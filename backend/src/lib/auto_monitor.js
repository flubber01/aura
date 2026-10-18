'use strict';
// AURA · Selbstüberwachung: das System schaut sich selbst an — und sagt Bescheid, wenn etwas kippt.
//
// Der Wachhund (watchdog.js) kümmert sich um Dienste, die abgestürzt sind. Hier geht es um die DINGE,
// die still kaputtgehen: Keine Messwerte mehr, Songbook rendert nicht mehr, Warteschlangen wachsen,
// Freigaben stapeln sich, Speicher läuft voll, ein Kanal ist abgelaufen. Solche Fehler tun nicht weh —
// bis der Betrieb steht. Deshalb: Regeln mit Schwellen, regelmäßig geprüft, Ergebnis als Befund.
//
// Aufbau:
//   Regel  = { id, name, was, prüft(), Schwelle, Dringlichkeit }
//   Lauf   = alle Regeln prüfen → Befunde → (bei Dringlichkeit) Alarm über die Alarmleiter
//   Lauf-Buch: wann wurde geprüft, was war der Befund, hat sich etwas geändert?
//
// Wichtig: Die Regeln LESEN nur. Sie reparieren nicht heimlich und löschen nichts. Was zu tun ist,
// steht als Vorschlag dabei — die Ausführung ist ein eigener, freigabepflichtiger Schritt.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_AUTO_MONITOR_FILE || path.join(__dirname, '..', 'data', 'auto_monitor.json');
const STATE = path.join(__dirname, '..', 'data', 'auto_monitor_state.json');

function safe(fn, fallback) { try { const v = fn(); return v === undefined || v === null ? fallback : v; } catch { return fallback; } }

