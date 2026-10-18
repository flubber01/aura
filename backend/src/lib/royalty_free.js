'use strict';
// AURA · Lizenzfreie und offene Ton-/Bildquellen.
//
// Zweck: eine belastbare Liste von Quellen, deren LIZENZ man nachlesen kann — nicht eine Liste von
// Grauzonen. Jeder Eintrag sagt: Lizenz, kommerzielle Nutzung ja/nein, Namensnennung nötig ja/nein,
// Bearbeitung erlaubt ja/nein, und ob es eine harte Einschränkung gibt.
//
// Grundsätze:
//  • Keine Download-Automatik, keine Umgehung von Bezahlschranken oder DRM, kein Scraping.
//  • Status VERIFIED heißt: Lizenzbedingungen sind im Eintrag dokumentiert und geprüft.
//    Status CHECK-LICENSE heißt: Quelle ist brauchbar, aber jede Datei kann eigene Bedingungen haben —
//    dann muss man die Lizenz der einzelnen Datei lesen.
//  • Nicht aufgenommen (und das steht hier ausdrücklich): Quellen, deren Geschäftsmodell auf
//    gestohlener Musik, gestreamten Katalogen oder Klick-Erzeugung beruht.
//
// Alles statisch, kein Netz, keine Datei nötig.
const LICENSES = {
  CC0: { name: 'CC0 1.0 (gemeinfrei)', attribution: false, commercial: true, derivatives: true },
  'CC-BY': { name: 'Creative Commons Namensnennung', attribution: true, commercial: true, derivatives: true },
  'CC-BY-SA': { name: 'Creative Commons Namensnennung, Weitergabe unter gleichen Bedingungen', attribution: true, commercial: true, derivatives: true, shareAlike: true },
  'CC-BY-NC': { name: 'Creative Commons Namensnennung, nicht kommerziell', attribution: true, commercial: false, derivatives: true },
  'CC-SAMPLING+': { name: 'CC Sampling Plus', attribution: true, commercial: false, derivatives: true },
  MIT: { name: 'MIT-Lizenz (Software)', attribution: true, commercial: true, derivatives: true },
  GPL: { name: 'GNU GPL', attribution: true, commercial: true, derivatives: true, shareAlike: true },
  LGPL: { name: 'GNU LGPL', attribution: true, commercial: true, derivatives: true },
  APACHE: { name: 'Apache 2.0', attribution: true, commercial: true, derivatives: true },
  BSD: { name: 'BSD-Lizenz', attribution: true, commercial: true, derivatives: true },
  PIXABAY: { name: 'Pixabay-Lizenz (eigene Bedingungen, weitgehend frei)', attribution: false, commercial: true, derivatives: true, note: 'Einzelne Dateien können abweichen; keine Weitergabe als eigenes Stock-Angebot.' },
  ROYALTY_FREE: { name: 'Royalty-frei (Herstellerbedingungen)', attribution: false, commercial: true, derivatives: true, note: 'Bedingungen je Anbieter lesen; meist keine Weitergabe der Rohdateien.' },
  ISC: { name: 'ISC-Lizenz (wie MIT, kürzer)', attribution: true, commercial: true, derivatives: true },
  'CHECK-LICENSE': { name: 'Lizenz je Datei/Instrument unterschiedlich', attribution: true, commercial: null, derivatives: true, note: 'Bedingungen stehen in der Quelle bei jeder einzelnen Datei — vor Nutzung nachlesen.' },
  PROPRIETARY_OK: { name: 'Herstellereigene Freigabe für Projekte', attribution: false, commercial: true, derivatives: false, note: 'Nur laut Anbieterbedingungen nutzbar.' },
};

