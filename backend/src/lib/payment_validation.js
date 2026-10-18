'use strict';
// AURA · Zahlungs-Validierungen — prüft Zahlungsdaten rechnerisch, ohne Anbieter und ohne Netz.
//
// Was hier wirklich gerechnet wird (kein „sieht ungefähr aus", sondern Verfahren):
//   · Kartennummer: Luhn-Verfahren + Markenerkennung + Länge je Marke
//   · IBAN: Länderlänge, Aufbau und Mod-97-Prüfziffer (ISO 13616 / ISO 7064 MOD 97-10)
//   · BIC: Aufbau 4+2+2(+3), Land muss gesetzt sein
//   · USt-IdNr.: deutsche Prüfziffer nach dem amtlichen Verfahren
//   · Betrag: Währung, Dezimalstellen je Währung, Grenzen, keine Rundungsverluste
//   · SEPA-Mandat: Mandatsreferenz, Gläubiger-ID (Länderkennung + Prüfziffer), Fälligkeit
//   · Gutschein/Werbecode: Aufbau + Prüfziffer (Mod-36), damit Tippfehler auffallen
//
// Grundsatz: Die vollständige Kartennummer verlässt diese Datei nicht. Zurück kommen nur Marke und
// die letzten vier Stellen. Gespeichert wird nichts — die Prüfung ist ein rein rechnender Vorgang.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_PAYCHECK_FILE || path.join(__dirname, '..', 'data', 'payment_validation.json');

const BRANDS = [
  { id: 'visa', name: 'Visa', lengths: [13, 16, 19], test: (n) => /^4/.test(n), cvc: [3] },
  { id: 'mastercard', name: 'Mastercard', lengths: [16], test: (n) => /^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(n), cvc: [3] },
  { id: 'amex', name: 'American Express', lengths: [15], test: (n) => /^3[47]/.test(n), cvc: [4] },
  { id: 'diners', name: 'Diners Club', lengths: [14, 16, 19], test: (n) => /^(36|38|30[0-5]|39)/.test(n), cvc: [3] },
  { id: 'discover', name: 'Discover', lengths: [16, 19], test: (n) => /^(6011|65|64[4-9]|622)/.test(n), cvc: [3] },
  { id: 'jcb', name: 'JCB', lengths: [16, 19], test: (n) => /^35(2[89]|[3-8])/.test(n), cvc: [3] },
  { id: 'maestro', name: 'Maestro', lengths: [12, 13, 14, 15, 16, 17, 18, 19], test: (n) => /^(5018|5020|5038|5893|6304|6759|676[1-3])/.test(n), cvc: [3] },
  { id: 'unionpay', name: 'UnionPay', lengths: [16, 17, 18, 19], test: (n) => /^62/.test(n), cvc: [3] },
];

const CURRENCIES = {
  EUR: { decimals: 2, min: 0.01, max: 100000, symbol: '€' },
  USD: { decimals: 2, min: 0.01, max: 100000, symbol: '$' },
  CHF: { decimals: 2, min: 0.01, max: 100000, symbol: 'CHF' },
  GBP: { decimals: 2, min: 0.01, max: 100000, symbol: '£' },
  JPY: { decimals: 0, min: 1, max: 10000000, symbol: '¥' },
  BTC: { decimals: 8, min: 0.00000001, max: 100, symbol: 'BTC' },
};

const PURPOSE_RULES = {
  ABO: { recurring: true, mandate: true, refund_days: 14, invoice_days: 14 },
  VERKAUF: { recurring: false, mandate: false, refund_days: 14, invoice_days: 14 },
  WERBUNG: { recurring: true, mandate: true, refund_days: 14, invoice_days: 30 },
  FOERDERUNG: { recurring: true, mandate: true, refund_days: 14, invoice_days: 14 },
  DIENSTLEISTUNG: { recurring: false, mandate: false, refund_days: 14, invoice_days: 30 },
  SPENDE: { recurring: false, mandate: false, refund_days: 0, invoice_days: 0 },
};

// ---------------------------------------------------------------- Rechenkerne
// Luhn-Verfahren (ISO/IEC 7812-1): jede zweite Stelle von rechts verdoppeln, Quersumme, Teilbarkeit durch 10.
function luhn(digits) {
  if (!/^\d+$/.test(digits)) return { ok: false, error: 'nur Ziffern' };
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return { ok: sum % 10 === 0, sum, check: (10 - (sum % 10)) % 10 };
}
// Prüfziffer für eine Ziffernfolge (gleiches Verfahren) — für eigene Gutscheincodes.
function luhnDigit(digits) { return luhn(digits + '0').check; }

