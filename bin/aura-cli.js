#!/usr/bin/env node
// AURA-CLI: ein Einstieg auf alles — „cli-anything".
// Nutzung: node bin/aura-cli.js <befehl> [argumente]
//   hilfe                       diese Liste
//   status                      Verbund-Überblick
//   verbund                     Concat-Repos intern + externe Steckplätze
//   kette                       Cross-Chain: Abteilung → Ereignis → n8n → Link
//   montage                     Montage-Abteilung offen (Video, Effekte, Kamera, Intro)
//   n8n                         n8n-Workflow-Katalog
//   meilensteine [nutzer]       Fortschritt und Verliehenes
//   track <nutzer> <ereignis> [wert]   Ereignis buchen (zeit/session/tag/inhalt/klick)
//   intro <sekunde> [breite hoehe]     Einzelbild rechnen und als PNG ablegen
'use strict';
const fs = require('fs');
const path = require('path');
const lib = (n) => require(path.join(__dirname, '..', 'backend', 'src', 'lib', n));
const out = (o) => { process.stdout.write(JSON.stringify(o, null, 2) + '\n'); };
const cmd = String(process.argv[2] || 'hilfe');
const arg = process.argv.slice(3);

try {
  if (cmd === 'hilfe') {
    process.stdout.write(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 13).join('\n') + '\n');
  } else if (cmd === 'status') {
    out({ werkzeug: 'aura-cli', verbund: lib('verbund').status(), meilensteine: lib('milestones').statusRoute() });
  } else if (cmd === 'verbund') {
    out({ intern: lib('verbund').REPOS, extern: lib('verbund').EXTERN });
  } else if (cmd === 'kette') {
    out(lib('verbund').kette());
  } else if (cmd === 'montage') {
    out(lib('verbund').montage());
  } else if (cmd === 'n8n') {
    out(lib('verbund').n8nWorkflows());
  } else if (cmd === 'meilensteine') {
    out(lib('milestones').status(arg[0] || 'gast'));
  } else if (cmd === 'track') {
    out(lib('milestones').track(arg[0] || 'gast', arg[1], arg[2] === undefined ? 1 : Number(arg[2]), { session: arg[3] || 'cli', datum: arg[4] }));
  } else if (cmd === 'intro') {
    const t = Number(arg[0] === undefined ? 8 : arg[0]);
    const w = Number(arg[1] || 1280), h = Number(arg[2] || 720);
    const bild = lib('agentic_intro').picture({ seconds: t, width: w, height: h });
    const ziel = path.join(process.cwd(), 'cli-intro-' + String(t).replace('.', '_') + '.png');
    fs.writeFileSync(ziel, bild.png);
    out({ ok: true, datei: ziel, bytes: bild.bytes, sekunde: t, breite: w, hoehe: h });
  } else {
    process.stderr.write('Unbekannter Befehl: ' + cmd + ' — siehe: node bin/aura-cli.js hilfe\n');
    process.exit(1);
  }
} catch (e) {
  process.stderr.write('Fehler: ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
}
