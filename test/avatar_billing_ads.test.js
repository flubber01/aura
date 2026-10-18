'use strict';
// Prüft Avatar-Studio (Kunstfigur/Podcast), Bezahlpläne und Werbung.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-aba-'));
process.env.AURA_AVATAR_FILE = path.join(tmp, 'avatars.json');
process.env.AURA_BILLING_FILE = path.join(tmp, 'billing.json');
process.env.AURA_ADS_FILE = path.join(tmp, 'advertising.json');
process.env.AURA_SPEECH_FILE = path.join(tmp, 'speech.json');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const av = require('../backend/src/lib/avatar_studio');
const bill = require('../backend/src/lib/billing_plans');
const ads = require('../backend/src/lib/advertising');

// ------------------------------------------------------------ Avatar
t('Avatar: Kunstfigur wird angelegt — mit Kennzeichnung, Wesenszug und Grenzen', () => {
  const a = av.create({ name: 'Nova', niche: 'Musikproduktion für Einsteiger', archetype: 'erklaerer', audience: 'Hobby-Produzenten' });
  assert.ok(a.ok, JSON.stringify(a));
  assert.strictEqual(a.avatar.archetype, 'erklaerer');
  assert.ok(/KI-Kunstfigur/.test(a.avatar.disclosure), 'Kennzeichnung fehlt');
  assert.ok(a.avatar.banned_words.includes('garantiert'));
  assert.strictEqual(a.avatar.look_spec.state, 'VORGABE (noch kein Bild erzeugt)');
  assert.strictEqual(av.create({ name: 'X' }).ok, false);
});

