'use strict';
// AURA · Künstler-Messenger: mit anderen Künstlern brainstormen — und das direkt ins Geschehen.
//
// Der Punkt ist nicht der Chat allein (den gab es als Funkkanal schon), sondern die Verbindung:
// Aus einer Unterhaltung wird mit einem Aufruf ein Entwurf — Kampagne, Song, Video-Auftrag, Umfrage.
// Nichts davon wird veröffentlicht; alles landet als Entwurf mit Freigabe-Pflicht.
//
// Kanäle:
//   direkt   — zwei Künstler, privat
//   crew     — feste Gruppe (Band, Label-Crew)
//   brainstorm — offene Ideenrunde mit Zeitgeber und Ergebnis-Zwang
//
// Brainstorming mit Struktur (statt "laber laber"):
//   Runde 1 Ideen sammeln → Runde 2 bewerten (Punkte) → Runde 3 Ergebnis festhalten.
//   Der Modus zwingt zu einem Ergebnis: eine Sitzung endet mit Entscheidung oder Verschiebung.
//
// Ehrlichkeit: Kein Nachrichtendienst außerhalb (kein WhatsApp/Instagram-Versand ohne Kanal-Schlüssel).
// Der Messenger läuft im OS; nach außen geht nur, was über Connectoren mit Schlüssel und Freigabe läuft.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_MESSENGER_FILE || path.join(__dirname, '..', 'data', 'artist_messenger.json');

const CHANNEL_KINDS = ['direkt', 'crew', 'brainstorm'];
const BRAINSTORM_ROUNDS = [
  { id: 'ideen', name: 'Runde 1 · Ideen sammeln', rule: 'Jede Idee zählt, keine Bewertung in dieser Runde.' },
  { id: 'bewerten', name: 'Runde 2 · Bewerten', rule: 'Punkte 1–5 pro Idee, jede Stimme einmal.' },
  { id: 'ergebnis', name: 'Runde 3 · Ergebnis', rule: 'Eine Idee gewinnt oder es wird verschoben. Kein offenes Ende.' },
];

