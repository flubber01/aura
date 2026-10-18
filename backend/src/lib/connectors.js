'use strict';
// AURA · Connectoren: Anbindung eigener Kanäle und Vertragspartner über deren OFFIZIELLE APIs.
//
// Beantwortet die Frage „welche API-Schlüssel kann ich auf den legalen Seiten holen und wie kommen sie rein?".
//
// Grundsätze (in Code erzwungen, nicht nur dokumentiert):
//  1. Schlüssel liegen AUSSCHLIESSLICH im verschlüsselten Vault (AES-256-GCM, lib/vault.js).
//     Sie werden nie zurückgegeben, nie geloggt und erscheinen in keiner Ausgabe — nur maskiert.
//  2. NUR eigene Kanäle und autorisierte Vertragspartner. Kein Zugriff auf fremde Konten.
//  3. Dienste, die Follower/Likes/Views/Klicks/Kommentare/Watchtime VERKAUFEN, werden nicht angebunden.
//     assessProvider() lehnt sie ab — das ist dieselbe Linie wie in der Web-Empire-Spezifikation.
//  4. Veröffentlichen ist Freigabe-pflichtig (REGEL 1): AURA bereitet vor, ein Mensch gibt frei.
//  5. Status ist ehrlich: NOT-CONNECTED / PARTIAL / CONNECTED (Schlüssel liegt) / VERIFIED (echter Test ok).
//     „CONNECTED" heißt ausdrücklich NICHT „getestet" — dafür gibt es test().
//
// Speicher: nur die Zuordnung Provider→Vault-Schlüsselnamen in backend/src/data/connectors.json (git-ignoriert).
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_CONNECTORS_FILE || path.join(__dirname, '..', 'data', 'connectors.json');

