'use strict';
// AURA — Modul-Loader für Erweiterungsmodule (backend/modules/<ordner>/aura.module.json).
//
// Lebenszyklus: discover → validate → configure → initialize → ready → execute → shutdown
// Grundregeln:
//  - Neue Module werden nur durch einen Ordner erkannt. Keine Eintragung in anderen Dateien nötig.
//  - Nichts läuft ohne menschliche Freigabe. Ändert sich die Datei, ist die Freigabe ungültig.
//  - Rechte sind standardmäßig leer. Die Freigabe gewährt genau die im Manifest deklarierten Rechte.
//  - Geheimnisse kommen nur aus Umgebungsvariablen (AURA_MOD_<ID>_<KEY>), nie aus Dateien, nie in API-Antworten.
//  - Fehler bleiben im Modul: Timeout, Fehlerzähler, Quarantäne nach 3 Fehlern. Der Server läuft weiter.
//  - Die bestehende Registry bleibt führend für die 40 Bereiche. Erweiterungen werden nur ergänzt.
// Ehrlich: Module laufen im selben Prozess. Das ist kein Sicherheits-Sandkasten. Timeouts fangen
// nur asynchrone Hänger ab. Siehe docs/MODULE_SPEC.md, Abschnitt „Grenzen“.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const manifest = require('./module_manifest');

const MODULES_DIR = process.env.AURA_MODULES_DIR || path.join(__dirname, '..', '..', 'modules');
const STATE_FILE = process.env.AURA_MODULE_STATE_FILE || path.join(__dirname, '..', '..', 'data', 'module_state.json');
const CONFIG_FILE = process.env.AURA_MODULE_CONFIG_FILE || path.join(__dirname, '..', '..', 'data', 'module_config.json');
const MAX_FAILS = 3;
const MAX_LOG = 50;
const AGENT_RE = /agent|system|bot|auto/i;

const recs = new Map();          // id -> record (siehe newRec)
const duplicates = new Set();    // IDs, die mehrfach vorkommen
let lastScan = null;

// ---------- Persistenz (klein, atomar) ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
const loadState = () => readJson(STATE_FILE, {});
const saveState = (s) => writeJson(STATE_FILE, s);
const loadConfig = () => readJson(CONFIG_FILE, {});
const saveConfig = (c) => writeJson(CONFIG_FILE, c);

function audit(event, detail) {
  try { require('./store').audit({ area: 'MODULE', event, ...detail }); } catch {}
}

// ---------- Hilfen ----------
function envName(id, key) {
  return 'AURA_MOD_' + id.replace(/-/g, '_').toUpperCase() + '_' + key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}
function withTimeout(p, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Zeitüberschreitung nach ' + ms + ' ms (' + label + ')')), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
// Prüfsumme über Manifest und Einstiegsdatei. Ändert sich eine der beiden, ist die Freigabe ungültig.
function hashOf(dir, file, entry) {
  const e = manifest.safeEntry(dir, entry);
  if (!e.ok) throw new Error(e.reason);
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  h.update(fs.readFileSync(e.abs));
  return h.digest('hex');
}

function newRec(id, dir, folder) {
  return {
    id, dir, folder, manifest: null, errors: [], warnings: [], hash: null,
    status: 'erkannt', missing_config: [], instance: null, started: false,
    consecutive_fails: 0, quarantined: false, last_health: null, last_run: null,
    last_errors: [], logs: [],
  };
}
function pushLimited(arr, item, max) { arr.push(item); if (arr.length > max) arr.shift(); }

// ---------- Erkennen und Prüfen ----------
function discover() {
  const found = [];
  let entries = [];
  try { entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true }); } catch { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
    const dir = path.join(MODULES_DIR, ent.name);
    const rm = manifest.readManifest(dir);
    if (!rm.ok) { found.push({ folder: ent.name, dir, id: null, errors: rm.errors, warnings: [], manifest: null, hash: null }); continue; }
    const v = manifest.validateManifest(rm.raw, dir);
    let hash = null;
    if (v.ok) { try { hash = hashOf(dir, rm.file, rm.raw.entry); } catch (e) { v.errors.push('Hash nicht berechenbar: ' + e.message); v.ok = false; } }
    found.push({ folder: ent.name, dir, id: rm.raw && rm.raw.id, errors: v.errors, warnings: v.warnings, manifest: v.ok ? v.manifest : null, hash });
  }
  // Doppelte IDs: beide Module werden abgelehnt, bis eines umbenannt ist.
  const count = new Map();
  for (const f of found) if (f.id) count.set(f.id, (count.get(f.id) || 0) + 1);
  duplicates.clear();
  for (const f of found) if (f.id && count.get(f.id) > 1) { duplicates.add(f.id); f.errors.push('doppelte ID „' + f.id + '“ (' + count.get(f.id) + ' Ordner)'); f.manifest = null; }

  // Laufende Instanzen, deren Hash sich geändert hat, sofort beenden.
  const seen = new Set();
  for (const f of found) {
    const key = f.id || ('folder:' + f.folder);
    seen.add(key);
    const old = recs.get(key);
    const rec = old || newRec(key, f.dir, f.folder);
    rec.id = f.manifest ? f.manifest.id : f.folder; // ungültige Module zeigen ihren Ordnernamen
    rec.dir = f.dir; rec.folder = f.folder;
    rec.manifest = f.manifest; rec.errors = f.errors; rec.warnings = f.warnings;
    if (old && old.hash && f.hash && old.hash !== f.hash && old.instance) { shutdownSafe(rec); }
    rec.hash = f.hash;
    recs.set(key, rec);
  }
  for (const key of [...recs.keys()]) if (!seen.has(key)) { shutdownSafe(recs.get(key)); recs.delete(key); }
  lastScan = new Date().toISOString();
  return { scanned: found.length, at: lastScan };
}

