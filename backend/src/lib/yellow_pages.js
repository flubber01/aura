'use strict';
// AURA Area 19 (maximiert) — Yellow Pages Wissensbasis.
// Admin-verwaltete Kategorien, Links, Services, Wissen & How-tos + Brain-Feed:
// der Administrator trägt selbst ein, erweitert und verbessert; Einträge können
// dem Super/Ultra-Brain als Wissen bereitgestellt werden (brain feed).
// Migration: übernimmt automatisch die bisherigen 66 kuratierten Links.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'yellowpages_v3.json');
const LEGACY = path.join(__dirname, '..', '..', 'data', 'yellowpages.json');

function defaults() {
  return { schema_version: 3, categories: [], entries: [], brain_feed: [], migrated_from_legacy: false };
}
function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch {
    const db = defaults();
    // one-time migration of the curated legacy list (keeps history intact)
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY, 'utf8'));
      const cats = new Set();
      for (const l of legacy.links || []) {
        if (l.status === 'blocked') continue; // Blockliste bleibt Blockliste
        const cat = String(l.category || 'uncategorized');
        cats.add(cat);
        db.entries.push({
          id: 'yp-' + db.entries.length + '-' + Math.abs(hash(l.url || '')),
          name: l.name, url: l.url || '', category: cat, desc: l.desc || '',
          kind: 'link', tags: [], status: l.status === 'review' ? 'review' : 'ok',
          custom: false, created_at: l.suggested_at || null, updated_at: null,
        });
      }
      for (const c of cats) db.categories.push({ id: c, name: c, desc: 'migriert aus kuratierter Liste', builtin: true });
      db.migrated_from_legacy = true;
    } catch {}
    save(db);
    return db;
  }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const t = FILE + '.tmp';
  fs.writeFileSync(t, JSON.stringify(db, null, 2));
  fs.renameSync(t, FILE);
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

function ensureCategory(db, id) {
  const cid = String(id || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || 'uncategorized';
  if (!db.categories.some((c) => c.id === cid)) db.categories.push({ id: cid, name: cid, desc: '', builtin: false });
  return cid;
}

function list({ q, category, kind, includeDeleted } = {}) {
  const db = load();
  let out = db.entries;
  if (!includeDeleted) out = out.filter((e) => e.status !== 'deleted');
  if (category && category !== 'all') out = out.filter((e) => e.category === category);
  if (kind) out = out.filter((e) => e.kind === kind);
  if (q) { const s = String(q).toLowerCase(); out = out.filter((e) => (e.name + ' ' + e.desc + ' ' + (e.tags || []).join(' ')).toLowerCase().includes(s)); }
  return out;
}

function addEntry(body) {
  const db = load();
  const name = String(body.name || '').trim().slice(0, 120);
  const url = String(body.url || '').trim();
  const kind = ['link', 'service', 'knowledge', 'howto'].includes(body.kind) ? body.kind : 'link';
  if (!name) { const e = new Error('name fehlt'); e.code = 400; throw e; }
  if (kind !== 'knowledge') {
    let u; try { u = new URL(url); } catch { const e = new Error('ungültige URL'); e.code = 400; throw e; }
    if (!/^https?:$/.test(u.protocol)) { const e = new Error('nur http(s) erlaubt'); e.code = 400; throw e; }
    if (db.entries.some((x) => x.url === u.href && x.status !== 'deleted')) { const e = new Error('URL schon vorhanden'); e.code = 409; throw e; }
  }
  const entry = {
    id: 'yp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    name, url: kind === 'knowledge' ? '' : url,
    category: ensureCategory(db, body.category),
    desc: String(body.desc || '').slice(0, 400),
    kind, tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).slice(0, 30)).slice(0, 10) : [],
    status: 'ok', custom: true, created_at: new Date().toISOString(), updated_at: null,
    body: kind === 'knowledge' || kind === 'howto' ? String(body.body || '').slice(0, 20000) : undefined,
  };
  db.entries.push(entry); save(db);
  return { ok: true, entry };
}

