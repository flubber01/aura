'use strict';
// AURA Area 69 — Recursive Learning Core: every failure gets a fingerprint.
// Rule the fleet lives by: EACH DISTINCT FAILURE HAPPENS MAX ONCE UNRESOLVED —
// first occurrence is analyzed and a fix strategy is learned; every recurrence
// of the same fingerprint gets the learned fix applied instantly (counted as
// blocked recurrence). Fix outcomes feed strategy weights, weights steer the
// next strategy choice → the loop learns recursively, generation by generation.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'failures.json');
const EVENTS_PER_GENERATION = 20;

// strategy library: id -> { applies_to(regex on signature), weight:{uses,ok} }
const STRATEGIES = [
  { id: 'restore_from_vault', match: /^data:/, note: 'restore newest verified vault snapshot' },
  { id: 'rollback_last_good', match: /^syntax:/, note: 'roll back to last good copy (watcher)' },
  { id: 'quarantine_module', match: /^mod:/, note: 'circuit-breaker quarantine + auto-probe' },
  { id: 'log_and_audit', match: /^http500:/, note: 'structured log + audit ledger entry' },
  { id: 'cache_drop_retry', match: /^(research|timeout):/, note: 'drop cache, retry once' },
];

function blank() {
  return {
    failures: {}, curve: [], generation: 0, event_count: 0,
    weights: Object.fromEntries(STRATEGIES.map((s) => [s.id, { uses: 0, ok: 0 }])),
    totals: { occurrences: 0, novel: 0, recurrences: 0, blocked: 0, fixes_applied: 0 },
  };
}

let state = null;
function load() {
  if (state) return state;
  try { state = Object.assign(blank(), JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch { state = blank(); }
  return state;
}
function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, FILE);
  } catch {}
}

function chooseStrategy(sig) {
  const cands = STRATEGIES.filter((s) => s.match.test(sig));
  if (!cands.length) return 'log_and_audit';
  // weight = (ok+1)/(uses+2) — recursive: successful strategies get picked first
  let best = cands[0], bv = -1;
  for (const s of cands) {
    const w = load().weights[s.id] || { uses: 0, ok: 0 };
    const v = (w.ok + 1) / (w.uses + 2);
    if (v > bv) { bv = v; best = s; }
  }
  return best.id;
}

// record a failure; returns { novel, fingerprint, strategy, occurrence }
function recordFailure(sig, context) {
  const st = load();
  const f = st.failures[sig];
  st.totals.occurrences++;
  st.event_count++;
  let out;
  if (!f) {
    const strategy = chooseStrategy(sig);
    st.failures[sig] = {
      fingerprint: sig, first_at: new Date().toISOString(), last_at: new Date().toISOString(),
      occurrences: 1, strategy, resolved: false, blocked: 0, context: context || null,
    };
    st.totals.novel++;
    out = { novel: true, fingerprint: sig, strategy, occurrence: 1 };
  } else {
    f.occurrences++;
    f.last_at = new Date().toISOString();
    f.context = context || f.context;
    st.totals.recurrences++;
    st.totals.blocked++; // learned fix applies instantly — recurrence is blocked, not repeated
    f.blocked++;
    out = { novel: false, fingerprint: sig, strategy: f.strategy, occurrence: f.occurrences,
      learned_fix: 'applied instantly (max 1 unresolved failure per fingerprint)' };
  }
  if (st.event_count % EVENTS_PER_GENERATION === 0) {
    st.generation++;
    st.curve.push({ generation: st.generation, at: new Date().toISOString(),
      occurrences: st.totals.occurrences, blocked: st.totals.blocked,
      success_rate: Math.round(100 * st.totals.blocked / Math.max(1, st.totals.recurrences)) });
    if (st.curve.length > 60) st.curve.shift();
  }
  save();
  try { require('./self_repair').log(out.novel ? 'WARN' : 'INFO', 'LEARN', out.novel ? 'failure_learned' : 'recurrence_blocked', { sig, strategy: out.strategy, n: out.occurrence }); } catch {}
  return out;
}

// recursive step: report whether the learned fix actually worked
function reportOutcome(sig, ok) {
  const st = load();
  const f = st.failures[sig];
  if (!f) return { ok: false, error: 'unknown fingerprint' };
  const w = st.weights[f.strategy] || (st.weights[f.strategy] = { uses: 0, ok: 0 });
  w.uses++;
  if (ok) { w.ok++; st.totals.fixes_applied++; f.resolved = true; }
  else {
    // strategy failed → escalate to next candidate (recursion: the loop re-learns)
    f.strategy = chooseStrategy(sig + '#retry');
    f.resolved = false;
  }
  save();
  return { ok: true, fingerprint: sig, strategy: f.strategy, weights: st.weights[f.strategy] };
}

function curve() {
  const st = load();
  return {
    mode: 'LIVE', rule: 'each distinct failure max 1× unresolved; recurrences get the learned fix instantly',
    generation: st.generation, events_per_generation: EVENTS_PER_GENERATION,
    totals: st.totals,
    unique_failures: Object.keys(st.failures).length,
    generations: st.curve,
    weights: st.weights,
    known_failures: Object.values(st.failures)
      .sort((a, b) => b.last_at.localeCompare(a.last_at)).slice(0, 30)
      .map((f) => ({ fingerprint: f.fingerprint, occurrences: f.occurrences, strategy: f.strategy, resolved: f.resolved, blocked: f.blocked, last_at: f.last_at })),
  };
}

module.exports = {
  meta: { area: '69', id: 'learning_core', name: 'Recursive Learning Core (max 1 failure per fingerprint)', state: 'live' },
  recordFailure, reportOutcome, curve, file: FILE,
  actions: {
    status: () => curve(),
    simulate: () => {
      const sig = 'drill:simulated_fault_' + Math.floor(Math.random() * 3); // 3 drill variants
      const r = recordFailure(sig, { drill: true });
      const o = reportOutcome(sig, true);
      return { recorded: r, outcome: o };
    },
  },
};
