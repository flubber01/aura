'use strict';
// AURA · Kamera-Regie — alles, was Kamera, Schnitt und Bewegung ausmacht, in Zahlen.
//
// Was hier wirklich gerechnet wird:
//   · Bildwinkel aus Sensorgröße und Brennweite:  2·arctan(Sensor / (2·f))
//   · Schärfentiefe (Nah-/Fernpunkt) über die hyperfokale Distanz
//   · Kadrierung: Motivhöhe im Bild aus Abstand, Brennweite, Sensorhöhe
//   · Schnittrhythmus: Anzahl Einstellungen, mittlere Länge, Verteilung über die Szenen
//   · Achsensprung (180-Grad-Regel): Vorzeichen der Blickrichtung prüfen
//   · Verhältnisse: Seitenverhältnis, Auflösung, Bildrate, Datenmenge und Speicherbedarf
//   · Bewegung: Tempo in Grad je Sekunde, Dauer einer Fahrt / eines Schwenks
//
// Was es nicht ist: keine Kamera steuert sich von selbst. Der Plan ist eine Anweisung für Menschen
// (oder für eine Kamera-App). Was nicht gedreht wurde, existiert nicht — das steht in jedem Ergebnis.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_CAMERA_FILE || path.join(__dirname, '..', 'data', 'camera_director.json');

// Sensoren: Breite × Höhe in Millimetern. Crop-Faktor gegen Kleinbild (36 mm).
const SENSORS = {
  'vollformat': { name: 'Kleinbild / Vollformat', w: 36, h: 24, crop: 1.0 },
  'aps-c': { name: 'APS-C', w: 23.6, h: 15.7, crop: 1.5 },
  'mft': { name: 'Micro Four Thirds', w: 17.3, h: 13, crop: 2.0 },
  '1zoll': { name: '1 Zoll', w: 13.2, h: 8.8, crop: 2.7 },
  'smartphone': { name: 'Handy (Hauptkamera)', w: 7.6, h: 5.7, crop: 4.7 },
  'super35': { name: 'Super 35 (Kino)', w: 24.9, h: 14, crop: 1.4 },
  's16': { name: 'Super 16', w: 12.5, h: 7, crop: 2.9 },
};

// Einstellungsgrößen mit Motivanteil an der Bildhöhe (Anteil, den die Person einnimmt).
const SHOT_SIZES = [
  { id: 'extreme-total', name: 'Weiteste Totale', share: 0.08, use: 'Ort, Größe, Verlassenheit' },
  { id: 'total', name: 'Totale', share: 0.35, use: 'Person in der Umgebung' },
  { id: 'halbtotal', name: 'Halbtotale', share: 0.6, use: 'Körper bis zu den Knien' },
  { id: 'halbnah', name: 'Halbnah', share: 0.8, use: 'Bis zur Hüfte — Standard für Dialog' },
  { id: 'nah', name: 'Nah', share: 1.0, use: 'Brust aufwärts — Nähe, Anteilnahme' },
  { id: 'gross', name: 'Großaufnahme', share: 1.6, use: 'Gesicht füllt das Bild' },
  { id: 'detail', name: 'Detail', share: 3.0, use: 'Augen, Hände, Gegenstand' },
];

