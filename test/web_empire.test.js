'use strict';
// Tests: Web Empire / Eigene Seiten.
// Prüft die verbindlichen Linien der Spezifikation:
//  - nur freigegebene eigene/autorisierten Seiten werden verbunden (REGEL 1, kein Auto-Connect)
//  - Freigabe nur durch einen Menschen
//  - Rotation ausschließlich im vorab freigegebenen Pool, sonst ehrlicher NEUTRAL-Zustand
//  - Health-Check ist kein Klick und keine Conversion
//  - Messwerte nur echt + signiert; Labels LIVE / SIM / NOT-CONNECTED ehrlich
//  - keine Funktion erzeugt Traffic, Klicks, Views oder Likes
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.AURA_WEB_EMPIRE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'we-')), 'web_empire.json');
process.env.AURA_CONTROL_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'we-ctl-')), 'control.json');
const we = require('../backend/src/lib/web_empire');

const SITE = { id: 'casino-vergleich', domain: 'casino-vergleich.de', niche: 'IGAMING', affiliate_status: 'OWN', consent_status: 'OK' };

test('fremde Seite ohne eigenen/autorisierten Status wird nicht verbunden', () => {
  const r = we.registerSite({ id: 'fremd', domain: 'fremde-seite.com', niche: 'FINANCE', affiliate_status: 'NONE' }, 'Jonas');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 403);
  assert.strictEqual(we.status().sites.some((s) => s.id === 'fremd'), false);
});

test('Registrierung erzeugt PENDING + Freigabe, keine sofortige Verbindung', () => {
  const r = we.registerSite(SITE, 'Jonas');
  assert.strictEqual(r.status, 'pending_approval');
  assert.match(r.approval.id, /^AP-[0-9a-f]{6}$/);
  const site = we.status().sites.find((s) => s.id === SITE.id);
  assert.strictEqual(site.status, 'PENDING');
  assert.strictEqual(site.connected, false);
});

test('Freigabe nur durch einen Menschen; danach Schluessel genau einmal', () => {
  const r = we.registerSite({ ...SITE, id: 'tech-portal', domain: 'tech-portal.de', niche: 'AI_TECH', affiliate_status: 'AUTHORIZED' }, 'Jonas');
  assert.strictEqual(we.decide(r.approval.id, 'approve', 'auto-bot').ok, false);
  assert.strictEqual(we.decide(r.approval.id, 'approve', 'agent-1').ok, false);
  const d = we.decide(r.approval.id, 'approve', 'Jonas');
  assert.strictEqual(d.ok, true);
  assert.match(d.api_key, /^[0-9a-f]{48}$/);
  const again = we.decide(r.approval.id, 'approve', 'Jonas');
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.code, 409);
});

test('Domain muss gueltig und eindeutig sein, Nische bekannt', () => {
  assert.strictEqual(we.registerSite({ id: 'test-x1', domain: 'nicht gueltig', niche: 'IGAMING', affiliate_status: 'OWN' }, 'Jonas').code, 400);
  assert.strictEqual(we.registerSite({ id: 'test-x2', domain: 'neu.de', niche: 'UNSINN', affiliate_status: 'OWN' }, 'Jonas').code, 400);
  assert.strictEqual(we.registerSite({ id: 'test-x3', domain: 'casino-vergleich.de', niche: 'IGAMING', affiliate_status: 'OWN' }, 'Jonas').code, 409);
});

test('Pool: nur https, nur nach Freigabe aktiv, keine fremden Ziele', () => {
  we.addSlot({ id: 'CASINO_HERO_DE', category: 'CASINO', region: 'DE' }, 'Jonas');
  assert.strictEqual(we.setPool('CASINO_HERO_DE', [{ id: 'p1', url: 'http://unsicher.example.com' }], 'Jonas').code, 400);
  const p = we.setPool('CASINO_HERO_DE', [
    { id: 'p1', partner: 'Partner A', url: 'https://a.example.com/x', priority: 1 },
    { id: 'p2', partner: 'Partner B', url: 'https://b.example.com/y', priority: 2 },
  ], 'Jonas');
  assert.strictEqual(p.status, 'pending_approval');
  // vor der Freigabe liegt nichts im Pool -> ehrlicher NEUTRAL-Zustand
  const before = we.resolveSlot('CASINO_HERO_DE', 'render');
  assert.strictEqual(before.availability, 'NEUTRAL');
  assert.strictEqual(before.url, null);
  we.decide(p.approval.id, 'approve', 'Jonas');
  const after = we.resolveSlot('CASINO_HERO_DE', 'render');
  assert.strictEqual(after.partner, 'p1');
});

