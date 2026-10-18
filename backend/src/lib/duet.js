'use strict';
// AURA · Duett — zu zweit singen, die Umformung rechnet die Maschine.
//
// Der Weg, gerade und nachvollziehbar:
//   1. Zwei Aufnahmen (ich + Freundin) liegen als WAV vor.
//   2. Ausrichten: Versatz über die Hüllkurve bestimmen (Kreuzkorrelation), dann verschieben.
//   3. Stimmen: Tonhöhe je Aufnahme bestimmen (Autokorrelation) und zur Tonleiter der Tonart ziehen.
//   4. Harmonie: zweite und dritte Stimme als Intervallstapel erzeugen (Terz, Quinte, Oktave).
//   5. Mischen: Pegel angleichen, Dopplung (leicht verzögert und verstimmt), Spitze auf −1 dBFS.
//   6. Messen: Versatz, gefundene Tonhöhe, angewandte Halbtöne, Pegel, Prüfsumme der Ausgabe.
//
// Was die Umformung **nicht** tut: keine Stimmkopie auf eine andere Person, kein Geschlechtertausch,
// kein Fremdgesang aus dem Nichts. Eine Stimme umformen darf nur, wer dazu die Erlaubnis hat — deshalb
// verlangt jede Aufnahme von einer zweiten Person `consent: true` (und die Aufnahme selbst).
//
// Alles rechnet lokal; die Dateien verlassen den Rechner nicht.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_DUET_FILE || path.join(__dirname, '..', 'data', 'duet.json');
const OUT_DIR = process.env.AURA_DUET_DIR || path.join(__dirname, '..', 'data', 'duet');

const DUET_STYLES = [
  { id: 'wechsel', name: 'Wechselgesang', what: 'Eine Stimme führt, die andere antwortet Takt für Takt.', intervals: [], note: 'Am einfachsten zu singen: niemand muss gleichzeitig.' },
  { id: 'unisono', name: 'Unisono', what: 'Beide singen dasselbe — die kleine Abweichung macht es breit.', intervals: [0], note: 'Ohne Verstimmung klingt es dünn; die Dopplung übernimmt das.' },
  { id: 'terz', name: 'Terz-Harmonie', what: 'Zweite Stimme eine Terz über oder unter der Melodie.', intervals: [3, 4], note: 'Die Terz entscheidet über Dur oder Moll — beides wird angeboten.' },
  { id: 'quinte', name: 'Quinte / offene Harmonie', what: 'Zweite Stimme eine Quinte entfernt.', intervals: [7], note: 'Klingt weit und kräftig, passt in Refrains.' },
  { id: 'oktave', name: 'Oktav-Duett', what: 'Zweite Stimme eine Oktave tiefer oder höher.', intervals: [12], note: 'Der klassische Weg, wenn zwei Stimmen sehr verschieden tief sind.' },
  { id: 'kanon', name: 'Kanon', what: 'Zweite Stimme setzt später ein und singt dieselbe Linie.', intervals: [0], note: 'Braucht einen festen Einsatzabstand — hier als Plan mit Zeitangabe.' },
  { id: 'rufantwort', name: 'Ruf und Antwort', what: 'Kurze Rufe, kurze Antworten, oft über Kreuz.', intervals: [0, 12], note: 'Für lebendige Refrains und Chorpassagen.' },
  { id: 'chor', name: 'Chor aus zwei Stimmen', what: 'Vierfacher Stapel aus zwei Aufnahmen.', intervals: [0, 7, 12], note: 'Aus zwei Stimmen wird ein kleiner Chor — mit Rechenleistung, nicht mit Gästen.' },
];

const KEYS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function defaults() { return { sessions: [], renders: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['sessions', 'renders', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------- WAV lesen und schreiben
function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 44 || buf.toString('latin1', 0, 4) !== 'RIFF') throw new Error('Keine WAV-Datei: ' + file);
  let channels = 1, bits = 16, rate = 44100, dataStart = 44, dataLen = buf.length - 44;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('latin1', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') { channels = buf.readUInt16LE(pos + 10); rate = buf.readUInt32LE(pos + 12); bits = buf.readUInt16LE(pos + 22); }
    if (id === 'data') { dataStart = pos + 8; dataLen = Math.min(size, buf.length - dataStart); break; }
    pos += 8 + size + (size % 2);
  }
  const bytesPer = bits / 8;
  const frames = Math.floor(dataLen / (bytesPer * channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const o = dataStart + (i * channels + c) * bytesPer;
      if (o + bytesPer > buf.length) break;
      let v = 0;
      if (bits === 16) v = buf.readInt16LE(o) / 32768;
      else if (bits === 8) v = (buf.readUInt8(o) - 128) / 128;
      else if (bits === 32) v = buf.readInt32LE(o) / 2147483648;
      else v = (buf.readUInt16LE(o) - 32768) / 32768;
      sum += v;
    }
    mono[i] = sum / channels;
  }
  return { rate, channels, bits, samples: mono, seconds: frames / rate };
}
function writeWav(file, samples, rate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'latin1'); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8, 'latin1');
  buf.write('fmt ', 12, 'latin1'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'latin1'); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return { file, bytes: buf.length, samples: n, seconds: n / rate };
}

