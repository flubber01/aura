'use strict';
// AURA Area 61 — governed workflow definitions and deliberately non-executing
// workflow runs. A run can be drafted, simulated, approved and handed off;
// it cannot provision, deploy, publish, call a provider or run shell commands.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const skills = require('./skills_registry');
const omniroute = require('./omniroute');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'workflows.json');
const RUN_FILE = path.join(DATA_DIR, 'workflow_runs.json');
const RUN_STATES = Object.freeze(['DRAFT', 'SIMULATED', 'AWAITING_APPROVAL', 'APPROVED', 'HANDED_OFF', 'REJECTED', 'CLOSED']);
const TRANSITIONS = Object.freeze({
  DRAFT: ['SIMULATED', 'CLOSED'],
  SIMULATED: ['AWAITING_APPROVAL', 'DRAFT', 'CLOSED'],
  AWAITING_APPROVAL: ['APPROVED', 'REJECTED', 'DRAFT', 'CLOSED'],
  APPROVED: ['HANDED_OFF', 'DRAFT', 'CLOSED'],
  HANDED_OFF: ['CLOSED'],
  REJECTED: ['DRAFT', 'CLOSED'],
  CLOSED: [],
});
const ARTIFACT_TYPES = new Set(['brief', 'checklist', 'evidence', 'report', 'handoff', 'approval', 'rejection', 'rollback', 'incident', 'link']);

function cleanText(value, max) { return String(value == null ? '' : value).trim().slice(0, max); }
function now() { return new Date().toISOString(); }
function randomId(prefix) { return prefix + crypto.randomBytes(6).toString('hex'); }
function error(message, code) { const e = new Error(message); e.code = code || 400; return e; }
function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, file);
}
function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}
function load() {
  const db = readJson(FILE, { workflows: [] });
  if (!Array.isArray(db.workflows)) db.workflows = [];
  return db;
}
function save(db) { atomicWrite(FILE, db); }
function loadRuns() {
  const db = readJson(RUN_FILE, { schema_version: 2, runs: [] });
  if (!Array.isArray(db.runs)) db.runs = [];
  return db;
}
function saveRuns(db) { atomicWrite(RUN_FILE, db); }

function catalog() {
  return skills.workflows().map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    version: workflow.version || '1.0.0',
    kind: 'preset',
    purpose: workflow.purpose || 'AURA workflow template.',
    chain: Array.isArray(workflow.chain) ? workflow.chain : [],
    gates: Array.isArray(workflow.gates) ? workflow.gates : [],
    roles: Array.isArray(workflow.roles) ? workflow.roles : [],
    risk_class: workflow.risk_class || 'STANDARD',
    execution_mode: workflow.execution_mode || 'HANDOFF_ONLY',
    required_inputs: Array.isArray(workflow.required_inputs) ? workflow.required_inputs : ['brief', 'owner'],
    expected_outputs: Array.isArray(workflow.expected_outputs) ? workflow.expected_outputs : ['review record'],
    safety_boundary: workflow.safety_boundary || 'No external action is performed by this workflow definition.',
  }));
}
function list() {
  const presets = catalog();
  const custom = load().workflows.map((workflow) => ({ ...workflow, kind: 'custom', version: workflow.version || '1.0.0', execution_mode: 'SIMULATION_ONLY' }));
  return {
    schema_version: 2,
    lifecycle: RUN_STATES,
    presets,
    custom,
    boundary: 'Definitions and runs are local records. Simulation is deterministic; approval and handoff never execute an external action.',
  };
}
function findDefinition(id) {
  const key = cleanText(id, 80);
  const preset = catalog().find((workflow) => workflow.id === key);
  if (preset) return preset;
  const custom = load().workflows.find((workflow) => workflow.id === key);
  if (!custom) return null;
  return {
    id: custom.id, name: custom.name, version: custom.version || '1.0.0', kind: 'custom',
    purpose: 'Custom local workflow definition.', chain: (custom.steps || []).map((step) => step.role + ': ' + step.task),
    gates: custom.gates || {}, roles: (custom.steps || []).map((step) => step.role),
    risk_class: custom.gates && custom.gates.dataPrivate ? 'DATA_PRIVATE' : 'STANDARD',
    execution_mode: 'SIMULATION_ONLY', required_inputs: ['brief', 'owner'], expected_outputs: ['simulation trace'],
    safety_boundary: 'Custom workflows run only as a local deterministic simulation.',
  };
}

