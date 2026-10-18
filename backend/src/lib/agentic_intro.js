'use strict';
// AURA · Intro „Agentic AI" — Bild nach Vorlage: Hirn-Hub in der Mitte, Strahlen zu fünf Feldern,
// in jedem Feld läuft ein **eigener Workflow animiert** (wie die Gehirn-Matrix), unten das Fundament
// „DATA ENGINEERING: THE FOUNDATION" mit Datenbanken und Rohren.
//
// Gezeichnet wird hier Pixel für Pixel (kein Fremdwerkzeug, kein Stock-Video, kein Schriftsatz im
// System — eigene 5×7-Punktmatrix aus boot_intro). Der Ton kommt aus dem eigenen Musik-Renderer,
// ffmpeg kodiert zu MP4. Fehlt ffmpeg, sagt der Baustein das ehrlich (BLOCKED_NO_FFMPEG) und liefert
// weiter Einzelbilder.
//
// Die fünf Felder und ihre Workflows (jeder anders, jeder wirklich gerechnet):
//   ORCHESTRATOR      Verzweigung: Eingabe → Planer → drei Äste → Zusammenführung
//   MUSIK & STIL      Kette: Stil → Text → Abteilungen → Renderer → Master
//   KAMERA & DREH     Reihe mit Rücklauf: Storyboard → Einstellungen → Drehtag → Nachdreh
//   PODCAST & BIBEL   Baum: Kapitel → Sprechplan → Feed → Verzeichnisse
//   VERTEILER         Fächer: Master + Kennung → fünf Wege (Läden, Bibliotheken, Direkt)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');
const boot = require('./boot_intro');

const DIR = process.env.AURA_AGENTIC_DIR || path.join(__dirname, '..', 'data', 'intro_agentic');
const FILE = process.env.AURA_AGENTIC_FILE || path.join(__dirname, '..', 'data', 'intro_agentic.json');
const FRAMES = process.env.AURA_AGENTIC_FRAMES || path.join(DIR, 'frames');

// Schrift: die 5×7-Matrix aus boot_intro, ergänzt um die Zeichen, die dort fehlen.
const FONT = Object.assign({}, boot.FONT, {
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
});

const PAL = {
  bg: [4, 9, 16],
  grid: [13, 26, 44],
  cyan: [96, 216, 238],
  blue: [86, 148, 255],
  deep: [30, 84, 150],
  orange: [244, 168, 74],
  gold: [232, 195, 122],
  white: [226, 238, 248],
  dim: [92, 116, 148],
};

// ---------------------------------------------------------------- Zeichnen
function canvas(w, h, bg) {
  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[i * 3] = bg[0]; px[i * 3 + 1] = bg[1]; px[i * 3 + 2] = bg[2]; }
  return { w, h, px, sc: 1 };
}
function blend(px, o, rgb, a) {
  if (a <= 0) return;
  const al = a > 1 ? 1 : a;
  px[o] = Math.round(px[o] * (1 - al) + rgb[0] * al);
  px[o + 1] = Math.round(px[o + 1] * (1 - al) + rgb[1] * al);
  px[o + 2] = Math.round(px[o + 2] * (1 - al) + rgb[2] * al);
}
function setPixel(c, x, y, rgb, alpha) {
  // Wichtig: Buffer-Zugriffe mit krummem Index werden von Node stillschweigend ignoriert.
  // Deshalb hier zentral runden — sonst verschwinden alle Primitive, die Float-Koordinaten
  // bekommen (Rect-Rahmen, Textzeilen, Flächen), spurlos aus dem Bild.
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  blend(c.px, (y * c.w + x) * 3, rgb, alpha === undefined ? 1 : alpha);
}
// Helligkeit dazuzählen (für Leuchten — heller wird heller, dunkel bleibt dunkel)
function addPixel(c, x, y, rgb, strength) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const o = (y * c.w + x) * 3, s = strength === undefined ? 1 : strength;
  for (let k = 0; k < 3; k++) {
    const v = c.px[o + k] + rgb[k] * s;
    c.px[o + k] = v > 255 ? 255 : Math.round(v);
  }
}
// Linie mit Kern und Halo — der Halo macht das Leuchten, das die Vorlage hat.
function line(c, x0, y0, x1, y1, rgb, width, alpha, glow) {
  const sc = c.sc || 1;
  const w = Math.max(1, Math.round((width || 1) * sc)), steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 + 1;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    for (let dx = -w; dx <= w; dx++) for (let dy = -w; dy <= w; dy++) {
      if (dx * dx + dy * dy > w * w) continue;
      setPixel(c, Math.round(x + dx), Math.round(y + dy), rgb, alpha);
    }
    if (glow) for (let dx = -w - 2; dx <= w + 2; dx++) for (let dy = -w - 2; dy <= w + 2; dy++) {
      const d = Math.hypot(dx, dy);
      if (d > w && d <= w + 2) setPixel(c, Math.round(x + dx), Math.round(y + dy), rgb, alpha * 0.16);
    }
  }
}
function ring(c, cx, cy, r, rgb, alpha, dash, glow) {
  const sc = c.sc || 1;
  r = r * sc;
  const steps = Math.max(90, Math.round(r * 6));
  for (let i = 0; i < steps; i++) {
    if (dash && (i % dash) > dash * 0.6) continue;
    const a = (i / steps) * Math.PI * 2;
    setPixel(c, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), rgb, alpha);
    if (glow) setPixel(c, Math.round(cx + Math.cos(a) * (r + 1 * sc)), Math.round(cy + Math.sin(a) * (r + 1 * sc)), rgb, alpha * 0.2);
  }
}
function arc(c, cx, cy, r, a0, a1, rgb, alpha, thick) {
  const sc = c.sc || 1;
  r = r * sc;
  const tk = Math.max(1, Math.round((thick || 1) * sc));
  const steps = Math.max(20, Math.round(r * Math.abs(a1 - a0) * 1.6));
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    for (let d = 0; d < tk; d++) setPixel(c, Math.round(cx + Math.cos(a) * (r + d)), Math.round(cy + Math.sin(a) * (r + d)), rgb, alpha);
  }
}
function rect(c, x0, y0, x1, y1, rgb, alpha, thick) {
  const t = Math.max(1, Math.round((thick || 1) * (c.sc || 1)));
  for (let x = x0; x <= x1; x++) for (let d = 0; d < t; d++) { setPixel(c, x, y0 + d, rgb, alpha); setPixel(c, x, y1 - d, rgb, alpha); }
  for (let y = y0; y <= y1; y++) for (let d = 0; d < t; d++) { setPixel(c, x0 + d, y, rgb, alpha); setPixel(c, x1 - d, y, rgb, alpha); }
}
function fillRect(c, x0, y0, x1, y1, rgb, alpha) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPixel(c, x, y, rgb, alpha);
}
function text(c, str, x, y, scale, rgb, alpha) {
  const sc = c.sc || 1;
  scale = Math.max(1, Math.round(scale * sc));
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) {
      if (g[gy][gx] !== '1') continue;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) setPixel(c, cx + gx * scale + sx, y + gy * scale + sy, rgb, alpha);
    }
    cx += 6 * scale;
  }
  return cx;
}
const textWidth = (str, scale) => String(str).length * 6 * scale;
function textCentered(c, str, cx, y, scale, rgb, alpha) {
  const sc = c.sc || 1, px2 = Math.max(1, Math.round(scale * sc));
  text(c, str, Math.round(cx - (String(str).length * 6 * px2) / 2), y, scale, rgb, alpha);
}
function dot(c, cx, cy, r, rgb, alpha) {
  const sc = c.sc || 1;
  r = r * sc;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= r) addPixel(c, x, y, rgb, alpha * (1 - (d / r) * 0.55));
    else if (d <= r + 2 * sc) addPixel(c, x, y, rgb, alpha * 0.14);
  }
}
// Reproduzierbarer Pseudo-Zufall (kein Math.random): dasselbe Bild zur selben Zeit ergibt exakt
// dasselbe Ergebnis — sonst flackert das Bild und der Bewegungsbeweis im Test wäre wertlos.
function hash(n) { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); }

// weiche Annäherung: 0 → 1 in der Dauer, danach 1
const prog = (t, from, dur) => Math.max(0, Math.min(1, (t - from) / dur));
const ease = (k) => k * k * (3 - 2 * k);
const pulse = (t, period) => 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2);

