'use strict';
// AURA — Command Tower UI: Brain-Mapping (80), Directives (81),
// Crosslink-Policy (82), Function Registry (83), Ollama (79) + Restart.

function towerPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — Command Tower</title>
<style>
 :root{--bg:#06070d;--line:#1c2b4a;--ink:#e8ecf5;--dim:#8fa0bd;--cy:#39d7ff;--vi:#a78bfa;--gr:#4ade80;--am:#f5c96b;--rd:#f87171}
 *{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink)}
 .orbs{position:fixed;inset:0;z-index:-2;overflow:hidden}
 .orb{position:absolute;border-radius:50%;filter:blur(72px);opacity:.28;animation:fl 18s ease-in-out infinite}
 .o1{width:430px;height:430px;background:radial-gradient(circle,#b45309,transparent 70%);top:-9%;left:-6%}
 .o2{width:380px;height:380px;background:radial-gradient(circle,#7c3aed,transparent 70%);bottom:-9%;right:-4%;animation-delay:-6s}
 @keyframes fl{50%{transform:translate(34px,-28px) scale(1.08)}}
 .grid{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(rgba(245,201,107,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,201,107,.04) 1px,transparent 1px);background-size:44px 44px;animation:pan 27s linear infinite}
 @keyframes pan{to{background-position:44px 44px}}
 .wrap{max-width:1300px;margin:0 auto;padding:30px 20px 80px}
 h1{font-size:26px;margin:0;background:linear-gradient(90deg,#f5c96b,#f472b6,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:var(--dim);font-size:13px;margin:6px 0 20px;max-width:960px}
 a{color:var(--cy);text-decoration:none}
 .tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
 .tab{padding:7px 15px;border-radius:20px;border:1px solid var(--line);background:#0a0f1c;color:var(--dim);cursor:pointer;font-size:12.5px;font-weight:700}
 .tab.on{color:var(--ink);border-color:var(--am);background:#241d0b}
 .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px}
 .card{background:linear-gradient(160deg,#0d1426,#0a0f1d);border:1px solid var(--line);border-radius:14px;padding:18px;position:relative;overflow:hidden}
 .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#f5c96b,#a78bfa,transparent);background-size:200% 100%;animation:scan 3s linear infinite}
 @keyframes scan{to{background-position:200% 0}}
 .card h2{font-size:14px;margin:0 0 10px;color:#f5c96b;letter-spacing:.5px;text-transform:uppercase}
 label{display:block;font-size:11px;color:var(--dim);margin:9px 0 3px;text-transform:uppercase;letter-spacing:.5px}
 input,select,textarea{width:100%;background:#0a0f1c;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:9px 11px;font-size:13px}
 input:focus,select:focus,textarea:focus{outline:none;border-color:var(--am)}
 button{background:linear-gradient(90deg,#b45309,#7c3aed);border:0;color:#fff;font-weight:700;font-size:12.5px;padding:9px 13px;border-radius:9px;cursor:pointer;margin-top:10px;transition:.15s}
 button:hover{filter:brightness(1.15);transform:translateY(-1px)}
 button.mini{padding:3px 9px;font-size:10.5px;margin:2px 3px 2px 0;background:#101a30;border:1px solid var(--line);border-radius:7px}
 button.danger{background:#3a1414;border:1px solid #5c2323}
 .dim2{color:var(--dim);font-size:11.5px;line-height:1.5;margin:5px 0 0}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11px;color:var(--cy)}
 .ok{color:var(--gr)}.err{color:var(--rd)}.warn{color:var(--am)}
 #msg{font-size:12px;margin-top:10px;min-height:16px;white-space:pre-wrap}
 .ln{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#0a0f1c;border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-bottom:7px;font-size:12px}
 .pill{border-radius:14px;padding:2px 9px;font-size:10px;font-weight:800;margin-left:5px}
 .p-a{background:#12351f;color:#4ade80}.p-r{background:#3a1414;color:#f87171}.p-y{background:#3a2f10;color:#f5c96b}.p-b{background:#0e2c3a;color:#39d7ff}
 table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px}
 th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #16203a;vertical-align:top}
 th{color:var(--dim)}
 .floor{background:#160f0f;border:1px solid #3a1414;border-radius:10px;padding:10px 14px;font-size:11.5px;color:#fca5a5;margin-top:10px;line-height:1.6}
</style></head><body>
<div class="orbs"><div class="orb o1"></div><div class="orb o2"></div></div><div class="grid"></div>
<div class="wrap">
 <div style="font-size:12px;color:var(--dim);margin-bottom:14px"><a href="/hub">← Hub</a> · <a href="/control">Control Center</a> · <a href="/api/howto">How-To</a> · Areas 79–83</div>
 <h1>🗼 Command Tower</h1>
 <p class="sub">Volle Admin-Kontrolle: welcher Agent welche Gehirn-Rolle spielt, welche Direktiven Gehirne/Departments befolgen, welche Querverbindungen erlaubt sind, welche Funktionen aktiv/ignoriert/gelöscht sind — plus Ollama-Katalog und Server-Restart. <b>Safety-Floor ist nicht abschaltbar.</b></p>
 <div class="tabs">
  <div class="tab on" onclick="tab('brain',this)">🧠 Brain-Mapping</div>
  <div class="tab" onclick="tab('dir',this)">📜 Direktiven</div>
  <div class="tab" onclick="tab('xl',this)">🔗 Crosslinks</div>
  <div class="tab" onclick="tab('fn',this)">🧩 Funktionen</div>
  <div class="tab" onclick="tab('oll',this)">🦙 Ollama</div>
  <div class="tab" onclick="tab('ops',this)">⚠ OPS</div>
 </div>

 <div id="pane-brain">
  <div class="row">
   <div class="card">
    <h2>Agent zuweisen</h2>
    <label>Knoten (ultra / super id / head_x / minion_x)</label><input id="bm_node" placeholder="z. B. ultra oder head_research">
    <label>Agent (Ollama-Modell oder Endpoint)</label><input id="bm_agent" placeholder="z. B. deepseek-r1:32b">
    <button class="mini" onclick="bmAssign()">🧠 Zuweisen</button>
    <button class="mini" onclick="bmUnassign()">✖ Lösen</button>
    <label>Tier-Default (alle einer Ebene)</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
     <select id="bm_tier"><option value="3">TIER-3 Minions</option><option value="2">TIER-2 Heads</option><option value="1">TIER-1 Supers</option><option value="0">TIER-0 Ultra</option></select>
     <input id="bm_tagent" placeholder="z. B. phi3:mini">
    </div>
    <button class="mini" onclick="bmTier()">💾 Tier-Default setzen</button>
    <div id="msg"></div>
   </div>
   <div class="card"><h2>Belegung (Wer spielt welche Rolle?)</h2><div id="bmap"><p class="dim2">lade …</p></div></div>
  </div>
 </div>

 <div id="pane-dir" style="display:none">
  <div class="row">
   <div class="card">
    <h2>Direktive setzen</h2>
    <label>Ziel (Knoten-ID oder Department)</label><input id="d_target" placeholder="z. B. head_content oder ultra">
    <label>Anweisung</label><textarea id="d_text" rows="3" placeholder="Klare Anweisung an dieses Gehirn/diesen Officer …"></textarea>
    <button class="mini" onclick="dSet()">📜 Speichern</button>
    <label style="margin-top:12px">Fault-Ack (gezielt, mit Begründung)</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
     <input id="a_item" placeholder="Routine-/Area-ID"><input id="a_reason" placeholder="Begründung (Pflicht)">
    </div>
    <button class="mini" onclick="aAck()">✔ Fault acknowledge</button>
    <p class="dim2">Ack setzt Container-Fails zurück — Schutzgrenzen bleiben aktiv. Ein „ignore ALL restrictions" gibt es bewusst nicht.</p>
   </div>
   <div class="card"><h2>Aktive Direktiven + Safety-Floor</h2><div id="dlist"><p class="dim2">lade …</p></div></div>
  </div>
 </div>

 <div id="pane-xl" style="display:none">
  <div class="card"><h2>Crosslink-Policy je Modul (allow / restrict)</h2><div id="xlist"><p class="dim2">lade …</p></div></div>
 </div>

 <div id="pane-fn" style="display:none">
  <div class="row">
   <div class="card">
    <h2>Funktion hinzufügen</h2>
    <label>Name</label><input id="f_name" placeholder="z. B. E-Mail-Versand">
    <label>Scope</label><input id="f_scope" placeholder="custom">
    <button class="mini" onclick="fAdd()">➕ Hinzufügen</button>
    <p class="dim2">Delete ist <b>SOFT</b> + Token-pflichtig (Unfall-Schutz): erster Klick zeigt Warnung + Token, erst mit Token wird gelöscht — wiederherstellbar.</p>
   </div>
   <div class="card"><h2>Funktions-Registry</h2><div id="flist"><p class="dim2">lade …</p></div></div>
  </div>
 </div>

 <div id="pane-oll" style="display:none">
  <div class="row">
   <div class="card">
    <h2>Ollama-Status</h2>
    <div id="ostat" class="dim2">lade …</div>
    <a href="/api/ollama/install-script" target="_blank"><button class="mini">⬇ Install-Skript (eigener Host)</button></a>
    <p class="dim2">Katalog enthält nur reguläre Modelle — <b>keine</b> Uncensored/Abliterated-Varianten (Policy).</p>
   </div>
   <div class="card"><h2>Modell-Katalog</h2><div id="ocat" style="max-height:480px;overflow:auto"><p class="dim2">lade …</p></div></div>
  </div>
 </div>

 <div id="pane-ops" style="display:none">
  <div class="card" style="max-width:640px">
   <h2>⚠ Gefahrenzone</h2>
   <p class="dim2">Kill-Switch: <code>POST /api/kill {"arm":true}</code> · Restart verlangt explizite Bestätigung <code>{"confirm":"RESTART"}</code>.</p>
   <button class="danger" onclick="doRestart()">🔄 RESTART SERVER NOW</button>
   <div id="omsg"></div>
  </div>
 </div>
</div>
<script>
const $=(i)=>document.getElementById(i);
function tab(id,el){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));el.classList.add('on');['brain','dir','xl','fn','oll','ops'].forEach(x=>$('pane-'+x).style.display=x===id?'block':'none')}
async function load(){
 const bm=await(await fetch('/api/brainmap')).json();
 const cov=bm.coverage||{};
 const heads=(bm.assignments||[]).filter(s=>s.tier===2);
 $('bmap').innerHTML='<p><b style="color:var(--am)">ULTRA MASTER BRAIN:</b> '+(cov.ultra?cov.ultra:'<span class="dim2">nicht zugewiesen</span>')+'</p>'+
  '<p><b style="color:var(--vi)">SUPER MASTER BRAINS:</b> '+((cov.supers||[]).map(s=>s.node+'='+(s.agent||'—')).join(' · ')||'<span class="dim2">keine</span>')+'</p>'+
  '<table><tr><th>Knoten</th><th>Rolle</th><th>Agent</th></tr>'+heads.map(h=>'<tr><td>'+h.node+'</td><td>'+h.role+'</td><td>'+(h.agent.agent||'<span class="dim2">'+h.agent.source+'</span>')+'</td></tr>').join('')+'</table>'+
  '<p class="dim2">'+(cov.heads||0)+' Heads · '+(cov.minions||0)+' Minions · Tier-Defaults: '+JSON.stringify(bm.tier_defaults||{})+'</p>';
 const ct=await(await fetch('/api/controltower/all')).json();
 const st=await(await fetch('/api/controltower/status')).json();
 let dh='<div class="floor"><b>SAFETY-FLOOR (nie abschaltbar):</b><br>'+st.safety_floor.map(s=>'• '+s).join('<br>')+'</div>';
 const tg=Object.keys(ct.directives||{});
 dh+=tg.length?tg.map(t=>{const d=ct.directives[t];return '<div class="ln"><b style="color:var(--cy)">'+t+'</b> v'+d.version+'<span style="flex:1"></span></div>'+d.list.map(x=>'<div class="ln" style="margin-left:14px">'+(x.active?'📜':'⏸')+' '+x.text.slice(0,90)+'<span style="flex:1"></span><button class="mini" onclick="dTog(\\''+t+'\\',\\''+x.id+'\\','+(!x.active)+')">'+(x.active?'⏸':'▶')+'</button><button class="mini" onclick="dDel(\\''+t+'\\',\\''+x.id+'\\')">🗑</button></div>').join('')}).join(''):'<p class="dim2">Keine Direktiven gesetzt.</p>';
 dh+='<p class="dim2">Acks: '+Object.keys(ct.acks||{}).length+'</p>';
 $('dlist').innerHTML=dh;
 const xl=await(await fetch('/api/crosslink/overview')).json();
 $('xlist').innerHTML='<table><tr><th>Modul</th><th>Policy</th><th>Schalten</th></tr>'+(xl.modules||[]).map(m=>'<tr><td>'+m.area+' · '+m.name+'</td><td><span class="pill '+(m.policy==='allow'?'p-a':'p-r')+'">'+m.policy.toUpperCase()+'</span></td><td><button class="mini" onclick="xSet(\\''+m.id+'\\',\\''+(m.policy==='allow'?'restrict':'allow')+'\\')">→ '+(m.policy==='allow'?'restrict':'allow')+'</button></td></tr>').join('')+'</table>';
 const fr=await(await fetch('/api/functions')).json();
 $('flist').innerHTML='<table><tr><th>Funktion</th><th>Status</th><th>Aktionen</th></tr>'+(fr.functions||[]).map(f=>{
  const pill=f.state==='active'?'p-a':f.state==='ignored'?'p-y':'p-r';
  let acts='';
  if(f.state==='active')acts='<button class="mini" onclick="fOp(\\''+f.id+'\\',\\'ignore\\')">⏸ ignore</button>'+(f.protected?'':'<button class="mini danger" onclick="fDel(\\''+f.id+'\\')">🗑 delete</button>');
  if(f.state==='ignored')acts='<button class="mini" onclick="fOp(\\''+f.id+'\\',\\'reactivate\\')">▶ reaktivieren</button>'+(f.protected?'':'<button class="mini danger" onclick="fDel(\\''+f.id+'\\')">🗑 delete</button>');
  if(f.state==='deleted')acts='<button class="mini" onclick="fOp(\\''+f.id+'\\',\\'restore\\')">♻ restore</button>';
  return '<tr><td>'+f.name+(f.protected?' <span class="pill p-b">PROTECTED</span>':'')+'</td><td><span class="pill '+pill+'">'+f.state.toUpperCase()+'</span></td><td>'+acts+'</td></tr>'}).join('')+'</table>';
 const os=await(await fetch('/api/ollama/status')).json();
 $('ostat').innerHTML='Zustand: <b class="'+(os.mode==='LIVE'?'ok':'warn')+'">'+os.mode+'</b> · URL: <code>'+os.url+'</code><br>Probe: '+((os.probe||{}).detail||'—')+'<br>Katalog: '+os.total_catalog+' Modelle · gewünscht installiert: '+os.installed_wanted;
 const oc=await(await fetch('/api/ollama/catalog')).json();
 $('ocat').innerHTML='<p class="warn" style="font-size:11px">'+oc.excluded_note+'</p>'+(oc.catalog||[]).map(c=>'<p style="margin:10px 0 4px"><b style="color:var(--cy)">'+c.tag+'</b></p>'+'<div>'+(c.models||[]).map(m=>'<span class="pill '+(m.installed?'p-a':'p-b')+'" style="margin:2px">'+m.name+'</span>').join('')+'</div>').join('');
}
async function bmAssign(){const r=await fetch('/api/brainmap/assign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({node:$('bm_node').value,agent:$('bm_agent').value})});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ '+j.role+' → '+j.agent+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function bmUnassign(){const r=await fetch('/api/brainmap/unassign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({node:$('bm_node').value})});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ gelöst</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function bmTier(){const r=await fetch('/api/brainmap/tier-default',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tier:+$('bm_tier').value,agent:$('bm_tagent').value})});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ Tier-Default gesetzt</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function dSet(){const r=await fetch('/api/controltower/set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:$('d_target').value,text:$('d_text').value})});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ Direktive v'+j.version+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function dTog(t,d,on){await fetch('/api/controltower/directives/'+t+'/'+d+'/'+(on?'on':'off'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});load()}
async function dDel(t,d){await fetch('/api/controltower/directives/'+t+'/'+d+'/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});load()}
async function aAck(){const r=await fetch('/api/controltower/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:$('a_item').value,reason:$('a_reason').value})});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ '+j.note+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function xSet(m,mode){const r=await fetch('/api/crosslink/set',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({module:m,mode})});const j=await r.json();if(j.error)alert(j.error);load()}
async function fAdd(){const r=await fetch('/api/functions/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('f_name').value,scope:$('f_scope').value})});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ '+j.id+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function fOp(id,op){const r=await fetch('/api/functions/'+id+'/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();if(j.error)alert(j.error);load()}
async function fDel(id){const r1=await fetch('/api/functions/'+id+'/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j1=await r1.json();
 if(j1.requires_confirmation){const tok=prompt(j1.warning+'\\n\\nToken eingeben:');if(!tok)return;
  const r2=await fetch('/api/functions/'+id+'/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tok})});const j2=await r2.json();
  $('msg').innerHTML=j2.ok?'<span class="warn">✔ '+j2.note+'</span>':'<span class="err">✖ '+(j2.error||'')+'</span>';}
 load()}
async function doRestart(){if(!confirm('⚠ WARNUNG: Server wird JETZT neu gestartet. Fortfahren?'))return;
 const r=await fetch('/api/ops/restart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'RESTART',reason:'tower ui'})});const j=await r.json();
 $('omsg').innerHTML=j.restarting?'<span class="warn">🔄 Neustart eingeleitet — Seite lädt gleich neu …</span>':'<span class="err">✖ '+(j.warning||j.error||'')+'</span>';
 if(j.restarting)setTimeout(()=>location.reload(),3500);}
load();setInterval(load,10000);
</script>
</body></html>`;
}
module.exports = towerPageHtml;