function updateEntry(id, patch) {
  const db = load();
  const e = db.entries.find((x) => x.id === id);
  if (!e) { const err = new Error('Eintrag nicht gefunden'); err.code = 404; throw err; }
  for (const k of ['name', 'url', 'desc', 'category', 'kind', 'tags', 'body', 'status']) {
    if (patch[k] !== undefined) {
      if (k === 'category') e.category = ensureCategory(db, patch[k]);
      else if (k === 'name') e.name = String(patch[k]).slice(0, 120);
      else if (k === 'desc') e.desc = String(patch[k]).slice(0, 400);
      else if (k === 'body') e.body = String(patch[k]).slice(0, 20000);
      else if (k === 'tags') e.tags = Array.isArray(patch[k]) ? patch[k].map((t) => String(t).slice(0, 30)).slice(0, 10) : e.tags;
      else if (k === 'status' && ['ok', 'review', 'blocked', 'deleted'].includes(patch[k])) e.status = patch[k];
      else if (k === 'url') { let u; try { u = new URL(String(patch[k])); } catch { const err = new Error('ungültige URL'); err.code = 400; throw err; } e.url = u.href; }
      else if (k === 'kind' && ['link', 'service', 'knowledge', 'howto'].includes(patch[k])) e.kind = patch[k];
    }
  }
  e.updated_at = new Date().toISOString();
  save(db);
  return { ok: true, entry: e };
}

function deleteEntry(id) {
  const db = load();
  const e = db.entries.find((x) => x.id === id);
  if (!e) { const err = new Error('Eintrag nicht gefunden'); err.code = 404; throw err; }
  e.status = 'deleted'; e.deleted_at = new Date().toISOString(); save(db);
  return { ok: true, id, soft: true, note: 'als gelöscht markiert — restore möglich' };
}
function restoreEntry(id) {
  const db = load();
  const e = db.entries.find((x) => x.id === id);
  if (!e) { const err = new Error('Eintrag nicht gefunden'); err.code = 404; throw err; }
  e.status = 'ok'; delete e.deleted_at; save(db);
  return { ok: true, entry: e };
}

