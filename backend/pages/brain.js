'use strict';
// AURA — Brain 2.0 page + data (previously inline in server.js).
const fs = require('fs');
const path = require('path');
const registry = require('../src/lib/registry');
const store = require('../src/lib/store');
const brain3dSnippet = require('./brain3d');


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
module.exports = brainPageHtml;
module.exports.brainData = brainData;
