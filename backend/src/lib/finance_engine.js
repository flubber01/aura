'use strict';
// AURA Area 31 — OmniRoute Financial Engine (LIVE, sicher redesign).
// Kein Trading, keine Spekulation: echtes Kosten-/Budget-Ledger über reale
// OmniRoute-Nutzung (Area 58) mit konfigurierbaren Sätzen und Budget-Alarmen.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'finance.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { budgets: {}, ledger: [], rates: { default_per_1k_tokens_usd: 0.002 } }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function setBudget(body) {
  const scope = String((body || {}).scope || 'global').slice(0, 60);
  const usd = Number(body.usd);
  if (!Number.isFinite(usd) || usd <= 0) { const e = new Error('usd muss > 0 sein'); e.code = 400; throw e; }
  const db = load(); db.budgets[scope] = { usd, set_at: new Date().toISOString() }; save(db);
  return { ok: true, scope, usd };
}
function setRates(body) {
  const db = load();
  db.rates = { ...db.rates, ...(body || {}) };
  save(db);
  return { ok: true, rates: db.rates };
}
function recordUsage(body) {
  const db = load();
  const route = String((body || {}).route || 'unknown').slice(0, 60);
  const tokens = Math.max(0, parseInt(body.tokens || 0, 10));
  const rate = Number((db.rates || {})[route + '_per_1k_tokens_usd']) || Number(db.rates.default_per_1k_tokens_usd) || 0.002;
  const cost = Math.round((tokens / 1000) * rate * 1e6) / 1e6;
  const entry = { id: 'led-' + Date.now().toString(36), at: new Date().toISOString(), route, tokens, rate, cost_usd: cost };
  db.ledger.push(entry); if (db.ledger.length > 2000) db.ledger = db.ledger.slice(-2000);
  // Budget-Alarm prüfen
  const spent = spend(db).total_usd;
  const alarm = db.budgets.global && spent > db.budgets.global.usd;
  save(db);
  return { ok: true, entry, spent_total_usd: spent, budget_alarm: alarm ? { scope: 'global', budget: db.budgets.global.usd, spent } : null };
}
function spend(db) {
  db = db || load();
  const total = db.ledger.reduce((s, e) => s + e.cost_usd, 0);
  const byRoute = {};
  for (const e of db.ledger) byRoute[e.route] = Math.round(((byRoute[e.route] || 0) + e.cost_usd) * 1e6) / 1e6;
  return { total_usd: Math.round(total * 1e6) / 1e6, by_route: byRoute, entries: db.ledger.length };
}
function status() {
  const db = load();
  const s = spend(db);
  return { area: '31', mode: 'LIVE', scope: 'Kosten-Ledger & Budgets (KEIN Trading)', budgets: db.budgets, spent: s, rates: db.rates, crosslink: 'Verbrauchswerte aus OmniRoute Area 58' };
}

module.exports = {
  meta: { area: '31', id: 'finance_engine', name: 'OmniRoute financial engine (cost ledger + budgets, no trading)', state: 'live' },
  actions: { status: () => status(), budget: (p) => setBudget(p || {}), rates: (p) => setRates(p || {}), usage: (p) => recordUsage(p || {}), spend: () => spend() },
  status, setBudget, setRates, recordUsage, spend,
};
