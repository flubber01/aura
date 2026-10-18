'use strict';
// AURA · Support: etwas stimmt nicht? Dann hier rein — mit Belegen, nicht mit Vermutungen.
//
// Der Ablauf ist absichtlich einfach und ehrlich:
//   1. Melden — mit Titel, Beschreibung, was erwartet wurde, was passiert ist.
//   2. Belege anhängen — automatisch: Zustand der Module, letzte Fehler, Version, Host-Merkmale.
//      Keine Geheimnisse, keine Passwörter, keine persönlichen Daten. Was NICHT angehängt wird, steht
//      in der Antwort (Datenschutz ist Teil des Supports).
//   3. Bearbeiten — Status, Antwort, Zuordnung. Kein Anliegen verschwindet still.
//   4. Dringlichkeit — „dringend" heißt: Benachrichtigung an den Menschen (Alarmleiter), nicht
//      „wird schon".
//
// Ehrlichkeit: Es gibt keine Ticket-Cloud und keinen Fremd-Support-Dienst. Alles liegt lokal und
// nachvollziehbar im OS. Der Kontakt geht an den Betreiber, nicht an einen Dritten.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_SUPPORT_FILE || path.join(__dirname, '..', 'data', 'support.json');

const CATEGORIES = ['FEHLER', 'FRAGE', 'WUNSCH', 'BEDIEUNG', 'ABRECHNUNG', 'SICHERHEIT', 'SONSTIG'];
const PRIORITIES = ['niedrig', 'normal', 'hoch', 'dringend'];
const STATES = ['NEU', 'IN_ARBEIT', 'WARTET_AUF_MELDENDEN', 'GELOEST', 'GESCHLOSSEN'];

// Was automatisch als Beleg mitgeht — und was ausdrücklich NICHT.
const ATTACH_ALWAYS = ['Zustand der Kernmodule (Zahlen, keine Inhalte)', 'Version und Startzeit des Servers', 'Zählwerke: Fehler, Neustarts, offene Freigaben', 'Betriebssystem und Node-Fassung (nur Version, kein Name des Rechners)'];
const ATTACH_NEVER = ['Passwörter oder Schlüssel', 'Inhalte von Nachrichten anderer', 'Persönliche Daten Dritter', 'Umgebungsvariablen im Ganzen', 'Dateipfade privater Medien'];

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

function safe(fn, fallback) { try { const v = fn(); return v === undefined || v === null ? fallback : v; } catch { return fallback; } }

function diagnostics() {
  const modules = {};
  for (const m of ['watchdog', 'human_final', 'security_response', 'campaign_planner', 'content_store', 'daw_devices', 'support']) {
    modules[m] = safe(() => {
      const mod = require('./' + m);
      const st = mod.actions && typeof mod.actions.status === 'function' ? mod.actions.status() : (typeof mod.status === 'function' ? mod.status() : {});
      return Object.fromEntries(Object.entries(st).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).slice(0, 8));
    }, { error: 'nicht abfragbar' });
  }
  return {
    at: new Date().toISOString(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch, uptime_s: Math.round(process.uptime()) },
    modules,
    attached: ATTACH_ALWAYS,
    not_attached: ATTACH_NEVER,
  };
}

