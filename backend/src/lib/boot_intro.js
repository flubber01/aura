'use strict';
// AURA · Startvideo: die 10 Sekunden beim Hochfahren.
//
// Gerendert wird wirklich: Die Bilder entstehen hier Pixel für Pixel (PPM-Sequenz, kein Fremdwerkzeug
// fürs Zeichnen), der Ton kommt aus dem eigenen Musik-Renderer, und ffmpeg macht daraus eine
// MP4-Datei. Fehlt ffmpeg, bleibt es ehrlich bei BLOCKED_NO_FFMPEG statt bei einem schwarzen Kasten.
//
// Das Bild: AURA-Schriftzug aus einer eigenen 5×7-Punktmatrix (damit braucht es keinen Schriftsatz im
// System), darum Kreise, die atmen, und ein Pegelband, das mit dem Ton läuft. 10 Sekunden, 24 Bilder
// pro Sekunde, 240 Einzelbilder.
//
// Steuerung: Titel, Untertitel, Farben, Dauer und Musikstil sind einstellbar.
const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

const DIR = process.env.AURA_INTRO_DIR || path.join(__dirname, '..', 'data', 'intro');
const FILE = process.env.AURA_INTRO_FILE || path.join(__dirname, '..', 'data', 'boot_intro.json');
const FRAMES = process.env.AURA_INTRO_FRAMES || path.join(DIR, 'frames');

// 5×7-Punktmatrix: damit lässt sich Text ohne Schriftsatz zeichnen.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'],
  F: ['11111', '10000', '11110', '10000', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '11111', '10001', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '11100', '10100', '10010', '10001', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10001', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const PALETTES = {
  aurora: { bg: [7, 12, 16], accent: [90, 209, 192], accent2: [127, 178, 255], gold: [232, 195, 122] },
  gold: { bg: [14, 10, 6], accent: [232, 195, 122], accent2: [255, 226, 168], gold: [255, 244, 214] },
  creed: { bg: [7, 12, 16], accent: [232, 195, 122], accent2: [90, 209, 192], gold: [246, 244, 239] },
  night: { bg: [5, 8, 18], accent: [127, 178, 255], accent2: [173, 199, 255], gold: [232, 195, 122] },
};

function defaults() { return { intros: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['intros', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function ffmpegBin() {
  const direct = [process.env.AURA_FFMPEG, '/tmp/ffbin/ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
  for (const c of direct) {
    if (c && fs.existsSync(c)) {
      try { execFileSync(c, ['-version'], { stdio: 'ignore', timeout: 4000 }); return c; } catch { /* weiter */ }
    }
  }
  for (const name of ['ffmpeg', 'ffmpeg7']) {
    try {
      const out = execFileSync('sh', ['-c', `command -v ${name} || true`], { encoding: 'utf8' }).trim();
      if (out) return out;
    } catch { /* weiter */ }
  }
  return null;
}

// ---------------------------------------------------------------- Zeichnen (ohne Fremdbibliothek)
function canvas(w, h, bg) {
  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[i * 3] = bg[0]; px[i * 3 + 1] = bg[1]; px[i * 3 + 2] = bg[2]; }
  return { w, h, px };
}
function setPixel(c, x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const o = (y * c.w + x) * 3;
  const a = alpha === undefined ? 1 : Math.max(0, Math.min(1, alpha));
  c.px[o] = Math.round(c.px[o] * (1 - a) + rgb[0] * a);
  c.px[o + 1] = Math.round(c.px[o + 1] * (1 - a) + rgb[1] * a);
  c.px[o + 2] = Math.round(c.px[o + 2] * (1 - a) + rgb[2] * a);
}
function circle(c, cx, cy, r, rgb, thickness, alpha) {
  const t = thickness || 1;
  for (let y = Math.floor(cy - r - t); y <= cy + r + t; y++) {
    for (let x = Math.floor(cx - r - t); x <= cx + r + t; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - r) <= t / 2) setPixel(c, x, y, rgb, alpha);
    }
  }
}
function text(c, str, x, y, scale, rgb, alpha) {
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const glyph = FONT[ch] || FONT[' '];
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
      if (glyph[gy][gx] === '1') {
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) setPixel(c, cx + gx * scale + sx, y + gy * scale + sy, rgb, alpha);
      }
    }
    cx += 6 * scale;
  }
  return cx;
}
function textWidth(str, scale) { return String(str).length * 6 * scale; }

