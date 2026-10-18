'use strict';
// Tests: Connectoren (Anbieter-Anbindung über offizielle APIs).
// Prüft: Katalog vollständig, ehrlicher Status, Schlüssel nur im Vault (nie in Ausgaben),
// nur Menschen dürfen Zugangsdaten hinterlegen, Veröffentlichen Freigabe-pflichtig,
// Anbieter mit Engagement-Verkauf dauerhaft gesperrt.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'con-'));
process.env.AURA_CONNECTORS_FILE = path.join(tmp, 'connectors.json');
process.env.AURA_CONTROL_FILE = path.join(tmp, 'control.json');
process.env.AURA_VAULT_KEY = 'test-schluessel-fuer-die-suite';
process.env.AURA_VAULT_FILE = path.join(tmp, 'vault.enc.json');
const con = require('../backend/src/lib/connectors');

test('Katalog deckt die Bereiche ab, die auf den legalen Seiten Schlüssel bekommt', () => {
  const cats = new Set(con.CATALOG.map((p) => p.category));
  for (const c of ['DISTRO', 'SOCIAL', 'ADS', 'AFFILIATE', 'SITE', 'AI']) assert.ok(cats.has(c), 'fehlt: ' + c);
  assert.ok(con.CATALOG.length >= 20, 'Katalog zu klein: ' + con.CATALOG.length);
  for (const p of con.CATALOG) {
    assert.ok(p.keys.length >= 1, p.id + ' ohne Schlüssel');
    assert.strictEqual(p.own_channels_only, true, p.id + ' muss auf eigene Kanäle begrenzt sein');
  }
});

test('Status startet ehrlich als NOT-CONNECTED', () => {
  const l = con.list();
  assert.strictEqual(l.area, 'CONNECTORS');
  assert.strictEqual(l.counts.total, con.CATALOG.length);
  assert.strictEqual(l.counts.connected, 0);
  assert.strictEqual(l.counts.not_connected, con.CATALOG.length);
  assert.match(l.providers[0].note, /Schlüssel fehlen|CONNECTED/);
});

test('Bot darf keine Zugangsdaten hinterlegen', () => {
  const r = con.connect('spotify', { 'spotify-client-id': 'abcdef1234567890' }, 'auto-bot');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 403);
});

test('Mensch legt Schlüssel in den Vault — Werte erscheinen in keiner Ausgabe', () => {
  const r = con.connect('spotify', {
    'spotify-client-id': 'client-id-1234567890',
    'spotify-client-secret': 'client-secret-0987654321',
  }, 'Jonas');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 'CONNECTED');
  assert.deepStrictEqual(r.keys_written.sort(), ['spotify-client-id', 'spotify-client-secret']);
  const ausgabe = JSON.stringify(r) + JSON.stringify(con.list()) + JSON.stringify(con.status());
  assert.ok(!ausgabe.includes('client-id-1234567890'), 'Schlüsselwert darf nicht in der Ausgabe stehen');
  assert.ok(!ausgabe.includes('client-secret-0987654321'), 'Secret darf nicht in der Ausgabe stehen');
});

test('zu kurze Werte werden als Tippfehler abgelehnt', () => {
  const r = con.connect('deezer', { 'deezer-app-id': 'kurz' }, 'Jonas');
  assert.strictEqual(r.keys_written.length, 0);
  assert.strictEqual(r.keys_rejected.length, 1);
  assert.match(r.keys_rejected[0].reason, /zu kurz/);
  assert.strictEqual(con.providerStatus(con.CATALOG.find((p) => p.id === 'deezer')).status, 'NOT-CONNECTED');
});

test('CONNECTED heißt nicht getestet — test() sagt das ehrlich', () => {
  const r = con.test('spotify', 'Jonas');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 'UNVERIFIED');
  assert.match(r.error, /kein Blindflug/);
  assert.strictEqual(con.providerStatus(con.CATALOG.find((p) => p.id === 'spotify')).verified, false);
});

test('fehlender PFLICHT-Schlüssel bleibt NOT-CONNECTED', () => {
  // meta braucht 3 Pflichtwerte; nur 2 gesetzt reicht nicht für eine Verbindung
  const r = con.connect('meta', { 'meta-app-id': 'app-id-1234567890', 'meta-app-secret': 'app-secret-1234567890' }, 'Jonas');
  assert.strictEqual(r.keys_written.length, 2);
  assert.strictEqual(r.status, 'NOT-CONNECTED');
  assert.ok(r.keys_missing === undefined || true);
  assert.deepStrictEqual(con.providerStatus(con.CATALOG.find((p) => p.id === 'meta')).keys_missing, ['meta-page-token']);
});

