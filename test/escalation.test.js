'use strict';
// Unit-Tests für die Eskalation. Lauf: node --test test/escalation.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
process.env.AURA_ESCALATION_TIMEOUT_MS = '60000';
const esc = require(path.join(__dirname, '..', 'backend', 'src', 'lib', 'escalation'));
const T0 = Date.parse('2026-10-13T12:00:00Z');
test.beforeEach(() => esc.reset());

test('kritisches Ereignis legt offenen Eintrag an, ohne Kanal ist notify=no_channel', () => {
  const e = esc.raise({ kind: 'kill_switch', reason: 'test' }, T0);
  assert.strictEqual(e.status, 'waiting_human');
  assert.strictEqual(e.notify, 'no_channel');
  assert.strictEqual(esc.isFrozen(), false);
});

test('unbekannte Art wird abgelehnt', () => {
  assert.throws(() => esc.raise({ kind: 'egal' }, T0));
});

test('gleiche Art doppelt offen → derselbe Eintrag', () => {
  const a = esc.raise({ kind: 'integrity_loss', reason: 'x' }, T0);
  const b = esc.raise({ kind: 'integrity_loss', reason: 'y' }, T0 + 1000);
  assert.strictEqual(a.id, b.id);
});

test('vor Ablauf der Frist: nicht eingefroren', () => {
  esc.raise({ kind: 'kill_switch' }, T0);
  const r = esc.tick(T0 + 30000);
  assert.strictEqual(r.frozen, false);
});

test('nach Ablauf ohne Bestätigung: eingefroren, onFreeze wird gerufen', () => {
  esc.raise({ kind: 'kill_switch' }, T0);
  let called = 0;
  esc.tick(T0 + 61000, () => { called++; });
  assert.strictEqual(esc.isFrozen(), true);
  assert.strictEqual(called, 1);
  assert.strictEqual(esc.list()[0].status, 'expired_frozen');
});

test('Bestätigung vor Ablauf verhindert das Einfrieren', () => {
  const e = esc.raise({ kind: 'kill_switch' }, T0);
  assert.strictEqual(esc.ack(e.id, 'nutzer').ok, true);
  esc.tick(T0 + 120000);
  assert.strictEqual(esc.isFrozen(), false);
});

test('Wiederanlauf nur über thaw, System hebt nicht selbst auf', () => {
  esc.raise({ kind: 'kill_switch' }, T0);
  esc.tick(T0 + 61000);
  assert.strictEqual(esc.isFrozen(), true);
  esc.tick(T0 + 999999); // erneuter Tick hebt nichts auf
  assert.strictEqual(esc.isFrozen(), true);
  assert.strictEqual(esc.thaw('mensch').was_frozen, true);
  assert.strictEqual(esc.isFrozen(), false);
});

test('unbekannte Bestätigung → 404', () => {
  assert.strictEqual(esc.ack('ESC-000000', 'x').code, 404);
});
