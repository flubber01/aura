'use strict';
// AURA — Creator-Beobachtungsliste (modular). Liest backend/data/creators.json.
// Rein lesend und prüfend. Es wird nichts abgerufen, nichts geladen, nichts gekauft.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'data', 'creators.json');
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { platforms: d.platforms || [], creators: Array.isArray(d.creators) ? d.creators : [] };
  } catch { return { platforms: [], creators: [] }; }
}

// Prüft einen Eintrag. Liefert Liste der Fehler (leer = ok).
function validate(c, platforms) {
  const err = [];
  if (!c || typeof c !== 'object') return ['kein Objekt'];
  if (!ID_RE.test(String(c.id || ''))) err.push('id: nur Kleinbuchstaben, Ziffern, Bindestrich (2–41 Zeichen)');
  if (!String(c.name || '').trim() || String(c.name).length > 80) err.push('name: 1–80 Zeichen');
  if (!platforms.includes(c.platform)) err.push('platform: unbekannt (' + platforms.join(', ') + ')');
  try { if (new URL(c.url).protocol !== 'https:') err.push('url: nur https'); } catch { err.push('url: ungültig'); }
  if (c.website) { try { if (new URL(c.website).protocol !== 'https:') err.push('website: nur https'); } catch { err.push('website: ungültig'); } }
  if (!Array.isArray(c.topics) || c.topics.length > 12) err.push('topics: Liste, max. 12');
  if (/\b(buy|kaufen|gekaufte?\s+(views|follower|likes)|fake\s+(views|likes|follower)|follower.?farm)\b/i.test(String(c.name || '') + ' ' + (c.topics || []).join(' '))) err.push('Name oder Themen enthalten Begriffe zu gekauftem Engagement');
  return err;
}

function list({ platform = '', topic = '', enabled = '' } = {}) {
  const { creators } = load();
  const t = String(topic).toLowerCase();
  return creators.filter((c) =>
    (!platform || c.platform === platform) &&
    (!t || (c.topics || []).some((x) => String(x).toLowerCase().includes(t))) &&
    (enabled === '' || String(c.enabled) === String(enabled)));
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

module.exports = { list, validate, check, load, meta: { area: 'CRW', id: 'creator_watch', name: 'Creator-Beobachtungsliste (modular, nur lesend)', state: 'live' } };
