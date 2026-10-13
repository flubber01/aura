#!/usr/bin/env node
'use strict';
// Erzeugt docs/FUNKTIONEN.md: A–Z-Verzeichnis aller Routen, Module, Seiten und Tests mit Querverweisen.
// Nur lesend. Aufruf: node scripts/build_function_index.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'FUNKTIONEN.md');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const list = (d, re) => { try { return fs.readdirSync(d).filter((f) => re.test(f)).sort(); } catch { return []; } };

// ---- Quellen einlesen ----
const server = read(path.join(ROOT, 'backend', 'server.js'));
const routes = [...new Set([...server.matchAll(/p === '(\/api[^']*)'/g)].map((m) => m[1]))].sort();

const libDir = path.join(ROOT, 'backend', 'src', 'lib');
const libs = list(libDir, /\.js$/).map((f) => f.replace(/\.js$/, ''));

const pagesDir = path.join(ROOT, 'backend', 'pages');
const pages = list(pagesDir, /\.js$/).map((f) => f.replace(/\.js$/, ''));

const tests = list(path.join(ROOT, 'test'), /\.test\.js$|^validate\.js$/);
const docs = list(path.join(ROOT, 'docs'), /\.md$/).map((f) => ({ name: f, text: read(path.join(ROOT, 'docs', f)) }));
docs.push({ name: '../README.md', text: read(path.join(ROOT, 'README.md')) });

const serverAll = server + read(path.join(ROOT, 'backend', 'pages', 'ext_modules_block.js'));
const testText = tests.map((t) => read(path.join(ROOT, 'test', t))).join('\n');
const docNamesFor = (needle) => docs.filter((d) => needle && d.name !== 'FUNKTIONEN.md' && d.text.includes(needle)).map((d) => d.name.replace(/\.md$/, ''));
// test/route_smoke.test.js liest alle Routen aus server.js und prüft sie, also gelten alle Routen als getestet.
const smokeCovers = tests.includes('route_smoke.test.js');
const requiredBy = (name) => {
  const re = new RegExp("require\\(['\"][./]*(?:src/)?(?:lib/)?" + name + "(?:\\.js)?['\"]\\)");
  const hits = [];
  for (const dir of [path.join(ROOT, 'backend'), path.join(ROOT, 'backend', 'pages'), libDir, path.join(ROOT, 'backend', 'modules'), path.join(ROOT, 'test'), path.join(ROOT, 'scripts')]) {
    for (const f of list(dir, /\.js$/)) if (re.test(read(path.join(dir, f)))) hits.push(f);
  }
  return hits;
};
const firstComment = (src) => {
  const line = src.split('\n').find((l) => /^\s*\/\/\s*\S/.test(l) && !/^#!/.test(l) && !/use strict/.test(l));
  return line ? line.replace(/^\s*\/\/\s*/, '').slice(0, 140) : '';
};

// ---- Einträge ----
const entries = [];

for (const r of routes) {
  const testHit = smokeCovers || testText.includes(r) ? 'ja' : 'nein';
  entries.push({ name: r, kind: 'Route', file: 'backend/server.js', test: testHit, docs: docNamesFor(r), note: '' });
}
for (const l of libs) {
  const src = read(path.join(libDir, l + '.js'));
  const used = requiredBy(l);
  const standalone = /^#!/.test(src);
  entries.push({
    name: l, kind: 'Modul', file: `backend/src/lib/${l}.js`,
    test: testText.includes(l) || tests.some((t) => t.startsWith(l)) ? 'ja' : 'nein',
    docs: docNamesFor(l), note: firstComment(src),
    wired: used.length > 0 || standalone ? (standalone && used.length === 0 ? 'eigenständig' : 'ja') : 'nein',
  });
}
for (const p of pages) {
  const src = read(path.join(pagesDir, p + '.js'));
  entries.push({ name: p, kind: 'Seite', file: `backend/pages/${p}.js`, test: '—', docs: docNamesFor(p), note: firstComment(src), wired: serverAll.includes(p) ? 'ja' : 'nein' });
}

entries.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));

// ---- Markdown ----
const gaps = [];
for (const e of entries) {
  if (e.kind === 'Modul' && e.wired === 'nein') gaps.push(`${e.name}: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)`);
  if (e.kind === 'Modul' && e.wired === 'eigenständig' && e.docs.length === 0) gaps.push(`${e.name}: eigenständiges Skript ohne Doku-Verweis`);
  if (e.kind === 'Route' && e.test === 'nein') gaps.push(`${e.name}: Route ohne Test-Verweis`);
  if (e.kind === 'Seite' && e.wired === 'nein') gaps.push(`${e.name}: Seite nicht im Server verlinkt`);
}

const letters = {};
for (const e of entries) {
  const k = /^[a-zA-Z]/.test(e.name) ? e.name[0].toUpperCase() : '#';
  (letters[k] = letters[k] || []).push(e);
}

const lines = [];
lines.push('# AURA — Funktionsverzeichnis A–Z', '');
lines.push('Automatisch erzeugt mit `node scripts/build_function_index.js`. Nicht von Hand bearbeiten.', '');
lines.push(`Stand: ${new Date().toISOString().slice(0, 10)} · Routen: ${routes.length} · Module: ${libs.length} · Seiten: ${pages.length} · Tests: ${tests.length}`, '');
lines.push('Spalten: **Name** · **Typ** · **Datei** · **Test** (Verweis in test/) · **Verbunden** (im Server/Skript eingebunden) · **Doku** (Verweis in docs/).', '');
lines.push('## Lücken', '');
lines.push(gaps.length ? gaps.map((g) => '- ' + g).join('\n') : '- keine', '');
lines.push('## Index', '');
lines.push(Object.keys(letters).sort().map((k) => `[${k}](#${k.toLowerCase()})`).join(' · '), '');
for (const k of Object.keys(letters).sort()) {
  lines.push(`## ${k}`, '');
  lines.push('| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const e of letters[k]) {
    const wired = e.wired || (e.kind === 'Route' ? 'ja' : '—');
    const doc = e.docs.length ? e.docs.join(', ') : '—';
    const note = (e.note || '').replace(/\|/g, '/');
    lines.push(`| \`${e.name}\` | ${e.kind} | \`${e.file}\` | ${e.test} | ${wired} | ${doc} | ${note} |`);
  }
  lines.push('');
}
fs.writeFileSync(OUT, lines.join('\n'));
console.log(`geschrieben: ${path.relative(ROOT, OUT)} · Einträge ${entries.length} · Lücken ${gaps.length}`);
