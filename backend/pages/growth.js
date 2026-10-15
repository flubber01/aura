'use strict';
// AURA Phase 2 — Growth Console: WF-18 Repurposing, Traffic Mesh, WF-19 Label, Unified Analytics.
// Jede Zahl trägt ihr Label (LIVE / IMPORTED / CONFIGURED / NOT-CONNECTED). Keine Auto-Veröffentlichung.
module.exports = function growthPageHtml(platforms = []) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA Growth — Repurposing · Traffic Mesh · Label · Analytics</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#070b12;color:#d6e4ff;font:14px/1.55 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:1100px;margin:0 auto;padding:26px 18px}
h1{font-size:26px;letter-spacing:2px;background:linear-gradient(90deg,#ffd75f,#7fffd0);-webkit-background-clip:text;background-clip:text;color:transparent}
h2{font-size:16px;color:#ffd75f;margin-bottom:8px}.sub{color:#8fa3c8;margin:4px 0 16px}
.card{background:rgba(10,18,38,.82);border:1px solid #1d3a66;border-radius:12px;padding:16px;margin-bottom:14px}
nav{margin-bottom:14px;font-size:13px}nav a{color:#7fd0ff;margin-right:12px;text-decoration:none}
input,textarea,select{width:100%;background:#0c1830;color:#d6e4ff;border:1px solid #1d3a66;border-radius:8px;padding:8px;font:inherit;margin-bottom:8px}
textarea{min-height:110px}button{background:#0d3b2a;color:#5fff9f;border:1px solid #1f6b4a;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:7px 9px;border-bottom:1px solid #16304f;text-align:left;vertical-align:top}th{color:#7d93b8}
.pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;margin-right:4px}
.LIVE{background:#0d3b2a;color:#5fff9f}.IMPORTED{background:#1f2f4a;color:#7fd0ff}.CONFIGURED{background:#3b3010;color:#ffd75f}.NOT-CONNECTED{background:#3a1717;color:#ff7d7d}.draft{background:#1f2f4a;color:#7fd0ff}.skipped{background:#2a2a2a;color:#aaa}.rejected{background:#3a1717;color:#ff7d7d}
.err{color:#ff7d7d;font-size:13px;white-space:pre-wrap}.ok{color:#5fff9f}
pre{white-space:pre-wrap;background:#081224;border:1px solid #16304f;border-radius:8px;padding:10px;font-size:12px;margin:6px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:800px){.grid{grid-template-columns:1fr}}
</style></head><body><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/pipelines">Pipelines</a><a href="/seo">SEO</a><a href="/ops">OPS</a></nav>
<h1>AURA GROWTH</h1>
<p class="sub">Phase 2 · nur offizielle APIs · eigene Konten · kein synthetisches Engagement · jede Veröffentlichung braucht Admin-Freigabe (REGEL 1)</p>

<div class="grid">
<div class="card"><h2>WF-18 · Repurposing: 1 Inhalt → 8 Formate</h2>
 <input id="rp-title" placeholder="Titel (min. 3 Zeichen)">
 <input id="rp-url" placeholder="Quelle/Eigene URL (https, optional)">
 <textarea id="rp-body" placeholder="Text des Inhalts (min. 80 Zeichen)"></textarea>
 <label style="font-size:13px"><input type="checkbox" id="rp-rights" style="width:auto"> Ich bestätige: eigener oder lizenzierter Inhalt (rights_ok)</label>
 <button onclick="repurpose()">Formate erzeugen (Entwürfe)</button>
 <div id="rp-out" style="margin-top:10px"></div>
</div>

<div class="card"><h2>Unified Analytics · ehrliche Labels</h2>
 <div id="an-conn"><p class="sub">lade…</p></div>
 <div id="an-rec" style="margin-top:8px"></div>
</div>
</div>

<div class="card"><h2>Traffic Mesh · Crosslink-Matrix (eigene Assets)</h2>
 <div id="mesh"><p class="sub">lade…</p></div>
</div>

<div class="card"><h2>WF-19 · Label-Release-Pipeline</h2>
 <div id="rel"><p class="sub">lade…</p></div>
</div>

<div class="card"><h2>Analytics-Import (manueller offizieller Export)</h2>
 <p class="sub">Format: JSON-Liste, z. B. <code>[{"content_ref":"asset-id","date":"2026-10-10","views":120}]</code></p>
 <select id="imp-platform"></select>
 <textarea id="imp-rows" placeholder='[{"content_ref":"...","date":"YYYY-MM-DD","views":0}]'></textarea>
 <button onclick="importRows()">Importieren</button>
 <div id="imp-out" style="margin-top:8px"></div>
</div>

<script>
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pill=s=>'<span class="pill '+esc(s)+'">'+esc(s)+'</span>';
async function jget(u){return (await fetch(u)).json();}
async function jpost(u,b){const r=await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});return {status:r.status,json:await r.json().catch(()=>({}))};}

async function repurpose(){
  const b={title:document.getElementById('rp-title').value,url:document.getElementById('rp-url').value||undefined,body:document.getElementById('rp-body').value,rights_ok:document.getElementById('rp-rights').checked};
  const r=await jpost('/api/growth/repurpose',b);
  const out=document.getElementById('rp-out');
  if(r.status!==201){out.innerHTML='<div class="err">'+esc((r.json.errors||[r.json.error||'Fehler']).join('\\n'))+'</div>';return;}
  out.innerHTML='<div class="ok">'+esc(r.json.record.id)+' · '+r.json.record.counts.draft+' Entwürfe · '+r.json.record.counts.skipped+' übersprungen · Freigabe ausstehend</div>'+
   r.json.record.drafts.map(d=>'<div style="margin-top:8px">'+pill(d.status)+'<b>'+esc(d.format)+'</b> <span class="sub">'+esc(d.notes||'')+'</span><pre>'+esc(d.text||d.markdown||'—')+'</pre></div>').join('');
}

async function loadAnalytics(){
  const d=await jget('/api/growth/analytics');
  document.getElementById('an-conn').innerHTML='<table><tr><th>Plattform</th><th>Status</th><th>Grund</th></tr>'+
   d.connectors.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+pill(c.state)+'</td><td class="sub">'+esc(c.reason)+'</td></tr>').join('')+'</table>'+
   '<p class="sub" style="margin-top:6px">'+esc(d.note)+'</p>';
  document.getElementById('an-rec').innerHTML=d.recommendations.map(x=>'<div>• '+esc(x.text)+'</div>').join('');
}

async function loadMesh(){
  const d=await jget('/api/growth/mesh');
  document.getElementById('mesh').innerHTML='<p class="sub">'+esc(d.notes)+' · Assets: '+d.assets.total+' · Vorschläge: '+d.proposals.length+' · Verwaiste Assets: '+d.orphans.length+'</p>'+
   (d.proposals.length?'<table><tr><th>Von</th><th>Nach</th><th>Status</th></tr>'+d.proposals.slice(0,60).map(p=>'<tr><td>'+esc(p.from)+' <span class="sub">'+esc(p.from_type)+'</span></td><td>'+esc(p.to)+' <span class="sub">'+esc(p.to_type)+'</span></td><td>'+pill('draft')+' Admin-Freigabe</td></tr>').join('')+'</table>':'');
}

async function loadReleases(){
  const d=await jget('/api/growth/releases');
  document.getElementById('rel').innerHTML='<p class="sub">Stufen: '+d.stages.map(esc).join(' → ')+'</p>'+
   (d.releases.length?'<table><tr><th>ID</th><th>Track</th><th>Stufe</th><th>Release</th></tr>'+d.releases.map(r=>'<tr><td>'+esc(r.id)+'</td><td>'+esc(r.track.title)+'</td><td>'+esc(r.stage)+'</td><td>'+esc(r.release_date||'—')+'</td></tr>').join('')+'</table>':'<p class="sub">Noch keine Releases. Anlage über POST /api/growth/releases.</p>');
}

async function importRows(){
  const out=document.getElementById('imp-out');
  let rows; try{rows=JSON.parse(document.getElementById('imp-rows').value);}catch{out.innerHTML='<div class="err">JSON ungültig</div>';return;}
  const r=await jpost('/api/growth/analytics/import',{platform:document.getElementById('imp-platform').value,rows});
  out.innerHTML=r.status===201?'<div class="ok">'+r.json.imported+' Zeilen importiert (Label IMPORTED)</div>':'<div class="err">'+esc((r.json.errors||[r.json.error]).join('\\n'))+'</div>';
  loadAnalytics();
}

const PLATFORMS_OPT=${JSON.stringify(platforms)};
document.getElementById('imp-platform').innerHTML=PLATFORMS_OPT.map(p=>'<option>'+esc(p)+'</option>').join('');
loadAnalytics();loadMesh();loadReleases();
</script></main></body></html>`;
};
