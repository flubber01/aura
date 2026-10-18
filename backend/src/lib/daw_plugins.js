'use strict';
// AURA · Tonstudio-Plug-ins: eine Effektkette, die man wirklich rechnen kann.
//
// Der Punkt dieses Moduls: Effekte sind keine Etiketten, sondern Parameter mit echten Bereichen und
// echten Regeln. Eine Kette wird geprüft, sortiert (der Limiter gehört ans Ende) und dann als
// Filterkette an den Renderer/das Tonwerkzeug übergeben. Ungültige Werte werden geklemmt oder
// abgelehnt — nie still durchgewinkt.
//
// Ehrlichkeit:
//  • Diese Plug-ins sind eingebaut (AURA-DSP + ffmpeg-Filter). Es werden KEINE fremden VSTs geladen.
//  • Externe offene Plug-ins (Calf, x42, ZamMax, LSP) stehen mit Namen und Lizenz im Katalog und
//    werden als „im Projekt verfügbar" geführt — nicht als „installiert" (das ist Sache des Servers).
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_PLUGINS_AUDIO_FILE || path.join(__dirname, '..', 'data', 'audio_plugins.json');

// Kategorien: in welcher Reihenfolge eine Kette üblicherweise läuft.
const ORDER = { KORREKTUR: 10, DYNAMIK: 20, FARBE: 30, RAUM: 40, BREITE: 50, MESSEN: 60, MASTER: 90 };