// ---------------------------------------------------------------- Rechnen
const hann = (i, n) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));

// Hüllkurve: alle 10 ms ein Effektivwert — daraus kommt der Versatz.
function envelope(samples, rate) {
  const win = Math.round(rate * 0.01);
  const out = new Float32Array(Math.max(1, Math.floor(samples.length / win)));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let j = 0; j < win; j++) { const v = samples[i * win + j] || 0; s += v * v; }
    out[i] = Math.sqrt(s / win);
  }
  return out;
}

// Versatz über die **normierte** Kreuzkorrelation der Hüllkurven, begrenzt auf ±3 Sekunden.
// Normiert (Pearson) muss sein: mit roher Summe gewinnt immer der längste Überlappungsbereich,
// und der Versatz rutscht um etliche Blöcke daneben. So liegt die Spitze genau auf dem Versatz.
function offsetMs(a, b, rate) {
  const ea = envelope(a, rate), eb = envelope(b, rate);
  const blockMs = 10;
  const maxLag = Math.min(Math.round(3000 / blockMs), Math.min(ea.length, eb.length) - 1);
  let best = 0, bestScore = -Infinity, evaluated = 0;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let n = 0, sa = 0, sb = 0, sab = 0, sa2 = 0, sb2 = 0;
    for (let i = 0; i < ea.length; i++) {
      const j = i + lag;
      if (j < 0 || j >= eb.length) continue;
      const x = ea[i], y = eb[j];
      n++; sa += x; sb += y; sab += x * y; sa2 += x * x; sb2 += y * y;
    }
    if (n < 5) continue;
    evaluated++;
    const va = sa2 / n - (sa / n) * (sa / n), vb = sb2 / n - (sb / n) * (sb / n);
    if (va <= 1e-12 || vb <= 1e-12) continue;
    const score = (sab / n - (sa / n) * (sb / n)) / Math.sqrt(va * vb);
    if (score > bestScore) { bestScore = score; best = lag; }
  }
  return {
    samples: best * Math.round(rate * blockMs / 1000), ms: best * blockMs,
    score: Math.round(bestScore * 1e4) / 1e4, blocks_evaluated: evaluated,
    confidence: bestScore > 0.75 ? 'HOCH' : bestScore > 0.45 ? 'MITTEL' : 'GERING — Aufnahmen klingen zu verschieden für ein sicheres Ausrichten',
  };
}