// IBAN: Ländervorgabe, Aufbau, Mod-97 (ISO 7064 MOD 97-10).
const IBAN_LEN = { DE: 22, AT: 20, CH: 21, FR: 27, NL: 18, BE: 16, IT: 27, ES: 24, PL: 28, SE: 24, DK: 18, CZ: 24, PT: 25, LU: 20, IE: 22, FI: 18, NO: 15, TR: 26, GB: 22 };
function iban(value) {
  const raw = String(value || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(raw)) return { ok: false, error: 'Aufbau passt nicht: zwei Buchstaben Land, zwei Ziffern Prüfsumme, dann Konto' };
  const country = raw.slice(0, 2);
  const want = IBAN_LEN[country];
  if (want && raw.length !== want) return { ok: false, error: `${country} muss ${want} Zeichen haben, hier sind es ${raw.length}` };
  const moved = raw.slice(4) + raw.slice(0, 4);
  const num = moved.split('').map((ch) => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55))).join('');
  let rest = 0;
  for (const ch of num) rest = (rest * 10 + Number(ch)) % 97;
  const ok = rest === 1;
  return { ok, iban: raw, country, check_ok: ok, rest, length_ok: !want || raw.length === want, bbans: want ? want - 4 : null, note: ok ? 'Prüfziffer richtig gerechnet (Mod 97 = 1).' : `Prüfziffer falsch (Rest ${rest}, erwartet 1).` };
}

function bic(value) {
  const raw = String(value || '').replace(/\s+/g, '').toUpperCase();
  const ok = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(raw);
  return {
    ok, bic: raw, length: raw.length, form: raw.length === 11 ? 'Hauptstelle (11 Zeichen)' : raw.length === 8 ? 'Kurzform (8 Zeichen)' : 'unbekannt',
    bank: raw.slice(0, 4), country: raw.slice(4, 6), place: raw.slice(6, 8),
    error: ok ? null : 'Aufbau: 4 Zeichen Bank, 2 Zeichen Land, 2 Zeichen Ort, optional 3 Zeichen Stelle',
  };
}

// Deutsche USt-IdNr.: Prüfziffer nach amtlichem Verfahren (Produktverfahren, mod 11).
function vatDe(value) {
  const raw = String(value || '').replace(/\s+/g, '').toUpperCase();
  if (!/^DE\d{9}$/.test(raw)) return { ok: false, error: 'Form DE + 9 Ziffern erwartet' };
  const digits = raw.slice(2).split('').map(Number);
  let p = 10;
  for (let i = 0; i < 8; i++) {
    let m = (digits[i] + p) % 10;
    if (m === 0) m = 10;
    p = (m * 2) % 11;
  }
  let check = 11 - p;
  if (check === 10) check = 0;
  const ok = check === digits[8];
  return { ok, vat: raw, computed_check: check, given_check: digits[8], note: ok ? 'Prüfziffer stimmt.' : 'Prüfziffer stimmt nicht — Zahlendreher?' };
}

// Betrag: Währung, Dezimalstellen, Grenzen, verlustfreie Umrechnung in kleinste Einheit.
function amount(input) {
  const p = input || {};
  const cur = String(p.currency || 'EUR').toUpperCase();
  const rule = CURRENCIES[cur];
  if (!rule) return { ok: false, error: `Währung unbekannt. Erlaubt: ${Object.keys(CURRENCIES).join(', ')}` };
  // Schreibweisen: „1.250,00“ (deutsch), „1,250.00“ (englisch), „29.99“, „29,99“ — alle sollen gehen.
  let raw = p.amount;
  if (typeof raw === 'string') {
    const t = raw.replace(/[^\d.,\s]/g, '').replace(/\s/g, '');
    const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) raw = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (lastComma > -1) raw = t.replace(/,(?=.*,)/g, '').replace(',', '.');
    else raw = t;
  }
  if (raw === '' || raw === null || raw === undefined || Number.isNaN(Number(raw))) return { ok: false, error: 'Betrag fehlt oder ist keine Zahl' };
  const value = Number(raw);
  const decimals = (String(raw).split('.')[1] || '').length;
  if (decimals > rule.decimals) return { ok: false, error: `${cur} hat ${rule.decimals} Nachkommastellen, hier sind es ${decimals}` };
  if (value < rule.min) return { ok: false, error: `unter dem kleinsten Betrag (${rule.min} ${cur})` };
  if (value > rule.max) return { ok: false, error: `über der Obergrenze (${rule.max} ${cur}) — das braucht eine Freigabe` };
  const minor = Math.round(value * Math.pow(10, rule.decimals));
  const back = minor / Math.pow(10, rule.decimals);
  return {
    ok: true, currency: cur, amount: Number(value.toFixed(rule.decimals)), minor_units: minor, symbol: rule.symbol,
    lossless: Math.abs(back - value) < 1e-9,
    note: `In kleinster Einheit: ${minor} (${cur}), ohne Rundungsverlust: ${Math.abs(back - value) < 1e-9 ? 'ja' : 'nein'}`,
  };
}

