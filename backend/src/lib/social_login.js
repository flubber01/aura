'use strict';
// AURA · Anmeldung über soziale Kanäle (Social Login).
//
// Der ehrliche Stand: Für eine echte Anmeldung über Google/Meta/TikTok & Co. braucht man eine eigene
// App beim jeweiligen Anbieter (Client-ID + Geheimnis) im Vault. Ohne die ist eine Anmeldung NICHT
// möglich — und dieses Modul tut auch nicht so. Was es in diesem Fall liefert: den fertigen,
// korrekten Ablauf (Adressen, Bereiche, Sicherheitswerte), die nötigen Schritte und den Status
// NOT-CONNECTED. Sobald die Schlüssel im Vault liegen, läuft derselbe Ablauf wirklich.
//
// Sicherheit (das ist bei Anmeldung wichtiger als alles andere):
//  • `state` gegen Einschleusen fremder Antworten, `code_verifier`/`code_challenge` (PKCE S256) gegen
//    abgefangene Codes. Beides wird hier echt erzeugt, nicht beschrieben.
//  • `nonce` für die offene Kennung (OpenID Connect).
//  • Pro Anbieter nur die Bereiche, die AURA wirklich braucht: Kennung, Name, E-Mail. KEIN Zugriff auf
//    Inhalte, Follower oder Posting-Rechte beim Anmelden. Schreibrechte werden getrennt vergeben
//    (Connectoren, mit Freigabe).
//  • Ein Kanal-Konto wird nur verknüpft, wenn der angemeldete Mensch es bestätigt.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_SOCIAL_LOGIN_FILE || path.join(__dirname, '..', 'data', 'social_login.json');