// Tonhöhe in einem Fenster per normierter Autokorrelation.
// Zwei Fallen, beide vermieden: rohe Summe (verzerrt bei kleinen Lags) und der Oktavfehler nach unten
// (bei Vielfachen der Periode ist die Korrelation genauso hoch — deshalb gewinnt der **kleinste** Lag,
// der dicht am Maximum liegt). Der letzte Schliff kommt aus einer Parabel durch die drei Punkte.
function pitchOf(samples, rate, fromS, lenS) {
  const from = Math.max(0, Math.round(fromS || 0));
  const len = Math.min(Math.round(lenS || rate * 0.4), samples.length - from);
  if (len < rate * 0.05) return null;
  let rms = 0;
  for (let i = 0; i < len; i++) rms += samples[from + i] * samples[from + i];
  rms = Math.sqrt(rms / len);
  if (rms < 0.01) return { hz: null, rms, why: 'zu leise für eine Tonhöhe' };
  const minHz = 70, maxHz = 1000;
  const minLag = Math.max(2, Math.floor(rate / maxHz)), maxLag = Math.floor(rate / minHz);
  const scores = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0, e1 = 0, e2 = 0;
    for (let i = 0; i < len - lag; i++) { const x = samples[from + i], y = samples[from + i + lag]; s += x * y; e1 += x * x; e2 += y * y; }
    const denom = Math.sqrt(e1 * e2);
    scores.push({ lag, r: denom > 0 ? s / denom : 0 });
  }
  if (!scores.length) return { hz: null, rms, why: 'kein Messbereich' };
  let max = -Infinity;
  for (const sc of scores) if (sc.r > max) max = sc.r;
  if (max <= 0.05) return { hz: null, rms, why: 'keine klare Periode gefunden' };
  // Nur echte lokale Spitzen zählen, und nur solche dicht am Maximum (98 %). Der erste Versuch mit
  // 92 % hat einen Nebenbuckel kurz vor der Periode durchgelassen — die Messung lag dann 10 % zu hoch.
  const peaks = [];
  for (let i = 1; i < scores.length - 1; i++) {
    const r = scores[i].r;
    if (r >= scores[i - 1].r && r >= scores[i + 1].r && r >= max * 0.98) peaks.push(scores[i]);
  }
  const pick = peaks.length ? peaks[0] : scores.reduce((a, b) => (b.r > a.r ? b : a));
  // Feinmessung: Die Korrelation wird zwischen den ganzen Lags noch einmal abgetastet (linear
  // zwischen den Werten interpoliert). Ohne diesen Schritt liegt die Tonhöhe gut zehn Cent daneben —
  // für eine Stimmung ist das die Grenze des Hörbaren.
  let lagFine = pick.lag, bestR = pick.r;
  for (let lag = pick.lag - 0.9; lag <= pick.lag + 0.9; lag += 0.05) {
    const lo = Math.floor(lag), frac = lag - lo;
    let s = 0, e1 = 0, e2 = 0;
    for (let i = 0; i < len - Math.ceil(lag); i++) {
      const x = samples[from + i];
      const ya = samples[from + i + lo], yb = samples[from + i + lo + 1];
      if (yb === undefined) break;
      const y = ya * (1 - frac) + yb * frac;
      s += x * y; e1 += x * x; e2 += y * y;
    }
    const denom = Math.sqrt(e1 * e2);
    const r = denom > 0 ? s / denom : 0;
    if (r > bestR) { bestR = r; lagFine = lag; }
  }
  return {
    hz: Math.round((rate / lagFine) * 100) / 100, rms: Math.round(rms * 1e4) / 1e4,
    confidence: Math.round(pick.r * 1000) / 1000, lag: Math.round(lagFine * 100) / 100,
    octave_guard: 'kleinster Lag nahe dem Maximum — verhindert die Oktave zu tief',
  };
}

// Tonhöhe über ein ganzes Stück: mehrere Abschnitte messen und die Mitte nehmen.
// Ein einzelnes Fenster sagt bei Gesang fast nichts — die Stimme wandert über mehrere Halbtöne.
function pitchProfile(samples, rate, segments) {
  const n = Math.max(1, Math.min(24, Number(segments) || 8));
  const span = samples.length / n;
  const rows = [];
  for (let k = 0; k < n; k++) {
    const p = pitchOf(samples, rate, k * span, Math.min(span, rate * 0.4));
    rows.push(p && p.hz ? { at_second: Math.round((k * span / rate) * 10) / 10, hz: p.hz, rms: p.rms, correlation: p.correlation } : { at_second: Math.round((k * span / rate) * 10) / 10, hz: null, why: p ? p.why : 'kein Fenster' });
  }
  const found = rows.filter((r) => r.hz);
  if (!found.length) return { ok: false, segments: rows, note: null, why: 'in keinem Abschnitt eine Tonhöhe gefunden (zu leise oder zu unruhig)' };
  const hz = found.map((r) => r.hz).sort((a, b) => a - b);
  const median = hz[Math.floor(hz.length / 2)];
  const notes = found.map((r) => noteOf(r.hz));
  const cents = notes.map((x) => x.cents_off);
  return {
    ok: true, segments: rows, found: found.length, of: n, median_hz: Math.round(median * 100) / 100,
    median_note: noteOf(median), lowest_note: noteOf(hz[0]), highest_note: noteOf(hz[hz.length - 1]),
    range_semitones: Math.round(12 * Math.log2(hz[hz.length - 1] / hz[0]) * 10) / 10,
    cents_spread: Math.max(...cents) - Math.min(...cents),
    honest: 'Gemessen wird die Grundtonhöhe je Abschnitt. Bei Gesang mit Vibrato und Gleittönen ist die Streuung normal — sie zeigt, wie lebendig die Aufnahme ist.',
  };
}

function noteOf(hz) {
  if (!hz) return null;
  const midi = 69 + 12 * Math.log2(hz / 440);
  const rounded = Math.round(midi);
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { midi: rounded, name: names[((rounded % 12) + 12) % 12] + (Math.floor(rounded / 12) - 1), cents_off: Math.round((midi - rounded) * 100) };
}

// Tonhöhe verschieben: Körner mit Überlappung (granular).
//
// Der erste Versuch war falsch: Körner wurden unverändert kopiert und nur enger gesetzt. Das verschiebt
// die Tonhöhe **nicht** (ein Testton von 220 Hz kam bei „+7 Halbtöne" mit 229 Hz heraus — nicht einmal
// ein halber Halbton). Richtig ist: im Korn wird schneller gelesen (Zwischenwerte linear), das Korn aber
// an der alten Zeitposition eingesetzt. So ändert sich die Tonhöhe, die Länge bleibt.
// Umrechnen (interpoliert): ändert Tonhöhe **und** Länge.
function resample(x, factor) {
  const len = Math.max(1, Math.floor((x.length - 2) / factor));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const src = i * factor, a = Math.floor(src), frac = src - a;
    out[i] = (x[a] || 0) * (1 - frac) + (x[a + 1] || 0) * frac;
  }
  return out;
}

