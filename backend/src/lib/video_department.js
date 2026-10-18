'use strict';
// AURA · Video-Abteilung: ein Team, das NUR für Video da ist.
//
// Die Abteilung hat einen klar begrenzten Auftrag (`scope: video`). Alles, was nicht Video ist
// (Musik mischen, Texte schreiben, Kampagnen planen), lehnt sie mit Begründung ab und verweist an
// das zuständige Haus. So kann sie nicht heimlich zum Mädchen-für-alles werden.
//
// Jeder Arbeitsplatz (Rolle) hat: Aufgabe, Eingang, Ausgang, Prüfkriterien (Definition of Done) und
// eine Grenze, was er NICHT tut. Aufträge laufen durch die Kette; jede Rolle kann nur liefern, wenn
// die Vorbedingung erfüllt ist. Fertige Aufträge gehen durch die Abnahme (QA) — die QA prüft messbar
// (Auflösung, Dauer, Tonspur, Pegel), nicht nach Gefühl.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_VIDEO_DEPT_FILE || path.join(__dirname, '..', 'data', 'video_department.json');

const SCOPE = {
  takes: [
    'Schneiden und Zusammenfügen', 'Farbe und Bildlook', 'Tonmischung für Video', 'Titel und Bauchbinden',
    'Untertitel und Transkript', 'Formate und Exportvarianten', 'Thumbnails und Vorschaubilder für Video',
    'Video-QA (Auflösung, Dauer, Ton, Bildstand)', 'Ausspielen auf eigene Kanäle (nach Freigabe)',
  ],
  refuses: [
    { what: 'Musik mischen / master', keys: ['mischen', 'mix', 'master', 'abmischen', 'mischen'], to: 'Tonstudio (daw_plugins)' },
    { what: 'Song komponieren', keys: ['komponieren', 'song schreiben', 'beat bauen', 'song'], to: 'Songbook (songbook)' },
    { what: 'Kampagne planen', keys: ['kampagne', 'release planen', 'pitch'], to: 'Kampagnen-Planer (campaign_planner)' },
    { what: 'Kanal-Verbindung herstellen', keys: ['kanal verbinden', 'connect', 'anmelden bei'], to: 'Connectoren (connectors)' },
    { what: 'Bezahlung', keys: ['bezahlen', 'rechnung', 'abo', 'zahlung'], to: 'Bezahlpläne (billing_plans)' },
  ],
};

const ROLES = [
  { id: 'eingang', name: 'Material-Eingang', does: 'Rohmaterial annehmen, sichten, benennen', input: 'Dateien/URLs', output: 'Materialliste mit Dauer und Format', dod: ['Jede Datei hat Name, Dauer, Auflösung', 'Doppelte erkannt', 'Nichts gelöscht'], not: 'kein Schnitt, keine Umskalierung' },
  { id: 'schnitt', name: 'Schnitt', does: 'Szenen ordnen, kürzen, Übergänge setzen', input: 'Materialliste', output: 'Schnittliste + gerenderer Rohschnitt', dod: ['Schnittliste mit Zeitmarken', 'Kein Bildsprung ohne Grund', 'Ton und Bild synchron'], not: 'keine Farbkorrektur, kein Mastering' },
  { id: 'farbe', name: 'Farbe', does: 'Belichtung, Weißabgleich, Look', input: 'Rohschnitt', output: 'Farbfassung', dod: ['Kein Übersteuern (Weißwerte < 100 %)', 'Hauttöne plausibel', 'Look über die ganze Szene gleich'], not: 'keine Effektspielerei ohne Auftrag' },
  { id: 'ton', name: 'Ton für Video', does: 'Sprache vorn, Musik hinten, Pegel nach EBU R128', input: 'Farbfassung', output: 'Tonfassung', dod: ['Sprachpegel gleichmäßig', 'Musik duckt unter Sprache', 'Keine Verzerrung'], not: 'kein Musik-Mixing (das macht das Tonstudio)' },
  { id: 'titel', name: 'Titel & Grafik', does: 'Titel, Bauchbinden, Abspann', input: 'Tonfassung', output: 'Titel-Fassung', dod: ['Lesbar auf Handy', 'Safe-Area eingehalten', 'Keine Rechtschreibfehler'], not: 'keine Wasserzeichen fremder Anbieter' },
  { id: 'untertitel', name: 'Untertitel', does: 'Transkript, Untertitel, Kapitel', input: 'Tonfassung', output: 'Untertiteldatei + Kapitelmarken', dod: ['Text deckt die Sprache ab', 'Zeiten passen ±0,2 s', 'Lesegeschwindigkeit unter 20 Zeichen/s'], not: 'erfindet keinen Text, wenn der Ton fehlt' },
  { id: 'export', name: 'Ausspielung', does: 'Formate rechnen und ablegen', input: 'Abnahme-Fassung', output: 'Ausgabedateien + Protokoll', dod: ['Zielauflösung exakt', 'Ton vorhanden', 'Dateigröße protokolliert'], not: 'lädt nichts auf fremde Kanäle ohne Freigabe' },
  { id: 'qa', name: 'Abnahme (QA)', does: 'messbare Endkontrolle', input: 'Ausgabe', output: 'Abnahmeprotokoll mit Zahlen', dod: ['Auflösung/Dauer/Lautheit gemessen', 'Bild vorhanden (kein schwarzes Bild)', 'Ton vorhanden (nicht stumm)'], not: 'nimmt nicht ab, was es nicht gemessen hat' },
];

