'use strict';
// AURA — J.A.R.V.I.S. live console: real assistant over real system state.
module.exports = function jarvisPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>J.A.R.V.I.S. — AURA Assistant · echter System-Assistent mit Stimme</title>
<meta name="description" content="J.A.R.V.I.S. für AURA: echter Assistent über Live-Systemdaten — Status, Container, Lernkurve, Backups, Logs, Research. Mit Browser-Sprachausgabe. Deterministisch und ehrlich gelabelt.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#020409;color:#cfe6ff;font:14px/1.55 'Segoe UI',system-ui,sans-serif;min-height:100vh;overflow-x:hidden}
#grid{position:fixed;inset:0;z-index:0;opacity:.35}
main{position:relative;z-index:1;max-width:1000px;margin:0 auto;padding:22px 16px}
header{text-align:center}h1{font-size:26px;letter-spacing:6px;color:#ffcf7d;text-shadow:0 0 24px rgba(255,207,125,.4)}
.sub{color:#7d94ad;font-size:12px;margin-top:2px}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#0d3b2a;color:#5fff9f}
.reactor{width:120px;height:120px;margin:16px auto;position:relative}
.ar{position:absolute;border-radius:50%;border:2px solid rgba(57,215,255,.5)}
.a1{inset:0;animation:spin 6s linear infinite;border-top-color:#39d7ff}
.a2{inset:12px;animation:spin 4s linear infinite reverse;border-left-color:#ffcf7d}
.a3{inset:26px;animation:spin 3s linear infinite;border-bottom-color:#7fffd0}
.core{position:absolute;inset:40px;border-radius:50%;background:radial-gradient(circle,#bfefff,#39d7ff 60%,transparent);box-shadow:0 0 30px #39d7ff;animation:pulse 2s infinite}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.55;transform:scale(.94)}}
#chat{background:rgba(8,14,30,.9);border:1px solid #1d3a66;border-radius:14px;padding:14px;height:400px;overflow-y:auto;margin:12px 0}
.msg{margin-bottom:10px;max-width:85%}
.u{margin-left:auto;background:#13294a;border:1px solid #2c5a94;border-radius:12px 12px 2px 12px;padding:8px 12px}
.j{background:rgba(20,16,4,.7);border:1px solid #5c4a1e;border-radius:12px 12px 12px 2px;padding:8px 12px}
.j b{color:#ffcf7d;font-size:11px;letter-spacing:2px}.u b{color:#7fd0ff;font-size:11px;letter-spacing:2px}
.j pre{white-space:pre-wrap;font-size:11px;color:#9fd8b0;margin-top:6px;background:#06101c;border-radius:6px;padding:6px}
.bar{display:flex;gap:8px}
.bar input{flex:1;background:#081226;border:1px solid #24466f;color:#cfe6ff;border-radius:10px;padding:11px;font:inherit}
.bar button{background:linear-gradient(90deg,#b8860b,#ffcf7d);color:#1a1200;border:0;border-radius:10px;padding:11px 18px;font-weight:800;cursor:pointer}
.bar button.mic{background:#0c1830;color:#7fd0ff;border:1px solid #2c5a94}.bar button.mic.on{background:#5a1020;color:#ffb0b0;border-color:#b03040;animation:pulse 1s infinite}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.chips button{background:#0c1830;border:1px solid #24466f;color:#9cc4ff;border-radius:20px;padding:5px 12px;font-size:12px;cursor:pointer}
nav{margin-bottom:10px;font-size:13px}nav a{color:#ffcf7d;margin-right:12px;text-decoration:none}
#voice{font-size:12px;color:#7d94ad;margin-top:8px}
</style></head><body><canvas id="grid"></canvas><main>
<nav><a href="/hub">Hub</a><a href="/ignition">Ignition</a><a href="/logs">Logs</a><a href="/containers">Container</a></nav>
<header><h1>J.A.R.V.I.S.</h1>
<p class="sub">Just A Rather Very Intelligent System · echter Assistent über Live-Daten · <label><input type="checkbox" id="voice" style="width:auto"> Sprachausgabe</label> <span class="pill">LIVE · DETERMINISTIC ENGINE</span></p>
<div class="reactor"><div class="ar a1"></div><div class="ar a2"></div><div class="ar a3"></div><div class="core"></div></div>
</header>
<div class="chips">
<button onclick="ask('status')">Status</button><button onclick="ask('learning')">Lernkurve</button>
<button onclick="ask('containers')">Container</button><button onclick="ask('backups')">Backups</button>
<button onclick="ask('logs')">Fehler-Log</button><button onclick="ask('traffic')">Traffic</button>
<button onclick="ask('research self hosting dashboard')">Research</button>
</div>
<div id="chat"></div>
<div class="bar"><input id="in" placeholder="Sir, was darf ich berichten? — frag mich nach status, learning, containers…" onkeydown="if(event.key==='Enter')send()"><button id="mic" class="mic" onclick="toggleMic()">🎙 Sprechen</button><button onclick="send()">SENDEN</button></div>
<p id="micnote" style="font-size:11px;color:#5f7186;margin-top:6px">Mikrofon: Browser-Spracherkennung (Chrome/Edge). Die Aufnahme wird vom Browser an dessen Spracherkennungsdienst übergeben. Erst nach Klick auf „Sprechen“ und mit Erlaubnis.</p>
<script>
const ch=document.getElementById('chat');
// (voice via browser SpeechSynthesis — no external service, works offline)
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function speak(t){if(!document.getElementById('voice').checked||!window.speechSynthesis)return;
 const u=new SpeechSynthesisUtterance(t);u.lang='en-GB';u.rate=1.05;u.pitch=.9;
 const v=speechSynthesis.getVoices().find(v=>/en[-_]GB/i.test(v.lang));if(v)u.voice=v;
 speechSynthesis.cancel();speechSynthesis.speak(u);}
function add(role,text,data){
 const d=document.createElement('div');d.className='msg '+(role==='u'?'u':'j');
 d.innerHTML='<b>'+(role==='u'?'DU':'J.A.R.V.I.S.')+'</b><br>'+esc(text)+(data?'<pre>'+esc(typeof data==='string'?data:JSON.stringify(data,null,1))+'</pre>':'');
 ch.appendChild(d);ch.scrollTop=ch.scrollHeight;return d;}
async function ask(text){
 add('u',text);
 const j=add('j','…');j.lastChild.textContent='denke…';
 const t0=Date.now();
 const r=await fetch('/api/jarvis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({msg:text})}).then(x=>x.json());
 j.querySelector('pre')?.remove();
 j.innerHTML='<b>J.A.R.V.I.S.</b><br>'+esc(r.reply)+(r.data?'<pre>'+esc(JSON.stringify(r.data,null,1))+'</pre>':'')+'<br><span style="font-size:10px;color:#5f7186">'+(Date.now()-t0)+'ms · mode '+r.mode+'</span>';
 ch.scrollTop=ch.scrollHeight;speak(r.reply);
 if(r.action==='research'){runResearch(r.data.topic);}
}
async function runResearch(topic){
 const d=document.createElement('div');d.className='msg j';
 d.innerHTML='<b>J.A.R.V.I.S. — LIVE-RECHERCHE</b><br>Frage GitHub ab zu "'+esc(topic)+'" … bitte warten.';
 ch.appendChild(d);ch.scrollTop=ch.scrollHeight;
 try{
  const res=await fetch('/api/research?q='+encodeURIComponent(topic)).then(x=>x.json());
  if(!res.ok||!res.results||!res.results.length){d.innerHTML+='<br><span style="color:#ffb0b0">Keine Ergebnisse. Vollständiges Labor: <a href="/research" style="color:#39d7ff">/research</a></span>';ch.scrollTop=ch.scrollHeight;return;}
  const top=res.results.slice(0,5).map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener" style="color:#39d7ff">'+esc(x.name)+'</a> — ★'+(x.stars||0)+' · '+esc(x.lang||'?')+(x.desc?'<br><span style="color:#8fa3b8">&nbsp;&nbsp;'+esc(x.desc)+'</span>':'')).join('<br>');
  d.innerHTML='<b>J.A.R.V.I.S. — LIVE-RECHERCHE "'+esc(topic)+'"</b> · '+res.results.length+' Treffer aus '+res.queries.length+' Suchläufen ('+esc(res.source||'GitHub API')+')<br><br>'+top+'<br><br><span style="font-size:10px;color:#5f7186">Export & Detail im Labor: <a href="/research" style="color:#39d7ff">/research</a> · mode '+esc(res.mode||'LIVE')+'</span>';
 }catch(e){d.innerHTML+='<br><span style="color:#ffb0b0">Recherche fehlgeschlagen: '+esc(e.message)+'</span>';}
 ch.scrollTop=ch.scrollHeight;
}
function send(){const i=document.getElementById('in');const t=i.value.trim();if(!t)return;i.value='';ask(t);}
// Spracheingabe: Browser-Spracherkennung (Web Speech API), Deutsch, Ergebnis landet im Eingabefeld und wird gesendet
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null,listening=false;
function toggleMic(){
 if(!SR){add('j','Spracheingabe ist in diesem Browser nicht verfügbar. Bitte Chrome oder Edge nutzen, oder Text eintippen.');return;}
 if(listening){rec&&rec.stop();return;}
 rec=new SR();rec.lang='de-DE';rec.interimResults=true;rec.continuous=false;
 const inp=document.getElementById('in'),btn=document.getElementById('mic');
 rec.onstart=()=>{listening=true;btn.textContent='■ Stopp';btn.classList.add('on');};
 rec.onresult=e=>{let t='',fin=false;for(const r of e.results){t+=r[0].transcript;if(r.isFinal)fin=true;}inp.value=t;
   if(fin){const q=t.trim();inp.value='';if(q)ask(q);}};
 rec.onerror=e=>{add('j','Mikrofon-Fehler: '+e.error+'. Mikrofon-Zugriff im Browser erlauben und nochmal versuchen.');};
 rec.onend=()=>{listening=false;btn.textContent='🎙 Sprechen';btn.classList.remove('on');};
 try{rec.start();}catch(err){add('j','Mikrofon konnte nicht gestartet werden: '+err.message);}
}
add('j','Guten Tag. Alle Systeme im grünen Bereich. Wie kann ich dienen? Sprechen Sie frei oder nutzen Sie die Schnellfragen.');
window.addEventListener('load',()=>speechSynthesis&&speechSynthesis.getVoices());
const gc=document.getElementById('grid'),gx=gc.getContext('2d');
function rs(){gc.width=innerWidth;gc.height=innerHeight}rs();addEventListener('resize',rs);
let T=0;(function loop(){gx.clearRect(0,0,gc.width,gc.height);gx.strokeStyle='rgba(57,215,255,.07)';
for(let x=0;x<gc.width;x+=44){gx.beginPath();gx.moveTo(x,0);gx.lineTo(x,gc.height);gx.stroke();}
for(let y=0;y<gc.height;y+=44){gx.beginPath();gx.moveTo(0,y);gx.lineTo(gc.width,y);gx.stroke();}
T+=.02;gx.fillStyle='rgba(255,207,125,'+(0.04+0.03*Math.sin(T))+')';gx.fillRect(0,0,gc.width,gc.height);
requestAnimationFrame(loop)})();
</script></main></body></html>`;
};
