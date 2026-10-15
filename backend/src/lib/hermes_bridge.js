'use strict';
// Hermes bridge contract — intentionally no Hermes installer, subprocess, network client,
// credential store or direct host control. This is a reviewable plan for a future isolated
// integration only, and it remains disconnected until an owner approves a separate build.
const crypto = require('crypto');

const CONTRACT_VERSION = '0.1.0-planning';
const CAPABILITIES = Object.freeze([
  {
    id: 'read_workflow_template', direction: 'hermes_to_aura', risk: 'LOW', enabled: false,
    boundary: 'Can read public, source-controlled workflow metadata only; no runtime ledgers, secrets, user data or host details.',
  },
  {
    id: 'submit_workflow_draft', direction: 'hermes_to_aura', risk: 'MEDIUM', enabled: false,
    boundary: 'May propose a DRAFT workflow record for human review; cannot simulate, approve, hand off or execute it.',
  },
  {
    id: 'request_handoff_review', direction: 'hermes_to_aura', risk: 'MEDIUM', enabled: false,
    boundary: 'May request a human review of an existing run; cannot set approval or handoff state.',
  },
]);
const NEVER_GRANTED = Object.freeze([
  'root or sudo access', 'shell command execution on the AURA Main Core', 'SSH, Kubernetes, container or deployment control',
  'read/write access to .env files, secret stores, private runtime ledgers or user media', 'Git push, pull-request merge, release, publish or payment authority',
  'automatic approval, handoff, scheduling, network scan, firewall or host action',
]);
const REQUIRED_CONTROLS = Object.freeze([
  'Run Hermes in a rootless isolated runtime, separate from the AURA Main Core service account.',
  'Use a dedicated read-only source mount and a narrow AURA HTTP bridge, never a broad host mount.',
  'Keep credentials outside both AURA and Hermes; issue short-lived scoped bridge credentials only after a separate owner decision.',
  'Default every bridge capability to disabled and require a human approval record for each capability expansion.',
  'Log request metadata and decisions without logging secrets or raw private content.',
  'Verify backup restore, revoke path, rate limits, input schemas and incident procedure before connection.',
]);

function canonical(value) { return JSON.stringify(value); }
function digest(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
function manifest() {
  const body = {
    contract_version: CONTRACT_VERSION,
    mode: 'NOT_INSTALLED_NOT_CONNECTED',
    scope: 'Planning contract only. Hermes is not installed, downloaded, configured, granted permissions or connected by AURA.',
    proposed_capabilities: CAPABILITIES,
    never_granted: NEVER_GRANTED,
    required_controls: REQUIRED_CONTROLS,
    approval_model: {
      draft_creation: 'A future bridge may propose only an AURA workflow DRAFT.',
      state_changes: 'SIMULATED, AWAITING_APPROVAL, APPROVED, HANDED_OFF and CLOSED remain AURA human-operator actions.',
      external_effects: 'AURA and this bridge perform no provider, deployment, publish, Git or host operation.',
    },
    revoke_plan: ['Disable bridge listener or scoped credential.', 'Remove isolated runtime access.', 'Preserve local audit evidence.', 'Rotate any separately issued bridge credential.', 'Re-run backup/restore and incident review.'],
  };
  return { ...body, manifest_sha256: digest(body) };
}
function preflight() {
  return {
    mode: 'BLOCKED_PENDING_OWNER_APPROVAL',
    summary: 'AURA intentionally exposes no installation or connection operation for Hermes.',
    required_before_any_connection: [
      'Fresh verified safe archive and restore drill evidence.',
      'A local Git checkpoint and a separately confirmed remote backup if desired.',
      'Approved rootless isolation topology and secret boundary.',
      'Explicit capability selection from the disabled contract; no broad filesystem or host access.',
      'Tested revoke/incident plan and a human approval record.',
    ],
    blocked_actions: NEVER_GRANTED,
  };
}
module.exports = { status: manifest, preflight, manifest, CAPABILITIES, NEVER_GRANTED, REQUIRED_CONTROLS };
