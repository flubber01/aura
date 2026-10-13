'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Eigener Modulordner und Zustand, nie die echten Dateien.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-mods-'));
const modsDir = path.join(root, 'modules');
fs.mkdirSync(modsDir);
process.env.AURA_MODULES_DIR = modsDir;
process.env.AURA_MODULE_STATE_FILE = path.join(root, 'state.json');
process.env.AURA_MODULE_CONFIG_FILE = path.join(root, 'config.json');

const M = require('../backend/src/lib/module_manifest');
const L = require('../backend/src/lib/module_loader');
const registry = require('../backend/src/lib/registry');

function mk(folder, manifest, src, rawManifest) {
  const dir = path.join(modsDir, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'aura.module.json'), rawManifest !== undefined ? rawManifest : JSON.stringify(manifest, null, 2));
  if (src !== undefined) fs.writeFileSync(path.join(dir, 'index.js'), src);
  return dir;
}
const base = (id, extra = {}) => ({
  id, name: 'Test ' + id, version: '1.0.0', description: 'Testmodul', author: 'Test', type: 'module', entry: 'index.js',
  permissions: [], capabilities: [{ name: 'echo', description: 'echo', permissions: [], input: { text: { type: 'string', required: true } } }],
  healthCheck: true, timeoutMs: 1000, ...extra,
});
const OK_SRC = "module.exports={initialize(c){this.c=c;},execute(a,i){return {action:a,echo:i.text||null};},healthCheck(){return {status:'ok'};},shutdown(){}};";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}
const st = (id) => L.get(id).status;

