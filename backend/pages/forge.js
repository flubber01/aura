'use strict';
// AURA Areas 73+74 — Content Forge (minion automation) + Service Fabric UI.

function forgePageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — Content Forge & Services</title>
<style>
 :root{--bg:#06070d;--line:#1c2b4a;--ink:#e8ecf5;--dim:#8fa0bd;--cy:#39d7ff;--vi:#a78bfa;--gr:#4ade80;--am:#f5c96b;--rd:#f87171}
 *{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink)}
 .orbs{position:fixed;inset:0;z-index:-2;overflow:hidden}
 .orb{position:absolute;border-radius:50%;filter:blur(72px);opacity:.3;animation:fl 15s ease-in-out infinite}
 .o1{width:420px;height:420px;background:radial-gradient(circle,#f59e0b,transparent 70%);top:-10%;left:-6%}
 .o2{width:360px;height:360px;background:radial-gradient(circle,#7c3aed,transparent 70%);bottom:-8%;right:-4%;animation-delay:-5s}
 .o3{width:300px;height:300px;background:radial-gradient(circle,#0891b2,transparent 70%);top:40%;left:46%;animation-delay:-9s}
 @keyframes fl{50%{transform:translate(38px,-30px) scale(1.1)}}
 .grid{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(rgba(57,215,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(57,215,255,.05) 1px,transparent 1px);background-size:44px 44px;animation:pan 24s linear infinite}
 @keyframes pan{to{background-position:44px 44px}}
 .wrap{max-width:1280px;margin:0 auto;padding:30px 20px 80px}
 h1{font-size:26px;margin:0;background:linear-gradient(90deg,#f5c96b,#a78bfa,#39d7ff);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:var(--dim);font-size:13px;margin:6px 0 22px;max-width:900px}
 a{color:var(--cy);text-decoration:none}
 .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px}
 .card{background:linear-gradient(160deg,#0d1426,#0a0f1d);border:1px solid var(--line);border-radius:14px;padding:18px;position:relative;overflow:hidden}
 .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#f5c96b,#a78bfa,transparent);background-size:200% 100%;animation:scan 3s linear infinite}
 @keyframes scan{to{background-position:200% 0}}
 .card h2{font-size:14px;margin:0 0 12px;color:#f5c96b;letter-spacing:.6px;text-transform:uppercase}
 label{display:block;font-size:11px;color:var(--dim);margin:10px 0 3px;text-transform:uppercase;letter-spacing:.5px}
 input,select,textarea{width:100%;background:#0a0f1c;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:9px 11px;font-size:13px}
 textarea{resize:vertical;font-size:12px}
 input:focus,textarea:focus,select:focus{outline:none;border-color:var(--cy)}
 button{background:linear-gradient(90deg,#b45309,#7c3aed);border:0;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border-radius:9px;cursor:pointer;margin-top:12px;transition:.15s}
 button:hover{filter:brightness(1.15);transform:translateY(-1px)}
 button.mini{padding:3px 9px;font-size:10.5px;margin:2px 3px 2px 0;background:#101a30;border:1px solid var(--line);border-radius:7px}
 button.danger{background:#3a1414;border:1px solid #5c2323}
 .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
 .item{background:#0a0f1c;border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:9px}
 .item b{color:var(--cy)}
 .pill{border-radius:14px;padding:2px 9px;font-size:10px;font-weight:800;margin-left:5px}
 .p-draft{background:#3a2f10;color:#f5c96b}.p-app{background:#12351f;color:#4ade80}.p-pub{background:#0e2c3a;color:#39d7ff}.p-rej{background:#3a1414;color:#f87171}
 .dim2{color:var(--dim);font-size:11.5px;line-height:1.5;margin:5px 0 0}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11px;color:var(--cy)}
 .ok{color:var(--gr)}.err{color:var(--rd)}.warn{color:var(--am)}
 #msg{font-size:12px;margin-top:10px;min-height:16px}
 .mode{display:flex;align-items:center;gap:10px;background:#0a0f1c;border:1px solid var(--line);border-radius:10px;padding:10px 13px;margin-bottom:8px}
 .mode input{width:auto}
 .svcline{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#0a0f1c;border:1px solid var(--line);border-radius:10px;padding:10px 13px;margin-bottom:8px}
 .tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
 .tab{padding:7px 16px;border-radius:20px;border:1px solid var(--line);background:#0a0f1c;color:var(--dim);cursor:pointer;font-size:12.5px;font-weight:700}
 .tab.on{color:var(--ink);border-color:var(--vi);background:#1b1430}
</style></head><body>
<div class="orbs"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div></div><div class="grid"></div>
<div class="wrap">
 <div style="font-size:12px;color:var(--dim);margin-bottom:14px"><a href="/hub">← Hub</a> · <a href="/builder">Workflow Builder</a> · <a href="/api/content/status">Forge-API</a> · <a href="/api/services/status">Fabric-API</a> · Areas 73+74</div>
 <h1>⚒ Content Forge & Service Fabric</h1>
 <p class="sub">Minion-Worker automatisieren Content über die WF-Pipelines: <b>auto-create</b> + <b>auto-modify</b> laufen automatisch, <b>auto-post NUR mit menschlicher Freigabe</b> über offizielle Kanäle (kein synthetisches Engagement, 403 bei Umgehungsversuchen). Service Fabric: selbst einbaubare Services + System-Modi für modulares Arbeiten.</p>

 <div class="tabs">
  <div class="tab on" onclick="tab('forge',this)">⚒ Content Forge</div>
  <div class="tab" onclick="tab('rout',this)">🔁 Routinen</div>
  <div class="tab" onclick="tab('fab',this)">🧵 Service Fabric</div>
  <div class="tab" onclick="tab('modes',this)">🎚 Modi</div>
 </div>

 <div id="pane-forge">
  <div class="row">
   <div class="card">
    <h2>Auto-Create (Minion-Pipeline)</h2>
    <label>Brief / Thema</label><textarea id="c_brief" rows="2" placeholder="z. B. Wochenrückblick: Was AURA diese Woche gelernt hat"></textarea>
    <div class="two">
     <div><label>Typ</label><select id="c_type"><option>article</option><option>story</option><option>social_draft</option><option>image_brief</option><option>script</option><option>newsletter</option></select></div>
     <div><label>&nbsp;</label><button style="width:100%" onclick="createC()">⚡ Minions los!</button></div>
    </div>
    <p class="dim2">Pipeline: research → writer → editor → qa → <b>Gate: menschliche Freigabe</b>. Storys laufen zusätzlich durch den Area-08-Kinderschutzfilter.</p>
    <div id="msg"></div>
   </div>
   <div class="card">
    <h2>Auto-Modify + Publish</h2>
    <label>Item-ID (aus Liste unten)</label><div class="two"><input id="m_id" placeholder="ct-xxxxxx"><input id="m_ins" placeholder="Anweisung, z. B. kürzen"></div>
    <button class="mini" onclick="modC()">✏ Modify</button>
    <button class="mini" onclick="appr('approve')">✔ Approve</button>
    <button class="mini danger" onclick="appr('reject')">✖ Reject</button>
    <label style="margin-top:12px">Kanal für Post (nur nach Approve)</label>
    <div class="two"><select id="p_ch"></select><button class="mini" style="margin-top:0" onclick="postC()">📤 Post</button></div>
    <p class="dim2" id="chinfo"></p>
   </div>
  </div>
  <div class="card"><h2>Content-Bibliothek</h2><div id="items"><p class="dim2">lade …</p></div></div>
 </div>

 <div id="pane-rout" style="display:none">
  <div class="row">
   <div class="card">
    <h2>Routine hinzufügen</h2>
    <label>Name</label><input id="r_name" placeholder="z. B. Tages-Briefing">
    <label>Brief</label><textarea id="r_brief" rows="2"></textarea>
    <div class="two">
     <div><label>Typ</label><select id="r_type"><option>article</option><option>story</option><option>social_draft</option><option>image_brief</option><option>script</option><option>newsletter</option></select></div>
     <div><label>Intervall (Min)</label><input id="r_int" type="number" value="1440" min="5"></div>
    </div>
    <button onclick="addR()">➕ Routine speichern</button><div id="rmsg"></div>
    <p class="dim2">Daemon-Tick alle 30 s feuert fällige Routinen — erzeugt/ändert Content, <b>postet niemals automatisch</b>. Safe-/Quiet-Mode (Tab Modi) pausiert das Feuer.</p>
   </div>
   <div class="card"><h2>Aktive Routinen</h2><div id="rlist"><p class="dim2">lade …</p></div></div>
  </div>
 </div>

 <div id="pane-fab" style="display:none">
  <div class="row">
   <div class="card">
    <h2>Service hinzufügen</h2>
    <label>Name</label><input id="s_name" placeholder="z. B. mein-dashboard">
    <label>URL</label><input id="s_url" placeholder="https://host:port/health">
    <label>Health-Pfad (optional)</label><input id="s_hp" placeholder="/api/health">
    <button onclick="addS()">➕ Service registrieren</button><div id="smsg"></div>
   </div>
   <div class="card"><h2>Installierte Services (echte Probes)</h2><div id="slist"><p class="dim2">lade …</p></div></div>
  </div>
 </div>

 <div id="pane-modes" style="display:none">
  <div class="card" style="max-width:640px"><h2>System-Modi</h2><div id="mlist"></div>
   <p class="dim2">Safe Mode blockt z. B. die Bild-Generierung (Area 71, 423) und Routine-Feuer — modulares Arbeiten ohne Neustart.</p></div>
 </div>
</div>
<script>
const $=(i)=>document.getElementById(i);
const PILL={draft:'p-draft',approved:'p-app',published:'p-pub',rejected:'p-rej',queued:'p-draft',review:'p-draft'};
function tab(id,el){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));el.classList.add('on');['forge','rout','fab','modes'].forEach(x=>$('pane-'+x).style.display=x===id?'block':'none')}
async function load(){
 const st=await(await fetch('/api/content/status')).json();
 $('p_ch').innerHTML=st.channels.map(c=>'<option value="'+c.id+'">'+c.name+' ('+c.state+')</option>').join('');
 $('chinfo').innerHTML=st.channels.map(c=>'· '+c.id+': <b class="'+(c.state==='LIVE'?'ok':'warn')+'">'+c.state+'</b>').join('  ');
 const it=await(await fetch('/api/content/items')).json();
 $('items').innerHTML=it.items.length?it.items.map(x=>'<div class="item"><b>'+x.id+'</b> <code>'+x.type+'</code><span class="pill '+(PILL[x.status]||'p-draft')+'">'+x.status.toUpperCase()+'</span>'+
  (x.labels||[]).map(l=>'<span class="pill p-draft">'+l+'</span>').join('')+
  '<p class="dim2">'+(x.title||'').replace(/</g,'&lt;')+' · '+new Date(x.updatedAt).toLocaleString()+' · '+x.workflow_ref+'</p></div>').join(''):'<p class="dim2">Noch kein Content erzeugt.</p>';
 const rl=await(await fetch('/api/content/routines')).json();
 $('rlist').innerHTML=rl.routines.length?rl.routines.map(r=>'<div class="item"><b>'+r.name+'</b> <code>'+r.type+'/'+r.action+'</code> alle '+r.interval_min+' min'+(r.enabled?'':' <span class="pill p-rej">PAUSIERT</span>')+
  '<p class="dim2">runs '+r.runs+' · nächste '+new Date(r.next_run).toLocaleString()+'</p>'+
  '<button class="mini" onclick="rop(\\''+r.id+'\\',\\'run\\')">▶ jetzt</button><button class="mini" onclick="rop(\\''+r.id+'\\','+(r.enabled?'\\'disable\\'':'\\'enable\\'')+')">'+(r.enabled?'⏸':'▶')+'</button><button class="mini danger" onclick="rop(\\''+r.id+'\\',\\'remove\\')">🗑</button></div>').join(''):'<p class="dim2">Keine Routinen definiert.</p>';
 const sf=await(await fetch('/api/services/status')).json();
 $('slist').innerHTML=sf.services.map(s=>'<div class="svcline"><b style="color:var(--cy)">'+s.name+'</b> <code>'+s.id+'</code><span class="pill '+(s.state==='LIVE'?'p-app':s.state==='NOT-CONNECTED'?'p-rej':'p-draft')+'">'+s.state+'</span>'+
  '<span class="dim2">'+(s.last_probe?s.last_probe.detail:'')+'</span>'+
  '<span style="flex:1"></span>'+
  '<button class="mini" onclick="sop(\\''+s.id+'\\',\\'probe\\')">📡 Probe</button>'+
  '<button class="mini" onclick="sop(\\''+s.id+'\\','+(s.installed?'\\'uninstall\\'':'\\'install\\'')+')">'+(s.installed?'⏏':'⬇')+'</button>'+
  '<button class="mini" onclick="sop(\\''+s.id+'\\','+(s.enabled?'\\'disable\\'':'\\'enable\\'')+')">'+(s.enabled?'✖':'✔')+'</button>'+
  (s.addedBy==='user'?'<button class="mini danger" onclick="sop(\\''+s.id+'\\',\\'remove\\')">🗑</button>':'')+'</div>').join('');
 $('mlist').innerHTML=sf.modes.map(m=>'<label class="mode"><input type="checkbox" '+(m.active?'checked':'')+' onchange="setMode(\\''+m.id+'\\',this.checked)"><span><b>'+m.name+'</b><br><span class="dim2">'+m.desc+'</span></span></label>').join('');
}
async function createC(){const r=await fetch('/api/content/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief:$('c_brief').value,type:$('c_type').value})});const j=await r.json();$('msg').innerHTML=j.id?'<span class="ok">✔ '+j.id+' als '+j.status+' erzeugt ('+(j.labels||[]).join(', ')+')</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function modC(){const r=await fetch('/api/content/modify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:$('m_id').value,instruction:$('m_ins').value})});const j=await r.json();$('msg').innerHTML=j.id?'<span class="ok">✔ geändert → Status zurück auf draft (Review-Gate)</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function appr(d){const r=await fetch('/api/content/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:$('m_id').value,decision:d})});const j=await r.json();$('msg').innerHTML=j.id?'<span class="ok">✔ '+j.status+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function postC(){const r=await fetch('/api/content/post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:$('m_id').value,channel:$('p_ch').value})});const j=await r.json();$('msg').innerHTML=j.id?'<span class="ok">✔ publiziert nach '+j.publishedTo+'</span>':'<span class="'+(r.status===403?'warn':'err')+'">✖ '+(j.error||r.status)+'</span>';load()}
async function addR(){const r=await fetch('/api/content/routines/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('r_name').value,brief:$('r_brief').value,type:$('r_type').value,interval_min:+$('r_int').value})});const j=await r.json();$('rmsg').innerHTML=j.id?'<span class="ok">✔ Routine aktiv</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function rop(id,op){const r=await fetch('/api/content/routines/'+id+'/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();if(j.error)$('rmsg').innerHTML='<span class="err">✖ '+j.error+'</span>';load()}
async function addS(){const r=await fetch('/api/services/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('s_name').value,url:$('s_url').value,health_path:$('s_hp').value})});const j=await r.json();$('smsg').innerHTML=j.ok?'<span class="ok">✔ '+j.service.id+' registriert</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function sop(id,op){const r=await fetch('/api/services/'+id+'/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();if(j.error)alert(j.error);load()}
async function setMode(id,on){await fetch('/api/services/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,on})});load()}
load();setInterval(load,8000);
</script>
</body></html>`;
}
module.exports = forgePageHtml;
