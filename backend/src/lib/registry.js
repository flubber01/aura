'use strict';
// Module registry — all 40 functional areas from the AURA inventory.
// live        -> real implementation in src/lib (actions dispatchable)
// placeholder -> structure exists; implementation deferred (needs external systems)
// review      -> design-only stub; must pass safe redesign before any execution
// restricted  -> EXCLUDED by policy; every action is refused
const live = {
  '02': require('./role_registry'),
  '08': require('./kids_story'),
  '17': require('./report_daemon'),
  '03': require('./cognitive_learning_core'),
  '04': require('./consensus_logic_core'),
  '05': require('./multi_response_controller'),
  '06': require('./openrouter_pinger_daemon'),
  '07': require('./metadata_shredder'),
  '09': require('./media_pipeline'),
  '10': require('./content_incubator'),
  '11': require('./editorial_incubator'),
  '12': require('./community_incubator'),
  '13': require('./omnichannel_dispatcher'),
  '14': require('./wordpress_bridge'),
  '15': require('./n8n_bridge'),
  '16': require('./self_healing_logger'),
  '18': require('./knowledge_sync'),
  '19': require('./yellow_pages'),
  '20': require('./mcp_ingestion_core'),
  '21': require('./news_algorithm_analyzer'),
  '22': require('./local_edge_cache'),
  '23': require('./swarm_sync_daemon'),
  '24': require('./chrono_backup_daemon'),
  '25': require('./synaptic_heartbeat_bridge'),
  '26': require('./hardware_router'),
  '27': require('./compute_router'),
  '28': require('./cloud_connector'),
  '29': require('./mesh_engine'),
  '30': require('./telemetry_stream'),
  '31': require('./finance_engine'),
  '34': require('./gateway_health'),
  '35': require('./delivery_monitor'),
  '37': require('./vision_bridge'),
  '38': require('./vault'),
  '39': require('./algorithm_matrix'),
  '40': require('./variance_lifecycle'),
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
  '70': require('./module_system'),
  '71': require('./image_gen'),
  '72': require('./mcp_manager'),
  '73': require('./content_forge'),
  '74': require('./service_fabric'),
  '75': require('./routine_control'),
  '76': require('./studio'),
  '77': require('./test_lab'),
  '78': require('./telegram_agent'),
  '79': require('./ollama_manager'),
  '80': require('./brain_mapper'),
  '81': require('./control_tower'),
  '82': require('./crosslink_policy'),
  '83': require('./function_registry'),
  '84': require('./agent_intercom'),
  '85': require('./harness_kit'),
  '86': require('./sentinel'),
  '87': require('./content_command'),
  '88': require('./aura_heart'),
  '89': require('./creator_desk'),
  '90': require('./label_desk'),
  '91': require('./media_newsroom'),
  '92': require('./social_control'),
  '93': require('./growth_nexus'),
  '94': require('./capability_radar'),
  '95': require('./aura_os'),
  '96': require('./aura_os_plus'),
  '97': require('./creator_continuity'),
  '98': require('./remote_approval'),
  '99': require('./creator_collaboration'),
  '100': require('./creator_revenue'),
  '101': require('./creator_passport'),
  '102': require('./studio_command'),
};

const skills = require('./skills_registry');

// Task 20: Areas 09–15, 18, 26–31, 34/35, 37/38, 40 wurden zu echten
// Live-Modulen ausgebaut (siehe requires oben). Hier bleiben nur Bootstrap
// und die DAUERHAFT ausgeschlossenen Bereiche.
const statics = [
  { area: '01', name: 'Bootstrap & container runtime', state: 'live', note: 'served by backend/server.js + deploy/docker-compose.yml' },
  { area: '32', name: 'Crypto faucet engines / brokers', state: 'restricted', note: 'excluded by policy' },
  { area: '33', name: 'Mining / unMineable control', state: 'restricted', note: 'excluded by policy: no third-party compute use without explicit permission' },
  { area: '36', name: 'CAPTCHA learning / bypass hub', state: 'restricted', note: 'excluded: bypassing platform protection is prohibited' },
];

function status() {
  const out = [];
  for (const m of Object.values(live)) out.push({ area: m.meta.area, name: m.meta.name, state: m.meta.state, mode: 'live', actions: m.actions ? Object.keys(m.actions) : [] });
  for (const s of statics) out.push({ ...s, mode: s.state, actions: [] });
  for (const k of skills.skills()) out.push({ area: k.area, name: k.name, state: 'skill', mode: 'skill', actions: [], note: `repo: ${k.repo} · hooks ${k.workflow_hook}` });
  // Erweiterungsmodule aus backend/modules (Manifest, Freigabe, Lebenszyklus). Ergänzung, keine Ersetzung.
  for (const e of require('./module_loader').registryEntries()) out.push(e);
  // Area 70 bridge: external manifest-based modules appear in the SAME
  // unified registry view (mode 'pkg') — no parallel registration system.
  try { for (const e of live['70'].registryEntries()) out.push(e); } catch {}
  return out.sort((a, b) => a.area.localeCompare(b.area));
}

function get(area) {
  if (live[area]) return { kind: 'live', mod: live[area] };
  // Area 70 bridge: resolve external package modules by "pkg:<id>"
  if (String(area).startsWith('pkg:')) {
    try {
      const ms = live['70'];
      const st = ms.moduleStatus(String(area).slice(4));
      if (st) return { kind: 'pkg', mod: { meta: { area: area, name: st.name, state: st.status }, pkg: st, actions: null } };
    } catch {}
    return null;
  }
  const k = skills.get(area);
  if (k) return { kind: 'skill', entry: { area: k.area, name: k.name, note: `external skill — repo ${k.repo}; integration plan via /api/skills` } };
  const ext = require('./module_loader').registryEntries().find((x) => x.area === area);
  if (ext) return { kind: 'module', entry: ext };
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
      module: s.filter((m) => m.mode === 'module').length,
    };
  },
};
