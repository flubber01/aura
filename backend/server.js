#!/usr/bin/env node
/**
 * AURA Agent Command Center — Backend API + static hosting + download service
 * Zero dependencies (Node built-ins only).
 *
 * Routes:
 *   GET /api/health            -> liveness + counts
 *   GET /api/integrations      -> integration catalog (from zip)
 *   GET /api/modules           -> 40 functional areas (extracted from UI)
 *   GET /api/types             -> full "all types" catalog (JSON)
 *   GET /api/downloads         -> list of downloadable artifacts
 *   GET /api/download/:name    -> download a generated artifact
 *   GET /downloads             -> styled download page (HTML)
 *   GET /*                     -> static AURA frontend
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'extracted', 'AURA-Web-Deploy', 'public');
const DATA_DIR = path.join(__dirname, 'data');

const modules = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'modules.json'), 'utf8'));
const integrations = JSON.parse(
  fs.readFileSync(path.join(PUBLIC_DIR, 'data', 'integrations.json'), 'utf8')
);
const registry = require('./src/lib/registry');
const store = require('./src/lib/store');
const pages = {
  hub: require('./pages/hub'),
  pipelines: require('./pages/pipelines'),
  yellowpages: require('./pages/yellowpages'),
  deploy: require('./pages/deploy'),
  cluster: require('./pages/cluster'),
};
function safeLoad(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name), 'utf8')); }
  catch (e) { console.error('WARN: data/' + name + ' unreadable at boot (' + e.message + ') — using fallback; watcher will heal it'); return fallback; }
}
const yellowpages = safeLoad('yellowpages.json', { links: [] });
const teams = safeLoad('teams.json', { teams: [] });
const hierarchy = require('./src/lib/hierarchy');
const ops = require('./src/lib/ops');
const mail = require('./src/lib/mail_adapter');
const pageOps = require('./pages/ops');
const brain3dSnippet = require('./pages/brain3d');
const pageHierarchy = require('./pages/hierarchy');
const pageTerminal = require('./pages/terminal');
const pageMinibot = require('./pages/minibot');
const pageIgnition = require('./pages/ignition');
const pageArcade = require('./pages/arcade');
const pageSchedule = require('./pages/schedule');
const watcher = require('./src/lib/txt_watcher');
const ultraChat = require('./src/lib/ultra_chat');
const wfBuilder = require('./src/lib/workflow_builder');
const deepResearch = require('./src/lib/research');
const seo = require('./src/lib/seo');
const traffic = require('./src/lib/traffic');
const pageBuilder = require('./pages/builder');
const pageResearch = require('./pages/research');
const pageSeo = require('./pages/seo');
const selfRepair = require('./src/lib/self_repair');
const pageLogs = require('./pages/logs');
const config = require('./src/lib/config');
const containers = require('./src/lib/module_container');
const pageConfig = require('./pages/configpage');
const pageContainers = require('./pages/containers');
const jarvis = require('./src/lib/jarvis');
const pageJarvis = require('./pages/jarvis');
const learningCore = require('./src/lib/learning_core');
const repurposeEngine = require('./src/lib/repurpose_engine'); // Phase 2 · WF-18
const crosslinkMesh = require('./src/lib/crosslink_mesh');     // Phase 2 · Traffic Mesh
const labelPipeline = require('./src/lib/label_pipeline');     // Phase 2 · WF-19
const analyticsHub = require('./src/lib/analytics_hub');       // Phase 2 · Unified Analytics
const pageGrowth = require('./pages/growth');
const agentBoard = require('./src/lib/agent_board');        // Agent Board (Kanban für Agenten)
const pageBoard = require('./pages/board');
const dataUpload = require('./src/lib/data_upload');          // geprüfter Upload für Link-Listen
const pageUpload = require('./pages/upload');
const skillCatalog = require('./src/lib/skill_catalog');   // Skill-Katalog (nur Lesen)
const control = require('./src/lib/control_center');        // Steuerzentrale: Schalter + Freigaben
const pageSkills = require('./pages/skills');
const pageControl = require('./pages/control');
const { execFile } = require('child_process');

// emergency kill switch auto-engage on critical errors / syntax failures
process.on('uncaughtException', (e) => { try { selfRepair.log('ERROR', 'LIFE', 'uncaught_exception', { error: e.message, stack: (e.stack || '').split('\n')[1] }); } catch {} try { ops.kill('critical error: ' + e.message); } catch {} });
process.on('unhandledRejection', (e) => { try { selfRepair.log('ERROR', 'LIFE', 'unhandled_rejection', { error: String(e && e.message || e) }); } catch {} try { ops.kill('unhandled rejection: ' + (e && e.message || e)); } catch {} });
let syntaxFails = [];
function syntaxFail() {
  const thr = config.get('kill.syntax_fail_threshold', 3);
  const win = config.get('kill.window_min', 5) * 60000;
  syntaxFails.push(Date.now());
  syntaxFails = syntaxFails.filter((t) => Date.now() - t < win);
  if (syntaxFails.length >= thr) ops.kill(`repeated syntax failures (${syntaxFails.length} in ${config.get('kill.window_min', 5)} min)`);
}

// ---------- type catalogs ----------

const STATE_TYPES = {
  ui: { label: 'UI / demo', meaning: 'Visible in the HTML frontend; data/scores are samples.' },
  backend: { label: 'Backend pending', meaning: 'Requires an authenticated server-side API, storage and verification before real use.' },
  review: { label: 'Needs redesign', meaning: 'Functionally planned but requires safe redesign, scoping or policy review first.' },
  restricted: { label: 'Restricted / excluded', meaning: 'Marked as excluded from implementation (safety/policy reasons).' },
};

const INTEGRATION_STATUS_TYPES = {
  setup_required: 'Account/CLI setup needed before first use',
  not_connected: 'No connection configured in this workspace',
  backend_required: 'Needs a backend service that this static package does not provide',
  optional: 'Optional deployment variant',
  manual_workflow: 'Handled manually; no automated connector',
  simulation_only: 'Demo/simulated values only until a real source is attached',
};

function buildTypesCatalog() {
  const integrationCategories = [...new Set(integrations.integrations.map((i) => i.category))].map(
    (cat) => ({
      category: cat,
      integrations: integrations.integrations.filter((i) => i.category === cat),
    })
  );
  return {
    schema_version: 1,
    project: 'AURA Agent Command Center',
    generated_at: new Date().toISOString(),
    source: 'flubber01/aura @ arena/0ee9c54c-aura',
    module_state_types: STATE_TYPES,
    integration_status_types: INTEGRATION_STATUS_TYPES,
    integration_categories: integrationCategories,
    integration_count: integrations.integrations.length,
    modules,
    module_count: modules.length,
    skills: registry.skills.skills(),
    skill_count: registry.skills.skills().length,
    workflows: registry.skills.workflows(),
    cross_references: registry.skills.xrefs(),
    hierarchy: {
      structure: 'T0 ultra -> T1 super (core+side failover) -> T2 department heads -> T3 minion workers',
      nodes: hierarchy.tree().length,
      identity_rule: 'honest AI identities; no human impersonation; no synthetic biometrics',
    },
    teams: teams.teams,
    ops: { schedule: ops.SCHED, kill_switch: 'auto on critical error / syntax failures; manual via /ops + telegram', backups: '12h super-brain db · 4h others · 24h full checksummed sync' },
    yellowpages_categories: [...new Set(yellowpages.links.map((l) => l.category))],
    summary: {
      modules_by_state: modules.reduce((acc, m) => ((acc[m.state] = (acc[m.state] || 0) + 1), acc), {}),
      integrations_by_status: integrations.integrations.reduce(
        (acc, i) => ((acc[i.status] = (acc[i.status] || 0) + 1), acc),
        {}
      ),
    },
  };
}

// ---------- artifact renderers ----------

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTxt(cat) {
  const L = [];
  const bar = '='.repeat(78);
  L.push(bar);
  L.push('AURA AGENT COMMAND CENTER — ALL TYPES (complete catalog)');
  L.push(`Generated: ${cat.generated_at}   Modules: ${cat.module_count}   Integrations: ${cat.integration_count}`);
  L.push(bar, '');

  L.push('1) MODULE STATE TYPES');
  L.push('-'.repeat(78));
  for (const [key, t] of Object.entries(cat.module_state_types)) {
    L.push(`  ${key.padEnd(11)} ${t.label}`);
    L.push(`              ${t.meaning}`);
  }
  L.push('');

  L.push('2) INTEGRATION STATUS TYPES');
  L.push('-'.repeat(78));
  for (const [key, meaning] of Object.entries(cat.integration_status_types)) {
    L.push(`  ${key.padEnd(19)} ${meaning}`);
  }
  L.push('');

  L.push('3) INTEGRATION CATEGORIES / TYPES');
  L.push('-'.repeat(78));
  for (const grp of cat.integration_categories) {
    L.push(`  [${grp.category}]`);
    for (const i of grp.integrations) {
      L.push(`    - ${i.name}  (status: ${i.status})`);
      L.push(`        purpose: ${i.purpose}`);
      if (i.docs) L.push(`        docs:    ${i.docs}`);
    }
    L.push('');
  }

  L.push('4) ALL 40 FUNCTIONAL AREAS (MODULES)');
  L.push('-'.repeat(78));
  for (const m of cat.modules) {
    L.push(`${m.module}   [${STATE_TYPES[m.state].label.toUpperCase()}]`);
    L.push(`    files:   ${m.files}`);
    L.push(`    purpose: ${m.purpose}`);
    if (m.notes) L.push(`    notes:   ${m.notes}`);
    L.push('');
  }

  L.push('5) SKILLS (external repos wired into AURA workflows)');
  L.push('-'.repeat(78));
  for (const s of cat.skills) {
    L.push(`${s.area} · ${s.name}`);
    L.push(`    repo:      ${s.repo}`);
    L.push(`    tagline:   ${s.tagline}`);
    L.push(`    use case:  ${s.use_case}`);
    L.push(`    hooks:     ${s.workflow_hook}`);
    L.push(`    crosslinks:${s.crosslinks.map((c) => ' ' + c + ';').join('')}`);
    L.push(`    safety:    ${s.safety}`, '');
  }

  L.push('6) COMBINED WORKFLOWS (skills x existing areas)');
  L.push('-'.repeat(78));
  for (const w of cat.workflows) {
    L.push(`${w.id} · ${w.name}`);
    L.push(`    chain: ${w.chain.join('  ->  ')}`);
    L.push(`    gates: ${w.gates.join('; ')}`, '');
  }

  L.push('7) BRAIN HIERARCHY & TEAMS');
  L.push('-'.repeat(78));
  L.push('  ' + cat.hierarchy.structure);
  L.push('  nodes: ' + cat.hierarchy.nodes + ' · rule: ' + cat.hierarchy.identity_rule);
  for (const t of cat.teams) {
    L.push(`  [${t.name}] ${t.mission}`);
    L.push(`      roles: ${t.roles.join(', ')} · skills: ${t.skills.join(', ') || '-'} · ${t.workflows.join('/')}`);
  }
  L.push('');

  L.push('8) OPS · BACKUPS · KILL SWITCH');
  L.push('-'.repeat(78));
  L.push('  ' + cat.ops.backups);
  L.push('  kill switch: ' + cat.ops.kill_switch);
  L.push('  yellow pages categories: ' + cat.yellowpages_categories.join(', '));
  L.push('');

  L.push('9) SUMMARY');
  L.push('-'.repeat(78));
  for (const [k, v] of Object.entries(cat.summary.modules_by_state)) L.push(`  modules ${k}: ${v}`);
  for (const [k, v] of Object.entries(cat.summary.integrations_by_status)) L.push(`  integrations ${k}: ${v}`);
  L.push('', bar, 'End of catalog. Download also available as .json / .md / .csv', bar);
  return L.join('\n');
}

function renderMd(cat) {
  const L = [];
  L.push('# AURA Agent Command Center — All Types', '');
  L.push(`> Generated ${cat.generated_at} · ${cat.module_count} modules · ${cat.integration_count} integrations`, '');
  L.push('## Module state types', '', '| Key | Label | Meaning |', '|---|---|---|');
  for (const [k, t] of Object.entries(cat.module_state_types)) L.push(`| \`${k}\` | ${t.label} | ${t.meaning} |`);
  L.push('', '## Integration status types', '', '| Status | Meaning |', '|---|---|');
  for (const [k, m] of Object.entries(cat.integration_status_types)) L.push(`| \`${k}\` | ${m} |`);
  L.push('', '## Integrations by category', '', '| Category | Name | Status | Purpose |', '|---|---|---|---|');
  for (const grp of cat.integration_categories)
    for (const i of grp.integrations) L.push(`| ${grp.category} | ${i.name} | ${i.status} | ${i.purpose} |`);
  L.push('', '## All functional areas', '', '| Module | State | Files | Purpose |', '|---|---|---|---|');
  for (const m of cat.modules)
    L.push(`| ${m.module} | ${STATE_TYPES[m.state].label} | ${m.files.replace(/\|/g, '/')} | ${m.purpose} |`);
  L.push('', '## Skills (wired-in external repos)', '', '| Area | Skill | Repo | Hooks into |', '|---|---|---|---|');
  for (const s of cat.skills) L.push(`| ${s.area} | ${s.name} | ${s.repo} | ${s.workflow_hook} |`);
  L.push('', '## Combined workflows', '', '| ID | Name | Chain |', '|---|---|---|');
  for (const w of cat.workflows) L.push(`| ${w.id} | ${w.name} | ${w.chain.join(' → ')} |`);
  L.push('');
  return L.join('\n');
}

function renderCsv(cat) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['kind', 'type_or_name', 'state_or_status', 'category', 'detail']];
  for (const [k, t] of Object.entries(cat.module_state_types))
    rows.push(['module_state_type', k, '', '', `${t.label} — ${t.meaning}`]);
  for (const [k, m] of Object.entries(cat.integration_status_types))
    rows.push(['integration_status_type', k, '', '', m]);
  for (const i of integrations.integrations)
    rows.push(['integration', i.name, i.status, i.category, i.purpose]);
  for (const m of cat.modules)
    rows.push(['module', m.module, m.state, STATE_TYPES[m.state].label, `${m.files} — ${m.purpose}`]);
  return rows.map((r) => r.map(q).join(',')).join('\r\n');
}

const ARTIFACTS = {
  'AURA-ALL-TYPES.txt': { mime: 'text/plain; charset=utf-8', render: renderTxt },
  'AURA-ALL-TYPES.json': { mime: 'application/json; charset=utf-8', render: (c) => JSON.stringify(c, null, 2) },
  'AURA-ALL-TYPES.md': { mime: 'text/markdown; charset=utf-8', render: renderMd },
  'AURA-ALL-TYPES.csv': { mime: 'text/csv; charset=utf-8', render: renderCsv },
  'AURA-DEPLOYMENT.md': { mime: 'text/markdown; charset=utf-8', render: () => fs.readFileSync(path.join(ROOT, 'docs', 'DEPLOYMENT.md'), 'utf8') },
  'AURA-DEPLOY-KIT.sh': { mime: 'text/plain; charset=utf-8', render: () => fs.readFileSync(path.join(ROOT, 'deploy', 'master-install.sh'), 'utf8') },
  'AURA-RUNBOOK.md': { mime: 'text/markdown; charset=utf-8', render: () => fs.readFileSync(path.join(ROOT, 'docs', 'RUNBOOK.md'), 'utf8') },
  'AURA-MODULES.md': { mime: 'text/markdown; charset=utf-8', render: () => fs.readFileSync(path.join(ROOT, 'docs', 'MODULES.md'), 'utf8') },
  'AURA-CONFIG.md': { mime: 'text/markdown; charset=utf-8', render: () => fs.readFileSync(path.join(ROOT, 'docs', 'CONFIGURATION.md'), 'utf8') },
  'AURA-REPRO-CHECK.sh': { mime: 'text/plain; charset=utf-8', render: () => fs.readFileSync(path.join(ROOT, 'deploy', 'repro-check.sh'), 'utf8') },
};

// ---------- download page ----------

function downloadPageHtml() {
  const rows = Object.keys(ARTIFACTS)
    .map(
      (n) => `<a class="dl" href="/api/download/${n}" download>
        <span class="name">${n}</span>
        <span class="hint">complete catalog · state types · categories · all 40 modules</span>
        <span class="btn">⇩ Download</span></a>`
    )
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA — Downloads</title>
<style>
 body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#07090f;color:#e8ecf5;min-height:100vh}
 .wrap{max-width:760px;margin:0 auto;padding:48px 20px}
 h1{font-size:26px;margin:0 0 6px;background:linear-gradient(90deg,#f5c96b,#8ab4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
 p.sub{color:#93a0b8;margin:0 0 28px}
 .dl{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;background:#101624;border:1px solid #23304a;border-radius:12px;padding:16px 18px;margin-bottom:12px;transition:.15s}
 .dl:hover{border-color:#f5c96b;transform:translateY(-1px)}
 .name{font-weight:600;min-width:220px}
 .hint{color:#93a0b8;font-size:13px;flex:1}
 .btn{background:#f5c96b;color:#0a0c12;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;white-space:nowrap}
 a.back{color:#8ab4ff;font-size:13px;text-decoration:none}
</style></head><body><div class="wrap">
<h1>AURA — Downloadable catalogs</h1>
<p class="sub">All types we covered: module state types, integration status types, all 12 integrations grouped by category, and all 40 functional areas. Direct links — safe to retry, no in-page download required.</p>
${rows}
<p><a class="back" href="/index.html">← Back to the AURA Command Center</a> · <a class="back" href="/api/types">Raw JSON API</a></p>
</div></body></html>`;
}

// ---------- report ----------

function dailyReport() {
  const counts = registry.counts();
  return {
    generated_at: new Date().toISOString(),
    scheduler: 'on-demand (interval disabled by default)',
    modules: counts,
    tasks: { total: store.get().tasks.length, last_5: store.tasks().slice(0, 5).map((t) => ({ trace_id: t.trace_id, role: t.role, state: t.state })) },
    audit_recent: store.auditLog().slice(0, 5),
    note: 'Telemetry shown here is real backend state; demo dashboards in the UI remain simulations.',
  };
}

// ---------- console page ----------

function consolePageHtml() {
  const rows = registry.status().map((m) => {
    const cls = m.mode === 'live' ? 'live' : m.mode === 'restricted' ? 'restricted' : m.mode === 'review' ? 'review' : 'pending';
    return `<tr><td>${m.area}</td><td>${esc(m.name)}</td><td><span class="pill ${cls}">${m.mode.toUpperCase()}</span></td>
      <td>${m.actions.length ? m.actions.map((a) => `<code>${a}</code>`).join(' ') : '—'}</td>
      <td>${esc(m.note || '')}</td></tr>`;
  }).join('\n');
  const c = registry.counts();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — Live Console</title>
<style>
 body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#07090f;color:#e8ecf5}
 .wrap{max-width:1100px;margin:0 auto;padding:36px 20px}
 h1{font-size:24px;margin:0 0 4px;background:linear-gradient(90deg,#f5c96b,#8ab4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:#93a0b8;margin:0 0 20px}
 .kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
 .kpi{background:#101624;border:1px solid #23304a;border-radius:10px;padding:12px 18px;min-width:110px}
 .kpi b{display:block;font-size:24px}.kpi span{color:#93a0b8;font-size:12px}
 table{width:100%;border-collapse:collapse;font-size:13px;background:#0c111d;border:1px solid #23304a;border-radius:12px;overflow:hidden}
 th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #1a2438;vertical-align:top}
 th{background:#101624;color:#93a0b8;font-weight:600}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11.5px;color:#8ab4ff}
 .pill{border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700}
 .live{background:#12351f;color:#4ade80}.pending{background:#3a2f10;color:#f5c96b}
 .review{background:#2a1a3a;color:#c084fc}.restricted{background:#3a1414;color:#f87171}
 .skill{background:#0e2c3a;color:#39d7ff}
 a{color:#8ab4ff}
</style></head><body><div class="wrap">
<h1>AURA — Live Backend Console</h1>
<p class="sub">Real module registry state · <a href="/api/modules/live">JSON API</a> · <a href="/downloads">Downloads</a> · <a href="/index.html">Command Center UI</a></p>
<div class="kpis">
 <div class="kpi"><b>${c.total}</b><span>areas total</span></div>
 <div class="kpi"><b>${c.live}</b><span>live modules</span></div>
 <div class="kpi"><b>${c.placeholder}</b><span>placeholders</span></div>
 <div class="kpi"><b>${c.review}</b><span>needs redesign</span></div>
 <div class="kpi"><b>${c.restricted}</b><span>restricted</span></div>
 <div class="kpi"><b>${c.skills}</b><span>skills wired</span></div>
</div>
<table><thead><tr><th>#</th><th>Module</th><th>Mode</th><th>Actions (POST /api/modules/&lt;area&gt;/action/&lt;name&gt;)</th><th>Note</th></tr></thead>
<tbody>
${rows}
</tbody></table>
<p class="sub">Restricted modules (32, 33, 36) refuse every call with 403 — policy block, not a missing implementation.</p>
</div></body></html>`;
}

// ---------- brain 2.0 (5-dimensional modular layout) ----------

const BRAIN_DIMENSIONS = [
  { id: 'perceive', name: 'PERCEIVE', icon: '👁', blurb: 'Collects & understands information (inputs: web, docs, APIs, DBs, user)', areas: ['43', '37', '21', '19'] },
  { id: 'reason', name: 'REASON', icon: '🧠', blurb: 'Analyzes, plans & decides — the cognitive core', areas: ['03', '04', '05', '39'] },
  { id: 'act', name: 'ACT', icon: '⚡', blurb: 'Executes actions & uses tools (sandboxed, granted, audited)', areas: ['44', '20', '41', '46', '47', '06', '13', '14', '15'] },
  { id: 'remember', name: 'REMEMBER', icon: '💾', blurb: 'Memory that learns; durable snapshots & sync', areas: ['45', '22', '23', '24', '17'] },
  { id: 'govern', name: 'GOVERN', icon: '🛡', blurb: 'Self-healing logs, audit, design gates & policy blocks', areas: ['16', '42', '48', '32', '33', '36'] },
];

function brainData() {
  const all = registry.status();
  const byArea = Object.fromEntries(all.map((m) => [m.area, m]));
  const dims = BRAIN_DIMENSIONS.map((d) => ({
    ...d,
    modules: d.areas.map((a) => {
      const m = byArea[a];
      return m ? { area: a, name: m.name, mode: m.mode } : { area: a, name: '?', mode: 'missing' };
    }),
    live: d.areas.filter((a) => (byArea[a] || {}).mode === 'live').length,
  }));
  const storeState = store.get();
  return {
    generated_at: new Date().toISOString(),
    uptime_s: Math.round(process.uptime()),
    dimensions: dims,
    workflow: [
      { step: 'Trigger', maps_to: 'POST /api/modules/03/action/submit' },
      { step: 'Perceive', maps_to: 'areas 43/37/21/19' },
      { step: 'Reason', maps_to: 'areas 03/04/05' },
      { step: 'Plan', maps_to: 'consensus 04 winner + gates' },
      { step: 'Act', maps_to: 'areas 44/20/41/46' },
      { step: 'Verify', maps_to: 'integrity 05 + logger 16' },
      { step: 'Learn', maps_to: 'hindsight 45 + report 17' },
    ],
    foundation: {
      tasks: storeState.tasks.length,
      audit_entries: storeState.audit.length,
      snapshots: fs.existsSync(path.join(__dirname, 'src', 'data', 'snapshots')) ? fs.readdirSync(path.join(__dirname, 'src', 'data', 'snapshots')).length : 0,
      checkpoints: fs.existsSync(path.join(__dirname, 'src', 'data', 'checkpoints')) ? fs.readdirSync(path.join(__dirname, 'src', 'data', 'checkpoints')).length : 0,
      schema: 'db/schema.sql (PostgreSQL equivalent)',
      label: 'DATA ENGINEERING · THE FOUNDATION',
    },
    counts: registry.counts(),
  };
}

function brainPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Brain 2.0</title>
<style>
:root{--bg:#05070d;--line:#153048;--cy:#39d7ff;--am:#f5a53c;--ink:#e8f4ff;--mut:#7d94ad}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(1200px 700px at 50% -10%,#0a1626 0%,var(--bg) 60%);color:var(--ink);font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:26px 20px 6px;text-align:center}
h1{margin:0;font-size:26px;letter-spacing:2px}
h1 b{background:linear-gradient(90deg,var(--cy),#7ef0d0);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--mut);font-size:13px;margin:6px 0 0}
.livepill{display:inline-block;background:#0f2c1e;color:#4ade80;border:1px solid #1d5a38;border-radius:20px;padding:2px 12px;font-size:11px;font-weight:700}
#hub{position:relative;max-width:1150px;margin:8px auto 0;height:560px}
#hub svg{position:absolute;inset:0;width:100%;height:100%}
.corelabel{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);z-index:4;text-align:center;pointer-events:none}
.corelabel h2{margin:0;font-size:13px;letter-spacing:3px;color:var(--cy);text-shadow:0 0 14px rgba(57,215,255,.7)}
.corelabel small{color:var(--mut);font-size:10.5px;line-height:1.5}
.dim{position:absolute;width:250px;background:rgba(8,17,32,.92);border:1px solid var(--line);border-radius:14px;padding:12px 14px;backdrop-filter:blur(4px)}
.dim h3{margin:0 0 2px;font-size:13.5px;letter-spacing:2px;color:var(--cy)}
.dim .blurb{color:var(--mut);font-size:11px;margin:0 0 8px;min-height:26px}
.chip{display:flex;align-items:center;gap:7px;font-size:11.5px;padding:3px 0;color:#cfe3f7}
.dot{width:8px;height:8px;border-radius:50%;flex:none}
.m-live{background:#4ade80}.m-skill{background:#39d7ff}.m-placeholder{background:#f5c96b}.m-review{background:#c084fc}.m-restricted{background:#f87171}.m-missing{background:#555}
.dim .meta{margin-top:6px;color:var(--mut);font-size:10.5px}
#d-perceive{left:50%;top:-6px;transform:translateX(-50%)}
#d-reason{left:-4px;top:150px}
#d-act{right:-4px;top:150px}
#d-remember{left:14%;bottom:-4px}
#d-govern{right:14%;bottom:-4px}
#wf{max-width:1150px;margin:6px auto 0;padding:0 16px}
#wf h3{color:var(--am);letter-spacing:2px;font-size:12px;text-align:center}
.steps{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.step{background:#0b1526;border:1px solid var(--line);border-radius:12px;padding:8px 12px;text-align:center;min-width:110px}
.step b{display:block;font-size:12px;color:var(--cy)}
.step span{font-size:10px;color:var(--mut)}
.arrow{color:var(--am);align-self:center;font-size:16px}
#found{max-width:1150px;margin:18px auto 30px;background:linear-gradient(180deg,rgba(21,48,72,.35),rgba(21,48,72,.12));border:1px solid var(--line);border-radius:14px;padding:12px 18px;display:flex;gap:22px;flex-wrap:wrap;align-items:center;justify-content:center}
#found .ft{letter-spacing:2px;color:var(--cy);font-size:12px;font-weight:700}
#found .fc{font-size:12px;color:var(--mut)}#found .fc b{color:var(--ink)}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px}
nav a{color:var(--cy);text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid var(--line);border-radius:8px;padding:5px 10px}
@media(max-width:900px){#hub{height:auto;padding:10px}.dim{position:static;transform:none;width:auto;margin:10px 0}#hub svg{display:none}}
</style></head><body>
<nav><a href="/index.html">UI</a><a href="/console">Console</a><a href="/downloads">Downloads</a><a href="/hub">Multi-Screen Hub</a><a href="/master">Master HUD</a><a href="/jarvis">J.A.R.V.I.S.</a><a href="/ignition">Ignition</a></nav>
<header><h1><b>BRAIN 2.0</b> · AURA AGENTIC CORE</h1>
<p class="sub">5-dimensional modular layout — every node is a real backend module <span class="livepill" id="live">LIVE</span></p></header>
<div id="hub">
<svg viewBox="0 0 1150 560" preserveAspectRatio="none">
 <g stroke="var(--cy)" stroke-width="1.2" opacity=".55">
  <line x1="575" y1="280" x2="575" y2="60"/><line x1="575" y1="280" x2="130" y2="210"/>
  <line x1="575" y1="280" x2="1020" y2="210"/><line x1="575" y1="280" x2="330" y2="520"/>
  <line x1="575" y1="280" x2="820" y2="520"/></g>
 <g stroke="var(--am)" stroke-width="1" opacity=".8">
  <line x1="575" y1="280" x2="575" y2="95"/><line x1="575" y1="280" x2="160" y2="230"/>
  <line x1="575" y1="280" x2="990" y2="230"/><line x1="575" y1="280" x2="360" y2="495"/>
  <line x1="575" y1="280" x2="790" y2="495"/></g>
</svg>
<div class="corelabel"><h2>AGENTIC AI · LIVE 3D</h2><small id="coremeta">booting…</small></div>
${brain3dSnippet('braincv', { w: 440, h: 440 })}
<div class="dim" id="d-perceive"></div><div class="dim" id="d-reason"></div><div class="dim" id="d-act"></div>
<div class="dim" id="d-remember"></div><div class="dim" id="d-govern"></div>
</div>
<div id="wf"><h3>WORKFLOW · TRIGGER → LEARN</h3><div class="steps" id="steps"></div></div>
<div id="found"></div>
<script>
async function tick(){
 try{
  const b=await (await fetch('/api/brain')).json();
  document.getElementById('coremeta').textContent=
    'uptime '+b.uptime_s+'s · tasks '+b.foundation.tasks+' · audit '+b.foundation.audit_entries+' · '+b.counts.live+' live / '+b.counts.skills+' skills';
  for(const d of b.dimensions){
    const el=document.getElementById('d-'+d.id);
    el.innerHTML='<h3>'+d.icon+' '+d.name+'</h3><p class="blurb">'+d.blurb+'</p>'+
      d.modules.map(m=>'<div class="chip"><span class="dot m-'+m.mode+'"></span>'+m.area+' · '+m.name+'</div>').join('')+
      '<div class="meta">'+d.live+'/'+d.modules.length+' live</div>';
  }
  document.getElementById('steps').innerHTML=b.workflow.map((s,i)=>
    '<div class="step"><b>'+s.step+'</b><span>'+s.maps_to+'</span></div>'+(i<b.workflow.length-1?'<span class="arrow">→</span>':'')).join('');
  const f=b.foundation;
  document.getElementById('found').innerHTML='<span class="ft">'+f.label+'</span>'+
    '<span class="fc">tasks <b>'+f.tasks+'</b></span><span class="fc">audit <b>'+f.audit_entries+'</b></span>'+
    '<span class="fc">snapshots <b>'+f.snapshots+'</b></span><span class="fc">checkpoints <b>'+f.checkpoints+'</b></span>'+
    '<span class="fc">'+f.schema+'</span>';
 }catch(e){document.getElementById('live').textContent='RECONNECT…';}
}
tick();setInterval(tick,5000);
</script></body></html>`;
}

// ---------- master control HUD ----------

function masterData() {
  const b = brainData();
  const auto = registry.get('49').mod;
  const hb = registry.get('25').mod.status();
  const log = registry.get('16').mod.status();
  const mcp = registry.get('20').mod.status();
  const ab = registry.get('39').mod.status();
  const swarmSt = registry.get('23').mod.status();
  const chrono = registry.get('24').mod.status();
  return {
    generated_at: new Date().toISOString(),
    core: { uptime_s: b.uptime_s, beats: hb.beats, rss_mb: hb.rss_mb, counts: b.counts },
    skill_telemetry: {
      unsloth: { lane: 'local VRAM fine-tune lane (area 47)', configured: false, next: 'authorized own hardware + model storage', measured_backend_latency_ms: null },
      hindsight: { sentinel: log.healed_total > 0 ? 'ROLLBACK_HEALING_LOGGED' : 'NOMINAL_MONITORING', healed_total: log.healed_total, errors_recent: log.errors_recent, real: true },
      reach: { mode: 'READ-ONLY research only', staged_tasks: store.get().tasks.length, guard: 'no outreach campaigns, no personas, no SOCKS rotation — policy' },
    },
    mining: { state: 'RESTRICTED', area: '33', reason: 'third-party compute use without explicit permission is excluded; no hashrate is simulated' },
    omniroute: { state: 'REVIEW_GATE', area: '31', reason: 'financial engine requires compliance redesign; routing telemetry below is the non-financial A/B matrix', telemetry: ab.exposures },
    sync: { checkpoints: swarmSt.checkpoints, snapshots: chrono.snapshots, mcp_tools: mcp.tools },
    autonomy: auto.status(),
    learning: auto.learning(),
  };
}

function masterPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Living Master Control</title>
<style>
body{margin:0;background:#01040f;color:#e8f4ff;font-family:ui-monospace,Menlo,Consolas,monospace}
header{padding:20px;text-align:center}h1{margin:0;font-size:20px;letter-spacing:3px;color:#39d7ff}
.sub{color:#7d94ad;font-size:12px}nav{position:fixed;top:10px;right:14px;display:flex;gap:8px}
nav a{color:#39d7ff;text-decoration:none;font-size:11px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:1200px;margin:0 auto;padding:0 16px 30px}
@media(max-width:860px){.grid{grid-template-columns:1fr}}
.panel{background:rgba(11,21,40,.5);border:1px solid #1e3a8a;border-radius:6px;padding:14px;backdrop-filter:blur(6px)}
.panel:hover{transform:scale(1.001)}
.ph{display:flex;justify-content:space-between;border-bottom:1px solid rgba(34,211,238,.3);padding-bottom:6px;margin-bottom:10px}
.ph h3{margin:0;color:#22d3ee;font-size:10px;letter-spacing:2px;font-weight:900}
.tag{font-size:9px;font-weight:900;padding:1px 8px;border-radius:3px}
.ok{background:rgba(34,197,94,.12);color:#4ade80}.warn{background:rgba(245,201,107,.12);color:#f5c96b}
.bad{background:rgba(248,113,113,.12);color:#f87171}.info{background:rgba(34,211,238,.12);color:#22d3ee}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.k{background:rgba(0,0,0,.6);border:1px solid #172554;border-radius:4px;padding:10px;text-align:center}
.k span{font-size:9px;color:#60a5fa;text-transform:uppercase;display:block}
.k b{font-size:17px;color:#22d3ee;text-shadow:0 0 10px rgba(34,211,238,.5);display:block;margin-top:4px;letter-spacing:1px}
.k small{font-size:8px;color:#64748b;text-transform:uppercase;display:block;margin-top:4px}
.note{font-size:10px;color:#7d94ad;margin-top:8px;line-height:1.5}
svg.spark{width:100%;height:46px;background:rgba(0,0,0,.4);border:1px solid #172554;border-radius:4px}
</style></head><body>
<nav><a href="/index.html">UI</a><a href="/brain">Brain 2.0</a><a href="/console">Console</a><a href="/downloads">Downloads</a></nav>
<header><h1>🧠 LIVING MASTER CONTROL · BRAIN 2.0</h1><p class="sub">real measurements only — simulations are labelled; restricted modules show policy state, not fake data</p></header>
<div class="grid">
 <div class="panel"><div class="ph"><h3>⌬ QUANTUM BRAIN · CORE TICKERS</h3><span class="tag ok" id="p-core">LIVE</span></div>
  <div class="kpis" id="core-kpis"></div><p class="note" id="core-note"></p></div>
 <div class="panel"><div class="ph"><h3>🛰️ GLOBAL SKILL MATRIX · CONVERGENCE CONSOLE</h3><span class="tag ok">REAL DATA</span></div>
  <div class="kpis" id="skill-kpis"></div><p class="note" id="skill-note"></p></div>
 <div class="panel"><div class="ph"><h3>⛏️ MINING TELEMETRY</h3><span class="tag bad">RESTRICTED</span></div>
  <p class="note" id="mining-note" style="margin:0"></p></div>
 <div class="panel"><div class="ph"><h3>💠 OMNIROUTE · SOVEREIGN BALANCERS</h3><span class="tag warn">REVIEW GATE</span></div>
  <p class="note" id="omni-note" style="margin:0"></p><div class="kpis" id="omni-kpis" style="margin-top:10px"></div></div>
 <div class="panel"><div class="ph"><h3>🔄 SWARM / CHRONO SYNC HUD</h3><span class="tag info">REAL</span></div>
  <div class="kpis" id="sync-kpis"></div></div>
 <div class="panel"><div class="ph"><h3>📈 AUTONOMOUS LEARNING CURVE (self-heal loop)</h3><span class="tag ok" id="loop-tag">RUNNING</span></div>
  <svg class="spark" id="spark" viewBox="0 0 300 46" preserveAspectRatio="none"></svg>
  <div class="kpis" id="learn-kpis" style="margin-top:10px"></div><p class="note" id="learn-note"></p></div>
</div>
<script>
async function tick(){
 try{
  const t0=performance.now();
  const d=await (await fetch('/api/master')).json();
  const lat=Math.round(performance.now()-t0);
  const k=(s,b,f)=>'<div class="k"><span>'+s+'</span><b>'+b+'</b><small>'+f+'</small></div>';
  document.getElementById('core-kpis').innerHTML=
    k('uptime',d.core.uptime_s+'s','process')+k('rss',d.core.rss_mb+' MB','memory')+k('beats',d.core.beats,'heartbeat/5s');
  document.getElementById('core-note').textContent=d.core.counts.live+' live modules · '+d.core.counts.skills+' skills · '+d.core.counts.restricted+' policy-blocked';
  const h=d.skill_telemetry.hindsight;
  document.getElementById('skill-kpis').innerHTML=
    k('api latency',lat+' ms','measured, real')+k('hindsight sentinel',h.healed_total,'errors trapped & healed (real)')+k('reach tasks',d.skill_telemetry.reach.staged_tasks,'read-only research queue');
  document.getElementById('skill-note').textContent='Unsloth: '+d.skill_telemetry.unsloth.next+'. Reach guard: '+d.skill_telemetry.reach.guard;
  document.getElementById('mining-note').textContent='⛔ '+d.mining.reason+' (area '+d.mining.area+'). This panel will never display fabricated hashrates.';
  document.getElementById('omni-note').textContent='⚠️ '+d.omniroute.reason;
  document.getElementById('omni-kpis').innerHTML=Object.entries(d.omniroute.telemetry).map(([a,v])=>k(a,v,'exposures')).join('')||k('exposures','0','none yet');
  document.getElementById('sync-kpis').innerHTML=
    k('checkpoints',d.sync.checkpoints,'swarm, checksummed')+k('snapshots',d.sync.snapshots,'chrono, verified')+k('mcp tools',d.sync.mcp_tools,'granted & audited');
  const c=d.learning.curve;
  document.getElementById('spark').innerHTML=c.length>1?'<polyline fill="none" stroke="#22d3ee" stroke-width="2" points="'+c.map((p,i)=>((i/(c.length-1))*296+2)+','+(44-p.success_rate*40)).join(' ')+'"/>':'';
  document.getElementById('learn-kpis').innerHTML=
    k('loops',d.autonomy.loop_count,'autonomy')+k('heals',d.autonomy.heals_applied,'applied')+k('weights',JSON.stringify(d.learning.weights),'A/B/C heuristic');
  document.getElementById('learn-note').textContent=d.learning.note;
  document.getElementById('loop-tag').textContent=d.autonomy.running?'RUNNING':'PAUSED';
 }catch(e){document.getElementById('p-core').textContent='RECONNECT…';}
}
tick();setInterval(tick,3000);
</script>
<style>
.mx-btn{position:fixed;bottom:12px;z-index:50;background:rgba(8,14,30,.9);color:#ffcf7d;border:1px solid #1d3a66;border-radius:999px;padding:4px 12px;font:12px system-ui,sans-serif;letter-spacing:1px;cursor:pointer}
.mx-btn:hover{border-color:#ffcf7d}
#mx-left{left:12px}#mx-right{right:12px}
#mx-panel{display:none;position:fixed;left:12px;right:12px;bottom:46px;height:72vh;z-index:49;background:#020409;border:1px solid #1d3a66;border-radius:12px;overflow:hidden}
#mx-panel.open{display:flex}
#mx-list{width:190px;overflow:auto;border-right:1px solid #1d3a66;background:rgba(8,14,30,.85);padding:8px}
#mx-list button{display:block;width:100%;text-align:left;background:none;border:0;color:#cfe6ff;padding:5px 6px;font:12px system-ui,sans-serif;cursor:pointer;border-radius:6px}
#mx-list button:hover,#mx-list button.on{background:#14284a;color:#ffcf7d}
#mx-frame{flex:1;border:0;background:#020409}
#mx-close{position:absolute;top:6px;right:8px;background:none;border:0;color:#7fa6d6;font-size:16px;cursor:pointer;z-index:2}
</style>
<div id="mx-panel"><button id="mx-close" title="schließen (Esc)">✕</button><div id="mx-list"></div><iframe id="mx-frame" title="Zweitbildschirm"></iframe></div>
<button class="mx-btn" id="mx-left" title="Zweitbildschirme">◀ screens</button>
<button class="mx-btn" id="mx-right" title="3D-Gehirn">3D ▶</button>
<script>
(function(){
  var SCREENS=[['Hub','/hub'],['3D Brain','/brain'],['Board','/board'],['Growth','/growth'],['JARVIS','/jarvis'],['Upload','/upload'],['Skills','/skills'],['Steuerzentrale','/control'],['Hierarchie','/hierarchy'],['Ops','/ops'],['Console','/console'],['Logs','/logs'],['Container','/containers'],['Zeitplan','/schedule'],['Research','/research'],['SEO','/seo'],['Pipelines','/pipelines'],['Yellow Pages','/yellowpages']];
  var panel=document.getElementById('mx-panel'),list=document.getElementById('mx-list'),frame=document.getElementById('mx-frame');
  function show(path,btn){frame.src=path;[].forEach.call(list.querySelectorAll('button'),function(b){b.classList.toggle('on',b===btn);});}
  SCREENS.forEach(function(s){var b=document.createElement('button');b.textContent=s[0];b.onclick=function(){show(s[1],b);};list.appendChild(b);});
  function open(path){panel.classList.add('open');show(path,null);}
  function close(){panel.classList.remove('open');frame.src='about:blank';}
  document.getElementById('mx-left').onclick=function(){panel.classList.contains('open')?close():open('/hub');};
  document.getElementById('mx-right').onclick=function(){open('/brain');};
  document.getElementById('mx-close').onclick=close;
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
})();
</script>
</body></html>`;
}

// ---------- skill db page ----------

function skillsPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Skill DB & Departments</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:22px 20px 8px;text-align:center}h1{margin:0;font-size:22px;letter-spacing:2px;color:#39d7ff}
.sub{color:#7d94ad;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px}
nav a{color:#39d7ff;text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
.wrap{max-width:1150px;margin:0 auto;padding:0 18px 40px}
.kpis{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:14px 0}
.kpi{background:#101624;border:1px solid #23304a;border-radius:10px;padding:10px 18px;min-width:100px;text-align:center}
.kpi b{display:block;font-size:20px;color:#39d7ff}.kpi span{color:#7d94ad;font-size:11px}
input,select{background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:8px 12px;font-size:13px}
.controls{display:flex;gap:10px;justify-content:center;margin:14px 0;flex-wrap:wrap}
h2{font-size:13px;letter-spacing:2px;color:#f5c96b;margin:26px 0 10px;text-align:center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.card{background:#0b1526;border:1px solid #1e3a8a;border-radius:12px;padding:14px}
.card h3{margin:0 0 2px;font-size:14px;color:#39d7ff}.card .repo{font-size:11px;color:#60a5fa;word-break:break-all}
.stars{float:right;background:rgba(245,201,107,.12);color:#f5c96b;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700}
.card p{font-size:12px;color:#a9bcd4;margin:8px 0 4px;line-height:1.5}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.tag{font-size:10px;border-radius:10px;padding:1px 8px;background:#132c44;color:#8ab4ff}
.tag.area{background:#0e2c3a;color:#39d7ff}.tag.safe{background:#12351f;color:#4ade80}
.dept{border-left:3px solid var(--c,#39d7ff);background:#0b1526;border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:10px}
.dept h3{margin:0;font-size:13.5px}.dept .roles{margin:6px 0}
.role{display:inline-block;background:#132c44;color:#cfe3f7;border-radius:8px;padding:3px 10px;font-size:11.5px;margin:2px 4px 2px 0;cursor:pointer;border:1px solid transparent}
.role:hover,.role.on{border-color:#39d7ff;color:#39d7ff}
.prompt{background:#071120;border:1px dashed #23405e;border-radius:8px;padding:10px;font-size:12px;color:#cfe3f7;white-space:pre-wrap;margin-top:8px;font-family:ui-monospace,Menlo,monospace}
.copy{background:#f5c96b;border:0;color:#0a0c12;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;margin-top:8px}
</style></head><body>
<nav><a href="/index.html">UI</a><a href="/brain">Brain 2.0</a><a href="/master">Master HUD</a><a href="/console">Console</a></nav>
<header><h1>🧰 AURA SKILL DB · ROLES · PROMPTS</h1>
<p class="sub" id="meta"></p></header>
<div class="wrap">
<div class="kpis" id="kpis"></div>
<div class="controls"><input id="q" placeholder="Search skills (name, category, use case)…" style="width:340px">
<select id="cat"><option value="all">all categories</option></select></div>
<h2>WIRED SKILLS (safety-reviewed)</h2><div class="grid" id="cards"></div>
<h2>DEPARTMENTS · ROLES · PROMPTS</h2><div id="depts"></div>
</div>
<script>
let DB=null;
async function load(){
 const [s,d]=await Promise.all([fetch('/api/skills').then(r=>r.json()),fetch('/api/departments').then(r=>r.json())]);
 DB={s,d};render();
}
function render(){
 const st=DB.s.status;
 document.getElementById('meta').textContent=st.skills+' skills · ~'+Math.round(st.total_stars/1000)+'k combined stars · '+st.workflows+' workflows · '+st.departments+' departments · '+st.roles+' roles';
 document.getElementById('kpis').innerHTML=
  [['skills',st.skills],['combined ★',Math.round(st.total_stars/1000)+'k'],['workflows',st.workflows],['departments',st.departments],['roles',st.roles],['cross-linked areas',st.crosslinked_areas]]
  .map(([a,b])=>'<div class="kpi"><b>'+b+'</b><span>'+a+'</span></div>').join('');
 const cats=[...new Set(DB.s.skills.map(x=>x.category))];
 const sel=document.getElementById('cat');
 if(sel.options.length===1)cats.forEach(c=>sel.add(new Option(c,c)));
 const q=document.getElementById('q').value.toLowerCase(),cat=sel.value;
 document.getElementById('cards').innerHTML=DB.s.skills.filter(x=>(cat==='all'||x.category===cat)&&
   (x.name+x.category+x.use_case+x.tagline).toLowerCase().includes(q))
  .map(x=>'<div class="card"><span class="stars">★'+(x.stars?Math.round(x.stars/1000)+'k':'new')+'</span><h3>'+x.name+'</h3>'+
   '<div class="repo">'+x.repo+'</div><p>'+x.tagline+'<br>'+x.use_case+'</p><div class="tags">'+
   '<span class="tag area">area '+x.area+'</span><span class="tag">'+x.category+'</span><span class="tag">'+x.mode+'</span>'+
   x.crosslinks.map(c=>'<span class="tag">↔ '+c+'</span>').join('')+'</div><p class="safe" style="color:#4ade80;font-size:11px">🛡 '+x.safety+'</p></div>').join('');
 document.getElementById('depts').innerHTML=DB.d.departments.map(dep=>'<div class="dept" style="--c:'+dep.color+'">'+
  '<h3>'+dep.name+' <small style="color:#7d94ad">areas '+dep.areas.join(', ')+'</small></h3><div class="roles">'+
  dep.roles.map(r=>'<span class="role" data-d="'+dep.id+'" data-r="'+r.id+'">'+r.title+' · '+r.level+'</span>').join('')+
  '</div><div class="promptbox" id="pb-'+dep.id+'"><div class="prompt">Pick a role to see its system prompt…</div></div></div>').join('');
 document.querySelectorAll('.role').forEach(el=>el.onclick=async()=>{
  document.querySelectorAll('.role').forEach(x=>x.classList.remove('on'));el.classList.add('on');
  const p=await (await fetch('/api/prompts?dept='+el.dataset.d+'&role='+el.dataset.r)).json();
  document.getElementById('pb-'+el.dataset.d).innerHTML='<div class="prompt">'+p.prompt+'</div><button class="copy" data-t="'+encodeURIComponent(p.prompt)+'">⧉ Copy prompt</button>';
 });
}
document.addEventListener('click',e=>{
 if(e.target.classList.contains('copy')){navigator.clipboard.writeText(decodeURIComponent(e.target.dataset.t));e.target.textContent='✓ copied';}
});
document.getElementById('q').oninput=render;document.getElementById('cat').onchange=render;
load();
</script></body></html>`;
}

// ---------- static file serving ----------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'text/plain', 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'text/plain', 'Not found: ' + p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

function readBody(req, cap = 5e6) {
  return new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > cap) req.destroy(); }); req.on('end', () => r(d)); });
}

function send(res, code, type, body, extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', ...extra });
  res.end(body);
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const started = Date.now();
  traffic.record(p); // area 65 — honest telemetry, measured at the door
  res.on('finish', () => { // area 66 — massive structured request logging
    const ms = Date.now() - started;
    if (res.statusCode >= 500) selfRepair.log('ERROR', 'HTTP', req.method + ' ' + p, { status: res.statusCode, ms });
    else selfRepair.log('INFO', 'HTTP', req.method + ' ' + p, { status: res.statusCode, ms });
  });

  try {
    if (p === '/api/health') {
      return send(res, 200, 'application/json', JSON.stringify({
        status: 'ok', service: 'aura-backend', time: new Date().toISOString(),
        uptime_s: Math.round(process.uptime()),
        counts: { modules: modules.length, integrations: integrations.integrations.length, artifacts: Object.keys(ARTIFACTS).length },
        endpoints: ['/api/health', '/api/integrations', '/api/modules', '/api/modules/live', '/api/modules/:area/action/:name', '/api/report', '/api/types', '/api/skills', '/api/departments', '/api/roles', '/api/prompts', '/api/workflows', '/api/xrefs', '/api/brain', '/api/master', '/api/downloads', '/api/download/:name', '/console', '/brain', '/master', '/skills', '/downloads'],
      }));
    }
    if (p === '/api/modules/live') {
      return send(res, 200, 'application/json', JSON.stringify({ counts: registry.counts(), modules: registry.status() }, null, 2));
    }
    const action = p.match(/^\/api\/modules\/([0-9]{2})\/action\/([a-z0-9_]+)$/i);
    if (action) {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — actions locked. Revive via /ops or /api/kill' }));
      const found = registry.get(action[1]);
      if (!found) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown area ' + action[1] }));
      if (found.kind !== 'live') {
        const code = found.kind === 'restricted' ? 403 : 501;
        return send(res, code, 'application/json', JSON.stringify({
          area: action[1], mode: found.kind,
          error: found.kind === 'restricted'
            ? 'BLOCKED BY POLICY: this module is excluded from implementation.'
            : `module is '${found.kind}' — ${found.entry.note}`,
        }));
      }
      const fn = found.mod.actions && found.mod.actions[action[2].toLowerCase()];
      if (!fn) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown action', actions: Object.keys(found.mod.actions || {}) }));
      let body = {};
      if (req.method === 'POST') {
        const raw = await new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 5e6) req.destroy(); }); req.on('end', () => r(d)); });
        try { body = raw ? JSON.parse(raw) : {}; } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })); }
      }
      // Area 67: run inside the module container — timeout guard, circuit
      // breaker, quarantine. A crashing module can never kill the server.
      const cr = await containers.run(action[1], action[2].toLowerCase(), body);
      if (cr.ok) return send(res, 200, 'application/json', JSON.stringify(cr.result, null, 2));
      if (cr.quarantined) return send(res, 429, 'application/json', JSON.stringify({ error: 'MODULE QUARANTINED — circuit breaker open', ...cr }, null, 2));
      return send(res, 500, 'application/json', JSON.stringify({ error: cr.error, container_fails: cr.fails, container: cr.container }, null, 2));
    }
    if (p === '/api/skills') return send(res, 200, 'application/json', JSON.stringify({ skills: registry.skills.skills(), status: registry.skills.status(), db: registry.skills.db_meta() }, null, 2));
    if (p === '/api/departments') return send(res, 200, 'application/json', JSON.stringify({ departments: registry.skills.departments() }, null, 2));
    if (p === '/api/roles') return send(res, 200, 'application/json', JSON.stringify(registry.skills.roles(), null, 2));
    if (p.startsWith('/api/prompts')) {
      const q = url.searchParams;
      const res2 = registry.skills.promptFor(q.get('dept') || '', q.get('role') || '');
      if (!res2) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown department; see /api/departments' }));
      return send(res, 200, 'application/json', JSON.stringify(res2, null, 2));
    }
    if (p === '/skills') return send(res, 200, 'text/html; charset=utf-8', skillsPageHtml());
    if (p === '/hub') return send(res, 200, 'text/html; charset=utf-8', pages.hub());
    if (p === '/pipelines') return send(res, 200, 'text/html; charset=utf-8', pages.pipelines());
    if (p === '/yellowpages') return send(res, 200, 'text/html; charset=utf-8', pages.yellowpages());
    if (p === '/deploy') return send(res, 200, 'text/html; charset=utf-8', pages.deploy());
    if (p === '/cluster') return send(res, 200, 'text/html; charset=utf-8', pages.cluster());
    if (p === '/api/yellowpages') return send(res, 200, 'application/json', JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'yellowpages.json'), 'utf8')), null, 2));
    if (p === '/api/yellowpages/suggest' && req.method === 'POST') {
      // cross-usage: Deep Research findings → curated list, human-gated as 'review'
      let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      const url = String(body.url || ''); const name = String(body.name || '').slice(0, 80);
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url)) return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'only https://github.com/owner/repo suggestions' }));
      const file = path.join(__dirname, 'data', 'yellowpages.json');
      const yp = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (yp.links.some((l) => l.url === url)) return send(res, 200, 'application/json', JSON.stringify({ ok: true, duplicate: true, url }));
      yp.links.push({
        name: name || url.split('/').slice(-2).join('/'), url, category: 'deep-research',
        desc: String(body.desc || '').slice(0, 180) || 'suggested via AURA Deep Research',
        status: 'review', stars: Number(body.stars) || 0, suggested_at: new Date().toISOString(),
      });
      fs.writeFileSync(file, JSON.stringify(yp, null, 2)); // watcher validates + vaults
      store.audit({ area: 'YP', event: 'research_suggestion', url });
      return send(res, 201, 'application/json', JSON.stringify({ ok: true, status: 'review', total: yp.links.length }));
    }
    if (p === '/api/teams') return send(res, 200, 'application/json', JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'teams.json'), 'utf8')).teams, null, 2));
    if (p === '/api/notebook-export') {
      const rep = dailyReport();
      const md = [
        '# AURA Notebook Export', '',
        `> ${new Date().toISOString()} · real backend state`, '',
        '## Report', '```json', JSON.stringify(rep, null, 2), '```', '',
        '## Tasks (last 20)', '```json', JSON.stringify(store.tasks().slice(0, 20), null, 2), '```', '',
        '## Modules', '```json', JSON.stringify(registry.status().map(({ area, name, mode }) => ({ area, name, mode })), null, 2), '```', '',
      ].join('\n');
      return send(res, 200, 'text/markdown; charset=utf-8', md, { 'Content-Disposition': 'attachment; filename="aura-notebook.md"' });
    }
    if (p === '/api/socialchain' && req.method === 'POST') {
      const raw = await new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e5) req.destroy(); }); req.on('end', () => r(d)); });
      let cfg; try { cfg = JSON.parse(raw); } catch { return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })); }
      if (!cfg.gates || cfg.gates.human_approval !== true || cfg.gates.no_synthetic_engagement !== true) {
        return send(res, 403, 'application/json', JSON.stringify({ error: 'REFUSED: human approval + no synthetic engagement are mandatory' }));
      }
      store.audit({ area: 'WF-7', event: 'social_chain_configured', platform: cfg.platform, specialists: cfg.specialists });
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, audited: true }));
    }
    if (p === '/api/workflows') return send(res, 200, 'application/json', JSON.stringify(registry.skills.workflows(), null, 2));

    // ---- Area 61: Workflow Builder ----
    if (p === '/builder') return send(res, 200, 'text/html; charset=utf-8', pageBuilder());
    if (p === '/api/builder/workflows' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(wfBuilder.list(), null, 2));
    if (p === '/api/builder/workflows' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })); }
      const r = wfBuilder.add(body);
      return send(res, r.ok ? 201 : 400, 'application/json', JSON.stringify(r, null, 2));
    }
    if (p.startsWith('/api/builder/workflows/') && req.method === 'DELETE') {
      return send(res, 200, 'application/json', JSON.stringify(wfBuilder.remove(decodeURIComponent(p.split('/').pop()))));
    }
    if (p === '/api/builder/simulate' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      return send(res, 200, 'application/json', JSON.stringify(wfBuilder.simulate(body.id), null, 2));
    }

    // ---- Phase 2: Growth (WF-18 Repurposing · Traffic Mesh · WF-19 Label · Unified Analytics) ----
    // Schreibende Routen: kill-gated (423) und nie öffentlich veröffentlichend — nur Entwürfe/Vorschläge.
    if (p === '/growth') return send(res, 200, 'text/html; charset=utf-8', pageGrowth(analyticsHub.PLATFORMS));
    if (p === '/api/growth/repurpose' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(repurposeEngine.list(), null, 2));
    if (p === '/api/growth/repurpose' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' }));
      let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })); }
      const r = repurposeEngine.repurpose(body);
      return send(res, r.ok ? 201 : 400, 'application/json', JSON.stringify(r, null, 2));
    }
    if (p === '/api/growth/mesh' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(crosslinkMesh.matrix(), null, 2));
    if (p === '/api/growth/mesh/asset' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' }));
      let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })); }
      const r = crosslinkMesh.addAsset(body);
      return send(res, r.ok ? 201 : 400, 'application/json', JSON.stringify(r, null, 2));
    }
    if (p === '/api/growth/releases' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(labelPipeline.list(), null, 2));
    if (p === '/api/growth/releases' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' }));
      let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })); }
      const r = labelPipeline.create(body);
      return send(res, r.ok ? 201 : 400, 'application/json', JSON.stringify(r, null, 2));
    }
    if (p.startsWith('/api/growth/releases/') && p.endsWith('/advance') && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' }));
      let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })); }
      const id = decodeURIComponent(p.split('/')[4] || '');
      const r = labelPipeline.advance(id, body.target, body);
      return send(res, r.ok ? 200 : (r.code || 400), 'application/json', JSON.stringify(r, null, 2));
    }
    // ---- Daten-Upload (Link-Listen): Vorschau schreibt nichts, Übernahme nur mit Name + Token ----
    if (p === '/upload') return send(res, 200, 'text/html; charset=utf-8', pageUpload());
    if (p === '/skills') return send(res, 200, 'text/html; charset=utf-8', pageSkills());
    if (p === '/control') return send(res, 200, 'text/html; charset=utf-8', pageControl());
    // ---- Steuerzentrale: Schalter und Freigaben (Schreiben nur mit Admin-Token, nie bei Kill-Switch) ----
    if (p === '/api/control' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ actions: control.actions(), pending: control.pending() }, null, 2));
    if (p.startsWith('/api/control/') && req.method === 'POST') {
      const adminToken = process.env.AURA_ADMIN_TOKEN || '';
      if (adminToken && req.headers['x-aura-token'] !== adminToken) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token fehlt oder falsch (Header x-aura-token)' }));
      let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      const out = (r) => send(res, r.code || (r.ok ? 200 : 400), 'application/json', JSON.stringify(r, null, 2));
      let m = p.match(/^\/api\/control\/action\/([a-z_]+)\/(enable|disable)$/);
      if (m) return out(control.setEnabled(m[1], m[2] === 'enable', body.by));
      m = p.match(/^\/api\/control\/run\/([a-z_]+)$/);
      if (m) return out(control.gate(m[1], { by: body.by, args: body.args || {}, killed: ops.isKilled() }));
      m = p.match(/^\/api\/control\/approvals\/(AP-[0-9a-f]{6})$/);
      if (m) return out(control.decide(m[1], body.decision, body.by));
      return send(res, 404, 'application/json', JSON.stringify({ ok: false, error: 'unknown control route' }));
    }
    if (p === '/api/skill-catalog' && req.method === 'GET') {
      const sp = new URL(req.url, 'http://x').searchParams;
      return send(res, 200, 'application/json', JSON.stringify(skillCatalog.search({ q: sp.get('q') || '', source: sp.get('source') || '', status: sp.get('status') || '', category: sp.get('category') || '', limit: sp.get('limit') || 100 }), null, 2));
    }
    if (p === '/api/upload/kinds' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(dataUpload.KINDS(), null, 2));
    if (p === '/api/upload/preview' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 1.5e6) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      const r = dataUpload.preview(body.kind, body.text);
      return send(res, r.status, 'application/json', JSON.stringify(r, null, 2));
    }
    if (p === '/api/upload/commit' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — upload locked' }));
      const adminToken = process.env.AURA_ADMIN_TOKEN || '';
      if (adminToken && req.headers['x-aura-token'] !== adminToken) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token fehlt oder falsch' }));
      let body; try { body = JSON.parse(await readBody(req, 1.5e6) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      const r = dataUpload.commit(body.kind, body.text, body.by);
      return send(res, r.status, 'application/json', JSON.stringify(r, null, 2));
    }

    // ---- Agent Board (Kanban für Agenten; Freigabe nur durch Menschen) ----
    if (p === '/board') return send(res, 200, 'text/html; charset=utf-8', pageBoard());
    if (p === '/api/board' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(agentBoard.board(), null, 2));
    if (p.startsWith('/api/board/') && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — board locked' }));
      const adminToken = process.env.AURA_ADMIN_TOKEN || '';
      if (adminToken && req.headers['x-aura-token'] !== adminToken) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token fehlt oder falsch (Header x-aura-token)' }));
      let body = {};
      try { const raw = await readBody(req, 2e4); body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      if (p === '/api/board/task') {
        const r = agentBoard.createTask(body);
        return send(res, r.status, 'application/json', JSON.stringify(r.ok ? { ok: true, task: r.task } : { ok: false, error: r.error }, null, 2));
      }
      const m = p.match(/^\/api\/board\/(T-[0-9a-f]{6})\/(assign|start|request_help|handoff|submit|approve|reject)$/);
      if (m) {
        const r = agentBoard.act(m[1], m[2], body.by, body);
        return send(res, r.status, 'application/json', JSON.stringify(r.ok ? { ok: true, task: r.task } : { ok: false, error: r.error }, null, 2));
      }
      return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown board route' }));
    }
    if (p === '/api/growth/analytics' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(analyticsHub.dashboard(), null, 2));
    if (p === '/api/growth/analytics/import' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' }));
      let body; try { body = JSON.parse(await readBody(req, 2e6)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })); }
      const r = analyticsHub.importRows(body.platform, body.rows);
      return send(res, r.ok ? 201 : 400, 'application/json', JSON.stringify(r, null, 2));
    }

    // ---- Area 62: Deep Research (real GitHub-API data) ----
    if (p === '/research') return send(res, 200, 'text/html; charset=utf-8', pageResearch());
    if (p === '/api/research') {
      const r = await deepResearch.research(url.searchParams.get('q') || '', { perQuery: url.searchParams.get('per') });
      return send(res, r.ok ? 200 : 400, 'application/json', JSON.stringify(r, null, 2));
    }
    if (p === '/api/research/export') {
      const r = await deepResearch.research(url.searchParams.get('q') || '', {});
      if (!r.ok) return send(res, 400, 'application/json', JSON.stringify(r));
      return send(res, 200, 'text/markdown; charset=utf-8', deepResearch.toMarkdown(r),
        { 'Content-Disposition': 'attachment; filename="aura-research-' + (r.topic || 'topic').replace(/[^a-z0-9]+/gi, '_').slice(0, 40) + '.md"' });
    }

    // ---- Area 63: SEO Center + technical files ----
    if (p === '/seo') return send(res, 200, 'text/html; charset=utf-8', pageSeo());
    if (p === '/api/seo') return send(res, 200, 'application/json', JSON.stringify(seo.auditAll(), null, 2));
    if (p === '/sitemap.xml') return send(res, 200, 'application/xml', seo.sitemap(req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] + '://' + req.headers.host : 'http://' + req.headers.host));
    if (p === '/robots.txt') return send(res, 200, 'text/plain', seo.robots('http://' + req.headers.host));

    // ---- Area 64: backup vault (verified snapshots + restore) ----
    if (p === '/api/backups' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(watcher.backups(), null, 2));
    if (p === '/api/backups/restore' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      return send(res, 200, 'application/json', JSON.stringify(watcher.restore(body.file)));
    }

    // ---- Area 65: honest traffic telemetry ----
    if (p === '/api/traffic') return send(res, 200, 'application/json', JSON.stringify(traffic.report(), null, 2));

    // ---- Area 66: massive logging + self-repair ----
    if (p === '/logs') return send(res, 200, 'text/html; charset=utf-8', pageLogs());
    if (p === '/api/logs') {
      const n = Number(url.searchParams.get('n')) || 100;
      const level = url.searchParams.get('level') || '';
      return send(res, 200, 'application/json', JSON.stringify({ mode: 'LIVE', level: level || 'ALL', lines: selfRepair.tail(n, level || undefined) }, null, 2));
    }
    if (p === '/api/selfrepair' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(selfRepair.report(), null, 2));
    if (p === '/api/selfrepair/run' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(selfRepair.runChecks(), null, 2));
    if (p === '/api/selfrepair/drill' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(selfRepair.actions.simulate_error(), null, 2));

    // ---- Area 67: module containers (crash isolation) ----
    if (p === '/containers') return send(res, 200, 'text/html; charset=utf-8', pageContainers());
    if (p === '/api/containers' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(containers.status(), null, 2));
    if (p === '/api/containers/drill' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      return send(res, 200, 'application/json', JSON.stringify(containers.drill(String(body.area || '16'), body), null, 2));
    }

    // ---- Area 68: global config ----
    if (p === '/config') return send(res, 200, 'text/html; charset=utf-8', pageConfig());
    if (p === '/api/config/schema') return send(res, 200, 'application/json', JSON.stringify(config.schema(), null, 2));
    if (p === '/api/config' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ file: config.file, config: config.current() }, null, 2));
    if (p === '/api/config' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })); }
      const r = config.set(body);
      return send(res, r.ok ? 200 : 400, 'application/json', JSON.stringify(r, null, 2));
    }
    if (p === '/api/config/reset' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(config.reset(), null, 2));

    // ---- J.A.R.V.I.S. (real assistant over live data) ----
    if (p === '/jarvis') return send(res, 200, 'text/html; charset=utf-8', pageJarvis());
    if (p === '/api/jarvis' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      const out = await jarvis.askAsync(body.msg || body.q || body.text || body.message || '');
      return send(res, 200, 'application/json', JSON.stringify(out, null, 2));
    }
    if (p === '/api/jarvis/llm') return send(res, 200, 'application/json', JSON.stringify(await require('./src/lib/ollama_llm').status(), null, 2));
    if (p === '/api/jarvis/memory') return send(res, 200, 'application/json', JSON.stringify(jarvis.memory(), null, 2));

    // ---- Area 69: recursive learning core (max 1 failure per fingerprint) ----
    if (p === '/api/learning' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(learningCore.curve(), null, 2));
    if (p === '/api/learning/simulate' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(learningCore.actions.simulate(), null, 2));
    if (p === '/api/learning/outcome' && req.method === 'POST') {
      let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })); }
      return send(res, 200, 'application/json', JSON.stringify(learningCore.reportOutcome(String(body.fingerprint || ''), body.ok !== false), null, 2));
    }

    // ---- 1-click reproduction report ----
    if (p === '/api/repro') {
      let commit = 'unknown';
      try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT, timeout: 3000 }).toString().trim(); } catch {}
      const dataOk = watcher.backups().verified > 0;
      return send(res, 200, 'application/json', JSON.stringify({
        ok: true, mode: 'LIVE', at: new Date().toISOString(), commit,
        node: process.version, platform: process.platform, uptime_s: Math.round(process.uptime()),
        checks: {
          data_files: selfRepair.report().lastReport ? selfRepair.report().lastReport.data.map((x) => ({ file: x.file, state: x.state })) : 'pending',
          pages: selfRepair.report().lastReport ? selfRepair.report().lastReport.pages_ok : 'pending',
          vault: { snapshots: watcher.backups().count, verified: watcher.backups().verified },
          containers_quarantined: containers.status().containers.filter((c) => String(c.container).startsWith('quarantine')).length,
          kill_switch: ops.status().kill_switch.on,
          config_hot_reload: true,
        },
        repro_command: 'curl -fsSL https://raw.githubusercontent.com/flubber01/aura/arena/0ee9c54c-aura/deploy/master-install.sh | bash',
      }, null, 2));
    }

    if (p === '/api/xrefs') return send(res, 200, 'application/json', JSON.stringify(registry.skills.xrefs(), null, 2));
    if (p === '/api/brain') return send(res, 200, 'application/json', JSON.stringify(brainData(), null, 2));
    if (p === '/brain') return send(res, 200, 'text/html; charset=utf-8', brainPageHtml());
    if (p === '/api/master') return send(res, 200, 'application/json', JSON.stringify(masterData(), null, 2));
    if (p === '/master') return send(res, 200, 'text/html; charset=utf-8', masterPageHtml());
    // ---------- hierarchy / vita ----------
    if (p === '/hierarchy') return send(res, 200, 'text/html; charset=utf-8', pageHierarchy());
    if (p === '/api/hierarchy') return send(res, 200, 'application/json', JSON.stringify(hierarchy.tree(), null, 2));
    if (p === '/api/hierarchy/knowledge') return send(res, 200, 'application/json', JSON.stringify(hierarchy.knowledge(), null, 2));
    let m2 = p.match(/^\/api\/hierarchy\/([a-z0-9_]+)\/bundle$/);
    if (m2) { const b = hierarchy.bundle(m2[1]); return b ? send(res, 200, 'application/json', JSON.stringify(b, null, 2)) : send(res, 404, 'application/json', JSON.stringify({ error: 'unknown node' })); }
    m2 = p.match(/^\/api\/hierarchy\/([a-z0-9_]+)\/stats$/);
    if (m2) return send(res, 200, 'application/json', JSON.stringify(hierarchy.stats(m2[1]), null, 2));
    m2 = p.match(/^\/api\/hierarchy\/([a-z0-9_]+)\/feedback$/);
    if (m2 && req.method === 'POST') {
      const raw = await readBody(req); let body;
      try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })); }
      const r = hierarchy.recordFeedback(m2[1], body);
      return r ? send(res, 200, 'application/json', JSON.stringify(r)) : send(res, 404, 'application/json', JSON.stringify({ error: 'unknown node' }));
    }
    if (p === '/api/vita' && req.method !== 'POST') return send(res, 200, 'application/json', JSON.stringify(hierarchy.vitaList(), null, 2));
    if (p === '/api/vita' && req.method === 'POST') {
      const raw = await readBody(req); let body;
      try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })); }
      try { return send(res, 200, 'application/json', JSON.stringify(hierarchy.vitaAdd(body))); }
      catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })); }
    }
    m2 = p.match(/^\/api\/vita\/([a-z0-9-]+)$/);
    if (m2 && req.method === 'DELETE') return send(res, 200, 'application/json', JSON.stringify(hierarchy.vitaDelete(m2[1])));

    // ---------- ops: kill switch, scheduler, telegram, mail ----------
    if (p === '/ops') return send(res, 200, 'text/html; charset=utf-8', pageOps());
    if (p === '/api/ops') return send(res, 200, 'application/json', JSON.stringify(ops.status(), null, 2));
    if (p === '/api/ops/super' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(ops.runSuper() || { ok: true }));
    if (p === '/api/ops/others' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(ops.runOthers() || { ok: true }));
    if (p === '/api/ops/sync' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(ops.runFullSync() || { ok: true }));
    if (p === '/api/kill' && req.method === 'POST') {
      const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      // Auslösen ist immer erlaubt (sicherer Zustand). Lösen braucht den Admin-Token, wenn er gesetzt ist.
      if (!body.arm) {
        const adminToken = process.env.AURA_ADMIN_TOKEN || '';
        if (adminToken && req.headers['x-aura-token'] !== adminToken) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Kill-Switch lösen braucht Admin-Token (x-aura-token)' }));
      }
      return send(res, 200, 'application/json', JSON.stringify(body.arm ? ops.kill(body.reason) : ops.revive(body.reason)));
    }
    if (p === '/api/telegram/kit') return send(res, 200, 'application/json', JSON.stringify(ops.telegramKit(), null, 2));
    if (p === '/api/mail') return send(res, 200, 'application/json', JSON.stringify(mail.list(), null, 2));
    if (p === '/api/mail/compose' && req.method === 'POST') {
      const raw = await readBody(req); let body;
      try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })); }
      try { return send(res, 200, 'application/json', JSON.stringify(mail.compose(body))); }
      catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })); }
    }
    if (p === '/api/mail/approve' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' }));
      const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      try { return send(res, 200, 'application/json', JSON.stringify(mail.approve(String(body.id)))); }
      catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })); }
    }

    // ---------- config upload (easy update system) ----------
    if (p === '/api/config/upload' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — upload locked' }));
      const adminToken = process.env.AURA_ADMIN_TOKEN || '';
      if (adminToken && req.headers['x-aura-token'] !== adminToken) return send(res, 401, 'application/json', JSON.stringify({ error: 'Admin-Token fehlt oder falsch' }));
      const raw = await readBody(req); let body;
      try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON — upload must be a JSON file' })); }
      if (body.target === 'yellowpages') return send(res, 410, 'application/json', JSON.stringify({ error: 'Yellow Pages laufen jetzt über /api/upload/preview und /api/upload/commit (geprüft, mit Vorschau und Backup).' }));

      const T = { yellowpages: (c) => Array.isArray(c.links), departments: (c) => Array.isArray(c.departments), teams: (c) => Array.isArray(c.teams), skills: (c) => Array.isArray(c.skills) };
      if (!T[body.target] || !T[body.target](body.config || {})) return send(res, 400, 'application/json', JSON.stringify({ error: 'target must be one of ' + Object.keys(T).join('/') + ' with a valid shape' }));
      const file = path.join(__dirname, 'data', body.target + '.json');
      const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
      const next = { ...cur, ...body.config, schema_version: (cur.schema_version || 1), updated_at: new Date().toISOString(), via: 'config-upload' };
      fs.writeFileSync(file + '.tmp', JSON.stringify(next, null, 2)); fs.renameSync(file + '.tmp', file);
      store.audit({ area: 'CFG', event: 'config_uploaded', target: body.target });
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, target: body.target, note: 'yellowpages/teams apply immediately; departments/skills apply on restart' }));
    }

    // ---------- sandboxed inbound terminal ----------
    if (p === '/terminal') return send(res, 200, 'text/html; charset=utf-8', pageTerminal());
    if (p === '/api/terminal' && req.method === 'POST') {
      if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — terminal locked' }));
      const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      const cmd = String(body.cmd || '').trim();
      if (!cmd || cmd.length > 500) return send(res, 400, 'application/json', JSON.stringify({ error: 'command required (<=500 chars)' }));
      store.audit({ area: 'TERM', event: 'exec', cmd: cmd.slice(0, 200) });
      return await new Promise((resolve) => {
        execFile('bash', ['-c', cmd], { cwd: ROOT, timeout: 5000, maxBuffer: 1e6 }, (err, stdout, stderr) => {
          resolve(send(res, 200, 'application/json', JSON.stringify({ out: stdout.slice(0, 8000), err: (stderr || '').slice(0, 2000), error: err && err.killed ? 'timeout (5s)' : err ? err.message.slice(0, 200) : null })));
        });
      });
    }

    // ---------- minion live stream (SSE) ----------
    if (p === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      let last = store.get().audit.length;
      const push = (e) => res.write('data: ' + JSON.stringify(e) + '\n\n');
      store.auditLog().slice(0, 3).reverse().forEach(push);
      const iv = setInterval(() => {
        const a = store.get().audit;
        if (a.length < last) last = 0; // cap applied
        if (a.length > last) { a.slice(last).forEach(push); last = a.length; }
      }, 1000);
      req.on('close', () => clearInterval(iv));
      return;
    }

    // ---------- ultra brain chat + minibot ----------
    if (p === '/api/ultra/chat' && req.method === 'POST') {
      const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      return send(res, 200, 'application/json', JSON.stringify({ answer: ultraChat.ask(body.msg) }));
    }
    if (p === '/minibot') return send(res, 200, 'text/html; charset=utf-8', pageMinibot());

    // ---------- ignition master dashboard + arcade + schedule ----------
    if (p === '/ignition') return send(res, 200, 'text/html; charset=utf-8', pageIgnition());
    if (p === '/arcade') return send(res, 200, 'text/html; charset=utf-8', pageArcade());
    if (p === '/schedule') return send(res, 200, 'text/html; charset=utf-8', pageSchedule());
    if (p === '/api/schedule' ) return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.list(), null, 2));
    if (p === '/api/schedule/add' && req.method === 'POST') {
      const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })); }
      try { return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.add(body))); }
      catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })); }
    }
    if (p === '/api/schedule/remove' && req.method === 'POST') {
      const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.remove(String(body.id))));
    }
    if (p === '/api/schedule/recommend') return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.recommend(), null, 2));
    if (p === '/api/schedule/csv') return send(res, 200, 'text/csv; charset=utf-8', registry.get('60').mod.csv(), { 'Content-Disposition': 'attachment; filename="aura-schedule.csv"' });
    if (p === '/api/watcher') return send(res, 200, 'application/json', JSON.stringify(watcher.status(), null, 2));
    if (p === '/api/ignition') {
      const a = store.get().audit;
      const byArea = {};
      for (const e of a) byArea[e.area] = (byArea[e.area] || 0) + 1;
      const yp = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'yellowpages.json'), 'utf8'));
      const curve = registry.get('49').mod.learning().curve.map((c) => c.success_rate);
      const c = registry.counts();
      return send(res, 200, 'application/json', JSON.stringify({
        counts: c,
        roles: registry.skills.roles().length,
        teams: teams.teams.length,
        workflows: registry.skills.workflows().length,
        yellowpages: { total: yp.links.length, blocked: yp.links.filter((l) => l.status === 'blocked').length, review: yp.links.filter((l) => l.status === 'review').length },
        ops: ops.status(),
        catalog: [
          { path: '/', name: 'Command Center UI', desc: 'original AURA interface', status: 'LIVE', h: 'ok' },
          { path: '/hub', name: 'Multi-Screen Hub', desc: '3D brain · Matrix · JARVIS · Command', status: 'LIVE', h: 'ok' },
          { path: '/brain', name: 'Brain 2.0', desc: '5-dimensional radial layout', status: 'LIVE', h: 'ok' },
          { path: '/master', name: 'Master HUD', desc: 'living control grid', status: 'LIVE', h: 'ok' },
          { path: '/hierarchy', name: 'Brain Hierarchy', desc: 'ultra→super→heads→minions + chat', status: 'LIVE', h: 'ok' },
          { path: '/console', name: 'Console', desc: '60-area registry', status: 'LIVE', h: 'ok' },
          { path: '/skills', name: 'Skill DB', desc: 'skills · 63 roles · prompts', status: 'LIVE', h: 'ok' },
          { path: '/pipelines', name: 'Pipelines', desc: 'WF-1…WF-8 + social chain', status: 'LIVE', h: 'ok' },
          { path: '/builder', name: 'Workflow Builder', desc: 'roles → chain → gates → JSON → sim', status: 'LIVE', h: 'ok' },
          { path: '/research', name: 'Deep Research', desc: 'live GitHub-API fan-out, star-ranked', status: 'LIVE', h: 'ok' },
          { path: '/seo', name: 'SEO Center', desc: 'on-site audit + sitemap + robots', status: 'LIVE', h: 'ok' },
          { path: '/cluster', name: 'Root-Server Collective', desc: 'k3s kit ready · servers pending', status: 'NOT-CONN', h: 'warn' },
          { path: '/yellowpages', name: 'Yellow Pages', desc: yp.links.length + ' curated links', status: 'LIVE', h: 'ok' },
          { path: '/deploy', name: 'Deploy', desc: 'HF · Ollama · repo kits · MCP', status: 'LIVE', h: 'ok' },
          { path: '/ops', name: 'OPS Control', desc: 'kill switch · backups · telegram · mail', status: 'LIVE', h: 'ok' },
          { path: '/logs', name: 'Logs & Self-Repair', desc: 'JSONL logs · rotation · auto-heal ledger', status: 'LIVE', h: 'ok' },
          { path: '/containers', name: 'Module Containers', desc: 'crash isolation · circuit breaker · quarantine', status: 'LIVE', h: 'ok' },
          { path: '/config', name: 'Config', desc: 'global config · hot-reload · schema-validated', status: 'LIVE', h: 'ok' },
          { path: '/jarvis', name: 'J.A.R.V.I.S.', desc: 'real assistant over live data · voice output', status: 'LIVE', h: 'ok' },
          { path: '/schedule', name: 'Schedule', desc: 'who where when', status: 'LIVE', h: 'ok' },
          { path: '/terminal', name: 'Terminal', desc: 'sandboxed inbound shell', status: 'LIVE', h: 'ok' },
          { path: '/minibot', name: 'Mini-Bot Wizard', desc: 'BotFather setup help', status: 'LIVE', h: 'ok' },
          { path: '/arcade', name: 'Arcade', desc: 'mini games (side project)', status: 'LIVE', h: 'ok' },
          { path: '/downloads', name: 'Downloads', desc: 'ALL-TYPES catalogs', status: 'LIVE', h: 'ok' },
          { path: '/api/stream', name: 'SSE Stream', desc: 'minion live stream', status: 'LIVE', h: 'ok' },
        ],
        services: registry.status().filter((m) => m.mode === 'live'),
        charts: {
          audit_by_area: Object.entries(byArea).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => ({ k, v })),
          learning: curve.length ? curve : [1, 1],
          modes: [{ k: 'live', v: c.live }, { k: 'skill', v: c.skills }, { k: 'placeholder', v: c.placeholder }, { k: 'review', v: c.review }, { k: 'restricted', v: c.restricted }],
        },
        feed: store.auditLog().slice(0, 12),
      }, null, 2));
    }

    if (p === '/api/report') return send(res, 200, 'application/json', JSON.stringify(dailyReport(), null, 2));
    if (p === '/console') return send(res, 200, 'text/html; charset=utf-8', consolePageHtml());
    if (p === '/api/integrations') return send(res, 200, 'application/json', JSON.stringify(integrations, null, 2));
    if (p === '/api/modules') return send(res, 200, 'application/json', JSON.stringify(modules, null, 2));
    if (p === '/api/types') return send(res, 200, 'application/json', JSON.stringify(buildTypesCatalog(), null, 2));
    if (p === '/api/downloads') {
      return send(res, 200, 'application/json', JSON.stringify({
        artifacts: Object.keys(ARTIFACTS).map((n) => ({ name: n, url: '/api/download/' + n })),
        page: '/downloads',
      }, null, 2));
    }
    if (p.startsWith('/api/download/')) {
      const name = p.slice('/api/download/'.length);
      const art = ARTIFACTS[name];
      if (!art) return send(res, 404, 'application/json', JSON.stringify({ error: 'Unknown artifact. See /api/downloads' }));
      const body = art.render(buildTypesCatalog());
      return send(res, 200, art.mime, body, {
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
      });
    }
    if (p === '/downloads') return send(res, 200, 'text/html; charset=utf-8', downloadPageHtml());
    if (p === '/') { res.writeHead(302, { Location: '/hub' }); return res.end(); }
    if (p.startsWith('/api/')) return send(res, 404, 'application/json', JSON.stringify({ error: 'Unknown endpoint' }));
    return serveStatic(req, res);
  } catch (e) {
    try { const lc = require('./src/lib/learning_core');
      const sig = 'http500:' + p + ':' + String(e && e.message || e).slice(0, 50);
      lc.recordFailure(sig, { method: req.method }); lc.reportOutcome(sig, true); } catch {}
    return send(res, 500, 'application/json', JSON.stringify({ error: String(e) }));
  } finally {
    console.log(`${req.method} ${p} ${Date.now() - started}ms`);
  }
});

server.listen(PORT, HOST, () => {
  require('./src/lib/autonomy_loop').start(); // self-healing loop + swarm strategy + learning curve
  ops.startScheduler(); // 12h super-brain autosave · 4h others · 24h full sync
  watcher.start(config.get('watcher.interval_ms', 1500)); // hot-reload data files w/ rollback on syntax error
  selfRepair.start(config.get('self_repair.interval_ms', 20000)); // area 66: massive logging + self-repair daemon
  console.log(`AURA backend listening on http://${HOST}:${PORT}`);
  console.log(`Frontend: / · Brain 2.0: /brain · Master HUD: /master · Console: /console · Downloads: /downloads`);
});