function depCheck(rec) {
  const problems = [];
  for (const d of rec.manifest.dependencies || []) {
    if (d.service) {
      if (!manifest.SERVICES.includes(d.service)) problems.push({ kind: 'abhaengigkeit_fehlt', msg: 'Dienst „' + d.service + '“ unbekannt' });
      continue;
    }
    const target = recs.get(d.id);
    if (!target || !target.manifest) { problems.push({ kind: 'abhaengigkeit_fehlt', msg: 'Modul „' + d.id + '“ fehlt oder ist ungültig' }); continue; }
    if (d.version && !manifest.satisfies(target.manifest.version, d.version)) {
      problems.push({ kind: 'version_konflikt', msg: 'Modul „' + d.id + '“ ist ' + target.manifest.version + ', gebraucht wird ' + d.version });
    }
  }
  return problems;
}

function configMissing(rec, values) {
  const miss = [];
  for (const [key, f] of Object.entries(rec.manifest.configSchema || {})) {
    if (f.secret) { if (process.env[envName(rec.id, key)] === undefined || process.env[envName(rec.id, key)] === '') miss.push(key); continue; }
    if (values[key] === undefined && f.default === undefined && f.required) miss.push(key);
  }
  return miss;
}

// Bestimmt den Status ohne etwas zu starten.
function computeStatus(rec) {
  if (rec.errors.length || !rec.manifest) return 'ungueltig';
  const st = loadState()[rec.id] || {};
  const cfg = loadConfig()[rec.id] || {};
  const deps = depCheck(rec);
  rec.missing_config = configMissing(rec, cfg);
  if (rec.quarantined) return 'fehlerhaft';
  if (deps.length) return deps[0].kind;
  if (rec.missing_config.length) return 'konfiguration_erforderlich';
  const approved = st.approval && st.approval.hash === rec.hash;
  if (!approved) return 'freigabe_erforderlich';
  if (!st.enabled) return 'deaktiviert';
  if (rec.last_status_error) return 'fehlerhaft';
  return rec.started ? 'bereit' : 'freigegeben';
}

function refresh() {
  for (const rec of recs.values()) rec.status = computeStatus(rec);
}

// ---------- Instanz laden und Adapter ----------
function loadEntry(rec) {
  const e = manifest.safeEntry(rec.dir, rec.manifest.entry);
  if (!e.ok) throw new Error(e.reason);
  delete require.cache[e.abs];
  return require(e.abs);
}