function addCategory(body) {
  const db = load();
  const id = String(body.id || body.name || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
  if (!id) { const e = new Error('id/name fehlt'); e.code = 400; throw e; }
  if (db.categories.some((c) => c.id === id)) { const e = new Error('Kategorie existiert schon'); e.code = 409; throw e; }
  const cat = { id, name: String(body.name || id).slice(0, 60), desc: String(body.desc || '').slice(0, 200), builtin: false };
  db.categories.push(cat); save(db);
  return { ok: true, category: cat };
}
function deleteCategory(id) {
  const db = load();
  const before = db.categories.length;
  db.categories = db.categories.filter((c) => c.id !== id);
  let moved = 0;
  for (const e of db.entries) if (e.category === id && e.status !== 'deleted') { e.category = 'uncategorized'; moved++; }
  if (!db.categories.some((c) => c.id === 'uncategorized') && moved) db.categories.push({ id: 'uncategorized', name: 'uncategorized', desc: '', builtin: true });
  save(db);
  return { ok: true, removed: before - db.categories.length, entries_moved: moved };
}

// Area 19 catalog ingestor → Yellow Pages (Crosslink: Deep-Research/Katalog-Ingest)
function ingestFromCatalog() {
  const ing = require('./catalog_ingestor');
  const db = load();
  const r = ing.ingest();
  let added = 0;
  for (const rec of r.items) {
    if (db.entries.some((e) => e.url === rec.url)) continue;
    db.entries.push({
      id: 'yp-ing-' + Math.abs(hash(rec.url)),
      name: rec.name, url: rec.url, category: ensureCategory(db, rec.category),
      desc: 'aus ingest/apis.txt (lizenz vor Nutzung prüfen)', kind: 'link', tags: ['ingest'],
      status: 'review', custom: false, created_at: new Date().toISOString(), updated_at: null,
    });
    added++;
  }
  save(db);
  return { ok: true, added, catalog_records: r.records, rejected: r.rejected };
}

// ---------- Brain-Feed: Wissen für Super/Ultra-Brain bereitstellen ----------
function feedToBrain(body) {
  const db = load();
  const title = String(body.title || '').trim().slice(0, 120);
  if (!title) { const e = new Error('title fehlt'); e.code = 400; throw e; }
  let refs = [];
  if (Array.isArray(body.entry_ids) && body.entry_ids.length) {
    refs = db.entries.filter((e) => body.entry_ids.includes(e.id) && e.status !== 'deleted')
      .map((e) => ({ id: e.id, name: e.name, url: e.url, desc: e.desc, body: (e.body || '').slice(0, 2000) }));
    if (!refs.length) { const e = new Error('keine gültigen Einträge gefunden'); e.code = 400; throw e; }
  } else if (body.category) {
    refs = db.entries.filter((e) => e.category === body.category && e.status === 'ok').slice(0, 50)
      .map((e) => ({ id: e.id, name: e.name, url: e.url, desc: e.desc, body: (e.body || '').slice(0, 2000) }));
  }
  const item = {
    id: 'feed-' + Date.now().toString(36),
    title, summary: String(body.summary || '').slice(0, 1000),
    refs, active: true, provided_at: new Date().toISOString(), provided_by: 'admin',
  };
  db.brain_feed.push(item); save(db);
  return { ok: true, item: { ...item, refs: refs.length } };
}
function brainFeed() { const db = load(); return db.brain_feed.map((f) => ({ ...f, refs_count: f.refs.length, refs: undefined })); }
function toggleFeed(id) {
  const db = load();
  const f = db.brain_feed.find((x) => x.id === id);
  if (!f) { const e = new Error('Feed nicht gefunden'); e.code = 404; throw e; }
  f.active = !f.active; save(db);
  return { ok: true, id, active: f.active };
}
function deleteFeed(id) {
  const db = load();
  const before = db.brain_feed.length;
  db.brain_feed = db.brain_feed.filter((x) => x.id !== id);
  save(db);
  return { ok: true, removed: before - db.brain_feed.length };
}
// fertiges Wissens-Bundle (z. B. für Brain-Kontext / Export)
function brainBundle(category) {
  const db = load();
  const active = db.brain_feed.filter((f) => f.active);
  const entries = category ? db.entries.filter((e) => e.category === category && e.status === 'ok') : [];
  return {
    generated_at: new Date().toISOString(),
    feeds: active.map((f) => ({ title: f.title, summary: f.summary, refs: f.refs.length })),
    category_entries: entries.map((e) => ({ name: e.name, url: e.url, desc: e.desc })),
    knowledge_chars: active.reduce((n, f) => n + f.summary.length + f.refs.reduce((m, r) => m + (r.body || '').length + (r.desc || '').length, 0), 0),
  };
}

// Abwärtskompatibilität: alte Ansicht {links:[…]} für /api/yellowpages & Ignition
function legacyView() {
  const db = load();
  return {
    schema_version: 2,
    note: 'AURA Yellow Pages — admin-verwaltete Link- & Wissensbasis (Area 19 maximiert). Listing ≠ Freigabe zur Ausführung.',
    links: db.entries.filter((e) => e.status !== 'deleted' && e.kind === 'link' && e.url).map((e) => ({ name: e.name, url: e.url, category: e.category, desc: e.desc, status: e.status })),
  };
}

function status() {
  const db = load();
  const act = db.entries.filter((e) => e.status !== 'deleted');
  return {
    area: '19', mode: 'LIVE',
    entries: act.length,
    by_kind: { link: act.filter((e) => e.kind === 'link').length, service: act.filter((e) => e.kind === 'service').length, knowledge: act.filter((e) => e.kind === 'knowledge').length, howto: act.filter((e) => e.kind === 'howto').length },
    categories: db.categories.length,
    custom_entries: act.filter((e) => e.custom).length,
    brain_feeds: db.brain_feed.length, active_feeds: db.brain_feed.filter((f) => f.active).length,
    admin: 'volle CRUD-Kontrolle: Kategorien & Einträge selbst anlegen/bearbeiten/löschen; Wissen per Feed ans Brain',
  };
}

module.exports = {
  meta: { area: '19', id: 'yellow_pages', name: 'Yellow Pages (admin knowledge base + brain feed)', state: 'live' },
  actions: {
    status: () => status(),
    list: (p) => list(p || {}),
    add: (p) => addEntry(p || {}),
    update: (p) => { const { id, ...patch } = p || {}; return updateEntry(String(id || ''), patch); },
    delete: (p) => deleteEntry(String((p || {}).id || '')),
    restore: (p) => restoreEntry(String((p || {}).id || '')),
    categories: () => load().categories,
    category_add: (p) => addCategory(p || {}),
    category_delete: (p) => deleteCategory(String((p || {}).id || '')),
    ingest: () => ingestFromCatalog(),
    feed: (p) => feedToBrain(p || {}),
    feed_list: () => brainFeed(),
    brain_bundle: (p) => brainBundle((p || {}).category),
    export: () => load(),
  },
  status, list, addEntry, updateEntry, deleteEntry, restoreEntry,
  addCategory, deleteCategory, ingestFromCatalog,
  feedToBrain, brainFeed, toggleFeed, deleteFeed, brainBundle, legacyView, load, save,
};