// Das Hauszeichen: Ring (Ton), zwei Straßen-Linien, Punkt in der Mitte — wie das Logo, nur gezeichnet.
function mark(c, cx, cy, r, pal, alpha) {
  circle(c, cx, cy, r, pal.gold, Math.max(1.6, r * 0.022), alpha);
  circle(c, cx, cy, r * 0.82, pal.accent, Math.max(1, r * 0.012), alpha * 0.75);
  // Straße: zwei Linien vom unteren Rand zur Mitte (wie im SVG-Logo)
  for (let i = 0; i <= 60; i++) {
    const k = i / 60;
    const x = cx - r * 0.62 + k * r * 0.62, y = cy + r * 0.62 - k * r * 0.62;
    for (let d = -1; d <= 1; d++) setPixel(c, Math.round(x + d), Math.round(y + d), pal.gold, alpha);
    const x2 = cx + r * 0.62 - k * r * 0.62;
    for (let d = -1; d <= 1; d++) setPixel(c, Math.round(x2 + d), Math.round(y + d), pal.accent, alpha * 0.85);
  }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) setPixel(c, Math.round(cx + dx), Math.round(cy + dy), pal.gold, alpha);
}

// Ein Bild bauen. Zeit t in Sekunden, Pegel 0…1 kommt vom Ton.
function frame(w, h, t, total, opts) {
  const pal = PALETTES[opts.palette] || PALETTES.aurora;
  const c = canvas(w, h, pal.bg);
  const cx = w / 2, cy = h / 2;

  // Hintergrund-Verlauf
  for (let y = 0; y < h; y++) {
    const k = y / h;
    const tint = [pal.accent[0] * 0.10 * (1 - k), pal.accent2[1] * 0.12 * (1 - k), pal.accent2[2] * 0.16 * (1 - k)];
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      c.px[o] = Math.min(255, c.px[o] + tint[0]); c.px[o + 1] = Math.min(255, c.px[o + 1] + tint[1]); c.px[o + 2] = Math.min(255, c.px[o + 2] + tint[2]);
    }
  }

  // Das Hauszeichen atmet ein (Logo statt neutraler Ringe).
  const grow = Math.min(1, t / 2.2);
  const markR = h * 0.24 * (0.55 + 0.45 * grow);
  mark(c, cx, cy - h * 0.06, markR, pal, 0.9 * grow);
  for (let i = 1; i <= 2; i++) {
    const phase = t * (0.7 + i * 0.22) + i * 1.4;
    const r = (h * 0.29 + i * h * 0.04) * (0.84 + 0.16 * Math.sin(phase)) * (0.35 + 0.65 * grow);
    circle(c, cx, cy - h * 0.06, r, i === 1 ? pal.accent2 : pal.accent, 1.2, 0.34 - i * 0.08);
  }

  // Pegelband unten, läuft mit dem Ton
  const bars = 44, bw = Math.floor((w * 0.8) / bars), x0 = Math.floor(w * 0.1);
  for (let i = 0; i < bars; i++) {
    const lvl = Math.abs(Math.sin(t * 2.1 + i * 0.55)) * (0.4 + 0.6 * opts.level);
    const bh = Math.max(2, Math.round(lvl * h * 0.045));
    const col = i % 7 === 0 ? pal.gold : pal.accent;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw - 2; x++) setPixel(c, x0 + i * bw + x, h - 8 - y, col, 0.6);
  }

  // Schriftzug: erst einblenden, dann stehen lassen
  const fade = Math.min(1, Math.max(0, (t - 0.5) / 1.2));
  const scale = Math.max(2, Math.floor(h / 90));
  const title = String(opts.title || 'CREED STREET').toUpperCase();
  const tw = textWidth(title, scale);
  text(c, title, Math.round(cx - tw / 2), Math.round(cy + h * 0.20), scale, pal.gold, fade);

  // Zweite Zeile: STUDIOS (kleiner, gesperrt)
  if (opts.brand_line !== false) {
    const s1 = Math.max(1, Math.floor(scale * 0.5));
    const line2 = String(opts.brand2 || 'STUDIOS').toUpperCase();
    const w2 = textWidth(line2, s1);
    text(c, line2, Math.round(cx - w2 / 2), Math.round(cy + h * 0.20 + 9 * scale), s1, pal.accent, fade * 0.95);
  }

  // Untertitel ab Sekunde 3
  if (t > 3 && opts.subtitle) {
    const s2 = Math.max(1, Math.floor(scale * 0.42));
    const sw = textWidth(opts.subtitle, s2);
    const a2 = Math.min(1, (t - 3) / 0.8);
    text(c, opts.subtitle, Math.round(cx - sw / 2), Math.round(cy - h * 0.45), s2, pal.accent2, a2 * 0.9);
  }

  // Copyright am unteren Rand — klein, aber immer da
  if (opts.copyright !== false) {
    const s3 = Math.max(1, Math.floor(scale * 0.35));
    const copy = String(opts.copyright_text || '© CREED STREET STUDIOS 2026');
    text(c, copy, 10, 9, s3, pal.accent2, 0.6 * fade);
  }

  // Fortschrittsband über die ganze Dauer
  const done = Math.round(w * Math.min(1, t / total));
  for (let x = 0; x < done; x++) for (let y = 0; y < 3; y++) setPixel(c, x, 0 + y, pal.accent, 0.85);

  // Abblenden am Ende
  if (t > total - 1.2) {
    const k = (t - (total - 1.2)) / 1.2;
    for (let i = 0; i < c.px.length; i++) c.px[i] = Math.round(c.px[i] * (1 - k));
  }
  return c;
}

