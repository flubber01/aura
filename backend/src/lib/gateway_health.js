'use strict';
// AURA Area 34 — Gateway Health Monitor (LIVE, legal redesign).
// Überwacht die GESUNDHEIT der eigenen Gateways/Endpunkte (Latenz, Status,
// Fehlerquote) — keine Umgehungs-/Verschleierungsfunktionen. Probes laufen
// gegen eigene, konfigurierte Endpunkte.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const FILE = path.join(__dirname, '..', 'data', 'gateway_health.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { endpoints: [], checks: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function addEndpoint(body) {
  const url = String((body || {}).url || '').trim();
  let u; try { u = new URL(url); } catch { const e = new Error('ungültige URL'); e.code = 400; throw e; }
  if (!/^https?:$/.test(u.protocol)) { const e = new Error('nur http(s)'); e.code = 400; throw e; }
  const db = load();
  if (db.endpoints.some((x) => x.url === u.href)) { const e = new Error('Endpunkt schon registriert'); e.code = 409; throw e; }
  const ep = { id: 'gw-' + Date.now().toString(36), name: String(body.name || u.hostname).slice(0, 80), url: u.href, added_at: new Date().toISOString() };
  db.endpoints.push(ep); save(db);
  return { ok: true, endpoint: ep };
}
function removeEndpoint(id) {
  const db = load(); const before = db.endpoints.length;
  db.endpoints = db.endpoints.filter((x) => x.id !== id); save(db);
  return { ok: true, removed: before - db.endpoints.length };
}
function probeEndpoint(ep) {
  return new Promise((resolve) => {
    const u = new URL(ep.url);
    const mod = u.protocol === 'https:' ? https : http;
    const t0 = Date.now();
    const req = mod.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', timeout: 5000 }, (res) => {
      res.resume();
      res.on('end', () => resolve({ id: ep.id, url: ep.url, state: res.statusCode < 500 ? 'HEALTHY' : 'DEGRADED', http: res.statusCode, latency_ms: Date.now() - t0, at: new Date().toISOString() }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ id: ep.id, url: ep.url, state: 'DOWN', error: e.code || e.message, latency_ms: Date.now() - t0, at: new Date().toISOString() }));
    req.end();
  });
}
async function checkAll() {
  const db = load();
  const results = [];
  for (const ep of db.endpoints) results.push(await probeEndpoint(ep));
  // lokale Selbstprüfung ist immer möglich:
  results.push(await probeEndpoint({ id: 'self', url: 'http://127.0.0.1:8080/api/health' }));
  db.checks.push({ at: new Date().toISOString(), results: results.map((r) => ({ id: r.id, state: r.state, latency_ms: r.latency_ms, http: r.http })) });
  if (db.checks.length > 200) db.checks = db.checks.slice(-200);
  save(db);
  return { ok: true, results };
}
function report() {
  const db = load();
  const last = db.checks.slice(-20);
  const perEp = {};
  for (const c of last) for (const r of c.results) {
    perEp[r.id] = perEp[r.id] || { checks: 0, healthy: 0, avg_latency: 0, sum_latency: 0 };
    perEp[r.id].checks++; if (r.state === 'HEALTHY') perEp[r.id].healthy++;
    perEp[r.id].sum_latency += r.latency_ms || 0;
  }
  for (const k of Object.keys(perEp)) { perEp[k].uptime_pct = Math.round((perEp[k].healthy / perEp[k].checks) * 100); perEp[k].avg_latency_ms = Math.round(perEp[k].sum_latency / perEp[k].checks); delete perEp[k].healthy; delete perEp[k].sum_latency; }
  return { ok: true, window: last.length + ' Checks', endpoints: perEp };
}
function status() {
  const db = load();
  return { area: '34', mode: 'LIVE', endpoints: db.endpoints.length, checks: db.checks.length, scope: 'nur Gesundheitsmessung eigener/autorisierter Endpunkte — keine Umgehungsfunktionen' };
}

module.exports = {
  meta: { area: '34', id: 'gateway_health', name: 'Gateway health monitor (latency, uptime, self-check)', state: 'live' },
  actions: { status: () => status(), endpoint_add: (p) => addEndpoint(p || {}), endpoint_remove: (p) => removeEndpoint(String((p || {}).id)), check: () => checkAll(), report: () => report() },
  status, addEndpoint, removeEndpoint, checkAll, report,
};
