'use strict';
// AURA · Text und Reim (Textdichter).
//
// Aus einem Thema und einer Stilrichtung entsteht ein Textgerüst: Aufbau (Strophe, Refrain, Brücke),
// Reimschema, Silbenzahl je Zeile, Reimpaare aus einem eigenen Reimverzeichnis, Refrain-Zeile, Haken.
//
// Wichtig und ehrlich:
//   · Es wird **kein** fremder Text kopiert und **kein** Lied zitiert. Alle Zeilen entstehen hier aus
//     eigenen Wortfeldern.
//   · Reime kommen aus einem eigenen Verzeichnis (deutsch und englisch), nicht aus einem Dienst.
//   · Silben werden gezählt, nicht geraten: Vokalgruppen je Wort (deutsche Näherung, offen benannt).
//   · Ohne Thema kommt kein Text, sondern eine Rückfrage.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_LYRICS_FILE || path.join(__dirname, '..', 'data', 'lyrics.json');

// Reimverzeichnis: Endung → Wörter. Bewusst übersichtlich und erweiterbar.
const RHYMES_DE = {
  'acht': ['Nacht', 'Macht', 'Pracht', 'Schlacht', 'Wacht', 'sacht', 'gemacht', 'gebracht'],
  'ein': ['Schein', 'Sein', 'Wein', 'allein', 'Stein', 'rein', 'mein', 'dein', 'klein', 'Gedeihn'],
  'icht': ['Licht', 'Gesicht', 'Gedicht', 'Schicht', 'Pflicht', 'Gewicht', 'nicht', 'spricht'],
  'eit': ['Zeit', 'Weit', 'Bereit', 'Kleid', 'Streit', 'gleit', 'schreit', 'Geleit'],
  'all': ['Hall', 'Ball', 'Schall', 'Fall', 'Wall', 'überall', 'knall', 'Fanal'],
  'immer': ['Zimmer', 'Schimmer', 'nimmer', 'Flimmer', 'Wimmer'],
  'traum': ['Raum', 'Saum', 'kaum', 'Schaum', 'Traum', 'Bau(m)', 'Vertrauen'],
  'straße': ['Straße', 'Maße', 'verlassen', 'Fassung', 'blasse'],
  'lauf': ['Lauf', 'drauf', 'hauf', 'Kauf', 'Tauf', 'darauf'],
  'herz': ['Herz', 'Schmerz', 'Erz', 'Scherz', 'Stärk(s)'],
  'tief': ['tief', 'rief', 'schlieft', 'blieb', 'lieb', 'Trieb'],
  'wieder': ['Lieder', 'nieder', 'wieder', 'Glider', 'Kiefer'],
  'gold': ['Gold', 'hold', 'sollt', 'gedollt', 'Troll'],
  'stadt': ['Stadt', 'hat', 'satt', 'platt', 'Blatt', 'Rat'],
  'raum': ['Raum', 'Traum', 'Saum', 'kaum', 'Schaum'],
  'musik': ['Musik', 'Stück', 'Glück', 'Blick', 'zurück'],
  'auge': ['Auge', 'Tauche', 'Brauche', 'Schlauch', 'Gauch'],
  'reich': ['gleich', 'Teich', 'weich', 'Streich', 'erreich'],
  'energie': ['Energie', 'Melodie', 'Harmonie', 'Ironie', 'Sympathie'],
};
const RHYMES_EN = {
  'ight': ['night', 'light', 'fight', 'right', 'sight', 'flight', 'bright', 'tight'],
  'ame': ['name', 'game', 'flame', 'same', 'frame', 'blame'],
  'ound': ['sound', 'ground', 'round', 'found', 'bound', 'pound'],
  'ove': ['love', 'above', 'dove', 'glove'],
  'own': ['own', 'town', 'down', 'crown', 'known', 'alone'],
  'ay': ['day', 'way', 'stay', 'play', 'away', 'today', 'okay'],
  'ine': ['shine', 'line', 'mine', 'fine', 'design', 'divine'],
  'old': ['gold', 'hold', 'told', 'cold', 'bold'],
  'ream': ['dream', 'stream', 'team', 'seem', 'scheme'],
};

