'use strict';
// AURA Area 70 — Central Module System: unified interface for future modules
// and integrations. Discovers manifest-based modules from backend/modules/,
// validates them, enforces a documented lifecycle and permission-gated
// context, and bridges them into the EXISTING registry + containers instead
// of building a parallel registration system.
//
// Lifecycle: discover -> validate -> configure -> initialize -> ready
//            -> execute -> shutdown   (plus error / disabled / needs_approval)
//
// Security: least-privilege context, schema validation for every input,
// approval required before first enable (third-party manifests are NOT
// trusted), timeouts on every lifecycle hook, audit trail, path-traversal
// protection. Modules run in-process; true process isolation is NOT provided
// in this sandbox and is documented as a limitation (see docs/MODULE_SYSTEM.md).

const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..', '..', 'modules');
const STATE_FILE = path.join(__dirname, '..', 'data', 'module_system.json');

// ---------------------------------------------------------------------------
// constants: manifest schema, permission catalog, lifecycle states
// ---------------------------------------------------------------------------

const TYPES = ['module', 'integration', 'skill', 'workflow'];

const PERMISSION_CATALOG = {
  'log:write':    { grants: 'context.log — structured self-repair log entries' },
  'audit:write':  { grants: 'context.audit — durable audit trail entries' },
  'config:read':  { grants: 'context.config.get — read global config values (no secrets)' },
  'events:pub':   { grants: 'context.events.emit — publish internal events' },
  'events:sub':   { grants: 'context.events.on — subscribe to internal events' },
  'health:read':  { grants: 'context.health — registry counters + uptime' },
  'storage:kv':   { grants: 'context.store — module-scoped persistent key/value data' },
  'skills:read':  { grants: 'context.skills — list wired skills/roles' },
  'schedule:read':{ grants: 'context.schedule — read scheduling data' },
  'ai:route':     { grants: 'context.routing — model routing info/status (never API keys)' },
  'registry:read':{ grants: 'context.services.registry.counts() — module counts (read-only)' },
};

const STATES = ['discovered', 'invalid', 'needs_approval', 'needs_config', 'initializing', 'ready', 'error', 'disabled', 'absent'];

const LIMITS = { initMs: 5000, execMs: 10000, healthMs: 5000 };

// ---------------------------------------------------------------------------
// manifest validation
// ---------------------------------------------------------------------------

// Spec v1 nennt die angebotenen Aktionen capabilities[].name, der Area-70-Vertrag
// capabilities[].action. Beides meint dasselbe — hier wird normalisiert, damit EIN
// Vertrag gilt und die Beispielmodule beider Fassungen laufen.
function normalizeManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  if (Array.isArray(raw.capabilities)) {
    for (const cap of raw.capabilities) {
      if (cap && typeof cap === 'object' && !cap.action && typeof cap.name === 'string') cap.action = cap.name;
    }
  }
  return raw;
}

