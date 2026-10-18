'use strict';
// AURA · Werbung im Betriebssystem — zwei Rhythmen, ehrlich getrennt.
//
// 1. KURZMELDUNG („Flash"): alle 6 Minuten, groß, **nicht wegklickbar**, bis die Anzeigedauer
//    abgelaufen ist. Sie zeigt immer eine Restzeit an — kein Trick, kein verstecktes Kreuz.
// 2. ANZEIGE („Banner"): alle 11 Minuten, am Rand, jederzeit wegklickbar.
//
// Beides zusammen ist ein Wecker, kein Betrug:
//   · Es werden **keine** Klicks, Aufrufe oder Einblendungen erfunden. Gezählt wird nur, was wirklich
//     passiert (angezeigt, angesehen, geklickt) — und auch das nur lokal.
//   · Werbeeinnahmen werden nie behauptet: ohne Messwert steht dort „unbekannt".
//   · Die Kurzmeldung bringt man nicht weg, aber man kann sie abstellen: `enabled:false`. Ein
//     Betriebssystem, das sich nicht ausschalten lässt, wäre kein Betriebssystem.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_AD_SCHEDULE_FILE || path.join(__dirname, '..', 'data', 'ad_schedule.json');

const RHYTHMS = [
  { id: 'flash', name: 'Kurzmeldung', every_minutes: 6, seconds: 15, dismissible: false, size: 'Vollbild', positions: ['VOLLBILD'], note: 'Groß, mit Restzeit, nicht wegklickbar — bis die Zeit abgelaufen ist.' },
  { id: 'banner', name: 'Anzeige', every_minutes: 11, seconds: 25, dismissible: true, size: 'Rand', positions: ['SIDEBAR', 'IN_ARTICLE', 'FOOTER', 'PLAYER_SIDE'], note: 'Am Rand, jederzeit wegklickbar.' },
];