const PLUGINS = [
  { id: 'highpass', name: 'Tiefensperre (Hochpass)', cat: 'KORREKTUR', ffmpeg: (p) => `highpass=f=${p.hz}`, params: { hz: { def: 30, min: 10, max: 800, unit: 'Hz' } }, does: 'entfernt Rumpeln unter der Stimme', criteria: 'Bei Gesang 80–120 Hz, bei Bass erst ab 20 Hz.' },
  { id: 'lowpass', name: 'Höhensperre (Tiefpass)', cat: 'KORREKTUR', ffmpeg: (p) => `lowpass=f=${p.hz}`, params: { hz: { def: 18000, min: 1000, max: 22000, unit: 'Hz' } }, does: 'nimmt Zischen weg' },
  { id: 'eq', name: 'Entzerrer (3 Bänder)', cat: 'KORREKTUR', ffmpeg: (p) => `equalizer=f=${p.low}:width_type=o:width=1:g=${p.low_gain},equalizer=f=${p.mid}:width_type=o:width=1:g=${p.mid_gain},equalizer=f=${p.high}:width_type=o:width=1:g=${p.high_gain}`, params: { low: { def: 120, min: 40, max: 400, unit: 'Hz' }, low_gain: { def: 0, min: -15, max: 15, unit: 'dB' }, mid: { def: 900, min: 300, max: 4000, unit: 'Hz' }, mid_gain: { def: 0, min: -15, max: 15, unit: 'dB' }, high: { def: 8000, min: 3000, max: 16000, unit: 'Hz' }, high_gain: { def: 0, min: -15, max: 15, unit: 'dB' } }, does: 'Klangbild formen', criteria: 'Erst schneiden, dann heben. Maximal ±6 dB pro Band, sonst klingt es künstlich.' },
  { id: 'compressor', name: 'Kompressor', cat: 'DYNAMIK', ffmpeg: (p) => `acompressor=threshold=${p.threshold}dB:ratio=${p.ratio}:attack=${p.attack}:release=${p.release}`, params: { threshold: { def: -18, min: -60, max: 0, unit: 'dB' }, ratio: { def: 3, min: 1, max: 20 }, attack: { def: 20, min: 0.01, max: 400, unit: 'ms' }, release: { def: 250, min: 10, max: 3000, unit: 'ms' } }, does: 'laut und ruhig gleichzeitig', criteria: 'Gesang 3:1 mit 10–30 ms Attack. Schlagzeug mehr Ratio, kürzerer Release.' },
  { id: 'gate', name: 'Rauschsperre (Gate)', cat: 'DYNAMIK', ffmpeg: (p) => `agate=threshold=${p.threshold}dB:ratio=${p.ratio}`, params: { threshold: { def: -45, min: -80, max: -10, unit: 'dB' }, ratio: { def: 2, min: 1, max: 20 } }, does: 'Atempausen still', criteria: 'Schwelle knapp unter die leisen Nutztöne, sonst verschluckt es Wortenden.' },
  { id: 'deesser', name: 'Zischlaut-Zähmer', cat: 'DYNAMIK', ffmpeg: (p) => `deesser=i=${p.intensity}`, params: { intensity: { def: 0.3, min: 0, max: 1 } }, does: 'S-Laute zähmen', criteria: 'Nur so viel wie nötig; zu viel macht die Stimme lispelig.' },
  { id: 'distortion', name: 'Verzerrer / Sättigung', cat: 'FARBE', ffmpeg: (p) => `distortion=amount=${p.amount}:makeup=${p.makeup}`, params: { amount: { def: 0.1, min: 0, max: 1 }, makeup: { def: 1, min: 0.5, max: 3 } }, does: 'Wärme oder Härte', criteria: 'Unter 0,1 ist Sättigung, darüber Verzerrung. Immer Pegel nachziehen.' },
  { id: 'chorus', name: 'Chorus', cat: 'FARBE', ffmpeg: (p) => `chorus=${p.in_gain}:${p.out_gain}:${p.delay}:${p.decay}:${p.speed}:${p.depth}`, params: { in_gain: { def: 0.6, min: 0, max: 1 }, out_gain: { def: 0.6, min: 0, max: 1 }, delay: { def: 50, min: 1, max: 100, unit: 'ms' }, decay: { def: 0.4, min: 0, max: 1 }, speed: { def: 0.25, min: 0.05, max: 5, unit: 'Hz' }, depth: { def: 2, min: 0, max: 10, unit: 'ms' } }, does: 'Weite ohne Hall' },
  { id: 'echo', name: 'Echo / Delay', cat: 'RAUM', ffmpeg: (p) => `aecho=${p.in_gain}:${p.out_gain}:${p.delay}:${p.decay}`, params: { in_gain: { def: 0.8, min: 0, max: 1 }, out_gain: { def: 0.9, min: 0, max: 1 }, delay: { def: 250, min: 20, max: 2000, unit: 'ms' }, decay: { def: 0.4, min: 0, max: 0.95 } }, does: 'Tiefe, Rhythmus', criteria: 'Delay-Zeit an das Tempo koppeln (Achtel/Sechzehntel), Decay unter 0,6.' },
  { id: 'reverb', name: 'Hall', cat: 'RAUM', ffmpeg: (p) => `aecho=${p.in_gain}:${p.out_gain}:${p.delay}:${p.decay}`, params: { in_gain: { def: 0.6, min: 0, max: 1 }, out_gain: { def: 0.7, min: 0, max: 1 }, delay: { def: 60, min: 10, max: 200, unit: 'ms' }, decay: { def: 0.75, min: 0, max: 0.95 } }, does: 'Raum (frühe Reflexionen, kurz)', criteria: 'Bei Gesang parallel über einen eigenen Kanal geben, nicht stumpf drüber.' },
  { id: 'stereo', name: 'Stereobreite', cat: 'BREITE', ffmpeg: (p) => `stereotools=mlev=${p.level}`, params: { level: { def: 1, min: 0, max: 2 } }, does: 'Breite der Aufnahme', criteria: 'Über 1,3 klingt es bei Monokompatibilität dünn — kurz gegenprüfen.' },
  { id: 'gain', name: 'Pegel', cat: 'DYNAMIK', ffmpeg: (p) => `volume=${p.db}dB`, params: { db: { def: 0, min: -30, max: 12, unit: 'dB' } }, does: 'lauter/leiser' },
  { id: 'loudnorm', name: 'Lautheit nach EBU R128', cat: 'MASTER', ffmpeg: (p) => `loudnorm=I=${p.i}:TP=${p.tp}:LRA=${p.lra}`, params: { i: { def: -14, min: -24, max: -9, unit: 'LUFS' }, tp: { def: -1.5, min: -3, max: 0, unit: 'dBTP' }, lra: { def: 11, min: 1, max: 20, unit: 'LU' } }, does: 'gleiche Lautheit für Streaming', criteria: 'Streaming üblich -14 LUFS, -1 dBTP. Club darf lauter, Radio nicht.' },
  { id: 'meter', name: 'Pegelmesser', cat: 'MESSEN', ffmpeg: (p) => `astats=metadata=1`, params: {}, does: 'misst statt klingt', criteria: 'Immer als letztes Element der Kette, es verändert nichts.' },
];

