'use strict';
// Ultra -> Super -> Heads -> Minions: tree, deploy bundles, learning, vita DB.
module.exports = function hierarchyPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Brain Hierarchy</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:20px;text-align:center}h1{margin:0;font-size:22px;letter-spacing:2px;color:#c084fc}
.sub{color:#7d94ad;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:#c084fc;text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid #3b2a5e;border-radius:8px;padding:5px 10px}
.wrap{max-width:1250px;margin:0 auto;padding:0 16px 60px}
.cols{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
@media(max-width:980px){.cols{grid-template-columns:1fr 1fr}}
.col h3{text-align:center;font-size:11px;letter-spacing:2px;color:#7d94ad;margin:8px 0}
.node{background:#0b1526;border:1px solid #23304a;border-radius:10px;padding:8px 10px;margin:8px 0;cursor:pointer;font-size:12px;transition:.15s;position:relative;animation:in .5s backwards}
.node:hover{border-color:#c084fc;transform:translateX(3px)}
.node.on{border-color:#c084fc;box-shadow:0 0 14px rgba(192,132,252,.35)}
.node small{display:block;color:#7d94ad;font-size:10px}
.t0 .node{border-color:#f5c96b;background:linear-gradient(160deg,#241a05,#120d02)}
.t1 .node{border-color:#39d7ff}.t2 .node{border-color:#4ade80}.t3 .node{border-color:#23304a}
@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1}}
.grid2{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-top:16px}
@media(max-width:980px){.grid2{grid-template-columns:1fr}}
.panel{background:#0b1526;border:1px solid #23304a;border-radius:14px;padding:14px}
.panel h3{margin:0 0 8px;font-size:13px;color:#c084fc;letter-spacing:1px}
pre{background:#071120;border:1px dashed #23405e;border-radius:8px;padding:10px;font-size:11px;overflow:auto;color:#cfe3f7;max-height:340px}
button{background:#3b2a5e;color:#fff;border:1px solid #6d4bb0;border-radius:8px;padding:7px 12px;font-size:11.5px;font-weight:700;cursor:pointer;margin:3px}
button.gold{background:#f5c96b;color:#0a0c12;border:0}
.know{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}
.kb{background:#120d20;border:1px solid #3b2a5e;border-radius:10px;padding:8px 14px;text-align:center}
.kb b{display:block;font-size:18px;color:#c084fc}.kb span{font-size:10px;color:#7d94ad}
input,select{background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:7px;font-size:12px}
.lbl{font-size:10.5px;color:#7d94ad;display:block;margin:6px 0 3px}
.warn{color:#f87171;font-size:11px}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/skills">Skills</a><a href="/deploy">Deploy</a><a href="/cluster">Cluster</a></nav>
<header><h1>🌌 ULTRA → SUPER → HEADS → MINIONS</h1>
<p class="sub">select any brain → deploy its role/prompt/skills to ANY AI · feedback flows up so every layer learns · honest AI identities only</p></header>
<div class="wrap">
<div class="know" id="know"></div>
<div class="cols" id="cols"></div>
<div class="grid2">
 <div class="panel"><h3 id="btitle">DEPLOY BUNDLE</h3>
  <button data-tab="prompt">system prompt</button><button data-tab="md">skill.md</button><button data-tab="json">full JSON</button><button data-tab="targets">1-click targets</button>
  <button class="gold" id="copyb">⧉ copy</button><button id="dlb">⇩ skill.md</button>
  <pre id="bout">select a brain node above ↑</pre>
  <div><button id="fbok">✓ report success</button><button id="fbno">✗ report failure</button><span id="fbstat" style="font-size:11px;color:#7d94ad"></span></div>
 </div>
 <div class="panel"><h3>🗄 VITA KNOWLEDGE DB (consent-only, no biometrics)</h3>
  <span class="lbl">owner label</span><input id="vowner" placeholder="e.g. customer-123 (pseudonym)">
  <span class="lbl">purpose</span><input id="vpurpose" placeholder="support context">
  <span class="lbl">data JSON (no fingerprints/biometrics/health…)</span><input id="vdata" placeholder='{"plan":"pro","language":"de"}'>
  <label style="font-size:11px;display:flex;gap:6px;margin:8px 0"><input type="checkbox" id="vconsent" style="width:auto"> owner gave explicit consent (GDPR Art. 6/7)</label>
  <button class="gold" id="vadd">store vita</button><span class="warn" id="verr"></span>
  <pre id="vlist" style="max-height:220px"></pre>
 </div>
</div>
<div class="grid2" style="margin-top:14px">
 <div class="panel"><h3>💬 CHAT · ULTRA MASTER BRAIN (top brain)</h3>
  <pre id="chat" style="max-height:240px">ULTRA: online. Ask me anything about the fleet — I answer from live data.</pre>
  <input id="cin" placeholder="status · learning · schedules · policy · workflows …" style="width:100%">
  <button id="csend">send ⏎</button>
 </div>
 <div class="panel"><h3>📡 MINION LIVE STREAM</h3><pre id="stream" style="max-height:280px">connecting…</pre></div>
</div>
</div>
<script>
let CUR=null,TAB='prompt',TREE=[];
async function load(){
 TREE=await (await fetch('/api/hierarchy')).json();
 const tiers=[0,1,2,3],names=['T0 · ULTRA','T1 · SUPER + SIDES','T2 · DEPARTMENT HEADS','T3 · MINION WORKERS'];
 document.getElementById('cols').innerHTML=tiers.map((t,i)=>'<div class="col t'+t+'"><h3>'+names[i]+'</h3>'+
  TREE.filter(n=>n.tier===t).map(n=>'<div class="node" data-id="'+n.id+'" style="animation-delay:'+(Math.random()*.4)+'s"><b>'+n.name+'</b><small>'+(n.domain||n.mission||'').slice(0,60)+'</small></div>').join('')+'</div>').join('');
 document.querySelectorAll('.node').forEach(el=>el.onclick=async()=>{
  document.querySelectorAll('.node').forEach(x=>x.classList.remove('on'));el.classList.add('on');
  CUR=el.dataset.id;await showBundle();
 });
 await know();await vlist();
}
async function know(){const k=await (await fetch('/api/hierarchy/knowledge')).json();
 document.getElementById('know').innerHTML=
 '<div class="kb"><b>'+k.total_events+'</b><span>feedback events</span></div><div class="kb"><b>'+k.knowledge_gain+'</b><span>knowledge gains</span></div><div class="kb"><b>'+(k.fleet_rate==null?'–':Math.round(k.fleet_rate*100)+'%')+'</b><span>fleet success</span></div><div class="kb"><b>'+k.nodes_with_feedback+'</b><span>learning brains</span></div>';}
async function showBundle(){
 const b=await (await fetch('/api/hierarchy/'+CUR+'/bundle')).json();
 document.getElementById('btitle').textContent='DEPLOY BUNDLE · '+b.name;
 renderB(b);
 const s=await (await fetch('/api/hierarchy/'+CUR+'/stats')).json();
 document.getElementById('fbstat').textContent=' · '+s.success+'✓ '+s.failure+'✗ rate '+(s.rate==null?'–':Math.round(s.rate*100)+'%');
}
function renderB(b){const o=document.getElementById('bout');
 o.textContent=TAB==='prompt'?b.system_prompt:TAB==='md'?b.skill_md:TAB==='json'?JSON.stringify(b,null,2):
 Object.entries(b.deploy_targets).map(([k,v])=>k+': '+v).join('\\n')+'\\n\\nenv:\\n'+b.env_template+'\\n\\nMCP: '+b.mcp_bridge;}
document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=async()=>{TAB=x.dataset.tab;renderB(await (await fetch('/api/hierarchy/'+CUR+'/bundle')).json());});
document.getElementById('copyb').onclick=()=>navigator.clipboard.writeText(document.getElementById('bout').textContent);
document.getElementById('dlb').onclick=async()=>{const b=await (await fetch('/api/hierarchy/'+CUR+'/bundle')).json();
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([b.skill_md],{type:'text/markdown'}));a.download='aura-'+CUR+'.md';a.click();};
async function fb(out){await fetch('/api/hierarchy/'+CUR+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({outcome:out,note:'via HUD'})});await showBundle();await know();}
document.getElementById('fbok').onclick=()=>fb('success');
document.getElementById('fbno').onclick=()=>fb('failure');
document.getElementById('vadd').onclick=async()=>{
 document.getElementById('verr').textContent='';
 let data={};try{data=JSON.parse(document.getElementById('vdata').value||'{}')}catch{document.getElementById('verr').textContent='invalid JSON';return;}
 const r=await fetch('/api/vita',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner_label:document.getElementById('vowner').value,purpose:document.getElementById('vpurpose').value,data,consent:document.getElementById('vconsent').checked})});
 const j=await r.json();if(!r.ok)document.getElementById('verr').textContent=j.error;else vlist();
};
async function vlist(){const v=await (await fetch('/api/vita')).json();
 document.getElementById('vlist').textContent=v.map(x=>x.id.slice(0,8)+' · '+x.owner_label+' · '+x.purpose+' · fields: '+x.fields.join(',')+' · retention '+x.retention_days+'d').join('\\n')||'(empty)';}
async function chatSend(){
 const cin=document.getElementById('cin');const m=cin.value.trim();if(!m)return;cin.value='';
 const c=document.getElementById('chat');c.textContent+='\nYOU: '+m;
 const j=await (await fetch('/api/ultra/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({msg:m})})).json();
 c.textContent+='\nULTRA: '+j.answer;c.scrollTop=c.scrollHeight;
}
document.getElementById('csend').onclick=chatSend;
document.getElementById('cin').onkeydown=e=>{if(e.key==='Enter')chatSend();};
const es=new EventSource('/api/stream');
es.onmessage=e=>{const s=document.getElementById('stream');const d=JSON.parse(e.data);
 s.textContent='['+(d.at||'').slice(11,19)+'] '+d.area+' · '+d.event+'\n'+s.textContent;
 s.textContent=s.textContent.split('\n').slice(0,40).join('\n');};
load();
</script></body></html>`;
};