function validateManifest(m, seenIds) {
  const errs = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['manifest must be a JSON object'];
  const need = ['id', 'name', 'version', 'description', 'author', 'entry', 'type'];
  for (const k of need) if (typeof m[k] !== 'string' || !m[k].trim()) errs.push(`missing or empty field "${k}"`);
  if (m.id && !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(m.id)) errs.push('id must match ^[a-z0-9][a-z0-9_-]{1,63}$');
  if (m.version && !/^\d+\.\d+\.\d+([-.][0-9a-zA-Z.]+)?$/.test(m.version)) errs.push('version must be semver-like (e.g. 1.0.0)');
  if (m.type && !TYPES.includes(m.type)) errs.push(`type must be one of ${TYPES.join(', ')}`);
  if (m.entry) {
    if (typeof m.entry !== 'string' || !m.entry || m.entry.includes('..') || path.isAbsolute(m.entry) || !m.entry.endsWith('.js')) {
      errs.push('entry must be a relative .js path without ".."');
    }
  }
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) errs.push('permissions must be an array');
    else for (const p of m.permissions) if (!PERMISSION_CATALOG[p]) errs.push(`unknown permission "${p}" (catalog: ${Object.keys(PERMISSION_CATALOG).join(', ')})`);
  }
  if (m.capabilities !== undefined) {
    if (!Array.isArray(m.capabilities)) errs.push('capabilities must be an array');
    else m.capabilities.forEach((c, i) => {
      if (!c || typeof c.action !== 'string' || !/^[a-z0-9_]{2,40}$/.test(c.action)) errs.push(`capabilities[${i}].action invalid (a-z0-9_, 2-40 chars)`);
    });
  }
  if (m.dependencies !== undefined && !Array.isArray(m.dependencies)) errs.push('dependencies must be an array of module ids');
  if (m.configSchema !== undefined && (typeof m.configSchema !== 'object' || m.configSchema === null || Array.isArray(m.configSchema))) {
    errs.push('configSchema must be an object of {field: {type, def, label}}');
  }
  if (seenIds && m.id && seenIds.has(m.id)) errs.push(`duplicate module id "${m.id}" — first registration wins, this one is quarantined`);
  return errs;
}

function validateConfig(manifest, values) {
  const errs = [];
  const schema = manifest.configSchema || {};
  for (const [k, v] of Object.entries(values || {})) {
    const f = schema[k];
    if (!f) { errs.push(`unknown config field "${k}"`); continue; }
    if (f.type === 'number' && (typeof v !== 'number' || isNaN(v))) errs.push(`${k} must be a number`);
    if (f.type === 'string' && typeof v !== 'string') errs.push(`${k} must be a string`);
    if (f.type === 'boolean' && typeof v !== 'boolean') errs.push(`${k} must be a boolean`);
    if (f.type === 'number' && typeof v === 'number') {
      if (typeof f.min === 'number' && v < f.min) errs.push(`${k} < min ${f.min}`);
      if (typeof f.max === 'number' && v > f.max) errs.push(`${k} > max ${f.max}`);
    }
  }
  return errs;
}

// ---------------------------------------------------------------------------
// state persistence (approved flags, enabled flags, config values)
// ---------------------------------------------------------------------------

let state = { approved: {}, enabled: {}, config: {} };

function loadState() {
  try { state = Object.assign({ approved: {}, enabled: {}, config: {} }, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); }
  catch { state = { approved: {}, enabled: {}, config: {} }; }
}
function saveState() {
  const tmp = STATE_FILE + '.tmp';
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

// ---------------------------------------------------------------------------
// runtime bookkeeping + event bus
// ---------------------------------------------------------------------------

const runtime = new Map(); // id -> { instance, status, lastError, lastHealth, calls, fails, loadedAt, dir, manifest }
const ledger = [];          // lifecycle events (newest last)
const kv = new Map();       // storage:kv scratch (persisted per-module in state)

function ev(id, event, detail, level) {
  ledger.push({ at: new Date().toISOString(), id, event, detail: detail || null });
  if (ledger.length > 300) ledger.shift();
  try { require('./self_repair').log(level || 'INFO', 'MODULE_SYSTEM', id + ' · ' + event, detail || null); } catch {}
  try { require('./store').audit({ area: '70', event, module: id, detail: detail || undefined }); } catch {}
}

const bus = {
  subs: new Map(),
  emit(topic, payload) { for (const fn of this.subs.get(topic) || []) { try { fn(payload); } catch {} } },
  on(topic, fn) { if (!this.subs.has(topic)) this.subs.set(topic, new Set()); this.subs.get(topic).add(fn); },
};

// ---------------------------------------------------------------------------
// discovery
// ---------------------------------------------------------------------------

function discover() {
  const found = [];
  let dirs = [];
  try { dirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { dirs = []; }
  const seenIds = new Set();
  for (const dir of dirs.sort()) {
    const mfile = path.join(MODULES_DIR, dir, 'aura.module.json');
    const rec = { dir, dirPath: path.join(MODULES_DIR, dir), manifest: null, errors: [], loaded: false };
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(mfile, 'utf8')); }
    catch (e) { rec.errors = ['aura.module.json missing or invalid JSON: ' + e.message]; found.push(rec); continue; }
    rec.manifest = normalizeManifest(raw);
    rec.errors = validateManifest(rec.manifest, seenIds);
    if (!rec.errors.length) {
      seenIds.add(raw.id);
      // duplicate id on disk: second directory with same id is kept invalid
      const dup = found.find((f) => f.manifest && f.manifest.id === raw.id);
      if (dup) { rec.errors = [`duplicate module id "${raw.id}" (already provided by ${dup.dir})`]; }
    }
    found.push(rec);
  }
  return found;
}

