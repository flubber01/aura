'use strict';
// AURA Infrastructure Control Room — inventory and safe cluster planning only.
// It never SSHes, scans, provisions, migrates a workload or stores credentials.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'cluster_control.json');
const ARM_ROLES = ['compute', 'media', 'research', 'automation', 'ai_local', 'archive'];
const INTERFACES = ['aura_api', 'mcp', 'queue', 'storage_manifest', 'metrics'];
const MAIN_FUNCTIONS = ['AURA API + registry', 'Admin Control Room', 'primary state / backup responsibility'];

function now() { return new Date().toISOString(); }
function id() { return 'cluster-arm-' + crypto.randomBytes(4).toString('hex'); }
function clean(v, max = 160) { return String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function base() {
  return {
    version: 1,
    core: { id: 'aura-main-core', label: 'AURA Main Core', host_reference: '', environment: 'production', state: 'UNCONFIGURED', protected: true, functions: MAIN_FUNCTIONS, updated_at: null },
    arms: [], audit: [],
  };
}
function load() {
  try {
    const db = { ...base(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
    db.core = { ...base().core, ...(db.core || {}) }; db.arms = Array.isArray(db.arms) ? db.arms : []; db.audit = Array.isArray(db.audit) ? db.audit : [];
    return db;
  } catch { return base(); }
}
function save(db) {
  db.audit = (db.audit || []).slice(0, 160); fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const temp = FILE + '.tmp'; fs.writeFileSync(temp, JSON.stringify(db, null, 2)); JSON.parse(fs.readFileSync(temp, 'utf8')); fs.renameSync(temp, FILE);
}
function audit(db, event, detail) { db.audit.unshift({ at: now(), event, detail }); }
function requireAdmin(input, action) {
  const by = clean(input.approved_by, 100); const authorization = clean(input.admin_authorization, 600);
  if (by.length < 2 || authorization.length < 8) throw err(`${action}: Admin-Name und nachvollziehbare lokale Autorisierung sind Pflicht.`);
  return { by, authorization };
}
function safeInterfaces(input) {
  const selected = Array.isArray(input) ? input.map((x) => clean(x, 40)).filter((x) => INTERFACES.includes(x)) : [];
  return [...new Set(selected)];
}
function safeRole(value) { const role = clean(value, 40); return ARM_ROLES.includes(role) ? role : 'compute'; }
function number(value, max) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : 0; }
function summary(db) {
  const arms = db.arms || []; const enabled = arms.filter((a) => a.pool_state === 'POOL_DECLARED_NOT_CONNECTED');
  const capacity = (list) => list.reduce((out, a) => ({ cores: out.cores + a.cores, memory_gb: out.memory_gb + a.memory_gb, storage_gb: out.storage_gb + a.storage_gb }), { cores: 0, memory_gb: 0, storage_gb: 0 });
  return {
    main_core: { configured: db.core.state === 'MAIN_CORE_PROTECTED', protected: !!db.core.protected, label: db.core.label, host_reference: db.core.host_reference || null, functions: db.core.functions },
    arms: { total: arms.length, declared: arms.filter((a) => a.pool_state === 'DECLARED').length, pool_declared: enabled.length, standby: arms.filter((a) => a.pool_state === 'STANDBY').length },
    declared_capacity: capacity(arms), pool_capacity: capacity(enabled),
    boundary: 'Declared capacity is operator-entered planning data, not live telemetry. No remote node, workload or credential is contacted by this Control Room.',
  };
}
function status() { const db = load(); const snapshot = summary(db); return { mode: 'LOCAL_INFRASTRUCTURE_INVENTORY', ...snapshot, arm_summary: snapshot.arms, arms: db.arms.map((a) => ({ ...a })), roles: ARM_ROLES, interfaces: INTERFACES, recent_audit: db.audit.slice(0, 12) }; }
function configureCore(input = {}) {
  const db = load(); const admin = requireAdmin(input, 'Main-Core-Konfiguration');
  if (clean(input.confirm, 40) !== 'PROTECT_MAIN_CORE') throw err('Bestätige den geschützten Main Core exakt mit PROTECT_MAIN_CORE.');
  const label = clean(input.label, 100); const host = clean(input.host_reference, 180); const environment = clean(input.environment, 40) || 'production';
  if (label.length < 3 || host.length < 3) throw err('Main-Core-Name und eine nicht geheime Host-/Inventarreferenz sind Pflicht.');
  db.core = { ...db.core, label, host_reference: host, environment, state: 'MAIN_CORE_PROTECTED', protected: true, updated_at: now(), updated_by: admin.by };
  audit(db, 'main_core_protected', { label, host_reference: host, by: admin.by }); save(db); return { core: db.core, note: 'Main Core local inventory updated. No server was contacted or changed.' };
}
function addArm(input = {}) {
  const db = load(); const admin = requireAdmin(input, 'Project-Arm anlegen');
  const label = clean(input.label, 100); const host = clean(input.host_reference, 180); const role = safeRole(input.role); const interfaces = safeInterfaces(input.interfaces);
  if (label.length < 3 || host.length < 3) throw err('Name und Host-/Inventarreferenz sind Pflicht.');
  if (db.arms.some((a) => a.host_reference.toLowerCase() === host.toLowerCase())) throw err('Diese Host-/Inventarreferenz ist bereits als Project Arm vorhanden.', 409);
  const arm = { id: id(), label, host_reference: host, role, interfaces, cores: number(input.cores, 4096), memory_gb: number(input.memory_gb, 65536), storage_gb: number(input.storage_gb, 1048576), note: clean(input.note, 600), pool_state: 'DECLARED', connection_state: 'NOT_CONNECTED_NOT_PROBED', created_at: now(), updated_at: now(), created_by: admin.by };
  db.arms.unshift(arm); audit(db, 'project_arm_declared', { id: arm.id, label, role, by: admin.by }); save(db); return { arm, note: 'Project Arm registered locally. It is not connected, scanned or used for a workload.' };
}
function armById(db, armId) { const arm = db.arms.find((x) => x.id === String(armId)); if (!arm) throw err('Project Arm unbekannt.', 404); return arm; }
function setArmPool(armId, input = {}) {
  const db = load(); const admin = requireAdmin(input, 'Project-Arm-Poolstatus ändern'); const arm = armById(db, armId);
  const enabled = input.enabled === true;
  arm.pool_state = enabled ? 'POOL_DECLARED_NOT_CONNECTED' : 'STANDBY'; arm.updated_at = now(); arm.updated_by = admin.by;
  audit(db, enabled ? 'project_arm_pool_declared' : 'project_arm_standby', { id: arm.id, label: arm.label, by: admin.by }); save(db);
  return { arm, note: enabled ? 'Capacity was added to the declared planning pool only. No workload moved and no server was contacted.' : 'Project Arm put into local planning standby. No server was changed.' };
}
function removeArm(armId, input = {}) {
  const db = load(); const admin = requireAdmin(input, 'Project-Arm entfernen'); if (clean(input.confirm, 40) !== 'REMOVE_PROJECT_ARM') throw err('Bestätige das Entfernen exakt mit REMOVE_PROJECT_ARM.');
  const arm = armById(db, armId); db.arms = db.arms.filter((x) => x.id !== arm.id); audit(db, 'project_arm_removed', { id: arm.id, label: arm.label, by: admin.by }); save(db);
  return { ok: true, removed: { id: arm.id, label: arm.label }, note: 'Only the local inventory record was removed. No remote node was changed.' };
}
function preflight() {
  const db = load(); const arms = db.arms; const duplicateHost = new Set(); const seen = new Set();
  for (const arm of arms) { const host = arm.host_reference.toLowerCase(); if (seen.has(host)) duplicateHost.add(host); seen.add(host); }
  const checks = [
    { id: 'main_core', pass: db.core.state === 'MAIN_CORE_PROTECTED' && db.core.protected && db.core.host_reference.length >= 3, blocking: true, note: 'A protected Main Core is locally defined before project capacity is pooled.' },
    { id: 'duplicate_hosts', pass: !duplicateHost.size, blocking: true, note: duplicateHost.size ? `Duplicate inventory references: ${[...duplicateHost].join(', ')}` : 'Each Project Arm has a unique local inventory reference.' },
    { id: 'arms', pass: arms.length > 0, blocking: false, note: arms.length ? `${arms.length} Project Arm(s) are locally declared.` : 'No optional Project Arm is registered yet.' },
    { id: 'interfaces', pass: arms.every((a) => a.interfaces.every((x) => INTERFACES.includes(x))), blocking: true, note: 'Only declared AURA integration contracts are accepted.' },
    { id: 'remote_boundary', pass: true, blocking: true, note: 'No remote connectivity, SSH key, token, scan, deployment or workload migration is part of this preflight.' },
  ];
  const blocking = checks.filter((x) => x.blocking && !x.pass); return { mode: 'LOCAL_PREFLIGHT_ONLY', ready_for_operator_connection_plan: !blocking.length, checks, blocking_checks: blocking.map((x) => x.id), summary: summary(db), next: ['Review the protected Main Core reference.', 'Review each Project Arm ownership and intended role.', 'Create connection credentials outside AURA in a dedicated secret manager.', 'Use separately reviewed deployment tooling after human approval.'] };
}
function handoff() {
  const db = load(); return {
    kind: 'AURA_INFRASTRUCTURE_CONNECTION_MANIFEST', created_at: now(), main_core: db.core,
    project_arms: db.arms.map(({ id: arm_id, label, host_reference, role, interfaces, cores, memory_gb, storage_gb, pool_state, connection_state, note }) => ({ arm_id, label, host_reference, role, interfaces, declared_resources: { cores, memory_gb, storage_gb }, pool_state, connection_state, note })),
    explicit_exclusions: ['SSH private keys', 'passwords', 'API tokens', 'k3s join tokens', 'Kubeconfig', 'customer data', 'runtime data', 'remote execution'],
    operator_boundary: 'This manifest describes local planning inventory only. It cannot connect a server, schedule workload, change firewall, deploy AURA, claim HA or pool real compute.',
  };
}
module.exports = { status, configureCore, addArm, setArmPool, removeArm, preflight, handoff, ARM_ROLES, INTERFACES };
