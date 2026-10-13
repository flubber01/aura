'use strict';
// Tests: Steuerzentrale (Schalter, Freigabe-Tor, Kill-Switch, nur Menschen entscheiden).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.AURA_CONTROL_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-')), 'control.json');
const cc = require('../backend/src/lib/control_center');

test('riskante Aktion braucht Freigabe, nichts läuft direkt', () => {
  const r = cc.gate('sync', { by: 'Jonas' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 'pending_approval');
  assert.match(r.approval.id, /^AP-[0-9a-f]{6}$/);
});

test('Freigabe nur durch einen Menschen', () => {
  const r = cc.gate('sync', { by: 'Jonas' });
  assert.strictEqual(cc.decide(r.approval.id, 'approve', 'auto-bot').ok, false);
  assert.strictEqual(cc.decide(r.approval.id, 'approve', 'Agent Smith').ok, false);
  const ok = cc.decide(r.approval.id, 'approve', 'telegram:123');
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.approval.status, 'approved');
});

test('eine Freigabe kann nur einmal entschieden werden', () => {
  const r = cc.gate('upload_commit', { by: 'Jonas' });
  assert.strictEqual(cc.decide(r.approval.id, 'deny', 'Jonas').ok, true);
  const again = cc.decide(r.approval.id, 'approve', 'Jonas');
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.code, 409);
});

test('ausgeschaltete Aktion läuft nicht', () => {
  assert.strictEqual(cc.setEnabled('status', false, 'Jonas').ok, true);
  const r = cc.gate('status', { by: 'Jonas' });
  assert.strictEqual(r.code, 403);
  cc.setEnabled('status', true, 'Jonas');
});

test('Schalter nur durch einen Menschen', () => {
  assert.strictEqual(cc.setEnabled('status', false, 'system').code, 403);
});

test('Kill-Switch sperrt, außer Status und Bericht', () => {
  assert.strictEqual(cc.gate('snapshot', { by: 'Jonas', killed: true }).code, 423);
  assert.strictEqual(cc.gate('status', { by: 'Jonas', killed: true }).ok, true);
});

test('unbekannte Aktion gibt 404', () => {
  assert.strictEqual(cc.gate('gibts_nicht', { by: 'Jonas' }).code, 404);
});

test('Hochrisiko-Aktionen sind standardmäßig aus oder freigabepflichtig', () => {
  const byId = Object.fromEntries(cc.ACTIONS.map((a) => [a.id, a]));
  assert.strictEqual(byId.autonomy_heal.enabled, false);
  assert.strictEqual(byId.skill_install.enabled, false);
  for (const id of ['upload_commit', 'growth_publish', 'revive', 'sync']) assert.strictEqual(byId[id].approval, true, id);
});

test('Mensch-Prüfung: Bots und Agenten werden abgelehnt', () => {
  assert.strictEqual(cc.isHuman('Jonas'), true);
  assert.strictEqual(cc.isHuman('telegram:123'), true);
  assert.strictEqual(cc.isHuman('bot_helper'), false);
  assert.strictEqual(cc.isHuman('Agent-1'), false);
  assert.strictEqual(cc.isHuman('x'), false);
});
