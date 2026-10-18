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


// ---------------------------------------------------------------------------
// Skill-Schicht (Nachtrag 2026-10-16)
//
// Bis hier war die Hermes-Seite nur ein Vertrag (Manifest + Preflight). Jetzt kommt die Ebene, die
// gefehlt hat: FÄHIGKEITEN, die einzeln vergeben, einzeln entzogen und einzeln geprüft werden.
//
// Regeln dieser Schicht:
//  1. Jede Fähigkeit startet AUS. Es gibt keinen Schalter „alles an".
//  2. Vergeben und Entziehen macht ein MENSCH. `grant()` verlangt human:true und einen Namen.
//  3. `use()` ist die Tür: ohne gültige Verleihung gibt es ein „nein" — mit Begründung.
//  4. Fähigkeiten aus NEVER_GRANTED sind nicht vergebbar. Sie stehen als `never_usable` im Katalog.
//  5. Verleihungen laufen ab (Tage), damit eine alte Erlaubnis nicht ewig gilt.
const fs = require('fs');
const path = require('path');

const SKILL_FILE = process.env.AURA_HERMES_SKILLS_FILE || path.join(__dirname, '..', 'data', 'hermes_skills.json');

// Skills: konkrete, kleine Fähigkeiten mit klarer Grenze — nicht "Zugriff auf alles".
const SKILLS = Object.freeze([
  { id: 'read_public_docs', name: 'Öffentliche Dokumente lesen', risk: 'LOW', direction: 'hermes_to_aura',
    allows: 'Handbücher, Architektur-Dokumente und Katalog-Einträge lesen', denies: 'Laufzeitdaten, Schlüssel, Benutzerdaten, Hostdetails', default_days: 30 },
  { id: 'propose_draft', name: 'Entwurf vorschlagen', risk: 'MEDIUM', direction: 'hermes_to_aura',
    allows: 'Einen Entwurf (Workflow, Text, Plan) als Vorschlag ablegen', denies: 'Freigeben, ausführen, veröffentlichen', default_days: 14 },
  { id: 'read_status', name: 'Betriebszustand lesen', risk: 'LOW', direction: 'hermes_to_aura',
    allows: 'Zustand von Diensten und Modulen abfragen (ohne geheime Werte)', denies: 'Dienste starten/stoppen', default_days: 30 },
  { id: 'request_review', name: 'Prüfung anfordern', risk: 'MEDIUM', direction: 'hermes_to_aura',
    allows: 'Einen Fall zur menschlichen Prüfung vorlegen', denies: 'Selbst entscheiden', default_days: 14 },
  { id: 'suggest_skill', name: 'Neue Fähigkeit vorschlagen', risk: 'MEDIUM', direction: 'hermes_to_aura',
    allows: 'Eine zusätzliche Fähigkeit vorschlagen, die ein Mensch genehmigen muss', denies: 'Sie sich selbst geben', default_days: 7 },
]);

