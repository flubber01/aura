'use strict';
// AURA Area 35 — Shadow-Ban Sentinel (LIVE, sicher redesign als Delivery-Monitor).
// Keine Plattform-Manipulations-Heuristiken: verfolgt ausschließlich die
// ZUSTELLUNG eigener, über offizielle APIs versandter Inhalte (Delivery
// Receipts aus Area 13) und meldet ehrliche Quoten.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'delivery_monitor.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { items: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function ingestFromDispatcher() {
  const disp = require('./omnichannel_dispatcher');
  const db = load();
  const { delivered } = disp.list();
  let added = 0;
  for (const d of delivered || []) {
    if (db.items.some((x) => x.source_id === d.id)) continue;
    db.items.push({ id: 'del-' + Date.now().toString(36) + '-' + added, source_id: d.id, channel: d.channel, at: d.delivered_at || d.created_at, state: 'delivered', checked_at: new Date().toISOString() });
    added++;
  }
  if (db.items.length > 1000) db.items = db.items.slice(-1000);
  save(db);
  return { ok: true, added, total: db.items.length };
}
function mark(id, state) {
  if (!['delivered', 'not_visible', 'failed'].includes(state)) { const e = new Error('state muss delivered|not_visible|failed sein'); e.code = 400; throw e; }
  const db = load();
  const it = db.items.find((x) => x.id === id);
  if (!it) { const e = new Error('Eintrag nicht gefunden'); e.code = 404; throw e; }
  it.state = state; it.checked_at = new Date().toISOString(); it.manual = true;
  save(db);
  return { ok: true, id, state };
}
function quota() {
  const db = load();
  const byChannel = {};
  for (const it of db.items) {
    byChannel[it.channel] = byChannel[it.channel] || { total: 0, delivered: 0, not_visible: 0, failed: 0 };
    byChannel[it.channel].total++; byChannel[it.channel][it.state]++;
  }
  for (const c of Object.keys(byChannel)) byChannel[c].delivery_pct = Math.round((byChannel[c].delivered / byChannel[c].total) * 100);
  return { ok: true, items: db.items.length, by_channel: byChannel, note: 'nur eigene Inhalte über offizielle APIs — Quoten sind gemessen, nie geschätzt' };
}
function status() {
  const db = load();
  return { area: '35', mode: 'LIVE', tracked: db.items.length, scope: 'Delivery Receipts eigener Inhalte (offizielle APIs) — keine Umgehungs-/Manipulationsfunktionen', crosslink: 'Area 13 Dispatcher' };
}

module.exports = {
  meta: { area: '35', id: 'delivery_monitor', name: 'Delivery monitor (own content via official APIs)', state: 'live' },
  actions: { status: () => status(), ingest: () => ingestFromDispatcher(), mark: (p) => mark(String((p || {}).id), String((p || {}).state)), quota: () => quota() },
  status, ingestFromDispatcher, mark, quota,
};