// Wortfelder je Stimmung — eigene Zusammenstellungen, keine Zitate.
const FIELDS = {
  aufbruch: { de: { nomen: ['Stadt', 'Straße', 'Morgen', 'Schritt', 'Licht', 'Fenster', 'Bahnsteig', 'Atem'], verben: ['gehen', 'öffnen', 'wachen', 'ziehen', 'lassen', 'suchen'], adj: ['wach', 'leise', 'neu', 'offen', 'klar'] }, en: { nomen: ['city', 'street', 'morning', 'step', 'light', 'window'], verben: ['walk', 'open', 'wake', 'pull', 'leave'], adj: ['awake', 'quiet', 'new', 'open'] } },
  sehnsucht: { de: { nomen: ['Nacht', 'Fenster', 'Regen', 'Telefon', 'Zug', 'Koffer', 'Meer'], verben: ['warten', 'zählen', 'hören', 'schweigen', 'rufen'], adj: ['fern', 'still', 'kalt', 'lang'] }, en: { nomen: ['night', 'window', 'rain', 'phone', 'train'], verben: ['wait', 'count', 'hear', 'call'], adj: ['far', 'still', 'cold', 'long'] } },
  kraft: { de: { nomen: ['Herz', 'Blut', 'Stimme', 'Boden', 'Feuer', 'Krone', 'Faust'], verben: ['stehen', 'schlagen', 'brennen', 'halten', 'steigen'], adj: ['laut', 'hart', 'echt', 'gross'] }, en: { nomen: ['heart', 'blood', 'voice', 'ground', 'fire'], verben: ['stand', 'beat', 'burn', 'hold', 'rise'], adj: ['loud', 'hard', 'real', 'big'] } },
  strasse: { de: { nomen: ['Asphalt', 'Beton', 'Laterne', 'Kiosk', 'Bass', 'Block', 'Treppe'], verben: ['rollen', 'ticken', 'schwitzen', 'rennen', 'bleiben'], adj: ['schnell', 'eng', 'rau', 'wach'] }, en: { nomen: ['asphalt', 'concrete', 'lamp', 'corner', 'bass'], verben: ['roll', 'tick', 'run', 'stay'], adj: ['fast', 'tight', 'rough'] } },
  liebe: { de: { nomen: ['Hand', 'Kuss', 'Sommer', 'Küche', 'Bett', 'Lächeln'], verben: ['halten', 'lachen', 'bleiben', 'teilen', 'flüstern'], adj: ['warm', 'nah', 'süss', 'leicht'] }, en: { nomen: ['hand', 'kiss', 'summer', 'kitchen', 'smile'], verben: ['hold', 'laugh', 'stay', 'share'], adj: ['warm', 'close', 'sweet'] } },
  nacht: { de: { nomen: ['Neon', 'Nebel', 'Club', 'Spiegel', 'Mond', 'Tür'], verben: ['tanzen', 'fallen', 'leuchten', 'flimmern'], adj: ['dunkel', 'blau', 'silbern'] }, en: { nomen: ['neon', 'fog', 'club', 'mirror', 'moon'], verben: ['dance', 'fall', 'glow'], adj: ['dark', 'blue', 'silver'] } },
};

const STRUCTURES = {
  popsong: { name: 'Popsong', parts: [{ id: 'intro', lines: 2, rhyme: 'AA' }, { id: 'strophe1', lines: 4, rhyme: 'ABAB' }, { id: 'refrain', lines: 4, rhyme: 'AABB', hook: true }, { id: 'strophe2', lines: 4, rhyme: 'ABAB' }, { id: 'refrain', lines: 4, rhyme: 'AABB', hook: true }, { id: 'bruecke', lines: 4, rhyme: 'ABAB' }, { id: 'refrain', lines: 4, rhyme: 'AABB', hook: true }] },
  hiphop: { name: 'Hip-Hop', parts: [{ id: 'hook', lines: 4, rhyme: 'AABB', hook: true }, { id: 'verse1', lines: 16, rhyme: 'AABB' }, { id: 'hook', lines: 4, rhyme: 'AABB', hook: true }, { id: 'verse2', lines: 16, rhyme: 'AABB' }, { id: 'hook', lines: 4, rhyme: 'AABB', hook: true }] },
  ballade: { name: 'Ballade', parts: [{ id: 'strophe1', lines: 6, rhyme: 'ABABCC' }, { id: 'refrain', lines: 4, rhyme: 'ABAB', hook: true }, { id: 'strophe2', lines: 6, rhyme: 'ABABCC' }, { id: 'refrain', lines: 4, rhyme: 'ABAB', hook: true }] },
  schlager: { name: 'Schlager', parts: [{ id: 'strophe1', lines: 4, rhyme: 'AABB' }, { id: 'refrain', lines: 4, rhyme: 'AABB', hook: true }, { id: 'strophe2', lines: 4, rhyme: 'AABB' }, { id: 'refrain', lines: 4, rhyme: 'AABB', hook: true }, { id: 'refrain_out', lines: 4, rhyme: 'AABB', hook: true }] },
};