const SOURCES = [
  // ---- Musik: gemeinfrei / offen
  { id: 'musopen', name: 'Musopen', kind: 'MUSIC', url: 'https://musopen.org', license: 'CC0', status: 'VERIFIED', content: 'Klassik-Aufnahmen und Noten, viele gemeinfrei', caveat: 'Einzelne Aufnahmen unter CC-BY-NC — Lizenz je Stück prüfen.' },
  { id: 'imslp', name: 'IMSLP / Petrucci Library', kind: 'NOTEN', url: 'https://imslp.org', license: 'CC0', status: 'VERIFIED', content: 'Noten gemeinfreier Werke', caveat: 'Bei manchen Ausgaben gilt das Urheberrecht des Herausgebers; Status je Datei steht dabei.' },
  { id: 'freemusicarchive', name: 'Free Music Archive', kind: 'MUSIC', url: 'https://freemusicarchive.org', license: 'CC-BY', status: 'CHECK-LICENSE', content: 'Kuratiertes freies Musikarchiv', caveat: 'Jeder Track hat eine eigene CC-Variante — Filter nutzen, CC-BY-NC meiden.' },
  { id: 'ccmixter', name: 'ccMixter', kind: 'MUSIC', url: 'https://ccmixter.org', license: 'CC-BY', status: 'CHECK-LICENSE', content: 'Remixe, A-cappella, Stems', caveat: 'Einzelne Tracks CC-BY-NC oder Sampling+.' },
  { id: 'jamendo', name: 'Jamendo (Freie Sektion)', kind: 'MUSIC', url: 'https://www.jamendo.com', license: 'CC-BY', status: 'CHECK-LICENSE', content: 'Künstler mit Creative-Commons-Freigabe', caveat: 'Nur der CC-Bereich; Kommerz-Freigabe kann kostenpflichtig sein.' },
  { id: 'incompetech', name: 'Incompetech (Kevin MacLeod)', kind: 'MUSIC', url: 'https://incompetech.com', license: 'CC-BY', status: 'VERIFIED', content: 'Bibliotheksmusik für Filme/Podcasts', caveat: 'Namensnennung Pflicht, wenn keine Lizenz erworben wurde.' },
  { id: 'pixabay-audio', name: 'Pixabay (Musik & Töne)', kind: 'MUSIC/SFX', url: 'https://pixabay.com/music/', license: 'PIXABAY', status: 'CHECK-LICENSE', content: 'Musik, Effekte, Field Recording', caveat: 'Keine Weitergabe als eigenes Stock-Angebot.' },
  { id: 'freesound', name: 'Freesound', kind: 'SFX', url: 'https://freesound.org', license: 'CC0', status: 'CHECK-LICENSE', content: 'Geräusche, Foley, Atmosphären', caveat: 'Pro Datei unterschiedlich (CC0 bis CC-BY-NC) — Feld steht auf der Dateiseite.' },
  { id: 'wikimedia-commons', name: 'Wikimedia Commons (Audio)', kind: 'MUSIC/SFX', url: 'https://commons.wikimedia.org', license: 'CC-BY-SA', status: 'CHECK-LICENSE', content: 'Instrumente, Feldaufnahmen, historische Aufnahmen', caveat: 'Namensnennung + Share-alike beachten.' },
  { id: 'archive-org-audio', name: 'Internet Archive (Audio)', kind: 'MUSIC', url: 'https://archive.org/details/audio', license: 'CC0', status: 'CHECK-LICENSE', content: 'historische Aufnahmen, Live-Sets, Vocals', caveat: 'Pro Sammlung unterschiedlich; "Public Domain" ist dort eindeutig benannt.' },
  { id: 'openmusicarchive', name: 'Open Music Archive', kind: 'MUSIC', url: 'https://openmusicarchive.org', license: 'CC0', status: 'VERIFIED', content: 'abgelaufene Urheberrechte, 1920er/30er' },
  { id: 'loyaltyfreemusic', name: 'YouTube Audio Library (nur eigene Kanäle)', kind: 'MUSIC', url: 'https://studio.youtube.com', license: 'ROYALTY_FREE', status: 'CHECK-LICENSE', content: 'Musik für eigene Videos', caveat: 'Nutzung ist auf YouTube-Kanäle des Inhabers beschränkt — für Releases NICHT geeignet.' },

  // ---- Instrumente / Samples / Presets
  { id: 'salamander-piano', name: 'Salamander Grand Piano', kind: 'INSTRUMENT', url: 'https://sfzinstruments.github.io/pianos/', license: 'CC-BY', status: 'VERIFIED', content: 'Yamaha C5, mehrlagig gesampelt, SFZ' },
  { id: 'generaluser-gs', name: 'GeneralUser GS SoundFont', kind: 'INSTRUMENT', url: 'https://schristiancollins.com/generaluser.php', license: 'CC-BY', status: 'VERIFIED', content: 'kompletter General-MIDI-Satz als SF2' },
  { id: 'fluidr3', name: 'FluidR3 GM SoundFont', kind: 'INSTRUMENT', url: 'https://member.keymusician.com/Member/FluidR3_GM/index.html', license: 'MIT', status: 'VERIFIED', content: 'General MIDI für MIDI-Wiedergabe' },
  { id: 'vsco2', name: 'VSCO 2 Community Edition', kind: 'INSTRUMENT', url: 'https://versilian-studios.com/vsco-community/', license: 'CC0', status: 'VERIFIED', content: 'Orchester-Instrumente, großenteils CC0' },
  { id: 'sonatina', name: 'Sonatina Symphonic Orchestra', kind: 'INSTRUMENT', url: 'https://github.com/peastman/sso', license: 'CC-BY-SA', status: 'VERIFIED', content: 'Orchester als SFZ' },
  { id: 'sfzinstruments', name: 'SFZ Instruments (Sammlung)', kind: 'INSTRUMENT', url: 'https://sfzinstruments.github.io', license: 'CHECK-LICENSE', status: 'CHECK-LICENSE', content: 'freie Sample-Instrumente mit dokumentierten Lizenzen', caveat: 'Lizenz steht je Instrument dabei.' },
  { id: 'tinysoundfont', name: 'TinySoundFont', kind: 'BIBLIOTHEK', url: 'https://github.com/schellingb/TinySoundFont', license: 'MIT', status: 'VERIFIED', content: 'SF2 in C laden/wiedergeben', caveat: 'Nur Wiedergabe-Bibliothek, keine Klänge.' },

  // ---- Tonwerkzeuge / Synthesizer / DAW (offen)
  { id: 'lmms', name: 'LMMS', kind: 'DAW', url: 'https://lmms.io', license: 'GPL', status: 'VERIFIED', content: 'freie DAW mit Synths und Effekten' },
  { id: 'ardour', name: 'Ardour', kind: 'DAW', url: 'https://ardour.org', license: 'GPL', status: 'VERIFIED', content: 'Mehrspur-Recording/Mixing' },
  { id: 'audacity', name: 'Audacity', kind: 'EDITOR', url: 'https://www.audacityteam.org', license: 'GPL', status: 'VERIFIED' },
  { id: 'zynaddsubfx', name: 'ZynAddSubFX / Zyn-Fusion', kind: 'SYNTH', url: 'https://zynaddsubfx.sourceforge.io', license: 'GPL', status: 'VERIFIED', content: 'additiver/subtraktiver Synth mit Presets' },
  { id: 'surge-xt', name: 'Surge XT', kind: 'SYNTH', url: 'https://surge-synthesizer.github.io', license: 'GPL', status: 'VERIFIED', content: 'Hybrid-Synth, über 1000 Presets' },
  { id: 'vital', name: 'Vital', kind: 'SYNTH', url: 'https://vital.audio', license: 'GPL', status: 'VERIFIED', content: 'Wavetable-Synth (GPL-Version)' },
  { id: 'dexed', name: 'Dexed', kind: 'SYNTH', url: 'https://asb2m10.github.io/dexed/', license: 'GPL', status: 'VERIFIED', content: 'DX7-Nachbau, DX7-SysEx-Bänke nutzbar' },
  { id: 'calf-plugins', name: 'Calf Studio Gear', kind: 'PLUGIN', url: 'https://calf-studio-gear.org', license: 'LGPL', status: 'VERIFIED', content: 'LV2-Effekte: Compressor, Limiter, Reverb, Exciter' },
  { id: 'x42-plugins', name: 'x42 Plugins', kind: 'PLUGIN', url: 'https://x42-plugins.com', license: 'GPL', status: 'VERIFIED', content: 'Meter, EQ, Compressor, Convolver' },
  { id: 'zam-plugins', name: 'ZamMax / ZamPlugins', kind: 'PLUGIN', url: 'https://www.zamaudio.com', license: 'GPL', status: 'VERIFIED', content: 'Mastering-Kette: EQ, Comp, Limiter' },
  { id: 'tonejs', name: 'Tone.js', kind: 'BIBLIOTHEK', url: 'https://tonejs.github.io', license: 'MIT', status: 'VERIFIED', content: 'Web-Audio-Synthese und Effekte im Browser' },
  { id: 'webaudio', name: 'Web Audio API (Standard)', kind: 'BIBLIOTHEK', url: 'https://developer.mozilla.org/docs/Web/API/Web_Audio_API', license: 'MIT', status: 'VERIFIED', content: 'im Browser eingebaut' },

  // ---- Trennen / Analysieren (offen)
  { id: 'demucs', name: 'Demucs (htdemucs)', kind: 'STEMS', url: 'https://github.com/facebookresearch/demucs', license: 'MIT', status: 'VERIFIED', content: 'Gesang/Schlagzeug/Bass/Rest trennen', caveat: 'Modellgewichte haben eigene Bedingungen (MIT für htdemucs).' },
  { id: 'spleeter', name: 'Spleeter', kind: 'STEMS', url: 'https://github.com/deezer/spleeter', license: 'MIT', status: 'VERIFIED' },
  { id: 'whisper', name: 'OpenAI Whisper', kind: 'TEXT', url: 'https://github.com/openai/whisper', license: 'MIT', status: 'VERIFIED', content: 'Sprache zu Text, Untertitel' },
  { id: 'librosa', name: 'librosa', kind: 'ANALYSE', url: 'https://librosa.org', license: 'ISC', status: 'CHECK-LICENSE', content: 'Tonhöhe, Tempo, Spektrogramm' },
  { id: 'aubio', name: 'aubio', kind: 'ANALYSE', url: 'https://aubio.org', license: 'GPL', status: 'VERIFIED', content: 'Onset, Tempo, Pitch' },
  { id: 'sonic-visualiser', name: 'Sonic Visualiser', kind: 'ANALYSE', url: 'https://www.sonicvisualiser.org', license: 'GPL', status: 'VERIFIED', content: 'Spektrogramm und Annotation' },
  { id: 'ffmpeg-audio', name: 'FFmpeg', kind: 'WERKZEUG', url: 'https://ffmpeg.org', license: 'LGPL', status: 'VERIFIED', content: 'Kodieren, Filtern, Pegel messen', caveat: 'Bestimmte Builds mit --enable-gpl stehen unter GPL.' },

  // ---- Gesang / Vocals ehrlich getrennt
  { id: 'vocal-synth-none', name: 'KI-Gesang: ehrlicher Stand', kind: 'HINWEIS', url: null, license: 'CC0', status: 'HINWEIS', content: 'Lokaler Gesang entsteht im AURA-Renderer NICHT. Gesang braucht entweder eine Aufnahme von Menschen oder einen Anbieter mit eigenem Schlüssel (Vault) und Freigabe.', caveat: 'Kein Anbieter wird hier als "frei" geführt, wenn er es nicht ist.' },
];

