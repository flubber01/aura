'use strict';
// Yellow Pages — searchable curated link lists.
module.exports = function yellowPagesHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Yellow Pages</title>
<style>
body{margin:0;background:#0a0803;color:#f4ecd8;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:22px;text-align:center}h1{margin:0;font-size:24px;letter-spacing:3px;color:#f5c96b;text-shadow:0 0 18px rgba(245,201,107,.4)}
.sub{color:#a89968;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:#f5c96b;text-decoration:none;font-size:11.5px;background:#171106;border:1px solid #4d3a12;border-radius:8px;padding:5px 10px}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px 50px}
.controls{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:14px 0}
input,select{background:#120d04;color:#f4ecd8;border:1px solid #4d3a12;border-radius:10px;padding:9px 12px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.card{background:linear-gradient(160deg,#171106,#100b03);border:1px solid #4d3a12;border-radius:12px;padding:14px;text-decoration:none;color:inherit;transition:.15s;position:relative;overflow:hidden}
.card:hover{transform:translateY(-3px);border-color:#f5c96b;box-shadow:0 6px 20px rgba(245,201,107,.15)}
.card h3{margin:0 0 4px;font-size:14px;color:#ffe3a1}
.card p{margin:0;font-size:12px;color:#bfae7e;line-height:1.5}
.cat{position:absolute;top:10px;right:10px;font-size:9.5px;background:#2a1f08;color:#f5c96b;border-radius:10px;padding:2px 9px;letter-spacing:1px}
.count{text-align:center;color:#a89968;font-size:12px;margin:8px 0 14px}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/pipelines">Pipelines</a><a href="/deploy">Deploy</a><a href="/cluster">Cluster</a></nav>
<header><h1>📒 AURA YELLOW PAGES</h1><p class="sub">free-for.dev · thereisanaiforthat · n8n · Kaggle · Vercel & every useful list that matches a workflow category</p></header>
<div class="wrap">
<div class="controls"><input id="q" placeholder="Search links…" style="width:320px"><select id="cat"><option value="all">all categories</option></select></div>
<div class="count" id="count"></div><div class="grid" id="grid"></div>
</div>
<script>
let L=[];
async function load(){L=(await (await fetch('/api/yellowpages')).json()).links;
 const cats=[...new Set(L.map(x=>x.category))].sort();
 const sel=document.getElementById('cat');cats.forEach(c=>sel.add(new Option(c,c)));render();}
function render(){const q=document.getElementById('q').value.toLowerCase(),c=document.getElementById('cat').value;
 const f=L.filter(x=>(c==='all'||x.category===c)&&(x.name+x.desc).toLowerCase().includes(q));
 document.getElementById('count').textContent=f.length+' of '+L.length+' curated links';
 document.getElementById('grid').innerHTML=f.map(x=>{const st=x.status||'ok';
  const blocked=st==='blocked';
  return '<a class="card" '+(blocked?'style="opacity:.55;border-color:#7f1d1d"':'')+' target="_blank" rel="noreferrer" href="'+x.url+'"><span class="cat" style="'+(blocked?'background:#3a1414;color:#f87171':st==='review'?'background:#2a1a08;color:#f5c96b':'')+'">'+(blocked?'⛔ BLOCKED':st==='review'?' REVIEW':x.category)+'</span><h3>'+x.name+'</h3><p>'+x.desc+'</p></a>';}).join('');}
document.getElementById('q').oninput=render;document.getElementById('cat').onchange=render;load();
</script></body></html>`;
};
