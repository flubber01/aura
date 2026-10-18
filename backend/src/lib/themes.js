'use strict';
// AURA · Aussehen: Themes und Hintergründe für das Betriebssystem.
//
// Jedes Theme ist ein Satz Farben; jeder Hintergrund ist eine Fläche, die ohne Fremddatei auskommt
// (Farbverlauf, Raster, Wellen, Sterne, Papier, Beton — alles aus CSS). Beides zusammen wird als
// CSS-Variablen und Hintergrund-Regel ausgegeben und von den Seiten direkt verwendet.
//
// Warum keine Bilddateien: ein Hintergrundbild lädt eine fremde Datei. Hier wird gezeichnet, nicht
// geladen — nichts telefoniert nach Hause, nichts fehlt offline.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_THEMES_FILE || path.join(__dirname, '..', 'data', 'themes.json');

const THEMES = [
  { id: 'creed', name: 'Creed Street', note: 'Hausstil: tiefes Nachtblau mit Gold', vars: { bg: '#070c10', panel: '#0f1620', text: '#e8eef6', dim: '#9fb0c4', line: '#22303f', accent: '#e8c37a', accent2: '#5ad1c0', danger: '#ff6b6b', ok: '#5ad1c0', warn: '#ffc857' } },
  { id: 'aurora', name: 'Polarlicht', note: 'Türkis und Blau, weich', vars: { bg: '#071014', panel: '#0e1a20', text: '#eaf7f5', dim: '#9dc2c0', line: '#1f3a3d', accent: '#5ad1c0', accent2: '#7fb2ff', danger: '#ff7a7a', ok: '#5ad1c0', warn: '#ffd479' } },
  { id: 'studio', name: 'Studio (dunkel)', note: 'Für lange Sitzungen: wenig Blau, viel Ruhe', vars: { bg: '#111213', panel: '#1a1c1e', text: '#e9e9ea', dim: '#a3a6aa', line: '#2c2f33', accent: '#d8b26a', accent2: '#8fd0c9', danger: '#e06c6c', ok: '#8fd0c9', warn: '#e0b96c' } },
  { id: 'paper', name: 'Papier (hell)', note: 'Für Tageslicht und Textarbeit', vars: { bg: '#f6f4ef', panel: '#ffffff', text: '#1a1c20', dim: '#5c636e', line: '#d9d5cc', accent: '#8a6b2f', accent2: '#2f6f6a', danger: '#a83b3b', ok: '#2f6f6a', warn: '#8a6b2f' } },
  { id: 'highcontrast', name: 'Hoher Kontrast', note: 'Für schlechte Bildschirme und müde Augen', vars: { bg: '#000000', panel: '#0a0a0a', text: '#ffffff', dim: '#c9c9c9', line: '#4d4d4d', accent: '#ffd400', accent2: '#57e0ff', danger: '#ff3b3b', ok: '#57e0ff', warn: '#ffd400' } },
  { id: 'neon', name: 'Neon', note: 'Für Show und Stream', vars: { bg: '#0a0714', panel: '#140d24', text: '#f2eaff', dim: '#b9a6dd', line: '#2c1c4d', accent: '#ff5ad1', accent2: '#5affe0', danger: '#ff5a7a', ok: '#5affe0', warn: '#ffe45a' } },
  { id: 'creedlight', name: 'Creed Street hell', note: 'Hausstil am Tag', vars: { bg: '#fbf8f2', panel: '#ffffff', text: '#201c14', dim: '#6b6252', line: '#e2dbcb', accent: '#9a7529', accent2: '#1f6f68', danger: '#a33b3b', ok: '#1f6f68', warn: '#9a7529' } },
];

const BACKGROUNDS = [
  { id: 'none', name: 'Ohne', css: 'background: var(--panel);' },
  { id: 'gradient', name: 'Verlauf', css: 'background: radial-gradient(1200px 600px at 20% -10%, color-mix(in srgb, var(--accent) 18%, transparent), transparent), var(--bg);' },
  { id: 'grid', name: 'Raster', css: 'background-image: linear-gradient(color-mix(in srgb, var(--line) 70%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--line) 70%, transparent) 1px, transparent 1px); background-size: 32px 32px; background-color: var(--bg);' },
  { id: 'waves', name: 'Wellen', css: 'background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--accent2) 8%, transparent) 0 14px, transparent 14px 28px), var(--bg);' },
  { id: 'stars', name: 'Sterne', css: 'background-image: radial-gradient(color-mix(in srgb, var(--text) 45%, transparent) 1px, transparent 1px), radial-gradient(color-mix(in srgb, var(--accent) 55%, transparent) 1px, transparent 1px); background-size: 90px 90px, 140px 140px; background-position: 0 0, 40px 60px; background-color: var(--bg);' },
  { id: 'paper', name: 'Papier', css: 'background-image: repeating-linear-gradient(0deg, color-mix(in srgb, var(--line) 40%, transparent) 0 1px, transparent 1px 26px); background-color: var(--bg);' },
  { id: 'metal', name: 'Gebürstet', css: 'background-image: repeating-linear-gradient(90deg, color-mix(in srgb, var(--line) 55%, transparent) 0 1px, transparent 1px 3px); background-color: var(--bg);' },
  { id: 'stage', name: 'Bühne', css: 'background: radial-gradient(900px 420px at 50% 120%, color-mix(in srgb, var(--accent) 26%, transparent), transparent), linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--panel) 80%, #000));' },
];

