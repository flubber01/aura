'use strict';
// AURA · Musik-Renderer: erzeugt echtes Audio (16-Bit PCM-WAV) — kein Plan, sondern Schall.
//
// Warum: AURA hatte Musik-Planung (groove/orchestrate), aber im ganzen Projekt existierte
// keine einzige Audio-Ausgabe (kein RIFF/WAVE, kein Buffer-PCM). Dieser Renderer schließt das:
// Akkorde, Bass, Melodie und Schlagzeug werden als Samples berechnet und als .wav geschrieben.
//
// Eigenschaften:
//  • Determinismus: gleicher Seed → gleiches Ergebnis (Byte-identisch). Kein Zufall über Zeit.
//  • Kein externer Dienst, kein Modell-Download, kein ffmpeg. Reines Node.
//  • Stems: Schlagzeug/Bass/Akkorde/Melodie lassen sich einzeln exportieren.
//  • Ehrlich: was hier entsteht, ist ein instrumentaler Entwurf ("SKETCH"), kein KI-Gesang.
//
// Ausgabe: backend/src/data/audio/<id>.wav (gitignoriert).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT_DIR = process.env.AURA_AUDIO_DIR || path.join(__dirname, '..', 'data', 'audio');
const SAMPLE_RATE = 22050;   // Entwurfsqualität: kleinere Dateien, deutlich hörbar

// ---------------------------------------------------------------- Zufall (deterministisch)
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => parseInt(crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8), 16);

// ---------------------------------------------------------------- Musiktheorie
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 3, 5, 7, 9, 10],
};
const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
function midiOf(note, octave) {
  const i = NOTES.indexOf(String(note).toUpperCase());
  if (i < 0) throw new Error('unbekannter Grundton: ' + note);
  return i + 12 * (Number(octave) + 1);
}
// Akkordfolgen als Stufen auf der Tonleiter (0-basiert), 1 Takt pro Stufe
const PROGRESSIONS = {
  pop: [0, 4, 5, 3],
  minor_epic: [0, 5, 3, 4],
  lofi: [1, 4, 0, 3],
  house: [0, 3, 4, 3],
  trap: [0, 5, 1, 4],
  cinematic: [0, 3, 5, 4],
  schlager: [0, 3, 4, 0],
};
const STYLES = {
  lofi:      { bpm: 78,  prog: 'lofi',       drums: 'boom_bap', swing: 0.12, padOct: 4, leadOct: 5, brightness: 0.45, reverb: 0.35, scale: 'dorian' },
  trap:      { bpm: 138, prog: 'trap',       drums: 'trap',     swing: 0.0,  padOct: 4, leadOct: 6, brightness: 0.7,  reverb: 0.2,  scale: 'minor' },
  house:     { bpm: 124, prog: 'house',      drums: 'fourfloor',swing: 0.0,  padOct: 4, leadOct: 5, brightness: 0.6,  reverb: 0.25, scale: 'minor' },
  pop:       { bpm: 104, prog: 'pop',        drums: 'pop',      swing: 0.03, padOct: 4, leadOct: 5, brightness: 0.65, reverb: 0.28, scale: 'major' },
  cinematic: { bpm: 72,  prog: 'cinematic',  drums: 'sparse',   swing: 0.0,  padOct: 3, leadOct: 5, brightness: 0.4,  reverb: 0.5,  scale: 'minor' },
  schlager:  { bpm: 126, prog: 'schlager',   drums: 'offbeat',  swing: 0.02, padOct: 4, leadOct: 5, brightness: 0.8,  reverb: 0.2,  scale: 'major' },
};

