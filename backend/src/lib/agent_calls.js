'use strict';
// AURA · Agenten rufen Agenten (agents call agents).
//
// Bisher gab es den Funkkanal (agent_intercom) — Nachrichten von Hand. Hier kommt das RUFEN dazu:
// ein Agent beauftragt einen anderen mit einer konkreten Fähigkeit und bekommt ein Ergebnis zurück.
//
// Regeln, ohne die so etwas gefährlich wird:
//  1. Ruf-Tiefe begrenzt (standardmäßig 3). Ein Agent, der sich selbst ruft, wird nach der Tiefe
//     gestoppt — keine Endlosschleife, keine Kostenexplosion.
//  2. Nur Fähigkeiten, die im Katalog stehen (Katalog = Module mit `actions`). Alles andere = unbekannt
//     und wird abgelehnt, nicht "irgendwie" ausgeführt.
//  3. Sperrliste: Fähigkeiten, die nach außen wirken oder Geld kosten, sind für Agent-zu-Agent gesperrt.
//     Sie brauchen immer einen Menschen (menschliches letztes Wort).
//  4. Jeder Ruf wird protokolliert: wer, wen, womit, Ergebnis, Dauer. Nachvollziehbar bis zum Schluss.
//  5. Zeitgrenze pro Ruf. Ein hängender Agent blockiert die Kette nicht.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_AGENT_CALLS_FILE || path.join(__dirname, '..', 'data', 'agent_calls.json');
const MAX_DEPTH = Number(process.env.AURA_AGENT_MAX_DEPTH || 3);
const TIMEOUT_MS = Number(process.env.AURA_AGENT_CALL_TIMEOUT_MS || 4000);

// Ganze Module, die für Agent-zu-Agent tabu sind: die Tür zum Menschen, die Steuerzentrale,
// alles, was Geld kostet oder nach außen wirkt, Sicherheits-Ausschluss und Schlüsseltruhen.
const BLOCKED_AGENTS = [
  'human_final',      // die Freigabe-Tür selbst — ein Agent darf sich seine Freigabe nicht selbst holen
  'control_center', 'release_gate', 'billing_plans', 'advertising',
  'security_response', 'self_call', 'vault', 'backup_vault', 'admin_auth', 'remote_approval',
];

// Fähigkeiten, die aus JEDEM Modul heraus gesperrt sind (nach außen oder Geld).
const BLOCKED_ACTIONS = [
  'publish', 'release', 'distribute', 'requestpublish', 'decide', 'approve', 'deny',
  'charge', 'spend', 'eject', 'delete', 'remove', 'kill', 'revive',
];

const HUMAN_ONLY = [...BLOCKED_AGENTS, ...BLOCKED_ACTIONS];

// Agenten = Module, die etwas können. Aus dem Katalog gelesen, nicht erfunden.
function catalog() {
  const dir = __dirname;
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    if (['agent_calls'].includes(f.replace(/\.js$/, ''))) continue;
    let mod = null;
    try { mod = require(path.join(dir, f)); } catch { continue; }
    if (!mod || typeof mod !== 'object') continue;
    let actions = [];
    if (mod.actions && typeof mod.actions === 'object') actions = Object.keys(mod.actions);
    else actions = Object.keys(mod).filter((k) => typeof mod[k] === 'function').slice(0, 20);
    if (!actions.length) continue;
    out.push({ id: f.replace(/\.js$/, ''), area: (mod.meta && mod.meta.area) || null, name: (mod.meta && mod.meta.name) || f, state: (mod.meta && mod.meta.state) || 'unbekannt', actions });
  }
  return out;
}

