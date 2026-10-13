'use strict';
// AURA · Steuerzentrale: jede Aktion hat Risikostufe, Schalter und Freigabe.
// - Jede Aktion kann an/aus geschaltet werden.
// - Riskante Aktionen (approval:true) erzeugen eine Freigabe-Anfrage, die nur ein Mensch entscheidet.
// - Der globale Kill-Switch (ops.isKilled) sperrt alles.
// - Speicher: backend/src/data/control.json (git-ignoriert).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_CONTROL_FILE || path.join(__dirname, '..', 'data', 'control.json');
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING = 20;

// Aktionskatalog. risk: low | medium | high. approval: true = Mensch muss freigeben.
const ACTIONS = [
  { id: 'status', name: 'Status lesen', risk: 'low', approval: false, enabled: true },
  { id: 'report', name: 'Bericht lesen', risk: 'low', approval: false, enabled: true },
  { id: 'snapshot', name: 'Snapshot (Backup) erzeugen', risk: 'medium', approval: false, enabled: true },
  { id: 'sync', name: 'Vollsync der Module', risk: 'medium', approval: true, enabled: true },
  { id: 'board_task', name: 'Board-Aufgabe anlegen', risk: 'medium', approval: false, enabled: true },
  { id: 'upload_commit', name: 'Link-Liste übernehmen', risk: 'high', approval: true, enabled: true },
  { id: 'growth_publish', name: 'Veröffentlichung freigeben', risk: 'high', approval: true, enabled: true },
  { id: 'autonomy_heal', name: 'Autonome Selbstheilung', risk: 'high', approval: true, enabled: false },
  { id: 'skill_install', name: 'Skill installieren', risk: 'high', approval: true, enabled: false },
  { id: 'kill', name: 'Kill-Switch auslösen', risk: 'medium', approval: false, enabled: true },
  { id: 'revive', name: 'Kill-Switch lösen', risk: 'high', approval: true, enabled: true },
];

// Akteure, die nie freigeben dürfen (Bots, Agenten, System).
const NON_HUMAN = /(^|[\s_-])(agent|bot|system|auto|daemon|validator)([\s_-]|$)/i;
const isHuman = (by) => typeof by === 'string' && by.trim().length >= 2 && !NON_HUMAN.test(by);

function load() {
  if (!fs.existsSync(FILE)) return { switches: {}, approvals: [] };
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return { switches: {}, approvals: [] }; }
}
function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}
function expire(state) {
  const now = Date.now();
  for (const a of state.approvals) if (a.status === 'pending' && now - Date.parse(a.at) > TTL_MS) a.status = 'expired';
}

function actions() {
  const state = load();
  return ACTIONS.map((a) => ({ ...a, enabled: state.switches[a.id] !== undefined ? state.switches[a.id] : a.enabled }));
}

function setEnabled(id, on, by) {
  const a = ACTIONS.find((x) => x.id === id);
  if (!a) return { ok: false, code: 404, error: 'unbekannte Aktion' };
  if (!isHuman(by)) return { ok: false, code: 403, error: 'nur ein Mensch darf Schalter ändern' };
  const state = load();
  state.switches[id] = !!on;
  save(state);
  return { ok: true, id, enabled: !!on, by };
}

// Prüft, ob eine Aktion jetzt läuft, braucht Freigabe oder ist aus.
function gate(id, { by = '', args = {}, killed = false } = {}) {
  const a = actions().find((x) => x.id === id);
  if (!a) return { ok: false, code: 404, error: 'unbekannte Aktion' };
  if (killed && id !== 'revive' && id !== 'status' && id !== 'report') return { ok: false, code: 423, error: 'KILL SWITCH ENGAGED' };
  if (!a.enabled) return { ok: false, code: 403, error: 'Aktion ist ausgeschaltet' };
  if (!a.approval) return { ok: true, status: 'run', action: a };
  const state = load();
  expire(state);
  if (state.approvals.filter((x) => x.status === 'pending').length >= MAX_PENDING) return { ok: false, code: 429, error: 'zu viele offene Freigaben' };
  const req = { id: 'AP-' + crypto.randomBytes(3).toString('hex'), action: id, by: String(by).slice(0, 60), args, status: 'pending', at: new Date().toISOString() };
  state.approvals.push(req);
  save(state);
  return { ok: false, code: 202, status: 'pending_approval', approval: req };
}

function pending() {
  const state = load();
  expire(state);
  save(state);
  return state.approvals.filter((x) => x.status === 'pending');
}

function decide(apId, decision, by) {
  if (!isHuman(by)) return { ok: false, code: 403, error: 'Freigabe nur durch einen Menschen' };
  if (!['approve', 'deny'].includes(decision)) return { ok: false, code: 400, error: 'approve oder deny' };
  const state = load();
  expire(state);
  const req = state.approvals.find((x) => x.id === apId);
  if (!req) return { ok: false, code: 404, error: 'Freigabe nicht gefunden' };
  if (req.status !== 'pending') return { ok: false, code: 409, error: 'bereits entschieden: ' + req.status };
  req.status = decision === 'approve' ? 'approved' : 'denied';
  req.decided_by = String(by).slice(0, 60);
  req.decided_at = new Date().toISOString();
  save(state);
  return { ok: true, approval: req };
}

module.exports = { ACTIONS, actions, setEnabled, gate, pending, decide, isHuman, FILE };
