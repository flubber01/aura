'use strict';
// AURA Studio — Groove-Generator, Orchestrator, Musik-Skill-Suche.
// Reine Ansicht: nutzt nur die JSON-Routen des Servers, keine Dateien, kein Audio.
module.exports = function studioPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Studio</title>
<style>
body{margin:0;background:#080612;color:#eee9ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:20px;text-align:center}h1{margin:0;font-size:22px;letter-spacing:2px;color:#c79bff}
.sub{color:#9a8fc0;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:#c79bff;text-decoration:none;font-size:11.5px;background:#150f2a;border:1px solid #3a2a66;border-radius:8px;padding:5px 10px}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px 40px}
.panel{background:#120d24;border:1px solid #3a2a66;border-radius:12px;padding:14px;margin:14px 0}
h2{font-size:13px;letter-spacing:2px;color:#f5c96b;margin:0 0 10px}
label{display:block;font-size:11.5px;color:#9a8fc0;margin:8px 0 3px}
input,select,button{background:#0c0818;color:#eee9ff;border:1px solid #3a2a66;border-radius:8px;padding:7px 10px;font-size:13px}
button{cursor:pointer;background:#2a1a4d}
pre{background:#0a0716;border-radius:8px;padding:10px;font-size:11.5px;overflow:auto;max-height:260px;white-space:pre-wrap}
.card{background:#0c0818;border:1px solid #3a2a66;border-radius:10px;padding:10px;margin:6px 0}
.card h3{margin:0 0 4px;font-size:13.5px;color:#e0c6ff}.card p{margin:0;font-size:12px;color:#b3a7d6}
.tag{display:inline-block;font-size:10.5px;background:#2a1a4d;border-radius:8px;padding:1px 7px;margin:2px 3px 0 0}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/yellowpages">Gelbe Seiten</a><a href="/skills">Skills</a><a href="/pipelines">Pipelines</a></nav>
<header><h1>🎛 STUDIO</h1><p class="sub">Groove-Generator · Orchestrator · Musik-Skills. Nur Vorschläge, kein Audio, keine Dateien.</p></header>
<div class="wrap">

<div class="panel"><h2>GROOVE-GENERATOR</h2>
<label>Stil</label>
<select id="gstyle"><option>boom-bap</option><option>four-on-floor</option><option>trap</option><option>breakbeat</option><option>halftime</option></select>
<label>Takte (1–16)</label><input id="gbars" type="number" value="2" min="1" max="16">
<label>Swing (0–0.5)</label><input id="gswing" type="number" value="0.1" step="0.05" min="0" max="0.5">
<label>Humanize (0–0.05)</label><input id="ghum" type="number" value="0.01" step="0.005" min="0" max="0.05">
<label>Seed</label><input id="gseed" type="number" value="7">
<br><br><button id="gbtn">Groove erzeugen</button>
<pre id="gout">noch nichts erzeugt</pre></div>

<div class="panel"><h2>ORCHESTRATOR</h2>
<label>Form (Abschnitte mit Komma getrennt: intro, verse, pre, chorus, bridge, breakdown, outro)</label>
<input id="oform" value="intro,verse,chorus,verse,chorus,outro" style="width:100%;box-sizing:border-box">
<label>Takte je Abschnitt (1–64)</label><input id="obars" type="number" value="8" min="1" max="64">
<br><br><button id="obtn">Arrangement erzeugen</button>
<pre id="oout">noch nichts erzeugt</pre></div>

<div class="panel"><h2>MUSIK-SKILLS SUCHEN</h2>
<label>Suchbegriff (z. B. producer, vocal, mix, dj)</label>
<input id="sq" placeholder="z. B. backing vocal" style="width:100%;box-sizing:border-box">
<br><br><button id="sbtn">Suchen</button>
<div id="sout"></div>
<p class="sub">Die Liste enthält nur Beschreibungen. Nichts wird installiert oder ausgeführt.</p></div>

</div>
<script>
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.getElementById('gbtn').onclick=async()=>{
  const q=new URLSearchParams({style:gstyle.value,bars:gbars.value,swing:gswing.value,humanize:ghum.value,seed:gseed.value});
  const r=await fetch('/api/studio/groove?'+q);const j=await r.json();
  gout.textContent=r.ok?('Stil '+j.style+', '+j.bars+' Takt(e), '+j.hits.length+' Schläge\\n'+JSON.stringify(j.hits.slice(0,40),null,1)+(j.hits.length>40?'\\n… ('+(j.hits.length-40)+' weitere)':'')):('Fehler: '+(j.error||r.status));
};
document.getElementById('obtn').onclick=async()=>{
  const q=new URLSearchParams({form:oform.value,bars:obars.value});
  const r=await fetch('/api/studio/orchestrate?'+q);const j=await r.json();
  oout.textContent=r.ok?JSON.stringify(j,null,1):('Fehler: '+(j.error||r.status));
};
document.getElementById('sbtn').onclick=async()=>{
  const r=await fetch('/api/music/skills?q='+encodeURIComponent(sq.value));const j=await r.json();
  sout.innerHTML=(j.results||[]).length?j.results.map(s=>'<div class="card"><h3>'+esc(s.title)+' <span class="tag">'+esc(s.id)+'</span></h3><p>'+esc(s.description)+'</p><p>'+(s.tasks||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</p></div>').join(''):'<p class="sub">Keine Treffer.</p>';
};
</script></body></html>`;
};
