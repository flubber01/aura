'use strict';
// AURA Area 84 — Agent Intercom: Chat der Agenten untereinander.
// Department HEADS, SUPER MASTER BRAINS und ULTRA SUPER BRAIN bekommen eigene
// Kanäle, können sich abstimmen und unterhalten.
// Ehrliche Stimmen: ohne laufendes Ollama spricht jeder Agent aus ECHTEN
// Live-Daten seines Verantwortungsbereichs (mode 'local', klar gelabelt).
// Auf dem Host mit Ollama + zugewiesenem Modell (Area 80) spricht der Agent
// über sein Modell (mode 'llm'). Admin kann mitposten.
const fs = require('fs');
const path = require('path');
const http = require('http');

const FILE = path.join(__dirname, '..', 'data', 'agent_intercom.json');
const MSG_CAP = 500;

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { messages: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function hier() { return require('./hierarchy'); }

// ---------- Kanäle: live aus der Hierarchie abgeleitet ----------
function dispName(n) {
  if (n.name) return n.name;
  if (n.tier === 1) return 'SUPER · ' + (n.domain || n.id);
  return n.id;
}
function channels() {
  const h = hier();
  const nodes = h.tree();
  const ultra = nodes.find((n) => n.tier === 0);
  const supers = nodes.filter((n) => n.tier === 1 && n.id !== 'gate');
  const heads = nodes.filter((n) => n.tier === 2);
  return [
    { id: 'bridge', name: 'Kommandobrücke (Ultra + Supers + Heads)', desc: 'Abstimmung über alle Ebenen', members: [ultra, ...supers, ...heads].map((n) => ({ id: n.id, name: dispName(n), tier: n.tier })) },
    { id: 'supers', name: 'Super-Brain-Runde (Ultra + Supers)', desc: 'Strategie & Koordination der Superbrains', members: [ultra, ...supers].map((n) => ({ id: n.id, name: dispName(n), tier: n.tier })) },
    { id: 'heads', name: 'Department-Heads', desc: 'Abstimmung der Abteilungsleiter', members: heads.map((n) => ({ id: n.id, name: dispName(n), tier: n.tier })) },
  ];
}
function channel(id) { return channels().find((c) => c.id === id); }
function isMember(channelId, nodeId) {
  if (nodeId === 'admin') return true;
  const c = channel(channelId);
  return !!c && c.members.some((m) => m.id === nodeId);
}

// ---------- lokale Stimme: echte Daten des Verantwortungsbereichs ----------
function localVoice(node, topic) {
  const registry = require('./registry');
  const ops = require('./ops');
  const store = require('./store');
  const t = (topic ? ' Zum Thema "' + topic + '":' : '');
  if (node.tier === 0) {
    const c = registry.counts(); const o = ops.status(); const k = hier().knowledge();
    return `ULTRA-Lagebericht:${t} Flotte ${c.live}/${c.total} live, Scheduler ${o.scheduler_running ? 'läuft' : 'pausiert'}, Kill-Switch ${o.kill_switch.on ? 'AKTIV' : 'bereit'}. Lernkurve: ${k.total_events} Feedback-Ereignisse, Erfolgsquote ${k.fleet_rate == null ? 'n/a' : Math.round(k.fleet_rate * 100) + '%'}. Meine Direktive: Prioritäten halten, ehrlich bleiben, Menschen entscheiden lassen.`;
  }
  if (node.tier === 1) {
    const DEPTS = node.departments || [];
    return `SUPER-Lagebericht (${dispName(node)}):${t} Ich koordiniere die Departments ${DEPTS.join(', ') || '—'}. Status: ${registry.counts().live} Live-Module in der Flotte, Audit-Ereignisse: ${store.get().audit.length}. Meine Köpfe sollen Blocker sofort melden; ich eskaliere nur, was ich nicht selbst lösen kann.`;
  }
  if (node.tier === 2) {
    const dept = node.department;
    const liveMods = registry.status().filter((m) => m.mode === 'live');
    const audit = store.get().audit.slice(-200).filter((a) => String(a.area || '').toLowerCase().includes(String(dept || '').toLowerCase()));
    const fb = hier().stats(node.id);
    return `HEAD-Lagebericht (${dispName(node)}):${t} Department ${dept}: ${audit.length} recente Audit-Ereignisse, meine Bilanz ${fb.success}✓/${fb.failure}✗. ${liveMods.length} Flotten-Module live. Ich delegiere atomare Tasks an meine Minions und verifiziere jede Ausgabe, bevor sie nach oben geht.`;
  }
  return `(${dispName(node)}) meldet sich:${t} bereit.`;
}

// ---------- LLM-Stimme (Host mit Ollama + Area-80-Zuweisung) ----------
async function llmVoice(node, topic, historyText) {
  const brainMapper = require('./brain_mapper');
  const ollama = require('./ollama_manager');
  const assignment = brainMapper.agentFor(node.id);
  if (!assignment || !assignment.agent) return null;
  const probe = await ollama.probe(1200);
  if (probe.state !== 'LIVE') return null;
  const bundle = hier().bundle(node.id);
  const prompt = [
    bundle ? bundle.system_prompt : '',
    'Du bist Teil des AURA-Agenten-Chats und antwortest als ' + dispName(node) + ' kurz und konkret (max. 3 Sätze).',
    historyText ? 'Bisheriger Verlauf:\n' + historyText : '',
    (topic ? 'Thema: ' + topic + '\n' : '') + 'Deine Antwort:',
  ].filter(Boolean).join('\n\n');
  return new Promise((resolve) => {
    const u = new URL((ollama.load().url || 'http://127.0.0.1:11434').replace(/\/$/, '') + '/api/generate');
    const req = http.request({ hostname: u.hostname, port: u.port || 11434, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 90000 }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => { try { const j = JSON.parse(d); resolve(res.statusCode === 200 && j.response ? String(j.response).slice(0, 1200) : null); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve(null));
    req.write(JSON.stringify({ model: assignment.agent, prompt, stream: false }));
    req.end();
  });
}

// ---------- sprechen ----------
async function speak(body) {
  const channelId = String((body || {}).channel || 'bridge');
  const agentId = String(body.agent || '');
  const topic = String(body.topic || '').slice(0, 300);
  const c = channel(channelId);
  if (!c) { const e = new Error('Kanal unbekannt: ' + channels().map((x) => x.id).join(', ')); e.code = 404; throw e; }
  if (!isMember(channelId, agentId)) { const e = new Error('"' + agentId + '" ist kein Mitglied von #' + channelId + ' (nur gelistete Agenten sprechen dort)'); e.code = 403; throw e; }
  const node = hier().get(agentId);
  if (!node) { const e = new Error('Agent unbekannt: ' + agentId); e.code = 404; throw e; }
  const db = load();
  const history = db.messages.filter((m) => m.channel === channelId).slice(-6).map((m) => m.name + ': ' + m.text).join('\n');
  let text = null, mode = 'local';
  try { text = await llmVoice(node, topic, history); } catch {}
  if (text) mode = 'llm'; else { text = localVoice(node, topic); mode = 'local'; }
  const msg = { id: 'im-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), channel: channelId, from: agentId, name: dispName(node), tier: node.tier, mode, topic: topic || null, text, at: new Date().toISOString() };
  db.messages.push(msg); if (db.messages.length > MSG_CAP) db.messages = db.messages.slice(-MSG_CAP);
  save(db);
  return { ok: true, message: msg };
}

// ---------- Admin-Post ----------
function adminPost(body) {
  const channelId = String((body || {}).channel || 'bridge');
  const text = String(body.text || '').trim().slice(0, 2000);
  if (!channel(channelId)) { const e = new Error('Kanal unbekannt'); e.code = 404; throw e; }
  if (!text) { const e = new Error('text fehlt'); e.code = 400; throw e; }
  const db = load();
  const msg = { id: 'im-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), channel: channelId, from: 'admin', name: 'ADMIN', tier: -1, mode: 'admin', topic: null, text, at: new Date().toISOString() };
  db.messages.push(msg); if (db.messages.length > MSG_CAP) db.messages = db.messages.slice(-MSG_CAP);
  save(db);
  return { ok: true, message: msg };
}

// ---------- Besprechung: strukturierte Runde ----------
async function meeting(body) {
  const topic = String((body || {}).topic || 'Lagebesprechung').slice(0, 300);
  const c = channel('bridge');
  const db = load();
  db.messages.push({ id: 'im-' + Date.now().toString(36) + '-open', channel: 'bridge', from: 'system', name: 'SYSTEM', tier: -1, mode: 'admin', topic, text: '📢 Besprechung eröffnet: ' + topic, at: new Date().toISOString() });
  save(db);
  // Reihenfolge: Heads (max. 8) → alle Supers → Ultra als Abschluss (garantiert)
  const order = [...c.members.filter((m) => m.tier === 2).slice(0, 8), ...c.members.filter((m) => m.tier === 1), ...c.members.filter((m) => m.tier === 0)];
  const transcript = [];
  for (const m of order) {
    const r = await speak({ channel: 'bridge', agent: m.id, topic });
    transcript.push(r.message);
  }
  return { ok: true, topic, speakers: transcript.length, transcript, note: transcript.some((t) => t.mode === 'llm') ? 'mindestens eine Stimme lief über ein echtes Modell' : 'alle Stimmen lokal aus Live-Daten (ohne laufendes Ollama ehrlich gelabelt)' };
}

function messages(channelId, limit) {
  const db = load();
  let out = db.messages;
  if (channelId) out = out.filter((m) => m.channel === channelId);
  return out.slice(-(limit || 80));
}
function clear(channelId) {
  const db = load(); const before = db.messages.length;
  db.messages = channelId ? db.messages.filter((m) => m.channel !== channelId) : [];
  save(db);
  return { ok: true, removed: before - db.messages.length };
}
function status() {
  const cs = channels(); const db = load();
  return { area: '84', mode: 'LIVE', channels: cs.map((c) => ({ id: c.id, name: c.name, members: c.members.length })), messages_total: db.messages.length, voices: { local: 'echte Live-Daten des Verantwortungsbereichs', llm: 'zugewiesenes Ollama-Modell (Area 80) — auf dem Host aktiv' } };
}

module.exports = {
  meta: { area: '84', id: 'agent_intercom', name: 'Agent Intercom (Heads/Supers/Ultra chat + meetings)', state: 'live' },
  actions: { status: () => status(), channels: () => channels(), messages: (p) => messages((p || {}).channel, (p || {}).limit), post: (p) => adminPost(p || {}), say: (p) => speak(p || {}), meeting: (p) => meeting(p || {}), clear: (p) => clear((p || {}).channel) },
  status, channels, channel, isMember, speak, adminPost, meeting, messages, clear,
};