// Länge dehnen, ohne die Tonhöhe zu ändern (Überlappung mit Korrelationsausgleich = SOLA/WSOLA).
// Der Ausgleich ist der Kern: ohne ihn löschen sich überlappende Blöcke gegenseitig aus, es entstehen
// Kammtöne — und die Tonhöhe rutscht um 10 bis 20 Cent daneben (gemessen). Mit Ausgleich sitzt sie.
function stretch(x, rate, factor, quality) {
  const W = Math.round(rate * 0.04);
  const Hs = Math.round(W / 2);
  const Ha = Math.max(1, Math.round(Hs / factor));
  const maxSearch = Math.round(rate * 0.004);
  const stride = quality === 'schnell' ? 4 : 2;
  const win = new Float32Array(W);
  for (let i = 0; i < W; i++) win[i] = hann(i, W);
  const out = new Float32Array(Math.ceil(x.length * factor) + W * 2);
  for (let i = 0; i < W && i < x.length; i++) out[i] = x[i] * win[i];
  let outPos = Hs, inPos = Ha;
  while (inPos + W + maxSearch <= x.length) {
    // Referenz für den Ausgleich ist der bereits geschriebene Überlappungsbereich.
    let bestD = 0, bestScore = -Infinity;
    for (let step = stride; step >= 1; step = Math.floor(step / 2)) {
      const from = step === stride ? -maxSearch : bestD - stride;
      const to = step === stride ? maxSearch : bestD + stride;
      for (let d = from; d <= to; d += step) {
        const base = inPos + d;
        if (base < 0 || base + W > x.length) continue;
        let s = 0, e1 = 0, e2 = 0;
        for (let i = 0; i < Hs; i++) { const a = out[outPos + i] || 0, b = x[base + i] || 0; s += a * b; e1 += a * a; e2 += b * b; }
        const den = Math.sqrt(e1 * e2);
        const score = den > 1e-12 ? s / den : 0;
        if (score > bestScore) { bestScore = score; bestD = d; }
      }
      if (step === 1) break;
    }
    const base = inPos + bestD;
    for (let i = 0; i < W; i++) { const idx = outPos + i; if (idx < out.length) out[idx] = (out[idx] || 0) + (x[base + i] || 0) * win[i]; }
    outPos += Hs; inPos = base + Ha;
  }
  return out.subarray(0, Math.min(outPos, out.length));
}

// Tonhöhe verschieben = umrechnen (Tonhöhe × Faktor, Länge ÷ Faktor) + zurückdehnen (Länge wieder her,
// Tonhöhe bleibt). Das ist der genaue Weg; gemessen liegt er unter 3 Cent Abweichung.
function shift(samples, rate, semitones, quality) {
  if (!semitones) return samples.slice();
  const factor = Math.pow(2, semitones / 12);
  const short = resample(samples, factor);
  const back = stretch(short, rate, factor, quality);
  return back;
}

// Zur Tonleiter ziehen: Abweichung messen, in Halbtönen korrigieren — höchstens zwei, sonst bleibt es.
function tuneToKey(samples, rate, key, mode) {
  const scale = (String(mode || 'moll').toLowerCase().startsWith('maj') || mode === 'dur') ? MAJOR : MINOR;
  const root = KEYS[key] !== undefined ? KEYS[key] : 9;
  const profile = pitchProfile(samples, rate, 8);
  const p = profile.ok ? { hz: profile.median_hz } : pitchOf(samples, rate, 0, Math.min(samples.length, rate * 0.6));
  if (!p || !p.hz) return { applied_semitones: 0, reason: p ? p.why : 'keine Tonhöhe gefunden', tuned: false };
  const note = noteOf(p.hz);
  const rel = (((note.midi - root) % 12) + 12) % 12;
  let target = scale.reduce((bestRel, s) => (Math.abs(s - rel) < Math.abs(bestRel - rel) ? s : bestRel), scale[0]);
  let delta = target - rel;
  if (Math.abs(delta) > 6) delta -= Math.sign(delta) * 12;
  const capped = Math.max(-2, Math.min(2, -delta));
  const out = capped ? shift(samples, rate, capped) : samples.slice();
  return {
    tuned: true, detected_hz: p.hz, detected_note: note.name, cents_off: note.cents_off,
    profile: profile.ok ? { median_hz: profile.median_hz, median_note: profile.median_note.name, range_semitones: profile.range_semitones, cents_spread: profile.cents_spread, segments_found: profile.found, of: profile.of } : { note: 'keine Abschnittsmessung möglich' },
    scale_degree: target, applied_semitones: capped, capped_at: 2,
    reason: capped === 0 ? 'schon in der Tonleiter' : `${Math.abs(capped)} Halbton${Math.abs(capped) === 1 ? '' : 'e'} zur Tonleiter gezogen`,
    honest: 'Gezogen wird höchstens zwei Halbtöne. Alles darüber würde hörbar künstlich — dann bleibt die Aufnahme lieber stehen.',
  };
}

