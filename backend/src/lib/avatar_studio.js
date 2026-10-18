'use strict';
// AURA · Avatar-Studio: sich selbst als Kunstfigur aufbauen und daraus Podcasts/Formate machen.
//
// Nach dem Vorbild dieser „AI-Influencer"-Aufbauten (Julian-Goldie-Art): Gesicht/Stimme/Haltung sind
// eine DATEI, nicht eine Person. Der Aufbau hier:
//
//   1. Persona anlegen: Name, Nische, Wesenszüge, Sprache, Publikum, feste Sätze, verbotene Wörter.
//      Die Persona ist ein Vertrag — alles, was der Avatar später sagt, muss dazu passen.
//   2. Aussehen: Bild-Vorgabe (Prompt) mit klaren Regeln; erzeugt wird über die vorhandene
//      Bildwerkstatt (image_gen) mit eigenem Schlüssel oder lokal. Ohne Werkzeug bleibt es bei der
//      Vorgabe — AURA zeigt kein Bild, das es nicht erzeugt hat.
//   3. Stimme: aus dem Stimmenkatalog (speech) oder als Sprechplan, falls kein Motor da ist.
//   4. Formate: Podcast-Folge (2 Rollen), Kurzvideo-Skript, Serien-Bogen — mit Kapiteln, Shownotes,
//      CTA und Zeitschätzung.
//
// Ehrlichkeit (wichtig, gerade bei Avataren):
//  • Ein Avatar ist eine gekennzeichnete Kunstfigur. In der Persona steht `disclosure` — die Offenlegung,
//    die bei jeder Veröffentlichung mitgeliefert wird. Ohne sie gibt es kein veröffentlichbares Format.
//  • AURA imitiert keine echten Personen: `lookalike_of` wird abgelehnt.
//  • Nichts wird veröffentlicht; jedes Format endet als Entwurf mit Freigabe-Pflicht.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_AVATAR_FILE || path.join(__dirname, '..', 'data', 'avatars.json');

const ARCHETYPES = [
  { id: 'erklaerer', name: 'Erklärer', style: 'ruhig, sachlich, Beispiel zuerst', voice: 'erzaehler-ruhig' },
  { id: 'unterhalter', name: 'Unterhalter', style: 'schnell, pointiert, Geschichten', voice: 'moderator-wach' },
  { id: 'analyst', name: 'Analyst', style: 'Zahlen, Vergleiche, klare Urteile', voice: 'podcast-duo-b' },
  { id: 'mentor', name: 'Mentor', style: 'ermutigend, Schritt für Schritt', voice: 'podcast-duo-a' },
  { id: 'chronist', name: 'Chronist', style: 'beobachtend, reportageartig', voice: 'erzaehler-ruhig' },
];

const FORMATS = ['PODCAST', 'KURZVIDEO', 'SERIE', 'HÖRBUCH', 'NEWSLETTER_VERTONUNG'];

const REFUSED = [
  { pattern: /julian\s*goldie|imitate|nachahm|sieht aus wie|lookalike|klon von/i, why: 'AURA bildet keine echten Personen nach. Ein Avatar ist eine eigene Kunstfigur.' },
  { pattern: /deepfake|gesicht von/i, why: 'Gesichter echter Menschen werden nicht verwendet.' },
  { pattern: /kinder|minderjährig/i, why: 'Keine Avatare, die Minderjährige darstellen oder ansprechen.' },
];

