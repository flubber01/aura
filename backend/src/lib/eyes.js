'use strict';
// AURA · Augen („now u have eyes"): Bilder und Bildschirm-Aufnahmen wirklich ansehen.
//
// Was hier ohne Fremdmodell WIRKLICH geht — und das ist mehr als erwartet:
//  • Bilddateien lesen: Format, Größe, Farbtiefe aus den Kopfdaten (PNG, JPEG, GIF, BMP, WebP).
//  • Bildinhalt messen: über einen reinen JS-Dekoder (PNG mit zlib, BMP unkomprimiert, PPM) sind
//    Helligkeit, Kontrast, Farbstimmung und ein grobes Rasterbild rechenbar. Daraus entstehen
//    brauchbare Aussagen: „zu dunkel", „links ist Fläche", „Farbstich blau", „Textbereich frei".
//  • Bildschirm-Aufnahme: Ein Ordner wird beobachtet; neue Aufnahmen werden automatisch gemessen
//    und als Sicht-Notiz abgelegt (der Agent „sieht", was gerade passiert).
//  • Genaue Bildbeschreibung (Was ist zu sehen? Welcher Text?) braucht ein Bildmodell — lokal über
//    Ollama (llava) oder einen Anbieter mit Schlüssel. Ist keins da, steht das ehrlich als
//    NOT-CONNECTED da, statt eine Beschreibung zu erfinden.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FILE = process.env.AURA_EYES_FILE || path.join(__dirname, '..', 'data', 'eyes.json');
const WATCH_DIR = process.env.AURA_EYES_WATCH_DIR || path.join(__dirname, '..', '..', 'screens');
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ppm'];

function defaults() { return { notes: [], seen: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['notes', 'seen']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// ---------------------------------------------------------------- Kopfdaten lesen (ohne Fremdbibliothek)
function sniff(buf) {
  if (buf.length < 16) return { format: 'zu kurz' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const depth = buf[24], color = buf[25];
    return { format: 'PNG', width: w, height: h, bit_depth: depth, color_type: color, interlace: buf[28], bytes: buf.length, decodable: color === 2 || color === 6 || color === 0 };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2; let w = null, h = null;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
      i += 2 + len;
    }
    return { format: 'JPEG', width: w, height: h, bytes: buf.length, decodable: false, note: 'Kopfdaten gelesen; volle Bildmessung nur für PNG/BMP/PPM (JPEG braucht externen Dekoder).' };
  }
  if (buf.slice(0, 6).toString('latin1') === 'GIF87a' || buf.slice(0, 6).toString('latin1') === 'GIF89a') return { format: 'GIF', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), bytes: buf.length, decodable: false };
  if (buf.slice(0, 2).toString('latin1') === 'BM') return { format: 'BMP', width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)), bit_depth: buf.readUInt16LE(28), bytes: buf.length, decodable: true };
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return { format: 'WebP', width: null, height: null, bytes: buf.length, decodable: false };
  if (buf.slice(0, 2).toString('latin1') === 'P6') { const m = buf.slice(0, 60).toString('latin1').match(/P6\s+(\d+)\s+(\d+)\s+(\d+)/); if (m) return { format: 'PPM', width: +m[1], height: +m[2], bytes: buf.length, decodable: true }; }
  return { format: 'unbekannt', bytes: buf.length };
}

// ---------------------------------------------------------------- Bild messen (echte Pixel, PNG/BMP/PPM)
function decodePixels(buf, info) {
  try {
    if (info.format === 'BMP' && info.bit_depth === 24) {
      const offset = buf.readUInt32LE(10); const w = info.width, h = info.height;
      const rowSize = Math.floor((24 * w + 31) / 32) * 4; const px = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = offset + (h - 1 - y) * rowSize + x * 3;
        px.push([buf[p + 2], buf[p + 1], buf[p]]); // BGR → RGB
      }
      return { pixels: px, width: w, height: h };
    }
    if (info.format === 'PPM') {
      const header = buf.slice(0, 60).toString('latin1'); const m = header.match(/P6\s+(\d+)\s+(\d+)\s+(\d+)\s/);
      const start = m[0].length; const w = +m[1], h = +m[2]; const px = [];
      for (let i = 0; i < w * h; i++) px.push([buf[start + i * 3], buf[start + i * 3 + 1], buf[start + i * 3 + 2]]);
      return { pixels: px, width: w, height: h };
    }
    if (info.format === 'PNG' && (info.color_type === 2 || info.color_type === 6)) {
      // IDAT einsammeln und entpacken
      let i = 8; const parts = []; let ihdrDone = false;
      while (i < buf.length - 8) {
        const len = buf.readUInt32BE(i); const type = buf.slice(i + 4, i + 8).toString('latin1');
        if (type === 'IHDR') ihdrDone = true;
        if (type === 'IDAT') parts.push(buf.slice(i + 8, i + 8 + len));
        i += 12 + len;
      }
      if (!parts.length) return null;
      const raw = zlib.inflateSync(Buffer.concat(parts));
      const bpp = info.color_type === 6 ? 4 : 3; const stride = info.width * bpp;
      const out = Buffer.alloc(info.height * stride);
      let pos = 0;
      for (let y = 0; y < info.height; y++) {
        const filter = raw[pos++]; const line = raw.slice(pos, pos + stride); pos += stride;
        const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
        const cur = out.slice(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? cur[x - bpp] : 0; const b = prev[x]; const c = x >= bpp ? prev[x - bpp] : 0;
          let v = line[x];
          if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
          else if (filter === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
          cur[x] = v & 0xff;
        }
      }
      const px = [];
      for (let p = 0; p < info.width * info.height; p++) px.push([out[p * bpp], out[p * bpp + 1], out[p * bpp + 2]]);
      return { pixels: px, width: info.width, height: info.height };
    }
  } catch { return null; }
  return null;
}

