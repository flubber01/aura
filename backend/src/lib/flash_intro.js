'use strict';
// AURA · Startintro im Browser (die „Flash"-Version des Startvideos).
//
// Dieselbe Idee wie das gerenderte Video, nur direkt in der Oberfläche: 10 Sekunden, Creed-Street-
// Zeichen, Ringe, Lauflicht, Fortschritt — gebaut aus CSS und einem kleinen Skript, ohne Fremddatei,
// ohne Fremdschrift (Georgia ist eine Systemschrift; sonst wird gezeichnet).
//
// Steuerung: nach 3 Sekunden erscheint „Überspringen" — wer das System startet, soll nicht warten
// müssen. Wer die volle Laufzeit will, startet ohne Knopf (`skippable:false`). Und: bei
// „Bewegung reduzieren" läuft nichts, dann steht das Zeichen still mit Fortschritt.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_FLASH_FILE || path.join(__dirname, '..', 'data', 'flash_intro.json');
const PALETTES = {
  creed: { bg: '#070c10', gold: '#e8c37a', teal: '#5ad1c0', ink: '#f6f4ef' },
  aurora: { bg: '#071014', gold: '#e8c37a', teal: '#5ad1c0', ink: '#eaf7f5' },
  gold: { bg: '#120d07', gold: '#f0d19a', teal: '#e8c37a', ink: '#fff6e6' },
  night: { bg: '#05070f', gold: '#e8c37a', teal: '#7fb2ff', ink: '#e8eef6' },
};

