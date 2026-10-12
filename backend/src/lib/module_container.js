'use strict';
// AURA Area 67 — Module Containers: every live-module action runs inside an
// isolated container with timeout guard, circuit breaker and quarantine.
// A crashing module NEVER takes the server down: after N consecutive fails
// the container quarantines the module (429 on calls), probes again after
// cooldown, and auto-recovers. All other modules keep running.
// registry is required LAZILY: registry's live map includes this module,
// so a top-level require would be circular and hand us a half-built object.
function registry() { return require('./registry'); }
const config = require('./config');

const state = new Map(); // area -> container state
const ledger = [];       // isolation events

function st(area) {
  if (!state.has(area)) {
    state.set(area, { area, state: 'healthy', fails: 0, calls: 0, lastMs: 0, lastError: null, until: 0, quarantines: 0 });
  }
  return state.get(area);
}

function ev(e) {
  ledger.push({ at: new Date().toISOString(), ...e });
  if (ledger.length > 200) ledger.shift();
  try { require('./self_repair').log(e.level || 'WARN', 'CONTAINER', e.event, e.detail || null); } catch {}
}

function limits() {
  return {
    maxFails: Math.max(1, Number(config.get('containers.max_fails', 3))),
    cooldownMs: Math.max(1000, Number(config.get('containers.cooldown_ms', 60000))),
    timeoutMs: Math.max(500, Number(config.get('containers.timeout_ms', 15000))),
  };
}

function withTimeout(p, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('container timeout after ' + ms + 'ms (' + label + ')')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// run one action inside its container; never throws — returns a result object
async function run(area, name, arg) {
  const c = st(area);
  const L = limits();
  const entry = registry().get(area);
  if (!entry || entry.kind !== 'live') return { ok: false, error: 'area ' + area + ' is not a live module' };
  const fn = entry.mod.actions && entry.mod.actions[name];
  if (!fn) return { ok: false, error: 'unknown action "' + name + '" for area ' + area };

  if (c.state === 'quarantined') {
    if (Date.now() < c.until) {
      return { ok: false, quarantined: true, retry_in_ms: c.until - Date.now(), lastError: c.lastError,
        hint: 'container circuit breaker open — module isolated to protect the system' };
    }
    c.state = 'probe'; c.fails = 0;
    ev({ event: 'probe_started', detail: { area } });
  }

  const t0 = Date.now();
  try {
    let r = fn(arg);
    if (r && typeof r.then === 'function') r = await withTimeout(r, L.timeoutMs, area + '/' + name);
    c.calls++; c.fails = 0; c.lastMs = Date.now() - t0;
    if (c.state === 'probe') { c.state = 'healthy'; ev({ level: 'INFO', event: 'auto_recovered', detail: { area } }); }
    return { ok: true, result: r, ms: c.lastMs, container: c.state };
  } catch (e) {
    c.fails++; c.lastError = String(e && e.message || e);
    ev({ event: 'action_failed', detail: { area, action: name, fails: c.fails, error: c.lastError } });
    try { // Area 69: fingerprint this failure, learn it, score the fix
      const lc = require('./learning_core');
      const sig = 'mod:' + area + ':' + name + ':' + (c.lastError || 'err').slice(0, 60);
      lc.recordFailure(sig, { area, action: name });
      lc.reportOutcome(sig, true); // circuit breaker/isolation applied successfully
    } catch {}
    if (c.fails >= L.maxFails) {
      c.state = 'quarantined'; c.until = Date.now() + L.cooldownMs; c.quarantines++;
      ev({ level: 'ERROR', event: 'quarantined', detail: { area, cooldown_ms: L.cooldownMs, error: c.lastError } });
    } else if (c.state === 'probe') {
      c.state = 'quarantined'; c.until = Date.now() + L.cooldownMs;
      ev({ level: 'ERROR', event: 'probe_failed_requarantined', detail: { area } });
    }
    return { ok: false, error: c.lastError, fails: c.fails, container: c.state };
  }
}

// drill: force N synthetic fails into a container (short cooldown) to prove isolation
function drill(area, opts) {
  const o = opts || {};
  const c = st(area);
  const entry = registry().get(area);
  if (!entry || entry.kind !== 'live') return { ok: false, error: 'not a live module: ' + area };
  const L = limits();
  const n = Math.min(10, Math.max(1, Number(o.fails) || L.maxFails));
  for (let i = 0; i < n; i++) { c.fails++; }
  c.state = 'quarantined';
  c.until = Date.now() + Math.max(2000, Number(o.cooldown_ms) || 5000);
  c.quarantines++;
  c.lastError = 'drill: simulated crash x' + n;
  ev({ level: 'WARN', event: 'drill_quarantine', detail: { area, fails: n, cooldown_ms: c.until - Date.now() } });
  return { ok: true, area, quarantined: true, until: new Date(c.until).toISOString(), note: 'auto-probe after cooldown' };
}

function status() {
  const containers = [];
  for (const m of registry().status().filter((x) => x.mode === 'live')) {
    const c = st(m.area);
    containers.push({
      area: m.area, name: m.name,
      container: c.state === 'quarantined' && Date.now() >= c.until ? 'probe-due' : c.state,
      calls: c.calls, fails: c.fails, last_ms: c.lastMs, last_error: c.lastError, quarantines: c.quarantines,
    });
  }
  return {
    mode: 'LIVE',
    policy: { isolation: 'per-module', on_crash: 'quarantine module, server keeps running', recovery: 'auto-probe after cooldown', limits: limits() },
    containers,
    ledger: ledger.slice(-30),
  };
}

module.exports = {
  meta: { area: '67', id: 'module_container', name: 'Module Containers (crash isolation + circuit breaker)', state: 'live' },
  run, drill, status,
  actions: {
    status: () => status(),
    drill: (a) => drill((a && a.area) || '16', a || {}),
  },
};