function defaults() { return { calls: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['calls', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function isBlocked(agentId, action) {
  const a = String(agentId).toLowerCase();
  const fn = String(action).toLowerCase();
  if (BLOCKED_AGENTS.some((b) => a.includes(b))) return 'Modul ist für Agent-Aufrufe tabu (wirkt nach außen, kostet Geld oder ist die Freigabe-Tür)';
  if (BLOCKED_ACTIONS.some((b) => fn.includes(b))) return 'Fähigkeit ist für Agent-Aufrufe gesperrt (wirkt nach außen oder kostet Geld)';
  return null;
}

function canCall(agentId, action) {
  const mod = catalog().find((m) => m.id === agentId);
  if (!mod) return { ok: false, error: `Agent "${agentId}" steht nicht im Katalog` };
  if (!mod.actions.includes(action)) return { ok: false, error: `Agent "${agentId}" kann "${action}" nicht. Bekannt: ${mod.actions.slice(0, 8).join(', ')}` };
  const blocked = isBlocked(agentId, action);
  if (blocked) return { ok: false, error: `"${agentId}.${action}": ${blocked} — nur mit Mensch.`, needs: 'human' };
  return { ok: true, agent: mod };
}

async function call(input) {
  const from = String((input && input.from) || 'unbekannt');
  const to = String((input && input.to) || '').trim();
  const action = String((input && input.action) || '').trim();
  const payload = (input && input.payload) || {};
  const depth = Number((input && input.depth) || 1);
  const chain = Array.isArray(input && input.chain) ? input.chain.slice() : [from];

  if (!to || !action) return { ok: false, error: 'to (Agent) und action (Fähigkeit) sind nötig' };
  if (depth > MAX_DEPTH) return { ok: false, error: `Ruf-Tiefe ${depth} über der Grenze ${MAX_DEPTH} — Kette gestoppt`, chain, stopped: 'depth' };
  if (to === from) return { ok: false, error: 'Ein Agent darf sich nicht selbst rufen (Endlosschleifen-Schutz)', chain };
  if (chain.includes(to)) return { ok: false, error: `Agent "${to}" ist in dieser Kette schon dran — Zyklus gestoppt`, chain };

  const check = canCall(to, action);
  if (!check.ok) return { ok: false, ...check, chain };

  const data = load();
  const started = Date.now();
  let result;
  try {
    const mod = require(path.join(__dirname, to + '.js'));
    const fn = mod.actions[action];
    result = await Promise.race([
      Promise.resolve().then(() => fn.call(mod.actions, { ...payload, __caller: from, __depth: depth })),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`Zeitgrenze ${TIMEOUT_MS} ms überschritten`)), TIMEOUT_MS)),
    ]);
  } catch (e) { result = { ok: false, error: 'Aufruf fehlgeschlagen: ' + e.message }; }

  const entry = {
    id: 'ac-' + Math.random().toString(16).slice(2, 10),
    at: new Date().toISOString(), from, to, action, depth, chain: [...chain, to],
    ms: Date.now() - started,
    ok: !(result && result.ok === false),
    result_summary: summarise(result),
    payload_keys: Object.keys(payload).slice(0, 12),
  };
  data.calls.unshift(entry); data.calls = data.calls.slice(0, 500);
  data.audit.unshift({ at: entry.at, action: 'call', id: entry.id, from, to, fn: action, ok: entry.ok });
  data.audit = data.audit.slice(0, 500);
  save(data);
  return { ok: true, call: entry, result, note: 'Der Ruf ist protokolliert. Ergebnis ist das, was der gerufene Agent zurückgegeben hat — unverändert.' };
}

// Kurzfassung fürs Protokoll (das Protokoll soll lesbar bleiben, keine Romane).
function summarise(result) {
  if (result === undefined || result === null) return 'kein Ergebnis';
  if (typeof result !== 'object') return String(result).slice(0, 200);
  const keys = Object.keys(result).slice(0, 6);
  const parts = [];
  for (const k of keys) { const v = result[k]; if (['string', 'number', 'boolean'].includes(typeof v)) parts.push(`${k}=${String(v).slice(0, 60)}`); else if (Array.isArray(v)) parts.push(`${k}[${v.length}]`); }
  return parts.join(' · ').slice(0, 300) || `Objekt mit ${keys.length} Feldern`;
}

// Kette abarbeiten: mehrere Rufe hintereinander, das Ergebnis geht als Eingabe weiter.
async function chain(input) {
  const steps = Array.isArray(input && input.steps) ? input.steps : [];
  if (!steps.length) return { ok: false, error: 'steps fehlen' };
  const results = []; let carry = (input && input.payload) || {};
  let depth = 1;
  for (const s of steps) {
    const r = await call({ from: (input && input.from) || 'kette', to: s.to, action: s.action, payload: { ...carry, ...(s.payload || {}) }, depth: depth++, chain: results.map((x) => x.to) });
    results.push(r.call || { to: s.to, action: s.action, ok: false, error: r.error });
    if (!r.ok) return { ok: false, stopped_at: s.to, error: r.error, results, note: 'Kette angehalten — ein Fehler wird nicht übersprungen.' };
    carry = { previous: r.result, previous_agent: s.to };
  }
  return { ok: true, steps: results.length, results, final: carry.previous };
}

function trace(limit) {
  const d = load();
  return { ok: true, count: d.calls.length, calls: d.calls.slice(0, Number(limit) || 25).map((c) => ({ id: c.id, at: c.at, from: c.from, to: c.to, action: c.action, ok: c.ok, ms: c.ms, chain: c.chain })) };
}

function status() {
  const d = load();
  const cat = catalog();
  return {
    area: 'ACA', module: 'agent_calls', state: 'live', file: FILE,
    agents: cat.length, callable_actions: cat.reduce((a, m) => a + m.actions.length, 0),
    max_depth: MAX_DEPTH, timeout_ms: TIMEOUT_MS,
    human_only_count: HUMAN_ONLY.length,
    blocked_agents: BLOCKED_AGENTS.length, blocked_actions: BLOCKED_ACTIONS.length, calls_logged: d.calls.length,
    rules: ['Nur bekannte Agenten und bekannte Fähigkeiten.', 'Kein Selbstaufruf, kein Zyklus, Tiefe begrenzt.', 'Nach-außen- und Geld-Fähigkeiten sind für Agenten gesperrt.', 'Jeder Ruf wird protokolliert.'],
  };
}

module.exports = {
  meta: { area: 'ACA', id: 'agent_calls', name: 'Agenten rufen Agenten (Rufe, Ketten, Protokoll)', state: 'live' },
  actions: { status: () => status(), catalog: () => ({ ok: true, agents: catalog() }), can: (p) => canCall((p || {}).agent, (p || {}).action), call: (p) => call(p || {}), chain: (p) => chain(p || {}), trace: (p) => trace((p || {}).limit), blocked: () => ({ ok: true, human_only: HUMAN_ONLY }) },
  catalog, canCall, call, chain, trace, status, HUMAN_ONLY, BLOCKED_AGENTS, BLOCKED_ACTIONS, MAX_DEPTH,
};