// ---------------------------------------------------------------- Provider-Katalog
// keys[].vault = Name des Secrets im Vault. scope = wofür der Schlüssel benutzt wird.
const CATALOG = [
  // ---- Veröffentlichung eigener Musik (Distro/Artists-Portale, offizielle APIs)
  { id: 'spotify', name: 'Spotify for Artists', category: 'DISTRO', purpose: 'eigene Releases, Hörerzahlen, Playlist-Pitches',
    keys: [{ vault: 'spotify-client-id', label: 'Client ID', required: true }, { vault: 'spotify-client-secret', label: 'Client Secret', required: true }],
    scopes: ['user-read-private', 'user-top-read'], own_channels_only: true },
  { id: 'apple-music', name: 'Apple Music for Artists', category: 'DISTRO', purpose: 'eigene Releases, Charts-Daten',
    keys: [{ vault: 'apple-music-key', label: 'MusicKit Token', required: true }], scopes: [], own_channels_only: true },
  { id: 'deezer', name: 'Deezer for Creators', category: 'DISTRO', purpose: 'eigene Releases',
    keys: [{ vault: 'deezer-app-id', label: 'App ID', required: true }, { vault: 'deezer-app-secret', label: 'App Secret', required: true }], scopes: ['basic_access'], own_channels_only: true },
  { id: 'tidal', name: 'TIDAL Artist', category: 'DISTRO', purpose: 'eigene Releases',
    keys: [{ vault: 'tidal-client-id', label: 'Client ID', required: true }, { vault: 'tidal-client-secret', label: 'Client Secret', required: true }], scopes: [], own_channels_only: true },
  { id: 'soundcloud', name: 'SoundCloud', category: 'DISTRO', purpose: 'eigene Uploads, Statistiken',
    keys: [{ vault: 'soundcloud-client-id', label: 'Client ID', required: true }, { vault: 'soundcloud-client-secret', label: 'Client Secret', required: true }], scopes: ['non-expiring'], own_channels_only: true },

  // ---- Eigene Social-Kanäle (offizielle APIs, eigener Account)
  { id: 'youtube', name: 'YouTube Data API', category: 'SOCIAL', purpose: 'eigene Videos verwalten, Analytics',
    keys: [{ vault: 'youtube-api-key', label: 'API Key', required: true }, { vault: 'youtube-oauth-refresh', label: 'OAuth Refresh Token', required: false }],
    scopes: ['youtube.readonly', 'youtube.upload'], own_channels_only: true },
  { id: 'meta', name: 'Meta Graph API (Facebook + Instagram)', category: 'SOCIAL', purpose: 'eigene Seiten/Profile posten und messen',
    keys: [{ vault: 'meta-app-id', label: 'App ID', required: true }, { vault: 'meta-app-secret', label: 'App Secret', required: true }, { vault: 'meta-page-token', label: 'Page Access Token', required: true }],
    scopes: ['pages_manage_posts', 'instagram_content_publish', 'read_insights'], own_channels_only: true },
  { id: 'tiktok', name: 'TikTok Content API', category: 'SOCIAL', purpose: 'eigene Videos posten und messen',
    keys: [{ vault: 'tiktok-client-key', label: 'Client Key', required: true }, { vault: 'tiktok-client-secret', label: 'Client Secret', required: true }],
    scopes: ['video.publish', 'video.list'], own_channels_only: true },
  { id: 'x', name: 'X API', category: 'SOCIAL', purpose: 'eigener Account',
    keys: [{ vault: 'x-api-key', label: 'API Key', required: true }, { vault: 'x-api-secret', label: 'API Secret', required: true }],
    scopes: ['tweet.read', 'tweet.write', 'users.read'], own_channels_only: true },
  { id: 'linkedin', name: 'LinkedIn API', category: 'SOCIAL', purpose: 'eigene Unternehmensseite',
    keys: [{ vault: 'linkedin-client-id', label: 'Client ID', required: true }, { vault: 'linkedin-client-secret', label: 'Client Secret', required: true }],
    scopes: ['w_organization_social'], own_channels_only: true },
  { id: 'telegram', name: 'Telegram Bot API', category: 'SOCIAL', purpose: 'eigener Kanal + Steuerung',
    keys: [{ vault: 'telegram-bot-token', label: 'Bot Token', required: true }, { vault: 'telegram-chat-id', label: 'Chat ID', required: false }],
    scopes: [], own_channels_only: true },

  // ---- Werbung (nur eigene Kampagnen, Budget-Deckel in Code)
  { id: 'adsense', name: 'Google AdSense', category: 'ADS', purpose: 'eigene Seiten monetarisieren (ads.txt, Consent)',
    keys: [{ vault: 'adsense-publisher-id', label: 'Publisher ID', required: true }], scopes: [], own_channels_only: true },
  { id: 'google-ads', name: 'Google Ads', category: 'ADS', purpose: 'eigene Kampagnen',
    keys: [{ vault: 'google-ads-developer-token', label: 'Developer Token', required: true }, { vault: 'google-ads-customer-id', label: 'Customer ID', required: true }], scopes: [], own_channels_only: true },
  { id: 'meta-ads', name: 'Meta Ads', category: 'ADS', purpose: 'eigene Kampagnen',
    keys: [{ vault: 'meta-ads-account-id', label: 'Ad Account ID', required: true }, { vault: 'meta-app-secret', label: 'App Secret', required: true }], scopes: ['ads_management'], own_channels_only: true },

  // ---- Affiliate/Vertragspartner mit OFFIZIELLER API oder Postback
  { id: 'awin', name: 'Awin', category: 'AFFILIATE', purpose: 'Partner-Programme, bestätigte Conversions per API',
    keys: [{ vault: 'awin-api-token', label: 'API Token', required: true }, { vault: 'awin-publisher-id', label: 'Publisher ID', required: true }], scopes: [], own_channels_only: true },
  { id: 'digistore24', name: 'Digistore24', category: 'AFFILIATE', purpose: 'Partner-Programme + Postback',
    keys: [{ vault: 'digistore24-api-key', label: 'API Key', required: true }], scopes: [], own_channels_only: true },
  { id: 'amazon-partner', name: 'Amazon PartnersNet', category: 'AFFILIATE', purpose: 'Partner-Links + Berichte',
    keys: [{ vault: 'amazon-partner-tag', label: 'Partner-Tag', required: true }, { vault: 'amazon-access-key', label: 'Access Key', required: true }, { vault: 'amazon-secret-key', label: 'Secret Key', required: true }], scopes: [], own_channels_only: true },
  { id: 'partner-postback', name: 'Generischer Partner-Postback', category: 'AFFILIATE', purpose: 'bestätigte Conversions rechtmäßig melden',
    keys: [{ vault: 'postback-shared-secret', label: 'Shared Secret (Signaturprüfung)', required: true }], scopes: [], own_channels_only: true },

  // ---- Eigene Seiten / Messung
  { id: 'wordpress', name: 'WordPress REST (eigene Seiten)', category: 'SITE', purpose: 'eigene Seiten befüllen',
    keys: [{ vault: 'wordpress-app-password', label: 'Application Password', required: true }, { vault: 'wordpress-site-url', label: 'Site-URL', required: true }], scopes: [], own_channels_only: true },
  { id: 'ga4', name: 'Google Analytics 4', category: 'SITE', purpose: 'eigene Messwerte',
    keys: [{ vault: 'ga4-property-id', label: 'Property ID', required: true }, { vault: 'ga4-service-json', label: 'Service-Account JSON', required: true }], scopes: [], own_channels_only: true },
  { id: 'matomo', name: 'Matomo (selbst gehostet)', category: 'SITE', purpose: 'eigene Messwerte, DSGVO-freundlich',
    keys: [{ vault: 'matomo-url', label: 'Matomo URL', required: true }, { vault: 'matomo-token', label: 'API Token', required: true }], scopes: [], own_channels_only: true },

  // ---- Modelle/Infrastruktur mit eigenem Schlüssel
  { id: 'openrouter', name: 'OpenRouter', category: 'AI', purpose: 'Cloud-Modelle (Budget-Deckel im Code)',
    keys: [{ vault: 'openrouter-api-key', label: 'API Key', required: true }], scopes: [], own_channels_only: true },
];

