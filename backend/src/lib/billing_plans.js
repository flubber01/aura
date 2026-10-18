'use strict';
// AURA · Bezahlpläne: Stufen, Grenzen, Rechnungsstellung — und der ehrliche Umgang mit Geld.
//
// Was hier steht:
//  • Plan-Stufen mit klaren Grenzen (Songs, Video-Minuten, Artist-Konten, KI-Aufrufe, Speicher).
//  • Probezeit und Kündigung: Kündigung ist sofort möglich, ohne Rückfrage. Das ist Absicht.
//  • Rechnung/Quittung wird intern erzeugt (Nummernkreis, Beträge, Steuerhinweis) — als Beleg.
//
// Was hier NICHT steht:
//  • Kein echter Zahlungsverkehr. Abbuchungen laufen ausschließlich über einen Anbieter mit eigenem
//    Schlüssel im Vault UND mit menschlicher Freigabe (Freigabe-Tür). Ohne Schlüssel bleibt der Plan
//    „lokal geführt" — das steht dann auch so in jeder Rechnung.
//  • Keine erfundenen Umsätze, keine Scheinabos.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_BILLING_FILE || path.join(__dirname, '..', 'data', 'billing.json');

const PLANS = [
  {
    id: 'free', name: 'Frei', price_eur: 0, period: 'monatlich',
    limits: { songs: 5, video_minutes: 10, artists: 1, ai_calls: 0, storage_gb: 1 },
    includes: ['Songbook lokal (echter Ton)', 'Video-Effekte ohne KI', 'Kalender und Kampagnen-Planer', 'Handbuch'],
    excludes: ['KI-Anbieter', 'Distribution', 'Anruf-Benachrichtigung'],
  },
  {
    id: 'creator', name: 'Creator', price_eur: 19, period: 'monatlich',
    limits: { songs: 50, video_minutes: 120, artists: 3, ai_calls: 500, storage_gb: 10 },
    includes: ['alles aus Frei', 'eigene Schlüssel für KI-Anbieter', 'Podcast/Avatar-Werkstatt', 'Selbst-Anruf bei Alarmen'],
    excludes: ['Distribution an Plattformen'],
  },
  {
    id: 'studio', name: 'Studio', price_eur: 49, period: 'monatlich',
    limits: { songs: 300, video_minutes: 600, artists: 10, ai_calls: 3000, storage_gb: 50 },
    includes: ['alles aus Creator', 'Distributions-Vorbereitung', 'mehrere Artists mit getrennter Sicht', 'Werbeflächen-Verwaltung'],
    excludes: [],
  },
  {
    id: 'label', name: 'Label', price_eur: 149, period: 'monatlich',
    limits: { songs: 2000, video_minutes: 3000, artists: 50, ai_calls: 20000, storage_gb: 250 },
    includes: ['alles aus Studio', 'Rollen und Freigaben je Artist', 'Sammelabrechnung', 'Prüfpfad-Export'],
    excludes: [],
  },
];

const PAYMENT_PROVIDERS = [
  { id: 'stripe', name: 'Stripe', key: 'stripe-secret-key', fields: ['stripe-secret-key', 'stripe-price-*'], note: 'offizielle Schnittstelle, Gebühren pro Zahlung' },
  { id: 'paypal', name: 'PayPal', key: 'paypal-client-secret', fields: ['paypal-client-id', 'paypal-client-secret'], note: 'offizielle Schnittstelle' },
  { id: 'sepa', name: 'SEPA-Überweisung (manuell)', key: null, fields: [], note: 'kein Schlüssel: Rechnung stellen, Zahlungseingang prüft ein Mensch' },
];

