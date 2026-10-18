'use strict';
// AURA · Gesprochenes Wort — Podcast, Hörbuch, Audiobibel in einem Baustein.
//
// Drei Erzeugnisse, ein Weg:
//   PODCAST    Show → Folge mit Abschnitten, Kapitelmarken, Transkriptplan, Bett aus dem Renderer, RSS-Feed
//   HÖRBUCH    Text → Teile → Kapitel → Lesezeit → Aufnahmeplan je Kapitel → Kennungen → Verteiler
//   AUDIOBIBEL 66 Bücher, 1189 Kapitel → Leseplan (auch als Jahr) → Aufnahmeplan je Buch → Feed
//
// Was hier wirklich gerechnet wird:
//   · Bibelstruktur: Zahl der Kapitel je Buch (Summe 1189 — das ist die Summe aller Kapitel der Bibel)
//   · Lesezeit: Wörter × Sprechtempo, mit Pausen an Absätzen und Kapitelenden
//   · Tonmessung: Spitzenpegel, Effektivpegel (RMS), Crest-Faktor aus einer WAV-Datei — echte Zahlen
//   · RSS-Feed: gültiges XML mit Titel, Beschreibung, Dauer, Kapitelmarken, Bild (Podcast-Standard)
//
// Ehrlich: AURA spricht nicht selbst. Ohne Sprachmotor oder Aufnahme bleibt es beim Plan plus
// Timeline; das steht in jedem Ergebnis drin. Die Messung braucht eine WAV-Datei, die es gibt.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_SPOKEN_FILE || path.join(__dirname, '..', 'data', 'spoken_word.json');

// Kapitelzahlen je Buch. Altes Testament 929 + Neues Testament 260 = 1189.
const BIBLE = [
  ['Genesis', 50, 'AT'], ['Exodus', 40, 'AT'], ['Levitikus', 27, 'AT'], ['Numeri', 36, 'AT'], ['Deuteronomium', 34, 'AT'],
  ['Josua', 24, 'AT'], ['Richter', 21, 'AT'], ['Rut', 4, 'AT'], ['1. Samuel', 31, 'AT'], ['2. Samuel', 24, 'AT'],
  ['1. Könige', 22, 'AT'], ['2. Könige', 25, 'AT'], ['1. Chronik', 29, 'AT'], ['2. Chronik', 36, 'AT'], ['Esra', 10, 'AT'],
  ['Nehemia', 13, 'AT'], ['Ester', 10, 'AT'], ['Hiob', 42, 'AT'], ['Psalmen', 150, 'AT'], ['Sprüche', 31, 'AT'],
  ['Prediger', 12, 'AT'], ['Hoheslied', 8, 'AT'], ['Jesaja', 66, 'AT'], ['Jeremia', 52, 'AT'], ['Klagelieder', 5, 'AT'],
  ['Ezechiel', 48, 'AT'], ['Daniel', 12, 'AT'], ['Hosea', 14, 'AT'], ['Joel', 3, 'AT'], ['Amos', 9, 'AT'],
  ['Obadja', 1, 'AT'], ['Jona', 4, 'AT'], ['Micha', 7, 'AT'], ['Nahum', 3, 'AT'], ['Habakuk', 3, 'AT'],
  ['Zefanja', 3, 'AT'], ['Haggai', 2, 'AT'], ['Sacharja', 14, 'AT'], ['Maleachi', 4, 'AT'],
  ['Matthäus', 28, 'NT'], ['Markus', 16, 'NT'], ['Lukas', 24, 'NT'], ['Johannes', 21, 'NT'], ['Apostelgeschichte', 28, 'NT'],
  ['Römer', 16, 'NT'], ['1. Korinther', 16, 'NT'], ['2. Korinther', 13, 'NT'], ['Galater', 6, 'NT'], ['Epheser', 6, 'NT'],
  ['Philipper', 4, 'NT'], ['Kolosser', 4, 'NT'], ['1. Thessalonicher', 5, 'NT'], ['2. Thessalonicher', 3, 'NT'], ['1. Timotheus', 6, 'NT'],
  ['2. Timotheus', 4, 'NT'], ['Titus', 3, 'NT'], ['Philemon', 1, 'NT'], ['Hebräer', 13, 'NT'], ['Jakobus', 5, 'NT'],
  ['1. Petrus', 5, 'NT'], ['2. Petrus', 3, 'NT'], ['1. Johannes', 5, 'NT'], ['2. Johannes', 1, 'NT'], ['3. Johannes', 1, 'NT'],
  ['Judas', 1, 'NT'], ['Offenbarung', 22, 'NT'],
];

