'use strict';
// AURA — Deep Research (Area 62): real GitHub-API research, star-ranked, no hallucination.
module.exports = function researchPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA Deep Research — echte Live-Recherche über GitHub API</title>
<meta name="description" content="AURA Deep Research: Multi-Query-Fan-out über die GitHub-API, deduped, star-ranked, mit Synthese und Markdown-Export. Echte Live-Daten, keine Halluzination.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#050510;color:#d8e6ff;font:14px/1.55 'Segoe UI',system-ui,sans-serif;min-height:100vh}
#net{position:fixed;inset:0;z-index:0}main{position:relative;z-index:1;max-width:1150px;margin:0 auto;padding:26px 18px}
h1{font-size:26px;letter-spacing:2px;color:#9ff}.sub{color:#8fa3c8;margin:4px 0 16px}
.bar{display:flex;gap:8px;margin-bottom:14px}input{flex:1;background:#0a1224;border:1px solid #2a4a7a;color:#d8e6ff;border-radius:10px;padding:11px;font:inherit}
button{background:linear-gradient(90deg,#0aa,#37f);border:0;color:#fff;font-weight:700;border-radius:10px;padding:11px 20px;cursor:pointer}
button:hover{filter:brightness(1.2)}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700}
.live{background:#0d3b2a;color:#5fff9f}.sim{background:#3b2f0d;color:#ffd75f}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.k{background:rgba(10,18,40,.85);border:1px solid #22406e;border-radius:12px;padding:12px;text-align:center}
.k b{display:block;font-size:22px;color:#7fffd0}.k span{font-size:12px;color:#8fa3c8}
.res{background:rgba(8,14,32,.9);border:1px solid #1d3a66;border-radius:10px;padding:12px;margin-bottom:10px}
.res a{color:#7fd0ff;font-weight:700;text-decoration:none}.res .d{color:#93a8c9;font-size:13px;margin-top:3px}
.tag{display:inline-block;background:#132a4f;color:#9cc4ff;border-radius:6px;padding:1px 8px;font-size:11px;margin:2px 4px 0 0}
.meta{color:#6f86ac;font-size:12px;margin-top:4px}nav{margin-bottom:14px;font-size:13px}nav a{color:#7fd0ff;margin-right:12px;text-decoration:none}
</style></head><body><canvas id="net"></canvas><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/builder">Builder</a><a href="/seo">SEO</a><a href="/yellowpages">Yellow Pages</a></nav>
<h1>DEEP RESEARCH</h1>
<p class="sub">Area 62 · echte Live-Daten von api.github.com · Fan-out, Dedupe, Star-Ranking, Synthese <span class="pill live">LIVE</span></p>
<div class="bar"><input id="q" placeholder="Thema… z.B. self hosting dashboard, rust cli, voice clone" value="">
<button onclick="go()">🔎 RESEARCH</button><a id="exp" style="display:none" href="#"><button class="ghost" style="background:#12233f">⬇ MD</button></a></div>
<div id="cards" class="cards"></div><div id="out"><p style="color:#6f86ac">Thema eingeben — AURA fächert die Anfrage in bis zu 5 Sub-Queries auf, deduped und ranked nach Stars.</p></div>
<script>
const nc=document.getElementById('net'),nx=nc.getContext('2d');let P=[];
function rs(){nc.width=innerWidth;nc.height=innerHeight;P=Array.from({length:60},()=>({x:Math.random()*nc.width,y:Math.random()*nc.height,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5}))}
rs();addEventListener('resize',rs);
(function loop(){nx.clearRect(0,0,nc.width,nc.height);
for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>nc.width)p.vx*=-1;if(p.y<0||p.y>nc.height)p.vy*=-1;}
nx.strokeStyle='rgba(60,140,255,.12)';for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
const a=P[i],b=P[j],d=(a.x-b.x)**2+(a.y-b.y)**2;if(d<14000){nx.beginPath();nx.moveTo(a.x,a.y);nx.lineTo(b.x,b.y);nx.stroke()}}
nx.fillStyle='#5fa8ff';for(const p of P)nx.fillRect(p.x,p.y,2,2);requestAnimationFrame(loop)})();
async function go(){
 const q=document.getElementById('q').value.trim();if(!q)return;
 document.getElementById('out').innerHTML='<p style="color:#9ff">Recherchiere live…</p>';
 const r=await fetch('/api/research?q='+encodeURIComponent(q)).then(x=>x.json());
 if(!r.ok){document.getElementById('out').innerHTML='<p style="color:#f88">'+(r.error||'Fehler')+'</p>';return}
 const s=r.synthesis;
 document.getElementById('cards').innerHTML=
  '<div class="k"><b>'+s.total+'</b><span>Projekte</span></div>'+
  '<div class="k"><b>★'+(s.topStar/1000).toFixed(0)+'k</b><span>Top-Stars</span></div>'+
  '<div class="k"><b>'+s.activeLast90d+'</b><span>aktiv &lt;90 Tage</span></div>'+
  '<div class="k"><b>'+r.queries.length+'</b><span>Sub-Queries</span></div>';
 window._R=r.results;
 document.getElementById('out').innerHTML=r.results.map((x,i)=>
  '<div class="res"><a href="'+x.url+'" target="_blank" rel="noopener">'+x.name+'</a> '+
  '<span class="pill live">★'+x.stars.toLocaleString('de-DE')+'</span> '+
  '<button class="ghost" style="background:#12233f;float:right" onclick="yp('+i+')">＋ Yellow Pages</button>'+
  '<span class="meta">'+x.lang+' · pushed '+x.pushed+' · Lizenz '+x.license+' · via „'+x.foundVia+'“</span>'+
  '<div class="d">'+(x.desc||'')+'</div><div>'+(x.topics||[]).map(t=>'<span class="tag">'+t+'</span>').join('')+'</div></div>').join('');
 const e=document.getElementById('exp');e.style.display='';e.href='/api/research/export?q='+encodeURIComponent(q);
}
async function yp(i){
 const x=(window._R||[])[i];if(!x)return;
 const r=await fetch('/api/yellowpages/suggest',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({name:x.name,url:x.url,desc:x.desc,stars:x.stars})}).then(x=>x.json());
 alert(r.duplicate?'Schon in den Yellow Pages.':'Aufgenommen mit Status REVIEW (human-gated): '+x.name);
}
</script></main></body></html>`;
};