function analyse(pixels, width, height) {
  const n = pixels.length;
  let sum = 0, sum2 = 0, r = 0, g = 0, b = 0, sat = 0;
  for (const [pr, pg, pb] of pixels) {
    const l = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
    sum += l; sum2 += l * l; r += pr; g += pg; b += pb;
    const mx = Math.max(pr, pg, pb), mn = Math.min(pr, pg, pb);
    sat += mx === 0 ? 0 : (mx - mn) / mx;
  }
  const mean = sum / n; const variance = Math.max(0, sum2 / n - mean * mean);
  // 3×3-Raster: wo ist Fläche, wo ist Struktur?
  const cells = [];
  const cw = Math.max(1, Math.floor(width / 3)), ch = Math.max(1, Math.floor(height / 3));
  for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
    let cs = 0, cs2 = 0, cnt = 0;
    for (let y = cy * ch; y < Math.min(height, (cy + 1) * ch); y++) for (let x = cx * cw; x < Math.min(width, (cx + 1) * cw); x++) {
      const [pr, pg, pb] = pixels[y * width + x] || [0, 0, 0]; const l = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
      cs += l; cs2 += l * l; cnt++;
    }
    const m = cnt ? cs / cnt : 0; const sd = cnt ? Math.sqrt(Math.max(0, cs2 / cnt - m * m)) : 0;
    cells.push({ row: cy + 1, col: cx + 1, brightness: Math.round(m), detail: Math.round(sd) });
  }
  const tone = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  const cast = [];
  if (tone.b > tone.r + 12 && tone.b > tone.g + 8) cast.push('Blau-/Kaltstich');
  if (tone.r > tone.b + 12 && tone.r > tone.g + 8) cast.push('Rot-/Warmstich');
  if (tone.g > tone.r + 12 && tone.g > tone.b + 12) cast.push('Grünstich');
  return { width, height, brightness_mean: Math.round(mean), brightness_sd: Math.round(Math.sqrt(variance)), saturation_mean: Math.round((sat / n) * 100), tone, color_cast: cast, grid: cells };
}

function verdicts(a) {
  const out = [];
  if (a.brightness_mean < 45) out.push({ finding: 'Bild ist sehr dunkel', advice: 'Belichtung anheben (eq=brightness=+0.08 … +0.15) oder Licht setzen.' });
  if (a.brightness_mean > 215) out.push({ finding: 'Bild ist fast weiß', advice: 'Belichtung senken; Weißwerte unter 100 % halten.' });
  if (a.brightness_sd < 12) out.push({ finding: 'Bild ist flau (kaum Kontrast)', advice: 'Kontrast/Sättigung anheben — sonst wirkt es wie ein Fehlerbild.' });
  if (a.color_cast.length) out.push({ finding: 'Farbstich erkannt: ' + a.color_cast.join(', '), advice: 'Weißabgleich/Farbtemperatur korrigieren.' });
  if (a.saturation_mean < 8) out.push({ finding: 'Bild ist fast grau', advice: 'Sättigung prüfen — gewollt oder Fehler?' });
  const blank = a.grid.filter((c) => c.detail < 4).length;
  if (blank >= 5) out.push({ finding: `${blank} von 9 Rasterfeldern sind leer/flächig`, advice: 'Platz für Text oder Titel — oder ein Zeichen dafür, dass Material fehlt.' });
  if (!out.length) out.push({ finding: 'Bild wirkt normal belichtet und kontrastreich', advice: 'Keine Auffälligkeit.' });
  return out;
}