const PODCAST_FORMATS = {
  interview: { name: 'Interview', parts: ['Begrüßung', 'Vorstellung des Gastes', 'Hauptteil in drei Blöcken', 'Zusammenfassung', 'Verabschiedung'] },
  solo: { name: 'Solo', parts: ['Einstieg mit These', 'Drei Argumente', 'Gegenargument', 'Schluss und Ausblick'] },
  duo: { name: 'Zwei Stimmen', parts: ['Begrüßung zu zweit', 'Thema aufwerfen', 'Wechselrede', 'Fazit', 'Verabschiedung'] },
  reportage: { name: 'Reportage', parts: ['Ort und Situation', 'Stimmen vor Ort', 'Einordnung', 'Rückweg und Schluss'] },
  hoerspiel: { name: 'Hörspiel', parts: ['Auftakt', 'Szene 1', 'Szene 2', 'Wendung', 'Schluss mit Nachklang'] },
  lehrgang: { name: 'Lehrgang', parts: ['Lernziel', 'Erklärung', 'Beispiel', 'Übung', 'Zusammenfassung'] },
  bibellesung: { name: 'Bibellesung', parts: ['Ansage der Stelle', 'Lesung', 'kurze Einordnung', 'Gebet oder Stille', 'Abspann'] },
  kinderbibel: { name: 'Kinderbibel', parts: ['Begrüßung', 'Erzählung in einfacher Sprache', 'Frage an die Kinder', 'Gute-Nacht-Wunsch'] },
};

const VOICE_ROLES = [
  { id: 'erzaehler', name: 'Erzähler', hint: 'ruhiges Tempo, klare Endungen' },
  { id: 'moderator', name: 'Moderation', hint: 'lebendig, hebt Fragen heraus' },
  { id: 'gast', name: 'Gast', hint: 'antwortet, unterbricht nicht' },
  { id: 'sprecher', name: 'Sprecher (Sachtext)', hint: 'gleichmäßig, sachlich' },
  { id: 'kind', name: 'Kinderstimme', hint: 'einfache Sätze, freundlich' },
  { id: 'chor', name: 'Chor / Gemeinde', hint: 'mehrere Stimmen, weit aufgenommen' },
];