function defaults() { return { drafts: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['drafts', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Silbenzählung: Vokalgruppen. Näherung — das wird offen dazugesagt.
function syllables(word, lang) {
  const w = String(word || '').toLowerCase().replace(/[^a-zäöüßàâæçéèêëïîôœùûü]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouyäöüàâæéèêëïîôœùû]+/g);
  let n = groups ? groups.length : 1;
  if (lang === 'de' && /e$/.test(w) && !/(ee|ie|he|le|re|ne|de|te|se|be|ge)$/.test(w)) n = Math.max(1, n - 0); // End-e zählt (deutsch), nichts abziehen
  if (lang === 'en' && /e$/.test(w) && n > 1) n -= 1;                                                      // stummes e (englisch)
  return Math.max(1, n);
}
function countSyllables(line, lang) { return String(line).split(/\s+/).filter(Boolean).reduce((n, w) => n + syllables(w, lang), 0); }

function findRhymes(word, lang) {
  const w = String(word || '').toLowerCase();
  const table = lang === 'en' ? RHYMES_EN : RHYMES_DE;
  for (const [end, words] of Object.entries(table)) {
    if (w.endsWith(end) || words.some((x) => x.toLowerCase() === w)) return { end, words: words.filter((x) => x.toLowerCase() !== w) };
  }
  // Zweiter Versuch: letzte drei Buchstaben vergleichen.
  for (const [end, words] of Object.entries(table)) {
    if (w.slice(-3) === end.slice(-3)) return { end, words };
  }
  return null;
}

// Eine Zeile bauen: Wortfeld + Reimendung.
function buildLine(opts) {
  const { subject, field, lang, rhymeEnd, rng, mood } = opts;
  const f = (FIELDS[field] || FIELDS.aufbruch)[lang] || FIELDS.aufbruch.de;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const rhyme = rhymeEnd ? (lang === 'en' ? RHYMES_EN[rhymeEnd] : RHYMES_DE[rhymeEnd]) : null;
  const endWord = rhyme ? pick(rhyme.filter((x) => x.toLowerCase() !== (subject || '').toLowerCase())) : pick(f.nomen);
  const templates = lang === 'en'
    ? [`I keep the ${pick(f.nomen)} in the ${endWord}`, `We were ${pick(f.adj)} in the ${endWord}`, `Every ${pick(f.nomen)} turns to ${endWord}`]
    : [`Ich trag den ${pick(f.nomen)} durch die ${endWord}`, `Wir waren ${pick(f.adj)} in der ${endWord}`, `Jeder ${pick(f.nomen)} wird zur ${endWord}`, `Und ich ${pick(f.verben)} bis zum ${endWord}`];
  const line = pick(templates);
  return { text: line, end_word: endWord, syllables: countSyllables(line, lang), rhyme_end: rhymeEnd || null };
}

function write(input) {
  const p = input || {};
  const subject = String(p.subject || p.thema || '').trim();
  if (subject.length < 3) return { ok: false, error: 'Ohne Thema kein Text — bitte subject angeben (z. B. "Aufbruch aus der Creed Street")' };
  const lang = ['de', 'en'].includes(String(p.lang || '')) ? String(p.lang) : 'de';
  const structure = STRUCTURES[String(p.structure || 'popsong').toLowerCase()];
  if (!structure) return { ok: false, error: `structure unbekannt. Erlaubt: ${Object.keys(STRUCTURES).join(', ')}` };
  const field = FIELDS[String(p.mood || 'aufbruch').toLowerCase()] ? String(p.mood || 'aufbruch').toLowerCase() : 'aufbruch';
  const bpm = Math.max(60, Math.min(200, Number(p.bpm) || 92));
  let seed = 0; for (const ch of subject + structure.name + field) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

  const hookField = (FIELDS[field][lang] || FIELDS[field].de);
  const hookWord = hookField.nomen[0];
  const hook = lang === 'en' ? `${subject.split(' ')[0]} — we ride the ${hookWord}` : `${subject.split(' ')[0]} — wir fahren durch die ${hookWord}`;

  const parts = structure.parts.map((part) => {
    let rhymeEnd = null;
    const lines = [];
    const scheme = part.rhyme;
    for (let i = 0; i < part.lines; i++) {
      const slot = scheme[i % scheme.length];
      if (!rhymeEnd || slot === 'A') {
        const base = findRhymes(part.hook ? hookWord : (lang === 'en' ? 'night' : 'Nacht'), lang);
        rhymeEnd = base ? base.end : (lang === 'en' ? 'ight' : 'acht');
      }
      const line = buildLine({ subject, field, lang, rhymeEnd, rng, mood: field });
      lines.push(Object.assign({ slot }, line));
    }
    const syl = lines.map((l) => l.syllables);
    const target = Math.round(syl.reduce((a, b) => a + b, 0) / syl.length);
    return {
      id: part.id, lines, hook: !!part.hook, rhyme_scheme: scheme,
      syllables: { min: Math.min(...syl), max: Math.max(...syl), avg: target },
      singable: Math.max(...syl) - Math.min(...syl) <= Math.max(3, Math.round(target * 0.35)),
    };
  });

  const draft = {
    id: 'lyr-' + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(), subject, lang, structure: structure.name, mood: field, bpm,
    hook, parts,
    line_count: parts.reduce((n, x) => n + x.lines.length, 0),
    rhyme_words: [...new Set(parts.flatMap((x) => x.lines.map((l) => l.end_word)))].length,
    note: 'Gerüst mit Reim und Silbenzahl. Zeilen sind Bausteine zum Umbauen — kein fremder Text, kein Zitat.',
  };
  const d = load();
  d.drafts.unshift(draft); d.drafts = d.drafts.slice(0, 300);
  d.audit.unshift({ at: draft.at, action: 'draft', subject, structure: draft.structure });
  save(d);
  return { ok: true, draft, syllables_rule: 'Vokalgruppen zählen (Näherung). Beim Singen entscheidet das Ohr, nicht der Zähler.', origin: 'Alle Zeilen entstehen aus eigenen Wortfeldern. Es wird nichts kopiert.' };
}

function rhymes(input) {
  const p = input || {};
  const word = String(p.word || '').trim();
  if (!word) return { ok: false, error: 'word fehlt' };
  const lang = ['de', 'en'].includes(String(p.lang || '')) ? String(p.lang) : 'de';
  const hit = findRhymes(word, lang);
  return hit
    ? { ok: true, word, language: lang, ending: hit.end, rhymes: hit.words.slice(0, Number(p.limit) || 20), syllables: syllables(word, lang), note: 'Aus dem eigenen Reimverzeichnis. Kein Reim-Dienst, kein Netz.' }
    : { ok: true, word, rhymes: [], note: 'Für diese Endung ist nichts eingetragen. Eigene Reime lassen sich über /api/music/lyrics/rhyme-add ergänzen.' };
}

function addRhyme(input) {
  const p = input || {};
  const end = String(p.ending || '').toLowerCase().slice(0, 12);
  const words = (Array.isArray(p.words) ? p.words : []).map((x) => String(x).trim()).filter(Boolean);
  if (!end || !words.length) return { ok: false, error: 'ending und words sind nötig' };
  const table = String(p.lang || 'de') === 'en' ? RHYMES_EN : RHYMES_DE;
  table[end] = [...new Set([...(table[end] || []), ...words])].slice(0, 40);
  return { ok: true, ending: end, count: table[end].length, words: table[end], note: 'Gilt ab sofort, nur zur Laufzeit. Für dauerhaft: Eintrag im Verzeichnis von lyrics.js.' };
}

function structures() {
  return { ok: true, structures: Object.entries(STRUCTURES).map(([id, s]) => ({ id, name: s.name, parts: s.parts.length, line_total: s.parts.reduce((n, x) => n + x.lines, 0) })), moods: Object.keys(FIELDS), languages: ['de', 'en'] };
}

function status() {
  const d = load();
  return {
    area: 'LYR', module: 'lyric_writer', state: 'live', file: FILE,
    structures: Object.keys(STRUCTURES).length, moods: Object.keys(FIELDS).length,
    rhyme_entries_de: Object.keys(RHYMES_DE).length, rhyme_entries_en: Object.keys(RHYMES_EN).length,
    drafts: d.drafts.length,
    rules: ['Kein fremder Text, kein Zitat: alle Zeilen aus eigenen Wortfeldern.', 'Reime und Silben werden hier gerechnet — kein Dienst, kein Netz.', 'Silben sind eine Näherung; das Ohr entscheidet.', 'Der Text ist ein Gerüst zum Umbauen, keine fertige Dichtung.'],
  };
}

module.exports = {
  meta: { area: 'LYR', id: 'lyric_writer', name: 'Text und Reim (Aufbau, Reimschema, Silben, Haken)', state: 'live' },
  actions: { status: () => status(), structures: () => structures(), write: (p) => write(p || {}), rhymes: (p) => rhymes(p || {}), rhyme_add: (p) => addRhyme(p || {}), drafts: () => { const d = load(); return { ok: true, count: d.drafts.length, drafts: d.drafts.slice(0, 10).map((x) => ({ id: x.id, subject: x.subject, structure: x.structure, hook: x.hook, lines: x.line_count })) }; }, draft: (p) => { const x = load().drafts.find((y) => y.id === (p || {}).id); return x ? { ok: true, draft: x } : { ok: false, error: 'Entwurf nicht gefunden' }; } },
  STRUCTURES, FIELDS, RHYMES_DE, RHYMES_EN, write, rhymes, syllables, countSyllables, status,
};
