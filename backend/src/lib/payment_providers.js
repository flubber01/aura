'use strict';
// AURA · Zahlungsdienstleister im Betriebssystem.
//
// Hier stehen die Wege, über die Geld hereinkommen kann — Karte, Lastschrift, Überweisung, Rechnung,
// Geldbörse, Krypto, Plattform-Abrechnung. Zu jedem Weg: wo er üblich ist, was er ungefähr kostet,
// wann Geld ankommt, ob er wiederkehrende Zahlungen kann, welche Unterlagen (KYC) nötig sind und
// welche Schlüssel im Vault liegen müssten.
//
// Drei ehrliche Regeln:
//  1. Gebühren sind Richtwerte aus den öffentlichen Angaben der Anbieter (Stand 2025) — sie ändern
//     sich. Deshalb: „unverbindlich" und immer mit Prüfauftrag.
//  2. Ohne Schlüssel im Vault ist nichts verbunden. Dann rechnet AURA nur und führt lokal Buch.
//  3. Geld bewegt sich nur mit Schlüssel UND menschlicher Freigabe. Kein Abonnement ohne Menschen.
//
// Die Empfehlung ist nachvollziehbar: sie nennt Punktzahl und Gründe pro Weg.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_PAYMENTS_FILE || path.join(__dirname, '..', 'data', 'payment_providers.json');