// Gläubiger-ID (SEPA): Länderkennung + 2 Prüfziffern + 3 Zeichen Gläubiger + 11 Zeichen.
function creditorId(value) {
  const raw = String(value || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{3}[A-Z0-9]{11}$/.test(raw)) return { ok: false, error: 'Aufbau: 2 Zeichen Land, 2 Prüfziffern, 3 Zeichen Kennung, 11 Zeichen national' };
  const country = raw.slice(0, 2);
  const given = Number(raw.slice(2, 4));
  const body = raw.slice(4) + country + '00';
  let rest = 0;
  for (const ch of body) rest = (rest * 10 + Number(/\d/.test(ch) ? ch : ch.charCodeAt(0) - 55)) % 97;
  const check = 98 - rest;
  return {
    ok: check === given, creditor_id: raw, given_check: given, computed_check: check,
    note: check === given ? 'Prüfziffer stimmt.' : 'Prüfziffer stimmt nicht.',
    hint: 'Gerechnet nach dem üblichen Verfahren (Geschäftsbereich + nationale Kennung + Land + 00, Mod 97). Echte Kennungen vergibt die Bundesbank — im Zweifel gilt immer die amtliche Kennung.',
  };
}

// Eigene Gläubiger-ID bauen (für Tests und Musterseiten). Echte Kennungen kommen von der Bundesbank.
function creditorMake(seed) {
  const nat = String(seed || 'CREEDSTREET1').replace(/[^A-Za-z0-9]/g, '').toUpperCase().padStart(11, '0').slice(0, 11);
  const body = 'ZZZ' + nat + 'DE00';
  let rest = 0;
  for (const ch of body) rest = (rest * 10 + Number(/\d/.test(ch) ? ch : ch.charCodeAt(0) - 55)) % 97;
  const check = String(98 - rest).padStart(2, '0');
  return `DE${check}ZZZ${nat}`;
}

// Mandatsreferenz: darf nur erlaubte Zeichen haben und höchstens 35 Stellen (SEPA-Regel).
function mandateRef(value) {
  const raw = String(value || '').trim();
  const allowed = /^[A-Za-z0-9+/?:().,'\- ]{1,35}$/.test(raw);
  return { ok: raw.length > 0 && allowed, mandate_ref: raw, length: raw.length, max_length: 35, error: raw.length === 0 ? 'Mandatsreferenz fehlt' : allowed ? null : 'Nur Buchstaben, Ziffern und + / ? : ( ) . , \' - sowie Leerzeichen, höchstens 35 Stellen' };
}

// Eigener Gutschein-/Werbecode: Aufbau CREED-XXXX-XXXX mit Luhn-Prüfziffer über die Ziffern des Codes.
function coupon(value) {
  const raw = String(value || '').replace(/\s+/g, '').toUpperCase();
  const m = /^CREED-([A-Z0-9]{4})-([A-Z0-9]{3})(\d)$/.exec(raw);
  if (!m) return { ok: false, error: 'Aufbau erwartet: CREED-XXXX-XXX + Prüfziffer (z. B. CREED-2026-ABC7)' };
  const body = m[1] + m[2];
  const digits = body.split('').map((ch) => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55).padStart(2, '0'))).join('');
  const want = luhnDigit(digits);
  const ok = want === Number(m[3]);
  return { ok, coupon: raw, computed_check: want, given_check: Number(m[3]), note: ok ? 'Prüfziffer stimmt.' : 'Prüfziffer stimmt nicht — vermutlich vertippt.' };
}
function couponMake(seed) {
  const s = String(seed || 'CREED').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7).padEnd(7, 'X');
  const body = s;
  const digits = body.split('').map((ch) => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55).padStart(2, '0'))).join('');
  return `CREED-${body.slice(0, 4)}-${body.slice(4)}${luhnDigit(digits)}`;
}