function skillDefaults() { return { grants: [], audit: [] }; }
function loadSkills() {
  try {
    if (!fs.existsSync(SKILL_FILE)) { const f = skillDefaults(); saveSkills(f); return f; }
    const raw = JSON.parse(fs.readFileSync(SKILL_FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['grants', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = skillDefaults(); saveSkills(f); return f; }
}
function saveSkills(d) { try { fs.mkdirSync(path.dirname(SKILL_FILE), { recursive: true }); fs.writeFileSync(SKILL_FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeitdatei */ } return d; }

function skillCatalog() {
  const data = loadSkills();
  const now = Date.now();
  const rows = SKILLS.map((s) => {
    const g = data.grants.find((x) => x.skill === s.id && x.state === 'GEWAEHRT');
    const expired = g && g.expires_at && new Date(g.expires_at).getTime() < now;
    const active = !!g && !expired;
    return { ...s, granted: active, granted_to: active ? g.to : null, granted_by: active ? g.by : null, expires_at: active ? g.expires_at : null, expired: !!expired, human_required: true };
  });
  const neverIds = NEVER_GRANTED.map((n) => n.slice(0, 40));
  return { ok: true, skills: rows, granted: rows.filter((r) => r.granted).length, total: rows.length, never_usable: neverIds };
}

function grant(input) {
  const data = loadSkills();
  const p = input || {};
  const skill = SKILLS.find((s) => s.id === p.skill);
  if (!skill) return { ok: false, error: `Fähigkeit unbekannt. Bekannt: ${SKILLS.map((s) => s.id).join(', ')}` };
  if (!p.human) return { ok: false, error: 'Vergeben nur durch einen Menschen (human: true fehlt)', needs: 'human' };
  const by = String(p.by || '').trim();
  if (!by) return { ok: false, error: 'Namen angeben: wer verleiht?', needs: 'name' };
  const to = String(p.to || 'hermes');
  const days = Math.min(365, Math.max(1, Number(p.days) || skill.default_days));
  const existing = data.grants.find((g) => g.skill === skill.id && g.state === 'GEWAEHRT');
  if (existing) existing.state = 'ERSETZT';
  const g = {
    id: 'hs-' + crypto.randomBytes(4).toString('hex'), skill: skill.id, to, by,
    risk: skill.risk, state: 'GEWAEHRT', days,
    granted_at: new Date().toISOString(), expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    allows: skill.allows, denies: skill.denies,
  };
  data.grants.unshift(g); data.grants = data.grants.slice(0, 300);
  data.audit.unshift({ at: g.granted_at, action: 'grant', id: g.id, skill: skill.id, by, days });
  data.audit = data.audit.slice(0, 300);
  saveSkills(data);
  return { ok: true, grant: g, note: 'Verleihung läuft automatisch ab. Entzug ist jederzeit möglich.' };
}

function revoke(input) {
  const data = loadSkills();
  const p = input || {};
  if (!p.human) return { ok: false, error: 'Entziehen nur durch einen Menschen (human: true fehlt)', needs: 'human' };
  let g = null;
  if (p.id) g = data.grants.find((x) => x.id === p.id);
  else if (p.skill) g = data.grants.find((x) => x.skill === p.skill && x.state === 'GEWAEHRT');
  else {
    // Ohne Angabe wird NICHT geraten: erst sagen, welche Verleihung gemeint ist.
    const active = data.grants.filter((x) => x.state === 'GEWAEHRT');
    return { ok: false, error: `bitte id oder skill angeben — laufende Verleihungen: ${active.length}`, active: active.map((x) => ({ id: x.id, skill: x.skill })) };
  }
  if (!g) return { ok: false, error: 'keine gültige Verleihung gefunden' };
  g.state = 'ENTZOGEN';
  g.revoked = { at: new Date().toISOString(), by: String(p.by || 'Mensch'), reason: String(p.reason || '').slice(0, 300) };
  data.audit.unshift({ at: g.revoked.at, action: 'revoke', id: g.id, skill: g.skill, by: g.revoked.by });
  saveSkills(data);
  return { ok: true, grant: { id: g.id, skill: g.skill, state: g.state }, note: 'Sofort entzogen.' };
}

// Die Tür: darf Hermes diese Fähigkeit jetzt benutzen?
function use(input) {
  const p = input || {};
  const skill = SKILLS.find((s) => s.id === p.skill);
  if (!skill) return { ok: false, allowed: false, error: 'Fähigkeit unbekannt' };
  if (NEVER_GRANTED.some((n) => String(p.skill).toLowerCase().includes(n.split(' ')[0]))) return { ok: false, allowed: false, error: 'Fähigkeit steht auf der Nie-Liste' };
  const data = loadSkills();
  const g = data.grants.find((x) => x.skill === skill.id && x.state === 'GEWAEHRT');
  if (!g) return { ok: false, allowed: false, error: `"${skill.id}" ist nicht vergeben. Weder AURA noch Hermes kann sich das selbst geben.`, needs: 'human' };
  if (g.expires_at && new Date(g.expires_at).getTime() < Date.now()) {
    g.state = 'ABGELAUFEN'; saveSkills(data);
    return { ok: false, allowed: false, error: `Verleihung am ${g.expires_at} abgelaufen`, needs: 'human' };
  }
  return {
    ok: true, allowed: true, skill: skill.id, granted_by: g.by, expires_at: g.expires_at,
    boundary: { allows: skill.allows, denies: skill.denies },
    note: 'Grenze gilt weiter: Erlaubt ist genau das, was unter „allows" steht.',
  };
}

function skillStatus() {
  const data = loadSkills();
  const cat = skillCatalog();
  return {
    area: 'HRM', module: 'hermes_bridge.skills', state: 'live', file: SKILL_FILE,
    skills: cat.total, granted: cat.granted,
    by_risk: SKILLS.reduce((a, s) => { a[s.risk] = (a[s.risk] || 0) + 1; return a; }, {}),
    never_usable: NEVER_GRANTED.length,
    mode: cat.granted ? 'FÄHIGKEITEN VERGEBEN (einzeln, befristet)' : 'ALLES AUS (Standard)',
    rules: ['Jede Fähigkeit startet aus.', 'Vergeben und entziehen nur Menschen.', 'Verleihungen laufen ab.', 'Die Nie-Liste bleibt gesperrt.'],
    audit: data.audit.slice(0, 5),
  };
}

module.exports.SKILLS = SKILLS;
module.exports.SKILL_FILE = SKILL_FILE;
module.exports.skills = skillCatalog;
module.exports.grantSkill = grant;
module.exports.revokeSkill = revoke;
module.exports.useSkill = use;
module.exports.skillStatus = skillStatus;
module.exports.actions = {
  status: () => manifest(),
  preflight: () => preflight(),
  skills: () => skillCatalog(),
  skillStatus: () => skillStatus(),
  grant: (p) => grant(p || {}),
  revoke: (p) => revoke(p || {}),
  use: (p) => use(p || {}),
};
module.exports.meta = { area: 'HRM', id: 'hermes_bridge', name: 'Hermes-Brücke (Vertrag + Fähigkeitsschicht mit Ablauf)', state: 'live' };
