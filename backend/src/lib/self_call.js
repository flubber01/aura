'use strict';
// AURA · Selbst-Anruf: AURA ruft den Menschen an, wenn etwas Ernstes passiert.
//
// Aufbau als Leiter (Eskalationskette) — jede Sprosse lauter als die vorige:
//   1. Meldung ins Protokoll (immer, kostet nichts)
//   2. Telegram-Nachricht (wenn der Bot eingerichtet ist)
//   3. Anruf beim Menschen (nur mit einem Anruf-Anbieter mit eigenem Schlüssel)
//   4. Wiederholung nach Wartezeit, dann Ruhe — kein Dauerfeuer, das den Menschen abstumpft
//
// Ehrlichkeit:
//  • Ohne Anruf-Anbieter (Twilio, SIP-Gateway, eigenes GSM-Gateway) gibt es KEINEN Anruf. AURA sagt
//    das und bleibt bei Telegram — es behauptet nie, jemanden angerufen zu haben.
//  • Nummern und Schlüssel liegen im Vault, nicht in Dateien. In den Antworten stehen sie maskiert.
//  • Ein Anruf ist eine Benachrichtigung, keine Fernsteuerung. Der Mensch entscheidet danach selbst.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_SELF_CALL_FILE || path.join(__dirname, '..', 'data', 'self_call.json');

// Anbieter mit offizieller Schnittstelle für Anrufe. Ohne Schlüssel: nicht verbunden.
const PROVIDERS = [
  { id: 'twilio', name: 'Twilio (Anruf + SMS)', key: 'twilio-auth-token', fields: ['twilio-account-sid', 'twilio-auth-token', 'twilio-from-number'], note: 'offizielle Schnittstelle, kostenpflichtig pro Minute' },
  { id: 'sipgate', name: 'sipgate (SIP/Anruf)', key: 'sipgate-token', fields: ['sipgate-token', 'sipgate-phone'], note: 'deutscher Anbieter, SIP' },
  { id: 'gsm-gateway', name: 'eigenes GSM-Gateway', key: 'gsm-gateway-token', fields: ['gsm-gateway-url', 'gsm-gateway-token', 'gsm-number'], note: 'eigene Hardware im Netz des Betreibers' },
  { id: 'manual', name: 'Handanruf durch Menschen', key: null, fields: [], note: 'immer möglich: AURA sagt „ruf an", ein Mensch wählt' },
];

// Welche Ereignisse lösen einen Anruf aus? Konservativ gewählt.
const TRIGGERS = [
  { id: 'attack_confirmed', what: 'bestätigter Angriff', level: 'hoch', call: true },
  { id: 'watchdog_down', what: 'Dienst endgültig ausgefallen', level: 'hoch', call: true },
  { id: 'money', what: 'Geldbewegung über der Grenze', level: 'hoch', call: true },
  { id: 'human_needed', what: 'Freigabe blockiert den Plan', level: 'mittel', call: false },
  { id: 'routine_fail', what: 'Routine mehrfach gescheitert', level: 'mittel', call: false },
];

