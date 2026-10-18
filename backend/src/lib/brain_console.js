'use strict';
// AURA · Gehirn-Konsole: der Mensch redet über die Konsole mit dem Gehirn UND mit den anderen Köpfen.
//
// Aufbau:
//   • Köpfe (Heads) = Bereiche mit eigenem Verstand: Gehirn/Brain, Hermes, Wachhund (Watchdog),
//     Tonstudio, Video-Abteilung, Web-Empire, Label, Connectoren … Jeder Kopf hat Zuständigkeit und
//     eine Liste dessen, was er beantworten kann.
//   • Eine Sitzung ist ein Gespräch des Menschen. Er schreibt; die Konsole schickt an den gewählten
//     Kopf. Antwort kommt aus dem Kopf selbst (dessen `status`/`actions`) — kein erfundener Text.
//   • Geht eine Frage an einen Kopf, der sie nicht beantworten kann, sagt der Kopf das und nennt den
//     zuständigen Kopf. Ein Kopf antwortet nie „irgendwie".
//   • Kein KI-Textmodell nötig: die Konsole ist ein echter Frage-Antwort-Weg durch die Landkarte.
//     Ist ein Sprachmodell verbunden (Ollama mit Schlüssel), kann es die Antworten ausformulieren —
//     es entscheidet aber nicht, was wahr ist.
//
// Das letzte Wort bleibt beim Menschen: die Konsole führt nichts aus, sie antwortet und schlägt vor.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_CONSOLE_FILE || path.join(__dirname, '..', 'data', 'brain_console.json');

// Köpfe und ihre Zuständigkeit. Reihenfolge = Vorstellung im Verzeichnis.
const HEADS = [
  { id: 'brain', name: 'Gehirn (Brain)', module: 'brain_mapper', topics: ['zustand', 'landkarte', 'module', 'übersicht'], answers: 'Was das System insgesamt ist und kann' },
  { id: 'hermes', name: 'Hermes (Brücke)', module: 'hermes_bridge', topics: ['rechte', 'kontrolle', 'freigabe', 'brücke'], answers: 'Welche Rechte vergeben sind und welche nie vergeben werden' },
  { id: 'watchdog', name: 'Wachhund (Aufsicht)', module: 'watchdog', topics: ['dienst', 'ausfall', 'neustart', 'schlaf'], answers: 'Welcher Dienst läuft, welcher nicht, was wurde neu gestartet' },
  { id: 'studio', name: 'Tonstudio', module: 'daw_plugins', topics: ['ton', 'effekt', 'mischen', 'master'], answers: 'Effekte, Parameter, Prüfkriterien' },
  { id: 'songbook', name: 'Song-Werkstatt', module: 'songbook', topics: ['song', 'musik', 'text', 'stems'], answers: 'Songs, Varianten, Stems, Texte' },
  { id: 'video', name: 'Video-Abteilung', module: 'video_department', topics: ['video', 'schnitt', 'untertitel', 'export'], answers: 'Ablauf der Videoarbeit, Abnahme' },
  { id: 'campaign', name: 'Kampagnen-Planer', module: 'campaign_planner', topics: ['release', 'kampagne', 'pitch', 'termin'], answers: 'Wann was fertig sein muss' },
  { id: 'empire', name: 'Web-Empire', module: 'web_empire', topics: ['seite', 'link', 'werbung', 'slot'], answers: 'Seiten, Slots, ehrliche Messwerte' },
  { id: 'label', name: 'Label & Distribution', module: 'label_desk', topics: ['label', 'distributor', 'release', 'isrc'], answers: 'Was für eine Veröffentlichung fehlt' },
  { id: 'connectors', name: 'Kanäle (Connectoren)', module: 'connectors', topics: ['kanal', 'spotify', 'youtube', 'schlüssel'], answers: 'Welcher Kanal verbunden ist und welcher nicht' },
  { id: 'speech', name: 'Stimme', module: 'speech', topics: ['stimme', 'sprechen', 'podcast', 'hörbuch'], answers: 'Ob gesprochen werden kann und womit' },
  { id: 'eyes', name: 'Augen', module: 'eyes', topics: ['bild', 'sehen', 'helligkeit', 'screenshot'], answers: 'Was auf Bildern messbar ist' },
  { id: 'artists', name: 'Artist-Konten', module: 'artist_accounts', topics: ['artist', 'login', 'konto', 'kanal'], answers: 'Wer angemeldet ist und was jeder sieht' },
  { id: 'security', name: 'Sicherheit', module: 'sentinel', topics: ['angriff', 'angreifer', 'sperre', 'verdacht'], answers: 'Was auffällt und was isoliert wurde' },
  { id: 'ressourcen', name: 'Ressourcen-Katalog', module: 'resources', topics: ['ressource', 'quelle', 'werkzeug', 'lizenz', 'freie'], answers: 'Welche freien Werkzeuge, Quellen und Lizenzen es gibt' },
  { id: 'money', name: 'Geld', module: 'finance_engine', topics: ['geld', 'preis', 'plan', 'rechnung'], answers: 'Pläne, Preise, offene Posten' },
];

