'use strict';
// ALL-TYPES catalog + downloadable artifact renderers (previously inline in server.js).
const fs = require('fs');
const path = require('path');
const { modules, integrations, teams, yellowpages } = require('./datasets');
const registry = require('./registry');
const hierarchy = require('./hierarchy');
const ops = require('./ops');

const ROOT = path.join(__dirname, '..', '..', '..');

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
module.exports = { STATE_TYPES, INTEGRATION_STATUS_TYPES, buildTypesCatalog, esc, renderTxt, renderMd, renderCsv, ARTIFACTS };
