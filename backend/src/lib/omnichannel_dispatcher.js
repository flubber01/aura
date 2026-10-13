'use strict';
// AURA Area 13 — Omnichannel Dispatcher (LIVE).
// Echte Dispatch-Queue: Kanäle, Consent-Pflicht, Idempotenz-Keys, Retry-Zähler.
// Adapter: Telegram (Area 78, offizielle Bot API) — alle anderen melden ehrlich
// NOT-CONNECTED bis Credentials gesetzt sind. Versand NUR mit Einwilligung.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'dispatcher.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { queue: [], delivered: [], seen_keys: {} }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const CHANNELS = ['telegram', 'discord', 'slack', 'mail', 'webhook', 'matrix'];

function enqueue(body) {
  const b = body || {};
  const channel = String(b.channel || '');
  if (!CHANNELS.includes(channel)) { const e = new Error('Kanal unbekannt: ' + CHANNELS.join(', ')); e.code = 400; throw e; }
  if (b.consent !== true) { const e = new Error('consent=true ist Pflicht — Versand ohne Einwilligung ist ausgeschlossen'); e.code = 400; throw e; }
  const text = String(b.text || '').trim().slice(0, 4000);
  if (!text) { const e = new Error('text fehlt'); e.code = 400; throw e; }
  const key = String(b.idempotency_key || '').slice(0, 100);
  const db = load();
  if (key) {
    if (db.seen_keys[key]) { const e = new Error('Idempotenz-Key schon verwendet (Duplikat-Schutz)'); e.code = 409; throw e; }
    db.seen_keys[key] = new Date().toISOString();
    const ks = Object.keys(db.seen_keys);
    if (ks.length > 2000) for (const k of ks.slice(0, ks.length - 2000)) delete db.seen_keys[k];
  }
  const item = { id: 'msg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), channel, to: String(b.to || '').slice(0, 200), text, consent: true, idempotency_key: key || null, retries: 0, state: 'queued', created_at: new Date().toISOString() };
  db.queue.push(item); save(db);
  return { ok: true, item };
}

async function flush() {
  const db = load();
  const results = [];
  for (const item of db.queue.slice(0, 25)) {
    if (item.channel === 'telegram') {
      try {
        const tg = require('./telegram_agent');
        const st = await tg.probe();
        if (st.state === 'LIVE' && item.to) {
          const sent = await tg.sendTo(item.to, item.text);
          item.state = sent.ok ? 'delivered' : 'failed';
          item.delivery = { state: st.state, detail: sent.error || 'ok' };
        } else { item.state = 'queued'; item.delivery = { state: st.state, detail: st.detail || 'kein Ziel' }; }
      } catch (e) { item.state = 'failed'; item.retries++; item.delivery = { state: 'ERROR', detail: e.message }; }
    } else {
      item.delivery = { state: 'NOT-CONNECTED', detail: item.channel + ': Adapter braucht offizielle API-Credentials (deploy/.env) — bis dahin ehrlich in der Queue' };
    }
    if (item.state === 'delivered') results.push({ id: item.id, channel: item.channel, result: 'delivered' });
    else if (item.state === 'failed' && item.retries >= 3) { results.push({ id: item.id, channel: item.channel, result: 'dead-letter' }); item.state = 'dead'; }
  }
  const still = [];
  for (const item of db.queue) {
    if (item.state === 'delivered') { db.delivered.push({ ...item, delivered_at: new Date().toISOString() }); if (db.delivered.length > 500) db.delivered = db.delivered.slice(-500); }
    else if (item.state !== 'dead') still.push(item);
  }
  db.queue = still;
  save(db);
  return { ok: true, processed: results.length, results, remaining: db.queue.length };
}

function list() { const db = load(); return { queue: db.queue.slice().reverse(), delivered: db.delivered.slice(-50).reverse() }; }
function status() {
  const db = load();
  return { area: '13', mode: 'LIVE', queued: db.queue.length, delivered_total: db.delivered.length, channels: CHANNELS, rules: ['consent=true Pflicht', 'Idempotenz-Keys gegen Duplikate', 'nur offizielle APIs', 'Retry max. 3 → dead-letter'], adapters: { telegram: 'Area 78 (Bot API)', discord: 'NOT-CONNECTED', slack: 'NOT-CONNECTED', mail: 'über OPS-Mail-Gate', webhook: 'NOT-CONNECTED', matrix: 'NOT-CONNECTED' } };
}

module.exports = {
  meta: { area: '13', id: 'omnichannel_dispatcher', name: 'Omnichannel dispatcher (queue + consent + idempotency)', state: 'live' },
  actions: { status: () => status(), enqueue: (p) => enqueue(p || {}), flush: () => flush(), list: () => list() },
  status, enqueue, flush, list,
};
