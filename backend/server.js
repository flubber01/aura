#!/usr/bin/env node
/**
 * AURA Agent Command Center — thin dispatcher.
 *
 * This file is deliberately SMALL: it owns the HTTP shell (telemetry,
 * logging, error fence, static fallback) and delegates every request to
 * route modules loaded by src/dispatcher.js:
 *
 *   src/routes/api_core.js     core catalog & registry APIs
 *   src/routes/api_areas.js    area-specific APIs (61…70, ops, hierarchy, …)
 *   src/routes/pages_routes.js all HTML pages
 *
 * Domain logic lives in src/lib/*, pages in pages/*, shared boot data in
 * src/lib/datasets.js, downloads/catalogs in src/lib/types_catalog.js.
 * External modules attach via Area 70 (backend/modules/ + aura.module.json).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'extracted', 'AURA-Web-Deploy', 'public');

const config = require('./src/lib/config');
const ops = require('./src/lib/ops');
const watcher = require('./src/lib/txt_watcher');
const selfRepair = require('./src/lib/self_repair');
const traffic = require('./src/lib/traffic');
const sentinel = require('./src/lib/sentinel');
const adminAuth = require('./src/lib/admin_auth');
const dispatcher = require('./src/dispatcher');

// emergency kill switch auto-engage on critical errors / syntax failures
process.on('uncaughtException', (e) => { try { selfRepair.log('ERROR', 'LIFE', 'uncaught_exception', { error: e.message, stack: (e.stack || '').split('\n')[1] }); } catch {} try { ops.kill('critical error: ' + e.message); } catch {} });
process.on('unhandledRejection', (e) => { try { selfRepair.log('ERROR', 'LIFE', 'unhandled_rejection', { error: String(e && e.message || e) }); } catch {} try { ops.kill('unhandled rejection: ' + (e && e.message || e)); } catch {} });

let syntaxFails = [];
function syntaxFail() {
  const thr = config.get('kill.syntax_fail_threshold', 3);
  const win = config.get('kill.window_min', 5) * 60000;
  syntaxFails.push(Date.now());
  syntaxFails = syntaxFails.filter((t) => Date.now() - t < win);
  if (syntaxFails.length >= thr) ops.kill(`repeated syntax failures (${syntaxFails.length} in ${config.get('kill.window_min', 5)} min)`);
}

// ---------- shared http helpers (passed to route modules via ctx) ----------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'text/plain', 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'text/plain', 'Not found: ' + p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', ...SECURITY_HEADERS });
    res.end(buf);
  });
}

function readBody(req, cap = 5e6) {
  return new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > cap) req.destroy(); }); req.on('end', () => r(d)); });
}

// Schutz-Kopfzeilen (Bereich SEC): Typ nicht raten, Herkunft begrenzen, nicht in fremde Seiten
// einbetten — **außer** in unsere eigene Vorschau. Die Vorschau läuft in einem Rahmen auf anderer
// Adresse; deshalb steht sie ausdrücklich in frame-ancestors. Ohne diese Zeile bricht die Vorschau,
// mit einer pauschalen Sperre ebenso. Über AURA_FRAME_ANCESTORS anpassbar.
const FRAME_ANCESTORS = process.env.AURA_FRAME_ANCESTORS || "'self' https:";
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': `default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors ${FRAME_ANCESTORS}; base-uri 'self'; form-action 'self'`,
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Resource-Policy': 'same-site',
  'X-AURA-Security': 'headers-on',
};

function send(res, code, type, body, extra = {}) {
  // Browser-facing AURA uses same-origin relative APIs. Do not advertise a
  // wildcard CORS policy for privileged local admin surfaces.
  res.writeHead(code, { 'Content-Type': type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

// ---------- dispatcher loop ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const started = Date.now();
  const ip = (req.socket && req.socket.remoteAddress) || '';
  if (sentinel.isBlocked(ip)) { // area 86: Quarantäne — erst getrackt, dann isoliert
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'quarantined by AURA sentinel (trace-first policy)' }));
    return;
  }
  sentinel.observe(ip, p); // verdächtige Pfade zählen → Auto-Quarantäne bei Schwelle
  if (sentinel.rateLimited(ip)) { // App-Level-DDoS-Bremse (Loopback immer ausgenommen)
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'rate limit exceeded — AURA sentinel' }));
    return;
  }
  const authGate = adminAuth.guard(req, p);
  if (!authGate.allow) {
    if (!p.startsWith('/api/')) {
      res.writeHead(302, { Location: '/login?next=' + encodeURIComponent(p) }); res.end(); return;
    }
    return send(res, authGate.code || 401, 'application/json', JSON.stringify({ ok: false, error: authGate.error || 'authentication required' }));
  }
  traffic.record(p); // area 65 — honest telemetry, measured at the door
  res.on('finish', () => { // area 66 — massive structured request logging
    const ms = Date.now() - started;
    if (res.statusCode >= 500) selfRepair.log('ERROR', 'HTTP', req.method + ' ' + p, { status: res.statusCode, ms });
    else selfRepair.log('INFO', 'HTTP', req.method + ' ' + p, { status: res.statusCode, ms });
  });

  try {
    const ctx = { req, res, url, p, method: req.method, send, readBody, syntaxFail, ROOT, PUBLIC_DIR, actor: authGate.actor || null, auth_mode: authGate.mode };
    const handled = await dispatcher.dispatch(ctx);
    // Cross-Chain: jede erfolgreiche Aktion bucht den Meilenstein der Abteilung (Verbund → Kette).
    // Ereignis je Pfad aus dem Verbund-Katalog; Erzeuger-Routen buchen Inhalt, alles andere Aktion.
    if (handled && req.method === 'POST' && res.statusCode === 200 && p !== '/api/repair/advise') {
      try {
        const verbund = require('./src/lib/verbund');
        require('./src/lib/milestones').track('gast', verbund.crosschain(p, req.method) || 'klick', 1);
      } catch (e) { /* Meilensteine dürfen den Betrieb nie stören */ }
    }
    if (!handled) {
      if (p.startsWith('/api/')) return send(res, 404, 'application/json', JSON.stringify({ error: 'Unknown endpoint' }));
      return serveStatic(req, res);
    }
  } catch (e) {
    try { const lc = require('./src/lib/learning_core');
      const sig = 'http500:' + p + ':' + String(e && e.message || e).slice(0, 50);
      lc.recordFailure(sig, { method: req.method }); lc.reportOutcome(sig, true); } catch {}
    return send(res, 500, 'application/json', JSON.stringify({ error: String(e) }));
  } finally {
    console.log(`${req.method} ${p} ${Date.now() - started}ms`);
  }
});

