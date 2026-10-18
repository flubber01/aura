'use strict';
// AURA · Ressourcen-Katalog: brauchbare freie Werkzeuge, Listen und Dokumentationen.
//
// Zweck: die Dinge, die man auf GitHub & Co. wirklich gebrauchen kann, an einer Stelle finden —
// mit Zweck, Lizenz-Hinweis und Kategorie. Es wird NICHTS heruntergeladen und NICHTS automatisch
// installiert: der Katalog ist ein Nachschlagewerk. Aufnahme heißt nicht Einbindung.
//
// Aufnahmeregeln (in Code erzwungen):
//  1. Nur freie/open-source Projekte bzw. frei zugängliche Listen und Dokumentationen.
//  2. Kein Eintrag, der Engagement, Klicks, Views oder Follower verkauft oder Bot-Tarnung anbietet.
//  3. Keine kostenpflichtigen Inhalte hinter Bezahlschranke, kein Scraping fremder Seiten.
//
// Speicher: im Code (kein Runtime-Zustand nötig). Eigene Ergänzungen: backend/src/data/resources.json
const fs = require('fs');
const path = require('path');

const EXTRA_FILE = process.env.AURA_RESOURCES_FILE || path.join(__dirname, '..', 'data', 'resources.json');

// Kategorien: LIST (Sammlungen), AUDIO, VIDEO, IMAGE, TEXT, DEV, SELFHOST, DOCS
const CATALOG = [
  // ---------- Sammlungen / Listen ----------
  { id: 'free-for-dev', name: 'free-for-dev', url: 'https://free-for.dev', repo: 'ripienaar/free-for-dev', cat: 'LIST', purpose: 'Liste kostenloser Developer-Angebote (Hosting, CI, DB, Mail, Monitoring)', license: 'Liste (MIT-artig, siehe Repo)' },
  { id: 'awesome', name: 'Awesome Lists', url: 'https://github.com/sindresorhus/awesome', cat: 'LIST', purpose: 'Sammelstelle thematischer Awesome-Listen', license: 'CC0' },
  { id: 'awesome-selfhosted', name: 'Awesome Selfhosted', url: 'https://github.com/awesome-selfhosted/awesome-selfhosted', cat: 'SELFHOST', purpose: 'selbst hostbare Dienste (Analytics, CMS, Media, Automation)', license: 'CC-BY-SA' },
  { id: 'awesome-nodejs', name: 'Awesome Node.js', url: 'https://github.com/sindresorhus/awesome-nodejs', cat: 'DEV', purpose: 'Node-Pakete und Werkzeuge', license: 'CC0' },
  { id: 'awesome-music', name: 'Awesome Music', url: 'https://github.com/ciconia/awesome-music', cat: 'AUDIO', purpose: 'Musik-Software, Bibliotheken, Notation, Synthese', license: 'Liste' },
  { id: 'awesome-audio', name: 'Awesome Audio', url: 'https://github.com/notthetup/awesome-webaudio', cat: 'AUDIO', purpose: 'Web-Audio-Projekte, Effekte, Synthesizer im Browser', license: 'Liste' },
  { id: 'public-apis', name: 'Public APIs', url: 'https://github.com/public-apis/public-apis', cat: 'DEV', purpose: 'frei nutzbare APIs (mit Auth-Hinweisen)', license: 'MIT' },
  { id: 'build-your-own-x', name: 'Build your own X', url: 'https://github.com/codecrafters-io/build-your-own-x', cat: 'DOCS', purpose: 'selbst bauen: DAW, Datenbank, Compiler, Renderer …', license: 'Liste' },

  // ---------- Audio / Musik ----------
  { id: 'tonejs', name: 'Tone.js', url: 'https://tonejs.github.io', repo: 'Tonejs/Tone.js', cat: 'AUDIO', purpose: 'Web-Audio-Framework: Synthese, Effekte, Sequencer', license: 'MIT' },
  { id: 'howler', name: 'Howler.js', url: 'https://howlerjs.com', repo: 'goldfire/howler.js', cat: 'AUDIO', purpose: 'Wiedergabe im Browser, robust über Formate hinweg', license: 'MIT' },
  { id: 'audiomass', name: 'AudioMass', url: 'https://audiomass.co', repo: 'pkalogiros/AudioMass', cat: 'AUDIO', purpose: 'Waveform-Editor im Browser (Schneiden, Effekte)', license: 'GPL-3.0' },
  { id: 'surge', name: 'Surge XT', url: 'https://surge-synthesizer.github.io', repo: 'surge-synthesizer/surge', cat: 'AUDIO', purpose: 'vollwertiger Hybrid-Synthesizer (VST3/CLAP)', license: 'GPL-3.0' },
  { id: 'vital', name: 'Vital', url: 'https://vital.audio', repo: 'mtytel/vital', cat: 'AUDIO', purpose: 'spektraler Wavetable-Synth (auch als VST)', license: 'GPL-3.0' },
  { id: 'lmms', name: 'LMMS', url: 'https://lmms.io', repo: 'LMMS/lmms', cat: 'AUDIO', purpose: 'komplette freie DAW (Beats, Bassline, Piano-Roll)', license: 'GPL-2.0' },
  { id: 'ardour', name: 'Ardour', url: 'https://ardour.org', repo: 'Ardour/ardour', cat: 'AUDIO', purpose: 'professionelle freie DAW für Aufnahme und Mix', license: 'GPL-2.0' },
  { id: 'audacity', name: 'Audacity', url: 'https://www.audacityteam.org', repo: 'audacity/audacity', cat: 'AUDIO', purpose: 'Audio-Editor, Batch-Verarbeitung', license: 'GPL-2.0' },
  { id: 'ffmpeg-audio', name: 'FFmpeg (Audio)', url: 'https://ffmpeg.org/documentation.html', cat: 'AUDIO', purpose: 'Konvertieren, Normalisieren (loudnorm), Stems schneiden', license: 'LGPL/GPL' },
  { id: 'musicgen', name: 'MusicGen (Meta)', url: 'https://github.com/facebookresearch/audiocraft', cat: 'AUDIO', purpose: 'Musikerzeugung aus Text — selbst hostbar, eigene GPU', license: 'MIT' },
  { id: 'stable-audio', name: 'Stable Audio Tools', url: 'https://github.com/Stability-AI/stable-audio-tools', cat: 'AUDIO', purpose: 'Audio-Modelle selbst betreiben', license: 'MIT' },
  { id: 'demucs', name: 'Demucs', url: 'https://github.com/facebookresearch/demucs', cat: 'AUDIO', purpose: 'Stems trennen (Gesang/Drums/Bass/Rest)', license: 'MIT' },
  { id: 'whisper', name: 'Whisper', url: 'https://github.com/openai/whisper', cat: 'AUDIO', purpose: 'Transkription für Songtexte, Untertitel', license: 'MIT' },

  // ---------- Video / Effekte ----------
  { id: 'ffmpeg', name: 'FFmpeg', url: 'https://ffmpeg.org', repo: 'FFmpeg/FFmpeg', cat: 'VIDEO', purpose: 'Videoschnitt, Effekte, Filtergraphs, Encoding', license: 'LGPL/GPL' },
  { id: 'shotcut', name: 'Shotcut', url: 'https://shotcut.org', repo: 'mltframework/shotcut', cat: 'VIDEO', purpose: 'freier Videoschnitt mit Filtern und Übergängen', license: 'GPL-3.0' },
  { id: 'kdenlive', name: 'Kdenlive', url: 'https://kdenlive.org', repo: 'KDE/kdenlive', cat: 'VIDEO', purpose: 'Schnitt + Effekte + Farbkorrektur', license: 'GPL-2.0' },
  { id: 'obs', name: 'OBS Studio', url: 'https://obsproject.com', repo: 'obsproject/obs-studio', cat: 'VIDEO', purpose: 'Aufnahme und Streaming eigener Kanäle', license: 'GPL-2.0' },
  { id: 'natron', name: 'Natron', url: 'https://natrongithub.github.io', repo: 'NatronGitHub/Natron', cat: 'VIDEO', purpose: 'Compositing und Keying (wie Chroma Key in Nodes)', license: 'GPL-2.0' },
  { id: 'blender', name: 'Blender', url: 'https://www.blender.org', repo: 'blender/blender', cat: 'VIDEO', purpose: '3D, Compositing und Videoschnitt in einem', license: 'GPL-2.0' },
  { id: 'ebur128', name: 'Loudness-Normen (EBU R128)', url: 'https://tech.ebu.ch/loudness', cat: 'VIDEO', purpose: 'Lautheit für Video/Audio nach Rundfunkstandard', license: 'Dokumentation' },

  // ---------- Bild / Grafik ----------
  { id: 'sharp', name: 'sharp', url: 'https://sharp.pixelplumbing.com', repo: 'lovell/sharp', cat: 'IMAGE', purpose: 'Bilder skalieren, zuschneiden, konvertieren (Node)', license: 'Apache-2.0' },
  { id: 'painterly', name: 'Painterly / Kunstfilter', url: 'https://github.com/agermanidis/painterly', cat: 'IMAGE', purpose: 'malerische Bildfilter', license: 'MIT' },
  { id: 'gimp', name: 'GIMP', url: 'https://www.gimp.org', repo: 'GNOME/gimp', cat: 'IMAGE', purpose: 'Bildbearbeitung, Batch-Skripting via Script-Fu', license: 'GPL-3.0' },
  { id: 'krita', name: 'Krita', url: 'https://krita.org', repo: 'KDE/krita', cat: 'IMAGE', purpose: 'digitales Malen, Animations-Storyboards', license: 'GPL-3.0' },
  { id: 'inkscape', name: 'Inkscape', url: 'https://inkscape.org', repo: 'inkscape/inkscape', cat: 'IMAGE', purpose: 'Vektorgrafik für Logos und Layouts', license: 'GPL-3.0' },
  { id: 'svg-repo', name: 'SVG Repo', url: 'https://www.svgrepo.com', cat: 'IMAGE', purpose: 'freie Vektoricons (Lizenz je Icon prüfen)', license: 'gemischt, je Datei' },
  { id: 'stable-diffusion-webui', name: 'Stable Diffusion WebUI', url: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', cat: 'IMAGE', purpose: 'Bilderzeugung selbst gehostet', license: 'AGPL-3.0' },

  // ---------- Text / Schreiben ----------
  { id: 'pandoc', name: 'Pandoc', url: 'https://pandoc.org', repo: 'jgm/pandoc', cat: 'TEXT', purpose: 'Dokumente zwischen Markdown/DOCX/PDF wandeln', license: 'GPL-2.0' },
  { id: 'languagetool', name: 'LanguageTool', url: 'https://languagetool.org', repo: 'languagetool-org/languagetool', cat: 'TEXT', purpose: 'Rechtschreibung/Grammatik selbst hostbar', license: 'LGPL-2.1' },
  { id: 'typst', name: 'Typst', url: 'https://typst.app', repo: 'typst/typst', cat: 'TEXT', purpose: 'moderner Textsatz für PDFs', license: 'Apache-2.0' },

  // ---------- Entwicklung / Betrieb ----------
  { id: 'node', name: 'Node.js', url: 'https://nodejs.org', repo: 'nodejs/node', cat: 'DEV', purpose: 'Laufzeitumgebung (AURA nutzt nur Bordmittel)', license: 'MIT' },
  { id: 'sqlite', name: 'SQLite', url: 'https://sqlite.org', cat: 'DEV', purpose: 'lokale Datenbank ohne Server', license: 'Public Domain' },
  { id: 'duckdb', name: 'DuckDB', url: 'https://duckdb.org', repo: 'duckdb/duckdb', cat: 'DEV', purpose: 'Auswertung großer Tabellen lokal', license: 'MIT' },
  { id: 'n8n', name: 'n8n', url: 'https://n8n.io', repo: 'n8n-io/n8n', cat: 'SELFHOST', purpose: 'selbst gehostete Workflow-Automation', license: 'Sustainable Use' },
  { id: 'matomo', name: 'Matomo', url: 'https://matomo.org', repo: 'matomo-org/matomo', cat: 'SELFHOST', purpose: 'eigene Web-Statistik, DSGVO-freundlich', license: 'GPL-3.0' },
  { id: 'plausible', name: 'Plausible', url: 'https://plausible.io', repo: 'plausible/analytics', cat: 'SELFHOST', purpose: 'schlanke, datensparsame Web-Statistik', license: 'AGPL-3.0' },
  { id: 'umami', name: 'Umami', url: 'https://umami.is', repo: 'umami-software/umami', cat: 'SELFHOST', purpose: 'leichtgewichtige Analytics-Alternative', license: 'MIT' },
  { id: 'n8n-ffmpeg', name: 'FFmpeg-Batch-Skripte', url: 'https://trac.ffmpeg.org/wiki', cat: 'DEV', purpose: 'Stapelverarbeitung von Medien', license: 'Wiki' },

  // ---------- Dokumentation / Lernen ----------
  { id: 'mdn', name: 'MDN Web Docs', url: 'https://developer.mozilla.org', cat: 'DOCS', purpose: 'Webstandard-Nachschlagewerk', license: 'CC-BY-SA' },
  { id: 'web-audio-spec', name: 'Web Audio API Spec', url: 'https://www.w3.org/TR/webaudio/', cat: 'DOCS', purpose: 'Referenz für Browser-Audio', license: 'W3C' },
  { id: 'ffmpeg-filters', name: 'FFmpeg Filter-Doku', url: 'https://ffmpeg.org/ffmpeg-filters.html', cat: 'DOCS', purpose: 'alle Filter mit Parametern (Grundlage der Effekt-Ketten)', license: 'Dokumentation' },
  { id: 'ebur128-doc', name: 'Loudness richtig messen', url: 'https://ffmpeg.org/ffmpeg-filters.html#loudnorm', cat: 'DOCS', purpose: 'loudnorm-Parameter verstehen', license: 'Dokumentation' },
  { id: 'creative-commons', name: 'Creative Commons', url: 'https://creativecommons.org/licenses/', cat: 'DOCS', purpose: 'Lizenzen für eigene Veröffentlichungen verstehen', license: 'CC' },
  { id: 'gema-musik', name: 'GEMA — Werk anmelden', url: 'https://www.gema.de', cat: 'DOCS', purpose: 'Rechteklärung für eigene Veröffentlichungen', license: 'Information' },
];

// Ablehnungsregeln (dieselbe Linie wie überall im Projekt)
const VERBOTEN = ['follower', 'likes', 'views kaufen', 'streams kaufen', 'watchtime', 'smm panel', 'smmpanel',
  'clickbot', 'bot-detection-bypass', 'fingerprint-spoof', 'antidetect', 'account-generator'];

function all() { return CATALOG.slice(); }

function list(filter) {
  const f = filter || {};
  let items = CATALOG.slice();
  if (f.cat) items = items.filter((i) => i.cat === String(f.cat).toUpperCase());
  if (f.q) { const q = String(f.q).toLowerCase(); items = items.filter((i) => (i.name + ' ' + i.purpose + ' ' + (i.repo || '')).toLowerCase().includes(q)); }
  let extra = [];
  try { if (fs.existsSync(EXTRA_FILE)) { const raw = JSON.parse(fs.readFileSync(EXTRA_FILE, 'utf8')); if (Array.isArray(raw && raw.items)) extra = raw.items; } } catch { /* egal */ }
  for (const e of extra) if (e && e.id && e.name && e.url && e.cat) items.push(e);
  return {
    ok: true, area: 'RESOURCES', mode: 'KATALOG',
    counts: { total: items.length, builtin: CATALOG.length, extra: extra.length },
    categories: [...new Set(items.map((i) => i.cat))],
    items: items.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name)),
    note: 'Nachschlagewerk. Aufnahme bedeutet NICHT, dass etwas installiert oder eingebunden ist. Lizenzen vor Nutzung selbst prüfen.',
  };
}

