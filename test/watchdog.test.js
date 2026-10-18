'use strict';
// Tests: Watchdog (Dienst-Aufsicht, 3-Strike-Regel, Sleep-Mode, Live-Übersicht).
// Prüft die Betriebs-Anforderungen: automatischer Neustart, erst nach 3 harten Fehlern bleibt ein
// Dienst unten, Benachrichtigung, Zustandssicherung im Sleep-Mode, Reaktivierung nur durch den Admin.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.AURA_WATCHDOG_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wd-')), 'watchdog.json');
const wd = require('../backend/src/lib/watchdog');

let started = 0, stopped = 0, sollKnallen = false, meldungen = [];
const makeJob = (name) => ({
  name,
  start: () => { started += 1; if (sollKnallen) throw new Error('Datei-Integration kaputt'); },
  stop: () => { stopped += 1; },
});

test('Registrierung verlangt Namen und start()', () => {
  assert.throws(() => wd.register({ start: () => {} }), /ohne Namen/);
  assert.throws(() => wd.register({ name: 'x' }), /braucht start/);
  wd.register(makeJob('sync-daemon'));
  wd.register(makeJob('report-daemon'));
  assert.deepStrictEqual(wd.registered().sort(), ['report-daemon', 'sync-daemon']);
});

test('Dienst startet und gilt in der Übersicht als arbeitend', () => {
  const r = wd.startService('sync-daemon');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 'RUNNING');
  const st = wd.status();
  assert.strictEqual(st.area, 'WATCHDOG');
  const svc = st.services.find((s) => s.name === 'sync-daemon');
  assert.strictEqual(svc.status, 'RUNNING');
  assert.strictEqual(svc.working, true);
  assert.strictEqual(svc.max_strikes, 3);
});

test('Herzschlag frischt den Dienst auf, ohne den Status zu verfälschen', () => {
  const b = wd.beat('sync-daemon', 'letzter Lauf ok');
  assert.strictEqual(b.ok, true);
  const svc = wd.status().services.find((s) => s.name === 'sync-daemon');
  assert.strictEqual(svc.beat_stale, false);
  assert.match(svc.last_beat, /^\d{4}-\d{2}-\d{2}T/);
});

test('unbekannter Dienst wird sauber abgewiesen', () => {
  assert.strictEqual(wd.startService('gibt-es-nicht').code, 404);
  assert.strictEqual(wd.beat('gibt-es-nicht').code, 404);
  assert.strictEqual(wd.stopService('gibt-es-nicht').code, 404);
});

test('Absturz: Neustart solange Strikes unter 3 liegen', () => {
  sollKnallen = true;
  const c1 = wd.crash('sync-daemon', new Error('kaputt'));
  assert.strictEqual(c1.strike, 1);
  assert.strictEqual(c1.restart, false);           // Neustart scheiterte (Job wirft weiter)
  const c2 = wd.crash('sync-daemon', new Error('kaputt'));
  assert.strictEqual(c2.strike, 2);
  assert.strictEqual(c2.status, 'DOWN');
});

test('nach 3 harten Fehlern bleibt der Dienst unten und der Admin wird benachrichtigt', () => {
  const notes = [];
  wd.setNotifier((subject, detail) => notes.push({ subject, detail }));
  const c3 = wd.crash('sync-daemon', new Error('kaputt'));
  assert.strictEqual(c3.strike, 3);
  assert.strictEqual(c3.status, 'DOWN_PERMANENT');
  assert.strictEqual(c3.restart, false);
  assert.strictEqual(c3.notified, true);
  assert.strictEqual(notes.length, 1);
  assert.match(notes[0].subject, /3 harten Fehlern/);
  assert.match(notes[0].detail, /sync-daemon/);
});

test('ein stehender Dienst startet nicht von allein wieder', () => {
  const r = wd.startService('sync-daemon');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 423);
  assert.match(r.error, /Admin muss ihn freigeben/);
});

