'use strict';
// AURA · Oberflächen-Baukasten: echte Bedienelemente statt hingerotzter Schrift.
//
// Warum es das gibt: Die vorhandenen Seiten waren größtenteils Text mit ein paar Links. Hier kommt
// ein gemeinsames Aussehen und echte Bedienelemente — Regler, Fader, Balken, Schalter, Reiter,
// Tabellen, Meldungen — die auf Handy und Rechner funktionieren. Alles serverseitig erzeugtes
// HTML/CSS/JS, kein externes Framework, keine Fremd-CDNs (kein Telefon nach Hause).
//
// Bausteine:
//  AURA_DESIGN_CSS  — das Aussehen (Farben, Abstände, Typografie, Formen) an einer Stelle
//  knob()           — Drehregler (SVG, Maus + Touch, Tastatur, Übergabe an eine Funktion)
//  fader()          — Schieberegler
//  meter()          — Pegelanzeige
//  switch_()        — Schalter
//  shell()          — ganze Seite mit Kopfzeile, Menü, Toast und Fehlerbehandlung
//  componentsPage() — Übersichtsseite aller Bausteine (zum Ansehen und Ausprobieren)
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_UI_FILE || path.join(__dirname, '..', 'data', 'ui_kit.json');

const CSS = `
:root{
  --bg:#070c10; --bg2:#0b1319; --panel:#101a22; --panel2:#152430; --line:#22384a;
  --text:#eaf2f7; --muted:#93a9b8; --gold:#e8c37a; --accent:#5ad1c0; --accent2:#7fb2ff;
  --ok:#7ddc9a; --warn:#ffd479; --bad:#ff9b8f; --radius:14px; --radius-s:9px;
  --shadow:0 18px 50px rgba(0,0,0,.45); --font:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme:light){
  :root{--bg:#f4f7f9;--bg2:#e9eff3;--panel:#fff;--panel2:#f0f5f8;--line:#cfdde6;--text:#0d1a22;--muted:#5b7280;--gold:#a5792a;--shadow:0 14px 40px rgba(16,40,60,.14)}
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:
  radial-gradient(1000px 500px at 12% -10%,rgba(90,209,192,.14),transparent 60%),
  radial-gradient(900px 500px at 88% 0%,rgba(127,178,255,.12),transparent 55%),
  var(--bg);
  color:var(--text);font:15px/1.5 var(--font);min-height:100vh;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:18px 16px 64px}
.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px;border:1px solid var(--line);
  border-radius:var(--radius);background:linear-gradient(160deg,var(--panel2),var(--panel));box-shadow:var(--shadow);margin-bottom:16px}
.brand{font-weight:800;letter-spacing:-.03em;font-size:22px;display:flex;align-items:center;gap:10px}
.brand .dot{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent)}
.ms-badge{margin-left:auto;font-size:12.5px;color:var(--muted);border:1px solid var(--line);background:var(--panel);padding:3px 11px;border-radius:999px;white-space:nowrap}
.ms-badge b{color:var(--gold)}
nav{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
nav a{color:var(--muted);text-decoration:none;font-size:13px;padding:7px 11px;border-radius:999px;border:1px solid transparent}
nav a:hover{color:var(--text);border-color:var(--line);background:var(--panel2)}
nav a.on{color:#08131a;background:var(--accent);border-color:var(--accent);font-weight:700}
h1{font-size:26px;letter-spacing:-.03em;margin:6px 0 10px}
h2{font-size:18px;margin:22px 0 10px;letter-spacing:-.01em}
h3{font-size:14px;margin:16px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
p{color:var(--text)} .lead{color:var(--muted);max-width:70ch}
.grid{display:grid;gap:14px}
.g2{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}
.card{background:linear-gradient(165deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:var(--radius);
  padding:15px;box-shadow:var(--shadow)}
.card.tight{padding:11px}
.tile{display:flex;flex-direction:column;gap:4px}
.tile .k{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.09em}
.tile .v{font-size:26px;font-weight:800;letter-spacing:-.02em}
.tile .s{font-size:12px;color:var(--muted)}
button,.btn{font:inherit;cursor:pointer;border-radius:var(--radius-s);border:1px solid var(--line);background:var(--panel2);
  color:var(--text);padding:9px 14px;font-weight:600;transition:transform .06s ease,border-color .12s,background .12s}
button:hover,.btn:hover{border-color:var(--accent);transform:translateY(-1px)}
button:active{transform:translateY(0) scale(.99)}
button.primary,.btn.primary{background:linear-gradient(150deg,var(--accent),#37b9a7);border-color:#37b9a7;color:#05201c}
button.gold{background:linear-gradient(150deg,var(--gold),#cfa451);border-color:#cfa451;color:#2b1e07}
button.danger{background:linear-gradient(150deg,#ff9b8f,#e5705f);border-color:#e5705f;color:#2a0d09}
button.ghost{background:transparent}
button:disabled{opacity:.5;cursor:not-allowed;transform:none}
input,select,textarea{font:inherit;width:100%;background:var(--bg2);color:var(--text);border:1px solid var(--line);
  border-radius:var(--radius-s);padding:9px 11px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:1px}
label{display:block;font-size:12px;color:var(--muted);margin:10px 0 4px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;
  border:1px solid var(--line);background:var(--panel2);color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.badge.ok{color:var(--ok);border-color:rgba(125,220,154,.4)}
.badge.warn{color:var(--warn);border-color:rgba(255,212,121,.4)}
.badge.bad{color:var(--bad);border-color:rgba(255,155,143,.4)}
.badge.live{color:#05201c;background:var(--accent);border-color:var(--accent)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 9px;border-bottom:1px solid var(--line)}
th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
tr:hover td{background:rgba(255,255,255,.02)}
.knob{display:inline-flex;flex-direction:column;align-items:center;gap:5px;user-select:none}
.knob svg{touch-action:none;cursor:grab;filter:drop-shadow(0 6px 16px rgba(0,0,0,.35))}
.knob svg:active{cursor:grabbing}
.knob .lbl{font-size:11px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase}
.knob .val{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}
.knob:focus-visible svg{outline:2px solid var(--accent);outline-offset:2px}
.fader{display:flex;flex-direction:column;gap:4px;min-width:120px;flex:1}
.fader input[type=range]{-webkit-appearance:none;appearance:none;height:26px;background:transparent;padding:0}
.fader input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.fader input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-6px;border-radius:50%;
  background:#fff;border:2px solid var(--accent)}
.fader input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:var(--line)}
.fader input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--accent)}
.meter{height:12px;border-radius:7px;background:var(--bg2);border:1px solid var(--line);overflow:hidden}
.meter i{display:block;height:100%;background:linear-gradient(90deg,var(--ok),var(--warn) 72%,var(--bad));transition:width .12s}
.switch{display:inline-flex;align-items:center;gap:9px;cursor:pointer}
.switch input{display:none}
.switch .track{width:44px;height:24px;border-radius:999px;background:var(--panel2);border:1px solid var(--line);position:relative;transition:background .15s}
.switch .track::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--muted);transition:transform .15s,background .15s}
.switch input:checked + .track{background:rgba(90,209,192,.25);border-color:var(--accent)}
.switch input:checked + .track::after{transform:translateX(20px);background:var(--accent)}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin:14px 0}
.tabs button{border:none;background:transparent;border-radius:0;padding:9px 12px;color:var(--muted);border-bottom:2px solid transparent}
.tabs button.on{color:var(--text);border-bottom-color:var(--accent);font-weight:700}
.toast{position:fixed;right:16px;bottom:16px;max-width:360px;background:var(--panel);border:1px solid var(--line);
  border-left:4px solid var(--accent);border-radius:var(--radius-s);padding:12px 14px;box-shadow:var(--shadow);
  font-size:13px;opacity:0;transform:translateY(10px);transition:opacity .18s,transform .18s;pointer-events:none;z-index:50}
.toast.on{opacity:1;transform:translateY(0)}
.toast.err{border-left-color:var(--bad)}
.hint{font-size:12.5px;color:var(--muted)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--panel2);border:1px solid var(--line);font-size:11.5px}
details{border:1px solid var(--line);border-radius:var(--radius-s);padding:9px 11px;background:var(--panel2);margin:8px 0}
summary{cursor:pointer;font-weight:600}
a{color:var(--accent)}
footer{color:var(--muted);font-size:12px;margin-top:26px;border-top:1px solid var(--line);padding-top:12px}
@media (max-width:560px){ nav{margin-left:0;width:100%} .brand{font-size:19px} h1{font-size:21px} }
`;