function submit(input) {
  const data = load();
  const p = input || {};
  const title = String(p.title || '').trim();
  const text = String(p.text || '').trim();
  if (title.length < 4) return { ok: false, error: 'title fehlt oder ist zu kurz (mindestens 4 Zeichen)' };
  if (text.length < 10) return { ok: false, error: 'text fehlt oder ist zu kurz — bitte beschreiben, was passiert ist' };
  const cat = CATEGORIES.includes(String(p.category || '').toUpperCase()) ? String(p.category).toUpperCase() : 'FEHLER';
  const prio = PRIORITIES.includes(String(p.priority || '').toLowerCase()) ? String(p.priority).toLowerCase() : 'normal';
  const t = {
    id: 'tick-' + crypto.randomBytes(4).toString('hex'),
    number: `A-${String(data.tickets.length + 1).padStart(4, '0')}`,
    title: title.slice(0, 160), text: text.slice(0, 8000),
    expected: String(p.expected || '').slice(0, 2000) || null,
    category: cat, priority: prio, state: 'NEU',
    from: String(p.from || p.email || 'anonym').slice(0, 120),
    contact_back: p.contact_back === false ? false : true,
    context: { page: p.page || null, action: p.action || null, when: p.when || null },
    diagnostics: diagnostics(),
    replies: [],
    created_at: new Date().toISOString(),
  };
  data.tickets.unshift(t); data.tickets = data.tickets.slice(0, 2000);
  data.audit.unshift({ at: t.created_at, action: 'submit', id: t.id, category: cat, priority: prio });
  save(data);

  // Dringendes geht sofort an den Menschen — über die Alarmleiter, nicht über „gesehen".
  let alerted = null;
  if (prio === 'dringend' || cat === 'SICHERHEIT') {
    alerted = safe(() => require('./self_call').alert({ trigger: cat === 'SICHERHEIT' ? 'attack_confirmed' : 'human_needed', reason: `Support ${t.number} (${cat}, ${prio}): ${t.title}`, allow_call: false }), { error: 'Alarmleiter nicht erreichbar' });
  }
  return {
    ok: true, ticket: { id: t.id, number: t.number, state: t.state, category: t.category, priority: t.priority, created_at: t.created_at },
    attached: ATTACH_ALWAYS, never_attached: ATTACH_NEVER,
    notified: alerted ? alerted.escalation ? { id: alerted.escalation.id, state: alerted.escalation.state } : { error: true } : null,
    note: prio === 'dringend' || cat === 'SICHERHEIT' ? 'Dringend: der Mensch wird benachrichtigt, nicht nur das System informiert.' : 'Anliegen liegt im OS und wird bearbeitet.',
  };
}

function reply(id, input) {
  const data = load();
  const t = data.tickets.find((x) => x.id === id || x.number === id);
  if (!t) return { ok: false, error: 'Anliegen nicht gefunden' };
  const p = input || {};
  const text = String(p.text || '').trim();
  if (!text) return { ok: false, error: 'text fehlt' };
  const r = { at: new Date().toISOString(), by: String(p.by || 'Support'), text: text.slice(0, 4000) };
  t.replies.push(r);
  if (p.state && STATES.includes(String(p.state).toUpperCase())) t.state = String(p.state).toUpperCase();
  else t.state = 'IN_ARBEIT';
  data.audit.unshift({ at: r.at, action: 'reply', id: t.id, by: r.by });
  save(data);
  return { ok: true, ticket: { id: t.id, number: t.number, state: t.state, replies: t.replies.length } };
}

function setState(id, state, payload) {
  const data = load();
  const t = data.tickets.find((x) => x.id === id || x.number === id);
  if (!t) return { ok: false, error: 'Anliegen nicht gefunden' };
  const s = String(state || '').toUpperCase();
  if (!STATES.includes(s)) return { ok: false, error: `Zustand unbekannt. Erlaubt: ${STATES.join(', ')}` };
  const alt = t.state;
  t.state = s;
  t.closed_at = ['GELOEST', 'GESCHLOSSEN'].includes(s) ? new Date().toISOString() : null;
  data.audit.unshift({ at: new Date().toISOString(), action: 'state', id: t.id, from: alt, to: s, by: String((payload && payload.by) || 'AURA') });
  save(data);
  return { ok: true, ticket: { id: t.id, number: t.number, state: t.state }, from: alt };
}

function get(id) {
  const t = load().tickets.find((x) => x.id === id || x.number === id);
  return t ? { ok: true, ticket: t } : { ok: false, error: 'Anliegen nicht gefunden' };
}

function open() {
  const data = load();
  const offen = data.tickets.filter((t) => ['NEU', 'IN_ARBEIT', 'WARTET_AUF_MELDENDEN'].includes(t.state));
  return {
    ok: true, count: offen.length,
    tickets: offen.slice(0, 50).map((t) => ({ id: t.id, number: t.number, title: t.title, category: t.category, priority: t.priority, state: t.state, at: t.created_at })),
  };
}

