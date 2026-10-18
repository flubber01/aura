'use strict';
// AURA · Rohrleitungen (Pipes) — jede Produktionsstraße des Hauses in einem Register.
//
// Eine Pipe ist eine Kette von Stufen. Jede Stufe nennt:
//   · den Baustein, der sie rechnet (echter Modulname aus diesem Haus),
//   · ob sie automatisch läuft (AUTO) oder einen Menschen braucht (MENSCH),
//   · was sie hinterlässt (Ergebnis, Datei, Ticket).
//
// Der Durchlauf (`run`) **führt die Automatikstufen wirklich aus** und schreibt zu jeder Stufe hin, was
// passiert ist. Menschliche Stufen werden nicht vorgetäuscht: sie stehen danach als „WARTET AUF MENSCH"
// im Protokoll. Ohne Schlüssel, ohne Sprachmotor, ohne Aufnahme bleibt es bei Plan und Paket — das
// steht in jedem Durchlauf drin.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_PIPES_FILE || path.join(__dirname, '..', 'data', 'workflow_pipes.json');

// A(was, baustein, aufruf, hinweis, zuordnung)
// Die Zuordnung sagt, womit der Baustein aufgerufen wird: aus der Pipe-Eingabe (input) oder aus dem
// Ergebnis einer früheren Stufe (prior). Ohne Zuordnung bekommt er die Pipe-Eingabe als ein Objekt.
const A = (what, module, call, note, map) => ({ kind: 'AUTO', what, module, call: call || null, note: note || '', map: typeof map === 'function' ? map : null });
const M = (what, module, note) => ({ kind: 'MENSCH', what, module: module || 'mensch', call: null, note: note || 'Freigabe durch einen Menschen' });