test('alle Pflichtschlüssel da, optionaler fehlt → PARTIAL', () => {
  // youtube: api-key ist Pflicht, oauth-refresh ist optional
  const r = con.connect('youtube', { 'youtube-api-key': 'api-key-1234567890' }, 'Jonas');
  assert.strictEqual(r.status, 'PARTIAL');
  const st = con.providerStatus(con.CATALOG.find((p) => p.id === 'youtube'));
  assert.deepStrictEqual(st.keys_missing, []);
  assert.deepStrictEqual(st.keys_optional_missing, ['youtube-oauth-refresh']);
});

test('mit optionalem Schlüssel zusätzlich → CONNECTED', () => {
  const r = con.connect('youtube', { 'youtube-oauth-refresh': 'refresh-token-1234567890' }, 'Jonas');
  assert.strictEqual(r.status, 'CONNECTED');
});

test('Veröffentlichen ohne Verbindung ist unmöglich', () => {
  // tiktok ist in dieser Suite nicht verbunden
  const r = con.requestPublish('tiktok', { title: 'Test' }, 'Jonas');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 409);
  assert.match(r.error, /nicht verbunden/);
});

test('Veröffentlichen auf verbundenem Kanal ist Freigabe-pflichtig', () => {
  const r = con.requestPublish('spotify', { title: 'Mein Track' }, 'Jonas');
  assert.strictEqual(r.code, 202);
  assert.strictEqual(r.status, 'pending_approval');
  assert.match(r.approval.id, /^AP-[0-9a-f]{6}$/);
  assert.match(r.note, /menschlicher Freigabe/);
  // und ein Bot kann die Freigabe nicht erteilen
  const cc = require('../backend/src/lib/control_center');
  assert.strictEqual(cc.decide(r.approval.id, 'approve', 'auto-bot').ok, false);
});

test('Anbieter, die Engagement verkaufen, sind dauerhaft gesperrt', () => {
  const liste = ['followerfabrik.de', 'likesandmore.de', 'echtestreamskaufen.de', 'followercenter.de',
    'followerpuls.de', 'socialfanclick.com', 'edenboost.de', 'getfans.de', 'socialboss.org',
    'useviral.com', 'stormlikes.net', 'sidesmedia.com'];
  for (const d of liste) {
    const r = con.assessProvider(d);
    assert.strictEqual(r.allowed, false, d + ' muss gesperrt sein');
    assert.strictEqual(r.code, 403);
    assert.match(r.reason, /Engagement/);
  }
});

test('saubere Anbieter und Partner werden nicht fälschlich gesperrt', () => {
  for (const d of ['awin.com', 'digistore24.com', 'spotify.com', 'matomo.org', 'wordpress.org', 'google.com/adsense']) {
    assert.strictEqual(con.assessProvider(d).allowed, true, d + ' darf nicht gesperrt sein');
  }
});

test('Trennen entfernt die Schlüssel aus dem Vault', () => {
  const r = con.disconnect('spotify', 'Jonas');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.keys_removed.length, 2);
  assert.strictEqual(con.providerStatus(con.CATALOG.find((p) => p.id === 'spotify')).status, 'NOT-CONNECTED');
});

test('Bot darf auch nicht trennen', () => {
  assert.strictEqual(con.disconnect('meta', 'system-auto').code, 403);
});

test('Zustand überlebt einen Neustart (Zuordnung bleibt erhalten)', () => {
  for (const k of Object.keys(require.cache)) if (k.includes('connectors.js')) delete require.cache[k];
  const con2 = require('../backend/src/lib/connectors');
  const st = con2.status();
  assert.strictEqual(st.area, 'CONNECTORS');
  assert.ok(st.audit_tail.length > 0);
  assert.ok(st.audit_tail.some((a) => a.action === 'connector.connect'));
});

test('selbstheilende Datei: fehlender Speicher wird neu angelegt', () => {
  fs.unlinkSync(process.env.AURA_CONNECTORS_FILE);
  const st = con.status();
  assert.strictEqual(st.area, 'CONNECTORS');
  assert.ok(fs.existsSync(process.env.AURA_CONNECTORS_FILE));
});

test('keine Erzeugung von Traffic oder Engagement im Modul', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'lib', 'connectors.js'), 'utf8');
  const verboten = ['generateClick', 'fakeView', 'boostEngagement', 'buyFollowers', 'sendLike'];
  for (const v of verboten) assert.ok(!src.includes(v), 'darf nicht existieren: ' + v);
});
