'use strict';
// AURA — J.A.R.V.I.S. phrasing via Ollama (own host, free, local). Optional.
// The model ONLY rephrases FACTS computed by the deterministic engine (jarvis.js).
// It is never allowed to add numbers or states. Off unless OLLAMA_URL is set.
// Server-side only: the browser never talks to Ollama directly.
//
//   OLLAMA_URL=http://<host>:11434   (required to enable)
//   OLLAMA_MODEL=llama3.2            (default; any model you have pulled)
//   OLLAMA_TIMEOUT_MS=20000          (1000–120000)
const http = require('http');
const https = require('https');

function cfg() {
  const raw = (process.env.OLLAMA_URL || '').trim();
  const model = (process.env.OLLAMA_MODEL || 'llama3.2').trim();
  const timeoutMs = Math.min(Math.max(Number(process.env.OLLAMA_TIMEOUT_MS) || 20000, 1000), 120000);
  let base = null;
  if (raw) {
    try {
      const u = new URL(raw);
      if (/^https?:$/.test(u.protocol)) base = u.origin;
    } catch { base = null; }
  }
  return { configured: Boolean(base), base, model, timeoutMs };
}

function request(base, path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, base);
    const mod = u.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const headers = data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {};
    const req = mod.request(u, { method: data ? 'POST' : 'GET', headers }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        buf += c;
        if (buf.length > 200000) req.destroy(new Error('response too large'));
      });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('ollama HTTP ' + res.statusCode));
        try { resolve(JSON.parse(buf)); } catch { reject(new Error('ollama returned non-JSON')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout after ' + timeoutMs + 'ms')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const SYSTEM = [
  'Du bist J.A.R.V.I.S., der Assistent von AURA.',
  'Antworte auf Deutsch, locker und knapp (höchstens 4 Sätze).',
  'Nutze NUR die Fakten im Block FAKTEN. Erfinde keine Zahlen, Namen oder Zustände.',
  'Wenn die Fakten die Frage nicht beantworten, sag das ehrlich und schlag vor, was man fragen kann: status, learning, containers, backups, logs, traffic, research <thema>.',
].join('\n');

async function phrase({ question, facts }) {
  const c = cfg();
  if (!c.configured) return { used: false, reason: 'OLLAMA_URL nicht gesetzt' };
  const user = 'FRAGE: ' + String(question || '').slice(0, 800) + '\n\nFAKTEN:\n' + String(facts || '').slice(0, 4000);
  try {
    const r = await request(c.base, '/api/chat', {
      model: c.model,
      stream: false,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
      options: { temperature: 0.3, num_predict: 300 },
    }, c.timeoutMs);
    const text = r && r.message && typeof r.message.content === 'string' ? r.message.content.trim() : '';
    if (!text) return { used: false, reason: 'leere Antwort' };
    return { used: true, text, model: c.model };
  } catch (e) {
    return { used: false, reason: e.message };
  }
}

async function status() {
  const c = cfg();
  if (!c.configured) {
    return { configured: false, reachable: false, model: c.model, hint: 'OLLAMA_URL setzen, z. B. http://<dein-host>:11434' };
  }
  try {
    const t = await request(c.base, '/api/tags', null, 3000);
    const names = (t.models || []).map((m) => m.name);
    const present = names.some((n) => n === c.model || n.startsWith(c.model + ':'));
    return { configured: true, reachable: true, model: c.model, model_present: present, models: names.slice(0, 20) };
  } catch (e) {
    return { configured: true, reachable: false, model: c.model, error: e.message };
  }
}

module.exports = { phrase, status, cfg };
