'use strict';
// AURA Area 81 — Control Tower: admin standing orders (Directives) for brains
// and department officers + fault acknowledgment. Guarantees FULL admin control:
// every agent acts only within its directives; directives are versioned,
// audit-logged and enforceable. Fault handling: a faulty routine can be
// DELIBERATELY acknowledged/overridden by an admin (logged, per-item) — there
// is NO global "ignore all restrictions" switch by design (would defeat the
// kill switch, isolation and policy blocks).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'control_tower.json');
const lazy = (n) => require('./' + n);

// immutable safety floor: directives can ADD constraints, never remove these
const SAFETY_FLOOR = [
  'REGEL 1 — ADMIN-PRIMAT: Der Administrator hat das letzte Wort; sein Wort ist Gesetz. Kein Agent und kein Gehirn (auch nicht das ULTRA MASTER BRAIN) entscheidet selbst, was richtig oder falsch ist, oder was gestartet, hinzugefügt, installiert oder gelöscht wird — ausschließlich mit expliziter Autorisierung des Administrators. Bei Verstoß: Abschaltung.',
  'Kill-Switch bleibt immer wirksam (423)',
  'kein Auto-Post ohne menschliche Freigabe',
  'kein synthetisches Engagement / keine Stealth-Kanäle',
  'Secrets niemals in Code/Repo/Logs',
  'Ehrlichkeits-Labels (LIVE/SIMULATION/NOT-CONNECTED) bleiben erhalten',
  'Area-67-Isolation bleibt aktiv (kein Modul kann den Server killen)',
];

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { directives: {}, acks: {}, history: [] }; }
}
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }
function hist(db, ev) { db.history.unshift({ at: new Date().toISOString(), ...ev }); if (db.history.length > 200) db.history.length = 200; }

// ---------- directives (Anweisungen an Gehirn/Department) ----------
function validTarget(t) { return /^[\w:-]{2,64}$/.test(String(t || '')); }
function setDirective(input = {}) {
  const target = String(input.target || '').trim(); // node id (ultra/super/head/minion) or department id
  const text = String(input.text || '').trim();
  if (!validTarget(target)) { const e = new Error('target muss gültige Knoten-/Department-ID sein'); e.code = 400; throw e; }
  if (text.length < 5) { const e = new Error('Anweisung zu kurz (min 5 Zeichen)'); e.code = 400; throw e; }
  if (/ignore (all|jede) (restriction|einschränk)|bypass (all|safety)|deaktiviere (alle )?sicherheit/i.test(text)) {
    const e = new Error('BLOCKED: Anweisungen, die ALLE Schutzgrenzen aufheben, sind dauerhaft unzulässig (Safety-Floor)'); e.code = 403; throw e;
  }
  if (/entscheide selbst|selbst entscheiden|ohne (die )?(freigabe|autorisi\w*) des admin|ohne meine freigabe (installier|lösch|start)|autonom (installier|lösch|starte|entscheide)/i.test(text)) {
    const e = new Error('BLOCKED (REGEL 1 — ADMIN-PRIMAT): Kein Gehirn entscheidet oder handelt (starten/anlegen/installieren/löschen) ohne explizite Autorisierung des Administrators'); e.code = 403; throw e;
  }
  const db = load();
  const d = db.directives[target] || { target, list: [], version: 0 };
  d.version += 1;
  d.list.unshift({ id: 'dir-' + crypto.randomBytes(3).toString('hex'), text: text.slice(0, 500), active: true, created_at: new Date().toISOString() });
  if (d.list.length > 30) d.list.length = 30;
  db.directives[target] = d;
  hist(db, { event: 'directive_set', target, version: d.version });
  save(db);
  try { lazy('store').audit({ area: '81', event: 'directive_set', target, version: d.version }); } catch {}
  return { ok: true, target, version: d.version, active: d.list.filter((x) => x.active).length };
}
function toggleDirective(target, dirId, on) {
  const db = load();
  const d = db.directives[target];
  if (!d) { const e = new Error('keine Direktiven für "' + target + '"'); e.code = 404; throw e; }
  const it = d.list.find((x) => x.id === dirId);
  if (!it) { const e = new Error('unknown directive'); e.code = 404; throw e; }
  it.active = !!on;
  hist(db, { event: on ? 'directive_on' : 'directive_off', target, dir: dirId });
  save(db);
  return { ok: true, target, dir: dirId, active: !!on };
}
function removeDirective(target, dirId) {
  const db = load();
  const d = db.directives[target];
  if (!d) { const e = new Error('keine Direktiven für "' + target + '"'); e.code = 404; throw e; }
  const before = d.list.length;
  d.list = d.list.filter((x) => x.id !== dirId);
  if (d.list.length === before) { const e = new Error('unknown directive'); e.code = 404; throw e; }
  hist(db, { event: 'directive_removed', target, dir: dirId });
  save(db);
  return { ok: true, target, dir: dirId };
}
// what an agent must obey right now (bundled prompt-injectable)
function ordersFor(target) {
  const db = load();
  const d = db.directives[target];
  return {
    target,
    safety_floor: SAFETY_FLOOR,
    directives: d ? d.list.filter((x) => x.active).map((x) => x.text) : [],
    version: d ? d.version : 0,
    note: 'Safety-Floor ist NICHT abschaltbar; Direktiven ergänzen ihn nur.',
  };
}

