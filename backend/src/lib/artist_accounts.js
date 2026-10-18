'use strict';
// AURA · Artist-Konten: mehrere Künstler parallel am OS — jeder mit eigenem Login und eigenem Blick.
//
// Was das ist:
//  • Jeder Artist bekommt ein eigenes Konto mit eigenem Login (Benutzername + Passwort).
//  • „Multi-Login": mehrere Artists können gleichzeitig angemeldet sein. Jede Sitzung ist eigenständig,
//    der Admin sieht, wer online ist und kann Sitzungen beenden.
//  • Sichtbarkeit ist getrennt: ein Artist sieht nur SEINE Songs, Releases und Kanäle. Der Admin sieht alles.
//  • Passwörter liegen NIE im Klartext: scrypt mit Zufallssalt, Vergleich zeitkonstant.
//  • Fremde Konten sind nicht erreichbar: jede Änderung wird gegen den angemeldeten Artist geprüft.
//
// Speicher: backend/src/data/artists.json (git-ignoriert, selbstheilend). Sitzungen liegen im Speicher.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_ARTISTS_FILE || path.join(__dirname, '..', 'data', 'artists.json');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 8;                       // danach kurze Sperre
const LOCK_MS = 15 * 60 * 1000;
const ROLES = ['artist', 'admin'];

// ---------------------------------------------------------------- Speicher (selbstheilend)
function defaults() { return { artists: [], channels: [], audit: [], sessions: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const fresh = defaults(); save(fresh); return fresh; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['artists', 'channels', 'audit', 'sessions']) if (!Array.isArray(raw[k])) raw[k] = [];
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
const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 40);
function audit(state, action, target, detail, by) {
  state.audit.unshift({ at: nowIso(), action, target: String(target || ''), detail: String(detail || '').slice(0, 200), by: String(by || '').slice(0, 40) });
  if (state.audit.length > 800) state.audit.length = 800;
}

