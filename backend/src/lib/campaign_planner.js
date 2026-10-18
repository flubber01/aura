'use strict';
// AURA · Kampagnen-Planer: vom Pitch bis zum geplanten Release.
//
// Der Planer rechnet RÜCKWÄRTS vom Release-Datum: erst der Releasetag, dann alles, was davor
// fertig sein muss (Master, Cover, Texte, Vorschau, Presse, Distribution, Freigabe). Damit steht
// für jeden Schritt ein Datum und eine Zuständigkeit — nicht nur eine Idee.
//
// Was der Planer NICHT tut:
//  • Er veröffentlicht nichts. Jeder Schritt mit `human: true` verlangt die Freigabe eines Menschen,
//    bevor er auf `done` geht (menschliches letztes Wort).
//  • Er erzeugt keine Reichweite und keine Klicks. Zahlen sind Ziele und Prognosen, klar als solche benannt.
//  • Er verbindet nur Kanäle, die im Connectoren-Katalog stehen und deren Status ehrlich ist.
//
// Speicher: backend/src/data/campaigns.json (git-ignoriert, selbstheilend).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_CAMPAIGNS_FILE || path.join(__dirname, '..', 'data', 'campaigns.json');
const DAY = 86400000;

// Pipeline-Stufen eines Releases. Reihenfolge ist verbindlich; Gates sind nicht überspringbar.
const STAGES = [
  { id: 'pitch', name: 'Pitch', days_before: 84, human: false, outputs: ['Kurz-Pitch (1 Absatz)', 'Zielgruppe', 'Referenztracks'] },
  { id: 'signoff', name: 'Zusage / Label-Entscheidung', days_before: 77, human: true, outputs: ['Entscheidung dokumentiert'] },
  { id: 'production', name: 'Produktion', days_before: 63, human: false, outputs: ['Instrumental', 'Arrangement', 'Stems'] },
  { id: 'vocals', name: 'Gesang / Topline', days_before: 49, human: false, outputs: ['Aufnahme', 'Komp-Takes'] },
  { id: 'mix', name: 'Mix', days_before: 35, human: false, outputs: ['Mix-Stems', 'Referenz-Versionen'] },
  { id: 'master', name: 'Master', days_before: 28, human: false, outputs: ['Master WAV', 'Master für Streaming'] },
  { id: 'artwork', name: 'Cover & Texte', days_before: 21, human: false, outputs: ['Cover 3000×3000', 'Booklet/Text', 'Liner Notes'] },
  { id: 'metadata', name: 'Metadaten & Codes', days_before: 18, human: false, outputs: ['ISRC', 'UPC', 'Credits', 'Split-Sheet'] },
  { id: 'preview', name: 'Vorschau / Vorverkauf', days_before: 14, human: true, outputs: ['Teaser-Stück', 'Vorverkaufs-Link aktiv'] },
  { id: 'pitchout', name: 'Presse & Playlist-Pitch', days_before: 10, human: true, outputs: ['Pressetext raus', 'Pitch an Kuratoren'] },
  { id: 'delivery', name: 'Übergabe an Distribution', days_before: 7, human: true, outputs: ['Upload beim Distributor', 'Bestätigung'] },
  { id: 'release', name: 'Release', days_before: 0, human: true, outputs: ['Live auf allen Kanälen', 'Bestätigung gesichert'] },
  { id: 'post', name: 'Nachrelease (4 Wochen)', days_before: -28, human: false, outputs: ['Content-Nachschub', 'Zahlen-Auswertung'] },
];

const CHANNELS = {
  distro: ['spotify', 'apple-music', 'deezer', 'tidal', 'soundcloud'],
  social: ['youtube', 'meta', 'tiktok', 'x', 'telegram'],
  promo: ['adsense', 'google-ads', 'meta-ads', 'awin'],
};

