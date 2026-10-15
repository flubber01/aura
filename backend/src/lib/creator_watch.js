'use strict';
// AURA — Creator-Beobachtungsliste (modular). Liest und schreibt backend/data/creators.json.
// Nur öffentliche Quellen: Links, Takeout-Exporte der eigenen Abos, öffentliche RSS-Feeds.
// Kein Login, kein Scraping hinter Anmeldung, kein Abruf in diesem Modul.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_CREATORS_FILE || path.join(__dirname, '..', '..', 'data', 'creators.json');
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const PLATFORMS = ['youtube', 'x', 'tiktok', 'instagram', 'soundcloud', 'bandcamp', 'spotify', 'website', 'newsletter', 'telegram', 'open-data', 'other'];
const BUY_RE = /\b(buy|kaufen|gekaufte?\s+(views|follower|likes|abos?)|fake\s+(views|likes|follower)|follower.?farm|views?\s+kaufen)\b/i;

// Host → Plattform. Unbekannte Hosts werden 'website' (https vorausgesetzt).
const HOSTS = [
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube'],
  [/(^|\.)(x|twitter)\.com$/, 'x'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)soundcloud\.com$/, 'soundcloud'],
  [/(^|\.)bandcamp\.com$/, 'bandcamp'],
  [/(^|\.)spotify\.com$/, 'spotify'],
  [/^t\.me$|(^|\.)telegram\.me$/, 'telegram'],
  [/(^|\.)musicbrainz\.org$|(^|\.)discogs\.com$|(^|\.)wikidata\.org$/, 'open-data'],
];

function detectPlatform(url) {
  let h = '';
  try { h = new URL(url).hostname.toLowerCase(); } catch { return 'website'; }
  const hit = HOSTS.find(([re]) => re.test(h));
  return hit ? hit[1] : 'website';
}

// YouTube-Link → Kanal-ID (UC…) oder @Handle, plus öffentlicher RSS-Feed, falls ID bekannt.
function normalizeYoutube(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const parts = u.pathname.split('/').filter(Boolean);
  let channel_id = null, handle = null;
  if (parts[0] === 'channel' && /^UC[\w-]{20,}$/.test(parts[1] || '')) channel_id = parts[1];
  else if (parts[0] && parts[0].startsWith('@')) handle = parts[0].slice(1);
  else if (parts[0] === 'c' || parts[0] === 'user') handle = parts[1] || null;
  if (!channel_id && !handle) return null;
  const canonical = channel_id ? 'https://www.youtube.com/channel/' + channel_id : 'https://www.youtube.com/@' + handle;
  return {
    channel_id, handle, canonical,
    feed: channel_id ? 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channel_id : null,
  };
}

function slug(name, fallback) {
  const s = String(name || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s.length >= 2 ? s : (fallback || 'c-' + crypto.randomBytes(3).toString('hex'));
}

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { platforms: PLATFORMS, creators: Array.isArray(d.creators) ? d.creators : [], raw: d };
  } catch { return { platforms: PLATFORMS, creators: [], raw: null }; }
}

// Prüft einen Eintrag. Liefert Liste der Fehler (leer = ok).
function validate(c, platforms = PLATFORMS) {
  const err = [];
  if (!c || typeof c !== 'object') return ['kein Objekt'];
  if (!ID_RE.test(String(c.id || ''))) err.push('id: nur Kleinbuchstaben, Ziffern, Bindestrich (2–41 Zeichen)');
  if (!String(c.name || '').trim() || String(c.name).length > 80) err.push('name: 1–80 Zeichen');
  if (!platforms.includes(c.platform)) err.push('platform: unbekannt (' + platforms.join(', ') + ')');
  try { if (new URL(c.url).protocol !== 'https:') err.push('url: nur https'); } catch { err.push('url: ungültig'); }
  if (c.website) { try { if (new URL(c.website).protocol !== 'https:') err.push('website: nur https'); } catch { err.push('website: ungültig'); } }
  if (c.feed) { try { if (new URL(c.feed).protocol !== 'https:') err.push('feed: nur https'); } catch { err.push('feed: ungültig'); } }
  if (!Array.isArray(c.topics) || c.topics.length > 12) err.push('topics: Liste, max. 12');
  if (c.bell !== undefined && typeof c.bell !== 'boolean') err.push('bell: true/false');
  if (BUY_RE.test(String(c.name || '') + ' ' + (c.topics || []).join(' '))) err.push('Name oder Themen enthalten Begriffe zu gekauftem Engagement');
  return err;
}

// Roh-Eintrag (Link + optionale Angaben) in fertigen Eintrag umwandeln.
function buildEntry(raw, existingIds = new Set()) {
  const url = String(raw.url || '').trim();
  const yt = detectPlatform(url) === 'youtube' ? normalizeYoutube(url) : null;
  const platform = raw.platform || detectPlatform(url);
  const name = String(raw.name || (yt && yt.handle) || (() => { try { return new URL(url).hostname; } catch { return ''; } })()).trim();
  let id = slug(name, yt && yt.channel_id ? slug(yt.channel_id.toLowerCase()) : null);
  let n = 2; while (existingIds.has(id)) id = slug(name) + '-' + n++;
  const entry = {
    id, name, platform,
    url: yt ? yt.canonical : url,
    topics: (Array.isArray(raw.topics) ? raw.topics : String(raw.topics || '').split(','))
      .map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12),
    enabled: raw.enabled === undefined ? true : !!raw.enabled,
    bell: raw.bell === undefined ? false : !!raw.bell,
    watch: 'manuell',
    source: raw.source || 'manual',
    note: String(raw.note || raw.desc || '').slice(0, 300),
  };
  if (raw.website) entry.website = String(raw.website);
  if (yt && yt.feed) entry.feed = yt.feed;
  return entry;
}

