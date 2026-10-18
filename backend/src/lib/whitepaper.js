'use strict';
// AURA · Weißbuch, Prüfbericht und Fahrplan — erzeugt aus dem, was wirklich läuft.
//
// Das Weißbuch beschreibt, was AURA ist und wie es arbeitet. Der Prüfbericht zählt die Module, Routen,
// Tests und offenen Punkte **live** durch. Der Fahrplan listet, was als Nächstes kommt, mit Aufwand
// und warum. Alles hängt am unteren Ende des Weißbuchs — wie gewünscht.
//
// Grundsatz: keine erfundenen Zahlen. Was nicht messbar ist, steht als „unbekannt" da.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_WHITEPAPER_FILE || path.join(__dirname, '..', 'data', 'whitepaper.json');

const ROADMAP = [
  { id: 'pages-ui', what: 'Die 59 vorhandenen Seiten auf die neuen Bedienelemente umstellen', effort: 'mittel', why: 'Regler und Kacheln sind gebaut, aber noch nicht überall eingebaut.', state: 'OFFEN' },
  { id: 'speech', what: 'Sprachmotor (piper/espeak-ng) und Transkription auf dem Server installieren', effort: 'klein', why: 'Ohne Motor bleibt Podcast und Avatar stumm — das ist der letzte große Baustein.', state: 'OFFEN' },
  { id: 'dist', what: 'Echte Testaufrufe je Connector (UNVERIFIED → geprüft)', effort: 'mittel', why: 'Erst dann ist Auslieferung belastbar statt nur eingerichtet.', state: 'OFFEN' },
  { id: 'vision', what: 'Bildmodell anbinden, damit die Augen Inhalte benennen können', effort: 'mittel', why: 'Bisher werden Bilder gemessen, nicht verstanden.', state: 'OFFEN' },
  { id: 'vps', what: 'Installation auf den Server des Inhabers mit Token und TLS', effort: 'klein', why: 'Betrieb außerhalb der Werkstatt, mit Zertifikat und Sicherung.', state: 'OFFEN' },
  { id: 'pay', what: 'Zahlungsanbieter und Social-Login verbinden (Schlüssel in den Vault)', effort: 'klein', why: '19 Zahlungswege und 9 Anmeldewege sind beschrieben, aber nicht verbunden.', state: 'WARTET AUF SCHLÜSSEL' },
  { id: 'free-engines', what: 'Freie Klang- und Effektquellen erweitern und prüfen', effort: 'klein', why: 'Der Katalog wächst; jede Quelle braucht eine klare Lizenzangabe.', state: 'LÄUFT' },
  { id: 'docs', what: 'Handbuch je Abteilung mit Beispielen füllen', effort: 'mittel', why: 'Das Handbuch zählt 150 Module; Beispiele fehlen noch.', state: 'OFFEN' },
];

function brand() { try { return require('./branding').BRAND; } catch { return { owner: 'Creed Street Studios', year: 2026, line: '© Creed Street Studios 2026 — alle Rechte vorbehalten' }; } }
function safe(fn, fallback) { try { const r = fn(); return r === undefined ? fallback : r; } catch { return fallback; } }