server.listen(PORT, HOST, () => {
  // Watchdog: die Dienste laufen unter Aufsicht (3-Strike-Regel, Sleep-Mode, Live-Uebersicht).
  // Er startet nur neu — er erzeugt keinen Traffic und kein Engagement.
  const watchdog = require('./src/lib/watchdog');
  const control = require('./src/lib/routine_control');
  const daemons = [
    { name: 'autonomy-loop', description: 'Selbstheilung + Lernkurve', job: () => require('./src/lib/autonomy_loop'), start: (m) => m.start(), stop: (m) => m.stop && m.stop() },
    { name: 'ops-scheduler', description: 'Autosave 12h/4h/24h', job: () => ops, start: (m) => m.startScheduler(), stop: (m) => m.stopScheduler() },
    { name: 'file-watcher', description: 'Datei-Hotreload mit Rollback', job: () => watcher, start: (m) => m.start(config.get('watcher.interval_ms', 1500)), stop: (m) => m.stop && m.stop() },
    { name: 'self-repair', description: 'Logging + Selbstreparatur', job: () => selfRepair, start: (m) => m.start(config.get('self_repair.interval_ms', 20000)), stop: (m) => m.stop && m.stop() },
    { name: 'report-daemon', description: 'Report-Tick (Area 17)', job: () => require('./src/lib/report_daemon'), start: () => control.toggle('report-daemon', true), stop: () => control.toggle('report-daemon', false) },
    { name: 'forge-tick', description: 'Content-Forge-Tick (Area 73)', job: () => require('./src/lib/content_forge'), start: () => control.toggle('forge-tick', true), stop: () => control.toggle('forge-tick', false) },
  ];
  for (const d of daemons) {
    try { watchdog.register({ name: d.name, description: d.description, start: () => d.start(d.job()), stop: () => d.stop(d.job()) }); }
    catch (e) { selfRepair.log('ERROR', 'WATCHDOG', 'register ' + d.name, { error: String(e.message || e) }); }
  }
  for (const d of daemons) {
    try { const r = watchdog.startService(d.name); if (!r.ok && r.code !== 423) selfRepair.log('ERROR', 'WATCHDOG', 'start ' + d.name, r); }
    catch (e) { selfRepair.log('ERROR', 'WATCHDOG', 'start ' + d.name, { error: String(e.message || e) }); }
  }
  setInterval(() => { // areas 17+73 daemons, gated by Area 74 modes + Area 75 toggles
    try {
      const fabric = require('./src/lib/service_fabric');
      if (control.isEnabled('report-daemon') && watchdog.status().services.find((s) => s.name === 'report-daemon' && s.status === 'RUNNING')) {
        try { require('./src/lib/report_daemon').tick(); watchdog.beat('report-daemon'); }
        catch (e) { const c = watchdog.crash('report-daemon', e); if (c.status === 'DOWN_PERMANENT') { control.toggle('report-daemon', false); selfRepair.log('ERROR', 'WATCHDOG', 'report-daemon bleibt unten', c); } }
      }
      if (control.isEnabled('forge-tick') && !fabric.mode('safe') && !fabric.mode('quiet') && watchdog.status().services.find((s) => s.name === 'forge-tick' && s.status === 'RUNNING')) {
        try { require('./src/lib/content_forge').tick(); watchdog.beat('forge-tick'); }
        catch (e) { const c = watchdog.crash('forge-tick', e); if (c.status === 'DOWN_PERMANENT') { control.toggle('forge-tick', false); selfRepair.log('ERROR', 'WATCHDOG', 'forge-tick bleibt unten', c); } }
      }
    } catch {}
  }, 30000);
  console.log(`AURA backend listening on http://${HOST}:${PORT} (dispatcher: ${dispatcher.modules.join(' → ')})`);
  console.log(`Frontend: / · Brain 2.0: /brain · Master HUD: /master · Console: /console · Downloads: /downloads`);
});
