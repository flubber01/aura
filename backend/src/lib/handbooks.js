'use strict';
// AURA · Handbücher: die Bedienungsanleitung, die aus dem laufenden System selbst entsteht.
//
// Warum so: handgeschriebene Handbücher veralten am Tag nach dem Bau. Der Handbuch-Generator liest
// die Module, ihre Fähigkeiten (`meta` + `actions`) und die vorhandenen Text-Dokumente und baut
// daraus Kapitel. Fällt ein Modul aus, steht es ehrlich als „nicht ladbar" im Buch.
//
// Kapitel:
//  1. Schnellstart (was sofort ohne Schlüssel läuft)
//  2. Anleitung je Arbeitsbereich (Modul → Fähigkeiten → Beispielaufrufe)
//  3. Der Mensch hat das letzte Wort (Freigabe-Regeln)
//  4. Ehrlichkeit (was NICHT geht und warum)
//  5. Vorhandene Dokumente (docs/*.md)
const fs = require('fs');
const path = require('path');

const LIB_DIR = path.join(__dirname);
const DOCS_DIR = path.join(__dirname, '..', '..', '..', 'docs');

const QUICKSTART = [
  { step: 'Server starten', cmd: 'node backend/server.js', note: 'Läuft ohne Schlüssel. Port aus PORT (Standard 8080).' },
  { step: 'Selbstprüfung ansehen', cmd: 'curl -s localhost:8080/api/health', note: 'Zeigt ehrlich, was läuft und was nicht verbunden ist.' },
  { step: 'Kampagne planen', cmd: 'POST /api/campaigns/create {"title":"…","release_date":"2026-12-05"}', note: 'Rechnet alle Schritte rückwärts vom Releasetag.' },
  { step: 'Kalender ansehen', cmd: 'GET /api/calendar?days=30', note: 'Termine aus Kampagnen, Tagesplan, Songbook, Routinen.' },
  { step: 'Song entwerfen', cmd: 'POST /api/songbook/create {"title":"…","style":"lofi"}', note: 'Erzeugt sofort hörbaren Ton (lokal, ohne Schlüssel).' },
  { step: 'Video bearbeiten', cmd: 'POST /api/video/preview {"input":"clip.mp4","effects":[…]}', note: 'Zeigt erst die Filterkette; rendern dann über /api/video/jobs.' },
  { step: 'Prüfen, was fehlt', cmd: 'node test/validate.js', note: 'Hauptprüflauf: Seiten + APIs + Dateien.' },
];

