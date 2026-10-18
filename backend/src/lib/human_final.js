'use strict';
// AURA · Letztes Wort des Menschen — als Regel im Code, nicht als Versprechen im Text.
//
// Aufbau:
//   • Es gibt einen Vorhaben-Speicher (Ledger). Jedes Vorhaben, das nach außen wirkt oder Geld kostet,
//     wird hier eingetragen. Anfangs steht es auf PROPOSED (Vorschlag von AURA).
//   • Nur ein Mensch kann es auf APPROVED, REJECTED oder POSTPONED setzen. `decide()` verlangt
//     ausdrücklich `human: true` UND einen Namen — ohne beides passiert nichts.
//   • `guard()` ist die Tür für alles andere im System: eine Aktion ohne menschliche Freigabe
//     bekommt kein „ok". Damit ist das letzte Wort nicht Erziehung, sondern eine Prüfung.
//   • Der Prüfpfad (Audit) ist fortlaufend: wer hat was wann entschieden.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_HUMAN_FINAL_FILE || path.join(__dirname, '..', 'data', 'human_final.json');

// Vorhaben-Arten, die IMMER über den Menschen laufen müssen. Liste ist bindend.
const REQUIRES_HUMAN = [
  { kind: 'PUBLISH', what: 'etwas veröffentlichen (Song, Video, Beitrag)' },
  { kind: 'DISTRIBUTE', what: 'an einen Distributor übergeben' },
  { kind: 'SPEND', what: 'Geld ausgeben (Werbung, Anbieter, Abo)' },
  { kind: 'AI_PROVIDER', what: 'einen KI-Anbieter mit Schlüssel benutzen' },
  { kind: 'OUTREACH', what: 'jemanden außerhalb anschreiben' },
  { kind: 'SECURITY_EJECT', what: 'jemanden endgültig ausschließen' },
  { kind: 'DELETE', what: 'Daten löschen' },
  { kind: 'SCHEMA', what: 'die eigene Struktur ändern' },
];

const HUMAN_DECISIONS = ['APPROVED', 'REJECTED', 'POSTPONED'];

function defaults() { return { ledger: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['ledger', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const needsHuman = (kind) => REQUIRES_HUMAN.some((r) => r.kind === String(kind || '').toUpperCase());

// Vorhaben einreichen — immer als Vorschlag von AURA, nie als Entscheidung.
function propose(input) {
  const data = load();
  const kind = String((input && input.kind) || '').toUpperCase();
  const what = String((input && input.what) || '').trim();
  if (!kind || !what) return { ok: false, error: 'kind und what sind nötig' };
  const entry = {
    id: 'hf-' + Math.random().toString(16).slice(2, 10),
    kind, what: what.slice(0, 800),
    by: String((input && input.by) || 'AURA'),
    evidence: (input && input.evidence) || null,
    status: 'PROPOSED',
    proposed_at: new Date().toISOString(),
    decision: null,
    requires_human: needsHuman(kind) || (input && input.human_required === true),
  };
  data.ledger.unshift(entry); data.ledger = data.ledger.slice(0, 500);
  data.audit.unshift({ at: entry.proposed_at, action: 'propose', id: entry.id, kind });
  data.audit = data.audit.slice(0, 500);
  save(data);
  return { ok: true, entry, rule: 'Das ist ein Vorschlag. Entscheiden kann nur ein Mensch.' };
}

// Entscheidung — nur durch Menschen, nur mit Namen.
function decide(id, input) {
  const data = load();
  const e = data.ledger.find((x) => x.id === id);
  if (!e) return { ok: false, error: 'Vorhaben nicht gefunden' };
  const p = input || {};
  const decision = String(p.decision || '').toUpperCase();
  if (!p.human) return { ok: false, error: 'Nur ein Mensch kann entscheiden (human: true fehlt).', needs: 'human' };
  const who = String(p.by || '').trim();
  if (!who) return { ok: false, error: 'Namen angeben: wer entscheidet?', needs: 'name' };
  if (!HUMAN_DECISIONS.includes(decision)) return { ok: false, error: `Unbekannte Entscheidung "${decision}" — erlaubt: ${HUMAN_DECISIONS.join(', ')}` };
  if (e.status !== 'PROPOSED' && p.override !== true) return { ok: false, error: `Vorhaben steht schon auf ${e.status}. Erneute Entscheidung nur mit override: true.` };
  e.status = decision;
  e.decision = { at: new Date().toISOString(), by: who, decision, reason: String(p.reason || '').slice(0, 500) };
  data.audit.unshift({ at: e.decision.at, action: 'decide', id: e.id, decision, by: who });
  data.audit = data.audit.slice(0, 500);
  save(data);
  return { ok: true, entry: e };
}

// Die Tür: darf diese Sache laufen? Ohne Freigabe: nein.
function guard(input) {
  const kind = String((input && input.kind) || '').toUpperCase();
  const id = (input && input.id) || null;
  if (!needsHuman(kind)) return { ok: true, gate: 'offen', note: `"${kind}" braucht nicht zwingend einen Menschen — AURA darf vorbereiten.` };
  const data = load();
  const e = id ? data.ledger.find((x) => x.id === id) : data.ledger.find((x) => x.kind === kind && x.status === 'APPROVED');
  if (!e) return { ok: false, gate: 'zu', error: `Für "${kind}" gibt es keine menschliche Freigabe.`, next: 'POST /api/human/propose, dann entscheidet ein Mensch.' };
  if (e.status !== 'APPROVED') return { ok: false, gate: 'zu', error: `Vorhaben ${e.id} steht auf ${e.status}.`, entry: { id: e.id, status: e.status } };
  return { ok: true, gate: 'offen', entry: { id: e.id, status: e.status, decided_by: e.decision ? e.decision.by : null } };
}

function open() {
  const data = load();
  const pending = data.ledger.filter((x) => x.status === 'PROPOSED');
  return { ok: true, count: pending.length, pending: pending.map((x) => ({ id: x.id, kind: x.kind, what: x.what.slice(0, 160), by: x.by, at: x.proposed_at, requires_human: x.requires_human })) };
}

function ledger(filter) {
  const items = load().ledger.filter((x) => !filter || !filter.status || x.status === filter.status);
  return { ok: true, count: items.length, items: items.slice(0, 100).map((x) => ({ id: x.id, kind: x.kind, what: x.what.slice(0, 160), status: x.status, decided_by: x.decision ? x.decision.by : null, at: x.proposed_at })) };
}

function status() {
  const d = load();
  const byStatus = {};
  for (const e of d.ledger) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
  return {
    area: 'HF', module: 'human_final', state: 'live', file: FILE,
    ledger: d.ledger.length, by_status: byStatus,
    requires_human: REQUIRES_HUMAN,
    rule: 'Was nach außen wirkt oder Geld kostet, geht nur mit menschlicher Freigabe über diese Tür. Nicht durch Gewohnheit, sondern durch Prüfung.',
    audit_entries: d.audit.length,
  };
}

module.exports = {
  meta: { area: 'HF', id: 'human_final', name: 'Letztes Wort des Menschen (Freigabe-Tür mit Prüfpfad)', state: 'live' },
  actions: { status: () => status(), require: () => ({ ok: true, kinds: REQUIRES_HUMAN }), propose: (p) => propose(p || {}), decide: (p) => decide((p || {}).id, p || {}), guard: (p) => guard(p || {}), open: () => open(), ledger: (p) => ledger(p || {}) },
  REQUIRES_HUMAN, HUMAN_DECISIONS, propose, decide, guard, open, ledger, status, needsHuman,
};
