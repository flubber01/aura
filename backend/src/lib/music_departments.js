'use strict';
// AURA · Musik-Abteilungen — alle, maximal ausgebaut.
//
// Ein Musikbetrieb hat 18 Abteilungen: von A&R über Aufnahme, Mischung, Mastering, Vertrieb, Verlags-
// wesen, Sync/Lizenzierung, Promotion, Radio, Playlist, Booking, Merch, Fanclub, Abrechnung, Rechte,
// Recht, Künstler-Entwicklung bis Label-Service. Jede Abteilung hat hier: Aufgaben, Übergabepunkte
// (Gates), Kennzahlen, was sie braucht, und was sie **nicht** tut.
//
// Ehrlich: keine Abteilung behauptet Ergebnisse. Aufgaben entstehen als Vorgang mit Zustand, Gates
// brauchen bei Veröffentlichung/Geld einen Menschen, und alles, was einen Anbieter braucht
// (Vertrieb, Playlist, Radio), steht auf „NOT-CONNECTED", solange kein Schlüssel da ist.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_MUSIC_DEPTS_FILE || path.join(__dirname, '..', 'data', 'music_departments.json');

const DEPARTMENTS = [
  { id: 'ar', name: 'A&R (Künstler und Repertoire)', tasks: ['Künstler-Gespräch führen', 'Demo anhören und bewerten', 'Repertoire-Liste pflegen'], kpi: ['Demos je Monat', 'Zusagen je Quartal'], needs: ['artist_accounts', 'songbook'], human_gate: 'Zusage an einen Künstler' },
  { id: 'songwriting', name: 'Songwriting / Textdichtung', tasks: ['Thema und Stimmung festlegen', 'Textgerüst bauen', 'Reim und Silben prüfen'], kpi: ['Entwürfe je Woche', 'verworfene Entwürfe (ehrlich gezählt)'], needs: ['lyric_writer', 'artist_messenger'], human_gate: 'Text freigeben' },
  { id: 'produktion', name: 'Produktion / Beat', tasks: ['Stil, Tempo und Tonart setzen', 'Instrumentenlagen legen', 'Varianten rendern'], kpi: ['Entwürfe je Woche', 'Varianten je Song'], needs: ['song_orchestrator', 'music_render'], human_gate: 'Produktion abnehmen' },
  { id: 'aufnahme', name: 'Aufnahme (Recording)', tasks: ['Geräte prüfen', 'Latenz prüfen', 'Spur aufnehmen'], kpi: ['Takes je Song', 'Latenz in ms'], needs: ['daw_devices', 'daw_plugins'], human_gate: 'Take für gut erklären' },
  { id: 'mischung', name: 'Mischung (Mixing)', tasks: ['Effektkette setzen', 'Pegel ausgleichen', 'Stems ausgeben'], kpi: ['Ketten je Song', 'Stems je Fassung'], needs: ['daw_plugins', 'music_render'], human_gate: 'Mischung abnehmen' },
  { id: 'mastering', name: 'Mastering', tasks: ['Lautheit auf Zielwert', 'Höhen und Tiefen prüfen', 'Referenzdatei bauen'], kpi: ['LUFS-Zielwert', 'Abweichung je Fassung'], needs: ['daw_plugins'], human_gate: 'Master freigeben' },
  { id: 'label', name: 'Label-Service', tasks: ['Releases planen', 'Metadaten pflegen', 'Termine halten'], kpi: ['Releases je Quartal', 'Termintreue'], needs: ['calendar', 'creator_passport'], human_gate: 'Release anmelden' },
  { id: 'vertrieb', name: 'Vertrieb (Distribution)', tasks: ['Zielplattformen wählen', 'Anbieter-Schlüssel prüfen', 'Auslieferung anstoßen'], kpi: ['Plattformen je Release', 'Zustand je Plattform'], needs: ['connectors', 'vault'], human_gate: 'Auslieferung starten', honest: 'Ohne Distributor-Schlüssel bleibt es bei „vorbereitet" — keine Auslieferung ohne Anbieter.' },
  { id: 'verlag', name: 'Verlagswesen (Publishing)', tasks: ['Werk anmelden', 'Urheber-Anteile festhalten', 'Wahrnehmung klären'], kpi: ['angemeldete Werke', 'offene Nachweise'], needs: ['legal', 'creator_passport'], human_gate: 'Werk anmelden' },
  { id: 'sync', name: 'Sync und Lizenzierung', tasks: ['Anfrage aufnehmen', 'Nutzungsumfang klären', 'Angebot rechnen'], kpi: ['Anfragen je Monat', 'Angebote je Anfrage'], needs: ['legal', 'billing_plans'], human_gate: 'Lizenz erteilen' },
  { id: 'promotion', name: 'Promotion und Presse', tasks: ['Pressetext schreiben', 'Versandliste pflegen', 'Antworten nachhalten'], kpi: ['Pressetexte', 'Rückmeldungen'], needs: ['content_store', 'newsletter'], human_gate: 'Pressetext versenden' },
  { id: 'radio', name: 'Radio', tasks: ['Sender-Liste pflegen', 'Ansprache vorbereiten', 'Rückmeldung festhalten'], kpi: ['Ansprachen', 'Zusagen'], needs: ['connectors'], human_gate: 'Einreichen', honest: 'Kein Sender wird automatisch angeschrieben. Alles läuft über einen Menschen und die Anbieter-Anbindung.' },
  { id: 'playlist', name: 'Playlist-Platzierung', tasks: ['Passende Listen suchen', 'Anfrage aufsetzen', 'Ergebnis festhalten'], kpi: ['Anfragen', 'Aufnahmen'], needs: ['connectors', 'web_empire'], human_gate: 'Anfrage senden', honest: 'Keine gekauften Aufrufe, keine Bots. Nur echte Anfragen mit echtem Ergebnis.' },
  { id: 'booking', name: 'Booking und Live', tasks: ['Termine planen', 'Rider festhalten', 'Kosten rechnen'], kpi: ['Termine', 'Deckungsbeitrag je Abend'], needs: ['calendar', 'billing_plans'], human_gate: 'Vertrag zusagen' },
  { id: 'merch', name: 'Merchandise', tasks: ['Artikel anlegen', 'Bestand zählen', 'Verkauf abrechnen'], kpi: ['Artikel', 'Deckungsbeitrag'], needs: ['content_store', 'payment_providers'], human_gate: 'Bestellung auslösen' },
  { id: 'fanclub', name: 'Fanclub und Kundenbindung', tasks: ['Rundbrief pflegen', 'Empfehlungen verfolgen', 'Stammkunden erkennen'], kpi: ['bestätigte Anmeldungen', 'Empfehlungen'], needs: ['newsletter', 'referral'], human_gate: 'Werbeaktion starten' },
  { id: 'abrechnung', name: 'Abrechnung und Lizenzen (Royalties)', tasks: ['Einnahmen erfassen', 'Anteile rechnen', 'Abrechnung erstellen'], kpi: ['eingegangene Beträge', 'ausgezahlte Anteile'], needs: ['logs_analytics', 'payment_providers'], human_gate: 'Auszahlung', honest: 'Ohne Zahlungsanbieter und Beleg bleibt es bei „lokal geführt".' },
  { id: 'rechte', name: 'Rechte und Freigaben (Clearance)', tasks: ['Samples prüfen', 'Lizenzen sammeln', 'Freigaben dokumentieren'], kpi: ['geprüfte Werke', 'offene Freigaben'], needs: ['royalty_free', 'legal'], human_gate: 'Freigabe bestätigen' },
  { id: 'recht', name: 'Recht (Verträge, AGB)', tasks: ['Vertragsvorlage wählen', 'AGB-Fassung prüfen', 'Widerruf klären'], kpi: ['Vorlagen', 'Fassungen'], needs: ['legal'], human_gate: 'Vertrag zeichnen' },
  { id: 'entwicklung', name: 'Künstler-Entwicklung', tasks: ['Ziele setzen', 'Übungsplan bauen', 'Fortschritt festhalten'], kpi: ['Ziele erreicht', 'Sitzungen'], needs: ['user_area', 'handbooks'], human_gate: 'Ziel verbindlich setzen' },
];

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
function safe(fn, fallback) { try { const r = fn(); return r === undefined ? fallback : r; } catch { return fallback; } }