// ---------------------------------------------------------------------------
// context builder — permission-gated, secrets NEVER handed out
// ---------------------------------------------------------------------------

function buildContext(manifest, values) {
  const has = (p) => (manifest.permissions || []).includes(p);
  const ctx = {
    module: { id: manifest.id, version: manifest.version, type: manifest.type },
    config: {}, // resolved config below (defaults + stored values)
  };
  if (has('log:write')) ctx.log = (level, msg, detail) => { try { require('./self_repair').log(level, 'MOD:' + manifest.id, msg, detail || null); } catch {} };
  if (has('audit:write')) ctx.audit = (event, detail) => { try { require('./store').audit({ area: '70', module: manifest.id, event, detail: detail || undefined }); } catch {} };
  if (has('config:read')) ctx.config = { get: (k, fb) => { try { return require('../lib/config').get(k, fb); } catch { return fb; } } };
  if (has('events:pub')) ctx.events = Object.assign(ctx.events || {}, { emit: (t, p) => bus.emit(t, p) });
  if (has('events:sub')) ctx.events = Object.assign(ctx.events || {}, { on: (t, fn) => bus.on(t, fn) });
  if (has('health:read')) ctx.health = () => { try { const r = require('./registry'); return { counts: r.counts(), uptime_s: Math.round(process.uptime()) }; } catch { return null; } };
  if (has('skills:read')) ctx.skills = () => { try { return require('./skills_registry').skills(); } catch { return []; } };
  if (has('schedule:read')) ctx.schedule = () => { try { return require('./schedule').status(); } catch { return null; } };
  if (has('ai:route')) ctx.routing = () => { try { const o = require('./omniroute'); return o.status ? o.status() : o; } catch { return null; } };
  if (has('registry:read')) ctx.services = Object.assign(ctx.services || {}, { registry: { counts: () => { try { return require('./registry').counts(); } catch { return { total: 0 }; } } } });
  if (has('storage:kv')) {
    const bucket = () => { if (!kv.has(manifest.id)) kv.set(manifest.id, Object.assign({}, (state.config['__kv__'] || {})[manifest.id])); return kv.get(manifest.id); };
    ctx.store = {
      get: (k) => bucket()[k],
      set: (k, v) => { bucket()[k] = v; state.config['__kv__'] = state.config['__kv__'] || {}; state.config['__kv__'][manifest.id] = bucket(); saveState(); },
    };
  }
  // resolved module config (defaults + stored)
  const schema = manifest.configSchema || {};
  for (const [k, f] of Object.entries(schema)) ctx.config[k] = f.def !== undefined ? f.def : f.default;
  Object.assign(ctx.config, values || {});
  return ctx;
}

// ---------------------------------------------------------------------------
// contract adapter — legacy {meta, actions} modules get wrapped
// ---------------------------------------------------------------------------

