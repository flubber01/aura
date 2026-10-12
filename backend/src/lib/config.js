'use strict';
// AURA Area 68 — global config: defaults in code, overrides in
// backend/src/data/config.json (hot-reloaded via mtime cache, vault-backed
// by the watcher). Schema exposed for the /config UI. Env vars beat file
// values where noted (PORT, keys).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'config.json');

const SCHEMA = {
  system: {
    name: { type: 'string', label: 'System-Name', def: 'AURA Agent Command Center' },
  },
  budget: {
    monthly_cap_eur: { type: 'number', label: 'OpenRouter Monats-Cap (EUR)', def: 20, min: 0, max: 500 },
  },
  kill: {
    syntax_fail_threshold: { type: 'number', label: 'Syntax-Fails bis Kill-Switch', def: 3, min: 1, max: 20 },
    window_min: { type: 'number', label: 'Zeitfenster (Minuten)', def: 5, min: 1, max: 60 },
  },
  watcher: {
    interval_ms: { type: 'number', label: 'Hot-Reload-Poll (ms)', def: 1500, min: 300, max: 30000 },
  },
  self_repair: {
    interval_ms: { type: 'number', label: 'Self-Repair-Check (ms)', def: 20000, min: 5000, max: 600000 },
  },
  containers: {
    max_fails: { type: 'number', label: 'Fails bis Quarantäne', def: 3, min: 1, max: 10 },
    cooldown_ms: { type: 'number', label: 'Quarantäne-Cooldown (ms)', def: 60000, min: 1000, max: 3600000 },
    timeout_ms: { type: 'number', label: 'Action-Timeout (ms)', def: 15000, min: 500, max: 120000 },
  },
};

function defaults() {
  const out = {};
  for (const [sec, fields] of Object.entries(SCHEMA)) {
    out[sec] = {};
    for (const [k, f] of Object.entries(fields)) out[sec][k] = f.def;
  }
  return out;
}

let cache = { mtime: 0, data: null };

function readFile() {
  try {
    const st = fs.statSync(FILE);
    if (cache.data && st.mtimeMs === cache.mtime) return cache.data;
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cache = { mtime: st.mtimeMs, data: j };
    return j;
  } catch { return {}; }
}

function get(dotpath, fallback) {
  const [sec, key] = String(dotpath).split('.');
  const j = readFile();
  if (j && j[sec] && typeof j[sec][key] !== 'undefined') return j[sec][key];
  if (typeof fallback !== 'undefined') return fallback;
  return SCHEMA[sec] && SCHEMA[sec][key] ? SCHEMA[sec][key].def : undefined;
}

function current() {
  const j = readFile();
  const out = defaults();
  for (const sec of Object.keys(out)) {
    for (const k of Object.keys(out[sec])) {
      if (j && j[sec] && typeof j[sec][k] !== 'undefined') out[sec][k] = j[sec][k];
    }
  }
  return out;
}

function validate(obj) {
  const errs = [];
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return ['config must be an object'];
  for (const [sec, fields] of Object.entries(obj)) {
    if (!SCHEMA[sec]) { errs.push('unknown section "' + sec + '"'); continue; }
    if (typeof fields !== 'object' || fields === null) { errs.push(sec + ' must be an object'); continue; }
    for (const [k, v] of Object.entries(fields)) {
      const f = SCHEMA[sec][k];
      if (!f) { errs.push(sec + '.' + k + ' unknown'); continue; }
      if (f.type === 'number') {
        if (typeof v !== 'number' || isNaN(v)) { errs.push(sec + '.' + k + ' must be a number'); continue; }
        if (typeof f.min === 'number' && v < f.min) errs.push(sec + '.' + k + ' < min ' + f.min);
        if (typeof f.max === 'number' && v > f.max) errs.push(sec + '.' + k + ' > max ' + f.max);
      } else if (f.type === 'string' && typeof v !== 'string') errs.push(sec + '.' + k + ' must be a string');
      else if (f.type === 'boolean' && typeof v !== 'boolean') errs.push(sec + '.' + k + ' must be boolean');
    }
  }
  return errs;
}

function set(obj) {
  const errs = validate(obj);
  if (errs.length) return { ok: false, errors: errs };
  const merged = current();
  for (const [sec, fields] of Object.entries(obj)) {
    for (const [k, v] of Object.entries(fields)) merged[sec][k] = v;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2));
  cache.data = null; // force reload
  try { require('./self_repair').log('INFO', 'CONFIG', 'config_updated', obj); } catch {}
  return { ok: true, config: current(), file: FILE };
}

function reset() {
  try { fs.unlinkSync(FILE); } catch {}
  cache.data = null;
  return { ok: true, config: current(), note: 'reset to defaults' };
}

function schema() {
  return { file: FILE, env_overrides: ['PORT', 'OPENROUTER_API_KEY', 'TELEGRAM_BOT_TOKEN'], schema: SCHEMA, current: current() };
}

module.exports = {
  meta: { area: '68', id: 'config', name: 'Global Config (schema-validated, hot-reloaded)', state: 'live' },
  get, set, reset, current, defaults, schema, validate, file: FILE,
  actions: { status: () => ({ file: FILE, overrides: Object.keys(readFile()), current: current() }) },
};
