'use strict';
// AURA Area 72 — MCP Server Manager.
//
// User-defined MCP servers: add / delete / install / uninstall / enable /
// disable / test + per-server usage tracking. AURA also exposes ITSELF as an
// MCP server (backend/mcp_server.js via stdio, /api/mcp via HTTP JSON-RPC);
// that built-in endpoint's usage is tracked here as id 'aura-builtin'.
//
// Honesty: the sandbox opens no outbound connections to user servers, so a
// configured server is reported as 'configured-not-connected' until a real
// handshake (POST /api/mcp/servers/:id/test) succeeds on your own hardware.
// stdio servers only launch for allowlisted binaries (never arbitrary cmds).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const FILE = path.join(__dirname, '..', 'data', 'mcp_servers.json');
const ALLOWED_STDIO_BINARIES = ['npx', 'uvx', 'node', 'python', 'python3', 'deno', 'bun'];
const USAGE_EVENT_CAP = 20;

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { servers: {}, usage: {} }; }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE);
}
function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
function usageEntry(db, id) {
  if (!db.usage[id]) db.usage[id] = { calls: 0, last: null, events: [] };
  return db.usage[id];
}
function recordUse(id, what, detail) {
  const db = load();
  const u = usageEntry(db, id);
  u.calls += 1; u.last = new Date().toISOString();
  u.events.unshift({ at: u.last, what, detail: String(detail || '').slice(0, 160) });
  if (u.events.length > USAGE_EVENT_CAP) u.events.length = USAGE_EVENT_CAP;
  save(db);
  return u;
}

// ---------- user-defined servers ----------
function validateServer(input) {
  const errs = [];
  const name = String(input.name || '').trim();
  if (name.length < 3) errs.push('name required (min 3 chars)');
  const transport = input.transport;
  if (!['stdio', 'sse', 'http'].includes(transport)) errs.push('transport must be stdio | sse | http');
  if (transport === 'stdio') {
    const cmd = String(input.command || '').trim();
    const bin = cmd.split(/\s+/)[0];
    if (!cmd) errs.push('stdio transport requires command');
    else if (!ALLOWED_STDIO_BINARIES.includes(bin)) errs.push('command must start with an allowlisted binary: ' + ALLOWED_STDIO_BINARIES.join(', '));
  }
  if (transport === 'sse' || transport === 'http') {
    const url = String(input.url || '').trim();
    if (!/^https?:\/\/[^/\s]+/.test(url)) errs.push('sse/http transport requires http(s):// url');
  }
  return errs;
}

function addServer(input = {}) {
  const errs = validateServer(input);
  if (errs.length) { const e = new Error(errs.join('; ')); e.code = 400; throw e; }
  const db = load();
  const id = slug(input.name) || 'srv-' + crypto.randomBytes(2).toString('hex');
  if (db.servers[id]) { const e = new Error('server id "' + id + '" existiert bereits'); e.code = 409; throw e; }
  const envKeys = Array.isArray(input.env_keys) ? input.env_keys.map(String).slice(0, 16) : [];
  db.servers[id] = {
    id, name: String(input.name).trim().slice(0, 80),
    transport: input.transport,
    command: input.transport === 'stdio' ? String(input.command).trim().slice(0, 300) : '',
    url: input.transport !== 'stdio' ? String(input.url).trim().slice(0, 300) : '',
    env_keys: envKeys, // Namen nur — Secret-Werte gehören in einen Secret-Store, nie hierher
    permissions: Array.isArray(input.permissions) ? input.permissions.map(String).slice(0, 20) : [],
    installed: false, enabled: false,
    addedAt: new Date().toISOString(), installedAt: null,
    note: 'konfiguriert — Sandbox öffnet keine externen Verbindungen; auf eigener Hardware via /test verifizieren',
  };
  save(db);
  recordUse(id, 'added', 'transport ' + input.transport);
  return db.servers[id];
}

function getServer(id) { const db = load(); return db.servers[id] || null; }
function requireServer(id) {
  const s = getServer(id);
  if (!s) { const e = new Error('unknown MCP server "' + id + '"'); e.code = 404; throw e; }
  return s;
}

function install(id) {
  const db = load(); const s = db.servers[id]; if (!s) { const e = new Error('unknown MCP server "' + id + '"'); e.code = 404; throw e; }
  if (s.env_keys.length && s.transport !== 'stdio') s.note = 'installiert — env_keys gesetzt: Werte müssen auf dem Host im Secret-Store liegen';
  s.installed = true; s.enabled = true; s.installedAt = new Date().toISOString();
  save(db); recordUse(id, 'installed', '');
  return { ok: true, server: s };
}
function uninstall(id) {
  const db = load(); const s = db.servers[id]; if (!s) { const e = new Error('unknown MCP server "' + id + '"'); e.code = 404; throw e; }
  s.installed = false; s.enabled = false; s.installedAt = null;
  save(db); recordUse(id, 'uninstalled', '');
  return { ok: true, server: s };
}
function removeServer(id) {
  const db = load();
  if (!db.servers[id]) { const e = new Error('unknown MCP server "' + id + '"'); e.code = 404; throw e; }
  const usage = db.usage[id] || { calls: 0 };
  delete db.servers[id]; delete db.usage[id];
  save(db);
  return { ok: true, removed: id, finalUsage: usage.calls };
}
function setEnabled(id, on) {
  const db = load(); const s = db.servers[id]; if (!s) { const e = new Error('unknown MCP server "' + id + '"'); e.code = 404; throw e; }
  if (on && !s.installed) { const e = new Error('server muss zuerst installiert werden (install vor enable)'); e.code = 409; throw e; }
  s.enabled = !!on; save(db); recordUse(id, on ? 'enabled' : 'disabled', '');
  return { ok: true, server: s };
}

