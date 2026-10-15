#!/usr/bin/env node
'use strict';
// Non-destructive deployment preflight. It inspects a source checkout and its
// environment; it never installs packages, creates users, starts services or
// changes network/system configuration.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const jsonMode = process.argv.includes('--json');
const checks = [];
function add(id, pass, severity, detail) { checks.push({ id, pass: !!pass, severity, detail }); }
function exists(relative) { return fs.existsSync(path.join(ROOT, relative)); }
function walk(dir, out) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.cache', 'data'].includes(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file, out); else if (item.isFile() && item.name.endsWith('.js')) out.push(file);
  }
}
function main() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add('node_version', nodeMajor >= 18, 'critical', 'Node ' + process.version + ' detected; AURA requires Node 18+');
  for (const file of ['backend/server.js', 'backend/src/dispatcher.js', 'deploy/aura.service', 'deploy/.env.example', 'docs/AURA_CLEAN_REBUILD_AND_CUTOVER.md']) add('required_' + file.replace(/[^a-z0-9]+/gi, '_'), exists(file), 'critical', file + (exists(file) ? ' present' : ' missing'));
  const port = Number(process.env.PORT || 8080); add('port', Number.isInteger(port) && port >= 1024 && port <= 65535, 'critical', 'PORT=' + port + ' (unprivileged range expected)');
  const production = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const authRequired = /^(1|true|yes|on)$/i.test(String(process.env.AURA_AUTH_REQUIRED || ''));
  add('production_auth', !production || authRequired, production ? 'critical' : 'advisory', production ? (authRequired ? 'AURA_AUTH_REQUIRED is enabled' : 'Set AURA_AUTH_REQUIRED=true before public production exposure') : 'Development mode: auth enforcement may remain disabled during local validation.');
  add('session_secret', !production || String(process.env.AURA_SESSION_SECRET || '').length >= 32, production ? 'critical' : 'advisory', production ? (String(process.env.AURA_SESSION_SECRET || '').length >= 32 ? 'AURA_SESSION_SECRET meets minimum length' : 'Set a 32+ character AURA_SESSION_SECRET outside Git') : 'Development may use an ephemeral session secret.');
  const source = []; walk(path.join(ROOT, 'backend'), source); let syntaxFailures = 0;
  for (const file of source) { const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (r.status !== 0) syntaxFailures++; }
  add('source_syntax', syntaxFailures === 0, 'critical', syntaxFailures ? syntaxFailures + ' JavaScript syntax failures' : source.length + ' backend JavaScript files passed node --check');
  add('runtime_boundary', !exists('backend/src/data/secrets.json'), 'advisory', exists('backend/src/data/secrets.json') ? 'Runtime secret file exists locally; it is excluded from source archives. Do not copy it to a clean target.' : 'No local secret runtime file detected.');
  const criticalFailures = checks.filter((check) => !check.pass && check.severity === 'critical').length;
  const report = { tool: 'AURA non-destructive deployment preflight', at: new Date().toISOString(), root: ROOT, production, checks, verdict: criticalFailures ? 'BLOCKED' : 'READY_FOR_OPERATOR_REVIEW', note: 'Passing this preflight does not install or configure a server. Complete the cutover document and restore drill before traffic is switched.' };
  if (jsonMode) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('== AURA deployment preflight ==');
    for (const check of checks) console.log((check.pass ? 'PASS' : 'FAIL') + ' [' + check.severity + '] ' + check.id + ' — ' + check.detail);
    console.log('\nVerdict: ' + report.verdict + ' — ' + report.note);
  }
  process.exit(criticalFailures ? 1 : 0);
}
main();