// ---------------------------------------------------------------- Passwörter (scrypt, nie Klartext)
function makeHash(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
  return 'scrypt$16384$' + salt.toString('base64') + '$' + key.toString('base64');
}
function checkHash(password, stored) {
  try {
    const [algo, n, saltB64, keyB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const want = Buffer.from(keyB64, 'base64');
    const got = crypto.scryptSync(String(password), salt, want.length, { N: Number(n), r: 8, p: 1 });
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch { return false; }
}

// ---------------------------------------------------------------- Konten
function createArtist(input, by) {
  const state = load();
  const actor = state.artists.find((a) => a.id === by && a.role === 'admin');
  // Erster Artist darf sich selbst anlegen (Bootstrap), danach nur noch der Admin.
  if (state.artists.length > 0 && !actor) return { ok: false, code: 403, error: 'nur der Admin darf Artist-Konten anlegen' };
  const id = slug((input && (input.id || input.name)) || '');
  const name = String((input && input.name) || id).slice(0, 60);
  const password = String((input && input.password) || '');
  const role = String((input && input.role) || 'artist').toLowerCase();
  if (!id || id.length < 3) return { ok: false, code: 400, error: 'Artist-ID fehlt (min. 3 Zeichen)' };
  if (password.length < 10) return { ok: false, code: 400, error: 'Passwort zu kurz (min. 10 Zeichen)' };
  if (!ROLES.includes(role)) return { ok: false, code: 400, error: 'Rolle: ' + ROLES.join(' | ') };
  if (state.artists.some((a) => a.id === id)) return { ok: false, code: 409, error: 'Artist existiert schon' };
  const a = {
    id, name, role, password_hash: makeHash(password),
    genres: Array.isArray(input && input.genres) ? input.genres.slice(0, 6).map((g) => String(g).slice(0, 24)) : [],
    label: String((input && input.label) || '').slice(0, 60),
    avatar: null, bio: String((input && input.bio) || '').slice(0, 400),
    created_at: nowIso(), created_by: String(by || 'bootstrap'),
    fails: 0, locked_until: null, last_login: null,
    releases: [],        // eigene Veröffentlichungen (nur Name/Status, keine Fremddaten)
  };
  state.artists.push(a);
  audit(state, 'artist.create', id, name + ' · ' + role, by);
  save(state);
  return { ok: true, artist: publicArtist(a), note: 'Passwort liegt als scrypt-Hash. Klartext wird nirgends gespeichert.' };
}

function publicArtist(a) {
  const { password_hash, ...rest } = a;
  return rest;
}

// ---------------------------------------------------------------- Anmelden / Sitzungen
const sessions = new Map();   // token -> { artist, role, at, last, ip }
function login(artistId, password, meta) {
  const state = load();
  const a = state.artists.find((x) => x.id === slug(artistId));
  const ip = String((meta && meta.ip) || '').slice(0, 45);
  if (!a) return { ok: false, code: 401, error: 'Artist oder Passwort falsch' };          // keine Auskunft, welches
  if (a.locked_until && Date.parse(a.locked_until) > Date.now()) return { ok: false, code: 429, error: 'kurz gesperrt nach zu vielen Fehlversuchen' };
  if (!checkHash(password, a.password_hash)) {
    a.fails = (a.fails || 0) + 1;
    if (a.fails >= MAX_FAILS) { a.locked_until = new Date(Date.now() + LOCK_MS).toISOString(); a.fails = 0; }
    audit(state, 'artist.login_failed', a.id, 'Versuch ' + a.fails, ip);
    save(state);
    return { ok: false, code: 401, error: 'Artist oder Passwort falsch' };
  }
  a.fails = 0; a.locked_until = null; a.last_login = nowIso();
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { artist: a.id, name: a.name, role: a.role, at: nowIso(), last: nowIso(), ip });
  state.sessions = [...sessions.values()].map((s) => ({ artist: s.artist, role: s.role, at: s.at, ip: s.ip }));
  audit(state, 'artist.login', a.id, 'Rolle ' + a.role, ip);
  save(state);
  return { ok: true, token, artist: { id: a.id, name: a.name, role: a.role }, ttl_hours: SESSION_TTL_MS / 3600000, note: 'Token gehört nur zu dieser Sitzung. Mehrere Artists können gleichzeitig angemeldet sein.' };
}

function logout(token, by) {
  const s = sessions.get(token);
  if (!s) return { ok: false, code: 404, error: 'Sitzung nicht gefunden' };
  sessions.delete(token);
  const state = load();
  state.sessions = [...sessions.values()].map((x) => ({ artist: x.artist, role: x.role, at: x.at, ip: x.ip }));
  audit(state, 'artist.logout', s.artist, 'Sitzung beendet', by || s.artist);
  save(state);
  return { ok: true, artist: s.artist };
}

function whoami(token) {
  const s = sessions.get(token);
  if (!s) return { ok: false, code: 401, error: 'nicht angemeldet' };
  if (Date.now() - Date.parse(s.at) > SESSION_TTL_MS) { sessions.delete(token); return { ok: false, code: 401, error: 'Sitzung abgelaufen' }; }
  s.last = nowIso();
  return { ok: true, artist: { id: s.artist, name: s.name, role: s.role }, since: s.at };
}

function sessionList() {
  const list = [...sessions.values()].map((s) => ({ artist: s.artist, name: s.name, role: s.role, since: s.at, last: s.last, ip: s.ip }));
  return { ok: true, count: list.length, sessions: list, note: 'Multi-Login: jede Zeile ist eine eigene, unabhängige Sitzung.' };
}

function killSession(artistId, by) {
  const state = load();
  const actor = state.artists.find((a) => a.id === by);
  const target = slug(artistId);
  if (!actor || actor.role !== 'admin') return { ok: false, code: 403, error: 'nur der Admin darf Sitzungen beenden' };
  let n = 0;
  for (const [t, s] of [...sessions]) if (s.artist === target) { sessions.delete(t); n++; }
  state.sessions = [...sessions.values()].map((x) => ({ artist: x.artist, role: x.role, at: x.at, ip: x.ip }));
  audit(state, 'artist.session_kill', target, n + ' Sitzung(en) beendet', by);
  save(state);
  return { ok: true, artist: target, ended: n };
}

function resetPassword(artistId, newPassword, by) {
  const state = load();
  const actor = state.artists.find((a) => a.id === by);
  if (!actor || actor.role !== 'admin') return { ok: false, code: 403, error: 'nur der Admin darf Passwörter setzen' };
  const a = state.artists.find((x) => x.id === slug(artistId));
  if (!a) return { ok: false, code: 404, error: 'Artist nicht gefunden' };
  if (String(newPassword).length < 10) return { ok: false, code: 400, error: 'Passwort zu kurz (min. 10 Zeichen)' };
  a.password_hash = makeHash(newPassword);
  a.fails = 0; a.locked_until = null;
  audit(state, 'artist.password_reset', a.id, 'gesetzt', by);
  save(state);
  return { ok: true, artist: a.id, note: 'Neues Passwort liegt als Hash. Bestehende Sitzungen laufen weiter, bis sie beendet werden.' };
}

// ---------------------------------------------------------------- Eigene Kanäle je Artist (Social-Managing)
function linkChannel(artistId, input, by) {
  const state = load();
  const a = state.artists.find((x) => x.id === slug(artistId));
  if (!a) return { ok: false, code: 404, error: 'Artist nicht gefunden' };
  const actor = state.artists.find((x) => x.id === by);
  const isSelf = by === a.id;
  const isAdmin = actor && actor.role === 'admin';
  if (!isSelf && !isAdmin) return { ok: false, code: 403, error: 'nur der Artist selbst oder der Admin' };
  const provider = String((input && input.provider) || '').toLowerCase().slice(0, 40);
  const handle = String((input && input.handle) || '').slice(0, 80);
  if (!provider || !handle) return { ok: false, code: 400, error: 'provider + handle nötig (z. B. instagram / @sabr47)' };
  if (state.channels.some((c) => c.artist === a.id && c.provider === provider)) return { ok: false, code: 409, error: 'Kanal für diesen Artist schon verknüpft' };
  const c = { id: 'ch-' + crypto.randomBytes(3).toString('hex'), artist: a.id, provider, handle, status: 'NOT-CONNECTED', created_at: nowIso(), by: String(by || '') };
  state.channels.push(c);
  audit(state, 'channel.link', a.id, provider + ' ' + handle, by);
  save(state);
  return { ok: true, channel: c, note: 'Verknüpft ist die Zuordnung. Der Schlüssel kommt über die Connectoren in den Vault — Status bleibt ehrlich NOT-CONNECTED bis dahin.' };
}

// Kanal-Namen, wie Künstler sie sagen → Connectoren-Anbieter
const PROVIDER_ALIAS = {
  instagram: 'meta', facebook: 'meta', fb: 'meta',
  youtube: 'youtube', yt: 'youtube', tiktok: 'tiktok', x: 'x', twitter: 'x', linkedin: 'linkedin',
  telegram: 'telegram', spotify: 'spotify', soundcloud: 'soundcloud',
  apple: 'apple-music', 'apple-music': 'apple-music', itunes: 'apple-music',
  deezer: 'deezer', tidal: 'tidal', bandcamp: null, soundcloudgo: 'soundcloud',
};
function resolveProvider(provider) {
  const key = String(provider || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(PROVIDER_ALIAS, key)) return PROVIDER_ALIAS[key];
  return key;
}
function channelsOf(artistId) {
  const state = load();
  const c = require('./connectors');
  return state.channels.filter((x) => x.artist === slug(artistId)).map((x) => {
    const mapped = resolveProvider(x.provider);
    let providerStatus = 'NOT-IN-CATALOG';
    let note = mapped ? null : 'Für diesen Dienst gibt es keinen offiziellen API-Zugang in der Connectoren-Liste.';
    try {
      if (mapped) {
        const p = c.CATALOG.find((y) => y.id === mapped);
        if (p) { providerStatus = c.providerStatus(p).status; note = null; }
      }
    } catch { /* egal */ }
    return { ...x, connector_provider: mapped || null, provider_status: providerStatus, note };
  });
}

// ---------------------------------------------------------------- Artist-Blick (nur eigene Sachen)
function view(artistId, by) {
  const state = load();
  const id = slug(artistId);
  const a = state.artists.find((x) => x.id === id);
  if (!a) return { ok: false, code: 404, error: 'Artist nicht gefunden' };
  const actor = state.artists.find((x) => x.id === by);
  const isSelf = by === id;
  const isAdmin = actor && actor.role === 'admin';
  if (!isSelf && !isAdmin) return { ok: false, code: 403, error: 'fremde Artist-Konten sind nicht einsehbar' };

  let songs = [];
  try { const sb = require('./songbook'); songs = sb.list({ artist: a.name }).songs; } catch { /* Songbook optional */ }
  const channels = channelsOf(id);
  return {
    ok: true, artist: { id: a.id, name: a.name, role: a.role, genres: a.genres, label: a.label, bio: a.bio, last_login: a.last_login },
    songs, counts: { songs: songs.length, channels: channels.length, released: songs.filter((s) => s.status === 'RELEASED').length },
    channels,
    note: 'Dieser Blick enthält ausschließlich Daten dieses Artists.',
  };
}

function status() {
  const state = load();
  return {
    area: 'ARTISTS', mode: 'LIVE', multi_login: true,
    counts: {
      artists: state.artists.length,
      admins: state.artists.filter((a) => a.role === 'admin').length,
      sessions_active: sessions.size,
      channels: state.channels.length,
    },
    artists: state.artists.map((a) => ({ id: a.id, name: a.name, role: a.role, genres: a.genres, last_login: a.last_login, online: [...sessions.values()].some((s) => s.artist === a.id) })),
    sessions: [...sessions.values()].map((s) => ({ artist: s.artist, name: s.name, since: s.at })),
    audit_tail: state.audit.slice(0, 15),
    note: 'Passwörter als scrypt-Hash. Mehrere Artists gleichzeitig angemeldet möglich; jeder sieht nur eigene Daten.',
  };
}

function reset() { sessions.clear(); }   // nur für Tests

module.exports = {
  ROLES, FILE, MAX_FAILS,
  createArtist, login, logout, whoami, sessionList, killSession, resetPassword,
  linkChannel, channelsOf, resolveProvider, PROVIDER_ALIAS, view, status, reset,
  makeHash, checkHash, load, save,
};
