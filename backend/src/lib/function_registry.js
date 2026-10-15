'use strict';
// AURA Area 83 — Function Capability Registry: admins can ADD, IGNORE or
// DELETE backend functions/capabilities. Safety against accidental deletion:
// every delete needs an explicit confirmation token, and deletion is SOFT —
// the function is marked 'deleted' and can be restored; nothing hard-crashes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'function_registry.json');

// seed: core capabilities that exist in the backend (visible + manageable)
const CORE = [
  { id: 'fn-health', name: 'Health-Check', scope: 'core' },
  { id: 'fn-report', name: 'Tages-Report', scope: 'core' },
  { id: 'fn-backup', name: 'Backup-Vault Snapshot', scope: 'core' },
  { id: 'fn-selfrepair', name: 'Self-Repair Daemon', scope: 'core' },
  { id: 'fn-killswitch', name: 'Kill-Switch', scope: 'core', protected: true },
  { id: 'fn-restart', name: 'Server-Restart', scope: 'core' },
  { id: 'fn-forge', name: 'Content Forge', scope: 'area73' },
  { id: 'fn-studio', name: 'Studio-Suite', scope: 'area76' },
  { id: 'fn-mcp', name: 'MCP-Manager', scope: 'area72' },
  { id: 'fn-telegram', name: 'Telegram-Agent', scope: 'area78' },
];

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { functions: CORE.map((c) => ({ ...c, state: 'active', created_at: new Date().toISOString(), custom: false })), log: [] }; }
}
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }
function log(db, ev) { db.log.unshift({ at: new Date().toISOString(), ...ev }); if (db.log.length > 200) db.log.length = 200; }

function list() { return load().functions; }

function add(input = {}) {
  const name = String(input.name || '').trim();
  if (name.length < 3) { const e = new Error('name required (min 3)'); e.code = 400; throw e; }
  const db = load();
  const id = 'fn-' + crypto.randomBytes(3).toString('hex');
  db.functions.push({ id, name: name.slice(0, 80), scope: String(input.scope || 'custom').slice(0, 40), state: 'active', custom: true, created_at: new Date().toISOString() });
  log(db, { event: 'fn_added', id, name });
  save(db);
  return { ok: true, id, name };
}
function setState(id, state) {
  if (!['active', 'ignored'].includes(state)) { const e = new Error('state muss active|ignored sein'); e.code = 400; throw e; }
  const db = load();
  const f = db.functions.find((x) => x.id === id);
  if (!f) { const e = new Error('unknown function "' + id + '"'); e.code = 404; throw e; }
  f.state = state;
  log(db, { event: state === 'ignored' ? 'fn_ignored' : 'fn_reactivated', id });
  save(db);
  return { ok: true, id, state };
}
// SOFT delete with mandatory confirmation token — prevents accidental loss
function requestDelete(id) {
  const db = load();
  const f = db.functions.find((x) => x.id === id);
  if (!f) { const e = new Error('unknown function "' + id + '"'); e.code = 404; throw e; }
  if (f.protected) { const e = new Error('PROTECTED: "' + f.name + '" ist sicherheitskritisch und kann nicht gelöscht werden (nur ignorieren)'); e.code = 403; throw e; }
  const token = crypto.randomBytes(4).toString('hex').toUpperCase();
  return {
    ok: false, requires_confirmation: true, token,
    warning: '⚠ WARNUNG: Du löschst die Funktion "' + f.name + '". Sie wird als gelöscht markiert (wiederherstellbar). Bestätige mit confirm + token ' + token + '.',
  };
}
function confirmDelete(id, token) {
  const db = load();
  const f = db.functions.find((x) => x.id === id);
  if (!f) { const e = new Error('unknown function "' + id + '"'); e.code = 404; throw e; }
  if (f.protected) { const e = new Error('PROTECTED: sicherheitskritische Funktion'); e.code = 403; throw e; }
  if (f.pending_token !== token) { const e = new Error('ungültiger/fehlender Bestätigungs-Token — Löschung abgebrochen (Unfall-Schutz)'); e.code = 400; throw e; }
  f.state = 'deleted'; delete f.pending_token; f.deleted_at = new Date().toISOString();
  log(db, { event: 'fn_deleted_soft', id });
  save(db);
  return { ok: true, id, state: 'deleted', note: 'SOFT-Delete: mit restore wiederherstellbar — kein Crash, nichts endgültig verloren' };
}
function deleteFn(id, token) {
  const db = load();
  const f = db.functions.find((x) => x.id === id);
  if (!f) { const e = new Error('unknown function "' + id + '"'); e.code = 404; throw e; }
  if (f.protected) { const e = new Error('PROTECTED: sicherheitskritische Funktion'); e.code = 403; throw e; }
  if (token) return confirmDelete(id, token); // zweiter Aufruf: gegen bestehenden Pending-Token prüfen
  // erster Aufruf: Warnung + frischen Token ausstellen
  const req = requestDelete(id);
  f.pending_token = req.token; save(db);
  return req;
}
function restore(id) {
  const db = load();
  const f = db.functions.find((x) => x.id === id);
  if (!f) { const e = new Error('unknown function "' + id + '"'); e.code = 404; throw e; }
  f.state = 'active'; delete f.deleted_at; delete f.pending_token;
  log(db, { event: 'fn_restored', id });
  save(db);
  return { ok: true, id, state: 'active' };
}

function status() {
  const db = load();
  const by = (s) => db.functions.filter((f) => f.state === s).length;
  return { area: '83', mode: 'LIVE', functions: db.functions.length, active: by('active'), ignored: by('ignored'), deleted: by('deleted'), note: 'Delete ist SOFT + Token-pflichtig (Unfall-Schutz); sicherheitskritische Funktionen sind geschützt.' };
}

module.exports = {
  meta: { area: '83', id: 'function_registry', name: 'Function Registry (add/ignore/soft-delete + warnings)', state: 'live' },
  actions: {
    status: () => status(), list: () => list(),
    add: (p) => add(p || {}),
    ignore: (p) => setState(String((p || {}).id), 'ignored'),
    reactivate: (p) => setState(String((p || {}).id), 'active'),
    delete: (p) => deleteFn(String((p || {}).id), (p || {}).token),
    restore: (p) => restore(String((p || {}).id)),
  },
  status, list, add, setState, deleteFn, restore,
};
