'use strict';
// Module registry — all 40 functional areas from the AURA inventory.
// live        -> real implementation in src/lib (actions dispatchable)
// placeholder -> structure exists; implementation deferred (needs external systems)
// review      -> design-only stub; must pass safe redesign before any execution
// restricted  -> EXCLUDED by policy; every action is refused
const live = {
  '02': require('./role_registry'),
  '03': require('./cognitive_learning_core'),
  '04': require('./consensus_logic_core'),
  '05': require('./multi_response_controller'),
  '06': require('./openrouter_pinger_daemon'),
  '07': require('./metadata_shredder'),
  '16': require('./self_healing_logger'),
  '19': require('./catalog_ingestor'),
  '20': require('./mcp_ingestion_core'),
  '21': require('./news_algorithm_analyzer'),
  '22': require('./local_edge_cache'),
  '23': require('./swarm_sync_daemon'),
  '24': require('./chrono_backup_daemon'),
  '25': require('./synaptic_heartbeat_bridge'),
  '39': require('./algorithm_matrix'),
  '49': require('./autonomy_loop'),
  '58': require('./omniroute'),
  '59': require('./txt_watcher'),
  '60': require('./schedule'),
  '61': require('./workflow_builder'),
  '62': require('./research'),
  '63': require('./seo'),
  '64': require('./backup_vault'),
  '65': require('./traffic'),
  '66': require('./self_repair'),
  '67': require('./module_container'),
  '68': require('./config'),
  '69': require('./learning_core'),
};

const skills = require('./skills_registry');

const statics = [
  { area: '01', name: 'Bootstrap & container runtime', state: 'live', note: 'served by backend/server.js + deploy/docker-compose.yml' },
  { area: '08', name: 'Kids Story Pipeline', state: 'placeholder', note: 'UI exists; needs LLM adapter with child-safety review' },
  { area: '09', name: 'Kids Media / mimetic video pipeline', state: 'placeholder', note: 'plan only; needs image/TTS/video adapters + FFmpeg worker' },
  { area: '10', name: 'Content incubation engine', state: 'placeholder', note: 'needs lifecycle model + manual review' },
  { area: '11', name: 'Editorial incubation', state: 'placeholder', note: 'needs durable content model + sign-off flow' },
  { area: '12', name: 'Community incubation', state: 'placeholder', note: 'official APIs + human approval only; no synthetic engagement' },
  { area: '13', name: 'Omnichannel dispatcher', state: 'placeholder', note: 'needs platform adapters, consent, idempotency' },
  { area: '14', name: 'WordPress Gutenberg / REST', state: 'placeholder', note: 'needs dedicated account + duplicate-post protection' },
  { area: '15', name: 'n8n secure dispatch / Kaggle relay', state: 'placeholder', note: 'needs HMAC, TTL, allowlist, opt-in compute policy' },
  { area: '17', name: 'Daily report daemon', state: 'placeholder', note: 'on-demand reports via /api/report; scheduler off by default' },
  { area: '18', name: 'GitHub / NotebookLM knowledge sync', state: 'placeholder', note: 'GitHub as source link only; NotebookLM manual' },
  { area: '26', name: 'Master hardware router', state: 'placeholder', note: 'no hardware in sandbox' },
  { area: '27', name: 'Intranet compute router', state: 'placeholder', note: 'no intranet in sandbox' },
  { area: '28', name: 'Cloud environment connector', state: 'placeholder', note: 'no cloud credentials; explicit opt-in required' },
  { area: '29', name: 'Sandbox mesh engine', state: 'placeholder', note: 'needs sandbox orchestration layer' },
  { area: '30', name: 'Streaming telemetry / remote workers', state: 'placeholder', note: 'simulation only until authorized source exists' },
  { area: '31', name: 'OmniRoute financial engine', state: 'review', note: 'financial logic requires redesign + compliance review before use' },
  { area: '32', name: 'Crypto faucet engines / brokers', state: 'restricted', note: 'excluded by policy' },
  { area: '33', name: 'Mining / unMineable control', state: 'restricted', note: 'excluded by policy: no third-party compute use without explicit permission' },
  { area: '34', name: 'Proxy / gateway health monitor', state: 'review', note: 'evasion-adjacent; requires redesign and lawful scoping' },
  { area: '35', name: 'Shadow-ban sentinel', state: 'review', note: 'platform-detection heuristics need redesign; official APIs only' },
  { area: '36', name: 'CAPTCHA learning / bypass hub', state: 'restricted', note: 'excluded: bypassing platform protection is prohibited' },
  { area: '37', name: 'Visual agent eyes / MCP Vision', state: 'review', note: 'needs consent + data-protection review for screenshot processing' },
  { area: '38', name: 'Identity vault / inbox orchestration', state: 'review', note: 'no credentials stored anywhere; redesign around a real secret manager' },
  { area: '40', name: 'Variance lifecycle / swarm evolution', state: 'placeholder', note: 'needs governance model before autonomous variance' },
];

function status() {
  const out = [];
  for (const m of Object.values(live)) out.push({ area: m.meta.area, name: m.meta.name, state: m.meta.state, mode: 'live', actions: m.actions ? Object.keys(m.actions) : [] });
  for (const s of statics) out.push({ ...s, mode: s.state, actions: [] });
  for (const k of skills.skills()) out.push({ area: k.area, name: k.name, state: 'skill', mode: 'skill', actions: [], note: `repo: ${k.repo} · hooks ${k.workflow_hook}` });
  return out.sort((a, b) => a.area.localeCompare(b.area));
}

function get(area) {
  if (live[area]) return { kind: 'live', mod: live[area] };
  const k = skills.get(area);
  if (k) return { kind: 'skill', entry: { area: k.area, name: k.name, note: `external skill — repo ${k.repo}; integration plan via /api/skills` } };
  const s = statics.find((x) => x.area === area);
  return s ? { kind: s.state, entry: s } : null;
}

module.exports = {
  status, get, live, skills,
  counts() {
    const s = status();
    return {
      total: s.length,
      live: s.filter((m) => m.mode === 'live').length,
      skills: s.filter((m) => m.mode === 'skill').length,
      placeholder: s.filter((m) => m.mode === 'placeholder').length,
      review: s.filter((m) => m.mode === 'review').length,
      restricted: s.filter((m) => m.mode === 'restricted').length,
    };
  },
};
