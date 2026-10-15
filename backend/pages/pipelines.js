'use strict';
// Pipelines: multi-pipeline fast setup + social connection chain with specialists.
module.exports = function pipelinesPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Pipelines</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:22px;text-align:center}h1{margin:0;font-size:22px;letter-spacing:2px;color:#39d7ff}
.sub{color:#7d94ad;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:#39d7ff;text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px 50px}
h2{font-size:13px;letter-spacing:2px;color:#f5c96b;margin:28px 0 12px}
.pipes{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
.pipe{background:#0b1526;border:1px solid #1e3a8a;border-radius:14px;padding:14px;position:relative;overflow:hidden}
.pipe::after{content:'';position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(57,215,255,.12),transparent);animation:sh 4s infinite}
@keyframes sh{to{left:130%}}
.pipe h3{margin:0 0 6px;color:#39d7ff;font-size:14px}
.chain{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:8px 0}
.step{background:#132c44;border-radius:8px;padding:3px 9px;font-size:11px;color:#cfe3f7;animation:pop .4s backwards}
.step:nth-child(2){animation-delay:.06s}.step:nth-child(3){animation-delay:.12s}.step:nth-child(4){animation-delay:.18s}.step:nth-child(5){animation-delay:.24s}.step:nth-child(6){animation-delay:.3s}
@keyframes pop{from{opacity:0;transform:scale(.7)}to{opacity:1}}
.arr{color:#f5a53c}
.gates{font-size:10.5px;color:#4ade80;margin:6px 0}
button.copy{background:#f5c96b;border:0;color:#0a0c12;border-radius:8px;padding:7px 14px;font-size:11.5px;font-weight:800;cursor:pointer}
button.copy:hover{filter:brightness(1.1)}
pre{background:#071120;border:1px dashed #23405e;border-radius:8px;padding:10px;font-size:11px;overflow:auto;color:#cfe3f7}
.build{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:860px){.build{grid-template-columns:1fr}}
.panel{background:#0b1526;border:1px solid #1e3a8a;border-radius:14px;padding:14px}
label{font-size:11px;color:#7d94ad;display:block;margin:8px 0 4px}
select,input{width:100%;background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:8px;font-size:12.5px}
.chkp{display:flex;gap:8px;align-items:center;font-size:12px;margin:6px 0;color:#cfe3f7}
.team{border-left:3px solid var(--c);background:#0b1526;border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:10px}
.team h3{margin:0;font-size:14px}.team p{margin:4px 0;color:#a9bcd4;font-size:12px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.tag{font-size:10px;border-radius:10px;padding:1px 8px;background:#132c44;color:#8ab4ff}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/workflows">Workflow Control</a><a href="/skills">Skills</a><a href="/yellowpages">Yellow Pages</a><a href="/deploy">Deploy</a><a href="/cluster">Cluster</a></nav>
<header><h1>🚀 MULTI-PIPELINE MAP</h1><p class="sub">Versioned workflow definitions · each operational handoff requires explicit human approval</p></header>
<div class="wrap">
<h2>PIPELINES (skills × areas)</h2><div class="pipes" id="pipes"></div>
<h2>SOCIAL MEDIA CONNECTION CHAIN · SPECIALISTS</h2>
<div class="build">
 <div class="panel">
  <label>Platform (official API only)</label>
  <select id="plat"></select>
  <label>Content source pipeline</label>
  <select id="src"><option>WF-1 video package</option><option>WF-2 research brief</option><option>WF-6 UI announcement</option></select>
  <label>Specialist (drafts)</label><select id="spec"></select>
  <label>Specialist (review & publish)</label><select id="rev"></select>
  <div class="chkp"><input type="checkbox" id="g1" checked style="width:auto"> Human approval before every publish</div>
  <div class="chkp"><input type="checkbox" id="g2" checked style="width:auto"> Platform rate-limits & ToS enforced</div>
  <div class="chkp"><input type="checkbox" id="g3" checked style="width:auto"> No synthetic engagement / no account farms</div>
  <button class="copy" id="genchain">⚙ Generate chain config</button>
 </div>
 <div class="panel"><pre id="chainout">configure left → generate</pre><button class="copy" id="copychain">⧉ Copy</button>
 <p style="font-size:11px;color:#7d94ad">Config is audited server-side (POST /api/socialchain). Adapters must use official APIs; keys live in a secret store, never in this page.</p></div>
</div>
<h2>TEAMS (cross-department squads)</h2><div id="teams"></div>
<h2>CUSTOM WORKFLOWS (aus dem Builder · Area 61)</h2><div id="custom"></div>
<p style="font-size:11px;color:#7d94ad;margin-top:8px">Eigene Ketten bauen: <a href="/builder" style="color:#39d7ff">→ Workflow Builder</a> · Rollen aus 63 Identitäten · Gates: Approvals, Integritäts-Audit, Human Sign-off.</p>
</div>
<script>
const SETUP={
 'WF-1':['Create a local content brief and child-safety/originality checklist.','Record a human distribution decision in Workflow Control.'],
 'WF-2':['Record allowed sources, terms and freshness window.','Keep research output as a reviewed local brief.'],
 'WF-3':['Document consensus inputs and escalation threshold.','Record the human resolution as evidence.'],
 'WF-4':['Define the sandbox, explicit grants and rollback plan.','Do not execute tools from this pipeline map.'],
 'WF-5':['Document local/cloud data boundary and approved secret-manager handoff.','No model or provider connection is created here.'],
 'WF-6':['Create UI acceptance and accessibility evidence.','Hand off release work only after a human quality gate.'],
 'WF-7':['Use the Social Control approval path and official-provider review.','No publish action is initiated from this page.'],
 'WF-8':['Open /cluster and produce a local infrastructure handoff manifest.','No SSH, provisioning, clustering or host action occurs in AURA.'],
 'WF-9':['Document the local image-generation brief and rights boundary.','Only connected local evidence can substantiate a render.'],
 'WF-10':['Create an AUTO-DRAFT plan and review checkpoints.','Human approval remains mandatory before any official-channel action.'],
 'WF-11':['Create Studio source and rights evidence.','Use Workflow Control to record a reviewed handoff.'],
 'WF-12':['Review allowlisted-chat policy and command confirmation gates.','Do not store chat credentials in the workflow record.'],
 'WF-13':['Record validation output, known limitations and a rollback note.','Use the Release Candidate quality gate for a decision record.'],
 'WF-14':['Create a Video Production Control run in /workflows.','Record rights, script and a human publish decision.'],
 'WF-15':['Create a Self-hosted Service Intake run in /workflows.','Use a manual owner-approved handoff; no deployment occurs here.'],
 'WF-16':['Create a Local Model and RAG Evaluation run in /workflows.','Keep model and data decisions local and evidence-based.'],
 'WF-17':['Create an API and Connector Onboarding run in /workflows.','Keep keys in a separate secret manager and record a revoke plan.'],
 'WF-18':['Create a Backup and Restore Drill run in /workflows.','Verify archive checksum and record restore evidence in an isolated location.'],
 'WF-19':['Create a Security Incident Triage run in /workflows.','Record evidence references and a human-approved response handoff only.'],
 'WF-20':['Create a Release Candidate Quality Gate run in /workflows.','Attach test/archive evidence; release execution is a separate operator action.'],
 'WF-21':['Create an Asset Rights and Media Intake run in /workflows.','Keep unclear-rights assets restricted until human review.']
};
async function load(){
 const [wf,roles,teams]=await Promise.all([
  fetch('/api/workflows').then(r=>r.json()),fetch('/api/roles').then(r=>r.json()),fetch('/api/teams').then(r=>r.json())]);
 document.getElementById('pipes').innerHTML=wf.map(w=>'<div class="pipe"><h3>'+w.id+' · '+w.name+'</h3>'+
  '<div class="chain">'+w.chain.map(c=>'<span class="step">'+c+'</span>').join('<span class="arr">→</span>')+'</div>'+
  '<div class="gates">🛡 '+w.gates.join(' · ')+'</div>'+
  '<button class="copy" data-wf="'+w.id+'">view safe handoff</button><pre id="pre-'+w.id+'" hidden>'+((SETUP[w.id]||['Review this versioned definition in /workflows.','No external action is performed by this page.']).join('\\n'))+'</pre></div>').join('');
 document.querySelectorAll('[data-wf]').forEach(b=>b.onclick=()=>{const p=document.getElementById('pre-'+b.dataset.wf);p.hidden=!p.hidden;});
 const plats=[['Bluesky','https://docs.bsky.app'],['Mastodon','https://docs.joinmastodon.org/api/'],['Telegram Bot','https://core.telegram.org/bots/api'],['YouTube','https://developers.google.com/youtube'],['WordPress','https://developer.wordpress.org/rest-api/'],['GitHub Releases','https://docs.github.com']];
 document.getElementById('plat').innerHTML=plats.map(p=>'<option value="'+p[0]+'">'+p[0]+'</option>').join('');
 document.getElementById('spec').innerHTML=roles.filter(r=>['editor','story_architect','product_designer','researcher','analyst'].includes(r.id)).map(r=>'<option value="'+r.id+'">'+r.title+' ('+r.department_name+')</option>').join('');
 document.getElementById('rev').innerHTML=roles.filter(r=>['reviewer','privacy_officer','editor'].includes(r.id)).map(r=>'<option value="'+r.id+'">'+r.title+' ('+r.department_name+')</option>').join('');
 document.getElementById('teams').innerHTML=teams.map(t=>'<div class="team" style="--c:'+t.color+'"><h3>'+t.name+'</h3><p>'+t.mission+'</p><div class="tags">'+
  t.roles.map(r=>'<span class="tag">👤 '+r+'</span>').join('')+t.skills.map(s=>'<span class="tag">🧰 '+s+'</span>').join('')+
  t.workflows.map(w=>'<span class="tag">⟳ '+w+'</span>').join('')+t.areas.map(a=>'<span class="tag">#'+a+'</span>').join('')+'</div></div>').join('');
 const bw=await fetch('/api/builder/workflows').then(r=>r.json());
 const cus=bw.custom||[];
 document.getElementById('custom').innerHTML=cus.length?cus.map(w=>'<div class="pipe"><h3>'+w.id+' · '+w.name+'</h3>'+
  '<div class="chain">'+w.steps.map(s=>'<span class="step">'+s.role+'</span>').join('<span class="arr">→</span>')+'</div>'+
  '<div class="gates">🛡 approvals≥'+w.gates.minApprovals+(w.gates.integrityAudit?' · integrity':'')+(w.gates.humanSignoff?' · human sign-off':'')+(w.gates.dataPrivate?' · data-private (local lane)':'')+' · runs: '+w.runs+'</div>'+
  '<button class="copy" data-sim="'+w.id+'">▶ simulate</button><pre id="sim-'+w.id+'" hidden></pre></div>').join(''):
  '<div class="pipe"><p style="color:#7d94ad">Noch keine eigenen Workflows — im <a href="/builder" style="color:#39d7ff">Builder</a> anlegen.</p></div>';
 document.querySelectorAll('[data-sim]').forEach(b=>b.onclick=async()=>{
  const p=document.getElementById('sim-'+b.dataset.sim);p.hidden=false;
  p.textContent='simuliere…';
  const r=await fetch('/api/builder/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.sim})}).then(x=>x.json());
  p.textContent=JSON.stringify(r,null,2);});
}
document.getElementById('genchain').onclick=async()=>{
 const cfg={platform:document.getElementById('plat').value,source:document.getElementById('src').value,
  specialists:{drafts:document.getElementById('spec').value,review_publish:document.getElementById('rev').value},
  gates:{human_approval:document.getElementById('g1').checked,rate_limits_tos:document.getElementById('g2').checked,no_synthetic_engagement:document.getElementById('g3').checked},
  adapter:'official API SDK',secrets:'secret store'};
 const out=document.getElementById('chainout');
 if(!cfg.gates.human_approval||!cfg.gates.no_synthetic_engagement){out.textContent='⛔ REFUSED: human approval + no synthetic engagement are mandatory gates.';return;}
 await fetch('/api/socialchain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
 out.textContent=JSON.stringify(cfg,null,2);
};
document.getElementById('copychain').onclick=()=>navigator.clipboard.writeText(document.getElementById('chainout').textContent);
load();
</script></body></html>`;
};
