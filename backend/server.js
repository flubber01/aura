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
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

function readBody(req, cap = 5e6) {
  return new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > cap) req.destroy(); }); req.on('end', () => r(d)); });
}

function send(res, code, type, body, extra = {}) {
  // Browser-facing AURA uses same-origin relative APIs. Do not advertise a
  // wildcard CORS policy for privileged local admin surfaces.
  res.writeHead(code, { 'Content-Type': type, ...extra });
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
  require('./src/lib/autonomy_loop').start(); // self-healing loop + swarm strategy + learning curve
  ops.startScheduler(); // 12h super-brain autosave · 4h others · 24h full sync
  watcher.start(config.get('watcher.interval_ms', 1500)); // hot-reload data files w/ rollback on syntax error
  selfRepair.start(config.get('self_repair.interval_ms', 20000)); // area 66: massive logging + self-repair daemon
  setInterval(() => { // areas 17+73 daemons, gated by Area 74 modes + Area 75 toggles
    try {
      const control = require('./src/lib/routine_control');
      const fabric = require('./src/lib/service_fabric');
      if (control.isEnabled('report-daemon')) require('./src/lib/report_daemon').tick();
      if (control.isEnabled('forge-tick') && !fabric.mode('safe') && !fabric.mode('quiet')) require('./src/lib/content_forge').tick();
    } catch {}
  }, 30000);
  console.log(`AURA backend listening on http://${HOST}:${PORT} (dispatcher: ${dispatcher.modules.join(' → ')})`);
  console.log(`Frontend: / · Brain 2.0: /brain · Master HUD: /master · Console: /console · Downloads: /downloads`);
});