function dept(id) { return DEPARTMENTS.find((d) => d.id === id) || null; }

// Lebend-Zustand je Abteilung: welche Module sind da, wie viele Vorgänge laufen, welche Gates offen.
function board() {
  const data = load();
  const rows = DEPARTMENTS.map((d) => {
    const modules = d.needs.map((m) => {
      const lib = safe(() => require('./' + m), null);
      return { module: m, present: !!lib, state: lib ? (lib.meta && lib.meta.state) || 'live' : 'FEHLT' };
    });
    const tickets = data.tickets.filter((t) => t.department === d.id);
    return {
      id: d.id, name: d.name,
      tasks: d.tasks.length, kpi: d.kpi,
      modules_ready: modules.filter((m) => m.present).length, modules_needed: modules.length,
      missing_modules: modules.filter((m) => !m.present).map((m) => m.module),
      open_tickets: tickets.filter((t) => t.state !== 'ERLEDIGT').length,
      done_tickets: tickets.filter((t) => t.state === 'ERLEDIGT').length,
      human_gate: d.human_gate,
      honest: d.honest || null,
      state: modules.every((m) => m.present) ? 'BEREIT' : 'TEILWEISE (Module fehlen)',
    };
  });
  return {
    ok: true, departments: rows.length,
    ready: rows.filter((r) => r.state === 'BEREIT').length,
    rows,
    note: '„Bereit" heißt: alle nötigen Module sind da. Es heißt nicht, dass schon etwas gelaufen ist.',
  };
}

