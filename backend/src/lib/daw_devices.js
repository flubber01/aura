'use strict';
// AURA · Tonstudio-Geräte: MIDI-Keyboards, Pads, Controller, Audio-Interfaces anschließen.
//
// Der ehrliche Kern: Ob ein Gerät WIRKLICH da ist, prüft dieses Modul am System nach
// (/proc/asound, aconnect, arecord, jack_lsp). Ist nichts da, steht NOT-CONNECTED — es wird kein
// Gerät erfunden und kein Regler simuliert, der auf nichts wirkt.
//
// Was funktioniert, wenn ein Gerät da ist:
//  • Erkennen: Karten, MIDI-Ports, Aufnahme- und Wiedergabegeräte mit Namen und Nummern.
//  • Anlernen (MIDI-Learn): ein Regler/Fader bewegt → CC-Nummer abgefangen → auf einen Parameter eines
//    Tonstudio-Plug-ins (daw_plugins) gelegt. Auflösungen: 7 Bit (CC), 14 Bit (MSB/LSB), Pitch Bend.
//  • Umrechnen: MIDI-Wert (0…127) → Parameterwert im echten Bereich des Plug-ins, mit Kurve
//    (linear, logarithmisch für Frequenzen, exponentiell für Zeiten).
//  • Abhören/Latenz: Puffer, Samplerate und die daraus folgende Latenz rechnen.
//  • Noten: Note an → Tonhöhe/Frequenz + Anschlagstärke, damit ein Klangerzeuger spielbar ist.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FILE = process.env.AURA_DAW_DEVICES_FILE || path.join(__dirname, '..', 'data', 'daw_devices.json');

const KINDS = [
  { id: 'MIDI_KEYBOARD', name: 'MIDI-Keyboard', connects: 'USB-MIDI oder DIN-MIDI über Interface', typical: '49/61/88 Tasten, Modwheel, Sustain' },
  { id: 'MIDI_PAD', name: 'Pad-Controller', connects: 'USB-MIDI', typical: '8–64 Pads, Noten + CC' },
  { id: 'CONTROL_SURFACE', name: 'Mischpult-Controller', connects: 'USB-MIDI oder Netzwerk (MCU/OSC)', typical: 'Fader, Drehregler, Transport, 8–16 Kanäle' },
  { id: 'AUDIO_INTERFACE', name: 'Audio-Interface', connects: 'USB/Thunderbolt, ALSA oder JACK', typical: '2–8 Ein-/Ausgänge, 24 Bit, 44,1–96 kHz' },
  { id: 'MIC', name: 'Mikrofon', connects: 'XLR in Interface oder USB', typical: 'Kondensator/dynamisch, Phantomspeisung 48 V' },
  { id: 'MONITOR', name: 'Abhöre / Kopfhörer', connects: 'Klinke/XLR am Interface', typical: 'Nahfeld oder Kopfhörer' },
  { id: 'INSTRUMENT', name: 'Instrument direkt', connects: 'DI-Box oder Hi-Z-Eingang', typical: 'Gitarre, Bass, Keyboard' },
  { id: 'NETWORK_AUDIO', name: 'Netzwerk-Audio', connects: 'Dante/AES67 über Netzwerkkarte', typical: 'mehrere Kanäle über ein Kabel' },
];