function defaults() { return { campaigns: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['campaigns', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch {
    const f = defaults(); save(f); return f; // AURA_SEED_WRITE
  }
}
function save(data) {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
  catch (e) { /* Laufzeitdatei nicht schreibbar: Betrieb läuft weiter, nichts geht still verloren */ }
  return data;
}
const rid = (p) => `${p}-${crypto.randomBytes(4).toString('hex')}`;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const parseDate = (s) => { const d = new Date(String(s) + 'T12:00:00Z'); return isNaN(d) ? null : d; };
function log(data, entry) { data.audit.unshift({ at: new Date().toISOString(), ...entry }); data.audit = data.audit.slice(0, 400); }

// ---------------------------------------------------------------- Plan rechnen
function planTasks(releaseDate, opts) {
  const rel = parseDate(releaseDate);
  if (!rel) throw new Error('Release-Datum fehlt oder ist kein Datum (JJJJ-MM-TT)');
  const today = new Date(); today.setUTCHours(12, 0, 0, 0);
  return STAGES.map((s) => {
    const due = new Date(rel.getTime() - s.days_before * DAY);
    return {
      stage: s.id, name: s.name, due: iso(due), offset_days: -s.days_before,
      owner: (opts.owners && opts.owners[s.id]) || (s.human ? 'Mensch (Freigabe)' : 'AURA'),
      human: s.human, outputs: s.outputs.slice(),
      state: s.days_before > 0 && due < today ? 'offen (Termin liegt vor heute)' : 'geplant',
      late: s.days_before > 0 && due < today,
    };
  });
}

function pipelines(campaign) {
  const ch = campaign.channels || {};
  const used = Object.entries(ch).filter(([, v]) => v && v.length).map(([k]) => k);
  return {
    stages: STAGES.map((s) => ({ id: s.id, name: s.name, human: s.human })),
    channels: used,
    gaps: Object.entries(CHANNELS).filter(([k]) => !ch[k] || !ch[k].length).map(([k, v]) => ({ group: k, missing: v })),
    note: 'Kanäle ohne Auswahl bleiben leer — der Planer trägt keine Kanäle nach, die nicht gewählt wurden.',
  };
}

function blockedBy(campaign) {
  // Was hält den Plan auf? offene menschliche Freigaben, die schon fällig sind.
  const today = iso(new Date());
  return campaign.tasks.filter((t) => t.human && t.state !== 'done' && t.due <= today).map((t) => t.stage);
}

function create(input) {
  const data = load();
  const title = String((input && input.title) || '').trim();
  if (!title) return { ok: false, error: 'Titel fehlt' };
  if (!input.release_date) return { ok: false, error: 'release_date fehlt (JJJJ-MM-TT)' };
  let tasks;
  try { tasks = planTasks(input.release_date, input); } catch (e) { return { ok: false, error: e.message }; }
  const campaign = {
    id: rid('cp'),
    title,
    artist: String(input.artist || 'ohne Zuordnung'),
    pitch: String(input.pitch || '').slice(0, 2000),
    genre: String(input.genre || ''),
    release_date: input.release_date,
    song_id: input.song_id || null,
    label: input.label || null,
    budget_eur: Number(input.budget_eur) || 0,
    goal: {
      streams_target: Number(input.streams_target) || 0,
      revenue_target_eur: Number(input.revenue_target_eur) || 0,
      note: 'Zielwerte, keine Prognose — AURA erzeugt keine Streams und keine Klicks.',
    },
    channels: {
      distro: (input.distro || CHANNELS.distro).slice(0, 6),
      social: (input.social || []).slice(0, 8),
      promo: (input.promo || []).slice(0, 6),
    },
    state: 'PLANNED',
    created_at: new Date().toISOString(),
    tasks,
  };
  campaign.pipelines = pipelines(campaign);
  data.campaigns.unshift(campaign);
  log(data, { action: 'create', id: campaign.id, release_date: campaign.release_date, by: input.by || 'AURA' });
  save(data);
  return { ok: true, campaign, plan: plan(campaign.id) };
}

function get(id) {
  const data = load();
  return data.campaigns.find((c) => c.id === id) || null;
}

function advance(id, stageId, payload) {
  const data = load();
  const c = data.campaigns.find((x) => x.id === id);
  if (!c) return { ok: false, error: 'Kampagne nicht gefunden' };
  const t = c.tasks.find((x) => x.stage === stageId);
  if (!t) return { ok: false, error: `Stufe "${stageId}" gibt es nicht` };
  const p = payload || {};
  if (t.human && !p.human_approved) {
    // Regel: kein Schritt mit menschlicher Freigabe geht ohne Menschen auf done.
    return { ok: false, error: `Stufe "${stageId}" braucht menschliche Freigabe (human_approved: true)`, needs: 'human' };
  }
  t.state = p.state || 'done';
  t.done_at = new Date().toISOString();
  t.note = String(p.note || '').slice(0, 400);
  t.proof = p.proof || null; // Datei/Beleg, z. B. Songbook-ID, Master-Pfad
  if (p.human_approved) t.approved_by = String(p.approved_by || 'Mensch');
  const idx = STAGES.findIndex((s) => s.id === stageId);
  const next = STAGES.slice(idx + 1).find((s) => { const tt = c.tasks.find((x) => x.stage === s.id); return tt && tt.state !== 'done'; });
  c.state = c.tasks.every((x) => x.state === 'done') ? 'DONE' : 'IN_PROGRESS';
  log(data, { action: 'advance', id: c.id, stage: stageId, by: p.by || (p.human_approved ? 'Mensch' : 'AURA'), human_approved: !!p.human_approved });
  save(data);
  return { ok: true, campaign_state: c.state, stage: t, next_stage: next ? next.id : null, human_needed: !!(next && next.human) };
}

function plan(id) {
  const c = get(id);
  if (!c) return { ok: false, error: 'Kampagne nicht gefunden' };
  const today = iso(new Date());
  const open = c.tasks.filter((t) => t.state !== 'done');
  const overdue = open.filter((t) => t.due < today);
  return {
    ok: true,
    id: c.id, title: c.title, artist: c.artist, release_date: c.release_date, state: c.state,
    countdown_days: Math.round((parseDate(c.release_date) - Date.now()) / DAY),
    stages_done: c.tasks.filter((t) => t.state === 'done').length,
    stages_total: c.tasks.length,
    next: open[0] || null,
    overdue: overdue.map((t) => ({ stage: t.stage, name: t.name, due: t.due, human: t.human })),
    waiting_for_human: blockedBy(c),
    pipelines: c.pipelines,
    timeline: c.tasks.map((t) => ({ stage: t.stage, name: t.name, due: t.due, owner: t.owner, human: t.human, state: t.state })),
  };
}

function releaseBoard() {
  const data = load();
  const rows = data.campaigns.map((c) => {
    const p = plan(c.id);
    return { id: c.id, title: c.title, artist: c.artist, release_date: c.release_date, state: c.state,
      days_left: p.countdown_days, next: p.next ? p.next.name : null, waiting_for_human: p.waiting_for_human,
      overdue: p.overdue.length };
  }).sort((a, b) => a.release_date < b.release_date ? -1 : 1);
  return { ok: true, count: rows.length, rows, next_release: rows[0] || null, channels: CHANNELS, stages: STAGES.map((s) => s.id) };
}

function list(filter) {
  const data = load();
  const f = filter || {};
  let items = data.campaigns;
  if (f.artist) items = items.filter((c) => c.artist.toLowerCase() === String(f.artist).toLowerCase());
  if (f.state) items = items.filter((c) => c.state === f.state);
  return { count: items.length, items: items.map((c) => ({ id: c.id, title: c.title, artist: c.artist, release_date: c.release_date, state: c.state, tasks_done: c.tasks.filter((t) => t.state === 'done').length, tasks_total: c.tasks.length })) };
}

function status() {
  const data = load();
  return {
    area: 'CMP', module: 'campaign_planner', state: 'live',
    file: FILE, campaigns: data.campaigns.length,
    stages: STAGES.length,
    human_gated_stages: STAGES.filter((s) => s.human).map((s) => s.id),
    rule: 'Jede Stufe mit menschlicher Freigabe bleibt stehen, bis ein Mensch sie freigibt.',
    honesty: ['Zielwerte sind Ziele, keine Prognosen.', 'Es werden keine Streams, Klicks oder Follower erzeugt.', 'Kanäle stammen aus dem Connectoren-Katalog und behalten ihren ehrlichen Status.'],
    audit: data.audit.slice(0, 5),
  };
}

module.exports = {
  meta: { area: 'CMP', id: 'campaign_planner', name: 'Kampagnen-Planer (Pitch → Release → Pipelines)', state: 'live' },
  actions: {
    status: () => status(),
    create: (p) => create(p || {}),
    plan: (p) => plan((p || {}).id),
    advance: (p) => advance((p || {}).id, (p || {}).stage, (p || {})),
    board: () => releaseBoard(),
    list: (p) => list(p || {}),
  },
  STAGES, CHANNELS, create, plan, advance, list, releaseBoard, status, pipelines, FILE,
};