// Prüft einen vorgeschlagenen Eintrag gegen die Aufnahmeregeln.
function assess(nameOrUrl) {
  const s = String(nameOrUrl || '').toLowerCase();
  const hit = VERBOTEN.find((v) => s.includes(v));
  if (hit) {
    return { ok: false, allowed: false, code: 403, reason: 'Eintrag passt nicht zu den Aufnahmeregeln (Treffer: „' + hit + '")',
      detail: 'Werkzeuge für Engagement-Kauf, Bot-Tarnung oder Konto-Erzeugung werden nicht aufgenommen — auch nicht als reiner Link.' };
  }
  return { ok: true, allowed: true, note: 'Kein Ausschlussgrund erkannt. Aufnahme prüft zusätzlich Lizenz und Zweck.' };
}

function status() {
  const l = list();
  const byCat = {};
  for (const i of l.items) byCat[i.cat] = (byCat[i.cat] || 0) + 1;
  return {
    area: 'RESOURCES', mode: 'KATALOG', total: l.counts.total,
    by_category: byCat,
    rules: ['nur freie/quelloffene Projekte bzw. frei zugängliche Listen', 'kein Engagement-Verkauf, keine Bot-Tarnung', 'keine Bezahlschranken, kein Scraping'],
    note: 'Der Katalog lädt nichts herunter und installiert nichts.',
  };
}

module.exports = { CATALOG, VERBOTEN, EXTRA_FILE, all, list, assess, status };
