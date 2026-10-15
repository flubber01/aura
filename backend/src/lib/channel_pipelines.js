'use strict';
// AURA — Multi-Kanal-Pipeline. Ein Ablauf für alle Ziele: Video, Blog, Newsletter, Börsen-News, Distributoren.
// Grundregel überall gleich: Entwurf zuerst, Mensch gibt frei, nie ein Agent. Nichts wird gesendet.
// Eigene Kanäle kommen aus backend/data/channels.json (von Hand oder später per Upload).
const fs = require('fs');
const path = require('path');
const yt = require('./youtube_pipeline');

const EXTRA_FILE = process.env.AURA_CHANNELS_FILE || path.join(__dirname, '..', '..', 'data', 'channels.json');
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const PUBLISH_MODES = ['private-first', 'draft-first', 'draft-only', 'human-review', 'human-only'];
const AGENT_RE = /agent|system|bot|auto/i;

const COMMON_STAGES = [
  { id: 'research', label: 'Recherche', gate: 'none' },
  { id: 'draft', label: 'Entwurf', gate: 'none' },
  { id: 'review', label: 'Prüfung durch Mensch', gate: 'human' },
  { id: 'format', label: 'Format für Kanal', gate: 'checks' },
  { id: 'approval', label: 'Freigabe', gate: 'human' },
  { id: 'publish', label: 'Veröffentlichung', gate: 'human' },
  { id: 'review_after', label: 'Auswertung', gate: 'none' },
];

// Eingebaute Kanäle. Schnittstellen-Hinweise sind Stand der Einordnung und vor Anbindung zu prüfen.
const BUILTIN = [
  { id: 'youtube', label: 'YouTube', kind: 'video', publish: 'private-first', api: 'YouTube Data API v3 (OAuth)', extra_rules: ['KI-Kennzeichnung bei synthetischen Inhalten'] },
  { id: 'wordpress', label: 'WordPress', kind: 'blog', publish: 'draft-first', api: 'WordPress REST API (Anwendungspasswort)', extra_rules: ['Affiliate-Links mit rel="sponsored nofollow"'] },
  { id: 'medium', label: 'Medium', kind: 'blog', publish: 'draft-only', api: 'Schnittstellenstatus vorher prüfen. Bis dahin nur Entwurf zum Kopieren', extra_rules: [] },
  { id: 'newsletter', label: 'Newsletter', kind: 'mail', publish: 'human-only', api: 'je Anbieter (z. B. Double-Opt-in-Liste)', extra_rules: ['Abmeldelink Pflicht'] },
  { id: 'finance-news', label: 'Börsen-News', kind: 'news', publish: 'human-review', api: 'öffentliche RSS-Feeds', extra_rules: ['Keine Anlageberatung', 'Quelle je Meldung', 'Disclaimer Pflicht', 'Kein automatischer Handel'], needs_disclaimer: true },
  { id: 'distro-distrokid', label: 'DistroKid (Musik)', kind: 'distribution', publish: 'human-only', api: 'kein offizieller Upload-Weg per API bekannt. Manuell', extra_rules: ['Nur eigene Rechte'] },
  { id: 'distro-tunecore', label: 'TuneCore (Musik)', kind: 'distribution', publish: 'human-only', api: 'kein offizieller Upload-Weg per API bekannt. Manuell', extra_rules: ['Nur eigene Rechte'] },
  { id: 'distro-cdbaby', label: 'CD Baby (Musik)', kind: 'distribution', publish: 'human-only', api: 'kein offizieller Upload-Weg per API bekannt. Manuell', extra_rules: ['Nur eigene Rechte'] },
  { id: 'distro-ditto', label: 'Ditto (Musik)', kind: 'distribution', publish: 'human-only', api: 'kein offizieller Upload-Weg per API bekannt. Manuell', extra_rules: ['Nur eigene Rechte'] },
];

function loadExtra() {
  try {
    const d = JSON.parse(fs.readFileSync(EXTRA_FILE, 'utf8'));
    return Array.isArray(d.channels) ? d.channels : [];
  } catch { return []; }
}

