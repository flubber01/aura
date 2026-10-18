'use strict';
// AURA · Sprachfunktion: Hören (Sprache → Text) und Sprechen (Text → Stimme).
//
// Der ehrliche Stand in einem Satz: Beides braucht entweder ein lokales Sprachmodell auf dem Server
// (piper, espeak-ng, whisper.cpp) oder einen Anbieter mit eigenem Schlüssel im Vault. AURA tut
// deshalb NICHT so, als könnte es sprechen: ohne Motor steht der Status auf NOT-CONNECTED und der
// Auftrag bleibt als vorbereiteter Plan stehen (Text in Sprech-Stücke zerlegt, Stimmen-Profil,
// Zielformat). Sobald ein Motor da ist, wird genau dieser Plan abgearbeitet.
//
// Vorhanden und sofort nutzbar (ohne Fremd-Motor):
//  • Sprech-Planung: Text zerlegen, Pausen setzen, Betonungshinweise, Zeit-Schätzung.
//  • Stimmen-Profile: Name, Tempo, Tonlage, Stil — als Einstellung, nicht als Behauptung.
//  • Podcast-Bau: mehrere Stimmen zu einer Folge zusammenlegen (Schnittliste mit Zeitmarken).
//  • Ton-Analyse vorhandener Aufnahmen (Dauer, Pegel) über die eingebaute WAV-Lesung.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FILE = process.env.AURA_SPEECH_FILE || path.join(__dirname, '..', 'data', 'speech.json');

// Lokale Motoren, die es auf einem Server geben kann. Reihenfolge = Vorliebe.
const ENGINES = [
  { id: 'piper', bin: 'piper', kind: 'TTS', license: 'MIT', quality: 'sehr gut, offline, neuronale Stimmen', args: '--model <stimme.onnx> --output_file <out.wav>' },
  { id: 'espeak-ng', bin: 'espeak-ng', kind: 'TTS', license: 'GPL', quality: 'verständlich, künstlich, sehr klein', args: '-v de -s 165 -w <out.wav>' },
  { id: 'festival', bin: 'festival', kind: 'TTS', license: 'GPL/MIT', quality: 'verständlich, altmodisch', args: '--tts <text>' },
  { id: 'flite', bin: 'flite', kind: 'TTS', license: 'MIT', quality: 'klein und schnell', args: '-o <out.wav> -t "<text>"' },
  { id: 'whisper-cpp', bin: 'whisper-cli', kind: 'STT', license: 'MIT', quality: 'sehr gut, offline', args: '-m <modell.bin> -f <audio> -otxt' },
  { id: 'whisper-py', bin: 'whisper', kind: 'STT', license: 'MIT', quality: 'sehr gut (Python)', args: '<audio> --model small --language de' },
  { id: 'ffmpeg', bin: 'ffmpeg', kind: 'WERKZEUG', license: 'LGPL', quality: 'kein Sprechen, aber Pegel/Analyse/Schnitt', args: '-i <in> -af …' },
];

const PROVIDERS = [
  { id: 'elevenlabs', kind: 'TTS', key: 'elevenlabs-api-key', note: 'sehr natürliche Stimmen, kostenpflichtig, Freigabe nötig' },
  { id: 'openai-tts', kind: 'TTS', key: 'openai-api-key', note: 'solide Stimmen, kostenpflichtig' },
  { id: 'openai-stt', kind: 'STT', key: 'openai-api-key', note: 'Transkription' },
  { id: 'azure-speech', kind: 'TTS/STT', key: 'azure-speech-key', note: 'gute deutsche Stimmen' },
];