function writePPM(c, file) {
  const header = Buffer.from(`P6\n${c.w} ${c.h}\n255\n`, 'latin1');
  fs.writeFileSync(file, Buffer.concat([header, c.px]));
}

// ---------------------------------------------------------------- Rendern
function renderToPPM(input, done) {
  const p = input || {};
  const w = Math.max(160, Math.min(1280, Number(p.width) || 640));
  const h = Math.max(90, Math.min(720, Number(p.height) || 360));
  const total = Math.max(3, Math.min(30, Number(p.seconds) || 10));
  const fps = Math.max(12, Math.min(30, Number(p.fps) || 24));
  const count = Math.round(total * fps);
  const opts = {
    title: String(p.title || 'CREED STREET'),
    brand2: String(p.brand2 || 'STUDIOS'),
    subtitle: String(p.subtitle || 'SYSTEM STARTET'),
    palette: String(p.palette || 'creed'),
    level: Number(p.level) || 0.75,
    brand_line: p.brand_line !== false,
    copyright: p.copyright !== false,
    copyright_text: String(p.copyright_text || '© CREED STREET STUDIOS 2026'),
  };
  fs.mkdirSync(FRAMES, { recursive: true });
  for (let i = 0; i < count; i++) {
    const t = i / fps;
    writePPM(frame(w, h, t, total, opts), path.join(FRAMES, `f-${String(i).padStart(4, '0')}.ppm`));
  }
  return { w, h, total, fps, count, frames_dir: FRAMES, opts };
}

function musicSting(input) {
  const p = input || {};
  try {
    const mr = require('./music_render');
    const style = mr.STYLES[String(p.music_style || 'cinematic')] ? String(p.music_style || 'cinematic') : 'cinematic';
    const seconds = Number(p.seconds) || 10;
    const bpm = (mr.STYLES[style] && Number(mr.STYLES[style].bpm)) || 90;
    const barDur = (60 / bpm) * 4;
    const bars = Math.max(2, Math.round(seconds / barDur));
    const r = mr.render({ style, bars, seed: Number(p.seed) || 4711, title: p.title || 'AURA Start' });
    return { ok: true, file: r.file, style, bars, bpm, duration: r.duration, note: 'Ton kommt aus dem eigenen Musik-Renderer; kein Fremdmaterial.' };
  } catch (e) { return { ok: false, error: 'Musik konnte nicht gerendert werden: ' + e.message }; }
}