// Jede Regel liest echte Werte. Schwellen sind offen benannt, damit man sie ändern kann.
const RULES = [
  {
    id: 'jobs_stuck', name: 'Hängende Aufträge', level: 'hoch', threshold: 3,
    was: 'Video- oder Rendersaufträge, die auf RUNNING stehen geblieben sind',
    check() {
      const vs = safe(() => require('./video_studio').status(), {});
      const running = (vs.jobs && typeof vs.jobs.running === 'number') ? vs.jobs.running : safe(() => (require('./video_studio').status().counts || {}).running, 0);
      return { value: running, unit: 'laufende Aufträge' };
    },
    advice: 'Auftrag einzeln prüfen (GET /api/video/jobs). Wenn er wirklich hängt: neu starten, nicht den Dienst.',
  },
  {
    id: 'pending_approvals', name: 'Freigaben stauen sich', level: 'mittel', threshold: 5,
    was: 'Vorhaben, die auf einen Menschen warten',
    check() { const o = safe(() => require('./human_final').open(), { count: 0 }); return { value: o.count || 0, unit: 'offene Freigaben' }; },
    advice: 'Im Nutzer-Bereich unter „Warten auf dich" ansehen und entscheiden.',
  },
  {
    id: 'support_open', name: 'Offene Anliegen', level: 'mittel', threshold: 5,
    was: 'Support-Anliegen ohne Antwort',
    check() { const s = safe(() => require('./support').open(), { count: 0 }); return { value: s.count || 0, unit: 'offene Anliegen' }; },
    advice: 'Support-Liste durchgehen und antworten — sonst fühlt sich niemand gehört.',
  },
  {
    id: 'security_cases', name: 'Sicherheitsfälle ohne Abschluss', level: 'hoch', threshold: 3,
    was: 'Fälle in DETECT/ISOLATE/REVIEW',
    check() { const c = safe(() => require('./security_response').cases({}), { cases: [] }); const offen = (c.cases || []).filter((x) => !x.closed).length; return { value: offen, unit: 'offene Fälle' }; },
    advice: 'Prüfung starten (REVIEW) und entscheiden: beobachten, aufheben oder ausschließen.',
  },
  {
    id: 'no_measurements', name: 'Keine Messwerte', level: 'niedrig', threshold: 7,
    was: 'Tage ohne neue Verkehrszahlen — Analyse läuft blind',
    check() {
      const a = safe(() => require('./analytics_forecast').status(), { traffic_entries: 0 });
      const last = safe(() => { const d = JSON.parse(fs.readFileSync(process.env.AURA_ANALYTICS_FILE || path.join(__dirname, '..', 'data', 'analytics.json'), 'utf8')); return (d.traffic[0] || {}).entered_at || null; }, null);
      const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : 999;
      return { value: days, unit: 'Tage seit letzter Zahl', entries: a.traffic_entries || 0 };
    },
    advice: 'Zahlen eintragen (Anzeigenkonto, Webserver-Protokoll, Plattform-Export) — ohne Daten keine Auswertung.',
  },
  {
    id: 'content_idle', name: 'Kein neuer Inhalt', level: 'niedrig', threshold: 14,
    was: 'Tage seit dem letzten gespeicherten Inhalt',
    check() {
      const st = safe(() => require('./content_store').status(), { items: 0 });
      const data = safe(() => JSON.parse(fs.readFileSync(process.env.AURA_CONTENT_FILE || path.join(__dirname, '..', 'data', 'content_index.json'), 'utf8')), { items: [] });
      const last = (data.items[0] || {}).created_at;
      return { value: last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : 999, unit: 'Tage seit letztem Inhalt', items: st.items || 0 };
    },
    advice: 'Im Studio etwas anfangen — Song, Video oder Text. Leerlauf ist der teuerste Fehler.',
  },
  {
    id: 'storage_growth', name: 'Speicher wächst schnell', level: 'mittel', threshold: 500 * 1024 * 1024,
    was: 'Inhalts-Speicher über der Grenze',
    check() { const st = safe(() => require('./content_store').status(), { bytes: 0 }); return { value: st.bytes || 0, unit: 'Bytes', human: st.bytes_human || '0 B' }; },
    advice: 'Aufräum-Vorschläge ansehen (GET /api/content/retention). Löschen bleibt eine menschliche Entscheidung.',
  },
  {
    id: 'channels_unverified', name: 'Kanäle ungeprüft', level: 'niedrig', threshold: 3,
    was: 'Anbieter ohne echten Testaufruf',
    check() { const c = safe(() => require('./connectors').status(), {}); const un = c.unverified || c.unverified_count || 0; return { value: un, unit: 'ungeprüfte Kanäle' }; },
    advice: 'Testaufruf je Kanal machen, damit die Statusangabe belastbar wird.',
  },
  {
    id: 'watchdog_down', name: 'Dienst dauerhaft ausgefallen', level: 'hoch', threshold: 1,
    was: 'Dienst auf DOWN_PERMANENT',
    check() {
      const w = safe(() => require('./watchdog').status(), {});
      const list = w.services || [];
      const down = list.filter((s) => String(s.state || '').includes('DOWN_PERMANENT')).length;
      return { value: down, unit: 'Dienste endgültig ausgefallen' };
    },
    advice: 'Dienst einzeln ansehen und gezielt neu starten (POST /api/watchdog/service/<name>/revive).',
  },
  {
    id: 'speech_engine', name: 'Sprachmotor fehlt', level: 'niedrig', threshold: 1,
    was: 'Sprechen/Hören nicht möglich',
    check() { const s = safe(() => require('./speech').engines(), { mode: 'unbekannt' }); return { value: s.mode === 'NOT-CONNECTED' ? 1 : 0, unit: s.mode }; },
    advice: 'piper/espeak-ng und whisper.cpp installieren — dann werden Podcast und Avatar hörbar.',
  },
  {
    id: 'devices_missing', name: 'Keine Studio-Geräte', level: 'niedrig', threshold: 1,
    was: 'Kein MIDI/Audio-Gerät am System gefunden',
    check() { const d = safe(() => require('./daw_devices').status(), { detected_devices: 0 }); return { value: d.detected_devices || 0, unit: 'erkannte Geräte (0 = keine Rückmeldung)', invert: true }; },
    advice: 'Gerät anstecken, Treiber/Rechte prüfen (ALSA/JACK). Angemeldete Geräte ohne Erkennung stehen im Geräte-Register.',
  },
];