function defaults() { return { played: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['played', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function boot() { try { return require('./boot_intro'); } catch { return null; } }
function text(key, lang) { try { return require('./i18n').textOf(key, lang || 'de'); } catch { return null; } }

function build(input) {
  const p = input || {};
  const seconds = Math.max(3, Math.min(30, Number(p.seconds) || 10));
  const pal = PALETTES[String(p.palette || 'creed')] || PALETTES.creed;
  const skippable = p.skippable !== false;
  const skipAfter = Math.max(1, Number(p.skip_after) || 3);
  const title = String(p.title || 'CREED STREET');
  const subtitle = String(p.subtitle || text('boot.starting', p.lang) || 'System startet');
  const b = boot();
  const logo = b && typeof b.FONT === 'object'
    ? null
    : null;
  const brandLogo = (() => { try { return require('./branding').logoSvg({ size: 168, transparent: true, gold: pal.gold, teal: pal.teal }); } catch { return ''; } })();

  const css = `
#aura-flash{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:${pal.bg};color:${pal.ink};font-family:Georgia,'Times New Roman',serif;overflow:hidden}
#aura-flash .ring{position:absolute;border-radius:50%;border:1px solid ${pal.teal};opacity:.45;animation:aura-puls 3.2s ease-in-out infinite}
#aura-flash .ring.r1{width:34vmin;height:34vmin;animation-delay:0s}
#aura-flash .ring.r2{width:48vmin;height:48vmin;border-color:${pal.gold};opacity:.32;animation-delay:.5s}
#aura-flash .ring.r3{width:64vmin;height:64vmin;opacity:.2;animation-delay:1s}
#aura-flash .mark{width:22vmin;max-width:180px;filter:drop-shadow(0 0 18px ${pal.gold}55);animation:aura-in 1.4s ease-out both}
#aura-flash .word{margin-top:2.2vmin;letter-spacing:.42em;font-size:clamp(15px,2.4vmin,26px);color:${pal.gold};animation:aura-in 1.6s .2s ease-out both}
#aura-flash .sub{margin-top:1vmin;letter-spacing:.3em;font-size:clamp(10px,1.5vmin,15px);color:${pal.teal};opacity:.9;animation:aura-in 1.6s .6s ease-out both}
#aura-flash .bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:${pal.teal};transform-origin:left;animation:aura-fill ${seconds}s linear forwards}
#aura-flash .date{position:absolute;bottom:2.2vmin;right:2.4vmin;font-size:11px;letter-spacing:.2em;opacity:.55}
#aura-flash .skip{position:absolute;bottom:2vmin;left:50%;transform:translateX(-50%);padding:9px 16px;border:1px solid ${pal.teal}66;border-radius:9px;background:transparent;color:${pal.ink};font-family:system-ui,sans-serif;font-size:13px;letter-spacing:.06em;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .5s}
#aura-flash.can-skip .skip{opacity:.9;pointer-events:auto}
#aura-flash .lights{position:absolute;inset:auto 0 12%;display:flex;gap:1.4vmin;justify-content:center}
#aura-flash .lights i{display:block;width:.7vmin;min-width:4px;height:5vmin;background:${pal.teal};opacity:.75;border-radius:2px;animation:aura-dance 1.1s ease-in-out infinite}
@keyframes aura-puls{0%,100%{transform:scale(.94)}50%{transform:scale(1.06)}}
@keyframes aura-in{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
@keyframes aura-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes aura-dance{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion: reduce){
 #aura-flash .ring,#aura-flash .mark,#aura-flash .word,#aura-flash .sub,#aura-flash .lights i{animation:none}
}`;

  const js = `(function(){
  var el=document.getElementById('aura-flash'); if(!el) return;
  var S=${seconds}, SKIP=${skippable ? 'true' : 'false'}, AFTER=${skipAfter};
  setTimeout(function(){ if(SKIP) el.classList.add('can-skip'); }, AFTER*1000);
  function done(){ if(el.parentNode) el.parentNode.removeChild(el); try{ document.body.classList.remove('aura-booting'); }catch(e){} }
  el.querySelector('.skip').addEventListener('click', function(){ done(); });
  el.querySelectorAll('.lights i').forEach(function(n,i){ n.style.animationDelay=(i%9)*0.07+'s'; });
  setTimeout(done, S*1000);
  window.AURA_FLASH={done:done, seconds:S};
})();`;

  const html = `<div id="aura-flash" role="dialog" aria-label="${title}" aria-live="polite">
  <span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span>
  <div style="display:grid;justify-items:center;text-align:center">
    <div class="mark">${brandLogo}</div>
    <div class="word">${title}</div>
    <div class="sub">${subtitle}</div>
  </div>
  <div class="lights">${Array.from({ length: 17 }, () => '<i></i>').join('')}</div>
  <div class="bar"></div>
  <div class="date">© Creed Street Studios 2026</div>
  ${skippable ? `<button class="skip" type="button">${text('action.skip', p.lang) || 'Überspringen'}</button>` : ''}
</div>`;

  const d = load();
  const entry = { id: 'fi-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), seconds, palette: String(p.palette || 'creed'), skippable, skippable_after_s: skippable ? skipAfter : null, title };
  d.played.unshift(entry); d.played = d.played.slice(0, 200);
  d.audit.unshift({ at: entry.at, action: 'build', id: entry.id, seconds });
  save(d);
  return { ok: true, flash: entry, html, css, js, note: skippable ? `„Überspringen" erscheint nach ${skipAfter} Sekunden.` : 'Ohne Überspringen — läuft die volle Zeit.', logo: 'Creed-Street-Zeichen als SVG gezeichnet, keine Bilddatei.' };
}

function page(input) {
  const built = build(input);
  return {
    ok: true,
    html: `<!doctype html><html lang="${(input || {}).lang || 'de'}"><head><meta charset="utf-8"><title>Start — Creed Street Studios</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#070c10;color:#e8eef6;font-family:system-ui,sans-serif}main{padding:40px 20px}
${built.css}</style></head><body>
<main><h1 style="font-family:Georgia,serif">Startintro</h1>
<p style="color:#9fb0c4;max-width:560px">Diese Seite zeigt nur das Startintro. Im Betrieb legt es sich beim Start des Systems über die Oberfläche und verschwindet nach ${built.flash.seconds} Sekunden${built.flash.skippable ? ' (überspringbar)' : ''}.</p></main>
${built.html}
<script>${built.js}</script>
</body></html>`,
    seconds: built.flash.seconds,
  };
}

function status() {
  const d = load();
  const b = boot();
  return {
    area: 'FLASH', module: 'flash_intro', state: 'live', file: FILE,
    palettes: Object.keys(PALETTES), played: d.played.length,
    rendered_video: b ? b.status().mode : 'Startvideo-Modul nicht ladbar',
    rules: ['Keine Fremddatei, kein Fremdskript: Zeichen als SVG, Bewegung als CSS.', 'Überspringen nach 3 Sekunden — außer man will es ohne.', 'Bei „Bewegung reduzieren" steht das Bild still.', 'Zeigt das Creed-Street-Zeichen und das Copyright 2026.'],
  };
}

module.exports = {
  meta: { area: 'FLASH', id: 'flash_intro', name: 'Startintro im Browser (10 s, Creed-Street-Zeichen, überspringbar)', state: 'live' },
  actions: { status: () => status(), build: (p) => build(p || {}), page: (p) => page(p || {}), palettes: () => ({ ok: true, palettes: Object.keys(PALETTES) }), played: () => { const d = load(); return { ok: true, count: d.played.length, played: d.played.slice(0, 20) }; } },
  PALETTES, build, page, status,
};
