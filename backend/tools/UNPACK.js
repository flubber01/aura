// UNPACK.js — vom AURA-Team.
//
// Aufgabe: Die "STAND"-Dumps (AURA-STAND-TEIL-*.txt / AURA-STAND-v2-TEIL-*.txt) wieder
// in echte Dateien im Repo auspacken. Jeder Block sieht so aus:
//
//   @@AURA-FILE@@backend/pages/hub.js@@
//   ...inhalt...
//   @@AURA-END@@
//
// Gebrauch:  node backend/tools/UNPACK.js <dump-teile...> [--out <zielordner>] [--dry]
//
// Sicherheit: Pfade mit '..' oder absolute Pfade werden uebersprungen, damit ein Dump
// niemals aus dem Zielordner ausbrechen kann. Es wird nie etwas geloescht, nur geschrieben.
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const outIdx = args.indexOf('--out');
const outDir = path.resolve(outIdx >= 0 ? args[outIdx + 1] : process.cwd());
const inputs = args.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1);

if (!inputs.length) {
  console.error('Gebrauch: node backend/tools/UNPACK.js <dump-teile...> [--out <ordner>] [--dry]');
  process.exit(1);
}

let text = '';
for (const f of inputs) {
  text += fs.readFileSync(f, 'utf8');
  if (!text.endsWith('\n')) text += '\n';
}

const START = '@@AURA-FILE@@';
const END = '@@AURA-END@@';

let written = 0;
let skipped = 0;
const report = [];

let pos = 0;
while (true) {
  const s = text.indexOf(START, pos);
  if (s === -1) break;
  const nameStart = s + START.length;
  // Dateiname endet an der naechsten @@-Markierung (Ende der Kopfzeile)
  let nameEnd = text.indexOf('@@', nameStart);
  if (nameEnd === -1) break;
  const rawName = text.slice(nameStart, nameEnd).trim();
  // Inhalt beginnt nach dem Zeilenumbruch hinter dem Namen
  let bodyStart = text.indexOf('\n', nameEnd);
  if (bodyStart === -1) break;
  bodyStart += 1;
  const e = text.indexOf(END, bodyStart);
  if (e === -1) break;
  const body = text.slice(bodyStart, e);
  pos = e + END.length;

  const rel = rawName.replace(/^\/+/, '');
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
    skipped += 1;
    report.push(`  uebersprungen (unsicherer Pfad): ${rawName}`);
    continue;
  }
  const abs = path.join(outDir, rel);
  if (!abs.startsWith(outDir + path.sep)) {
    skipped += 1;
    report.push(`  uebersprungen (ausserhalb Ziel): ${rawName}`);
    continue;
  }
  if (dry) {
    written += 1;
    report.push(`  [dry] ${rel} (${body.split('\n').length} Zeilen)`);
    continue;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  written += 1;
}

console.log(`entpackt: ${written} Dateien nach ${outDir}${dry ? ' (dry-run, nichts geschrieben)' : ''}`);
if (skipped) console.log(`uebersprungen: ${skipped}`);
for (const line of report.slice(0, 50)) console.log(line);
if (report.length > 50) console.log(`  ... und ${report.length - 50} weitere`);