function defaults() { return { avatars: [], episodes: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['avatars', 'episodes', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function create(input) {
  const data = load();
  const name = String((input && input.name) || '').trim();
  const niche = String((input && input.niche) || '').trim();
  if (!name || !niche) return { ok: false, error: 'name und niche sind nötig' };
  const wish = String((input && input.lookalike_of) || '') + ' ' + String((input && input.look) || '');
  const refused = REFUSED.find((r) => r.pattern.test(wish));
  if (refused) return { ok: false, refused: true, error: refused.why };
  const arch = ARCHETYPES.find((a) => a.id === String((input && input.archetype) || 'erklaerer')) || ARCHETYPES[0];
  const avatar = {
    id: 'av-' + Math.random().toString(16).slice(2, 10),
    name, niche,
    archetype: arch.id, style: arch.style, default_voice: (input && input.voice) || arch.voice,
    audience: String((input && input.audience) || 'Einsteiger').slice(0, 200),
    language: String((input && input.language) || 'de'),
    catchphrases: (Array.isArray(input && input.catchphrases) ? input.catchphrases : ['Kurz gesagt:', 'Das Wichtigste zuerst:']).slice(0, 6),
    banned_words: (Array.isArray(input && input.banned_words) ? input.banned_words : ['garantiert', 'sofort reich']).slice(0, 20),
    principles: ['Keine Versprechen zu Einkommen.', 'Keine erfundenen Zahlen.', 'Immer sagen, woher eine Information kommt.'],
    look_spec: {
      prompt: `${arch.name}, ${niche}, ruhiges Studiolicht, halbnahe Einstellung, neutrale Farben, freundlicher Blick, kein Markenlogo`,
      rules: ['Kein Wasserzeichen', 'Kein Gesicht einer echten Person', 'Querformat 16:9 und Hochformat 9:16 getrennt rechnen'],
      tool: 'image_gen (Bildwerkstatt) — braucht eigenen Schlüssel oder lokalen Rechner',
      state: 'VORGABE (noch kein Bild erzeugt)',
    },
    disclosure: String((input && input.disclosure) || `"${name}" ist eine KI-Kunstfigur von AURA. Stimme und Text sind maschinell erzeugt.`),
    state: 'AKTIV',
    created_at: new Date().toISOString(),
  };
  data.avatars.unshift(avatar); data.avatars = data.avatars.slice(0, 50);
  data.audit.unshift({ at: avatar.created_at, action: 'create', id: avatar.id, name });
  data.audit = data.audit.slice(0, 300);
  save(data);
  return { ok: true, avatar, next: ['Aussehen erzeugen (image_gen)', 'Folge oder Kurzvideo anlegen', 'Freigabe durch Menschen'] };
}

// Prüft, ob ein Text zur Persona passt (verbotene Wörter, Kennzeichnung, Wesenszug).
function checkText(avatarId, text) {
  const a = load().avatars.find((x) => x.id === avatarId);
  if (!a) return { ok: false, error: 'Avatar nicht gefunden' };
  const t = String(text || '');
  const hits = a.banned_words.filter((w) => t.toLowerCase().includes(String(w).toLowerCase()));
  const problems = [];
  if (hits.length) problems.push(`verbotene Wörter benutzt: ${hits.join(', ')}`);
  if (/\d+\s*(€|euro|pro monat|% rendite)/i.test(t) && !/\d+\s*(€|euro)/.test(a.principles.join(' '))) problems.push('Zahlen zu Geld ohne Quelle — die Persona erlaubt das nicht.');
  if (!t.trim()) problems.push('Text ist leer');
  return {
    ok: problems.length === 0, problems, hits,
    disclosure_present: t.includes(a.disclosure.slice(0, 20)),
    reminder: `Kennzeichnung nicht vergessen: ${a.disclosure}`,
  };
}

// Podcast-Folge bauen: zwei Rollen, Kapitel, Shownotes, CTA. Ohne Motor: Sprechplan statt Ton.
function episode(input) {
  const data = load();
  const avatarId = String((input && input.avatar) || '');
  const a = data.avatars.find((x) => x.id === avatarId) || data.avatars[0];
  if (!a) return { ok: false, error: 'Noch kein Avatar angelegt — erst Persona bauen' };
  const topic = String((input && input.topic) || '').trim();
  if (!topic) return { ok: false, error: 'Thema (topic) fehlt' };
  const format = FORMATS.includes(String((input && input.format || '').toUpperCase())) ? String(input.format).toUpperCase() : 'PODCAST';
  const minutes = Math.min(60, Math.max(3, Number((input && input.minutes) || 12)));
  const guest = String((input && input.guest) || 'zweite Stimme').slice(0, 80);

  // Gesprächsgerüst: feste, wiederkehrende Form — kein blindes Band.
  const outline = [
    { part: 'Intro', seconds: 25, speaker: a.name, line: `Intro mit Kennzeichnung: ${a.disclosure}` },
    { part: 'Haken', seconds: 40, speaker: a.name, line: `Warum "${topic}" jetzt wichtig ist — ein Satz, keine Behauptung ohne Quelle.` },
    { part: 'Frage 1', seconds: Math.round(minutes * 60 * 0.15), speaker: guest, line: `Die naheliegende Frage zu ${topic} stellen.` },
    { part: 'Antwort 1', seconds: Math.round(minutes * 60 * 0.2), speaker: a.name, line: `Antwort im Stil "${a.style}", mit einem konkreten Beispiel.` },
    { part: 'Frage 2', seconds: Math.round(minutes * 60 * 0.12), speaker: guest, line: 'Nachfragen, wo es weh tut (Kosten, Fehler, Umwege).' },
    { part: 'Antwort 2', seconds: Math.round(minutes * 60 * 0.18), speaker: a.name, line: 'Antwort mit Schritt-für-Schritt-Teil.' },
    { part: 'Zusammenfassung', seconds: 60, speaker: a.name, line: `Drei Punkte zu ${topic}.` },
    { part: 'Ausklang', seconds: 30, speaker: a.name, line: 'Nächste Folge ankündigen, Kennzeichnung wiederholen.' },
  ];
  let t0 = 0;
  const timeline = outline.map((o) => { const row = { ...o, starts_at: t0 }; t0 += o.seconds; return row; });

  const ep = {
    id: 'ep-' + Math.random().toString(16).slice(2, 10),
    avatar: a.id, avatar_name: a.name, topic, format, target_minutes: minutes,
    guest_role: guest,
    timeline, total_seconds: t0,
    chapters: timeline.map((x) => ({ at: x.starts_at, title: `${x.part}: ${x.speaker}` })),
    show_notes: { title: `${a.name} — ${topic}`, summary: `Folge über ${topic}, Zielgruppe ${a.audience}.`, disclosure: a.disclosure, sources_required: true },
    cta: 'Auf den eigenen Kanal lenken — keine Kaufaufforderung, keine Reichweiten-Käufe.',
    state: 'ENTWURF',
    needs: ['Menschliche Freigabe', 'Kennzeichnung im Intro UND in den Shownotes', 'Quellen zu allen Zahlen'],
    created_at: new Date().toISOString(),
  };
  data.episodes.unshift(ep); data.episodes = data.episodes.slice(0, 100);
  data.audit.unshift({ at: ep.created_at, action: 'episode', id: ep.id, topic });
  ep.stored = storeAuto(ep);
  save(data);

  let audio = { mode: 'PLAN' };
  try { const sp = require('./speech'); const st = sp.status(); audio = { mode: st.mode, engine: st.tts_available, parts: timeline.length, note: st.mode === 'NOT-CONNECTED' ? 'Kein Sprachmotor: die Folge bleibt als Sprechplan mit Zeitmarken stehen.' : 'Sprachmotor vorhanden — Sprechstücke können gerendert werden.' }; }
  catch { audio = { mode: 'NICHT LADBAR', note: 'Sprachmodul fehlt' }; }

  return { ok: true, episode: ep, audio, truth: 'Der Gesprächsverlauf ist ein Gerüst mit Rollen und Zeiten — der echte Wortlaut entsteht beim Sprechen und wird vor Veröffentlichung geprüft.' };
}

// Jede Folge landet als Inhalt (mit Kennzeichnung) im Speicher.
function storeAuto(ep) {
  try {
    const cs = require('./content_store');
    return cs.register({
      kind: 'PROTOKOLL', title: `${ep.avatar_name}: ${ep.topic}`,
      body: 'Kennzeichnung: ' + ep.show_notes.disclosure + '\n\n' + ep.timeline.map((t) => `${t.starts_at}s ${t.speaker}: ${t.line}`).join('\n'),
      tags: ['podcast', ep.format.toLowerCase()], source_module: 'avatar_studio', source_ref: ep.id, by: 'AURA',
    });
  } catch (e) { return { ok: false, error: e.message }; }
}

function list(filter) {
  const data = load();
  return {
    ok: true, avatars: data.avatars.length, episodes: data.episodes.length,
    items: data.avatars.map((a) => ({ id: a.id, name: a.name, niche: a.niche, archetype: a.archetype, state: a.state })),
    recent_episodes: data.episodes.slice(0, 10).map((e) => ({ id: e.id, avatar: e.avatar_name, topic: e.topic, format: e.format, state: e.state })),
  };
}

function status() {
  const d = load();
  return {
    area: 'AV', module: 'avatar_studio', state: 'live', file: FILE,
    avatars: d.avatars.length, episodes: d.episodes.length,
    archetypes: ARCHETYPES.length, formats: FORMATS,
    rules: ['Ein Avatar ist eine gekennzeichnete Kunstfigur — ohne Offenlegung gibt es kein veröffentlichbares Format.', 'Keine Nachbildung echter Personen, keine Deepfakes, keine Minderjährigen.', 'Aussehen entsteht nur über die Bildwerkstatt; ohne Werkzeug bleibt es bei der Vorgabe.', 'Veröffentlicht wird nur mit menschlicher Freigabe.'],
  };
}

module.exports = {
  meta: { area: 'AV', id: 'avatar_studio', name: 'Avatar-Studio (Kunstfigur, Podcast, Kurzvideo)', state: 'live' },
  actions: { status: () => status(), archetypes: () => ({ ok: true, archetypes: ARCHETYPES, formats: FORMATS }), create: (p) => create(p || {}), check: (p) => checkText((p || {}).avatar, (p || {}).text), episode: (p) => episode(p || {}), list: (p) => list(p || {}) },
  ARCHETYPES, FORMATS, REFUSED, create, checkText, episode, list, status,
};