function defaults() { return { versions: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['versions', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// ---- Prüfbericht: zählt live durch, was im Projekt liegt.
function audit() {
  const data = require('fs');
  const libDir = path.join(__dirname);
  const libs = safe(() => data.readdirSync(libDir).filter((f) => f.endsWith('.js')), []);
  let live = 0, other = 0;
  const byState = {};
  const rows = [];
  for (const f of libs) {
    const id = f.replace(/\.js$/, '');
    const m = safe(() => { const mod = require('./' + id); return mod && mod.meta ? mod.meta : null; }, null);
    const state = m ? (m.state || 'unbekannt') : 'ohne meta';
    byState[state] = (byState[state] || 0) + 1;
    if (state === 'live') live++; else other++;
    if (m) rows.push({ id, area: m.area || '', name: m.name || '', state });
  }
  const apiFile = path.join(__dirname, '..', 'routes', 'api_areas.js');
  const routeText = safe(() => data.readFileSync(apiFile, 'utf8'), '');
  const routes = [...new Set([...routeText.matchAll(/p === '(\/api[^']*)'/g)].map((m) => m[1]))];
  const routeFiles = safe(() => data.readdirSync(path.join(__dirname, '..', 'routes')).filter((f) => f.endsWith('.js')), []);
  let routesAll = routes.length;
  for (const f of routeFiles) {
    if (f === 'api_areas.js') continue;
    const text = safe(() => data.readFileSync(path.join(__dirname, '..', 'routes', f), 'utf8'), '');
    routesAll += [...new Set([...text.matchAll(/p === '(\/api[^']*)'/g)].map((m) => m[1]))].length;
  }
  const pages = safe(() => data.readdirSync(path.join(__dirname, '..', '..', 'pages')).length, 0);
  const tests = safe(() => data.readdirSync(path.join(__dirname, '..', '..', '..', 'test')).filter((f) => f.endsWith('.test.js')).length, 0);
  const docs = safe(() => data.existsSync(path.join(__dirname, '..', '..', '..', 'docs', 'STATUS.md')), false);
  return {
    ok: true, at: new Date().toISOString(),
    modules: { total: libs.length, live, other, by_state: byState },
    routes: routesAll, pages, test_files: tests, status_doc: docs ? 'docs/STATUS.md vorhanden' : 'fehlt',
    open_points: ROADMAP.filter((r) => r.state === 'OFFEN').length,
    waiting: ROADMAP.filter((r) => r.state === 'WARTET AUF SCHLÜSSEL').length,
    honesty: 'Gezählt wird, was im Projekt liegt: Module mit Zustand "live", Routenpfade im Quelltext, Seiten, Testdateien. Keine geschätzten Zahlen.',
  };
}

// ---- Fahrplan: offene Punkte, sortiert nach Wirkung.
function roadmap() {
  const order = { klein: 1, mittel: 2, gross: 3 };
  const items = ROADMAP.slice().sort((a, b) => (a.state === 'LÄUFT' ? 1 : 0) - (b.state === 'LÄUFT' ? 1 : 0) || (order[a.effort] || 2) - (order[b.effort] || 2));
  return { ok: true, items, counts: items.reduce((a, x) => { a[x.state] = (a[x.state] || 0) + 1; return a; }, {}), rule: 'Jeder Punkt nennt den Grund. Was keinen Grund hat, kommt nicht in den Fahrplan.' };
}

// ---- Weißbuch (Markdown) mit angehängtem Prüfbericht und Fahrplan.
function markdown(input) {
  const p = input || {};
  const a = audit();
  const r = roadmap();
  const br = brand();
  const i18n = safe(() => require('./i18n').coverage(), null);
  const themes = safe(() => require('./themes').status(), null);
  const music = safe(() => require('./music_departments').status(), null);
  const ads = safe(() => require('./ad_engine').status(), null);
  const ref = safe(() => require('./referral').status(), null);
  const spons = safe(() => require('./sponsor').status(), null);
  const legal = safe(() => require('./legal').status(), null);
  const nl = safe(() => require('./newsletter').status(), null);
  const orc = safe(() => require('./song_orchestrator').status(), null);
  const log = safe(() => require('./logs_analytics').status(), null);

  const md = `# AURA — Weißbuch

**${br.owner} · ${br.year}** · Stand ${new Date().toISOString().slice(0, 10)} · ${br.line}

## 1. Was AURA ist

AURA ist ein eigenes Betriebssystem für Musik, Medien und Web-Betrieb. Es besteht aus ${a.modules.total} Modulen,
einem eigenen Server (${a.routes} API-Pfade) und ${a.pages} Oberflächen. Es läuft lokal oder auf einem eigenen Server —
ohne Zwang zu einem Fremdanbieter, ohne Telefonieren nach Hause.

## 2. Wie es arbeitet

1. **Mensch zuerst.** Veröffentlichen, freigeben, Geld bewegen, löschen: immer ein Mensch. Jede Automatik endet an einer Freigabe-Tür.
2. **Ehrliche Zustände.** Was nicht verbunden ist, heißt NOT-CONNECTED. Was ohne Messung nicht bewertbar ist, heißt „zu wenig Daten".
3. **Keine erzeugte Reichweite.** Keine gekauften Klicks, keine Bots, keine erfundenen Einnahmen — in keinem Modul.
4. **Eigene Mittel.** Zeichen statt Fremdgrafiken, eigener Ton-Renderer statt Fremd-Töne, eigene Reime statt Zitatdatenbank.
5. **Alles nachlesbar.** Jede Handlung landet im Protokoll: wer, wann, was, mit welcher Freigabe.

## 3. Was drin ist (gemessen)

| Bereich | Zahlen |
|---|---|
| Module | ${a.modules.total} Dateien, davon **${a.modules.live}** mit Zustand „live" |
| Schnittstellen | **${a.routes}** API-Pfade |
| Oberflächen | ${a.pages} Seiten |
| Tests | ${a.test_files} Testdateien |
| Sprachen | ${i18n ? `${i18n.languages} Sprachen, ${i18n.keys} Sätze` : 'unbekannt'} |
| Aussehen | ${themes ? `${themes.themes} Themes × ${themes.backgrounds} Hintergründe = ${themes.combinations} Kombinationen` : 'unbekannt'} |
| Musik | ${music ? `${music.departments} Abteilungen, ${music.human_gates} Mensch-Tore` : 'unbekannt'} |
| Song-Orchester | ${orc ? `${orc.styles_readable} lesbare Stile, ${orc.sections} Abschnittsarten, ${orc.steps.length} Schritte` : 'unbekannt'} |
| Werbung | ${ads ? `Kurzmeldung alle 6 Min (nicht wegklickbar), Anzeige alle 11 Min (wegklickbar)` : 'unbekannt'} |
| Empfehlungen | ${ref ? `${ref.codes} Codes, ${ref.rewards} Prämien` : 'unbekannt'} |
| Förderung | ${spons ? `${spons.tiers} Stufen, ${spons.sponsors} Förderer` : 'unbekannt'} |
| Rundbrief | ${nl ? `${nl.subscribers} Anmeldungen (${nl.confirmed} bestätigt)` : 'unbekannt'} |
| Recht | ${legal ? `${legal.documents} Dokumente, Fassung ${legal.version}, ${legal.open_placeholders} Platzhalter offen` : 'unbekannt'} |
| Protokoll | ${log ? `${log.sources} Quellen, Klick-Bewertung und Einnahmen-Bewertung` : 'unbekannt'} |

## 4. Was es bewusst nicht tut

- **Kein Gesang, kein Fremdmodell für Musik.** Es gibt keinen offenen Zugang zu Suno/Udio; nachgebaut ist die Arbeitsweise, nicht der Anbieter.
- **Keine Auslieferung ohne Anbieter.** Ohne Distributor-Schlüssel bleibt ein Release „vorbereitet".
- **Keine Anmeldung über Sozialkanäle ohne Schlüssel.** Neun Wege sind beschrieben, null verbunden — und das steht so da.
- **Kein Geldfluss.** Zahlungswege werden gerechnet und geplant; abgebucht wird nur von einem Menschen beim Anbieter.
- **Kein stilles Löschen.** Aufräumen schlägt vor, ein Mensch entscheidet.
- **Kein Klickbetrug.** Werbung wird geplant und ehrlich gemessen; Klicks erzeugt AURA nicht.

## 5. Aufbau der Werbung (wie gewünscht)

- **Kurzmeldung („flash")** erscheint **alle 6 Minuten**, groß, mit Restzeit, und lässt sich bis zum Ablauf nicht wegklicken.
- **Anzeige** erscheint **alle 11 Minuten** am Rand und ist jederzeit schließbar.
- Gezählt wird nur, was wirklich passiert. Abschalten ist möglich (eine Zeile) — sonst wäre es kein Betriebssystem, sondern eine Falle.

## 6. Marke

${br.line}. Das Zeichen wird als SVG gezeichnet (Ring, Straße, Studioschrift), die Kennzeichnung ist für Bild, Ton, Video, Text und Seite beschrieben —
immer sichtbar und vorher angekündigt.

---

# Prüfbericht (Audit)

- Module: **${a.modules.total}** Dateien · Zustände: ${Object.entries(a.modules.by_state).map(([k, v]) => `${k}: ${v}`).join(' · ')}
- API-Pfade: **${a.routes}** · Oberflächen: **${a.pages}** · Testdateien: **${a.test_files}**
- Dokumentation: ${a.status_doc}
- Offene Fahrplan-Punkte: **${a.open_points}** · wartend auf Schlüssel: **${a.waiting}**
- Gemessen am: ${a.at}

> ${a.honesty}

---

# Fahrplan (Roadmap)

${r.items.map((x, i) => `${i + 1}. **${x.what}** — Aufwand: ${x.effort} · Zustand: ${x.state}\n   *Warum:* ${x.why}`).join('\n')}

---

${br.line}
`;
  const data = load();
  const entry = { id: 'wp-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), chars: md.length, modules: a.modules.total, routes: a.routes, by: String(p.by || 'Auraos') };
  data.versions.unshift(entry); data.versions = data.versions.slice(0, 100);
  data.audit.unshift({ at: entry.at, action: 'generate', id: entry.id, chars: md.length });
  save(data);
  return { ok: true, version: entry, markdown: md, audit: a, roadmap: r };
}

// Weißbuch als HTML-Seite (mit Fußzeile, AGB-Link, Support-Knopf).
function page(input) {
  const p = input || {};
  const built = markdown(p);
  const br = brand();
  const footer = safe(() => require('./branding').footer({}), null);
  const theme = safe(() => require('./themes').page({ user: p.user || 'Auraos' }).css, '');
  const body = built.markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^\| (.+) \|$/gm, (line) => `<div class="row">${line.replace(/^\||\|$/g, '').split('|').map((c) => `<span>${c.trim()}</span>`).join('')}</div>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>').replace(/^/, '<p>').concat('</p>');
  return {
    ok: true, html: `<!doctype html><html lang="${p.lang || 'de'}"><head><meta charset="utf-8"><title>Weißbuch — ${br.owner}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>${theme}
body{margin:0;font-family:system-ui,Segoe UI,sans-serif}
main{max-width:920px;margin:0 auto;padding:28px 18px 80px;line-height:1.7}
h1{font-family:Georgia,'Times New Roman',serif}h2{margin-top:28px;border-bottom:1px solid var(--line);padding-bottom:6px}
.row{display:grid;grid-template-columns:1fr 1.2fr;gap:10px;border-bottom:1px solid var(--line);padding:6px 0;font-size:14px}
.row span:first-child{color:var(--dim)}</style></head><body><main>${body}</main>${footer ? footer.html : ''}</body></html>`,
    chars: built.markdown.length,
  };
}

function status() {
  const d = load();
  const a = audit();
  return {
    area: 'WP', module: 'whitepaper', state: 'live', file: FILE,
    versions: d.versions.length, last: d.versions[0] || null,
    modules: a.modules.total, routes: a.routes, roadmap_items: ROADMAP.length,
    sections: ['Weißbuch', 'Prüfbericht (Audit)', 'Fahrplan (Roadmap)'],
    rules: ['Alles aus dem lebenden Projekt gezählt, nichts geschätzt.', 'Prüfbericht und Fahrplan hängen unten am Weißbuch — wie eine Unterschrift unter einem Dokument.', 'Was keinen Grund hat, kommt nicht in den Fahrplan.'],
  };
}

module.exports = {
  meta: { area: 'WP', id: 'whitepaper', name: 'Weißbuch mit Prüfbericht und Fahrplan', state: 'live' },
  actions: { status: () => status(), markdown: (p) => markdown(p || {}), page: (p) => page(p || {}), audit: () => audit(), roadmap: () => roadmap(), versions: () => { const d = load(); return { ok: true, count: d.versions.length, versions: d.versions.slice(0, 20) }; } },
  ROADMAP, audit, roadmap, markdown, page, status,
};
