'use strict';
// AURA · Skill-Katalog-Seite (nur Anzeige). Lädt /api/skills.
module.exports = function skillsPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA · Skill-Katalog</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020409;color:#cfe6ff;font:13px/1.5 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:1100px;margin:0 auto;padding:28px 16px 40px}
nav{margin:0 0 18px;padding:9px 14px;border:1px solid #1d3a66;border-radius:12px;background:rgba(8,14,30,.85);text-align:center;font-size:13px}
nav a{color:#ffcf7d;margin:0 12px;text-decoration:none;letter-spacing:1px}
h1{font-size:22px;color:#ffcf7d;margin-bottom:6px}
.note{color:#7fa6d6;margin-bottom:14px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
input,select{background:#080e1e;color:#cfe6ff;border:1px solid #1d3a66;border-radius:8px;padding:7px 10px;font:inherit}
input{flex:1;min-width:220px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #14284a;vertical-align:top}
th{color:#7fa6d6;font-weight:600}
.tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;border:1px solid}
.verfuegbar{color:#7dffb0;border-color:#2c6a48}
.pruefen{color:#ffcf7d;border-color:#7a5d1d}
.gesperrt{color:#ff8a8a;border-color:#7a2d2d}
a{color:#7fc4ff}
</style></head><body><main>
<nav><a href="/hub">Hub</a><a href="/upload">Upload</a><a href="/board">Board</a><a href="/jarvis">JARVIS</a></nav>
<h1>Skill-Katalog</h1>
<div class="note" id="meta">lade …</div>
<div class="bar">
  <input id="q" placeholder="Suche nach Name, Beschreibung, Kategorie">
  <select id="src"><option value="">alle Quellen</option></select>
  <select id="st"><option value="">alle Status</option><option>verfuegbar</option><option>pruefen</option><option>gesperrt</option></select>
</div>
<table><thead><tr><th>Skill</th><th>Quelle</th><th>Kategorie</th><th>Lizenz</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table>
<p class="note" style="margin-top:12px">Nichts wird hier installiert oder ausgeführt. „verfuegbar“ heißt nur: auf der Liste, Installation ist eine bewusste Entscheidung.</p>
<script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let timer;
async function load(){
  const p=new URLSearchParams({q:q.value,source:src.value,status:st.value,limit:'200'});
  const r=await fetch('/api/skill-catalog?'+p);
  const j=await r.json();
  if(!src.dataset.ready){ (j.sources||[]).forEach(s=>src.insertAdjacentHTML('beforeend','<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>')); src.dataset.ready='1'; }
  const c=j.counts||{};
  meta.textContent='Stand '+(j.generated_at||'–')+' · '+(j.total??0)+' Treffer · verfügbar '+(c.verfuegbar||0)+' · prüfen '+(c.pruefen||0)+' · gesperrt '+(c.gesperrt||0);
  rows.innerHTML=(j.skills||[]).map(s=>'<tr><td><a href="'+esc(s.link)+'" target="_blank" rel="noopener">'+esc(s.name)+'</a><div style="color:#7fa6d6">'+esc(s.description)+'</div>'+(s.reason?'<div style="color:#ff8a8a">'+esc(s.reason)+'</div>':'')+'</td><td>'+esc(s.source)+'</td><td>'+esc(s.category)+'</td><td>'+esc(s.license)+'</td><td><span class="tag '+esc(s.status)+'">'+esc(s.status)+'</span></td></tr>').join('')||'<tr><td colspan="5">Keine Treffer. Katalog gebaut?</td></tr>';
}
function debounced(){clearTimeout(timer);timer=setTimeout(load,200);}
q.addEventListener('input',debounced); src.addEventListener('change',load); st.addEventListener('change',load);
load();
</script>
</main></body></html>`;
};
