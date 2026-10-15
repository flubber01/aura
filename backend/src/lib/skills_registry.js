'use strict';
// AURA Skills Registry + Skill DB + Department/Prompt library.
// DB lives in backend/data/skills.json; departments in backend/data/departments.json.
// Adapters are config-driven and sandbox-safe: no outbound calls, no secrets in code.
const fs = require('fs');
const path = require('path');

// HOT-RELOAD DBs (mtime cache): departments/skills/teams können zur Laufzeit
// per API hinzugefügt/gelöscht werden — validiert + atomar geschrieben,
// ohne Neustart und ohne Syntax-Crash-Risiko (alter Stand bleibt bei Fehlern).
const SKILLS_FILE = path.join(__dirname, '..', '..', 'data', 'skills.json');
const DEPTS_FILE = path.join(__dirname, '..', '..', 'data', 'departments.json');
function cached(file, fallback) {
  const c = { mtime: 0, data: null };
  return () => {
    try {
      const st = fs.statSync(file);
      if (c.data && st.mtimeMs === c.mtime) return c.data;
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      c.mtime = st.mtimeMs; c.data = j;
      return j;
    } catch { return c.data || fallback; }
  };
}
const skillsDb = cached(SKILLS_FILE, { schema_version: 0, skills: [] });
const deptsDb = cached(DEPTS_FILE, { departments: [] });
const SKILLS_DB = skillsDb(); // boot snapshot for db_meta compatibility
function SKILLS() { return skillsDb().skills || []; }
function DEPTS() { return deptsDb().departments || []; }

// atomic write: tmp file → JSON re-parse check → rename; rollback by design
function atomicWrite(file, obj) {
  const tmp = file + '.tmp';
  const txt = JSON.stringify(obj, null, 2);
  JSON.parse(txt); // self-check before touching the real file
  fs.writeFileSync(tmp, txt);
  fs.renameSync(tmp, file);
}
const VALID_ID = /^[a-z0-9_-]{2,40}$/;

function addDepartment(input = {}) {
  const errs = [];
  const id = String(input.id || '').trim().toLowerCase();
  const name = String(input.name || '').trim();
  if (!VALID_ID.test(id)) errs.push('id muss 2-40 Zeichen [a-z0-9_-] sein');
  if (name.length < 3) errs.push('name required (min 3)');
  if (!String(input.prompt || '').includes('{role}')) errs.push('prompt muss {role}-Platzhalter enthalten');
  if (!Array.isArray(input.roles) || input.roles.length === 0) errs.push('mindestens eine Rolle nötig');
  for (const r of input.roles || []) {
    if (!VALID_ID.test(String(r.id || ''))) errs.push('role id ungültig: ' + r.id);
    if (!String(r.title || '').trim()) errs.push('role title fehlt für ' + r.id);
  }
  if (errs.length) { const e = new Error(errs.join('; ')); e.code = 400; throw e; }
  const db = deptsDb();
  if (db.departments.some((d) => d.id === id)) { const e = new Error('department "' + id + '" existiert bereits'); e.code = 409; throw e; }
  db.departments.push({
    id, name: name.slice(0, 80), areas: Array.isArray(input.areas) ? input.areas.map(String).slice(0, 20) : [],
    prompt: String(input.prompt).slice(0, 2000),
    roles: input.roles.slice(0, 30).map((r) => ({ id: String(r.id).toLowerCase(), title: String(r.title).slice(0, 80), usecase: String(r.usecase || '').slice(0, 200) })),
  });
  atomicWrite(DEPTS_FILE, db);
  return { ok: true, department: id, roles: db.departments.find((d) => d.id === id).roles.length, hot: true };
}
function removeDepartment(id) {
  const db = deptsDb();
  const before = db.departments.length;
  db.departments = db.departments.filter((d) => d.id !== String(id));
  if (db.departments.length === before) { const e = new Error('unknown department "' + id + '"'); e.code = 404; throw e; }
  atomicWrite(DEPTS_FILE, db);
  return { ok: true, removed: String(id), hot: true };
}
function addSkill(input = {}) {
  const errs = [];
  const id = String(input.id || '').trim().toLowerCase();
  const name = String(input.name || '').trim();
  if (!VALID_ID.test(id)) errs.push('id muss 2-40 Zeichen [a-z0-9_-] sein');
  if (name.length < 3) errs.push('name required (min 3)');
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(input.repo || ''))) errs.push('repo muss Format owner/repo haben');
  if (!Array.isArray(input.crosslinks) || input.crosslinks.length === 0) errs.push('crosslinks (Area-IDs) nötig — Skills sind Querverbindungen');
  if (errs.length) { const e = new Error(errs.join('; ')); e.code = 400; throw e; }
  const db = skillsDb();
  if (db.skills.some((s) => s.id === id)) { const e = new Error('skill "' + id + '" existiert bereits'); e.code = 409; throw e; }
  db.skills.push({
    id, name: name.slice(0, 80), repo: String(input.repo).slice(0, 120),
    desc: String(input.desc || '').slice(0, 300), stars: Math.max(0, Number(input.stars) || 0),
    area: String(input.area || '').slice(0, 8), workflow_hook: String(input.workflow_hook || '').slice(0, 120),
    crosslinks: input.crosslinks.map(String).slice(0, 20),
  });
  atomicWrite(SKILLS_FILE, db);
  return { ok: true, skill: id, hot: true };
}
function removeSkill(id) {
  const db = skillsDb();
  const before = db.skills.length;
  db.skills = db.skills.filter((s) => s.id !== String(id));
  if (db.skills.length === before) { const e = new Error('unknown skill "' + id + '"'); e.code = 404; throw e; }
  atomicWrite(SKILLS_FILE, db);
  return { ok: true, removed: String(id), hot: true };
}

