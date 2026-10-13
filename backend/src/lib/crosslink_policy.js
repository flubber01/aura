'use strict';
// AURA Area 82 — Cross-link Policy: for EVERY module the admin can freely
// ALLOW or RESTRICT new cross-connections (Querverbindungen). Default policy
// is 'allow with audit'; restricted modules refuse new links with 403.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'crosslink_policy.json');
const lazy = (n) => require('./' + n);

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { default: 'allow', per_module: {}, log: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }
function log(db, ev) { db.log.unshift({ at: new Date().toISOString(), ...ev }); if (db.log.length > 200) db.log.length = 200; }

function policyFor(moduleId) {
  const db = load();
  return db.per_module[moduleId] || db.default; // 'allow' | 'restrict'
}
function setPolicy(moduleId, mode) {
  if (!['allow', 'restrict'].includes(mode)) { const e = new Error('mode muss allow|restrict sein'); e.code = 400; throw e; }
  if (!/^[\w:-]{2,64}$/.test(String(moduleId))) { const e = new Error('ungültige Modul-ID'); e.code = 400; throw e; }
  const db = load();
  db.per_module[moduleId] = mode;
  log(db, { event: 'policy_set', module: moduleId, mode });
  save(db);
  return { ok: true, module: moduleId, mode };
}
// gate used by any producer before creating a NEW cross-link
function permitNewLink(moduleId, detail) {
  const p = policyFor(moduleId);
  const db = load();
  if (p === 'restrict') {
    log(db, { event: 'link_denied', module: moduleId, detail: String(detail || '').slice(0, 120) });
    save(db);
    const e = new Error('RESTRICTED: neue Querverbindungen für "' + moduleId + '" sind durch die Crosslink-Policy gesperrt'); e.code = 403; throw e;
  }
  log(db, { event: 'link_permitted', module: moduleId, detail: String(detail || '').slice(0, 120) });
  save(db);
  return { ok: true, module: moduleId, policy: 'allow' };
}
function overview() {
  const db = load();
  const reg = lazy('registry');
  const mods = reg.status().filter((m) => m.mode === 'live');
  return {
    default: db.default,
    modules: mods.map((m) => ({ area: m.area, id: m.area, name: m.name, policy: db.per_module[m.area] || db.default })),
    recent: db.log.slice(0, 30),
  };
}
function status() {
  const db = load();
  const restricted = Object.entries(db.per_module).filter(([, v]) => v === 'restrict').length;
  return { area: '82', mode: 'LIVE', default_policy: db.default, restricted_modules: restricted, note: 'je Modul frei allow/restrict schaltbar; neue Querverbindungen werden gegen die Policy geprüft und audit-loggiert' };
}

module.exports = {
  meta: { area: '82', id: 'crosslink_policy', name: 'Cross-link Policy (allow/restrict per module)', state: 'live' },
  actions: { status: () => status(), overview: () => overview(), set: (p) => setPolicy(String((p || {}).module), String((p || {}).mode)) },
  status, overview, setPolicy, permitNewLink, policyFor,
};