// Kamerabewegungen mit Tempoangabe (Grad je Sekunde bzw. Meter je Sekunde) und Wirkung.
const MOVEMENTS = [
  { id: 'statisch', name: 'Statisch', kind: 'ruhe', speed: 0, use: 'Zuhören, Beobachten, Ruhe', risk: 'kann bei langen Einstellungen träge wirken' },
  { id: 'schwenk', name: 'Schwenk (horizontal)', kind: 'drehung', speed: [4, 12], use: 'Zusammenhang zeigen, mitziehen', risk: 'zu schnell = Schlieren und Unruhe' },
  { id: 'neigen', name: 'Neigen (vertikal)', kind: 'drehung', speed: [3, 10], use: 'Aufbau, Größe zeigen', risk: 'zu viel = Achterbahn' },
  { id: 'fahrt', name: 'Fahrt (Dolly)', kind: 'weg', speed: [0.1, 0.6], use: 'Nähe aufbauen, Enthüllung', risk: 'Ruckeln ohne Schienen oder Gimbal' },
  { id: 'zoom', name: 'Zoom', kind: 'optik', speed: [1, 5], use: 'Hervorheben ohne zu gehen', risk: 'verändert die Perspektive — sparsam' },
  { id: 'fahrtzoom', name: 'Fahrt + Gegenzoom (Dolly Zoom)', kind: 'mix', speed: [0.2, 0.8], use: 'Schock, Erkenntnis', risk: 'nur einmal pro Werk einsetzen' },
  { id: 'handkamera', name: 'Handkamera', kind: 'haltung', speed: [0.5, 3], use: 'Nähe, Wirklichkeit, Aufregung', risk: 'ohne Schulterstütze wackelig' },
  { id: 'gimbal', name: 'Gimbal-Fahrt', kind: 'weg', speed: [0.2, 1.2], use: 'fließende Wege', risk: 'zu glatt kann steril wirken' },
  { id: 'kran', name: 'Kran / Drohne', kind: 'weg', speed: [0.3, 2], use: 'Übersicht, Ortswechsel', risk: 'Regeln beachten (Drohnenverbot, Menschen)' },
  { id: 'schiene', name: 'Schiene (Slider)', kind: 'weg', speed: [0.05, 0.3], use: 'feine Verschiebung im Detail', risk: 'kurze Wege' },
  { id: 'steadicam', name: 'Steadicam', kind: 'weg', speed: [0.3, 1.5], use: 'lange Wege ohne Schnitt', risk: 'braucht Übung und Platz' },
  { id: 'kamera-von-oben', name: 'Top-Shot (senkrecht)', kind: 'haltung', speed: 0, use: 'Tische, Muster, Arrangements', risk: 'Licht und Schatten beachten' },
];

// Licht-Setups mit typischen Werten. Zahlen sind Erfahrungswerte, keine Messung.
const LIGHTING = [
  { id: 'drei-punkt', name: 'Drei-Punkt-Licht', parts: ['Führungslicht 45° zur Kamera', 'Aufhelllicht gegenüber, halbe Stärke', 'Kantenlicht von hinten oben'], key_ratio: '2:1 bis 4:1', use: 'Standard für Porträt und Interview' },
  { id: 'rembrandt', name: 'Rembrandt-Licht', parts: ['Führungslicht hoch und 45° seitlich', 'kleines Dreieck auf der Schattenwange'], key_ratio: '3:1 bis 8:1', use: 'Gesicht mit Charakter' },
  { id: 'butterfly', name: 'Schmetterlingslicht', parts: ['Führungslicht frontal, leicht erhöht', 'Schatten unter der Nase'], key_ratio: '2:1', use: 'Schönheit, klare Haut' },
  { id: 'split', name: 'Geteiltes Licht', parts: ['eine Seite hell, eine dunkel'], key_ratio: '8:1 bis 16:1', use: 'Spannung, Zwiespalt' },
  { id: 'gegenlicht', name: 'Gegenlicht / Silhouette', parts: ['Licht hinter dem Motiv', 'Aufhellung nach Wahl'], key_ratio: 'stark', use: 'Form, Geheimnis, Sonnenuntergang' },
  { id: 'nur-kerze', name: 'Kerzenlicht', parts: ['praktische Quelle im Bild', 'Farbtemperatur 1900 K bis 2200 K'], key_ratio: 'stark', use: 'Wärme, Nähe, alte Zeit' },
  { id: 'neon', name: 'Neon / Stadt bei Nacht', parts: ['Farbige Quellen von außen', 'Praktiker im Bild'], key_ratio: 'variabel', use: 'Nacht, Musikvideo' },
  { id: 'buehne', name: 'Bühne', parts: ['Verfolger von vorn', 'Gegenlicht von hinten', 'Nebel für Lichtbahnen'], key_ratio: 'stark', use: 'Konzert, Show' },
  { id: 'tageslicht-wolke', name: 'Tageslicht, bewölkt', parts: ['weiches Licht von oben'], key_ratio: '1:1 bis 2:1', use: 'Dokumentation, draußen schnell' },
  { id: 'fenster', name: 'Fensterlicht', parts: ['eine große weiche Quelle seitlich', 'Aufheller gegenüber (weiße Wand genügt)'], key_ratio: '2:1', use: 'natürlich, innen, günstig' },
  { id: 'kamin', name: 'Feuer / Kamin', parts: ['flackernde warme Quelle', 'Dunkelheit ringsum'], key_ratio: 'stark', use: 'Erzählen, Geborgenheit' },
  { id: 'studio-flach', name: 'Flaches Studiolicht', parts: ['zwei gleiche Quellen vorn'], key_ratio: '1:1', use: 'Erklärvideo, Freisteller' },
];

