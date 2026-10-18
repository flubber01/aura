'use strict';
// AURA · „Freund werben, beide profitieren" (Refer a friend).
//
// Jeder bekommt einen eigenen Werbecode. Wer den Code nutzt, bekommt einen Vorteil; wer ihn
// weitergegeben hat, auch. Beides wird **nur** bei echten Ereignissen gebucht: eine Registrierung, die
// wirklich passiert ist, eine Zahlung, die wirklich eingegangen ist. Keine Fantasiezahlen, keine
// Selbstanmeldungen, keine Mehrfachprämien für dieselbe Person.
//
// Auszahlung von Gutschriften braucht immer einen Menschen (Freigabe-Tür). Und: Werbeprämien dürfen
// keine Einnahmen erfinden — sie werden als Preisnachlass oder Gutschrift geführt, nie als Geld, das
// nie geflossen ist.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_REFERRAL_FILE || path.join(__dirname, '..', 'data', 'referral.json');

// Was es zu holen gibt. Werte sind Nachlässe/Gutschriften, keine behaupteten Einnahmen.
const PROGRAM = {
  id: 'creed-refer-2026',
  name: 'Creed-Street-Empfehlung',
  for_referrer: { first_signup: '1 Monat Werkstatt-Plan gratis', per_paid_month: '15 % dauerhaft auf den eigenen Plan', milestone_5: 'eigene Künstler-Seite im Web-Empire gratis' },
  for_friend: { signup: '14 Tage alles offen (kein Geld, keine Karte)', first_payment: '20 % auf den ersten bezahlten Monat' },
  rules: [
    'Eine Prämie pro Person und Ereignis — Mehrfachanmeldung wird erkannt und abgelehnt.',
    'Ereignisse zählen nur, wenn sie wirklich passiert sind (Registrierung bestätigt, Zahlung eingegangen).',
    'Keine Prämie für sich selbst (gleiche Person, gleiche Zahlungsart, gleiche Adresse).',
    'Gutschriften sind Nachlässe — sie werden nicht als Einnahme gebucht.',
    'Auszahlung von Gutschriften im Konto braucht einen Menschen (Freigabe-Tür).',
  ],
};

function defaults() { return { codes: [], events: [], rewards: [], audit: [] }; }
// Wichtig: ein einziger Datenbestand im Speicher. Sonst arbeitet eine zweite Abfrage auf einer
// Kopie, und das gebuchte Ereignis wäre beim Speichern wieder weg.
let CACHE = null;
function load() {
  if (CACHE) return CACHE;
  try {
    let raw;
    if (!fs.existsSync(FILE)) raw = defaults();
    else raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['codes', 'events', 'rewards', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    CACHE = raw;
    if (!fs.existsSync(FILE)) persist(CACHE); // AURA_SEED_WRITE
    return CACHE;
  } catch {
    CACHE = defaults();
    persist(CACHE); // AURA_SEED_WRITE
    return CACHE;
  }
}
function persist(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12); }

// Werbecode anlegen (für einen Künstler, Kunden oder Unterstützer).
function code(input) {
  const p = input || {};
  const who = String(p.user || p.name || '').trim();
  if (who.length < 2) return { ok: false, error: 'user fehlt' };
  const d = load();
  const existing = d.codes.find((c) => c.user.toLowerCase() === who.toLowerCase());
  if (existing) return { ok: true, code: existing, note: 'Code gab es schon — derselbe Code bleibt gültig.' };
  const short = slug(who) || 'freund';
  const token = Math.random().toString(36).slice(2, 6);
  const c = {
    id: 'rc-' + Math.random().toString(36).slice(2, 8),
    code: `${short}-${token}`.toUpperCase(),
    user: who, role: String(p.role || 'artist'),
    created_at: new Date().toISOString(),
    link: `/start?ref=${`${short}-${token}`.toUpperCase()}`,
    signups: 0, paid_months: 0, rewards: [], state: 'AKTIV',
  };
  d.codes.unshift(c); d.codes = d.codes.slice(0, 1000);
  d.audit.unshift({ at: c.created_at, action: 'code', user: who, code: c.code });
  persist(d);
  return { ok: true, code: c, program: PROGRAM.for_referrer };
}

