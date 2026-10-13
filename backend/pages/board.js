'use strict';
// AURA — Agent Board: Kanban, auf dem Agenten nach Fähigkeit Aufgaben übernehmen,
// sich gegenseitig helfen (Übergabe) und ein Mensch am Ende freigibt.
module.exports = function boardPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA · Agent Board</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020409;color:#cfe6ff;font:13px/1.5 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:1280px;margin:0 auto;padding:28px 18px 40px}
nav{margin-bottom:16px;font-size:13px}nav a{color:#ffcf7d;margin-right:14px;text-decoration:none}
h1{font-size:24px;letter-spacing:4px;color:#7fd0ff}
.sub{color:#7d94ad;font-size:12px;margin:4px 0 16px}
.note{background:#0a1426;border:1px solid #1d3a66;border-radius:10px;padding:10px 14px;font-size:12px;color:#9cb6d4;margin-bottom:16px}
.note li{margin-left:18px}
.new{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.new input,.new select,.new textarea{background:#081226;border:1px solid #24466f;color:#cfe6ff;border-radius:8px;padding:8px 10px;font:inherit}
.new input{flex:1;min-width:200px}.new textarea{flex:2;min-width:260px;min-height:38px}
button{background:#0c1830;border:1px solid #2c5a94;color:#9cc4ff;border-radius:8px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer}
button.go{background:linear-gradient(90deg,#1c5a8a,#39d7ff);color:#001522;border:0;font-weight:700}
button.ok{background:#0d3b2a;border-color:#2c8a5a;color:#8fffc0}
button.no{background:#3b1420;border-color:#8a2c40;color:#ffb0b0}
button:disabled{opacity:.4;cursor:not-allowed}
.cols{display:grid;grid-template-columns:repeat(6,minmax(170px,1fr));gap:10px;overflow-x:auto}
.col{background:rgba(8,14,30,.85);border:1px solid #1d3a66;border-radius:12px;padding:10px;min-height:260px}
.col h2{font-size:11px;letter-spacing:2px;color:#7d94ad;text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between}
.col h2 span{color:#39d7ff}
.col.review{border-color:#5c4a1e}.col.blocked{border-color:#8a2c40}.col.done{border-color:#2c8a5a}
.card{background:#081226;border:1px solid #24466f;border-radius:10px;padding:9px;margin-bottom:8px}
.card h3{font-size:13px;color:#e6f2ff;margin-bottom:3px}
.id{font-size:10px;color:#5f7186;font-family:monospace}
.chip{display:inline-block;font-size:10px;padding:1px 7px;border-radius:12px;margin:2px 3px 0 0;background:#0c1830;border:1px solid #2c5a94;color:#9cc4ff}
.owner{font-size:11px;color:#ffcf7d;margin-top:4px}
.help{font-size:11px;color:#ffb0b0;margin-top:4px}
.res{font-size:11px;color:#9fd8b0;background:#06101c;border-radius:6px;padding:5px;margin-top:5px;white-space:pre-wrap}
.acts{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.acts select{background:#081226;border:1px solid #24466f;color:#cfe6ff;border-radius:6px;padding:3px;font-size:11px;max-width:150px}
.hist{font-size:10px;color:#5f7186;margin-top:5px}
.msg{margin:10px 0;font-size:12px;color:#ffcf7d;min-height:16px}
.roles{margin-top:16px;font-size:11px;color:#7d94ad}
.roles b{color:#9cc4ff}
</style></head><body><main>
<nav><a href="/hub">Hub</a><a href="/hierarchy">Hierarchie</a><a href="/skills">Skills</a><a href="/jarvis">J.A.R.V.I.S.</a><a href="/ops">Ops</a></nav>
<h1>AGENT BOARD</h1>
<p class="sub">Aufgabe rein, Agenten nach Fähigkeit zuweisen, Hilfe von anderen Abteilungen anfordern, am Ende gibt ein Mensch frei.</p>
<ul class="note" id="rules"></ul>
<div class="new">
  <input id="t" placeholder="Titel (3–120 Zeichen)">
  <textarea id="g" placeholder="Ziel / Auftrag (mind. 10 Zeichen)"></textarea>
  <select id="n" multiple size="1" style="min-width:180px;max-height:34px" title="Abteilungen (Strg-Klick für mehrere)"></select>
  <button class="go" onclick="create()">+ Aufgabe</button>
</div>
<div class="msg" id="msg"></div>
<div class="cols" id="cols"></div>
<div class="roles" id="roles"></div>
</main>
<script>
const COLS=[['backlog','Backlog'],['assigned','Zugewiesen'],['in_progress','In Arbeit'],['blocked','Blockiert'],['review','Freigabe (Mensch)'],['done','Fertig']];
let S=null;
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function msg(t,bad){const m=document.getElementById('msg');m.textContent=t;m.style.color=bad?'#ffb0b0':'#ffcf7d'}
async function api(path,body){
  const r=await fetch(path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){msg((j.error||('Fehler '+r.status))+(r.status===423?' — Kill-Switch aktiv':''),true);return null;}
  msg('');return j;
}
async function load(){S=await fetch('/api/board').then(x=>x.json());render();}
function roleName(id){const r=S.roles.find(x=>x.id===id);return r?(r.title+' · '+r.department_name):id}
function deptName(id){const d=S.departments.find(x=>x.id===id);return d?d.name:id}
function render(){
 document.getElementById('rules').innerHTML=S.rules.map(r=>'<li>'+esc(r)+'</li>').join('');
 const sel=document.getElementById('n');
 if(!sel.options.length){sel.innerHTML=S.departments.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('');sel.size=1;}
 document.getElementById('cols').innerHTML=COLS.map(([k,label])=>{
  const list=S.tasks[k]||[];
  return '<div class="col '+k+'"><h2>'+label+' <span>'+list.length+'</span></h2>'+list.map(card).join('')+'</div>';
 }).join('');
 document.getElementById('roles').innerHTML='<b>Auslastung</b> (WIP-Limit '+S.wip_limit+'): '+S.roles.filter(r=>r.active>0).map(r=>esc(r.title)+' '+r.active+'/'+r.wip_limit).join(' · ')+(S.roles.every(r=>r.active===0)?'alle frei':'');
}
function card(t){
 const hr=t.help_request;
 const dept=t.needs.map(n=>'<span class="chip">'+esc(deptName(n))+'</span>').join('');
 let a='';
 if(t.status==='backlog')a='<button class="go" onclick="act(\\''+t.id+'\\',\\'assign\\')">Zuweisen</button>';
 if(t.status==='assigned')a='<button onclick="act(\\''+t.id+'\\',\\'start\\')">Start</button>'+helpBtn(t);
 if(t.status==='in_progress')a=helpBtn(t)+'<button onclick="submit(\\''+t.id+'\\')">Einreichen</button>';
 if(t.status==='blocked')a=handoffUI(t);
 if(t.status==='review')a='<button class="ok" onclick="approve(\\''+t.id+'\\')">Freigeben</button><button class="no" onclick="reject(\\''+t.id+'\\')">Zurück</button>';
 return '<div class="card"><div class="id">'+esc(t.id)+'</div><h3>'+esc(t.title)+'</h3>'+dept+
  (t.owner?'<div class="owner">'+esc(roleName(t.owner))+'</div>':'<div class="owner" style="color:#5f7186">noch niemand</div>')+
  (hr?'<div class="help">Hilfe gesucht: '+esc(deptName(hr.dept))+' — '+esc(hr.reason)+(hr.suggested?' · Vorschlag: '+esc(roleName(hr.suggested)):'')+'</div>':'')+
  (t.result?'<div class="res">'+esc(t.result)+'</div>':'')+
  (t.approved_by?'<div class="hist">freigegeben von '+esc(t.approved_by)+'</div>':'')+
  '<div class="acts">'+a+'</div>'+
  '<div class="hist">'+t.history.slice(-2).map(h=>esc(h.event)+' · '+esc(h.by)).join('<br>')+'</div></div>';
}
function helpBtn(t){return '<button onclick="helpReq(\\''+t.id+'\\')">Hilfe anfordern</button>'}
function handoffUI(t){
 const hr=t.help_request||{};
 const opts=S.roles.filter(r=>r.department===hr.dept).filter(r=>r.active<r.wip_limit||r.id===hr.suggested)
   .map(r=>'<option value="'+esc(r.id)+'"'+(r.id===hr.suggested?' selected':'')+'>'+esc(r.title)+' ('+r.active+'/'+r.wip_limit+')</option>').join('');
 return '<select id="h-'+t.id+'">'+opts+'</select><button class="go" onclick="handoff(\\''+t.id+'\\')">Übergeben</button>';
}
async function create(){
 const title=document.getElementById('t').value.trim(),goal=document.getElementById('g').value.trim();
 const needs=[...document.getElementById('n').selectedOptions].map(o=>o.value);
 if(!needs.length){const first=S.departments[0].id;needs.push(first);}
 const r=await api('/api/board/task',{title,goal,needs});
 if(r){document.getElementById('t').value='';document.getElementById('g').value='';msg('Aufgabe '+r.task.id+' angelegt.');load();}
}
async function act(id,a,body){const r=await api('/api/board/'+id+'/'+a,body||{});if(r){msg('OK: '+a);load();}}
async function helpReq(id){
 const dept=prompt('Welche Abteilung wird gebraucht? (Schlüssel: '+S.departments.map(d=>d.id).join(', ')+')');if(!dept)return;
 const reason=prompt('Warum? (mind. 5 Zeichen)');if(!reason)return;
 act(id,'request_help',{dept:dept.trim(),reason});
}
function handoff(id){const to=document.getElementById('h-'+id).value;act(id,'handoff',{to_role:to});}
function submit(id){const result=prompt('Ergebnis (mind. 10 Zeichen):');if(!result)return;act(id,'submit',{result,by:S.tasks.in_progress.find(t=>t.id===id).owner});}
function approve(id){const by=prompt('Dein Name (Freigabe nur durch einen Menschen):');if(!by)return;act(id,'approve',{by});}
function reject(id){const by=prompt('Dein Name:');if(!by)return;const note=prompt('Grund für die Rückgabe (mind. 5 Zeichen):');if(!note)return;act(id,'reject',{by,note});}
load();setInterval(load,15000);
</script></main></body></html>`;
};
