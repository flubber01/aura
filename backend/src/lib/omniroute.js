'use strict';
// 58 · OmniRoute — MODEL router (OpenRouter cloud + Ollama/Unsloth local lanes)
// with health-based failover and budget caps. The FINANCIAL revenue-balancer
// variant stays REVIEW-GATED (area 31) — this module routes inference only.
const store = require('./store');
const config = require('./config');
let budget = { monthly_cap_eur: config.get('budget.monthly_cap_eur', 20), spent_eur: 0 };
let capOverridden = false; // set_budget() pins the cap; otherwise it tracks global config live
const capEur = () => (capOverridden ? budget.monthly_cap_eur : config.get('budget.monthly_cap_eur', budget.monthly_cap_eur));

const providers = () => [
  { id: 'unsloth_local', kind: 'local', egress_needed: false, configured: true, note: 'own authorized hardware lane' },
  { id: 'ollama_local', kind: 'local', egress_needed: false, configured: true, note: 'localhost:11434 when deployed' },
  { id: 'openrouter', kind: 'cloud', egress_needed: true, configured: Boolean(process.env.OPENROUTER_API_KEY), note: 'key only via secret manager' },
];

function route(payload) {
  const task = String(payload.task || '');
  const privateData = /private|personal|vita|internal/i.test(task);
  const heavy = /render|video|train|finetune|large/i.test(task);
  const P = providers();
  const order = privateData
    ? ['unsloth_local', 'ollama_local', 'openrouter']
    : heavy
      ? ['openrouter', 'unsloth_local', 'ollama_local']
      : ['ollama_local', 'unsloth_local', 'openrouter'];
  const chosen = order.map((id) => P.find((p) => p.id === id)).find((p) => {
    if (!p) return false;
    if (p.kind === 'cloud' && !p.configured) return false;
    if (p.kind === 'cloud' && budget.spent_eur >= capEur()) return false;
    return true;
  }) || P[0];
  const rec = { at: new Date().toISOString(), lane: chosen.id, reason: privateData ? 'data-private → local first' : heavy ? 'heavy → cloud if funded' : 'default local-first', failover: order };
  store.audit({ area: '58', event: 'route_decision', lane: chosen.id });
  return rec;
}

module.exports = {
  meta: { area: '58', id: 'omniroute', name: 'OmniRoute model router', state: 'live' },
  route, providers,
  set_budget: (p) => { budget = { monthly_cap_eur: Math.max(1, Number(p.cap_eur) || 20), spent_eur: Number(p.spent_eur) || 0 }; capOverridden = true; return budget; },
  status: () => ({ providers: providers(), budget, effective_cap_eur: capEur(), cap_source: capOverridden ? 'set_budget' : 'global config (live)', financial_balancer: 'REVIEW-GATED (area 31) — not active' }),
  actions: {
    route: (p) => route(p),
    status: () => module.exports.status(),
    set_budget: (p) => module.exports.set_budget(p),
  },
};
