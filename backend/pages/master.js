'use strict';
// AURA — Master Control HUD page + data (previously inline in server.js).
const registry = require('../src/lib/registry');
const store = require('../src/lib/store');
const { brainData } = require('./brain');


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
</script></body></html>`;
}
module.exports = masterPageHtml;
module.exports.masterData = masterData;