function validateChannel(c) {
  const err = [];
  if (!c || typeof c !== 'object') return ['kein Objekt'];
  if (!ID_RE.test(String(c.id || ''))) err.push('id: Kleinbuchstaben, Ziffern, Bindestrich');
  if (!String(c.label || '').trim() || String(c.label).length > 80) err.push('label: 1–80 Zeichen');
  if (!PUBLISH_MODES.includes(c.publish)) err.push('publish: ' + PUBLISH_MODES.join(' | '));
  if (c.url) { try { if (new URL(c.url).protocol !== 'https:') err.push('url: nur https'); } catch { err.push('url: ungültig'); } }
  if (c.needs_disclaimer && !/finance|news|boerse|börse/i.test(c.id + ' ' + c.kind)) err.push('needs_disclaimer nur für Finanz- oder News-Kanäle');
  return err;
}

function channels() {
  const map = new Map();
  for (const c of BUILTIN) map.set(c.id, { ...c, source: 'builtin' });
  for (const c of loadExtra()) {
    const e = validateChannel(c);
    if (!e.length) map.set(c.id, { ...c, extra_rules: c.extra_rules || [], source: 'manuell' });
  }
  return [...map.values()];
}

// Plan über ausgewählte Kanäle. Nur Auflistung, kein Versand.
function plan({ channel_ids = [], topic = '' } = {}) {
  const all = channels();
  const picked = all.filter((c) => channel_ids.length === 0 || channel_ids.includes(c.id));
  return {
    topic: String(topic).slice(0, 120),
    channels: picked.map((c) => ({
      id: c.id, label: c.label, kind: c.kind, publish: c.publish, api: c.api, source: c.source,
      stages: COMMON_STAGES.map((s, i) => ({ ...s, step: i + 1, status: i === 0 ? 'bereit' : 'offen' })),
      rules: [...yt.RULES.map((r) => r.desc), ...(c.extra_rules || [])],
    })),
    note: 'Trockenlauf. Nichts wird gesendet. Veröffentlichung braucht immer einen Menschen.',
  };
}

// Prüft einen Entwurf für einen Kanal. meta: {title, body, tags, synthetic, ai_disclosure}
function checkDraft(channelId, meta = {}) {
  const c = channels().find((x) => x.id === channelId);
  if (!c) return { ok: false, issues: [{ rule: 'channel', msg: 'Kanal unbekannt: ' + channelId }] };
  const issues = [];
  const title = String(meta.title || '');
  if (!title.trim()) issues.push({ rule: 'title', msg: 'Titel fehlt' });
  const text = [title, meta.body || '', (meta.tags || []).join(' ')].join(' ');
  issues.push(...yt.textIssues(text));
  if (meta.synthetic && !meta.ai_disclosure) issues.push({ rule: 'ai-disclosure', msg: 'Synthetischer Inhalt ohne KI-Kennzeichnung' });
  if (c.needs_disclaimer && !/keine anlageberatung/i.test(String(meta.body || ''))) {
    issues.push({ rule: 'disclaimer', msg: 'Finanz-Inhalt ohne Hinweis „Keine Anlageberatung“' });
  }
  if (c.kind === 'video' && title.length > 100) issues.push({ rule: 'title-len', msg: 'Videotitel über 100 Zeichen' });
  return { ok: issues.length === 0, channel: c.id, publish: c.publish, issues };
}

// Freigabe: nur Mensch. Liefert, ob der nächste Schritt erlaubt ist.
function publishAllowed(channelId, { approvedBy = '' } = {}) {
  const c = channels().find((x) => x.id === channelId);
  if (!c) return { ok: false, reason: 'Kanal unbekannt' };
  if (!approvedBy || AGENT_RE.test(approvedBy)) return { ok: false, reason: 'Freigabe durch einen Menschen fehlt' };
  const mode = c.publish;
  return { ok: true, mode, note: mode === 'draft-only' ? 'Nur Entwurf. Veröffentlichung manuell.' : mode === 'private-first' ? 'Zuerst privat.' : mode === 'draft-first' ? 'Zuerst als Entwurf.' : 'Mit Freigabe.' };
}

module.exports = {
  BUILTIN, COMMON_STAGES, PUBLISH_MODES, channels, validateChannel, plan, checkDraft, publishAllowed, EXTRA_FILE,
  meta: { area: 'CRW', id: 'channel_pipelines', name: 'Multi-Kanal-Pipeline (Video, Blog, News, Distributoren; nur Entwurf und Freigabe)', state: 'live' },
};