function adapt(mod, m) {
  if (!mod || typeof mod !== 'object') throw new Error('Entry exportiert kein Objekt');
  const legacy = typeof mod.execute !== 'function';
  return {
    legacy,
    initialize: (ctx) => (typeof mod.initialize === 'function' ? mod.initialize(ctx) : undefined),
    getCapabilities: () => (typeof mod.getCapabilities === 'function' ? mod.getCapabilities() : m.capabilities.map((c) => ({ name: c.name, description: c.description || '' }))),
    execute: (action, input, ctx) => {
      if (!legacy) return mod.execute(action, input, ctx);
      // Adapter für ältere Module mit actions-Objekt
      const fn = mod.actions && mod.actions[action];
      if (typeof fn !== 'function') throw new Error('Aktion nicht implementiert: ' + action);
      return fn(input, ctx);
    },
    healthCheck: () => (typeof mod.healthCheck === 'function' ? mod.healthCheck() : { status: 'unbekannt', detail: 'kein healthCheck im Modul' }),
    shutdown: () => (typeof mod.shutdown === 'function' ? mod.shutdown() : undefined),
  };
}

function makeContext(rec, granted) {
  const has = (p) => granted.includes(p);
  const ctx = {
    id: rec.id, name: rec.manifest.name, version: rec.manifest.version,
    config: {},
    log(msg) { pushLimited(rec.logs, { at: new Date().toISOString(), msg: String(msg).slice(0, 500) }, MAX_LOG); },
  };
  const values = loadConfig()[rec.id] || {};
  for (const [key, f] of Object.entries(rec.manifest.configSchema || {})) {
    if (!f.secret) ctx.config[key] = values[key] !== undefined ? values[key] : f.default;
  }
  Object.freeze(ctx.config);
  if (has('secrets:read')) ctx.getSecret = (key) => {
    if (!rec.manifest.configSchema[key] || !rec.manifest.configSchema[key].secret) throw new Error('„' + key + '“ ist kein Geheimnis');
    return process.env[envName(rec.id, key)] || null;
  };
  if (has('audit:write')) ctx.audit = (event, detail) => audit(event, { module: rec.id, ...(detail || {}) });
  const services = {};
  if (has('registry:read')) services.registry = { counts: () => require('./registry').counts() };
  if (has('mcp:invoke')) services.mcp = { invoke: (p) => require('./mcp_ingestion_core').invoke(p) };
  ctx.services = services;
  return ctx;
}

function shutdownSafe(rec) {
  if (!rec || !rec.instance) { if (rec) rec.started = false; return; }
  const inst = rec.instance;
  rec.instance = null; rec.started = false;
  Promise.resolve().then(() => withTimeout(Promise.resolve(inst.shutdown()), 3000, 'shutdown')).catch(() => {});
}

// Startet ein Modul, falls alle Bedingungen erfüllt sind.
async function start(id) {
  const rec = recs.get(id);
  if (!rec) return { ok: false, status: 404, error: 'Modul nicht gefunden' };
  refresh();
  if (rec.started) return { ok: true, status: 200, already: true };
  if (rec.status !== 'freigegeben' && rec.status !== 'bereit') return { ok: false, status: 409, error: 'nicht startbar: ' + rec.status, status_detail: rec.status };
  const granted = ((loadState()[id] || {}).approval || {}).grants || [];
  try {
    const mod = adapt(loadEntry(rec), rec.manifest);
    const ctx = makeContext(rec, granted);
    await withTimeout(Promise.resolve(mod.initialize(ctx)), rec.manifest.timeoutMs, 'initialize');
    rec.instance = { ...mod, ctx, granted };
    rec.started = true;
    rec.consecutive_fails = 0;
    rec.quarantined = false;
    rec.last_status_error = null;
    audit('module_started', { module: id, version: rec.manifest.version });
    refresh();
    return { ok: true, status: 200 };
  } catch (e) {
    rec.last_status_error = e.message;
    pushLimited(rec.last_errors, { at: new Date().toISOString(), phase: 'initialize', message: e.message }, 20);
    rec.status = 'fehlerhaft';
    audit('module_init_failed', { module: id, error: e.message });
    return { ok: false, status: 500, error: e.message };
  }
}

async function stop(id) {
  const rec = recs.get(id);
  if (!rec) return { ok: false, status: 404, error: 'Modul nicht gefunden' };
  shutdownSafe(rec);
  rec.quarantined = false; rec.consecutive_fails = 0;
  refresh();
  return { ok: true, status: 200 };
}

