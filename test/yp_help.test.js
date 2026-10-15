'use strict';
// Unit-Tests für die Gelbe-Seiten-Hilfe. Lauf: node --test test/yp_help.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const yp = require(path.join(__dirname, '..', 'backend', 'src', 'lib', 'yp_help'));

test('leere oder Stopwort-Suche liefert nichts', () => {
  assert.deepStrictEqual(yp.find(''), []);
  assert.deepStrictEqual(yp.find('der und die'), []);
});

test('Treffer nach Name und Kategorie, begrenzt', () => {
  const r = yp.find('daw', 3);
  assert.ok(r.length >= 1 && r.length <= 3);
  assert.ok(r.every((x) => x.url && x.name && x.category));
});

test('Limit wird begrenzt (max 10)', () => {
  assert.ok(yp.find('music', 99).length <= 10);
});

test('nur lesend: keine Netzwerkaufrufe nötig, Ergebnis ist reines JSON', () => {
  const r = yp.find('sample', 2);
  assert.doesNotThrow(() => JSON.stringify(r));
});
