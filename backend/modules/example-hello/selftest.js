'use strict';
// Selbsttest des Beispielmoduls „example-hello“.
// Läuft beim Import als EIGENER Kindprozess: 10 Sekunden Zeit, kein Netz, kein Schreiben,
// keine Umgebungsvariablen (siehe backend/src/preload/module_selftest_sandbox.js).
// Ausgabe auf stdout ist ein kleines Protokoll; Exit 0 heißt bestanden.

const modul = require('./index.js');

const protokoll = [];
const kontext = {                       // nachgebauter Modul-Kontext, ohne echte AURA-Interna
  id: 'example-hello',
  name: 'Beispiel: Hallo-Modul',
  version: '1.0.0',
  config: { greeting: 'Hallo', shout: false },
  log() {},
  audit(event, detail) { protokoll.push({ audit: event, detail }); },
  services: { registry: { counts: () => ({ total: 7 }) } },
};

const pruefungen = [];
function pruefe(name,bedingung,detail){pruefungen.push({name,ok:bedingung===true,detail:detail||''});}

try {
  modul.initialize(kontext);

  const gruss = modul.execute('greet', { name: 'Selbsttest' }, kontext);
  pruefe('greet liefert Text', typeof gruss.text === 'string' && gruss.text.includes('Selbsttest'), gruss.text);

  const gross = modul.execute('greet', { name: 'Welt' }, Object.assign({}, kontext, { config: { greeting: 'Hallo', shout: true } }));
  pruefe('shout schreibt groß', gross.text === gross.text.toUpperCase(), gross.text);

  const zaehlung = modul.execute('count_modules', {}, kontext);
  pruefe('count_modules zählt', zaehlung.registry_entries === 7, String(zaehlung.registry_entries));

  const gesund = modul.healthCheck ? modul.healthCheck(kontext) : { status: 'unbekannt' };
  pruefe('healthCheck meldet ok', gesund.status === 'ok', gesund.detail || gesund.status);

  let unbekannt = false;
  try { modul.execute('gibtsnicht', {}, kontext); } catch { unbekannt = true; }
  pruefe('unbekannte Aktion wirft', unbekannt, 'execute() lehnt Unbekanntes ab');

  modul.shutdown(kontext);
  const aus = modul.healthCheck ? modul.healthCheck(kontext) : { status: 'ok' };
  pruefe('shutdown setzt zurück', aus.status === 'fehler', aus.status);
} catch (fehler) {
  pruefe('Selbsttest ohne Ausnahme', false, String(fehler && fehler.message || fehler));
}

const bestanden = pruefungen.every((p) => p.ok);
console.log(JSON.stringify({ ok: bestanden, modul: 'example-hello', pruefungen, audit: protokoll.length }, null, 2));
process.exit(bestanden ? 0 : 1);