// Formate: JSON-Liste, Zeilen "Name | Link | Themen | bell", Takeout-CSV der Abos.
function parseLines(text) {
  const out = [];
  String(text).split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [name = '', url = '', topics = '', bell = ''] = t.split('|').map((s) => s.trim());
    out.push({ name, url, topics, bell: /^(ja|yes|true|1|bell|glocke)$/i.test(bell), source: 'upload' });
  });
  return out;
}

function parseTakeoutCsv(text) {
  // Takeout: "Channel Id,Channel Url,Channel Title" (Abos). Glocken-Status steht darin nicht.
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const iUrl = head.indexOf('channel url'), iTitle = head.indexOf('channel title');
  if (iUrl < 0) return null;
  return lines.slice(1).map((l) => {
    // einfacher CSV-Split mit Anführungszeichen
    const cells = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur);
    return { name: iTitle >= 0 ? (cells[iTitle] || '').trim() : '', url: (cells[iUrl] || '').trim(), source: 'takeout', platform: 'youtube' };
  });
}

// Upload-Parser: liefert {accepted, rejected, total} im Format von data_upload.finish().
function parseUpload(text, { checkItem }) {
  const s = String(text || '').trim();
  let rows;
  if (s.startsWith('[') || s.startsWith('{')) {
    let obj; try { obj = JSON.parse(s); } catch (e) { return { error: 'kein gültiges JSON: ' + e.message }; }
    const list = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.creators) ? obj.creators : null);
    if (!list) return { error: 'erwartet ein Array oder {"creators": [...]}' };
    rows = list.map((r) => ({ ...r, source: 'upload' }));
  } else if (/^channel id,/i.test(s) || /channel url/i.test(s.split('\n')[0] || '')) {
    rows = parseTakeoutCsv(s);
    if (!rows) return { error: 'CSV ohne Spalte "Channel Url"' };
  } else {
    rows = parseLines(s);
  }
  if (rows.length > 500) return { error: 'höchstens 500 Einträge pro Upload' };
  const existing = load().creators;
  const taken = new Set(existing.map((c) => c.id));
  const accepted = [], rejected = [];
  rows.forEach((raw, i) => {
    const entry = buildEntry(raw, taken);
    const why = [];
    if (!entry.name || entry.name.length < 2) why.push('name: 2–80 Zeichen');
    if (entry.name.length > 80) why.push('name: höchstens 80 Zeichen');
    if (!/^https:\/\//.test(entry.url)) why.push('url: nur https');
    const hit = checkItem && checkItem({ name: entry.name, url: entry.url, category: entry.platform, desc: entry.note });
    if (hit) why.push(hit);
    const v = validate(entry);
    if (v.length) why.push(...v);
    if (why.length) rejected.push({ line: i + 1, name: entry.name || raw.name || '(ohne Name)', reason: why.join('; ') });
    else { taken.add(entry.id); accepted.push({ ...entry, category: entry.platform, desc: entry.note }); }
  });
  return { total: rows.length, accepted, rejected };
}

// Übernahme: merge nach URL. Bekannte Einträge werden aktualisiert, neue angehängt.
function mergeAccepted(items) {
  const cur = load();
  const creators = cur.creators.slice();
  const byUrl = new Map(creators.map((c) => [c.url, c]));
  let added = 0, updated = 0;
  for (const it of items) {
    const { category, desc, ...entry } = it; // interne Felder aus dem Upload nicht speichern
    const ex = byUrl.get(entry.url);
    if (ex) {
      Object.assign(ex, { name: entry.name, platform: entry.platform, topics: entry.topics, bell: entry.bell, note: entry.note || ex.note, feed: entry.feed || ex.feed, source: ex.source || entry.source });
      updated++;
    } else {
      creators.push(entry); byUrl.set(entry.url, entry); added++;
    }
  }
  const next = { ...(cur.raw || {}), schema_version: 1, platforms: cur.platforms, creators, updated_at: new Date().toISOString() };
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(next, null, 2) + '\n');
  fs.renameSync(FILE + '.tmp', FILE);
  return { added, updated };
}

function list({ platform = '', topic = '', enabled = '', bell = '' } = {}) {
  const { creators } = load();
  const t = String(topic).toLowerCase();
  return creators.filter((c) =>
    (!platform || c.platform === platform) &&
    (!t || (c.topics || []).some((x) => String(x).toLowerCase().includes(t))) &&
    (enabled === '' || String(c.enabled) === String(enabled)) &&
    (bell === '' || String(!!c.bell) === String(bell)));
}

function check() {
  const { platforms, creators } = load();
  const ids = new Set();
  const problems = [];
  for (const c of creators) {
    const e = validate(c, platforms);
    if (ids.has(c.id)) e.push('id doppelt');
    ids.add(c.id);
    if (e.length) problems.push({ id: c.id, problems: e });
  }
  return { ok: problems.length === 0, count: creators.length, problems };
}

module.exports = {
  FILE, PLATFORMS, load, list, validate, check, detectPlatform, normalizeYoutube, buildEntry,
  parseUpload, mergeAccepted, parseTakeoutCsv,
  meta: { area: 'CRW', id: 'creator_watch', name: 'Creator-Beobachtungsliste (modular, Upload, nur öffentlich)', state: 'live' },
};