// Dienste, die Engagement VERKAUFEN — werden grundsätzlich nicht angebunden (siehe Web-Empire-Spezifikation).
// (a) Konkrete Dienste aus der Rechercheliste, die Engagement verkaufen. Sie sind dauerhaft gesperrt.
const VERBOTENE_ANBIETER = [
  'followerfabrik', 'likesandmore', 'echtestreamskaufen', 'followercenter', 'followerpuls',
  'socialfanclick', 'edenboost', 'getfans', 'socialboss', 'useviral', 'stormlikes', 'sidesmedia',
];
// (b) Muster, die auf Engagement-Verkauf hindeuten.
const VERBOTEN = ['follower', 'likes', 'views kaufen', 'viewskauf', 'streamskauf', 'streams kaufen', 'subscriber',
  'watchtime', 'klicks kaufen', 'clickbot', 'smmpanel', 'smm-panel', 'smm panel', 'boost-service',
  'growthservice', 'traffic-kauf', 'engagement kaufen', 'abos kaufen', 'abonnenten'];

// ---------------------------------------------------------------- Speicher (selbstheilend)
function defaults() { return { links: {}, audit: [], publish_requests: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const fresh = defaults(); save(fresh); return fresh; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['links', 'publish_requests']) if (!raw[k] || typeof raw[k] !== 'object') raw[k] = {};
    if (!Array.isArray(raw.audit)) raw.audit = [];
    return raw;
  } catch {
    // AURA_SEED_WRITE
    const fresh = defaults();
    try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* egal */ }
    return fresh;
  }
}
function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}
const nowIso = () => new Date().toISOString();
function audit(state, action, provider, detail) {
  state.audit.unshift({ at: nowIso(), action, provider: String(provider || ''), detail: String(detail || '').slice(0, 200) });
  if (state.audit.length > 500) state.audit.length = 500;
}
const by = (v) => String(v || '').slice(0, 60);

// ---------------------------------------------------------------- Vault-Zugriff (nur Namen, nie Werte in Ausgaben)
function vaultHas(name) {
  try {
    const v = require('./vault');
    const st = v.listSecrets();
    if (st.locked) return { locked: true, has: false, reason: st.reason };
    return { locked: false, has: st.entries.some((e) => e.name === String(name).toLowerCase()) };
  } catch { return { locked: false, has: false, reason: 'Vault nicht lesbar' }; }
}

function providerStatus(p) {
  const missing = [], present = [];
  for (const k of p.keys) {
    const s = vaultHas(k.vault);
    if (s.locked) return { id: p.id, status: 'LOCKED', verified: false, missing: p.keys.map((x) => x.vault), note: s.reason };
    if (s.has) present.push(k.vault); else if (k.required) missing.push(k.vault);
  }
  const required = p.keys.filter((k) => k.required).length;
  let status = 'NOT-CONNECTED';
  if (missing.length === 0 && present.length >= required) status = present.length < p.keys.length ? 'PARTIAL' : 'CONNECTED';
  const state = load();
  const link = state.links[p.id] || {};
  return {
    id: p.id, name: p.name, category: p.category, purpose: p.purpose,
    status, verified: !!link.verified, connected_at: link.connected_at || null,
    keys_present: present, keys_missing: missing, keys_optional_missing: p.keys.filter((k) => !k.required && !present.includes(k.vault)).map((k) => k.vault),
    own_channels_only: p.own_channels_only,
    note: status === 'CONNECTED' || status === 'PARTIAL'
      ? 'Schlüssel hinterlegt. „CONNECTED" heißt NICHT „getestet" — dafür test() aufrufen.'
      : 'Schlüssel fehlen. Über den Anbieter (Entwicklerportal) holen und mit connect() in den Vault legen.',
  };
}