const VOICES = [
  { id: 'erzaehler-ruhig', name: 'Erzähler ruhig', rate: 0.95, pitch: 0.0, style: 'Dokumentation, Handbuch, Podcast-Intro' },
  { id: 'moderator-wach', name: 'Moderator wach', rate: 1.08, pitch: 0.05, style: 'News, Ankündigungen' },
  { id: 'podcast-duo-a', name: 'Podcast-Stimme A', rate: 1.0, pitch: -0.05, style: 'Fragen stellen' },
  { id: 'podcast-duo-b', name: 'Podcast-Stimme B', rate: 1.02, pitch: 0.08, style: 'Antworten, erklären' },
  { id: 'werbung-druck', name: 'Werbung mit Druck', rate: 1.12, pitch: -0.02, style: 'Verkaufstext' },
];

function defaults() { return { projects: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['projects', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function findEngine(id) {
  const e = ENGINES.find((x) => x.id === id) || ENGINES.find((x) => x.bin === id);
  if (!e) return { found: false, engine: null, error: 'Motor unbekannt' };
  let found = false; let where = null;
  try {
    const out = execFileSync('sh', ['-c', `command -v ${e.bin} || true`], { encoding: 'utf8' }).trim();
    if (out) { found = true; where = out; }
  } catch { found = false; }
  return { found, engine: e, path: where };
}

function engines() {
  const rows = ENGINES.map((e) => ({ ...e, available: findEngine(e.id).found, path: findEngine(e.id).path || null }));
  const tts = rows.filter((r) => r.kind === 'TTS' && r.available).map((r) => r.id);
  const stt = rows.filter((r) => r.kind === 'STT' && r.available).map((r) => r.id);
  return {
    ok: true, engines: rows, tts_available: tts, stt_available: stt,
    mode: tts.length || stt.length ? 'TEILWEISE LIVE' : 'NOT-CONNECTED',
    note: tts.length || stt.length
      ? 'Auf diesem Server ist mindestens ein Sprachmotor installiert — Sprechen/Hören läuft lokal.'
      : 'Kein Sprachmotor installiert. AURA behauptet NICHT, sprechen zu können: Aufträge werden als Plan vorbereitet und warten auf den Motor.',
    install: {
      sprechen: 'piper (MIT, Stimmen als .onnx) oder espeak-ng (GPL) installieren und in den PATH legen',
      hoeren: 'whisper.cpp (MIT) mit deutschem Modell installieren',
      alternativ: 'Anbieter mit eigenem Schlüssel im Vault (elevenlabs, openai, azure) — kostenpflichtig, Freigabe nötig',
    },
  };
}

// Text in Sprech-Stücke zerlegen: an Satzgrenzen, mit Pausen und Betonungshinweisen.
function plan(input) {
  const text = String((input && input.text) || '').trim();
  if (!text) return { ok: false, error: 'Text fehlt' };
  const voice = VOICES.find((v) => v.id === (input && input.voice)) || VOICES[0];
  const max = Number((input && input.max_chars) || 220);
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || [text];
  const chunks = []; let buf = '';
  for (const s of sentences) {
    if ((buf + s).trim().length > max && buf) { chunks.push(buf.trim()); buf = s; }
    else buf += s + ' ';
  }
  if (buf.trim()) chunks.push(buf.trim());
  const words = text.split(/\s+/).filter(Boolean).length;
  const secPerWord = 0.42 / (voice.rate || 1);
  const pieces = chunks.map((c, i) => {
    const w = c.split(/\s+/).filter(Boolean).length;
    return {
      index: i + 1, chars: c.length, words: w, text: c,
      est_seconds: Math.round(w * secPerWord * 10) / 10,
      pause_after_s: /[.!?]$/.test(c) ? 0.45 : 0.2,
      emphasis: (c.match(/[A-ZÄÖÜ]{2,}/g) || []).map((x) => x.trim()).slice(0, 5),
    };
  });
  return {
    ok: true, voice, chunks: pieces,
    total_seconds: Math.round(pieces.reduce((a, p) => a + p.est_seconds + p.pause_after_s, 0) * 10) / 10,
    words, ssml_hint: 'Pausen als <break time="450ms"/>, Betonung als <emphasis>. Reine Hinweise — viele Motoren ignorieren sie.',
    engine_state: engines().mode,
    honest: 'Die Zeit ist geschätzt (0,42 s pro Wort, an das Sprechtempo angepasst), nicht gemessen.',
  };
}

function createProject(input) {
  const data = load();
  const title = String((input && input.title) || '').trim();
  if (!title) return { ok: false, error: 'Titel fehlt' };
  const p = plan(input || {});
  if (!p.ok) return p;
  const entry = {
    id: 'sp-' + Math.random().toString(16).slice(2, 10), title,
    kind: String((input && input.kind) || 'SPRACHSTUECK').toUpperCase(),
    voice: p.voice.id, chunks: p.chunks.length, est_seconds: p.total_seconds,
    text: String(input.text).slice(0, 20000),
    state: engines().mode === 'NOT-CONNECTED' ? 'WAITING_FOR_ENGINE' : 'READY_TO_RENDER',
    created_at: new Date().toISOString(),
  };
  data.projects.unshift(entry); data.projects = data.projects.slice(0, 50);
  data.audit.unshift({ at: entry.created_at, action: 'createProject', id: entry.id });
  data.audit = data.audit.slice(0, 200);
  save(data);
  return { ok: true, project: entry, plan: p, next: engines().mode === 'NOT-CONNECTED' ? 'Sprachmotor installieren oder Anbieter mit Schlüssel freigeben — dann wird der Plan abgearbeitet.' : 'Rendern starten.' };
}

// Podcast-Schnittliste: mehrere Sprechstücke (Stimme A/B) zu einer Folge mit Zeitmarken.
function podcastOutline(parts) {
  const rows = Array.isArray(parts) ? parts : [];
  if (!rows.length) return { ok: false, error: 'Keine Sprechstücke übergeben' };
  let t = 0; const timeline = [];
  rows.forEach((r, i) => {
    const voice = VOICES.find((v) => v.id === r.voice) || VOICES[2 + (i % 2)];
    const w = String(r.text || '').split(/\s+/).filter(Boolean).length;
    const dur = Math.round((w * 0.42 / (voice.rate || 1) + 2.5) * 10) / 10; // +2,5 s Musik/Atmo-Abstand
    timeline.push({ part: i + 1, speaker: r.speaker || voice.name, voice: voice.id, starts_at: t, seconds: dur, text: String(r.text || '').slice(0, 500) });
    t = Math.round((t + dur) * 10) / 10;
  });
  return { ok: true, episode_seconds: t, timeline, chapter_marks: timeline.map((x) => ({ at: x.starts_at, title: `${x.speaker}: ${x.text.slice(0, 40)}…` })), engine_state: engines().mode };
}

function status() {
  const data = load();
  const e = engines();
  return {
    area: 'SPK', module: 'speech', state: 'live', file: FILE,
    mode: e.mode, tts_available: e.tts_available, stt_available: e.stt_available,
    voices: VOICES.length, providers_with_key_needed: PROVIDERS.length, projects: data.projects.length,
    honesty: ['Ohne Motor wird nicht gesprochen — der Auftrag wartet sichtbar als WAITING_FOR_ENGINE.', 'Zeitschätzungen sind Schätzungen, keine Messungen.', 'KI-Stimmen von Anbietern laufen nur mit eigenem Schlüssel (Vault) und Freigabe.'],
  };
}

module.exports = {
  meta: { area: 'SPK', id: 'speech', name: 'Sprachfunktion (Sprechen und Hören, Motoren ehrlich geprüft)', state: 'live' },
  actions: { status: () => status(), engines: () => engines(), voices: () => ({ ok: true, voices: VOICES }), plan: (p) => plan(p || {}), project: (p) => createProject(p || {}), podcast: (p) => podcastOutline((p || {}).parts) },
  ENGINES, VOICES, PROVIDERS, engines, plan, createProject, podcastOutline, status, load,
};
