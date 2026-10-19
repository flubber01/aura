#!/usr/bin/env node
'use strict';
// Smoke-Test für ALLE Routen aus backend/server.js.
// Liest die Routen automatisch aus dem Quelltext, startet den Server auf freiem Port mit Temp-Dateien
// und prüft jede Route per GET und POST (ohne Token):
//  - kein 500 (kein unbehandelter Fehler)
//  - Schreibaktionen ohne Admin-Token dürfen nicht erfolgreich sein (2xx), außer sie sind bewusst öffentlich
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const NAV_PATHS = require(path.join(BACKEND, 'src', 'lib', 'nav')).hrefs();
// Routen liegen seit dem Dispatcher-Umbau nicht mehr nur in server.js, sondern in src/routes/*.js.
// Deshalb wird der komplette Quelltext der Routendateien gescannt (sonst findet der Test 0 Routen
// und prüft still nichts — genau das war der Fall).
const ROUTE_DIR = path.join(BACKEND, 'src', 'routes');
const SOURCES = [path.join(BACKEND, 'server.js')]
  .concat(fs.existsSync(ROUTE_DIR) ? fs.readdirSync(ROUTE_DIR).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(ROUTE_DIR, f)) : [])
  .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
const ROUTES = [...new Set(SOURCES.flatMap(({ text }) => [...text.matchAll(/p === '(\/api[^']*)'/g)].map((m) => m[1])))].sort();
// Schreibrouten: dieselbe Zeile prüft zusätzlich die Methode POST (präzise, damit
// GET-Routen nicht fälschlich als Schreibpfad gelten)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WRITE_ROUTES = new Set(ROUTES.filter((r) => SOURCES.some(({ text }) => new RegExp(`p === '${esc(r)}'\\s*&&\\s*req\\.method === 'POST'`).test(text))));
if (ROUTES.length === 0) { console.error('route_smoke FEHLER: 0 Routen gefunden — Scan der Quelltextdateien prüfen: ' + SOURCES.map((s) => path.relative(ROOT, s.file)).join(', ')); process.exit(1); }

// Bekannte offene Punkte: schreibende POST-Routen ohne Admin-Token-Prüfung. Sichtbar als WARN, nicht still.
// Entscheidung ausstehend (Token-Pflicht würde bestehende Seiten ändern).
// Früher hier gelistete Schreibpfade sind jetzt ebenfalls durch adminSoft geschützt
// (AURA_ADMIN_TOKEN gesetzt -> Header x-aura-token oder angemeldeter Besitzer).
const KNOWN_OPEN = new Set([]);
// Bewusst öffentliche Lesepfade (kein Schreiben, keine Freigabe nötig)
// /api/auth/logout muss ohne Token funktionieren (Abmelden darf nie am Token scheitern)
const PUBLIC_WRITES = new Set(['/api/auth/logout', '/api/auth/login-form', '/api/jarvis', '/api/jarvis/llm', '/api/yellowpages/suggest', '/api/yellowpages/help', '/api/studio/groove', '/api/studio/orchestrate', '/api/terminal', '/api/ultra/chat', '/api/video/preview',
  // Reine Rechenpfade: prüfen/ausrechnen, speichern nichts (kein Zustand, keine Freigabe nötig).
  '/api/audio/license', '/api/plugins/audio/validate', '/api/plugins/audio/build', '/api/speech/plan', '/api/speech/podcast', '/api/media/preview',
  '/api/human/guard', '/api/avatar/check', '/api/ads/check', '/api/repair/advise']);
// /api/video/preview rechnet nur die ffmpeg-Filterkette aus und speichert nichts — reiner Lesepfad.

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-smoke-'));
const port = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const PORT = await port();
  const env = {
    ...process.env, PORT: String(PORT), AURA_ADMIN_TOKEN: 'smoke-tok', AURA_ULTRA_SCOUT: '0',
    AURA_MODULES_DIR: path.join(BACKEND, 'modules'),
    AURA_MODULE_STATE_FILE: path.join(tmp, 'module_state.json'), AURA_MODULE_CONFIG_FILE: path.join(tmp, 'module_config.json'),
    AURA_CREATORS_FILE: path.join(tmp, 'creators.json'), AURA_CHANNELS_FILE: path.join(tmp, 'channels.json'),
    AURA_CONTROL_FILE: path.join(tmp, 'control.json'), AURA_ULTRA_FILE: path.join(tmp, 'ultra.json'),
  };
  // Server läuft auf einer Kopie des Projekts, damit der Test keine Repo-Dateien verändert.
  // Wichtig: die komplette Wurzel kopieren (nicht nur backend/) — die Download-Routen bauen
  // ZIP-Bundles aus Allowlists, die auch README/docs/deploy/scripts enthalten.
  const SKIP = new Set(['.git', 'node_modules', '_uploads', 'google_drive']);
  const copy = path.join(tmp, 'backend');
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    if (entry.isFile() && /\.zip$/i.test(entry.name)) continue; // große Artefakte, für den Test nicht nötig
    fs.cpSync(path.join(ROOT, entry.name), path.join(tmp, entry.name), {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}node_modules`) && !src.includes(`${path.sep}_uploads`),
    });
  }
  env.AURA_MODULES_DIR = path.join(copy, 'modules');
  const child = spawn(process.execPath, ['server.js'], { cwd: copy, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${PORT}`;
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try { const r = await fetch(base + '/api/health'); up = r.status < 500; } catch { await sleep(250); }
  }
  let pass = 0, fail = 0, warn = 0;
  const failures = [];
  const warnings = [];
  let navPass = 0, navFail = 0;
  const navFailures = [];
  try {
    if (!up) throw new Error('Server startet nicht: ' + log.slice(-400));
    for (const r of ROUTES) {
      const url = base + r;
      let g;
      try { g = await fetch(url, { signal: AbortSignal.timeout(8000) }); } catch (e) { g = { status: 0, err: e.message }; }
      const gOk = g.status > 0 && g.status < 500;
      let pOk = true, pStatus = null;
      if (WRITE_ROUTES.has(r) && !PUBLIC_WRITES.has(r)) {
        try {
          const p = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) });
          pStatus = p.status;
          // Schreibpfad ohne Admin-Token darf nicht erfolgreich sein und nicht abstürzen
          pOk = p.status >= 400 && p.status < 500;
        } catch (e) { pStatus = 'err'; pOk = false; }
      }
      if (gOk && pOk) pass++;
      else if (gOk && KNOWN_OPEN.has(r) && pStatus >= 200 && pStatus < 300) { warn++; warnings.push(`${r}: POST ohne Token erlaubt (bekannt offen)`); }
      else { fail++; failures.push(`${r}: GET ${g.status}${g.err ? ' ' + g.err : ''} · POST ${pStatus}`); }
    }
    for (const href of NAV_PATHS) {
      try {
        const response = await fetch(base + href, { signal: AbortSignal.timeout(8000) });
        await response.text();
        if (response.status === 200) navPass++;
        else { navFail++; navFailures.push(`${href}: GET ${response.status}`); }
      } catch (e) { navFail++; navFailures.push(`${href}: GET failed (${e.message})`); }
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(200);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
  console.log(`route_smoke: ${pass} PASS / ${fail} FAIL / ${warn} WARN (${ROUTES.length} Routen)`);
  console.log(`route_smoke NAV: ${navPass} PASS / ${navFail} FAIL (${NAV_PATHS.length} hrefs)`);
  for (const f of failures) console.log('  FAIL ' + f);
  for (const f of navFailures) console.log('  FAIL NAV ' + f);
  for (const w of warnings) console.log('  WARN ' + w);
  process.exitCode = fail || navFail ? 1 : 0;
}

main().catch((e) => { console.error('route_smoke FEHLER:', e.message); process.exitCode = 1; });