function defaults() { return { subscriptions: [], invoices: [], audit: [], counter: 0 }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['subscriptions', 'invoices', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    if (typeof raw.counter !== 'number') raw.counter = 0;
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Zahlungsbereitschaft ehrlich abfragen (nur Anzahl der Werte, nie Inhalte).
function paymentState() {
  let vault = null;
  try { vault = require('./vault'); } catch { vault = null; }
  const rows = PAYMENT_PROVIDERS.map((p) => {
    if (!p.key) return { id: p.id, name: p.name, ready: true, manual: true, note: p.note };
    let ready = false; let reason = null;
    try {
      const st = vault && typeof vault.status === 'function' ? vault.status() : {};
      const keys = st.keys || st.stored || [];
      const list = Array.isArray(keys) ? keys : Object.keys(keys || {});
      const have = p.fields.filter((f) => f.endsWith('*') ? list.some((k) => k.startsWith(f.slice(0, -1))) : list.includes(f));
      ready = have.length === p.fields.length;
      reason = ready ? null : `fehlende Werte: ${p.fields.length - have.length}`;
      if (String(st.state || st.status || '') === 'LOCKED') reason = 'Vault gesperrt (kein AURA_VAULT_KEY)';
    } catch (e) { reason = 'Vault nicht abfragbar: ' + e.message; }
    return { id: p.id, name: p.name, ready, manual: false, reason, note: p.note };
  });
  const ready = rows.filter((r) => r.ready && !r.manual).map((r) => r.id);
  return {
    ok: true, providers: rows, online_ready: ready,
    mode: ready.length ? 'ONLINE-ZAHLUNG MÖGLICH' : 'LOKAL GEFÜHRT (kein Zahlungsanbieter verbunden)',
    honesty: 'Ohne verbundenen Anbieter wird nichts abgebucht. Rechnungen sind Belege im System, keine Zahlung.',
    gate: 'Jede Abbuchung geht zusätzlich über die Freigabe-Tür des Menschen (kind SPEND).',
  };
}

function quote(input) {
  const plan = PLANS.find((p) => p.id === String((input && input.plan) || '').toLowerCase());
  if (!plan) return { ok: false, error: `Plan unbekannt. Bekannt: ${PLANS.map((p) => p.id).join(', ')}` };
  const seats = Math.max(1, Number((input && input.seats) || 1));
  const months = Math.max(1, Number((input && input.months) || 1));
  const yearly = months >= 12;
  const monthly = plan.price_eur;
  const discount = yearly ? 0.16 : 0;                       // zwei Monate geschenkt
  const per_month = Math.round(monthly * (1 - discount) * 100) / 100;
  const net = Math.round(per_month * seats * months * 100) / 100;
  const vat = Math.round(net * 0.19 * 100) / 100;
  return {
    ok: true, plan: plan.id, plan_name: plan.name, seats, months, yearly,
    per_month_eur: per_month, months_free: yearly ? 2 : 0,
    net_eur: net, vat_19_eur: vat, gross_eur: Math.round((net + vat) * 100) / 100,
    limits: plan.limits, includes: plan.includes, excludes: plan.excludes,
    note: 'Rechenweg nachvollziehbar: Monatspreis × (1 − Rabatt) × Plätze × Monate, danach 19 % Umsatzsteuer.',
  };
}

function subscribe(input) {
  const data = load();
  const plan = String((input && input.plan) || '').toLowerCase();
  const who = String((input && input.who) || '').trim();
  if (!PLANS.some((p) => p.id === plan)) return { ok: false, error: 'Plan unbekannt' };
  if (!who) return { ok: false, error: 'who (Kunde) fehlt' };
  const existing = data.subscriptions.find((s) => s.who === who && s.state === 'AKTIV');
  if (existing && !(input && input.change === true)) return { ok: false, error: `${who} hat schon "${existing.plan}". Wechsel nur mit change: true.`, current: existing.plan };
  if (existing) existing.state = 'GEWECHSELT';
  const sub = {
    id: 'sub-' + Math.random().toString(16).slice(2, 10), who, plan,
    state: 'AKTIV', trial_days: Number((input && input.trial_days) || 14),
    started_at: new Date().toISOString(),
    cancel_at_any_time: true,
    payment_mode: paymentState().mode,
  };
  data.subscriptions.unshift(sub); data.subscriptions = data.subscriptions.slice(0, 500);
  data.audit.unshift({ at: sub.started_at, action: 'subscribe', id: sub.id, who, plan });
  save(data);
  return { ok: true, subscription: sub, note: 'Kündigung ist jederzeit und ohne Rückfrage möglich.' };
}

function cancel(who) {
  const data = load();
  const sub = data.subscriptions.find((s) => (s.who === String(who || '').trim() && s.state === 'AKTIV'));
  if (!sub) return { ok: false, error: 'kein aktives Abo für diese Kennung' };
  sub.state = 'GEKUENDIGT';
  sub.cancelled_at = new Date().toISOString();
  data.audit.unshift({ at: sub.cancelled_at, action: 'cancel', id: sub.id, who: sub.who });
  save(data);
  return { ok: true, subscription: { id: sub.id, state: sub.state }, note: 'Gekündigt. Keine Rückfrage, keine Wartezeit.' };
}

// Rechnung als Beleg. Online-Abbuchung nur mit Anbieter UND menschlicher Freigabe.
function invoice(input) {
  const data = load();
  const q = quote(input);
  if (!q.ok) return q;
  const who = String((input && input.who) || '').trim();
  if (!who) return { ok: false, error: 'who fehlt' };
  data.counter += 1;
  const number = `${new Date().getFullYear()}-${String(data.counter).padStart(5, '0')}`;
  const inv = {
    id: 'inv-' + number, number, who, plan: q.plan, seats: q.seats, months: q.months,
    net_eur: q.net_eur, vat_19_eur: q.vat_19_eur, gross_eur: q.gross_eur,
    created_at: new Date().toISOString(),
    payment: { mode: paymentState().mode, charged: false },
    note: 'Beleg im System. Abgebucht ist nichts — dafür wäre ein Zahlungsanbieter im Vault und eine menschliche Freigabe nötig.',
  };
  data.invoices.unshift(inv); data.invoices = data.invoices.slice(0, 500);
  data.audit.unshift({ at: inv.created_at, action: 'invoice', id: inv.id, who, gross: inv.gross_eur });
  save(data);
  return { ok: true, invoice: inv, gate: 'Für eine echte Abbuchung: human_final.propose({kind:"SPEND"}) und menschliche Entscheidung.' };
}

// Grenzen prüfen: hat der Kunde noch Luft in seinem Plan?
function checkLimits(input) {
  const who = String((input && input.who) || '').trim();
  const data = load();
  const sub = data.subscriptions.find((s) => s.who === who && s.state === 'AKTIV');
  if (!sub) return { ok: false, error: 'kein aktives Abo — bitte Plan wählen' };
  const plan = PLANS.find((p) => p.id === sub.plan);
  const usage = (input && input.usage) || {};
  const rows = Object.entries(plan.limits).map(([key, limit]) => {
    const used = Number(usage[key] || 0);
    const over = limit > 0 ? used > limit : used > 0;
    return { key, used, limit, over, left: limit > 0 ? Math.max(0, limit - used) : (used ? 0 : Infinity) };
  });
  return { ok: true, plan: plan.id, rows, exceeded: rows.filter((r) => r.over).map((r) => r.key), note: 'Grenzen sind Zählwerte. Überschreitung sperrt nichts hart — sie wird gemeldet.' };
}

function status() {
  const d = load();
  const ps = paymentState();
  return {
    area: 'BILL', module: 'billing_plans', state: 'live', file: FILE,
    plans: PLANS.length, subscriptions: d.subscriptions.filter((s) => s.state === 'AKTIV').length, invoices: d.invoices.length,
    payment_mode: ps.mode, online_ready: ps.online_ready,
    rules: ['Kein Geldverkehr ohne Anbieter-Schlüssel UND menschliche Freigabe.', 'Kündigung ist immer sofort möglich.', 'Rechnungen sind Belege, keine Abbuchungen.', 'Preise und Grenzen stehen offen im Plan.'],
  };
}

module.exports = {
  meta: { area: 'BILL', id: 'billing_plans', name: 'Bezahlpläne (Stufen, Grenzen, Belege)', state: 'live' },
  actions: { status: () => status(), plans: () => ({ ok: true, plans: PLANS, providers: PAYMENT_PROVIDERS }), payment: () => paymentState(), quote: (p) => quote(p || {}), subscribe: (p) => subscribe(p || {}), cancel: (p) => cancel((p || {}).who), invoice: (p) => invoice(p || {}), limits: (p) => checkLimits(p || {}), list: () => ({ ok: true, subscriptions: load().subscriptions.slice(0, 50), invoices: load().invoices.slice(0, 20) }) },
  PLANS, PAYMENT_PROVIDERS, paymentState, quote, subscribe, cancel, invoice, checkLimits, status,
};
