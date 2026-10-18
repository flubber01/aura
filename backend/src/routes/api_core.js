'use strict';
// Route module: core catalog & registry APIs (moved verbatim from server.js).
const path = require('path');
const fs = require('fs');
const { modules, integrations } = require('../lib/datasets');
const registry = require('../lib/registry');
const store = require('../lib/store');
const ops = require('../lib/ops');
const containers = require('../lib/module_container');
const watcher = require('../lib/txt_watcher');
const selfRepair = require('../lib/self_repair');
const { buildTypesCatalog, ARTIFACTS } = require('../lib/types_catalog');
const { dailyReport } = require('../lib/report');
const { buildStudioSourceBundle, buildCompleteSafeSourceBackup } = require('../lib/studio_source_bundle');
const adminAuth = require('../lib/admin_auth');
const { brainData } = require('../../pages/brain');
const { masterData } = require('../../pages/master');

const ROOT = path.join(__dirname, '..', '..', '..');

async function handle(ctx) {
  const { req, res, url, p, send, readBody, syntaxFail } = ctx;

  // Authentication is opt-in via AURA_AUTH_REQUIRED=true. These bootstrap/login
  // endpoints are intentionally narrow and never expose password material.
  if (p === '/api/auth/status') return send(res, 200, 'application/json', JSON.stringify(adminAuth.status(req), null, 2)), true;
  if (p === '/api/auth/bootstrap' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { const out = adminAuth.bootstrap(body, req); return send(res, 201, 'application/json', JSON.stringify({ ...out, set_cookie: undefined }, null, 2), { 'Set-Cookie': out.set_cookie }), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/auth/login' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { const out = adminAuth.login(body, req); return send(res, 200, 'application/json', JSON.stringify({ ...out, set_cookie: undefined }, null, 2), { 'Set-Cookie': out.set_cookie }), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/auth/logout' && req.method === 'POST') {
    const out = adminAuth.logout(req); return send(res, 200, 'application/json', JSON.stringify({ ok: true }, null, 2), { 'Set-Cookie': out.set_cookie }), true;
  }

  if (p === '/api/health') {
    return send(res, 200, 'application/json', JSON.stringify({
      status: 'ok', service: 'aura-backend', time: new Date().toISOString(),
      uptime_s: Math.round(process.uptime()),
      counts: { modules: modules.length, integrations: integrations.integrations.length, artifacts: Object.keys(ARTIFACTS).length },
      endpoints: ['/api/health', '/api/integrations', '/api/modules', '/api/modules/live', '/api/modules/:area/action/:name', '/api/report', '/api/types', '/api/skills', '/api/departments', '/api/roles', '/api/prompts', '/api/workflows', '/api/xrefs', '/api/brain', '/api/master', '/api/downloads', '/api/download/:name', '/api/download/aura-studio-command-source.zip', '/api/download/aura-complete-safe-source-backup.zip', '/api/admin-copilot/status', '/api/admin-copilot/chat', '/api/auth/status', '/api/auth/bootstrap', '/api/auth/login', '/api/ollama/server-profiles', '/api/releases', '/api/cluster/status', '/api/cluster/preflight', '/api/modulehub', '/api/modulehub/:id/(approve|enable|disable|config|execute|health)', '/api/modulehub/scan', '/console', '/brain', '/master', '/skills', '/downloads'],
    })), true;
  }
  if (p === '/api/modules/live') {
    return send(res, 200, 'application/json', JSON.stringify({ counts: registry.counts(), modules: registry.status() }, null, 2)), true;
  }
  const action = p.match(/^\/api\/modules\/([0-9]{2})\/action\/([a-z0-9_]+)$/i);
  if (action) {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — actions locked. Revive via /ops or /api/kill' })), true;
    const found = registry.get(action[1]);
    if (!found) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown area ' + action[1] })), true;
    if (found.kind !== 'live') {
      const code = found.kind === 'restricted' ? 403 : 501;
      return send(res, code, 'application/json', JSON.stringify({
        area: action[1], mode: found.kind,
        error: found.kind === 'restricted'
          ? 'BLOCKED BY POLICY: this module is excluded from implementation.'
          : `module is '${found.kind}' — ${found.entry.note}`,
      })), true;
    }
    const fn = found.mod.actions && found.mod.actions[action[2].toLowerCase()];
    if (!fn) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown action', actions: Object.keys(found.mod.actions || {}) })), true;
    let body = {};
    if (req.method === 'POST') {
      const raw = await new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 5e6) req.destroy(); }); req.on('end', () => r(d)); });
      try { body = raw ? JSON.parse(raw) : {}; } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    }
    // Area 67: run inside the module container — timeout guard, circuit
    // breaker, quarantine. A crashing module can never kill the server.
    const cr = await containers.run(action[1], action[2].toLowerCase(), body);
    if (cr.ok) return send(res, 200, 'application/json', JSON.stringify(cr.result, null, 2)), true;
    if (cr.quarantined) return send(res, 429, 'application/json', JSON.stringify({ error: 'MODULE QUARANTINED — circuit breaker open', ...cr }, null, 2)), true;
    return send(res, 500, 'application/json', JSON.stringify({ error: cr.error, container_fails: cr.fails, container: cr.container }, null, 2)), true;
  }
  if (p === '/api/skills') return send(res, 200, 'application/json', JSON.stringify({ skills: registry.skills.skills(), status: registry.skills.status(), db: registry.skills.db_meta() }, null, 2)), true;
  if (p === '/api/departments') return send(res, 200, 'application/json', JSON.stringify({ departments: registry.skills.departments() }, null, 2)), true;
  if (p === '/api/roles') return send(res, 200, 'application/json', JSON.stringify(registry.skills.roles(), null, 2)), true;
  if (p.startsWith('/api/prompts')) {
    const q = url.searchParams;
    const res2 = registry.skills.promptFor(q.get('dept') || '', q.get('role') || '');
    if (!res2) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown department; see /api/departments' })), true;
    return send(res, 200, 'application/json', JSON.stringify(res2, null, 2)), true;
  }
  if (p === '/api/notebook-export') {
    const rep = dailyReport();
    const md = [
      '# AURA Notebook Export', '',
      `> ${new Date().toISOString()} · real backend state`, '',
      '## Report', '```json', JSON.stringify(rep, null, 2), '```', '',
      '## Tasks (last 20)', '```json', JSON.stringify(store.tasks().slice(0, 20), null, 2), '```', '',
      '## Modules', '```json', JSON.stringify(registry.status().map(({ area, name, mode }) => ({ area, name, mode })), null, 2), '```', '',
    ].join('\n');
    return send(res, 200, 'text/markdown; charset=utf-8', md, { 'Content-Disposition': 'attachment; filename="aura-notebook.md"' }), true;
  }
  if (p === '/api/workflows') return send(res, 200, 'application/json', JSON.stringify(registry.skills.workflows(), null, 2)), true;
  if (p === '/api/xrefs') return send(res, 200, 'application/json', JSON.stringify(registry.skills.xrefs(), null, 2)), true;
  if (p === '/api/brain') return send(res, 200, 'application/json', JSON.stringify(brainData(), null, 2)), true;
  if (p === '/api/master') return send(res, 200, 'application/json', JSON.stringify(masterData(), null, 2)), true;

  // ---- 1-click reproduction report ----
  if (p === '/api/repro') {
    let commit = 'unknown';
    try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
    const dataOk = watcher.backups().verified > 0;
    return send(res, 200, 'application/json', JSON.stringify({
      ok: true, mode: 'LIVE', at: new Date().toISOString(), commit,
      node: process.version, platform: process.platform, uptime_s: Math.round(process.uptime()),
      checks: {
        data_files: selfRepair.report().lastReport ? selfRepair.report().lastReport.data.map((x) => ({ file: x.file, state: x.state })) : 'pending',
        pages: selfRepair.report().lastReport ? selfRepair.report().lastReport.pages_ok : 'pending',
        vault: { snapshots: watcher.backups().count, verified: watcher.backups().verified },
        containers_quarantined: containers.status().containers.filter((c) => String(c.container).startsWith('quarantine')).length,
        kill_switch: ops.status().kill_switch.on,
        config_hot_reload: true,
      },
      repro_command: 'curl -fsSL https://raw.githubusercontent.com/flubber01/aura/arena/0ee9c54c-aura/deploy/master-install.sh | bash',
    }, null, 2)), true;
  }

  // ---- minion live stream (SSE) ----
  if (p === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    let last = store.get().audit.length;
    const push = (e) => res.write('data: ' + JSON.stringify(e) + '\n\n');
    store.auditLog().slice(0, 3).reverse().forEach(push);
    const iv = setInterval(() => {
      const a = store.get().audit;
      if (a.length < last) last = 0; // cap applied
      if (a.length > last) { a.slice(last).forEach(push); last = a.length; }
    }, 1000);
    req.on('close', () => clearInterval(iv));
    return true;
  }

  if (p === '/api/report') return send(res, 200, 'application/json', JSON.stringify(dailyReport(), null, 2)), true;
  if (p === '/api/integrations') return send(res, 200, 'application/json', JSON.stringify(integrations, null, 2)), true;
  if (p === '/api/modules') return send(res, 200, 'application/json', JSON.stringify(modules, null, 2)), true;
  if (p === '/api/types') return send(res, 200, 'application/json', JSON.stringify(buildTypesCatalog(), null, 2)), true;
  if (p === '/api/download/aura-studio-command-source.zip') {
    try {
      const bundle = buildStudioSourceBundle();
      return send(res, 200, 'application/zip', bundle.body, {
        'Content-Disposition': 'attachment; filename="' + bundle.filename + '"',
        'Content-Length': String(bundle.body.length), 'Cache-Control': 'no-store',
      }), true;
    } catch (e) { return send(res, 500, 'application/json', JSON.stringify({ error: 'source bundle unavailable', detail: e.message })), true; }
  }
  if (p === '/api/download/aura-complete-safe-source-backup.zip') {
    try {
      const bundle = buildCompleteSafeSourceBackup();
      return send(res, 200, 'application/zip', bundle.body, {
        'Content-Disposition': 'attachment; filename="' + bundle.filename + '"',
        'Content-Length': String(bundle.body.length), 'Cache-Control': 'no-store',
      }), true;
    } catch (e) { return send(res, 500, 'application/json', JSON.stringify({ error: 'complete safe source backup unavailable', detail: e.message })), true; }
  }
  if (p === '/api/downloads') {
    return send(res, 200, 'application/json', JSON.stringify({
      artifacts: [
        { name: 'AURA_COMPLETE_SAFE_SOURCE_BACKUP.zip', url: '/api/download/aura-complete-safe-source-backup.zip', kind: 'complete_safe_source_docs_config', note: 'Complete current safe project source/docs/config ZIP; excludes runtime data, secrets, dependencies, caches and media.' },
        { name: 'AURA_STUDIO_COMMAND_SOURCE.zip', url: '/api/download/aura-studio-command-source.zip', kind: 'source_docs_allowlist', note: 'Focused Studio Command/J.A.R.V.I.S. ZIP; excludes runtime data, secrets, dependencies and media.' },
        ...Object.keys(ARTIFACTS).map((n) => ({ name: n, url: '/api/download/' + n, kind: 'catalog' })),
      ],
      page: '/downloads',
    }, null, 2)), true;
  }
  if (p.startsWith('/api/download/')) {
    const name = p.slice('/api/download/'.length);
    const art = ARTIFACTS[name];
    if (!art) return send(res, 404, 'application/json', JSON.stringify({ error: 'Unknown artifact. See /api/downloads' })), true;
    const body = art.render(buildTypesCatalog());
    return send(res, 200, art.mime, body, {
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    }), true;
  }

  return false;
}

module.exports = { name: 'api_core', handle };
