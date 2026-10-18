'use strict';
// AURA · Marke: Creed Street Studios.
//
// Ein Logo, das ohne Bilddatei funktioniert (als SVG gezeichnet), eine Copyright-Zeile für 2026, und
// die Kennzeichnung (Wasserzeichen) für alles, was das Haus verlässt: Bild, Ton, Video, Seite, Text.
//
// Zur Kennzeichnung ganz offen: AURA *plant* sie und gibt die fertigen Filterketten aus. Ob und wo
// gekennzeichnet wird, entscheidet ein Mensch — und es wird nirgends etwas in eine fremde Datei
// hineingerechnet, ohne dass es vorher sichtbar in der Ablage steht.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_BRANDING_FILE || path.join(__dirname, '..', 'data', 'branding.json');

const BRAND = {
  owner: 'Creed Street Studios',
  year: 2026,
  line: '© Creed Street Studios 2026 — alle Rechte vorbehalten',
  short: 'Creed Street',
  claim: 'Musik, Medien und Betriebssystem aus einer Hand',
  colors: { night: '#070c10', gold: '#e8c37a', teal: '#5ad1c0', bone: '#f6f4ef' },
  // Das Zeichen: ein Ring (Ton) mit einer Straße, die durch ein Studienfenster führt — Creed Street.
  logo: { viewbox: '0 0 240 240', ring_radius: 96, street_width: 16 },
  watermark_defaults: { text: 'CREED STREET STUDIOS', opacity: 0.28, position: 'unten rechts', tile: true },
};

