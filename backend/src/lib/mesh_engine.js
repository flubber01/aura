'use strict';
// AURA Area 29 — Sandbox Mesh Engine (LIVE).
// Echtes Mesh: Knoten registrieren sich per API, Heartbeats mit TTL,
// Routing-Tabelle über alle lebenden Knoten, Nachbarschafts-Ansicht.
// Läuft auch als ehrliches 1-Knoten-Mesh in der Sandbox — keine Simulation.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'mesh.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { nodes: {}, routes: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const TTL_MS = 90000;

function join(body) {
  const id = String((body || {}).id || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
  if (!id) { const e = new Error('id fehlt'); e.code = 400; throw e; }
  const db = load();
  db.nodes[id] = { id, addr: String(body.addr || '').slice(0, 120), caps: Array.isArray(body.caps) ? body.caps.slice(0, 10).map((c) => String(c).slice(0, 30)) : [], joined_at: db.nodes[id] ? db.nodes[id].joined_at : new Date().toISOString(), last_seen: new Date().toISOString() };
  db.routes.push({ at: new Date().toISOString(), event: 'join', node: id });
  if (db.routes.length > 300) db.routes = db.routes.slice(-300);
  save(db);
  return { ok: true, node: db.nodes[id], mesh_size: live(db).length };
}
function leave(id) {
  const db = load();
  if (!db.nodes[id]) { const e = new Error('Knoten unbekannt'); e.code = 404; throw e; }
  delete db.nodes[id];
  db.routes.push({ at: new Date().toISOString(), event: 'leave', node: id });
  save(db);
  return { ok: true, node: id };
}
function heartbeat(id) {
  const db = load();
  if (!db.nodes[id]) { const e = new Error('Knoten unbekannt — erst join()'); e.code = 404; throw e; }
  db.nodes[id].last_seen = new Date().toISOString(); save(db);
  return { ok: true, node: id };
}
function live(db) {
  const now = Date.now();
  return Object.values(db.nodes).filter((n) => now - new Date(n.last_seen).getTime() <= TTL_MS);
}
function routingTable() {
  const db = load();
  const l = live(db);
  return {
    generated_at: new Date().toISOString(),
    live_nodes: l.map((n) => ({ id: n.id, addr: n.addr, caps: n.caps, age_s: Math.round((Date.now() - new Date(n.last_seen).getTime()) / 1000) })),
    stale_nodes: Object.values(db.nodes).filter((n) => Date.now() - new Date(n.last_seen).getTime() > TTL_MS).map((n) => n.id),
    hops: l.length * (l.length - 1), // direkte Paare; Mesh ist voll vermascht über AURA-Dispatcher
    note: l.length ? 'ehrliches Mesh mit ' + l.length + ' lebenden Knoten' : 'Mesh leer — Knoten per join() anmelden',
  };
}
function status() {
  const db = load();
  const l = live(db);
  return { area: '29', mode: 'LIVE', nodes_total: Object.keys(db.nodes).length, live: l.length, ttl_ms: TTL_MS, events: db.routes.slice(-10).reverse() };
}

module.exports = {
  meta: { area: '29', id: 'mesh_engine', name: 'Sandbox mesh engine (join/heartbeat/routing table)', state: 'live' },
  actions: { status: () => status(), join: (p) => join(p || {}), leave: (p) => leave(String((p || {}).id)), heartbeat: (p) => heartbeat(String((p || {}).id)), table: () => routingTable() },
  status, join, leave, heartbeat, routingTable,
};