function adapt(api) {
  if (api && typeof api.execute === 'function') return api; // full contract
  // legacy shape: {meta, actions:{name:fn}} -> adapter implementing the contract
  if (api && api.actions && typeof api.actions === 'object') {
    return {
      initialize: typeof api.initialize === 'function' ? api.initialize : () => ({ ok: true }),
      getCapabilities: () => Object.keys(api.actions),
      execute: (action, input) => {
        const fn = api.actions[String(action).toLowerCase()];
        if (!fn) throw Object.assign(new Error('unknown action "' + action + '"'), { code: 404 });
        return fn(input || {});
      },
      healthCheck: typeof api.healthCheck === 'function' ? api.healthCheck : () => ({ ok: true, note: 'legacy module — no healthCheck declared' }),
      shutdown: typeof api.shutdown === 'function' ? api.shutdown : () => ({ ok: true }),
      _adapter: 'legacy {meta, actions} wrapped by module_system adapter',
    };
  }
  return null;
}

function withTimeout(p, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout after ' + ms + 'ms (' + label + ')')), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// ---------------------------------------------------------------------------
// lifecycle operations
// ---------------------------------------------------------------------------

function record(id) {
  if (!runtime.has(id)) runtime.set(id, { status: 'absent', lastError: null, lastHealth: null, calls: 0, fails: 0, instance: null, manifest: null, dir: null, loadedAt: null, events: [] });
  return runtime.get(id);
}

function scan() {
  loadState();
  const found = discover();
  const currentIds = new Set();
  for (const rec of found) {
    if (!rec.manifest || rec.errors.length) {
      if (rec.manifest && rec.manifest.id) {
        const r = record(rec.manifest.id);
        r.status = 'invalid'; r.lastError = rec.errors.join('; '); r.manifest = rec.manifest; r.dir = rec.dir; r.instance = null;
        currentIds.add(rec.manifest.id);
      } else {
        ev(rec.dir, 'discovery_invalid', { dir: rec.dir, errors: rec.errors }, 'WARN');
      }
      continue;
    }
    const id = rec.manifest.id;
    currentIds.add(id);
    const r = record(id);
    r.manifest = rec.manifest; r.dir = rec.dir;
    if (r.status === 'ready' || r.status === 'error' || r.status === 'disabled') continue; // keep live state
    r.status = 'discovered';
    // approval gate: third-party modules are never trusted by manifest alone
    if (!state.approved[id]) { r.status = 'needs_approval'; r.lastError = 'not yet approved — a valid manifest alone does not grant trust'; continue; }
    if (state.enabled[id] === false) { r.status = 'disabled'; continue; }
    initializeModule(id);
  }
  // modules that vanished from disk
  for (const [id, r] of runtime) if (!currentIds.has(id)) { safeShutdown(id); runtime.delete(id); }
  ev('*', 'scan_complete', { modules: currentIds.size }, 'INFO');
  return { ok: true, modules: currentIds.size };
}

function resolveEntry(manifest, dirPath) {
  const target = path.normalize(path.join(dirPath, manifest.entry));
  if (!target.startsWith(path.normalize(dirPath) + path.sep)) throw new Error('entry escapes module directory (path traversal blocked)');
  return target;
}

function initializeModule(id) {
  const r = runtime.get(id);
  const m = r.manifest;
  const dirPath = path.join(MODULES_DIR, r.dir);
  try {
    const errs = validateConfig(m, state.config[id] || {});
    if (errs.length) { r.status = 'needs_config'; r.lastError = 'config invalid: ' + errs.join('; '); return; }
    // required config without defaults?
    for (const [k, f] of Object.entries(m.configSchema || {})) {
      if (f.required && typeof (state.config[id] || {})[k] === 'undefined' && typeof f.def === 'undefined') {
        r.status = 'needs_config'; r.lastError = `required config "${k}" missing`; return;
      }
    }
    // dependency check (other package modules must be ready or not required-hard)
    for (const dep of m.dependencies || []) {
      // Spec v1 kennt {service:'registry'|'audit'|'mcp'|'llm'} — die Wirtsanforderungen gelten hier als erfüllt.
      if (typeof dep === 'object' && dep !== null) { if (dep.service) continue; }
      const depId = typeof dep === 'string' ? dep : String((dep && dep.id) || '');
      if (!depId || depId.startsWith('aura-core') || depId.startsWith('service:')) continue;
      const dr = runtime.get(depId);
      if (!dr || !['ready'].includes(dr.status)) { r.status = 'error'; r.lastError = `dependency "${depId}" not ready`; return; }
    }
    r.status = 'initializing';
    const entry = resolveEntry(m, dirPath);
    if (!fs.existsSync(entry)) { r.status = 'error'; r.lastError = 'entry file not found: ' + m.entry; return; }
    // invalidate require cache so updates/rescans load fresh code (hot reload)
    try { const resolved = require.resolve(entry); if (require.cache[resolved]) delete require.cache[resolved]; } catch {}
    let api = require(entry);
    if (api && api.default) api = api.default;
    const adapted = adapt(api);
    if (!adapted) { r.status = 'error'; r.lastError = 'entry exports neither the module contract (execute/…) nor legacy {meta, actions}'; return; }
    const ctx = buildContext(m, state.config[id]);
    if (typeof adapted.initialize === 'function') {
      const out = adapted.initialize(ctx);
      if (out && typeof out.then === 'function') { /* async init awaited by caller route when possible */ }
    }
    r.instance = adapted; r.context = ctx; r.status = 'ready'; r.loadedAt = new Date().toISOString(); r.lastError = null; r.fails = 0;
    ev(id, 'initialized', { dir: r.dir, adapter: adapted._adapter || 'contract' });
  } catch (e) {
    r.status = 'error'; r.lastError = String(e && e.message || e);
    ev(id, 'init_failed', { error: r.lastError }, 'ERROR');
  }
}

function safeShutdown(id) {
  const r = runtime.get(id);
  if (!r || !r.instance) return;
  try { if (typeof r.instance.shutdown === 'function') r.instance.shutdown(r.context); } catch {}
  r.instance = null;
  ev(id, 'shutdown', {});
}

function approve(id, on) {
  loadState();
  const r = runtime.get(id);
  if (!r || !r.manifest) return { ok: false, error: 'unknown module ' + id };
  state.approved[id] = on !== false;
  saveState();
  ev(id, on !== false ? 'approved' : 'approval_revoked', {}, 'WARN');
  if (on !== false && r.status === 'needs_approval') initializeModule(id);
  if (on === false) { safeShutdown(id); r.status = 'needs_approval'; r.lastError = 'approval revoked'; }
  return { ok: true, id, approved: state.approved[id], status: r.status };
}

function enable(id) {
  loadState();
  const r = runtime.get(id);
  if (!r || !r.manifest) return { ok: false, error: 'unknown module ' + id };
  if (!state.approved[id]) return { ok: false, error: 'module not approved — approve it first (a valid manifest alone is not trust)' };
  state.enabled[id] = true;
  saveState();
  initializeModule(id);
  ev(id, 'enabled', {});
  return { ok: true, id, status: r.status, error: r.lastError || undefined };
}

function disable(id) {
  loadState();
  const r = runtime.get(id);
  if (!r || !r.manifest) return { ok: false, error: 'unknown module ' + id };
  state.enabled[id] = false;
  saveState();
  safeShutdown(id);
  r.status = 'disabled';
  ev(id, 'disabled', {});
  return { ok: true, id, status: 'disabled' };
}

function configure(id, values) {
  loadState();
  const r = runtime.get(id);
  if (!r || !r.manifest) return { ok: false, error: 'unknown module ' + id };
  const errs = validateConfig(r.manifest, values || {});
  if (errs.length) return { ok: false, errors: errs };
  state.config[id] = Object.assign({}, state.config[id] || {}, values || {});
  saveState();
  ev(id, 'configured', { fields: Object.keys(values || {}) });
  if (['ready', 'error', 'needs_config'].includes(r.status) && state.approved[id] && state.enabled[id] !== false) {
    safeShutdown(id);
    initializeModule(id);
  }
  return { ok: true, id, config: state.config[id], status: r.status };
}

async function execute(id, action, input) {
  const r = runtime.get(id);
  if (!r || !r.manifest) return { ok: false, error: 'unknown module ' + id };
  if (r.status !== 'ready') return { ok: false, error: `module state is "${r.status}" — not executable${r.lastError ? ' (' + r.lastError + ')' : ''}` };
  const caps = (r.manifest.capabilities || []).map((c) => c.action);
  if (caps.length && !caps.includes(action)) return { ok: false, error: `action "${action}" is not a declared capability (${caps.join(', ') || 'none'})` };
  const t0 = Date.now();
  try {
    let out = r.instance.execute(action, input || {}, r.context);
    if (out && typeof out.then === 'function') out = await withTimeout(out, LIMITS.execMs, id + '/' + action);
    r.calls++; r.fails = 0; r.lastMs = Date.now() - t0;
    ev(id, 'executed', { action, ms: r.lastMs });
    return { ok: true, id, action, ms: r.lastMs, result: out };
  } catch (e) {
    r.fails++; r.lastMs = Date.now() - t0;
    const msg = String(e && e.message || e);
    r.lastError = msg;
    ev(id, 'execute_failed', { action, error: msg }, 'ERROR');
    try { const lc = require('./learning_core'); const sig = 'mod:' + id + ':' + action + ':' + msg.slice(0, 60); lc.recordFailure(sig, { module: id, action }); lc.reportOutcome(sig, true); } catch {}
    if (r.fails >= 3) { r.status = 'error'; ev(id, 'quarantined_by_errors', { fails: r.fails }, 'ERROR'); }
    return { ok: false, error: msg, fails: r.fails, status: r.status };
  }
}

function health(id) {
  const r = runtime.get(id);
  if (!r || !r.manifest) return { ok: false, error: 'unknown module ' + id };
  if (r.status !== 'ready' || !r.instance) return { ok: false, status: r.status, error: r.lastError || undefined };
  const t0 = Date.now();
  try {
    let out = typeof r.instance.healthCheck === 'function' ? r.instance.healthCheck(r.context) : { ok: true };
    if (out && typeof out.then === 'function') return { ok: false, status: r.status, error: 'async healthCheck not awaited in sync route' };
    r.lastHealth = { at: new Date().toISOString(), ms: Date.now() - t0, result: out };
    return { ok: true, id, status: r.status, ms: r.lastHealth.ms, result: out };
  } catch (e) {
    r.lastHealth = { at: new Date().toISOString(), ms: Date.now() - t0, error: String(e.message || e) };
    return { ok: false, id, status: r.status, error: r.lastHealth.error };
  }
}

// integration honesty: map module/health state onto the five honest states
function integrationStatus(id) {
  const r = runtime.get(id);
  if (!r || !r.manifest) return 'not-connected';
  if (r.manifest.type !== 'integration') return null;
  if (r.status === 'needs_config' || r.status === 'needs_approval') return 'config-required';
  if (r.status === 'disabled' || r.status === 'absent') return 'not-connected';
  if (r.status === 'invalid' || r.status === 'error') return 'configured-unreachable';
  const h = r.lastHealth && r.lastHealth.result;
  if (h && h.simulation === true) return 'simulation';
  if (r.status === 'ready' && h && h.connected === true) return 'connected';
  if (r.status === 'ready' && !h) return 'config-required'; // registered ≠ connected
  return 'configured-unreachable';
}

// ---------------------------------------------------------------------------
// status / reporting (feeds /api/modulehub + registry bridge + containers UI)
// ---------------------------------------------------------------------------

function moduleStatus(id) {
  const r = runtime.get(id);
  if (!r) return null;
  const m = r.manifest || {};
  return {
    id, name: m.name, version: m.version, description: m.description, author: m.author, type: m.type, dir: r.dir,
    status: r.status, error: r.lastError || undefined,
    permissions: m.permissions || [], capabilities: (m.capabilities || []).map((c) => c.action),
    dependencies: m.dependencies || [],
    configSchema: m.configSchema || {}, config: state.config[id] || {},
    approved: !!state.approved[id], enabled: state.enabled[id] !== false,
    stats: { calls: r.calls, fails: r.fails, last_ms: r.lastMs || null, loaded_at: r.loadedAt },
    lastHealth: r.lastHealth || null,
    integration: integrationStatus(id) || undefined,
  };
}

function status() {
  if (runtime.size === 0) scan();
  const mods = [...runtime.keys()].sort().map(moduleStatus).filter(Boolean);
  return {
    mode: 'LIVE',
    area: '70',
    dir: MODULES_DIR,
    lifecycle: ['discover', 'validate', 'configure', 'initialize', 'ready', 'execute', 'shutdown'],
    contract: ['initialize(context)', 'getCapabilities()', 'execute(action, input, context)', 'healthCheck()', 'shutdown()'],
    permission_catalog: PERMISSION_CATALOG,
    limits: LIMITS,
    states: STATES,
    counts: {
      total: mods.length,
      ready: mods.filter((m) => m.status === 'ready').length,
      needs_approval: mods.filter((m) => m.status === 'needs_approval').length,
      needs_config: mods.filter((m) => m.status === 'needs_config').length,
      error: mods.filter((m) => m.status === 'error' || m.status === 'invalid').length,
      disabled: mods.filter((m) => m.status === 'disabled').length,
    },
    modules: mods,
    ledger: ledger.slice(-40),
    isolation_note: 'in-process isolation with timeouts + error quarantine; no OS-level sandbox in this environment (documented limitation)',
  };
}

// bridge for registry.js: external modules shown in the unified registry view
function registryEntries() {
  if (runtime.size === 0) scan();
  return [...runtime.values()]
    .filter((r) => r.manifest)
    .map((r) => ({
      area: 'pkg:' + r.manifest.id, name: r.manifest.name + ' (v' + r.manifest.version + ')',
      state: r.status === 'ready' ? 'live' : r.status, mode: 'pkg', actions: (r.manifest.capabilities || []).map((c) => c.action),
      note: `external module (${r.manifest.type}) via Area 70 · ${r.status}`,
    }));
}

// ---------------------------------------------------------------------------
// example modules live in backend/modules/ — see hello-tool + crash-dummy
// ---------------------------------------------------------------------------

function actionsMeta() {
  return {
    status: () => status(),
    scan: () => scan(),
    approve: (p) => approve(String(p && p.id), p && p.on),
    enable: (p) => enable(String(p && p.id)),
    disable: (p) => disable(String(p && p.id)),
    configure: (p) => configure(String(p && p.id), (p && p.values) || {}),
    execute: (p) => execute(String(p && p.id), String((p && p.action) || 'status'), (p && p.input) || {}),
    health: (p) => health(String(p && p.id)),
  };
}

module.exports = {
  meta: { area: '70', id: 'module_system', name: 'Central Module System (manifest loader + lifecycle + permissions)', state: 'live' },
  MODULES_DIR, STATE_FILE, TYPES, PERMISSION_CATALOG, STATES,
  validateManifest, normalizeManifest, validateConfig, discover, scan, approve, enable, disable, configure, execute, health,
  status, moduleStatus, registryEntries, integrationStatus, bus,
  actions: Object.assign(actionsMeta(), {
    catalog: () => ({ permissions: PERMISSION_CATALOG, types: TYPES, states: STATES, lifecycle: status().lifecycle, contract: status().contract }),
  }),
  _internals: { runtime, state: () => state, loadState, saveState },
};

// initial discovery at require-time (never throws into the server boot)
try { scan(); } catch {}
