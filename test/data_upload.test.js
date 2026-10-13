'use strict';
// Unit-Tests für den geprüften Daten-Upload (Link-Listen).
// Lauf: node --test test/data_upload.test.js
// Schreibt NICHTS: getestet werden Vorschau und alle Ablehnungspfade der Übernahme.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const du = require(path.join(__dirname, '..', 'backend', 'src', 'lib', 'data_upload'));

const yp = (links) => JSON.stringify({ links });
const good = { name: 'Beispiel Tool', url: 'https://example.org/tool', category: 'dev-tools', desc: 'Kurze Beschreibung.' };

test('Quellen sind registriert', () => {
  const ids = du.KINDS().map((k) => k.id);
  assert.deepStrictEqual(ids.sort(), ['apis', 'yellowpages']);
});

test('gültige Yellow-Pages-Liste: Vorschau ok, Übernahme erlaubt', () => {
  const r = du.preview('yellowpages', yp([good]));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.accepted, 1);
  assert.strictEqual(r.rejected, 0);
  assert.strictEqual(r.can_commit, true);
});

test('nur https: http und andere Schemata werden abgelehnt', () => {
  const r = du.preview('yellowpages', yp([{ ...good, url: 'http://example.org' }, { ...good, name: 'Ftp', url: 'ftp://example.org' }]));
  assert.strictEqual(r.rejected, 2);
  assert.strictEqual(r.can_commit, false);
  assert.match(r.rejected_items[0].reason, /nur https/);
});

test('verbotene Inhalte werden abgelehnt (Umgehung, Mining, gekaufte Reichweite, Credential-Sammlung)', () => {
  const bad = [
    { ...good, name: 'Captcha Bypass Service' },
    { ...good, name: 'Free Faucet Hub' },
    { ...good, name: 'Buy Followers Fast' },
    { ...good, name: 'SMM Panel Deluxe' },
    { ...good, desc: 'Token harvest kit' },
    { ...good, name: 'Credential dump' },
  ];
  const r = du.preview('yellowpages', yp(bad));
  assert.strictEqual(r.rejected, bad.length, 'alle verbotenen müssen abgelehnt werden');
  assert.strictEqual(r.can_commit, false);
  assert.ok(r.rejected_items.every((x) => /verboten/.test(x.reason)));
});

test('Dubletten innerhalb der Datei werden erkannt', () => {
  const r = du.preview('yellowpages', yp([good, { ...good, name: 'Anderer Name' }]));
  assert.strictEqual(r.accepted, 1);
  assert.strictEqual(r.rejected, 1);
  assert.match(r.rejected_items[0].reason, /doppelt/);
});

test('Alles-oder-nichts: ein abgelehnter Eintrag sperrt die Übernahme', () => {
  const r = du.preview('yellowpages', yp([good, { ...good, name: 'Captcha Bypass X', url: 'https://x.example' }]));
  assert.strictEqual(r.can_commit, false);
});

test('ungültiges JSON und falsche Form: Fehler, kein Absturz', () => {
  assert.strictEqual(du.preview('yellowpages', '{kaputt').status, 400);
  assert.strictEqual(du.preview('yellowpages', JSON.stringify({ foo: 1 })).status, 400);
});

test('unbekannte Quelle: 400', () => {
  assert.strictEqual(du.preview('nope', '[]').status, 400);
});

test('API-Katalog (Textformat): Kommentare und Leerzeilen ignoriert, Fehler gemeldet', () => {
  const txt = '# Kommentar\n\nOpenRouter | https://openrouter.ai/docs | ai\nKaputt | nicht-eine-url | ai\n';
  const r = du.preview('apis', txt);
  assert.strictEqual(r.total, 2);
  assert.strictEqual(r.accepted, 1);
  assert.strictEqual(r.rejected, 1);
  assert.strictEqual(r.can_commit, false);
});

test('Übernahme: Rolle/Bot als Name wird abgelehnt (403), nichts geschrieben', () => {
  const r = du.commit('yellowpages', yp([good]), 'Bot-Agent');
  assert.strictEqual(r.status, 403);
});

test('Übernahme: zu kurzer Name (400)', () => {
  assert.strictEqual(du.commit('yellowpages', yp([good]), 'x').status, 400);
});

test('Übernahme: mit Ablehnungen (422), nichts geschrieben', () => {
  const r = du.commit('yellowpages', yp([{ ...good, name: 'Captcha Bypass Y' }]), 'Julian');
  assert.strictEqual(r.status, 422);
  assert.ok(Array.isArray(r.rejected_items));
});

test('FORBIDDEN-Muster erkennt Varianten, lässt harmlose Begriffe durch', () => {
  assert.ok(du.FORBIDDEN.test('captcha-bypass'));
  assert.ok(du.FORBIDDEN.test('crypto mining pool'));
  assert.ok(!du.FORBIDDEN.test('free-for.dev hosting and CI'));
});
