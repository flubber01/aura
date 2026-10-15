'use strict';
// Yellow Pages — admin-verwaltete Wissensbasis (Area 19 maximiert).
// Tabs: Links/Services · Kategorien · Wissen & How-tos · Brain-Feed.
module.exports = function yellowPagesHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Yellow Pages</title>
<style>
:root{--gold:#f5c96b}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(900px 500px at 50% -10%,#221803 0%,#0a0803 60%);color:#f4ecd8;font-family:system-ui,Segoe UI,Roboto,sans-serif;min-height:100vh}
header{padding:22px;text-align:center}
h1{margin:0;font-size:24px;letter-spacing:3px;color:var(--gold);text-shadow:0 0 18px rgba(245,201,107,.4)}
.sub{color:#a89968;font-size:12.5px;margin-top:6px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:var(--gold);text-decoration:none;font-size:11.5px;background:#171106;border:1px solid #4d3a12;border-radius:8px;padding:5px 10px}
.wrap{max-width:1280px;margin:0 auto;padding:0 16px 50px}
.tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:14px 0}
.tabs button{background:#171106;color:#cbb277;border:1px solid #4d3a12;border-radius:10px;padding:8px 16px;font-size:12.5px;cursor:pointer;letter-spacing:1px}
.tabs button.on{background:#2a1f08;color:var(--gold);border-color:var(--gold)}
.controls{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0}
input,select,textarea{background:#120d04;color:#f4ecd8;border:1px solid #4d3a12;border-radius:10px;padding:9px 12px;font-size:13px}
textarea{width:100%;min-height:90px}
button.act{background:linear-gradient(90deg,#4d3a12,#6b4a12);color:#ffe9b8;border:1px solid #8a6a1f;border-radius:10px;padding:8px 14px;font-size:12px;cursor:pointer;letter-spacing:1px;margin:4px 6px 0 0}
button.act:hover{filter:brightness(1.2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;margin-top:14px}
.card{background:linear-gradient(160deg,#171106,#100b03);border:1px solid #4d3a12;border-radius:12px;padding:14px;color:inherit;transition:.15s;position:relative;overflow:hidden;animation:rise .35s ease both}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.card:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 6px 20px rgba(245,201,107,.15)}
.card h3{margin:0 0 4px;font-size:14px;color:#ffe3a1;padding-right:70px}
.card p{margin:0;font-size:12px;color:#bfae7e;line-height:1.5}
.cat{position:absolute;top:10px;right:10px;font-size:9.5px;background:#2a1f08;color:var(--gold);border-radius:10px;padding:2px 9px;letter-spacing:1px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.count{text-align:center;color:#a89968;font-size:12px;margin:8px 0}
.form{background:#14100a;border:1px solid #4d3a12;border-radius:14px;padding:16px;margin:14px 0}
.form h2{margin:0 0 10px;font-size:14px;color:var(--gold);letter-spacing:2px}
.form .row{display:flex;gap:8px;flex-wrap:wrap}
.form input,.form select{flex:1;min-width:150px;margin:4px 0}
.msg{text-align:center;font-size:12.5px;margin:8px 0;min-height:16px}
.ok{color:#7fd6a4}.err{color:#e08484}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #33270d}
th{color:var(--gold);letter-spacing:1px;font-size:11px}
.small{font-size:11px;color:#a89968}
a{color:var(--gold)}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/grid">Grid</a><a href="/models">Model Bay</a><a href="/tower">Tower</a></nav>
<header><h1>📒 AURA YELLOW PAGES</h1><p class="sub">deine Wissensbasis: Links, Services, Wissen & How-tos — selbst eintragen, erweitern, verbessern und dem Brain bereitstellen</p></header>
<div class="wrap">
<div class="tabs">
 <button id="tab-links" class="on" onclick="showTab('links')">🔗 Links & Services</button>
 <button id="tab-cats" onclick="showTab('cats')">🗂 Kategorien</button>
 <button id="tab-know" onclick="showTab('know')">🧠 Wissen & How-tos</button>
 <button id="tab-feed" onclick="showTab('feed')">⚡ Brain-Feed</button>
</div>
<div class="msg" id="msg"></div>

<section id="sec-links">
 <div class="form"><h2>➕ LINK / SERVICE EINTRAGEN</h2>
  <div class="row">
   <input id="l-name" placeholder="Name">
   <input id="l-url" placeholder="https://…">
   <select id="l-cat"></select>
   <select id="l-kind"><option value="link">Link</option><option value="service">Service</option></select>
   <button class="act" onclick="addLink()">Eintragen</button>
  </div>
  <div class="row"><input id="l-desc" placeholder="Beschreibung (optional)"></div>
 </div>
 <div class="controls"><input id="q" placeholder="Suchen…" style="width:300px"><select id="fcat"><option value="all">alle Kategorien</option></select><select id="fkind"><option value="">alle Typen</option><option value="link">Links</option><option value="service">Services</option></select><button class="act" onclick="exportAll()">⬇ Export</button><button class="act" onclick="ingest()">Katalog-Ingest (Area 19)</button></div>
 <div class="count" id="count"></div><div class="grid" id="grid"></div>
</section>

<section id="sec-cats" style="display:none">
 <div class="form"><h2>➕ KATEGORIE ANLEGEN</h2>
  <div class="row"><input id="c-id" placeholder="id (z. B. mein-tooling)"><input id="c-name" placeholder="Anzeigename"><input id="c-desc" placeholder="Beschreibung"><button class="act" onclick="addCat()">Anlegen</button></div>
 </div>
 <table id="cattab"><tr><th>ID</th><th>Name</th><th>Beschreibung</th><th></th></tr></table>
</section>

<section id="sec-know" style="display:none">
 <div class="form"><h2>➕ WISSEN / HOW-TO FÜR DAS BRAIN EINTRAGEN</h2>
  <div class="row"><input id="k-name" placeholder="Titel"><select id="k-cat"></select><select id="k-kind"><option value="knowledge">Wissen</option><option value="howto">How-to</option></select></div>
  <textarea id="k-body" placeholder="Text, Know-how, Anleitung … (wird dem Brain bereitstellbar)"></textarea>
  <button class="act" onclick="addKnow()">Speichern</button>
 </div>
 <div class="grid" id="kgrid"></div>
</section>

<section id="sec-feed" style="display:none">
 <div class="form"><h2>⚡ WISSEN DEM SUPER/ULTRA-BRAIN BEREITSTELLEN</h2>
  <div class="row"><input id="f-title" placeholder="Titel des Wissenspakets" style="flex:2"><input id="f-cat" placeholder="… oder ganze Kategorie (id)" ></div>
  <div class="row"><input id="f-sum" placeholder="Kurzfassung (optional)" style="flex:2"><button class="act" onclick="makeFeed()">Bereitstellen</button><button class="act" onclick="viewBundle()">Aktuelles Bundle ansehen</button></div>
  <p class="small">Einträge vom Typ Wissen/How-to und ausgewählte Links fließen als Paket in den Brain-Kontext (GET /api/yp/brain-bundle).</p>
 </div>
 <table id="feedtab"><tr><th>Titel</th><th>Refs</th><th>Aktiv</th><th></th></tr></table>
 <pre id="bundle" style="display:none;background:#14100a;border:1px solid #4d3a12;border-radius:12px;padding:12px;font-size:11.5px;max-height:340px;overflow:auto"></pre>
</section>
</div>
<script>
const $=id=>document.getElementById(id);let L=[],CATS=[];
function msg(t,ok){$('msg').innerHTML='<span class="'+(ok?'ok':'err')+'">'+t+'</span>';setTimeout(()=>$('msg').innerHTML='',3500);}
async function j(u,opt){const r=await fetch(u,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d;}
async function loadAll(){
 L=(await j('/api/yp/list')).entries||[];CATS=(await j('/api/yp/categories')).categories||[];
 const opts='<option value="">Kategorie wählen</option>'+CATS.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
 $('l-cat').innerHTML=opts;$('k-cat').innerHTML=opts;
 $('fcat').innerHTML='<option value="all">alle Kategorien</option>'+CATS.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
 render();renderCats();renderKnow();renderFeed();}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(){
 const q=$('q').value.toLowerCase(),c=$('fcat').value,k=$('fkind').value;
 const f=L.filter(x=>(x.kind==='link'||x.kind==='service')&&(c==='all'||x.category===c)&&(!k||x.kind===k)&&((x.name||'')+(x.desc||'')).toLowerCase().includes(q));
 $('count').textContent=f.length+' von '+L.filter(x=>x.kind==='link'||x.kind==='service').length+' Einträgen';
 $('grid').innerHTML=f.map(x=>{
  const link=x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noreferrer" style="text-decoration:none;color:inherit">':'';
  return '<div class="card">'+link+'<span class="cat">'+esc(x.category)+'</span><h3>'+esc(x.name)+'</h3><p>'+esc(x.desc||'')+'</p>'+(x.url?'</a>':'')+'<div style="margin-top:8px"><button class="act" onclick="delEntry(\\''+x.id+'\\')">Löschen</button></div></div>';}).join('')||'<p class="count">Noch nichts eingetragen — leg oben los!</p>';}
function renderKnow(){
 const f=L.filter(x=>x.kind==='knowledge'||x.kind==='howto');
 $('kgrid').innerHTML=f.map(x=>'<div class="card"><span class="cat">'+esc(x.kind==='howto'?'HOW-TO':'WISSEN')+'</span><h3>'+esc(x.name)+'</h3><p>'+esc((x.body||x.desc||'').slice(0,220))+((x.body||'').length>220?' …':'')+'</p><div style="margin-top:8px"><button class="act" onclick="delEntry(\\''+x.id+'\\')">Löschen</button></div></div>').join('')||'<p class="count">Noch kein Wissen eingetragen.</p>';}
function renderCats(){
 $('cattab').innerHTML='<tr><th>ID</th><th>Name</th><th>Beschreibung</th><th></th></tr>'+CATS.map(c=>'<tr><td>'+esc(c.id)+'</td><td>'+esc(c.name)+'</td><td>'+esc(c.desc||'')+'</td><td><button class="act" onclick="delCat(\\''+c.id+'\\')">Löschen</button></td></tr>').join('');}
async function renderFeed(){
 const f=(await j('/api/yp/feed')).feed||[];
 $('feedtab').innerHTML='<tr><th>Titel</th><th>Refs</th><th>Aktiv</th><th></th></tr>'+f.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+x.refs_count+'</td><td>'+(x.active?'✓':'—')+'</td><td><button class="act" onclick="toggleFeed(\\''+x.id+'\\')">Toggle</button><button class="act" onclick="delFeed(\\''+x.id+'\\')">Löschen</button></td></tr>').join('');}
async function addLink(){try{await j('/api/yp/entries',{method:'POST',body:JSON.stringify({name:$('l-name').value,url:$('l-url').value,category:$('l-cat').value,desc:$('l-desc').value,kind:$('l-kind').value})});msg('✓ eingetragen',1);$('l-name').value='';$('l-url').value='';$('l-desc').value='';loadAll();}catch(e){msg(e.message,0);}}
async function addKnow(){try{await j('/api/yp/entries',{method:'POST',body:JSON.stringify({name:$('k-name').value,category:$('k-cat').value,kind:$('k-kind').value,body:$('k-body').value,desc:($('k-body').value||'').slice(0,150)})});msg('✓ Wissen gespeichert',1);$('k-name').value='';$('k-body').value='';loadAll();}catch(e){msg(e.message,0);}}
async function addCat(){try{await j('/api/yp/categories',{method:'POST',body:JSON.stringify({id:$('c-id').value,name:$('c-name').value,desc:$('c-desc').value})});msg('✓ Kategorie angelegt',1);$('c-id').value='';$('c-name').value='';$('c-desc').value='';loadAll();}catch(e){msg(e.message,0);}}
async function delCat(id){if(!confirm('Kategorie "'+id+'" löschen? Einträge wandern zu uncategorized.'))return;try{await j('/api/yp/categories/delete',{method:'POST',body:JSON.stringify({id})});msg('✓ gelöscht',1);loadAll();}catch(e){msg(e.message,0);}}
async function delEntry(id){if(!confirm('Eintrag wirklich löschen? (kann wiederhergestellt werden)'))return;try{await j('/api/yp/entries/delete',{method:'POST',body:JSON.stringify({id})});msg('✓ gelöscht',1);loadAll();}catch(e){msg(e.message,0);}}
async function makeFeed(){try{const r=await j('/api/yp/feed',{method:'POST',body:JSON.stringify({title:$('f-title').value,summary:$('f-sum').value,category:$('f-cat').value||undefined})});msg('✓ dem Brain bereitgestellt ('+(r.item?r.item.refs:'0')+' Refs)',1);$('f-title').value='';$('f-sum').value='';$('f-cat').value='';renderFeed();}catch(e){msg(e.message,0);}}
async function toggleFeed(id){await j('/api/yp/feed/toggle',{method:'POST',body:JSON.stringify({id})});renderFeed();}
async function delFeed(id){await j('/api/yp/feed/delete',{method:'POST',body:JSON.stringify({id})});renderFeed();}
async function viewBundle(){const b=await j('/api/yp/brain-bundle');$('bundle').style.display='block';$('bundle').textContent=JSON.stringify(b,null,2);}
function exportAll(){location.href='/api/yp/export';}
async function ingest(){try{const r=await j('/api/yp/ingest',{method:'POST',body:'{}'});msg('✓ Ingest: '+r.added+' neu übernommen',1);loadAll();}catch(e){msg(e.message,0);}}
function showTab(t){for(const s of ['links','cats','know','feed']){$('sec-'+s).style.display=s===t?'':'none';$('tab-'+s).classList.toggle('on',s===t);}}
$('q').oninput=render;$('fcat').onchange=render;$('fkind').onchange=render;
loadAll();
</script></body></html>`;
};
