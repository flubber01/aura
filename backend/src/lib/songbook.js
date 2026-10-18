'use strict';
// AURA · Songbook: Song-Werkstatt in der Arbeitsweise, die man von Suno kennt —
// Prompt, Stil-Tags, Songtext, Varianten, Verlängern, Stems, Bibliothek, Playlists, Export.
//
// Zwei Wege zur Musik, klar getrennt und ehrlich benannt:
//  1. LOCAL  — music_render.js berechnet echten Ton (instrumentaler Entwurf). Läuft sofort, ohne Schlüssel.
//  2. KI     — über einen Anbieter mit EIGENEM Schlüssel (Vault) und offizieller API. Freigabe-pflichtig.
//
// Wichtig zur Ehrlichkeit:
//  • Suno und Udio bieten keinen offenen offiziellen API-Zugang. Sie werden deshalb NICHT als
//    integrierbar geführt (Status NOT-API). Nachgebaut ist die ARBEITSWEISE, nicht der Dienst.
//  • Lokal entsteht kein KI-Gesang — das steht als `vocals: false` in jeder Antwort.
//  • Veröffentlichen ist Freigabe-pflichtig (REGEL 1), genauso wie die Distribution.
//
// Speicher: backend/src/data/songbook.json (git-ignoriert, selbstheilend).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const musicRender = require('./music_render');

const FILE = process.env.AURA_SONGBOOK_FILE || path.join(__dirname, '..', 'data', 'songbook.json');

// Anbieter für KI-Musik: nur solche mit echtem, offiziellem API-Zugang.
const AI_PROVIDERS = [
  { id: 'replicate', name: 'Replicate (MusicGen, Stable Audio …)', api: 'https://api.replicate.com/v1/predictions', key: 'replicate-api-token', vocals: false, note: 'Meta MusicGen / Stability-Modelle, instrumentell' },
  { id: 'stability', name: 'Stability AI (Stable Audio)', api: 'https://api.stability.ai/v2beta/audio', key: 'stability-api-key', vocals: false, note: 'instrumentelle Erzeugung' },
  { id: 'elevenlabs', name: 'ElevenLabs Music', api: 'https://api.elevenlabs.io/v1/music', key: 'elevenlabs-api-key', vocals: true, note: 'Musik mit Gesang' },
  { id: 'suno', name: 'Suno', api: null, key: null, vocals: true, note: 'kein offizieller offener API-Zugang — nicht integrierbar, nur Arbeitsweise nachgebaut' },
  { id: 'udio', name: 'Udio', api: null, key: null, vocals: true, note: 'kein offizieller offener API-Zugang — nicht integrierbar' },
];

const STYLES_TAGS = ['lofi', 'trap', 'house', 'pop', 'cinematic', 'schlager', 'synthwave', 'acoustic', 'orchestral', 'dnb'];
const STATUSES = ['DRAFT', 'RENDERED', 'IN_REVIEW', 'APPROVED', 'RELEASED'];