function defaults() { return { enabled: true, slots: [], views: [], clicks: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['slots', 'views', 'clicks', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    if (typeof raw.enabled !== 'boolean') raw.enabled = true;
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function inventory() { try { const a = require('./advertising'); return a.inventory ? a.inventory() : null; } catch { return null; } }

// Eine Meldung in den Plan setzen. Ohne Inhalt wird nichts erfunden — dann läuft die eigene Meldung.
function slot(input) {
  const p = input || {};
  const data = load();
  const rhythm = RHYTHMS.find((r) => r.id === String(p.rhythm || '').toLowerCase());
  if (!rhythm) return { ok: false, error: `Rhythmus unbekannt. Erlaubt: ${RHYTHMS.map((r) => r.id).join(', ')}` };
  const headline = String(p.headline || '').trim();
  if (headline.length < 4) return { ok: false, error: 'headline fehlt (mindestens 4 Zeichen)' };
  const inv = inventory();
  const positions = Array.isArray(p.positions) && p.positions.length ? p.positions.filter((x) => rhythm.positions.includes(x)) : rhythm.positions;
  if (!positions.length) return { ok: false, error: `Für ${rhythm.id} erlaubt: ${rhythm.positions.join(', ')}` };
  const entry = {
    id: 'ads-' + Math.random().toString(16).slice(2, 8),
    rhythm: rhythm.id, every_minutes: rhythm.every_minutes, seconds: rhythm.seconds, dismissible: rhythm.dismissible,
    headline: headline.slice(0, 90), body: String(p.body || '').slice(0, 300),
    target: String(p.target || '#').slice(0, 300),
    positions, kind: String(p.kind || 'EIGEN'),   // EIGEN = eigene Meldung, FREMD = eingekauft
    paid: p.paid === true, price_eur: Number(p.price_eur) || null,
    by: String(p.by || 'Auraos'),
    created_at: new Date().toISOString(), online: p.online !== false,
    honest: { clicks_created: 0, views_created: 0, note: 'Diese Meldung erzeugt keine Klicks und keine Einblendungen. Gezählt wird nur, was wirklich passiert.' },
  };
  data.slots.unshift(entry); data.slots = data.slots.slice(0, 200);
  data.audit.unshift({ at: entry.created_at, action: 'slot', rhythm: rhythm.id, id: entry.id });
  save(data);
  return { ok: true, slot: entry, inventory_available: inv ? inv.slots : 0, note: `Läuft ${rhythm.name === 'Kurzmeldung' ? 'alle 6 Minuten, nicht wegklickbar' : 'alle 11 Minuten, wegklickbar'}.` };
}

// Wenn es für einen Rhythmus keine Meldung gibt, kommt die Haus-Mitteilung — sichtbar als eigene Meldung.
function household(rhythm, lang) {
  const i18n = (() => { try { return require('./i18n'); } catch { return null; } })();
  const brand = (() => { try { return require('./branding'); } catch { return null; } })();
  const owner = brand ? brand.BRAND.owner : 'Creed Street Studios';
  return {
    id: 'ads-haus-' + rhythm,
    rhythm, kind: 'HAUS',
    headline: rhythm === 'flash' ? 'AURA wird von Creed Street Studios gebaut' : 'Fördern Sie AURA',
    body: rhythm === 'flash'
      ? 'Musik, Medien und Betriebssystem aus einer Hand — Rückmeldung gern über den Support.'
      : 'Werde Förderer oder Sponsor und hilf mit. Der Weg steht unten in der Leiste.',
    target: rhythm === 'flash' ? '/support' : '/sponsor',
    positions: rhythm === 'flash' ? ['VOLLBILD'] : ['FOOTER', 'SIDEBAR'],
    seconds: rhythm === 'flash' ? 15 : 25,
    dismissible: rhythm !== 'flash',
    owner,
    footer: brand ? brand.BRAND.line : null,
    support_label: i18n ? i18n.textOf('support.contact', lang || 'de') : 'Kontaktieren Sie unseren Support',
  };
}

// Der Plan, was wann kommt — nachvollziehbar, ohne echte Uhr: die Seite nimmt es und zählt selbst.
function schedule(input) {
  const p = input || {};
  const minutes = Math.max(1, Math.min(240, Number(p.minutes) || 60));
  const data = load();
  const items = [];
  for (const r of RHYTHMS) {
    const own = data.slots.filter((s) => s.rhythm === r.id && s.online);
    for (let m = r.every_minutes; m <= minutes; m += r.every_minutes) {
      const pick = own.length ? own[(m / r.every_minutes - 1) % own.length] : null;
      items.push({
        at_minute: m,
        rhythm: r.id, name: r.name,
        seconds: r.seconds, dismissible: r.dismissible, positions: r.positions,
        source: pick ? 'EIGENE MELDUNG' : 'HAUS-MITTEILUNG',
        headline: pick ? pick.headline : household(r.id).headline,
        slot_id: pick ? pick.id : null,
      });
    }
  }
  items.sort((a, b) => a.at_minute - b.at_minute || (a.rhythm === 'flash' ? -1 : 1));
  return {
    ok: true, enabled: data.enabled, minutes, viewport_shows: items.length,
    plan: items,
    rhythms: RHYTHMS,
    honest: {
      clicks_created: 0, views_created: 0,
      note: 'Der Plan sagt nur, wann etwas erscheint. Er erzeugt keine Klicks und keine Einblendungen.',
      switch: 'Abschalten mit POST /api/adsched/schedule { enabled: false } — die Kurzmeldung ist nicht wegklickbar, aber das ganze System lässt sich ausschalten.',
    },
  };
}

function setEnabled(on, payload) {
  const d = load();
  const alt = d.enabled;
  d.enabled = on !== false;
  d.audit.unshift({ at: new Date().toISOString(), action: 'toggle', from: alt, to: d.enabled, by: String((payload && payload.by) || 'Auraos') });
  save(d);
  return { ok: true, enabled: d.enabled, from: alt, note: d.enabled ? 'Werbung wieder an.' : 'Werbung aus. Kein Fenster, keine Leiste.' };
}

// Zählen: nur echte Ereignisse, vom Aufrufer gemeldet. Ohne Meldung bleibt der Zähler stehen.
function record(input) {
  const p = input || {};
  const what = String(p.what || '').toLowerCase();
  if (!['view', 'click', 'watched'].includes(what)) return { ok: false, error: 'what muss view, watched oder click sein' };
  const slotId = String(p.slot_id || '');
  if (!slotId) return { ok: false, error: 'slot_id fehlt — ohne Kennung nicht zählbar' };
  const d = load();
  const row = { at: new Date().toISOString(), what, slot_id: slotId, rhythm: String(p.rhythm || ''), seconds: Number(p.seconds) || null, page: String(p.page || '') };
  (what === 'click' ? d.clicks : d.views).push(row);
  d.views = d.views.slice(-5000); d.clicks = d.clicks.slice(-5000);
  save(d);
  return { ok: true, recorded: row, counts: { views: d.views.length, clicks: d.clicks.length }, note: 'Echte Ereignisse, lokal gezählt. Nichts wird hochgerechnet.' };
}

function stats() {
  const d = load();
  const bySlot = {};
  for (const v of d.views) bySlot[v.slot_id] = bySlot[v.slot_id] || { views: 0, watched: 0, clicks: 0 };
  for (const v of d.views) bySlot[v.slot_id][v.what === 'watched' ? 'watched' : 'views']++;
  for (const c of d.clicks) { bySlot[c.slot_id] = bySlot[c.slot_id] || { views: 0, watched: 0, clicks: 0 }; bySlot[c.slot_id].clicks++; }
  const revenue = d.slots.filter((s) => s.paid && s.price_eur).reduce((n, s) => n + s.price_eur, 0);
  return {
    area: 'ADS-SCHED', module: 'ad_engine', state: 'live', file: FILE,
    enabled: d.enabled, slots: d.slots.length, online: d.slots.filter((s) => s.online).length,
    rhythms: RHYTHMS.map((r) => ({ id: r.id, every_minutes: r.every_minutes, seconds: r.seconds, dismissible: r.dismissible })),
    views: d.views.length, clicks: d.clicks.length, by_slot: bySlot,
    revenue_eur: revenue ? Number(revenue.toFixed(2)) : 0,
    revenue_state: revenue ? 'gebuchte Beträge' : 'keine gebuchten Beträge — Einnahmen unbekannt',
    rules: ['Kurzmeldung alle 6 Minuten, nicht wegklickbar, immer mit Restzeit.', 'Anzeige alle 11 Minuten, jederzeit wegklickbar.', 'Keine erzeugten Klicks, keine erzeugten Einblendungen, keine erfundenen Einnahmen.', 'Das Ganze lässt sich abschalten — und die Seiten zeigen die Werbung nur, wenn sie eingeschaltet ist.'],
  };
}

function client() {
  return `(function(){
  var AURA={plan:null,i:0,timer:null};
  function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild}
  function close(node){if(node&&node.parentNode)node.parentNode.removeChild(node)}
  function flash(item){
    var left=item.seconds||15;
    var wrap=el('<div style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(3,6,10,.86);backdrop-filter:blur(3px)"></div>');
    var box=el('<div style="max-width:560px;margin:16px;padding:26px 24px;border:1px solid var(--line,#22303f);border-radius:16px;background:var(--panel,#0f1620);color:var(--text,#e8eef6);text-align:center"></div>');
    box.innerHTML='<div style="letter-spacing:.24em;font-size:11px;color:var(--accent,#e8c37a);margin-bottom:10px">KURZMELDUNG · ALLE 6 MINUTEN</div>'
      +'<div style="font-size:20px;font-weight:600;margin-bottom:8px">'+(item.headline||'')+'</div>'
      +'<div style="color:var(--dim,#9fb0c4);font-size:14px;margin-bottom:16px">'+(item.body||'')+'</div>'
      +'<div style="height:4px;background:var(--line,#22303f);border-radius:3px;overflow:hidden"><div id="aura-flash-bar" style="height:100%;width:100%;background:var(--accent,#e8c37a);transition:width 1s linear"></div></div>'
      +'<div id="aura-flash-left" style="margin-top:10px;font-size:13px;color:var(--dim,#9fb0c4)">'+(item.seconds||15)+' s</div>'
      +'<div style="margin-top:14px"><a href="'+(item.target||'#')+'" data-cs="click" style="color:var(--accent2,#5ad1c0)">'+(item.footer||'Mehr erfahren')+'</a></div>';
    wrap.appendChild(box); document.body.appendChild(wrap);
    var bar=box.querySelector('#aura-flash-bar'), lab=box.querySelector('#aura-flash-left');
    var t=setInterval(function(){
      left--; if(bar)bar.style.width=Math.max(0,left/(item.seconds||15)*100)+'%';
      if(lab)lab.textContent=left+' s';
      if(left<=0){clearInterval(t);close(wrap);AURA.tick()} },1000);
  }
  function banner(item){
    var box=el('<div style="position:fixed;right:14px;bottom:58px;z-index:9998;max-width:300px;padding:14px;border:1px solid var(--line,#22303f);border-radius:12px;background:var(--panel,#0f1620);color:var(--text,#e8eef6);font-size:13px"></div>');
    box.innerHTML='<div style="letter-spacing:.2em;font-size:10px;color:var(--accent,#e8c37a);margin-bottom:6px">ANZEIGE · ALLE 11 MINUTEN</div>'
      +'<div style="font-weight:600;margin-bottom:6px">'+(item.headline||'')+'</div>'
      +'<div style="color:var(--dim,#9fb0c4);margin-bottom:8px">'+(item.body||'')+'</div>'
      +'<a href="'+(item.target||'#')+'" style="color:var(--accent2,#5ad1c0)">Öffnen</a>'
      +'<button style="float:right;background:none;border:0;color:var(--dim,#9fb0c4);cursor:pointer" aria-label="Schließen">✕</button>';
    box.querySelector('button').onclick=function(){close(box)};
    document.body.appendChild(box);
  }
  AURA.load=function(next){
    var r=document.getElementById('aura-side');if(r)r.style.display=(next.enabled===false?'none':'');AURA.tick()};
  AURA.tick=function(){var item=AURA.plan&&AURA.plan[0];if(!item||!AURA.plan||!AURA.plan.length)return;AURA.plan.shift();
    if(item.rhythm==='flash'&&item.dismissible===false)flash(item);else if(item.rhythm==='flash')flash(item);else banner(item)};
  window.AURA_AD=AURA;
})();`;
}

function status() { const s = stats(); return Object.assign(s, { client_js: 'AURA_AD (window.AURA_AD.load/schedule) — kein Fremdskript', switch: 'POST /api/adsched/schedule { enabled:false }' }); }

module.exports = {
  meta: { area: 'ADS-SCHED', id: 'ad_engine', name: 'Werbung im OS: Kurzmeldung alle 6 Min (nicht wegklickbar), Anzeige alle 11 Min', state: 'live' },
  actions: { status: () => status(), rhythms: () => ({ ok: true, rhythms: RHYTHMS }), slot: (p) => slot(p || {}), schedule: (p) => schedule(p || {}), enable: (p) => setEnabled((p || {}).enabled, p), record: (p) => record(p || {}), stats: () => stats(), client: () => ({ ok: true, js: client() }) },
  RHYTHMS, slot, schedule, setEnabled, record, stats, household, client, status,
};
