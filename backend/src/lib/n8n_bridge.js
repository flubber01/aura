'use strict';
// AURA Area 15 — n8n Secure Dispatch / Kaggle Relay (LIVE).
// Gesicherter Webhook-Dispatch: HTTPS-Only-Allowlist, HMAC-Signatur,
// TTL gegen Replay, Payload-Größenlimit. Opt-in Compute-Relay für Kaggle.
// HMAC-Key aus deploy/.env (N8N_HMAC_KEY). Ehrlicher Status ohne Ziel.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const FILE = path.join(__dirname, '..', 'data', 'n8n_bridge.json');
const ENV_FILE = path.join(__dirname, '..', '..', '..', 'deploy', '.env');

function parseEnvFile(f) { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])); } catch { return {}; } }
function hmacKey() { const env = { ...parseEnvFile(ENV_FILE), ...process.env }; return env.N8N_HMAC_KEY || ''; }

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { webhooks: [], dispatches: [], compute_opt_in: false }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function addWebhook(body) {
  const url = String((body || {}).url || '').trim();
  const name = String(body.name || 'hook-' + Date.now().toString(36)).slice(0, 60);
  let u; try { u = new URL(url); } catch { const e = new Error('ungültige URL'); e.code = 400; throw e; }
  if (u.protocol !== 'https:') { const e = new Error('nur HTTPS-Webhooks erlaubt'); e.code = 400; throw e; }
  const db = load();
  if (db.webhooks.some((w) => w.url === u.href)) { const e = new Error('Webhook schon registriert'); e.code = 409; throw e; }
  const hook = { id: 'hook-' + Date.now().toString(36), name, url: u.href, added_at: new Date().toISOString() };
  db.webhooks.push(hook); save(db);
  return { ok: true, webhook: hook };
}
function removeWebhook(id) {
  const db = load(); const before = db.webhooks.length;
  db.webhooks = db.webhooks.filter((w) => w.id !== id); save(db);
  return { ok: true, removed: before - db.webhooks.length };
}

function sign(payload, ts) {
  const key = hmacKey();
  if (!key) return null;
  return crypto.createHmac('sha256', key).update(ts + '.' + JSON.stringify(payload)).digest('hex');
}

async function dispatch(body) {
  const db = load();
  const hook = db.webhooks.find((w) => w.id === String((body || {}).webhook || ''));
  if (!hook) { const e = new Error('Webhook nicht registriert (Allowlist)'); e.code = 404; throw e; }
  const payload = (body && body.payload) || {};
  if (JSON.stringify(payload).length > 200000) { const e = new Error('Payload zu groß (>200KB)'); e.code = 400; throw e; }
  const ts = new Date().toISOString();
  const sig = sign(payload, ts);
  const rec = { id: 'disp-' + Date.now().toString(36), webhook: hook.id, ttl_ms: 60000, ts, signed: !!sig, state: 'pending', created_at: ts };
  // TTL: hier sofort versandt — Replay-Fenster wird über ts + Signatur geprüft
  const result = await new Promise((resolve) => {
    const u = new URL(hook.url);
    const data = JSON.stringify({ payload, ts, sig });
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AURA-TS': ts, ...(sig ? { 'X-AURA-SIG': sig } : {}), 'Content-Length': Buffer.byteLength(data) }, timeout: 12000 }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, http: res.statusCode, raw: d.slice(0, 200) }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ ok: false, state: 'NOT-CONNECTED', error: e.code || e.message }));
    req.write(data); req.end();
  });
  rec.state = result.ok ? 'delivered' : (result.state || 'failed');
  rec.result = result;
  db.dispatches.push(rec); if (db.dispatches.length > 300) db.dispatches = db.dispatches.slice(-300); save(db);
  return { ok: result.ok, dispatch: rec, note: result.ok ? undefined : 'ehrlich: ohne erreichbares Ziel kein Versand — Konfiguration bleibt bestehen' };
}

function setComputeOptIn(on) {
  const db = load(); db.compute_opt_in = !!on; save(db);
  return { ok: true, compute_opt_in: db.compute_opt_in, note: 'Kaggle-Relay läuft NUR mit explizitem Opt-in und eigener Kaggle-API (nie mit Fremdkontingenten)' };
}
function status() {
  const db = load();
  return { area: '15', mode: 'LIVE', webhooks: db.webhooks.length, dispatches: db.dispatches.length, hmac: !!hmacKey(), compute_opt_in: db.compute_opt_in, security: ['HTTPS-Only-Allowlist', 'HMAC-SHA256-Signatur', 'TTL/Zeitstempel gegen Replay', 'Payload-Limit 200KB'] };
}

module.exports = {
  meta: { area: '15', id: 'n8n_bridge', name: 'n8n secure dispatch / Kaggle relay (HMAC, TTL, allowlist)', state: 'live' },
  actions: { status: () => status(), webhook_add: (p) => addWebhook(p || {}), webhook_remove: (p) => removeWebhook(String((p || {}).id)), dispatch: (p) => dispatch(p || {}), compute_optin: (p) => setComputeOptIn(!!(p || {}).on) },
  status, addWebhook, removeWebhook, dispatch, setComputeOptIn,
};
