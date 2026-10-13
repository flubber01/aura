'use strict';
// Unit-Tests für Studio (Groove, Orchestrator, Musik-Skills). Lauf: node --test test/music_studio.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const st = require(path.join(__dirname, '..', 'backend', 'src', 'lib', 'music_studio'));

test('Groove ist deterministisch bei gleichem Seed', () => {
  const a = st.groove({ style: 'boom-bap', bars: 2, swing: 0.1, humanize: 0.01, seed: 7 });
  const b = st.groove({ style: 'boom-bap', bars: 2, swing: 0.1, humanize: 0.01, seed: 7 });
  assert.deepStrictEqual(a, b);
});

test('Groove: Kick auf Schritt 0 jedes Takts, Schritte im Takt-Raster', () => {
  const g = st.groove({ style: 'four-on-floor', bars: 2, seed: 1 });
  const kicks = g.hits.filter((h) => h.inst === 'kick').map((h) => h.step);
  assert.ok(kicks.includes(0) && kicks.includes(16));
  assert.ok(g.hits.every((h) => h.step >= 0 && h.step < g.bars * 16));
});

test('Groove: unbekannter Stil und Grenzen', () => {
  assert.throws(() => st.groove({ style: 'xyz' }));
  const g = st.groove({ style: 'trap', bars: 999, swing: 9, humanize: 9 });
  assert.strictEqual(g.bars, 16);
  assert.strictEqual(g.swing, 0.5);
  assert.strictEqual(g.humanize, 0.05);
});

test('Orchestrator: Abschnitte laufen durch, Takte summieren sich', () => {
  const o = st.orchestrate({ form: 'intro,verse,chorus,outro', bars: 4 });
  assert.strictEqual(o.total_bars, 16);
  assert.strictEqual(o.sections[2].start_bar, 8);
  assert.ok(o.instruments_used.includes('strings') || o.instruments_used.includes('lead'));
});

test('Orchestrator: Instrumentenfilter wirkt', () => {
  const o = st.orchestrate({ form: 'chorus', bars: 4, instruments: ['drums'] });
  assert.deepStrictEqual(o.instruments_used, ['drums']);
});

test('Orchestrator: unbekannter Abschnitt und zu lange Form werden abgelehnt', () => {
  assert.throws(() => st.orchestrate({ form: 'solo' }));
  assert.throws(() => st.orchestrate({ form: Array(25).fill('verse').join(',') }));
});

test('Musik-Skills: Suche nach Begriff findet Producer und Backing-Vocal', () => {
  assert.ok(st.skills('producer').some((s) => s.id === 'producer'));
  assert.ok(st.skills('backing vocal').some((s) => s.id === 'backing_vocal_artist'));
  assert.deepStrictEqual(st.skills('zzzgibtesnicht'), []);
});

test('Musik-Skills: nur Metadaten, jeder Eintrag hat Titel und Beschreibung', () => {
  const all = st.skills('', 100);
  assert.ok(all.length >= 15);
  assert.ok(all.every((s) => s.title && s.description));
});
