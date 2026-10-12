'use strict';
// AURA Skills Registry + Skill DB + Department/Prompt library.
// DB lives in backend/data/skills.json; departments in backend/data/departments.json.
// Adapters are config-driven and sandbox-safe: no outbound calls, no secrets in code.
const fs = require('fs');
const path = require('path');

const SKILLS_DB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'skills.json'), 'utf8'));
const DEPTS_DB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'departments.json'), 'utf8'));
const SKILLS = SKILLS_DB.skills;

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
    id: 'WF-8', name: 'Root-server collective bind',
    chain: ['/cluster enter 4 nodes', '1-click kit (k3s + ansible)', 'firewall hardening', 'AURA backend deployed fleet-wide', 'uptime-kuma + grafana observe'],
    gates: ['own/authorized hardware only', 'SSH-key-only', 'control plane never public'],
  },
];

function xrefs() {
  const map = {};
  for (const s of SKILLS) for (const c of s.crosslinks) map[c] = [...(map[c] || []), s.id];
  return map;
}

function departments() { return DEPTS_DB.departments; }
function roles() {
  return DEPTS_DB.departments.flatMap((d) => d.roles.map((r) => ({
    ...r, department: d.id, department_name: d.name, areas: d.areas,
    prompt: d.prompt.replace(/\{role\}/g, r.title) + (r.usecase ? ' Primary use case: ' + r.usecase + '.' : ''),
  })));
}
function promptFor(deptId, roleId) {
  const d = DEPTS_DB.departments.find((x) => x.id === deptId);
  if (!d) return null;
  const r = d.roles.find((x) => x.id === roleId) || d.roles[0];
  return { department: d.id, role: r.id, title: r.title, prompt: d.prompt.replace(/\{role\}/g, r.title) };
}

module.exports = {
  db_meta: () => ({ schema_version: SKILLS_DB.schema_version, note: SKILLS_DB.note }),
  skills: () => SKILLS,
  workflows: () => WORKFLOWS,
  xrefs,
  departments, roles, promptFor,
  get: (id) => SKILLS.find((s) => s.id === id || s.area === id) || null,
  totalStars: () => SKILLS.reduce((a, s) => a + (s.stars || 0), 0),
  status() {
    return {
      skills: SKILLS.length,
      workflows: WORKFLOWS.length,
      crosslinked_areas: Object.keys(xrefs()).length,
      departments: DEPTS_DB.departments.length,
      roles: roles().length,
      total_stars: module.exports.totalStars(),
    };
  },
};