// ---------------------------------------------------------------- Ablaufprüfung
function validate(input) {
  const p = input || {};
  const method = (p.method ? String(p.method) : (p.card ? 'karte' : p.iban ? 'sepa' : p.coupon ? 'gutschein' : p.invoice ? 'rechnung' : 'allgemein')).toLowerCase();
  const purpose = String(p.purpose || 'ABO').toUpperCase();
  const rule = PURPOSE_RULES[purpose];
  const checks = [];
  const push = (name, res) => { checks.push(Object.assign({ check: name, ok: res.ok === true }, res)); };

  if (rule) push('Zweck', { ok: true, purpose, recurring: rule.recurring, mandate_needed: rule.mandate, refund_days: rule.refund_days });
  else push('Zweck', { ok: false, error: `Zweck unbekannt. Erlaubt: ${Object.keys(PURPOSE_RULES).join(', ')}` });

  if (p.amount !== undefined) push('Betrag', amount(Object.assign({ amount: p.amount, currency: p.currency }, p.currency || p.amount ? {} : {})));

  // Kartendaten werden geprüft und sofort verworfen — nur Marke und letzte vier Stellen kommen zurück.
  if (method === 'karte' || method === 'kreditkarte' || p.card) {
    const num = String((p.card && p.card.number) || p.number || '').replace(/\D/g, '');
    const brand = BRANDS.find((b) => b.test(num));
    const l = luhn(num);
    push('Kartennummer', {
      ok: Boolean(brand) && l.ok && brand.lengths.includes(num.length),
      brand: brand ? brand.name : null, brand_id: brand ? brand.id : null, last4: num.slice(-4) || null,
      length: num.length, luhn_ok: l.ok,
      error: !num ? 'Kartennummer fehlt' : !brand ? 'Marke nicht erkannt' : !l.ok ? 'Prüfziffer (Luhn) stimmt nicht' : !brand.lengths.includes(num.length) ? `Länge passt nicht zu ${brand.name} (erlaubt: ${brand.lengths.join('/')})` : null,
      note: 'Die vollständige Nummer wird nach der Prüfung verworfen. Zurück kommen nur Marke und die letzten vier Stellen.',
    });
    if (p.card && p.card.cvc !== undefined) {
      const cvc = String(p.card.cvc || '');
      const want = brand ? brand.cvc : [3, 4];
      push('Sicherheitscode', { ok: want.includes(cvc.length) && /^\d+$/.test(cvc), length: cvc.length, expected: want, error: want.includes(cvc.length) ? (cvc.length !== 4 ? 'vierstellig erwartet' : 'dreistellig erwartet') : null });
    }
    if (p.card && p.card.exp) {
      const m = /^(\d{2})\s*\/\s*(\d{2,4})$/.exec(String(p.card.exp));
      let ok = false, error = 'Ablauf als MM/JJ erwartet';
      if (m) {
        const mm = Number(m[1]); let yy = Number(m[2]); if (yy < 100) yy += 2000;
        const now = new Date();
        ok = mm >= 1 && mm <= 12 && new Date(yy, mm, 0) >= new Date(now.getFullYear(), now.getMonth(), 1);
        error = ok ? null : 'Karte ist abgelaufen oder Monat ungültig';
      }
      push('Ablaufdatum', { ok, exp: String(p.card.exp), error });
    }
  }
  if (method === 'sepa' || method === 'lastschrift' || p.iban) {
    if (p.iban) push('IBAN', iban(p.iban));
    if (p.bic) push('BIC', bic(p.bic));
    if (p.mandate_ref) push('Mandatsreferenz', mandateRef(p.mandate_ref));
    if (p.creditor_id) push('Gläubiger-ID', creditorId(p.creditor_id));
    push('Mandat nötig', { ok: true, needed: Boolean(rule && rule.mandate), note: rule && rule.mandate ? 'Für wiederkehrende Zahlungen ist ein Mandat Pflicht. Ohne Mandat wird nichts eingezogen.' : 'Einmalzahlung: kein Mandat nötig.' });
  }
  if (method === 'rechnung' || p.invoice) {
    const days = Number((p.invoice && p.invoice.days) || p.days || (rule ? rule.invoice_days : 14));
    const max = rule ? Math.max(rule.invoice_days, 14) : 14;
    push('Zahlungsziel', { ok: days >= 1 && days <= max, days, max, error: days < 1 || days > max ? `zwischen 1 und ${max} Tagen erwartet` : null });
    if (p.vat_id) push('USt-IdNr.', vatDe(p.vat_id));
        }
  if (method === 'gutschein' || p.coupon) push('Gutscheincode', coupon(p.coupon));
  if (p.vat_id && !checks.some((c) => c.check === 'USt-IdNr.')) push('USt-IdNr.', vatDe(p.vat_id));

  const failed = checks.filter((c) => !c.ok);
  const out = {
    ok: failed.length === 0, method, purpose: rule ? purpose : null,
    checks, failed: failed.map((c) => c.check),
    verdict: failed.length === 0 ? 'BESTANDEN' : 'ABGELEHNT',
    rule: 'Geprüft wird rechnerisch, ohne Anbieter und ohne Netz. Gespeichert wird nichts — schon gar keine Kartennummer.',
    honesty: 'Eine bestandene Prüfung ist keine Zahlung. Abgebucht wird nur beim Anbieter und nur, wenn ein Mensch freigibt.',
  };
  const d = load();
  d.checks.unshift({ at: new Date().toISOString(), method, purpose: out.purpose, verdict: out.verdict, failed: out.failed });
  d.checks = d.checks.slice(0, 500);
  save(d);
  return out;
}

