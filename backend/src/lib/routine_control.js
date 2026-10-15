'use strict';
// AURA Area 75 — Routine & Link Control: ONE switchboard for every routine
// connected to the core ("Kern") and the brain tree ("Gehirn"), plus
// user-defined parallel links (Querverbindungen) between them.
// Every routine can be toggled on/off (persisted) and every link can be
// added/deleted at runtime — no restart, no syntax risk.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'routine_control.json');

// registry of ALL core/brain routines (static definitions, runtime state persisted)
const ROUTINES = [
  { id: 'autonomy-loop', name: 'Autonomy Loop (Self-Healing + Lernkurve)', area: '49', kind: 'core', def: true },
  { id: 'ops-scheduler', name: 'OPS Scheduler (Autosave/Sync-Zyklen)', area: 'ops', kind: 'core', def: true },
  { id: 'watcher', name: 'Hot-Reload Watcher (Data-Dateien)', area: '59', kind: 'core', def: true },
  { id: 'self-repair', name: 'Self-Repair Daemon (Logs + Heilung)', area: '66', kind: 'core', def: true },
  { id: 'report-daemon', name: 'Report-Daemon (täglich, Area 17)', area: '17', kind: 'core', def: false },
  { id: 'forge-tick', name: 'Content-Forge Routinen-Tick (Area 73)', area: '73', kind: 'brain', def: true },
  { id: 'telegram-agent', name: 'Telegram Agent Poller (Area 78)', area: '78', kind: 'core', def: false },
  { id: 'openrouter-pinger', name: 'OpenRouter Provider-Pinger', area: '06', kind: 'core', def: true },
];

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { toggles: {}, links: [] }; }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE);
}

function isEnabled(id) {
  const def = ROUTINES.find((r) => r.id === id);
  const db = load();
  if (typeof db.toggles[id] === 'boolean') return db.toggles[id];
  return def ? def.def : true;
}
function toggle(id, on) {
  const def = ROUTINES.find((r) => r.id === id);
  if (!def) { const e = new Error('unbekannte Routine "' + id + '" — verfügbar: ' + ROUTINES.map((r) => r.id).join(', ')); e.code = 404; throw e; }
  const db = load();
  db.toggles[id] = !!on;
  save(db);
  return { ok: true, routine: id, enabled: !!on };
}

// ---------- parallel links (Querverbindungen) ----------
// link = {id, name, from, to, on} — when source fires, it may trigger target.
// 'from'/'to' may be routine ids, workflow ids (WF-x / WF-Cxxx) or area ids.
function validTarget(t) { return /^[\w:-]{2,64}$/.test(String(t || '')); }
function addLink(input = {}) {
  const from = String(input.from || '').trim(), to = String(input.to || '').trim();
  if (!validTarget(from) || !validTarget(to)) { const e = new Error('from/to müssen gültige IDs sein (Buchstaben/Ziffern/-/_/:)'); e.code = 400; throw e; }
  if (from === to) { const e = new Error('Selbstverknüpfung nicht erlaubt'); e.code = 400; throw e; }
  const db = load();
  if (db.links.some((l) => l.from === from && l.to === to)) { const e = new Error('diese Verknüpfung existiert bereits'); e.code = 409; throw e; }
  if (db.links.length >= 64) { const e = new Error('max 64 Verknüpfungen'); e.code = 409; throw e; }
  const link = { id: 'lnk-' + crypto.randomBytes(3).toString('hex'), name: String(input.name || from + ' → ' + to).slice(0, 80), from, to, on: true, createdAt: new Date().toISOString() };
  db.links.push(link); save(db);
  return link;
}
function removeLink(id) {
  const db = load(); const n = db.links.length;
  db.links = db.links.filter((l) => l.id !== id);
  if (db.links.length === n) { const e = new Error('unknown link'); e.code = 404; throw e; }
  save(db); return { ok: true, removed: id };
}
function toggleLink(id, on) {
  const db = load(); const l = db.links.find((x) => x.id === id);
  if (!l) { const e = new Error('unknown link'); e.code = 404; throw e; }
  l.on = !!on; save(db); return l;
}
// called by any producer (forge routine, workflow run, daemon) — returns the
// enabled targets that should fire in parallel. Pure read, side-effect free.
function parallelTargets(sourceId) {
  const db = load();
  return db.links.filter((l) => l.on && l.from === sourceId).map((l) => l.to);
}
function links() { return load().links; }

function status() {
  const db = load();
  return {
    area: '75', mode: 'LIVE',
    note: 'zentrales Schaltbrett: jede Kern-/Gehirn-Routine einzeln on/off (persistiert) + parallele Verknüpfungen add/delete/toggle',
    routines: ROUTINES.map((r) => ({ ...r, enabled: isEnabled(r.id) })),
    links: db.links,
    consumers: 'server.js Tick · autonomy_loop · forge-Routinen · telegram-agent',
  };
}

module.exports = {
  meta: { area: '75', id: 'routine_control', name: 'Routine & Link Control (toggle on/off + add/delete)', state: 'live' },
  actions: {
    status: () => status(),
    toggle: (p) => toggle(String((p || {}).id), (p || {}).on),
    link_add: (p) => addLink(p || {}),
    link_remove: (p) => removeLink(String((p || {}).id)),
  },
  status, isEnabled, toggle, addLink, removeLink, toggleLink, parallelTargets, links, ROUTINES,
};