t('Avatar: Nachbildung echter Personen und Deepfakes werden abgelehnt', () => {
  const r = av.create({ name: 'Fake', niche: 'Geld', lookalike_of: 'sieht aus wie Julian Goldie' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.refused, true);
  assert.match(r.error, /keine eigenen? Personen|Kunstfigur/);
  assert.match(av.create({ name: 'x', niche: 'y', look: 'Deepfake mit Gesicht von ...' }).error, /Gesichter echter Menschen/);
  assert.ok(av.REFUSED.length >= 3);
});

t('Avatar: Textprüfung findet verbotene Wörter und mahnt die Kennzeichnung an', () => {
  const a = av.list({}).items[0];
  const schlecht = av.checkText(a.id, 'Damit wirst du garantiert erfolgreich.');
  assert.strictEqual(schlecht.ok, false);
  assert.ok(schlecht.hits.includes('garantiert'));
  const gut = av.checkText(a.id, 'Kurz gesagt: drei Schritte, die bei mir funktioniert haben.');
  assert.strictEqual(gut.ok, true);
  assert.ok(/Kennzeichnung/.test(gut.reminder));
  assert.strictEqual(av.checkText('gibtsnicht', 'x').ok, false);
});

t('Avatar: Podcast-Folge hat Rollen, Kapitel, Shownotes und Zeiten', () => {
  const a = av.list({}).items[0];
  const e = av.episode({ avatar: a.id, topic: 'Erste Beats am Laptop', minutes: 10, guest: 'Co-Moderator' });
  assert.ok(e.ok, JSON.stringify(e).slice(0, 200));
  assert.strictEqual(e.episode.timeline.length, 8);
  assert.ok(e.episode.total_seconds > 300, 'Folge zu kurz: ' + e.episode.total_seconds);
  assert.strictEqual(e.episode.chapters.length, 8);
  assert.ok(/KI-Kunstfigur/.test(e.episode.show_notes.disclosure));
  assert.ok(e.episode.needs.some((n) => /Kennzeichnung/.test(n)));
  assert.ok(e.episode.show_notes.sources_required);
  assert.ok(['PLAN', 'NOT-CONNECTED', 'TEILWEISE LIVE', 'LIVE', 'NICHT LADBAR'].includes(e.audio.mode), 'Sprachstand unklar: ' + e.audio.mode);
});

t('Avatar: Zeitmarken laufen lückenlos fort', () => {
  const e = av.episode({ topic: 'Test', minutes: 5 });
  const tl = e.episode.timeline;
  for (let i = 1; i < tl.length; i++) assert.strictEqual(tl[i].starts_at, tl[i - 1].starts_at + tl[i - 1].seconds);
  assert.strictEqual(av.episode({}).ok, false);
});

// ------------------------------------------------------------ Bezahlpläne
t('Bezahlpläne: vier Stufen mit klaren Grenzen und Preisen', () => {
  assert.strictEqual(bill.PLANS.length, 4);
  for (const p of bill.PLANS) { assert.strictEqual(typeof p.price_eur, 'number'); assert.ok(Object.keys(p.limits).length >= 5, p.id + ' ohne Grenzen'); }
  const st = bill.status();
  assert.ok(st.rules.some((r) => /Kündigung/.test(r)));
});

t('Bezahlpläne: Rechnung stimmt rechnerisch (Rabatt, Plätze, Steuer)', () => {
  const q = bill.quote({ plan: 'creator', seats: 2, months: 12 });
  assert.ok(q.ok, JSON.stringify(q));
  assert.strictEqual(q.months_free, 2);
  assert.strictEqual(q.per_month_eur, Math.round(19 * 0.84 * 100) / 100);
  assert.strictEqual(q.net_eur, Math.round(q.per_month_eur * 2 * 12 * 100) / 100);
  assert.strictEqual(q.gross_eur, Math.round((q.net_eur + q.vat_19_eur) * 100) / 100);
  const m = bill.quote({ plan: 'studio', seats: 1, months: 1 });
  assert.strictEqual(m.net_eur, 49);
  assert.strictEqual(m.months_free, 0);
  assert.strictEqual(bill.quote({ plan: 'gratis' }).ok, false);
});

t('Bezahlpläne: ohne Zahlungsanbieter wird NICHTS abgebucht — ehrlich benannt', () => {
  const ps = bill.paymentState();
  assert.strictEqual(ps.online_ready.length, 0);
  assert.strictEqual(ps.mode, 'LOKAL GEFÜHRT (kein Zahlungsanbieter verbunden)');
  assert.ok(/wird nichts abgebucht/.test(ps.honesty));
  const inv = bill.invoice({ plan: 'creator', who: 'Sabr47', seats: 1, months: 1 });
  assert.ok(inv.ok, JSON.stringify(inv));
  assert.strictEqual(inv.invoice.payment.charged, false);
  assert.ok(/Beleg im System/.test(inv.invoice.note));
  assert.match(inv.invoice.number, /^\d{4}-\d{5}$/);
  assert.ok(/SPEND/.test(inv.gate));
});

t('Bezahlpläne: Abo anlegen, doppelt nicht möglich, Kündigung sofort', () => {
  const s = bill.subscribe({ plan: 'studio', who: 'Sabr47' });
  assert.ok(s.ok, JSON.stringify(s));
  assert.strictEqual(s.subscription.cancel_at_any_time, true);
  assert.strictEqual(bill.subscribe({ plan: 'studio', who: 'Sabr47' }).ok, false);
  assert.ok(bill.subscribe({ plan: 'label', who: 'Sabr47', change: true }).ok);
  assert.ok(bill.cancel('Sabr47').ok);
  assert.strictEqual(bill.cancel('Sabr47').ok, false);
  assert.strictEqual(bill.subscribe({ plan: 'studio' }).ok, false);
});

t('Bezahlpläne: Grenzen werden geprüft und Überschreitung gemeldet', () => {
  bill.subscribe({ plan: 'free', who: 'Testkunde' });
  const r = bill.checkLimits({ who: 'Testkunde', usage: { songs: 9, artists: 1 } });
  assert.ok(r.ok);
  assert.deepStrictEqual(r.exceeded, ['songs']);
  assert.strictEqual(r.rows.find((x) => x.key === 'songs').left, 0);
  assert.strictEqual(bill.checkLimits({ who: 'Unbekannt' }).ok, false);
});

// ------------------------------------------------------------ Werbung
t('Werbung: Klick- und Reichweitenkauf wird abgelehnt — nicht nur kommentiert', () => {
  const r = ads.checkRequest('Bitte 10000 Klicks kaufen für die Kampagne');
  assert.strictEqual(r.allowed, false);
  assert.match(r.reason, /gesperrt/);
  assert.strictEqual(ads.checkRequest('Bitte Klickautomat starten').allowed, false);
  assert.strictEqual(ads.checkRequest('Pop-up-Netzwerk anbinden').allowed, false);
  assert.strictEqual(ads.checkRequest('Kontextwerbung für Musiksoftware auf eigener Seite').allowed, true);
  const c = ads.campaign({ name: 'Klicks', budget_eur: 100, goal: 'ich will Klicks kaufen' });
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.refused, true);
});

