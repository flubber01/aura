'use strict';
// AURA Area 77 — Test Lab: admin force-run harness with EXPECT-FAILURE view.
//
// Lets an admin force-run ANY live-module action with a custom payload, even
// right after failures: force=true resets the container fail counter first, so
// new/buggy modules stay modularly testable without taking anything down.
// expect='fail' flips the verdict: a controlled crash then counts as the
// EXPECTED outcome (shown, not hidden). Nothing here can kill the server —
// every run goes through Area 67 containers (timeout + isolation).
const crypto = require('crypto');

const ledger = []; // recent runs, capped

function lazy(name) { return require('./' + name); }

async function runOne(spec = {}) {
  const area = String(spec.area || '').trim();
  const action = String(spec.action || '').toLowerCase().trim();
  if (!/^\d{2,3}$/.test(area)) { const e = new Error('area muss zwei- oder dreistellig sein (z. B. 71 oder 100)'); e.code = 400; throw e; }
  const reg = lazy('registry');
  const found = reg.get(area);
  if (!found) { const e = new Error('unknown area ' + area); e.code = 404; throw e; }
  if (found.kind !== 'live') { const e = new Error('area ' + area + ' ist ' + found.kind + ' — nur live-Module sind force-runnbar'); e.code = 409; throw e; }
  const actions = found.mod.actions || {};
  if (!actions[action]) { const e = new Error('unknown action "' + action + '" — verfügbar: ' + Object.keys(actions).join(', ')); e.code = 404; throw e; }

  const containers = lazy('module_container');
  if (spec.force) containers.resetFails(area); // admin override: quarantine/fails zurücksetzen

  const expect = spec.expect === 'fail' ? 'fail' : 'ok';
  const t0 = Date.now();
  let actual, output, error = null;
  const cr = await containers.run(area, action, spec.payload || {});
  if (cr.ok) { actual = 'ok'; output = cr.result; }
  else { actual = 'fail'; error = cr.error || ('quarantined' in cr ? 'quarantined' : 'unknown container error'); output = cr; }
  const ms = Date.now() - t0;
  const entry = {
    id: 'run-' + crypto.randomBytes(3).toString('hex'),
    at: new Date().toISOString(), area, action, expect, actual,
    verdict: (expect === actual) ? 'MATCH ✔' : 'MISMATCH ✖',
    force: !!spec.force, ms, error,
    output_preview: JSON.stringify(output).slice(0, 300),
  };
  ledger.unshift(entry);
  if (ledger.length > 100) ledger.length = 100;
  return { ...entry, output };
}

// built-in suite: every live module's status action + honest verdicts
async function suite() {
  const reg = lazy('registry');
  const out = [];
  for (const m of reg.status().filter((x) => x.mode === 'live')) {
    const target = m.actions.includes('status') ? 'status' : (m.actions[0] || null);
    if (!target) { out.push({ area: m.area, name: m.name, action: null, verdict: 'SKIP', detail: 'keine Actions' }); continue; }
    try {
      const r = await runOne({ area: m.area, action: target, expect: 'ok', force: false });
      out.push({ area: m.area, name: m.name, action: target, verdict: r.verdict, ms: r.ms, detail: r.error || 'ok' });
    } catch (e) {
      out.push({ area: m.area, name: m.name, action: target, verdict: 'ERROR', detail: e.message });
    }
  }
  return { ran_at: new Date().toISOString(), total: out.length, mismatches: out.filter((x) => x.verdict === 'MISMATCH ✖').length, results: out };
}

function status() {
  return {
    area: '77', mode: 'LIVE',
    note: 'Admin-Testlab: force-run jeder Live-Action mit expect ok/fail — Fehlschläge werden GEZEIGT und isoliert, nie versteckt; force=true setzt Container-Fails zurück',
    recent_runs: ledger.slice(0, 20),
  };
}

module.exports = {
  meta: { area: '77', id: 'test_lab', name: 'Test Lab (force-run + expect-failure view)', state: 'live' },
  actions: { status: () => status(), run: (p) => runOne(p || {}), suite: () => suite() },
  status, runOne, suite, ledger: () => ledger.slice(0, 100),
};
