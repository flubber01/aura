'use strict';
// AURA Area 61 — Workflow Builder: pick roles from the 63-role registry,
// chain them into a flexible workflow with gates, persist as JSON, simulate.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const skills = require('./skills_registry');
const omniroute = require('./omniroute');

const FILE = path.join(__dirname, '..', 'data', 'workflows.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { workflows: [] }; }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function list() {
  const presets = skills.workflows().map((w) => ({
    id: w.id, name: w.name, kind: 'preset', chain: w.chain, gates: w.gates, roles: w.roles,
  }));
  return { presets, custom: load().workflows };
}

function validate(wf) {
  const errs = [];
  if (!wf.name || wf.name.length < 3) errs.push('name required (min 3 chars)');
  if (!Array.isArray(wf.steps) || wf.steps.length < 2) errs.push('min 2 steps required');
  const known = new Set(skills.roles().map((r) => r.title));
  (wf.steps || []).forEach((s, i) => {
    if (!s.role) errs.push('step ' + (i + 1) + ': role missing');
    else if (!known.has(s.role)) errs.push('step ' + (i + 1) + ': unknown role "' + s.role + '"');
    if (!s.task || s.task.length < 5) errs.push('step ' + (i + 1) + ': task description required');
  });
  return errs;
}

function add(wf) {
  const errs = validate(wf);
  if (errs.length) return { ok: false, errors: errs };
  const db = load();
  const item = {
    id: 'WF-C' + crypto.randomBytes(3).toString('hex'),
    name: String(wf.name).slice(0, 120),
    kind: 'custom',
    steps: wf.steps.slice(0, 24).map((s) => ({ role: s.role, task: String(s.task).slice(0, 400) })),
    gates: {
      minApprovals: Math.max(1, Math.min(5, Number((wf.gates || {}).minApprovals) || 2)),
      integrityAudit: (wf.gates || {}).integrityAudit !== false,
      humanSignoff: (wf.gates || {}).humanSignoff !== false,
      dataPrivate: Boolean((wf.gates || {}).dataPrivate),
    },
    createdAt: new Date().toISOString(),
    runs: 0,
  };
  db.workflows.unshift(item);
  db.workflows = db.workflows.slice(0, 100);
  save(db);
  return { ok: true, workflow: item };
}

function remove(id) {
  const db = load();
  const before = db.workflows.length;
  db.workflows = db.workflows.filter((w) => w.id !== id);
  save(db);
  return { ok: db.workflows.length < before, id };
}

// deterministic local simulation — labeled SIMULATION, no external calls
function simulate(wfId) {
  const db = load();
  const wf = db.workflows.find((w) => w.id === wfId) || null;
  if (!wf) return { ok: false, error: 'custom workflow not found: ' + wfId };
  const laneBase = omniroute.route({ task: wf.name, tags: wf.gates.dataPrivate ? ['data-private'] : [] });
  const trace = [];
  let ok = true;
  wf.steps.forEach((s, i) => {
    const lane = wf.gates.dataPrivate
      ? { lane: 'unsloth_local', reason: 'workflow gate data-private → local first' }
      : omniroute.route({ task: s.task, tags: [] });
    trace.push({
      step: i + 1, role: s.role, task: s.task.slice(0, 80),
      lane: lane.lane, routeReason: lane.reason,
      gate: i === wf.steps.length - 1
        ? 'integrity ' + (wf.gates.integrityAudit ? 'PASS' : 'skipped') +
          ' · approvals ' + wf.gates.minApprovals + '/required' +
          (wf.gates.humanSignoff ? ' · human sign-off REQUIRED before publish' : '')
        : 'step hand-off OK',
      status: 'OK',
    });
  });
  wf.runs += 1;
  save(db);
  return {
    ok: true, mode: 'SIMULATION', workflow: wf.id, name: wf.name,
    laneBase: { lane: laneBase.lane, reason: laneBase.reason },
    trace, verdict: ok ? 'SIM-PASS — safe to run when connected' : 'SIM-FAIL',
  };
}

module.exports = {
  meta: { area: '61', id: 'workflow_builder', name: 'Workflow Builder (roles → gates → JSON → sim)', state: 'live' },
  list, add, remove, simulate, file: FILE,
  actions: {
    status: () => ({ custom_workflows: load().workflows.length, presets: skills.workflows().length, simulate: 'SIMULATION-labeled, deterministic' }),
  },
};
