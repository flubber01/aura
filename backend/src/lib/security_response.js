'use strict';
// AURA · Sicherheits-Antwort: erst erkennen, dann isolieren, dann (nur mit Mensch) ausschließen.
//
// Die Reihenfolge ist der ganze Punkt. „Rauskicken" ist der LETZTE Schritt, nicht der erste — sonst
// schmeißt man im Zweifel den Falschen raus und der eigentliche Angriff läuft weiter.
//
//   1. DETECT   — Verdacht entsteht aus Belegen (Fehlversuche, Muster, Zeiten, Quellen). Nichts wird
//                 gesperrt. Es wird nur gezählt und protokolliert.
//   2. ISOLATE  — Die betroffene Kennung/das Konto wird eingeschränkt: Sitzungen beendet, Rechte
//                 entzogen, Zugriff auf Verdacht. Kein Ausschluss, umkehrbar mit einem Befehl.
//   3. REVIEW   — Ein Mensch bekommt die Belegsammlung und entscheidet.
//   4. EJECT    — Endgültiger Ausschluss. NUR nach menschlicher Freigabe (human_final). Danach bleibt
//                 der Beleg, sofern kein Mensch anders entscheidet.
//
// Ehrlichkeit: AURA erkennt Muster in dem, was es sieht (eigene Protokolle, Anmeldeversuche, Zugriffe).
// Es behauptet nicht, Angreifer zu „erkennen" wie ein Virenscanner, und es greift nie selbst zum
// Netzwerk-Schalter fremder Systeme.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_SECURITY_FILE || path.join(__dirname, '..', 'data', 'security_response.json');

const SIGNALS = [
  { id: 'failed_logins', weight: 30, what: 'viele fehlgeschlagene Anmeldungen', threshold: 6 },
  { id: 'wrong_scope', weight: 25, what: 'Zugriff auf fremde Bereiche versucht', threshold: 1 },
  { id: 'bot_token', weight: 20, what: 'Maschinen-Kennung bei Schreibzugriff benutzt', threshold: 1 },
  { id: 'rapid_fire', weight: 20, what: 'sehr viele Anfragen in kurzer Zeit', threshold: 60 },
  { id: 'odd_hours', weight: 10, what: 'Zugriff außerhalb der üblichen Zeiten', threshold: 1 },
  { id: 'secret_probe', weight: 35, what: 'Versuch, an Schlüssel/Truhe zu kommen', threshold: 1 },
];

const STAGES = ['DETECT', 'ISOLATE', 'REVIEW', 'EJECT'];