// Module mit `meta` einsammeln — ohne sie zu laden, wenn sie kaputt sind.
function scanModules() {
  const rows = [];
  for (const f of fs.readdirSync(LIB_DIR).filter((x) => x.endsWith('.js')).sort()) {
    const file = path.join(LIB_DIR, f);
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const m = text.match(/meta:\s*\{([^}]*)\}/);
    const row = { file: f, id: f.replace(/\.js$/, ''), area: null, name: null, state: 'unbekannt', actions: [], loadable: false, error: null };
    if (m) {
      const body = m[1];
      row.area = (body.match(/area:\s*'([^']*)'/) || [])[1] || null;
      row.name = (body.match(/name:\s*'([^']*)'/) || [])[1] || null;
      row.state = (body.match(/state:\s*'([^']*)'/) || [])[1] || 'unbekannt';
    }
    const am = text.match(/actions:\s*\{/);
    if (am) {
      const start = am.index + am[0].length;
      let depth = 1, i = start;
      while (i < text.length && depth > 0) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
      const body = text.slice(start, i - 1);
      row.actions = [...body.matchAll(/(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?:\(|async)/g)].map((x) => x[1]);
    }
    try {
      const mod = require(file);
      row.loadable = true;
      // Manche Module haben keinen `actions`-Block, sondern exportieren Funktionen direkt.
      // Dann sind die exportierten Funktionen die Fähigkeiten — nichts wird erfunden.
      if (!row.actions.length && mod && typeof mod === 'object') {
        row.actions = Object.keys(mod).filter((k) => typeof mod[k] === 'function' && !k.startsWith('_')).slice(0, 14);
      }
    } catch (e) { row.error = e.message.slice(0, 160); }
    rows.push(row);
  }
  return rows;
}

function docsIndex() {
  try {
    return fs.readdirSync(DOCS_DIR).filter((f) => /\.(md|txt)$/i.test(f)).sort()
      .map((f) => { const full = path.join(DOCS_DIR, f); const s = fs.statSync(full);
        return { file: f, bytes: s.size, title: (fs.readFileSync(full, 'utf8').split('\n').find((l) => /^#\s+/.test(l)) || '').replace(/^#\s+/, '') || f }; });
  } catch { return []; }
}

function chapters() {
  const mods = scanModules();
  const byArea = {};
  for (const m of mods) { const k = m.area || 'ohne Bereich'; (byArea[k] = byArea[k] || []).push(m); }
  return {
    ok: true,
    book: 'AURA Handbuch (aus dem laufenden System erzeugt)',
    generated_at: new Date().toISOString(),
    chapter_1_quickstart: QUICKSTART,
    chapter_2_areas: Object.entries(byArea).sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'de'))
      .map(([area, list]) => ({ area, modules: list.length, entries: list.map((m) => ({ id: m.id, name: m.name || m.id, state: m.state, actions: m.actions, loadable: m.loadable, error: m.error })) })),
    chapter_3_human_final: {
      rule: 'Der Mensch hat immer das letzte Wort.',
      gates: ['Veröffentlichen (Songbook, Distribution)', 'Freigabe-Stufen der Kampagne', 'Einsatz von KI-Anbietern (eigener Schlüssel nötig)', 'Sicherheits-Ausschluss (Rauswurf nur nach Freigabe)', 'Bezahlvorgänge'],
      note: 'AURA schlägt vor und führt vorbereitete Schritte aus. Was nach außen geht oder Geld kostet, braucht eine menschliche Freigabe.',
    },
    chapter_4_honesty: {
      not_connected_by_design: [
        { what: 'Suno / Udio', why: 'kein offener offizieller API-Zugang — Arbeitsweise nachgebaut, Dienst nicht integriert' },
        { what: 'Follower- oder Klick-Kauf', why: 'gesperrt; AURA erzeugt keine Reichweite' },
        { what: 'KI-Anbieter ohne eigenen Schlüssel', why: 'Status bleibt NOT-CONNECTED, nichts wird vorgetäuscht' },
        { what: 'Externe Kalender/Posting-Dienste', why: 'kein Versand ohne Freigabe und Schlüssel' },
      ],
      verifying: 'Jede Statusangabe hat eine Messung dahinter: test/validate.js, test/route_smoke.test.js, Bereichsprüfung in docs/STATUS.md.',
    },
    chapter_5_documents: docsIndex(),
    counts: { modules: mods.length, loadable: mods.filter((m) => m.loadable).length, areas: Object.keys(byArea).length, documents: docsIndex().length, quickstart_steps: QUICKSTART.length },
  };
}

function markdown() {
  const c = chapters();
  const L = [];
  L.push(`# ${c.book}`, '', `Erzeugt: ${c.generated_at}`, '');
  L.push(`**Module:** ${c.counts.modules} (davon ladbar: ${c.counts.loadable}) · **Bereiche:** ${c.counts.areas} · **Dokumente:** ${c.counts.documents}`, '');
  L.push('## 1. Schnellstart', '');
  for (const q of QUICKSTART_LINES(c)) L.push(`- **${q.step}** — \`${q.cmd}\``, `  ${q.note}`);
  L.push('', '## 2. Anleitung je Arbeitsbereich', '');
  for (const a of c.chapter_2_areas) {
    L.push(`### Bereich ${a.area} (${a.modules} Module)`, '');
    for (const m of a.entries) {
      L.push(`- **${m.name}** \`${m.id}\` — Zustand: ${m.state}${m.loadable ? '' : ` · NICHT LADBAR: ${m.error}`}`);
      if (m.actions.length) L.push(`  - Aufrufe: ${m.actions.map((x) => '`' + x + '`').join(', ')}`);
    }
    L.push('');
  }
  L.push('## 3. Der Mensch hat das letzte Wort', '', c.chapter_3_human_final.rule, '');
  for (const g of c.chapter_3_human_final.gates) L.push(`- ${g}`);
  L.push('', c.chapter_3_human_final.note, '');
  L.push('## 4. Ehrlichkeit', '');
  for (const n of c.chapter_4_honesty.not_connected_by_design) L.push(`- **${n.what}** — ${n.why}`);
  L.push('', c.chapter_4_honesty.verifying, '');
  L.push('## 5. Vorhandene Dokumente', '');
  for (const d of c.chapter_5_documents) L.push(`- \`${d.file}\` — ${d.title} (${Math.round(d.bytes / 1024)} KB)`);
  return L.join('\n') + '\n';
}
function QUICKSTART_LINES() { return QUICKSTART; }

function status() {
  const c = chapters();
  return { area: 'HB', module: 'handbooks', state: 'live', modules: c.counts.modules, loadable: c.counts.loadable, areas: c.counts.areas, documents: c.counts.documents, note: 'Handbuch wird bei jedem Abruf neu aus dem laufenden System gebaut.', honesty: c.chapter_4_honesty.not_connected_by_design };
}

module.exports = {
  meta: { area: 'HB', id: 'handbooks', name: 'Benutzerhandbücher (aus dem System erzeugt)', state: 'live' },
  actions: { status: () => status(), chapters: () => chapters(), module: (p) => modulePage((p || {}).id), markdown: () => ({ ok: true, markdown: markdown() }) },
  chapters, markdown, scanModules, docsIndex, status, QUICKSTART, FILE: null,
};

// Einzelne Modulseite: Fähigkeiten, Beispielaufrufe, was es NICHT tut.
function modulePage(id) {
  const key = String(id || '').replace(/\.js$/, '');
  const m = scanModules().find((x) => x.id === key || x.file === key);
  if (!m) return { ok: false, error: `Modul "${key}" nicht gefunden` };
  let mod = null;
  try { mod = require(path.join(LIB_DIR, m.file)); } catch (e) { return { ok: false, error: `nicht ladbar: ${e.message}` }; }
  return {
    ok: true, id: m.id, name: m.name || m.id, area: m.area, state: m.state, file: m.file, loadable: m.loadable,
    actions: m.actions,
    example: m.actions.slice(0, 4).map((a) => `GET/POST /api/${m.id}/${a}`),
    honesty: mod.meta && mod.meta.rule ? mod.meta.rule : 'Kein Täuschungsversuch: nicht Verbundenes steht als NOT-CONNECTED.',
    note: 'Beispielpfade folgen dem Muster /api/<modul>/<aktion> und gelten für gleichnamige Routen.',
  };
}