// Was auf diesem Rechner wirklich zu finden ist. Keine Annahmen, nur Abfragen.
function probe() {
  const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
  const out = { tools: {}, alsa_cards: [], midi_ports: [], capture: [], playback: [], jack: [] };

  for (const t of ['aconnect', 'arecord', 'amidi', 'jack_lsp', 'aplay']) {
    const w = run('sh', ['-c', `command -v ${t} || true`]);
    out.tools[t] = !!(w && w.trim());
  }
  try {
    if (fs.existsSync('/proc/asound/cards')) {
      out.alsa_cards = fs.readFileSync('/proc/asound/cards', 'utf8').split('\n').filter((l) => /^\s*\d+\s*\[/.test(l)).map((l) => {
        const m = l.match(/^\s*(\d+)\s*\[([^\]]+)\]\s*:\s*([^-]+)-\s*(.*)$/);
        return m ? { index: Number(m[1]), id: m[2].trim(), driver: m[3].trim(), name: m[4].trim() } : { raw: l.trim() };
      });
    }
  } catch { /* nicht lesbar */ }
  if (out.tools.aconnect) {
    const s = run('aconnect', ['-o']);            // Ausgänge = Quellen
    if (s) out.midi_ports = s.split('\n').filter((l) => l.includes('client') || /^\s*\d+\s/.test(l)).map((l) => l.trim()).slice(0, 40);
  }
  if (out.tools.arecord) { const s = run('arecord', ['-l']); if (s) out.capture = s.split('\n').filter((l) => /^card \d+/.test(l)).map((l) => l.trim()); }
  if (out.tools.aplay) { const s = run('aplay', ['-l']); if (s) out.playback = s.split('\n').filter((l) => /^card \d+/.test(l)).map((l) => l.trim()); }
  if (out.tools.jack_lsp) { const s = run('jack_lsp', []); if (s) out.jack = s.split('\n').filter(Boolean).slice(0, 40); }

  const found = out.alsa_cards.length + out.midi_ports.length + out.jack.length;
  return {
    ok: true, ...out, found,
    mode: out.midi_ports.length || out.jack.length ? 'MIDI/AUDIO ERKANNT' : (out.alsa_cards.length ? 'NUR AUDIO-KARTEN ERKANNT' : 'NOT-CONNECTED'),
    honesty: 'Abfrage von /proc/asound, aconnect, arecord/aplay, jack_lsp. Ohne Treiber oder ohne angestecktes Gerät bleibt der Status ehrlich leer.',
  };
}

