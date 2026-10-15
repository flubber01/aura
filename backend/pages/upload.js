'use strict';
// AURA — Daten-Upload: Link-Listen hochladen, prüfen, Vorschau, dann übernehmen.
module.exports = function uploadPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA · Daten-Upload</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020409;color:#cfe6ff;font:13px/1.5 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:980px;margin:0 auto;padding:32px 16px 40px}
nav{margin:0 0 18px;padding:9px 14px;border:1px solid #1d3a66;border-radius:12px;background:rgba(8,14,30,.85);text-align:center;font-size:13px}
nav a{color:#ffcf7d;margin:0 12px;text-decoration:none;letter-spacing:1px}
h1{font-size:22px;letter-spacing:4px;color:#7fd0ff;margin-bottom:6px}
.sub{color:#7d94ad;font-size:12px;margin-bottom:16px}
.box{background:rgba(8,14,30,.9);border:1px solid #1d3a66;border-radius:12px;padding:14px;margin-bottom:14px}
label{display:block;font-size:11px;letter-spacing:1px;color:#7d94ad;margin:8px 0 4px;text-transform:uppercase}
select,input,textarea{width:100%;background:#081226;border:1px solid #24466f;color:#cfe6ff;border-radius:8px;padding:8px 10px;font:inherit}
textarea{min-height:180px;font-family:monospace;font-size:12px}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
button{background:#0c1830;border:1px solid #2c5a94;color:#9cc4ff;border-radius:8px;padding:8px 14px;font:inherit;font-size:12px;cursor:pointer}
button.go{background:linear-gradient(90deg,#1c5a8a,#39d7ff);color:#001522;border:0;font-weight:700}
button:disabled{opacity:.4;cursor:not-allowed}
.msg{margin:10px 0;font-size:12px;color:#ffcf7d;min-height:16px;white-space:pre-wrap}
.bad{color:#ffb0b0}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
td,th{border-bottom:1px solid #12233f;padding:5px 6px;text-align:left;vertical-align:top}
th{color:#7d94ad;font-weight:600}
.stat{display:inline-block;margin-right:14px;color:#9cc4ff}.stat b{color:#ffcf7d}
.note{font-size:11px;color:#5f7186;margin-top:8px}
</style></head><body><main>
<nav><a href="/hub">Hub</a><a href="/yellowpages">Yellow Pages</a><a href="/board">Board</a><a href="/ops">Ops</a><a href="/jarvis">J.A.R.V.I.S.</a></nav>
<h1>DATEN-UPLOAD</h1>
<p class="sub">Link-Listen hochladen. Erst prüfen, dann übernehmen. Ein abgelehnter Eintrag stoppt die ganze Übernahme. Vor jeder Übernahme wird die alte Datei gesichert.</p>

<div class="box">
  <label for="kind">Quelle</label>
  <select id="kind"></select>
  <label for="file">Datei (JSON oder TXT)</label>
  <input id="file" type="file" accept=".json,.txt,.csv,application/json,text/plain">
  <label for="text">oder Text einfügen</label>
  <textarea id="text" placeholder="Yellow Pages: JSON mit links[] (name, url, category, desc)&#10;API-Katalog: name | url | category, eine Zeile pro Eintrag"></textarea>
  <div class="row">
    <button class="go" onclick="preview()">1 · Vorschau prüfen</button>
    <button id="commit" disabled onclick="commit()">2 · Übernehmen</button>
  </div>
  <div class="note">Übernehmen braucht deinen Namen und das Admin-Token (sofern gesetzt). Vorschau schreibt nichts.</div>
</div>

<div class="msg" id="msg"></div>
<div class="box" id="result" style="display:none"></div>
<script>
let READY=null;
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function msg(t,bad){const m=document.getElementById('msg');m.textContent=t;m.className='msg'+(bad?' bad':'')}
function body(){return document.getElementById('text').value}
async function loadKinds(){
  const ks=await fetch('/api/upload/kinds').then(x=>x.json());
  document.getElementById('kind').innerHTML=ks.map(k=>'<option value="'+esc(k.id)+'">'+esc(k.label)+'</option>').join('');
}
document.getElementById('file').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=()=>{document.getElementById('text').value=r.result;msg('Datei geladen: '+f.name+' ('+f.size+' Bytes). Jetzt Vorschau prüfen.');};r.readAsText(f);
});
async function preview(){
  READY=null;document.getElementById('commit').disabled=true;
  const text=body();if(!text.trim()){msg('Keine Daten. Datei wählen oder Text einfügen.',true);return;}
  const r=await fetch('/api/upload/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:document.getElementById('kind').value,text})});
  const j=await r.json();
  if(!r.ok||!j.ok){msg(j.error||('Fehler '+r.status),true);document.getElementById('result').style.display='none';return;}
  READY={kind:j.kind,text};
  const box=document.getElementById('result');box.style.display='block';
  box.innerHTML='<div><span class="stat">Gesamt <b>'+j.total+'</b></span><span class="stat">Gültig <b>'+j.accepted+'</b></span><span class="stat">Abgelehnt <b>'+j.rejected+'</b></span>'+
    (j.mode==='merge'?'<span class="stat">Neu <b>'+j.would_add+'</b></span><span class="stat">Aktualisiert <b>'+j.would_update+'</b></span>':'<span class="stat">Modus: <b>ersetzen</b></span>')+'</div>'+
    (j.rejected_items&&j.rejected_items.length?'<table><tr><th>Zeile</th><th>Name</th><th>Grund</th></tr>'+j.rejected_items.map(x=>'<tr><td>'+esc(x.line)+'</td><td>'+esc(x.name)+'</td><td class="bad">'+esc(x.reason)+'</td></tr>').join('')+'</table>':'')+
    '<div class="note">'+esc(j.note)+'</div>';
  document.getElementById('commit').disabled=!j.can_commit;
  msg(j.can_commit?'Vorschau ok.':'Vorschau mit Ablehnungen. Übernahme gesperrt.',!j.can_commit);
}
async function commit(){
  if(!READY)return;
  const by=prompt('Dein Name (nur ein Mensch gibt frei):');if(!by)return;
  const send=()=>{const h={'content-type':'application/json'};const t=sessionStorage.getItem('aura_token');if(t)h['x-aura-token']=t;
    return fetch('/api/upload/commit',{method:'POST',headers:h,body:JSON.stringify({kind:READY.kind,text:READY.text,by})});};
  let r=await send();
  if(r.status===401){const t=prompt('Admin-Token:');if(!t)return;sessionStorage.setItem('aura_token',t.trim());r=await send();}
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok){msg((j.error||('Fehler '+r.status))+(r.status===423?' — Kill-Switch aktiv':''),true);return;}
  msg('Übernommen. Neu: '+(j.added||0)+' · aktualisiert: '+(j.updated||0)+(j.backup?' · Backup: '+j.backup:''));
  READY=null;document.getElementById('commit').disabled=true;
}
loadKinds();
</script></main></body></html>`;
};
