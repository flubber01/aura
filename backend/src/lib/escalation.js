'use strict';
// AURA — Eskalation an den Menschen bei kritischen Ereignissen.
//
// Kritisch sind: Kill-Switch ausgelöst, Integritätsverlust.
// 1) Jedes kritische Ereignis legt einen offenen Eintrag an und versucht den Menschen zu erreichen.
// 2) Der Mensch bestätigt per POST /api/escalations/:id/ack (mit Admin-Token).
// 3) Kommt innerhalb der Frist keine Bestätigung, friert das System ein:
//    Kill-Switch bleibt aktiv, der Autonomie-Loop lernt und heilt nicht mehr.
// 4) Das System hebt nie selbst auf. Wiederanlauf nur über den Menschen (revive mit Token).
//
// Frist: AURA_ESCALATION_TIMEOUT_MS (Standard 15 min, Minimum 60 s).
const crypto = require('crypto');
const store = require('./store');

const CRITICAL = new Set(['kill_switch', 'integrity_loss']);
const DEFAULT_TIMEOUT = 15 * 60 * 1000;
const MAX_KEEP = 100;

let items = [];
let frozen = null; // { since, reason, escalation_id } wenn eingefroren

function timeoutMs() {
  const v = Number(process.env.AURA_ESCALATION_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? Math.max(v, 60000) : DEFAULT_TIMEOUT;
}

// Benachrichtigung über einen konfigurierten Kanal (Telegram). Ohne Kanal wird nur vermerkt.
// Der Versuch wird protokolliert, ein Fehlschlag verlängert nichts.
let notifier = null; // injizierbar für Tests / Telegram-Anbindung
function setNotifier(fn) { notifier = typeof fn === 'function' ? fn : null; }

function raise({ kind, reason }, now = Date.now()) {
  if (!CRITICAL.has(kind)) throw new Error('unbekannte Art: ' + kind);
  const open = items.find((e) => e.kind === kind && e.status === 'waiting_human');
  if (open) return open; // gleiche Art offen: nicht doppelt anlegen
  const e = {
    id: 'ESC-' + crypto.randomBytes(3).toString('hex'),
    kind,
    reason: String(reason || '').slice(0, 300),
    status: 'waiting_human',
    raised_at: new Date(now).toISOString(),
    deadline: new Date(now + timeoutMs()).toISOString(),
    notify: 'pending',
  };
  items.push(e);
  if (items.length > MAX_KEEP) items = items.slice(-MAX_KEEP);
  store.audit({ area: 'ESC', event: 'escalation_raised', id: e.id, kind, reason: e.reason });
  if (notifier) {
    try { Promise.resolve(notifier(e)).then((r) => { e.notify = r && r.ok ? 'sent' : 'failed'; }, () => { e.notify = 'failed'; }); }
    catch { e.notify = 'failed'; }
  } else {
    e.notify = 'no_channel';
  }
  return e;
}

// Wird regelmäßig aufgerufen (vom Autonomie-Loop). Friert ein, wenn die Frist abläuft.
function tick(now = Date.now(), onFreeze = null) {
  const expired = items.filter((e) => e.status === 'waiting_human' && Date.parse(e.deadline) <= now);
  if (!expired.length) return { frozen: Boolean(frozen), expired: 0 };
  for (const e of expired) e.status = 'expired_frozen';
  const first = expired[0];
  frozen = frozen || { since: new Date(now).toISOString(), reason: 'Frist ohne Bestätigung: ' + first.id, escalation_id: first.id };
  store.audit({ area: 'ESC', event: 'safe_freeze', escalation_id: first.id, kind: first.kind });
  if (typeof onFreeze === 'function') { try { onFreeze(frozen); } catch { /* ignorieren, Freeze bleibt gesetzt */ } }
  return { frozen: true, expired: expired.length };
}

// Mensch bestätigt. Hebt die Frist auf, friert aber nicht selbst auf.
function ack(id, by) {
  const e = items.find((x) => x.id === id);
  if (!e) return { ok: false, code: 404, error: 'unbekannte Eskalation' };
  if (e.status !== 'waiting_human' && e.status !== 'expired_frozen') return { ok: false, code: 409, error: 'bereits abgeschlossen' };
  e.status = 'acknowledged';
  e.acknowledged_by = String(by || 'mensch').slice(0, 60);
  e.acknowledged_at = new Date().toISOString();
  store.audit({ area: 'ESC', event: 'escalation_acked', id, by: e.acknowledged_by });
  return { ok: true, escalation: e };
}

// Wiederanlauf nach Einfrieren: nur durch den Menschen (wird vom revive-Pfad aufgerufen, dort mit Token).
function thaw(by) {
  if (!frozen) return { ok: true, was_frozen: false };
  const prev = frozen;
  frozen = null;
  store.audit({ area: 'ESC', event: 'safe_thaw', by: String(by || 'mensch').slice(0, 60), previous: prev.escalation_id });
  return { ok: true, was_frozen: true, previous: prev };
}

function isFrozen() { return Boolean(frozen); }
function list() { return items.slice().reverse(); }
function open() { return items.filter((e) => e.status === 'waiting_human'); }
function status() { return { frozen: frozen, open: open().length, timeout_ms: timeoutMs(), critical_kinds: [...CRITICAL], items: list().slice(0, 20) }; }
function reset() { items = []; frozen = null; }

module.exports = {
  raise, tick, ack, thaw, isFrozen, list, open, status, setNotifier, reset,
  meta: { area: 'ESC', id: 'escalation', name: 'Eskalation an den Menschen (kritische Ereignisse)', state: 'live' },
};