function validate(wf) {
  const errs = [];
  if (!wf.name || String(wf.name).trim().length < 3) errs.push('name required (min 3 chars)');
  if (!Array.isArray(wf.steps) || wf.steps.length < 2) errs.push('min 2 steps required');
  const known = new Set(skills.roles().map((role) => role.title));
  (wf.steps || []).forEach((step, index) => {
    if (!step.role) errs.push('step ' + (index + 1) + ': role missing');
    else if (!known.has(step.role)) errs.push('step ' + (index + 1) + ': unknown role "' + step.role + '"');
    if (!step.task || String(step.task).trim().length < 5) errs.push('step ' + (index + 1) + ': task description required');
    if (step.params != null && (typeof step.params !== 'object' || Array.isArray(step.params))) errs.push('step ' + (index + 1) + ': params must be a JSON object');
  });
  if (wf.params != null && (typeof wf.params !== 'object' || Array.isArray(wf.params))) errs.push('workflow params must be a JSON object');
  (wf.branches || []).forEach((branch, index) => {
    if (!branch.when || typeof branch.when !== 'string') errs.push('branch ' + (index + 1) + ': "when" condition (string) required');
    if (!branch.goto || typeof branch.goto !== 'string') errs.push('branch ' + (index + 1) + ': "goto" target required');
  });
  return errs;
}
function add(wf) {
  const errs = validate(wf || {});
  if (errs.length) return { ok: false, errors: errs };
  const db = load();
  const item = {
    id: 'WF-C' + crypto.randomBytes(3).toString('hex'), name: cleanText(wf.name, 120), kind: 'custom', version: '1.0.0',
    params: wf.params && typeof wf.params === 'object' ? JSON.parse(JSON.stringify(wf.params)) : {},
    branches: (Array.isArray(wf.branches) ? wf.branches : []).slice(0, 12).map((branch) => ({
      when: cleanText(branch.when, 200), goto: cleanText(branch.goto, 60), note: cleanText(branch.note, 200),
    })),
    steps: wf.steps.slice(0, 24).map((step) => ({
      role: step.role, task: cleanText(step.task, 400),
      ...(step.params && typeof step.params === 'object' ? { params: JSON.parse(JSON.stringify(step.params)) } : {}),
      ...(step.service ? { service: cleanText(step.service, 60) } : {}),
      ...(step.loop ? { loop: Math.max(1, Math.min(10, Number(step.loop) || 1)) } : {}),
    })),
    gates: {
      minApprovals: Math.max(1, Math.min(5, Number((wf.gates || {}).minApprovals) || 2)),
      integrityAudit: (wf.gates || {}).integrityAudit !== false,
      humanSignoff: (wf.gates || {}).humanSignoff !== false,
      dataPrivate: Boolean((wf.gates || {}).dataPrivate),
    },
    createdAt: now(), runs: 0,
  };
  db.workflows.unshift(item);
  db.workflows = db.workflows.slice(0, 100);
  save(db);
  return { ok: true, workflow: item };
}
function remove(id) {
  const db = load();
  const before = db.workflows.length;
  db.workflows = db.workflows.filter((workflow) => workflow.id !== id);
  save(db);
  return { ok: db.workflows.length < before, id };
}

