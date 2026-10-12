'use strict';
// Brain hierarchy engine: tree build, deployable bundles, learning feedback,
// privacy-safe vita knowledge DB.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const H = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'hierarchy.json'), 'utf8'));
const DEPTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'departments.json'), 'utf8')).departments;
const FB_FILE = path.join(__dirname, '..', 'data', 'feedback.json');
const VITA_FILE = path.join(__dirname, '..', 'data', 'vita.json');

function loadJson(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } }
function saveJson(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 2)); fs.renameSync(t, f); }
let feedback = loadJson(FB_FILE, {});
let vita = loadJson(VITA_FILE, []);

// ---------- tree ----------
function tree() {
  const nodes = [];
  const u = H.ultra;
  nodes.push({ ...u, parent: null, children: [...H.supers.map((s) => s.id), 'guard'] });
  for (const s of [...H.supers, H.gate]) {
    const heads = s.departments || [];
    nodes.push({ ...s, parent: 'ultra', children: heads.map((d) => 'head_' + d) });
  }
  for (const d of DEPTS) {
    nodes.push({ id: 'head_' + d.id, tier: 2, name: 'HEAD · ' + d.name, department: d.id, parent: superOf(d.id), children: d.roles.map((r) => 'minion_' + r.id),
      mission: 'Directs ' + d.name + ' minions; enforces department prompt + gates; reports outcomes upward.',
      prompt: d.prompt.replace('{role}', d.name + ' Department Head') + ' You delegate atomic tasks to your minion workers, verify their outputs, and send structured feedback to your SUPER MASTER BRAIN so the whole tree learns.',
      skills: [] });
    for (const r of d.roles) {
      nodes.push({ id: 'minion_' + r.id, tier: 3, name: 'MINION · ' + r.title, department: d.id, role: r.id, parent: 'head_' + d.id, children: [],
        mission: r.title + ' execution worker (atomic tasks, honest AI identity).',
        prompt: d.prompt.replace('{role}', r.title) + ' Report every outcome (success/failure + evidence) to your department head; that feedback improves the whole brain tree. Disclose that you are an AI wherever humans interact with your output.',
        skills: [] });
    }
  }
  return nodes;
}
function superOf(deptId) {
  for (const s of H.supers) if ((s.departments || []).includes(deptId)) return s.id;
  return 'ultra';
}
const NODES = tree();
const get = (id) => NODES.find((n) => n.id === id);

// ---------- deployable bundles ----------
const TIERS = {
  0: 'TIER-0 ULTRA: strategy + consensus + policy. ',
  1: 'TIER-1 SUPER: supervise department heads, aggregate learning, coordinate side-server failover. ',
  2: 'TIER-2 HEAD: manage minions, verify outputs, enforce gates, report upward. ',
  3: 'TIER-3 MINION: execute one atomic task, report structured outcomes. ',
};
function bundle(id) {
  const n = get(id);
  if (!n) return null;
  const superSkills = (H.supers.find((s) => s.id === id) || H.gate || {}).skills || [];
  const skills = n.skills || superSkills;
  const system_prompt =
    'AURA BRAIN HIERARCHY — honest AI identity; no human impersonation; no synthetic biometrics; human gates on outbound actions.\n' +
    TIERS[n.tier] + (n.prompt || n.mission || '') +
    (n.department ? '\nDepartment areas: ' + (DEPTS.find((d) => d.id === n.department) || {}).areas?.join(', ') : '');
  const skill_md = '---\nname: aura-' + n.id + '\ndescription: ' + (n.name || n.id) + ' (AURA hierarchy ' + n.tier + ')\n---\n\n' + system_prompt + '\n\n## Skills\n' + (skills.map((s) => '- ' + s).join('\n') || '- (none)') + '\n';
  return {
    id: n.id, tier: n.tier, name: n.name, parent: n.parent, children: n.children,
    system_prompt, skills,
    env_template: 'AURA_URL=http://localhost:8080\n# secrets ONLY via secret manager:\n# OPENROUTER_API_KEY=...\n# HINDSIGHT_API_KEY=...',
    mcp_bridge: 'node backend/src/lib/mcp_bridge.js ' + String((DEPTS.find((d) => d.id === n.department) || {}).areas?.[0] || '03'),
    deploy_targets: {
      claude_project: 'Paste system_prompt into Project instructions; attach skill.md.',
      openai_gpt: 'Paste system_prompt into Custom Instructions / assistant setup.',
      api: 'Send system_prompt as `system` message; tools via mcp_bridge.',
      any_agent: 'Drop skill.md into the harness skill folder (Claude Code, Cursor, OpenClaw...).',
    },
    skill_md,
  };
}

// ---------- learning feedback ----------
function recordFeedback(id, body) {
  const n = get(id);
  if (!n) return null;
  const ok = body.outcome === 'success';
  const e = feedback[id] || { success: 0, failure: 0, notes: [] };
  e[ok ? 'success' : 'failure']++;
  e.notes = [...(e.notes || []), { at: new Date().toISOString(), outcome: body.outcome, note: String(body.note || '').slice(0, 200) }].slice(-20);
  feedback[id] = e;
  saveJson(FB_FILE, feedback);
  // knowledge flows UP: parent also gains
  if (n.parent && feedback[n.parent]) { /* counters stay per-node; aggregation computed in stats */ }
  return stats(id);
}
function stats(id) {
  const e = feedback[id] || { success: 0, failure: 0 };
  const total = e.success + e.failure;
  return { id, success: e.success, failure: e.failure, total, rate: total ? Number((e.success / total).toFixed(2)) : null, recent: (e.notes || []).slice(-5) };
}
function knowledge() {
  const per = NODES.map((n) => stats(n.id)).filter((s) => s.total > 0);
  const tot = per.reduce((a, s) => a + s.total, 0);
  const gain = per.reduce((a, s) => a + s.success, 0);
  return { nodes_with_feedback: per.length, total_events: tot, knowledge_gain: gain, fleet_rate: tot ? Number((gain / tot).toFixed(2)) : null, top_learners: per.sort((a, b) => (b.rate || 0) - (a.rate || 0)).slice(0, 6) };
}

// ---------- vita knowledge DB (privacy-by-design) ----------
const FORBIDDEN = /finger|biometr|face[_-]?id|voiceprint|iris|dna|passport|ssn|health|religion|orientation/i;
function vitaAdd(body) {
  if (body.consent !== true) throw Object.assign(new Error('explicit consent is mandatory (GDPR Art. 6/7); entry refused'), { code: 403 });
  const data = body.data || {};
  const bad = Object.keys(data).filter((k) => FORBIDDEN.test(k));
  if (bad.length) throw Object.assign(new Error('special-category/biometric fields refused: ' + bad.join(', ') + ' — no fingerprints, ever'), { code: 403 });
  const rec = { id: crypto.randomUUID(), owner_label: String(body.owner_label || 'anonymous'), purpose: String(body.purpose || 'knowledge base'), data, retention_days: Math.min(Number(body.retention_days) || 365, 730), created_at: new Date().toISOString(), consent: true };
  vita.push(rec);
  saveJson(VITA_FILE, vita);
  return rec;
}
function vitaList() { return vita.map(({ data, ...m }) => ({ ...m, fields: Object.keys(data) })); }
function vitaDelete(id) { const before = vita.length; vita = vita.filter((v) => v.id !== id); saveJson(VITA_FILE, vita); return { deleted: before - vita.length }; }

module.exports = { tree, get, bundle, recordFeedback, stats, knowledge, vitaAdd, vitaList, vitaDelete, node_count: NODES.length };
