'use strict';
// AURA Area 26 — Master Hardware Router (LIVE).
// Echter Geräte-Router: Geräte-Registry mit Capabilities, Task-Routing per
// Capability-Match + geringste Last, Freigabe/Zuweisung. Probes gegen echte
// Adressen melden ehrlich NOT-CONNECTED aus der Sandbox (auf dem Host LIVE).
const fs = require('fs');
const path = require('path');
const net = require('net');
const FILE = path.join(__dirname, '..', 'data', 'hardware_router.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { devices: [], assignments: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function addDevice(body) {
  const id = String((body || {}).id || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
  if (!id) { const e = new Error('id fehlt'); e.code = 400; throw e; }
  const db = load();
  if (db.devices.some((d) => d.id === id)) { const e = new Error('Gerät existiert schon'); e.code = 409; throw e; }
  const dev = { id, kind: String(body.kind || 'server').slice(0, 40), caps: Array.isArray(body.caps) ? body.caps.slice(0, 20).map((c) => String(c).toLowerCase().slice(0, 30)) : [], addr: String(body.addr || '').slice(0, 120), load: 0, registered_at: new Date().toISOString() };
  db.devices.push(dev); save(db);
  return { ok: true, device: dev };
}
function removeDevice(id) {
  const db = load(); const before = db.devices.length;
  db.devices = db.devices.filter((d) => d.id !== id);
  db.assignments = db.assignments.filter((a) => a.device !== id);
  save(db);
  return { ok: true, removed: before - db.devices.length };
}
function route(task) {
  const need = Array.isArray((task || {}).caps) ? task.caps.map((c) => String(c).toLowerCase()) : [];
  const db = load();
  const candidates = db.devices.filter((d) => need.every((c) => d.caps.includes(c)));
  if (!candidates.length) { const e = new Error('kein Gerät mit Capabilities: ' + (need.join(',') || '(leer)')); e.code = 404; throw e; }
  candidates.sort((a, b) => a.load - b.load);
  const dev = candidates[0];
  dev.load++;
  const assignment = { id: 'asg-' + Date.now().toString(36), task: String(task.name || 'task').slice(0, 120), caps: need, device: dev.id, at: new Date().toISOString() };
  db.assignments.push(assignment); if (db.assignments.length > 500) db.assignments = db.assignments.slice(-500);
  save(db);
  return { ok: true, routed_to: dev.id, candidates: candidates.map((c) => c.id), assignment };
}
function release(assignmentId) {
  const db = load();
  const a = db.assignments.find((x) => x.id === assignmentId);
  if (!a) { const e = new Error('Assignment nicht gefunden'); e.code = 404; throw e; }
  const dev = db.devices.find((d) => d.id === a.device);
  if (dev && dev.load > 0) dev.load--;
  db.assignments = db.assignments.filter((x) => x.id !== assignmentId);
  save(db);
  return { ok: true, released: assignmentId };
}
function probeDevice(id) {
  const db = load();
  const dev = db.devices.find((d) => d.id === id);
  if (!dev) { const e = new Error('Gerät nicht gefunden'); e.code = 404; throw e; }
  const m = /^([a-z0-9.-]+):(\d+)$/.exec(dev.addr || '');
  if (!m) return Promise.resolve({ ok: false, device: id, state: 'NOT-CONFIGURED', detail: 'addr im Format host:port setzen' });
  return new Promise((resolve) => {
    const sock = net.connect({ host: m[1], port: Number(m[2]), timeout: 3500 });
    sock.on('connect', () => { sock.destroy(); resolve({ ok: true, device: id, state: 'LIVE', detail: dev.addr + ' erreichbar' }); });
    sock.on('timeout', () => { sock.destroy(); resolve({ ok: false, device: id, state: 'NOT-CONNECTED', detail: 'timeout' }); });
    sock.on('error', (e) => resolve({ ok: false, device: id, state: 'NOT-CONNECTED', detail: e.code || e.message }));
  });
}
function status() {
  const db = load();
  return { area: '26', mode: 'LIVE', devices: db.devices.length, active_assignments: db.assignments.length, routing: 'capability-match + geringste Last', note: 'eigene/autorisierte Hardware; Probes aus der Sandbox ehrlich NOT-CONNECTED' };
}

module.exports = {
  meta: { area: '26', id: 'hardware_router', name: 'Master hardware router (capability routing + probes)', state: 'live' },
  actions: { status: () => status(), device_add: (p) => addDevice(p || {}), device_remove: (p) => removeDevice(String((p || {}).id)), route: (p) => route(p || {}), release: (p) => release(String((p || {}).id)), probe: (p) => probeDevice(String((p || {}).id)) },
  status, addDevice, removeDevice, route, release, probeDevice,
};