function render(input) {
  const p = input || {};
  const bin = ffmpegBin();
  if (!bin) {
    return {
      ok: false, code: 409, status: 'BLOCKED_NO_FFMPEG',
      error: 'ffmpeg ist nicht installiert — ohne ffmpeg entsteht keine Videodatei.',
      install: 'sudo apt-get install -y ffmpeg (oder imageio-ffmpeg und AURA_FFMPEG auf den Pfad setzen)',
      frames_possible: true,
      note: 'Die Einzelbilder kann AURA auch ohne ffmpeg zeichnen; zum Video fehlt der Kodierer.',
    };
  }
  const t0 = Date.now();
  const built = renderToPPM(p, null);
  const audio = musicSting(p);
  const outDir = path.join(DIR, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const id = 'intro-' + Math.random().toString(16).slice(2, 8);
  const out = path.join(outDir, `${id}.mp4`);
  const args = ['-y', '-framerate', String(built.fps), '-i', path.join(FRAMES, 'f-%04d.ppm')];
  if (audio.ok) args.push('-i', audio.file);
  args.push('-vf', `scale=${Number(p.out_width) || 1280}:${Number(p.out_height) || 720}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p');
  if (audio.ok) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push(out);

  const started = Date.now();
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 * 32 }, (err, stdout, stderr) => {
      const entry = {
        id, at: new Date().toISOString(),
        seconds: built.total, fps: built.fps, frames: built.count, source_size: `${built.w}x${built.h}`,
        out: err ? null : out, size: err ? 0 : (fs.existsSync(out) ? fs.statSync(out).size : 0),
        audio: audio.ok ? audio.style : null, audio_error: audio.ok ? null : audio.error,
        ms: Date.now() - started, status: err ? 'FAILED' : 'DONE',
        error: err ? String((stderr || err.message || '')).slice(-400) : null,
      };
      const data = load();
      data.intros.unshift(entry); data.intros = data.intros.slice(0, 30);
      data.audit.unshift({ at: entry.at, action: 'render', id, status: entry.status });
      save(data);
      // Einzelbilder wieder wegräumen — sie haben ihren Zweck erfüllt.
      try { for (const f of fs.readdirSync(FRAMES)) fs.unlinkSync(path.join(FRAMES, f)); } catch { /* egal */ }
      resolve({ ok: !err, status: entry.status, video: entry, build_ms: Date.now() - t0, audio: audio.ok ? { style: audio.style, file: audio.file } : audio, error: entry.error });
    });
  });
}

function list() {
  const d = load();
  return { ok: true, count: d.intros.length, intros: d.intros };
}

function status() {
  const d = load();
  const bin = ffmpegBin();
  return {
    area: 'INTRO', module: 'boot_intro', state: 'live', dir: DIR, file: FILE,
    ffmpeg: bin || 'NICHT GEFUNDEN',
    mode: bin ? 'RENDERN MÖGLICH' : 'NUR EINZELBILDER (kein ffmpeg)',
    rendered: d.intros.length, last: d.intros[0] ? { id: d.intros[0].id, status: d.intros[0].status, seconds: d.intros[0].seconds, size: d.intros[0].size } : null,
    defaults: { seconds: 10, fps: 24, source: '640x360', out: '1280x720', title: 'CREED STREET', brand2: 'STUDIOS', palette: 'creed' },
    components: ['eigene 5×7-Schrift (kein Schriftsatz im System nötig)', 'zeichnet Kreise, Pegelband, Fortschritt', 'Musik aus dem eigenen Renderer', 'ffmpeg kodiert zu MP4 (H.264 + AAC)'],
    honesty: ['Ohne ffmpeg gibt es kein Video — dann steht BLOCKED_NO_FFMPEG da.', 'Die Einzelbilder sind echte, hier gezeichnete Bilder (kein Farbverlauf-Platzhalter).', 'Kein Fremdmaterial, keine Stock-Videos, keine Wasserzeichen.'],
  };
}

module.exports = {
  meta: { area: 'INTRO', id: 'boot_intro', name: 'Startvideo (10 s, animiert, selbst gerendert)', state: 'live' },
  actions: { status: () => status(), palettes: () => ({ ok: true, palettes: Object.keys(PALETTES) }), frame: (p) => ({ ok: true, note: 'Einzelbild als PPM schreiben: POST mit file', size: { w: Number((p || {}).width) || 640, h: Number((p || {}).height) || 360 } }), render: (p) => render(p || {}), list: () => list(), frames_dir: () => ({ ok: true, dir: FRAMES }) },
  FONT, PALETTES, frame, renderToPPM, musicSting, render, list, status, ffmpegBin, DIR,
};