const PRESETS = [
  { id: 'vocal-clean', name: 'Gesang sauber', chain: [['highpass', { hz: 90 }], ['eq', { mid: 2000, mid_gain: -2, high_gain: 2 }], ['compressor', { threshold: -20, ratio: 3 }], ['deesser', { intensity: 0.3 }], ['loudnorm', { i: -14 }]] },
  { id: 'vocal-cut', name: 'Gesang schnittig (Rap)', chain: [['highpass', { hz: 110 }], ['eq', { low_gain: -3, mid: 3500, mid_gain: 3 }], ['compressor', { threshold: -22, ratio: 5, attack: 8 }], ['distortion', { amount: 0.08 }], ['loudnorm', { i: -14 }]] },
  { id: 'beat-glue', name: 'Beat zusammenkleben', chain: [['eq', { low: 80, low_gain: 3 }], ['compressor', { threshold: -16, ratio: 4, attack: 30 }], ['stereo', { level: 1.15 }], ['loudnorm', { i: -14 }]] },
  { id: 'podcast-voice', name: 'Podcast-Stimme', chain: [['highpass', { hz: 95 }], ['gate', { threshold: -48 }], ['compressor', { threshold: -20, ratio: 3.5 }], ['deesser', { intensity: 0.35 }], ['loudnorm', { i: -16, tp: -1.5 }]] },
  { id: 'master-safe', name: 'Mastering sicher', chain: [['eq', { low_gain: 1, mid_gain: -1, high_gain: 1.5 }], ['compressor', { threshold: -14, ratio: 2, attack: 40 }], ['loudnorm', { i: -14 }], ['meter', {}]] },
];