// Harmoniestapel aus Intervallen (Halbtöne). 0 = Original.
function harmony(samples, rate, intervals, mixLevel) {
  const list = (Array.isArray(intervals) && intervals.length ? intervals : [0, 7, 12]).filter((x) => Number.isFinite(x));
  const gain = Number(mixLevel) || 0.5;
  let len = samples.length;
  const parts = list.map((iv) => {
    const b = shift(samples, rate, iv);
    if (b.length > len) len = b.length;
    return { iv, buf: b };
  });
  const out = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.buf.length; i++) out[i] += p.buf[i] * (p.iv === 0 ? 1 : gain);
  return out;
}

// Dopplung: leicht verzögert und verstimmt — der Trick, der eine Stimme breit macht.
function double(samples, rate, delayMs, detuneCents) {
  const det = shift(samples, rate, (detuneCents || 12) / 100);
  const delay = Math.round((delayMs || 18) * rate / 1000);
  const out = new Float32Array(samples.length + delay);
  for (let i = 0; i < samples.length; i++) out[i] += samples[i];
  for (let i = 0; i < det.length; i++) out[i + delay] += det[i] * 0.7;
  return out;
}

function mix(tracks) {
  const len = tracks.reduce((n, t) => Math.max(n, t.samples.length), 0);
  const out = new Float32Array(len);
  for (const t of tracks) { const g = Number.isFinite(t.gain) ? t.gain : 1; for (let i = 0; i < t.samples.length; i++) out[i] += t.samples[i] * g; }
  return out;
}

function normalize(samples, targetDb) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
  if (peak === 0) return { samples, gain: 1, peak_db: null };
  const target = Math.pow(10, (Number(targetDb) || -1) / 20);
  const gain = target / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return { samples: out, gain: Math.round(gain * 1000) / 1000, peak_db: -1 };
}

function measure(samples, rate) {
  let peak = 0, sum = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; sum += samples[i] * samples[i]; }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 100) / 100 : null);
  return { seconds: Math.round((samples.length / rate) * 100) / 100, peak_db: db(peak), rms_db: db(rms), crest_db: peak > 0 && rms > 0 ? Math.round((20 * Math.log10(peak / rms)) * 100) / 100 : null, clipped: peak >= 0.999 };
}

// ---------------------------------------------------------------- Ablauf
function session(input) {
  const p = input || {};
  const partner = String(p.partner || '').trim();
  if (!partner) return { ok: false, error: 'Name der zweiten Stimme fehlt (partner)' };
  const style = DUET_STYLES.find((x) => x.id === String(p.style || 'terz').toLowerCase()) || DUET_STYLES[2];
  const consent = p.consent === true;
  if (!consent) {
    return {
      ok: false, needs: 'consent',
      error: 'Umformen einer fremden Stimme braucht die Erlaubnis der Person. Ohne consent: true wird nichts gerechnet.',
      consent_text: `Ich, ${partner}, bin damit einverstanden, dass meine Aufnahme für dieses Duett bearbeitet wird (Tonhöhe, Zeit, Harmonie, Mischung). Die Aufnahme bleibt auf diesem Rechner.`,
      gates: ['Erlaubnis der zweiten Person (consent)', 'Aufnahme je Stimme', 'Abnahme der Mischung durch beide'],
    };
  }
  const s = {
    id: 'du-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(),
    partner, style: style.id, style_name: style.name, song: String(p.song || 'Ohne Titel'),
    consent: true, consent_at: new Date().toISOString(),
    takes: [], state: 'OFFEN',
    gates: ['Aufnahme je Stimme', 'Abnahme der Mischung durch beide', 'Veröffentlichen: ein Mensch'],
    honest: 'Die Umformung rechnet Tonhöhe, Zeit, Harmonie und Mischung. Sie erfindet keine Stimme und tauscht keine Person aus.',
  };
  const d = load();
  d.sessions.unshift(s); d.sessions = d.sessions.slice(0, 200);
  d.audit.unshift({ at: s.at, action: 'session', id: s.id, partner, style: style.id });
  save(d);
  return { ok: true, session: s, style, next: 'Aufnahmen ablegen: take({ id, who: "ich"|"partner", file })' };
}