function list(category) {
  const items = CATALOG.filter((p) => !category || p.category === String(category).toUpperCase()).map(providerStatus);
  const locked = items.filter((i) => i.status === 'LOCKED').length;
  return {
    ok: true, area: 'CONNECTORS', mode: 'LIVE',
    note: 'Nur eigene Kanäle und autorisierte Vertragspartner über deren offizielle APIs. Schlüssel liegen ausschließlich verschlüsselt im Vault.',
    vault_state: locked
      ? { state: 'LOCKED', how_to_fix: 'AURA_VAULT_KEY in deploy/.env setzen (lang und zufällig, NIE ins Repo). Danach können Schlüssel verschlüsselt abgelegt werden.' }
      : { state: 'READY' },
    counts: {
      total: items.length,
      connected: items.filter((i) => i.status === 'CONNECTED').length,
      partial: items.filter((i) => i.status === 'PARTIAL').length,
      not_connected: items.filter((i) => i.status === 'NOT-CONNECTED').length,
      locked,
      verified: items.filter((i) => i.verified).length,
    },
    categories: [...new Set(CATALOG.map((p) => p.category))],
    providers: items,
  };
}

// Lehnt Anbieter ab, die Engagement verkaufen (Follower/Likes/Views/Klicks/Watchtime).
function assessProvider(nameOrUrl) {
  const s = String(nameOrUrl || '').toLowerCase();
  const hit = VERBOTENE_ANBIETER.find((v) => s.includes(v)) || VERBOTEN.find((v) => s.includes(v));
  if (hit) {
    return {
      ok: false, code: 403, allowed: false, reason: 'Anbieter verkauft Engagement (Treffer: „' + hit + '")',
      detail: 'Solche Dienste werden nicht angebunden — weder als Traffic-Quelle, Automatisierung noch Affiliate-Workflow. Das ist dieselbe Linie wie in der Web-Empire-Spezifikation.',
    };
  }
  return { ok: true, allowed: true, note: 'Kein Engagement-Verkauf erkannt. Anbindung erfolgt weiterhin nur mit eigenen/zugesagten Schlüsseln des Anbieters.' };
}

// Schlüssel in den Vault legen. Nur ein Mensch. Werte werden nie zurückgegeben.
function connect(providerId, keys, who) {
  if (!require('./control_center').isHuman(who)) return { ok: false, code: 403, error: 'nur ein Mensch darf Zugangsdaten hinterlegen' };
  const p = CATALOG.find((x) => x.id === providerId);
  if (!p) return { ok: false, code: 404, error: 'unbekannter Anbieter: ' + providerId };
  const input = keys && typeof keys === 'object' ? keys : {};
  const vault = require('./vault');
  const written = [], rejected = [];
  for (const k of p.keys) {
    const value = input[k.vault] !== undefined ? input[k.vault] : input[k.label];
    if (value === undefined || value === null || value === '') continue;
    // Kurze Werte und Platzhalter werden nicht gespeichert (Tippfehler-Schutz).
    if (String(value).length < 8) { rejected.push({ key: k.vault, reason: 'zu kurz für einen echten Schlüssel' }); continue; }
    try {
      if (Array.isArray(value)) { rejected.push({ key: k.vault, reason: 'Objekte/Arrays bitte als JSON-String übergeben' }); continue; }
      vault.addSecret({ name: k.vault, value: String(value), scope: 'connector:' + p.id });
      written.push(k.vault);
    } catch (e) { rejected.push({ key: k.vault, reason: String(e.message || e) }); }
  }
  const state = load();
  state.links[p.id] = Object.assign(state.links[p.id] || {}, { connected_at: nowIso(), connected_by: by(who), verified: false });
  audit(state, 'connector.connect', p.id, written.length + ' Schlüssel gesetzt, ' + rejected.length + ' abgelehnt');
  save(state);
  const st = providerStatus(p);
  audit(state, 'connector.status', p.id, st.status);
  save(state);
  return {
    ok: true, provider: p.id, status: st.status, keys_written: written, keys_rejected: rejected,
    note: 'Werte liegen verschlüsselt im Vault und erscheinen in keiner Ausgabe. Status ist erst nach test() „verified".',
  };
}

