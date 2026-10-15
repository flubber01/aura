'use strict';
// AURA Studio — Groove-Generator und Orchestrator (deterministisch, mit Seed).
// Erzeugt Rasterdaten (16 Schritte pro Takt) und Arrangements. Kein Audio, keine Dateien.
// Die Ausgabe kann später in eine DAW oder ein MIDI-Werkzeug übergeben werden.

const STYLES = {
  'four-on-floor': { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], ghost: [] },
  'boom-bap': { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [3, 11] },
  'trap': { kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [15] },
  'breakbeat': { kick: [0, 10], snare: [4, 12], hat: [2, 6, 10, 14], ghost: [7, 13] },
  'halftime': { kick: [0, 11], snare: [8], hat: [0, 4, 8, 12], ghost: [14] },
};

// Kleiner deterministischer Zufallsgenerator (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function groove({ style = 'boom-bap', bars = 2, swing = 0, humanize = 0, seed = 1 } = {}) {
  if (!STYLES[style]) throw new Error('unbekannter Stil: ' + style + ' (erlaubt: ' + Object.keys(STYLES).join(', ') + ')');
  const b = Math.min(Math.max(Number(bars) || 2, 1), 16);
  const sw = Math.min(Math.max(Number(swing) || 0, 0), 0.5);
  const hu = Math.min(Math.max(Number(humanize) || 0, 0), 0.05);
  const r = rng(Number(seed) || 1);
  const pat = STYLES[style];
  const hits = [];
  for (let bar = 0; bar < b; bar++) {
    for (const [inst, steps] of Object.entries({ kick: pat.kick, snare: pat.snare, hat: pat.hat, ghost: pat.ghost })) {
      for (const s of steps) {
        const step = bar * 16 + s;
        // Swing verschiebt jede zweite Achtel (Schritte 2, 6, 10, 14 im Takt) nach hinten.
        const swung = (s % 4 === 2) ? sw * 0.25 : 0;
        const jitter = hu ? (r() * 2 - 1) * hu : 0;
        const vel = inst === 'ghost' ? 0.35 : inst === 'hat' ? 0.6 + r() * 0.1 : 0.9;
        hits.push({ inst: inst === 'ghost' ? 'snare' : inst, step, offset: Number((swung + jitter).toFixed(4)), velocity: Number(Math.min(vel, 1).toFixed(2)), ghost: inst === 'ghost' });
      }
    }
  }
  return { style, bars: b, steps_per_bar: 16, swing: sw, humanize: hu, seed: Number(seed) || 1, hits };
}

const SECTION_LAYERS = {
  intro: ['pad'],
  verse: ['drums', 'bass', 'keys'],
  pre: ['drums', 'keys'],
  chorus: ['drums', 'bass', 'keys', 'lead', 'strings'],
  bridge: ['pad', 'strings'],
  breakdown: ['drums', 'pad'],
  outro: ['pad', 'keys'],
};

// form: z. B. "intro,verse,chorus,verse,chorus,outro"; bars je Abschnitt (Standard 8)
function orchestrate({ form = 'intro,verse,chorus,verse,chorus,outro', bars = 8, instruments = null } = {}) {
  const sections = String(form).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!sections.length) throw new Error('form leer');
  if (sections.length > 24) throw new Error('form zu lang (max 24 Abschnitte)');
  const bl = Math.min(Math.max(Number(bars) || 8, 1), 64);
  const allowed = instruments ? new Set(instruments) : null;
  const out = [];
  let start = 0;
  for (const name of sections) {
    if (!SECTION_LAYERS[name]) throw new Error('unbekannter Abschnitt: ' + name + ' (erlaubt: ' + Object.keys(SECTION_LAYERS).join(', ') + ')');
    const layers = SECTION_LAYERS[name].filter((l) => !allowed || allowed.has(l));
    out.push({ section: name, start_bar: start, bars: bl, layers });
    start += bl;
  }
  const used = [...new Set(out.flatMap((s) => s.layers))];
  return { total_bars: start, sections: out, instruments_used: used };
}

// Musik-Skills suchen (nur Metadaten aus backend/data/music_skills.json). Nichts wird ausgeführt.
function skills(q = '', limit = 20) {
  const fs = require('fs');
  const path = require('path');
  let list = [];
  try { list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'music_skills.json'), 'utf8')).skills || []; } catch { list = []; }
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const scored = list.map((s) => {
    const hay = (s.id + ' ' + s.title + ' ' + s.description + ' ' + (s.tasks || []).join(' ')).toLowerCase();
    const score = terms.length ? terms.reduce((a, t) => a + (hay.includes(t) ? 1 : 0), 0) : 1;
    return { s, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.s.title.localeCompare(b.s.title));
  return scored.slice(0, n).map((x) => x.s);
}

module.exports = {
  groove, orchestrate, skills, STYLES: Object.keys(STYLES), SECTIONS: Object.keys(SECTION_LAYERS),
  meta: { area: 'STU', id: 'music_studio', name: 'Studio: Groove-Generator und Orchestrator', state: 'live' },
};
