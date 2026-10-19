#!/usr/bin/env node
'use strict';
// AURA — einmalige Owner-Einrichtung per Terminal (kein Browser nötig).
//
//   node backend/src/scripts/create-owner.js [--force]
//
// Fragt E-Mail und Passwort (zweimal, Eingabe maskiert wenn möglich) ab und
// schreibt den Owner-Datensatz (E-Mail + scrypt-Passwort-Hash) in eine
// Laufzeit-Datei, die NIEMALS committet wird:
//   Pfad:   AURA_AUTH_FILE (Standard: backend/src/data/auth_owner.json)
//   Schutz: chmod 600 · abgedeckt durch .gitignore (backend/src/data/)
//
// Existiert schon ein Owner, bricht das Skript ehrlich ab — nur --force
// überschreibt den Datensatz. Danach: Browser auf /login, E-Mail + Passwort,
// Knopf ANMELDEN. Kein Token im Browser, kein JavaScript nötig.
const readline = require('readline');
const adminAuth = require('../lib/admin_auth');

const FORCE = process.argv.includes('--force');

// Eingabe-Layer: funktioniert interaktiv (TTY, Passwort maskiert) UND per Pipe
// (alle Zeilen gepuffert — kein Rennen zwischen stdin-Ende und Nachfrage).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const queue = [];
let waiter = null;
let closed = false;
let maskOn = false;
const origWrite = typeof rl._writeToOutput === 'function' ? rl._writeToOutput.bind(rl) : (s) => process.stdout.write(s);
if (typeof rl._writeToOutput === 'function') {
  rl._writeToOutput = (s) => {
    const text = String(s == null ? '' : s);
    if (!maskOn) return origWrite(text);
    if (/[\r\n]/.test(text)) return origWrite('\n');
    if (text.includes('\b')) return origWrite('\b \b');
    return origWrite('*'.repeat([...text].length || 1));
  };
}
rl.on('line', (line) => { if (waiter) { const w = waiter; waiter = null; w(line); } else queue.push(line); });
rl.on('close', () => { closed = true; if (waiter) { const w = waiter; waiter = null; w(''); } });

function ask(promptText, mask) {
  maskOn = Boolean(mask) && Boolean(process.stdin.isTTY); // maskiert nur am echten Terminal
  origWrite(promptText);
  return new Promise((resolve, reject) => {
    const done = (value) => { maskOn = false; resolve(value); };
    if (queue.length) return done(queue.shift());
    if (closed) return reject(new Error('Eingabe endete vorzeitig (stdin geschlossen) — nichts wurde geschrieben.'));
    waiter = done;
  });
}

async function main() {
  console.log('AURA — Owner einrichten (einmalig, per Terminal)');
  console.log('Datensatz: ' + adminAuth.ownerFile() + ' (chmod 600, wird nie committet)');
  console.log('');
  let email = '';
  for (;;) {
    email = (await ask('E-Mail-Adresse: ')).trim();
    if (adminAuth.validEmail(email)) break;
    console.log('!! E-Mail-Adresse ist ungültig — bitte erneut eingeben.');
  }
  let password = '';
  for (;;) {
    password = await ask('Passwort (14+ Zeichen, Buchstaben + Ziffern): ', true);
    if (adminAuth.validPassword(password)) break;
    console.log('!! Passwort braucht 14–256 Zeichen mit Buchstaben und Ziffern — bitte erneut.');
  }
  const again = await ask('Passwort wiederholen: ', true);
  if (again !== password) {
    console.log('!! Die Passwörter stimmen nicht überein — nichts wurde geschrieben.');
    process.exitCode = 1;
    return;
  }
  const out = adminAuth.createOwner({ email, password, force: FORCE });
  console.log('');
  console.log('Owner eingerichtet: ' + out.email);
  console.log('Datei: ' + out.file + ' (chmod 600, Laufzeit — nie committet)');
  console.log('Nächster Schritt: Browser auf /login öffnen, mit E-Mail + Passwort anmelden (Knopf ANMELDEN).');
  console.log('Hinweis: Die Sitzung hält 12 Stunden und ist prozess-lokal — nach einem Server-Neustart bitte neu anmelden.');
}

main().then(() => { rl.close(); }).catch((e) => {
  console.log('!! ' + (e && e.message ? e.message : String(e)));
  if (e && e.code === 409) console.log('   Bestehenden Owner behalten, oder bewusst mit --force überschreiben.');
  process.exitCode = 1;
  rl.close();
});