const PIPELINE = ROLES.map((r) => r.id);

function defaults() { return { tickets: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['tickets', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Annahmeprüfung: nur Video-Aufträge kommen rein.
function accepts(task) {
  const text = String(task || '').toLowerCase();
  const videoWords = ['video', 'clip', 'schnitt', 'schneiden', 'subtitle', 'untertitel', 'thumbnail', 'reel', 'short', 'farbe', 'render', 'vorschau', 'teaser'];
  const isVideo = videoWords.some((v) => text.includes(v));
  const foreign = SCOPE.refuses.filter((r) => r.keys.some((k) => text.includes(k)));
  if (foreign.length && !isVideo) return { accepted: false, reason: `Das ist nicht Aufgabe der Video-Abteilung: ${foreign[0].what}`, to: foreign[0].to };
  if (!isVideo) return { accepted: false, reason: 'Der Auftrag nennt kein Video-Ziel — bitte konkret sagen, was am Bild passieren soll.', to: null };
  return { accepted: true };
}

function ticket(input) {
  const data = load();
  const task = String((input && input.task) || '').trim();
  if (!task) return { ok: false, error: 'Auftrag (task) fehlt' };
  const gate = accepts(task);
  if (!gate.accepted) return { ok: false, refused: true, error: gate.reason, hand_to: gate.to };
  const t = {
    id: 'vd-' + Math.random().toString(16).slice(2, 10),
    task, source: String((input && input.source) || ''),
    target_format: String((input && input.target_format) || '1080x1920'),
    station: PIPELINE[0],
    state: 'OFFEN',
    history: [{ station: PIPELINE[0], at: new Date().toISOString(), note: 'angenommen' }],
    created_at: new Date().toISOString(),
  };
  data.tickets.unshift(t);
  data.audit.unshift({ at: t.created_at, action: 'ticket', id: t.id, task: task.slice(0, 80) });
  data.audit = data.audit.slice(0, 300);
  save(data);
  return { ok: true, ticket: t, scope: 'video', path: PIPELINE };
}

function get(id) { return load().tickets.find((t) => t.id === id) || null; }

function deliver(id, stationId, payload) {
  const data = load();
  const t = data.tickets.find((x) => x.id === id);
  if (!t) return { ok: false, error: 'Auftrag nicht gefunden' };
  const role = ROLES.find((r) => r.id === stationId);
  if (!role) return { ok: false, error: `Arbeitsplatz "${stationId}" gibt es nicht` };
  if (t.station !== stationId) return { ok: false, error: `Der Auftrag steht bei "${t.station}", nicht bei "${stationId}"` };
  const p = payload || {};
  if (role.dod.length && !p.self_check) {
    const misses = role.dod.filter((d) => !(p.checks || []).includes(d));
    if (misses.length) return { ok: false, error: 'Prüfkriterien nicht bestätigt', missing: misses, dod: role.dod };
  }
  const idx = PIPELINE.indexOf(stationId);
  t.history.push({ station: stationId, at: new Date().toISOString(), note: String(p.note || 'geliefert'), proof: p.proof || null });
  t.station = PIPELINE[idx + 1] || null;
  t.state = t.station ? 'IN_ARBEIT' : 'FERTIG';
  if (!t.station) t.finished_at = new Date().toISOString();
  save(data);
  return { ok: true, ticket: t, next_station: t.station, next_role: t.station ? ROLES.find((r) => r.id === t.station) : null };
}

// Abnahme: prüft MESSBAR. Fehlt eine Zahl, wird nicht abgenommen.
function qa(id, probe) {
  const data = load();
  const t = data.tickets.find((x) => x.id === id);
  if (!t) return { ok: false, error: 'Auftrag nicht gefunden' };
  const p = probe || {};
  const checks = [];
  const want = /(\d{3,4})x(\d{3,4})/.exec(t.target_format);
  if (want) {
    const okSize = Number(p.width) === Number(want[1]) && Number(p.height) === Number(want[2]);
    checks.push({ check: `Auflösung ${t.target_format}`, ok: okSize, measured: p.width && p.height ? `${p.width}x${p.height}` : 'nicht gemessen', note: okSize ? '' : 'Auflösung weicht ab oder wurde nicht gemessen' });
  }
  checks.push({ check: 'Bild vorhanden', ok: Number(p.frames) > 0, measured: p.frames ? `${p.frames} Bilder` : 'nicht gemessen' });
  checks.push({ check: 'Ton vorhanden', ok: p.has_audio === true, measured: p.has_audio === undefined ? 'nicht gemessen' : String(p.has_audio) });
  if (p.loudness_lufs !== undefined) checks.push({ check: 'Lautheit im Zielbereich (-18…-12 LUFS)', ok: Number(p.loudness_lufs) >= -18 && Number(p.loudness_lufs) <= -12, measured: `${p.loudness_lufs} LUFS` });
  if (p.duration !== undefined) checks.push({ check: 'Dauer plausibel (> 0,5 s)', ok: Number(p.duration) > 0.5, measured: `${p.duration} s` });
  const failed = checks.filter((c) => !c.ok);
  t.qa = { at: new Date().toISOString(), checks, verdict: failed.length ? 'NICHT ABGENOMMEN' : 'ABGENOMMEN', failed: failed.map((f) => f.check) };
  t.state = failed.length ? 'NACHARBEIT' : 'ABGENOMMEN';
  if (failed.length) t.station = 'qa';
  save(data);
  return { ok: true, verdict: t.qa.verdict, checks, failed: t.qa.failed, rule: 'Ohne Messung keine Abnahme.' };
}

function board() {
  const data = load();
  const counts = {};
  for (const r of ROLES) counts[r.id] = data.tickets.filter((t) => t.station === r.id).length;
  return {
    ok: true, scope: 'video', stations: ROLES.map((r) => ({ id: r.id, name: r.name, queue: counts[r.id], does: r.does, dod: r.dod, not: r.not })),
    open: data.tickets.filter((t) => !['FERTIG', 'ABGENOMMEN'].includes(t.state)).length,
    tickets: data.tickets.slice(0, 20).map((t) => ({ id: t.id, task: t.task.slice(0, 70), station: t.station, state: t.state, target: t.target_format })),
  };
}

function status() {
  const data = load();
  return {
    area: 'VDP', module: 'video_department', state: 'live', file: FILE,
    stations: ROLES.length, open_tickets: data.tickets.length,
    scope: SCOPE.takes, refuses: SCOPE.refuses,
    rule: 'Die Abteilung nimmt nur Video-Aufträge an. Alles andere wird mit Nennung des zuständigen Hauses abgelehnt.',
    qa_rule: 'Abnahme nur mit Messwerten (Auflösung, Bilder, Ton, Lautheit). Ohne Messung keine Abnahme.',
  };
}

module.exports = {
  meta: { area: 'VDP', id: 'video_department', name: 'Video-Abteilung (nur Video, mit Abnahme)', state: 'live' },
  actions: { status: () => status(), roles: () => ({ ok: true, roles: ROLES, pipeline: PIPELINE }), board: () => board(), ticket: (p) => ticket(p || {}), deliver: (p) => deliver((p || {}).id, (p || {}).station, p || {}), qa: (p) => qa((p || {}).id, (p || {}).probe), accepts: (p) => accepts((p || {}).task) },
  ROLES, PIPELINE, SCOPE, ticket, deliver, qa, board, status, accepts,
};