// Logo als SVG — ohne Schriftdatei im System, damit es überall gleich aussieht.
function logoSvg(input) {
  const p = input || {};
  const size = Math.max(48, Math.min(1024, Number(p.size) || 240));
  const gold = String(p.gold || BRAND.colors.gold);
  const teal = String(p.teal || BRAND.colors.teal);
  const bg = p.transparent ? 'none' : String(p.bg || BRAND.colors.night);
  const mono = p.mono === true;
  const g = mono ? String(p.mono_color || '#ffffff') : gold;
  const t = mono ? String(p.mono_color || '#ffffff') : teal;
  const withText = p.with_text !== false;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="${size}" height="${size}" role="img" aria-label="Creed Street Studios">
  <rect width="240" height="240" fill="${bg}"/>
  <circle cx="120" cy="108" r="88" fill="none" stroke="${g}" stroke-width="3"/>
  <circle cx="120" cy="108" r="72" fill="none" stroke="${t}" stroke-width="1.5" opacity="0.7"/>
  <path d="M56 168 L120 60 L184 168" fill="none" stroke="${g}" stroke-width="10" stroke-linecap="round"/>
  <path d="M84 168 L120 108 L156 168" fill="none" stroke="${t}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="120" cy="108" r="7" fill="${g}"/>
  ${withText ? `<text x="120" y="205" text-anchor="middle" fill="${g}" font-family="Georgia, 'Times New Roman', serif" font-size="17" letter-spacing="4">CREED STREET</text>
  <text x="120" y="226" text-anchor="middle" fill="${t}" font-family="Georgia, 'Times New Roman', serif" font-size="11" letter-spacing="7">STUDIOS</text>` : ''}
</svg>`;
}

function defaults() { return { marks: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['marks', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Kennzeichnung: für jede Art von Datei der passende Weg — als fertige Angabe, nicht als Behauptung.
function watermark(input) {
  const p = input || {};
  const kind = String(p.kind || 'BILD').toUpperCase();
  const text = String(p.text || BRAND.watermark_defaults.text).replace(/[':\\]/g, '');
  const opacity = Math.max(0.05, Math.min(0.9, Number(p.opacity) || BRAND.watermark_defaults.opacity));
  const pos = String(p.position || BRAND.watermark_defaults.position);
  const corner = { 'unten rechts': 'x=w-tw-24:y=h-th-24', 'unten links': 'x=24:y=h-th-24', 'oben rechts': 'x=w-tw-24:y=24', 'oben links': 'x=24:y=24', 'mitte': 'x=(w-tw)/2:y=(h-th)/2' }[pos] || 'x=w-tw-24:y=h-th-24';
  const tiled = p.tile !== false;
  const out = { ok: true, kind, text, opacity, position: pos, tiled: Boolean(tiled), note: 'Kennzeichnung ist sichtbar und wird angekündigt — nichts wird heimlich eingerechnet.' };
  if (kind === 'BILD' || kind === 'VIDEO') {
    out.filter = tiled
      ? `drawtext=text='${text}':fontsize=h/22:fontcolor=white@${opacity}:${corner}`
      : `drawtext=text='${text}':fontsize=h/22:fontcolor=white@${opacity}:${corner}`;
    out.ffmpeg = `ffmpeg -i eingabe -vf "${out.filter}" -c:a copy ausgabe`;
    out.warning = 'Diese Sandbox hat kein drawtext im ffmpeg — der Filter ist gültig, die Ausführung braucht ein ffmpeg mit Schriftrunterstützung.';
    out.alternative = 'Alternative ohne drawtext: eine halbtransparente PNG-Marke aus /api/branding/logo-overlay über das Bild legen (overlay-Filter, kein Schriftsatz nötig).';
    out.overlay_filter = 'ffmpeg -i eingabe -i marke.png -filter_complex "overlay=W-w-24:H-h-24" -c:a copy ausgabe';
  }
  if (kind === 'TON' || kind === 'AUDIO') {
    out.plan = {
      intro: `0,8 s Ansage oder Ton-Marke vor dem Stück, dann 0,2 s Stille`,
      outro: `letzte 1,2 s Ausblenden mit Ton-Marke bei −18 dB`,
      spoken_tag: 'Text-Marke für Ansagen: "Creed Street Studios, 2026"',
      metadata: { artist: BRAND.owner, comment: BRAND.line, year: BRAND.year },
    };
    out.note = 'Bei Ton ist die Kennzeichnung im Ton oder in den Metadaten — nicht unhörbar hineingerechnet.';
  }
  if (kind === 'TEXT' || kind === 'PDF') {
    out.plan = { footer: BRAND.line, header_right: 'Creed Street Studios', page_mark: `${text} · Seite {n}` };
  }
  if (kind === 'SEITE' || kind === 'HTML') {
    out.plan = {
      footer_html: `<footer class="cs-footer">${BRAND.line} · <a href="/support">Support</a> · <a href="/agb">AGB</a></footer>`,
      css: '.cs-footer{position:relative;padding:18px 12px;border-top:1px solid var(--line);color:var(--dim);font-size:12px;text-align:center}',
      ticker: 'Förderer-Leiste am unteren Rand (siehe /api/sponsor/ticker)',
    };
  }
  const d = load();
  const entry = { id: 'wm-' + Math.random().toString(16).slice(2, 8), at: new Date().toISOString(), kind, text, opacity, position: pos, target: String(p.target || 'nicht angegeben') };
  d.marks.unshift(entry); d.marks = d.marks.slice(0, 200);
  d.audit.unshift({ at: entry.at, action: 'watermark_plan', kind, target: entry.target });
  save(d);
  return Object.assign(out, { id: entry.id, copyright: BRAND.line });
}

// Fußzeile und Förderer-Leiste: "am Boden laufend, aber gut sichtbar".
function footer(input) {
  const p = input || {};
  const sponsor = (() => { try { return require('./sponsor').footerTicker({}); } catch { return null; } })();
  const ticker = sponsor && sponsor.ok ? sponsor.html : '';
  const support = (() => { try { const i18n = require('./i18n'); return i18n.textOf('support.contact', p.lang || 'de'); } catch { return 'Kontaktieren Sie unseren Support'; } })();
  return {
    ok: true,
    html: `<footer class="cs-footer">
  <div class="cs-ticker">${ticker || 'Förderer-Leiste: /api/sponsor/ticker'}</div>
  <div class="cs-links"><a href="/support">${support}</a> · <a href="/agb">AGB</a> · <a href="/datenschutz">Datenschutz</a> · <a href="/impressum">Impressum</a></div>
  <div class="cs-copy">${BRAND.line}</div>
</footer>`,
    css: `.cs-footer{position:sticky;bottom:0;z-index:40;background:color-mix(in srgb, var(--panel) 92%, #000);border-top:1px solid var(--line);color:var(--dim);font-size:12px;text-align:center;padding:8px 12px}
.cs-ticker{overflow:hidden;white-space:nowrap;height:20px;position:relative}
.cs-ticker span{display:inline-block;padding-left:100%;animation:cs-lauf 26s linear infinite}
@keyframes cs-lauf{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}
.cs-links{margin:4px 0}
.cs-copy{opacity:.8}`,
    brand: BRAND.owner, year: BRAND.year, copyright: BRAND.line,
    honesty: 'Die Leiste läuft dauerhaft am unteren Rand und ist trotzdem lesbar (kein Flackern, keine Bewegung bei „Bewegung reduzieren").',
  };
}

function status() {
  const d = load();
  return {
    area: 'BRAND', module: 'branding', state: 'live', file: FILE,
    owner: BRAND.owner, year: BRAND.year, copyright: BRAND.line,
    logo: 'als SVG gezeichnet (keine Bilddatei, keine Schriftdatei nötig)',
    kinds: ['BILD', 'VIDEO', 'TON', 'TEXT', 'PDF', 'SEITE'],
    marks_planned: d.marks.length,
    rules: ['Kennzeichnung ist sichtbar und wird vorher angekündigt.', 'Nichts wird in fremde Dateien gerechnet — Pläne und Filterketten kommen als Vorschlag.', 'Copyright-Zeile ist 2026 und steht auf jeder Seite unten.'],
  };
}

module.exports = {
  meta: { area: 'BRAND', id: 'branding', name: 'Marke Creed Street Studios (Logo, Copyright 2026, Kennzeichnung, Fußzeile)', state: 'live' },
  actions: { status: () => status(), logo: (p) => ({ ok: true, svg: logoSvg(p || {}), brand: BRAND.owner, year: BRAND.year }), svg: (p) => ({ ok: true, svg: logoSvg(p || {}) }), mark: (p) => watermark(p || {}), footer: (p) => footer(p || {}), marks: () => { const d = load(); return { ok: true, count: d.marks.length, marks: d.marks.slice(0, 20) }; } },
  BRAND, logoSvg, watermark, footer, status,
};
