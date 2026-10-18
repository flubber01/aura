// Prüfsatz Meilensteine: Katalog, Zählung, Verleihung, Doppelverleihungsschutz,
// Session-/Tag-Entdopplung, Fortschrittsrechnung, Speicher über Prozessgrenzen, Seite.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
process.env.AURA_MILESTONES_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ms-')), 'milestones.json');
const ms = require('../backend/src/lib/milestones');

const results = [];
const t = (name, fn) => {
  try { fn(); results.push('  ok   ' + name); }
  catch (e) { results.push('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
};

t('Katalog: Kennungen eindeutig, Schwellen je Kette aufsteigend, Namen und Texte gesetzt', () => {
  const ids = new Set();
  for (const m of ms.CATALOG) {
    assert.ok(!ids.has(m.id), 'doppelte Kennung ' + m.id);
    ids.add(m.id);
    assert.ok(m.name && m.text && m.einheit, m.id + ' unvollständig');
  }
  for (const metric of ms.METRICS) {
    const chain = ms.CATALOG.filter((m) => m.metric === metric).sort((a, b) => a.schwelle - b.schwelle);
    assert.ok(chain.length >= 2, metric + ' hat keine Kette');
    for (let i = 1; i < chain.length; i++) assert.ok(chain[i].schwelle > chain[i - 1].schwelle, metric + ' nicht aufsteigend');
  }
});

t('Zeitmeilenstein: 10 Minuten verleihen „ERSTE SCHRITTE“, kein zweites Mal', () => {
  const r1 = ms.track('u1', 'zeit', 10);
  assert.ok(r1.ok);
  assert.deepStrictEqual(r1.neu.map((m) => m.id), ['zeit-10']);
  assert.strictEqual(r1.neu[0].name, 'ERSTE SCHRITTE');
  assert.ok(Date.parse(r1.neu[0].verliehen_am) > 0, 'Verleihzeitpunkt fehlt');
  const r2 = ms.track('u1', 'zeit', 1);
  assert.deepStrictEqual(r2.neu, [], 'doppelt verliehen');
});

t('Sprung über mehrere Stufen verlieht die ganze Kette in Reihenfolge', () => {
  const r = ms.track('u2', 'zeit', 70);
  assert.deepStrictEqual(r.neu.map((m) => m.id), ['zeit-10', 'zeit-60']);
});

t('Sessions werden je Session-Kennung nur einmal gezählt', () => {
  ms.track('u3', 'session', 1, { session: 'a' });
  ms.track('u3', 'session', 1, { session: 'a' });
  ms.track('u3', 'session', 1, { session: 'b' });
  assert.strictEqual(ms.status('u3').werte.sessions, 2);
});

t('Tage werden je Datum nur einmal gezählt', () => {
  ms.track('u4', 'tag', 1, { datum: '2026-10-01' });
  ms.track('u4', 'tag', 1, { datum: '2026-10-01' });
  ms.track('u4', 'tag', 1, { datum: '2026-10-02' });
  assert.strictEqual(ms.status('u4').werte.tage, 2);
});

t('Fortschritt: Prozent und Fehlmenge zum nächsten Meilenstein stimmen', () => {
  ms.track('u5', 'zeit', 30);
  const k = ms.status('u5').ketten.find((x) => x.metric === 'zeit');
  assert.strictEqual(k.naechster.id, 'zeit-60');
  assert.strictEqual(k.naechster.fehlt, 30);
  assert.strictEqual(k.naechster.prozent, 50);
  assert.ok(k.verliehen.some((v) => v.id === 'zeit-10'), 'zeit-10 fehlt in der Verliehen-Liste');
});

t('Unbekanntes Ereignis wird abgelehnt und nennt die erlaubten', () => {
  const r = ms.track('u6', 'flugstunden', 3);
  assert.strictEqual(r.ok, false);
  assert.ok(Array.isArray(r.erlaubt) && r.erlaubt.includes('zeit'));
});

t('Inhalte und Klicks zählen einfach hoch', () => {
  ms.track('u7', 'inhalt', 1);
  ms.track('u7', 'klick', 5);
  ms.track('u7', 'klick');
  const w = ms.status('u7').werte;
  assert.strictEqual(w.inhalte, 1);
  assert.strictEqual(w.klicks, 6);
});

t('Nutzer bleiben getrennt', () => {
  assert.strictEqual(ms.status('u1').werte.zeit, 11);
  assert.strictEqual(ms.status('u8').werte.zeit, 0);
  assert.strictEqual(ms.status('u8').gesamt_verliehen, 0);
});

t('Speicher trägt über Prozessgrenzen (schreiben und in neuem Prozess lesen)', () => {
  const datei = process.env.AURA_MILESTONES_FILE;
  ms.track('u9', 'zeit', 60);
  assert.ok(fs.existsSync(datei), 'Datei nicht geschrieben');
  const out = execFileSync(process.execPath, ['-e',
    'const m=require(' + JSON.stringify(path.join(__dirname, '..', 'backend', 'src', 'lib', 'milestones.js')) + ');' +
    'process.stdout.write(String(m.status("u9").werte.zeit));'],
    { env: Object.assign({}, process.env) }).toString();
  assert.strictEqual(out, '60');
});

t('Seite: Heartbeat, Klickdrossel und Fortschrittsbalken enthalten', () => {
  const html = ms.page('u1');
  assert.ok(html.includes("setInterval(function(){ping('zeit',1,"), 'Heartbeat fehlt');
  assert.ok(html.includes("document.addEventListener('click'"), 'Klickzählung fehlt');
  assert.ok(html.includes('█'), 'Balken fehlt');
  assert.ok(html.includes('ERSTE SCHRITTE'), 'Verliehener Meilenstein fehlt auf der Seite');
});

t('Statusroute nennt Pfade, Datei und Ereignisse', () => {
  const s = ms.statusRoute();
  assert.strictEqual(s.seite, '/meilensteine');
  assert.ok(s.ereignisse.zeit && s.ereignisse.session && s.ereignisse.tag && s.ereignisse.inhalt && s.ereignisse.klick);
  assert.ok(s.anzahl_meilensteine >= 14);
});

console.log(results.join('\n'));
const fail = results.filter((r) => r.startsWith('  FAIL')).length;
console.log('\nMeilensteine: ' + (results.length - fail) + ' pass / ' + fail + ' fail');