// Combined workflows: skills x existing areas, maximizing each use case.
const WORKFLOWS = [
  {
    id: 'WF-1', name: 'Kids story -> narrated video -> publish queue',
    chain: ['08 story script (cognitive core 03 drafts)', '46 VoiceBox narration', '41 HyperFrames render', '07 metadata scrub', '13 omnichannel queue (human approval gate)'],
    gates: ['child-safety review', 'originality check', 'publish approval'],
  },
  {
    id: 'WF-2', name: 'Sanctioned research loop ("agent eyes")',
    chain: ['43 Agent-Reach read-only fetch', '21 news analyzer (freshness window)', '19 catalog ingestor (normalize+dedupe)', '03 cognitive core task', '45 Hindsight stores findings'],
    gates: ['source ToS check', 'no-execution rule for cataloged scripts'],
  },
  {
    id: 'WF-3', name: 'Consensus build with learning feedback',
    chain: ['03 task intake', '04 tri-vector consensus A/B/C', '05 integrity compare', '39 A/B variant assignment', '45 Hindsight memory write-back'],
    gates: ['all totals < 60 -> escalate to human'],
  },
  {
    id: 'WF-4', name: 'Sandboxed tool execution',
    chain: ['44 OpenShell sandbox boot', '20 MCP tool register+invoke', '16 self-healing logger', '23 checkpoint export', '24 snapshot before/after'],
    gates: ['explicit grants', 'schema-bound args', 'checksum-verified restore'],
  },
  {
    id: 'WF-5', name: 'Hybrid model ops (local + cloud)',
    chain: ['47 Unsloth local lane', '06 OpenRouter cloud lane', '06 pinger health+failover', '27 compute router scheduling', '17 daily report'],
    gates: ['own hardware only', 'API keys in secret store'],
  },
  {
    id: 'WF-6', name: 'Professional UI build',
    chain: ['48 ui-ux-pro-max design pass', '42 impeccable quality gate', 'build + /console verification', '16 logger observes rollout'],
    gates: ['accessibility check', 'asset licensing'],
  },
  {
    id: 'WF-7', name: 'Social connection chain (specialists, human gates)',
    chain: ['source pipeline (WF-1/2/6) package', 'specialist drafts per platform', 'compliance review & sign-off', 'official-API adapter publishes', 'ledger entry + audit'],
    gates: ['human approval on every publish', 'rate limits + ToS', 'no synthetic engagement'],
  },
  {
    id: 'WF-8', name: 'Protected Infrastructure Handoff', version: '2.0.0',
    purpose: 'Turn an owner-authorized infrastructure request into a reviewed connection manifest without touching a server.',
    chain: ['/cluster local inventory record', 'Main Core protection check', 'Project Arm boundary and declared capacity review', 'network/RBAC/backup checklist', 'owner-approved connection handoff'],
    gates: ['own/authorized hardware only', 'no SSH, tokens, scans or provisioning in AURA', 'Main Core cannot be restarted, migrated or replaced automatically', 'human approval before any separate deployment tooling is considered'],
    risk_class: 'HIGH', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'authorized_assets'],
    expected_outputs: ['reviewed connection manifest', 'operator handoff checklist'],
    safety_boundary: 'AURA only records inventory and a handoff. It never creates a cluster, opens a connection, changes a firewall or deploys workloads.',
  },
  {
    id: 'WF-9', name: 'Image generation pipeline (ComfyUI / WebUI)',
    chain: ['02 role registry prompt draft (creative dept)', '48 ui-ux-pro-max prompt refinement', '71 ImageGen Gateway: auto-probe ComfyUI→WebUI', '71 generate via /prompt or /sdapi/v1', '16 logger + 64 vault snapshot of artifact'],
    gates: ['honest mode label LIVE vs SIMULATION on every artifact', 'no generation while kill switch engaged', 'artifacts stay local unless human publishes (WF-7 gates)'],
  },
  {
    id: 'WF-10', name: 'Content automation via minions (Forge)',
    chain: ['74 fabric mode check (safe/quiet)', '73 routine fires brief', 'minion chain: research→writer→editor→qa', '73 item saved as AUTO-DRAFT', 'human approve → official-channel publish or vault archive'],
    gates: ['NO auto-post without human approval (403 enforced)', 'official APIs only, no synthetic engagement', 'Area 08 safety filter for stories', 'ledger audit for every publish attempt'],
  },
  {
    id: 'WF-11', name: 'Studio production pipeline (all formats)',
    chain: ['76 studio generate (book/article/social/newsletter/script/podcast/pitch)', '73 forge library intake + labels', '71 image_brief → Cover/Visuals (ComfyUI/WebUI or SIM)', '63 SEO on-page audit for articles', 'WF-7 human publish gate'],
    gates: ['honest LOCAL-TEMPLATE-ENGINE labels', 'kinder-Genre durch Area-08-Filter', 'publish nur mit Freigabe'],
  },
  {
    id: 'WF-12', name: 'Telegram ops loop (allowlisted)',
    chain: ['78 agent probe getMe', '75 routine toggle gate', 'commands /status /report /forge /control /snapshot', '/kill + /revive CONFIRM map to ops', 'ledger audit of every command'],
    gates: ['TELEGRAM_ALLOWED_CHATS Pflicht', 'offizielle Bot-API nur', 'kill/revive brauchen CONFIRM'],
  },
  {
    id: 'WF-13', name: 'Test-lab regression loop',
    chain: ['77 suite über alle Live-Module', 'expect-fail Drill (crash-dummy boom)', 'force-run nach Fix', '66 ledger + 69 Lernkurve übernehmen Fingerprint', 'docs/HOWTO_BUILD.md bleibt aktuell'],
    gates: ['jeder eindeutige Fehler max. 1× ungelöst (Area 69)', 'Suite muss 0 mismatches melden bevor gepusht wird'],
  },
  {
    id: 'WF-14', name: 'Video Production Control Loop', version: '1.0.0',
    purpose: 'Governed editorial flow from a video brief to a reviewed local production handoff.',
    chain: ['brief + audience intake', 'research and script draft', 'brand/originality/rights checklist', 'local render handoff package', 'human decision for distribution'],
    gates: ['rights source recorded', 'brand and originality review', 'render state must be evidenced by a connected local tool', 'no publish without human approval'],
    risk_class: 'HIGH', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'audience', 'rights_source'],
    expected_outputs: ['script package', 'rights checklist', 'local render handoff', 'human publish decision'],
    safety_boundary: 'This workflow creates planning and handoff records only. It does not render, upload, publish or claim media output.',
  },
  {
    id: 'WF-15', name: 'Self-hosted Service Intake', version: '1.0.0',
    purpose: 'Evaluate an owner-requested self-hosted service before any deployment is considered.',
    chain: ['service request intake', 'architecture and data-classification review', 'network/RBAC/backup requirements', 'configuration template and rollback plan', 'owner-approved manual handoff'],
    gates: ['no credentials in AURA', 'no remote provisioning or host command', 'backup and rollback plan required', 'owner authorization required'],
    risk_class: 'HIGH', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'service_name', 'data_classification'],
    expected_outputs: ['service intake record', 'configuration template', 'risk and rollback checklist'],
    safety_boundary: 'AURA does not deploy, install, probe, configure or connect to the requested service.',
  },
  {
    id: 'WF-16', name: 'Local Model and RAG Evaluation', version: '1.0.0',
    purpose: 'Compare locally installed models and a proposed RAG dataset under a privacy-first evaluation plan.',
    chain: ['use-case and data boundary', 'installed local-model inventory', 'evaluation rubric and representative test set', 'quality/safety/privacy report', 'owner model selection'],
    gates: ['local models only unless separately approved', 'no automatic model download', 'private data remains local', 'human chooses any production model'],
    risk_class: 'DATA_PRIVATE', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'use_case', 'data_classification'],
    expected_outputs: ['evaluation rubric', 'local-model comparison report', 'RAG proposal'],
    safety_boundary: 'AURA does not pull models, ingest documents, send prompts to a provider or activate a RAG index.',
  },
  {
    id: 'WF-17', name: 'API and Connector Onboarding', version: '1.0.0',
    purpose: 'Turn a prospective provider integration into a reviewed, least-privilege connection plan.',
    chain: ['provider/use-case intake', 'ToS and data-flow review', 'permission matrix + least privilege design', 'secret-manager handoff specification', 'test and revoke plan'],
    gates: ['no API key stored in AURA', 'no provider call during planning', 'data-processing and revocation plan required', 'owner approval required before connection'],
    risk_class: 'HIGH', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'provider', 'data_classification'],
    expected_outputs: ['permission matrix', 'secret-manager handoff', 'test/revoke checklist'],
    safety_boundary: 'AURA records an onboarding plan only; it does not create accounts, store secrets or call provider APIs.',
  },
  {
    id: 'WF-18', name: 'Backup and Restore Drill', version: '1.0.0',
    purpose: 'Verify that a safe archive can be checked and restored as source without claiming production recovery.',
    chain: ['select source archive', 'verify checksum and archive integrity', 'review restore boundary', 'dependency reinstall checklist', 'record restore drill evidence'],
    gates: ['checksum required', 'restore occurs in an isolated review location', 'no credentials or production state in safe archive', 'human validates outcome'],
    risk_class: 'HIGH', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'archive_sha256', 'restore_target'],
    expected_outputs: ['integrity evidence', 'restore checklist', 'drill report'],
    safety_boundary: 'AURA records and simulates a restore drill. It does not overwrite production files or restore credentials, accounts or runtime state.',
  },
  {
    id: 'WF-19', name: 'Security Incident Triage', version: '1.0.0',
    purpose: 'Capture, classify and hand off a security concern with trace-first evidence and owner decisions.',
    chain: ['report incident', 'classify severity and scope', 'collect non-secret evidence references', 'containment recommendation', 'owner-approved response handoff and review'],
    gates: ['no automatic firewall/host/network action', 'do not put secrets in evidence', 'owner authorization for any response outside AURA', 'post-incident review required'],
    risk_class: 'CRITICAL', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'severity', 'evidence_reference'],
    expected_outputs: ['incident record', 'triage report', 'response handoff', 'review notes'],
    safety_boundary: 'AURA only records an incident and recommendation. It does not scan hosts, block IPs outside its local sentinel record, or perform containment.',
  },
  {
    id: 'WF-20', name: 'Release Candidate Quality Gate', version: '1.0.0',
    purpose: 'Collect code, test, archive and human approval evidence before a release is handed to an operator.',
    chain: ['change summary', 'syntax/lint/test evidence', 'security and dependency review', 'safe archive/checksum evidence', 'human release decision'],
    gates: ['no claim of passed checks without evidence', 'release approval is explicit', 'remote push/deploy remains a separate operator action', 'rollback note required'],
    risk_class: 'HIGH', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'commit_or_version', 'test_evidence'],
    expected_outputs: ['release checklist', 'validation evidence', 'archive checksum', 'human decision'],
    safety_boundary: 'AURA records a release candidate only. It does not push, tag, publish, deploy or alter a remote repository.',
  },
  {
    id: 'WF-21', name: 'Asset Rights and Media Intake', version: '1.0.0',
    purpose: 'Document rights, attribution and permitted use before an asset can enter a Studio workflow.',
    chain: ['asset metadata intake', 'rights/license and attribution review', 'permitted-use classification', 'expiry/review reminder plan', 'approved/restricted asset handoff'],
    gates: ['rights source required', 'unclear rights remain restricted', 'no media binary stored in workflow record', 'human review before distribution'],
    risk_class: 'HIGH', execution_mode: 'HANDOFF_ONLY',
    required_inputs: ['brief', 'owner', 'scope', 'asset_reference', 'rights_source'],
    expected_outputs: ['rights record', 'attribution note', 'permitted-use decision'],
    safety_boundary: 'AURA stores only a small metadata record and reference. It does not ingest media, verify legal ownership or publish assets.',
  },
];

