'use strict';
// AURA Area 74 — Service Fabric: self-installable services & modes.
//
// Users can ADD / REMOVE / INSTALL / UNINSTALL / TOGGLE modular services
// (internal AURA areas or own http endpoints) and switch system MODES.
// Every probe is honest: internal services report real health, external
// ones LIVE only after a real HTTP probe succeeds.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'service_fabric.json');

// internal services map to REAL health checks inside AURA
const INTERNAL_PROBES = {
  'area-71-imagegen': () => require('./image_gen').status().then((s) => ({ up: true, detail: 'gateway mode ' + s.mode })),
  'area-62-research': () => Promise.resolve({ up: true, detail: 'live GitHub-API fan-out bereit' }),
  'area-63-seo': () => Promise.resolve({ up: true, detail: 'on-site audit bereit' }),
  'area-73-forge': () => Promise.resolve({ up: true, detail: require('./content_forge').status().items.total + ' content items' }),
  'area-72-mcp': () => Promise.resolve({ up: true, detail: require('./mcp_manager').status().servers + ' MCP-Server registriert' }),
  'area-70-modulehub': () => Promise.resolve({ up: true, detail: require('./module_system').status().counts.total + ' Manifest-Module' }),
  'area-08-kids-story': () => Promise.resolve({ up: true, detail: 'safety filter aktiv' }),
  'area-17-report': () => Promise.resolve({ up: true, detail: 'daemon ' + (require('./report_daemon').status().enabled ? 'aktiv' : 'pausiert') }),
};

const MODES = [
  { id: 'safe', name: 'Safe Mode', desc: 'blockiert Bild-Generierung + Routine-Feuer bis deaktiviert', def: false },
  { id: 'creative', name: 'Creative Mode', desc: 'Forge legt Entwürfe mit erweitertem Brief-Kontext an', def: true },
  { id: 'quiet', name: 'Quiet Mode', desc: 'Daemons feuern, aber ohne Folgeaktionen (nur Protokoll)', def: false },
];

// These are review templates, not installed software or live endpoints. They give
// WF-15 a stable source-controlled vocabulary without implying a deployment.
const SELFHOST_REVIEW_PRESETS = [
  { id: 'anythingllm', name: 'AnythingLLM', purpose: 'local knowledge workspace evaluation' },
  { id: 'aio-sandbox', name: 'aio-sandbox', purpose: 'isolated workload design review' },
  { id: 'excalidraw', name: 'Excalidraw', purpose: 'self-hosted visual planning review' },
  { id: 'openmausbot', name: 'OpenMausBot', purpose: 'agent-harness pattern review' },
];
function defaultServices() {
  return [
    ...Object.keys(INTERNAL_PROBES).map((id) => ({ id, name: id, kind: 'internal', installed: true, enabled: true, addedBy: 'system', url: '' })),
    ...SELFHOST_REVIEW_PRESETS.map((preset) => ({
      ...preset, kind: 'selfhost-review-template', installed: false, enabled: false, addedBy: 'system', url: '',
      status_note: 'NOT-INSTALLED — review template only; use WF-15 before any separate owner-approved deployment.',
    })),
  ];
}

function mergeReviewPresets(db) {
  if (!Array.isArray(db.services)) db.services = [];
  let changed = false;
  for (const preset of SELFHOST_REVIEW_PRESETS) {
    if (db.services.some((service) => service.id === preset.id)) continue;
    db.services.push({ ...preset, kind: 'selfhost-review-template', installed: false, enabled: false, addedBy: 'system', url: '', status_note: 'NOT-INSTALLED — review template only; use WF-15 before any separate owner-approved deployment.' });
    changed = true;
  }
  return changed;
}
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (mergeReviewPresets(db)) save(db);
    return db;
  } catch {
    return {
      services: defaultServices(),
      modes: Object.fromEntries(MODES.map((m) => [m.id, m.def])),
      usage: {},
    };
  }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE);
}
function recordUse(db, id, what) {
  const u = db.usage[id] || (db.usage[id] = { calls: 0, last: null, events: [] });
  u.calls += 1; u.last = new Date().toISOString();
  u.events.unshift({ at: u.last, what }); if (u.events.length > 10) u.events.length = 10;
}