// Gebühren als Richtwert in Prozent + feste Gebühr in Euro. „Stand 2025, unverbindlich."
const PROVIDERS = [
  { id: 'stripe', name: 'Stripe', kinds: ['karte', 'geldboerse', 'lastschrift', 'abonnement'], regionen: ['EU', 'weltweit'], fee: { pct: 1.5, fix: 0.25, note: 'EU-Karten; Nicht-EU-Karten und Währungsumrechnung teurer' }, payout: '2–7 Bankarbeitstage (Standardzeitplan)', abo: true, kyc: true, keys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], deutschland: true, url: 'stripe.com', stark: ['Entwicklerfreundlich', 'Abos und Rechnungen', 'Karten weltweit'], schwach: ['Gebühren steigen bei Fremdwährung', 'Konto-Sperren bei Risiko möglich'] },
  { id: 'paypal', name: 'PayPal', kinds: ['geldboerse', 'karte', 'abonnement'], regionen: ['EU', 'weltweit'], fee: { pct: 2.49, fix: 0.35, note: 'Standard für DE; Ratenzahlung teurer' }, payout: 'Sofort im Guthaben, Auszahlung 1–2 Tage', abo: true, kyc: true, keys: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'], deutschland: true, url: 'paypal.com', stark: ['Käufer vertrauen ihm', 'Sehr hohe Reichweite'], schwach: ['Käuferschutz kann gegen Verkäufer ausgelegt werden', 'Konto-Einfrierungen'] },
  { id: 'mollie', name: 'Mollie', kinds: ['karte', 'lastschrift', 'ueberweisung', 'abonnement'], regionen: ['EU'], fee: { pct: 1.8, fix: 0.25, note: 'Karten EU; andere Wege je Methode' }, payout: 'wöchentlich oder täglich', abo: true, kyc: true, keys: ['MOLLIE_API_KEY'], deutschland: true, url: 'mollie.com', stark: ['Viele europäische Zahlwege', 'Einfache Anbindung'], schwach: ['Nur Europa', 'Auszahlungsrhythmus je Vertrag'] },
  { id: 'klarna', name: 'Klarna', kinds: ['rechnung', 'raten', 'karte'], regionen: ['EU', 'US'], fee: { pct: 2.99, fix: 0.35, note: 'Händlergebühr, stark verhandelbar' }, payout: 'je Vertrag', abo: false, kyc: true, keys: ['KLARNA_API_KEY', 'KLARNA_API_SECRET'], deutschland: true, url: 'klarna.com', stark: ['Kauf auf Rechnung hebt Warenkörbe', 'In DE sehr verbreitet'], schwach: ['Risiko trägt der Händler', 'Gebühren verhandelbar = intransparent'] },
  { id: 'sumup', name: 'SumUp', kinds: ['karte', 'vorort'], regionen: ['EU'], fee: { pct: 1.39, fix: 0, note: 'Kartenleser vor Ort; Online-Zahlungen anderer Satz' }, payout: '1–3 Tage', abo: false, kyc: true, keys: ['SUMUP_API_KEY'], deutschland: true, url: 'sumup.com', stark: ['Vor-Ort-Zahlung ohne Vertrag', 'Kartenleser'], schwach: ['Online-Anbindung eingeschränkt', 'Hardware nötig'] },
  { id: 'adyen', name: 'Adyen', kinds: ['karte', 'geldboerse', 'lastschrift', 'vorort'], regionen: ['weltweit'], fee: { pct: 0, fix: 0, note: 'Interchange-plus, individuell verhandelt' }, payout: 'je Vertrag', abo: true, kyc: true, keys: ['ADYEN_API_KEY', 'ADYEN_MERCHANT_ACCOUNT'], deutschland: true, url: 'adyen.com', stark: ['Große Volumen günstig', 'Ein System für online und vor Ort'], schwach: ['Erst ab Volumen sinnvoll', 'Aufwändige Einrichtung'] },
  { id: 'unzer', name: 'Unzer', kinds: ['karte', 'lastschrift', 'rechnung', 'vorort'], regionen: ['EU'], fee: { pct: 1.9, fix: 0.25, note: 'Richtwert; DE-Lastschrift eigener Satz' }, payout: 'je Vertrag', abo: true, kyc: true, keys: ['UNZER_PUBLIC_KEY', 'UNZER_PRIVATE_KEY'], deutschland: true, url: 'unzer.com', stark: ['Deutscher Anbieter', 'Kartenleser und online'], schwach: ['Vertragsbindung möglich'] },
  { id: 'payone', name: 'PAYONE', kinds: ['karte', 'lastschrift', 'rechnung', 'vorort'], regionen: ['EU'], fee: { pct: 1.9, fix: 0.3, note: 'Richtwert nach Vertrag' }, payout: 'je Vertrag', abo: true, kyc: true, keys: ['PAYONE_MERCHANT_ID', 'PAYONE_PORTAL_ID', 'PAYONE_KEY'], deutschland: true, url: 'payone.com', stark: ['Deutsch, viele Zahlwege'], schwach: ['Vertragsbasierte Abwicklung'] },
  { id: 'paddle', name: 'Paddle', kinds: ['karte', 'abonnement', 'haendler'], regionen: ['weltweit'], fee: { pct: 5, fix: 0.5, note: 'Abo-Modell; Anbieter tritt als Verkäufer auf' }, payout: 'monatlich', abo: true, kyc: true, keys: ['PADDLE_API_KEY', 'PADDLE_NOTIFICATION_SECRET'], deutschland: true, url: 'paddle.com', stark: ['Übernimmt Umsatzsteuer weltweit', 'Kein eigenes Steuer-Thema'], schwach: ['Höhere Gebühr', 'Anbieter ist Verkäufer'] },
  { id: 'lemonsqueezy', name: 'Lemon Squeezy', kinds: ['karte', 'abonnement', 'haendler'], regionen: ['weltweit'], fee: { pct: 5, fix: 0.5, note: 'Weiterverkäufer-Modell' }, payout: 'monatlich', abo: true, kyc: true, keys: ['LEMON_API_KEY', 'LEMON_WEBHOOK_SECRET'], deutschland: true, url: 'lemonsqueezy.com', stark: ['Schnell eingerichtet', 'Digitalprodukte mit Lizenzschlüsseln'], schwach: ['Gebühr wie Paddle', 'Weniger Kontrolle über Checkout'] },
  { id: 'gumroad', name: 'Gumroad', kinds: ['karte', 'haendler'], regionen: ['weltweit'], fee: { pct: 10, fix: 0, note: 'Richtwert; Verkaufsseite inklusive' }, payout: 'wöchentlich', abo: true, kyc: true, keys: ['GUMROAD_TOKEN'], deutschland: true, url: 'gumroad.com', stark: ['Ohne eigene Seite verkaufen', 'Für Künstler üblich'], schwach: ['Hohe Gebühr', 'Marktplatz-Abhängigkeit'] },
  { id: 'sepa', name: 'SEPA-Überweisung', kinds: ['ueberweisung', 'lastschrift'], regionen: ['EU'], fee: { pct: 0, fix: 0, note: 'Überweisung kostet nur das eigene Bankkonto; Lastschrift je Vereinbarung' }, payout: '0–2 Tage', abo: true, kyc: false, keys: [], deutschland: true, url: '—', stark: ['Keine Anbietergebühr', 'Kein Konto bei Dritten nötig'], schwach: ['Kein sofortiger Zahlungseingang', 'Kein Käuferschutz'] },
  { id: 'rechnung', name: 'Kauf auf Rechnung (eigene Rechnung)', kinds: ['rechnung'], regionen: ['EU'], fee: { pct: 0, fix: 0, note: 'Ausfallrisiko trägt der Rechnungssteller' }, payout: 'je Zahlungsziel', abo: false, kyc: false, keys: [], deutschland: true, url: '—', stark: ['Günstig', 'Für gute Stammkunden üblich'], schwach: ['Ausfallrisiko', 'Mahnwesen nötig'] },
  { id: 'krypto', name: 'Krypto-Zahlung (Coinbase Commerce, BTCPay)', kinds: ['krypto'], regionen: ['weltweit'], fee: { pct: 1, fix: 0, note: 'Coinbase Commerce Richtwert; BTCPay selbst gehostet kostenfrei' }, payout: 'sofort in Krypto', abo: false, kyc: true, keys: ['COINBASE_COMMERCE_KEY'], deutschland: true, url: 'commerce.coinbase.com', stark: ['Grenzenlos', 'Keine Rückbuchungen'], schwach: ['Kursrisiko', 'Buchhaltung und Steuer aufwändig'] },
  { id: 'amazonpay', name: 'Amazon Pay', kinds: ['geldboerse', 'karte'], regionen: ['EU', 'US'], fee: { pct: 2.9, fix: 0.3, note: 'Richtwert' }, payout: 'je Vertrag', abo: false, kyc: true, keys: ['AMAZON_PAY_KEY', 'AMAZON_PAY_SECRET'], deutschland: true, url: 'pay.amazon', stark: ['Käufer sind angemeldet', 'Reibungsloser Checkout'], schwach: ['Amazon-Konto nötig', 'Datenschutz-Thema'] },
  { id: 'paydirekt', name: 'giropay / paydirekt', kinds: ['ueberweisung'], regionen: ['DE'], fee: { pct: 0.9, fix: 0.1, note: 'Richtwert; giropay wird eingestellt — Nachfolgewege prüfen' }, payout: '1–2 Tage', abo: false, kyc: true, keys: ['GIROPAY_MERCHANT_ID'], deutschland: true, url: 'giropay.de', stark: ['Direkt vom Girokonto', 'In DE bekannt'], schwach: ['Ablösung im Gange', 'Anbieterbindung'] },
  { id: 'wise', name: 'Wise (Ausland, Plattform-Auszahlung)', kinds: ['ueberweisung', 'auszahlung'], regionen: ['weltweit'], fee: { pct: 0.6, fix: 0, note: 'Richtwert Umrechnung' }, payout: 'Stunden bis 2 Tage', abo: false, kyc: true, keys: ['WISE_API_TOKEN'], deutschland: true, url: 'wise.com', stark: ['Günstige Umrechnung', 'Für Auslandseinnahmen'], schwach: ['Kein Bezahl-Formular für Kunden', 'Konto-Prüfung'] },
  { id: 'spotify_payout', name: 'Plattform-Abrechnung (Streaming/Labels)', kinds: ['plattform'], regionen: ['weltweit'], fee: { pct: 0, fix: 0, note: 'Anteil je Plattform; Auszahlung über Distributor' }, payout: 'monatlich/quartalsweise', abo: false, kyc: true, keys: ['DISTRIBUTOR_API_KEY'], deutschland: true, url: '—', stark: ['Einnahmen aus Streaming', 'Ohne eigenen Checkout'], schwach: ['Schwellenwerte', 'Konten je Plattform nötig'] },
  { id: 'bank', name: 'Eigenes Bankkonto / Bar', kinds: ['ueberweisung', 'bar'], regionen: ['DE'], fee: { pct: 0, fix: 0, note: 'Kontogebühren des eigenen Kontos' }, payout: 'sofort', abo: false, kyc: false, keys: [], deutschland: true, url: '—', stark: ['Immer möglich', 'Kein Dritter'], schwach: ['Keine Automatik', 'Buchhaltung von Hand'] },
];

