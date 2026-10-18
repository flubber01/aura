'use strict';
// Prüft die Zahlungs-Validierungen (Runde 5, Punkt f): Karte (Luhn), IBAN (Mod 97), BIC,
// USt-IdNr. (deutsches Verfahren), Betrag (Dezimalregeln je Währung), SEPA-Mandat,
// Gläubiger-ID, Gutscheincode (Mod-36-Prüfziffer) und den Gesamtablauf.
//
// Es werden nur erfundene Testnummern benutzt. Gespeichert wird nichts außer der Ergebnisseite.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-pay-'));
process.env.AURA_PAYCHECK_FILE = path.join(tmp, 'paycheck.json');

const P = require('../backend/src/lib/payment_validation');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); }
}

check('Luhn: richtige Nummer besteht, vertippte Nummer fällt durch', () => {
  assert.strictEqual(P.luhn('4111111111111111').ok, true);
  assert.strictEqual(P.luhn('4111111111111112').ok, false);
  assert.strictEqual(P.luhn('4111 1111 1111 1111'.replace(/\D/g, '')).ok, true);
  assert.strictEqual(P.luhn('keine ziffern').ok, false);
});
check('Karte: Marke, Länge und Sicherheitscode werden erkannt', () => {
  const v = P.validate({ method: 'karte', purpose: 'ABO', amount: '29,99', currency: 'EUR', card: { number: '4111 1111 1111 1111', cvc: '123', exp: '12/28' } });
  assert.strictEqual(v.verdict, 'BESTANDEN');
  const num = v.checks.find((c) => c.check === 'Kartennummer');
  assert.strictEqual(num.brand, 'Visa');
  assert.strictEqual(num.last4, '1111');
  assert.ok(!JSON.stringify(v).includes('4111111111111111'), 'die volle Nummer darf nicht zurückkommen');
  const amex = P.validate({ method: 'karte', amount: 10, card: { number: '378282246310005', cvc: '123', exp: '12/28' } });
  assert.strictEqual(amex.verdict, 'ABGELEHNT', 'American Express braucht vier Stellen im Sicherheitscode');
  assert.ok(amex.failed.includes('Sicherheitscode'));
});
check('Karte: abgelaufene Karte und falsche Länge werden abgelehnt', () => {
  const old = P.validate({ method: 'karte', amount: 10, card: { number: '4111111111111111', cvc: '123', exp: '01/24' } });
  assert.ok(old.failed.includes('Ablaufdatum'));
  const short = P.validate({ method: 'karte', amount: 10, card: { number: '411111111111', cvc: '123', exp: '12/28' } });
  assert.ok(short.failed.includes('Kartennummer'));
});
check('IBAN: Prüfziffer nach Mod 97 wird wirklich gerechnet', () => {
  const good = P.iban('DE89 3704 0044 0532 0130 00');
  assert.strictEqual(good.check_ok, true);
  assert.strictEqual(good.rest, 1);
  assert.strictEqual(good.country, 'DE');
  const bad = P.iban('DE89 3704 0044 0532 0130 01');
  assert.strictEqual(bad.check_ok, false);
  assert.notStrictEqual(bad.rest, 1);
  assert.ok(P.iban('DE893704004405320130').error.includes('22 Zeichen'));
  assert.strictEqual(P.iban('X').ok, false);
});
check('BIC: Aufbau, Land und Stelle werden gelesen', () => {
  const b = P.bic('COBADEFFXXX');
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.country, 'DE');
  assert.strictEqual(b.form, 'Hauptstelle (11 Zeichen)');
  assert.strictEqual(P.bic('COBADEFF').form, 'Kurzform (8 Zeichen)');
  assert.strictEqual(P.bic('X').ok, false);
});
check('USt-IdNr.: deutsches Produktverfahren mod 11', () => {
  assert.strictEqual(P.vatDe('DE136695976').ok, true);
  assert.strictEqual(P.vatDe('DE136695977').ok, false);
  assert.ok(P.vatDe('ATU12345678').error.includes('DE'));
});
check('Betrag: Schreibweisen, Dezimalregeln und kleinste Einheit', () => {
  assert.strictEqual(P.amount({ amount: '1.250,00', currency: 'EUR' }).amount, 1250);
  assert.strictEqual(P.amount({ amount: '1,250.00', currency: 'EUR' }).amount, 1250);
  assert.strictEqual(P.amount({ amount: '29,99', currency: 'EUR' }).minor_units, 2999);
  assert.strictEqual(P.amount({ amount: '29,99', currency: 'EUR' }).lossless, true);
  assert.ok(P.amount({ amount: '0,001', currency: 'EUR' }).error.includes('2 Nachkommastellen'));
  assert.ok(P.amount({ amount: '120.5', currency: 'JPY' }).error.includes('0 Nachkommastellen'));
  assert.ok(P.amount({ amount: 0, currency: 'EUR' }).error.includes('kleinsten Betrag'));
  assert.ok(P.amount({ amount: 999999, currency: 'EUR' }).error.includes('Obergrenze'));
  assert.ok(P.amount({ amount: 10, currency: 'XYZ' }).error.includes('Währung unbekannt'));
});
check('SEPA: Mandat, Mandatsreferenz und Gläubiger-ID', () => {
  assert.strictEqual(P.mandateRef('CREED-2026-0001').ok, true);
  assert.strictEqual(P.mandateRef('x'.repeat(40)).ok, false);
  const cid = P.creditorMake('CREEDSTREET1');
  assert.strictEqual(P.creditorId(cid).ok, true);
  assert.strictEqual(P.creditorId('DE99ZZZ09999999999').ok, false);
  assert.ok(P.creditorId(cid).hint.includes('Bundesbank'));
});
check('Gutscheincode: eigene Prüfziffer, Tippfehler fallen auf', () => {
  const code = P.couponMake('CREED2026');
  assert.ok(/^CREED-[A-Z0-9]{4}-[A-Z0-9]{3}\d$/.test(code));
  assert.strictEqual(P.coupon(code).ok, true);
  for (let i = 0; i <= 9; i++) {
    const wrong = code.slice(0, -1) + i;
    if (wrong !== code) assert.strictEqual(P.coupon(wrong).ok, false, wrong + ' müsste durchfallen');
  }
});
check('Ablauf: vollständige SEPA-Zahlung besteht, kaputte wird abgelehnt', () => {
  const good = P.validate({ method: 'sepa', purpose: 'ABO', amount: 29.99, iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', mandate_ref: 'CREED-2026-0001', creditor_id: P.creditorMake('CREEDSTREET1') });
  assert.strictEqual(good.verdict, 'BESTANDEN');
  assert.strictEqual(good.purpose, 'ABO');
  assert.ok(good.checks.some((c) => c.check === 'Mandat nötig' && c.needed === true));
  const bad = P.validate({ method: 'sepa', purpose: 'ABO', amount: 29.99, iban: 'DE89370400440532013001' });
  assert.strictEqual(bad.verdict, 'ABGELEHNT');
  assert.deepStrictEqual(bad.failed, ['IBAN']);
  const wrongPurpose = P.validate({ purpose: 'SPASS', amount: 10 });
  assert.deepStrictEqual(wrongPurpose.failed, ['Zweck']);
});
check('Ablauf: Rechnung mit Zahlungsziel und USt-IdNr. wird geprüft', () => {
  const v = P.validate({ method: 'rechnung', purpose: 'DIENSTLEISTUNG', amount: '1.250,00', vat_id: 'DE136695976', invoice: { days: 30 } });
  assert.strictEqual(v.verdict, 'BESTANDEN');
  const tooLong = P.validate({ method: 'rechnung', purpose: 'DIENSTLEISTUNG', amount: 100, invoice: { days: 90 } });
  assert.ok(tooLong.failed.includes('Zahlungsziel'));
  const badVat = P.validate({ method: 'rechnung', purpose: 'DIENSTLEISTUNG', amount: 100, invoice: { days: 14 }, vat_id: 'DE136695977' });
  assert.ok(badVat.failed.includes('USt-IdNr.'));
});
check('Ehrlichkeit: Prüfung ist keine Zahlung, Ablauf wird festgehalten', () => {
  const st = P.status();
  assert.ok(st.procedures.some((p) => p.includes('Luhn')));
  assert.ok(st.procedures.some((p) => p.includes('Mod 97')));
  assert.ok(st.rules.some((r) => r.toLowerCase().includes('kartennummer')));
  const h = P.actions.history();
  assert.strictEqual(h.ok, true);
  assert.ok(h.count >= 8, 'die Läufe der Prüfung sollen festgehalten werden');
  assert.ok(h.checks.every((c) => ['BESTANDEN', 'ABGELEHNT'].includes(c.verdict)));
  const v = P.validate({ method: 'karte', amount: 10, card: { number: '4111111111111111', cvc: '123', exp: '12/28' } });
  assert.ok(v.honesty.includes('keine Zahlung'));
  assert.ok(v.rule.includes('Gespeichert wird nichts'));
});

console.log(`\npayment_validation: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
