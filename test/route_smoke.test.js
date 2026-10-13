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
const server = fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8');
const ROUTES = [...new Set([...server.matchAll(/p === '(\/api[^']*)'/g)].map((m) => m[1]))].sort();
// Schreibrouten: die Zeile mit der Route prüft POST
const WRITE_ROUTES = new Set(ROUTES.filter((r) => (server.split('\n').find((l) => l.includes(`p === '${r}'`)) || '').includes("'POST'")));

// Bekannte offene Punkte: schreibende POST-Routen ohne Admin-Token-Prüfung. Sichtbar als WARN, nicht still.
// Entscheidung ausstehend (Token-Pflicht würde bestehende Seiten ändern).
const KNOWN_OPEN = new Set(['/api/builder/simulate', '/api/config/reset', '/api/containers/drill', '/api/learning/outcome', '/api/learning/simulate', '/api/ops/others', '/api/ops/super', '/api/ops/sync', '/api/schedule/add', '/api/schedule/remove', '/api/selfrepair/drill', '/api/selfrepair/run']);
// Bewusst öffentliche Lesepfade (kein Schreiben, keine Freigabe nötig)
const PUBLIC_WRITES = new Set(['/api/jarvis', '/api/jarvis/llm', '/api/yellowpages/suggest', '/api/yellowpages/help', '/api/studio/groove', '/api/studio/orchestrate', '/api/terminal', '/api/ultra/chat']);

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
  // Server läuft auf einer Kopie des Backends, damit der Test keine Repo-Dateien verändert
  const copy = path.join(tmp, 'backend');
  fs.cpSync(BACKEND, copy, { recursive: true, filter: (src) => !src.includes(`${path.sep}node_modules`) });
  // Der Server liest Dateien relativ zu ../extracted, deshalb wird der Ordner mitkopiert
  const extracted = path.join(ROOT, 'extracted');
  if (fs.existsSync(extracted)) fs.cpSync(extracted, path.join(tmp, 'extracted'), { recursive: true });
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
  } finally {
    child.kill('SIGTERM');
    await sleep(200);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
  console.log(`route_smoke: ${pass} PASS / ${fail} FAIL / ${warn} WARN (${ROUTES.length} Routen)`);
  for (const f of failures) console.log('  FAIL ' + f);
  for (const w of warnings) console.log('  WARN ' + w);
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => { console.error('route_smoke FEHLER:', e.message); process.exitCode = 1; });