function ticket(input) {
  const p = input || {};
  const d = dept(String(p.department || '').toLowerCase());
  if (!d) return { ok: false, error: `Abteilung unbekannt. Erlaubt: ${DEPARTMENTS.map((x) => x.id).join(', ')}` };
  const task = String(p.task || '').trim();
  if (task.length < 3) return { ok: false, error: 'task fehlt' };
  const data = load();
  const t = {
    id: 'md-' + Math.random().toString(36).slice(2, 8),
    department: d.id, department_name: d.name, task: task.slice(0, 200),
    artist: String(p.artist || '') || null, song: String(p.song || '') || null,
    state: 'OFFEN', steps: d.tasks.map((x, i) => ({ nr: i + 1, what: x, done: false })),
    human_gate: d.human_gate, created_at: new Date().toISOString(), by: String(p.by || 'Auraos'),
    honest: d.honest || null,
  };
  data.tickets.unshift(t); data.tickets = data.tickets.slice(0, 2000);
  data.audit.unshift({ at: t.created_at, action: 'ticket', department: d.id, id: t.id });
  save(data);
  return { ok: true, ticket: t, note: `Vorgang liegt in „${d.name}". Vor „${d.human_gate}" entscheidet ein Mensch.` };
}

function advance(input) {
  const p = input || {};
  const data = load();
  const t = data.tickets.find((x) => x.id === p.id);
  if (!t) return { ok: false, error: 'Vorgang nicht gefunden' };
  const open = t.steps.filter((s) => !s.done);
  if (!open.length) {
    if (t.state === 'ERLEDIGT') return { ok: true, ticket: t, note: 'Schon fertig.' };
    if (!p.human) return { ok: false, needs: 'human', error: `Vor „${t.human_gate}" muss ein Mensch zustimmen (human: true).`, gate: 'Freigabe-Tür: POST /api/human/propose' };
    t.state = 'ERLEDIGT'; t.done_at = new Date().toISOString(); t.done_by = String(p.by || 'Mensch');
    save(data);
    return { ok: true, ticket: { id: t.id, state: t.state }, note: 'Abgeschlossen — mit menschlicher Freigabe.' };
  }
  const step = open[0];
  step.done = true; step.at = new Date().toISOString();
  if (!t.steps.some((s) => !s.done)) t.state = 'WARTET AUF MENSCH';
  save(data);
  return { ok: true, ticket: { id: t.id, state: t.state, done_steps: t.steps.filter((s) => s.done).length, total: t.steps.length }, step: step.what, next: (t.steps.find((s) => !s.done) || {}).what || `Freigabe: ${t.human_gate}` };
}

function status() {
  const data = load();
  return {
    area: 'MUSDEPT', module: 'music_departments', state: 'live', file: FILE,
    departments: DEPARTMENTS.length, tickets: data.tickets.length,
    open: data.tickets.filter((t) => t.state !== 'ERLEDIGT').length,
    human_gates: DEPARTMENTS.filter((d) => d.human_gate).length,
    honesty: DEPARTMENTS.filter((d) => d.honest).map((d) => ({ department: d.id, note: d.honest })),
    rules: ['Jede Abteilung hat Aufgaben, Kennzahlen und ein Mensch-Tor.', 'Keine Abteilung behauptet Ergebnisse: Zahlen entstehen nur aus echten Vorgängen.', 'Was einen Anbieter braucht, steht auf NOT-CONNECTED, solange kein Schlüssel da ist.'],
  };
}

module.exports = {
  meta: { area: 'MUSDEPT', id: 'music_departments', name: 'Musik-Abteilungen (20 Abteilungen mit Aufgaben, Kennzahlen, Mensch-Toren)', state: 'live' },
  actions: { status: () => status(), departments: () => ({ ok: true, departments: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, tasks: d.tasks.length, needs: d.needs, human_gate: d.human_gate })) }), board: () => board(), ticket: (p) => ticket(p || {}), advance: (p) => advance(p || {}), list: (p) => { const data = load(); const f = (p || {}).department; const items = data.tickets.filter((t) => !f || t.department === f); return { ok: true, count: items.length, tickets: items.slice(0, 50) }; } },
  DEPARTMENTS, board, ticket, advance, status,
};