// ---------------------------------------------------------------- Die fünf Felder
// Jedes Feld hat einen echten kleinen Arbeitsablauf: Knoten (mit Ort im Feld), Kanten (von → nach),
// eine Laufrichtung für den Wanderpunkt und eine Farbe. Der Ablauf wird gezeichnet, nicht angedeutet.
const PANELS = [
  {
    id: 'orchestrator', short: 'EINGABE - PLANER - 3 AESTE', label: 'ORCHESTRATOR', icon: 'net', cx: 640, cy: 74, w: 210, h: 74,
    color: PAL.cyan, phase: 4.0,
    nodes: [[0.12, 0.5], [0.34, 0.5], [0.58, 0.22], [0.58, 0.5], [0.58, 0.78], [0.88, 0.5]],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [3, 5], [4, 5]],
    path: [0, 1, 3, 5], note: 'Eingabe → Planer → drei Äste → Zusammenführung',
  },
  {
    id: 'musik', short: 'STIL - TEXT - ABTEILUNGEN', label: 'MUSIK & STIL', icon: 'wave', cx: 196, cy: 150, w: 196, h: 84,
    color: PAL.blue, phase: 4.5,
    nodes: [[0.1, 0.62], [0.32, 0.3], [0.55, 0.62], [0.78, 0.3], [0.92, 0.62]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    path: [0, 1, 2, 3, 4], note: 'Stil → Text → Abteilungen → Renderer → Master',
  },
  {
    id: 'kamera', short: 'STORYBOARD - DREH - NACHDREH', label: 'KAMERA & DREH', icon: 'cam', cx: 1084, cy: 150, w: 196, h: 84,
    color: PAL.cyan, phase: 5.0,
    nodes: [[0.1, 0.32], [0.42, 0.32], [0.74, 0.32], [0.42, 0.74]],
    edges: [[0, 1], [1, 2], [1, 3], [3, 1]],
    path: [0, 1, 3, 1, 2], note: 'Storyboard → Einstellungen → Drehtag → Nachdreh',
  },
  {
    id: 'spoken', short: 'KAPITEL - SPRECHPLAN - FEED', label: 'PODCAST & BIBEL', icon: 'book', cx: 196, cy: 398, w: 196, h: 84,
    color: PAL.gold, phase: 5.5,
    nodes: [[0.12, 0.5], [0.4, 0.24], [0.4, 0.76], [0.7, 0.5], [0.92, 0.5]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
    path: [0, 1, 3, 4], note: 'Kapitel → Sprechplan → Feed → Verzeichnisse',
  },
  {
    id: 'dist', short: 'MASTER - KENNUNG - 5 WEGE', label: 'VERTEILER', icon: 'fan', cx: 1084, cy: 398, w: 196, h: 84,
    color: PAL.orange, phase: 6.0,
    nodes: [[0.12, 0.5], [0.44, 0.5], [0.78, 0.14], [0.78, 0.38], [0.78, 0.62], [0.78, 0.86]],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
    path: [0, 1, 2], note: 'Master + Kennung → fünf Wege (Läden, Bibliotheken, Direkt)',
  },
];

const FOUNDATION = { label: 'DATA ENGINEERING: THE FOUNDATION', x0: 150, y0: 556, x1: 1130, y1: 634 };

// Hervorhebung: der Scheinwerfer wandert der Reihe nach über die fünf Felder. Das aktive Feld
// glüht (Rahmen, Lichthof, Pfeil von oben, Ablauf als Text), die übrigen treten zurück.
// Beginnt, sobald alle Felder stehen, und läuft als Umlauf weiter (auch bei längeren Videos).
const HIGHLIGHT = { start: 4.6, dur: 1.4, fade: 0.25 };
function highlightAt(t) {
  if (t < HIGHLIGHT.start) return { index: -1, amount: 0, id: null, local: 0, round: 0 };
  const passed = t - HIGHLIGHT.start;
  const round = Math.floor(passed / (HIGHLIGHT.dur * PANELS.length));
  const idx = Math.floor(passed / HIGHLIGHT.dur) % PANELS.length;
  const local = passed - Math.floor(passed / HIGHLIGHT.dur) * HIGHLIGHT.dur;
  const amount = Math.max(0, Math.min(1, Math.min(local / HIGHLIGHT.fade, (HIGHLIGHT.dur - local) / HIGHLIGHT.fade)));
  return { index: idx, amount, id: PANELS[idx].id, local, round };
}
const HUB = { cx: 640, cy: 250, r: 112 };


// Die Anordnung liegt als Vorlage in 1280×720 fest. Für jede andere Bildgröße wird sie
// umgerechnet (gleicher Maßstab für x und y, Rest mittig) — sonst klebt das Bild bei 1920×1080
// in der linken oberen Ecke (genau das war im Videobild zu sehen).
function layoutFor(w, h, zoom, shiftX, shiftY) {
  const z = zoom || 1;
  const F = Math.min(w / 1280, h / 720) * z;
  const ox = Math.round((w - 1280 * F) / 2 + (shiftX || 0) * F), oy = Math.round((h - 720 * F) / 2 + (shiftY || 0) * F);
  const sx = (x) => Math.round(ox + x * F), sy = (y) => Math.round(oy + y * F);
  return {
    F, ox, oy,
    hub: { cx: sx(HUB.cx), cy: sy(HUB.cy), r: HUB.r * F },
    foundation: { label: FOUNDATION.label, x0: sx(FOUNDATION.x0), y0: sy(FOUNDATION.y0), x1: sx(FOUNDATION.x1), y1: sy(FOUNDATION.y1) },
    panels: PANELS.map((p) => Object.assign({}, p, { cx: sx(p.cx), cy: sy(p.cy), w: p.w * F, h: p.h * F })),
  };
}

// Statischer Hintergrund: Grundfarbe, feines Gitter, Sternpunkte — einmal rechnen, je Bild kopieren.
function background(w, h) {
  const c = canvas(w, h, PAL.bg);
  for (let x = 0; x < w; x += 40) for (let y = 0; y < h; y++) setPixel(c, x, y, PAL.grid, 0.35);
  for (let y = 0; y < h; y += 40) for (let x = 0; x < w; x++) setPixel(c, x, y, PAL.grid, 0.35);
  let seed = 20261016;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < Math.round(w * h / 5200); i++) setPixel(c, Math.floor(rnd() * w), Math.floor(rnd() * h), PAL.dim, 0.25 + rnd() * 0.3);
  return c;
}