// ---------------------------------------------------------------- Signalverarbeitung
// Einfacher Tiefpass (Ein-Pol) + weiches Clipping
function lowpass(buf, cutoff) {
  const dt = 1 / SAMPLE_RATE;
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < buf.length; i++) { y += a * (buf[i] - y); buf[i] = y; }
  return buf;
}
function softClip(buf, drive) {
  const d = drive || 1;
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * d);
  return buf;
}
// Reverb: mehrere verzögerte Kopien (Schroeder-artig, billig aber wirkt)
function reverb(buf, mix, seed) {
  if (!mix) return buf;
  const r = rng(seed + 7);
  const taps = [0.037, 0.061, 0.089, 0.127, 0.163];
  const out = new Float32Array(buf.length);
  for (const t of taps) {
    const d = Math.floor(t * SAMPLE_RATE * (0.9 + r() * 0.2));
    const g = mix * (0.35 + r() * 0.2);
    for (let i = d; i < buf.length; i++) out[i] += buf[i - d] * g;
  }
  for (let i = 0; i < buf.length; i++) out[i] += buf[i];
  return out;
}
// Stereobreite: leichte Verzögerung zwischen L/R
function widen(mono, seed) {
  const d = 11; // ~0.5 ms
  const l = new Float32Array(mono.length), rr = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    l[i] = mono[i];
    rr[i] = i >= d ? mono[i - d] * 0.92 + mono[i] * 0.08 : mono[i];
  }
  return [l, rr];
}

// ---------------------------------------------------------------- Instrumente
function env(t, a, d, s, r, dur) {           // ADSR in Sekunden
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur) return s;
  const rt = t - dur;
  return rt < r ? s * (1 - rt / r) : 0;
}
function addNote(buf, start, dur, f, gain, kind, opts) {
  const o = opts || {};
  const i0 = Math.floor(start * SAMPLE_RATE);
  const n = Math.floor((dur + (o.release || 0.08)) * SAMPLE_RATE);
  const a = o.a !== undefined ? o.a : 0.008, d = o.d || 0.12, s = o.s !== undefined ? o.s : 0.6, r = o.r || 0.08;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i; if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const e = env(t, a, d, s, r, dur);
    if (e <= 0) continue;
    let v = 0;
    const ph = 2 * Math.PI * f * t;
    if (kind === 'sine') v = Math.sin(ph);
    else if (kind === 'tri') v = 2 * Math.abs(2 * (((f * t) % 1)) - 1) - 1;
    else if (kind === 'saw') v = 2 * ((f * t) % 1) - 1;
    else if (kind === 'square') v = ((f * t) % 1) < 0.5 ? 1 : -1;
    else if (kind === 'epiano') { // FM: Träger + modulierender Sinus
      const mod = Math.sin(ph * 2) * (o.fm || 1.4) * Math.exp(-t * 3);
      v = Math.sin(ph + mod);
    } else if (kind === 'pluck') { // Karplus-Strong-artig (kurz)
      v = Math.sin(ph) * Math.exp(-t * 6) + 0.3 * Math.sin(ph * 2) * Math.exp(-t * 9);
    }
    buf[idx] += v * e * gain;
  }
}
function addKick(buf, start, gain) {
  const dur = 0.28, i0 = Math.floor(start * SAMPLE_RATE), n = Math.floor(dur * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    const idx = i0 + i; if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const f = 150 * Math.exp(-t * 22) + 42;            // Tonhöhe fällt ab
    const e = Math.exp(-t * 9);
    buf[idx] += Math.sin(2 * Math.PI * f * t) * e * gain;
  }
}
function addSnare(buf, start, gain, r) {
  const dur = 0.2, i0 = Math.floor(start * SAMPLE_RATE), n = Math.floor(dur * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    const idx = i0 + i; if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const e = Math.exp(-t * 18);
    const tone = Math.sin(2 * Math.PI * 190 * t) * 0.5;
    buf[idx] += ((r() * 2 - 1) * 0.8 + tone) * e * gain;
  }
}
function addHat(buf, start, gain, r, len) {
  const dur = len || 0.06, i0 = Math.floor(start * SAMPLE_RATE), n = Math.floor(dur * SAMPLE_RATE);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i; if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const e = Math.exp(-t * 60);
    const white = r() * 2 - 1;
    const hp = white - prev; prev = white;               // Hochpass = Differenz
    buf[idx] += hp * e * gain;
  }
}
function addClap(buf, start, gain, r) {
  for (let k = 0; k < 3; k++) {
    const off = start + k * 0.011;
    const i0 = Math.floor(off * SAMPLE_RATE), n = Math.floor(0.09 * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      const idx = i0 + i; if (idx >= buf.length) break;
      const t = i / SAMPLE_RATE;
      buf[idx] += (r() * 2 - 1) * Math.exp(-t * 45) * gain * 0.5;
    }
  }
}