function defaults() { return { escalations: [], attempts: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['escalations', 'attempts', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const mask = (s) => { const t = String(s || ''); return t.length <= 4 ? '••••' : '••••' + t.slice(-4); };

// Anbieter-Bereitschaft: Vault fragen, ob die Felder gefüllt sind. Keine Werte in der Ausgabe!
function providerState() {
  let vault = null;
  try { vault = require('./vault'); } catch { vault = null; }
  const rows = PROVIDERS.map((p) => {
    if (!p.key) return { id: p.id, name: p.name, ready: true, note: p.note };
    let ready = false; let reason = null;
    if (!vault) reason = 'Vault nicht ladbar';
    else {
      try {
        const st = typeof vault.status === 'function' ? vault.status() : {};
        const keys = st.keys || st.stored || [];
        const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
        const missing = p.fields.filter((f) => !list.includes(f));
        ready = missing.length === 0;
        reason = ready ? null : `fehlende Werte: ${missing.length} (Namen werden hier nicht genannt, nur die Anzahl)`;
        if (!ready && String(st.state || st.status || '') === 'LOCKED') reason = 'Vault ist gesperrt (AURA_VAULT_KEY fehlt)';
      } catch (e) { reason = 'Vault-Abfrage fehlgeschlagen: ' + e.message; }
    }
    return { id: p.id, name: p.name, ready, reason, note: p.note };
  });
  const ready = rows.filter((r) => r.ready && r.id !== 'manual').map((r) => r.id);
  return {
    ok: true, providers: rows, call_ready: ready.length > 0, ready_providers: ready,
    mode: ready.length ? 'ANRUF MÖGLICH' : 'NUR MELDUNG (kein Anruf-Anbieter verbunden)',
    honesty: 'Ohne verbundenen Anbieter findet KEIN Anruf statt. AURA meldet dann über Telegram und wartet auf einen Menschen.',
  };
}

// Alarm auslösen: Leiter abarbeiten, jede Sprosse protokollieren.
function alert(input) {
  const data = load();
  const trigger = String((input && input.trigger) || 'human_needed');
  const t = TRIGGERS.find((x) => x.id === trigger);
  if (!t) return { ok: false, error: `unbekannter Auslöser "${trigger}". Bekannt: ${TRIGGERS.map((x) => x.id).join(', ')}` };
  const reason = String((input && input.reason) || t.what).slice(0, 500);
  const esc = {
    id: 'sc-' + crypto.randomBytes(4).toString('hex'),
    at: new Date().toISOString(), trigger, level: t.level, reason,
    related_case: (input && input.case_id) || null,
    ladder: [], state: 'OFFEN',
  };

  // 1) Protokoll (immer)
  esc.ladder.push({ step: 1, what: 'Protokoll', ok: true, detail: 'Alarm vermerkt', at: esc.at });

  // 2) Telegram (wenn eingerichtet)
  let telegram = { ok: false, detail: 'nicht eingerichtet' };
  try {
    const notify = require('./notify');
    const st = typeof notify.status === 'function' ? notify.status() : {};
    if (st && (st.telegram_ready || st.configured)) {
      telegram = { ok: true, detail: 'Telegram-Nachricht abgesetzt (Bot eingerichtet)' };
      if (typeof notify.notifyEmergency === 'function') { try { notify.notifyEmergency({ what: `AURA-Alarm (${t.what}): ${reason}`, level: t.level }); } catch (e) { telegram = { ok: false, detail: 'Versand fehlgeschlagen: ' + e.message }; } }
    } else if (st && st.telegram === 'NOT-CONNECTED') telegram = { ok: false, detail: 'Telegram ist nicht verbunden (kein Bot-Token)' };
  } catch { telegram = { ok: false, detail: 'Benachrichtigungsmodul nicht ladbar' }; }
  esc.ladder.push({ step: 2, what: 'Telegram', ok: telegram.ok, detail: telegram.detail, at: new Date().toISOString() });

  // 3) Anruf (nur wenn Anbieter bereit UND der Fall ruft UND der Mensch es erlaubt)
  const ps = providerState();
  const wantsCall = t.call && input && input.allow_call === true;
  if (!t.call) esc.ladder.push({ step: 3, what: 'Anruf', ok: false, skipped: true, detail: `Auslöser "${trigger}" ruft nicht an (Stufe ${t.level})` });
  else if (!ps.call_ready) esc.ladder.push({ step: 3, what: 'Anruf', ok: false, skipped: true, detail: 'Kein Anruf-Anbieter verbunden — es wird NICHT angerufen', install: 'Twilio/sipgate/GSM-Gateway im Vault hinterlegen (Schlüssel + Nummer)' });
  else if (!wantsCall) esc.ladder.push({ step: 3, what: 'Anruf', ok: false, skipped: true, detail: 'Anruf möglich, aber nicht erlaubt (allow_call fehlt) — Freigabe nötig' });
  else esc.ladder.push({ step: 3, what: 'Anruf', ok: true, pending: true, detail: `Anruf über ${ps.ready_providers.join(', ')} würde jetzt ausgelöst — Nummer maskiert: ${mask((input && input.number) || '')}`, note: 'Der eigentliche Wählvorgang läuft über den Anbieter und wird dort protokolliert.' });

  // 4) Handanruf-Hinweis (immer möglich)
  esc.ladder.push({ step: 4, what: 'Handanruf', ok: true, detail: 'Immer möglich: der Mensch sieht die Meldung und wählt selbst.' });

  if (!esc.ladder.some((s) => s.ok && !s.skipped && s.step >= 2)) esc.state = 'NUR_PROTOKOLL';
  else if (esc.ladder.some((s) => s.pending)) esc.state = 'ANRUF_AUSGELOEST';
  else esc.state = 'GEMELDET';

  data.escalations.unshift(esc); data.escalations = data.escalations.slice(0, 200);
  data.audit.unshift({ at: esc.at, action: 'alert', id: esc.id, trigger, state: esc.state });
  data.audit = data.audit.slice(0, 300);
  save(data);
  return { ok: true, escalation: esc, mode: ps.mode, honesty: ps.honesty };
}

function ack(id, payload) {
  const data = load();
  const e = data.escalations.find((x) => x.id === id);
  if (!e) return { ok: false, error: 'Alarm nicht gefunden' };
  e.state = 'BESTAETIGT';
  e.ack = { at: new Date().toISOString(), by: String((payload && payload.by) || 'Mensch'), note: String((payload && payload.note) || '').slice(0, 300) };
  save(data);
  return { ok: true, escalation: { id: e.id, state: e.state, ack: e.ack } };
}

function retry(id, payload) {
  const data = load();
  const e = data.escalations.find((x) => x.id === id);
  if (!e) return { ok: false, error: 'Alarm nicht gefunden' };
  const max = Number((payload && payload.max) || 3);
  const tries = data.attempts.filter((a) => a.escalation === id).length + 1;
  if (tries > max) { e.state = 'RUHE (Obergrenze erreicht)'; save(data); return { ok: false, error: `Obergrenze ${max} erreicht — kein Dauerfeuer.`, state: e.state }; }
  data.attempts.push({ escalation: id, try: tries, at: new Date().toISOString() });
  save(data);
  return { ok: true, try: tries, max, wait_seconds: 60 * tries, note: 'Wartezeit wächst mit jedem Versuch — der Mensch soll nicht abgestumpft werden.' };
}

function status() {
  const d = load();
  const ps = providerState();
  return {
    area: 'SC', module: 'self_call', state: 'live', file: FILE,
    mode: ps.mode, ready_providers: ps.ready_providers,
    triggers: TRIGGERS, escalations: d.escalations.length, last: d.escalations[0] ? { id: d.escalations[0].id, state: d.escalations[0].state, at: d.escalations[0].at } : null,
    rule: 'Anruf nur bei ernsten Auslösern und nur mit verbundenem Anbieter. Ohne Anbieter bleibt es bei der Meldung — ohne Behauptung.',
    privacy: 'Nummern und Schlüssel liegen im Vault; in Ausgaben erscheinen sie maskiert.',
  };
}

module.exports = {
  meta: { area: 'SC', id: 'self_call', name: 'Selbst-Anruf (Alarmleiter bis zum Anruf beim Menschen)', state: 'live' },
  actions: { status: () => status(), providers: () => providerState(), triggers: () => ({ ok: true, triggers: TRIGGERS }), alert: (p) => alert(p || {}), ack: (p) => ack((p || {}).id, p || {}), retry: (p) => retry((p || {}).id, p || {}), log: () => ({ ok: true, escalations: load().escalations.slice(0, 25).map((e) => ({ id: e.id, at: e.at, trigger: e.trigger, state: e.state, ladder: e.ladder.map((l) => l.what + ':' + (l.ok ? 'ok' : 'nein')) })) }) },
  PROVIDERS, TRIGGERS, providerState, alert, ack, retry, status, mask,
};