t('Werbung: Fläche verlangt Kennzeichnung, Einwilligung und Slot-Position', () => {
  const s = ads.slot({ page: '/master-web-empire/01_igaming_toplists', position: 'HERO', size: '970x250' });
  assert.ok(s.ok, JSON.stringify(s));
  assert.strictEqual(s.slot.rel, 'sponsored nofollow');
  assert.strictEqual(s.slot.consent_required, true);
  assert.strictEqual(s.slot.state, 'LEER');
  assert.strictEqual(ads.slot({ page: '/x', position: 'OBEN' }).ok, false);
  assert.strictEqual(ads.slot({ position: 'HERO' }).ok, false);
});

t('Werbung: Kampagnenzahlen sind als Prognose gekennzeichnet und nachrechenbar', () => {
  const c = ads.campaign({ name: 'Herbst', budget_eur: 100, cpm_eur: 4, ctr: 0.01, channels: ['meta-ads'] });
  assert.ok(c.ok, JSON.stringify(c).slice(0, 200));
  assert.strictEqual(c.campaign.forecast.impressions, 25000);
  assert.strictEqual(c.campaign.forecast.clicks, 250);
  assert.ok(/PROGNOSE/.test(c.campaign.forecast.label));
  assert.ok(/25000 Einblendungen/.test(c.campaign.forecast.formula));
  assert.ok(c.campaign.needs.some((n) => /Freigabe/.test(n)));
  assert.strictEqual(ads.campaign({ name: 'x', budget_eur: 0 }).ok, false);
});

t('Werbung: erst gemessene Werte machen aus der Prognose Wirklichkeit', () => {
  const id = ads.actions.campaigns().campaigns[0].id;
  const m = ads.measure(id, { impressions: 24000, clicks: 210, spend_eur: 96, source: 'Anzeigenkonto-Export' });
  assert.ok(m.ok, JSON.stringify(m));
  assert.strictEqual(m.campaign.measured.ctr_real, Math.round((210 / 24000) * 10000) / 10000);
  assert.strictEqual(m.campaign.measured.vs_forecast, Math.round(((210 - 250) / 250) * 100) / 100);
  assert.strictEqual(ads.measure(id, {}).ok, false);
  assert.strictEqual(ads.measure('gibtsnicht', { clicks: 1 }).ok, false);
});

t('Werbung: Bestand zeigt freie und belegte Flächen', () => {
  const inv = ads.inventory();
  assert.strictEqual(inv.slots, 1);
  assert.strictEqual(inv.free, 1);
  assert.ok(inv.by_page['/master-web-empire/01_igaming_toplists']);
  const st = ads.status();
  assert.ok(st.refused_rules >= 5);
  assert.ok(st.rules.some((r) => /Klick/.test(r)));
});

console.log(`\navatar_billing_ads: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
