'use strict';
// AURA Area 76 — Creative Studio Suite UI: 7 real generator studios.

function studioPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — Creative Studio</title>
<style>
 :root{--bg:#06070d;--line:#1c2b4a;--ink:#e8ecf5;--dim:#8fa0bd;--cy:#39d7ff;--vi:#a78bfa;--gr:#4ade80;--am:#f5c96b}
 *{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink)}
 .orbs{position:fixed;inset:0;z-index:-2;overflow:hidden}
 .orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.3;animation:fl 16s ease-in-out infinite}
 .o1{width:420px;height:420px;background:radial-gradient(circle,#db2777,transparent 70%);top:-8%;left:-5%}
 .o2{width:380px;height:380px;background:radial-gradient(circle,#7c3aed,transparent 70%);bottom:-10%;right:-4%;animation-delay:-5s}
 .o3{width:300px;height:300px;background:radial-gradient(circle,#0891b2,transparent 70%);top:36%;left:44%;animation-delay:-9s}
 @keyframes fl{50%{transform:translate(36px,-30px) scale(1.1)}}
 .grid{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(rgba(219,39,119,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(219,39,119,.04) 1px,transparent 1px);background-size:44px 44px;animation:pan 26s linear infinite}
 @keyframes pan{to{background-position:44px 44px}}
 .wrap{max-width:1200px;margin:0 auto;padding:30px 20px 80px}
 h1{font-size:26px;margin:0;background:linear-gradient(90deg,#f472b6,#a78bfa,#39d7ff);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:var(--dim);font-size:13px;margin:6px 0 22px;max-width:900px}
 a{color:var(--cy);text-decoration:none}
 .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;margin-bottom:16px}
 .card{background:linear-gradient(160deg,#0d1426,#0a0f1d);border:1px solid var(--line);border-radius:14px;padding:18px;position:relative;overflow:hidden}
 .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#f472b6,#a78bfa,transparent);background-size:200% 100%;animation:scan 3s linear infinite}
 @keyframes scan{to{background-position:200% 0}}
 .card h2{font-size:14px;margin:0 0 6px;color:#f472b6;letter-spacing:.5px}
 .card .d{color:var(--dim);font-size:11.5px;margin:0 0 10px}
 label{display:block;font-size:11px;color:var(--dim);margin:9px 0 3px;text-transform:uppercase;letter-spacing:.5px}
 input,select{width:100%;background:#0a0f1c;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:9px 11px;font-size:13px}
 input:focus,select:focus{outline:none;border-color:var(--vi)}
 button{background:linear-gradient(90deg,#db2777,#7c3aed);border:0;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border-radius:9px;cursor:pointer;margin-top:12px;transition:.15s;width:100%}
 button:hover{filter:brightness(1.15);transform:translateY(-1px)}
 #out{background:#0a0f1c;border:1px solid var(--line);border-radius:12px;padding:16px;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:560px;overflow:auto}
 .ok{color:var(--gr)}.err{color:#f87171}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11px;color:var(--cy)}
 .pill{border-radius:14px;padding:2px 9px;font-size:10px;font-weight:800;margin-left:5px;background:#2a1a3a;color:#c084fc}
</style></head><body>
<div class="orbs"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div></div><div class="grid"></div>
<div class="wrap">
 <div style="font-size:12px;color:var(--dim);margin-bottom:14px"><a href="/hub">← Hub</a> · <a href="/forge">Content Forge</a> · <a href="/api/studio/status">Studio-API</a> · Area 76</div>
 <h1>🎭 Creative Studio Suite</h1>
 <p class="sub">7 echte Generator-Studios — weit mehr als Kinderbücher. Jedes Studio erzeugt ein <b>vollständiges Artefakt</b> und legt es in die Forge-Bibliothek (Gate + Ledger greifen). Ehrliche Labels: <code>LOCAL-TEMPLATE-ENGINE</code>, LLM-Anbindung optional über OmniRoute.</p>
 <div class="row">
  <div class="card">
   <h2>📚 Book Studio</h2><p class="d">Kinderbuch · Roman · Sachbuch — Outline + Kapitel + Cover-Brief</p>
   <label>Thema</label><input id="b_theme" placeholder="z. B. Mut im Alltag">
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label>Genre</label><select id="b_genre"><option>kinder</option><option>roman</option><option selected>sachbuch</option></select></div>
    <div><label>Kapitel</label><input id="b_ch" type="number" value="8" min="3" max="24"></div>
   </div>
   <button onclick="gen('book',{theme:gv('b_theme'),genre:gv('b_genre'),chapters:+gv('b_ch')})">⚡ Buch erzeugen</button>
  </div>
  <div class="card">
   <h2>📰 Article Studio</h2><p class="d">Longform mit Sections, Meta-Tags, SEO-Übergabe an Area 63</p>
   <label>Thema</label><input id="a_topic" placeholder="z. B. Heimserver automatisieren">
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label>Zielgruppe</label><input id="a_aud" placeholder="Einsteiger"></div>
    <div><label>Sections</label><input id="a_sec" type="number" value="5" min="3" max="12"></div>
   </div>
   <button onclick="gen('article',{topic:gv('a_topic'),audience:gv('a_aud'),sections:+gv('a_sec')})">⚡ Artikel erzeugen</button>
  </div>
  <div class="card">
   <h2>📣 Social Studio</h2><p class="d">Post-Serien mit Hook-Varianten — Publishing nur mit Freigabe</p>
   <label>Thema</label><input id="s_topic" placeholder="z. B. Unser neues Modul-System">
   <label>Varianten</label><input id="s_var" type="number" value="3" min="1" max="6">
   <button onclick="gen('social',{topic:gv('s_topic'),variants:+gv('s_var')})">⚡ Posts erzeugen</button>
  </div>
  <div class="card">
   <h2>✉ Newsletter Studio</h2><p class="d">Betreff-Kandidaten, Blöcke, Abmelde-Hinweis (DSGVO)</p>
   <label>Thema</label><input id="n_topic" placeholder="z. B. Monats-Update">
   <button onclick="gen('newsletter',{topic:gv('n_topic')})">⚡ Newsletter erzeugen</button>
  </div>
  <div class="card">
   <h2>🎬 Script Studio</h2><p class="d">Video-Skript: Szenen, Timings, Regie-Notizen</p>
   <label>Thema</label><input id="v_topic" placeholder="z. B. AURA in 2 Minuten">
   <label>Länge (Sekunden)</label><input id="v_dur" type="number" value="120" min="30" max="900">
   <button onclick="gen('script',{topic:gv('v_topic'),duration_s:+gv('v_dur')})">⚡ Skript erzeugen</button>
  </div>
  <div class="card">
   <h2>🎙 Podcast Studio</h2><p class="d">Episoden-Run-down mit Segmenten und Timings</p>
   <label>Thema</label><input id="p_topic" placeholder="z. B. KI im Eigenbau">
   <label>Gast (optional)</label><input id="p_guest" placeholder="optional">
   <button onclick="gen('podcast',{topic:gv('p_topic'),guest:gv('p_guest')||undefined})">⚡ Run-down erzeugen</button>
  </div>
  <div class="card">
   <h2>🤝 Pitch Studio</h2><p class="d">Problem → Lösung → Nutzen → Roadmap → Risiken → Ask</p>
   <label>Projekt</label><input id="pr_topic" placeholder="z. B. AURA Root-Server-Collective">
   <button onclick="gen('pitch',{project:gv('pr_topic')})">⚡ Pitch erzeugen</button>
  </div>
 </div>
 <div class="card"><h2>Ergebnis <span id="verdict"></span></h2><div id="out">Wähle ein Studio und starte eine Generierung — jedes Ergebnis wandert als echtes Artefakt in die <a href="/forge">Forge-Bibliothek</a>.</div></div>
</div>
<script>
const $=(i)=>document.getElementById(i);const gv=(i)=>$(i).value;
async function gen(studio,fields){
 $('out').textContent='⏳ Studio arbeitet …';$('verdict').innerHTML='';
 const r=await fetch('/api/studio/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studio,...fields})});
 const j=await r.json();
 if(j.studio){
  $('verdict').innerHTML='<span class="pill">'+(j.labels||[]).join('</span> <span class="pill">')+'</span>';
  $('out').textContent=JSON.stringify(j,null,2);
 }else{
  $('verdict').innerHTML='<span class="err">✖</span>';
  $('out').textContent='Fehler: '+(j.error||r.status);
 }
}
</script>
</body></html>`;
}
module.exports = studioPageHtml;