// ---------------------------------------------------------------- Schlagzeug-Muster
function drumPattern(style, bar, r, swing) {
  const hits = [];
  const B = 4;                      // 4 Beats pro Takt
  const off = (b, sw) => (b / B) + (sw && (b % 1 === 0.5) ? swing * 0.05 : 0);
  switch (style) {
    case 'fourfloor':
      for (let b = 0; b < B; b++) { hits.push({ t: b / B, k: 'kick', g: 0.9 }); hits.push({ t: b / B + 0.5 / B, k: 'hat', g: 0.22 }); }
      hits.push({ t: 0.5, k: 'clap', g: 0.5 }); hits.push({ t: 0.25, k: 'hat', g: 0.3 });
      break;
    case 'trap':
      hits.push({ t: 0, k: 'kick', g: 0.95 }); hits.push({ t: 0.42, k: 'kick', g: 0.8 });
      hits.push({ t: 0.62, k: 'kick', g: 0.75 }); hits.push({ t: 0.5, k: 'snare', g: 0.55 });
      for (let i = 0; i < 16; i++) hits.push({ t: i / 16, k: 'hat', g: i % 4 === 0 ? 0.3 : 0.16, len: 0.035 });
      hits.push({ t: 0.875, k: 'clap', g: 0.4 });
      break;
    case 'boom_bap':
      hits.push({ t: 0, k: 'kick', g: 0.9 }); hits.push({ t: 0.375, k: 'snare', g: 0.6 });
      hits.push({ t: 0.5, k: 'kick', g: 0.7 }); hits.push({ t: 0.875, k: 'snare', g: 0.5 });
      for (let i = 0; i < 8; i++) hits.push({ t: i / 8 + (i % 2 ? swing * 0.05 : 0), k: 'hat', g: 0.2 });
      break;
    case 'pop':
      hits.push({ t: 0, k: 'kick', g: 0.85 }); hits.push({ t: 0.25, k: 'kick', g: 0.6 });
      hits.push({ t: 0.5, k: 'snare', g: 0.6 }); hits.push({ t: 0.75, k: 'snare', g: 0.5 });
      for (let i = 0; i < 8; i++) hits.push({ t: i / 8, k: 'hat', g: 0.2 });
      break;
    case 'offbeat':
      for (let b = 0; b < B; b++) {
        hits.push({ t: b / B, k: 'kick', g: 0.85 });
        hits.push({ t: b / B + 0.5 / B, k: 'hat', g: 0.28 });
        hits.push({ t: b / B + 0.5 / B, k: 'clap', g: 0.35 });
      }
      break;
    case 'sparse':
      hits.push({ t: 0, k: 'kick', g: 0.7 });
      if (bar % 2 === 1) hits.push({ t: 0.5, k: 'snare', g: 0.35 });
      hits.push({ t: (bar % 2 ? 0.75 : 0.25), k: 'hat', g: 0.14 });
      break;
    default:
      hits.push({ t: 0, k: 'kick', g: 0.8 });
  }
  return hits.map((h) => ({ ...h, t: h.t + (h.k === 'hat' && swing ? swing * 0.02 : 0) }));
}