const FRAMINGS = {
  'goldener-schnitt': { name: 'Goldener Schnitt', line: 0.618, note: 'Augen auf der Linie — wirkt ruhig und edel.' },
  'drittel': { name: 'Drittelregel', line: 1 / 3, note: 'Standard: Motiv auf einer der beiden Linien.' },
  'zentriert': { name: 'Zentriert', line: 0.5, note: 'Symmetrie, Macht, Ansprache direkt ins Bild.' },
  'viel-luft': { name: 'Viel Luft in Blickrichtung', line: 1 / 3, note: 'Der Blick braucht Platz, sonst wirkt es bedrängt.' },
  'unten-tief': { name: 'Tiefe Kamera (Frosch)', line: 0.5, note: 'Macht größer, bedrohlicher, heroischer.' },
  'oben-hoch': { name: 'Hohe Kamera (Vogel)', line: 0.5, note: 'Macht kleiner, verletzlich, überblickt.' },
};

const RATIOS = {
  '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '4:3': 4 / 3, '21:9': 21 / 9, '2.39:1': 2.39, '3:2': 1.5,
};

function defaults() { return { plans: [], storyboards: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['plans', 'storyboards', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }
const R = (x, n) => Math.round(x * Math.pow(10, n || 2)) / Math.pow(10, n || 2);

// ---------------------------------------------------------------- Optik
function optics(input) {
  const p = input || {};
  const sensor = SENSORS[String(p.sensor || 'vollformat').toLowerCase()];
  if (!sensor) return { ok: false, error: `Sensor unbekannt. Erlaubt: ${Object.keys(SENSORS).join(', ')}` };
  const f = Number(p.focal) || 50;
  const hFov = 2 * Math.atan(sensor.w / (2 * f)) * 180 / Math.PI;
  const vFov = 2 * Math.atan(sensor.h / (2 * f)) * 180 / Math.PI;
  const dFov = 2 * Math.atan(Math.hypot(sensor.w, sensor.h) / (2 * f)) * 180 / Math.PI;
  const equiv = R(f * sensor.crop, 1);
  const out = { ok: true, sensor: sensor.name, focal: f, crop: sensor.crop, focal_equiv_35mm: equiv,
    fov_horizontal_deg: R(hFov), fov_vertical_deg: R(vFov), fov_diagonal_deg: R(dFov),
    look: equiv < 18 ? 'extremes Weitwinkel — Verzerrung an den Rändern' : equiv < 28 ? 'Weitwinkel — Ort zeigen, Räume wirken größer' : equiv < 45 ? 'leicht weit — Reportage, Handkamera' : equiv < 60 ? 'normal — wie das Auge empfindet' : equiv < 90 ? 'leichtes Tele — Porträt, Freistellen' : equiv < 160 ? 'Tele — verdichten, Hintergrund verschmelzen' : 'starkes Tele — Nähe ohne Nähe, Kompression' };

  // Kadrierung: Wie hoch erscheint ein 1,70 m großer Mensch aus der Entfernung?
  if (p.distance_m) {
    const dist = Number(p.distance_m);
    const frameH = 2 * dist * Math.tan((vFov / 2) * Math.PI / 180);
    const personH = Number(p.person_m) || 1.7;
    out.framing = { distance_m: dist, frame_height_m: R(frameH), person_share_of_frame: R(personH / frameH, 3),
      verdict: personH / frameH > 1.2 ? 'Detail — Gesicht oder Hände' : personH / frameH > 0.75 ? 'Nah bis Groß' : personH / frameH > 0.45 ? 'Halbnah bis Halbtotal' : personH / frameH > 0.2 ? 'Totale' : 'weite Totale' };
  }
  // Schärfentiefe
  if (p.aperture || p.distance_m) {
    const N = Number(p.aperture) || 2.8;
    const c = Number(p.coc_mm) || 0.03;
    const hyper = (f * f) / (N * c) + f;                       // hyperfokale Distanz in mm
    out.depth = { aperture: N, coc_mm: c, hyperfocal_m: R(hyper / 1000) };
    if (p.distance_m) {
      const s = Number(p.distance_m) * 1000;
      const near = (hyper * s) / (hyper + (s - f));
      const far = (hyper * s) / (hyper - (s - f));
      out.depth.focus_m = R(s / 1000);
      out.depth.near_m = R(near / 1000);
      out.depth.far_m = far > 1e6 ? 'unendlich' : R(far / 1000);
      out.depth.total_m = far > 1e6 ? 'unendlich' : R((far - near) / 1000);
      out.depth.note = N <= 2 ? 'offene Blende: wenig Schärfe — Hintergrund trennt sich' : N >= 8 ? 'geschlossene Blende: viel Schärfe — Beugung nimmt ab etwa f/16 zu' : 'mittlere Blende';
    }
  }
  return out;
}

// Bewegung: Wie lange dauert ein Schwenk um X Grad bei einem Tempo, und wie weit fährt man in Y Sekunden?
function motion(input) {
  const p = input || {};
  const mv = MOVEMENTS.find((x) => x.id === String(p.movement || 'schwenk').toLowerCase());
  if (!mv) return { ok: false, error: `Bewegung unbekannt. Erlaubt: ${MOVEMENTS.map((x) => x.id).join(', ')}` };
  const res = {};
  if (mv.kind === 'drehung') {
    const speed = Number(p.speed_deg_s) || mv.speed[0];
    const deg = Number(p.degrees) || 45;
    res.degrees = deg; res.speed_deg_s = speed; res.seconds = R(deg / speed);
    res.note = speed > 15 ? 'schneller als 15°/s — verwischt beim Aufnehmen, nur mit Ansage' : speed < 3 ? 'sehr ruhig' : 'normales Tempo';
  } else if (mv.kind === 'weg') {
    const speed = Number(p.speed_m_s) || mv.speed[0];
    const sec = Number(p.seconds) || 6;
    res.speed_m_s = speed; res.seconds = sec; res.meters = R(speed * sec);
    res.note = res.meters < 0.3 ? 'kaum sichtbar — Slider' : res.meters < 2 ? 'deutlich, kontrolliert' : 'weite Fahrt — Weg muss frei und sauber sein';
  } else if (mv.kind === 'optik') {
    const from = Number(p.focal_from) || 35, to = Number(p.focal_to) || 85, sec = Number(p.seconds) || 4;
    res.from_mm = from; res.to_mm = to; res.seconds = sec;
    res.change_per_second_mm = R((to - from) / sec);
    res.note = Math.abs(to - from) / from > 1 ? 'mehr als Verdopplung der Brennweite — sehr auffällig' : 'maßvoller Zoom';
  } else res.note = 'Diese Bewegung hat kein konstantes Tempo — Handkamera wird über die Haltung geführt.';
  res.movement = { id: mv.id, name: mv.name, use: mv.use, risk: mv.risk };
  return Object.assign({ ok: true }, res);
}

// Schnittrhythmus: Wie viele Einstellungen ergeben sich für eine Szene, und wie ist das Tempo?
function cutting(input) {
  const p = input || {};
  const minutes = Math.max(0.1, Number(p.minutes) || 5);
  const asl = Math.max(0.4, Number(p.avg_shot_seconds) || 6);   // mittlere Einstellungslänge
  const shots = Math.max(1, Math.round((minutes * 60) / asl));
  const cuts = shots - 1;
  const byIntensity = {
    'ruhig (Doku, Andacht)': R(minutes * 60 / 12),
    'mittel (Interview, Erklärung)': R(minutes * 60 / 7),
    'lebhaft (Reportage, Vlog)': R(minutes * 60 / 4),
    'schnell (Musikvideo, Trailer)': R(minutes * 60 / 2.2),
    'sehr schnell (Montage, Sport)': R(minutes * 60 / 1.2),
  };
  return {
    ok: true, minutes, avg_shot_seconds: asl, shots, cuts,
    shots_per_minute: R(shots / minutes),
    variants: byIntensity,
    rules: [
      'Beim Wechsel der Person ein Schnitt — nicht mitten im Satz, außer gewollt.',
      'Bei einem Gespräch nie von einer Aufnahme desselben Tages in die andere springen, ohne Achsenwechsel.',
      'Zwei aufeinanderfolgende Einstellungen dürfen sich nicht zu ähnlich sein (Größensprung um mindestens eine Stufe).',
      'Kein Schnitt ohne Grund: Ort, Person, Zeit oder Blickrichtung müssen sich ändern.',
      'Bei Musik: auf die Zählzeit schneiden, harte Schnitte auf die Eins.',
    ],
    honest: 'Einstellungslängen sind eine Planung. Der Schnitt am Ende richtet sich nach dem, was wirklich im Material liegt.',
  };
}

// Achsensprung prüfen: Positionen von Kamera A und B gegen die Blickachse der Personen.
function axisCheck(input) {
  const p = input || {};
  const pos = p.positions_m || {};
  const need = ['a_cam_x', 'b_cam_x', 'person_x'];
  const missing = need.filter((k) => typeof pos[k] !== 'number');
  if (missing.length) return { ok: false, error: `Für die Achsenprüfung fehlen Zahlen: ${missing.join(', ')} (Meter auf derselben Achse)` };
  const sideA = Math.sign(pos.a_cam_x - pos.person_x), sideB = Math.sign(pos.b_cam_x - pos.person_x);
  const jump = sideA !== sideB && sideA !== 0 && sideB !== 0;
  return {
    ok: true, side_a: sideA > 0 ? 'rechts der Achse' : 'links der Achse', side_b: sideB > 0 ? 'rechts der Achse' : 'links der Achse',
    axis_jump: jump,
    verdict: jump ? 'ACHSENSPRUNG — Blicke wirken entgegengesetzt, Zuschauer verliert die Richtung. Entweder Kamera auf dieselbe Seite oder Achsenwechsel bewusst zeigen (Fahrt über die Achse im Bild).'
      : 'Achse gehalten — die Blickrichtungen passen zusammen.',
    note: 'Die Achse (180-Grad-Linie) ist eine gedachte Linie zwischen zwei Gesprächspartnern. Alle Kameras bleiben auf einer Seite.',
  };
}

// Seitenverhältnis und Daten: Was kostet welche Auflösung?
function formatPlan(input) {
  const p = input || {};
  const ratioName = String(p.ratio || '16:9');
  const ratio = RATIOS[ratioName];
  if (!ratio) return { ok: false, error: `Verhältnis unbekannt. Erlaubt: ${Object.keys(RATIOS).join(', ')}` };
  const height = Number(p.height) || 1080;
  const width = Math.round(height * ratio);
  const fps = Number(p.fps) || 25;
  const bitrate = Number(p.mbps) || (height >= 2160 ? 60 : height >= 1440 ? 24 : height >= 1080 ? 12 : 6);
  const seconds = Number(p.seconds) || 600;
  const gb = (bitrate * seconds) / 8 / 1024;
  // Speicherbedarf eines Rohdrehs: Auflösung × Farbtiefe × Bildrate, unkomprimiert
  const rawFps = width * height * 2 * 3 * fps;                       // 2 Byte je Kanal, 3 Kanäle (vereinfacht)
  return {
    ok: true, ratio: ratioName, width, height, fps, bitrate_mbps: bitrate,
    seconds, file_gb: R(gb, 2),
    raw_gb_per_minute: R((rawFps * 60) / 8 / 1024 / 1024 / 1024, 1),
    delivery: [
      { where: 'YouTube / Vimeo', format: `${width}×${height}, ${fps} fps, ${bitrate} Mbit/s` },
      { where: 'Instagram / TikTok / Shorts', format: `1080×1920 (9:16), 25–30 fps, 8–12 Mbit/s${ratioName === '9:16' ? ' — passt schon' : ' — eigener Schnitt nötig'}` },
      { where: 'Podcast als Video', format: `1920×1080 (16:9), 25 fps, 8 Mbit/s` },
      { where: 'Archiv', format: 'Original belassen, dazu eine Fassung mit halber Datenmenge' },
    ],
    note: 'Datenmengen sind gerechnet, nicht gemessen: die echte Kamera schreibt langsamer oder schneller als das Papier erlaubt.',
  };
}

// Storyboard: Szenen in Einstellungen zerlegen (nach Zeitanteil), mit Größe, Bewegung, Licht, Framing.
function storyboard(input) {
  const p = input || {};
  const scenes = Array.isArray(p.scenes) ? p.scenes : [];
  if (!scenes.length) return { ok: false, error: 'Szenen fehlen (scenes: [{name, minutes}])' };
  const style = String(p.style || 'mittel');
  const asl = style === 'ruhig' ? 12 : style === 'lebhaft' ? 4 : style === 'schnell' ? 2.2 : 7;
  let nr = 1;
  const shots = [];
  for (const sc of scenes) {
    const minutes = Math.max(0.1, Number(sc.minutes) || 1);
    const count = Math.max(1, Math.round((minutes * 60) / asl));
    for (let i = 0; i < count; i++) {
      const size = SHOT_SIZES[(i < count - 1 ? i % (SHOT_SIZES.length - 1) : SHOT_SIZES.length - 2)];
      const mv = MOVEMENTS[(i * 3 + (sc.name || '').length) % MOVEMENTS.length];
      const li = LIGHTING[(i * 2 + (sc.name || '').length) % LIGHTING.length];
      const fr = Object.keys(FRAMINGS)[i % Object.keys(FRAMINGS).length];
      shots.push({
        nr: nr++, scene: String(sc.name || `Szene ${nr}`), size: size.id, size_name: size.name,
        seconds: R(minutes * 60 / count, 1), movement: mv.id, movement_name: mv.name,
        lighting: li.id, lighting_name: li.name, framing: fr,
        purpose: size.use,
      });
    }
  }
  const totalSeconds = shots.reduce((n, s) => n + s.seconds, 0);
  const plan = {
    id: 'cam-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(),
    style, scenes: scenes.length, shots: shots.length, total_seconds: R(totalSeconds, 1),
    avg_shot_seconds: R(totalSeconds / shots.length, 1),
    shot_list: shots,
    coverage: {
      wide: shots.filter((s) => ['extreme-total', 'total', 'halbtotal'].includes(s.size)).length,
      medium: shots.filter((s) => ['halbnah', 'nah'].includes(s.size)).length,
      close: shots.filter((s) => ['gross', 'detail'].includes(s.size)).length,
      movements_used: [...new Set(shots.map((s) => s.movement))].length,
      lighting_used: [...new Set(shots.map((s) => s.lighting))].length,
    },
    checklist: [
      'Vor dem Dreh: Akkus, Speicherkarten, Objektive putzen, Ton prüfen (Probeaufnahme anhören!).',
      'Kamera auf Stativ oder Gimbal, Wasserwaage im Bild prüfen.',
      'Weißabgleich setzen, Belichtung mit Zebra oder Wellenform prüfen.',
      'Bei jeder Einstellung 5 Sekunden vorher und nachher laufen lassen — Schnittfutter.',
      'Nach jeder Szene: Ansage für die Tonzuordnung (Szene, Einstellung, Nummer).',
      'Nach dem Dreh: Karten sofort sichern, zwei Kopien an verschiedenen Orten.',
    ],
    next_step: 'Dreh; danach Schnittliste aus der Ablage übernehmen (video_department).',
    honest: 'Der Plan plant Einstellungen. Gedreht wird von Menschen — und was fehlt, kann kein Schnitt erfinden.',
  };
  const d = load();
  d.storyboards.unshift(Object.assign({}, plan, { shot_list: shots.slice(0, 60) }));
  d.storyboards = d.storyboards.slice(0, 100);
  d.plans.unshift({ id: plan.id, at: plan.at, shots: plan.shots, total_seconds: plan.total_seconds, style });
  d.plans = d.plans.slice(0, 200);
  d.audit.unshift({ at: plan.at, action: 'storyboard', id: plan.id, shots: plan.shots });
  save(d);
  return { ok: true, storyboard: plan };
}

// Maximierung: Was lässt sich aus einem vorhandenen Dreh noch herausholen?
function maximize(input) {
  const p = input || {};
  const minutes = Math.max(0.1, Number(p.minutes) || 10);
  const existing = Math.max(0, Number(p.existing_shots) || 0);
  const ideas = [
    { what: 'Zweite Kamera oder zweiter Durchgang', gain: 'Aus einer Einstellung werden zwei Winkel — der Schnitt atmet', effort: 'ein Durchgang mehr, gleiches Licht nötig' },
    { what: 'Zwischenschnitte / B-Roll drehen', gain: 'Überbrückt Sprünge und lange Sätze', effort: '10 Einstellungen à 5 Sekunden genügen für 5 Minuten' },
    { what: 'Detailaufnahmen nachdrehen (Hände, Augen, Gegenstände)', gain: 'Macht Erzählungen greifbar', effort: 'kurze Extrazeit, oft am selben Ort' },
    { what: 'Pausen aufnehmen (5 Sekunden vor und nach jedem Take)', gain: 'Schnittfutter ohne Lücken', effort: 'kostet nichts' },
    { what: 'Ton doppelt sichern (Kamera + separates Gerät)', gain: 'Rettet Takes, bei denen ein Kanal streikt', effort: 'zweites Gerät, Klatschen zum Abgleich' },
    { what: 'Ein Einstellung mehr pro Szene als nötig', gain: 'Sicherheit im Schnitt', effort: 'wenige Minuten' },
    { what: 'Bewegung einmal pro Szene einsetzen, nicht überall', gain: 'Bewegung wirkt, wenn sie selten ist', effort: 'Planung' },
    { what: 'Gegenlicht- und Silhouetten-Variante aufnehmen', gain: 'Bildsprache mit wenigen Mitteln', effort: 'eine Position, eine Lichtquelle' },
    { what: 'Hochformat-Fassung gleich mitdenken (9:16)', gain: 'Kurzvideos ohne zweiten Dreh (Mitte halten)', effort: 'Bildausschnitt planen, nicht nachschneiden' },
    { what: 'Atmo aufnehmen (Raumton, Umgebung)', gain: 'Schnitte werden unhörbar, wenn die Atmo durchläuft', effort: '60 Sekunden am Ort stehen bleiben' },
  ];
  const recommended = Math.max(3, Math.round(minutes / 2));
  return {
    ok: true, minutes, existing_shots: existing,
    target_shots: Math.round(minutes * 60 / 6),
    missing_shots: Math.max(0, Math.round(minutes * 60 / 6) - existing),
    ideas: p.top ? ideas.slice(0, Math.min(ideas.length, Number(p.top) || 5)) : ideas,
    first_steps: ideas.slice(0, recommended > 5 ? 5 : recommended).map((x) => x.what),
    note: 'Erst drehen, was nur einmal geht (Personen, Wetter, Ort). Alles Wiederholbare danach.',
  };
}

// Tagesplan für einen Drehtag: Zeitfenster, Reihenfolge nach Licht.
function shootDay(input) {
  const p = input || {};
  const start = String(p.start || '09:00');
  const scenes = Array.isArray(p.scenes) && p.scenes.length ? p.scenes.map((s) => ({ name: String(s.name || 'Szene'), minutes: Math.max(0.1, Number(s.minutes) || 30), needs: String(s.needs || '') })) : null;
  if (!scenes) return { ok: false, error: 'Szenen fehlen (scenes: [{name, minutes, needs}])' };
  const [h0, m0] = start.split(':').map(Number);
  let t = (h0 || 9) * 60 + (m0 || 0);
  const rows = [];
  const buffer = Math.max(0, Number(p.buffer_minutes) || 10);
  for (const sc of scenes) {
    const from = t, to = t + sc.minutes;
    const fmt = (x) => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    rows.push({ name: sc.name, from: fmt(from), to: fmt(to), minutes: sc.minutes, needs: sc.needs });
    t = to + buffer;
  }
  const fmt = (x) => `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  const total = scenes.reduce((n, s) => n + s.minutes, 0);
  return {
    ok: true, start, end: fmt(t - buffer), rows, total_minutes: total, buffer_minutes: buffer,
    day_plan: [
      { at: fmt((h0 || 9) * 60 + (m0 || 0) - 30), what: 'Aufbau, Licht, Tonprobe, Testaufnahme anhören' },
      { at: fmt(t - buffer + buffer), what: 'Abbau, zwei Sicherungen der Karten, Notizen zum Material' },
    ],
    rules: ['Außenaufnahmen zuerst, wenn das Licht knapp ist (goldene Stunde einplanen).', 'Aufwändiges Make-up und Kostüm vor den leichten Szenen.', 'Nach jeder Szene 10 Minuten Puffer — es dauert immer länger.', 'Eine Person hat die Zeit im Blick, nicht alle.'],
  };
}

function status() {
  const d = load();
  return {
    area: 'CAM', module: 'camera_director', state: 'live', file: FILE,
    sensors: Object.keys(SENSORS).length, shot_sizes: SHOT_SIZES.length, movements: MOVEMENTS.length,
    lighting_setups: LIGHTING.length, framings: Object.keys(FRAMINGS).length, ratios: Object.keys(RATIOS).length,
    plans: d.plans.length, storyboards: d.storyboards.length,
    computed: ['Bildwinkel (horizontal, vertikal, diagonal) aus Sensor und Brennweite', 'Kleinbild-Entsprechung über den Crop-Faktor', 'Schärfentiefe über hyperfokale Distanz (Nah-, Fernpunkt, Gesamttiefe)', 'Kadrierungsanteil einer Person aus Abstand und Bildhöhe', 'Schnittanzahl und Einstellungslängen aus Länge und Rhythmus', 'Achsensprung aus Positionen (Vorzeichenprüfung)', 'Datenmenge aus Auflösung, Bildrate und Bitrate', 'Drehplan mit Zeitfenstern und Puffern'],
    rules: ['Der Plan braucht Menschen mit Kamera. Keine Automatik dreht von selbst.', 'Gedreht wird zuerst, was nur einmal geht.', 'Kadrierung und Licht sind Vorschläge mit Zahlen — die Kontrolle am Monitor entscheidet.'],
  };
}

module.exports = {
  meta: { area: 'CAM', id: 'camera_director', name: 'Kamera-Regie (Optik, Bewegung, Schnitt, Licht, Drehplan)', state: 'live' },
  actions: {
    status: () => status(),
    optics: (p) => optics(p || {}),
    motion: (p) => motion(p || {}),
    cutting: (p) => cutting(p || {}),
    axis: (p) => axisCheck(p || {}),
    format: (p) => formatPlan(p || {}),
    storyboard: (p) => storyboard(p || {}),
    maximize: (p) => maximize(p || {}),
    day: (p) => shootDay(p || {}),
    catalog: () => ({ ok: true, sensors: SENSORS, shot_sizes: SHOT_SIZES, movements: MOVEMENTS, lighting: LIGHTING, framings: FRAMINGS, ratios: Object.keys(RATIOS) }),
    storyboards: () => { const d = load(); return { ok: true, count: d.storyboards.length, storyboards: d.storyboards.slice(0, 10).map((x) => ({ id: x.id, at: x.at, shots: x.shots, total_seconds: x.total_seconds, coverage: x.coverage })) }; },
  },
  SENSORS, SHOT_SIZES, MOVEMENTS, LIGHTING, FRAMINGS, RATIOS, optics, motion, cutting, axisCheck, formatPlan, storyboard, maximize, shootDay, status,
};