function defaults() { return { channels: [], messages: [], ideas: [], votes: [], outcomes: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['channels', 'messages', 'ideas', 'votes', 'outcomes', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }
const rid = (p) => `${p}-${crypto.randomBytes(4).toString('hex')}`;

function channel(input) {
  const data = load();
  const p = input || {};
  const kind = CHANNEL_KINDS.includes(String(p.kind || '').toLowerCase()) ? String(p.kind).toLowerCase() : 'crew';
  const name = String(p.name || '').trim();
  const members = (Array.isArray(p.members) ? p.members : []).map((m) => String(m).trim()).filter(Boolean);
  if (!name) return { ok: false, error: 'name fehlt' };
  if (kind === 'direkt' && members.length !== 2) return { ok: false, error: 'direkt braucht genau zwei Teilnehmer' };
  if (!members.length) return { ok: false, error: 'members fehlen' };
  const c = { id: rid('ch'), kind, name, members, created_at: new Date().toISOString(), state: kind === 'brainstorm' ? 'ideen' : 'offen', messages: 0 };
  data.channels.unshift(c); data.channels = data.channels.slice(0, 100);
  data.audit.unshift({ at: c.created_at, action: 'channel', id: c.id, kind });
  save(data);
  return { ok: true, channel: c };
}

function post(input) {
  const data = load();
  const p = input || {};
  const ch = data.channels.find((c) => c.id === p.channel);
  if (!ch) return { ok: false, error: 'Kanal nicht gefunden' };
  const from = String(p.from || '').trim();
  const text = String(p.text || '').trim();
  if (!from) return { ok: false, error: 'from fehlt' };
  if (!ch.members.includes(from)) return { ok: false, error: `"${from}" ist nicht in diesem Kanal`, members: ch.members };
  if (!text) return { ok: false, error: 'text fehlt' };
  const m = { id: rid('msg'), at: new Date().toISOString(), channel: ch.id, from, text: text.slice(0, 4000), kind: String(p.kind || 'text'), ref: p.ref || null };
  data.messages.push(m);
  if (data.messages.length > 3000) data.messages = data.messages.slice(-3000);
  ch.messages = (ch.messages || 0) + 1;
  ch.last_at = m.at;
  // In einer Ideenrunde wird eine Nachricht automatisch zur Idee, wenn sie als Idee markiert ist.
  if (ch.kind === 'brainstorm' && ch.state === 'ideen' && p.kind === 'idee') {
    data.ideas.push({ id: rid('idea'), channel: ch.id, at: m.at, from, text: m.text.slice(0, 500), points: 0, votes: 0, state: 'OFFEN' });
  }
  data.audit.unshift({ at: m.at, action: 'post', channel: ch.id, from });
  save(data);
  return { ok: true, message: m, note: 'Nur im OS. Nach außen geht nichts ohne Kanal-Schlüssel und Freigabe.' };
}

function history(channelId, limit) {
  const data = load();
  const ch = data.channels.find((c) => c.id === channelId);
  if (!ch) return { ok: false, error: 'Kanal nicht gefunden' };
  const msgs = data.messages.filter((m) => m.channel === channelId).slice(-(Number(limit) || 50));
  const ideas = data.ideas.filter((i) => i.channel === channelId);
  return { ok: true, channel: { id: ch.id, name: ch.name, kind: ch.kind, members: ch.members, state: ch.state }, count: msgs.length, messages: msgs, ideas };
}

function vote(input) {
  const data = load();
  const p = input || {};
  const idea = data.ideas.find((i) => i.id === p.idea);
  if (!idea) return { ok: false, error: 'Idee nicht gefunden' };
  const by = String(p.by || '').trim();
  const points = Math.min(5, Math.max(1, Number(p.points) || 1));
  if (!by) return { ok: false, error: 'by fehlt' };
  if (data.votes.some((v) => v.idea === idea.id && v.by === by)) return { ok: false, error: `${by} hat diese Idee schon bewertet — eine Stimme pro Person` };
  data.votes.push({ id: rid('v'), idea: idea.id, by, points, at: new Date().toISOString() });
  idea.points = data.votes.filter((v) => v.idea === idea.id).reduce((a, v) => a + v.points, 0);
  idea.votes = data.votes.filter((v) => v.idea === idea.id).length;
  save(data);
  return { ok: true, idea: { id: idea.id, text: idea.text, points: idea.points, votes: idea.votes } };
}

function advance(channelId) {
  const data = load();
  const ch = data.channels.find((c) => c.id === channelId);
  if (!ch) return { ok: false, error: 'Kanal nicht gefunden' };
  if (ch.kind !== 'brainstorm') return { ok: false, error: 'nur eine Ideenrunde hat Runden' };
  const idx = BRAINSTORM_ROUNDS.findIndex((r) => r.id === ch.state);
  const next = BRAINSTORM_ROUNDS[idx + 1];
  if (!next) return { ok: false, error: 'die Runde ist schon am Ende — Ergebnis festhalten' };
  if (idx === 0 && !data.ideas.some((i) => i.channel === ch.id)) return { ok: false, error: 'erst Ideen sammeln' };
  ch.state = next.id;
  ch.round_changed_at = new Date().toISOString();
  save(data);
  return { ok: true, channel: { id: ch.id, state: ch.state }, round: next };
}

function result(channelId, payload) {
  const data = load();
  const ch = data.channels.find((c) => c.id === channelId);
  if (!ch) return { ok: false, error: 'Kanal nicht gefunden' };
  const ideas = data.ideas.filter((i) => i.channel === ch.id).sort((a, b) => b.points - a.points);
  if (!ideas.length) return { ok: false, error: 'keine Ideen vorhanden' };
  const winner = ideas[0];
  const p = payload || {};
  const out = {
    id: rid('out'), channel: ch.id, at: new Date().toISOString(),
    winner: { id: winner.id, text: winner.text, from: winner.from, points: winner.points, votes: winner.votes },
    ranking: ideas.slice(0, 5).map((i) => ({ text: i.text.slice(0, 80), points: i.points, votes: i.votes })),
    decision: p.decision === 'verschoben' ? 'VERSCHOBEN' : 'ENTSCHEIDEN',
    next_step: p.next_step || null,
    state: 'ENTWURF',
  };
  ch.state = 'ergebnis';
  data.outcomes.push(out); data.outcomes = data.outcomes.slice(0, 200);
  data.audit.unshift({ at: out.at, action: 'result', channel: ch.id, winner: winner.id });
  save(data);
  return { ok: true, outcome: out, note: 'Ergebnis ist ein Entwurf. Veröffentlicht wird nur mit menschlicher Freigabe.' };
}

// Der eigentliche Punkt: aus dem Ergebnis direkt einen Entwurf im Geschehen erzeugen.
function toDraft(input) {
  const data = load();
  const p = input || {};
  const out = data.outcomes.find((o) => o.id === p.outcome) || data.outcomes.find((o) => o.channel === p.channel);
  if (!out) return { ok: false, error: 'kein Ergebnis vorhanden — erst die Runde zu Ende bringen' };
  const what = String(p.what || 'campaign').toLowerCase();
  const title = p.title || out.winner.text.slice(0, 60);
  const payload = { title, by: p.by || 'Künstler-Chat', artist: p.artist || null };

  if (what === 'campaign') {
    if (!p.release_date) return { ok: false, error: 'für eine Kampagne fehlt release_date (JJJJ-MM-TT)' };
    const r = require('./campaign_planner').create({ ...payload, release_date: p.release_date, pitch: out.winner.text });
    return r.ok ? { ok: true, created: { type: 'campaign', id: r.campaign.id }, path: `/api/campaigns/plan?id=${r.campaign.id}`, outcome: out.id } : r;
  }
  if (what === 'song') {
    const r = require('./songbook').create({ ...payload, prompt: out.winner.text, style: p.style || 'lofi', bars: p.bars || 4 });
    return r.ok ? { ok: true, created: { type: 'song', id: r.song.id }, path: `/api/songbook/song-${String(r.song.id).slice(-8)}/status`, outcome: out.id } : { ok: false, error: r.error || 'Songbook hat abgelehnt' };
  }
  if (what === 'video') {
    const r = require('./video_department').ticket({ task: `Video: ${title}`, target_format: p.target_format || '1080x1920', source: 'Brainstorm' });
    return r.ok ? { ok: true, created: { type: 'video', id: r.ticket.id }, path: '/api/video/dept', outcome: out.id } : r;
  }
  if (what === 'content') {
    const r = require('./content_store').register({ kind: 'IDEE', title, body: out.winner.text, tags: ['brainstorm'], by: p.by || 'Künstler-Chat' });
    return r.ok ? { ok: true, created: { type: 'content', id: r.item.id }, path: '/api/content/list', outcome: out.id } : r;
  }
  return { ok: false, error: `what muss campaign, song, video oder content sein (nicht "${what}")` };
}

function list() {
  const data = load();
  return {
    ok: true, channels: data.channels.length, messages: data.messages.length, ideas: data.ideas.length, outcomes: data.outcomes.length,
    items: data.channels.map((c) => ({ id: c.id, name: c.name, kind: c.kind, members: c.members, state: c.state, messages: c.messages || 0 })),
    rounds: BRAINSTORM_ROUNDS.map((r) => r.id),
  };
}

function status() {
  const d = load();
  return {
    area: 'MSG', module: 'artist_messenger', state: 'live', file: FILE,
    channels: d.channels.length, messages: d.messages.length, ideas: d.ideas.length, outcomes: d.outcomes.length,
    kinds: CHANNEL_KINDS, rounds: BRAINSTORM_ROUNDS.length,
    rule: 'Eine Ideenrunde endet mit Ergebnis oder Verschiebung — kein offenes Ende.',
    bridge: 'Ergebnis → Entwurf: campaign, song, video oder content mit einem Aufruf.',
    honesty: ['Der Messenger läuft im OS. Kein Versand an WhatsApp/Instagram ohne Kanal-Schlüssel und Freigabe.', 'Jede Stimme zählt einmal pro Person.', 'Ergebnisse sind Entwürfe, keine Veröffentlichungen.'],
  };
}

module.exports = {
  meta: { area: 'MSG', id: 'artist_messenger', name: 'Künstler-Messenger (Brainstorm mit Ergebnis → Entwurf)', state: 'live' },
  actions: { status: () => status(), kinds: () => ({ ok: true, kinds: CHANNEL_KINDS, rounds: BRAINSTORM_ROUNDS }), channel: (p) => channel(p || {}), post: (p) => post(p || {}), history: (p) => history((p || {}).channel, (p || {}).limit), vote: (p) => vote(p || {}), advance: (p) => advance((p || {}).channel), result: (p) => result((p || {}).channel, p || {}), draft: (p) => toDraft(p || {}), list: () => list() },
  CHANNEL_KINDS, BRAINSTORM_ROUNDS, channel, post, history, vote, advance, result, toDraft, list, status,
};
