'use strict';
// AURA · Watchdog: Aufsicht über Dienste mit 3-Strike-Regel, Sleep-Mode und ehrlicher Live-Übersicht.
//
// Übernommen aus der Google-Docs-Spezifikation (Autonomous Agent Cosmos), Abschnitt „Owner Design Notes" —
// ausschließlich der BETRIEBS-Teil:
//   • Jeder Dienst wird automatisch neu gestartet, wenn er abstürzt.
//   • Erst wenn ein harter Fehler einen Dienst DREIMAL hintereinander aus dem Stand wirft, bleibt er unten.
//   • Vor dem Neustart werden System und Datei-Integration geprüft, danach läuft die Arbeit weiter.
//   • Sleep-Mode: Zustand liegt lokal, alle Dienste stehen, Reaktivierung nur durch den Administrator.
//   • Fällt ein Dienst aus, wird der Administrator benachrichtigt (Mail/Chat) — siehe notify/escalation.
//   • Live-Übersicht zeigt, welcher Dienst lebt, arbeitet oder steht; einzelne Dienste abschaltbar.
//
// Nicht übernommen (bewusst): alles, was Erzeugung von Klicks/Views/Likes/Kommentaren oder das Umgehen
// von Bot-Erkennung betrifft. Der Watchdog startet Dienste neu, er erzeugt nichts.
//
// Speicher: backend/src/data/watchdog.json (git-ignoriert, selbstheilend).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_WATCHDOG_FILE || path.join(__dirname, '..', 'data', 'watchdog.json');
const MAX_STRIKES = 3;                 // danach bleibt der Dienst unten (nur Admin startet ihn wieder)
const RESTART_DELAY_MS = 1500;         // kurze Pause vor dem Neustart
const HEARTBEAT_STALE_MS = 5 * 60 * 1000;

// Dienst-Zustände: RUNNING | RESTARTING | DOWN | DOWN_PERMANENT | STOPPED | SLEEPING
const services = new Map();
let asleep = null;                     // { at, by, reason, stopped: [namen] }
let notifier = null;                   // für Tests injizierbar; Standard: escalation + notify

// ---------------------------------------------------------------- Speicher (selbstheilend)
function defaults() {
  return { services: {}, strikes: {}, last_errors: {}, audit: [], sleep: null };
}
function load() {
  try {
    if (!fs.existsSync(FILE)) { const fresh = defaults(); save(fresh); return fresh; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['services', 'strikes', 'last_errors']) if (!raw[k] || typeof raw[k] !== 'object') raw[k] = {};
    if (!Array.isArray(raw.audit)) raw.audit = [];
    return raw;
  } catch {
    // AURA_SEED_WRITE: fehlende/kaputte Datei wird neu angelegt statt Absturz.
    const fresh = defaults();
    try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* Schreibrechte fehlen */ }
    return fresh;
  }
}
function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}
const nowIso = () => new Date().toISOString();
function audit(state, action, target, detail) {
  state.audit.unshift({ at: nowIso(), action, target: String(target || ''), detail: String(detail || '').slice(0, 300) });
  if (state.audit.length > 1000) state.audit.length = 1000;
}
function notifyAdmin(subject, detail) {
  // Benachrichtigung ist niemals kritisch für den Betrieb: Fehler werden geschluckt.
  try {
    if (notifier) { notifier(subject, detail); return; }
    try { require('./escalation').raise({ kind: 'integrity_loss', reason: subject + ' — ' + detail }); } catch { /* noch offen oder unbekannt */ }
    try { require('./notify').notifyEmergency({ kind: 'service', title: subject, detail }).catch(() => {}); } catch { /* optional */ }
  } catch { /* niemals werfen */ }
}

// ---------------------------------------------------------------- Registrierung
// job: { name, start: ()=>any, stop?: ()=>any, critical?: boolean, description?: string }
function register(job) {
  const name = String((job && job.name) || '');
  if (!name) throw new Error('Dienst ohne Namen');
  if (typeof job.start !== 'function') throw new Error('Dienst ' + name + ' braucht start()');
  services.set(name, { name, start: job.start, stop: typeof job.stop === 'function' ? job.stop : null, critical: !!job.critical, description: String(job.description || '') });
  const state = load();
  if (!state.services[name]) state.services[name] = { status: 'REGISTERED', started_at: null, restarts: 0 };
  save(state);
  return { ok: true, name };
}
const registered = () => [...services.keys()];

function startService(name, { by = 'watchdog', restart = false } = {}) {
  const svc = services.get(name);
  if (!svc) return { ok: false, code: 404, error: 'Dienst nicht registriert: ' + name };
  const state = load();
  const rec = state.services[name] || (state.services[name] = { status: 'REGISTERED', started_at: null, restarts: 0 });
  if (asleep) return { ok: false, code: 423, error: 'Sleep-Mode aktiv — erst aufwecken' };
  if (rec.status === 'DOWN_PERMANENT' && !restart) return { ok: false, code: 423, error: 'Dienst ist nach ' + MAX_STRIKES + ' harten Fehlern unten — Admin muss ihn freigeben' };
  try {
    svc.start();
    rec.status = 'RUNNING';
    rec.started_at = nowIso();
    rec.last_error = null;
    if (restart) rec.restarts = (rec.restarts || 0) + 1;   // Strikes zaehlt allein crash()
    else state.strikes[name] = 0;                          // regulaerer Start setzt zurueck
    audit(state, restart ? 'service.restart' : 'service.start', name, 'durch ' + by);
    save(state);
    return { ok: true, name, status: 'RUNNING', restarts: rec.restarts };
  } catch (e) {
    return crash(name, e, { by });
  }
}