// ---------------------------------------------------------------- Hauptrender
function renderSong(plan) {
  const p = plan || {};
  const style = STYLES[p.style] ? p.style : 'lofi';
  const cfg = STYLES[style];
  const seed = Number.isFinite(p.seed) ? p.seed : hash(p.title || p.prompt || style);
  const r = rng(seed);
  const rDrums = rng(seed + 1);
  const bpm = Number(p.bpm) || cfg.bpm;
  const bars = Math.max(2, Math.min(64, Number(p.bars) || 8));
  const beat = 60 / bpm;
  const barDur = beat * 4;
  const total = bars * barDur + 1.2;                     // + Ausklang
  const N = Math.ceil(total * SAMPLE_RATE);
  const scale = SCALES[p.scale || cfg.scale] || SCALES.minor;
  const root = midiOf(p.key || 'A', p.octave !== undefined ? p.octave : 3);
  const prog = PROGRESSIONS[cfg.prog];

  const bufDrums = new Float32Array(N), bufBass = new Float32Array(N),
        bufPad = new Float32Array(N), bufLead = new Float32Array(N);
  const want = (k) => !p.include || p.include.includes(k);

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * barDur;
    const deg = prog[bar % prog.length];
    const chordRoot = root + scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
    const triad = [0, 2, 4].map((k) => root + scale[(deg + k) % scale.length] + 12 * Math.floor((deg + k) / scale.length));

    // --- Schlagzeug
    if (want('drums')) {
      for (const h of drumPattern(cfg.drums, bar, rDrums, cfg.swing)) {
        const at = t0 + h.t * barDur;
        if (h.k === 'kick') addKick(bufDrums, at, h.g);
        else if (h.k === 'snare') addSnare(bufDrums, at, h.g, rDrums);
        else if (h.k === 'clap') addClap(bufDrums, at, h.g, rDrums);
        else addHat(bufDrums, at, h.g, rDrums, h.len);
      }
      if (bar % 4 === 3) { // Fill am Taktende
        for (let i = 0; i < 4; i++) addSnare(bufDrums, t0 + barDur - 0.4 + i * 0.1, 0.32 + i * 0.05, rDrums);
      }
    }
    // --- Bass (Grundton, Achtelrhythmus je Stil)
    if (want('bass')) {
      const bf = freq(chordRoot - 12);
      const hits = cfg.drums === 'trap' ? 6 : 4;
      for (let i = 0; i < hits; i++) {
        const at = t0 + (i / hits) * barDur;
        addNote(bufBass, at, barDur / hits * 0.85, bf, 0.5, 'sine', { a: 0.004, d: 0.08, s: 0.75, r: 0.06 });
      }
    }
    // --- Akkordfläche
    if (want('chords')) {
      const padBase = 12 * (cfg.padOct - 3);
      for (const m of triad) {
        addNote(bufPad, t0, barDur * 0.95, freq(m + padBase), 0.16, cfg.drums === 'trap' ? 'tri' : 'saw', { a: 0.12, d: 0.4, s: 0.5, r: 0.3 });
      }
      // hoher Liegeton als Glanz
      addNote(bufPad, t0, barDur * 0.9, freq(chordRoot + 12 * (cfg.padOct - 2)), 0.05, 'sine', { a: 0.3, d: 0.5, s: 0.4, r: 0.4 });
    }
    // --- Melodie: Tonleiter, rhythmisch, mit Pausen
    if (want('melody')) {
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        if (r() < (cfg.drums === 'sparse' ? 0.45 : 0.32)) continue;   // Pause
        const pick = Math.floor(r() * 5) + (r() < 0.25 ? 2 : 0);
        const deg2 = deg + pick;
        const m = root + 12 * (cfg.leadOct - 3) + scale[deg2 % scale.length] + 12 * Math.floor(deg2 / scale.length);
        const durS = (barDur / steps) * (r() < 0.2 ? 2 : 1) * 0.9;
        addNote(bufLead, t0 + (s / steps) * barDur, durS, freq(m), 0.17, cfg.brightness > 0.55 ? 'pluck' : 'epiano', { a: 0.005, d: 0.2, s: 0.35, r: 0.18 });
      }
    }
  }

  // --- Effekte je Bus
  lowpass(bufPad, 900 + cfg.brightness * 2600);
  lowpass(bufLead, 1800 + cfg.brightness * 4000);
  lowpass(bufBass, 260);
  lowpass(bufDrums, 6500);
  const padR = reverb(bufPad, cfg.reverb, seed);
  const leadR = reverb(bufLead, cfg.reverb * 0.8, seed);
  const drumsC = softClip(bufDrums, 1.3);
  const bassC = softClip(bufBass, 1.2);

  // --- Summe
  const mix = new Float32Array(N);
  for (let i = 0; i < N; i++) mix[i] = drumsC[i] * 0.9 + bassC[i] * 0.8 + padR[i] * 0.55 + leadR[i] * 0.5;
  // Ausblenden am Ende
  const fade = Math.floor(0.9 * SAMPLE_RATE);
  for (let i = 0; i < fade; i++) { const idx = N - fade + i; if (idx >= 0) mix[idx] *= 1 - i / fade; }
  // Normalisieren auf -1.5 dBFS
  let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mix[i]));
  const norm = peak > 0 ? 0.84 / peak : 1;
  for (let i = 0; i < N; i++) mix[i] *= norm;

  return {
    style, bpm, bars, seed, sampleRate: SAMPLE_RATE, duration: N / SAMPLE_RATE,
    stems: { drums: drumsC, bass: bassC, chords: padR, melody: leadR, mix },
    progression: prog.map((d) => scale[d % scale.length] + (p.key || 'A')).join(' '),
  };
}

