'use strict';
// AURA · Video-Werkstatt: Effekt-Ketten für Videos, gebaut auf ffmpeg.
//
// Ehrlichkeit zuerst: Ohne installiertes ffmpeg wird NICHTS gerendert — die Antwort sagt das dann
// klar mit Installationsbefehl, statt ein leeres Ergebnis zu liefern. Der Filtergraph wird trotzdem
// gebaut und ist prüfbar (auch ohne ffmpeg), damit man die Kette vorher sehen kann.
//
// Was es gibt: Zuschnitt/Skalierung, Weichzeichnen, Schärfen, Farbkorrektur, Chroma Key,
// Text/Bauchbinde, Tempo, Übergänge, Wasserzeichen, Lautheit normalisieren, Standbild, GIF.
//
// Speicher: backend/src/data/video_jobs.json (git-ignoriert, selbstheilend).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const FILE = process.env.AURA_VIDEO_FILE || path.join(__dirname, '..', 'data', 'video_jobs.json');
const OUT_DIR = process.env.AURA_VIDEO_DIR || path.join(__dirname, '..', 'data', 'video');

// Effekt-Katalog. Jeder Effekt baut ein oder mehrere ffmpeg-Filterglieder.
const EFFECTS = {
  scale:        { label: 'Größe',            params: ['width', 'height'], build: (p) => `scale=${Number(p.width) || 1280}:${Number(p.height) || -2}` },
  crop:         { label: 'Zuschnitt',        params: ['w', 'h', 'x', 'y'], build: (p) => `crop=${+p.w || 1080}:${+p.h || 1080}:${+p.x || 0}:${+p.y || 0}` },
  blur:         { label: 'Weichzeichnen',    params: ['strength'], build: (p) => `gblur=sigma=${Math.max(0.1, Math.min(20, +p.strength || 4))}` },
  sharpen:      { label: 'Schärfen',         params: ['amount'], build: (p) => `unsharp=5:5:${Math.max(0, Math.min(3, +p.amount || 1))}` },
  brightness:   { label: 'Helligkeit',       params: ['value'], build: (p) => `eq=brightness=${Math.max(-1, Math.min(1, +p.value || 0))}` },
  contrast:     { label: 'Kontrast',         params: ['value'], build: (p) => `eq=contrast=${Math.max(0, Math.min(3, +p.value || 1))}` },
  saturation:   { label: 'Sättigung',        params: ['value'], build: (p) => `eq=saturation=${Math.max(0, Math.min(3, +p.value || 1))}` },
  gamma:        { label: 'Gamma',            params: ['value'], build: (p) => `eq=gamma=${Math.max(0.1, Math.min(4, +p.value || 1))}` },
  hue:          { label: 'Farbton',          params: ['degrees'], build: (p) => `hue=h=${Number(p.degrees) || 0}` },
  grayscale:    { label: 'Schwarzweiß',      params: [], build: () => 'hue=s=0' },
  sepia:        { label: 'Sepia',            params: [], build: () => 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131' },
  vignette:     { label: 'Vignette',         params: [], build: () => 'vignette' },
  noise:        { label: 'Filmkorn',         params: ['strength'], build: (p) => `noise=alls=${Math.max(1, Math.min(60, +p.strength || 12))}:allf=t` },
  chroma_key:   { label: 'Chroma Key (Grün)', params: ['color', 'similarity', 'blend'], build: (p) => `chromakey=${p.color || '0x00ff00'}:${+p.similarity || 0.3}:${+p.blend || 0.1}` },
  text:         { label: 'Text einblenden',  params: ['text', 'size', 'color', 'y'], build: (p) => `drawtext=text='${String(p.text || '').replace(/'/g, '')}':fontsize=${+p.size || 48}:fontcolor=${p.color || 'white'}:x=(w-text_w)/2:y=${p.y === undefined ? 40 : +p.y}:box=1:boxcolor=black@0.4:boxborderw=12` },
  watermark:    { label: 'Wasserzeichen',    params: ['text'], build: (p) => `drawtext=text='${String(p.text || 'AURA').replace(/'/g, '')}':fontsize=24:fontcolor=white@0.5:x=w-text_w-20:y=h-text_h-20` },
  speed:        { label: 'Tempo',            params: ['factor'], build: (p) => { const f = Math.max(0.25, Math.min(4, +p.factor || 1)); return `setpts=${(1 / f).toFixed(4)}*PTS`; } },
  fade_in:      { label: 'Einblenden',       params: ['seconds'], build: (p) => `fade=t=in:st=0:d=${+p.seconds || 1}` },
  fade_out:     { label: 'Ausblenden',       params: ['seconds'], build: (p) => `fade=t=out:st=9999:d=${+p.seconds || 1}` },
  fade:         { label: 'Übergang Ein/Aus', params: ['seconds'], build: (p) => `fade=t=in:st=0:d=${+p.seconds || 1},fade=t=out:d=${+p.seconds || 1}` },
  rotate:       { label: 'Drehen',           params: ['degrees'], build: (p) => `rotate=${(Number(p.degrees) || 0) * Math.PI / 180}` },
  mirror:       { label: 'Spiegeln',         params: [], build: () => 'hflip' },
  flip:         { label: 'Kopfüber',         params: [], build: () => 'vflip' },
  volume:       { label: 'Lautstärke (Ton)', params: ['db'], audio: true, build: (p) => `volume=${Number(p.db) || 0}dB` },
  loudnorm:     { label: 'Lautheit normalisieren (Ton)', params: [], audio: true, build: () => 'loudnorm=I=-14:TP=-1.5:LRA=11' },
  fps:          { label: 'Bildrate',         params: ['value'], build: (p) => `fps=${Math.max(1, Math.min(120, +p.value || 30))}` },
};

// ---------------------------------------------------------------- Speicher (selbstheilend)
function defaults() { return { jobs: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const fresh = defaults(); save(fresh); return fresh; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['jobs', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
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
function audit(state, action, target, detail) {
  state.audit.unshift({ at: nowIso(), action, target: String(target || ''), detail: String(detail || '').slice(0, 200) });
  if (state.audit.length > 500) state.audit.length = 500;
}

// ---------------------------------------------------------------- ffmpeg-Erkennung
function findBinary(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const d of dirs) for (const e of exts) { const f = path.join(d, name + e); try { if (fs.existsSync(f)) return f; } catch { /* egal */ } }
  return null;
}
// Welche ffmpeg-Filter braucht ein Effekt? (Builds ohne freetype/fontconfig haben z. B. kein drawtext)
const FILTER_REQUIRES = {
  blur: ['gblur'], sharpen: ['unsharp'], brightness: ['eq'], contrast: ['eq'], saturation: ['eq'], gamma: ['eq'],
  hue: ['hue'], grayscale: ['hue'], sepia: ['colorchannelmixer'], vignette: ['vignette'], noise: ['noise'],
  chroma_key: ['chromakey'], text: ['drawtext'], watermark: ['drawtext'], speed: ['setpts'], fade: ['fade'],
  fade_in: ['fade'], fade_out: ['fade'], rotate: ['rotate'], mirror: ['hflip'], flip: ['vflip'],
  volume: ['volume'], loudnorm: ['loudnorm'], fps: ['fps'], scale: ['scale'], crop: ['crop'],
};
let _filterCache = null;
function probeFilters(force) {
  if (_filterCache && !force) return _filterCache;
  const ff = findBinary('ffmpeg');
  if (!ff) { _filterCache = { available: false, filters: [], missing_known: Object.keys(FILTER_REQUIRES) }; return _filterCache; }
  let out = '';
  try {
    const r = require('child_process').execFileSync(ff, ['-hide_banner', '-filters'], { encoding: 'utf8', timeout: 8000, maxBuffer: 4194304 });
    out = String(r);
  } catch (e) {
    out = String((e && e.stdout) || '');
  }
  const filters = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*[TSC.]+\s+([a-zA-Z0-9_]+)\s/);
    if (m) filters.push(m[1]);
  }
  const unique = [...new Set(filters)];
  const needed = [...new Set(Object.values(FILTER_REQUIRES).flat())];
  _filterCache = {
    available: unique.length > 0,
    count: unique.length,
    missing: needed.filter((f) => !unique.includes(f)),
    has: (name) => unique.includes(name),
    filters: unique,
  };
  return _filterCache;
}
function effectCapability(type) {
  const need = FILTER_REQUIRES[type] || [];
  const probe = probeFilters();
  if (!probe.available) return { type, needs: need, available: null, reason: 'ffmpeg nicht installiert' };
  const missing = need.filter((f) => !probe.has(f));
  return {
    type, needs: need, available: missing.length === 0,
    reason: missing.length ? 'dieser ffmpeg-Build hat den Filter nicht: ' + missing.join(', ') + ' — ffmpeg mit freetype/fontconfig installieren' : null,
  };
}

function ffmpegStatus() {
  const ff = findBinary('ffmpeg'), fp = findBinary('ffprobe');
  return {
    available: !!ff, ffmpeg: ff, ffprobe: fp,
    install: ff ? null : 'sudo apt-get install -y ffmpeg   # Debian/Ubuntu',
    note: ff ? 'ffmpeg gefunden — Rendern möglich.' : 'ffmpeg NICHT gefunden. Effekt-Ketten lassen sich bauen und prüfen, aber nicht rendern.',
  };
}

// ---------------------------------------------------------------- Filtergraph
// effects: [{ type, ...params }] → ffmpeg-Filterkette + Warnungen
function buildChain(effects) {
  const vParts = [], aParts = [], warnings = [];
  for (const e of Array.isArray(effects) ? effects : []) {
    const def = EFFECTS[e && e.type];
    if (!def) { warnings.push('unbekannter Effekt: ' + (e && e.type)); continue; }
    try {
      const built = def.build(e);
      if (def.audio) aParts.push(built); else vParts.push(built);
    } catch (err) { warnings.push('Effekt ' + e.type + ' fehlgeschlagen: ' + err.message); }
  }
  const chain = vParts.join(',');
  const audio_chain = aParts.join(',');
  return {
    chain, audio_chain, video_parts: vParts, audio_parts: aParts,
    parts: [...vParts, ...aParts], warnings,
    empty: vParts.length === 0 && aParts.length === 0,
  };
}

function effects() {
  return Object.entries(EFFECTS).map(([type, d]) => {
    const cap = effectCapability(type);
    return { type, label: d.label, params: d.params, needs: cap.needs, available: cap.available, reason: cap.reason };
  });
}

// ---------------------------------------------------------------- Aufträge
function createJob(input, who) {
  const src = String((input && input.input) || '');
  if (!src) return { ok: false, code: 400, error: 'input fehlt (Pfad zur Videodatei)' };
  if (!fs.existsSync(src)) return { ok: false, code: 400, error: 'Datei nicht gefunden: ' + src };
  const chain = buildChain(input && input.effects);
  if (chain.empty) return { ok: false, code: 400, error: 'mindestens einen Effekt angeben' };
  if (!chain.chain) return { ok: false, code: 400, error: 'mindestens einen BILD-Effekt angeben (nur Audio-Effekte reichen nicht)' };
  if (chain.warnings.length) return { ok: false, code: 400, error: chain.warnings.join('; ') };
  const state = load();
  const job = {
    id: 'vj-' + crypto.randomBytes(4).toString('hex'),
    input: src, effects: input.effects, chain: chain.chain, audio_chain: chain.audio_chain, chain_obj: chain,
    out_format: String((input && input.format) || 'mp4').toLowerCase(),
    status: 'READY', created_at: nowIso(), by: String(who || '').slice(0, 60),
    command: null, output: null, error: null,
  };
  job.command = commandFor(job);
  state.jobs.push(job);
  audit(state, 'video.job', job.id, job.effects.length + ' Effekte · ' + job.out_format);
  save(state);
  return { ok: true, job, ffmpeg: ffmpegStatus() };
}

function commandFor(job) {
  const out = path.join(OUT_DIR, job.id + '.' + job.out_format);
  const chain = job.chain_obj || buildChain(job.effects);
  const args = ['-y', '-i', job.input];
  if (chain.chain) args.push('-vf', chain.chain);
  if (chain.audio_chain) args.push('-af', chain.audio_chain);
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', out);
  return { bin: 'ffmpeg', args, out, video_chain: chain.chain || null, audio_chain: chain.audio_chain || null };
}

// Rendern. Ohne ffmpeg: ehrliche Absage, kein Blindflug. Immer ein Promise (gleiche Form für Aufrufer).
async function run(jobId, who) {
  const state = load();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, code: 404, error: 'Auftrag nicht gefunden' };
  const ff = ffmpegStatus();
  if (!ff.available) {
    job.status = 'BLOCKED_NO_FFMPEG';
    job.error = ff.note + ' — ' + ff.install;
    audit(state, 'video.run_blocked', job.id, 'ffmpeg fehlt');
    save(state);
    return { ok: false, code: 503, status: job.status, error: 'ffmpeg fehlt', install: ff.install, note: 'Die Effekt-Kette ist fertig gebaut und kann nach der Installation sofort laufen.', chain: job.chain };
  }
  // Fehlende Filter VOR dem Start prüfen — kein halber Lauf, klare Auskunft.
  const fehlend = [];
  for (const e of [].concat(job.effects || [])) {
    const cap = effectCapability(e.type);
    if (cap.available === false) fehlend.push({ effect: e.type, needs: cap.needs, reason: cap.reason });
  }
  if (fehlend.length) {
    job.status = 'BLOCKED_MISSING_FILTERS';
    job.error = 'Filter fehlen im ffmpeg-Build: ' + fehlend.map((f) => f.effect + ' (' + f.needs.join(',') + ')').join('; ');
    audit(state, 'video.run_blocked', job.id, job.error.slice(0, 150));
    save(state);
    return {
      ok: false, code: 501, status: job.status, error: job.error, missing: fehlend,
      install: 'ffmpeg mit freetype/fontconfig nötig (z. B. apt-get install ffmpeg aus den Distribution-Paketen statt eines Static-Builds)',
      note: 'Andere Effekte der Kette laufen; nur die genannten Filter fehlen in diesem Build.', chain: job.chain,
    };
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const cmd = commandFor(job);
  job.status = 'RUNNING';
  job.started_at = nowIso();
  save(state);
  return await new Promise((resolve) => {
    execFile(cmd.bin, cmd.args, { timeout: 15 * 60 * 1000, maxBuffer: 1024 * 1024 * 16 }, (err, stdout, stderr) => {
      const st = load();
      const j = st.jobs.find((x) => x.id === jobId) || job;
      if (err) {
        j.status = 'FAILED';
        j.error = String((stderr || err.message || '').slice(-600));
        audit(st, 'video.failed', j.id, j.error.slice(0, 120));
      } else {
        j.status = 'DONE';
        j.finished_at = nowIso();
        try { j.output = cmd.out; j.bytes = fs.statSync(cmd.out).size; } catch { /* egal */ }
        audit(st, 'video.done', j.id, (j.bytes || 0) + ' Bytes');
        j.stored = storeAuto(j, { by: j.by });   // fertiges Video in den Inhalts-Speicher
      }
      save(st);
      resolve({ ok: !err, job: j, output: j.output || null, error: j.error || null });
    });
  });
}

function status() {
  const state = load();
  const ff = ffmpegStatus();
  const probe = ff.available ? probeFilters() : null;
  return {
    area: 'VIDEO', mode: ff.available ? 'LIVE' : 'GEBAUT-WARTET-AUF-FFMPEG',
    ffmpeg: ff,
    filters: probe ? { count: probe.count, missing_of_needed: probe.missing } : null,
    effects_count: Object.keys(EFFECTS).length,
    counts: {
      jobs: state.jobs.length,
      done: state.jobs.filter((j) => j.status === 'DONE').length,
      blocked: state.jobs.filter((j) => j.status === 'BLOCKED_NO_FFMPEG').length,
      failed: state.jobs.filter((j) => j.status === 'FAILED').length,
    },
    jobs: state.jobs.slice(-20).map((j) => ({ id: j.id, status: j.status, effects: j.effects.map((e) => e.type), chain: (j.chain || '').slice(0, 120), audio_chain: j.audio_chain || null, output: j.output, bytes: j.bytes || 0 })),
    audit_tail: state.audit.slice(0, 10),
    note: 'Effekt-Ketten werden immer gebaut und sind prüfbar; gerendert wird nur mit installiertem ffmpeg.',
  };
}

function preview(input) {
  const chain = buildChain(input && input.effects);
  const fehlend = [];
  for (const e of [].concat((input && input.effects) || [])) {
    const cap = effectCapability(e.type);
    if (cap.available === false) fehlend.push({ effect: e.type, needs: cap.needs, reason: cap.reason });
  }
  const p = {
    ok: chain.warnings.length === 0 && fehlend.length === 0,
    chain: chain.chain || null, audio_chain: chain.audio_chain || null,
    video_steps: chain.video_parts, audio_steps: chain.audio_parts,
    warnings: chain.warnings, missing_filters: fehlend, ffmpeg: ffmpegStatus(),
  };
  if (chain.chain || chain.audio_chain) {
    p.preview_command = 'ffmpeg -y -i "' + ((input && input.input) || 'input.mp4') + '"'
      + (chain.chain ? ' -vf "' + chain.chain + '"' : '')
      + (chain.audio_chain ? ' -af "' + chain.audio_chain + '"' : '')
      + ' -c:v libx264 -pix_fmt yuv420p out.mp4';
  }
  return p;
}

// Fertige Videos automatisch in den Inhalts-Speicher (Fassungen bleiben erhalten).
function storeAuto(job, out) {
  try {
    const cs = require('./content_store');
    return cs.register({
      kind: 'VIDEO', title: job.title || `Video ${job.id}`,
      body: `Effekte: ${(job.effects || []).map((e) => (Array.isArray(e) ? e[0] : (e && e.id)) || '?').join(', ') || 'keine'}`,
      tags: ['video'], source_module: 'video_studio', source_ref: job.id,
      by: (out && out.by) || 'AURA',
      file: job.output && fs.existsSync(job.output) ? job.output : null, role: 'haupt',
    });
  } catch (e) { return { ok: false, error: e.message }; }
}

module.exports = { EFFECTS, FILTER_REQUIRES, FILE, OUT_DIR, effects, buildChain, createJob, run, status, preview, ffmpegStatus, probeFilters, effectCapability, findBinary, load };