function defaults() { return { default_theme: 'creed', default_background: 'gradient', chosen: {}, audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    if (!THEMES.some((t) => t.id === raw.default_theme)) raw.default_theme = 'creed';
    if (!BACKGROUNDS.some((b) => b.id === raw.default_background)) raw.default_background = 'gradient';
    if (!raw.chosen || typeof raw.chosen !== 'object') raw.chosen = {};
    if (!Array.isArray(raw.audit)) raw.audit = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function pick(id) { return THEMES.find((t) => t.id === id) || null; }
function pickBg(id) { return BACKGROUNDS.find((b) => b.id === id) || null; }

function css(themeId, backgroundId) {
  const d = load();
  const theme = pick(themeId) || pick(d.default_theme) || THEMES[0];
  const bg = pickBg(backgroundId) || pickBg(d.default_background) || BACKGROUNDS[1];
  const vars = Object.entries(theme.vars).map(([k, v]) => `  --${k}: ${v};`).join('\n');
  return `:root {\n${vars}\n  --bg-image: ${bg.css.replace(/^background:\s*/, '').replace(/;$/, '')};\n}\nbody { background: var(--bg-image); color: var(--text); }`;
}

function set(input) {
  const p = input || {};
  const d = load();
  const who = String(p.user || p.by || 'AURA');
  const theme = p.theme ? pick(p.theme) : null;
  const bg = p.background ? pickBg(p.background) : null;
  if (p.theme && !theme) return { ok: false, error: `Theme unbekannt. Erlaubt: ${THEMES.map((t) => t.id).join(', ')}` };
  if (p.background && !bg) return { ok: false, error: `Hintergrund unbekannt. Erlaubt: ${BACKGROUNDS.map((b) => b.id).join(', ')}` };
  d.chosen[who] = { theme: theme ? theme.id : (d.chosen[who] ? d.chosen[who].theme : d.default_theme), background: bg ? bg.id : (d.chosen[who] ? d.chosen[who].background : d.default_background), at: new Date().toISOString() };
  d.audit.unshift({ at: d.chosen[who].at, action: 'set', who, theme: d.chosen[who].theme, background: d.chosen[who].background });
  d.audit = d.audit.slice(0, 300);
  save(d);
  return { ok: true, chosen: d.chosen[who], css: css(d.chosen[who].theme, d.chosen[who].background).split('\n').length + ' CSS-Zeilen' };
}

function forUser(who) {
  const d = load();
  const c = (who && d.chosen[who]) || { theme: d.default_theme, background: d.default_background };
  return { ok: true, user: who || null, theme: c.theme, background: c.background, css: css(c.theme, c.background) };
}

// Für eine Seite fertig zum Einbauen (Kopfzeile, Farben, Ränder).
function page(input) {
  const p = input || {};
  const u = forUser(p.user);
  const theme = pick(u.theme);
  return { ok: true, theme: { id: theme.id, name: theme.name }, background: u.background, css: u.css, meta_color: theme.vars.bg, note: 'Ohne Fremddateien, ohne Bildabruf — alles gezeichnet.' };
}

function status() {
  const d = load();
  return {
    area: 'THEME', module: 'themes', state: 'live', file: FILE,
    themes: THEMES.length, backgrounds: BACKGROUNDS.length, combinations: THEMES.length * BACKGROUNDS.length,
    default_theme: d.default_theme, default_background: d.default_background, users_with_choice: Object.keys(d.chosen).length,
    rules: ['Kein Hintergrundbild aus dem Netz — jeder Hintergrund ist gezeichnet.', 'Jedes Theme liefert helle und dunkle Variante (creed/creedlight, studio/paper).', 'Farben sind CSS-Variablen: die Bausteine der Seite übernehmen sie automatisch.', 'Hoher Kontrast ist ein eigenes Theme, keine Notlösung.'],
  };
}

module.exports = {
  meta: { area: 'THEME', id: 'themes', name: 'Themes und Hintergründe (7 Aussehen × 8 Hintergründe, ohne Fremddateien)', state: 'live' },
  actions: { status: () => status(), list: () => ({ ok: true, themes: THEMES.map((t) => ({ id: t.id, name: t.name, note: t.note })), backgrounds: BACKGROUNDS.map((b) => ({ id: b.id, name: b.name })) }), css: (p) => ({ ok: true, css: css((p || {}).theme, (p || {}).background) }), set: (p) => set(p || {}), for_user: (p) => forUser((p || {}).user), page: (p) => page(p || {}) },
  THEMES, BACKGROUNDS, css, set, forUser, page, status,
};