// Für welchen Zweck welcher Weg sinnvoll ist. Punktzahl statt Behauptung.
const PURPOSES = {
  abo: { name: 'Wiederkehrende Zahlung (Abo)', want: ['abo'], weight: { fee: 0.25, abo: 0.35, deutschland: 0.2, stark: 0.2 } },
  einmalig: { name: 'Einmaliger Verkauf digitaler Ware', want: ['karte'], weight: { fee: 0.35, deutschland: 0.25, abo: 0.1, stark: 0.3 } },
  vor_ort: { name: 'Zahlung vor Ort', want: ['vorort'], weight: { fee: 0.4, vorort: 0.3, stark: 0.3 } },
  rechnung: { name: 'Rechnung / Raten', want: ['rechnung'], weight: { fee: 0.3, deutschland: 0.2, stark: 0.5 } },
  klein: { name: 'Kleinbeträge ohne Anbietervertrag', want: [], weight: { fee: 0.6, deutschland: 0.2, stark: 0.2 } },
  weltweit: { name: 'Weltweit verkaufen', want: ['karte'], weight: { fee: 0.3, abo: 0.2, stark: 0.5 } },
};

function defaults() { return { audits: [], checkouts: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['audits', 'checkouts']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function vaultNames() {
  try {
    const v = require('./vault');
    const l = typeof v.listSecrets === 'function' ? v.listSecrets() : null;
    const arr = Array.isArray(l) ? l : (l && Array.isArray(l.secrets) ? l.secrets : []);
    return arr.map((x) => (typeof x === 'string' ? x : (x && (x.name || x.id)) || '')).filter(Boolean);
  } catch { return []; }
}

// Zustand je Anbieter: bereit heißt: alle Schlüssel da. Sonst: was fehlt, ehrlich benannt.
function state() {
  const names = vaultNames();
  const has = (k) => names.includes(k);
  const items = PROVIDERS.map((p) => {
    const missing = p.keys.filter((k) => !has(k));
    const ready = p.keys.length === 0 ? true : missing.length === 0;
    return {
      id: p.id, name: p.name, kinds: p.kinds, deutschland: p.deutschland,
      fee_guide: p.fee, payout: p.payout, abo: p.abo, kyc: p.kyc,
      state: ready ? (p.keys.length === 0 ? 'OHNE ANBIETER MÖGLICH' : 'BEREIT') : 'NOT-CONNECTED',
      missing_keys: missing,
      data_protection: p.kyc ? 'Konto-Prüfung (KYC) beim Anbieter nötig' : 'keine Konto-Prüfung nötig',
      stark: p.stark, schwach: p.schwach,
    };
  });
  const ready = items.filter((i) => i.state === 'BEREIT');
  return {
    ok: true, count: items.length, ready: ready.length,
    mode: ready.length ? `${ready.length} Anbieter verbunden` : 'LOKAL GEFÜHRT (kein Zahlungsanbieter verbunden)',
    providers: items,
    honesty: ['Gebühren sind Richtwerte aus öffentlichen Anbieterangaben (Stand 2025) und unverbindlich.', 'Ohne Schlüssel im Vault wird nichts verbunden und nichts abgebucht.', 'Jede Bewegung von Geld braucht einen Menschen.'],
  };
}

// Empfehlung mit nachvollziehbarer Punktzahl.
function choose(input) {
  const p = input || {};
  const purpose = PURPOSES[String(p.purpose || 'einmalig')];
  if (!purpose) return { ok: false, error: `Zweck unbekannt. Erlaubt: ${Object.keys(PURPOSES).join(', ')}` };
  const maxFeePct = Math.max(...PROVIDERS.map((x) => x.fee.pct)) || 1;
  const ranked = PROVIDERS.map((pr) => {
    const reasons = [];
    let score = 0;
    const feeScore = 1 - (pr.fee.pct / (maxFeePct || 1));
    score += feeScore * (purpose.weight.fee || 0) * 100;
    reasons.push(`Gebühr ${pr.fee.pct}% + ${pr.fee.fix} € (Richtwert) → ${Math.round(feeScore * 100)}/100 günstig`);
    const wantsMatch = purpose.want.filter((w) => pr.kinds.includes(w)).length;
    if (wantsMatch) { score += 35 * (purpose.weight[pr.kinds.find((k) => purpose.want.includes(k))] || 0.3) * 2; reasons.push(`kann ${pr.kinds.filter((k) => purpose.want.includes(k)).join(', ')}`); }
    if (pr.abo && purpose.weight.abo) { score += 30 * purpose.weight.abo * 3; reasons.push('wiederkehrende Zahlungen möglich'); }
    if (pr.deutschland && purpose.weight.deutschland) { score += 20 * purpose.weight.deutschland * 3; reasons.push('in Deutschland verbreitet'); }
    if (String(p.region || 'DE').toUpperCase() === 'DE' && !pr.deutschland) { score -= 12; reasons.push('kein Schwerpunkt Deutschland'); }
    if (pr.keys.length === 0) { score += 8; reasons.push('ohne Anbietervertrag nutzbar'); }
    const st = state().providers.find((x) => x.id === pr.id);
    return { id: pr.id, name: pr.name, score: Math.round(Math.max(0, Math.min(100, score))), ready: st ? st.state : 'unbekannt', fee_guide: `${pr.fee.pct}% + ${pr.fee.fix} €`, payout: pr.payout, reasons: reasons.slice(0, 4), missing_keys: st ? st.missing_keys : pr.keys };
  }).sort((a, b) => b.score - a.score);
  const data = load();
  data.audits.unshift({ at: new Date().toISOString(), purpose: purpose.id, top: ranked.slice(0, 3).map((r) => `${r.id}:${r.score}`) });
  data.audits = data.audits.slice(0, 100);
  save(data);
  return {
    ok: true, purpose: purpose.id, purpose_name: purpose.name,
    recommendation: ranked[0],
    shortlist: ranked.slice(0, 5),
    blocked: ranked[0].ready !== 'BEREIT' && ranked[0].missing_keys.length > 0,
    note: ranked[0].ready !== 'BEREIT' && ranked[0].missing_keys.length
      ? `Empfehlung rechnerisch klar, aber nicht verbunden: es fehlen ${ranked[0].missing_keys.join(', ')} im Vault. Bis dahin bleibt es beim lokalen Führen der Bücher.`
      : 'Empfehlung rechnerisch und verbunden — Geld bewegt sich trotzdem nur mit menschlicher Freigabe.',
    honesty: 'Punktzahlen kommen aus Gebühren-Richtwerten, Verbreitung und Eigenschaften der Wege. Sie sind ein Vorschlag, keine Zusage.',
  };
}

// Zahlungsvorgang vorbereiten. Ohne Schlüssel und ohne Mensch passiert nichts.
function checkout(input) {
  const p = input || {};
  const pr = PROVIDERS.find((x) => x.id === p.provider || x.name === p.provider);
  if (!pr) return { ok: false, error: `Anbieter unbekannt. Erlaubt: ${PROVIDERS.map((x) => x.id).join(', ')}` };
  const amount = Number(p.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'amount fehlt oder ist keine Zahl' };
  const st = state().providers.find((x) => x.id === pr.id);
  const steps = [
    { nr: 1, what: 'Betrag und Zweck festhalten', done: true, detail: `${amount.toFixed(2)} ${String(p.currency || 'EUR')} — ${String(p.purpose || 'ohne Angabe')}` },
    { nr: 2, what: 'Zahlungsweg verfügbar?', done: st.state === 'BEREIT' || pr.keys.length === 0, detail: st.state === 'BEREIT' ? 'Schlüssel im Vault vorhanden' : (pr.keys.length === 0 ? 'kein Anbietervertrag nötig' : `fehlt: ${st.missing_keys.join(', ')}`) },
    { nr: 3, what: 'Menschliche Freigabe', done: p.human === true, detail: p.human === true ? 'Freigabe liegt vor' : 'ohne Freigabe wird nichts ausgelöst' },
    { nr: 4, what: 'Auslösen beim Anbieter', done: false, detail: 'wird von AURA nicht selbst ausgelöst — dafür ist ein Mensch am Anbieterkonto zuständig' },
  ];
  const blockedBy = [];
  if (!(st.state === 'BEREIT' || pr.keys.length === 0)) blockedBy.push(`Anbieter nicht verbunden (${st.missing_keys.join(', ')})`);
  if (p.human !== true) blockedBy.push('menschliche Freigabe fehlt (human: true)');
  const data = load();
  const record = {
    id: 'pay-' + Math.random().toString(16).slice(2, 10), at: new Date().toISOString(),
    provider: pr.id, amount, currency: String(p.currency || 'EUR'), purpose: String(p.purpose || ''),
    blocked: blockedBy.length > 0, blocked_by: blockedBy, charged: false,
    fee_guide: amount * (pr.fee.pct / 100) + pr.fee.fix,
    note: 'Kein Geldfluss durch diese Datei. Sie rechnet und dokumentiert.',
  };
  data.checkouts.unshift(record); data.checkouts = data.checkouts.slice(0, 200);
  save(data);
  return {
    ok: !record.blocked, status: record.blocked ? 'NICHT AUSGELÖST' : 'BEREIT (Auslösung beim Anbieter durch einen Menschen)',
    provider: { id: pr.id, name: pr.name, fee_guide: `${pr.fee.pct}% + ${pr.fee.fix} €`, payout: pr.payout },
    plan: steps, blocked_by: blockedBy, charged: false,
    fee_estimate: { amount, fee: Number(record.fee_guide.toFixed(2)), net: Number((amount - record.fee_guide).toFixed(2)), note: 'Schätzung mit Richtwerten' },
    record,
    rule: 'Diese Datei bucht nichts ab. Sie plant, rechnet und belegt — die Auslösung macht ein Mensch beim Anbieter.',
  };
}

function status() {
  const data = load();
  const st = state();
  let billing = null;
  try { const b = require('./billing_plans'); billing = typeof b.status === 'function' ? b.status() : null; } catch { billing = null; }
  return {
    area: 'PAY', module: 'payment_providers', state: 'live', file: FILE,
    providers: st.count, ready: st.ready, mode: st.mode,
    purposes: Object.keys(PURPOSES).filter((k) => PURPOSES[k] && PURPOSES[k].name),
    audits: data.audits.length, checkouts: data.checkouts.length,
    billing_mode: billing ? billing.payment_mode : 'unbekannt',
    rules: ['Alle Wege an einem Ort, mit Richtwert-Gebühren und ehrlichem Verbindungszustand.', 'Ohne Schlüssel: nur rechnen und lokal buchen.', 'Geld bewegt sich nur mit Schlüssel UND Mensch.', 'Keine Zugangsdaten in dieser Datei — Schlüssel gehören in den Vault.'],
  };
}

module.exports = {
  meta: { area: 'PAY', id: 'payment_providers', name: 'Zahlungsdienstleister (Katalog, Empfehlung, Zahlungsplan)', state: 'live' },
  actions: { status: () => status(), providers: () => state(), purposes: () => ({ ok: true, purposes: Object.keys(PURPOSES).map((k) => ({ id: k, name: PURPOSES[k].name, want: PURPOSES[k].want })) }), choose: (p) => choose(p || {}), checkout: (p) => checkout(p || {}), checkouts: () => { const d = load(); return { ok: true, count: d.checkouts.length, checkouts: d.checkouts.slice(0, 20) }; } },
  PROVIDERS, PURPOSES, state, choose, checkout, status,
};
