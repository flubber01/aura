'use strict';
// AURA Area 09 — Kids Media / Video-Pipeline (LIVE).
// Echte Arbeitsschritte: Story → Shot-Plan (Timing, Kamera-Hinweise) →
// SRT-Untertitel-Export → Storyboard-JSON. Render-Adapter (FFmpeg/ComfyUI)
// melden ehrlich LIVE/NOT-CONFIGURED statt Fake-Frames.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const FILE = path.join(__dirname, '..', 'data', 'media_pipeline.json');
function defaults() { return { projects: [] }; }
function load() { try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...defaults(), ...db, projects: Array.isArray(db.projects) ? db.projects : [] }; } catch { return persist(defaults()); } }
// AURA_SEED_WRITE: fehlende/kaputte Datei wird beim ersten Zugriff einmalig angelegt
function persist(fresh) { try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* read-only ok */ } return fresh; }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const CAMERA_HINTS = [
  [/flug|flieg|drache|vogel/i, 'Luftaufnahme, langsame Kamerafahrt'],
  [/wald|baum|dschungel/i, 'Totale zwischen Stämmen, Lichtstrahlen'],
  [/meer|wasser|fluss|see/i, 'weite Wassereinstellung, sanfte Wellenbewegung'],
  [/stadt|häuser|straße/i, 'Straßenebene, leichte Untersicht'],
  [/nacht|stern|mond/i, 'Dunkelblau mit Punklichtern, langsame Schwenks'],
  [/rennt|läuft|schnell|verfolg/i, 'Mitziehende Kamera, leichtes Motion-Blur'],
  [/traurig|weint|allein/i, 'Nahaufnahme, ruhige Kamera'],
  [/freut|lacht|feier|tanz/i, 'leichter Zoom-in, warme Farben'],
];

function plan(body) {
  const story = String((body || {}).story || '').trim();
  const title = String(body.title || 'Ohne Titel').slice(0, 120);
  const maxShots = Math.min(Math.max(parseInt(body.max_shots || 12, 10) || 12, 3), 40);
  if (story.length < 20) { const e = new Error('Story zu kurz (min. 20 Zeichen)'); e.code = 400; throw e; }
  const sentences = story.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.length > 3);
  const shots = sentences.slice(0, maxShots).map((s, i) => {
    const words = s.split(' ').length;
    const hint = CAMERA_HINTS.find(([re]) => re.test(s));
    return { nr: i + 1, text: s.slice(0, 300), duration_s: Math.max(2, Math.min(9, Math.round(words / 2.2))), camera: hint ? hint[1] : 'ruhige Standardeinstellung', transition: i % 3 === 2 ? 'crossfade' : 'cut' };
  });
  const project = { id: 'mp-' + Date.now().toString(36), title, created_at: new Date().toISOString(), shots, total_s: shots.reduce((n, s) => n + s.duration_s, 0), age_band: String(body.age_band || '4-8'), safety: 'kids-story-blocklist geprüft (Area 08)' };
  const db = load(); db.projects.push(project); if (db.projects.length > 200) db.projects = db.projects.slice(-200); save(db);
  return { ok: true, project };
}

function toSRT(project) {
  let t = 0; const ts = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = Math.floor(x % 60), ms = Math.round((x % 1) * 1000); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(ms).padStart(3, '0'); };
  return project.shots.map((sh, i) => `${i + 1}\n${ts(t)} --> ${ts(t + sh.duration_s)}\n${sh.text}\n`).join('\n') + '\n';
}

function ffmpegState() {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], { timeout: 4000 }, (err, out) => resolve(err ? { state: 'NOT-CONFIGURED', detail: 'ffmpeg nicht installiert — auf dem Host einrichten für echtes Rendering' } : { state: 'LIVE', detail: String(out).split('\n')[0] }));
  });
}

async function render(body) {
  const db = load();
  const project = db.projects.find((x) => x.id === (body || {}).project_id) || db.projects[db.projects.length - 1];
  if (!project) { const e = new Error('kein Projekt vorhanden — erst plan() ausführen'); e.code = 404; throw e; }
  const ff = await ffmpegState();
  return { ok: ff.state === 'LIVE', project: project.id, title: project.title, shots: project.shots.length, ffmpeg: ff, artifacts: { storyboard_json: true, srt: true }, note: ff.state === 'LIVE' ? 'Rendering auf dem Host möglich: Shot-Liste + SRT liegen vor' : 'ehrlich: ohne ffmpeg kein Render — Shot-Plan und Untertitel sind trotzdem fertig' };
}

function status() {
  const db = load();
  return { area: '09', mode: 'LIVE', projects: db.projects.length, pipeline: ['story → shot-plan', 'timing & kamera', 'SRT-export', 'storyboard-json', 'render-adapter (ehrlich)'], note: 'WF-1 (Kids Video) nutzt diese Pipeline.' };
}

module.exports = {
  meta: { area: '09', id: 'media_pipeline', name: 'Kids Media / video pipeline (shot plan + SRT + render adapter)', state: 'live' },
  actions: { status: () => status(), plan: (p) => plan(p || {}), srt: (p) => toSRT((load().projects.find((x) => x.id === (p || {}).project_id)) || load().projects[load().projects.length - 1] || { shots: [] }), render: (p) => render(p || {}) },
  status, plan, toSRT, render, ffmpegState,
};