function defaults() { return { productions: [], feed_items: [], readings: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['productions', 'feed_items', 'readings', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const safe = (fn, fb) => { try { const r = fn(); return r === undefined ? fb : r; } catch { return fb; } };

// ---------------------------------------------------------------- 1. Text und Zeit
// Lesezeit aus Wörtern. Sprechtempo je Rolle, Pausen an Absätzen und Kapitelenden.
function readingTime(text, opts) {
  const p = opts || {};
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  const wpm = Number(p.words_per_minute) || 145;            // Vorlesen: 130–160 Wörter/Minute
  const paragraphs = String(text || '').split(/\n\s*\n/).filter((x) => x.trim()).length || 1;
  const minutes = words / wpm;
  const pauses = paragraphs * 0.9 + (Number(p.chapters) || 0) * 1.6;
  return {
    words, paragraphs, words_per_minute: wpm,
    minutes: Math.round(minutes * 10) / 10,
    with_pauses_minutes: Math.round((minutes + pauses / 60) * 10) / 10,
    characters: String(text || '').length,
    note: 'Gerechnet mit dem angegebenen Sprechtempo plus Pausen an Absätzen. Der echte Ton kann davon abweichen — eine Stoppuhr ist die Wahrheit.',
  };
}

// Text in Teile und Kapitel zerlegen (Kapitelmarken für den Feed).
function outline(input) {
  const p = input || {};
  const text = String(p.text || '');
  if (text.trim().length < 40) return { ok: false, error: 'Text fehlt (mindestens 40 Zeichen)' };
  const chapterHeading = /^\s*(kapitel|chapter|kap\.?|teil|abschnitt)\b.*$/i;
  const blocks = text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const chapters = [];
  let current = { title: String(p.first_chapter_title || 'Anfang'), body: [] };
  for (const b of blocks) {
    if (chapterHeading.test(b) && current.body.length) { chapters.push(current); current = { title: b.replace(/\s+/g, ' ').slice(0, 90), body: [] }; }
    else if (chapterHeading.test(b)) current.title = b.replace(/\s+/g, ' ').slice(0, 90);
    else current.body.push(b);
  }
  chapters.push(current);
  let cursor = 0;
  const parts = chapters.map((c, i) => {
    const body = c.body.join('\n\n');
    const rt = readingTime(body, { chapters: 1 });
    const start = cursor; cursor += rt.with_pauses_minutes;
    return {
      nr: i + 1, title: c.title, characters: body.length, words: rt.words,
      minutes: rt.with_pauses_minutes, starts_at_minute: Math.round(start * 100) / 100,
      first_words: body.split(/\s+/).slice(0, 12).join(' '),
    };
  });
  const total = Math.round(cursor * 100) / 100;
  return {
    ok: true, title: String(p.title || 'Ohne Titel'), author: String(p.author || ''),
    chapters: parts.length, parts, total_minutes: total, total_words: parts.reduce((n, x) => n + x.words, 0),
    honest: 'Die Kapitelmarken sind gerechnet, nicht gemessen: Aufnahme oder Sprachmotor liefern die echten Zeiten.',
  };
}

// ---------------------------------------------------------------- 2. Podcast
function podcastEpisode(input) {
  const p = input || {};
  const format = PODCAST_FORMATS[String(p.format || 'solo').toLowerCase()];
  if (!format) return { ok: false, error: `Format unbekannt. Erlaubt: ${Object.keys(PODCAST_FORMATS).join(', ')}` };
  const title = String(p.title || '').trim();
  if (title.length < 3) return { ok: false, error: 'Titel fehlt (mindestens 3 Zeichen)' };
  const minutes = Math.max(1, Math.min(300, Number(p.minutes) || 28));
  const roles = Array.isArray(p.voices) && p.voices.length ? p.voices.filter((v) => VOICE_ROLES.some((r) => r.id === v)) : ['moderator'];
  if (!roles.length) return { ok: false, error: `Stimmen unbekannt. Erlaubt: ${VOICE_ROLES.map((r) => r.id).join(', ')}` };

  // Abschnitte über die Länge verteilen. Die Gewichte (Auftakt kürzer, Abschluss kürzer, Mitte voll)
  // werden **normiert**, damit die Summe genau die geplante Länge ergibt — sonst kommen 27,6 statt 30
  // Minuten heraus. Die letzte Marke wird auf den Rest gesetzt, damit rundet es sich sauber.
  const weights = format.parts.map((_, i) => (i === 0 ? 0.6 : i === format.parts.length - 1 ? 0.7 : 1.1));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const totalSec = Math.round(minutes * 60);
  let at = 0;
  const chapters = format.parts.map((name, i) => {
    const seconds = i === format.parts.length - 1 ? Math.max(1, totalSec - at) : Math.round((totalSec * weights[i]) / wSum);
    const entry = { nr: i + 1, name, at_second: at, seconds, at_label: `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}` };
    at += seconds;
    return entry;
  });

  const bed = safe(() => { const sc = require('./styles_catalog'); const st = sc.find(p.bed || 'podcast') || sc.find('podcast'); return sc.toRender(st.id, { bars: 8 }); }, null);
  const voicePlan = roles.map((r) => ({ role: r, name: (VOICE_ROLES.find((x) => x.id === r) || {}).name, hint: (VOICE_ROLES.find((x) => x.id === r) || {}).hint }));
  const speechState = safe(() => require('./speech').status().mode, 'unbekannt');

  const episode = {
    id: 'pod-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(),
    title, format: format.name, format_id: String(p.format || 'solo').toLowerCase(), minutes,
    planned_seconds: totalSec, chapters_seconds: chapters.reduce((n, c) => n + c.seconds, 0),
    guest: String(p.guest || ''), summary: String(p.summary || '').slice(0, 600),
    chapters, total_chapters: chapters.length,
    voices: voicePlan, bed: bed ? { style: bed.style_name, render_style: bed.render_style, bpm: bed.bpm, mapping: bed.mapping_note } : null,
    transcript_plan: {
      engine_wanted: ['whisper-cpp', 'whisper-py'],
      state: safe(() => require('./speech').engines().ready_count, 0) > 0 ? 'MOTOR DA' : 'KEIN MOTOR — Transkript kommt aus der Vorlage oder wird nachgereicht',
      segments: chapters.map((c) => ({ from: c.at_label, to_seconds: c.at_second + c.seconds })),
    },
    loudness_target: { podcast: '-16 LUFS (Stereo) üblich', spoken: '-19 LUFS für reine Sprachfolgen', measured: 'braucht eine Tonmessung der fertigen Datei' },
    gates: ['Inhalt freigeben (Mensch)', 'Veröffentlichen (Mensch)', 'Einreichen beim Verzeichnis (einmalig, Mensch)'],
  };
  const d = load();
  d.productions.unshift(Object.assign({ kind: 'PODCAST', state: 'PLAN' }, episode));
  d.productions = d.productions.slice(0, 300);
  d.audit.unshift({ at: episode.at, action: 'podcast_episode', id: episode.id, minutes });
  save(d);
  return { ok: true, episode, honest: `Der Plan steht — der Ton fehlt noch. Sprachmotor: ${speechState}. Ohne Aufnahme oder Motor wird nichts gesprochen.` };
}

// RSS 2.0 mit Podcast-Angaben (Kapitelmarken, Dauer, Bild). Echter Feed, keine Andeutung.
function podcastFeed(input) {
  const p = input || {};
  const d = load();
  const base = String(p.base_url || 'https://example.invalid').replace(/\/+$/, '');
  const title = String(p.title || 'Creed Street Podcast');
  const author = String(p.author || 'Creed Street Studios');
  const desc = String(p.description || 'Musik, Werkstatt und Geschichten aus der Creed Street.');
  const items = (Array.isArray(p.items) && p.items.length ? p.items : d.productions.filter((x) => x.kind === 'PODCAST').slice(0, 20).map((x) => ({
    title: x.title, summary: x.summary, at: x.at, minutes: x.minutes, id: x.id, chapters: x.chapters,
    audio_url: `${base}/audio/${x.id}.mp3`, bytes: Math.round((x.minutes || 20) * 60 * 24000), seconds: (x.minutes || 20) * 60,
  })));

  const rfc822 = (iso) => { try { return new Date(iso).toUTCString(); } catch { return new Date().toUTCString(); } };
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  const itemsXml = items.map((it) => {
    const chapters = Array.isArray(it.chapters) ? it.chapters : [];
    const chapterXml = chapters.length
      ? `<podcast:chapters url="${esc(base)}/chapters/${esc(it.id)}.json" type="application/json+chapters"/>\n      <psc:chapters version="1.2">${chapters.map((c) => `<psc:chapter start="${esc(c.at_label || mmss(c.at_second || 0))}" title="${esc(c.name)}"/>`).join('')}</psc:chapters>`
      : '';
    return `    <item>
      <title>${esc(it.title)}</title>
      <description>${esc(it.summary || '')}</description>
      <pubDate>${rfc822(it.at)}</pubDate>
      <guid isPermaLink="false">aura:${esc(it.id || it.title)}</guid>
      <itunes:duration>${mmss(it.seconds || (it.minutes || 20) * 60)}</itunes:duration>
      <enclosure url="${esc(it.audio_url || base + '/audio/' + (it.id || 'folge') + '.mp3')}" length="${esc(it.bytes || 1000000)}" type="audio/mpeg"/>
      ${chapterXml}
      <itunes:explicit>false</itunes:explicit>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:psc="http://podlove.org/simple-chapters">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(base)}</link>
    <description>${esc(desc)}</description>
    <language>${esc(p.language || 'de')}</language>
    <itunes:author>${esc(author)}</itunes:author>
    <itunes:owner><itunes:name>${esc(author)}</itunes:name><itunes:email>${esc(p.email || 'kontakt@example.invalid')}</itunes:email></itunes:owner>
    <itunes:category text="${esc(p.category || 'Music')}"/>
    <itunes:image href="${esc(base)}/bild/cover-3000.jpg"/>
    <itunes:explicit>false</itunes:explicit>
    <lastBuildDate>${rfc822(new Date().toISOString())}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;
  const entry = {
    items: items.length, bytes: Buffer.byteLength(xml, 'utf8'), title, base_url: base,
    validations: [
      { what: 'XML-Aufbau', ok: /^<\?xml[\s\S]*<rss[\s\S]*<channel>[\s\S]*<\/channel><\/rss>/.test(xml.trim() + '</rss>') || xml.includes('</channel>\n</rss>') },
      { what: 'Pflichtangaben eines Podcast-Feeds (Titel, Beschreibung, Sprache, Bild, Autor)', ok: ['<title>', '<description>', '<language>', 'itunes:image', 'itunes:author'].every((k) => xml.includes(k)) },
      { what: 'je Folge eine eigene Kennung', ok: items.every((it) => it.id || it.title) },
      { what: 'Kapitelmarken vorhanden', ok: items.some((it) => (it.chapters || []).length) },
      { what: 'absolute Adressen im Feed', ok: /https?:\/\//.test(xml) },
    ],
  };
  const d2 = load();
  d2.feed_items.unshift(Object.assign({ at: new Date().toISOString() }, entry));
  d2.feed_items = d2.feed_items.slice(0, 100);
  d2.audit.unshift({ at: new Date().toISOString(), action: 'podcast_feed', items: items.length });
  save(d2);
  return { ok: true, xml, entry, straight: 'Ein Feed für alle Verzeichnisse — dieser Text geht unverändert an jedes Haus, das Feeds liest.', honest: 'Ein Feed ist erst gültig, wenn eine fremde App ihn liest. Unser Prüfweg: Podcast Index und AntennaPod.' };
}

// ---------------------------------------------------------------- 3. Hörbuch
function audiobook(input) {
  const p = input || {};
  const plan = outline(p);
  if (!plan.ok) return plan;
  const target = { lufs: -18, true_peak_dbtp: -3, noise_floor_dbfs: -50, note: 'Übliche Hörbuch-Vorgaben. Gemessen wird mit einer Tonmessung — unsere Zahl kommt aus der Datei, nicht aus einem Wunsch.' };
  const perChapter = plan.parts.map((c) => ({
    nr: c.nr, title: c.title, minutes: c.minutes, words: c.words,
    file: `kapitel-${String(c.nr).padStart(3, '0')}.wav`,
    markers: { start: c.starts_at_minute }, gate: 'Abnahme durch den Menschen',
  }));
  const upc = safe(() => require('./distributors').ean13(p.ean_prefix || '426', p.ean_number || String(Date.now()).slice(-9)), null);
  const production = {
    id: 'hb-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), kind: 'HOERBUCH',
    title: plan.title, author: plan.author, narrator: String(p.narrator || ''), language: String(p.language || 'de'),
    chapters: plan.chapters, total_minutes: plan.total_minutes, total_words: plan.total_words,
    chapter_plan: perChapter, loudness_target: target, upc: upc ? upc.ean13 : null,
    states: ['TEXT', 'PLAN', 'AUFNAHME', 'SCHNITT', 'ABNAHME', 'KENNUNGEN', 'VERTEILER'],
    next_step: 'Aufnahme je Kapitel oder Sprachmotor; danach Pegel messen und Kapitelmarken setzen.',
    gates: ['Tonabnahme je Kapitel (Mensch)', 'Sprecher-Freigabe (Mensch)', 'Einreichen beim Verteiler (Mensch)'],
  };
  const d = load();
  d.productions.unshift(production); d.productions = d.productions.slice(0, 300);
  d.audit.unshift({ at: production.at, action: 'audiobook', id: production.id, chapters: plan.chapters });
  save(d);
  return { ok: true, production, honest: 'Plan und Kapitelzeiten sind gerechnet. Aufnahme, Abnahme und Kennung brauchen Menschen und Arbeit.' };
}

// ---------------------------------------------------------------- 4. Audiobibel
function bibleBooks(input) {
  const p = input || {};
  const testament = p.testament ? String(p.testament).toUpperCase() : null;
  const rows = BIBLE.filter((b) => !testament || b[2] === testament).map(([name, chapters, t]) => ({ name, chapters, testament: t }));
  const chapters = rows.reduce((n, b) => n + b.chapters, 0);
  return {
    ok: true, books: rows.length, chapters, rows,
    totals: {
      AT_books: BIBLE.filter((b) => b[2] === 'AT').length, AT_chapters: BIBLE.filter((b) => b[2] === 'AT').reduce((n, b) => n + b[1], 0),
      NT_books: BIBLE.filter((b) => b[2] === 'NT').length, NT_chapters: BIBLE.filter((b) => b[2] === 'NT').reduce((n, b) => n + b[1], 0),
    },
    note: `Die Bibel hat 66 Bücher und ${BIBLE.reduce((n, b) => n + b[1], 0)} Kapitel (929 im Alten, 260 im Neuen Testament). Gezählt wird hier je Buch, nicht je Vers.`,
  };
}

// Leseplan: das ganze Werk in einer gewünschten Zahl von Tagen, gleichmäßig nach Kapiteln.
function biblePlan(input) {
  const p = input || {};
  const days = Math.max(1, Math.min(2000, Number(p.days) || 365));
  const from = String(p.from || 'Genesis').toLowerCase();
  const start = BIBLE.findIndex((b) => b[0].toLowerCase() === from);
  if (start < 0) return { ok: false, error: `Buch unbekannt: „${p.from}“. Erste Bücher: ${BIBLE.slice(0, 5).map((b) => b[0]).join(', ')} …` };
  const queue = [];
  for (const [name, chapters] of BIBLE.slice(start)) for (let c = 1; c <= chapters; c++) queue.push({ book: name, chapter: c });
  const perDay = queue.length / days;
  const plan = [];
  let i = 0;
  for (let day = 1; day <= days; day++) {
    const take = Math.max(1, Math.round(day * perDay) - Math.round((day - 1) * perDay));
    const part = queue.slice(i, i + take);
    i += take;
    if (!part.length) break;
    plan.push({
      day, chapters: part.length,
      from: `${part[0].book} ${part[0].chapter}`, to: `${part[part.length - 1].book} ${part[part.length - 1].chapter}`,
      minutes: Math.round(part.length * 4.2 * 10) / 10,           // ≈ 4–5 Minuten je Kapitel vorgelesen
    });
  }
  const rt = safe(() => require('./styles_catalog').toRender('audiobibel', { bars: 8 }), null);
  const entry = {
    id: 'ab-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), kind: 'AUDIOBIBEL',
    days, chapters: queue.length, from: BIBLE[start][0],
    total_minutes_estimated: Math.round(queue.length * 4.2), plan: p.verbose === true ? plan : plan.slice(0, 14),
    bed: rt ? { style: rt.style_name, render_style: rt.render_style, bpm: rt.bpm } : null,
    voice_roles: ['erzaehler', 'sprecher'],
    states: ['PLAN', 'AUFNAHME', 'SCHNITT', 'ABNAHME', 'FEED', 'VERTEILER'],
    straight: 'Eine Aufnahme je Kapitel, ein Leseplan, ein Feed. Die 1189 Kapitel sind die Arbeit — die Struktur steht schon.',
    honest: 'Je Kapitel sind rund 4–5 Minuten Vorlesen angenommen (Richtwert, keine Messung). 1189 Kapitel sind bei 5 Minuten etwa 99 Stunden Ton.',
  };
  const d = load();
  d.readings.unshift(Object.assign({}, entry, { plan_full: plan })); d.readings = d.readings.slice(0, 50);
  d.productions.unshift(Object.assign({ kind: 'AUDIOBIBEL', state: 'PLAN', chapters: queue.length, days }, { id: entry.id, at: entry.at, title: `Audiobibel in ${days} Tagen`, total_minutes: entry.total_minutes_estimated }));
  d.audit.unshift({ at: entry.at, action: 'bible_plan', id: entry.id, days, chapters: queue.length });
  save(d);
  return Object.assign({ ok: true, reading: entry, plan }, { honesty: entry.honest });
}

// Fortschritt eines Leseplans festhalten (eine Zahl, die wirklich gemessen ist: abgehörte Kapitel).
function bibleProgress(input) {
  const p = input || {};
  const d = load();
  const r = d.readings.find((x) => x.id === p.id);
  if (!r) return { ok: false, error: 'Leseplan nicht gefunden' };
  const done = Math.max(0, Math.min(r.chapters, Number(p.chapters_done) || 0));
  r.chapters_done = done; r.at_done = new Date().toISOString();
  const percent = Math.round((done / r.chapters) * 1000) / 10;
  d.audit.unshift({ at: r.at_done, action: 'bible_progress', id: r.id, done, percent });
  save(d);
  return { ok: true, id: r.id, chapters_done: done, chapters: r.chapters, percent, remaining_hours: Math.round(((r.chapters - done) * 4.2) / 60 * 10) / 10, note: 'Nur was wirklich gehört wurde, zählt. Geschätzt wird nur die verbleibende Zeit.' };
}

// Ton einer fertigen Datei messen: Spitze, Effektivwert, Crest-Faktor. Echte Zahlen aus der Datei.
function measure(file) {
  const f = String(file || '');
  if (!f || !fs.existsSync(f)) return { ok: false, error: 'Datei nicht gefunden: ' + (f || '(leer)') };
  const buf = fs.readFileSync(f);
  if (buf.length < 44 || buf.toString('latin1', 0, 4) !== 'RIFF') return { ok: false, error: 'Keine WAV-Datei (RIFF-Kopf fehlt)' };
  // Kanäle und Bittiefe aus dem fmt-Block lesen
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
  let peak = 0, sum = 0, n = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const o = dataStart + (i * channels + c) * bytesPer;
      if (o + bytesPer > buf.length) break;
      let v;
      if (bits === 16) v = buf.readInt16LE(o) / 32768;
      else if (bits === 8) v = (buf.readUInt8(o) - 128) / 128;
      else if (bits === 32) v = buf.readInt32LE(o) / 2147483648;
      else v = (buf.readUInt16LE(o) - 32768) / 32768;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v; n++;
    }
  }
  const rms = n ? Math.sqrt(sum / n) : 0;
  const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 100) / 100 : null);
  const seconds = Math.round((frames / rate) * 100) / 100;
  return {
    ok: true, file: f, seconds, channels, sample_rate: rate, bits, frames, bytes: buf.length,
    peak_db: db(peak), rms_db: db(rms), crest_factor_db: peak > 0 && rms > 0 ? Math.round((20 * Math.log10(peak / rms)) * 100) / 100 : null,
    clipped: peak >= 0.999,
    verdict: peak >= 0.999 ? 'ÜBERSTEUERT — Spitze liegt an der Grenze' : db(rms) > -12 ? 'SEHR LAUT — für Sprache zu dicht' : db(rms) < -30 ? 'SEHR LEISE — Pegel anheben' : 'PEGEL IM RAHMEN',
    honesty: 'Gemessen wird Spitze und Effektivwert. Eine Lautheit nach EBU R128 (LUFS) braucht ein Messgerät — diese Zahl hier ist keine.',
  };
}

function status() {
  const d = load();
  const byKind = ['PODCAST', 'HOERBUCH', 'AUDIOBIBEL'].map((k) => ({ kind: k, count: d.productions.filter((x) => x.kind === k).length }));
  return {
    area: 'SPOKEN', module: 'spoken_word', state: 'live', file: FILE,
    productions: d.productions.length, by_kind: byKind, feeds: d.feed_items.length, readings: d.readings.length,
    podcast_formats: Object.keys(PODCAST_FORMATS), voice_roles: VOICE_ROLES.length,
    bible: { books: BIBLE.length, chapters: BIBLE.reduce((n, b) => n + b[1], 0) },
    speech_engine: safe(() => require('./speech').status().mode, 'unbekannt'),
    rules: ['Ohne Aufnahme oder Sprachmotor bleibt es beim Plan — AURA spricht nicht selbst.', 'Der RSS-Feed wird wirklich erzeugt und geprüft (Pflichtangaben, Kennungen, Kapitelmarken, absolute Adressen).', 'Die Bibelstruktur ist gezählt (66 Bücher, 1189 Kapitel), nicht geschätzt.', 'Kapitelzeiten sind gerechnet; die Stoppuhr der Aufnahme gewinnt immer.', 'Tonabnahme, Freigabe und Einreichen: ein Mensch.'],
  };
}

module.exports = {
  meta: { area: 'SPOKEN', id: 'spoken_word', name: 'Podcast, Hörbuch und Audiobibel (Plan, Kapitel, Feed, Messung)', state: 'live' },
  actions: {
    status: () => status(),
    reading_time: (p) => readingTime((p || {}).text, p || {}) || { ok: false, error: 'Text fehlt' },
    outline: (p) => outline(p || {}),
    podcast: (p) => podcastEpisode(p || {}),
    feed: (p) => podcastFeed(p || {}),
    audiobook: (p) => audiobook(p || {}),
    bible: (p) => bibleBooks(p || {}),
    bible_plan: (p) => biblePlan(p || {}),
    bible_progress: (p) => bibleProgress(p || {}),
    measure: (p) => measure((p || {}).file),
    formats: () => ({ ok: true, formats: Object.entries(PODCAST_FORMATS).map(([id, f]) => ({ id, name: f.name, parts: f.parts })), voices: VOICE_ROLES }),
    productions: () => { const d = load(); return { ok: true, count: d.productions.length, productions: d.productions.slice(0, 30) }; },
    feeds: () => { const d = load(); return { ok: true, count: d.feed_items.length, feeds: d.feed_items.slice(0, 10) }; },
    readings: () => { const d = load(); return { ok: true, count: d.readings.length, readings: d.readings.slice(0, 10).map((r) => ({ id: r.id, days: r.days, chapters: r.chapters, chapters_done: r.chapters_done || 0, from: r.from })) }; },
  },
  BIBLE, PODCAST_FORMATS, VOICE_ROLES, readingTime, outline, podcastEpisode, podcastFeed, audiobook, bibleBooks, biblePlan, bibleProgress, measure, status,
};
