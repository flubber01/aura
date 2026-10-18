'use strict';
// AURA — Container Console (Area 67): per-module crash isolation dashboard.
module.exports = function containersPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA Module Containers — Crash-Isolation, Circuit Breaker, Quarantäne</title>
<meta name="description" content="AURA Container-Konsole: jedes Live-Modul läuft in einem eigenen Container mit Timeout-Guard, Circuit Breaker und Quarantäne. Ein abstürzendes Modul kann den Server nie mitreißen.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#02040a;color:#d6e4ff;font:13px/1.55 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
h1{font-size:24px;letter-spacing:2px;color:#39d7ff}.sub{color:#7d94ad;font-size:12px;margin:4px 0 16px}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
.live{background:#0d3b2a;color:#5fff9f}.q{background:#3a1414;color:#f87171}.d{background:#3a2f10;color:#ffd75f}
table{width:100%;border-collapse:collapse;font-size:12.5px;background:rgba(9,15,30,.85);border-radius:10px;overflow:hidden}
td,th{padding:7px 10px;border-bottom:1px solid #16304f;text-align:left}th{color:#7d93b8;background:#0c1830}
button{background:#12233f;border:1px solid #2c5a94;color:#9cc4ff;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px}
.policy{background:rgba(9,15,30,.85);border:1px solid #1d3a66;border-radius:10px;padding:12px;font-size:12px;margin-bottom:14px;line-height:1.8}
nav{margin-bottom:12px;font-size:13px}nav a{color:#39d7ff;margin-right:12px;text-decoration:none}
#ledger{font-size:11px;color:#8fa3c8;margin-top:14px;max-height:180px;overflow:auto;background:rgba(5,10,20,.8);border:1px solid #16304f;border-radius:8px;padding:8px}
</style></head><body><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/config">Config</a><a href="/logs">Logs</a><a href="/console">Console</a></nav>
<h1>📦 MODULE CONTAINERS</h1>
<p class="sub">Area 67 · jedes Live-Modul = eigener Container · Timeout-Guard · Circuit Breaker · Quarantäne statt System-Crash <span class="pill live">LIVE</span></p>
<div class="policy" id="policy">lade…</div>
<table><thead><tr><th>Area</th><th>Modul</th><th>Container</th><th>Calls</th><th>Fails</th><th>letzte Latenz</th><th>Quarantänen</th><th>Drill</th></tr></thead><tbody id="tb"></tbody></table>
<div id="ledger"></div>

<h1 style="margin-top:26px">🧩 MODULE HUB <span class="pill live">AREA 70</span></h1>
<p class="sub">Zentrales Modul-System: Manifest-basierte Module aus <code>backend/modules/</code> · Lifecycle discover→validate→configure→initialize→ready→execute→shutdown · Approval-Pflicht für Drittanbieter-Module · Spec: <code>docs/MODULE_SYSTEM.md</code> · Schnittstelle v2: <code>docs/MODULE_SPEC.md</code></p>
<div class="policy" id="mhPolicy">lade…</div>
<div id="mhCards"></div>
<div id="mhLedger"></div>

<h2 style="margin-top:22px;font-size:17px;letter-spacing:1px;color:#39d7ff">📥 Dritt-Modul importieren <span class="pill live">FEHLERFREI-SCHLEUSE</span></h2>
<p class="sub">Ein fremdes Paket geht zuerst in die Quarantäne (<code>backend/src/data/modulehub-quarantine/</code>, liegt nie im Git). Dort prüft AURA: Manifest gegen Schnittstelle v2 · <code>node --check</code> je Datei · Verbotsliste statisch · Selbsttest als eigener Kindprozess mit 10 Sekunden und ohne Netz. Erst wenn alle Prüfungen grün sind, wartet das Modul auf <b>deine</b> Freigabe. Automatisch wird nichts geladen und nichts gestartet.</p>
<div class="policy">
  <div style="margin-bottom:8px"><b>1 · ZIP-Datei wählen</b> (wird im Browser in Basis64 gewandelt und als Text gesendet):<br>
    <input type="file" id="impFile" accept=".zip" style="margin-top:5px;font-size:12px">
  </div>
  <div style="margin-bottom:8px"><b>2 · oder Basis64-Text einfügen</b> — entweder reines Basis64 eines ZIPs oder ein JSON-Objekt
    <code>{"name":"mein-modul","files":[{"path":"aura.module.json","content":"…","encoding":"base64"}]}</code>:<br>
    <textarea id="impText" rows="5" placeholder='{"files":[{"path":"aura.module.json","content":"eyJpZCI6IC4uLn0","encoding":"base64"}]}' style="width:100%;margin-top:5px;background:#0c1830;border:1px solid #2c5a94;color:#9cc4ff;border-radius:6px;padding:6px;font:11px/1.4 ui-monospace,monospace"></textarea>
  </div>
  <div class="row" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <button id="impSend">🔍 Prüfen und in Quarantäne legen</button>
    <button onclick="impLoadSpec()">📄 Schnittstellen-Spec (JSON)</button>
    <span id="impMsg" class="sub" style="margin:0"></span>
  </div>
</div>
<div id="impResult"></div>
<div id="impQueue" style="margin-top:14px"></div>

<script>
const badge=s=>s==='healthy'?'<span class="pill live">HEALTHY</span>':s==='quarantined'?'<span class="pill q">QUARANTINED</span>':s==='probe-due'?'<span class="pill d">PROBE DUE</span>':s==='probe'?'<span class="pill d">PROBE</span>':'<span class="pill q">'+s+'</span>';
const mbadge=s=>({ready:'<span class="pill live">BEREIT</span>',needs_approval:'<span class="pill d">FREIGABE ERFORDERLICH</span>',needs_config:'<span class="pill d">KONFIG ERFORDERLICH</span>',disabled:'<span class="pill q">DEAKTIVIERT</span>',error:'<span class="pill q">FEHLER</span>',invalid:'<span class="pill q">MANIFEST UNGÜLTIG</span>',discovered:'<span class="pill d">ERKANNT</span>',initializing:'<span class="pill d">STARTET</span>'})[s]||'<span class="pill q">'+s+'</span>';
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function mhCall(id,op,body){await fetch('/api/modulehub/'+encodeURIComponent(id)+'/'+op,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});mhTick();}
async function mhScan(){await fetch('/api/modulehub/scan',{method:'POST'});mhTick();}
function cfgVal(id,f,v){const m=(window.__mh||{}).modules?__mh.modules.find(x=>x.id===id):null;return m&&m.config&&typeof m.config[f]!=='undefined'?m.config[f]:(v==null?'':v);}
function mhCfgForm(m){const cs=Object.entries(m.configSchema||{});if(!cs.length)return'';
 return '<div style="margin:6px 0">'+cs.map(([f,d])=>{const v=cfgVal(m.id,f,d.def);
  if(d.type==='boolean')return '<label style="display:block;font-size:11px;margin:2px 0"><input type="checkbox" data-mhcfg="'+m.id+'" data-f="'+f+'" data-t="boolean" '+(v?'checked':'')+'> '+esc(d.label||f)+'</label>';
  if(d.type==='number')return '<label style="display:block;font-size:11px;margin:2px 0">'+esc(d.label||f)+' <input type="number" style="width:90px;background:#0c1830;border:1px solid #2c5a94;color:#9cc4ff;border-radius:4px;padding:2px 6px" data-mhcfg="'+m.id+'" data-f="'+f+'" data-t="number" value="'+esc(v)+'"></label>';
  return '<label style="display:block;font-size:11px;margin:2px 0">'+esc(d.label||f)+' <input style="width:220px;background:#0c1830;border:1px solid #2c5a94;color:#9cc4ff;border-radius:4px;padding:2px 6px" data-mhcfg="'+m.id+'" data-f="'+f+'" data-t="string" value="'+esc(v)+'"></label>';}).join('')+
 '<button style="margin-top:4px" onclick="mhSaveCfg(\''+m.id+'\')">💾 Konfiguration speichern</button></div>';}
async function mhSaveCfg(id){const vals={};document.querySelectorAll('[data-mhcfg="'+id+'"]').forEach(el=>{const f=el.dataset.f;vals[f]=el.dataset.t==='boolean'?el.checked:el.dataset.t==='number'?Number(el.value):el.value;});
 const r=await fetch('/api/modulehub/'+id+'/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({values:vals})}).then(x=>x.json());
 alert(r.ok?'Konfiguration gespeichert.':'Fehler: '+((r.errors||[]).join(', ')||r.error||'unbekannt'));mhTick();}
async function mhExec(id,action){const inp=prompt('Input (JSON) für '+action+' — leer lassen für {}:',action==='greet'?'{"name":"Arena"}':'{}');let input={};
 if(inp&&inp.trim()){try{input=JSON.parse(inp);}catch(e){alert('Ungültiges JSON: '+e.message);return;}}
 const r=await fetch('/api/modulehub/'+id+'/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,input})}).then(x=>x.json());
 alert(r.ok?('Ergebnis ('+r.ms+'ms):\n'+JSON.stringify(r.result,null,2)):('Fehler: '+(r.error||'unbekannt')));mhTick();}
async function mhTick(){
 const d=await (await fetch('/api/modulehub')).json();window.__mh=d;
 document.getElementById('mhPolicy').innerHTML='🧬 <b>Vertrag:</b> '+d.contract.join(' · ')+
  '<br>🔐 <b>Rechte-Katalog:</b> '+Object.keys(d.permission_catalog).map(k=>'<code>'+k+'</code>').join(' · ')+
  '<br>⏱ <b>Limits:</b> init '+Math.round(d.limits.initMs/1000)+'s · execute '+Math.round(d.limits.execMs/1000)+'s · health '+Math.round(d.limits.healthMs/1000)+'s · '+
  '<b>Zustände:</b> '+d.states.map(s=>'<code>'+s+'</code>').join(' · ')+
  '<br>📂 Modul-Verzeichnis: <code>'+esc(d.dir)+'</code> — <button onclick="mhScan()">🔁 Neu einlesen</button> <a href="/api/modulehub" style="color:#39d7ff">JSON-API</a>';
 document.getElementById('mhCards').innerHTML=d.modules.length?('<table><thead><tr><th>Modul</th><th>Typ</th><th>Status</th><th>Rechte</th><th>Aktionen</th><th>Calls/Fails</th><th>Steuerung</th></tr></thead><tbody>'+
  d.modules.map(m=>'<tr><td><b style="color:#39d7ff">'+esc(m.name)+'</b> <span style="color:#5f7186">v'+esc(m.version)+'</span><br><span style="font-size:11px;color:#8fa3c8">'+esc(m.description||'')+'</span><br>'+
   '<span style="font-size:10px;color:#5f7186">Autor: '+esc(m.author)+' · Ordner: '+esc(m.dir)+' · Abhängigkeiten: '+(m.dependencies.length?m.dependencies.map(esc).join(', '):'keine')+'</span>'+
   (m.error?'<br><span style="font-size:11px;color:#f87171">⚠ '+esc(m.error)+'</span>':'')+
   (m.integration?'<br><span style="font-size:10px;color:#ffd75f">Integration: '+esc(m.integration)+'</span>':'')+
   (m.lastHealth?'<br><span style="font-size:10px;color:#8fa3c8">Health: '+esc(JSON.stringify(m.lastHealth.result||m.lastHealth.error)).slice(0,120)+'</span>':'')+
   '<details style="font-size:11px"><summary style="cursor:pointer;color:#f5c96b">Konfiguration & Schema</summary>'+mhCfgForm(m)+'</details></td>'+
   '<td>'+esc(m.type)+'</td><td>'+mbadge(m.status)+(m.approved?'<br><span style="font-size:10px;color:#5fff9f">✓ freigegeben</span>':'')+'</td>'+
   '<td style="font-size:10px">'+(m.permissions.length?m.permissions.map(p=>'<code>'+esc(p)+'</code>').join('<br>'):'minimal (keine)')+'</td>'+
   '<td style="font-size:11px">'+(m.capabilities.length?m.capabilities.map(c=>'<button onclick="mhExec(\''+m.id+'\',\''+c+'\')">'+esc(c)+'</button>').join(' '):'—')+'</td>'+
   '<td>'+(m.stats.calls||0)+'/'+(m.stats.fails||0)+(m.stats.last_ms?'<br><span style="font-size:10px;color:#5f7186">'+m.stats.last_ms+'ms</span>':'')+'</td>'+
   '<td>'+(m.status==='needs_approval'?'<button onclick="mhCall(\''+m.id+'\',\'approve\')">✓ Freigeben</button> ':'')+
   (m.status==='disabled'?'<button onclick="mhCall(\''+m.id+'\',\'enable\')">▶ Aktivieren</button> ':'')+
   (m.status==='ready'?'<button onclick="mhCall(\''+m.id+'\',\'disable\')">⏸ Deaktivieren</button> ':'')+
   '<button onclick="mhCall(\''+m.id+'\',\'health\')">🩺 Health</button>'+(m.approved?' <button onclick="mhCall(\''+m.id+'\',\'approve\',{on:false})">🚫 Freigabe entziehen</button>':'')+'</td></tr>').join('')+'</tbody></table>')
  :'<div class="policy">Keine Module in <code>backend/modules/</code> gefunden. Jedes Verzeichnis mit <code>aura.module.json</code> wird automatisch erkannt.</div>';
 document.getElementById('mhLedger').innerHTML='<div id="ledger" style="margin-top:12px"><b>Lifecycle-Ledger:</b><br>'+(d.ledger.length?d.ledger.slice().reverse().map(e=>e.at.slice(11,19)+' ['+e.id+'] '+e.event+(e.detail?' '+esc(JSON.stringify(e.detail)):'')).join('<br>'):'keine Ereignisse')+'</div>';
}
// ---------- Dritt-Modul-Import: Prüfprotokoll sichtbar, Freigabe bleibt beim Menschen ----------
const istat=s=>({ok:'<span class="pill live">GRÜN</span>',fail:'<span class="pill q">ROT</span>',uebersprungen:'<span class="pill d">ÜBERSPRUNGEN</span>'})[s]||'<span class="pill d">'+esc(s)+'</span>';
function impProtokoll(r){
 const head='<div class="policy" style="border-color:'+(r.ok?'#1d6b3f':'#7a1f1f')+'"><b>'+(r.ok?'✅ Prüfungen bestanden':'⛔ Prüfungen nicht bestanden')+'</b> · '
  +(r.id?'<code>'+esc(r.id)+'</code> v'+esc(r.version||'—'):'kein gültiges Manifest')+' · <b>Status:</b> '+(r.status==='pending_approval'?'<span class="pill d">WARTET AUF DEINE FREIGABE</span>':'<span class="pill q">ABGELEHNT · nicht übernommen</span>')
  +(r.reason?'<br><b>Grund:</b> '+esc(r.reason):'')
  +'<br><span class="sub" style="margin:0">'+esc(r.boundary||'')+'</span></div>';
 const rows=(r.checks||[]).map(c=>'<tr><td style="white-space:nowrap">'+istat(c.status)+'</td><td><b>'+esc(c.label)+'</b>'
   +'<br><span style="font-size:10px;color:#8fa3c8">'+esc(c.detail||'')+'</span>'
   +((c.belege||[]).length?'<details style="font-size:10px"><summary style="cursor:pointer;color:#f5c96b">Belege ('+c.belege.length+')</summary><pre style="white-space:pre-wrap;margin:4px 0">'+c.belege.map(esc).join('\n')+'</pre></details>':'')
   +'</td></tr>').join('');
 return head+'<table><thead><tr><th>Ergebnis</th><th>Prüfung</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
async function impLoadSpec(){const d=await (await fetch('/api/modulehub/import')).json();
 document.getElementById('impResult').innerHTML='<div class="policy"><b>Schnittstelle v'+esc(d.spec_version)+'</b> — Erlaubte Routen: '+d.route_allowlist.map(r=>'<code>'+r.method+' '+esc(r.path)+'</code>').join(' · ')
  +'<br>Erlaubte Rechte: '+Object.keys(d.permissions).map(k=>'<code>'+esc(k)+'</code>').join(' · ')
  +'<br>Verbotsliste: '+d.forbidden_patterns.map(p=>'<code>'+esc(p.id)+'</code>').join(' · ')
  +'<br>Grenzen: '+esc(JSON.stringify(d.limits))+'<br>Quarantäne: <code>'+esc(d.quarantine_dir)+'</code></div>';}
function impFileBasis64(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=()=>rej(new Error('Datei nicht lesbar'));
 fr.onload=()=>res(String(fr.result).split(',').pop()||'');fr.readAsDataURL(file);});}
async function impSend(){
 const msg=document.getElementById('impMsg'),button=document.getElementById('impSend');
 let payload=null;
 try{
  const file=document.getElementById('impFile').files[0];
  const text=(document.getElementById('impText').value||'').trim();
  if(file){payload={name:file.name.replace(/\.zip$/i,''),data:await impFileBasis64(file)};msg.textContent='ZIP wird geprüft …';}
  else if(text){
   if(text.charAt(0)==='{'){try{payload=JSON.parse(text);}catch(e){throw new Error('Text ist kein gültiges JSON: '+e.message);}}
   else payload={data:text};
   msg.textContent='Basis64-Text wird geprüft …';
  } else {msg.textContent='Bitte ZIP-Datei wählen oder Basis64-Text einfügen.';return;}
 }catch(e){msg.textContent='Fehler: '+e.message;return;}
 button.disabled=true;
 try{
  const r=await fetch('/api/modulehub/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const body=await r.json().catch(()=>({ok:false,error:'UNGÜLTIGE ANTWORT'}));
  if(r.status===401){msg.textContent='Admin-Token nötig (x-aura-token).';return;}
  document.getElementById('impResult').innerHTML=impProtokoll(Object.assign({ok:body.ok===true},body));
  msg.textContent=body.ok?'Alle Prüfungen grün — das Modul wartet unten auf deine Freigabe.':'Nicht übernommen. Gründe stehen im Protokoll.';
  impQueue();mhTick();
 }catch(e){msg.textContent='Import fehlgeschlagen: '+e.message;}
 finally{button.disabled=false;}
}
async function impDiscard(id){await fetch('/api/modulehub/imports/discard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});impQueue();mhTick();}
async function impQueue(){
 const box=document.getElementById('impQueue');if(!box)return;
 let d;try{d=await (await fetch('/api/modulehub/imports')).json();}catch{return;}
 const items=d.imports||[];
 box.innerHTML='<div class="policy"><b>Warteschlange ('+items.length+')</b> — Freigabe erfolgt ausschließlich über das bestehende Approve-Gate; ein Klick auf „Freigeben“ ruft <code>POST /api/modulehub/&lt;id&gt;/approve</code>.</div>'
  +(items.length?'<table><thead><tr><th>Modul</th><th>Zeitpunkt</th><th>Status</th><th>Prüfungen</th><th>Entscheidung</th></tr></thead><tbody>'
   +items.slice().reverse().map(r=>'<tr><td><b style="color:#39d7ff">'+esc(r.name||r.id||'—')+'</b>'+(r.id?'<br><span style="font-size:10px;color:#8fa3c8"><code>'+esc(r.id)+'</code> v'+esc(r.version||'—')+'</span>':'')
    +'</td><td style="font-size:11px">'+esc(String(r.at||'').slice(0,19).replace('T',' '))+'</td>'
    +'<td>'+(r.status==='pending_approval'?'<span class="pill d">WARTET AUF FREIGABE</span>':'<span class="pill q">ABGELEHNT</span>')+(r.installed?'<br><span class="pill live">INSTALLIERT</span>':'')+'</td>'
    +'<td style="font-size:10px">'+(r.checks||[]).map(c=>'<span title="'+esc(c.detail||'')+'">'+(c.status==='ok'?'✅':c.status==='fail'?'⛔':'⏭')+' '+esc(c.id)+'</span>').join('<br>')
    +((r.reason&&r.ok===false)?'<br><span style="color:#f87171">'+esc(r.reason.slice(0,160))+'</span>':'')+'</td>'
    +'<td>'+(r.ok?'<button onclick="mhCall(\''+esc(r.id)+'\',\'approve\')">✓ Freigeben (installieren)</button> ':'<span class="sub" style="margin:0">nicht freigabefähig</span>')
    +'<button onclick="impDiscard(\''+esc(r.id)+'\')" style="margin-left:4px">🗑 Verwerfen</button></td></tr>').join('')
   +'</tbody></table>':'<div class="policy">Noch kein Import. Die Schleuse ist leer.</div>');
}

async function tick(){
 const d=await (await fetch('/api/containers')).json();
 const p=d.policy;
 document.getElementById('policy').innerHTML='🛡 <b>Isolations-Policy:</b> '+p.isolation+' · bei Crash: <b>'+p.on_crash+'</b> · Recovery: '+p.recovery+
  '<br>Limits: '+p.limits.max_fails+' Fails → Quarantäne · Cooldown '+Math.round(p.limits.cooldown_ms/1000)+'s · Action-Timeout '+Math.round(p.limits.timeout_ms/1000)+'s (änderbar unter <a href="/config" style="color:#f5c96b">/config</a>)';
 document.getElementById('tb').innerHTML=d.containers.map(c=>'<tr><td>#'+c.area+'</td><td>'+c.name+'</td><td>'+badge(c.container)+'</td>'+
  '<td>'+c.calls+'</td><td>'+(c.fails||'0')+'</td><td>'+(c.last_ms?c.last_ms+'ms':'—')+'</td><td>'+(c.quarantines||0)+'</td>'+
  '<td><button onclick="drill(\\''+c.area+'\\')">💥 Crash drillen</button></td></tr>').join('');
 document.getElementById('ledger').innerHTML='<b>Isolations-Ledger:</b><br>'+(d.ledger.length?d.ledger.slice().reverse().map(e=>e.at.slice(11,19)+' ['+e.event+'] '+JSON.stringify(e.detail||{})).join('<br>'):'keine Ereignisse — alle Container gesund');
}
async function drill(area){
 await fetch('/api/containers/drill',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({area})});
 tick();
}
document.getElementById('impSend').addEventListener('click',impSend);
tick();mhTick();impQueue();setInterval(tick,3000);setInterval(mhTick,7000);
</script></main></body></html>`;
};