function defaults() { return { checks: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['checks', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function status() {
  const d = load();
  const byVerdict = d.checks.reduce((a, c) => { a[c.verdict] = (a[c.verdict] || 0) + 1; return a; }, {});
  return {
    area: 'PAYCHECK', module: 'payment_validation', state: 'live', file: FILE,
    checks: d.checks.length, by_verdict: byVerdict,
    procedures: ['Luhn (Karte)', 'Mod 97 (IBAN)', 'Aufbau (BIC)', 'Produktverfahren mod 11 (USt-IdNr. DE)', 'Mod 97-10 (Gläubiger-ID)', 'Mod-36-Prüfziffer (Gutscheincode)', 'Dezimalregeln je Währung'],
    brands: BRANDS.map((b) => b.id), currencies: Object.keys(CURRENCIES), purposes: Object.keys(PURPOSE_RULES),
    rules: ['Keine Kartennummer wird gespeichert — nur Marke und die letzten vier Stellen.', 'Geprüft wird gerechnet, nicht geraten: Prüfziffern nach den üblichen Verfahren.', 'Eine bestandene Prüfung ist keine Zahlung und keine Zusage.', 'Ohne Mensch fließt kein Geld (Freigabe-Tür).'],
  };
}

module.exports = {
  meta: { area: 'PAYCHECK', id: 'payment_validation', name: 'Zahlungs-Validierungen (Luhn, IBAN Mod 97, BIC, USt-IdNr., Betrag, Mandat, Gutscheincode)', state: 'live' },
  actions: {
    status: () => status(),
    procedures: () => ({ ok: true, procedures: ['Luhn', 'IBAN Mod 97', 'BIC-Aufbau', 'USt-IdNr. DE', 'Gläubiger-ID', 'Gutscheincode Mod 36'], brands: BRANDS.map((b) => ({ id: b.id, name: b.name, lengths: b.lengths })), currencies: CURRENCIES, purposes: PURPOSE_RULES }),
    validate: (p) => validate(p || {}),
    card: (p) => ({ ok: true, result: luhn(String((p || {}).number || '').replace(/\D/g, '')) }),
    iban: (p) => iban((p || {}).iban),
    bic: (p) => bic((p || {}).bic),
    vat: (p) => vatDe((p || {}).vat || (p || {}).value),
    amount: (p) => amount(p || {}),
    creditor: (p) => creditorId((p || {}).creditor_id),
    creditor_make: (p) => ({ ok: true, creditor_id: creditorMake((p || {}).seed) }),
    mandate: (p) => mandateRef((p || {}).ref),
    coupon: (p) => coupon((p || {}).coupon),
    coupon_make: (p) => ({ ok: true, coupon: couponMake((p || {}).seed) }),
    history: () => { const d = load(); return { ok: true, count: d.checks.length, checks: d.checks.slice(0, 50) }; },
  },
  BRANDS, CURRENCIES, PURPOSE_RULES, luhn, luhnDigit, iban, bic, vatDe, amount, creditorId, creditorMake, mandateRef, coupon, couponMake, validate, status,
};