// ---------------------------------------------------------------- Speicher (selbstheilend)
function defaults() { return { songs: [], playlists: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const fresh = defaults(); save(fresh); return fresh; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['songs', 'playlists', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
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
const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 48);
function audit(state, action, target, detail) {
  state.audit.unshift({ at: nowIso(), action, target: String(target || ''), detail: String(detail || '').slice(0, 200) });
  if (state.audit.length > 800) state.audit.length = 800;
}

// Aus Prompt + Stil wird ein musikalisches Rezept. Gleicher Prompt → gleiches Rezept (+Variante).
function planFromPrompt(song, variant) {
  const seedBase = parseInt(crypto.createHash('sha256').update(String(song.prompt) + '|' + (song.artist || '')).digest('hex').slice(0, 8), 16);
  const seed = (seedBase + (variant || 0) * 7919) >>> 0;
  const r = (() => { let a = seed; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const keys = ['A', 'C', 'D', 'E', 'F', 'G'];
  return {
    style: song.style || 'lofi',
    bpm: song.bpm || null,
    bars: song.bars || 8,
    key: song.key || keys[Math.floor(r() * keys.length)],
    seed,
    title: song.title,
    prompt: song.prompt,
  };
}

// Lied anlegen. mode: 'LOCAL' (sofort Ton) oder 'AI' (Anbieter nötig, Freigabe nötig).
function create(input, who) {
  const title = String((input && input.title) || '').trim().slice(0, 120);
  const prompt = String((input && input.prompt) || '').trim().slice(0, 600);
  if (!title || title.length < 2) return { ok: false, code: 400, error: 'Titel fehlt' };
  if (!prompt || prompt.length < 8) return { ok: false, code: 400, error: 'Prompt fehlt (min. 8 Zeichen) — beschreibe Stimmung, Instrumente, Tempo' };
  const style = String((input && input.style) || 'lofi');
  if (!musicRender.STYLES[style]) return { ok: false, code: 400, error: 'unbekannter Stil — verfügbar: ' + Object.keys(musicRender.STYLES).join(', ') };
  const mode = String((input && input.mode) || 'LOCAL').toUpperCase();
  if (!['LOCAL', 'AI'].includes(mode)) return { ok: false, code: 400, error: 'mode: LOCAL oder AI' };

  const state = load();
  const song = {
    id: 'song-' + crypto.randomBytes(4).toString('hex'),
    title, prompt, style, mode,
    artist: String((input && input.artist) || (who || '')).slice(0, 60),
    bpm: Number(input && input.bpm) || null,
    key: (input && input.key) || null,
    bars: Math.max(2, Math.min(64, Number(input && input.bars) || 8)),
    lyrics: String((input && input.lyrics) || '').slice(0, 4000),
    tags: Array.isArray(input && input.tags) ? input.tags.slice(0, 8).map((t) => String(t).slice(0, 24)) : [],
    status: 'DRAFT',
    vocals: false,                  // lokal gibt es keinen KI-Gesang
    variants: [],
    created_at: nowIso(), created_by: String(who || '').slice(0, 60),
    releases: [],
  };
  state.songs.push(song);
  audit(state, 'song.create', song.id, title + ' · ' + style + ' · ' + mode);
  save(state);

  if (mode === 'LOCAL') {
    const r = renderVariant(state, song, 0);
    save(state);
    song.stored = storeAuto(song, { by: (input && input.by) || song.created_by, file: r && r.file ? r.file : null });
    return { ok: true, song: publicSong(song), render: r, stored: song.stored };
  }
  // KI: nur mit hinterlegtem Schlüssel und nach Freigabe
  const cc = require('./control_center');
  const provider = String((input && input.provider) || 'replicate');
  const p = AI_PROVIDERS.find((x) => x.id === provider);
  if (!p || !p.api) return { ok: true, song: publicSong(song), pending_ai: { provider, status: 'NOT-API', note: (p ? p.note : 'unbekannter Anbieter') } };
  const g = cc.gate('growth_publish', { by: who, args: { song: song.id, provider } });
  if (!g.ok && g.code === 202) {
    song.status = 'IN_REVIEW';
    song.ai_request = { provider, approval: g.approval.id, at: nowIso() };
    audit(state, 'song.ai_request', song.id, provider + ' · ' + g.approval.id);
    save(state);
    return { ok: true, song: publicSong(song), pending_ai: { provider, status: 'pending_approval', approval: g.approval.id, note: 'Erst nach menschlicher Freigabe wird der Anbieter gerufen.' } };
  }
  return g;
}

function renderVariant(state, song, variant) {
  const plan = planFromPrompt(song, variant);
  const r = musicRender.render({ ...plan, include: ['drums', 'bass', 'chords', 'melody'], stems: false });
  const v = {
    n: variant, render_id: r.id, file: r.file, bytes: r.bytes, duration: r.duration,
    bpm: r.bpm, key: plan.key, style: r.style, progression: r.progression, seed: r.seed,
    kind: r.kind, vocals: false, at: nowIso(),
  };
  song.variants.push(v);
  song.status = 'RENDERED';
  song.bpm = song.bpm || r.bpm;
  song.key = song.key || plan.key;
  audit(state, 'song.render', song.id, 'Variante ' + variant + ' · ' + Math.round(r.duration) + 's · ' + r.style);
  return v;
}

function render(songId, who, opts) {
  const state = load();
  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { ok: false, code: 404, error: 'Song nicht gefunden' };
  const v = renderVariant(state, song, song.variants.length);
  save(state);
  return { ok: true, song: publicSong(song), render: v };
}

function variations(songId, count, who) {
  const state = load();
  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { ok: false, code: 404, error: 'Song nicht gefunden' };
  const n = Math.max(1, Math.min(5, Number(count) || 3));
  const out = [];
  for (let i = 0; i < n; i++) out.push(renderVariant(state, song, song.variants.length));
  audit(state, 'song.variations', songId, n + ' Varianten');
  save(state);
  return { ok: true, song: publicSong(song), added: out.length, variants: out };
}

function extend(songId, addBars, who) {
  const state = load();
  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { ok: false, code: 404, error: 'Song nicht gefunden' };
  const add = Math.max(2, Math.min(32, Number(addBars) || 8));
  if (song.bars + add > 64) return { ok: false, code: 400, error: 'Maximum 64 Takte erreicht' };
  song.bars += add;
  const v = renderVariant(state, song, song.variants.length);
  audit(state, 'song.extend', songId, '+' + add + ' Takte → ' + song.bars);
  save(state);
  return { ok: true, song: publicSong(song), bars: song.bars, render: v };
}

function stems(songId, who) {
  const state = load();
  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { ok: false, code: 404, error: 'Song nicht gefunden' };
  const plan = planFromPrompt(song, song.variants.length ? song.variants[song.variants.length - 1].n : 0);
  const r = musicRender.render({ ...plan, stems: true });
  audit(state, 'song.stems', songId, Object.keys(r.stems || {}).join(', '));
  save(state);
  return { ok: true, song: song.id, stems: r.stems, note: 'Einzelspuren zum Weiterarbeiten in einer DAW.' };
}

function setStatus(songId, status, who) {
  const state = load();
  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { ok: false, code: 404, error: 'Song nicht gefunden' };
  const s = String(status || '').toUpperCase();
  if (!STATUSES.includes(s)) return { ok: false, code: 400, error: 'Status: ' + STATUSES.join(', ') };
  if (['APPROVED', 'RELEASED'].includes(s) && !require('./control_center').isHuman(who)) return { ok: false, code: 403, error: 'nur ein Mensch darf freigeben/veröffentlichen' };
  song.status = s;
  song.status_at = nowIso();
  audit(state, 'song.status', songId, s + ' durch ' + (who || ''));
  save(state);
  return { ok: true, song: publicSong(song) };
}

function lyrics(songId, text, who) {
  const state = load();
  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { ok: false, code: 404, error: 'Song nicht gefunden' };
  song.lyrics = String(text || '').slice(0, 4000);
  audit(state, 'song.lyrics', songId, song.lyrics.length + ' Zeichen');
  save(state);
  return { ok: true, song: publicSong(song), words: song.lyrics.split(/\s+/).filter(Boolean).length };
}

function playlistAdd(name, songIds, who) {
  const n = String(name || '').trim().slice(0, 80);
  if (!n) return { ok: false, code: 400, error: 'Name fehlt' };
  const state = load();
  const ids = (Array.isArray(songIds) ? songIds : []).filter((id) => state.songs.some((s) => s.id === id));
  if (!ids.length) return { ok: false, code: 400, error: 'keine gültigen Songs' };
  let pl = state.playlists.find((p) => p.name === n);
  if (!pl) { pl = { id: 'pl-' + crypto.randomBytes(3).toString('hex'), name: n, songs: [], created_at: nowIso(), by: String(who || '').slice(0, 60) }; state.playlists.push(pl); }
  for (const id of ids) if (!pl.songs.includes(id)) pl.songs.push(id);
  audit(state, 'playlist.add', pl.id, n + ' · ' + ids.length);
  save(state);
  return { ok: true, playlist: { id: pl.id, name: pl.name, songs: pl.songs.length } };
}

function publicSong(s) {
  const last = s.variants[s.variants.length - 1] || null;
  return {
    id: s.id, title: s.title, prompt: s.prompt, style: s.style, artist: s.artist, mode: s.mode,
    status: s.status, bpm: s.bpm, key: s.key, bars: s.bars, vocals: s.vocals, tags: s.tags,
    lyrics_chars: (s.lyrics || '').length, variants: s.variants.length,
    duration: last ? last.duration : null, file: last ? last.file : null, progression: last ? last.progression : null,
    releases: s.releases, created_at: s.created_at,
  };
}

function list(filter) {
  const state = load();
  const f = filter || {};
  let songs = state.songs;
  if (f.artist) songs = songs.filter((s) => s.artist === f.artist);
  if (f.status) songs = songs.filter((s) => s.status === String(f.status).toUpperCase());
  if (f.style) songs = songs.filter((s) => s.style === f.style);
  if (f.q) { const q = String(f.q).toLowerCase(); songs = songs.filter((s) => (s.title + ' ' + s.prompt + ' ' + s.lyrics).toLowerCase().includes(q)); }
  return {
    ok: true, area: 'SONGBOOK', mode: 'LOCAL+AI',
    counts: {
      songs: state.songs.length, playlists: state.playlists.length,
      rendered: state.songs.filter((s) => s.status === 'RENDERED').length,
      released: state.songs.filter((s) => s.status === 'RELEASED').length,
      variants: state.songs.reduce((a, s) => a + s.variants.length, 0),
    },
    songs: songs.map(publicSong),
    playlists: state.playlists.map((p) => ({ id: p.id, name: p.name, songs: p.songs.length })),
    ai_providers: AI_PROVIDERS.map((p) => ({ id: p.id, name: p.name, integrable: !!p.api, vocals: p.vocals, note: p.note })),
    note: 'Lokal entsteht ein instrumentaler Entwurf (echter Ton, kein KI-Gesang). KI-Musik nur über Anbieter mit eigenem Schlüssel und offizieller API.',
  };
}

function status() {
  const st = list();
  const audio = musicRender.info();
  return {
    area: 'SONGBOOK', mode: 'LIVE', counts: st.counts, audio,
    styles: Object.keys(musicRender.STYLES), style_tags: STYLES_TAGS, statuses: STATUSES,
    ai_integrable: AI_PROVIDERS.filter((p) => p.api).map((p) => p.id),
    ai_not_integrable: AI_PROVIDERS.filter((p) => !p.api).map((p) => ({ id: p.id, reason: p.note })),
    note: 'Nachgebaut ist die Arbeitsweise (Prompt, Tags, Text, Varianten, Verlängern, Stems, Bibliothek, Playlists), nicht ein fremder Dienst.',
  };
}

// Automatische Ablage: jede Sache, bei der Inhalt entsteht, kommt in den Inhalts-Speicher.
// Bewusst fehlertolerant: Ist der Speicher nicht da, läuft das Songbook trotzdem weiter.
function storeAuto(song, extra) {
  try {
    const cs = require('./content_store');
    return cs.register({
      kind: 'SONG', title: song.title || song.id,
      body: [song.prompt ? 'Prompt: ' + song.prompt : null, song.lyrics ? 'Text:\n' + song.lyrics : null].filter(Boolean).join('\n\n') || null,
      tags: [song.style, song.artist].filter(Boolean),
      artist: song.artist || null, project: song.project || null,
      source_module: 'songbook', source_ref: song.id,
      by: (extra && extra.by) || 'AURA',
      file: extra && extra.file && fs.existsSync(extra.file) ? extra.file : null,
      role: (extra && extra.role) || 'haupt',
    });
  } catch (e) { return { ok: false, error: e.message }; }
}

module.exports = {
  AI_PROVIDERS, STYLES_TAGS, STATUSES, FILE, storeAuto,
  create, render, variations, extend, stems, setStatus, lyrics, playlistAdd, list, status, load, publicSong,
};