function simulationTrace(definition, dataPrivate) {
  const steps = definition.chain.length ? definition.chain : ['Workflow definition has no declared steps.'];
  return steps.map((task, index) => {
    const lane = dataPrivate || definition.risk_class === 'DATA_PRIVATE'
      ? { lane: 'unsloth_local', reason: 'data-private workflow → local-first lane' }
      : omniroute.route({ task, tags: [] });
    return {
      step: index + 1, task: cleanText(task, 180), lane: lane.lane, routeReason: lane.reason,
      gate: index === steps.length - 1 ? 'SIMULATION ONLY · explicit approval required before handoff' : 'local planning hand-off',
      status: 'SIMULATED',
    };
  });
}
function simulate(id) {
  const definition = findDefinition(id);
  if (!definition) return { ok: false, error: 'workflow definition not found: ' + cleanText(id, 80) };
  const trace = simulationTrace(definition, definition.risk_class === 'DATA_PRIVATE');
  if (definition.kind === 'custom') {
    const db = load(); const workflow = db.workflows.find((entry) => entry.id === definition.id);
    if (workflow) { workflow.runs = Number(workflow.runs || 0) + 1; save(db); }
  }
  return {
    ok: true, mode: 'SIMULATION', workflow: definition.id, version: definition.version, name: definition.name,
    trace, verdict: 'SIM-PASS — no external action was attempted',
  };
}