function defaults() { return { sessions: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['sessions', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function directory() {
  return {
    ok: true, count: HEADS.length,
    heads: HEADS.map((h) => {
      let state = 'nicht ladbar'; let reachable = false;
      try { const m = require(path.join(__dirname, h.module + '.js')); state = (m.meta && m.meta.state) || 'live'; reachable = true; } catch { /* ehrlich: nicht ladbar */ }
      return { id: h.id, name: h.name, module: h.module, state, reachable, topics: h.topics, answers: h.answers };
    }),
    note: 'Jeder Kopf antwortet aus seinem eigenen Modul. Ist ein Modul nicht ladbar, steht das hier — es wird nichts vorgetäuscht.',
  };
}

// Frage an einen Kopf: Suchbegriff trifft Zuständigkeit, sonst Zuständigkeitsverweis.
function headFor(question, explicit) {
  const q = String(question || '').toLowerCase();
  if (explicit) { const h = HEADS.find((x) => x.id === explicit); if (h) return { head: h, why: 'ausdrücklich gewählt' }; }
  const hit = HEADS.find((h) => h.topics.some((t) => q.includes(t)));
  if (hit) return { head: hit, why: `Stichwort passt zu ${hit.name}` };
  return { head: null, why: 'kein Kopf fühlt sich zuständig' };
}

function reply(headId, question) {
  const { head, why } = headFor(question, headId);
  if (!head) {
    return {
      ok: true, answered_by: null, why,
      answer: 'Kein Kopf ist dafür zuständig. Bitte konkreter fragen — oder einen Kopf ausdrücklich wählen.',
      suggest: HEADS.map((h) => ({ id: h.id, topics: h.topics })),
    };
  }
  let mod = null;
  try { mod = require(path.join(__dirname, head.module + '.js')); } catch (e) {
    return { ok: true, answered_by: head.id, head: head.name, why, answer: `Kopf "${head.name}" ist nicht ladbar: ${e.message}`, state: 'NICHT LADBAR' };
  }
  let facts = {};
  try { facts = (mod.actions && typeof mod.actions.status === 'function') ? mod.actions.status() : (typeof mod.status === 'function' ? mod.status() : {}); } catch (e) { facts = { error: e.message }; }
  return {
    ok: true, answered_by: head.id, head: head.name, why, state: (mod.meta && mod.meta.state) || 'live',
    answer: `${head.name}: ${head.answers}.`,
    facts: zumReden(facts),
    raw_state: facts,
  };
}

// Fakten kurz und lesbar machen — die Konsole soll kein Datenmüllausgabe sein.
function zumReden(facts, depth) {
  if (!facts || typeof facts !== 'object' || (depth || 0) > 1) return facts;
  const out = {};
  for (const [k, v] of Object.entries(facts)) {
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = typeof v === 'string' ? v.slice(0, 200) : v;
    else if (Array.isArray(v)) out[k] = v.length > 6 ? `${v.length} Einträge: ` + JSON.stringify(v.slice(0, 3)).slice(0, 200) : v;
    else if (typeof v === 'object') out[k] = JSON.stringify(v).slice(0, 200);
  }
  return out;
}

function openSession(input) {
  const data = load();
  const who = String((input && input.who) || 'Mensch');
  const s = { id: 'cs-' + Math.random().toString(16).slice(2, 10), who, started_at: new Date().toISOString(), turns: [], human_last_word: true };
  data.sessions.unshift(s); data.sessions = data.sessions.slice(0, 30);
  save(data);
  return { ok: true, session: { id: s.id, who: s.who, started_at: s.started_at }, heads: directory().heads.length, note: 'Alles, was diese Sitzung anstößt, bleibt Vorschlag. Ausgeführt wird nur, was ein Mensch freigibt.' };
}

function say(input) {
  const data = load();
  const sid = String((input && input.session) || '');
  let s = data.sessions.find((x) => x.id === sid);
  if (!s) { const opened = openSession({ who: (input && input.who) || 'Mensch' }); s = data.sessions.find((x) => x.id === opened.session.id); }
  const text = String((input && input.text) || '').trim();
  if (!text) return { ok: false, error: 'text fehlt' };
  const head = (input && input.head) || null;
  const r = reply(head, text);
  const turn = { at: new Date().toISOString(), who: s.who, text: text.slice(0, 2000), head: r.answered_by, answer: r.answer, facts: r.facts || null };
  s.turns.push(turn); s.turns = s.turns.slice(-200);
  data.audit.unshift({ at: turn.at, action: 'say', session: s.id, head: r.answered_by });
  data.audit = data.audit.slice(0, 300);
  save(data);
  return { ok: true, session: s.id, turn, suggestion_only: true, rule: 'Die Konsole antwortet und schlägt vor. Ausführen kann nur ein Mensch.' };
}

function transcript(sessionId) {
  const s = load().sessions.find((x) => x.id === sessionId);
  if (!s) return { ok: false, error: 'Sitzung nicht gefunden' };
  return { ok: true, session: s.id, who: s.who, turns: s.turns, count: s.turns.length };
}

function askAll(question) {
  const q = String(question || '').trim();
  if (!q) return { ok: false, error: 'Frage fehlt' };
  const answers = HEADS.map((h) => reply(h.id, q)).filter((r) => r.ok);
  return { ok: true, question: q, answers: answers.map((a) => ({ head: a.answered_by, answer: a.answer, facts: a.facts })), note: 'Rundfrage an alle Köpfe: jeder antwortet aus seinem eigenen Modul.' };
}

function status() {
  const d = load();
  const dir = directory();
  return {
    area: 'CONS', module: 'brain_console', state: 'live', file: FILE,
    heads: dir.count, reachable: dir.heads.filter((h) => h.reachable).length,
    sessions: d.sessions.length, turns: d.sessions.reduce((a, s) => a + s.turns.length, 0),
    rule: 'Der Mensch hat das letzte Wort. Die Konsole antwortet, sie führt nicht aus.',
    language_model: (() => { try { const o = require('./ollama_llm'); const s = typeof o.status === 'function' ? o.status() : {}; return { module: 'ollama_llm', state: s.reachable ? 'verbunden' : 'nicht verbunden', note: 'Ein Sprachmodell kann Antworten ausformulieren — die Fakten kommen aus den Modulen.' }; } catch { return { module: 'ollama_llm', state: 'nicht ladbar' }; } })(),
  };
}

module.exports = {
  meta: { area: 'CONS', id: 'brain_console', name: 'Gehirn-Konsole (Mensch spricht mit Gehirn und Köpfen)', state: 'live' },
  actions: { status: () => status(), heads: () => directory(), session: (p) => openSession(p || {}), say: (p) => say(p || {}), transcript: (p) => transcript((p || {}).session), askAll: (p) => askAll((p || {}).question) },
  HEADS, directory, headFor, reply, openSession, say, transcript, askAll, status,
};
