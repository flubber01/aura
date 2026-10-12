'use strict';
// AURA — Workflow Builder (Area 61): pick roles → chain → gates → JSON → simulate
module.exports = function builderPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA Workflow Builder — Rollen wählen, Gates setzen, Workflow als JSON</title>
<meta name="description" content="AURA Workflow Builder: aus 63 Spezialisten-Rollen flexible Workflows bauen, mit Approval-Gates, Integritäts-Audit und menschlicher Freigabe. Als JSON speichern oder simulieren.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#04070f;color:#cfe3ff;font:14px/1.5 'Segoe UI',system-ui,sans-serif;min-height:100vh}
#stars{position:fixed;inset:0;z-index:0}main{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:26px 18px}
h1{font-size:26px;letter-spacing:2px;background:linear-gradient(90deg,#7fd0ff,#b48fff,#7fffd0);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:#7d93b8;margin:4px 0 18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
.card{background:rgba(10,18,38,.82);border:1px solid #1d3a66;border-radius:12px;padding:16px;box-shadow:0 0 24px rgba(30,120,255,.08)}
.card h2{font-size:15px;color:#7fd0ff;margin-bottom:10px;letter-spacing:1px}
select,input,textarea{width:100%;background:#081226;color:#cfe3ff;border:1px solid #24466f;border-radius:8px;padding:8px;font:inherit;margin-bottom:8px}
button{background:linear-gradient(90deg,#1b4fd8,#7a3ff0);border:0;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-weight:600;margin:2px}
button.ghost{background:#12233f;border:1px solid #2c5a94}button:hover{filter:brightness(1.2)}
.step{display:flex;gap:8px;align-items:center;margin-bottom:6px}.step b{color:#7fffd0;min-width:22px}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700}
.ok{background:#0d3b2a;color:#5fff9f}.sim{background:#3b2f0d;color:#ffd75f}.pre{background:#152a4d;color:#9cc4ff}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:6px 8px;border-bottom:1px solid #16304f;text-align:left}
th{color:#7d93b8;font-weight:600}pre{background:#060d1d;border:1px solid #1d3a66;border-radius:8px;padding:10px;overflow:auto;font-size:12px;max-height:340px}
.row{display:flex;gap:10px;flex-wrap:wrap}.chk{display:flex;align-items:center;gap:6px;width:auto;margin:4px 10px 4px 0}
.chk input{width:auto;margin:0}.badge{float:right;font-size:11px}a{color:#7fd0ff}
nav{margin-bottom:14px;font-size:13px}nav a{margin-right:12px;text-decoration:none}
</style></head><body><canvas id="stars"></canvas><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/skills">Roles</a><a href="/pipelines">Pipelines</a><a href="/research">Research</a><a href="/seo">SEO</a></nav>
<h1>WORKFLOW BUILDER</h1>
<p class="sub">Area 61 · Rollen aus dem 63-Identitäten-Registry wählen → Kette bauen → Gates setzen → als JSON speichern oder simulieren <span class="pill sim">SIMULATION-LABEL EHRLICH</span></p>
<div class="grid">
 <div class="card"><h2>1 · NEUER WORKFLOW</h2>
  <input id="name" placeholder="Workflow-Name (z.B. Content-Pipeline DE)">
  <div id="steps"></div>
  <div class="row">
   <select id="role" style="max-width:340px"></select>
   <input id="task" placeholder="Aufgabe dieser Rolle…" style="flex:1">
   <button class="ghost" onclick="addStep()">+ Schritt</button>
  </div>
  <h2 style="margin-top:12px">2 · GATES</h2>
  <div class="row">
   <label class="chk"><input type="number" id="gAppr" value="2" min="1" max="5" style="width:64px"> Approvals nötig</label>
   <label class="chk"><input type="checkbox" id="gAudit" checked> Integritäts-Audit</label>
   <label class="chk"><input type="checkbox" id="gHuman" checked> Human Sign-off</label>
   <label class="chk"><input type="checkbox" id="gPriv"> Data-private (nur lokale Lane)</label>
  </div>
  <button onclick="createWf()">💾 Als JSON speichern</button>
  <button class="ghost" onclick="showJson()">JSON-Vorschau</button>
  <pre id="out" style="margin-top:10px"></pre>
 </div>
 <div class="card"><h2>3 · BESTAND & SIMULATION</h2>
  <div id="list"></div><h2 style="margin-top:14px">TRACE</h2><pre id="trace">— noch keine Simulation —</pre>
 </div>
</div>
<script>
const S=[];let ROLES=[];
const sc=document.getElementById('stars'),sx=sc.getContext('2d');
function rs(){sc.width=innerWidth;sc.height=innerHeight}rs();addEventListener('resize',rs);
const P=Array.from({length:90},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,v:Math.random()*.5+.1}));
(function loop(){sx.clearRect(0,0,sc.width,sc.height);sx.fillStyle='#3f6fb8';
P.forEach(p=>{p.y+=p.v;if(p.y>sc.height)p.y=0;sx.fillRect(p.x,p.y,1.4,1.4)});requestAnimationFrame(loop)})();
async function boot(){
 const r=await (await fetch('/api/roles')).json();
 ROLES=Array.isArray(r)?r:(r.roles||[]);
 document.getElementById('role').innerHTML=ROLES.map(x=>'<option>'+x.title+'</option>').join('');
 addStep();addStep();refresh();
}
function addStep(){S.push({role:document.getElementById('role').value||ROLES[0]?.title,task:''});render()}
function render(){document.getElementById('steps').innerHTML=S.map((s,i)=>
 '<div class="step"><b>'+(i+1)+'</b><select onchange="S['+i+'].role=this.value" style="max-width:260px">'+
 ROLES.map(x=>'<option'+(x.title===s.role?' selected':'')+'>'+x.title+'</option>').join('')+
 '</select><input placeholder="Aufgabe…" value="'+(s.task||'').replace(/"/g,'&quot;')+'" onchange="S['+i+'].task=this.value" style="flex:1">'+
 '<button class="ghost" onclick="S.splice('+i+',1);render()">✕</button></div>').join('');}
function buildWf(){return {name:document.getElementById('name').value,steps:S.filter(s=>s.task&&s.role),
 gates:{minApprovals:+document.getElementById('gAppr').value,integrityAudit:document.getElementById('gAudit').checked,
 humanSignoff:document.getElementById('gHuman').checked,dataPrivate:document.getElementById('gPriv').checked}}}
function showJson(){document.getElementById('out').textContent=JSON.stringify(buildWf(),null,2)}
async function createWf(){const r=await fetch('/api/builder/workflows',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(buildWf())}).then(x=>x.json());
 document.getElementById('out').textContent=JSON.stringify(r,null,2);if(r.ok)refresh();}
async function refresh(){const r=await (await fetch('/api/builder/workflows')).json();
 const pre=(r.presets||[]).map(w=>'<tr><td><span class="pill pre">PRESET</span></td><td>'+w.id+'</td><td>'+w.name+'</td><td>'+w.chain.length+' Schritte</td><td>—</td></tr>').join('');
 const cus=(r.custom||[]).map(w=>'<tr><td><span class="pill ok">CUSTOM</span></td><td>'+w.id+'</td><td>'+w.name+'</td><td>'+w.steps.length+' Schritte · '+w.runs+' Runs</td>'+
 '<td><button class="ghost" onclick="sim(\\''+w.id+'\\')">▶ Sim</button> <button class="ghost" onclick="del(\\''+w.id+'\\')">🗑</button></td></tr>').join('');
 document.getElementById('list').innerHTML='<table><tr><th></th><th>ID</th><th>Name</th><th>Steps</th><th></th></tr>'+pre+cus+'</table>';}
async function sim(id){const r=await fetch('/api/builder/simulate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})}).then(x=>x.json());
 document.getElementById('trace').textContent=JSON.stringify(r,null,2);refresh();}
async function del(id){await fetch('/api/builder/workflows/'+id,{method:'DELETE'});refresh();}
boot();
</script></main></body></html>`;
};