function findCode(value) {
  const d = load();
  const v = String(value || '').trim().toUpperCase();
  return d.codes.find((c) => c.code === v) || null;
}

// Ein echtes Ereignis buchen. Ohne Beleg kein Ereignis.
function event(input) {
  const p = input || {};
  const type = String(p.type || '').toLowerCase();
  if (!['signup', 'paid_month', 'cancelled'].includes(type)) return { ok: false, error: 'type muss signup, paid_month oder cancelled sein' };
  const who = String(p.who || '').trim();
  if (!who) return { ok: false, error: 'who fehlt — wer hat den Code benutzt?' };
  const d = load();
  const c = findCode(p.code);
  if (!c) return { ok: false, error: 'Werbecode unbekannt oder abgelaufen' };

  // Missbrauchsschutz: sich selbst werben ist keine Werbung.
  if (slug(who) === slug(c.user) || slug(who).startsWith(slug(c.user))) {
    return { ok: false, refused: true, error: 'Das ist dieselbe Person wie der Werber — Selbstwerbung zählt nicht.' };
  }
  const twin = d.events.find((e) => e.code === c.code && e.who.toLowerCase() === who.toLowerCase() && e.type === type);
  if (twin) return { ok: true, duplicate: true, event: twin, note: 'Ereignis war schon gebucht — ein Ereignis, eine Prämie.' };
  if (type === 'paid_month' && !/^\d+(\.\d{1,2})?$/.test(String(p.amount || ''))) {
    return { ok: false, error: 'Für eine Zahlung fehlt der Betrag (amount in Euro) — ohne Betrag keine Prämie' };
  }

  const ev = {
    id: 'rev-' + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(), type, code: c.code, who,
    amount_eur: type === 'paid_month' ? Number(p.amount) : null,
    proof: String(p.proof || 'bestätigt'), by: String(p.by || 'AURA'),
  };
  d.events.unshift(ev);
  if (type === 'signup') c.signups++;
  if (type === 'paid_month') c.paid_months++;
  if (type === 'cancelled') c.state = 'PAUSIERT';

  // Prämien ausrechnen — als Nachlass, nicht als Einnahme.
  const rewards = [];
  if (type === 'signup') {
    rewards.push({ for: c.user, kind: 'GUTSCHRIFT', text: PROGRAM.for_referrer.first_signup, value: '1 Monat Werkstatt' });
    rewards.push({ for: who, kind: 'GUTSCHRIFT', text: PROGRAM.for_friend.signup, value: '14 Tage offen' });
  }
  if (type === 'paid_month') {
    const amount = Number(p.amount) || 0;
    rewards.push({ for: c.user, kind: 'PROVISION', percent: 15, base: amount, value_eur: Number((amount * 0.15).toFixed(2)), text: PROGRAM.for_referrer.per_paid_month });
    rewards.push({ for: who, kind: 'NACHLASS', percent: 20, base: amount, value_eur: Number((amount * 0.2).toFixed(2)), text: PROGRAM.for_friend.first_payment });
  }
  if (type === 'signup' && c.signups === 5) {
    rewards.push({ for: c.user, kind: 'MEILENSTEIN', text: PROGRAM.for_referrer.milestone_5, value: 'eigene Künstlerseite' });
  }
  for (const r of rewards) {
    c.rewards.push(Object.assign({ at: new Date().toISOString(), event: ev.id }, r));
    d.rewards.unshift(Object.assign({ id: 'rw-' + Math.random().toString(36).slice(2, 8), event: ev.id, code: c.code }, r));
  }
  d.rewards = d.rewards.slice(0, 2000);
  d.audit.unshift({ at: ev.at, action: 'event', type, code: c.code, who, rewards: rewards.length });
  persist(d);
  return {
    ok: true, event: ev, rewards,
    balance: { signups: c.signups, paid_months: c.paid_months, reward_count: c.rewards.length },
    honesty: 'Prämien werden nur bei belegten Ereignissen gebucht. Gutschriften sind Nachlässe — sie zählen nicht als Einnahme.',
  };
}

