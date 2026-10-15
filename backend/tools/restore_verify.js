#!/usr/bin/env node
'use strict';
// Isolated safe-source archive verification. Extracts only into a fresh OS temp
// directory, starts a temporary AURA process on an explicit high port, exercises
// local HTTP checks, then removes that temp directory. It never touches a running
// Main Core, credentials, production data directory or deployment target.
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }
const archive = arg('--archive'); const expected = arg('--sha256'); const port = Number(arg('--port') || 18081);
function fail(message) { throw new Error(message); }
function request(url) { return new Promise((resolve, reject) => { const req = http.get(url, { timeout: 5000 }, (res) => { let body = ''; res.on('data', (chunk) => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body, type: res.headers['content-type'] || '' })); }); req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); }); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function makeOwnerReadable(target) {
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) { fs.chmodSync(target, 0o700); for (const name of fs.readdirSync(target)) makeOwnerReadable(path.join(target, name)); }
  else if (stat.isFile()) fs.chmodSync(target, 0o600);
}
async function waitForHealth(base, child) { const deadline = Date.now() + 30000; let last = 'not attempted'; while (Date.now() < deadline) { if (child.exitCode !== null) fail('temporary AURA process exited early: ' + child.exitCode); try { const r = await request(base + '/api/health'); if (r.status === 200) return r; last = 'HTTP ' + r.status; } catch (e) { last = e.message; } await sleep(300); } fail('temporary AURA health endpoint did not become ready: ' + last); }
async function main() {
  if (!archive) fail('Usage: node backend/tools/restore_verify.js --archive /absolute/path/AURA_COMPLETE_SAFE_SOURCE_BACKUP.zip [--sha256 <expected>] [--port 18081]');
  const absoluteArchive = path.resolve(archive); if (!fs.existsSync(absoluteArchive)) fail('archive not found: ' + absoluteArchive);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail('port must be in unprivileged range 1024–65535');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(absoluteArchive)).digest('hex');
  if (expected && actual.toLowerCase() !== String(expected).trim().toLowerCase()) fail('SHA-256 mismatch: expected ' + expected + ', got ' + actual);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-restore-verify-')); let child = null;
  const report = { tool: 'AURA isolated restore verify', archive: absoluteArchive, archive_sha256: actual, temp_directory: temp, port, checks: [], boundary: 'Extracted and started only in a temporary directory; no production files, credentials or runtime state were restored.' };
  try {
    execFileSync('unzip', ['-t', absoluteArchive], { stdio: 'pipe' }); report.checks.push({ id: 'zip_crc', pass: true });
    execFileSync('unzip', ['-q', absoluteArchive, '-d', temp], { stdio: 'pipe' });
    // AURA's stored source ZIP deliberately does not preserve executable modes.
    // Make the isolated temp copy owner-readable only; never change the archive or a live checkout.
    makeOwnerReadable(temp);
    const roots = fs.readdirSync(temp, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(temp, entry.name));
    const sourceRoot = roots.find((candidate) => fs.existsSync(path.join(candidate, 'backend', 'server.js')));
    if (!sourceRoot) fail('archive does not contain an AURA backend source root');
    report.checks.push({ id: 'expected_source_root', pass: true, source_root: path.basename(sourceRoot) });
    const excluded = ['backend/src/data', '.git', 'node_modules'];
    for (const relative of excluded) { const found = fs.existsSync(path.join(sourceRoot, relative)); report.checks.push({ id: 'excluded_' + relative.replace(/[^a-z0-9]+/gi, '_'), pass: !found }); if (found) fail('safe archive unexpectedly contains ' + relative); }
    child = spawn(process.execPath, ['backend/server.js'], { cwd: sourceRoot, env: { ...process.env, PORT: String(port), NODE_ENV: 'restore-verification' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = ''; child.stdout.on('data', (data) => { logs += data; }); child.stderr.on('data', (data) => { logs += data; });
    const base = 'http://127.0.0.1:' + port; await waitForHealth(base, child); report.checks.push({ id: 'temporary_health', pass: true });
    for (const endpoint of ['/admin', '/jarvis', '/workflows', '/api/builder/workflows', '/api/auth/status', '/api/ollama/server-profiles']) {
      const result = await request(base + endpoint); const pass = result.status === 200; report.checks.push({ id: 'endpoint_' + endpoint.replace(/[^a-z0-9]+/gi, '_'), pass, status: result.status }); if (!pass) fail(endpoint + ' returned HTTP ' + result.status);
    }
    report.verdict = 'RESTORE_VERIFIED_IN_ISOLATED_TEMPORARY_DIRECTORY';
  } finally {
    if (child && child.exitCode === null) { child.kill('SIGTERM'); await sleep(400); if (child.exitCode === null) child.kill('SIGKILL'); }
    fs.rmSync(temp, { recursive: true, force: true }); report.temp_directory_removed = true;
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => { console.error(JSON.stringify({ ok: false, tool: 'AURA isolated restore verify', error: error.message }, null, 2)); process.exit(1); });