function disconnect(providerId, who) {
  if (!require('./control_center').isHuman(who)) return { ok: false, code: 403, error: 'nur ein Mensch' };
  const p = CATALOG.find((x) => x.id === providerId);
  if (!p) return { ok: false, code: 404, error: 'unbekannter Anbieter' };
  const v = require('./vault');
  const removed = [];
  for (const k of p.keys) { try { v.removeSecret(k.vault); removed.push(k.vault); } catch { /* war nicht da */ } }
  const state = load();
  state.links[p.id] = { connected_at: null, disconnected_at: nowIso(), connected_by: by(who), verified: false };
  audit(state, 'connector.disconnect', p.id, removed.length + ' Schlüssel entfernt');
  save(state);
  return { ok: true, provider: p.id, keys_removed: removed };
}

// Echter Verbindungstest. Braucht Netz. Ohne Schlüssel gar nicht erst.
function test(providerId, who) {
  const p = CATALOG.find((x) => x.id === providerId);
  if (!p) return { ok: false, code: 404, error: 'unbekannter Anbieter' };
  const st = providerStatus(p);
  if (st.status === 'NOT-CONNECTED' || st.status === 'LOCKED') {
    return { ok: false, code: 409, provider: p.id, status: st.status, error: 'keine Schlüssel hinterlegt — erst connect()' };
  }
  // Ohne hinterlegten, freigegebenen Testweg wird KEIN Blindflug gemacht: ehrlich melden.
  const state = load();
  state.links[p.id] = Object.assign(state.links[p.id] || {}, { last_test_at: nowIso(), last_test_by: by(who) });
  audit(state, 'connector.test', p.id, 'Test angefordert');
  save(state);
  return {
    ok: false, code: 501, provider: p.id, status: 'UNVERIFIED',
    error: 'Verbindungstest noch nicht implementiert — kein Blindflug mit echten Schlüsseln',
    note: 'Der Provider-spezifische Testaufruf fehlt noch. Ehrlicher Zustand: Schlüssel liegen, Verbindung ungeprüft.',
  };
}

// Veröffentlichen ist Freigabe-pflichtig (REGEL 1). AURA bereitet vor, ein Mensch entscheidet.
function requestPublish(providerId, payload, who) {
  const p = CATALOG.find((x) => x.id === providerId);
  if (!p) return { ok: false, code: 404, error: 'unbekannter Anbieter' };
  const st = providerStatus(p);
  if (st.status === 'NOT-CONNECTED' || st.status === 'LOCKED') return { ok: false, code: 409, error: 'Anbieter nicht verbunden (' + st.status + ') — keine Veröffentlichung möglich' };
  const cc = require('./control_center');
  const g = cc.gate('growth_publish', { by: who, args: { provider: p.id, ...(payload || {}) } });
  if (!g.ok && g.code === 202) {
    const state = load();
    state.publish_requests[g.approval.id] = { provider: p.id, at: nowIso(), by: by(who), payload: payload || {}, status: 'pending' };
    audit(state, 'connector.publish_request', p.id, g.approval.id);
    save(state);
    return { ok: true, code: 202, status: 'pending_approval', approval: g.approval, provider: p.id, note: 'Erst nach menschlicher Freigabe darf veröffentlicht werden.' };
  }
  return g;
}

function status() {
  const state = load();
  const l = list();
  return {
    area: 'CONNECTORS', mode: 'LIVE',
    vault_state: l.vault_state,
    counts: l.counts,
    by_category: l.categories.map((c) => ({ category: c, providers: l.providers.filter((p) => p.category === c).map((p) => p.id) })),
    never_connected: VERBOTEN.length + ' Muster gesperrt (Engagement-Verkauf)',
    audit_tail: state.audit.slice(0, 20),
    note: 'Nur eigene Kanäle und autorisierte Partner über offizielle APIs. Veröffentlichen ist Freigabe-pflichtig.',
  };
}

module.exports = { CATALOG, VERBOTEN, VERBOTENE_ANBIETER, FILE, list, status, connect, disconnect, test, assessProvider, requestPublish, providerStatus, load };