test('Ausfall rotiert nur innerhalb des freigegebenen Pools', () => {
  we.markHealth('CASINO_HERO_DE', 'p1', false, 'Jonas');
  const r = we.resolveSlot('CASINO_HERO_DE', 'render');
  assert.strictEqual(r.partner, 'p2');
  we.markHealth('CASINO_HERO_DE', 'p2', false, 'Jonas');
  const none = we.resolveSlot('CASINO_HERO_DE', 'render');
  assert.strictEqual(none.availability, 'NEUTRAL');
  assert.strictEqual(none.url, null);
  assert.match(none.text, /kein passender Partner/);
});

test('Health-Check ist kein Klick und keine Conversion', () => {
  const st = we.status();
  const slot = st.slots.find((s) => s.id === 'CASINO_HERO_DE');
  assert.ok(slot, 'Slot vorhanden');
  const m = we.metrics('casino-vergleich');
  assert.strictEqual(m.totals.outbound_clicks, 0);
  assert.strictEqual(m.totals.conversions_confirmed, 0);
});

test('Messwerte: ohne gueltigen Schluessel keine Daten, falsche Signatur wird abgewiesen', () => {
  const d = we.registerSite({ ...SITE, id: 'finanz-tipps', domain: 'finanz-tipps.de', niche: 'FINANCE', affiliate_status: 'OWN' }, 'Jonas');
  we.decide(d.approval.id, 'approve', 'Jonas');
  assert.strictEqual(we.ingest('finanz-tipps', 'falscher-schluessel', { events: [{ type: 'pageview' }] }).code, 401);
  assert.strictEqual(we.metrics('finanz-tipps').label, 'NOT-CONNECTED');
});

test('Label LIVE nur bei frischen echten Daten; SIM getrennt; keine erfundenen Zahlen', () => {
  const r = we.registerSite({ ...SITE, id: 'sm-vergleich', domain: 'sm-vergleich.de', niche: 'SMM_GROWTH', affiliate_status: 'OWN' }, 'Jonas');
  const d = we.decide(r.approval.id, 'approve', 'Jonas');
  const key = d.api_key;
  assert.strictEqual(we.metrics('sm-vergleich').label, 'NOT-CONNECTED');
  const ing = we.ingest('sm-vergleich', key, { events: [
    { type: 'pageview', path: '/', value: 3 },
    { type: 'session' },
    { type: 'outbound_click', partner: 'p1' },
    { type: 'conversion_confirmed' },                        // ohne autorisierte Quelle: wird nicht gezaehlt
    { type: 'conversion_confirmed', authorized_source: 'partner-postback' },
    { type: 'unbekannt' },                                   // unbekannter Typ: verworfen
  ] });
  assert.strictEqual(ing.accepted, 4);
  assert.strictEqual(ing.rejected.length, 2);
  const m = we.metrics('sm-vergleich');
  assert.strictEqual(m.label, 'LIVE');
  assert.strictEqual(m.totals.pageviews, 3);
  assert.strictEqual(m.totals.sessions, 1);
  assert.strictEqual(m.totals.outbound_clicks, 1);
  assert.strictEqual(m.totals.conversions_confirmed, 1);
  assert.match(m.note, /nie erfunden/);
  // SIM nur, wenn ausdruecklich als Simulation markiert
  const r2 = we.registerSite({ ...SITE, id: 'sim-seite', domain: 'sim-seite.de', niche: 'OTHER', affiliate_status: 'OWN' }, 'Jonas');
  const d2 = we.decide(r2.approval.id, 'approve', 'Jonas');
  we.ingest('sim-seite', d2.api_key, { events: [{ type: 'pageview', sim: true }] });
  assert.strictEqual(we.metrics('sim-seite').label, 'SIM');
});

test('nicht freigegebene Seite nimmt keine Daten an', () => {
  const r = we.registerSite({ ...SITE, id: 'wartet', domain: 'wartet.de', niche: 'OTHER', affiliate_status: 'OWN' }, 'Jonas');
  assert.strictEqual(r.status, 'pending_approval');
  const out = we.ingest('wartet', 'irgendein-schluessel', { events: [{ type: 'pageview' }] });
  assert.strictEqual(out.code, 403);
  assert.match(out.error, /nicht freigegeben/);
});

