'use strict';
// AURA Area 12 — Community Incubation (LIVE).
// Echtes Community-Management OHNE synthetisches Engagement: Feedback-Tracker,
// Event-Planung, Antwort-Vorlagen. Plattform-Anbindung nur über offizielle
// APIs mit menschlicher Freigabe (Adapter melden ehrlich NOT-CONNECTED).
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'community.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { feedback: [], events: [], templates: defaultTemplates() }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function defaultTemplates() {
  return [
    { id: 'tpl-welcome', name: 'Welcome', text: 'Willkommen! Schön, dass du da bist. Worum geht es bei dir?' },
    { id: 'tpl-thanks', name: 'Danke für Feedback', text: 'Danke für dein Feedback — wir schauen es uns an und melden uns.' },
    { id: 'tpl-issue', name: 'Problem aufgenommen', text: 'Danke für den Hinweis. Wir haben es aufgenommen und prüfen die nächsten Schritte.' },
  ];
}

function addFeedback(body) {
  const text = String((body || {}).text || '').trim().slice(0, 2000);
  if (!text) { const e = new Error('text fehlt'); e.code = 400; throw e; }
  const db = load();
  const item = {
    id: 'fb-' + Date.now().toString(36),
    from: String(body.from || 'anonym').slice(0, 80),
    channel: ['direct', 'telegram', 'discord', 'mail', 'other'].includes(body.channel) ? body.channel : 'other',
    text, sentiment: ['positive', 'neutral', 'negative'].includes(body.sentiment) ? body.sentiment : 'neutral',
    status: 'open', created_at: new Date().toISOString(),
  };
  db.feedback.push(item); save(db);
  return { ok: true, item };
}
function closeFeedback(id, reply) {
  const db = load();
  const f = db.feedback.find((x) => x.id === id);
  if (!f) { const e = new Error('Feedback nicht gefunden'); e.code = 404; throw e; }
  f.status = 'closed'; f.reply = String(reply || '').slice(0, 1000); f.closed_at = new Date().toISOString();
  save(db);
  return { ok: true, id };
}
function addEvent(body) {
  const title = String((body || {}).title || '').trim().slice(0, 120);
  if (!title) { const e = new Error('title fehlt'); e.code = 400; throw e; }
  const db = load();
  const ev = { id: 'ev-' + Date.now().toString(36), title, date: String(body.date || '').slice(0, 20), location: String(body.location || '').slice(0, 120), capacity: Math.max(0, parseInt(body.capacity || 0, 10) || 0), signups: [], created_at: new Date().toISOString() };
  db.events.push(ev); save(db);
  return { ok: true, event: ev };
}
function signup(eventId, name) {
  const db = load();
  const ev = db.events.find((x) => x.id === eventId);
  if (!ev) { const e = new Error('Event nicht gefunden'); e.code = 404; throw e; }
  const who = String(name || '').trim().slice(0, 80);
  if (!who) { const e = new Error('name fehlt'); e.code = 400; throw e; }
  if (ev.capacity && ev.signups.length >= ev.capacity) { const e = new Error('Event voll'); e.code = 409; throw e; }
  if (ev.signups.includes(who)) return { ok: true, duplicate: true };
  ev.signups.push(who); save(db);
  return { ok: true, event: ev.id, signups: ev.signups.length };
}
function saveTemplate(body) {
  const db = load();
  const name = String((body || {}).name || '').trim().slice(0, 60);
  const text = String(body.text || '').trim().slice(0, 1000);
  if (!name || !text) { const e = new Error('name + text fehlen'); e.code = 400; throw e; }
  const id = 'tpl-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  db.templates = (db.templates || []).filter((t) => t.id !== id);
  db.templates.push({ id, name, text }); save(db);
  return { ok: true, template: { id, name, text } };
}
function status() {
  const db = load();
  return {
    area: '12', mode: 'LIVE',
    feedback: { total: db.feedback.length, open: db.feedback.filter((f) => f.status === 'open').length },
    events: db.events.length, templates: (db.templates || []).length,
    platform_adapters: { telegram: 'über Area 78 (offizielle Bot API)', discord: 'NOT-CONNECTED (offizieller Bot + Freigabe nötig)', note: 'KEIN synthetisches Engagement — nur echte Interaktion, menschliche Freigabe' },
  };
}

module.exports = {
  meta: { area: '12', id: 'community_incubator', name: 'Community incubation (feedback/events/templates, no synthetic engagement)', state: 'live' },
  actions: { status: () => status(), feedback_add: (p) => addFeedback(p || {}), feedback_close: (p) => closeFeedback(String((p || {}).id), (p || {}).reply), event_add: (p) => addEvent(p || {}), signup: (p) => signup(String((p || {}).event), (p || {}).name), template_save: (p) => saveTemplate(p || {}) },
  status, addFeedback, closeFeedback, addEvent, signup, saveTemplate,
};