function eventEnvelope(event) {
  return {
    id: event.id, at: event.at, kind: event.kind, by: event.by, note: event.note,
    from: event.from, to: event.to, detail: event.detail, previous_hash: event.previous_hash,
  };
}
function appendEvent(run, kind, by, note, from, to, detail) {
  const previous = run.history && run.history.length ? run.history[run.history.length - 1].hash : 'GENESIS';
  const event = {
    id: randomId('evt_'), at: now(), kind, by: cleanText(by, 80) || 'system', note: cleanText(note, 800),
    from: from || null, to: to || null, detail: detail || {}, previous_hash: previous,
  };
  event.hash = crypto.createHash('sha256').update(JSON.stringify(eventEnvelope(event))).digest('hex');
  run.history = Array.isArray(run.history) ? run.history : [];
  run.history.push(event);
  return event;
}
function getRunOrThrow(id) {
  const db = loadRuns();
  const run = db.runs.find((item) => item.id === cleanText(id, 100));
  if (!run) throw error('workflow run not found', 404);
  return { db, run };
}
function safeInput(input) {
  if (input == null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) throw error('input must be a JSON object');
  const raw = JSON.stringify(input);
  if (raw.length > 20000) throw error('input exceeds 20 KB');
  return JSON.parse(raw);
}
function inputGaps(definition, input, owner, scope) {
  const gaps = [];
  if (!owner) gaps.push('owner');
  if (!scope) gaps.push('scope');
  for (const field of definition.required_inputs || []) {
    if (field === 'owner' || field === 'scope') continue;
    if (input[field] == null || input[field] === '') gaps.push(field);
  }
  return gaps;
}
function createRun(payload) {
  payload = payload || {};
  const definition = findDefinition(payload.workflow_id || payload.workflowId);
  if (!definition) throw error('unknown workflow definition', 404);
  const owner = cleanText(payload.owner, 80);
  const scope = cleanText(payload.scope, 240);
  const input = safeInput(payload.input);
  const gaps = inputGaps(definition, input, owner, scope);
  if (gaps.length) throw error('missing required input: ' + gaps.join(', '));
  const riskClass = cleanText(payload.risk_class || definition.risk_class, 40);
  const run = {
    id: randomId('wfr_'), workflow_id: definition.id, workflow_name: definition.name, workflow_version: definition.version,
    template_kind: definition.kind, state: 'DRAFT', owner, scope, risk_class: riskClass, input,
    definition_snapshot: {
      purpose: definition.purpose, chain: definition.chain, gates: definition.gates, required_inputs: definition.required_inputs,
      expected_outputs: definition.expected_outputs, safety_boundary: definition.safety_boundary, execution_mode: definition.execution_mode,
    },
    artifacts: [], history: [], created_at: now(), updated_at: now(), closed_at: null,
  };
  appendEvent(run, 'RUN_CREATED', owner, cleanText(payload.note, 800) || 'Workflow run created as draft.', null, 'DRAFT', {
    boundary: 'No provider, host, deploy, publish or shell action is connected to workflow runs.',
  });
  const db = loadRuns(); db.runs.unshift(run); db.runs = db.runs.slice(0, 250); saveRuns(db);
  return run;
}
function updateState(id, target, payload) {
  payload = payload || {};
  if (!RUN_STATES.includes(target)) throw error('unknown target state');
  const { db, run } = getRunOrThrow(id);
  const operator = cleanText(payload.operator || payload.approved_by || payload.owner, 80);
  const note = cleanText(payload.note || payload.admin_authorization, 800);
  if (!operator) throw error('operator is required');
  if (!note) throw error('operator note is required');
  if (!(TRANSITIONS[run.state] || []).includes(target)) throw error('transition ' + run.state + ' → ' + target + ' is not permitted', 409);
  if (target === 'AWAITING_APPROVAL' && run.state !== 'SIMULATED') throw error('only simulated runs may enter approval', 409);
  if (target === 'APPROVED' && payload.confirm !== 'APPROVE_WORKFLOW') throw error('approval requires confirm: APPROVE_WORKFLOW', 400);
  if (target === 'APPROVED' && ['HIGH', 'CRITICAL'].includes(run.risk_class)) {
    if (operator === run.owner) throw error('four-eyes rule: HIGH/CRITICAL workflow owner and approver must differ', 409);
    if (!cleanText(payload.risk_acknowledgement, 800)) throw error('risk_acknowledgement is required for HIGH/CRITICAL approval');
    if (!cleanText(payload.rollback_note, 800)) throw error('rollback_note is required for HIGH/CRITICAL approval');
  }
  if (target === 'HANDED_OFF' && payload.confirm !== 'HANDOFF_WORKFLOW') throw error('handoff requires confirm: HANDOFF_WORKFLOW', 400);
  const from = run.state;
  run.state = target; run.updated_at = now();
  if (target === 'CLOSED') run.closed_at = now();
  appendEvent(run, target === 'APPROVED' ? 'APPROVAL_RECORDED' : target === 'HANDED_OFF' ? 'HANDOFF_RECORDED' : 'STATE_CHANGED', operator, note, from, target, {
    risk_acknowledgement: cleanText(payload.risk_acknowledgement, 800) || null,
    rollback_note: cleanText(payload.rollback_note, 800) || null,
    action_boundary: target === 'HANDED_OFF'
      ? 'Handoff record only. AURA did not dispatch work, access a host, or call an external provider.'
      : 'State record only.',
  });
  saveRuns(db);
  return run;
}
function simulateRun(id, payload) {
  const { db, run } = getRunOrThrow(id);
  if (run.state !== 'DRAFT') throw error('only DRAFT runs can be simulated', 409);
  const trace = simulationTrace({ chain: run.definition_snapshot.chain, risk_class: run.risk_class }, run.risk_class === 'DATA_PRIVATE');
  const operator = cleanText((payload || {}).operator, 80) || run.owner;
  run.state = 'SIMULATED'; run.updated_at = now();
  run.simulation = { at: now(), trace, verdict: 'SIM-PASS — no external action was attempted' };
  appendEvent(run, 'SIMULATION_COMPLETED', operator, cleanText((payload || {}).note, 800) || 'Deterministic simulation completed.', 'DRAFT', 'SIMULATED', { steps: trace.length });
  saveRuns(db);
  return run;
}
function addArtifact(id, payload) {
  payload = payload || {};
  const { db, run } = getRunOrThrow(id);
  const operator = cleanText(payload.operator, 80);
  const type = cleanText(payload.type, 40).toLowerCase();
  const name = cleanText(payload.name, 160);
  const summary = cleanText(payload.summary, 2000);
  const url = cleanText(payload.url, 500);
  const checksum = cleanText(payload.checksum, 128).toLowerCase();
  if (!operator || !name || !summary) throw error('operator, artifact name and summary are required');
  if (!ARTIFACT_TYPES.has(type)) throw error('artifact type must be one of: ' + [...ARTIFACT_TYPES].join(', '));
  if (url && !/^(https?:\/\/|\/)/.test(url)) throw error('artifact URL must be http(s) or a local relative path');
  if (checksum && !/^[a-f0-9]{32,128}$/.test(checksum)) throw error('checksum must be hexadecimal');
  const artifact = { id: randomId('art_'), type, name, summary, ...(url ? { url } : {}), ...(checksum ? { checksum } : {}), created_at: now(), created_by: operator };
  run.artifacts.push(artifact); run.updated_at = now();
  appendEvent(run, 'ARTIFACT_ADDED', operator, 'Added ' + type + ' artifact: ' + name, run.state, run.state, { artifact_id: artifact.id, type });
  saveRuns(db);
  return { run, artifact };
}
function reportIncident(id, payload) {
  payload = payload || {};
  const { db, run } = getRunOrThrow(id);
  const operator = cleanText(payload.operator, 80);
  const summary = cleanText(payload.summary, 2000);
  const severity = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(payload.severity || '').toUpperCase()) ? String(payload.severity).toUpperCase() : 'MEDIUM';
  if (!operator || !summary) throw error('operator and incident summary are required');
  const incident = { id: randomId('inc_'), severity, summary, state: 'OPEN', reported_at: now(), reported_by: operator };
  run.incidents = Array.isArray(run.incidents) ? run.incidents : [];
  run.incidents.push(incident); run.updated_at = now();
  appendEvent(run, 'INCIDENT_REPORTED', operator, summary, run.state, run.state, { incident_id: incident.id, severity, boundary: 'Incident recorded only; no containment action was executed.' });
  saveRuns(db);
  return { run, incident };
}
function auditRun(id) {
  const { run } = getRunOrThrow(id);
  let previous = 'GENESIS'; let valid = true;
  for (const event of run.history || []) {
    const expected = crypto.createHash('sha256').update(JSON.stringify(eventEnvelope(event))).digest('hex');
    if (event.previous_hash !== previous || event.hash !== expected) { valid = false; break; }
    previous = event.hash;
  }
  return { run_id: run.id, valid, events: (run.history || []).length, head_hash: previous, boundary: 'This verifies the local workflow audit chain. It is not a legal signature or external audit service.' };
}
function listRuns(options) {
  const state = cleanText((options || {}).state, 30).toUpperCase();
  const workflowId = cleanText((options || {}).workflow_id, 80);
  let runs = loadRuns().runs;
  if (state) runs = runs.filter((run) => run.state === state);
  if (workflowId) runs = runs.filter((run) => run.workflow_id === workflowId);
  return { schema_version: 2, lifecycle: RUN_STATES, boundary: 'Workflow runs are local records, not executed jobs.', runs: runs.map((run) => ({
    id: run.id, workflow_id: run.workflow_id, workflow_name: run.workflow_name, workflow_version: run.workflow_version,
    state: run.state, owner: run.owner, scope: run.scope, risk_class: run.risk_class, created_at: run.created_at,
    updated_at: run.updated_at, artifacts: run.artifacts.length, incidents: (run.incidents || []).length,
  })) };
}
function status() {
  const runs = loadRuns().runs;
  const byState = Object.fromEntries(RUN_STATES.map((state) => [state, runs.filter((run) => run.state === state).length]));
  return { mode: 'LOCAL_GOVERNED_WORKFLOWS', preset_definitions: catalog().length, custom_definitions: load().workflows.length, total_runs: runs.length, by_state: byState, execution: 'DISCONNECTED — simulation, approval records and handoff records only' };
}

module.exports = {
  meta: { area: '61', id: 'workflow_builder', name: 'Governed Workflow Builder (definitions → simulation → approvals → handoff)', state: 'live' },
  list, add, remove, simulate, createRun, simulateRun, updateState, addArtifact, reportIncident, auditRun, listRuns, getRun: (id) => getRunOrThrow(id).run,
  status, file: FILE, runFile: RUN_FILE, RUN_STATES,
  actions: { status },
};