function defaults() { return { devices: [], mappings: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['devices', 'mappings', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Gerät anmelden: Kategorie, Name, Anschluss. Der Status kommt aus der echten Abfrage.
function addDevice(input) {
  const data = load();
  const p = input || {};
  const kind = KINDS.find((k) => k.id === String(p.kind || '').toUpperCase());
  const name = String(p.name || '').trim();
  if (!kind) return { ok: false, error: `kind fehlt oder unbekannt. Erlaubt: ${KINDS.map((k) => k.id).join(', ')}` };
  if (!name) return { ok: false, error: 'name fehlt' };
  const pr = probe();
  const matched = pr.alsa_cards.find((c) => name.toLowerCase().split(' ')[0] && (c.name || '').toLowerCase().includes(name.toLowerCase().split(' ')[0]))
    || pr.midi_ports.find((m) => m.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
  const d = {
    id: 'dev-' + Math.random().toString(16).slice(2, 10),
    name, kind: kind.id, connector: String(p.connector || kind.connects),
    channels: Number(p.channels) || (kind.id === 'AUDIO_INTERFACE' ? 2 : 0),
    sample_rate: Number(p.sample_rate) || 48000,
    buffer_frames: Number(p.buffer_frames) || 256,
    latency_ms: 0,
    detected: !!matched,
    detection: matched || null,
    state: matched ? 'ERKANNT' : 'ANGEMELDET (nicht am System gefunden)',
    note: matched ? 'Das Gerät wurde in der Systemabfrage gefunden.' : 'Angemeldet, aber in der Systemabfrage nicht gefunden — Kabel, Treiber oder Rechte prüfen.',
    created_at: new Date().toISOString(),
  };
  d.latency_ms = Math.round((d.buffer_frames / d.sample_rate) * 1000 * (kind.id === 'AUDIO_INTERFACE' ? 2 : 1) * 100) / 100;
  data.devices.unshift(d); data.devices = data.devices.slice(0, 100);
  data.audit.unshift({ at: d.created_at, action: 'addDevice', id: d.id, name, detected: d.detected });
  save(data);
  return { ok: true, device: d, probe_mode: pr.mode };
}

// MIDI anlernen: welcher Regler (CC) bewegt welchen Parameter?
function learn(input) {
  const data = load();
  const p = input || {};
  const cc = Number(p.cc);
  const target = String(p.target || '').trim();
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) return { ok: false, error: 'cc muss eine Zahl von 0 bis 127 sein' };
  if (!target) return { ok: false, error: 'target fehlt (z. B. "daw_plugins.compressor.threshold")' };
  const [mod, pluginId, param] = target.split('.');
  if (mod !== 'daw_plugins' || !pluginId || !param) return { ok: false, error: 'target muss wie "daw_plugins.<effekt>.<parameter>" aussehen' };
  let spec = null;
  try {
    const fx = require('./daw_plugins');
    const plugin = fx.PLUGINS.find((x) => x.id === pluginId);
    if (!plugin) return { ok: false, error: `Effekt "${pluginId}" gibt es nicht` };
    spec = plugin.params[param];
    if (!spec) return { ok: false, error: `Parameter "${param}" gibt es bei "${pluginId}" nicht. Bekannt: ${Object.keys(plugin.params).join(', ') || 'keine'}` };
  } catch (e) { return { ok: false, error: 'Tonstudio-Modul nicht ladbar: ' + e.message }; }
  const resolution = String(p.resolution || '7bit');
  if (!['7bit', '14bit', 'pitchbend'].includes(resolution)) return { ok: false, error: 'resolution muss 7bit, 14bit oder pitchbend sein' };
  const curve = ['linear', 'log', 'exp'].includes(p.curve) ? p.curve : (/hz/.test(param) ? 'log' : /ms|release|attack/.test(param) ? 'exp' : 'linear');
  const m = {
    id: 'map-' + Math.random().toString(16).slice(2, 10),
    cc, target, plugin: pluginId, param, resolution, curve,
    range: { min: spec.min, max: spec.max, unit: spec.unit || null, default: spec.def },
    device: String(p.device || 'Standard-Eingang'),
    learned_at: new Date().toISOString(),
    note: 'Anlernen heißt: dieser Regler steuert genau diesen Parameter in genau diesem Bereich.',
  };
  data.mappings = [m, ...data.mappings.filter((x) => !(x.cc === cc && x.device === m.device))].slice(0, 200);
  data.audit.unshift({ at: m.learned_at, action: 'learn', cc, target });
  save(data);
  return { ok: true, mapping: m, howto: 'Regler bewegen → CC kommt an → apply(cc, wert) rechnet den Parameterwert aus.' };
}

// Kurve: MIDI-Wert → Parameterwert (linear, logarithmisch für Frequenzen, exponentiell für Zeiten)
function curveValue(t, curve, min, max) {
  const x = Math.min(1, Math.max(0, t));
  if (curve === 'log' && min > 0) return Math.round(min * Math.pow(max / min, x) * 100) / 100;
  if (curve === 'exp') return Math.round((min + (max - min) * Math.pow(x, 2)) * 100) / 100;
  return Math.round((min + (max - min) * x) * 100) / 100;
}

// Regler bewegt sich: Wert umrechnen und als Parameteränderung zurückgeben.
function apply(input) {
  const data = load();
  const p = input || {};
  const cc = Number(p.cc);
  const device = String(p.device || 'Standard-Eingang');
  const map = data.mappings.find((m) => m.cc === cc && m.device === device) || data.mappings.find((m) => m.cc === cc);
  if (!map) return { ok: false, error: `CC ${cc} ist nicht angelernt — erst learn() benutzen`, needs: 'learn' };
  let t;
  const value = Number(p.value);
  if (map.resolution === '14bit') {
    const msb = Number(p.msb); const lsb = Number(p.lsb);
    if (!Number.isFinite(msb) || !Number.isFinite(lsb)) return { ok: false, error: 'bei 14 Bit müssen msb und lsb kommen (0…127)' };
    t = ((msb << 7) | lsb) / 16383;
  } else if (map.resolution === 'pitchbend') {
    if (!Number.isFinite(value)) return { ok: false, error: 'bei Pitch Bend muss value kommen (0…16383, Mitte 8192)' };
    t = value / 16383;
  } else {
    if (!Number.isFinite(value) || value < 0 || value > 127) return { ok: false, error: 'value muss 0…127 sein' };
    t = value / 127;
  }
  const out = curveValue(t, map.curve, map.range.min, map.range.max);
  return {
    ok: true, cc, target: map.target, curve: map.curve, normalized: Math.round(t * 1000) / 1000,
    value: out, unit: map.range.unit,
    patch: { [map.plugin]: { [map.param]: out } },
    note: 'Dieser Wert kann direkt als Parameteränderung an die Effektkette gehen.',
  };
}

// Note an: Tonhöhe und Frequenz — damit ein Klangerzeuger wirklich spielbar ist.
function note(input) {
  const p = input || {};
  const n = Number(p.note);
  if (!Number.isInteger(n) || n < 0 || n > 127) return { ok: false, error: 'note muss 0…127 sein (60 = mittleres C)' };
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(n / 12) - 1;
  const hz = Math.round(440 * Math.pow(2, (n - 69) / 12) * 100) / 100;
  const vel = Number.isFinite(Number(p.velocity)) ? Math.min(127, Math.max(1, Number(p.velocity))) : 100;
  return { ok: true, note: n, name: `${names[n % 12]}${octave}`, frequency_hz: hz, velocity: vel, gain_db: Math.round((vel / 127 - 1) * 24 * 10) / 10, note_on: p.on !== false };
}

// Latenz planen: Puffergröße gegen Samplerate.
function latency(input) {
  const p = input || {};
  const rate = Math.max(8000, Number(p.sample_rate) || 48000);
  const buffer = Math.max(16, Number(p.buffer_frames) || 256);
  const one = (buffer / rate) * 1000;
  const total = one * 2;
  return {
    ok: true, sample_rate: rate, buffer_frames: buffer,
    one_way_ms: Math.round(one * 100) / 100, round_trip_ms: Math.round(total * 100) / 100,
    verdict: total <= 10 ? 'spielbar (unter 10 ms)' : total <= 20 ? 'brauchbar, für Gesang grenzwertig' : 'zu hoch für Live-Einspielung — Puffer senken',
    table: [64, 128, 256, 512, 1024].map((b) => ({ buffer_frames: b, round_trip_ms: Math.round((b / rate) * 1000 * 2 * 100) / 100 })),
  };
}

function list() {
  const data = load();
  const pr = probe();
  return {
    ok: true, system: { mode: pr.mode, alsa_cards: pr.alsa_cards.length, midi_ports: pr.midi_ports.length, capture: pr.capture.length, playback: pr.playback.length, jack: pr.jack.length, tools: pr.tools },
    devices: data.devices.map((d) => ({ id: d.id, name: d.name, kind: d.kind, state: d.state, detected: d.detected, latency_ms: d.latency_ms })),
    mappings: data.mappings.map((m) => ({ cc: m.cc, target: m.target, curve: m.curve, device: m.device, resolution: m.resolution })),
    kinds: KINDS,
    honesty: pr.honesty,
  };
}

function status() {
  const data = load();
  const pr = probe();
  return {
    area: 'DAW-DEV', module: 'daw_devices', state: 'live', file: FILE,
    system_mode: pr.mode, detected_devices: data.devices.filter((d) => d.detected).length,
    registered: data.devices.length, mappings: data.mappings.length,
    kinds: KINDS.length,
    rules: ['Geräte werden am System nachgeschaut, nicht angenommen.', 'Ohne Gerät bleibt der Status NOT-CONNECTED — es wird kein Regler simuliert.', 'Anlernen gilt nur für Parameter, die es in der Effektkette wirklich gibt.', 'Kein Zugriff auf fremde Hardware, kein Netzwerk-Audio-Scan ohne Auftrag.'],
  };
}

module.exports = {
  meta: { area: 'DAW-DEV', id: 'daw_devices', name: 'Tonstudio-Geräte (MIDI, Audio, Anlernen, Latenz)', state: 'live' },
  actions: { status: () => status(), probe: () => probe(), kinds: () => ({ ok: true, kinds: KINDS }), list: () => list(), add: (p) => addDevice(p || {}), learn: (p) => learn(p || {}), apply: (p) => apply(p || {}), note: (p) => note(p || {}), latency: (p) => latency(p || {}), mappings: () => ({ ok: true, mappings: load().mappings }) },
  KINDS, probe, addDevice, learn, apply, note, latency, list, status, curveValue,
};
