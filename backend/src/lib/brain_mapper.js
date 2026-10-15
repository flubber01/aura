'use strict';
// AURA Area 80 — Brain Role Mapper: modular assignment of WHICH agent/model
// plays WHICH brain role. Explicit slots for the ULTRA MASTER BRAIN (TIER-0),
// each SUPER MASTER BRAIN (TIER-1), every department HEAD (TIER-2) and the
// MINION workers (TIER-3). Admin-editable, persisted, audit-logged.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'brain_map.json');
const lazy = (n) => require('./' + n);

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { assignments: {}, defaults: {} }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

// role slots derived from the live hierarchy tree
function roleSlots() {
  const h = lazy('hierarchy');
  const nodes = h.tree();
  const slots = [];
  for (const n of nodes) {
    const role = n.tier === 0 ? 'ULTRA MASTER BRAIN' : n.tier === 1 ? 'SUPER MASTER BRAIN' : n.tier === 2 ? 'DEPARTMENT HEAD' : 'MINION';
    slots.push({ node: n.id, name: n.name, tier: n.tier, role, department: n.department || null });
  }
  return slots;
}

// assign an agent/model (ollama model name, external endpoint, or role-label) to a node
function assign(nodeId, agent) {
  const h = lazy('hierarchy');
  const node = h.tree().find((n) => n.id === nodeId);
  if (!node) { const e = new Error('unbekannter Hirn-Knoten "' + nodeId + '"'); e.code = 404; throw e; }
  const a = String(agent || '').trim();
  if (!a) { const e = new Error('agent fehlt (Modell-Name oder Endpoint)'); e.code = 400; throw e; }
  const db = load();
  db.assignments[nodeId] = { agent: a.slice(0, 120), assigned_at: new Date().toISOString(), by: 'admin' };
  save(db);
  try { lazy('store').audit({ area: '80', event: 'brain_assign', node: nodeId, agent: a }); } catch {}
  return { ok: true, node: nodeId, role: node.tier === 0 ? 'ULTRA MASTER BRAIN' : node.tier === 1 ? 'SUPER MASTER BRAIN' : node.tier === 2 ? 'DEPARTMENT HEAD' : 'MINION', agent: a };
}
function unassign(nodeId) {
  const db = load(); const had = !!db.assignments[nodeId];
  delete db.assignments[nodeId]; save(db);
  if (!had) { const e = new Error('kein Assignment für "' + nodeId + '"'); e.code = 404; throw e; }
  return { ok: true, node: nodeId };
}
// default agent for a whole tier (e.g. all minions -> a lightweight worker)
function setTierDefault(tier, agent) {
  if (![0, 1, 2, 3].includes(Number(tier))) { const e = new Error('tier muss 0..3 sein'); e.code = 400; throw e; }
  const db = load(); db.defaults[String(tier)] = String(agent || '').slice(0, 120); save(db);
  return { ok: true, tier: Number(tier), agent: db.defaults[String(tier)] };
}
function agentFor(nodeId) {
  const db = load();
  const h = lazy('hierarchy');
  const node = h.tree().find((n) => n.id === nodeId);
  if (db.assignments[nodeId]) return { source: 'explicit', agent: db.assignments[nodeId].agent };
  if (node && db.defaults[String(node.tier)]) return { source: 'tier-default', agent: db.defaults[String(node.tier)] };
  return { source: 'none', agent: null };
}

function map() {
  const db = load();
  return {
    assignments: roleSlots().map((s) => ({ ...s, agent: agentFor(s.node) })),
    tier_defaults: db.defaults,
    coverage: {
      ultra: agentFor((roleSlots().find((s) => s.tier === 0) || {}).node).agent,
      supers: roleSlots().filter((s) => s.tier === 1).map((s) => ({ node: s.node, agent: agentFor(s.node).agent })),
      heads: roleSlots().filter((s) => s.tier === 2).length,
      minions: roleSlots().filter((s) => s.tier === 3).length,
    },
  };
}

function status() {
  const db = load();
  return { area: '80', mode: 'LIVE', assigned: Object.keys(db.assignments).length, slots: roleSlots().length, note: 'Admin legt fest, welcher Agent welche Gehirn-Rolle spielt (Ultra/Super/Head/Minion); Änderungen sind audit-loggiert.' };
}

module.exports = {
  meta: { area: '80', id: 'brain_mapper', name: 'Brain Role Mapper (agent ↔ hierarchy role)', state: 'live' },
  actions: { status: () => status(), map: () => map(), assign: (p) => assign(String((p || {}).node), (p || {}).agent), unassign: (p) => unassign(String((p || {}).node)), tier_default: (p) => setTierDefault((p || {}).tier, (p || {}).agent) },
  status, map, assign, unassign, setTierDefault, agentFor, roleSlots,
};
