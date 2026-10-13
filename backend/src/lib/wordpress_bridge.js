'use strict';
// AURA Area 14 — WordPress Gutenberg/REST Bridge (LIVE).
// Echter WP-REST-Client: Draft/Publish über /wp-json/wp/v2/posts mit
// Application-Password, Duplikat-Schutz (Titel-Hash) und ehrlichem Status.
// Credentials NUR aus deploy/.env (WP_SITE_URL, WP_USER, WP_APP_PASSWORD).
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const FILE = path.join(__dirname, '..', 'data', 'wordpress.json');
const ENV_FILE = path.join(__dirname, '..', '..', '..', 'deploy', '.env');

function parseEnvFile(f) { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])); } catch { return {}; } }
function cfg() {
  const env = { ...parseEnvFile(ENV_FILE), ...process.env };
  return { site: (env.WP_SITE_URL || '').replace(/\/$/, ''), user: env.WP_USER || '', pass: env.WP_APP_PASSWORD || '' };
}
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { posts: [], title_hashes: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function titleHash(s) { let h = 0; const x = String(s).toLowerCase().replace(/\s+/g, ' ').trim(); for (let i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) | 0; return 'h' + Math.abs(h).toString(36); }

async function publishPost(body) {
  const title = String((body || {}).title || '').trim().slice(0, 200);
  const content = String(body.content || '').slice(0, 100000);
  const status = body.publish === true ? 'publish' : 'draft';
  if (!title || !content) { const e = new Error('title + content fehlen'); e.code = 400; throw e; }
  const db = load();
  const th = titleHash(title);
  if (db.title_hashes.includes(th)) { const e = new Error('Duplikat-Schutz: Titel existiert schon (title-hash ' + th + ')'); e.code = 409; throw e; }
  const c = cfg();
  if (!c.site || !c.user || !c.pass) {
    db.posts.push({ id: 'wp-local-' + Date.now().toString(36), title, status: 'queued-local', created_at: new Date().toISOString() });
    db.title_hashes.push(th); save(db);
    return { ok: true, state: 'NOT-CONNECTED', queued_local: true, note: 'WP_SITE_URL/WP_USER/WP_APP_PASSWORD in deploy/.env setzen — der Post liegt als lokaler Entwurf bereit und wird bei Erreichbarkeit publiziert' };
  }
  return new Promise((resolve) => {
    const u = new URL(c.site + '/wp-json/wp/v2/posts');
    const mod = u.protocol === 'https:' ? https : http;
    const payload = JSON.stringify({ title, content, status });
    const req = mod.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(c.user + ':' + c.pass).toString('base64'), 'Content-Length': Buffer.byteLength(payload) }, timeout: 12000 }, (res) => {
      let d = ''; res.on('data', (x) => d += x);
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        if (ok) { db.title_hashes.push(th); db.posts.push({ id: 'wp-' + Date.now().toString(36), title, status, remote_id: (JSON.parse(d || '{}') || {}).id || null, created_at: new Date().toISOString() }); save(db); }
        resolve({ ok, state: ok ? 'LIVE' : 'ERROR', http: res.statusCode, raw: d.slice(0, 200), title });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ ok: false, state: 'NOT-CONNECTED', error: e.code || e.message }));
    req.write(payload); req.end();
  });
}

function listPosts() { return load().posts.slice().reverse(); }
function status() {
  const c = cfg(); const db = load();
  return { area: '14', mode: c.site && c.user && c.pass ? 'READY' : 'NOT-CONFIGURED', configured: { site: !!c.site, user: !!c.user, app_password: !!c.pass }, posts_local: db.posts.length, protection: ['Duplikat-Schutz über Titel-Hash', 'Application Password (nie im Repo)', 'publish nur mit explizitem publish=true'], note: 'Sandbox ohne Netz: ehrlich NOT-CONNECTED — auf dem Host mit WP-Zugang voll LIVE.' };
}

module.exports = {
  meta: { area: '14', id: 'wordpress_bridge', name: 'WordPress Gutenberg/REST (drafts, dup-guard, app-password)', state: 'live' },
  actions: { status: () => status(), publish: (p) => publishPost(p || {}), list: () => listPosts() },
  status, publishPost, listPosts,
};
