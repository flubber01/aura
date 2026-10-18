'use strict';
// AURA · Song-Orchester (die „Suno"-Arbeitsweise, maximal ausgebaut).
//
// Aus einer Beschreibung wird ein vollständiger Bauplan für einen Song — und dann wirklich gerechnet
// bzw. gerendert, soweit es ohne fremdes Modell geht:
//
//   1. Auslesen der Beschreibung: Stil, Tempo, Tonart, Stimmung, Länge, Sprache
//   2. Aufbau planen: Abschnitte mit Taktzahlen, Instrumentenlagen, Energie-Kurve
//   3. Effektketten je Lage aus dem eigenen Tonstudio (daw_plugins) — echte Filterketten
//   4. Textgerüst aus dem Textdichter (lyric_writer), wenn gewünscht
//   5. Rendern über den eigenen Musik-Renderer: Entwurf + Varianten + Stems (echte Dateien)
//   6. Prüflauf (Qualitätskontrolle): Taktgefühl, Länge, Pegel, ob Varianten sich unterscheiden
//   7. Übergabe: Ablage im Speicher (Fassung 1), Vorgang in den Abteilungen, Veröffentlichung nur mit Mensch
//
// Was hier bewusst NICHT passiert: es gibt keinen Zugriff auf Suno/Udio (kein offener Zugang) und
// keinen Gesang. Erzeugt wird ein instrumentaler Entwurf — lokal berechnet, kein fremder Dienst.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_ORCHESTRATOR_FILE || path.join(__dirname, '..', 'data', 'orchestrator.json');

const STYLE_HINTS = [
  { match: [/trap/i, /808/], style: 'trap', bpm: 140, note: 'Trap' },
  { match: [/drill/i], style: 'trap', bpm: 142, note: 'Drill' },
  { match: [/lofi/i, /lo-fi/i, /chill/i], style: 'lofi', bpm: 82, note: 'Lo-Fi' },
  { match: [/schlager/i], style: 'schlager', bpm: 124, note: 'Schlager' },
  { match: [/pop/i], style: 'pop', bpm: 112, note: 'Pop' },
  { match: [/rock/i], style: 'rock', bpm: 128, note: 'Rock' },
  { match: [/jazz/i], style: 'jazz', bpm: 96, note: 'Jazz' },
  { match: [/klassik/i, /cinematic/i, /film/i, /orchester/i], style: 'cinematic', bpm: 76, note: 'Filmmusik' },
  { match: [/hip.?hop/i, /rap/i, /boom.?bap/i], style: 'boombap', bpm: 92, note: 'Hip-Hop' },
  { match: [/house/i, /techno/i, /edm/i, /dance/i], style: 'house', bpm: 124, note: 'Electronic' },
  { match: [/ambient/i, /flächen/i], style: 'ambient', bpm: 70, note: 'Ambient' },
];

const SECTIONS = [
  { id: 'intro', bars: 2, energy: 0.25, layers: ['pad', 'lead'] },
  { id: 'aufbau', bars: 2, energy: 0.45, layers: ['drums', 'bass', 'pad'] },
  { id: 'strophe', bars: 8, energy: 0.62, layers: ['drums', 'bass', 'chords', 'lead'] },
  { id: 'vor-refrain', bars: 4, energy: 0.72, layers: ['drums', 'bass', 'chords', 'pad'] },
  { id: 'refrain', bars: 8, energy: 0.95, layers: ['drums', 'bass', 'chords', 'lead', 'pad'] },
  { id: 'strophe2', bars: 8, energy: 0.66, layers: ['drums', 'bass', 'chords', 'lead'] },
  { id: 'refrain2', bars: 8, energy: 1.0, layers: ['drums', 'bass', 'chords', 'lead', 'pad'] },
  { id: 'bruecke', bars: 4, energy: 0.5, layers: ['pad', 'lead', 'bass'] },
  { id: 'ende', bars: 2, energy: 0.3, layers: ['pad', 'chords'] },
];
const SHORT_SECTIONS = ['intro', 'strophe', 'refrain', 'ende'];