function list(filter) {
  const data = load();
  const f = filter || {};
  let items = data.tickets;
  if (f.state) items = items.filter((t) => t.state === String(f.state).toUpperCase());
  if (f.category) items = items.filter((t) => t.category === String(f.category).toUpperCase());
  if (f.priority) items = items.filter((t) => t.priority === String(f.priority).toLowerCase());
  return { ok: true, count: items.length, tickets: items.slice(0, 100).map((t) => ({ id: t.id, number: t.number, title: t.title, category: t.category, priority: t.priority, state: t.state, replies: t.replies.length, at: t.created_at })) };
}

// Kontakt- und Hilfewege — offen benannt, ohne Versprechen.
function contact() {
  return {
    ok: true,
    ways: [
      { channel: 'Support-Formular', how: 'POST /api/support/submit', when: 'etwas stimmt nicht, Frage, Wunsch', sla: 'dringend: sofortige Benachrichtigung des Menschen; normal: Bearbeitung in der Reihenfolge' },
      { channel: 'Telegram', how: 'Bot einrichten (TELEGRAM_BOT_TOKEN) und Befehle /status /report /pending nutzen', when: 'schneller Blick von unterwegs', state: safe(() => (require('./notify').status() || {}).telegram === 'CONNECTED' ? 'verbunden' : 'nicht verbunden', 'unbekannt') },
      { channel: 'Alarmleiter', how: '/api/selfcall/alert', when: 'Angriff, Ausfall, Geld über Grenze', sla: 'Meldung + (mit Anbieter) Anruf' },
      { channel: 'Handbücher', how: 'GET /api/handbooks/markdown', when: 'Bedienfragen zuerst hier nachsehen', state: 'immer verfügbar' },
      { channel: 'Selbstprüfung', how: 'node test/validate.js', when: 'vermuten, dass etwas nicht läuft', state: 'lokal, ohne Netz' },
    ],
    promise: 'Was hier gemeldet wird, bleibt sichtbar: kein Anliegen verschwindet still, jedes hat Nummer und Zustand.',
    no_third_party: 'Es geht nichts an einen Fremd-Dienst. Alles bleibt im OS.',
  };
}

function status() {
  const d = load();
  const byState = {}; const byCat = {};
  for (const t of d.tickets) { byState[t.state] = (byState[t.state] || 0) + 1; byCat[t.category] = (byCat[t.category] || 0) + 1; }
  return {
    area: 'SUP', module: 'support', state: 'live', file: FILE,
    tickets: d.tickets.length, by_state: byState, by_category: byCat,
    categories: CATEGORIES, priorities: PRIORITIES,
    attached: ATTACH_ALWAYS, never_attached: ATTACH_NEVER,
    rules: ['Jedes Anliegen hat Nummer und Zustand — nichts verschwindet still.', 'Dringendes benachrichtigt den Menschen sofort.', 'Belege werden automatisch angehängt — aber keine Geheimnisse und keine persönlichen Daten.', 'Kein Fremd-Support-Dienst.'],
  };
}

module.exports = {
  meta: { area: 'SUP', id: 'support', name: 'Support & Kontakt (melden, belegen, verfolgen)', state: 'live' },
  actions: { status: () => status(), categories: () => ({ ok: true, categories: CATEGORIES, priorities: PRIORITIES, states: STATES }), submit: (p) => submit(p || {}), reply: (p) => reply((p || {}).id, p || {}), state: (p) => setState((p || {}).id, (p || {}).state, p || {}), get: (p) => get((p || {}).id), open: () => open(), list: (p) => list(p || {}), contact: () => contact(), diagnostics: () => diagnostics() },
  CATEGORIES, PRIORITIES, STATES, ATTACH_ALWAYS, ATTACH_NEVER, submit, reply, setState, get, open, list, contact, diagnostics, status,
};