// ---------- Aktionen ----------
function checkInput(schema, input) {
  const errs = [];
  if (input === undefined || input === null) input = {};
  if (typeof input !== 'object' || Array.isArray(input)) return ['Eingabe muss ein Objekt sein'];
  for (const [k, f] of Object.entries(schema || {})) {
    if (f.required && input[k] === undefined) errs.push('fehlt: ' + k);
    if (input[k] !== undefined && typeof input[k] !== f.type) errs.push(k + ': Typ ' + f.type + ' erwartet');
  }
  for (const k of Object.keys(input)) if (!schema || !schema[k]) errs.push('unbekanntes Feld: ' + k);
  return errs;
}

async function execute(id, action, input) {
  const rec = recs.get(id);
  if (!rec) return { ok: false, status: 404, error: 'Modul nicht gefunden' };
  if (rec.quarantined) return { ok: false, status: 429, error: 'Modul in Quarantäne nach ' + MAX_FAILS + ' Fehlern. Neu aktivieren oder neu laden.' };
  if (!rec.started) return { ok: false, status: 409, error: 'Modul läuft nicht (Status: ' + rec.status + ')', status_detail: rec.status };
  const cap = (rec.manifest.capabilities || []).find((c) => c.name === action);
  if (!cap) return { ok: false, status: 404, error: 'unbekannte Aktion', actions: rec.manifest.capabilities.map((c) => c.name) };
  const granted = rec.instance.granted || [];
  const missing = (cap.permissions || []).filter((p) => !granted.includes(p));
  if (missing.length) return { ok: false, status: 403, error: 'Rechte fehlen: ' + missing.join(', ') };
  const bad = checkInput(cap.input, input);
  if (bad.length) return { ok: false, status: 400, error: 'Eingabe ungültig', details: bad };
  try {
    const out = await withTimeout(Promise.resolve(rec.instance.execute(action, input || {}, rec.instance.ctx)), rec.manifest.timeoutMs, id + '/' + action);
    rec.consecutive_fails = 0;
    rec.last_run = { at: new Date().toISOString(), action, ok: true };
    audit('module_action', { module: id, action, ok: true });
    return { ok: true, status: 200, result: out };
  } catch (e) {
    rec.consecutive_fails++;
    rec.last_run = { at: new Date().toISOString(), action, ok: false };
    pushLimited(rec.last_errors, { at: new Date().toISOString(), phase: 'execute', action, message: e.message }, 20);
    audit('module_action', { module: id, action, ok: false, error: e.message });
    if (rec.consecutive_fails >= MAX_FAILS) {
      rec.quarantined = true;
      shutdownSafe(rec);
      audit('module_quarantined', { module: id, fails: rec.consecutive_fails });
      refresh();
      return { ok: false, status: 429, error: 'Modul in Quarantäne gesetzt: ' + e.message };
    }
    return { ok: false, status: 500, error: e.message };
  }
}

async function health(id) {
  const rec = recs.get(id);
  if (!rec) return { ok: false, status: 404, error: 'Modul nicht gefunden' };
  if (!rec.started) return { ok: false, status: 409, status_detail: rec.status, health: { status: 'nicht_gestartet' } };
  try {
    const r = await withTimeout(Promise.resolve(rec.instance.healthCheck()), 5000, id + '/health');
    rec.last_health = { at: new Date().toISOString(), status: r && r.status ? r.status : 'unbekannt', detail: r && r.detail ? String(r.detail).slice(0, 300) : null };
  } catch (e) {
    rec.last_health = { at: new Date().toISOString(), status: 'fehler', detail: e.message };
  }
  return { ok: true, status: 200, health: rec.last_health };
}

// ---------- Freigabe, Aktivierung, Konfiguration (nur Mensch) ----------
function humanOk(by) {
  const who = String(by || '').trim();
  if (who.length < 2 || who.length > 40) return { ok: false, status: 400, error: 'by: Name der freigebenden Person angeben' };
  if (AGENT_RE.test(who)) return { ok: false, status: 403, error: 'Nur ein Mensch darf das' };
  return { ok: true, who };
}

function approve(id, { by }) {
  const h = humanOk(by); if (!h.ok) return h;
  const rec = recs.get(id);
  if (!rec || !rec.manifest) return { ok: false, status: 404, error: 'Modul nicht gefunden oder ungültig' };
  const st = loadState();
  st[id] = { ...(st[id] || {}), enabled: (st[id] || {}).enabled || false, approval: { hash: rec.hash, by: h.who, at: new Date().toISOString(), grants: rec.manifest.permissions } };
  saveState(st);
  audit('module_approved', { module: id, by: h.who, grants: rec.manifest.permissions });
  refresh();
  return { ok: true, status: 200, status_detail: rec.status };
}

