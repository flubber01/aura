'use strict';
// AURA — API-Failover für Sprachmodelle.
// Probiert eine Kette von Endpunkten der Reihe nach. Schlägt einer fehl
// (Netz, Timeout, HTTP-Fehler, leere Antwort), wird er mit Abklingzeit
// markiert und der nächste wird probiert. Erfolgreich getestete Endpunkte
// bleiben vorne. Nichts wird automatisch "repariert" oder neu konfiguriert.
//
// Kette (Standard): ollama (wenn OLLAMA_URL), openrouter (wenn OPENROUTER_API_KEY).
//   AURA_LLM_CHAIN=ollama,openrouter   Reihenfolge überschreiben (optional)
//   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1   (nur https; http nur für localhost)
//   OPENROUTER_MODEL=openrouter/auto
//   AURA_LLM_COOLDOWN_MS=60000         Abklingzeit nach dem 1. Fehler (max. 10 min, verdoppelt sich)
//
// Schlüssel werden nie ausgegeben. Der Status zeigt nur "konfiguriert ja/nein".
const http = require('http');
const https = require('https');
const store = require('./store');

const TIMEOUT_MS = 20000;
const MAX_BODY = 400000;

function isLocalHost(h) { return h === 'localhost' || h === '127.0.0.1' || h === '::1'; }

function safeBase(raw, fallback) {
  const s = String(raw || fallback || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:') return u.origin + u.pathname.replace(/\/+$/, '');
    if (u.protocol === 'http:' && isLocalHost(u.hostname)) return u.origin + u.pathname.replace(/\/+$/, '');
    return null; // kein unverschlüsseltes Ziel außerhalb von localhost
  } catch { return null; }
}

function endpoints() {
  const ollamaBase = safeBase(process.env.OLLAMA_URL, '');
  const orKey = (process.env.OPENROUTER_API_KEY || '').trim();
  const all = {
    ollama: {
      id: 'ollama', kind: 'local', configured: Boolean(ollamaBase),
      base: ollamaBase, model: (process.env.OLLAMA_MODEL || 'llama3.2').trim(),
    },
    openrouter: {
      id: 'openrouter', kind: 'cloud', configured: Boolean(orKey) && Boolean(safeBase(process.env.OPENROUTER_BASE_URL, 'https://openrouter.ai/api/v1')),
      base: safeBase(process.env.OPENROUTER_BASE_URL, 'https://openrouter.ai/api/v1'),
      model: (process.env.OPENROUTER_MODEL || 'openrouter/auto').trim(), key: orKey,
    },
  };
  const want = (process.env.AURA_LLM_CHAIN || 'ollama,openrouter').split(',').map((s) => s.trim()).filter(Boolean);
  return want.map((id) => all[id]).filter(Boolean);
}

const state = {}; // id -> { fails, cooldown_until, last_ok, last_error, last_ms }
const cooldownBase = () => Math.min(Math.max(Number(process.env.AURA_LLM_COOLDOWN_MS) || 60000, 1000), 600000);

function inCooldown(id) { const s = state[id]; return Boolean(s && s.cooldown_until && s.cooldown_until > Date.now()); }
function markFail(id, err) {
  const s = state[id] || (state[id] = { fails: 0 });
  s.fails += 1;
  const wait = Math.min(cooldownBase() * 2 ** (s.fails - 1), 600000);
  s.cooldown_until = Date.now() + wait;
  s.last_error = String(err && err.message || err).slice(0, 200);
  s.last_error_at = new Date().toISOString();
}
function markOk(id, ms) {
  state[id] = { fails: 0, cooldown_until: 0, last_ok: new Date().toISOString(), last_ms: ms };
}

function post(base, path, body, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(base + path);
    const mod = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = mod.request(u, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; if (buf.length > MAX_BODY) req.destroy(new Error('response too large')); });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(buf)); } catch { reject(new Error('non-JSON response')); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout after ' + timeoutMs + 'ms')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callOne(ep, messages) {
  if (ep.id === 'ollama') {
    const r = await post(ep.base, '/api/chat', { model: ep.model, stream: false, messages, options: { temperature: 0.3, num_predict: 300 } }, {}, TIMEOUT_MS);
    return r && r.message && r.message.content;
  }
  // openrouter (OpenAI-kompatibel)
  const r = await post(ep.base, '/chat/completions', { model: ep.model, messages, temperature: 0.3, max_tokens: 300 },
    { authorization: 'Bearer ' + ep.key, 'x-title': 'AURA' }, TIMEOUT_MS);
  return r && r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content;
}

// Hauptfunktion. Gibt { ok, text, endpoint, model, tried } zurück. Wirft nie.
async function complete(messages) {
  const tried = [];
  const chain = endpoints().filter((e) => e.configured);
  if (!chain.length) return { ok: false, reason: 'keine Endpunkte konfiguriert (OLLAMA_URL oder OPENROUTER_API_KEY setzen)', tried };
  for (const ep of chain) {
    if (inCooldown(ep.id)) { tried.push({ id: ep.id, skipped: 'cooldown' }); continue; }
    const t0 = Date.now();
    try {
      const raw = await callOne(ep, messages);
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) throw new Error('leere Antwort');
      markOk(ep.id, Date.now() - t0);
      tried.push({ id: ep.id, ok: true });
      store.audit({ area: 'LLM', event: 'failover_ok', endpoint: ep.id, tried: tried.length });
      return { ok: true, text, endpoint: ep.id, model: ep.model, tried };
    } catch (e) {
      markFail(ep.id, e);
      tried.push({ id: ep.id, ok: false, error: state[ep.id].last_error });
      store.audit({ area: 'LLM', event: 'failover_fail', endpoint: ep.id });
    }
  }
  return { ok: false, reason: 'alle Endpunkte fehlgeschlagen oder im Cooldown', tried };
}

// Status ohne Schlüssel und ohne Netzaufruf.
function status() {
  return {
    chain: endpoints().map((e) => ({
      id: e.id, kind: e.kind, configured: e.configured, model: e.model,
      cooldown: inCooldown(e.id), cooldown_until: state[e.id] && state[e.id].cooldown_until ? new Date(state[e.id].cooldown_until).toISOString() : null,
      last_ok: state[e.id] && state[e.id].last_ok || null,
      last_error: state[e.id] && state[e.id].last_error || null,
      last_error_at: state[e.id] && state[e.id].last_error_at || null,
    })),
    note: 'Schlüssel werden nie angezeigt. Reihenfolge: AURA_LLM_CHAIN oder Standard ollama → openrouter.',
  };
}

function resetCooldowns() { for (const k of Object.keys(state)) { state[k].cooldown_until = 0; state[k].fails = 0; } }

module.exports = { complete, status, endpoints, resetCooldowns, meta: { area: 'LLM', id: 'api_failover', name: 'API-Failover (Sprachmodelle)', state: 'live' } };
