'use strict';
// Agent Intercom — Chat der Agenten untereinander (Area 84).
module.exports = function intercomHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Agent Intercom</title>
<style>
:root{--bg:#03060a;--ink:#d7ecff;--cy:#39d7ff;--vio:#a78bfa;--gold:#f5c96b;--ok:#43e58c}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1100px 600px at 80% -10%,#0a2033 0%,var(--bg) 55%);color:var(--ink);font-family:system-ui,Segoe UI,Roboto,sans-serif;min-height:100vh}
header{padding:20px;text-align:center}
h1{margin:0;font-size:23px;letter-spacing:4px;color:var(--cy);text-shadow:0 0 22px rgba(57,215,255,.5)}
.sub{color:#6d87a8;font-size:12px;margin-top:5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:var(--cy);text-decoration:none;font-size:11.5px;background:#071120;border:1px solid #12395c;border-radius:8px;padding:5px 10px}
.wrap{max-width:1300px;margin:0 auto;padding:0 16px 50px;display:grid;grid-template-columns:270px 1fr;gap:14px}
@media(max-width:900px){.wrap{grid-template-columns:1fr}}
.panel{background:linear-gradient(160deg,#081324,#060c18);border:1px solid #12395c;border-radius:14px;padding:14px}
.panel h2{margin:0 0 10px;font-size:12.5px;color:var(--cy);letter-spacing:2px}
.chan{display:block;width:100%;text-align:left;background:#050b14;color:#9fd4ff;border:1px solid #12395c;border-radius:10px;padding:9px 12px;font-size:12.5px;cursor:pointer;margin:5px 0}
.chan.on{border-color:var(--cy);color:#dff4ff;background:#0a1a2e}
.member{font-size:11.5px;color:#7d94ad;padding:3px 0;border-bottom:1px dashed #0d2238}
.member b{color:#bcd9f2}
#feed{height:520px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:6px 2px}
.msg{max-width:82%;padding:10px 13px;border-radius:13px;font-size:12.8px;line-height:1.55;animation:pop .3s ease both;border:1px solid transparent}
@keyframes pop{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.msg .who{font-size:10.5px;letter-spacing:1.5px;margin-bottom:4px;opacity:.9}
.msg .mode{float:right;font-size:9px;border-radius:8px;padding:1px 7px;margin-left:8px;border:1px solid transparent}
.t0{align-self:flex-end;background:linear-gradient(150deg,#251b06,#171106);border-color:#5c4a1e}
.t0 .who{color:var(--gold)}
.t1{align-self:flex-end;background:linear-gradient(150deg,#14102e,#0c0920);border-color:#3b2a63}
.t1 .who{color:var(--vio)}
.t2{align-self:flex-start;background:linear-gradient(150deg,#06222b,#04151c);border-color:#0e4b5e}
.t2 .who{color:var(--cy)}
.tadm{align-self:center;background:#101d12;border-color:#1e4630;color:#b9e8c9}
.mllm{background:#12290f;color:var(--ok);border-color:#245b1f}
.mlocal{background:#0d1a2c;color:#7fb7e8;border-color:#173a5e}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
input,textarea{flex:1;background:#050b14;color:var(--ink);border:1px solid #1b4a75;border-radius:10px;padding:9px 12px;font-size:12.5px}
button{background:linear-gradient(90deg,#0e4b6e,#123a6b);color:#dff4ff;border:1px solid #2a7fb0;border-radius:10px;padding:9px 15px;font-size:12px;cursor:pointer;letter-spacing:1px}
button:hover{filter:brightness(1.2)}
button.gold{background:linear-gradient(90deg,#5c4a1e,#6b4a12);border-color:#a8862f;color:#ffe9b8}
.note{font-size:11px;color:#6d87a8;margin-top:8px;line-height:1.6}
select{background:#050b14;color:var(--ink);border:1px solid #1b4a75;border-radius:10px;padding:9px 10px;font-size:12.5px;max-width:280px}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/hierarchy">Hierarchie</a><a href="/tower">Tower</a><a href="/models">Model Bay</a></nav>
<header><h1>📡 AGENT INTERCOM</h1><p class="sub">Heads · Superbrains · Ultra Super Brain stimmen sich ab — echte Stimmen aus Live-Daten oder dem zugewiesenen Modell</p></header>
<div class="wrap">
<div>
 <div class="panel"><h2>KANÄLE</h2><div id="chans"></div></div>
 <div class="panel" style="margin-top:12px"><h2>MITGLIEDER</h2><div id="members"></div></div>
</div>
<div class="panel">
 <h2 id="channame">#…</h2>
 <div id="feed"></div>
 <div class="row">
  <select id="agent"></select>
  <input id="topic" placeholder="Thema / Frage an den Agenten …">
  <button onclick="say()">🗣 Agent spricht</button>
 </div>
 <div class="row">
  <input id="admintext" placeholder="Als Admin mitposten …">
  <button class="gold" onclick="postAdmin()">✍ Posten</button>
  <button onclick="meeting()">📢 Besprechung starten</button>
  <button onclick="clearChan()" style="opacity:.75">🧹 Kanal leeren</button>
 </div>
 <div class="note">Stimmen: <span class="mode mlocal" style="float:none">LOKAL</span> = Agent spricht aus echten Live-Daten seines Bereichs · <span class="mode mllm" style="float:none">LLM</span> = zugewiesenes Ollama-Modell (Area 80, auf deinem Host). Besprechung: Heads → Supers → Ultra, automatisch.</div>
</div>
</div>
<script>
const $=id=>document.getElementById(id);let CH=[],CUR='bridge';
async function j(u,opt){const r=await fetch(u,opt);return r.json();}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function loadChans(){CH=(await j('/api/intercom/channels')).channels||[];
 $('chans').innerHTML=CH.map(c=>'<button class="chan'+(c.id===CUR?' on':'')+'" onclick="pick(\\''+c.id+'\\')"># '+esc(c.name)+' <span style="float:right;opacity:.6">'+c.members.length+'</span></button>').join('');
 const cur=CH.find(c=>c.id===CUR)||{members:[]};$('channame').textContent='# '+cur.name;$('members').innerHTML=cur.members.map(m=>'<div class="member"><b>'+esc(m.name)+'</b> · Tier '+m.tier+'</div>').join('');
 $('agent').innerHTML='<option value="">Agent wählen …</option>'+cur.members.map(m=>'<option value="'+m.id+'">'+esc(m.name)+'</option>').join('');
 loadFeed();}
async function loadFeed(){const ms=(await j('/api/intercom/messages?channel='+CUR+'&limit=120')).messages||[];
 $('feed').innerHTML=ms.map(m=>{const tc=m.tier===0?'t0':m.tier===1?'t1':m.tier===2?'t2':'tadm';
  return '<div class="msg '+tc+'"><span class="mode '+(m.mode==='llm'?'mllm':'mlocal')+'">'+(m.mode==='admin'?'ADMIN':m.mode.toUpperCase())+'</span><div class="who">'+esc(m.name)+'</div>'+esc(m.text)+(m.topic?'<div style="opacity:.55;font-size:11px;margin-top:4px">Thema: '+esc(m.topic)+'</div>':'')+'</div>';}).join('')||'<div class="note" style="text-align:center;margin-top:40px">Noch keine Nachrichten — lass einen Agenten sprechen oder starte eine Besprechung.</div>';
 $('feed').scrollTop=$('feed').scrollHeight;}
function pick(id){CUR=id;loadChans();}
async function say(){const a=$('agent').value;if(!a){alert('Erst einen Agenten wählen.');return;}
 const r=await j('/api/intercom/say',{method:'POST',body:JSON.stringify({channel:CUR,agent:a,topic:$('topic').value})});
 if(!r.ok)alert(r.error||'Fehler');$('topic').value='';loadFeed();}
async function postAdmin(){const t=$('admintext').value.trim();if(!t)return;
 await j('/api/intercom/post',{method:'POST',body:JSON.stringify({channel:CUR,text:t})});$('admintext').value='';loadFeed();}
async function meeting(){const topic=prompt('Thema der Besprechung?','Abstimmung der nächsten Schritte')||'Lagebesprechung';
 const btn=event.target;btn.disabled=true;btn.textContent='läuft …';
 const r=await j('/api/intercom/meeting',{method:'POST',body:JSON.stringify({topic})});
 btn.disabled=false;btn.textContent='📢 Besprechung starten';CUR='bridge';loadChans();if(!r.ok)alert(r.error||'Fehler');}
async function clearChan(){if(!confirm('Kanal #'+CUR+' wirklich leeren?'))return;
 await j('/api/intercom/clear',{method:'POST',body:JSON.stringify({channel:CUR})});loadFeed();}
loadChans();setInterval(loadFeed,5000);
</script></body></html>`;
};