// ---------------------------------------------------------------- WAV schreiben
function toWav(float, { channels = 1, sampleRate = SAMPLE_RATE } = {}) {
  const frames = channels === 2 ? float[0].length : float.length;
  const dataLen = frames * channels * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataLen, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = channels === 2 ? float[c][i] : float[i];
      const s = Math.max(-1, Math.min(1, v));
      buf.writeInt16LE(Math.round(s * 32767), o); o += 2;
    }
  }
  return buf;
}

// ---------------------------------------------------------------- Öffentliche API
function render(plan) {
  const song = renderSong(plan);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const id = 'mx-' + crypto.randomBytes(4).toString('hex');
  const [L, R] = widen(song.stems.mix, song.seed);
  const stereo = [L, R];
  const wav = toWav(stereo, { channels: 2 });
  const file = path.join(OUT_DIR, id + '.wav');
  fs.writeFileSync(file, wav);
  const result = {
    ok: true, id, file, bytes: wav.length, sampleRate: song.sampleRate,
    duration: Number(song.duration.toFixed(2)), style: song.style, bpm: song.bpm, bars: song.bars,
    seed: song.seed, progression: song.progression, channels: 2,
    kind: 'SKETCH', note: 'Instrumentaler Entwurf, lokal berechnet. Kein KI-Gesang, kein externer Dienst.',
    stems_available: ['drums', 'bass', 'chords', 'melody'],
    stems: null,
  };
  if (plan && plan.stems) {
    result.stems = {};
    for (const k of ['drums', 'bass', 'chords', 'melody']) {
      const f = path.join(OUT_DIR, id + '.' + k + '.wav');
      fs.writeFileSync(f, toWav(song.stems[k], { channels: 1 }));
      result.stems[k] = { file: f, bytes: fs.statSync(f).size };
    }
  }
  return result;
}

function styles() {
  return Object.entries(STYLES).map(([id, c]) => ({ id, bpm: c.bpm, progression: PROGRESSIONS[c.prog], drum_pattern: c.drums, scale: c.scale, reverb: c.reverb }));
}

function info() {
  let files = 0, bytes = 0;
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.wav')) { files++; bytes += fs.statSync(path.join(OUT_DIR, f)).size; }
  } catch { /* egal */ }
  return {
    area: 'MUSIC-RENDER', mode: 'LOCAL', sample_rate: SAMPLE_RATE, output: OUT_DIR,
    files, megabytes: +(bytes / 1048576).toFixed(2),
    styles: Object.keys(STYLES), note: 'Reines Node. Kein ffmpeg, kein Modell, kein Netz.',
  };
}

module.exports = { render, styles, info, toWav, renderSong, STYLES, PROGRESSIONS, SCALES, OUT_DIR, SAMPLE_RATE };
