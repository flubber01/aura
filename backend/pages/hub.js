'use strict';
// AURA Multi-Screen Hub — 4 animated screens, layered themes, one live core.
const brain3dSnippet = require('./brain3d');
module.exports = function hubPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Multi-Screen Hub</title>
<style>
:root{--ink:#e8f4ff}
*{box-sizing:border-box}body{margin:0;background:#02040a;color:var(--ink);font-family:system-ui,Segoe UI,Roboto,sans-serif;overflow-x:hidden}
nav{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;gap:8px;justify-content:center;padding:10px;background:linear-gradient(180deg,rgba(2,4,10,.95),transparent)}
nav a,nav button{cursor:pointer;background:#0b1526;border:1px solid #1e3a8a;color:#8ab4ff;border-radius:20px;padding:7px 16px;font-size:12px;letter-spacing:1px;font-weight:700;text-decoration:none}
nav button.on{background:#12355e;color:#fff;box-shadow:0 0 14px rgba(57,215,255,.5)}
section{display:none;min-height:100vh;padding-top:64px;position:relative}
section.on{display:block}
/* ============ SCREEN 1: BRAIN-3D ============ */
#s-brain{background:radial-gradient(900px 600px at 50% 40%,#07203a 0%,#02040a 70%)}
.stage{position:relative;height:640px;max-width:1200px;margin:0 auto;perspective:1100px}
canvas#neurons{position:absolute;inset:0;width:100%;height:100%}
@keyframes r1{from{transform:rotateX(66deg) rotateZ(0)}to{transform:rotateX(66deg) rotateZ(360deg)}}
@keyframes r2{from{transform:rotateY(70deg) rotateZ(0)}to{transform:rotateY(70deg) rotateZ(360deg)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.dimchip{position:absolute;background:rgba(6,20,40,.85);border:1px solid rgba(57,180,255,.5);color:#bfe9ff;border-radius:14px;padding:8px 14px;font-size:12px;letter-spacing:2px;font-weight:800;animation:float 5s ease-in-out infinite;backdrop-filter:blur(3px);z-index:5}
.dimchip small{display:block;font-size:9.5px;color:#7d94ad;letter-spacing:0;font-weight:400}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
#dc1{left:50%;top:2%;transform:translateX(-50%)}#dc2{left:4%;top:30%}#dc3{right:4%;top:30%}#dc4{left:12%;bottom:6%}#dc5{right:12%;bottom:6%}
.ticker{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;padding:0 14px 30px}
.tk{background:#071120;border:1px solid #14406b;border-radius:10px;padding:8px 16px;font-size:12px;color:#7fd0ff;animation:blink 2.4s infinite}
.tk b{color:#fff}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.72}}
/* ============ SCREEN 2: MATRIX ============ */
#s-matrix{background:#010501}
canvas#rain{position:absolute;inset:0;width:100%;height:100%}
.mgrid{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;max-width:1150px;margin:0 auto;padding:10px 16px 40px}
.mpanel{background:rgba(0,12,0,.72);border:1px solid #0f5;border-radius:6px;padding:12px;color:#9f9;text-shadow:0 0 8px rgba(0,255,120,.6);font-family:ui-monospace,Menlo,monospace;font-size:12px;box-shadow:0 0 18px rgba(0,255,120,.15) inset}
.mpanel h3{margin:0 0 8px;font-size:11px;letter-spacing:2px;color:#5f5}
.mpanel b{color:#d8ffd8}
.scan{position:absolute;left:0;right:0;height:90px;background:linear-gradient(180deg,transparent,rgba(0,255,120,.12),transparent);animation:scan 4s linear infinite;pointer-events:none}
@keyframes scan{from{top:-100px}to{top:110%}}
/* ============ SCREEN 3: JARVIS ============ */
#s-jarvis{background:radial-gradient(1000px 700px at 50% 45%,#241503 0%,#050302 70%)}
.reactor{position:relative;width:340px;height:340px;margin:10px auto}
.reactor .ar{position:absolute;border-radius:50%}
.ar.a1{inset:0;border:3px solid rgba(245,165,60,.8);box-shadow:0 0 40px rgba(245,165,60,.4);animation:r1 14s linear infinite}
.ar.a2{inset:26px;border:2px dashed rgba(255,205,112,.6);animation:r2 10s linear infinite reverse}
.ar.a3{inset:52px;border:6px dotted rgba(255,170,60,.5);animation:r1 8s linear infinite}
.ar.a4{inset:96px;background:radial-gradient(circle at 40% 35%,#fff8e1,#ffb74d 40%,#7a3c00 85%);box-shadow:0 0 70px rgba(255,183,77,.9);animation:pulse 2.6s infinite}
.jdials{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;padding:6px 14px 40px}
.dial{width:150px;height:150px;border-radius:50%;border:2px solid rgba(245,165,60,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(30,17,2,.6);position:relative;animation:pulse 4s infinite}
.dial b{font-size:22px;color:#ffcf7d;text-shadow:0 0 14px rgba(255,183,77,.8)}
.dial span{font-size:9.5px;color:#c89b5a;letter-spacing:2px}
.dial::before{content:'';position:absolute;inset:-8px;border-radius:50%;border:1px dashed rgba(245,165,60,.4);animation:r1 6s linear infinite}
/* ============ SCREEN 4: COMMAND ============ */
#s-cmd .cgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;max-width:1150px;margin:0 auto;padding:6px 16px 40px}
.ccard{background:linear-gradient(160deg,#0b1526,#0a0f1d);border:1px solid #1e3a8a;border-radius:14px;padding:16px;text-decoration:none;color:var(--ink);position:relative;overflow:hidden;transition:.15s}
.ccard:hover{transform:translateY(-3px);border-color:#39d7ff}
.ccard::after{content:'';position:absolute;top:-60%;left:-60%;width:40%;height:220%;background:linear-gradient(90deg,transparent,rgba(57,215,255,.14),transparent);transform:rotate(20deg);animation:shine 3.5s infinite}
@keyframes shine{from{left:-60%}to{left:130%}}
.ccard h3{margin:0 0 4px;color:#39d7ff;font-size:14px}.ccard p{margin:0;color:#7d94ad;font-size:11.5px}
.state{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.6px;padding:2px 8px;border-radius:10px;vertical-align:2px;margin-left:6px}
.state.live{background:#0d3b2a;color:#5fff9f;box-shadow:0 0 8px rgba(95,255,159,.35)}
.state.sim{background:#3b2f0d;color:#ffd75f}
.state.off{background:#2a1520;color:#ff8fa0}
.legend{font-size:10.5px;color:#7d94ad;padding:7px 16px;display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid #12233f;background:rgba(6,10,22,.6)}
h2.scr{ text-align:center;letter-spacing:4px;font-size:15px;margin:8px 0 4px }
</style></head><body>
<nav id="tabs">
 <button data-s="s-brain" class="on">🧠 BRAIN-3D</button>
 <button data-s="s-matrix"> MATRIX</button>
 <button data-s="s-jarvis">🟨 JARVIS</button>
 <button data-s="s-cmd">🟦 COMMAND</button>
 <a href="/console">CONSOLE</a><a href="/master">HUD</a><a href="/brain">GEHIRN 2.0</a><a href="/index.html">UI</a>
</nav>
<div class="legend">STATUS-SEMANTIK: <span class="state live">LIVE</span> echte Daten/Messung · <span class="state sim">SIM</span> Simulation/Demo-Daten, klar markiert · <span class="state off">NOT-CONNECTED</span> Integration wartet auf Freischaltung (z.B. Telegram-Token, Mail-Relay, OpenRouter-Key)</div>

<section id="s-brain" class="on">
 <h2 class="scr" style="color:#7fd0ff">BLUE 3D BRAIN · 5-DIMENSIONAL AGENTIC CORE <span class="state live">LIVE</span></h2>
 <div class="stage">
  <canvas id="neurons"></canvas>
  ${brain3dSnippet('hubbraincv', { w: 540, h: 540 })}
  <div class="dimchip" id="dc1">👁 PERCEIVE<small id="d1"></small></div>
  <div class="dimchip" id="dc2">🧠 REASON<small id="d2"></small></div>
  <div class="dimchip" id="dc3">⚡ ACT<small id="d3"></small></div>
  <div class="dimchip" id="dc4">💾 REMEMBER<small id="d4"></small></div>
  <div class="dimchip" id="dc5">🛡 GOVERN<small id="d5"></small></div>
 </div>
 <div class="ticker" id="btick"></div>
</section>

<section id="s-matrix">
 <canvas id="rain"></canvas><div class="scan"></div>
 <h2 class="scr" style="color:#5f5">FOLLOW THE WHITE RABBIT · LIVE MODULE STREAM <span class="state live">LIVE</span></h2>
 <div class="mgrid" id="mgrid"></div>
</section>

<section id="s-jarvis">
 <h2 class="scr" style="color:#ffcf7d">J.A.R.V.I.S. · AT YOUR SERVICE <span class="state live">LIVE</span></h2>
 <div class="reactor"><div class="ar a1"></div><div class="ar a2"></div><div class="ar a3"></div><div class="ar a4"></div></div>
 <div class="jdials" id="jdials"></div>
 <p style="text-align:center"><a href="/jarvis" style="color:#ffcf7d;text-decoration:none;border:1px solid #5c4a1e;border-radius:10px;padding:8px 18px;font-size:12px;letter-spacing:2px">→ ZUR ECHTEN J.A.R.V.I.S.-KONSOLE (mit Stimme)</a></p>
</section>

<section id="s-cmd">
 <h2 class="scr" style="color:#39d7ff">COMMAND · ALL SCREENS & SYSTEMS</h2>
 <div class="cgrid">
  <a class="ccard" href="/index.html"><h3> Command Center UI<span class="state live">LIVE</span></h3><p>original AURA interface</p></a>
  <a class="ccard" href="/brain"><h3>🧠 Gehirn 2.0<span class="state live">LIVE</span></h3><p>5-dimensionales Radial-Layout · PERCEIVE/REASON/ACT/REMEMBER/GOVERN</p></a>
  <a class="ccard" href="/ignition"><h3>🔥 Ignition<span class="state live">LIVE</span></h3><p>master dashboard · alle Sites/Services/Health</p></a>
  <a class="ccard" href="/console"><h3>⌘ Console<span class="state live">LIVE</span></h3><p>area registry, actions, states</p></a>
  <a class="ccard" href="/master"><h3>🧠 Master HUD<span class="state live">LIVE</span></h3><p>living control grid, real telemetry</p></a>
  <a class="ccard" href="/skills"><h3>🧰 Skill DB<span class="state live">LIVE</span></h3><p>skills · 63 Rollen · Prompts</p></a>
  <a class="ccard" href="/builder"><h3>🧩 Workflow Builder<span class="state live">LIVE</span></h3><p>Rollen → Kette → Gates → JSON</p></a>
  <a class="ccard" href="/pipelines"><h3>🚀 Pipelines<span class="state live">LIVE</span></h3><p>WF-1…8 + social chain (human gates)</p></a>
  <a class="ccard" href="/research"><h3>🔎 Deep Research<span class="state live">LIVE</span></h3><p>echte GitHub-API-Recherche, ranked</p></a>
  <a class="ccard" href="/seo"><h3>📈 SEO Center<span class="state live">LIVE</span></h3><p>On-Site-Audit + sitemap + robots</p></a>
  <a class="ccard" href="/schedule"><h3>🗓 Schedule<span class="state live">LIVE</span></h3><p>wer wann wo · Konflikte · CSV</p></a>
  <a class="ccard" href="/yellowpages"><h3>📒 Yellow Pages<span class="state live">LIVE</span></h3><p>64 Links · 4 blockiert · 2 review</p></a>
  <a class="ccard" href="/deploy"><h3>📦 Deploy<span class="state live">LIVE</span></h3><p>HF search · 1-click Ollama · MCP</p></a>
  <a class="ccard" href="/hierarchy"><h3>🏛 Hierarchy<span class="state live">LIVE</span></h3><p>Ultra→Heads→Minions · Chat · Vita</p></a>
  <a class="ccard" href="/ops"><h3>🛡 Ops<span class="state live">LIVE</span></h3><p>Kill-Switch · Backups · Telegram <span class="state off">NOT-CONNECTED</span></p></a>
  <a class="ccard" href="/logs"><h3>📜 Logs & Self-Repair<span class="state live">LIVE</span></h3><p>massive JSONL-Logs · Auto-Heal · Repair-Ledger</p></a>
  <a class="ccard" href="/containers"><h3>📦 Module Containers<span class="state live">LIVE</span></h3><p>Crash-Isolation · Circuit Breaker · Quarantäne</p></a>
  <a class="ccard" href="/config"><h3>⚙ Config<span class="state live">LIVE</span></h3><p>globale Konfiguration · Hot-Reload · schema-validiert</p></a>
  <a class="ccard" href="/jarvis"><h3>🎙 J.A.R.V.I.S.<span class="state live">LIVE</span></h3><p>echter Assistent über Live-Daten · mit Stimme</p></a>
  <a class="ccard" href="/terminal"><h3>⌨ Terminal<span class="state live">LIVE</span></h3><p>sandboxed, non-root (root refused)</p></a>
  <a class="ccard" href="/minibot"><h3>🤖 MiniBot<span class="state sim">SIM</span></h3><p>BotFather-Wizard · Bot selbst wartet auf Token</p></a>
  <a class="ccard" href="/cluster"><h3>🖧 Cluster<span class="state off">NOT-CONNECTED</span></h3><p>k3s-Kit ready · 4 Server stehen aus</p></a>
  <a class="ccard" href="/arcade"><h3>🕹 Arcade<span class="state live">LIVE</span></h3><p>Reflex · Simon · Snake</p></a>
  <a class="ccard" href="/downloads"><h3>⇩ Downloads<span class="state live">LIVE</span></h3><p>ALL-TYPES catalogs (attachment)</p></a>
 </div>
</section>

<script>
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
 document.querySelectorAll('section').forEach(s=>s.classList.remove('on'));
 document.getElementById(b.dataset.s).classList.add('on');
});
// matrix rain
const rc=document.getElementById('rain'),rx=rc.getContext('2d');
function rsize(){rc.width=rc.offsetWidth;rc.height=rc.offsetHeight}rsize();addEventListener('resize',rsize);
const cols=()=>Math.floor(rc.width/14),drops=Array(400).fill(1);
setInterval(()=>{rx.fillStyle='rgba(1,5,1,.08)';rx.fillRect(0,0,rc.width,rc.height);rx.fillStyle='#0f8';rx.font='12px monospace';
 for(let i=0;i<cols();i++){rx.fillText(String.fromCharCode(0x30A0+Math.random()*96),i*14,drops[i]*14);
  if(drops[i]*14>rc.height&&Math.random()>.975)drops[i]=0;drops[i]++;}},55);
// neuron particles
const nc=document.getElementById('neurons'),nx=nc.getContext('2d');let P=[];
function nsize(){nc.width=nc.offsetWidth;nc.height=nc.offsetHeight;P=Array.from({length:70},()=>({x:Math.random()*nc.width,y:Math.random()*nc.height,vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6}));}
nsize();addEventListener('resize',nsize);
(function loop(){nx.clearRect(0,0,nc.width,nc.height);
 for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>nc.width)p.vx*=-1;if(p.y<0||p.y>nc.height)p.vy*=-1;
  nx.fillStyle='rgba(120,210,255,.8)';nx.beginPath();nx.arc(p.x,p.y,1.6,0,7);nx.fill();}
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const a=P[i],b=P[j],d=Math.hypot(a.x-b.x,a.y-b.y);
  if(d<110){nx.strokeStyle='rgba(60,170,255,'+(1-d/110)*.5+')';nx.beginPath();nx.moveTo(a.x,a.y);nx.lineTo(b.x,b.y);nx.stroke();}}
 requestAnimationFrame(loop);})();
// live fill
async function tick(){try{
 const b=await (await fetch('/api/brain')).json();
 const m=await (await fetch('/api/master')).json();
 const dims=b.dimensions;
 ['d1','d2','d3','d4','d5'].forEach((id,i)=>document.getElementById(id).textContent=dims[i].live+'/'+dims[i].modules.length+' live');
 document.getElementById('btick').innerHTML=
  ['uptime <b>'+b.uptime_s+'s</b>','tasks <b>'+b.foundation.tasks+'</b>','audit <b>'+b.foundation.audit_entries+'</b>',
   'loops <b>'+m.autonomy.loop_count+'</b>','heals <b>'+m.autonomy.heals_applied+'</b>','skills <b>'+b.counts.skills+'</b>',
   'live <b>'+b.counts.live+'</b>','restricted <b>'+b.counts.restricted+'</b>'].map(t=>'<span class="tk">'+t+'</span>').join('');
 document.getElementById('mgrid').innerHTML=dims.map(d=>'<div class="mpanel"><h3>'+d.icon+' '+d.name+'</h3>'+
   d.modules.map(x=>'<div>▸ '+x.area+' '+x.name+' :: <b>'+x.mode.toUpperCase()+'</b></div>').join('')+'</div>').join('')+
   '<div class="mpanel"><h3>⛔ POLICY</h3><div>token-harvest :: <b>REFUSED</b></div><div>socks-evasion :: <b>REFUSED</b></div><div>mining :: <b>REFUSED</b></div><div>synthetic-engagement :: <b>REFUSED</b></div></div>';
 const dial=(s,v,f)=>'<div class="dial"><b>'+v+'</b><span>'+f+'</span></div>';
 document.getElementById('jdials').innerHTML=
  dial('',b.uptime_s+'s','UPTIME')+dial('',b.foundation.tasks,'TASKS')+dial('',m.skill_telemetry.hindsight.healed_total,'HEALS')+
  dial('',Math.round(m.learning.curve.slice(-1)[0]?.success_rate*100||100)+'%','SUCCESS')+dial('',b.counts.skills,'SKILLS')+dial('',b.foundation.snapshots,'SNAPSHOTS');
}catch(e){}}
tick();setInterval(tick,4000);
</script></body></html>`;
};