async function enable(id, { by }) {
  const h = humanOk(by); if (!h.ok) return h;
  const rec = recs.get(id);
  if (!rec) return { ok: false, status: 404, error: 'Modul nicht gefunden' };
  refresh();
  if (rec.status === 'freigabe_erforderlich') return { ok: false, status: 409, error: 'Erst freigeben (Datei oder Rechte haben sich geändert)' };
  const st = loadState();
  if (!st[id] || !st[id].approval) return { ok: false, status: 409, error: 'Erst freigeben' };
  st[id].enabled = true;
  saveState(st);
  // Bewusste Aktivierung hebt Quarantäne und alte Startfehler auf.
  rec.quarantined = false; rec.consecutive_fails = 0; rec.last_status_error = null;
  audit('module_enabled', { module: id, by: h.who });
  refresh();
  if (rec.status === 'konfiguration_erforderlich' || rec.status === 'abhaengigkeit_fehlt' || rec.status === 'version_konflikt') {
    return { ok: false, status: 409, error: 'Aktiviert, aber noch nicht startbar: ' + rec.status, missing_config: rec.missing_config, deps: depCheck(rec).map((d) => d.msg) };
  }
  const r = await start(id);
  return r.ok ? { ok: true, status: 200, status_detail: recs.get(id).status } : r;
}

async function disable(id, { by }) {
  const h = humanOk(by); if (!h.ok) return h;
  const st = loadState();
  if (st[id]) { st[id].enabled = false; saveState(st); }
  audit('module_disabled', { module: id, by: h.who });
  const r = await stop(id);
  return r;
}

function setConfig(id, { by, values }) {
  const h = humanOk(by); if (!h.ok) return h;
  const rec = recs.get(id);
  if (!rec || !rec.manifest) return { ok: false, status: 404, error: 'Modul nicht gefunden oder ungültig' };
  const schema = rec.manifest.configSchema || {};
  if (!values || typeof values !== 'object' || Array.isArray(values)) return { ok: false, status: 400, error: 'values: Objekt' };
  const errs = [];
  const clean = {};
  for (const [k, v] of Object.entries(values)) {
    const f = schema[k];
    if (!f) { errs.push('unbekannter Schlüssel: ' + k); continue; }
    if (f.secret) { errs.push(k + ': Geheimnis nur über Umgebungsvariable ' + envName(id, k) + ' setzen'); continue; }
    if (typeof v !== f.type) { errs.push(k + ': Typ ' + f.type + ' erwartet'); continue; }
    if (f.type === 'string' && v.length > 500) { errs.push(k + ': höchstens 500 Zeichen'); continue; }
    if (f.enum && !f.enum.includes(v)) { errs.push(k + ': nur ' + f.enum.join(' | ')); continue; }
    if (f.type === 'number' && (f.min !== undefined && v < f.min || f.max !== undefined && v > f.max)) { errs.push(k + ': Bereich ' + f.min + '–' + f.max); continue; }
    clean[k] = v;
  }
  if (errs.length) return { ok: false, status: 400, error: 'Konfiguration ungültig', details: errs };
  const all = loadConfig();
  all[id] = { ...(all[id] || {}), ...clean };
  saveConfig(all);
  // Laufende Instanz mit altem Stand beenden. Der nächste Start nimmt die neue Konfiguration.
  if (rec.started) shutdownSafe(rec);
  audit('module_config', { module: id, by: h.who, keys: Object.keys(clean) });
  refresh();
  return { ok: true, status: 200, status_detail: rec.status, missing_config: rec.missing_config };
}

// Neu erkennen und Hashes prüfen. Geänderte Module verlieren die Freigabe.
async function reload() {
  for (const rec of recs.values()) shutdownSafe(rec);
  const scan = discover();
  refresh();
  audit('modules_reloaded', { scanned: scan.scanned });
  const started = await startEnabled();
  return { ok: true, status: 200, ...scan, started };
}

