'use strict';
// AURA Agent Board — Kanban für Agenten (Rollen aus dem Skills-Registry).
//
// Was es tut:
// - Aufgaben landen in Spalten: backlog → assigned → in_progress → review → done.
//   Zusätzlich blocked, wenn ein Agent Hilfe aus einer anderen Abteilung braucht.
// - Zuweisung deterministisch: freie Rolle aus den benötigten Abteilungen mit der
//   geringsten Auslastung (WIP-Limit je Rolle). Keine LLM-Entscheidung.
// - Hilfe anfordern → Blocker mit Vorschlag einer Rolle aus der gewünschten Abteilung.
//   Übergabe (handoff) nur an Rollen, die zur Abteilung passen.
// - Freigabe: nur ein MENSCH schließt eine Aufgabe ab (review → done). Eine Rolle darf
//   sich nicht selbst freigeben. Direkt nach done springen geht nicht.
//
// Was es NICHT tut: Die Agenten führen die Arbeit hier nicht selbst aus. Das Ergebnis
// wird als Text eingetragen (von Mensch oder einem angebundenen Workflow). Keine
// externen Aufrufe. Schreibende Aktionen sind kill-gated (Server, 423).
const crypto = require('crypto');
const growthStore = require('./growth_store');
const registry = require('./registry');
const store = require('./store');

const COLUMNS = ['backlog', 'assigned', 'in_progress', 'blocked', 'review', 'done'];
const ACTIVE = ['assigned', 'in_progress', 'blocked', 'review'];
const WIP_LIMIT = 3;
const TRANSITIONS = {
  assign: { from: ['backlog', 'assigned'], to: 'assigned' },
  start: { from: ['assigned', 'blocked'], to: 'in_progress' },
  request_help: { from: ['in_progress'], to: 'blocked' },
  handoff: { from: ['blocked'], to: 'assigned' },
  submit: { from: ['in_progress'], to: 'review' },
  approve: { from: ['review'], to: 'done' },
  reject: { from: ['review'], to: 'in_progress' },
};

// ---------- Lesen ----------
function allRoles() {
  return registry.skills.roles().map((r) => ({ id: r.id, title: r.title, department: r.department, department_name: r.department_name, level: r.level }));
}
function departments() {
  return registry.skills.departments().map((d) => ({ id: d.id, name: d.name, color: d.color }));
}
const roleIds = () => new Set(allRoles().map((r) => r.id));
const deptIds = () => new Set(departments().map((d) => d.id));

function load() {
  const db = growthStore.load();
  if (!Array.isArray(db.board)) db.board = [];
  return db;
}
function persist(db) { growthStore.save(db); }

function activeCount(db, roleId) {
  return db.board.filter((t) => t.owner === roleId && ACTIVE.includes(t.status)).length;
}

function candidatesFor(db, needs, excludeRole) {
  const depts = new Set(needs);
  return allRoles()
    .filter((r) => (depts.has(r.department) || needs.includes(r.id)) && r.id !== excludeRole)
    .map((r) => ({ ...r, active: activeCount(db, r.id) }))
    .filter((r) => r.active < WIP_LIMIT)
    .sort((a, b) => a.active - b.active || a.id.localeCompare(b.id));
}

function board() {
  const db = load();
  const cols = Object.fromEntries(COLUMNS.map((c) => [c, []]));
  for (const t of db.board) cols[t.status].push(t);
  for (const c of COLUMNS) cols[c].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const roles = allRoles();
  const loadMap = Object.fromEntries(roles.map((r) => [r.id, activeCount(db, r.id)]));
  return {
    columns: COLUMNS,
    counts: Object.fromEntries(COLUMNS.map((c) => [c, cols[c].length])),
    tasks: cols,
    departments: departments(),
    roles: roles.map((r) => ({ ...r, active: loadMap[r.id], wip_limit: WIP_LIMIT })),
    wip_limit: WIP_LIMIT,
    rules: [
      'Aufgaben gehen nur in Reihenfolge durch: backlog → assigned → in_progress → review → done.',
      'Nur ein Mensch gibt frei (review → done). Eine Rolle darf sich nicht selbst freigeben.',
      `Jede Rolle hat höchstens ${WIP_LIMIT} aktive Aufgaben (WIP-Limit).`,
      'Die Agenten führen die Arbeit hier nicht selbst aus. Ergebnisse werden eingetragen.',
    ],
  };
}

// ---------- Schreiben ----------
const err = (status, error) => ({ ok: false, status, error });
const clip = (v, n) => String(v || '').trim().slice(0, n);

function audit(task, event, by, note) {
  task.history.push({ at: new Date().toISOString(), event, by: by || 'system', note: note || null, status: task.status, owner: task.owner });
  store.audit({ area: 'board', event: 'board_' + event, task: task.id, status: task.status });
}