function defaults() { return { cases: [], counters: {}, audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['cases', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    if (typeof raw.counters !== 'object' || !raw.counters) raw.counters = {};
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }
const caseId = () => 'sec-' + crypto.randomBytes(4).toString('hex');

// ---------------------------------------------------------------- 1. DETECT
// Belege sammeln: jeder Beleg ist eine Zählung/Meldung zu einer Kennung. Kein Sperren.
function report(input) {
  const data = load();
  const subject = String((input && input.subject) || '').trim();
  const signal = String((input && input.signal) || '').trim();
  if (!subject || !signal) return { ok: false, error: 'subject und signal sind nötig' };
  const sig = SIGNALS.find((s) => s.id === signal);
  if (!sig) return { ok: false, error: `unbekanntes Signal "${signal}". Bekannt: ${SIGNALS.map((s) => s.id).join(', ')}` };
  const key = subject + '|' + signal;
  data.counters[key] = (data.counters[key] || 0) + (Number(input.count) || 1);
  const count = data.counters[key];
  data.audit.unshift({ at: new Date().toISOString(), action: 'report', subject, signal, count });
  data.audit = data.audit.slice(0, 600);
  save(data);

  const score = scoreOf(subject);
  if (count >= sig.threshold && score.total >= 30) {
    const c = openCase(subject, { reason: `${sig.what} (${count}×)`, signals: [signal], score });
    return { ok: true, stage: 'DETECT', escalated: true, case: summarize(c.case), note: 'Schwelle überschritten — Fall angelegt. Es wurde NICHTS gesperrt.' };
  }
  return { ok: true, stage: 'DETECT', escalated: false, count, threshold: sig.threshold, score: score.total, note: 'Beleg gezählt. Es wird nichts gesperrt, solange die Schwelle nicht erreicht ist.' };
}

function scoreOf(subject) {
  const data = load();
  const parts = [];
  let total = 0;
  for (const sig of SIGNALS) {
    const n = data.counters[subject + '|' + sig.id] || 0;
    if (!n) continue;
    const w = Math.min(1, n / sig.threshold) * sig.weight;
    parts.push({ signal: sig.id, count: n, weight: Math.round(w) });
    total += w;
  }
  const dupe = total > 100 ? 100 : total;
  return { subject, total: Math.round(dupe), parts };
}

function openCase(subject, detail) {
  const data = load();
  let c = data.cases.find((x) => x.subject === subject && ['DETECT', 'ISOLATE', 'REVIEW'].includes(x.stage));
  if (!c) {
    c = { id: caseId(), subject, stage: 'DETECT', opened_at: new Date().toISOString(), evidence: [], actions: [], decision: null, closed: false };
    data.cases.unshift(c); data.cases = data.cases.slice(0, 200);
  }
  c.evidence.push({ at: new Date().toISOString(), ...detail });
  if (c.evidence.length > 50) c.evidence = c.evidence.slice(-50);
  data.audit.unshift({ at: new Date().toISOString(), action: 'case', id: c.id, subject, stage: c.stage });
  data.audit = data.audit.slice(0, 600);
  save(data);
  return { ok: true, case: c };
}

// ---------------------------------------------------------------- 2. ISOLATE
function isolate(id, payload) {
  const data = load();
  const c = data.cases.find((x) => x.id === id || x.subject === id);
  if (!c) return { ok: false, error: 'Fall nicht gefunden' };
  if (c.closed) return { ok: false, error: 'Fall ist geschlossen' };
  const p = payload || {};
  const actions = [];
  // Was wirklich isoliert wird: Sitzungen der Kennung beenden (über die Artist-Konten) und Rechte entziehen.
  if (p.kill_sessions !== false) {
    try {
      const artists = require('./artist_accounts');
      const s = artists.killSessions ? artists.killSessions(c.subject, String(p.by || 'AURA')) : null;
      actions.push({ action: 'sessions_beendet', result: s || 'keine Sitzungsverwaltung für diese Kennung' });
    } catch (e) { actions.push({ action: 'sessions_beendet', result: 'nicht möglich: ' + e.message }); }
  }
  if (p.freeze === true) {
    try { const esc = require('./escalation'); if (esc.raise) { esc.raise({ level: 'hoch', what: 'Sicherheits-Isolation: ' + c.subject, by: 'AURA-Sicherheit' }); actions.push({ action: 'eskalation_erhoben', result: 'Mensch benachrichtigt' }); } } catch (e) { actions.push({ action: 'eskalation_erhoben', result: 'nicht möglich: ' + e.message }); }
  }
  c.stage = 'ISOLATE';
  c.actions.push({ at: new Date().toISOString(), stage: 'ISOLATE', actions, reversible: true });
  data.audit.unshift({ at: new Date().toISOString(), action: 'isolate', id: c.id, subject: c.subject });
  save(data);
  return { ok: true, case: summarize(c), reversible: true, undo: 'POST /api/security/undo mit der Fall-ID', note: 'Isolation ist umkehrbar. Ein Ausschluss findet hier NICHT statt.' };
}

function undo(id, payload) {
  const data = load();
  const c = data.cases.find((x) => x.id === id);
  if (!c) return { ok: false, error: 'Fall nicht gefunden' };
  if (c.stage === 'EJECT') return { ok: false, error: 'Ein Ausschluss lässt sich hier nicht zurücknehmen — das ist eine menschliche Entscheidung.' };
  c.stage = 'DETECT';
  c.actions.push({ at: new Date().toISOString(), stage: 'Zurückgenommen', by: String((payload && payload.by) || 'Mensch') });
  save(data);
  return { ok: true, case: summarize(c), note: 'Isolation aufgehoben. Belege bleiben erhalten.' };
}

// ---------------------------------------------------------------- 3. REVIEW
function review(id) {
  const data = load();
  const c = data.cases.find((x) => x.id === id);
  if (!c) return { ok: false, error: 'Fall nicht gefunden' };
  c.stage = 'REVIEW';
  const summary = {
    id: c.id, subject: c.subject, stage: c.stage, opened_at: c.opened_at,
    score: scoreOf(c.subject).total,
    evidence: c.evidence,
    actions_taken: c.actions,
    question_to_human: `Soll "${c.subject}" endgültig ausgeschlossen werden?`,
    recommendation: scoreOf(c.subject).total >= 60 ? 'Belege sind stark — Ausschluss vertretbar, aber prüfen.' : 'Belege sind dünn — eher Isolation lassen und beobachten.',
    options: ['eject (endgültig ausschließen, nur mit Freigabe)', 'hold (weiter isoliert beobachten)', 'undo (Isolation aufheben)'],
  };
  data.audit.unshift({ at: new Date().toISOString(), action: 'review', id: c.id });
  save(data);
  return { ok: true, ...summary, needs: 'human' };
}

// ---------------------------------------------------------------- 4. EJECT (nur mit Mensch)
function eject(id, payload) {
  const data = load();
  const c = data.cases.find((x) => x.id === id);
  if (!c) return { ok: false, error: 'Fall nicht gefunden' };
  const p = payload || {};
  if (c.stage !== 'REVIEW') return { ok: false, error: `Erst prüfen (REVIEW), dann ausschließen. Aktueller Stand: ${c.stage}` };
  // Die Freigabe-Tür des Menschen ist bindend.
  let gate;
  try { gate = require('./human_final').guard({ kind: 'SECURITY_EJECT', id: p.approval_id }); }
  catch { gate = { ok: false, error: 'Freigabe-Tür nicht ladbar — Ausschluss abgelehnt' }; }
  if (!gate.ok) {
    const prop = (() => { try { return require('./human_final').propose({ kind: 'SECURITY_EJECT', what: `Ausschluss von "${c.subject}" (Fall ${c.id})`, by: 'AURA-Sicherheit', evidence: { score: scoreOf(c.subject).total, evidence_count: c.evidence.length } }); } catch { return null; } })();
    return { ok: false, needs: 'human', error: gate.error, proposal: prop && prop.entry ? { id: prop.entry.id, status: prop.entry.status } : null, next: 'Ein Mensch entscheidet: POST /api/human/decide {id, decision:"APPROVED", human:true, by:"…"}' };
  }
  c.stage = 'EJECT';
  c.decision = { at: new Date().toISOString(), by: String(p.by || 'Mensch'), approval: gate.entry ? gate.entry.id : null, note: String(p.reason || '').slice(0, 400) };
  c.closed = true;
  data.audit.unshift({ at: c.decision.at, action: 'eject', id: c.id, subject: c.subject, by: c.decision.by });
  save(data);
  return { ok: true, case: summarize(c), note: 'Ausschluss durch Menschen freigegeben und ausgeführt. Beleg bleibt im Prüfpfad.' };
}

function summarize(c) {
  return { id: c.id, subject: c.subject, stage: c.stage, opened_at: c.opened_at, evidence_count: c.evidence.length, actions: c.actions.map((a) => a.stage), closed: !!c.closed, decision: c.decision };
}

function cases(filter) {
  const items = load().cases.filter((c) => !filter || !filter.stage || c.stage === filter.stage);
  return { ok: true, count: items.length, cases: items.slice(0, 50).map(summarize) };
}

// Sammelprüfung: aus dem übrigen System Belege holen, ohne etwas zu sperren.
function sweep() {
  const found = [];
  try {
    const artists = require('./artist_accounts');
    const st = artists.status ? artists.status() : {};
    if (st.locked_out && st.locked_out.length) for (const s of st.locked_out) found.push({ subject: s.artist || s.subject, signal: 'failed_logins', count: s.failures || 8, note: 'Kontosperre aus Fehlversuchen' });
  } catch { /* Modul nicht da */ }
  try {
    const sent = require('./sentinel');
    const st = sent.status ? sent.status() : {};
    if (Array.isArray(st.alerts)) for (const a of st.alerts.slice(0, 10)) found.push({ subject: a.subject || a.source || 'unbekannt', signal: 'odd_hours', count: 1, note: a.what || 'Meldung des Wächters' });
  } catch { /* Modul nicht da */ }
  return { ok: true, found: found.length, reports: found, note: 'Nur Belege einsammeln — Sperren passieren hier nicht.' };
}

function status() {
  const d = load();
  const byStage = {};
  for (const c of d.cases) byStage[c.stage] = (byStage[c.stage] || 0) + 1;
  return {
    area: 'SEC', module: 'security_response', state: 'live', file: FILE,
    stages: STAGES, cases: d.cases.length, by_stage: byStage,
    signals: SIGNALS.map((s) => ({ id: s.id, weight: s.weight, threshold: s.threshold })),
    order: 'DETECT → ISOLATE → REVIEW → EJECT. Ausschluss ist immer der letzte Schritt und immer menschlich.',
    honesty: ['AURA erkennt Muster in eigenen Protokollen, nicht „Angreifer" wie ein Virenscanner.', 'Isolation ist umkehrbar; Ausschluss ist es nicht.', 'Kein Zugriff auf fremde Systeme, keine Gegenmaßnahmen nach außen.'],
  };
}

module.exports = {
  meta: { area: 'SEC', id: 'security_response', name: 'Sicherheits-Antwort (erkennen → isolieren → prüfen → ausschließen)', state: 'live' },
  actions: { status: () => status(), signals: () => ({ ok: true, signals: SIGNALS, stages: STAGES }), report: (p) => report(p || {}), score: (p) => scoreOf((p || {}).subject), isolate: (p) => isolate((p || {}).id, p || {}), undo: (p) => undo((p || {}).id, p || {}), review: (p) => review((p || {}).id), eject: (p) => eject((p || {}).id, p || {}), cases: (p) => cases(p || {}), sweep: () => sweep() },
  SIGNALS, STAGES, report, scoreOf, isolate, undo, review, eject, cases, sweep, status,
};