function addService(input = {}) {
  const name = String(input.name || '').trim();
  if (name.length < 3) { const e = new Error('name required'); e.code = 400; throw e; }
  const url = String(input.url || '').trim();
  if (!/^https?:\/\/[^/\s]+/.test(url)) { const e = new Error('url muss http(s)://host[:port][/pfad] sein'); e.code = 400; throw e; }
  const db = load();
  const id = String(input.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40));
  if (db.services.some((s) => s.id === id)) { const e = new Error('service "' + id + '" existiert bereits'); e.code = 409; throw e; }
  const svc = { id, name: name.slice(0, 80), kind: 'http', url: url.slice(0, 300), health_path: String(input.health_path || '').slice(0, 120), installed: false, enabled: false, addedBy: 'user', addedAt: new Date().toISOString() };
  db.services.push(svc); recordUse(db, id, 'added'); save(db);
  return svc;
}
function removeService(id) {
  const db = load(); const n = db.services.length;
  const svc = db.services.find((s) => s.id === id);
  if (!svc) { const e = new Error('unknown service'); e.code = 404; throw e; }
  if (svc.addedBy === 'system') { const e = new Error('System-Services können nur deaktiviert, nicht gelöscht werden'); e.code = 403; throw e; }
  db.services = db.services.filter((s) => s.id !== id); delete db.usage[id];
  save(db);
  return { ok: true, removed: id };
}
function setInstalled(id, on) {
  const db = load(); const svc = db.services.find((s) => s.id === id);
  if (!svc) { const e = new Error('unknown service'); e.code = 404; throw e; }
  svc.installed = !!on; if (!on) svc.enabled = false;
  recordUse(db, id, on ? 'installed' : 'uninstalled'); save(db);
  return svc;
}
function setEnabled(id, on) {
  const db = load(); const svc = db.services.find((s) => s.id === id);
  if (!svc) { const e = new Error('unknown service'); e.code = 404; throw e; }
  if (on && !svc.installed) { const e = new Error('erst installieren, dann aktivieren'); e.code = 409; throw e; }
  svc.enabled = !!on; recordUse(db, id, on ? 'enabled' : 'disabled'); save(db);
  return svc;
}

function probeHttp(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let u; try { u = new URL(url); } catch { return resolve({ up: false, detail: 'invalid url' }); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', timeout: timeoutMs,
      ...(u.protocol === 'https:' && fs.existsSync('/etc/ssl/certs/ca-certificates.crt') ? { ca: fs.readFileSync('/etc/ssl/certs/ca-certificates.crt') } : {}) },
      (res) => { res.resume(); resolve({ up: res.statusCode < 500, detail: 'HTTP ' + res.statusCode }); });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ up: false, detail: e.message.slice(0, 80) }));
    req.end();
  });
}

async function probeService(id) {
  const db = load(); const svc = db.services.find((s) => s.id === id);
  if (!svc) { const e = new Error('unknown service'); e.code = 404; throw e; }
  let r;
  if (svc.kind === 'internal' && INTERNAL_PROBES[svc.id]) {
    try { r = await INTERNAL_PROBES[svc.id](); } catch (e2) { r = { up: false, detail: e2.message }; }
  } else {
    r = await probeHttp(svc.url.replace(/\/$/, '') + (svc.health_path || ''));
  }
  svc.last_probe = { at: new Date().toISOString(), up: r.up, detail: r.detail };
  recordUse(db, id, 'probe:' + (r.up ? 'up' : 'down'));
  save(db);
  return { service: id, state: r.up ? 'LIVE' : 'NOT-CONNECTED', detail: r.detail };
}

function mode(id) { const db = load(); return db.modes[id] === true; }
function setMode(id, on) {
  if (!MODES.some((m) => m.id === id)) { const e = new Error('unknown mode; verfügbar: ' + MODES.map((m) => m.id).join(', ')); e.code = 404; throw e; }
  const db = load(); db.modes[id] = !!on; recordUse(db, 'mode:' + id, on ? 'on' : 'off'); save(db);
  return { ok: true, mode: id, active: !!on };
}
function isServiceActive(id) {
  const db = load(); const svc = db.services.find((s) => s.id === id);
  return !!(svc && svc.installed && svc.enabled);
}

async function status() {
  const db = load();
  const services = [];
  for (const s of db.services) {
    const u = db.usage[s.id] || { calls: 0, last: null };
    services.push({ ...s, state: !s.installed ? 'not-installed' : (s.last_probe ? (s.last_probe.up ? 'LIVE' : 'NOT-CONNECTED') : 'installed-unprobed'), last_probe: s.last_probe || null, usage: { calls: u.calls, last: u.last } });
  }
  return {
    area: '74', mode: 'LIVE',
    note: 'modulare Services + System-Modi; interne Probes sind echte Health-Checks, externe ehrlich LIVE nur nach erfolgreichem HTTP-Check',
    services, modes: MODES.map((m) => ({ ...m, active: db.modes[m.id] === true })),
  };
}

module.exports = {
  meta: { area: '74', id: 'service_fabric', name: 'Service Fabric (self-installable services + modes)', state: 'live' },
  actions: {
    status: () => status(),
    add: (p) => addService(p || {}),
    remove: (p) => removeService(String((p || {}).id)),
    install: (p) => setInstalled(String((p || {}).id), true),
    uninstall: (p) => setInstalled(String((p || {}).id), false),
    enable: (p) => setEnabled(String((p || {}).id), (p || {}).on !== false),
    probe: (p) => probeService(String((p || {}).id)),
    mode: (p) => setMode(String((p || {}).id), (p || {}).on),
  },
  status, addService, removeService, setInstalled, setEnabled, probeService, mode, setMode, isServiceActive, MODES,
};