// Die Gehirn-Matrix: 7×5 Knoten, die nacheinander aufflammen, mit Geflecht untereinander.
// Dazu ein Lichtfächer, der langsam über das Feld streicht — dadurch lebt der Kern sichtbar.
function brainMatrix(c, cx, cy, r, t, brgb) {
  const cols = 7, rows = 5, step = (r * 1.5) / cols;
  const lit = [];
  const sweep = (t * 0.55) % (Math.PI * 2);
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const x = Math.round(cx - r * 0.75 + gx * step + step / 2);
    const y = Math.round(cy - r * 0.5 + gy * step * 0.9 + step / 2);
    const ph = (gx * 0.7 + gy * 1.3);
    const k = pulse(t + ph * 0.12, 1.6);
    const ang = Math.atan2(y - cy, x - cx);
    const near = Math.abs(((ang - sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI - 0.45;
    const on = k > 0.62 || near;
    if (on) lit.push([x, y]);
    dot(c, x, y, on ? 3.0 : 1.6, on ? PAL.white : brgb, on ? 0.95 : 0.35);
  }
  // Verbindungen zwischen den gerade leuchtenden Knoten — das „Matrix"-Geflecht
  for (let i = 0; i < lit.length; i++) for (let j = i + 1; j < lit.length; j++) {
    const d = Math.hypot(lit[i][0] - lit[j][0], lit[i][1] - lit[j][1]);
    if (d < step * 1.8) line(c, lit[i][0], lit[i][1], lit[j][0], lit[j][1], brgb, 0, 0.26);
  }
}

// Schockwellen: Ringe, die aus dem Kern nach außen laufen — „baller" ohne Kitsch.
function shockwaves(c, hub, F, t) {
  for (let i = 0; i < 3; i++) {
    const ph = ((t * 0.42 + i / 3) % 1);
    if (ph < 0.06) continue;
    const r = (HUB.r + 6) + ph * 96;
    ring(c, hub.cx, hub.cy, r, i % 2 ? PAL.orange : PAL.cyan, (1 - ph) * 0.22);
  }
}

// Kleine Symbole für die Felder — gezeichnet, nicht aus einer Bilddatei.
// S ist der Maßstab, damit die Symbole in jeder Bildgröße gleich aussehen.
function panelIcon(c, x, y, kind, rgb, alpha, t, S) {
  const a = alpha, sc = S || c.sc || 1;
  if (kind === 'net') {                       // Netz: vier Punkte, verbunden
    dot(c, x, y + 6 * sc, 2, rgb, a);
    dot(c, x + 9 * sc, y + 1 * sc, 2, rgb, a);
    dot(c, x + 9 * sc, y + 11 * sc, 2, rgb, a);
    dot(c, x + 17 * sc, y + 6 * sc, 2, rgb, a);
    line(c, x, y + 6 * sc, x + 9 * sc, y + 1 * sc, rgb, 0, 0.5 * a);
    line(c, x, y + 6 * sc, x + 9 * sc, y + 11 * sc, rgb, 0, 0.5 * a);
    line(c, x + 9 * sc, y + 1 * sc, x + 17 * sc, y + 6 * sc, rgb, 0, 0.5 * a);
    line(c, x + 9 * sc, y + 11 * sc, x + 17 * sc, y + 6 * sc, rgb, 0, 0.5 * a);
  } else if (kind === 'wave') {               // Ton: laufende Wellenlinie
    for (let i = 0; i <= Math.round(18 * sc); i++) {
      setPixel(c, x + i, y + 6 * sc + Math.round(Math.sin(t * 3 + i * 0.4) * 4 * sc), rgb, a);
    }
    line(c, x, y + 12 * sc, x + 18 * sc, y + 12 * sc, rgb, 0, 0.4 * a);
  } else if (kind === 'cam') {                // Kamera: Gehäuse, Linse, Sucher
    rect(c, x, y + 3 * sc, x + 16 * sc, y + 13 * sc, rgb, 0.8 * a, 1);
    ring(c, x + 8 * sc, y + 8 * sc, 3, rgb, 0.9 * a, 0);
    line(c, x + 3 * sc, y + 3 * sc, x + 6 * sc, y, rgb, 0, 0.8 * a);
    line(c, x + 6 * sc, y, x + 10 * sc, y, rgb, 0, 0.8 * a);
  } else if (kind === 'book') {               // Buch/Bibel: zwei Seiten
    const L = (xa, ya, xb, yb, al) => line(c, x + xa * sc, y + ya * sc, x + xb * sc, y + yb * sc, rgb, 0, al * a);
    L(1, 2, 1, 12, 0.9); L(17, 2, 17, 12, 0.9); L(1, 2, 9, 4, 0.7); L(17, 2, 9, 4, 0.7);
    L(1, 12, 9, 14, 0.7); L(17, 12, 9, 14, 0.7); L(9, 4, 9, 14, 0.9);
  } else {                                    // Fächer: ein Punkt zu vielen
    dot(c, x, y + 7 * sc, 2, rgb, a);
    for (let i = 0; i < 4; i++) {
      const yy = y + (2 + i * 3.2) * sc;
      line(c, x, y + 7 * sc, x + 16 * sc, yy, rgb, 0, 0.5 * a);
      dot(c, x + 17 * sc, Math.round(yy), 1.6, rgb, a);
    }
  }
}

// Mini-Matrix im Feld: ein Raster kleiner Punkte, die versetzt aufblitzen. Damit hat jedes Feld
// denselben „Gehirn-Matrix"-Charakter wie der Hub — der Workflow läuft darüber.
function panelMatrix(c, inner, t, rgb, a, seed) {
  const cols = 9, rows = 3;
  const sx = (inner.x1 - inner.x0) / (cols + 1), sy = (inner.y1 - inner.y0) / (rows + 1);
  for (let gy = 1; gy <= rows; gy++) for (let gx = 1; gx <= cols; gx++) {
    const x = Math.round(inner.x0 + gx * sx), y = Math.round(inner.y0 + gy * sy);
    const h = hash(gx * 7.31 + gy * 3.17 + seed * 13.7);
    const phase = ((t * 1.35 + h * 4.2) % 3.2);
    const on = phase < 0.75;
    dot(c, x, y, on ? 1.9 : 1.0, on ? PAL.white : rgb, (on ? 0.62 : 0.16) * a);
  }
}

// Ein Feld zeichnen: Mini-Matrix, Rahmen, Ikone, Titel, laufender Workflow.
// hl sagt, ob dieses Feld gerade hervorgehoben ist (0 = nein, 1 = voll): dann glüht der Rahmen,
// ein Lichthof liegt darunter, ein Pfeil zeigt von oben darauf, der Ablauf steht als Text darin —
// und die übrigen Felder treten zurück.
function drawPanel(c, p, t, hl, idx) {
  const k = ease(prog(t, p.phase, 0.7));
  if (k <= 0.001) return { done: 0 };
  const S = c.sc || 1;
  const isActive = !!hl && hl.index === idx;
  const amount = isActive ? hl.amount : 0;
  const dim = !hl || hl.index < 0 ? 1 : (isActive ? 1 + 0.3 * hl.amount : 1 - 0.25 * hl.amount);
  const a = Math.min(1.3, k * dim);
  const grow = 1 + 0.08 * amount;              // hervorgehoben = größer
  const x0 = Math.round(p.cx - p.w * grow / 2), x1 = Math.round(p.cx + p.w * grow / 2);
  const y0 = Math.round(p.cy - p.h * grow / 2), y1 = Math.round(p.cy + p.h * grow / 2);
  const inner = { x0: x0 + 10 * S, y0: y0 + 20 * S, x1: x1 - 10 * S, y1: y1 - 22 * S };
  const px = (nx) => Math.round(inner.x0 + nx * (inner.x1 - inner.x0));
  const py = (ny) => Math.round(inner.y0 + ny * (inner.y1 - inner.y0));

  // Lichthof und Grundflaeche beim hervorgehobenen Feld (liegt unter allem anderen)
  if (amount > 0.02) {
    const halo = Math.round(9 * S * amount);
    for (let d = halo; d >= 1; d--) rect(c, x0 - d, y0 - d, x1 + d, y1 + d, p.color, 0.05 * amount, 1);
    fillRect(c, x0 + 1, y0 + 1, x1 - 1, y1 - 1, [10, 26, 48], 0.55 * amount * k);
  }

  panelMatrix(c, inner, t, p.color, a, p.phase);
  rect(c, x0, y0, x1, y1, isActive ? PAL.white : p.color, (isActive ? 0.85 * amount + 0.4 * (1 - amount) : 0.55) * a, isActive ? 2 : 1);
  // Ecken betont (wie in der Vorlage: kleine Winkel) — beim aktiven Feld laenger und weiss
  const ek = Math.round((12 + 10 * amount) * S);
  const ec = amount > 0.4 ? PAL.white : p.color;
  line(c, x0, y0 + ek, x0, y0, ec, 1, 0.9 * a, true);
  line(c, x0, y0, x0 + ek, y0, ec, 1, 0.9 * a, true);
  line(c, x1 - ek, y1, x1, y1, ec, 1, 0.9 * a, true);
  line(c, x1, y1 - ek, x1, y1, ec, 1, 0.9 * a, true);
  // Kanten: sie wachsen nacheinander (Fortschritt je Kante)
  let drawn = 0;
  p.edges.forEach((e, idx2) => {
    const kk = ease(prog(t, p.phase + 0.5 + idx2 * 0.12, 0.35));
    if (kk <= 0.02) return;
    drawn++;
    const a0 = p.nodes[e[0]], a1 = p.nodes[e[1]];
    const mx = px(a0[0]) + (px(a1[0]) - px(a0[0])) * kk;
    const my = py(a0[1]) + (py(a1[1]) - py(a0[1])) * kk;
    line(c, px(a0[0]), py(a0[1]), mx, my, isActive ? PAL.white : p.color, 0, (isActive ? 0.3 + 0.35 * amount : 0.45) * a);
  });
  // Knoten: leuchten nacheinander auf
  p.nodes.forEach((n, idx2) => {
    const kn = ease(prog(t, p.phase + 0.75 + idx2 * 0.1, 0.3));
    if (kn <= 0.02) return;
    const x = px(n[0]), y = py(n[1]);
    const hot = pulse(t + idx2 * 0.22, 1.1);
    dot(c, x, y, (3.1 + hot * 0.8) * (1 + 0.25 * amount), p.color, 0.75 * a * kn);
    dot(c, x, y, 1.7, PAL.white, (0.55 + 0.35 * amount) * a * kn);
  });
  // Laeufer mit Schweif: drei Stueck, gleichmaessig ueber den Umlauf verteilt
  const speed = 0.5;                                    // Sekunden je Kante
  const cyc = Math.max(0.1, (p.path.length - 1) * speed);
  const total = t - (p.phase + 1.0);
  const runners = 3;
  const atPosition = (age) => {
    const pos = ((age % cyc) / speed);
    const seg = Math.min(p.path.length - 2, Math.floor(pos));
    const frac = pos - seg;
    const a0 = p.nodes[p.path[seg]], a1 = p.nodes[p.path[seg + 1]];
    return [px(a0[0]) + (px(a1[0]) - px(a0[0])) * frac, py(a0[1]) + (py(a1[1]) - py(a0[1])) * frac];
  };
  if (total > 0) {
    for (let r = 0; r < runners; r++) {
      const age = total - r * (cyc / runners);
      if (age < 0) continue;
      for (let tail = 8; tail >= 0; tail--) {
        const tt = age - tail * 0.03;
        if (tt < 0) continue;
        const [x, y] = atPosition(tt);
        if (tail === 0) {
          dot(c, Math.round(x), Math.round(y), 3.3 + 1.1 * amount, PAL.white, 0.95 * a);
          dot(c, Math.round(x), Math.round(y), 6.2 + 2 * amount, p.color, (0.3 + 0.3 * amount) * a);
          // Ankunft am Knoten: kurzer Blitz (Radius waechst, Helligkeit faellt)
          for (const n of p.nodes) {
            const d = Math.hypot(x - px(n[0]), y - py(n[1]));
            if (d < 5) {
              const flash = 1 - d / 5;
              dot(c, px(n[0]), py(n[1]), 5.5 + flash * 3, p.color, 0.55 * flash * a);
              dot(c, px(n[0]), py(n[1]), 2.4, PAL.white, 0.9 * flash * a);
            }
          }
        } else dot(c, Math.round(x), Math.round(y), 2.4 - tail * 0.13, p.color, (0.4 - tail * 0.04) * a);
      }
    }
  }
  // Fortschrittsbalken innen oben: fuellt sich im Takt des Umlaufs (unten sitzen Text und Titel)
  if (total > 0) {
    const frac = (total % cyc) / cyc;
    const bw = inner.x1 - inner.x0;
    line(c, inner.x0, y0 + 5 * S, inner.x0 + bw * frac, y0 + 5 * S, isActive ? PAL.white : p.color, 0, 0.65 * a);
  }
  panelIcon(c, x0 + 16 * S, y0 + 11 * S, p.icon, p.color, 1, t, S);
  // Titel innen unten. Die Hoehe wird aus der **echten** Schriftgroesse gerechnet — vorher stand sie
  // ueber den gerundeten Massstab, dadurch sass der Titel bei 1920x1080 direkt auf dem Rahmen.
  const tsize = Math.max(1, Math.round(1 * S));
  const tw = String(p.label).length * 6 * tsize;
  const tTop = y1 - Math.round(5 * S) - 7 * tsize;
  fillRect(c, Math.round(p.cx - tw / 2) - 5 * S, tTop - 3 * S, Math.round(p.cx + tw / 2) + 4 * S, y1 - 3 * S, [6, 12, 22], 0.92 * a);
  text(c, p.label, Math.round(p.cx - tw / 2), tTop, 1, isActive ? PAL.white : p.color, 0.95 * a);
  // Ablauf **dauerhaft** unter dem Feld: jedes Feld trägt seinen Workflow immer sichtbar als
  // eigene Box (Rahmen und Text in der Feldfarbe). Der Scheinwerfer hebt dieselbe Box dann
  // hell und cyan heraus — hervorgehoben ist also immer jedes Feld, eines besonders.
  if (k > 0.5 && p.short) {
    const csize = Math.max(1, Math.round(1 * S));
    const cw = String(p.short).length * 6 * csize;
    const bx0 = Math.round(p.cx - cw / 2) - 6 * S, bx1 = Math.round(p.cx + cw / 2) + 6 * S;
    const by0 = y1 + Math.round(6 * S), by1 = by0 + 7 * csize + 6 * S;
    const capA = isActive ? Math.max(0.6, amount) : 0.6;
    const capCol = isActive ? PAL.cyan : p.color;
    fillRect(c, bx0, by0, bx1, by1, [4, 10, 20], 0.9 * capA * k);
    rect(c, bx0, by0, bx1, by1, capCol, (isActive ? 0.85 : 0.55) * capA * k, 1);
    text(c, p.short, Math.round(p.cx - cw / 2), by0 + 3 * S, 1, capCol, (isActive ? 1 : 0.8) * capA * k);
    line(c, Math.round(p.cx), y1, Math.round(p.cx), by0, capCol, 0, (isActive ? 0.7 : 0.4) * capA * k);
  }
  // Pfeil von oben auf das hervorgehobene Feld
  if (amount > 0.02) {
    const cxp = Math.round(p.cx), ty = y0 - Math.round(10 * S);
    line(c, cxp, ty - Math.round(8 * S), cxp, ty, PAL.white, 0, 0.85 * amount);
    line(c, cxp - Math.round(5 * S), ty - Math.round(6 * S), cxp, ty, PAL.white, 0, 0.85 * amount);
    line(c, cxp + Math.round(5 * S), ty - Math.round(6 * S), cxp, ty, PAL.white, 0, 0.85 * amount);
    dot(c, cxp, ty - Math.round(11 * S), 2.2, PAL.white, 0.8 * amount);
  }
  return { done: drawn };
}

// Die Strahlen: vom Hub zu jedem Feld, mit Pfeilspitze und laufendem Funken (blau/orange wie Vorlage).
// Für Felder links/rechts endet der Strahl an der **Innenseite** des Rahmens — lief er auf die Unterkante
// zu, kreuzte er den Titel unter dem Feld (im ersten Bild deutlich sichtbar).
function rayTarget(p, L) {
  L = L || layoutFor(1280, 720);
  const F = L.F, hub = L.hub;
  if (p.cy < hub.cy - 40 * F) return [p.cx, p.cy + p.h / 2 + 4 * F];    // oben
  if (p.cx < hub.cx) return [p.cx + p.w / 2 + 4 * F, p.cy];             // links
  return [p.cx - p.w / 2 - 4 * F, p.cy];                                // rechts
}
function drawRays(c, t, L, hl) {
  L = L || layoutFor(1280, 720);
  const hub = L.hub, F = L.F;
  const start = 2.3;
  L.panels.forEach((p, i) => {
    const target = rayTarget(p, L);
    const dx = target[0] - hub.cx, dy = target[1] - hub.cy;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const sx = hub.cx + ux * (hub.r + 6 * F), sy = hub.cy + uy * (hub.r + 6 * F);
    const k = ease(prog(t, start + i * 0.18, 0.55));
    if (k <= 0.01) return;
    const ex = sx + (target[0] - 6 * ux - sx) * k, ey = sy + (target[1] - 6 * uy - sy) * k;
    const act = !!hl && hl.index === i;
    const dimRay = !hl || hl.index < 0 ? 1 : (act ? 1 + 0.55 * hl.amount : 1 - 0.5 * hl.amount);
    const col = i % 2 === 0 ? PAL.cyan : PAL.orange;
    if (act && hl.amount > 0.02) {              // Lichtkegel: weicher Fächer zum aktiven Feld
      const qx = -uy, qy = ux;
      for (let k = -3; k <= 3; k++) {
        line(c, hub.cx + ux * hub.r * 0.9, hub.cy + uy * hub.r * 0.9,
          target[0] + qx * k * 9 * F, target[1] + qy * k * 9 * F, col, 0, 0.055 * hl.amount);
      }
    }
    line(c, sx, sy, ex, ey, act ? PAL.white : col, 0, 0.55 * dimRay, true);
    if (k > 0.98) {
      const px2 = -uy, py2 = ux;
      const headCol = act ? PAL.white : col;
      line(c, target[0], target[1], target[0] - ux * 9 * F + px2 * 5 * F, target[1] - uy * 9 * F + py2 * 5 * F, headCol, 0, 0.75 * dimRay);
      line(c, target[0], target[1], target[0] - ux * 9 * F - px2 * 5 * F, target[1] - uy * 9 * F - py2 * 5 * F, headCol, 0, 0.75 * dimRay);
      // Verkehr in **beide** Richtungen mit Schweif: hin (hell) und zurück (weiß).
      for (let f = 0; f < 3; f++) {
        const out = ((t * 0.5 + f * 0.34 + i * 0.11) % 1);          // hinaus zum Feld
        const inn = (1 - ((t * 0.42 + f * 0.29 + i * 0.07) % 1));   // zurück zum Kern
        for (const [fr, dirOut] of [[out, true], [inn, false]]) {
          for (let tail = 0; tail < 7; tail++) {
            const tt = fr - (dirOut ? 1 : -1) * tail * 0.022;
            if (tt < 0 || tt > 1) continue;
            const x = Math.round(sx + (ex - sx) * tt), y = Math.round(sy + (ey - sy) * tt);
            if (tail === 0) { dot(c, x, y, 3.0 + 1.2 * (act ? hl.amount : 0), PAL.white, 0.95); dot(c, x, y, 5.6 + 2 * (act ? hl.amount : 0), col, 0.3 + 0.3 * (act ? hl.amount : 0)); }
            else dot(c, x, y, 2.2 - tail * 0.16, col, (0.34 - tail * 0.04) * dimRay);
          }
        }
      }
      // Pegelbalken entlang des Strahls (wie eine laufende Leitung)
      const pegel = pulse(t + i * 0.3, 1.2);
      for (let q = 0; q < 6; q++) {
        const fr = q / 6;
        if (fr > pegel) break;
        setPixel(c, Math.round(sx + (ex - sx) * fr), Math.round(sy + (ey - sy) * fr), col, 0.2);
      }
    }
  });
  // Zwei waagerechte Seitenpfeile (wie in der Vorlage): zeigen nach links und rechts ins Leere.
  [[-1, PAL.blue], [1, PAL.orange]].forEach(([dir, col], i) => {
    const k = ease(prog(t, start + 0.4 + i * 0.2, 0.6));
    if (k <= 0.01) return;
    const y = hub.cy - 4 * F;
    const x0 = hub.cx + dir * (hub.r + 6 * F), x1 = x0 + dir * (120 * F * k);
    line(c, x0, y, x1, y, col, 0, 0.5, true);
    if (k > 0.98) {
      line(c, x1, y, x1 - dir * 9 * F, y - 5 * F, col, 0, 0.7);
      line(c, x1, y, x1 - dir * 9 * F, y + 5 * F, col, 0, 0.7);
      for (let f = 0; f < 2; f++) {
        const fr = ((t * 0.5 + f * 0.5 + i * 0.25) % 1);
        dot(c, Math.round(x0 + (x1 - x0) * fr), y, 2.2, col, 0.8);
      }
    }
  });
}

// Das Fundament: Rohre vom Hub nach unten, eine Sammelleitung, Kettenglieder und Symbole,
// Datenbanken auf der Leitung, aufsteigende Datenpunkte. Vorbild ist die Leiterplatte der Vorlage.
function drawFoundation(c, t, L) {
  L = L || layoutFor(1280, 720);
  const HUB = L.hub, FOUNDATION = L.foundation;
  const k = ease(prog(t, 3.4, 1.1));
  if (k <= 0.01) return;
  const top = Math.round(HUB.cy + HUB.r + 6);
  const busY = FOUNDATION.y0 - 16;
  // Senkrechte Rohre vom Hub zur Sammelleitung
  [[540, 'pipe'], [610, 'db'], [670, 'pipe'], [740, 'db']].forEach(([x], i) => {
    const kk = ease(prog(t, 3.4 + i * 0.14, 0.6));
    const endY = top + (busY - top) * kk;
    line(c, x, top, x, endY, i % 2 === 0 ? PAL.cyan : PAL.blue, 0, 0.4, true);
    if (kk > 0.9) {
      const fr = 1 - ((t * 0.35 + i * 0.25) % 1);
      dot(c, x, Math.round(top + (busY - top) * fr), 2, PAL.cyan, 0.85);
    }
  });
  // Sammelleitung mit Kettengliedern (wie Leiterbahnen)
  const kk2 = ease(prog(t, 3.7, 0.7));
  line(c, 300, busY, 980, busY, PAL.blue, 0, 0.45 * kk2, true);
  for (let x = 330; x <= 970; x += 40) {
    const on = pulse(t + x * 0.01, 1.4) > 0.55;
    dot(c, x, busY, on ? 2.6 : 1.6, on ? PAL.cyan : PAL.deep, 0.75 * kk2);
  }
  // Symbole auf der Leitung (Balken, Zahnrad, Netz, Lupe) — kleine Zeichnungen, keine Bilddateien
  [[350, 'bars'], [410, 'gear'], [900, 'net'], [960, 'lens']].forEach(([x, kind], i) => {
    const ka = ease(prog(t, 4.2 + i * 0.1, 0.5));
    if (ka <= 0.01) return;
    const y = busY - 20;
    if (kind === 'bars') { for (let b = 0; b < 3; b++) line(c, x + b * 5, y + 12, x + b * 5, y + 12 - (4 + b * 3), PAL.cyan, 1, 0.8 * ka); line(c, x - 2, y + 13, x + 14, y + 13, PAL.cyan, 0, 0.6 * ka); }
    if (kind === 'gear') { ring(c, x + 6, y + 6, 5, PAL.gold, 0.9 * ka, 0); for (let g = 0; g < 8; g++) { const a2 = (g / 8) * Math.PI * 2; line(c, x + 6 + Math.cos(a2) * 5, y + 6 + Math.sin(a2) * 5, x + 6 + Math.cos(a2) * 8, y + 6 + Math.sin(a2) * 8, PAL.gold, 0, 0.8 * ka); } dot(c, x + 6, y + 6, 2, PAL.gold, 0.9 * ka); }
    if (kind === 'net') { dot(c, x, y + 12, 2, PAL.cyan, ka); dot(c, x + 7, y + 2, 2, PAL.cyan, ka); dot(c, x + 14, y + 12, 2, PAL.cyan, ka); line(c, x, y + 12, x + 7, y + 2, PAL.cyan, 0, 0.5 * ka); line(c, x + 7, y + 2, x + 14, y + 12, PAL.cyan, 0, 0.5 * ka); line(c, x, y + 12, x + 14, y + 12, PAL.cyan, 0, 0.35 * ka); }
    if (kind === 'lens') { ring(c, x + 6, y + 7, 5, PAL.orange, 0.9 * ka, 0); line(c, x + 10, y + 11, x + 15, y + 16, PAL.orange, 0, 0.9 * ka); dot(c, x + 6, y + 7, 2, PAL.orange, 0.7 * ka); }
  });
  // Datenbanken stehen auf der Leitung
  [[330, 0], [470, 1], [820, 2], [960, 3], [1020, 4]].forEach(([x, i]) => {
    const kd = ease(prog(t, 3.9 + i * 0.1, 0.5));
    if (kd <= 0.01) return;
    const w = 26, hh = 30, y = busY - hh;
    for (let dy = 0; dy < hh; dy++) for (let dx = -w / 2; dx <= w / 2; dx++) {
      if (Math.abs(dx) > w / 2 - 1 || dy === 0 || dy === hh - 1) setPixel(c, x + dx, y + dy, PAL.blue, 0.6 * kd);
    }
    for (let ell = 0; ell < 3; ell++) {
      const ey = y + 7 + ell * 9;
      for (let dx = -w / 2; dx <= w / 2; dx++) {
        const t2 = dx / (w / 2);
        setPixel(c, x + Math.round(dx), ey + Math.round(Math.abs(t2) * 2), PAL.blue, 0.42 * kd);
      }
      if (pulse(t + i * 0.3 + ell * 0.25, 1.3) > 0.6) dot(c, x, ey, 2.4, PAL.cyan, 0.75 * kd);
    }
    line(c, x, busY, x, busY + 6, PAL.blue, 0, 0.5 * kd);
  });
  // Leiste mit Namen und Fortschritt
  rect(c, FOUNDATION.x0, FOUNDATION.y0, FOUNDATION.x1, FOUNDATION.y1, PAL.blue, 0.5 * k, 1);
  fillRect(c, FOUNDATION.x0 + 1, FOUNDATION.y0 + 1, FOUNDATION.x1 - 1, FOUNDATION.y1 - 1, [8, 18, 32], 0.85 * k);
  // Name und Unterzeile: Zeilenhöhen aus der echten Schriftgröße, damit sie sich in **keiner**
  // Bildgröße berühren (bei 1920×1080 lagen sie vorher nur 2 Punkte auseinander).
  const S = c.sc || 1;
  const mSize = Math.max(1, Math.round(2 * S));            // Name: Größe 2
  const sSize = Math.max(1, Math.round(1 * S));            // Unterzeile: Größe 1
  const cxF = (FOUNDATION.x0 + FOUNDATION.x1) / 2;
  const nameTop = FOUNDATION.y0 + Math.round(6 * S);
  const subTop = nameTop + 7 * mSize + Math.round(5 * S);
  const nameW = String(FOUNDATION.label).length * 6 * mSize;
  text(c, FOUNDATION.label, Math.round(cxF - nameW / 2), nameTop, 2, PAL.white, k);
  const sub = 'ROHRE 14 - STUFEN 95 - DATENBANKEN 5 - KENNUNGEN 24';
  const subW = String(sub).length * 6 * sSize;
  text(c, sub, Math.round(cxF - subW / 2), subTop, 1, PAL.cyan, 0.7 * k);
  const frac = Math.min(1, (t - 3.4) / 6);
  const barY = FOUNDATION.y1 - Math.round(9 * S);
  line(c, FOUNDATION.x0 + 30, barY, FOUNDATION.x0 + 30 + (FOUNDATION.x1 - FOUNDATION.x0 - 60) * frac, barY, PAL.cyan, 0, 0.6 * k);
}

// Die fallende Matrix am Rand (dezent, nur an den Außenstreifen — die Mitte bleibt klar).
function drawMatrixDigits(c, t, seedBase) {
  // Nur die Außenränder: links x ≤ 90, rechts x ≥ Breite−90. Felder fangen bei 98 an — sonst
  // schreiben die Ziffern mitten in die Felder (im Zwischenbild deutlich sichtbar).
  const cols = [];
  for (let x = 18; x <= 90; x += 24) cols.push(x);
  for (let x = c.w - 90; x <= c.w - 18; x += 24) cols.push(x);
  cols.forEach((x, i) => {
    const speed = 24 + ((i * 7) % 5) * 7;
    const span = c.h + 80;
    const off = ((t * speed + i * 37) % span) - 40;
    for (let k = 0; k < 4; k++) {
      const y = Math.round(off - k * 16);
      if (y < 0 || y > c.h - 8) continue;
      const ch = ((i * 13 + k * 7 + Math.floor(t * 3) + seedBase) % 2) ? '1' : '0';
      text(c, ch, x, y, 1, k === 0 ? PAL.cyan : PAL.deep, k === 0 ? 0.7 : 0.35);
    }
  });
}

// ---------------------------------------------------------------- Ein Bild bauen
function frameAt(t, total, opts) {
  const o = Object.assign({ width: 1280, height: 720 }, opts || {});
  const w = o.width, h = o.height;
  const c = o._bg && o._bg.w === w && o._bg.h === h ? { w, h, px: Buffer.from(o._bg.px) } : canvas(w, h, PAL.bg);
  if (!c.px.length) return c;
  // Kamera-Atmung: die Szene atmet leicht (Zoom + Verschiebung). Der Hintergrund bleibt stehen,
  // dadurch entsteht Tiefe. Alles andere wächst proportional mit — dieselbe Wirkung in jeder Größe.
  const breathe = o.still ? 1 : (1 + 0.012 * Math.sin(t * 0.55) + 0.007 * Math.sin(t * 1.73));
  const driftX = o.still ? 0 : 5 * Math.sin(t * 0.31);
  const driftY = o.still ? 0 : 3 * Math.sin(t * 0.43);
  const L = layoutFor(w, h, breathe, driftX, driftY);
  const F = L.F, hub = L.hub, FOUNDATION = L.foundation;
  c.sc = F;                                    // Strichstärken wachsen mit der Bildgröße mit

  drawMatrixDigits(c, t, o.seed || 3);
  drawMatrixRain(c, t);                        // feiner Matrix-Regen über das ganze Bild (dezent)

  // Hauptkreis aufbauen
  const hubK = ease(prog(t, 0.6, 1.0));
  if (hubK > 0.01) {
    shockwaves(c, hub, F, t);                  // Schockwellen laufen aus dem Kern nach außen
    ring(c, hub.cx, hub.cy, HUB.r, PAL.cyan, 0.55 * hubK, 0, true);
    ring(c, hub.cx, hub.cy, HUB.r - 9, PAL.blue, 0.4 * hubK, 3);
    ring(c, hub.cx, hub.cy, HUB.r - 24, PAL.deep, 0.3 * hubK, 5);
    arc(c, hub.cx, hub.cy, HUB.r - 3, t * 1.1, t * 1.1 + 0.9, PAL.cyan, 0.85 * hubK, 2);
    arc(c, hub.cx, hub.cy, HUB.r - 3, t * 1.1 + Math.PI, t * 1.1 + Math.PI + 0.9, PAL.orange, 0.75 * hubK, 2);
    arc(c, hub.cx, hub.cy, HUB.r - 16, -t * 0.7, -t * 0.7 + 1.4, PAL.blue, 0.7 * hubK, 2);
    // Tickmarken wie in der Vorlage
    for (let i = 0; i < 36; i++) {
      const a2 = (i / 36) * Math.PI * 2;
      const r0 = HUB.r + 4 + (i % 6 === 0 ? 6 : 2), r1 = r0 + 5;
      line(c, hub.cx + Math.cos(a2) * r0 * F, hub.cy + Math.sin(a2) * r0 * F, hub.cx + Math.cos(a2) * r1 * F, hub.cy + Math.sin(a2) * r1 * F, PAL.deep, 0, 0.5 * hubK);
    }
    // Kern: leuchtender Punkt + Gehirn-Matrix
    const core = 0.55 + pulse(t, 1.5) * 0.45;
    dot(c, hub.cx, hub.cy + 8 * F, 52 + core * 7, [20, 74, 126], 0.5 * hubK);
    ring(c, hub.cx, hub.cy + 8 * F, 48, PAL.deep, 0.5 * hubK, 4);
    brainMatrix(c, hub.cx, hub.cy + 8 * F, 50, t, PAL.cyan);
    textCentered(c, 'AGENTIC AI', hub.cx, hub.cy - 84 * F, 2, PAL.white, hubK);
    textCentered(c, 'CREED STREET STUDIOS', hub.cx, hub.cy + 70 * F, 1, PAL.gold, 0.75 * hubK);
  }

  const hl = highlightAt(t);                   // welches Feld gerade hervorgehoben ist
  drawRays(c, t, L, hl);
  L.panels.forEach((p, i) => drawPanel(c, p, t, hl, i));
  drawFoundation(c, t, L);
  drawHighlightBar(c, hl, L, t);                // Anzeige: welches Feld an der Reihe ist

  // Abspann: Hauszeichen und Rechte
  const endK = ease(prog(t, o.seconds - 1.6, 0.6));
  if (endK > 0.01) {
    const alpha = 1 - ease(prog(t, o.seconds - 0.7, 0.7));
    houseMark(c, w - 96 * F, 74 * F, 26, alpha);
    textCentered(c, '© CREED STREET STUDIOS 2026', w / 2, h - 22 * F, 1, PAL.dim, 0.8 * alpha);
  }
  return c;
}

// Anzeige unter dem Fundament: fünf Punkte, der Punkt des hervorgehobenen Feldes leuchtet.
function drawHighlightBar(c, hl, L, t) {
  const S = c.sc || 1, F = L.foundation;
  const cx = (F.x0 + F.x1) / 2, y = F.y1 + Math.round(16 * S);
  const gap = 16 * S;
  for (let i = 0; i < PANELS.length; i++) {
    const x = Math.round(cx + (i - (PANELS.length - 1) / 2) * gap);
    const act = hl && hl.index === i;
    const amt = act ? hl.amount : 0;
    dot(c, x, Math.round(y), 2.2 + 1.4 * amt, act ? PAL.white : PANELS[i].color, act ? 0.4 + 0.6 * amt : 0.28);
    if (act) ring(c, x, Math.round(y), 4.5, PANELS[i].color, 0.5 * amt, 0);
  }
  // kleiner Hinweistext daneben, nur wenn gerade hervorgehoben wird
  if (hl && hl.index >= 0 && hl.amount > 0.3) {
    const label = 'ABLAUF ' + (hl.index + 1) + ' VON 5';
    textCentered(c, label, cx, Math.round(y + 9 * S), 1, PAL.dim, 0.6 * hl.amount);
  }
}

// Feiner Matrix-Regen über das **ganze** Bild — dezent, damit die Felder klar bleiben.
function drawMatrixRain(c, t) {
  const S = c.sc || 1;
  const step = Math.round(34 * S);
  for (let x = Math.round(14 * S); x < c.w; x += step) {
    const col = Math.round(x / step);
    const h1 = hash(col * 3.77), h2 = hash(col * 9.13 + 5.2);
    const speed = 22 + h1 * 34;
    const span = c.h + 120 * S;
    const off = ((t * speed + h2 * span) % span) - 60 * S;
    for (let k = 0; k < 5; k++) {
      const y = Math.round(off - k * 15 * S);
      if (y < 0 || y > c.h - 8 * S) continue;
      const ch = ((col + k + Math.floor(t * 4)) % 2) ? '1' : '0';
      text(c, ch, x, y, 1, k === 0 ? PAL.cyan : PAL.deep, k === 0 ? 0.5 : 0.22);
    }
  }
}

// Hauszeichen (Ring, zwei Straßen, Punkt) — hier lokal gezeichnet, damit dieser Baustein nicht von
// inneren Funktionen eines anderen abhängt.
function houseMark(c, cx, cy, r, alpha) {
  const sc = c.sc || 1, rp = r * sc;                 // Bahn in Bildpunkten, Ring/Punkt skalieren selbst
  ring(c, cx, cy, r, PAL.gold, alpha, 0, true);
  ring(c, cx, cy, r * 0.82, PAL.cyan, alpha * 0.75, 0);
  for (let i = 0; i <= 60; i++) {
    const k = i / 60;
    const x = Math.round(cx - rp * 0.62 + k * rp * 0.62), y = Math.round(cy + rp * 0.62 - k * rp * 0.62);
    for (let d = -1; d <= 1; d++) {
      setPixel(c, x + d, y + d, PAL.gold, alpha);
      setPixel(c, Math.round(cx + rp * 0.62 - k * rp * 0.62) + d, y + d, PAL.cyan, alpha * 0.85);
    }
  }
  dot(c, cx, cy, 3, PAL.gold, alpha);
}

// ---------------------------------------------------------------- PNG (für die Vorschau im Browser)
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function toPNG(c) {
  const raw = Buffer.alloc((c.w * 3 + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    raw[y * (c.w * 3 + 1)] = 0;                                  // Filter „keine"
    c.px.copy(raw, y * (c.w * 3 + 1) + 1, y * c.w * 3, (y + 1) * c.w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8 Bit, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Ein Bild als PNG liefern (für die Vorschau, ohne Videodatei).
function picture(input) {
  const p = input || {};
  const seconds = Math.max(0, Math.min(60, Number(p.seconds) || 0));
  const o = {
    width: Math.max(320, Math.min(1920, Number(p.width) || 1280)),
    height: Math.max(180, Math.min(1080, Number(p.height) || 720)),
    seconds: Number(p.total) || DEFAULT_TOTAL,
  };
  const t0 = Date.now();
  const c = frameAt(seconds, o.seconds, o);
  const png = toPNG(c);
  return { ok: true, seconds, size: { width: c.w, height: c.h }, bytes: png.length, ms: Date.now() - t0, png };
}

// ---------------------------------------------------------------- Rendern
const DEFAULT_TOTAL = 12;

function writePPM(c, file) {
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`P6\n${c.w} ${c.h}\n255\n`, 'latin1'), c.px]));
}

function renderToFrames(input) {
  const p = input || {};
  const w = Math.max(320, Math.min(1920, Number(p.width) || 1280));
  const h = Math.max(180, Math.min(1080, Number(p.height) || 720));
  const total = Math.max(4, Math.min(30, Number(p.seconds) || DEFAULT_TOTAL));
  const fps = Math.max(12, Math.min(30, Number(p.fps) || 25));
  const count = Math.round(total * fps);
  const opts = { width: w, height: h, seconds: total, seed: Number(p.seed) || 3, _bg: background(w, h) };
  fs.mkdirSync(FRAMES, { recursive: true });
  for (let i = 0; i < count; i++) writePPM(frameAt(i / fps, total, opts), path.join(FRAMES, `a-${String(i).padStart(4, '0')}.ppm`));
  return { w, h, total, fps, count, frames_dir: FRAMES, opts };
}

function musicSting(input) {
  const p = input || {};
  try {
    const mr = require('./music_render');
    const style = mr.STYLES[String(p.music_style || 'cinematic')] ? String(p.music_style || 'cinematic') : 'cinematic';
    const seconds = Number(p.seconds) || DEFAULT_TOTAL;
    const bpm = (mr.STYLES[style] && Number(mr.STYLES[style].bpm)) || 90;
    const barDur = (60 / bpm) * 4;
    const bars = Math.max(2, Math.round(seconds / barDur));
    const r = mr.render({ style, bars, seed: Number(p.seed) || 20261016, title: 'Agentic Intro' });
    return { ok: true, file: r.file, style, bars, bpm, duration: r.duration, note: 'Ton aus dem eigenen Musik-Renderer — kein Fremdmaterial.' };
  } catch (e) { return { ok: false, error: 'Musik ließ sich nicht rendern: ' + e.message }; }
}

function render(input) {
  const p = input || {};
  const bin = boot.ffmpegBin();
  if (!bin) {
    return Promise.resolve({
      ok: false, code: 409, status: 'BLOCKED_NO_FFMPEG',
      error: 'Ohne ffmpeg entsteht keine Videodatei. Die Einzelbilder zeichnet AURA trotzdem.',
      frames_possible: true,
      single_frame: '/api/intro/agentic/frame.png?seconds=6',
    });
  }
  const t0 = Date.now();
  let built;
  try { built = renderToFrames(p); } catch (e) { return Promise.resolve({ ok: false, status: 'FAILED', error: 'Bilder: ' + e.message }); }
  const audio = musicSting(p);
  const outDir = path.join(DIR, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const id = 'agentic-' + Math.random().toString(16).slice(2, 8);
  const out = path.join(outDir, `${id}.mp4`);
  const args = ['-y', '-framerate', String(built.fps), '-i', path.join(FRAMES, 'a-%04d.ppm')];
  if (audio.ok) args.push('-i', audio.file);
  args.push('-vf', `scale=${Number(p.out_width) || 1920}:${Number(p.out_height) || 1080}:flags=lanczos`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p');
  if (audio.ok) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push(out);
  const started = Date.now();
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 20 * 60 * 1000, maxBuffer: 1024 * 1024 * 32 }, (err, stdout, stderr) => {
      const entry = {
        id, at: new Date().toISOString(), seconds: built.total, fps: built.fps, frames: built.count,
        source_size: `${built.w}x${built.h}`, out: err ? null : out,
        size: err ? 0 : (fs.existsSync(out) ? fs.statSync(out).size : 0),
        audio: audio.ok ? audio.style : null, audio_error: audio.ok ? null : audio.error,
        ms: Date.now() - started, status: err ? 'FAILED' : 'DONE',
        error: err ? String((stderr || err.message || '')).slice(-400) : null,
      };
      const d = load();
      d.renders.unshift(entry); d.renders = d.renders.slice(0, 30);
      d.audit.unshift({ at: entry.at, action: 'render', id, status: entry.status, frames: entry.frames });
      save(d);
      try { for (const f of fs.readdirSync(FRAMES)) fs.unlinkSync(path.join(FRAMES, f)); } catch { /* egal */ }
      resolve({ ok: !err, status: entry.status, video: entry, build_ms: Date.now() - t0, panels: PANELS.length, panel_workflows: PANELS.map((x) => ({ id: x.id, label: x.label, what: x.note, nodes: x.nodes.length, edges: x.edges.length })) , honest: 'Das Bild ist hier gezeichnet; der Ton kommt aus dem eigenen Renderer.' });
    });
  });
}

