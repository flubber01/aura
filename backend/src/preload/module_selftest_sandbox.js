'use strict';
// AURA — Sandkasten-Vorladung für den Modul-Selbsttest (Area 70, Importpfad).
//
// Aufruf:  node --require backend/src/preload/module_selftest_sandbox.js selftest.js
//          (nur mit AURA_MODULE_SELFTEST=1 wirksam)
//
// Was sie sperrt (im Kindprozess, bevor Modulcode läuft):
//   · Netzwerk:        require('net'|'tls'|'dgram'|'dns'|'http'|'https'|'http2'), fetch
//   · Kindprozesse:    require('child_process'|'worker_threads')
//   · Fremdcode:       require('vm'|'inspector'), eval/Function sind zusätzlich statisch geprüft
//   · Schreiben:       alle schreibenden fs-Aufrufe und createWriteStream
//   · Geheimnisse:     process.env ist leer
//
// Ehrlich gesagt: das ist eine API-Sperre im Node-Prozess, kein Betriebssystem-Sandkasten.
// Ein Modul mit eigenen nativen Erweiterungen könnte sie umgehen. Deshalb bleibt die
// Freigabe durch den Menschen das eigentliche Tor — dieser Sandkasten ist nur die zweite Tür.

// WICHTIG: Diese Datei ist KEIN Modul aus backend/src/lib. Sie liegt absichtlich in src/preload,
// damit Werkzeuge, die alle Module laden (z. B. das Weißbuch in src/lib/whitepaper.js), sie nicht
// versehentlich mitladen und damit den laufenden Prozess sperren.
// Sie wirkt nur, wenn sie ausdrücklich als Vorladung mit AURA_MODULE_SELFTEST=1 läuft.
if (process.env.AURA_MODULE_SELFTEST !== '1') {
  module.exports = { inactive: 'nur mit AURA_MODULE_SELFTEST=1 aktiv (Vorladung für den Selbsttest)' };
  return;
}

const Module = require('module');

const BLOCKED_REQUIRES = new Set([
  'child_process', 'node:child_process',
  'worker_threads', 'node:worker_threads',
  'vm', 'node:vm',
  'inspector', 'node:inspector',
  'net', 'node:net',
  'tls', 'node:tls',
  'dgram', 'node:dgram',
  'dns', 'node:dns',
  'http', 'node:http',
  'https', 'node:https',
  'http2', 'node:http2',
]);

const MESSAGE = 'AURA-Selbsttest-Sandkasten: ';

function deny(what) {
  return function blocked() {
    throw new Error(MESSAGE + what + ' ist im Selbsttest gesperrt');
  };
}

// 1) require() filtern
const originalRequire = Module.prototype.require;
Module.prototype.require = function guardedRequire(id) {
  if (BLOCKED_REQUIRES.has(String(id))) throw new Error(MESSAGE + "require('" + id + "') ist im Selbsttest gesperrt");
  return originalRequire.apply(this, arguments);
};

// 2) schreibende fs-Zugriffe sperren (lesen bleibt erlaubt)
const fs = require('fs');
const WRITE_METHODS = [
  'writeFileSync', 'appendFileSync', 'truncateSync', 'unlinkSync', 'rmSync', 'rmdirSync', 'mkdirSync',
  'renameSync', 'copyFileSync', 'symlinkSync', 'linkSync', 'chmodSync', 'chownSync', 'utimesSync',
  'writeFile', 'appendFile', 'truncate', 'unlink', 'rm', 'rmdir', 'mkdir', 'rename', 'copyFile', 'symlink', 'link', 'chmod', 'chown', 'utimes',
];
for (const method of WRITE_METHODS) {
  if (typeof fs[method] === 'function' && !fs[method].__auraBlocked) {
    const blocked = deny('fs.' + method);
    blocked.__auraBlocked = true;
    try { fs[method] = blocked; } catch {}
  }
}
try {
  const blocked = deny('fs.createWriteStream');
  blocked.__auraBlocked = true;
  fs.createWriteStream = blocked;
} catch {}
try {
  const promises = fs.promises || {};
  for (const method of WRITE_METHODS) {
    if (typeof promises[method] === 'function') {
      const blocked = deny('fs.promises.' + method);
      blocked.__auraBlocked = true;
      promises[method] = blocked;
    }
  }
} catch {}
// open/openSync mit Schreibflag sperren
try {
  const openSync = fs.openSync;
  const guarded = function (target, flags) {
    const text = String(flags === undefined ? 'r' : flags);
    if (/[wax+]/.test(text)) throw new Error(MESSAGE + 'fs.openSync zum Schreiben ist im Selbsttest gesperrt');
    return openSync.apply(this, arguments);
  };
  guarded.__auraBlocked = true;
  fs.openSync = guarded;
} catch {}

// 3) Netzwerk-APIs sperren, falls sie doch im Prozess landen (z. B. über globale Referenzen)
try {
  if (typeof globalThis.fetch === 'function') {
    const blocked = deny('fetch');
    blocked.__auraBlocked = true;
    globalThis.fetch = blocked;
  }
} catch {}

// 4) Umgebung leeren — Geheimnisse liegen dort, ein Modul darf sie nicht lesen
try {
  Object.defineProperty(process, 'env', { value: Object.freeze({}), writable: false, configurable: false });
} catch {}

// 5) Notausstieg: der Selbsttest darf den Prozess nicht endlos halten.
//    Die äußere Schleife beendet ihn zusätzlich nach 10 s hart — hier die weiche Erinnerung.
try {
  const timer = setTimeout(() => {
    try { process.stderr.write(MESSAGE + 'Zeitlimit erreicht — Selbsttest abgebrochen\n'); } catch {}
    process.exit(124);
  }, 9500);
  timer.unref();
} catch {}

module.exports = { BLOCKED_REQUIRES };