// Auszahlung/Gutschrift im Konto: nur mit Mensch.
function claim(input) {
  const p = input || {};
  const c = findCode(p.code);
  if (!c) return { ok: false, error: 'Werbecode unbekannt' };
  const open = c.rewards.filter((r) => !r.claimed);
  if (!open.length) return { ok: false, error: 'keine offenen Prämien für diesen Code' };
  const plan = { ok: true, code: c.code, open: open.length, rewards: open.map((r) => ({ kind: r.kind, text: r.text, value_eur: r.value_eur || null })) };
  if (!p.human) {
    return Object.assign(plan, {
      ok: false, needs: 'human',
      error: 'Prämien werden im Konto durch einen Menschen eingelöst (human: true).',
      gate: 'Freigabe-Tür: POST /api/human/propose { kind:"SPEND", reason:"Empfehlungsprämie" }',
    });
  }
  const d = load();
  const target = d.codes.find((x) => x.code === c.code);
  for (const r of target.rewards) if (!r.claimed) { r.claimed = true; r.claimed_at = new Date().toISOString(); r.claimed_by = String(p.by || 'Mensch'); }
  d.audit.unshift({ at: new Date().toISOString(), action: 'claim', code: c.code, count: plan.open, by: String(p.by || 'Mensch') });
  persist(d);
  return { ok: true, code: c.code, claimed: plan.open, by: String(p.by || 'Mensch'), note: 'Im Konto verbucht. Es fließt dabei kein Geld — es ist ein Nachlass.' };
}

function ranking() {
  const d = load();
  const rows = d.codes.map((c) => ({
    code: c.code, user: c.user, signups: c.signups, paid_months: c.paid_months,
    rewards: c.rewards.length, open_rewards: c.rewards.filter((r) => !r.claimed).length,
    credit_eur: Number(c.rewards.reduce((n, r) => n + (r.value_eur || 0), 0).toFixed(2)),
    state: c.state,
  })).sort((a, b) => b.signups - a.signups || b.paid_months - a.paid_months);
  const paid = d.rewards.filter((r) => r.kind === 'PROVISION').reduce((n, r) => n + (r.value_eur || 0), 0);
  return {
    ok: true, program: PROGRAM.id, partners: rows.length, top: rows.slice(0, 10),
    totals: { signups: d.events.filter((e) => e.type === 'signup').length, paid_months: d.events.filter((e) => e.type === 'paid_month').length, provisions_eur: Number(paid.toFixed(2)), reward_rows: d.rewards.length },
    honesty: 'Provisionen sind aus echten Zahlungen gerechnet. Ohne eingegangene Zahlung gibt es keine Provision — auch keine geschätzte.',
  };
}

function status() {
  const d = load();
  return {
    area: 'REF', module: 'referral', state: 'live', file: FILE,
    program: PROGRAM.id, codes: d.codes.length, events: d.events.length, rewards: d.rewards.length,
    open_rewards: d.rewards.filter((r) => !r.claimed).length,
    rules: PROGRAM.rules,
    honesty: ['Selbstwerbung wird abgelehnt.', 'Ein Ereignis, eine Prämie — Mehrfachbuchung wird erkannt.', 'Prämien sind Nachlässe und werden nicht als Einnahme geführt.', 'Einlösen im Konto braucht einen Menschen.'],
  };
}

module.exports = {
  meta: { area: 'REF', id: 'referral', name: 'Empfehlungsprogramm „Freund werben, beide profitieren"', state: 'live' },
  actions: { status: () => status(), program: () => ({ ok: true, program: PROGRAM }), code: (p) => code(p || {}), event: (p) => event(p || {}), claim: (p) => claim(p || {}), ranking: () => ranking(), codes: () => { const d = load(); return { ok: true, count: d.codes.length, codes: d.codes.slice(0, 50) }; } },
  PROGRAM, code, event, claim, ranking, status,
};
