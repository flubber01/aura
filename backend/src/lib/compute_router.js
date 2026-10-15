'use strict';
// AURA Area 27 — Intranet Compute Router (LIVE).
// Echter Job-Scheduler für Intranet-Knoten: Registrierung, Heartbeats mit
// Stale-Erkennung, Scheduling auf den Knoten mit den meisten freien Kernen.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'compute_router.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { nodes: [], jobs: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const STALE_MS = 120000;

function registerNode(body) {
  const id = String((body || {}).id || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
  if (!id) { const e = new Error('id fehlt'); e.code = 400; throw e; }
  const db = load();
  const node = { id, cores: Math.max(1, parseInt(body.cores || 4, 10)), ram_gb: Math.max(1, parseInt(body.ram_gb || 8, 10)), addr: String(body.addr || '').slice(0, 120), busy_cores: 0, last_seen: new Date().toISOString(), registered_at: new Date().toISOString() };
  db.nodes = db.nodes.filter((n) => n.id !== id);
  db.nodes.push(node); save(db);
  return { ok: true, node };
}
function heartbeat(id) {
  const db = load();
  const n = db.nodes.find((x) => x.id === id);
  if (!n) { const e = new Error('Knoten nicht registriert'); e.code = 404; throw e; }
  n.last_seen = new Date().toISOString();
  save(db);
  return { ok: true, node: id, last_seen: n.last_seen };
}
function liveNodes() {
  const db = load(); const now = Date.now();
  return db.nodes.map((n) => ({ ...n, stale: now - new Date(n.last_seen).getTime() > STALE_MS })).filter((n) => !n.stale);
}
function submitJob(body) {
  const name = String((body || {}).name || 'job').slice(0, 120);
  const need = Math.max(1, parseInt(body.cores || 1, 10));
  const db = load();
  const now = Date.now();
  const avail = db.nodes.filter((n) => now - new Date(n.last_seen).getTime() <= STALE_MS && n.cores - n.busy_cores >= need);
  if (!avail.length) {
    const job = { id: 'job-' + Date.now().toString(36), name, cores: need, state: 'pending', created_at: new Date().toISOString() };
    db.jobs.push(job); save(db);
    return { ok: true, job, state: 'pending', note: 'kein freier Knoten — Job wartet in der Queue (echte Queue, kein Fake)' };
  }
  avail.sort((a, b) => (b.cores - b.busy_cores) - (a.cores - a.busy_cores));
  const node = avail[0];
  node.busy_cores += need;
  const job = { id: 'job-' + Date.now().toString(36), name, cores: need, state: 'running', node: node.id, started_at: new Date().toISOString() };
  db.jobs.push(job); save(db);
  return { ok: true, job, node: node.id };
}
function completeJob(id) {
  const db = load();
  const job = db.jobs.find((j) => j.id === id);
  if (!job) { const e = new Error('Job nicht gefunden'); e.code = 404; throw e; }
  if (job.state === 'running' && job.node) {
    const n = db.nodes.find((x) => x.id === job.node);
    if (n) n.busy_cores = Math.max(0, n.busy_cores - job.cores);
  }
  job.state = 'done'; job.finished_at = new Date().toISOString();
  // pending jobs nachrücken lassen
  for (const p of db.jobs.filter((j) => j.state === 'pending')) {
    const now = Date.now();
    const cand = db.nodes.filter((n) => now - new Date(n.last_seen).getTime() <= STALE_MS && n.cores - n.busy_cores >= p.cores).sort((a, b) => (b.cores - b.busy_cores) - (a.cores - a.busy_cores))[0];
    if (cand) { cand.busy_cores += p.cores; p.state = 'running'; p.node = cand.id; p.started_at = new Date().toISOString(); }
  }
  save(db);
  return { ok: true, job: id, state: 'done' };
}
function status() {
  const db = load();
  const live = liveNodes();
  return { area: '27', mode: 'LIVE', nodes: db.nodes.length, live_nodes: live.length, jobs: db.jobs.length, running: db.jobs.filter((j) => j.state === 'running').length, pending: db.jobs.filter((j) => j.state === 'pending').length, utilization: live.map((n) => ({ node: n.id, busy: n.busy_cores + '/' + n.cores })) };
}

module.exports = {
  meta: { area: '27', id: 'compute_router', name: 'Intranet compute router (nodes, heartbeats, scheduling)', state: 'live' },
  actions: { status: () => status(), node_register: (p) => registerNode(p || {}), heartbeat: (p) => heartbeat(String((p || {}).id)), submit: (p) => submitJob(p || {}), complete: (p) => completeJob(String((p || {}).id)) },
  status, registerNode, heartbeat, submitJob, completeJob, liveNodes,
};
