'use strict';
// AURA Area 65 — honest traffic telemetry: REAL request counts per route,
// measured in-process. Mode LIVE. Replaces any "traffic bot" concept:
// we report what actually happens, never fabricate or inflate numbers.
const hits = new Map();   // route -> { n, last }
const timeline = [];      // { at } timestamps, capped
const CAP = 5000;
let total = 0;

function record(route) {
  if (!route) return;
  const r = route.startsWith('/api/') ? '/api/*' : route; // bucket APIs
  const e = hits.get(r) || { n: 0, last: null };
  e.n += 1; e.last = new Date().toISOString();
  hits.set(r, e);
  total += 1;
  timeline.push(Date.now());
  if (timeline.length > CAP) timeline.splice(0, timeline.length - CAP);
}

function rpm() { // hits in the last 60s
  const cut = Date.now() - 60000;
  while (timeline.length && timeline[0] < cut) timeline.shift();
  return timeline.length;
}

function report() {
  const routes = [...hits.entries()].map(([route, e]) => ({ route, hits: e.n, last: e.last }))
    .sort((a, b) => b.hits - a.hits);
  return {
    mode: 'LIVE', note: 'real measured requests since boot — no bots, no inflation',
    totalRequests: total, lastMinute: rpm(), uniqueRoutes: routes.length,
    top: routes.slice(0, 20), all: routes,
  };
}

module.exports = {
  meta: { area: '65', id: 'traffic', name: 'Honest traffic telemetry (real counts, no bots)', state: 'live' },
  record, report,
  actions: { status: () => ({ total: total, lastMinute: rpm(), routes: hits.size }) },
};