function defaults() { return { chains: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['chains', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const plugin = (id) => PLUGINS.find((p) => p.id === String(id).toLowerCase()) || null;

function clampParams(def, given) {
  const out = {}; const clipped = []; const ignored = [];
  for (const [k, spec] of Object.entries(def.params || {})) {
    const raw = given ? given[k] : undefined;
    if (raw === undefined || raw === null || raw === '') { out[k] = spec.def; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) { ignored.push(k); out[k] = spec.def; continue; }
    const v = Math.min(spec.max, Math.max(spec.min, n));
    if (v !== n) clipped.push(`${k}: ${n} → ${v}`);
    out[k] = v;
  }
  for (const k of Object.keys(given || {})) if (!(k in (def.params || {}))) ignored.push(k);
  return { params: out, clipped, ignored };
}

// Kette prüfen: unbekannte Plug-ins fliegen raus (mit Begründung), Parameter werden geklemmt,
// die Reihenfolge wird nach Kategorie sortiert — der Limiter/Messer wandert ans Ende.
function validate(chain) {
  const input = Array.isArray(chain) ? chain : [];
  const steps = []; const rejected = []; const warnings = [];
  input.forEach((raw, i) => {
    const id = Array.isArray(raw) ? raw[0] : (raw && raw.id);
    const given = Array.isArray(raw) ? (raw[1] || {}) : ((raw && raw.params) || {});
    const p = plugin(id);
    if (!p) { rejected.push({ at: i, id: String(id), why: 'kein eingebautes Plug-in mit dieser Kennung' }); return; }
    const c = clampParams(p, given);
    if (c.clipped.length) warnings.push(`${p.id}: Wert außerhalb des Bereichs geklemmt (${c.clipped.join(', ')})`);
    if (c.ignored.length) warnings.push(`${p.id}: unbekannte Parameter ignoriert (${c.ignored.join(', ')})`);
    steps.push({ id: p.id, name: p.name, cat: p.cat, params: c.params });
  });
  steps.sort((a, b) => (ORDER[a.cat] || 50) - (ORDER[b.cat] || 50));
  const last = steps[steps.length - 1];
  if (last && last.cat === 'MASTER') warnings.push('Mastering-Element sitzt am Ende der Kette.');
  if (steps.filter((s) => s.cat === 'MASTER').length > 1) warnings.push('Mehr als ein Mastering-Element: Loudness wird doppelt gerechnet.');
  return { ok: true, steps, rejected, warnings };
}

function buildFilters(chain) {
  const v = validate(chain);
  const filters = v.steps.map((s) => plugin(s.id).ffmpeg(s.params));
  return {
    ok: v.steps.length > 0,
    filters,
    chain: filters.join(','),
    steps: v.steps,
    rejected: v.rejected,
    warnings: v.warnings,
    hint: 'Audio-Kette: an ffmpeg mit -af übergeben (nicht -vf), oder an music_render als Effektkette.',
  };
}

function saveChain(input) {
  const data = load();
  const name = String((input && input.name) || '').trim();
  if (!name) return { ok: false, error: 'Name fehlt' };
  const built = buildFilters((input && input.chain) || []);
  if (!built.ok) return { ok: false, error: 'Kette ist leer oder enthält nur unbekannte Plug-ins', rejected: built.rejected };
  const entry = { id: 'fx-' + Math.random().toString(16).slice(2, 10), name, chain: built.chain, steps: built.steps, warnings: built.warnings, created_at: new Date().toISOString() };
  data.chains.unshift(entry); data.chains = data.chains.slice(0, 100);
  data.audit.unshift({ at: entry.created_at, action: 'saveChain', id: entry.id });
  data.audit = data.audit.slice(0, 200);
  save(data);
  return { ok: true, entry };
}

function status() {
  const data = load();
  const cats = {}; for (const p of PLUGINS) cats[p.cat] = (cats[p.cat] || 0) + 1;
  return {
    area: 'FX', module: 'daw_plugins', state: 'live', file: FILE,
    builtin: PLUGINS.length, categories: cats, presets: PRESETS.length, saved_chains: data.chains.length,
    external_open_reference: ['Calf Studio Gear (LGPL)', 'x42 Plugins (GPL)', 'ZamMax/ZamPlugins (GPL)', 'LSP Plugins (GPL)', 'Surge XT (GPL)', 'Vital (GPL)', 'Dexed (GPL)'],
    rule: 'Es werden nur eingebaute Effekte gerechnet. Fremde VSTs werden nicht geladen — offene Projekte stehen als Vorlage im Katalog.',
    quality: ['Parameter werden auf ihren gültigen Bereich geklemmt statt still übernommen.', 'Die Reihenfolge folgt der Kategorie; Mastering-Elemente gehören ans Ende.', 'Ungültige Plug-in-Kennungen werden mit Begründung abgelehnt, nicht verschluckt.'],
  };
}

module.exports = {
  meta: { area: 'FX', id: 'daw_plugins', name: 'Tonstudio-Plug-ins (Kette, Parameter, Kriterien)', state: 'live' },
  actions: { status: () => status(), plugins: () => ({ ok: true, plugins: PLUGINS.map((p) => ({ id: p.id, name: p.name, cat: p.cat, does: p.does, params: p.params, criteria: p.criteria || null })) }), presets: () => ({ ok: true, presets: PRESETS.map((p) => ({ id: p.id, name: p.name, chain: p.chain.join(' → ') })) }), validate: (p) => validate((p || {}).chain), build: (p) => buildFilters((p || {}).chain), save: (p) => saveChain(p || {}), chains: () => ({ ok: true, chains: load().chains.map((c) => ({ id: c.id, name: c.name, chain: c.chain })) }) },
  PLUGINS, PRESETS, validate, buildFilters, saveChain, status, plugin, ORDER,
};