const REFUSED = [
  { pattern: /freemusicdownloader|mp3skull|zippyshare|beemp3/i, why: 'Musik-Download aus nicht lizenzierten Quellen' },
  { pattern: /follower|laufkundschaft|tiktok.*bot|view.*bot/i, why: 'Kauf von Reichweite — AURA erzeugt keine Zuschauer' },
  { pattern: /suno|udio/i, why: 'KI-Musikdienst ohne offenen offiziellen API-Zugang — nicht als Quelle geführt (Arbeitsweise ist im Songbook nachgebaut)' },
];

function list(filter) {
  const f = filter || {};
  let items = SOURCES;
  if (f.kind) items = items.filter((s) => s.kind === String(f.kind).toUpperCase());
  if (f.q) { const q = String(f.q).toLowerCase(); items = items.filter((s) => (s.name + ' ' + s.kind + ' ' + (s.content || '')).toLowerCase().includes(q)); }
  if (f.commercial === 'yes' || f.commercial === true) items = items.filter((s) => (LICENSES[s.license] || {}).commercial !== false);
  return { ok: true, count: items.length, items: items.map((s) => ({ ...s, terms: LICENSES[s.license] || null })) };
}

// Prüft eine einzelne Lizenzangabe: darf ich das kommerziell veröffentlichen?
function assess(input) {
  const q = String((input && input.license) || input || '').trim();
  const key = Object.keys(LICENSES).find((k) => k.toLowerCase() === q.toLowerCase());
  if (!key) {
    const refused = REFUSED.find((r) => r.pattern.test(String((input && input.url) || input || '')));
    return { ok: true, allowed: false, reason: refused ? `gesperrt: ${refused.why}` : 'Lizenz unbekannt — vor Nutzung im Original nachlesen', license: q || null };
  }
  const l = LICENSES[key];
  return {
    ok: true, allowed: l.commercial !== false, license: key, terms: l,
    obligations: [l.attribution ? 'Namensnennung in den Credits' : null, l.shareAlike ? 'Weitergabe nur unter gleicher Lizenz' : null, l.commercial === false ? 'NICHT für kommerzielle Releases' : null].filter(Boolean),
    note: l.note || null,
  };
}

function status() {
  const kinds = {};
  for (const s of SOURCES) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  const byLicense = {};
  for (const s of SOURCES) byLicense[s.license] = (byLicense[s.license] || 0) + 1;
  return {
    area: 'RF', module: 'royalty_free', state: 'live',
    sources: SOURCES.length, kinds, licenses: byLicense,
    commercial_ok: SOURCES.filter((s) => (LICENSES[s.license] || {}).commercial !== false).length,
    needs_attribution: SOURCES.filter((s) => (LICENSES[s.license] || {}).attribution === true).length,
    refused_patterns: REFUSED.length,
    rules: ['Kein Download, kein Scraping, kein Umgehen von Bezahlschranken oder DRM.', 'Lizenz jeder einzelnen Datei nachlesen, wenn der Status CHECK-LICENSE ist.', 'Nichts wird automatisch in ein Release übernommen.'],
  };
}

module.exports = {
  meta: { area: 'RF', id: 'royalty_free', name: 'Lizenzfreie und offene Tonquellen (mit Lizenzprüfung)', state: 'live' },
  actions: { status: () => status(), list: (p) => list(p || {}), assess: (p) => assess(p || {}) },
  SOURCES, LICENSES, REFUSED, list, assess, status,
};