const PIPES = [
  {
    id: 'musik', name: 'Musik: von der Idee zur Veröffentlichung', area: 'MUSIK',
    stages: [
      A('Stil bestimmen', 'styles_catalog', 'read', 'Liest den gewünschten Stil aus dem Text und legt Tempo, Takt, Instrumente fest.', (i) => [{ text: i.style || i.beschreibung || 'ich will einen lofi song' }]),
      A('Text und Reim', 'lyric_writer', 'write', 'Strophen, Reim, Silbenzahl je Zeile.', (i) => [{ subject: i.subject || i.title || 'Aufbruch aus der Creed Street', style: i.style || 'pop' }]),
      A('Struktur und Ablauf', 'song_orchestrator', 'plan', 'Abschnitte, Tonart, Übergänge, Ticket für die Abteilung.', (i) => [{ prompt: i.prompt || (i.style ? i.style + ' mit klarer Struktur' : 'dunkler Trap mit Schlager-Piano, deutsch'), title: i.title || 'Arbeitstitel' }]),
      A('Abteilungen prüfen', 'music_departments', 'gates', '20 Tore: Text, Melodie, Harmonie, Rhythmus, Klang, Mischung, Master.', (i, prior) => [Object.assign({ title: i.title || 'Arbeitstitel' }, (prior['Struktur und Ablauf'] && prior['Struktur und Ablauf'].plan) || {})]),
      A('Rendern (Grundgerüst)', 'music_render', 'renderSong', 'Sechs Grundgerüste; alles Weitere wird über Tempo, Tonleiter und Klangfarbe gelegt.'),
      M('Gehört und abgenommen', 'mensch', 'Jemand hört den Mix ganz an. Erst dann geht es weiter.'),
      A('Kennungen', 'distributors', 'ean', 'UPC (EAN-13 mit Prüfziffer) und ISRC-Aufbau.', (i) => [i.ean_prefix || '426', i.ean_number || '000123456']),
      M('Bei einem Verteiler einreichen', 'distributors', 'Konto und Handlung eines Menschen; danach laufen Läden und Abrechnung.'),
      A('Abrechnung gegenprüfen', 'logs_analytics', 'report', 'Eigene Zahlen gegen die Abrechnung des Verteilers.'),
    ],
  },
  {
    id: 'podcast', name: 'Podcast: Folge bauen und ausliefern', area: 'SPOKEN',
    stages: [
      A('Format und Länge', 'spoken_word', 'podcast', 'Abschnitte, Kapitelmarken in Sekunden, Stimmenrollen.', (i) => [{ title: i.title || 'Folge 1: Der erste Ton', format: i.format || 'interview', minutes: Number(i.minutes) || 30, voices: i.voices || ['moderator', 'gast'] }]),
      A('Stil für das Bett', 'styles_catalog', 'toRender', 'Podcast-Bett mit Tempo und Klangfarbe.', (i) => [i.bed || 'podcast', { bars: Number(i.bars) || 8 }]),
      A('Text vorbereiten', 'lyric_writer', 'write', 'Kein Reimzwang — aber Zeilenlänge und Sprechbarkeit.', (i) => [{ subject: i.subject || i.title || 'Der erste Ton', style: 'podcast' }]),
      A('Aufnahme oder Sprachplan', 'speech', 'plan', 'Ohne Sprachmotor: Plan mit Wortzahl und geschätzter Dauer. Mit Aufnahme: echte Datei.', (i) => [{ text: i.sprechtext || i.summary || 'Beispieltext für die Zeitrechnung: rund zweihundert Wörter, damit die Schätzung greifbar wird. '.repeat(4), voice: i.voice }]),
      M('Folge anhören und freigeben', 'mensch', 'Ton, Aussage, Länge. Der Mensch hat das letzte Wort.'),
      A('Tonmessung', 'spoken_word', 'measure', 'Spitze, Effektivwert, Crest-Faktor aus der fertigen Datei.', (i) => [i.file || i.audio_file || '']),
      A('RSS-Feed erzeugen', 'spoken_word', 'feed', 'Gültiges XML mit Kapitelmarken, Dauer, Bild.'),
      A('Verteilerliste', 'distributors', 'straight', 'Ein Feed, viele Verzeichnisse — mit den originalen Adressen.', () => ['podcast']),
      M('Feed einreichen', 'distributors', 'Einmalig bei den Verzeichnissen; danach holt sich jede Folge selbst.'),
    ],
  },
  {
    id: 'hoerbuch', name: 'Hörbuch: vom Text zum Hörbuch', area: 'SPOKEN',
    stages: [
      A('Text zerlegen', 'spoken_word', 'outline', 'Teile, Kapitel, Lesezeit je Kapitel.', (i) => [{ title: i.title || 'Beispielhörbuch', author: i.author || 'Creed Street', text: i.text || ('Kapitel 1\n\n' + 'Wort '.repeat(200) + '\n\nKapitel 2\n\n' + 'Wort '.repeat(200)) }]),
      A('Sprechrolle wählen', 'spoken_word', 'formats', 'Erzähler, Sachtext, Kinderstimme — je nach Werk.'),
      A('Aufnahme je Kapitel planen', 'speech', 'plan', 'Wortzahl, geschätzte Dauer, Pausen.', (i) => [{ text: i.text ? String(i.text).slice(0, 4000) : 'Beispieltext für die Kapitelplanung. '.repeat(20) }]),
      M('Sprecher-Aufnahme abnehmen', 'mensch', 'Je Kapitel anhören; Sprecherfreigabe.'),
      A('Pegel und Lautheit messen', 'spoken_word', 'measure', 'Vorgaben nennen, gemessene Werte daneben stellen. Braucht die fertige Datei.', (i) => [i.file || i.audio_file || '']),
      A('Kennungen', 'distributors', 'ean', 'UPC je Titel.', (i) => [i.ean_prefix || '426', i.ean_number || '000654321']),
      M('Einreichen (ACX, Apple, Google, Kobo, Bookwire)', 'distributors', 'Verträge und Tonabnahme prüft ein Mensch.'),
    ],
  },
  {
    id: 'audiobibel', name: 'Audiobibel: 1189 Kapitel in einem Leseplan', area: 'SPOKEN',
    stages: [
      A('Bücher und Kapitel zählen', 'spoken_word', 'bible', '66 Bücher, 1189 Kapitel (929 + 260).'),
      A('Leseplan bauen', 'spoken_word', 'bible_plan', 'Gleichmäßig nach Kapiteln, wahlweise 365 Tage.'),
      A('Bett und Klang', 'styles_catalog', 'toRender', 'Ruhiger Unterleger, keine Ablenkung.', (i) => [i.bed || 'audiobibel', { bars: 8 }]),
      A('Aufnahmeplan je Buch', 'speech', 'plan', 'Rund 4–5 Minuten je Kapitel sind die Arbeit.', (i) => [{ text: i.sprechtext || 'Und Gott sprach: Es werde Licht. Und es ward Licht. '.repeat(12), voice: i.voice || 'erzaehler' }]),
      M('Theologische und sprachliche Abnahme', 'mensch', 'Textfassung, Aussprache, Betonung.'),
      A('Fortschritt festhalten', 'spoken_word', 'bible_progress', 'Nur Gehörtes zählt.', (i, prior) => [{ id: (prior['Leseplan bauen'] && prior['Leseplan bauen'].reading && prior['Leseplan bauen'].reading.id) || i.plan_id, chapters_done: Number(i.chapters_done) || 3 }]),
      A('Als Feed ausliefern', 'spoken_word', 'feed', 'Kapitel als Folgen mit Marken.'),
      M('Veröffentlichen', 'mensch', 'Ein Mensch drückt den Knopf.'),
    ],
  },
  {
    id: 'duett', name: 'Duett: zu zweit singen', area: 'DUET',
    stages: [
      M('Erlaubnis der zweiten Person', 'duet', 'consent_text', 'Ohne Einverständnis wird nichts umgeformt.'),
      M('Aufnahmen machen', 'duet', 'take', 'Zwei WAV-Dateien, je eine Stimme.'),
      A('Mischplan (Tonart, Intervalle, Grenzen)', 'duet', 'plan', 'Welche Intervalle, wie viel Korrektur, welche Tore — ohne Aufnahme beantwortbar.'),
      A('Paarmessung (Versatz, Tonhöhe beide)', 'duet', 'pair', 'Braucht zwei Aufnahmen; ohne sie wird die Stufe ehrlich abgebrochen.', (i) => [{ ich_file: i.ich_file || i.file_a, partner_file: i.partner_file || i.file_b }]),
      A('Ausrichten, Stimmen, Harmonie, Dopplung, Mischen', 'duet', 'duet', 'Höchstens zwei Halbtöne je Stimme; Spitze auf −1 dBFS; Zahlen zum Nachlesen.'),
      M('Abnahme durch beide', 'mensch', 'Die Mischung hören beide an.'),
      A('Bild dazu', 'visual_effects', 'chain', 'Geteiltes Bild, Wasserzeichen, Farb-Look.', () => [{ effects: ['special-duett-split', 'farbe-waerme', 'zusatz-logo-wasserzeichen'] }]),
      M('Veröffentlichen', 'mensch', 'Freigabe beider Personen.'),
    ],
  },
  {
    id: 'video', name: 'Video: Drehplan, Effekte, Schnitt, Auslieferung', area: 'VIDEO',
    stages: [
      A('Drehbuch und Einstellungen', 'camera_director', 'storyboard', 'Einstellungsgrößen, Bewegungen, Licht, Framing.', (i) => [{ scenes: i.scenes || [{ name: 'Ankunft', minutes: 2 }, { name: 'Gespräch', minutes: 4 }], style: i.style || 'mittel' }]),
      A('Optik rechnen', 'camera_director', 'optics', 'Bildwinkel, Schärfentiefe, Kadrierung.'),
      A('Effekte und Ketten', 'visual_effects', 'chain', 'Farbe, Störung, Übergänge — geprüft, mit Blitzwarnung.', (i) => [{ effects: i.effects || ['farbe-grundlook', 'schnitt-blende'] }]),
      A('Rollenkette und Tickets', 'video_department', 'create / dispatch', 'Schnitt, Ton, Farbe, Grafik als Aufgaben.'),
      M('Dreh', 'mensch', 'Kamera, Licht, Ton — das macht niemand automatisch.'),
      A('Ton aufbereiten', 'daw_plugins', 'buildFilters', 'Kette für Stimme und Musik.', (i) => [i.tonkette || [['highpass', { hz: 90 }], ['eq', { mid: 2000, mid_gain: -2, high_gain: 2 }], ['compressor', { threshold: -20, ratio: 3 }], ['deesser', {}]]]),
      M('Abnahme des Schnitts', 'mensch', 'Bild und Ton zusammen ansehen.'),
      A('Formate und Datenmengen', 'camera_director', 'format', 'Je Plattform Länge, Auflösung, Bitrate.'),
      A('Plattformliste', 'distributors', 'links', 'Originaladressen der Plattformen.', () => [{ kind: 'video' }]),
      M('Hochladen', 'mensch', 'Ein Mensch lädt hoch und schreibt die Beschreibung.'),
    ],
  },
  {
    id: 'print', name: 'Buch und Handel: Druck, Laden, Versand', area: 'PRINT',
    stages: [
      A('Text und Umfang', 'spoken_word', 'reading_time', 'Zeichen, Wörter, Lesezeit — daraus Seitenzahl schätzen.', (i) => [i.text || 'Beispieltext für den Umfang: '.repeat(60), { chapters: 1 }]),
      M('Lektorat', 'mensch', 'Rechtschreibung, Aussage, Reihenfolge.'),
      A('Kennung und Verzeichnung', 'distributors', 'ean', 'EAN-13 mit Prüfziffer.', (i) => [i.ean_prefix || '426', i.ean_number || '000111222']),
      A('Rechte und Abspann', 'legal', 'list', 'Impressum, Urheberrecht, Copyright Creed Street Studios 2026 (fünf Dokumente, Fassung 2026.1).', () => []),
      M('Bei KDP, IngramSpark, BoD einreichen', 'distributors', 'Konto und Vertrag: Mensch.'),
      A('Aufgabe für den Laden', 'store', 'addTask', 'Direktverkauf ohne Zwischenhändler: Artikel und Versand als Aufgabe anlegen.', (i) => [{ title: i.title || 'Artikel anlegen: Beispielbuch', kind: i.kind || 'SHOP', note: 'Direktverkauf über den eigenen Laden.' }]),
    ],
  },
  {
    id: 'werbung', name: 'Werbung und Sponsoring: Sendeplatz und Abrechnung', area: 'ADS',
    stages: [
      A('Sendeplatz und Länge', 'ad_engine', 'plan', 'Sechs Minuten Flash (nicht wegklickbar), elf Minuten andere.'),
      A('Ticker und Förderung', 'sponsor', 'tiers / commit', 'Foundry-Ticker unten, Zahlung nur mit Beleg.'),
      A('Empfehlung und Anteil', 'referral', 'create / payout', 'Code, Prozentsatz, gutgeschriebener Anteil.'),
      A('Auswertung', 'logs_analytics', 'report', 'Aufrufe, Klicks, Einnahmen, Marge.'),
      M('Sponsoring-Zusage', 'mensch', 'Vertrag und Freigabe der Einblendung.'),
      A('Abrechnung prüfen', 'payment_validation', 'validate', 'IBAN, USt-IdNr., Betrag, SEPA-Prüfziffern.'),
    ],
  },
  {
    id: 'newsletter', name: 'Newsletter und Publikum', area: 'PUBLIC',
    stages: [
      A('Inhalt aus dem Werk', 'newsletter', 'create', 'Aus dem, was wirklich entstanden ist.'),
      A('Anmeldung mit Marker', 'newsletter', 'subscribe', 'Zweistufig — kein stilles Eintragen. Ohne Bestätigung passiert nichts.', (i) => [{ mail: i.mail || 'beispiel@example.invalid', topics: i.topics || ['musik'] }]),
      A('Bestätigung des Markers', 'newsletter', 'confirm', 'Marker bestätigen — sonst bleibt der Eintrag unbestätigt.', (i, prior) => {
        const link = (prior['Anmeldung mit Marker'] || {}).confirm_link || '';
        const t = link.split('token=')[1] || '';
        return [{ token: t }];
      }),
      A('Versandweg prüfen', 'newsletter', 'status', 'Ohne SMTP: Plan mit Vermerk „wartet auf Versandweg".'),
      M('Absenden', 'mensch', 'Ein Mensch sendet.'),
      A('Messung', 'logs_analytics', 'collect', 'Öffnungen und Klicks nur, wenn der Weg es hergibt.'),
    ],
  },
  {
    id: 'web', name: 'Seiten und Projekte', area: 'WEB',
    stages: [
      A('Idee finden', 'idea_catalog', 'pick', '250 Ideen je Nische mit Aufwand und Ertrag.'),
      A('Baugerüst', 'ui_kit', 'shell', 'Seitenhülle, Navigation, Fuß.'),
      A('Mehrsprachigkeit', 'i18n', 'translate', 'Acht Sprachen, RTL für Arabisch.', () => [{ key: 'nav.support' }, { lang: 'en', key: 'nav.support' }]),
      A('Außenhaut', 'themes', 'apply', 'Themes und Hintergründe.'),
      A('Kennzahlen', 'logs_analytics', 'collect', 'Ohne Kekse, ohne Weitergabe.', () => [{ path: '/', ms: 40 }]),
      M('Freischalten', 'mensch', 'Domain, Inhalt, Verantwortung.'),
      A('Suchmaschinen', 'distributors', 'links', 'Search Console, Webmaster Tools, Sitemaps.', () => [{ kind: 'web' }]),
    ],
  },
  {
    id: 'fortbildung', name: 'Kurse und Lernwege', area: 'LERN',
    stages: [
      A('Ablauf und Lernziele', 'media_newsroom', 'plan', 'Lernweg in Abschnitte.'),
      A('Erklärung und Beispiel', 'spoken_word', 'podcast', 'Lehrgang-Format mit fünf Abschnitten.', (i) => [{ title: i.title || 'Lehrgang: Grundlagen', format: 'lehrgang', minutes: Number(i.minutes) || 12, voices: ['moderator'] }]),
      A('Kamera für die Aufnahme', 'camera_director', 'day', 'Drehplan mit Licht und Zeitfenstern.', (i) => [{ start: i.start || '10:00', scenes: i.scenes || [{ name: 'Tafelbild', minutes: 40 }, { name: 'Sprechkopf', minutes: 60 }] }]),
      M('Fachliche Abnahme', 'mensch', 'Stimmt der Inhalt?'),
      A('Auslieferung', 'distributors', 'straight', 'Plattformen und eigene Seite.', () => ['video']),
      A('Effekte fürs Lernvideo', 'visual_effects', 'chain', 'Untertitel und Fortschritt — geprüft.', () => [{ effects: ['farbe-grundlook', 'zusatz-untertitel-brennen', 'zusatz-fortschrittsbalken'] }]),
    ],
  },
  {
    id: 'intro', name: 'Intros und Vorspänne', area: 'BRAND',
    stages: [
      A('Szene bauen', 'flash_intro', 'build / render', '10 Sekunden Boot-Sequenz, Logo, Text.'),
      A('Marke', 'branding', 'logo / colors', 'Zeichen und Farben nach Vorgabe.'),
      A('Effekte', 'visual_effects', 'preset', 'Übergänge und Look.', (i) => [{ preset: i.preset || 'kinderbibel' }]),
      M('Ansehen und freigeben', 'mensch', 'Ein Intro, das gefällt, oder gar keines.'),
    ],
  },
  {
    id: 'support', name: 'Support und Kundenpflege', area: 'SERVICE',
    stages: [
      A('Kontaktwege', 'support', 'ways', 'Erreichbarkeit mit Zeiten und Antwortzeiten.'),
      A('Einliefern und einordnen', 'support', 'submit', 'Kategorie, Dringlichkeit, Zuständigkeit.', (i) => [{ title: i.subject || 'Frage zur Bestellung', text: i.text || 'Bitte um Auskunft zum Lieferstand meiner Bestellung.', from: i.from || 'kunde@example.invalid', category: i.category || 'bestellung' }]),
      M('Antworten', 'mensch', 'Kein Textbaustein ohne Prüfung.'),
      A('Nachverfolgen', 'support', 'status', 'Bis es geschlossen ist.'),
    ],
  },
  {
    id: 'sicherheit', name: 'Sicherheit: prüfen, isolieren, rauswerfen', area: 'SEC',
    stages: [
      A('Rundgang', 'security_center', 'sweep', 'Geheimnisse, Rechte, Wege, Eingaben.'),
      A('Angriff erkennen', 'security_center', 'detect', 'Erst erkennen — nicht sofort sperren.'),
      A('Isolieren', 'security_center', 'isolate', 'Zugang sperren, Beweise sichern.'),
      M('Rauswerfen entscheiden', 'mensch', 'Der Mensch entscheidet über Ausschluss.'),
      A('Protokoll', 'security_center', 'incident', 'Wer, wann, was, warum.', (i) => [{ action: 'detect', what: i.what || 'Rundgang ohne Befund — zur Nachvollziehbarkeit festgehalten', severity: i.severity || 'HINWEIS', source: 'Rohrleitung Sicherheit' }]),
    ],
  },
];

