'use strict';
const nav = require('../src/lib/nav');
// Model Bay — offenes Modell-System (Area 79): Suche, eigene Modelle, Test, Keys.
module.exports = function modelsHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Model Bay</title>
<style>
:root{--bg:#04070d;--ink:#cfe7ff;--cy:#39d7ff;--vio:#8b7bff;--ok:#43e58c;--warn:#ffb454;--err:#ff5d5d}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 700px at 70% -10%,#0a1a33 0%,var(--bg) 55%);color:var(--ink);font-family:system-ui,Segoe UI,Roboto,sans-serif;min-height:100vh}
header{padding:22px;text-align:center}
h1{margin:0;font-size:24px;letter-spacing:4px;color:var(--cy);text-shadow:0 0 22px rgba(57,215,255,.5)}
.sub{color:#6d87a8;font-size:12.5px;margin-top:6px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:var(--cy);text-decoration:none;font-size:11.5px;background:#071120;border:1px solid #12395c;border-radius:8px;padding:5px 10px}
.wrap{max-width:1280px;margin:0 auto;padding:0 16px 60px}
.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
.card{background:linear-gradient(160deg,#081324,#060c18);border:1px solid #12395c;border-radius:14px;padding:16px;margin-bottom:14px;animation:rise .4s ease both}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.card h2{margin:0 0 10px;font-size:14px;color:var(--cy);letter-spacing:2px}
input,textarea,select{width:100%;background:#050b14;color:var(--ink);border:1px solid #1b4a75;border-radius:10px;padding:9px 12px;font-size:13px;margin:4px 0}
button{background:linear-gradient(90deg,#0e4b6e,#123a6b);color:#dff4ff;border:1px solid #2a7fb0;border-radius:10px;padding:9px 16px;font-size:12.5px;cursor:pointer;letter-spacing:1px;margin:4px 6px 0 0}
button:hover{filter:brightness(1.2)}
.row{display:flex;gap:8px;flex-wrap:wrap}
.badge{display:inline-block;font-size:10px;border-radius:10px;padding:2px 9px;letter-spacing:1px;margin-left:6px}
.live{background:#0b2e1c;color:var(--ok);border:1px solid #14532d}
.nc{background:#33240c;color:var(--warn);border:1px solid #6b4a12}
.list{font-size:12.5px;line-height:1.8}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:#050b14;border:1px solid #12395c;border-radius:10px;padding:10px;white-space:pre-wrap;max-height:260px;overflow:auto}
.chip{display:inline-block;background:#0a1a2e;border:1px solid #1b4a75;color:#9fd4ff;border-radius:12px;padding:3px 10px;font-size:11px;margin:3px 4px 0 0;cursor:pointer}
.chip:hover{border-color:var(--cy)}
.note{color:#7d94ad;font-size:11.5px;line-height:1.6}
h3{font-size:12px;color:#9fd4ff;letter-spacing:1px;margin:12px 0 6px}
#spin{display:none;color:var(--cy)}
</style></head><body>
${nav.html('/models')}
<header><h1>🧭 MODEL BAY</h1><p class="sub">offenes Modell-System · kuratierter Katalog + EIGENE Modelle + offene Suche + Test-Konsole</p></header>
<div class="wrap">
<div id="statusline" class="note" style="text-align:center;margin-bottom:12px">lade Status …</div>
<div class="grid">
 <div>
  <div class="card"><h2>🔎 OFFENE SUCHE (lokal + Ollama-Netzwerk)</h2>
   <div class="row"><input id="q" placeholder="z. B. qwen, deepseek, llama …" style="flex:1"><button onclick="doSearch()">Suchen</button><span id="spin">…</span></div>
   <div id="searchres" class="list"></div>
  </div>
  <div class="card"><h2>➕ EIGENES MODELL REGISTRIEREN</h2>
   <p class="note">Jedes reguläre Modell ist erlaubt (Ollama-Name, GGUF-Quelle, HF-Repo). Nur sicherheits-entkernte Familien (uncensored/abliterated) werden abgelehnt.</p>
   <input id="cname" placeholder="modell-name[:tag]">
   <input id="csrc" placeholder="Quelle: ollama-library | gguf-url | hf-repo | local-file">
   <input id="curl2" placeholder="Quelle-URL (optional)">
   <textarea id="cnotes" rows="2" placeholder="Notizen (optional)"></textarea>
   <button onclick="addCustom()">Registrieren</button>
   <div id="customres" class="list"></div>
   <h3>Registrierte eigene Modelle</h3><div id="customlist" class="list"></div>
  </div>
  <div class="card"><h2>🧪 TEST-KONSOLE</h2>
   <input id="tmodel" placeholder="modell-name (Katalog oder custom)">
   <textarea id="tprompt" rows="2">Sag in einem Satz, dass du läufst.</textarea>
   <button onclick="doTest()">Testen</button>
   <div id="testres" class="mono" style="margin-top:8px">noch kein Test</div>
  </div>
 </div>
 <div>
  <div class="card"><h2>🔑 NETZWERK & KEYS</h2>
   <input id="kurl" placeholder="OLLAMA_URL (z. B. http://192.168.1.10:11434)">
   <input id="khf" type="password" placeholder="HuggingFace Token (optional)">
   <input id="kreg" type="password" placeholder="Registry-Key (optional)">
   <button onclick="saveKeys()">Speichern</button>
   <div id="keyres" class="note"></div>
  </div>
  <div class="card"><h2>📦 KATALOG (kuratiert, Startpunkt)</h2><div id="catalog" class="list"></div></div>
  <div class="card"><h2>⬇ INSTALL-SKRIPT (eigene Hardware)</h2>
   <p class="note">Lädt kuratierte + deine eigenen Modelle auf deinem Rechner.</p>
   <a href="/api/ollama/install-script" style="color:var(--cy)">→ aura-ollama-install.sh herunterladen</a>
  </div>
 </div>
</div>
</div>
<script>
const $=id=>document.getElementById(id);
async function j(u,opt){const r=await fetch(u,opt);return r.json();}
async function loadStatus(){try{const s=await j('/api/ollama/status');$('statusline').innerHTML='Ollama: <b>'+s.mode+'</b> · URL '+s.url+' · Katalog '+s.total_catalog+' · eigene Modelle '+s.total_custom+' · installiert/gewünscht '+s.installed_wanted;}catch(e){$('statusline').textContent='Status-Fehler: '+e.message;}}
async function loadCatalog(){const c=await j('/api/ollama/catalog');$('catalog').innerHTML=c.map(g=>'<h3>'+g.tag+'</h3>'+g.models.map(m=>'<span class="chip" onclick="pickModel(\\''+m.name+'\\')">'+m.name+(m.installed?' ✓':'')+'</span>').join('')).join('');}
async function loadCustom(){const c=(await j('/api/ollama/custom')).custom||[];$('customlist').innerHTML=c.length?c.map(m=>'<span class="chip" onclick="pickModel(\\''+m.name+'\\')">'+m.name+' ('+m.source+')</span> <a href="#" onclick="rmCustom(\\''+m.name+'\\');return false" style="color:var(--err);font-size:11px">✕</a>').join('<br>'):'(noch keine)';}
function pickModel(n){$('tmodel').value=n;}
async function doSearch(){const q=$('q').value.trim();if(q.length<2)return;$('spin').style.display='inline';const r=await j('/api/ollama/search?q='+encodeURIComponent(q));$('spin').style.display='none';
 let h='<b>Lokal:</b> '+(r.local.length?r.local.map(m=>'<span class="chip" onclick="pickModel(\\''+m.name+'\\')">'+m.name+' ('+m.source+')</span>').join(''):'keine Treffer');
 h+='<br><b>Ollama-Netzwerk:</b> '+r.network.state+(r.network.results&&r.network.results.length?' — '+r.network.results.map(m=>'<span class="chip" onclick="regFromSearch(\\''+m.name+'\\')">'+m.name+'</span>').join(''):' — '+r.network.detail);
 h+='<br><span class="note">Tipp: Treffer aus dem Netz anklicken → wird als eigenes Modell registriert.</span>';
 $('searchres').innerHTML=h;}
async function regFromSearch(n){const r=await j('/api/ollama/custom',{method:'POST',body:JSON.stringify({name:n,source:'ollama-network',notes:'über offene Suche gefunden'})});alert(r.ok?('registriert: '+n):('Fehler: '+(r.error||'')));loadCustom();}
async function addCustom(){const r=await j('/api/ollama/custom',{method:'POST',body:JSON.stringify({name:$('cname').value,source:$('csrc').value||'ollama-library',source_url:$('curl2').value,notes:$('cnotes').value})});
 $('customres').innerHTML=r.ok?'<span style="color:var(--ok)">✓ '+(r.note||'registriert')+'</span>':'<span style="color:var(--err)">'+(r.error||'Fehler')+'</span>';if(r.ok){$('cname').value='';loadCustom();}}
async function rmCustom(n){if(!confirm('Eigenes Modell "'+n+'" wirklich entfernen?'))return;await j('/api/ollama/custom/remove',{method:'POST',body:JSON.stringify({name:n})});loadCustom();}
async function doTest(){$('testres').textContent='teste … (bei NOT-CONNECTED ehrliche Meldung)';const r=await j('/api/ollama/test',{method:'POST',body:JSON.stringify({model:$('tmodel').value.trim(),prompt:$('tprompt').value})});
 $('testres').textContent=JSON.stringify(r,null,2);}
async function saveKeys(){const r=await j('/api/ollama/keys',{method:'POST',body:JSON.stringify({ollama_url:$('kurl').value,hf_token:$('khf').value,registry_key:$('kreg').value})});
 $('keyres').innerHTML=r.ok?'<span style="color:var(--ok)">✓ gespeichert</span> — '+JSON.stringify(r.keys):('<span style="color:var(--err)">'+(r.error||'Fehler')+'</span>');loadStatus();}
loadStatus();loadCatalog();loadCustom();
</script></body></html>`;
};
