'use strict';
// AURA · Medien-Import: von jeder Medienseite schnell etwas Eigenes machen.
//
// Ehrlich in zwei Teilen:
//  1. ERKENNEN und ÜBERNEHMEN von Metadaten: Plattform wird am Link erkannt, offene Schnittstellen
//     (oEmbed / RSS / Open Graph) werden gelesen, wenn das Netz es zulässt. Daraus entsteht ein
//     Import-Eintrag mit Titel, Urheber, Link und Vorschaubild-Adresse.
//  2. UMGANG mit fremdem Material: AURA lädt keine fremden Videos/Musik herunter und umgeht keine
//     Sperren. Es gibt genau drei erlaubte Wege:
//       • EMBED  — fremde Seite einbetten (erlaubt, wo die Plattform es anbietet)
//       • LINK   — verlinken und bewerben
//       • EIGEN  — eigenes Material verwenden (aus Songbook/Video-Abteilung)
//     Für alles andere steht „braucht Rechteklärung" — und das bleibt stehen, bis ein Mensch es klärt.
//
// Der Import wandelt einen Link in einen ENTWURF um: Titel, Beschreibung, Hashtags, Format-Vorschlag,
// Zuordnung zu Artist/Kanal. Veröffentlicht wird nichts automatisch (REGEL 1).
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_MEDIA_IMPORT_FILE || path.join(__dirname, '..', 'data', 'media_import.json');

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', match: /(youtube\.com|youtu\.be)/i, oembed: 'https://www.youtube.com/oembed?format=json&url=', rights: 'EMBED erlaubt (offizieller Player), Download NICHT erlaubt', asset: 'siehe YouTube-Nutzungsbedingungen; eigene Videos über die API' },
  { id: 'spotify', name: 'Spotify', match: /open\.spotify\.com/i, oembed: 'https://open.spotify.com/oembed?url=', rights: 'EMBED erlaubt, kein Download', asset: 'nur Metadaten + Einbettung' },
  { id: 'soundcloud', name: 'SoundCloud', match: /soundcloud\.com/i, oembed: 'https://soundcloud.com/oembed?format=json&url=', rights: 'EMBED erlaubt, Download nur wenn der Urheber es freigibt', asset: 'eigene Uploads via API mit Schlüssel' },
  { id: 'vimeo', name: 'Vimeo', match: /vimeo\.com/i, oembed: 'https://vimeo.com/api/oembed.json?url=', rights: 'EMBED erlaubt', asset: 'eigene Uploads via API mit Schlüssel' },
  { id: 'tiktok', name: 'TikTok', match: /tiktok\.com/i, oembed: 'https://www.tiktok.com/oembed?url=', rights: 'EMBED, kein Download', asset: 'eigene Uploads nur über die offizielle Schnittstelle' },
  { id: 'instagram', name: 'Instagram (Meta)', match: /instagram\.com/i, oembed: 'https://graph.facebook.com/v20.0/instagram_oembed?url=', rights: 'EMBED über Meta-Schnittstelle (Schlüssel nötig)', asset: 'eigene Beiträge über Meta-Schnittstelle mit Schlüssel' },
  { id: 'x', name: 'X', match: /(twitter\.com|x\.com)/i, oembed: null, rights: 'Einbettung nach Plattformbedingungen', asset: 'eigene Posts über Schnittstelle mit Schlüssel' },
  { id: 'facebook', name: 'Facebook (Meta)', match: /facebook\.com/i, oembed: 'https://graph.facebook.com/v20.0/oembed_video?url=', rights: 'EMBED über Meta-Schnittstelle', asset: 'eigene Inhalte über Meta-Schnittstelle' },
  { id: 'bandcamp', name: 'Bandcamp', match: /bandcamp\.com/i, oembed: null, rights: 'EMBED des Players, kein Download', asset: 'eigene Verkäufe/Seiten laut Bandcamp-Bedingungen' },
  { id: 'twitch', name: 'Twitch', match: /twitch\.tv/i, oembed: 'https://api.twitch.tv/v5/oembed?url=', rights: 'EMBED erlaubt', asset: 'eigene Streams über Twitch-Schnittstelle mit Schlüssel' },
  { id: 'podcast-rss', name: 'Podcast (RSS)', match: /\.(xml|rss)$/i, oembed: null, rights: 'RSS lesen und verlinken; Folgen nicht weiterverbreiten', asset: 'eigene Folgen über eigenen Feed' },
  { id: 'wikipedia', name: 'Wikipedia/Wikimedia', match: /wikipedia\.org|wikimedia\.org/i, oembed: null, rights: 'Texte CC-BY-SA, Bilder je Datei', asset: 'Nachnutzung mit Namensnennung und Share-alike' },
  { id: 'generisch', name: 'Unbekannte Seite', match: /.*/, oembed: null, rights: 'unbekannt — Rechteklärung nötig', asset: 'nichts automatisch' },
];

const MODES = ['EMBED', 'LINK', 'EIGEN', 'RECHTE_UNKLAR'];

