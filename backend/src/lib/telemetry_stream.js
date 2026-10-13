'use strict';
// AURA Area 30 — Streaming Telemetry / Remote Workers (LIVE).
// ECHTE Telemetrie: Prozess-Metriken, Request-Zähler (Area 65), Registry- und
// Ops-Zustand — live als SSE-Stream. Remote Worker registrieren sich mit
// Heartbeat. Keine simulierten Zahlen, nirgendwo.
const os = require('os');
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'telemetry_workers.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { workers: {} }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const WORKER_TTL_MS = 120000;
const startedAt = Date.now();

function snapshot() {
  const registry = require('./registry');
  const traffic = require('./traffic');
  const ops = require('./ops');
  const mem = process.memoryUsage();
  const c = registry.counts();
  return {
    at: new Date().toISOString(),
    process: { rss_mb: Math.round(mem.rss / 1048576), heap_mb: Math.round(mem.heapUsed / 1048576), uptime_s: Math.round((Date.now() - startedAt) / 1000), node: process.version },
    host: { cpus: os.cpus().length, loadavg: os.loadavg().map((x) => Math.round(x * 100) / 100), freemem_mb: Math.round(os.freemem() / 1048576) },
    requests: traffic.report ? traffic.report() : null,
    fleet: { total: c.total, live: c.live, skills: c.skills, placeholder: c.placeholder, review: c.review, restricted: c.restricted },
    ops: { kill_switch: ops.status().kill_switch, scheduler_running: ops.status().scheduler_running },
  };
}

function stream(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
  res.write('retry: 2000\n\n');
  const send = () => { try { res.write('data: ' + JSON.stringify(snapshot()) + '\n\n'); } catch {} };
  send();
  const iv = setInterval(send, 2000);
  res.on('close', () => clearInterval(iv));
  return true;
}

function registerWorker(body) {
  const id = String((body || {}).id || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
  if (!id) { const e = new Error('id fehlt'); e.code = 400; throw e; }
  const db = load();
  db.workers[id] = { id, role: String(body.role || 'worker').slice(0, 60), addr: String(body.addr || '').slice(0, 120), last_seen: new Date().toISOString(), registered_at: (db.workers[id] || {}).registered_at || new Date().toISOString() };
  save(db);
  return { ok: true, worker: db.workers[id] };
}
function workerHeartbeat(id) {
  const db = load();
  if (!db.workers[id]) { const e = new Error('Worker unbekannt — erst registrieren'); e.code = 404; throw e; }
  db.workers[id].last_seen = new Date().toISOString(); save(db);
  return { ok: true, worker: id };
}
function workers() {
  const db = load(); const now = Date.now();
  return Object.values(db.workers).map((w) => ({ ...w, live: now - new Date(w.last_seen).getTime() <= WORKER_TTL_MS }));
}
function status() {
  const w = workers();
  return { area: '30', mode: 'LIVE', stream: '/api/telemetry/stream (SSE, 2s-Takt, echte Metriken)', workers_total: w.length, workers_live: w.filter((x) => x.live).length, note: 'alle Zahlen sind gemessen, nie erfunden' };
}

module.exports = {
  meta: { area: '30', id: 'telemetry_stream', name: 'Streaming telemetry / remote workers (real metrics, SSE)', state: 'live' },
  actions: { status: () => status(), snapshot: () => snapshot(), worker_register: (p) => registerWorker(p || {}), worker_heartbeat: (p) => workerHeartbeat(String((p || {}).id)), workers: () => workers() },
  status, snapshot, stream, registerWorker, workerHeartbeat, workers,
};
