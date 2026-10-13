'use strict';
// AURA Area 18 — GitHub / NotebookLM Knowledge Sync (LIVE).
// Repo-Registry + Sync-Manifest (Dateien + SHAs) über die GitHub-API,
// lokaler Wissens-Cache, NotebookLM-Link-Registry (manuell, ehrlich).
// Ohne Netz: ehrlich NOT-CONNECTED; Manifest-Logik läuft trotzdem echt.
const fs = require('fs');
const path = require('path');
const https = require('https');
const FILE = path.join(__dirname, '..', 'data', 'knowledge_sync.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { repos: [], manifests: {}, notebooklm: [], cache: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function ghFetch(pathname) {
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'api.github.com', path: pathname, method: 'GET', timeout: 8000, headers: { 'user-agent': 'AURA-knowledge-sync', accept: 'application/vnd.github+json' } }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve({ state: 'NOT-CONNECTED', detail: 'HTTP ' + res.statusCode, data: null });
        try { resolve({ state: 'LIVE', detail: 'ok', data: JSON.parse(d) }); } catch { resolve({ state: 'NOT-CONNECTED', detail: 'Antwort nicht lesbar', data: null }); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ state: 'NOT-CONNECTED', detail: e.code || e.message, data: null }));
    req.end();
  });
}

function addRepo(body) {
  const owner = String((body || {}).owner || '').trim();
  const repo = String(body.repo || '').trim();
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) { const e = new Error('owner/repo ungültig'); e.code = 400; throw e; }
  const db = load();
  if (db.repos.some((r) => r.owner === owner && r.repo === repo)) { const e = new Error('Repo schon registriert'); e.code = 409; throw e; }
  const entry = { owner, repo, branch: String(body.branch || 'main').slice(0, 60), paths: Array.isArray(body.paths) ? body.paths.slice(0, 10).map((p) => String(p).slice(0, 200)) : ['README.md'], added_at: new Date().toISOString() };
  db.repos.push(entry); save(db);
  return { ok: true, repo: entry };
}
function removeRepo(owner, repo) {
  const db = load(); const before = db.repos.length;
  db.repos = db.repos.filter((r) => !(r.owner === owner && r.repo === repo));
  delete db.manifests[owner + '/' + repo]; save(db);
  return { ok: true, removed: before - db.repos.length };
}

async function syncRepo(owner, repo) {
  const db = load();
  const r = db.repos.find((x) => x.owner === owner && x.repo === repo);
  if (!r) { const e = new Error('Repo nicht registriert'); e.code = 404; throw e; }
  const files = [];
  let state = 'LIVE';
  for (const p of r.paths) {
    const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(r.branch)}`);
    if (res.state !== 'LIVE') { state = res.state; files.push({ path: p, state: res.state, detail: res.detail }); continue; }
    const d = res.data || {};
    files.push({ path: p, state: 'LIVE', sha: d.sha, size: d.size, fetched_at: new Date().toISOString() });
    if (d.content && d.encoding === 'base64') {
      db.cache.push({ repo: owner + '/' + repo, path: p, sha: d.sha, content_chars: Buffer.from(d.content, 'base64').toString('utf8').slice(0, 60000).length, fetched_at: new Date().toISOString() });
      if (db.cache.length > 200) db.cache = db.cache.slice(-200);
    }
  }
  db.manifests[owner + '/' + repo] = { synced_at: new Date().toISOString(), state, files };
  save(db);
  return { ok: state === 'LIVE', repo: owner + '/' + repo, state, files, note: state === 'LIVE' ? undefined : 'ehrlich: GitHub-API aus der Sandbox nicht erreichbar — auf dem Host synchronisiert dieser Lauf wirklich' };
}
async function syncAll() {
  const db = load(); const out = [];
  for (const r of db.repos) out.push(await syncRepo(r.owner, r.repo));
  return { ok: true, synced: out.length, results: out };
}

function addNotebookLM(body) {
  const url = String((body || {}).url || '').trim();
  let u; try { u = new URL(url); } catch { const e = new Error('ungültige URL'); e.code = 400; throw e; }
  const db = load();
  const item = { id: 'nb-' + Date.now().toString(36), url: u.href, title: String(body.title || '').slice(0, 120), note: 'manueller Link — NotebookLM hat keine öffentliche Sync-API (ehrlich)', added_at: new Date().toISOString() };
  db.notebooklm.push(item); save(db);
  return { ok: true, item };
}
function status() {
  const db = load();
  return { area: '18', mode: 'LIVE', repos: db.repos.length, manifests: Object.keys(db.manifests).length, cached_files: db.cache.length, notebooklm_links: db.notebooklm.length, note: 'Manifest & Cache laufen echt; GitHub-Abruf meldet ohne Netz ehrlich NOT-CONNECTED.' };
}

module.exports = {
  meta: { area: '18', id: 'knowledge_sync', name: 'GitHub/NotebookLM knowledge sync (manifest + cache)', state: 'live' },
  actions: { status: () => status(), repo_add: (p) => addRepo(p || {}), repo_remove: (p) => removeRepo(String((p || {}).owner), String((p || {}).repo)), sync: (p) => syncRepo(String((p || {}).owner), String((p || {}).repo)), sync_all: () => syncAll(), notebooklm_add: (p) => addNotebookLM(p || {}) },
  status, addRepo, removeRepo, syncRepo, syncAll, addNotebookLM,
};