// Client-JS für die Bedienelemente: Regler ziehen (Maus/Touch/Tastatur), Reiter, Toast, API-Helfer.
const CLIENT_JS = `
(function(){
  var AURA={};
  function q(s,r){return (r||document).querySelector(s)}
  window.auraToast=function(msg,isErr){var t=q('#toast');if(!t)return;t.textContent=msg;t.className='toast on'+(isErr?' err':'');clearTimeout(t._h);t._h=setTimeout(function(){t.className='toast'},4200)};
  window.auraApi=async function(path,opts){opts=opts||{};var t=null;try{t=sessionStorage.getItem('aura_token')}catch(e){}
    var h=Object.assign({'content-type':'application/json'},opts.headers||{});if(t)h['x-aura-token']=t;
    var r=await fetch(path,{method:opts.method||'GET',headers:h,body:opts.body?JSON.stringify(opts.body):undefined});
    var j=await r.json().catch(function(){return {}});
    if(!r.ok&&!j.error)j.error='HTTP '+r.status;
    return j};
  // Regler: Wert wird über data-Attribute geführt, Änderung löst aura-onknob aus.
  function initKnobs(root){
    Array.prototype.forEach.call((root||document).querySelectorAll('.knob[data-knob]'),function(k){
      if(k._ready)return;k._ready=true;
      var min=+k.dataset.min||0,max=+k.dataset.max||100,step=+k.dataset.step||0;
      var v=+k.dataset.value;var arc=q('.arc',k),val=q('.val',k),svg=q('svg',k);
      function fmt(x){var d=step&&step<1?2:0;return (Math.round(x*100)/100).toFixed(d)+(k.dataset.unit||'')}
      function paint(){
        var t=(max-min)?(v-min)/(max-min):0, a=-135+t*270;
        if(arc){var r=26,cx=32,cy=32,rad=a*Math.PI/180,x=cx+r*Math.sin(rad),y=cy-r*Math.cos(rad);
          arc.setAttribute('x2',x.toFixed(2));arc.setAttribute('y2',y.toFixed(2));}
        if(val)val.textContent=fmt(v);k.setAttribute('aria-valuenow',String(v));
      }
      function set(nv,silent){v=Math.min(max,Math.max(min,nv));paint();
        if(!silent&&k.dataset.on){var f=window[k.dataset.on];if(typeof f==='function')f(v,k)}}
      k._set=set;
      var dragging=false,startY=0,startV=0;
      function down(e){dragging=true;startY=(e.touches?e.touches[0].clientY:e.clientY);startV=v;e.preventDefault()}
      function move(e){if(!dragging)return;var y=(e.touches?e.touches[0].clientY:e.clientY);
        var dy=(startY-y)*((max-min)/180)/(e.shiftKey?6:1);set(startV+dy)}
      function up(){dragging=false}
      if(svg){svg.addEventListener('mousedown',down);window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
        svg.addEventListener('touchstart',down,{passive:false});window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);
        svg.addEventListener('wheel',function(e){e.preventDefault();set(v+(e.deltaY<0?step||1:-(step||1)))},{passive:false});}
      k.addEventListener('keydown',function(e){if(e.key==='ArrowUp'||e.key==='ArrowRight'){set(v+(step||1));e.preventDefault()}
        else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){set(v-(step||1));e.preventDefault()}});
      paint();
    });
  }
  window.auraInitKnobs=initKnobs;
  function initTabs(){Array.prototype.forEach.call(document.querySelectorAll('.tabs'),function(t){
    t.addEventListener('click',function(e){var b=e.target.closest('button[data-tab]');if(!b)return;
      Array.prototype.forEach.call(t.querySelectorAll('button'),function(x){x.classList.toggle('on',x===b)});
      var name=b.dataset.tab;Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'),function(p){p.hidden=(p.dataset.panel!==name)})});});}
  // Meilenstein-Badge im Kopf jeder shell-Seite: echte Werte aus /api/milestones/kurz.
  // Ohne Antwort bleibt das Badge leer — es wird nichts erfunden. Neue Verleihungen → Toast.
  function initMilestones(){
    var el=q('#ms-badge');if(!el)return;
    function check(){
      auraApi('/api/milestones/kurz').then(function(j){
        if(!j||!j.stufe)return;
        el.innerHTML='🏅 <b>'+j.stufe+'</b>'+(j.naechster?' · '+j.naechster.prozent+' % → '+j.naechster.name:' · alle Ketten voll');
        var gesehen=-1;try{gesehen=localStorage.getItem('aura_ms_gesehen')}catch(e){}
        if(gesehen!==null&&+gesehen<j.verliehen)auraToast('🏅 Meilenstein verliehen — '+j.verliehen+' insgesamt, Stufe '+j.stufe);
        try{localStorage.setItem('aura_ms_gesehen',String(j.verliehen))}catch(e){}
      }).catch(function(){});
    }
    check();setInterval(check,60000);
  }
  function boot(){initKnobs();initTabs();initMilestones();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.AURA=AURA;
})();
`;