function xrefs() {
  const map = {};
  for (const s of SKILLS()) for (const c of s.crosslinks || []) map[c] = [...(map[c] || []), s.id];
  return map;
}

function departments() { return DEPTS(); }
function roles() {
  return DEPTS().flatMap((d) => d.roles.map((r) => ({
    ...r, department: d.id, department_name: d.name, areas: d.areas,
    prompt: d.prompt.replace(/\{role\}/g, r.title) + (r.usecase ? ' Primary use case: ' + r.usecase + '.' : ''),
  })));
}
function promptFor(deptId, roleId) {
  const d = DEPTS().find((x) => x.id === deptId);
  if (!d) return null;
  const r = d.roles.find((x) => x.id === roleId) || d.roles[0];
  return { department: d.id, role: r.id, title: r.title, prompt: d.prompt.replace(/\{role\}/g, r.title) };
}

module.exports = {
  db_meta: () => ({ schema_version: SKILLS_DB.schema_version, note: SKILLS_DB.note }),
  skills: () => SKILLS(),
  workflows: () => WORKFLOWS,
  xrefs,
  departments, roles, promptFor,
  get: (id) => SKILLS().find((s) => s.id === id || s.area === id) || null,
  totalStars: () => SKILLS().reduce((a, s) => a + (s.stars || 0), 0),
  status() {
    return {
      skills: SKILLS().length,
      workflows: WORKFLOWS.length,
      crosslinked_areas: Object.keys(xrefs()).length,
      departments: DEPTS().length,
      roles: roles().length,
      total_stars: module.exports.totalStars(),
    };
  },
  addDepartment, removeDepartment, addSkill, removeSkill,
  actions: {
    status: () => module.exports.status(),
    dept_add: (p) => addDepartment(p || {}),
    dept_remove: (p) => removeDepartment(String((p || {}).id)),
    skill_add: (p) => addSkill(p || {}),
    skill_remove: (p) => removeSkill(String((p || {}).id)),
  },
};