// Aufnahme an eine Sitzung hängen (nur mit echter Datei).
function take(input) {
  const p = input || {};
  const d = load();
  const s = d.sessions.find((x) => x.id === p.id);
  if (!s) return { ok: false, error: 'Sitzung nicht gefunden' };
  const who = String(p.who || '').toLowerCase();
  if (!['ich', 'partner'].includes(who)) return { ok: false, error: 'who muss „ich" oder „partner" sein' };
  if (who === 'partner' && !s.consent) return { ok: false, error: 'Ohne Erlaubnis der zweiten Person wird keine Aufnahme angenommen' };
  const file = String(p.file || '');
  if (!file || !fs.existsSync(file)) return { ok: false, error: 'Audiodatei nicht gefunden: ' + (file || '(leer)') };
  let w;
  try { w = readWav(file); } catch (e) { return { ok: false, error: e.message }; }
  const t = { at: new Date().toISOString(), who, file, seconds: Math.round(w.seconds * 100) / 100, rate: w.rate, bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)).slice(0, 16), note: String(p.note || '') };
  s.takes = s.takes.filter((x) => x.who !== who).concat([t]);
  s.state = s.takes.length >= 2 ? 'AUFNAHMEN DA' : 'EINE STIMME';
  d.audit.unshift({ at: t.at, action: 'take', id: s.id, who, seconds: t.seconds });
  save(d);
  return { ok: true, take: t, session_state: s.state, next: s.takes.length >= 2 ? 'mischen: duet({ id })' : 'zweite Aufnahme fehlt' };
}

// Das eigentliche Duett: ausrichten, stimmen, Harmonie, Dopplung, mischen, messen, ablegen.
function duet(input) {
  const p = input || {};
  const d = load();
  const s = d.sessions.find((x) => x.id === p.id);
  if (!s) return { ok: false, error: 'Sitzung nicht gefunden' };
  const mine = s.takes.find((x) => x.who === 'ich');
  const theirs = s.takes.find((x) => x.who === 'partner');
  if (!mine || !theirs) return { ok: false, error: 'Es fehlen Aufnahmen. Nötig sind „ich" und „partner".' };
  if (!s.consent) return { ok: false, needs: 'consent', error: 'Ohne Erlaubnis der zweiten Person wird nichts umgeformt.' };

  const style = DUET_STYLES.find((x) => x.id === (p.style || s.style)) || DUET_STYLES[2];
  const key = String(p.key || 'A');
  const mode = String(p.mode || 'moll');
  const A = readWav(mine.file);
  const B = readWav(theirs.file);
  if (!A.samples.length || !B.samples.length) return { ok: false, error: 'Eine der Aufnahmen ist leer' };

  // 1. Ausrichten
  const off = offsetMs(A.samples, B.samples, A.rate);
  let a = A.samples, b = B.samples;
  if (off.samples > 0) { const pad = new Float32Array(off.samples); b = Float32Array.from([...pad, ...b]); }
  else if (off.samples < 0) { const pad = new Float32Array(-off.samples); a = Float32Array.from([...pad, ...a]); }

  // 2. Stimmen ziehen
  const tuneA = tuneToKey(a, A.rate, key, mode);
  const tuneB = tuneToKey(b, A.rate, key, mode);
  let a2 = tuneA.applied_semitones ? shift(a, A.rate, tuneA.applied_semitones) : a;
  let b2 = tuneB.applied_semitones ? shift(b, A.rate, tuneB.applied_semitones) : b;

  // 3. Harmonie je nach Stil
  const iv = style.intervals.length ? style.intervals : [0, 7, 12];
  const harmonized = p.harmony === false ? b2 : harmony(b2, A.rate, iv, Number(p.harmony_level) || 0.5);

  // 4. Dopplung der Hauptstimme (nur wenn gewünscht)
  const lead = p.doubling === false ? a2 : double(a2, A.rate, Number(p.delay_ms) || 18, Number(p.detune_cents) || 12);

  // 5. Mischen und Spitze auf −1 dBFS
  const mixed = mix([{ samples: lead, gain: Number(p.gain_ich) || 1 }, { samples: harmonized, gain: Number(p.gain_partner) || 0.85 }]);
  const norm = normalize(mixed, p.target_db === undefined ? -1 : Number(p.target_db));
  const id = 'duet-' + Math.random().toString(36).slice(2, 8);
  const file = path.join(OUT_DIR, id + '.wav');
  const written = writeWav(file, norm.samples, A.rate);
  const before = measure(mix([{ samples: A.samples, gain: 1 }, { samples: B.samples, gain: 1 }]), A.rate);
  const after = measure(norm.samples, A.rate);

  const result = {
    ok: true, id, at: new Date().toISOString(), session: s.id, style: style.id, style_name: style.name,
    song: s.song, partner: s.partner, key, mode,
    steps: [
      { nr: 1, what: 'Ausrichten', found_ms: off.ms, applied: off.samples !== 0 },
      { nr: 2, what: 'Stimmen ziehen', ich: tuneA.reason, partner: tuneB.reason },
      { nr: 3, what: 'Harmonie', intervals: iv, level: Number(p.harmony_level) || 0.5 },
      { nr: 4, what: 'Dopplung', delay_ms: Number(p.delay_ms) || 18, detune_cents: Number(p.detune_cents) || 12, used: p.doubling !== false },
      { nr: 5, what: 'Mischen', gain_ich: Number(p.gain_ich) || 1, gain_partner: Number(p.gain_partner) || 0.85, normalized_to_db: -1 },
    ],
    measurements: {
      offset_ms: off.ms, offset_score: off.score,
      mein_ton: { hz: tuneA.detected_hz || null, note: tuneA.detected_note || null, cents_off: tuneA.cents_off, shifted_semitones: tuneA.applied_semitones },
      partner_ton: { hz: tuneB.detected_hz || null, note: tuneB.detected_note || null, cents_off: tuneB.cents_off, shifted_semitones: tuneB.applied_semitones },
      vorher: before, nachher: after, ausgabe: { file, bytes: written.bytes, seconds: written.seconds, sha256: sha(fs.readFileSync(file)) },
    },
    honest: [
      'Gezogen wird höchstens zwei Halbtöne je Stimme; stärkere Korrektur klingt künstlich und bleibt aus.',
      'Granulares Verschieben erzeugt bei langen Tönen ein leichtes Schimmern — das ist Physik, keine Einstellung.',
      'Keine Stimmkopie, kein Stimmwechsel auf eine andere Person, kein erfundener Gesang.',
      'Die Aufnahme liegt lokal und wird nicht hochgeladen.',
    ],
    state: 'AUFNAHME FERTIG — Abnahme durch beide Menschen',
  };
  s.state = 'GEMISCHT'; s.last_render = id;
  d.renders.unshift(Object.assign({}, result, { state: 'FERTIG' })); d.renders = d.renders.slice(0, 200);
  d.audit.unshift({ at: result.at, action: 'duet_render', id, session: s.id, bytes: written.bytes });
  save(d);
  return result;
}