function defaults() { return { pages: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['pages', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- Bausteine
function knob(o) {
  const p = { min: 0, max: 100, value: 50, step: 1, unit: '', label: 'REGEL', on: null, ...(o || {}) };
  const a = -135 + ((p.value - p.min) / (p.max - p.min || 1)) * 270;
  const rad = (a * Math.PI) / 180;
  const x = (32 + 26 * Math.sin(rad)).toFixed(2); const y = (32 - 26 * Math.cos(rad)).toFixed(2);
  return `<div class="knob" data-knob="1" tabindex="0" role="slider" aria-valuemin="${p.min}" aria-valuemax="${p.max}" aria-valuenow="${p.value}"
    data-min="${p.min}" data-max="${p.max}" data-step="${p.step}" data-value="${p.value}" data-unit="${esc(p.unit)}"${p.on ? ` data-on="${esc(p.on)}"` : ''}>
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="22" fill="#0d1620" stroke="#22384a" stroke-width="2"/>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#152430" stroke-width="4" stroke-dasharray="141 47" stroke-dashoffset="-23" transform="rotate(90 32 32)"/>
      <line class="arc" x1="32" y1="32" x2="${x}" y2="${y}" stroke="#5ad1c0" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="4.6" fill="#5ad1c0"/>
    </svg>
    <span class="lbl">${esc(p.label)}</span><span class="val">${p.value}${esc(p.unit)}</span></div>`;
}

function fader(o) {
  const p = { min: 0, max: 100, value: 50, step: 1, label: 'FADER', on: null, ...(o || {}) };
  return `<div class="fader"><label>${esc(p.label)}</label>
    <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}"
      oninput="${p.on ? esc(p.on) + '(this.value,this)' : `this.nextElementSibling.textContent=this.value`}">
    <span class="val mono">${p.value}</span></div>`;
}

function meter(o) {
  const p = { value: 0, max: 100, label: 'PEGEL', ...(o || {}) };
  const pct = Math.max(0, Math.min(100, (p.value / p.max) * 100));
  return `<div><div class="row" style="justify-content:space-between"><span class="hint">${esc(p.label)}</span><span class="mono" id="${esc(p.id || '')}">${p.value}</span></div>
    <div class="meter"><i style="width:${pct}%"></i></div></div>`;
}

function switch_(o) {
  const p = { label: 'SCHALTER', checked: false, on: null, ...(o || {}) };
  return `<label class="switch"><input type="checkbox"${p.checked ? ' checked' : ''}${p.on ? ` onchange="${esc(p.on)}(this.checked,this)"` : ''}>
    <span class="track"></span><span>${esc(p.label)}</span></label>`;
}

function tile(o) {
  const p = { k: 'WERT', v: '—', s: '', ...(o || {}) };
  return `<div class="card tile"><span class="k">${esc(p.k)}</span><span class="v">${esc(p.v)}</span><span class="s">${esc(p.s)}</span></div>`;
}

function badge(text, kind) { return `<span class="badge${kind ? ' ' + kind : ''}">${esc(text)}</span>`; }

function table(head, rows) {
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// Nur Seiten, die wirklich ausgeliefert werden — tote Links sind unehrlich und fliegen raus.
const NAV = [
  ['/start', 'Start'], ['/hub', 'Hub'], ['/console', 'Konsole'], ['/growth', 'Growth'],
  ['/board', 'Board'], ['/design', 'Bausteine'], ['/meilensteine', 'Meilensteine'], ['/montage', 'Montage'],
];

function shell(o) {
  const p = { title: 'AURA', active: null, body: '', script: '', note: null, ...(o || {}) };
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} · AURA</title><style>${CSS}</style></head><body>
<div class="wrap">
  <header class="top">
    <span class="brand"><span class="dot"></span>AURA</span>
    <nav>${NAV.map(([href, label]) => `<a href="${href}"${p.active === href ? ' class="on"' : ''}>${label}</a>`).join('')}</nav>
    <span class="ms-badge" id="ms-badge" aria-live="polite"></span>
  </header>
  <h1>${esc(p.title)}</h1>
  ${p.note ? `<p class="lead">${p.note}</p>` : ''}
  ${p.body}
  <footer>AURA · Bedienoberfläche. Alle Zahlen kommen aus den Modulen; nichts wird zur Anzeige erfunden.</footer>
</div>
<div class="toast" id="toast"></div>
<script>${CLIENT_JS}</script>
<script>${p.script}</script>
</body></html>`;
}

function componentsPage() {
  const body = `
  <div class="grid g3">
    <div class="card"><h3>Drehregler</h3><div class="row" style="justify-content:space-around">
      ${knob({ label: 'GAIN', min: -24, max: 12, value: 0, step: 1, unit: ' dB', on: 'onGain' })}
      ${knob({ label: 'TEMPO', min: 60, max: 180, value: 140, step: 1, unit: ' bpm' })}
    </div><p class="hint">Ziehen, Mausrad, Pfeiltasten. Mit Shift feiner.</p></div>
    <div class="card"><h3>Fader & Pegel</h3>
      ${fader({ label: 'Kanal 1', min: 0, max: 127, value: 96 })}
      ${meter({ label: 'Ausgang', value: 62 })}</div>
    <div class="card"><h3>Schalter & Marken</h3>
      <div class="row">${switch_({ label: 'Aufnahme bereit', checked: true })}${switch_({ label: 'Metronom' })}</div>
      <div class="row" style="margin-top:10px">${badge('live', 'live')}${badge('verbunden', 'ok')}${badge('nicht verbunden')}${badge('achtung', 'warn')}${badge('gesperrt', 'bad')}</div></div>
    <div class="card"><h3>Kacheln</h3><div class="grid g2">${tile({ k: 'Songs', v: '12', s: '3 veröffentlicht' })}${tile({ k: 'Freigaben', v: '2', s: 'warten auf Mensch' })}</div></div>
    <div class="card"><h3>Reiter</h3>
      <div class="tabs"><button class="on" data-tab="a">Übersicht</button><button data-tab="b">Details</button></div>
      <div data-panel="a"><p class="hint">Erster Bereich.</p></div><div data-panel="b" hidden><p class="hint">Zweiter Bereich.</p></div></div>
    <div class="card"><h3>Tabelle</h3>${table(['Gerät', 'Status', 'Latenz'], [['Keyboard', badge('erkannt', 'ok'), '5,3 ms'], ['Interface', badge('angemeldet'), '10,7 ms']])}</div>
  </div>
  <h2>Meldungen</h2>
  <div class="row"><button class="primary" onclick="auraToast('Gespeichert.')">Erfolg zeigen</button>
    <button class="danger" onclick="auraToast('Das ging nicht.',true)">Fehler zeigen</button>
    <button class="ghost" onclick="auraApi('/api/health').then(function(j){auraToast('Server: '+(j.status||j.ok||'?'))})">Server fragen</button></div>
  <p class="hint" style="margin-top:12px">Alles hier ist echtes HTML/CSS/JS aus <span class="mono">ui_kit.js</span> — kein Fremd-Framework, keine externen CDNs.</p>`;
  const script = `function onGain(v){auraToast('GAIN auf '+v+' dB gesetzt');}`;
  return shell({ title: 'Oberflächen-Bausteine', active: '/design', body, script, note: 'Die Bedienelemente, aus denen die AURA-Oberfläche gebaut ist.' });
}

function startPage() {
  const s = status();
  const links = NAV.map(([href, label]) => `<a class="card" href="${href}" style="text-decoration:none;display:block"><h3>${label}</h3><p class="hint mono">${href}</p></a>`).join('\n');
  const body = `
  <div class="grid g2">
    ${tile({ k: 'Bausteine', v: String(s.components.length), s: 'aus ui_kit.js — ohne Fremd-Framework' })}
    ${tile({ k: 'Navigation', v: String(s.nav_entries), s: 'jeder Eintrag liefert eine echte Seite' })}
  </div>
  <h2>Seiten</h2>
  <div class="grid g3">
  ${links}
  </div>
  <p class="hint">Regel: ${s.rules[0]}</p>`;
  return shell({ title: 'Start', active: '/start', body, note: 'Einstieg: alle Seiten der Bedienoberfläche auf einen Blick — ohne tote Links.' });
}

function status() {
  const d = load();
  return {
    area: 'UI', module: 'ui_kit', state: 'live', file: FILE,
    css_bytes: CSS.length, client_js_bytes: CLIENT_JS.length,
    components: ['knob', 'fader', 'meter', 'switch', 'tile', 'badge', 'table', 'tabs', 'toast', 'card', 'shell'],
    nav_entries: NAV.length,
    rules: ['Kein Fremd-Framework, keine externen Skripte oder Schriften (kein Telefon nach Hause).', 'Bedienung mit Maus, Touch, Mausrad und Tastatur.', 'Helles und dunkles Aussehen über die Systemeinstellung.', 'Alle Zahlen auf den Seiten kommen aus Modulen — nichts wird dekorativ erfunden.'],
  };
}

module.exports = {
  meta: { area: 'UI', id: 'ui_kit', name: 'Oberflächen-Baukasten (Regler, Fader, Seiten)', state: 'live' },
  actions: { status: () => status(), components: () => ({ ok: true, components: ['knob', 'fader', 'meter', 'switch', 'tile', 'badge', 'table', 'tabs'], css_bytes: CSS.length }) },
  CSS, CLIENT_JS, NAV, knob, fader, meter, switch: switch_, tile, badge, table, shell, componentsPage, startPage, status,
};