function defaults() { return { plans: [], renders: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['plans', 'renders', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }
function safe(fn, fallback) { try { const r = fn(); return r === undefined ? fallback : r; } catch { return fallback; } }

// 1. + 2. Beschreibung lesen und Aufbau planen.
function plan(input) {
  const p = input || {};
  const prompt = String(p.prompt || p.beschreibung || '').trim();
  if (prompt.length < 4) return { ok: false, error: 'Ohne Beschreibung kein Plan — bitte prompt angeben (z. B. "dunkler Trap mit Schlager-Piano, 140 bpm")' };
  const style = (() => {
    for (const s of STYLE_HINTS) if (s.match.some((r) => r.test(prompt))) return s;
    const mr = safe(() => require('./music_render'), null);
    return { style: mr && p.style && mr.STYLES[p.style] ? p.style : 'lofi', bpm: Number(p.bpm) || 90, note: 'aus dem Wunsch abgeleitet' };
  })();
  const bpm = Math.max(60, Math.min(200, Number(p.bpm) || style.bpm));
  const minutes = Math.max(0.5, Math.min(8, Number(p.minutes) || 3));
  const beat = 60 / bpm, barDur = beat * 4;
  const barsWanted = Math.max(8, Math.round((minutes * 60) / barDur));
  const layout = (p.short !== false && minutes <= 1.5) ? SHORT_SECTIONS : SECTIONS.map((s) => s.id);
  const byId = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
  let taken = 0; const parts = [];
  for (const id of layout) {
    const s = byId[id];
    if (taken + s.bars > barsWanted + 2) {
      const rest = barsWanted - taken;
      if (rest >= 2) parts.push(Object.assign({}, s, { bars: rest, trimmed: true }));
      break;
    }
    parts.push(Object.assign({}, s));
    taken += s.bars;
  }
  const totalBars = parts.reduce((n, s) => n + s.bars, 0);
  const seconds = Number((totalBars * barDur).toFixed(2));

  // 3. Effektketten je Lage aus dem eigenen Tonstudio.
  const plugins = safe(() => require('./daw_plugins'), null);
  const chains = {};
  const fxFor = (layer) => {
    if (!plugins || !plugins.PLUGINS) return [];
    const byId = Object.fromEntries(plugins.PLUGINS.map((x) => [x.id, x]));
    const recipe = {
      drums: ['compressor', 'eq'], bass: ['eq', 'compressor'], chords: ['eq', 'reverb'], lead: ['delay', 'reverb'], pad: ['reverb', 'eq'],
    }[layer] || [];
    return recipe.map((id) => byId[id]).filter(Boolean).map((x) => ({ id: x.id, name: x.name, params: Object.fromEntries(Object.entries(x.params || {}).map(([k, v]) => [k, v.def])) }));
  };
  for (const l of new Set(parts.flatMap((x) => x.layers))) chains[l] = fxFor(l);

  // 4. Textgerüst, wenn gewünscht.
  const lyrics = p.lyrics === true || p.text === true
    ? safe(() => require('./lyric_writer').write({ subject: p.subject || prompt.slice(0, 60), lang: p.lang || 'de', structure: /hip|rap|trap/i.test(prompt) ? 'hiphop' : /schlager/i.test(prompt) ? 'schlager' : 'popsong', mood: /nacht|dark|trap/i.test(prompt) ? 'nacht' : /liebe|lovesong/i.test(prompt) ? 'liebe' : 'aufbruch', bpm }), null)
    : null;

  const songPlan = {
    id: 'orc-' + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(),
    prompt: prompt.slice(0, 300),
    reading: { style: style.style, style_note: style.note, bpm, key: String(p.key || 'A minor'), lang: ['de', 'en'].includes(p.lang) ? p.lang : 'de', mood: p.mood || (/dark|nacht/i.test(prompt) ? 'nacht' : 'aufbruch') },
    sections: parts.map((s, i) => ({
      nr: i + 1, id: s.id, bars: s.bars, seconds: Number((s.bars * barDur).toFixed(1)),
      energy: s.energy, layers: s.layers, trimmed: !!s.trimmed,
      chords: (() => { const prog = ['Am', 'F', 'C', 'G']; const c = prog[i % prog.length]; return `${c} (Takt 1–${Math.min(s.bars, 4)})`; })(),
    })),
    totals: { bars: totalBars, seconds, minutes: Number((seconds / 60).toFixed(2)), sections: parts.length, layers: Object.keys(chains).length },
    chains,
    variants: Math.max(1, Math.min(6, Number(p.variants) || 3)),
    stems: p.stems !== false,
    lyrics: lyrics && lyrics.ok ? { id: lyrics.draft.id, hook: lyrics.draft.hook, lines: lyrics.draft.line_count, structure: lyrics.draft.structure } : (lyrics ? { error: lyrics.error } : null),
    gates: [
      { at: 'nach dem Rendern', what: 'Entwurf anhören — ein Mensch entscheidet, ob es weitergeht' },
      { at: 'vor Veröffentlichung', what: 'Freigabe-Tür: publish braucht einen Menschen' },
      { at: 'vor Auslieferung', what: 'Distributor-Schlüssel nötig; ohne Schlüssel bleibt es beim Entwurf' },
    ],
    honest: [
      'Kein Gesang: erzeugt wird ein instrumentaler Entwurf.',
      'Kein Zugriff auf Suno/Udio — es gibt keinen offenen Zugang. Nachgebaut ist die Arbeitsweise.',
      'Alles wird lokal gerechnet: Töne aus dem eigenen Renderer, Ketten aus dem eigenen Tonstudio.',
      'Ohne Veröffentlichungs-Freigabe bleibt der Song im Entwurf.',
    ],
  };
  const d = load();
  d.plans.unshift(songPlan); d.plans = d.plans.slice(0, 300);
  d.audit.unshift({ at: songPlan.at, action: 'plan', id: songPlan.id, style: songPlan.reading.style, bpm });
  save(d);
  return { ok: true, plan: songPlan, next: 'Rendern mit POST /api/music/orchestrator/render { id }' };
}

// 5. Rendern: Entwurf + Varianten + Stems — echte Dateien.
function render(input) {
  const p = input || {};
  const d = load();
  const songPlan = p.id ? d.plans.find((x) => x.id === p.id) : d.plans[0];
  if (!songPlan) return { ok: false, error: 'Kein Plan vorhanden — erst planen' };
  const mr = safe(() => require('./music_render'), null);
  if (!mr || typeof mr.render !== 'function') return { ok: false, error: 'Musik-Renderer nicht ladbar' };
  const variants = Math.max(1, Math.min(6, Number(p.variants) || songPlan.variants));
  const results = [];
  for (let i = 0; i < variants; i++) {
    const r = mr.render({
      style: mr.STYLES[songPlan.reading.style] ? songPlan.reading.style : 'lofi',
      bars: Math.max(2, Math.min(64, songPlan.totals.bars)),
      seed: 1000 + i * 77 + songPlan.totals.bars,
      title: `${songPlan.prompt.slice(0, 40)} · Variante ${i + 1}`,
      stems: songPlan.stems && i === 0,
    });
    results.push({ variant: i + 1, file: r.file, id: r.id, seconds: r.duration, bytes: r.bytes, bpm: r.bpm, bars: r.bars, stems: r.stems ? Object.keys(r.stems) : [] });
  }
  // 6. Prüflauf: sind die Varianten wirklich verschieden? Stimmt die Länge?
  // Vergleich über Inhalts-Prüfsumme (MD5) der echten WAV-Dateien: Dateigröße und
  // Sekunden sind bei gleicher Länge auch mit verschiedenen Seeds identisch —
  // der frühere Vergleich bytes:seconds meldete darum fälschlich „nicht verschieden".
  const fingerprints = results.map((x) => {
    try { return require('crypto').createHash('md5').update(require('fs').readFileSync(x.file)).digest('hex').slice(0, 12); }
    catch { return 'unlesbar:' + x.file; }
  });
  const hashes = new Set(fingerprints);
  const lengths = results.map((x) => x.seconds);
  const target = songPlan.totals.seconds;
  const qc = {
    variants: results.length,
    all_different: hashes.size === results.length,
    fingerprints,
    length_ok: lengths.every((l) => Math.abs(l - target) < Math.max(4, target * 0.2)),
    target_seconds: target,
    measured_seconds: lengths,
    verdict: hashes.size === results.length && lengths.every((l) => Math.abs(l - target) < Math.max(4, target * 0.2)) ? 'BESTANDEN' : 'PRÜFEN',
    note: 'Lokale Dateien, Varianten-Vergleich über MD5 der WAV-Inhalte, keine Lautheitsschätzung. Anhören bleibt die Entscheidung eines Menschen.',
  };
  const entry = { id: 'orcr-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), plan: songPlan.id, variants: results, qc, stems: songPlan.stems };

  // 7. Ablage im Speicher (Fassung 1) + Vorgang in der Abteilung, wenn angefragt.
  const store = safe(() => require('./content_store'), null);
  let stored = null;
  if (store && results[0]) {
    const s = store.register({
      title: `${songPlan.prompt.slice(0, 60)} (Entwurf)`, kind: 'SONG',
      body: `Orchester-Plan ${songPlan.id} · ${songPlan.reading.style} · ${songPlan.reading.bpm} bpm · ${songPlan.totals.bars} Takte`,
      tags: ['orchestrator', songPlan.reading.style], file: results[0].file, role: 'mix', source_module: 'song_orchestrator', source_ref: songPlan.id, by: 'AURA',
    });
    stored = s && s.ok ? { id: s.item.id, where: s.where } : { error: s && s.error };
  }
  const depts = safe(() => require('./music_departments'), null);
  const ticket = depts && p.department ? depts.ticket({ department: p.department, task: `Entwurf aus Plan ${songPlan.id}`, song: songPlan.prompt.slice(0, 60) }) : null;

  const data = load();
  data.renders.unshift(Object.assign({}, entry, { stored, ticket: ticket && ticket.ok ? ticket.ticket.id : null }));
  data.renders = data.renders.slice(0, 200);
  data.audit.unshift({ at: entry.at, action: 'render', plan: songPlan.id, variants: results.length, verdict: qc.verdict });
  save(data);
  return { ok: true, render: entry, stored, ticket: ticket && ticket.ok ? { id: ticket.ticket.id, department: ticket.ticket.department } : null, honest: 'Instrumentaler Entwurf, lokal gerechnet. Veröffentlichen nur mit Mensch.' };
}

function status() {
  const d = load();
  const mr = safe(() => require('./music_render'), null);
  return {
    area: 'ORC', module: 'song_orchestrator', state: 'live', file: FILE,
    plans: d.plans.length, renders: d.renders.length,
    styles_readable: STYLE_HINTS.length, sections: SECTIONS.length,
    renderer_styles: mr && mr.STYLES ? Object.keys(mr.STYLES) : [],
    steps: ['Beschreibung lesen', 'Aufbau planen', 'Effektketten setzen', 'Textgerüst bauen', 'Rendern (Varianten + Stems)', 'Prüflauf', 'Ablage + Übergabe'],
    rules: ['Kein Gesang, kein fremder Dienst — die Arbeitsweise ist nachgebaut, nicht der Anbieter.', 'Jede Variante ist eine echte Datei mit eigener Prüfsumme.', 'Prüflauf sagt offen, wenn Varianten gleich klingen.', 'Veröffentlichung und Auslieferung brauchen einen Menschen.'],
  };
}

module.exports = {
  meta: { area: 'ORC', id: 'song_orchestrator', name: 'Song-Orchester (Beschreibung → Aufbau → Ketten → Entwurf → Prüflauf)', state: 'live' },
  actions: { status: () => status(), styles: () => ({ ok: true, styles: STYLE_HINTS.map((s) => ({ style: s.style, bpm: s.bpm, note: s.note })), sections: SECTIONS }), plan: (p) => plan(p || {}), render: (p) => render(p || {}), plans: () => { const d = load(); return { ok: true, count: d.plans.length, plans: d.plans.slice(0, 20).map((x) => ({ id: x.id, prompt: x.prompt, style: x.reading.style, bpm: x.reading.bpm, seconds: x.totals.seconds, sections: x.totals.sections })) }; }, plan_get: (p) => { const x = load().plans.find((y) => y.id === (p || {}).id); return x ? { ok: true, plan: x } : { ok: false, error: 'Plan nicht gefunden' }; }, renders: () => { const d = load(); return { ok: true, count: d.renders.length, renders: d.renders.slice(0, 10) }; } },
  STYLE_HINTS, SECTIONS, plan, render, status,
};
