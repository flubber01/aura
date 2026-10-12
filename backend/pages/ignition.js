'use strict';
// IGNITION — master dashboard: ALL sites/projects/games/links/services under
// one list, health statuses, tracking & analysis charts, animated 3D look.
module.exports = function ignitionPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · IGNITION</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#02040a;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif;overflow-x:hidden}
canvas#bg{position:fixed;inset:0;z-index:0;opacity:.5}
.wrap{position:relative;z-index:1;max-width:1250px;margin:0 auto;padding:16px 16px 60px}
header{text-align:center;padding:14px 0 4px}
h1{margin:0;font-size:26px;letter-spacing:4px;background:linear-gradient(90deg,#39d7ff,#c084fc,#f5c96b);-webkit-background-clip:text;background-clip:text;color:transparent;animation:glow 3s infinite}
@keyframes glow{50%{filter:brightness(1.35)}}
.sub{color:#7d94ad;font-size:12px}
.tilt{transform-style:preserve-3d;transition:transform .15s ease-out}
.kpis{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:14px 0}
.kpi{background:rgba(11,21,38,.85);border:1px solid #23304a;border-radius:12px;padding:10px 16px;min-width:104px;text-align:center;backdrop-filter:blur(4px)}
.kpi b{display:block;font-size:20px;color:#39d7ff}.kpi span{font-size:10px;color:#7d94ad;letter-spacing:1px}
h2{font-size:12px;letter-spacing:3px;color:#f5c96b;margin:24px 0 10px;text-align:center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.item{background:rgba(11,21,38,.88);border:1px solid #23304a;border-radius:12px;padding:12px;text-decoration:none;color:inherit;transition:.15s;position:relative;overflow:hidden}
.item:hover{transform:translateY(-3px) rotateX(2deg);border-color:#39d7ff}
.item h3{margin:0 0 3px;font-size:13px;color:#7fd0ff}.item p{margin:0;font-size:11px;color:#7d94ad}
.h{position:absolute;top:8px;right:8px;font-size:9px;border-radius:10px;padding:2px 8px;font-weight:800}
.h.ok{background:#12351f;color:#4ade80}.h.warn{background:#3a2f10;color:#f5c96b}.h.bad{background:#3a1414;color:#f87171}.h.info{background:#0e2c3a;color:#39d7ff}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.ch{background:rgba(11,21,38,.88);border:1px solid #23304a;border-radius:12px;padding:12px}
.ch h3{margin:0 0 8px;font-size:11px;color:#c084fc;letter-spacing:2px}
canvas.cv{width:100%;height:150px;background:rgba(7,17,32,.7);border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:11.5px;background:rgba(11,21,38,.88);border:1px solid #23304a;border-radius:12px;overflow:hidden}
th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #1a2438}th{color:#7d94ad}
nav{position:fixed;top:10px;right:14px;z-index:5;display:flex;gap:8px}
nav a{color:#39d7ff;text-decoration:none;font-size:11px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
</style></head><body>
<canvas id="bg"></canvas>
<nav><a href="/hub">Hub</a><a href="/console">Console</a><a href="/arcade">Arcade</a><a href="/ops">OPS</a></nav>
<div class="wrap tilt" id="tilt">
<header><h1> AURA IGNITION</h1><p class="sub">everything under one list · health · tracking · analysis · live 3D</p></header>
<div class="kpis" id="kpis"></div>
<h2>SITES · PROJECTS · GAMES · LISTS · SERVICES</h2><div class="grid" id="all"></div>
<h2>SERVICE HEALTH (live modules)</h2><div class="grid" id="svc"></div>
<h2>TRACKING & ANALYSIS</h2>
<div class="charts">
 <div class="ch"><h3>AUDIT EVENTS BY AREA</h3><canvas class="cv" id="c1"></canvas></div>
 <div class="ch"><h3>LEARNING CURVE (fleet success)</h3><canvas class="cv" id="c2"></canvas></div>
 <div class="ch"><h3>MODULE MODES (donut)</h3><canvas class="cv" id="c3"></canvas></div>
</div>
<h2>TRAFFIC & SELF-REPAIR (live gemessen)</h2>
<div class="charts">
 <div class="ch"><h3>TRAFFIC (Area 65 · ehrliche Zähler)</h3><div id="traf" style="font-size:11px;line-height:1.9"></div></div>
 <div class="ch"><h3>SELF-REPAIR (Area 66 · <a href="/logs" style="color:#39d7ff">Logs →</a>)</h3><div id="rep" style="font-size:11px;line-height:1.9"></div></div>
 <div class="ch"><h3>RECURSIVE LEARNING (Area 69 · 1 Fehler max. 1×)</h3><div id="learn" style="font-size:11px;line-height:1.9"></div></div>
</div>
<h2>LIVE TRACKING FEED</h2>
<table id="feed"><thead><tr><th>time</th><th>area</th><th>event</th><th>detail</th></tr></thead><tbody></tbody></table>
</div>
<script>
// parallax 3D tilt
addEventListener('mousemove',e=>{const t=document.getElementById('tilt');
 const x=(e.clientX/innerWidth-.5)*4,y=(e.clientY/innerHeight-.5)*-4;
 t.style.transform='perspective(1200px) rotateX('+y+'deg) rotateY('+x+'deg)';});
// bg neurons
const bc=document.getElementById('bg'),bx=bc.getContext('2d');let P=[];
function rs(){bc.width=innerWidth;bc.height=innerHeight;P=Array.from({length:60},()=>({x:Math.random()*bc.width,y:Math.random()*bc.height,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5}));}
rs();addEventListener('resize',rs);
(function loop(){bx.clearRect(0,0,bc.width,bc.height);
 for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>bc.width)p.vx*=-1;if(p.y<0||p.y>bc.height)p.vy*=-1;
  bx.fillStyle='rgba(90,170,255,.5)';bx.fillRect(p.x,p.y,2,2);}
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const a=P[i],b=P[j],d=Math.hypot(a.x-b.x,a.y-b.y);
  if(d<120){bx.strokeStyle='rgba(60,140,255,'+(1-d/120)*.35+')';bx.beginPath();bx.moveTo(a.x,a.y);bx.lineTo(b.x,b.y);bx.stroke();}}
 requestAnimationFrame(loop);})();
function bar(cv,entries){const x=cv.getContext('2d');cv.width=cv.offsetWidth;cv.height=150;
 const max=Math.max(...entries.map(e=>e.v),1),w=cv.width/entries.length;
 entries.forEach((e,i)=>{x.fillStyle='#39d7ff';const h=e.v/max*130;x.fillRect(i*w+4,145-h,w-8,h);
  x.fillStyle='#7d94ad';x.font='9px sans-serif';x.save();x.translate(i*w+w/2,143);x.rotate(-.6);x.fillText(e.k,0,0);x.restore();});}
function line(cv,pts){const x=cv.getContext('2d');cv.width=cv.offsetWidth;cv.height=150;
 if(pts.length<2)return;x.strokeStyle='#4ade80';x.beginPath();
 pts.forEach((p,i)=>{const X=i/(pts.length-1)*(cv.width-20)+10,Y=140-p*120;i?x.lineTo(X,Y):x.moveTo(X,Y);});x.stroke();}
function donut(cv,parts){const x=cv.getContext('2d');cv.width=cv.offsetWidth;cv.height=150;
 const tot=parts.reduce((a,p)=>a+p.v,0);let a0=-Math.PI/2;const C=['#4ade80','#39d7ff','#f5c96b','#c084fc','#f87171'];
 parts.forEach((p,i)=>{const a1=a0+p.v/tot*2*Math.PI;x.beginPath();x.arc(75,75,55,a0,a1);x.strokeStyle=C[i%5];x.lineWidth=22;x.stroke();
  x.fillStyle=C[i%5];x.font='10px sans-serif';x.fillText(p.k+' '+p.v,160,30+i*18);a0=a1;});}
async function tick(){
 const d=await (await fetch('/api/ignition')).json();
 document.getElementById('kpis').innerHTML=
  [['areas',d.counts.total],['live',d.counts.live],['skills',d.counts.skills],['roles',d.roles],['links',d.yellowpages.total],['workflows',d.workflows],['teams',d.teams],['kill',d.ops.kill_switch.on?'☠':'✔']].map(([a,b])=>'<div class="kpi"><b>'+b+'</b><span>'+a+'</span></div>').join('');
 document.getElementById('all').innerHTML=d.catalog.map(c=>'<a class="item" href="'+c.path+'"><span class="h '+c.h+'">'+c.status+'</span><h3>'+c.name+'</h3><p>'+c.desc+'</p></a>').join('');
 document.getElementById('svc').innerHTML=d.services.map(s=>'<div class="item"><span class="h '+(s.mode==='live'?'ok':s.mode==='restricted'?'bad':s.mode==='review'?'warn':'info')+'">'+s.mode+'</span><h3>#'+s.area+' '+s.name+'</h3><p>'+(s.note||'').slice(0,70)+'</p></div>').join('');
 bar(document.getElementById('c1'),d.charts.audit_by_area);
 line(document.getElementById('c2'),d.charts.learning);
 donut(document.getElementById('c3'),d.charts.modes);
 document.querySelector('#feed tbody').innerHTML=d.feed.map(f=>'<tr><td>'+String(f.at).slice(11,19)+'</td><td>'+f.area+'</td><td>'+f.event+'</td><td>'+JSON.stringify(f).slice(0,90)+'</td></tr>').join('');
 try{
  const tr=await (await fetch('/api/traffic')).json();
  document.getElementById('traf').innerHTML='Requests gesamt: <b style="color:#39d7ff">'+tr.totalRequests+'</b> · letzte Minute: <b>'+tr.lastMinute+'</b> · Routen: '+tr.uniqueRoutes+'<br>'+
   tr.top.slice(0,6).map(t=>'· '+t.route+' → <b>'+t.hits+'</b>').join('<br>')+'<br><span style="color:#5f7186">'+tr.note+'</span>';
  const sr=await (await fetch('/api/selfrepair')).json();const c=sr.counters;
  document.getElementById('rep').innerHTML='Checks: <b style="color:#39d7ff">'+c.checks+'</b> · Probleme: <b style="color:#f5c96b">'+c.problems+'</b> · repariert: <b style="color:#4ade80">'+c.repaired+'</b> · fehlgeschlagen: <b style="color:#f87171">'+c.failed+'</b> · Log-Rotationen: '+c.rotations+'<br>'+
   'Log-Dateien: '+((sr.meta&&sr.meta.log_files||[]).map(f=>f.file+' ('+Math.round(f.bytes/1024)+'kB)').join(' · ')||'–')+'<br>'+
   'letzte Reparatur: '+(sr.repairs&&sr.repairs.length?sr.repairs[sr.repairs.length-1].action:'keine nötig · System gesund');
  const lc=await (await fetch('/api/learning')).json();
  document.getElementById('learn').innerHTML='Generation: <b style="color:#c084fc">'+lc.generation+'</b> · eindeutige Fehler: <b>'+lc.unique_failures+'</b> · Vorkommnisse: '+lc.totals.occurrences+'<br>'+
   'gelernte Fixes angewandt: <b style="color:#4ade80">'+lc.totals.fixes_applied+'</b> · Rezidive geblockt: <b style="color:#f5c96b">'+lc.totals.blocked+'</b><br>'+
   '<span style="color:#5f7186">Regel: jeder eindeutige Fehler max. 1× ungelöst · '+(lc.known_failures.length?lc.known_failures.length+' bekannte Fingerprints':'noch keine Fehler gelernt')+'</span>';
 }catch(e){document.getElementById('rep').textContent='self-repair offline: '+e.message;}
}
tick();setInterval(tick,5000);
</script></body></html>`;
};