// Herzschlag: ein Dienst meldet, dass er lebt. Ohne Herzschlag gilt ein RUNNING-Dienst als verdächtig (nicht als abgestürzt).
function beat(name, note) {
  const state = load();
  const rec = state.services[name];
  if (!rec) return { ok: false, code: 404, error: 'Dienst nicht registriert: ' + name };
  rec.last_beat = nowIso();
  rec.note = note ? String(note).slice(0, 200) : rec.note;
  save(state);
  return { ok: true, name, last_beat: rec.last_beat };
}

// Harter Fehler: Strike zählen, bei < 3 neu starten, bei 3 unten lassen und den Admin benachrichtigen.
function crash(name, err, { by = 'watchdog' } = {}) {
  const state = load();
  const rec = state.services[name] || (state.services[name] = { status: 'RUNNING', restarts: 0 });
  const message = String((err && err.message) || err || 'unbekannter Fehler').slice(0, 300);
  const strike = (state.strikes[name] || 0) + 1;
  state.strikes[name] = strike;
  state.last_errors[name] = { at: nowIso(), message, by };

  if (strike < MAX_STRIKES) {
    rec.status = 'RESTARTING';
    audit(state, 'service.crash', name, 'Strike ' + strike + '/' + MAX_STRIKES + ': ' + message + ' — Neustart');
    save(state);
    const svc = services.get(name);
    if (svc) {
      try { svc.start(); rec.status = 'RUNNING'; rec.started_at = nowIso(); rec.restarts = (rec.restarts || 0) + 1; audit(state, 'service.restart', name, 'automatisch nach Strike ' + strike); }
      catch (e2) { rec.status = 'DOWN'; state.last_errors[name] = { at: nowIso(), message: String(e2.message || e2).slice(0, 300), by: 'watchdog' }; audit(state, 'service.restart_failed', name, String(e2.message || e2)); }
    } else {
      rec.status = 'DOWN';
    }
    save(state);
    return { ok: false, strike, max: MAX_STRIKES, status: rec.status, restart: rec.status === 'RUNNING', error: message };
  }

  // Strike 3: stehen bleiben, nichts mehr automatisch starten, Admin informieren.
  rec.status = 'DOWN_PERMANENT';
  rec.down_since = nowIso();
  audit(state, 'service.down_permanent', name, 'Strike ' + strike + '/' + MAX_STRIKES + ': ' + message + ' — bleibt unten, Admin informiert');
  save(state);
  notifyAdmin('AURA: Dienst steht nach ' + MAX_STRIKES + ' harten Fehlern', name + ' — ' + message + ' (Zeit ' + nowIso() + '). Zustand wurde gesichert; Freigabe durch den Administrator nötig.');
  return { ok: false, strike, max: MAX_STRIKES, status: 'DOWN_PERMANENT', restart: false, error: message, notified: true };
}

// Admin gibt einen stehenden Dienst wieder frei (Strikes zurück auf 0).
function revive(name, by) {
  if (!services.has(name) && !load().services[name]) return { ok: false, code: 404, error: 'Dienst nicht registriert: ' + name };
  const state = load();
  state.strikes[name] = 0;
  const rec = state.services[name] || (state.services[name] = { restarts: 0 });
  audit(state, 'service.revive', name, 'durch ' + (by || 'admin') + ' (Strikes zurückgesetzt)');
  save(state);
  return startService(name, { by: by || 'admin', restart: true });
}

// Einzelnen Dienst abschalten (kill single).
function stopService(name, by) {
  const svc = services.get(name);
  const state = load();
  const rec = state.services[name];
  if (!rec) return { ok: false, code: 404, error: 'Dienst nicht registriert: ' + name };
  try { if (svc && svc.stop) svc.stop(); } catch (e) { /* Stopp-Fehler blockiert nichts */ }
  rec.status = 'STOPPED';
  rec.stopped_at = nowIso();
  state.strikes[name] = 0;
  audit(state, 'service.stop', name, 'durch ' + (by || 'admin'));
  save(state);
  return { ok: true, name, status: 'STOPPED' };
}

