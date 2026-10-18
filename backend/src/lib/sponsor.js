'use strict';
// AURA · Förderer und Sponsoren (Foundry-Konzept).
//
// Oben der klare Weg (Stufen, Gegenleistung, Preis), unten die Leiste, die dauerhaft am Boden läuft
// und trotzdem gut sichtbar bleibt: langsame Laufschrift, ruhige Farbe, jeder Name anklickbar.
//
// Ehrlichkeit: Ein Förderer steht hier nur, wenn er zugesagt hat. Es werden keine Namen erfunden, keine
// Logos von Fremden eingebunden (wir zeichnen den Namen als Text), und Förderbeiträge werden als
// Einnahme gebucht — aber nur, wenn sie wirklich eingegangen sind (Beleg-Feld). Ohne Beleg: „zugesagt".
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_SPONSOR_FILE || path.join(__dirname, '..', 'data', 'sponsor.json');

const TIERS = [
  { id: 'freund', name: 'Freund', monthly_eur: 5, perks: ['Name in der Leiste am Boden', 'Rundbrief zuerst', 'Danke-Seite'], slots: 1, note: 'Der Einstieg. Kein Kleingedrucktes.' },
  { id: 'foerderer', name: 'Förderer', monthly_eur: 25, perks: ['Name in der Leiste, größer', 'Logo-Platz im Web-Empire (eigenes Seitenlogo)', 'Zwei Werkstatt-Sitzungen im Jahr'], slots: 1 },
  { id: 'partner', name: 'Partner', monthly_eur: 100, perks: ['Eigener Platz im Web-Empire', 'Nennung in Videos und Podcasts', 'Früher Zugang zu neuen Bereichen'], slots: 1 },
  { id: 'foundry', name: 'Foundry (Gründerkreis)', monthly_eur: 250, perks: ['Nennung in der Fußzeile jeder Seite', 'Eigene Förder-Seite', 'Mitbestimmung bei der Roadmap (Abstimmung, keine Zusage)'], slots: 1, note: 'Gedacht für Unterstützer, die den Aufbau begleiten wollen.' },
  { id: 'einmalig', name: 'Einmalige Gabe', monthly_eur: null, perks: ['Nennung ein Jahr lang', 'Danke-Karte'], slots: 1, note: 'Einmal zahlen, ein Jahr stehen.' },
];