test('Module-Flags und genau eine der fuenf Stilvarianten, nur durch Menschen', () => {
  const st = we.updateSite('casino-vergleich', { modules: { FORUM: true, ADSENSE: true } }, 'auto-bot');
  assert.strictEqual(st.code, 403);
  const ok = we.updateSite('casino-vergleich', { modules: { FORUM: true, ADSENSE: true }, active_style: 'stil-4' }, 'Jonas');
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(ok.site.modules_on, undefined);
  const site = we.status().sites.find((s) => s.id === 'casino-vergleich');
  assert.deepStrictEqual(site.modules_on.sort(), ['ADSENSE', 'FORUM']);
  assert.strictEqual(site.active_style, 'stil-4');
  assert.strictEqual(we.updateSite('casino-vergleich', { active_style: 'stil-9' }, 'Jonas').code, 400);
  assert.strictEqual(we.updateSite('casino-vergleich', { modules: { UNSINN: true } }, 'Jonas').code, 400);
});

test('Blanko-Header/Footer zentral pflegbar, ohne Inhalte zu zerstoeren', () => {
  const r = we.updateSite('casino-vergleich', {
    header: { logo_text: 'Casino Vergleich', claim: 'Toplisten 2026', nav: ['Start', 'Casinos', 'Ratgeber'], cta: 'Zum Test' },
    footer: { legal: 'Impressum', consent_link: '/datenschutz', newsletter: true },
  }, 'Jonas');
  assert.strictEqual(r.ok, true);
  const raw = JSON.parse(fs.readFileSync(process.env.AURA_WEB_EMPIRE_FILE, 'utf8'));
  const site = raw.sites.find((s) => s.id === 'casino-vergleich');
  assert.strictEqual(site.header.logo_text, 'Casino Vergleich');
  assert.strictEqual(site.header.nav.length, 3);
  assert.strictEqual(site.footer.newsletter, true);
  // zweite Aenderung laesst nicht genannte Felder unberuehrt
  we.updateSite('casino-vergleich', { header: { claim: 'Neu' } }, 'Jonas');
  const raw2 = JSON.parse(fs.readFileSync(process.env.AURA_WEB_EMPIRE_FILE, 'utf8'));
  const site2 = raw2.sites.find((s) => s.id === 'casino-vergleich');
  assert.strictEqual(site2.header.claim, 'Neu');
  assert.strictEqual(site2.header.logo_text, 'Casino Vergleich');
  assert.strictEqual(site2.footer.legal, 'Impressum');
});

test('Sperren einer Seite trennt die Verbindung', () => {
  const r = we.updateSite('casino-vergleich', { suspend: true }, 'Jonas');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.site.status, 'SUSPENDED');
  const site = we.status().sites.find((s) => s.id === 'casino-vergleich');
  assert.strictEqual(site.connected, false);
});

test('Audit-Log haelt fest, wer was geaendert hat', () => {
  const st = we.status();
  assert.ok(st.audit_tail.length >= 5);
  assert.ok(st.audit_tail.every((a) => a.at && a.action && a.by));
  assert.ok(st.audit_tail.some((a) => a.action === 'site.approve'));
});

test('KEINE Funktion erzeugt Traffic, Klicks, Views oder Likes', () => {
  const names = Object.keys(we).map((k) => k.toLowerCase());
  const verboten = ['traffic', 'click', 'view', 'like', 'boost', 'generate', 'bot', 'visit', 'impression', 'submit_lead'];
  const treffer = names.filter((n) => verboten.some((v) => n.includes(v)));
  assert.deepStrictEqual(treffer, []);
  // und auch die exportierten Ereignistypen kennen keine Erzeugung, nur Zaehlung eingehender Meldungen
  assert.deepStrictEqual(we.EVENT_TYPES, ['pageview', 'session', 'referrer', 'utm', 'outbound_click', 'error', 'conversion_confirmed']);
});

test('selbstheilende Datei: fehlende Speicherdatei wird neu angelegt', () => {
  fs.unlinkSync(process.env.AURA_WEB_EMPIRE_FILE);
  const st = we.status();
  assert.strictEqual(st.area, 'WEB-EMPIRE');
  assert.deepStrictEqual(st.sites, []);
  assert.ok(fs.existsSync(process.env.AURA_WEB_EMPIRE_FILE));
});