// ---------------------------------------------------------------- Sleep-Mode
// Zustand liegt lokal, alle Dienste stehen, Reaktivierung nur durch den Administrator.
function sleep(reason, by) {
  const state = load();
  const stopped = [];
  for (const [name, svc] of services) {
    try { if (svc.stop) svc.stop(); } catch { /* egal */ }
    const rec = state.services[name] || (state.services[name] = { restarts: 0 });
    if (rec.status !== 'DOWN_PERMANENT') rec.status = 'SLEEPING';
    stopped.push(name);
  }
  asleep = { at: nowIso(), by: String(by || 'admin').slice(0, 60), reason: String(reason || 'manuell').slice(0, 200), stopped };
  state.sleep = asleep;
  audit(state, 'sleep.enter', 'alle', 'Grund: ' + asleep.reason + ' · gesichert: ' + stopped.length + ' Dienste');
  save(state);
  return { ok: true, sleeping: true, stopped, note: 'Zustand liegt in ' + FILE + '. Reaktivierung nur durch den Administrator (wake).' };
}

function wake(by) {
  const state = load();
  const previous = state.sleep || asleep;
  asleep = null;
  state.sleep = null;
  const started = [];
  for (const [name, svc] of services) {
    const rec = state.services[name] || (state.services[name] = { restarts: 0 });
    if (rec.status === 'DOWN_PERMANENT') continue;      // harte Fehler bleiben Freigabe-pflichtig
    try { svc.start(); rec.status = 'RUNNING'; rec.started_at = nowIso(); started.push(name); }
    catch (e) { rec.status = 'DOWN'; state.last_errors[name] = { at: nowIso(), message: String(e.message || e).slice(0, 300), by: 'wake' }; }
  }
  audit(state, 'sleep.wake', 'alle', 'durch ' + (by || 'admin') + ' · gestartet: ' + started.length + (previous ? ' · geschlafen seit ' + previous.at : ''));
  save(state);
  return { ok: true, sleeping: false, started, skipped_down_permanent: Object.values(state.services).filter((r) => r.status === 'DOWN_PERMANENT').length };
}

// ---------------------------------------------------------------- Live-Übersicht
function status() {
  const state = load();
  const now = Date.now();
  const list = Object.entries(state.services).map(([name, rec]) => {
    const svc = services.get(name);
    const beatAge = rec.last_beat ? now - Date.parse(rec.last_beat) : null;
    return {
      name,
      status: rec.status || 'REGISTERED',
      critical: !!(svc && svc.critical),
      description: svc ? svc.description : '',
      strikes: state.strikes[name] || 0,
      max_strikes: MAX_STRIKES,
      restarts: rec.restarts || 0,
      started_at: rec.started_at || null,
      last_beat: rec.last_beat || null,
      beat_stale: beatAge !== null && beatAge > HEARTBEAT_STALE_MS,
      last_error: state.last_errors[name] || null,
      working: rec.status === 'RUNNING' && !(beatAge !== null && beatAge > HEARTBEAT_STALE_MS),
    };
  });
  return {
    area: 'WATCHDOG', mode: 'LIVE', max_strikes: MAX_STRIKES, sleep_file: FILE,
    sleeping: !!state.sleep, sleep: state.sleep,
    counts: {
      total: list.length,
      running: list.filter((s) => s.status === 'RUNNING').length,
      stopped: list.filter((s) => s.status === 'STOPPED' || s.status === 'SLEEPING').length,
      down: list.filter((s) => s.status === 'DOWN').length,
      down_permanent: list.filter((s) => s.status === 'DOWN_PERMANENT').length,
    },
    services: list.sort((a, b) => a.name.localeCompare(b.name)),
    audit_tail: state.audit.slice(0, 15),
    note: 'Startet Dienste automatisch neu; erst nach ' + MAX_STRIKES + ' harten Fehlern bleibt ein Dienst unten. Erzeugt keinerlei Traffic oder Engagement.',
  };
}

// Zustandsprüfung vor einem Neustart: Datei-Integration muss stimmen (kein Start mit kaputtem Zustand).
function preflight() {
  const checks = [];
  const dataDir = path.join(__dirname, '..', 'data');
  let dirOk = false;
  try { fs.mkdirSync(dataDir, { recursive: true }); dirOk = fs.existsSync(dataDir); } catch { /* egal */ }
  checks.push({ check: 'datenverzeichnis', ok: dirOk, detail: dataDir });
  let stateOk = false;
  try { const st = load(); stateOk = typeof st === 'object' && !!st; } catch { /* egal */ }
  checks.push({ check: 'watchdog-zustand', ok: stateOk, detail: FILE });
  const selfRepairOk = (() => { try { const sr = require('./self_repair'); return typeof sr.runChecks === 'function' && typeof sr.healDataFile === 'function'; } catch { return false; } })();
  checks.push({ check: 'selbstreparatur-verfuegbar', ok: selfRepairOk, detail: 'lib/self_repair (runChecks + healDataFile)' });
  return { ok: checks.every((c) => c.ok), checks, at: nowIso() };
}

function reset() {                    // nur für Tests
  services.clear();
  asleep = null;
  notifier = null;
}
function setNotifier(fn) { notifier = typeof fn === 'function' ? fn : null; }   // für Tests
function ensureId() { return 'WD-' + crypto.randomBytes(3).toString('hex'); }

module.exports = {
  MAX_STRIKES, FILE,
  register, registered, startService, crash, beat, revive, stopService,
  sleep, wake, status, preflight, reset, setNotifier, ensureId,
  isSleeping: () => !!asleep,
};