// ---------- Ansichten ----------
function connectionOf(rec) {
  if (!rec.manifest || rec.manifest.type !== 'integration') return null;
  if (rec.manifest.mode !== 'live') return 'nicht_verbunden';
  if (rec.missing_config.length) return 'nicht_verbunden';
  if (rec.last_health && rec.last_health.status === 'ok' && rec.status === 'bereit') return 'verbunden_getestet';
  if (rec.last_health && rec.last_health.status !== 'ok') return 'eingerichtet_nicht_erreichbar';
  return 'eingerichtet_ungeprueft';
}

function view(rec) {
  const st = loadState()[rec.id] || {};
  const cfg = loadConfig()[rec.id] || {};
  refresh();
  const schema = {};
  for (const [k, f] of Object.entries((rec.manifest && rec.manifest.configSchema) || {})) {
    schema[k] = f.secret
      ? { type: f.type, secret: true, set: !!process.env[envName(rec.id, k)], env: envName(rec.id, k) }
      : { type: f.type, secret: false, value: cfg[k] !== undefined ? cfg[k] : f.default, default: f.default, enum: f.enum, min: f.min, max: f.max };
  }
  return {
    id: rec.id, folder: rec.folder, status: rec.status,
    name: rec.manifest ? rec.manifest.name : rec.folder,
    version: rec.manifest ? rec.manifest.version : null,
    type: rec.manifest ? rec.manifest.type : null,
    description: rec.manifest ? rec.manifest.description : null,
    author: rec.manifest ? rec.manifest.author : null,
    enabled: !!st.enabled, started: rec.started, quarantined: rec.quarantined,
    approved: !!(st.approval && st.approval.hash === rec.hash),
    approval: st.approval ? { by: st.approval.by, at: st.approval.at } : null,
    permissions: rec.manifest ? rec.manifest.permissions : [],
    granted: st.approval ? st.approval.grants : [],
    capabilities: rec.manifest ? rec.manifest.capabilities.map((c) => ({ name: c.name, description: c.description || '', permissions: c.permissions || [], input: c.input || {} })) : [],
    config: schema,
    missing_config: rec.missing_config,
    dependencies: rec.manifest ? (rec.manifest.dependencies || []) : [],
    dependency_problems: rec.manifest ? depCheck(rec).map((d) => d.msg) : [],
    healthCheck: rec.manifest ? rec.manifest.healthCheck : false,
    mode: rec.manifest ? rec.manifest.mode : null,
    connection: connectionOf(rec),
    last_health: rec.last_health,
    last_run: rec.last_run,
    errors: rec.errors.concat(rec.last_status_error ? [rec.last_status_error] : []),
    warnings: rec.warnings,
    last_errors: rec.last_errors,
    logs: rec.logs.slice(-20),
  };
}

function list() {
  refresh();
  return { scanned_at: lastScan, modules_dir: path.relative(path.join(__dirname, '..', '..', '..'), MODULES_DIR) || '.', duplicates: [...duplicates], modules: [...recs.values()].map(view) };
}

// Sucht nach Modul-ID oder Ordnername (ungültige Module haben nur den Ordnernamen).
function find(id) {
  return recs.get(id) || [...recs.values()].find((r) => r.id === id || r.folder === id) || null;
}

function get(id) {
  const rec = find(id);
  return rec ? view(rec) : null;
}

// Für die Registry: Erweiterungen als Einträge mit mode „module“.
function registryEntries() {
  refresh();
  return [...recs.values()].filter((r) => r.manifest).map((r) => ({
    area: r.id, name: r.manifest.name, state: r.status, mode: 'module',
    actions: r.manifest.capabilities.map((c) => c.name),
    note: 'Erweiterungsmodul ' + r.manifest.version + ' · ' + r.manifest.type,
  }));
}

// Startet alle Module, die freigegeben und aktiviert sind. Fehler bleiben lokal.
async function startEnabled() {
  const out = [];
  refresh();
  for (const rec of recs.values()) {
    if (!rec.manifest) continue;
    if (rec.status === 'bereit') continue;
    if (rec.status === 'freigegeben') out.push({ id: rec.id, ...(await start(rec.id)) });
  }
  return out;
}

module.exports = {
  MODULES_DIR, STATE_FILE, CONFIG_FILE, MAX_FAILS,
  discover, reload, list, get, view, registryEntries, startEnabled,
  start, stop, execute, health, approve, enable, disable, setConfig,
  checkInput, envName,
  meta: { area: 'EXT', id: 'module_loader', name: 'Modul-Loader (Manifest, Freigabe, Lebenszyklus, Isolation)', state: 'live' },
};