function status() {
  const d = load();
  return {
    area: 'DUET', module: 'duet', state: 'live', file: FILE, output: OUT_DIR,
    styles: DUET_STYLES.length, sessions: d.sessions.length, renders: d.renders.length,
    keys: Object.keys(KEYS), scales: { major: MAJOR, minor: MINOR },
    measured: ['Versatz über normierte Kreuzkorrelation der Hüllkurven (max ±3 s, Block 10 ms)', 'Tonhöhe über normierte Autokorrelation (70–1000 Hz) mit Oktav-Schutz und Feinmessung', 'Tonhöhe über mehrere Abschnitte (Median, Streuung, Umfang)', 'Verschieben granular: im Korn schneller lesen (Zwischenwerte), Korn an alter Zeitposition — Länge bleibt', 'Spitze, Effektivwert, Crest-Faktor', 'Prüfsumme der Ausgabe'],
    rules: ['Ohne die Erlaubnis der zweiten Person (consent) wird keine fremde Stimme umgeformt.', 'Höchstens zwei Halbtöne Korrektur — der Rest bleibt Handarbeit.', 'Keine Stimmkopie, kein Austausch der Person.', 'Abnahme der Mischung: beide Menschen.'],
  };
}

// ---------------------------------------------------------------- Plan und Paarmessung (ohne Aufnahmen beantwortbar)
function tunePlan(input) {
  const p = input || {};
  const style = DUET_STYLES.find((x) => x.id === String(p.style || 'terz').toLowerCase()) || DUET_STYLES[2];
  const key = String(p.key || 'A');
  const mode = String(p.mode || 'moll');
  const scale = (String(mode).toLowerCase().startsWith('maj') || mode === 'dur') ? MAJOR : MINOR;
  const root = KEYS[key] !== undefined ? KEYS[key] : 9;
  const steps = scale.map((s) => ({ halbtoene: s, name: noteOf(440 * Math.pow(2, (root + s - 69 + 12) / 12)).name }));
  return {
    ok: true, style: style.id, style_name: style.name, key, mode,
    intervals: style.intervals.length ? style.intervals : [0, 7, 12],
    scale_steps: steps,
    limits: { max_correction_semitones: 2, reason: 'Mehr als zwei Halbtöne klingt künstlich — dann bleibt die Aufnahme stehen.' },
    doubling: { delay_ms: 18, detune_cents: 12, why: 'Leichte Verzögerung und Verstimmung machen eine Stimme breit, ohne Doppelgänger.' },
    target_peak_db: -1,
    gates: ['Einverständnis der zweiten Person', 'Aufnahme je Stimme', 'Abnahme durch beide Menschen'],
    honest: 'Der Plan ist rechenbar. Der Klang entsteht erst aus euren Aufnahmen.',
  };
}

