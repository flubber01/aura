'use strict';
// Unit-Tests für die Notfall-Benachrichtigung. Lauf: node --test test/notify.test.js
// Kein Netz: ohne Konfiguration wird nichts gesendet.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const nt = require(path.join(__dirname, '..', 'backend', 'src', 'lib', 'notify'));

const KEYS = ['TELEGRAM_BOT_TOKEN', 'EMERGENCY_TELEGRAM_CHAT', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM', 'EMERGENCY_PHONE', 'EMERGENCY_PHONE_CALL'];
test.beforeEach(() => { for (const k of KEYS) delete process.env[k]; });
test.afterEach(() => { for (const k of KEYS) delete process.env[k]; });

test('ohne Konfiguration: kein Kanal, nichts gesendet', async () => {
  const s = nt.status();
  assert.strictEqual(s.telegram, false);
  assert.strictEqual(s.sms, false);
  assert.strictEqual(s.call, false);
  const r = await nt.notifyEmergency({ id: 'ESC-000001', kind: 'kill_switch', reason: 'test', deadline: 'x' });
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.channels, []);
});

test('SMS braucht gültige Rufnummer im E.164-Format', () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC123';
  process.env.TWILIO_AUTH_TOKEN = 'secret-token';
  process.env.TWILIO_FROM = '+4921100000';
  process.env.EMERGENCY_PHONE = '0171 123456'; // ungültig: kein +, Leerzeichen
  assert.strictEqual(nt.status().sms, false);
  process.env.EMERGENCY_PHONE = '+491711234567';
  assert.strictEqual(nt.status().sms, true);
});

test('Status zeigt keine Geheimnisse', () => {
  process.env.TWILIO_AUTH_TOKEN = 'GEHEIM-XYZ-999';
  assert.ok(!JSON.stringify(nt.status()).includes('GEHEIM-XYZ-999'));
});

test('Nachrichtentext ist kurz und enthält die ID', () => {
  const t = nt.msgText({ id: 'ESC-abc123', kind: 'integrity_loss', reason: 'Store defekt', deadline: '12:15' });
  assert.ok(t.includes('ESC-abc123'));
  assert.ok(t.length <= 300);
});