function defaults() { return { runs: [], findings: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['runs', 'findings', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Ein Lauf: alle Regeln prüfen. Optional Alarm bei ernsten Befunden.
function run(options) {
  const data = load();
  const p = options || {};
  const at = new Date().toISOString();
  const results = [];
  for (const r of RULES) {
    let m = { value: 0, unit: '' };
    try { m = r.check() || m; } catch (e) { m = { value: null, unit: 'Prüfung fehlgeschlagen: ' + e.message }; }
    const breached = r.check_none ? false : (m.invert ? m.value < r.threshold : m.value >= r.threshold);
    results.push({ rule: r.id, name: r.name, level: r.level, value: m.value, unit: m.unit, extra: m.human || m.entries || null, threshold: r.threshold, breached, advice: breached ? r.advice : null });
  }
  const breached = results.filter((r) => r.breached);
  const entry = {
    id: 'am-' + crypto.randomBytes(4).toString('hex'), at, checked: results.length, breached: breached.length,
    by: String(p.by || 'Selbstüberwachung'), findings: breached.map((b) => ({ rule: b.rule, level: b.level, value: b.value, unit: b.unit })),
  };
  data.runs.unshift(entry); data.runs = data.runs.slice(0, 500);
  for (const b of breached) data.findings.unshift({ at, rule: b.rule, level: b.level, value: b.value, unit: b.unit });
  data.findings = data.findings.slice(0, 1000);
  data.audit.unshift({ at, action: 'run', id: entry.id, breached: breached.length });
  data.audit = data.audit.slice(0, 500);
  save(data);

  let alerted = null;
  const severe = breached.filter((b) => b.level === 'hoch');
  if (severe.length && p.alert !== false) {
    alerted = safe(() => require('./self_call').alert({ trigger: 'watchdog_down', reason: `Selbstüberwachung: ${severe.map((s) => s.name).join(', ')}`, allow_call: false }), { error: 'Alarmleiter nicht erreichbar' });
  }
  return {
    ok: true, run: entry, results,
    verdict: breached.length === 0 ? 'ALLES IM RAHMEN' : `${breached.length} Befund(e): ${breached.map((b) => b.name).join(', ')}`,
    alerted: alerted && alerted.escalation ? { id: alerted.escalation.id, state: alerted.escalation.state } : null,
    rule: 'Diese Prüfung liest nur. Sie repariert nichts heimlich und löscht nichts.',
  };
}

function findings(limit) {
  const d = load();
  return { ok: true, count: d.findings.length, findings: d.findings.slice(0, Number(limit) || 30) };
}

// Regeln und ihre Schwellen offenlegen — damit man sie bewusst ändern kann.
function rules() {
  return { ok: true, rules: RULES.map((r) => ({ id: r.id, name: r.name, level: r.level, threshold: r.threshold, what: r.was, advice: r.advice })), count: RULES.length };
}

function status() {
  const d = load();
  const last = d.runs[0] || null;
  return {
    area: 'AMON', module: 'auto_monitor', state: 'live', file: FILE,
    rules: RULES.length, runs: d.runs.length, findings: d.findings.length,
    last_run: last ? { at: last.at, checked: last.checked, breached: last.breached } : null,
    levels: RULES.reduce((a, r) => { a[r.level] = (a[r.level] || 0) + 1; return a; }, {}),
    rules_text: ['Regeln lesen nur, sie reparieren nichts heimlich.', 'Schwellen sind offen und änderbar.', 'Ernste Befunde gehen an den Menschen (Alarmleiter).', 'Ein Lauf ist nachvollziehbar: wann, was geprüft, was gefunden.'],
  };
}

module.exports = {
  meta: { area: 'AMON', id: 'auto_monitor', name: 'Selbstüberwachung (Regeln, Befunde, Alarm)', state: 'live' },
  actions: { status: () => status(), rules: () => rules(), run: (p) => run(p || {}), findings: (p) => findings((p || {}).limit), runs: () => ({ ok: true, runs: load().runs.slice(0, 20) }) },
  RULES, run, rules, findings, status,
};