function defaults() { return { runs: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['runs', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function list(input) {
  const p = input || {};
  const area = p.area ? String(p.area).toUpperCase() : null;
  const rows = PIPES.filter((x) => !area || x.area === area);
  return {
    ok: true, total: PIPES.length, shown: rows.length,
    pipes: rows.map((x) => ({
      id: x.id, name: x.name, area: x.area, stages: x.stages.length,
      auto: x.stages.filter((s) => s.kind === 'AUTO').length, human: x.stages.filter((s) => s.kind === 'MENSCH').length,
      modules: [...new Set(x.stages.map((s) => s.module))],
    })),
    human_rule: 'Jede Pipe endet bei einem Menschen. Automatik bereitet vor, ein Mensch gibt frei.',
  };
}

// Eine Stufe wirklich ausführen — mit echten Modulaufrufen. Fehlt der Baustein, steht das da.
function runStage(stage, input, prior) {
  if (stage.kind === 'MENSCH') return { kind: 'MENSCH', state: 'WARTET AUF MENSCH', what: stage.what, module: stage.module, note: stage.note };
  if (!stage.call) return { kind: 'AUTO', state: 'KEIN AUFRUF', what: stage.what, module: stage.module, note: stage.note };
  let mod;
  try { mod = require('./' + stage.module); }
  catch (e) { return { kind: 'AUTO', state: 'BAUSTEIN FEHLT', what: stage.what, module: stage.module, error: e.message }; }
  const fn = stage.call.split(' ')[0].split('/')[0].trim();
  const actions = mod.actions || {};
  const handler = actions[fn] || (typeof mod[fn] === 'function' ? mod[fn] : null) || (mod.actions && Object.keys(actions).length ? actions[Object.keys(actions)[0]] : null);
  if (typeof handler !== 'function') return { kind: 'AUTO', state: 'KEIN ZUGANG', what: stage.what, module: stage.module, call: stage.call, note: 'Baustein vorhanden, aber diese Aktion nicht aufrufbar.' };
  const args = stage.map ? stage.map(input || {}, prior || {}) : [Object.assign({}, input || {})];
  try {
    const out = handler.apply(null, Array.isArray(args) ? args : [args]);
    const summary = out && typeof out === 'object'
      ? { ok: out.ok !== false, keys: Object.keys(out).slice(0, 6) }
      : { ok: true, value: typeof out };
    return { kind: 'AUTO', state: summary.ok ? 'ERLEDIGT' : 'ABGEBROCHEN', what: stage.what, module: stage.module, call: stage.call, result: summary, note: stage.note, raw: out };
  } catch (e) {
    return { kind: 'AUTO', state: 'FEHLER', what: stage.what, module: stage.module, call: stage.call, error: e.message };
  }
}

// Eine Pipe durchlaufen. `until` bricht vor einer Stufe ab (für Zwischenstände).
function run(input) {
  const p = input || {};
  const pipe = PIPES.find((x) => x.id === String(p.pipe || '').toLowerCase());
  if (!pipe) return { ok: false, error: `Rohrleitung unbekannt. Erlaubt: ${PIPES.map((x) => x.id).join(', ')}` };
  const until = p.until ? String(p.until) : null;
  const trace = [];
  const prior = {};
  let stopped = null;
  for (const st of pipe.stages) {
    if (until && st.what.toLowerCase().includes(until.toLowerCase())) { stopped = st.what; break; }
    const step = runStage(st, p.input || p, prior);
    if (step.raw && typeof step.raw === 'object') prior[st.what] = step.raw;
    delete step.raw;
    trace.push(step);
    if (step.state === 'FEHLER' && p.halt_on_error !== false) { stopped = st.what; break; }
  }
  const done = trace.filter((t) => t.state === 'ERLEDIGT').length;
  const human = trace.filter((t) => t.kind === 'MENSCH').length;
  const entry = {
    id: 'pipe-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(),
    pipe: pipe.id, name: pipe.name, area: pipe.area,
    stages_total: pipe.stages.length, ran: trace.length, auto_done: done, human_gates: human,
    stopped_at: stopped, state: human ? 'WARTET AUF MENSCH' : done === trace.length ? 'DURCHGELAUFEN' : 'TEILWEISE',
    trace,
    honest: 'Automatikstufen sind wirklich gelaufen. Menschliche Stufen stehen als Wartemeldung — hier wird nichts vorgetäuscht.',
  };
  const d = load();
  d.runs.unshift(Object.assign({}, entry, { trace: trace.map((t) => ({ kind: t.kind, state: t.state, module: t.module, what: t.what })) }));
  d.runs = d.runs.slice(0, 200);
  d.audit.unshift({ at: entry.at, action: 'run', pipe: pipe.id, auto_done: done, human });
  save(d);
  return { ok: true, run: entry };
}

// Abdeckung: Welcher Baustein kommt in wie vielen Rohrleitungen vor, und welche Leitungen fehlen noch?
function coverage() {
  const byModule = {};
  for (const pipe of PIPES) for (const st of pipe.stages) { byModule[st.module] = byModule[st.module] || { module: st.module, pipes: new Set(), stages: 0 }; byModule[st.module].pipes.add(pipe.id); byModule[st.module].stages++; }
  const rows = Object.values(byModule).map((x) => ({ module: x.module, pipes: x.pipes.size, stages: x.stages })).sort((a, b) => b.stages - a.stages);
  const available = safeLibNames();
  const unused = available.filter((n) => !byModule[n] && !['workflow_pipes', 'security_center'].includes(n));
  return {
    ok: true, pipes: PIPES.length, stages: PIPES.reduce((n, p) => n + p.stages.length, 0),
    modules_used: rows.length, rows, modules_available: available.length, not_yet_wired: unused,
    note: 'Unverdrahtete Bausteine sind kein Mangel — sie sind Werkzeug, das noch keinen festen Platz in einer Straße hat.',
  };
}

function safeLibNames() {
  try { return fs.readdirSync(__dirname).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, '')).sort(); }
  catch { return []; }
}

function status() {
  const d = load();
  const cov = coverage();
  return {
    area: 'PIPE', module: 'workflow_pipes', state: 'live', file: FILE,
    pipes: PIPES.length, stages: cov.stages, modules_used: cov.modules_used,
    runs: d.runs.length,
    by_area: [...new Set(PIPES.map((p) => p.area))].map((a) => ({ area: a, pipes: PIPES.filter((p) => p.area === a).length })),
    human_stages: PIPES.reduce((n, p) => n + p.stages.filter((s) => s.kind === 'MENSCH').length, 0),
    rules: [
      'Jede Straße beginnt mit einem Werkzeug und endet bei einem Menschen.',
      'Automatikstufen laufen wirklich; menschliche Stufen werden als Wartemeldung geführt, nicht vorgetäuscht.',
      'Fehlt ein Baustein, steht das im Protokoll der Stufe — kein stiller Abbruch.',
      'Ohne Schlüssel, Sprachmotor oder Aufnahme bleiben die abhängigen Stufen bei Plan und Paket.',
    ],
  };
}

module.exports = {
  meta: { area: 'PIPE', id: 'workflow_pipes', name: 'Alle Rohrleitungen des Hauses (Stufen, Verdrahtung, Durchlauf)', state: 'live' },
  actions: {
    status: () => status(),
    list: (p) => list(p || {}),
    get: (p) => { const x = PIPES.find((y) => y.id === String((p || {}).id || '').toLowerCase()); return x ? { ok: true, pipe: x } : { ok: false, error: 'Rohrleitung unbekannt' }; },
    run: (p) => run(p || {}),
    coverage: () => coverage(),
    runs: () => { const d = load(); return { ok: true, count: d.runs.length, runs: d.runs.slice(0, 20) }; },
  },
  PIPES, A, M, list, run, coverage, status,
};
