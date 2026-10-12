'use strict';
// AURA Arcade — three tiny side-project games, live-feel neon.
module.exports = function arcadePageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Arcade</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:20px;text-align:center}h1{margin:0;color:#f5c96b;letter-spacing:3px;font-size:22px}
.sub{color:#7d94ad;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;max-width:1100px;margin:0 auto;padding:0 16px 50px}
.game{background:#0b1526;border:1px solid #1e3a8a;border-radius:14px;padding:16px;text-align:center}
.game h3{margin:0 0 8px;color:#39d7ff;font-size:14px}
button{background:#12355e;color:#fff;border:1px solid #1e5a8a;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;margin:4px}
#reactbox{height:140px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;cursor:pointer;background:#12351f;color:#4ade80;transition:background .1s}
canvas{background:#071120;border:1px solid #23304a;border-radius:10px}
.score{font-size:12px;color:#7d94ad;margin-top:6px}
nav{position:fixed;top:10px;right:14px}nav a{color:#f5c96b;text-decoration:none;font-size:11px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
</style></head><body>
<nav><a href="/ignition">Ignition</a><a href="/hub">Hub</a></nav>
<header><h1>🕹 AURA ARCADE</h1><p class="sub">side-project mini games — break between backups</p></header>
<div class="grid">
 <div class="game"><h3>⚡ Reflex (minion reaction test)</h3><div id="reactbox">click to arm…</div><div class="score" id="rscore">best: –</div></div>
 <div class="game"><h3>🧠 Memory Core (Simon)</h3><canvas id="simon" width="220" height="220"></canvas><div class="score" id="sscore">watch the pattern…</div><button id="sstart">start</button></div>
 <div class="game"><h3>🐍 Packet Snake</h3><canvas id="snake" width="240" height="240"></canvas><div class="score" id="kscore">arrows / swipe · score 0</div></div>
</div>
<script>
// reflex
const rb=document.getElementById('reactbox');let rt=0,rs=0,armed=false;
rb.onclick=()=>{if(!armed){armed=true;rb.style.background='#3a2f10';rb.style.color='#f5c96b';rb.textContent='wait for green…';
 rt=setTimeout(()=>{rb.style.background='#12351f';rb.style.color='#4ade80';rb.textContent='CLICK!';rs=performance.now();},800+Math.random()*2200);}
 else{armed=false;const ms=Math.round(performance.now()-rs);rb.textContent=ms+' ms';rb.style.background='#0b1526';rb.style.color='#8ab4ff';
 const b=+localStorage.rb||9999;if(ms<b)localStorage.rb=ms;document.getElementById('rscore').textContent='best: '+Math.min(ms,b)+' ms';}};
// simon
const sc=document.getElementById('simon'),sx=sc.getContext('2d');let seq=[],idx=0,phase='idle';
const PADS=[{x:10,y:10,c:'#f87171'},{x:115,y:10,c:'#4ade80'},{x:10,y:115,c:'#8ab4ff'},{x:115,y:115,c:'#f5c96b'}];
function drawS(hi){sx.clearRect(0,0,220,220);PADS.forEach((p,i)=>{sx.fillStyle=p.c;sx.globalAlpha=hi===i?1:.35;sx.fillRect(p.x,p.y,95,95);});sx.globalAlpha=1;}
drawS(-1);
async function play(){phase='show';for(const s of seq){drawS(s);await new Promise(r=>setTimeout(r,420));drawS(-1);await new Promise(r=>setTimeout(r,140));}phase='input';idx=0;document.getElementById('sscore').textContent='your turn (len '+seq.length+')';}
sc.onclick=e=>{if(phase!=='input')return;const r=sc.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 const i=PADS.findIndex(p=>x>=p.x&&x<=p.x+95&&y>=p.y&&y<=p.y+95);if(i<0)return;drawS(i);setTimeout(()=>drawS(-1),200);
 if(i!==seq[idx]){phase='idle';document.getElementById('sscore').textContent='💥 wrong — len '+seq.length;return;}
 if(++idx===seq.length){phase='idle';setTimeout(()=>{seq.push(Math.floor(Math.random()*4));play();},600);}};
document.getElementById('sstart').onclick=()=>{seq=[Math.floor(Math.random()*4)];play();};
// snake
const kc=document.getElementById('snake'),kx=kc.getContext('2d');const N=12,S=20;let sn=[{x:6,y:6}],dir={x:1,y:0},food={x:9,y:6},ks=0,kt;
function kd(){kx.fillStyle='#071120';kx.fillRect(0,0,240,240);
 kx.fillStyle='#f5c96b';kx.fillRect(food.x*S,food.y*S,S-2,S-2);
 kx.fillStyle='#39d7ff';sn.forEach(s=>kx.fillRect(s.x*S,s.y*S,S-2,S-2));}
function step(){const h={x:(sn[0].x+dir.x+N)%N,y:(sn[0].y+dir.y+N)%N};
 if(sn.some(s=>s.x===h.x&&s.y===h.y)){clearInterval(kt);document.getElementById('kscore').textContent='game over · score '+ks;return;}
 sn.unshift(h);if(h.x===food.x&&h.y===food.y){ks++;document.getElementById('kscore').textContent='score '+ks;food={x:Math.floor(Math.random()*N),y:Math.floor(Math.random()*N)};}else sn.pop();kd();}
kt=setInterval(step,180);kd();
addEventListener('keydown',e=>{const m={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}}[e.key];
 if(m&&(m.x!==-dir.x||m.y!==-dir.y))dir=m;});
</script></body></html>`;
};