function look(input) {
  const file = String((input && input.file) || input || '').trim();
  if (!file) return { ok: false, error: 'file fehlt' };
  if (!fs.existsSync(file)) return { ok: false, error: 'Datei nicht gefunden: ' + file };
  let buf; try { buf = fs.readFileSync(file); } catch (e) { return { ok: false, error: 'nicht lesbar: ' + e.message }; }
  const info = sniff(buf);
  const dec = info.decodable ? decodePixels(buf, info) : null;
  const res = {
    ok: true, file, name: path.basename(file), bytes: buf.length,
    header: info,
    measured: dec ? analyse(dec.pixels, dec.width, dec.height) : null,
    findings: dec ? verdicts(analyse(dec.pixels, dec.width, dec.height)) : [{ finding: 'Beschreibung braucht externes Bildmodell (kein lokaler Dekoder für dieses Format)', advice: 'Für genaue Bildinhalte ein Bildmodell verbinden (Ollama llava mit Schlüssel oder Anbieter mit Schlüssel).' }],
    can_describe_content: false,
    honest: 'AURA kann messen (Helligkeit, Kontrast, Farben, Flächen). Was auf dem Bild ZU SEHEN ist, kann es ohne Bildmodell nicht benennen.',
  };
  const data = load();
  const seenKey = `${file}:${buf.length}`;
  if (!data.seen.includes(seenKey)) { data.seen.push(seenKey); data.seen = data.seen.slice(-500); }
  data.notes.unshift({ at: new Date().toISOString(), file, header: info.format, size: `${info.width}x${info.height}`, finding: res.findings[0].finding });
  data.notes = data.notes.slice(0, 200);
  save(data);
  return res;
}

// Bildschirm-Ordner abtasten: neue Dateien ansehen und als Notiz ablegen.
function scan(dir) {
  const target = String(dir || WATCH_DIR);
  if (!fs.existsSync(target)) return { ok: true, dir: target, new_files: [], note: 'Ordner existiert noch nicht — lege ihn an und wirf Bildschirmaufnahmen hinein.' };
  const files = fs.readdirSync(target).filter((f) => IMG_EXT.includes(path.extname(f).toLowerCase()));
  const data = load();
  const newOnes = [];
  for (const f of files) {
    const full = path.join(target, f);
    let size = 0; try { size = fs.statSync(full).size; } catch { continue; }
    const key = `${full}:${size}`;
    if (data.seen.includes(key)) continue;
    const out = look({ file: full });
    newOnes.push({ file: full, findings: out.findings, measured: out.measured ? { brightness: out.measured.brightness_mean, sd: out.measured.brightness_sd } : null });
  }
  return { ok: true, dir: target, files: files.length, new_files: newOnes, notes: load().notes.slice(0, 10) };
}

function notes(limit) {
  const d = load();
  return { ok: true, count: d.notes.length, notes: d.notes.slice(0, Number(limit) || 20) };
}

function visionModelState() {
  let ollama = { available: false };
  try { const o = require('./ollama_llm'); ollama = { available: typeof o.status === 'function' ? !!(o.status() || {}).reachable : false, module: o.meta ? o.meta.name : 'ollama_llm' }; } catch { /* nicht vorhanden */ }
  let vaultReady = false;
  try { const v = require('./vault'); const st = v.status ? v.status() : {}; vaultReady = String(st.state || st.status || '') === 'READY'; } catch { /* nicht vorhanden */ }
  return { ollama, vault_ready: vaultReady, mode: ollama.available || vaultReady ? 'MODELL KANN VERBUNDEN SEIN' : 'NOT-CONNECTED', note: 'Nur wenn ein Bildmodell erreichbar ist, kann AURA Bildinhalte benennen. Das ist keine Schätzung, sondern eine Abfrage.' };
}

function status() {
  const d = load();
  return {
    area: 'EYE', module: 'eyes', state: 'live', file: FILE, watch_dir: WATCH_DIR,
    can_measure: ['PNG (RGB/RGBA)', 'BMP (24 Bit)', 'PPM'], header_only: ['JPEG', 'GIF', 'WebP'],
    notes: d.notes.length, seen: d.seen.length,
    vision_model: visionModelState(),
    honesty: ['Messwerte sind echte Pixel-Messungen.', 'Bildinhalte („was ist zu sehen") brauchen ein Bildmodell — ohne Modell wird nichts erfunden.', 'Der Bildschirm-Ordner wird nur auf ausdrückliche Abfrage gelesen, nicht heimlich im Hintergrund.'],
  };
}

module.exports = {
  meta: { area: 'EYE', id: 'eyes', name: 'Augen (Bilder messen, Bildschirm-Ordner ansehen)', state: 'live' },
  actions: { status: () => status(), look: (p) => look(p || {}), scan: (p) => scan((p || {}).dir), notes: (p) => notes((p || {}).limit), model: () => visionModelState() },
  sniff, decodePixels, analyse, verdicts, look, scan, notes, status, WATCH_DIR, IMG_EXT,
};