test('Admin gibt frei: Strikes zurück auf null, Dienst läuft', () => {
  sollKnallen = false;
  const r = wd.revive('sync-daemon', 'Auraos');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 'RUNNING');
  assert.strictEqual(wd.status().services.find((s) => s.name === 'sync-daemon').strikes, 0);
});

test('normaler Neustart zählt keinen Strike hoch (kein Doppelzählen)', () => {
  const vorher = wd.status().services.find((s) => s.name === 'report-daemon').strikes;
  wd.startService('report-daemon');
  assert.strictEqual(wd.status().services.find((s) => s.name === 'report-daemon').strikes, vorher);
});

test('einzelnen Dienst abschalten', () => {
  const r = wd.stopService('report-daemon', 'Auraos');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.status, 'STOPPED');
  const svc = wd.status().services.find((s) => s.name === 'report-daemon');
  assert.strictEqual(svc.status, 'STOPPED');
  assert.strictEqual(svc.working, false);
});

test('Sleep-Mode: alles steht, Zustand liegt lokal, Start ist gesperrt', () => {
  const s = wd.sleep('Nachtruhe', 'Auraos');
  assert.strictEqual(s.ok, true);
  assert.strictEqual(s.sleeping, true);
  assert.strictEqual(s.stopped.length, 2);
  assert.ok(fs.existsSync(process.env.AURA_WATCHDOG_FILE));
  const st = wd.status();
  assert.strictEqual(st.sleeping, true);
  assert.strictEqual(st.sleep.reason, 'Nachtruhe');
  assert.strictEqual(st.counts.running, 0);
  const r = wd.startService('sync-daemon');
  assert.strictEqual(r.code, 423);
  assert.match(r.error, /Sleep-Mode/);
});

test('Wake startet alles außer den hart gestoppten Diensten', () => {
  const w = wd.wake('Auraos');
  assert.strictEqual(w.ok, true);
  assert.strictEqual(w.sleeping, false);
  assert.ok(w.started.includes('sync-daemon'));
  assert.ok(w.started.includes('report-daemon'));
  assert.strictEqual(wd.status().sleeping, false);
});

test('Preflight prüft Verzeichnis, Zustand und Selbstreparatur', () => {
  const p = wd.preflight();
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.checks.length, 3);
  assert.ok(p.checks.every((c) => c.ok));
  assert.ok(p.checks.some((c) => c.check === 'selbstreparatur-verfuegbar'));
});

test('Zustand überlebt einen Neustart des Prozesses (Zustandssicherung)', () => {
  wd.stopService('report-daemon', 'Auraos');
  for (const k of Object.keys(require.cache)) if (k.includes('watchdog.js')) delete require.cache[k];
  const wd2 = require('../backend/src/lib/watchdog');   // frisch geladen: liest die Datei
  const svc = wd2.status().services.find((s) => s.name === 'report-daemon');
  assert.strictEqual(svc.status, 'STOPPED');
  assert.ok(wd2.status().audit_tail.length > 0);
});

test('selfheilende Datei: fehlender Speicher wird neu angelegt', () => {
  fs.unlinkSync(process.env.AURA_WATCHDOG_FILE);
  const st = wd.status();
  assert.strictEqual(st.area, 'WATCHDOG');
  assert.ok(fs.existsSync(process.env.AURA_WATCHDOG_FILE));
});

test('Watchdog startet nur Dienste neu — er erzeugt keinen Traffic und kein Engagement', () => {
  const names = Object.keys(wd).map((k) => k.toLowerCase());
  const verboten = ['traffic', 'click', 'view', 'like', 'boost', 'scrape', 'proxy', 'fingerprint', 'clicker'];
  assert.deepStrictEqual(names.filter((n) => verboten.some((v) => n.includes(v))), []);
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'src', 'lib', 'watchdog.js'), 'utf8');
  assert.ok(!/https?:\/\//.test(src), 'kein Netzwerkziel im Watchdog');
});