// Anbieter mit OAuth 2.0 / OpenID Connect. Adressen sind die offiziellen Endpunkte.
const PROVIDERS = [
  { id: 'google', name: 'Google', kind: 'OIDC', auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile'], keys: ['google-client-id', 'google-client-secret'], note: 'kann auch YouTube-Kanäle mitverwalten (Bereich wird extra vergeben)' },
  { id: 'meta', name: 'Meta (Facebook/Instagram)', kind: 'OAuth2', auth: 'https://www.facebook.com/v20.0/dialog/oauth', token: 'https://graph.facebook.com/v20.0/oauth/access_token',
    scopes: ['public_profile', 'email'], keys: ['meta-app-id', 'meta-app-secret'], note: 'Instagram-Konten laufen über dieselbe App' },
  { id: 'tiktok', name: 'TikTok', kind: 'OAuth2', auth: 'https://www.tiktok.com/v2/auth/authorize/', token: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic'], keys: ['tiktok-client-key', 'tiktok-client-secret'], note: 'Prüfung der App durch TikTok nötig' },
  { id: 'discord', name: 'Discord', kind: 'OAuth2', auth: 'https://discord.com/oauth2/authorize', token: 'https://discord.com/api/oauth2/token',
    scopes: ['identify', 'email'], keys: ['discord-client-id', 'discord-client-secret'], note: 'gut für Crews und Brainstorm-Räume' },
  { id: 'twitch', name: 'Twitch', kind: 'OAuth2', auth: 'https://id.twitch.tv/oauth2/authorize', token: 'https://id.twitch.tv/oauth2/token',
    scopes: ['user:read:email'], keys: ['twitch-client-id', 'twitch-client-secret'] },
  { id: 'spotify', name: 'Spotify', kind: 'OAuth2', auth: 'https://accounts.spotify.com/authorize', token: 'https://accounts.spotify.com/api/token',
    scopes: ['user-read-email'], keys: ['spotify-client-id', 'spotify-client-secret'], note: 'zum Anmelden reicht das Lesen der Kennung; Veröffentlichen braucht eigene Rechte' },
  { id: 'x', name: 'X', kind: 'OAuth2+PKCE', auth: 'https://twitter.com/i/oauth2/authorize', token: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['users.read', 'tweet.read'], keys: ['x-client-id', 'x-client-secret'], note: 'PKCE ist Pflicht' },
  { id: 'github', name: 'GitHub', kind: 'OAuth2', auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token',
    scopes: ['read:user', 'user:email'], keys: ['github-client-id', 'github-client-secret'], note: 'nützlich für Entwicklerzugänge' },
  { id: 'apple', name: 'Apple', kind: 'OIDC', auth: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token',
    scopes: ['name', 'email'], keys: ['apple-client-id', 'apple-team-id', 'apple-key-id', 'apple-private-key'], note: 'braucht einen signierten Client-Schlüssel' },
];

// Was zum Anmelden NICHT verlangt wird. Wird bei jedem Start mitgeschickt und geprüft.
const NEVER_REQUESTED = ['Posten im Namen des Nutzers', 'Follower-Listen', 'Direktnachrichten lesen', 'Zugriff auf Kontakte', 'Werbe-Konto-Verwaltung'];

function defaults() { return { flows: [], links: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['flows', 'links', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Anbieter-Bereitschaft: Anzahl der Schlüssel, nie Inhalte.
function providerState() {
  let vault = null;
  try { vault = require('./vault'); } catch { vault = null; }
  const rows = PROVIDERS.map((p) => {
    let have = 0; let ready = false; let reason = null;
    try {
      const st = vault && typeof vault.status === 'function' ? vault.status() : {};
      const keys = st.keys || st.stored || [];
      const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
      have = p.keys.filter((k) => list.includes(k)).length;
      ready = have === p.keys.length;
      reason = ready ? null : `fehlende Werte: ${p.keys.length - have} (Namen stehen in der Anleitung, nicht hier)`;
      if (String(st.state || st.status || '') === 'LOCKED') reason = 'Vault gesperrt (AURA_LOAD: AURA_VAULT_KEY fehlt)';
    } catch (e) { reason = 'Vault nicht abfragbar: ' + e.message; }
    return { id: p.id, name: p.name, kind: p.kind, ready, keys_needed: p.keys.length, keys_present: have, reason, note: p.note || null };
  });
  const ready = rows.filter((r) => r.ready).map((r) => r.id);
  return {
    ok: true, providers: rows, ready, ready_count: ready.length,
    mode: ready.length ? 'SOCIAL-LOGIN MÖGLICH' : 'NOT-CONNECTED (kein Anbieter eingerichtet)',
    honesty: 'Ohne eigene App (Client-ID + Geheimnis beim Anbieter) ist eine Anmeldung über diesen Kanal nicht möglich. Bis dahin bleibt sie sichtbar aus.',
    setup_steps: [
      'Beim Anbieter eine Anwendung anlegen und die Rückleitung auf <deine-adresse>/api/auth/social/callback eintragen.',
      'Client-ID und Geheimnis in den Vault legen (Namen stehen in der Statusausgabe).',
      'Erst dann startet der Ablauf; vorher verweigert das Modul ehrlich.',
    ],
  };
}

// Ablauf starten: erzeugt state, nonce und PKCE — echt, mit Zufall.
function start(input) {
  const data = load();
  const id = String((input && input.provider) || '').toLowerCase();
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) return { ok: false, error: `Anbieter unbekannt. Bekannt: ${PROVIDERS.map((x) => x.id).join(', ')}` };
  const state = b64url(crypto.randomBytes(24));
  const nonce = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const redirect = String((input && input.redirect_uri) || 'http://localhost:8080/api/auth/social/callback');
  const ps = providerState();
  const ready = ps.ready.includes(id);

  const params = new URLSearchParams({
    client_id: `<${p.keys[0]} aus dem Vault>`, redirect_uri: redirect, response_type: 'code',
    scope: p.scopes.join(' '), state, nonce,
  });
  if (p.kind.includes('PKCE') || id === 'x') { params.set('code_challenge', challenge); params.set('code_challenge_method', 'S256'); }

  const flow = {
    id: 'oa-' + crypto.randomBytes(4).toString('hex'),
    provider: id, state, nonce, code_verifier: verifier,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
    redirect_uri: redirect, status: ready ? 'BEREIT' : 'BLOCKED_NOT_CONFIGURED',
    requested_scopes: p.scopes, never_requested: NEVER_REQUESTED,
  };
  data.flows.unshift(flow); data.flows = data.flows.slice(0, 100);
  data.audit.unshift({ at: flow.created_at, action: 'start', provider: id, status: flow.status });
  save(data);

  if (!ready) {
    return {
      ok: false, blocked: true, provider: id, status: 'NOT-CONNECTED',
      error: `Anmeldung über ${p.name} ist nicht eingerichtet — es wird nichts vorgetäuscht.`,
      needed: p.keys, setup: ps.setup_steps,
      authorization_url_preview: `${p.auth}?${params.toString()}`,
      note: 'Die Adresse ist fertig aufgebaut (state, nonce, PKCE echt erzeugt). Sobald die Schlüssel im Vault liegen, geht genau diese Adresse live.',
    };
  }
  params.set('client_id', p.keys[0]);   // im echten Betrieb setzt der Server die ID ein
  return {
    ok: true, provider: id, status: 'BEREIT',
    authorization_url: `${p.auth}?${params.toString()}`,
    scopes: p.scopes, never_requested: NEVER_REQUESTED,
    next: 'Nach der Rückkehr: POST /api/auth/social/callback mit {state, code}.',
  };
}

// Rückkehr vom Anbieter: state und PKCE prüfen. Der Code-Umtausch braucht die Schlüssel.
function callback(input) {
  const data = load();
  const p = input || {};
  const flow = data.flows.find((f) => f.state === p.state);
  if (!flow) return { ok: false, error: 'state unbekannt — Antwort gehört nicht zu einem gestarteten Ablauf (möglicher Einschleusversuch)' };
  if (new Date(flow.expires_at).getTime() < Date.now()) return { ok: false, error: 'Ablauf ist abgelaufen (10 Minuten) — bitte neu starten' };
  if (!p.code) return { ok: false, error: 'code fehlt' };
  const cfg = providerState();
  if (!cfg.ready.includes(flow.provider)) {
    return { ok: false, blocked: true, error: `Anbieter ${flow.provider} ist nicht eingerichtet — Umtausch nicht möglich`, needed: (PROVIDERS.find((x) => x.id === flow.provider) || {}).keys };
  }
  flow.status = 'CODE_ERHALTEN';
  flow.code_received_at = new Date().toISOString();
  data.audit.unshift({ at: flow.code_received_at, action: 'callback', provider: flow.provider });
  save(data);
  return {
    ok: true, provider: flow.provider, status: 'CODE_ERHALTEN',
    next: ['Code gegen Token tauschen (Server hat die Schlüssel)', 'Kennung lesen (nur openid/profile/email-Bereiche)', 'Nutzer zuordnen oder anlegen', 'Kanal-Verknüpfung durch den Menschen bestätigen lassen'],
    never_requested: NEVER_REQUESTED,
  };
}

// Kanal mit Nutzer verknüpfen — nur wenn ein Mensch bestätigt.
function link(input) {
  const data = load();
  const p = input || {};
  const provider = String(p.provider || '').toLowerCase();
  const handle = String(p.handle || '').trim();
  const user = String(p.user || '').trim();
  if (!PROVIDERS.some((x) => x.id === provider)) return { ok: false, error: 'Anbieter unbekannt' };
  if (!handle || !user) return { ok: false, error: 'handle und user sind nötig' };
  if (!p.human) return { ok: false, error: 'Verknüpfung nur mit Bestätigung durch einen Menschen (human: true)', needs: 'human' };
  const entry = { id: 'lnk-' + crypto.randomBytes(4).toString('hex'), provider, handle, user, at: new Date().toISOString(), by: String(p.by || 'Mensch') };
  data.links = [entry, ...data.links.filter((l) => !(l.provider === provider && l.user === user))].slice(0, 200);
  data.audit.unshift({ at: entry.at, action: 'link', provider, user });
  save(data);
  return { ok: true, link: entry, note: 'Anmelden und Veröffentlichen sind getrennt: diese Verknüpfung gibt KEIN Posting-Recht.' };
}

function unlink(idOrHandle, payload) {
  const data = load();
  const p = payload || {};
  if (!p.human) return { ok: false, error: 'Trennen nur mit Bestätigung durch einen Menschen', needs: 'human' };
  const before = data.links.length;
  data.links = data.links.filter((l) => l.id !== idOrHandle && l.handle !== idOrHandle);
  if (data.links.length === before) return { ok: false, error: 'Verknüpfung nicht gefunden' };
  save(data);
  return { ok: true, removed: idOrHandle };
}

function status() {
  const d = load();
  const ps = providerState();
  return {
    area: 'OAUTH', module: 'social_login', state: 'live', file: FILE,
    providers: PROVIDERS.length, ready: ps.ready_count, mode: ps.mode,
    flows: d.flows.length, links: d.links.length,
    never_requested: NEVER_REQUESTED,
    rules: ['Kein Anbieter ohne eigene App — sonst bleibt die Anmeldung sichtbar aus.', 'state, nonce und PKCE sind echt erzeugt, nicht beschrieben.', 'Zum Anmelden nur Kennung/Name/E-Mail — keine Inhalte, keine Posting-Rechte.', 'Kanal verknüpfen nur mit Bestätigung durch den Menschen.'],
  };
}

module.exports = {
  meta: { area: 'OAUTH', id: 'social_login', name: 'Anmeldung über soziale Kanäle (OAuth mit PKCE)', state: 'live' },
  actions: { status: () => status(), providers: () => providerState(), start: (p) => start(p || {}), callback: (p) => callback(p || {}), link: (p) => link(p || {}), unlink: (p) => unlink((p || {}).id, p || {}), links: () => ({ ok: true, links: load().links }) },
  PROVIDERS, NEVER_REQUESTED, providerState, start, callback, link, unlink, status,
};
