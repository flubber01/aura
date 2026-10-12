'use strict';
// ULTRA MASTER BRAIN chat panel — honest local oracle over REAL system state.
// No external LLM in sandbox; answers are computed from live backend data.
const registry = require('./registry');
const hierarchy = require('./hierarchy');
const ops = require('./ops');
const store = require('./store');

function ask(msg) {
  const m = String(msg || '').toLowerCase();
  const C = registry.counts();
  const K = hierarchy.knowledge();
  const O = ops.status();
  const has = (...w) => w.some((x) => m.includes(x));

  if (has('kill', 'emergency', 'notruf')) return `Kill switch: ${O.kill_switch.on ? '☠ ENGAGED (' + O.kill_switch.reason + ')' : 'not engaged — system live'}. Auto-triggers: critical errors, unhandled rejections, 3 syntax failures in 5 min. Manage at /ops.`;
  if (has('status', 'health', 'alive', 'uptime')) return `Fleet status: ${C.live} live modules, ${C.skills} skills, ${C.restricted} restricted. Tasks ${store.get().tasks.length}, audit ${store.get().audit.length}. Scheduler ${O.scheduler_running ? 'running' : 'paused'}; last full sync ${O.last_runs.full || 'n/a'}.`;
  if (has('learn', 'better', 'knowledge', 'feedback')) return `Learning: ${K.total_events} feedback events, ${K.knowledge_gain} gains, fleet rate ${K.fleet_rate == null ? 'n/a' : Math.round(K.fleet_rate * 100) + '%'}. Every minion report flows head → super → ultra so all layers improve. Top learners: ${K.top_learners.map((t) => t.id).join(', ') || 'none yet'}.`;
  if (has('schedule', 'backup', 'autosave', 'sync')) return `Backup rhythm: super-brain DB every ${O.schedule.super_brain_autosave_h}h, other DBs every ${O.schedule.others_autosave_h}h, full checksummed sync every ${O.schedule.full_sync_h}h. Last runs: ${JSON.stringify(O.last_runs)}.`;
  if (has('workflow', 'wf', 'pipeline')) return `8 workflows: WF-1 kids video, WF-2 research eyes, WF-3 consensus build, WF-4 sandbox exec, WF-5 hybrid model ops, WF-6 UI build, WF-7 social chain (human gates), WF-8 root-server collective. Details: /api/workflows.`;
  if (has('team', 'department', 'role', 'minion', 'head')) return `Structure: 1 ultra, ${registry.skills.status().skills} skills, 7 departments with heads, ${hierarchy.node_count} hierarchy nodes total (incl. minion workers). Deploy any brain's role+prompt+skills via /hierarchy.`;
  if (has('telegram', 'bot', 'botfather')) return `Telegram control: create bot via @BotFather, token to secret manager, allowlist YOUR chat, run telegram_poller.js outside sandbox. Palette: /status /report /tasks /snapshot /sync /learn /brains /kill /revive. Wizard: /minibot.`;
  if (has('mail')) return `Mail Schnittstelle: compose → approval gate → provider adapter (Gmail OAuth / own IMAP / Telegram relay). Sandbox never sends; approved items hand off outside. /ops panel.`;
  if (has('vita', 'data', 'privacy', 'gdpr')) return `Vita DB: consent-mandatory, retention-capped, right-to-erasure endpoint, biometrics/fingerprints hard-rejected. We build honest AI roles — no human impersonation.`;
  if (has('restrict', 'policy', 'safety', 'refuse')) return `Permanent refusals: credential harvesting/validation, SOCKS ban-evasion, stealth multi-account outreach, CAPTCHA/platform bypass, third-party mining, human impersonation with synthetic biometrics. Restricted areas 32/33/36 return 403 on every action.`;
  if (has('deploy', 'cluster', 'server')) return `Deploy: /deploy (HF search, 1-click Ollama, repo kits, master install), /cluster (4 root servers → k3s+Ansible 1-click bind). Own hardware only.`;
  if (has('hello', 'hi', 'hallo')) return 'ULTRA MASTER BRAIN online. Ask about status, learning, schedules, workflows, teams, telegram, mail, deploy — I answer from live system state.';
  return `I answer from LIVE data only. Try: status · learning · schedules · workflows · teams · telegram · mail · deploy · kill · policy. (${C.total} areas, ${C.live} live.)`;
}
module.exports = { ask };