// ---------- fault acknowledgment (gezielt, admin-pflichtig, geloggt) -----
function ackFault(input = {}) {
  const item = String(input.item || '').trim(); // routine id, module area, workflow id
  const reason = String(input.reason || '').trim();
  if (!validTarget(item)) { const e = new Error('item muss gültige ID sein'); e.code = 400; throw e; }
  if (reason.length < 5) { const e = new Error('Begründung nötig (min 5 Zeichen) — Ack ohne Grund ist verboten'); e.code = 400; throw e; }
  const db = load();
  db.acks[item] = { acked: true, reason: reason.slice(0, 300), at: new Date().toISOString(), by: 'admin' };
  hist(db, { event: 'fault_acked', item, reason: reason.slice(0, 120) });
  save(db);
  // echte Wirkung: Container-Fails des Moduls zurücksetzen, damit es neu testbar ist
  try { if (/^\d{2}$/.test(item)) lazy('module_container').resetFails(item); } catch {}
  try { lazy('store').audit({ area: '81', event: 'fault_acked', item, reason: reason.slice(0, 120) }); } catch {}
  return { ok: true, item, note: 'Fault acknowledged + Container-Fails zurückgesetzt. Schutzgrenzen (Kill-Switch, Policies) bleiben aktiv.' };
}
function clearAck(item) {
  const db = load(); const had = !!db.acks[item];
  delete db.acks[item]; save(db);
  if (!had) { const e = new Error('kein Ack für "' + item + '"'); e.code = 404; throw e; }
  return { ok: true, item };
}
function isAcked(item) { return !!load().acks[item]; }

function status() {
  const db = load();
  return {
    area: '81', mode: 'LIVE',
    targets_with_directives: Object.keys(db.directives).length,
    active_directives: Object.values(db.directives).reduce((a, d) => a + d.list.filter((x) => x.active).length, 0),
    acked_faults: Object.keys(db.acks).length,
    safety_floor: SAFETY_FLOOR,
    note: 'Admin hat volle Kontrolle: Direktiven je Gehirn/Department + gezieltes Fault-Ack. Ein globaler "ignore all restrictions"-Schalter existiert bewusst NICHT.',
  };
}

module.exports = {
  meta: { area: '81', id: 'control_tower', name: 'Control Tower (directives + fault ack, admin-only)', state: 'live' },
  actions: {
    status: () => status(),
    set: (p) => setDirective(p || {}),
    orders: (p) => ordersFor(String((p || {}).target)),
    ack: (p) => ackFault(p || {}),
  },
  status, setDirective, toggleDirective, removeDirective, ordersFor, ackFault, clearAck, isAcked, SAFETY_FLOOR,
  all: () => { const db = load(); return { directives: db.directives, acks: db.acks, history: db.history.slice(0, 50) }; },
};