function createTask(input = {}) {
  const title = clip(input.title, 120);
  const goal = clip(input.goal, 1000);
  const needs = Array.isArray(input.needs) ? input.needs.map(String) : [];
  if (title.length < 3) return err(400, 'title: mindestens 3 Zeichen');
  if (goal.length < 10) return err(400, 'goal: mindestens 10 Zeichen');
  if (needs.length < 1 || needs.length > 4) return err(400, 'needs: 1–4 Abteilungen angeben');
  const known = deptIds();
  const bad = needs.filter((n) => !known.has(n));
  if (bad.length) return err(422, 'unbekannte Abteilung: ' + bad.join(', '));
  const db = load();
  const task = {
    id: 'T-' + crypto.randomBytes(3).toString('hex'),
    title, goal, needs, status: 'backlog', owner: null, help_request: null, result: null,
    created_at: new Date().toISOString(), approved_by: null, history: [],
  };
  audit(task, 'created', 'human', title);
  db.board.push(task);
  persist(db);
  return { ok: true, status: 201, task };
}

function act(taskId, action, by, body = {}) {
  const db = load();
  const task = db.board.find((t) => t.id === taskId);
  if (!task) return err(404, 'Aufgabe nicht gefunden');
  const tr = TRANSITIONS[action];
  if (!tr) return err(400, 'unbekannte Aktion');
  if (!tr.from.includes(task.status)) return err(409, `Aktion "${action}" nicht erlaubt im Status "${task.status}"`);
  const roles = roleIds();

  if (action === 'assign') {
    const c = candidatesFor(db, task.needs, null)[0];
    if (!c) return err(409, 'Kein freier Agent mit passender Abteilung (WIP-Limit erreicht)');
    task.owner = c.id;
    task.status = tr.to;
    audit(task, 'assigned', 'system', `${c.title} (${c.department_name}), Auslastung ${c.active}/${WIP_LIMIT}`);
  } else if (action === 'start') {
    task.status = tr.to;
    audit(task, 'started', task.owner);
  } else if (action === 'request_help') {
    const dept = clip(body.dept, 40);
    const reason = clip(body.reason, 300);
    if (!deptIds().has(dept)) return err(422, 'dept: unbekannte Abteilung');
    if (reason.length < 5) return err(400, 'reason: mindestens 5 Zeichen');
    const sug = candidatesFor(db, [dept], task.owner)[0] || null;
    // Gelbe-Seiten-Vorschläge (nur lesend, Mensch entscheidet): Suche aus Grund und Abteilung.
    const yp = require('./yp_help').find(reason + ' ' + dept, 5);
    task.help_request = { dept, reason, suggested: sug ? sug.id : null, yellow_pages: yp, at: new Date().toISOString() };
    task.status = tr.to;
    audit(task, 'help_requested', task.owner, `${dept}: ${reason}`);
  } else if (action === 'handoff') {
    const to = clip(body.to_role, 60);
    if (!roles.has(to)) return err(422, 'to_role: unbekannte Rolle');
    const role = allRoles().find((r) => r.id === to);
    const hr = task.help_request; // Übergabe nur als Antwort auf eine Hilfsanfrage
    if (!hr) return err(409, 'Keine Hilfsanfrage offen');
    if (role.department !== hr.dept) return err(422, 'Rolle passt nicht zur angefragten Abteilung (' + hr.dept + ')');
    if (activeCount(db, to) >= WIP_LIMIT) return err(409, 'Rolle hat kein freies Kapazitätsfenster (WIP)');
    const from = task.owner;
    task.owner = to;
    task.help_request = null;
    task.status = tr.to;
    audit(task, 'handoff', from, `→ ${to}${body.note ? ': ' + clip(body.note, 200) : ''}`);
  } else if (action === 'submit') {
    const result = clip(body.result, 2000);
    if (result.length < 10) return err(400, 'result: mindestens 10 Zeichen');
    if (by !== task.owner) return err(403, 'Nur der zugewiesene Agent kann einreichen');
    task.result = result;
    task.status = tr.to;
    audit(task, 'submitted', by, result.slice(0, 200));
  } else if (action === 'approve') {
    const human = clip(body.by, 40);
    if (human.length < 2) return err(400, 'by: Name der freigebenden Person angeben');
    if (roles.has(human) || /agent|bot|system/i.test(human)) return err(403, 'Freigabe nur durch einen Menschen');
    task.approved_by = human;
    task.status = tr.to;
    audit(task, 'approved', human);
  } else if (action === 'reject') {
    const human = clip(body.by, 40);
    const note = clip(body.note, 300);
    if (human.length < 2) return err(400, 'by: Name der prüfenden Person angeben');
    if (note.length < 5) return err(400, 'note: Grund für die Rückgabe angeben');
    task.status = tr.to;
    audit(task, 'rejected', human, note);
  }
  persist(db);
  return { ok: true, status: 200, task };
}

module.exports = {
  meta: { area: 'AGENT-BOARD', id: 'agent_board', name: 'Agent Board (Kanban für Agenten)', state: 'live' },
  COLUMNS, WIP_LIMIT, TRANSITIONS,
  board, createTask, act, candidatesFor,
};