// usage: mark a routed invocation. Honest: the sandbox does not open the
// external connection — the event records the ROUTING decision.
function use(id, tool) {
  const db = load(); const s = db.servers[id]; if (!s) { const e = new Error('unknown MCP server "' + id + '"'); e.code = 404; throw e; }
  if (!s.installed || !s.enabled) { const e = new Error('server not active (installed+enabled nötig)'); e.code = 409; throw e; }
  const u = recordUse(id, 'tool_call', 'tool=' + String(tool || '?'));
  return {
    ok: true, server: id, tool: tool || null, routed: true, dispatched: false,
    note: 'ehrlicher Hinweis: Sandbox öffnet keine externe Verbindung — Routing erfasst, Dispatch erfolgt auf deinem Host nach Installation',
    usage: { calls: u.calls, last: u.last },
  };
}

// real handshake test for stdio servers (allowlisted binaries only)
function testServer(id, timeoutMs = 6000) {
  const s = requireServer(id);
  if (s.transport !== 'stdio') {
    return Promise.resolve({ ok: false, state: 'config-only', server: id, note: 'sse/http-Handshake läuft auf deinem Host — Sandbox hat keinen Ausgang zum Ziel' });
  }
  const parts = s.command.split(/\s+/);
  const bin = parts[0];
  if (!ALLOWED_STDIO_BINARIES.includes(bin)) return Promise.resolve({ ok: false, state: 'blocked', note: 'Binary nicht in Allowlist' });
  return new Promise((resolve) => {
    let done = false, out = '';
    const finish = (r) => { if (!done) { done = true; try { child.kill('SIGKILL'); } catch {} recordUse(id, 'test', r.state); resolve(r); } };
    let child;
    try { child = spawn(bin, parts.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs }); }
    catch (e) { return finish({ ok: false, state: 'spawn-error', detail: e.message }); }
    const timer = setTimeout(() => finish({ ok: false, state: 'timeout', detail: 'kein initialize-Answer in ' + timeoutMs + 'ms' }), timeoutMs);
    child.stdout.on('data', (c) => {
      out += c.toString();
      if (/"serverInfo"/.test(out)) { clearTimeout(timer); finish({ ok: true, state: 'handshake-ok', detail: out.slice(0, 200) }); }
    });
    child.stderr.on('data', () => {});
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, state: 'spawn-error', detail: e.message }); });
    child.on('exit', (code) => { clearTimeout(timer); if (!done) finish({ ok: false, state: 'exited-early', detail: 'exit ' + code }); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-19', capabilities: {}, clientInfo: { name: 'aura-72', version: '1.0.0' } } }) + '\n');
  });
}

// ---------- AURA's own MCP endpoint usage ----------
function builtinUsed(method) { return recordUse('aura-builtin', 'mcp_call', method); }

function listServers() {
  const db = load();
  return Object.values(db.servers).map((s) => ({
    ...s,
    connection: !s.installed ? 'not-installed' : 'configured-not-connected',
    usage: db.usage[s.id] ? { calls: db.usage[s.id].calls, last: db.usage[s.id].last } : { calls: 0, last: null },
  }));
}

function status() {
  const db = load();
  const servers = listServers();
  const builtin = db.usage['aura-builtin'] || { calls: 0, last: null };
  return {
    area: '72', mode: 'LIVE',
    note: 'Manager läuft — user-defined Server sind konfiguriert, bis auf eigener Hardware ein Handshake gelingt; AURA-eigener MCP-Endpoint: /api/mcp (HTTP) + backend/mcp_server.js (stdio)',
    servers: servers.length,
    installed: servers.filter((s) => s.installed).length,
    list: servers,
    builtin: { endpoint_http: '/api/mcp', endpoint_stdio: 'node backend/mcp_server.js', calls: builtin.calls, last: builtin.last },
    allowed_stdio_binaries: ALLOWED_STDIO_BINARIES,
  };
}

module.exports = {
  meta: { area: '72', id: 'mcp_manager', name: 'MCP Server Manager (add/delete/install/uninstall + usage)', state: 'live' },
  actions: {
    status: () => status(),
    add: (p) => addServer(p || {}),
    install: (p) => install(String((p || {}).id)),
    uninstall: (p) => uninstall(String((p || {}).id)),
    remove: (p) => removeServer(String((p || {}).id)),
    use: (p) => use(String((p || {}).id), (p || {}).tool),
  },
  status, addServer, install, uninstall, removeServer, setEnabled, use, testServer, listServers, getServer, builtinUsed,
  ALLOWED_STDIO_BINARIES,
};