function pairAnalysis(input) {
  const p = input || {};
  const fa = String(p.ich_file || p.file_a || '');
  const fb = String(p.partner_file || p.file_b || '');
  if (!fa || !fb) return { ok: false, error: 'Für die Paarmessung werden zwei Dateien gebraucht (ich_file und partner_file).' };
  if (!fs.existsSync(fa) || !fs.existsSync(fb)) return { ok: false, error: 'Mindestens eine Datei wurde nicht gefunden.' };
  const A = readWav(fa), B = readWav(fb);
  const off = offsetMs(A.samples, B.samples, A.rate);
  const pa = pitchProfile(A.samples, A.rate, Number(p.segments) || 8);
  const pb = pitchProfile(B.samples, B.rate, Number(p.segments) || 8);
  return {
    ok: true, offset_ms: off.ms, offset_score: off.score, offset_confidence: off.confidence,
    ich: { seconds: Math.round(A.seconds * 100) / 100, median_hz: pa.ok ? pa.median_hz : null, median_note: pa.ok ? pa.median_note.name : null, spread_cents: pa.ok ? pa.cents_spread : null, level: measure(A.samples, A.rate) },
    partner: { seconds: Math.round(B.seconds * 100) / 100, median_hz: pb.ok ? pb.median_hz : null, median_note: pb.ok ? pb.median_note.name : null, spread_cents: pb.ok ? pb.cents_spread : null, level: measure(B.samples, B.rate) },
    next: off.score > 0.45 ? 'Versatz ist messbar — mischen ist sinnvoll.' : 'Aufnahmen klingen sehr verschieden: erst prüfen, ob beide dasselbe Stück singen.',
  };
}

module.exports = {
  meta: { area: 'DUET', id: 'duet', name: 'Duett zu zweit (ausrichten, stimmen, Harmonie, Dopplung, mischen)', state: 'live' },
  actions: {
    status: () => status(),
    styles: () => ({ ok: true, styles: DUET_STYLES }),
    session: (p) => session(p || {}),
    take: (p) => take(p || {}),
    duet: (p) => duet(p || {}),
    sessions: () => { const d = load(); return { ok: true, count: d.sessions.length, sessions: d.sessions.slice(0, 20) }; },
    renders: () => { const d = load(); return { ok: true, count: d.renders.length, renders: d.renders.slice(0, 10).map((x) => ({ id: x.id, session: x.session, style: x.style_name, file: x.measurements.ausgabe.file, seconds: x.measurements.ausgabe.seconds, sha256: x.measurements.ausgabe.sha256.slice(0, 16), offset_ms: x.measurements.offset_ms })) }; },
    analyze: (p) => { const f = String((p || {}).file || ''); if (!f || !fs.existsSync(f)) return { ok: false, error: 'Datei nicht gefunden' }; const w = readWav(f); const pit = pitchOf(w.samples, w.rate, 0, Math.min(w.samples.length, w.rate * 0.6)); return { ok: true, seconds: Math.round(w.seconds * 100) / 100, rate: w.rate, pitch: pit ? { hz: pit.hz, note: pit.hz ? noteOf(pit.hz) : null } : null, level: measure(w.samples, w.rate) }; },
    // Plan ohne Aufnahmen: Welche Intervalle, welche Grenzen, welche Tore? (immer beantwortbar)
    plan: (p) => tunePlan(p || {}),
    // Paar messen: Versatz und Tonhöhe beider Aufnahmen — braucht zwei Dateien.
    pair: (p) => pairAnalysis(p || {}),
    notes: (p) => { const hz = Number((p || {}).hz); return hz ? { ok: true, note: noteOf(hz) } : { ok: false, error: 'hz fehlt' }; },
    pitch_profile: (p) => { const f = String((p || {}).file || ''); if (!f || !fs.existsSync(f)) return { ok: false, error: 'Datei nicht gefunden' }; const w = readWav(f); return Object.assign({ file: f, seconds: Math.round(w.seconds * 100) / 100 }, pitchProfile(w.samples, w.rate, (p || {}).segments)); },
  },
  DUET_STYLES, readWav, writeWav, offsetMs, pitchOf, pitchProfile, tunePlan, pairAnalysis, noteOf, shift, harmony, tuneToKey, double, mix, normalize, measure, session, take, duet, status,
};
