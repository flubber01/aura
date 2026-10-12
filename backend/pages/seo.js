'use strict';
// AURA — SEO Center (Area 63): honest on-site audit of AURA's own pages + sitemap/robots.
module.exports = function seoPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA SEO Center — On-Site Audit, Sitemap, Robots</title>
<meta name="description" content="AURA SEO Center: ehrliches On-Site-SEO-Audit aller AURA-Seiten — Titel, Meta-Descriptions, H1, Viewport, Alt-Texte, interne Links — plus sitemap.xml und robots.txt.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#070b12;color:#d6e4ff;font:14px/1.55 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:1100px;margin:0 auto;padding:26px 18px}
h1{font-size:26px;letter-spacing:2px;background:linear-gradient(90deg,#ffd75f,#7fffd0);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:#8fa3c8;margin:4px 0 16px}.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;background:#0d3b2a;color:#5fff9f}
table{width:100%;border-collapse:collapse;font-size:13px;background:rgba(9,15,30,.8);border-radius:10px;overflow:hidden}
td,th{padding:8px 10px;border-bottom:1px solid #16304f;text-align:left}th{color:#7d93b8;background:#0c1830}
.score{font-weight:800;font-size:15px}.hi{color:#5fff9f}.mid{color:#ffd75f}.lo{color:#ff7d7d}
details{margin:2px 0 10px}.ch{font-size:12px;padding:2px 0}.pass{color:#5fff9f}.fail{color:#ff7d7d}
.card{background:rgba(10,18,38,.82);border:1px solid #1d3a66;border-radius:12px;padding:16px;margin-bottom:14px}
nav{margin-bottom:14px;font-size:13px}nav a{color:#7fd0ff;margin-right:12px;text-decoration:none}
.btnrow a{margin-right:10px;color:#7fffd0}
</style></head><body><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/research">Research</a><a href="/builder">Builder</a></nav>
<h1>SEO CENTER</h1>
<p class="sub">Area 63 · ehrliches On-Site-Audit der eigenen Seiten — Manipulation anderer Plattformen ist und bleibt ausgeschlossen <span class="pill">LIVE</span></p>
<div class="card btnrow"><b>Technische Dateien:</b> <a href="/sitemap.xml">sitemap.xml</a> · <a href="/robots.txt">robots.txt</a> · <a href="/api/seo" download>audit.json ⬇</a></div>
<div id="out"><p style="color:#8fa3c8">Lade Audit…</p></div>
<script>
async function boot(){
 const r=await (await fetch('/api/seo')).json();
 const cl=s=>s>=80?'hi':s>=55?'mid':'lo';
 document.getElementById('out').innerHTML=
 '<div class="card"><h2 style="color:#ffd75f">Ø Score: <span class="score '+cl(r.avgScore)+'">'+r.avgScore+'</span>/100 über '+r.audited+' Seiten · '+r.at+'</h2></div>'+
 '<table><tr><th>Seite</th><th>Score</th><th>Titel</th><th>Checks</th></tr>'+
 r.pages.map(p=>'<tr><td><a href="'+p.route+'" style="color:#7fd0ff">'+p.route+'</a></td>'+
 '<td><span class="score '+cl(p.score)+'">'+p.score+'</span></td><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(p.title||'—')+'</td>'+
 '<td><details><summary>'+p.checks.filter(c=>c.pass).length+'/'+p.checks.length+' bestanden</summary>'+
 p.checks.map(c=>'<div class="ch '+(c.pass?'pass':'fail')+'">'+(c.pass?'✔':'✘')+' '+c.rule+' — '+c.detail+'</div>').join('')+'</details></td></tr>').join('')+'</table>';
}
boot();
</script></main></body></html>`;
};