// ---------------------------------------------------------------- Zustand und Dateien
function defaults() { return { renders: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['renders', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function status() {
  const d = load();
  const bin = boot.ffmpegBin();
  return {
    area: 'INTRO2', module: 'agentic_intro', state: 'live', file: FILE, out_dir: path.join(DIR, 'out'),
    mode: bin ? 'RENDERN MÖGLICH' : 'NUR EINZELBILDER (kein ffmpeg)',
    ffmpeg: bin || 'NICHT GEFUNDEN',
    panels: PANELS.map((p) => ({ id: p.id, label: p.label, workflow: p.note, nodes: p.nodes.length, edges: p.edges.length })),
    hub: { center: [HUB.cx, HUB.cy], radius: HUB.r, inside: 'Gehirn-Matrix (7×5 Knoten, leuchten im Takt, mit Geflecht und Lichtfächer)' },
    rays: PANELS.length * 2,
    bewegung: {
      je_feld: 'Mini-Matrix aus 27 Punkten, 3 Läufer mit Schweif, Ankunftsblitz an den Knoten, Fortschrittsbalken',
      strahlen: 'Verkehr in beide Richtungen (hin und zurück) mit Schweif, dazu Pegelbalken',
      hub: 'Schockwellen laufen nach außen, Lichtfächer streicht über die Matrix',
      hintergrund: 'Matrix-Regen aus 0/1 über das ganze Bild, dazu Gitter und Sternpunkte',
      kamera: 'leichte Atmung (Zoom und Verschiebung) — über still:true abschaltbar',
    },
    foundation: { label: FOUNDATION.label, cylinders: 5, trunks: 4, note: 'Daten steigen vom Fundament in den Hub.' },
    highlight: {
      takt: HIGHLIGHT.start + ' s Start, ' + HIGHLIGHT.dur + ' s je Feld, Umlauf ' + (HIGHLIGHT.dur * PANELS.length).toFixed(2) + ' s',
      was_passiert: 'Rahmen glüht weiß, Lichthof, Pfeil von oben, Ablauf als Textbox unter dem Feld, Leitung zum Hub wird hell, die anderen vier Felder treten zurück',
      anzeige: 'fünf Punkte unter dem Fundament zeigen, welches Feld an der Reihe ist',
      abschaltbar: 'ohne Wirkung vor ' + HIGHLIGHT.start + ' s und in jedem Einzelbild mit still=true',
    },
    phases: [
      { from: 0.0, to: 1.2, what: 'Grund und Matrix fallen ein, Hauptkreis zeichnet sich' },
      { from: 1.2, to: 2.3, what: 'Kern zündet, Gehirn-Matrix pulsiert' },
      { from: 2.3, to: 4.0, what: 'Strahlen fahren zu den Feldern' },
      { from: 4.0, to: 6.5, what: 'Felder erscheinen nacheinander, ihre Workflows laufen an' },
      { from: 3.4, to: 6.0, what: 'Fundament, Rohre und Datenbanken wachsen' },
      { from: 6.5, to: 10.4, what: 'alles läuft: Wanderpunkte, Funken, aufsteigende Daten' },
      { from: 10.4, to: 12.0, what: 'Abspann mit Hauszeichen und Rechten' },
    ],
    renders: d.renders.length, last: d.renders[0] ? { id: d.renders[0].id, status: d.renders[0].status, size: d.renders[0].size, frames: d.renders[0].frames } : null,
    honesty: [
      'Alles hier gezeichnet (Pixel für Pixel), eigene Schrift, kein Fremdmaterial, kein Stock-Video.',
      'Ton aus dem eigenen Musik-Renderer. Ohne ffmpeg bleibt es bei Einzelbildern — das steht dann da.',
      'Die Workflows in den Feldern sind wirklich animierte Knoten-Kanten-Läufe, keine Standbilder.',
    ],
  };
}

// Vorschauseite: lädt Einzelbilder im Takt nach (kein Video nötig).
function page(input) {
  const p = input || {};
  const total = Number(p.seconds) || DEFAULT_TOTAL;
  const w = Number(p.width) || 960, h = Number(p.height) || 540;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Intro „Agentic AI" · Creed Street Studios</title>
<style>body{background:#05080f;color:#e6eef8;font:15px/1.5 system-ui,sans-serif;margin:0;padding:20px}
h1{font-size:20px;margin:0 0 6px}.sub{color:#8fa3bf;margin-bottom:14px}
img{width:100%;max-width:${w}px;border:1px solid #1d2c46;border-radius:12px;background:#05080f}
.row{display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap}
button{background:#12203a;color:#cfe3ff;border:1px solid #24405f;border-radius:8px;padding:7px 12px;cursor:pointer}
button:hover{background:#182b4a}.mono{font-family:ui-monospace,monospace;color:#7fd1a0}
a{color:#8ab4ff}</style></head><body>
<h1>Intro „Agentic AI"</h1>
<div class="sub">Hirn-Hub, Strahlen zu fünf Feldern — in jedem Feld läuft ein eigener Workflow — und unten das Fundament mit dem Namen DATA ENGINEERING: THE FOUNDATION (Rohre, Datenbanken, Kennungen). Vorschau: Einzelbilder im Takt, ${total} s gesamt.</div>
<img id="f" src="/api/intro/agentic/frame.png?seconds=0&width=${w}&height=${h}" alt="Vorschaubild">
<div class="row">
  <button onclick="toggle()" id="b">Anhalten</button>
  <button onclick="seek(-0.5)">−0,5 s</button>
  <button onclick="seek(0.5)">+0,5 s</button>
  <span class="mono" id="t">0,00 s</span>
  <span class="mono" id="s">lädt …</span>
  <a href="/api/intro/agentic/status">Daten</a>
</div>
<script>
let t=0, run=true, last=performance.now();
const img=document.getElementById('f'), lbl=document.getElementById('t'), st=document.getElementById('s'), b=document.getElementById('b');
const TOTAL=${total};
function paint(){ img.src='/api/intro/agentic/frame.png?seconds='+t.toFixed(2)+'&width=${w}&height=${h}'; lbl.textContent=t.toFixed(2)+' s'; }
function toggle(){ run=!run; b.textContent=run?'Anhalten':'Weiter'; }
function seek(d){ t=Math.max(0,Math.min(TOTAL-0.01,t+d)); paint(); }
img.addEventListener('load',()=>{ st.textContent='Bild '+(performance.now()-last).toFixed(0)+' ms'; },{once:false});
setInterval(()=>{ if(!run) return; const now=performance.now(); const dt=(now-last)/1000; last=now; t=(t+dt)%TOTAL; }, 1000/25);
setInterval(()=>{ if(!run) return; paint(); }, 140);
paint();
</script></body></html>`;
  return { ok: true, html, seconds: total };
}

function list() {
  const d = load();
  return { ok: true, count: d.renders.length, renders: d.renders };
}

module.exports = {
  meta: { area: 'INTRO2', id: 'agentic_intro', name: 'Intro „Agentic AI" — Hirn-Hub, fünf Workflow-Felder, Fundament', state: 'live' },
  actions: {
    status: () => status(),
    build: (p) => ({ ok: true, total: Number((p || {}).seconds) || DEFAULT_TOTAL, panels: PANELS, hub: HUB, foundation: FOUNDATION, page: '/api/intro/agentic/start' }),
    frame: (p) => { const r = picture(p || {}); delete r.png; return r; },
    render: (p) => render(p || {}),
    page: (p) => page(p || {}),
    list: () => list(),
    workflows: () => ({ ok: true, panels: PANELS.map((x) => ({ id: x.id, label: x.label, nodes: x.nodes.length, edges: x.edges.length, path: x.path, what: x.note, appears_at_second: x.phase })) }),
  },
  PAL, FONT, PANELS, HUB, FOUNDATION, DEFAULT_TOTAL,
  canvas, setPixel, addPixel, line, ring, arc, rect, text, textCentered, dot, background,
  brainMatrix, drawPanel, drawRays, drawFoundation, drawHighlightBar, houseMark, frameAt, layoutFor, highlightAt, HIGHLIGHT, toPNG, picture, renderToFrames, musicSting, render, page, list, status,
};