function defaults() { return { sponsors: [], payouts: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['sponsors', 'payouts', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function tiers() {
  return { ok: true, count: TIERS.length, tiers: TIERS, note: 'Alle Stufen sind monatlich kündbar. Eine Gegenleistung, die nicht gehalten werden kann, steht nicht in der Liste.' };
}

// Förderer aufnehmen. „zugesagt" ist ehrlich — erst mit Beleg wird daraus „bezahlt".
function add(input) {
  const p = input || {};
  const name = String(p.name || '').trim();
  if (name.length < 2) return { ok: false, error: 'name fehlt' };
  const tier = TIERS.find((x) => x.id === String(p.tier || '').toLowerCase());
  if (!tier) return { ok: false, error: `Stufe unbekannt. Erlaubt: ${TIERS.map((x) => x.id).join(', ')}` };
  const d = load();
  if (d.sponsors.some((s) => s.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Dieser Name steht schon in der Liste' };
  const amount = tier.monthly_eur === null ? Number(p.amount_eur) || null : tier.monthly_eur;
  const s = {
    id: 'sp-' + Math.random().toString(36).slice(2, 8),
    name: name.slice(0, 60), tier: tier.id, tier_name: tier.name,
    monthly_eur: tier.monthly_eur, amount_eur: amount,
    link: String(p.link || '').slice(0, 300) || null,
    note: String(p.note || '').slice(0, 160) || null,
    state: p.paid === true ? 'BEZAHLT' : 'ZUGESAGT',
    since: new Date().toISOString().slice(0, 10),
    by: String(p.by || 'Auraos'),
    perks: tier.perks,
    proof: p.paid === true ? String(p.proof || 'Beleg vorhanden') : null,
  };
  d.sponsors.unshift(s); d.sponsors = d.sponsors.slice(0, 500);
  d.audit.unshift({ at: new Date().toISOString(), action: 'add', id: s.id, tier: s.tier, state: s.state });
  save(d);
  return { ok: true, sponsor: s, honesty: s.state === 'ZUGESAGT' ? 'Zusage aufgenommen. Erst mit Beleg wird daraus „bezahlt" — bis dahin zählt der Beitrag nicht als Einnahme.' : 'Beitrag mit Beleg gebucht.' };
}

function setState(input) {
  const p = input || {};
  const d = load();
  const s = d.sponsors.find((x) => x.id === p.id || x.name === p.name);
  if (!s) return { ok: false, error: 'Förderer nicht gefunden' };
  const to = String(p.state || '').toUpperCase();
  if (!['ZUGESAGT', 'BEZAHLT', 'PAUSIERT', 'BEENDET'].includes(to)) return { ok: false, error: 'state: ZUGESAGT | BEZAHLT | PAUSIERT | BEENDET' };
  if (to === 'BEZAHLT' && !p.proof) return { ok: false, error: 'Für BEZAHLT fehlt der Beleg (proof: Überweisungsnotiz, Rechnungsnummer)' };
  const from = s.state;
  s.state = to; s.proof = to === 'BEZAHLT' ? String(p.proof) : s.proof;
  if (to === 'PAUSIERT' || to === 'BEENDET') s.offline_at = new Date().toISOString();
  d.audit.unshift({ at: new Date().toISOString(), action: 'state', id: s.id, from, to, by: String(p.by || 'Auraos') });
  save(d);
  return { ok: true, sponsor: { id: s.id, name: s.name, state: s.state }, from };
}

// Die Leiste am Boden: nur aktive Namen, als Text — keine fremden Logos, keine Bildabrufe.
function footerTicker(input) {
  const p = input || {};
  const d = load();
  const active = d.sponsors.filter((s) => s.state === 'BEZAHLT' || s.state === 'ZUGESAGT');
  const i18n = (() => { try { return require('./i18n'); } catch { return null; } })();
  const head = i18n ? i18n.textOf('sponsor.bottom', p.lang || 'de') : 'Förderer und Partner';
  const brand = (() => { try { return require('./branding'); } catch { return null; } })();
  const names = active.length
    ? active.slice(0, 24).map((s) => (s.link ? `<a href="${s.link}" rel="noopener">${s.name}</a>` : s.name)).join(' · ')
    : `<a href="/sponsor">Werde der erste Förderer — Stufen ab 5 € im Monat</a>`;
  return {
    ok: true,
    html: `<span>${head}: ${names} · ${brand ? brand.BRAND.line : '© Creed Street Studios 2026'} · <a href="/sponsor">${i18n ? i18n.textOf('sponsor.title', p.lang || 'de') : 'Fördern Sie AURA'}</a></span>`,
    count: active.length,
    css_hint: 'Läuft langsam (26 s) einmal durch. Bei „Bewegung reduzieren" hält sie an und wird komplett lesbar.',
  };
}

// Ganze Förder-Seite (Foundry-Seite) zum Ausliefern.
function page(input) {
  const p = input || {};
  const d = load();
  const ticker = footerTicker(p);
  const theme = (() => { try { return require('./themes').page({ user: p.user || 'Auraos' }); } catch { return { css: '' }; } })();
  const brand = (() => { try { return require('./branding'); } catch { return null; } })();
  const rows = TIERS.map((t) => `<div class="tier"><h3>${t.name}</h3><div class="price">${t.monthly_eur === null ? 'einmalig, frei' : t.monthly_eur + ' € / Monat'}</div>
  <ul>${t.perks.map((x) => `<li>${x}</li>`).join('')}</ul>${t.note ? `<p class="note">${t.note}</p>` : ''}</div>`).join('');
  const list = d.sponsors.length
    ? `<h2>Wer schon dabei ist</h2><ul class="who">${d.sponsors.map((s) => `<li>${s.name} — ${s.tier_name} · ${s.state === 'BEZAHLT' ? 'Beitrag eingegangen' : 'Zusage'}</li>`).join('')}</ul>`
    : '<h2>Wer schon dabei ist</h2><p class="note">Noch niemand. Wer zuerst kommt, steht zuerst in der Leiste.</p>';
  return {
    ok: true, html: `<!doctype html><html lang="${p.lang || 'de'}"><head><meta charset="utf-8">
<title>Fördern — Creed Street Studios</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${theme.css}
body{margin:0;font-family:system-ui,Segoe UI,sans-serif}
main{max-width:1000px;margin:0 auto;padding:32px 18px 70px}
h1{font-family:Georgia,'Times New Roman',serif;font-size:34px;margin:0 0 6px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-top:18px}
.tier{border:1px solid var(--line);border-radius:14px;padding:18px;background:color-mix(in srgb,var(--panel) 88%,transparent)}
.tier h3{margin:0 0 4px;font-size:19px}.price{color:var(--accent);font-weight:600;margin-bottom:10px}
.tier ul{margin:0;padding-left:18px;color:var(--dim);font-size:14px;line-height:1.6}
.note{color:var(--dim);font-size:13px}
.who{color:var(--dim)}</style></head><body>
<main>
<div class="logo">${brand ? brand.logoSvg({ size: 96, with_text: false }) : ''}</div>
<h1>Fördern Sie AURA</h1>
<p class="note">AURA wird von Creed Street Studios gebaut — Musik, Medien und ein eigenes Betriebssystem.
Wer mitmacht, wird sichtbar genannt. Keine Zusagen, die nicht gehalten werden können.</p>
<div class="grid">${rows}</div>
${list}
<p class="note">Stand: ${new Date().toISOString().slice(0, 10)} · ${brand ? brand.BRAND.line : ''}</p>
</main>
<footer class="cs-footer"><div class="cs-ticker">${ticker.html}</div><div class="cs-copy">${brand ? brand.BRAND.line : ''}</div></footer>
</body></html>`,
    tiers: TIERS.length, sponsors: d.sponsors.length,
  };
}

function status() {
  const d = load();
  const paid = d.sponsors.filter((s) => s.state === 'BEZAHLT');
  const monthly = paid.reduce((n, s) => n + (s.monthly_eur || 0), 0);
  return {
    area: 'SPONSOR', module: 'sponsor', state: 'live', file: FILE,
    tiers: TIERS.length, sponsors: d.sponsors.length,
    by_state: d.sponsors.reduce((a, s) => { a[s.state] = (a[s.state] || 0) + 1; return a; }, {}),
    monthly_eur: Number(monthly.toFixed(2)),
    monthly_state: paid.length ? 'aus belegten Beiträgen' : 'keine belegten Beiträge — keine Einnahme gebucht',
    ticker: 'läuft am unteren Rand (26 s), bei „Bewegung reduzieren" stehend und ganz lesbar',
    rules: ['Nur echte Förderer stehen in der Leiste — keine erfundenen Namen.', 'Keine eingebundenen Fremd-Logos: Namen als Text, damit nichts nachlädt.', 'Erst mit Beleg wird ein Beitrag zur Einnahme.', 'Monatlich kündbar, jederzeit entfernbar.'],
  };
}

module.exports = {
  meta: { area: 'SPONSOR', id: 'sponsor', name: 'Fördern / Sponsor (Foundry-Stufen, Leiste am Boden, Förder-Seite)', state: 'live' },
  actions: { status: () => status(), tiers: () => tiers(), add: (p) => add(p || {}), state: (p) => setState(p || {}), list: () => { const d = load(); return { ok: true, count: d.sponsors.length, sponsors: d.sponsors }; }, ticker: (p) => footerTicker(p || {}), page: (p) => page(p || {}) },
  TIERS, tiers, add, setState, footerTicker, page, status,
};