function defaults() { return { imports: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['imports', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const detect = (link) => PLATFORMS.find((p) => p.id !== 'generisch' && p.match.test(String(link || ''))) || PLATFORMS[PLATFORMS.length - 1];

// oEmbed lesen — wenn das Netz es hergibt. Ohne Netz bleibt es beim erkannten Link (kein Fehler).
async function oembed(platform, link, timeoutMs) {
  if (!platform.oembed) return { ok: false, reason: 'Diese Plattform hat keine offene oEmbed-Schnittstelle.' };
  const url = platform.oembed + encodeURIComponent(link);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(timeoutMs) || 6000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'AURA-Media-Import/1.0 (eigene Kanäle, kein Scraping)' } });
    clearTimeout(timer);
    if (!r.ok) return { ok: false, reason: `Schnittstelle antwortete ${r.status}` };
    const j = await r.json();
    return { ok: true, title: j.title || null, author: j.author_name || null, thumb: j.thumbnail_url || null, provider: j.provider_name || platform.name };
  } catch (e) { return { ok: false, reason: 'Netz nicht erreichbar oder abgelehnt: ' + (e.message || 'Fehler') }; }
}

function draft(input) {
  const link = String((input && input.link) || '').trim();
  if (!/^https?:\/\//i.test(link)) return { ok: false, error: 'Gültiger Link (http/https) nötig' };
  const platform = detect(link);
  const own = input && input.own === true;
  const mode = own ? 'EIGEN' : (platform.id === 'generisch' ? 'RECHTE_UNKLAR' : 'EMBED');
  const title = String((input && input.title) || '').trim();
  const tags = Array.isArray(input && input.tags) ? input.tags.slice(0, 12) : [];
  const entry = {
    id: 'mi-' + Math.random().toString(16).slice(2, 10),
    link, platform: platform.id, platform_name: platform.name,
    mode, rights: platform.rights, asset_note: platform.asset,
    title: title || null, artist: String((input && input.artist) || ''), kind: String((input && input.kind) || 'BEITRAG').toUpperCase(),
    target: String((input && input.target) || 'eigener Kanal'),
    draft: {
      headline: title || `Übernahme von ${platform.name}`,
      caption: String((input && input.caption) || '').slice(0, 1500),
      hashtags: tags.length ? tags : ['#aura'],
      format_hint: platform.id === 'youtube' ? 'Querformat 16:9 oder Short 9:16' : 'Hochformat 9:16',
      call_to_action: 'Auf den eigenen Kanal lenken — kein Kauf von Reichweite.',
    },
    state: mode === 'RECHTE_UNKLAR' ? 'BRAUCHT_RECHTE KLAERUNG' : 'ENTWURF',
    needs: mode === 'RECHTE_UNKLAR' ? 'Rechte klären, bevor irgendetwas veröffentlicht wird.' : 'Menschliche Freigabe vor Veröffentlichung.',
    created_at: new Date().toISOString(),
  };
  const data = load();
  data.imports.unshift(entry); data.imports = data.imports.slice(0, 200);
  data.audit.unshift({ at: entry.created_at, action: 'draft', id: entry.id, platform: platform.id, mode });
  data.audit = data.audit.slice(0, 300);
  save(data);
  return { ok: true, import: entry, rules: ['Kein Download fremder Medien.', 'Kein Umgehen von Sperren oder Bezahlschranken.', 'Veröffentlichen nur nach menschlicher Freigabe.'], platform_info: { id: platform.id, rights: platform.rights, oembed: !!platform.oembed } };
}

async function preview(input) {
  const link = String((input && input.link) || '').trim();
  if (!/^https?:\/\//i.test(link)) return { ok: false, error: 'Gültiger Link nötig' };
  const platform = detect(link);
  const meta = await oembed(platform, link, input && input.timeout_ms);
  return {
    ok: true, link, platform: platform.id, platform_name: platform.name,
    metadata: meta, rights: platform.rights, asset_note: platform.asset,
    allowed_uses: ['EMBED', 'LINK', 'EIGEN'],
    not_allowed: ['Herunterladen', 'Weiterverbreiten fremder Inhalte', 'Sperren umgehen'],
    next: 'Übernahme als Entwurf: POST /api/media/draft',
  };
}

function list(filter) {
  const items = load().imports.filter((i) => (!filter || !filter.platform || i.platform === filter.platform) && (!filter || !filter.state || i.state === filter.state));
  return { ok: true, count: items.length, items: items.map((i) => ({ id: i.id, title: i.headline || i.draft.headline, platform: i.platform, mode: i.mode, state: i.state, link: i.link })) };
}

function status() {
  return {
    area: 'MIMP', module: 'media_import', state: 'live', file: FILE,
    platforms: PLATFORMS.length, modes: MODES,
    detected: PLATFORMS.filter((p) => p.id !== 'generisch').map((p) => ({ id: p.id, oembed: !!p.oembed, rights: p.rights })),
    rules: ['AURA lädt keine fremden Medien herunter und umgeht keine Sperren.', 'Erlaubt sind Einbetten, Verlinken und eigenes Material.', 'Unklare Rechte bleiben sichtbar als RECHTE_UNKLAR stehen — kein stilles Übernehmen.'],
  };
}

module.exports = {
  meta: { area: 'MIMP', id: 'media_import', name: 'Medien-Import (Link erkennen, Entwurf machen, Rechte benennen)', state: 'live' },
  actions: { status: () => status(), platforms: () => ({ ok: true, platforms: PLATFORMS.map(({ match, ...p }) => p) }), preview: (p) => preview(p || {}), draft: (p) => draft(p || {}), list: (p) => list(p || {}) },
  PLATFORMS, MODES, detect, preview, draft, list, status,
};