(async () => {
  // ---------- Fixtures ----------
  mk('fx-good', base('fx-good', { configSchema: { msg: { type: 'string', default: 'x' } } }), OK_SRC);
  mk('fx-conf', base('fx-conf', { configSchema: { token: { type: 'string', required: true } } }), OK_SRC);
  mk('fx-secret', base('fx-secret', { configSchema: { key: { type: 'string', secret: true, required: true } } }), OK_SRC);
  mk('fx-bad-json', null, undefined, '{ kaputt');
  mk('fx-badid', base('Bad_ID'), OK_SRC);
  mk('fx-dup1', base('fx-dup'), OK_SRC);
  mk('fx-dup2', base('fx-dup'), OK_SRC);
  mk('fx-dep', base('fx-dep', { dependencies: [{ id: 'nichtda' }] }), OK_SRC);
  mk('fx-ver', base('fx-ver', { dependencies: [{ id: 'fx-good', version: '>=9.0.0' }] }), OK_SRC);
  mk('fx-trav', base('fx-trav', { entry: '../../etc/passwd' }), OK_SRC);
  mk('fx-throw', base('fx-throw', { capabilities: [{ name: 'boom', description: 'wirft', permissions: [], input: {} }] }),
    "module.exports={execute(){throw new Error('kaputt im Modul');},healthCheck(){return {status:'ok'};}};");
  mk('fx-slow', base('fx-slow', { timeoutMs: 100, capabilities: [{ name: 'slow', description: 'langsam', permissions: [], input: {} }] }),
    "module.exports={execute(){return new Promise(r=>setTimeout(()=>r({late:true}),800));}};");
  mk('fx-legacy', base('fx-legacy', { capabilities: [{ name: 'ping', description: 'ping', permissions: [], input: {} }] }),
    "module.exports={actions:{ping:(i)=>({pong:true})}};");
  mk('fx-int', base('fx-int', { type: 'integration', mode: 'simulation', capabilities: [{ name: 'ping', description: 'sim', permissions: [], input: {} }] }),
    "module.exports={execute(){return {simulated:true};},healthCheck(){return {status:'simulation'};}};");

  L.discover();

  await t('Erkennung: gültige Module gefunden, kaputte mit Grund gemeldet', () => {
    const v = L.list();
    const ids = v.modules.map((m) => m.id);
    assert.ok(ids.includes('fx-good') && ids.includes('fx-conf') && ids.includes('fx-legacy'));
    assert.strictEqual(st('fx-bad-json'), 'ungueltig');
    assert.ok(L.get('fx-bad-json').errors[0].includes('kein gültiges JSON'));
    assert.strictEqual(st('fx-badid'), 'ungueltig');
    assert.strictEqual(st('fx-trav'), 'ungueltig');
    assert.ok(L.get('fx-trav').errors.some((e) => e.includes('verlässt den Modulordner')));
  });

  await t('Doppelte IDs: beide abgelehnt, Liste der Duplikate', () => {
    assert.strictEqual(st('fx-dup'), 'ungueltig');
    assert.ok(L.list().duplicates.includes('fx-dup'));
  });

  await t('Neues Modul nur durch Ordner: nach Anlegen erkannt, ohne andere Dateien zu ändern', () => {
    mk('fx-new', base('fx-new'), OK_SRC);
    L.discover();
    assert.ok(L.get('fx-new'), 'fx-new fehlt');
    assert.strictEqual(st('fx-new'), 'freigabe_erforderlich');
  });

  await t('Fehlende Abhängigkeit und Versionskonflikt werden erkannt', () => {
    assert.strictEqual(st('fx-dep'), 'abhaengigkeit_fehlt');
    assert.strictEqual(st('fx-ver'), 'version_konflikt');
  });

  await t('Keine Ausführung ohne Freigabe: Start wird verweigert', async () => {
    const r = await L.enable('fx-good', { by: 'Daniel' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 409);
  });

  await t('Freigabe nur durch Mensch (Agent-Name wird abgelehnt)', () => {
    assert.strictEqual(L.approve('fx-good', { by: 'Ultra-Bot' }).status, 403);
    assert.strictEqual(L.approve('fx-good', { by: '' }).status, 400);
    const ok = L.approve('fx-good', { by: 'Daniel' });
    assert.strictEqual(ok.ok, true);
    assert.deepStrictEqual(L.get('fx-good').granted, []);
  });

  await t('Aktivieren, ausführen, Eingabe wird gegen Schema geprüft', async () => {
    const r = await L.enable('fx-good', { by: 'Daniel' });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(st('fx-good'), 'bereit');
    const out = await L.execute('fx-good', 'echo', { text: 'hallo' });
    assert.strictEqual(out.ok, true);
    assert.deepStrictEqual(out.result, { action: 'echo', echo: 'hallo' });
    assert.strictEqual((await L.execute('fx-good', 'echo', {})).status, 400, 'Pflichtfeld fehlt');
    assert.strictEqual((await L.execute('fx-good', 'echo', { text: 'a', extra: 1 })).status, 400, 'unbekanntes Feld');
    assert.strictEqual((await L.execute('fx-good', 'gibtsnicht', {})).status, 404);
  });

  await t('Health-Check über Vertrag', async () => {
    const h = await L.health('fx-good');
    assert.strictEqual(h.health.status, 'ok');
  });

  await t('Deaktivieren stoppt die Instanz', async () => {
    const r = await L.disable('fx-good', { by: 'Daniel' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(st('fx-good'), 'deaktiviert');
    assert.strictEqual((await L.execute('fx-good', 'echo', { text: 'x' })).status, 409);
  });

  await t('Konfiguration: Typ, Schlüssel und Geheimnis-Regeln', () => {
    assert.strictEqual(L.setConfig('fx-good', { by: 'Daniel', values: { msg: 5 } }).status, 400);
    assert.strictEqual(L.setConfig('fx-good', { by: 'Daniel', values: { nope: 'x' } }).status, 400);
    const bad = L.setConfig('fx-secret', { by: 'Daniel', values: { key: 'abc' } });
    assert.strictEqual(bad.status, 400, 'Geheimnis darf nicht über API kommen');
    const ok = L.setConfig('fx-good', { by: 'Daniel', values: { msg: 'hallo welt' } });
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(L.get('fx-good').config.msg.value, 'hallo welt');
  });

  await t('Fehlende Pflicht-Konfiguration wird gemeldet', () => {
    L.approve('fx-conf', { by: 'Daniel' });
    assert.strictEqual(st('fx-conf'), 'konfiguration_erforderlich');
    assert.deepStrictEqual(L.get('fx-conf').missing_config, ['token']);
    L.setConfig('fx-conf', { by: 'Daniel', values: { token: 'x' } });
    assert.notStrictEqual(st('fx-conf'), 'konfiguration_erforderlich');
  });

  await t('Geheimnis aus Umgebungsvariable: fehlt, dann gesetzt, Wert nie in der Ausgabe', () => {
    L.approve('fx-secret', { by: 'Daniel' });
    assert.strictEqual(st('fx-secret'), 'konfiguration_erforderlich');
    const env = L.envName('fx-secret', 'key');
    assert.strictEqual(env, 'AURA_MOD_FX_SECRET_KEY');
    process.env[env] = 'GEHEIM-WERT-123';
    try {
      assert.notStrictEqual(st('fx-secret'), 'konfiguration_erforderlich');
      assert.ok(!JSON.stringify(L.list()).includes('GEHEIM-WERT-123'), 'Geheimnis darf nie ausgegeben werden');
    } finally { delete process.env[env]; }
  });

  await t('Isolation: Zeitüberschreitung bricht nur die Aktion ab', async () => {
    L.approve('fx-slow', { by: 'Daniel' });
    await L.enable('fx-slow', { by: 'Daniel' });
    const r = await L.execute('fx-slow', 'slow', {});
    assert.strictEqual(r.ok, false);
    assert.ok(/Zeitüberschreitung/.test(r.error));
    // Andere Module laufen weiter.
    await L.enable('fx-good', { by: 'Daniel' });
    assert.strictEqual((await L.execute('fx-good', 'echo', { text: 'weiter' })).ok, true);
  });

  await t('Quarantäne nach 3 Fehlern, Server und andere Module bleiben funktionsfähig', async () => {
    L.approve('fx-throw', { by: 'Daniel' });
    await L.enable('fx-throw', { by: 'Daniel' });
    for (let i = 0; i < 2; i++) assert.strictEqual((await L.execute('fx-throw', 'boom', {})).status, 500);
    const third = await L.execute('fx-throw', 'boom', {});
    assert.strictEqual(third.status, 429, 'nach dritttem Fehler Quarantäne');
    assert.strictEqual(st('fx-throw'), 'fehlerhaft');
    assert.strictEqual((await L.execute('fx-throw', 'boom', {})).status, 429);
    assert.strictEqual((await L.execute('fx-good', 'echo', { text: 'ok' })).ok, true);
    assert.ok(L.get('fx-throw').last_errors.length >= 3);
  });

  await t('Legacy-Adapter: actions-Objekt wird über den Vertrag erreichbar', async () => {
    L.approve('fx-legacy', { by: 'Daniel' });
    const r = await L.enable('fx-legacy', { by: 'Daniel' });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const out = await L.execute('fx-legacy', 'ping', {});
    assert.deepStrictEqual(out.result, { pong: true });
  });

  await t('Integration im Simulationsmodus gilt nie als verbunden', async () => {
    L.approve('fx-int', { by: 'Daniel' });
    await L.enable('fx-int', { by: 'Daniel' });
    assert.strictEqual(L.get('fx-int').connection, 'simulation');
    await L.health('fx-int');
    assert.strictEqual(L.get('fx-int').connection, 'simulation');
  });

  await t('Geänderte Datei verliert die Freigabe', async () => {
    assert.strictEqual(st('fx-good'), 'bereit');
    fs.writeFileSync(path.join(modsDir, 'fx-good', 'index.js'), OK_SRC + '// geändert');
    await L.reload();
    assert.strictEqual(st('fx-good'), 'freigabe_erforderlich');
  });

  await t('Manifest-Regeln: Rechte, Pfade, Geheimnis-Default, Typ', () => {
    assert.strictEqual(M.validateManifest(base('ok-id', { capabilities: [{ name: 'x1', permissions: ['network'], input: {} }] })).ok, false, 'Fähigkeit braucht deklariertes Recht');
    assert.strictEqual(M.validateManifest(base('ok-id', { permissions: ['gibts:nicht'] })).ok, false);
    assert.strictEqual(M.validateManifest(base('ok-id', { configSchema: { k: { type: 'string', secret: true, default: 'x' } } })).ok, false);
    assert.strictEqual(M.validateManifest(base('ok-id', { type: 'plugin' })).ok, false);
    assert.strictEqual(M.validateManifest(base('ok-id', { type: 'integration', mode: 'live', healthCheck: false })).ok, false, 'live braucht healthCheck');
    assert.strictEqual(M.validateManifest(base('ok-id', { timeoutMs: 999999 })).ok, false);
  });

  await t('Versionsbereiche und Pfadschutz (Einheiten)', () => {
    assert.strictEqual(M.satisfies('1.2.3', '>=1.2.0'), true);
    assert.strictEqual(M.satisfies('1.2.3', '^1.0.0'), true);
    assert.strictEqual(M.satisfies('2.0.0', '^1.0.0'), false);
    assert.strictEqual(M.satisfies('1.2.3', '1.2.3'), true);
    assert.strictEqual(M.satisfies('1.2.3', '1.2.4'), false);
    assert.strictEqual(M.safeEntry(modsDir, '/etc/passwd').ok, false);
    assert.strictEqual(M.safeEntry(modsDir, 'fx-good/../../x').ok, false);
  });

  await t('Rückwärtskompatibilität: bestehende Registry bleibt, Erweiterungen kommen dazu', () => {
    assert.strictEqual(registry.get('02').kind, 'live');
    assert.strictEqual(registry.get('67').kind, 'live');
    assert.strictEqual(registry.get('32').kind, 'restricted');
    const ext = registry.status().find((m) => m.area === 'fx-good');
    assert.ok(ext && ext.mode === 'module');
    assert.ok(registry.counts().module >= 1);
    assert.ok(registry.counts().live >= 20);
  });

  await t('Neu erkennen mit Start: freigegebene und aktivierte Module laufen wieder', async () => {
    await L.reload();
    assert.strictEqual(st('fx-legacy'), 'bereit');
  });

  console.log(`\nmodule_loader: ${pass} PASS / ${fail} FAIL`);
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  if (fail) process.exit(1);
})();
