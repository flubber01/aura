'use strict';
// Prüft die fünfte Ausbaustufe (Runde 5): Sprachen, Aussehen, Marke, Werbung im OS, Empfehlungen,
// Förderung, Protokoll/Auswertung, Text und Reim, Musik-Abteilungen, Song-Orchester, Rundbrief,
// Recht, Weißbuch, Ideenkatalog und das Startintro.
//
// Alle Dateien liegen in einem Temp-Ordner; die Prüfung berührt keine echten Daten.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r5-'));
process.env.AURA_I18N_FILE = path.join(tmp, 'i18n.json');
process.env.AURA_THEMES_FILE = path.join(tmp, 'themes.json');
process.env.AURA_BRANDING_FILE = path.join(tmp, 'branding.json');
process.env.AURA_AD_SCHEDULE_FILE = path.join(tmp, 'ads.json');
process.env.AURA_SPONSOR_FILE = path.join(tmp, 'sponsor.json');
process.env.AURA_REFERRAL_FILE = path.join(tmp, 'referral.json');
process.env.AURA_LOGS_FILE = path.join(tmp, 'logs.json');
process.env.AURA_LYRICS_FILE = path.join(tmp, 'lyrics.json');
process.env.AURA_MUSIC_DEPTS_FILE = path.join(tmp, 'depts.json');
process.env.AURA_ORCHESTRATOR_FILE = path.join(tmp, 'orchestrator.json');
process.env.AURA_NEWSLETTER_FILE = path.join(tmp, 'newsletter.json');
process.env.AURA_LEGAL_FILE = path.join(tmp, 'legal.json');
process.env.AURA_WHITEPAPER_FILE = path.join(tmp, 'whitepaper.json');
process.env.AURA_IDEAS_FILE = path.join(tmp, 'ideas.json');
process.env.AURA_FLASH_FILE = path.join(tmp, 'flash.json');
process.env.AURA_CONTENT_FILE = path.join(tmp, 'content.json');
process.env.AURA_CONTENT_DIR = path.join(tmp, 'content');
process.env.AURA_AUDIO_DIR = path.join(tmp, 'audio');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  OK   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); }
}

const i18n = require('../backend/src/lib/i18n');
const themes = require('../backend/src/lib/themes');
const branding = require('../backend/src/lib/branding');
const adEngine = require('../backend/src/lib/ad_engine');
const referral = require('../backend/src/lib/referral');
const sponsor = require('../backend/src/lib/sponsor');
const logs = require('../backend/src/lib/logs_analytics');
const lyricWriter = require('../backend/src/lib/lyric_writer');
const musicDepartments = require('../backend/src/lib/music_departments');
const orchestrator = require('../backend/src/lib/song_orchestrator');
const newsletter = require('../backend/src/lib/newsletter');
const legal = require('../backend/src/lib/legal');
const whitepaper = require('../backend/src/lib/whitepaper');
const ideaCatalog = require('../backend/src/lib/idea_catalog');
const flashIntro = require('../backend/src/lib/flash_intro');

// ---------------------------------------------------------------- Sprachen
check('i18n: 8 Sprachen, Arabisch von rechts nach links', () => {
  const st = i18n.status();
  assert.strictEqual(st.languages, 8);
  assert.ok(st.with_right_to_left.includes('ar'));
  assert.ok(st.keys >= 40, 'zu wenige Sätze');
  assert.strictEqual(i18n.catalog('ar').rtl, true);
});
check('i18n: fehlender Satz fällt auf Deutsch zurück, nie auf den Schlüssel', () => {
  const de = i18n.t('nav.support', 'de');
  const tr = i18n.t('nav.support', 'tr');
  assert.strictEqual(de.ok, true);
  assert.strictEqual(tr.fallback, false, 'Türkisch muss eigene Fassung haben');
  const missing = i18n.t('gibt.es.nicht', 'de');
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.text, null);
});
check('i18n: Überschreiben eines Satzes gilt sofort', () => {
  const set = i18n.setText('nav.support', 'tr', 'Destek Hattı', { by: 'Test' });
  assert.strictEqual(set.ok, true);
  assert.strictEqual(i18n.t('nav.support', 'tr').text, 'Destek Hattı');
  assert.ok(i18n.coverage().coverage.length === 8);
});

// ---------------------------------------------------------------- Aussehen
check('themes: 7 Aussehen × 8 Hintergründe = 56, alles gezeichnet', () => {
  const st = themes.status();
  assert.strictEqual(st.themes, 7);
  assert.strictEqual(st.backgrounds, 8);
  assert.strictEqual(st.combinations, 56);
  const css = themes.css('neon', 'stage');
  assert.ok(css.includes('--bg'), 'CSS-Variablen fehlen');
  assert.ok(!/url\(http/i.test(css), 'kein Fremdbild erlaubt');
});
check('themes: unbekanntes Aussehen wird abgelehnt, Nutzerwahl wird gespeichert', () => {
  assert.strictEqual(themes.set({ user: 'x', theme: 'gibtsnicht' }).ok, false);
  const ok = themes.set({ user: 'Sabr47', theme: 'creedlight', background: 'paper' });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.chosen.theme, 'creedlight');
  assert.strictEqual(themes.forUser('Sabr47').theme, 'creedlight');
  assert.strictEqual(themes.forUser('niemand').theme, 'creed');
});

// ---------------------------------------------------------------- Marke
check('branding: Zeichen als SVG, Copyright 2026', () => {
  const svg = branding.logoSvg({ size: 96 });
  assert.ok(svg.startsWith('<svg'), 'kein SVG');
  assert.ok(svg.includes('</svg>'));
  assert.strictEqual(branding.BRAND.year, 2026);
  assert.ok(branding.BRAND.line.includes('Creed Street Studios 2026'));
});
check('branding: Kennzeichnung für Bild, Ton, Video wird geplant und angekündigt', () => {
  const bild = branding.watermark({ kind: 'BILD' });
  assert.ok(bild.filter.includes('drawtext'));
  assert.ok(bild.warning, 'ehrlicher Hinweis auf fehlendes drawtext fehlt');
  const ton = branding.watermark({ kind: 'TON' });
  assert.strictEqual(ton.plan.metadata.artist, 'Creed Street Studios');
  const seite = branding.watermark({ kind: 'SEITE' });
  assert.ok(seite.ok);
  assert.ok(branding.actions.marks().count >= 3);
});
check('branding: Fußzeile trägt Copyright und Förderer-Leiste', () => {
  const f = branding.footer({});
  assert.ok(f.html.includes('Creed Street Studios 2026'));
  assert.ok(f.html.includes('Förderer'));
  assert.ok(f.html.includes('cs-footer'));
});

// ---------------------------------------------------------------- Werbung im OS
check('ad_engine: Kurzmeldung alle 6 Minuten und nicht wegklickbar, Anzeige alle 11 Minuten', () => {
  const r = adEngine.RHYTHMS;
  const flash = r.find((x) => x.id === 'flash');
  const banner = r.find((x) => x.id === 'banner');
  assert.strictEqual(flash.every_minutes, 6);
  assert.strictEqual(flash.dismissible, false);
  assert.strictEqual(banner.every_minutes, 11);
  assert.strictEqual(banner.dismissible, true);
});
check('ad_engine: Plan für 60 Minuten ergibt 10 Kurzmeldungen und 5 Anzeigen', () => {
  const s = adEngine.schedule({ minutes: 60 });
  const flashes = s.plan.filter((x) => x.rhythm === 'flash');
  const banners = s.plan.filter((x) => x.rhythm === 'banner');
  assert.strictEqual(flashes.length, 10);
  assert.strictEqual(banners.length, 5);
  assert.strictEqual(banners[0].at_minute, 11);
  assert.strictEqual(s.honest.clicks_created, 0);
});
check('ad_engine: Meldung einsetzen, zählen nur echte Ereignisse, abschaltbar', () => {
  assert.strictEqual(adEngine.slot({ rhythm: 'flash', headline: 'ab' }).ok, false, 'zu kurze Überschrift muss scheitern');
  const slot = adEngine.slot({ rhythm: 'flash', headline: 'Neuer Song ist draußen', body: 'Creed Street', target: '/musik' });
  assert.strictEqual(slot.ok, true);
  assert.strictEqual(slot.slot.every_minutes, 6);
  assert.strictEqual(slot.slot.dismissible, false);
  assert.strictEqual(adEngine.record({ what: 'view' }).ok, false, 'ohne Kennung darf nicht gezählt werden');
  const rec = adEngine.record({ what: 'view', slot_id: slot.slot.id, rhythm: 'flash' });
  assert.strictEqual(rec.counts.views, 1);
  const off = adEngine.setEnabled(false, { by: 'Test' });
  assert.strictEqual(off.enabled, false);
  assert.strictEqual(adEngine.schedule({ minutes: 60 }).enabled, false);
  adEngine.setEnabled(true, { by: 'Test' });
});
check('ad_engine: Bedienteil ist eigenes Skript ohne Fremdabruf', () => {
  const js = adEngine.client();
  assert.ok(js.includes('KURZMELDUNG'));
  assert.ok(js.includes('ALLE 6 MINUTEN'));
  assert.ok(js.includes('ALLE 11 MINUTEN'));
  assert.ok(!/https?:\/\//.test(js), 'kein Fremdaufruf im Skript');
});

// ---------------------------------------------------------------- Empfehlungen
check('referral: Code anlegen, Selbstwerbung und Doppelbuchung werden abgelehnt', () => {
  const c = referral.code({ user: 'Sabr47' });
  assert.strictEqual(c.ok, true);
  assert.ok(c.code.link.startsWith('/start?ref='));
  const self = referral.event({ code: c.code.code, who: 'Sabr47', type: 'signup' });
  assert.strictEqual(self.refused, true);
  const first = referral.event({ code: c.code.code, who: 'freund-1', type: 'signup' });
  assert.strictEqual(first.rewards.length, 2, 'Werber und Freund bekommen je eine Prämie');
  const twin = referral.event({ code: c.code.code, who: 'freund-1', type: 'signup' });
  assert.strictEqual(twin.duplicate, true);
});
check('referral: Meilenstein bei 5 Anmeldungen, Auszahlung nur mit Mensch', () => {
  const c = referral.actions.codes().codes[0];
  for (let i = 2; i <= 5; i++) referral.event({ code: c.code, who: 'freund-' + i, type: 'signup' });
  const top = referral.ranking().top[0];
  assert.strictEqual(top.signups, 5);
  assert.ok(top.rewards >= 11, 'Meilenstein-Prämie fehlt');
  const noHuman = referral.claim({ code: c.code });
  assert.strictEqual(noHuman.ok, false);
  assert.strictEqual(noHuman.needs, 'human');
  const done = referral.claim({ code: c.code, human: true, by: 'Test' });
  assert.strictEqual(done.ok, true);
  assert.strictEqual(referral.actions.codes().codes[0].rewards.filter((r) => !r.claimed).length, 0);
});
check('referral: Provision nur aus belegter Zahlung, nicht geschätzt', () => {
  const c = referral.actions.codes().codes[0];
  assert.strictEqual(referral.event({ code: c.code, who: 'freund-1', type: 'paid_month' }).ok, false, 'ohne Betrag keine Provision');
  const paid = referral.event({ code: c.code, who: 'freund-1', type: 'paid_month', amount: 29.99 });
  const prov = paid.rewards.find((r) => r.kind === 'PROVISION');
  assert.strictEqual(prov.value_eur, 4.5);
  assert.ok(referral.status().rewards >= 13);
});

// ---------------------------------------------------------------- Förderung
check('sponsor: 5 Stufen, Zusage und Beleg sind getrennt', () => {
  assert.strictEqual(sponsor.tiers().count, 5);
  assert.strictEqual(sponsor.tiers().tiers.length, 5);
  assert.strictEqual(sponsor.add({ name: 'X', tier: 'gesund' }).ok, false);
  const s = sponsor.add({ name: 'Beispiel GmbH', tier: 'partner', link: 'https://beispiel.de' });
  assert.strictEqual(s.sponsor.state, 'ZUGESAGT');
  assert.strictEqual(sponsor.setState({ id: s.sponsor.id, state: 'BEZAHLT' }).ok, false);
  assert.ok(sponsor.setState({ id: s.sponsor.id, state: 'BEZAHLT' }).error.includes('Beleg'));
  const paid = sponsor.setState({ id: s.sponsor.id, state: 'BEZAHLT', proof: 'Rechnung 2026-014' });
  assert.strictEqual(paid.ok, true);
  const st = sponsor.status();
  assert.strictEqual(st.monthly_eur, 100);
  assert.ok(st.monthly_state.includes('belegten'));
});
check('sponsor: Leiste läuft am Boden, Seite ist vollständig', () => {
  const t = sponsor.footerTicker({});
  assert.ok(t.ok);
  assert.ok(t.html.includes('Beispiel GmbH'));
  assert.strictEqual(t.count, 1);
  assert.ok(t.css_hint.includes('26 s'));
  const p = sponsor.page({});
  assert.ok(p.html.includes('Fördern'));
  assert.ok(p.html.includes('Creed Street Studios 2026'));
});

// ---------------------------------------------------------------- Protokoll und Auswertung
check('logs: 9 Protokollquellen, Klassen werden gezählt', () => {
  const src = logs.actions.sources();
  assert.strictEqual(src.sources.length, 9);
  const s = logs.search({ limit: 5 });
  assert.strictEqual(s.ok, true);
  assert.ok(Array.isArray(s.rows));
  assert.strictEqual(logs.classes().ok, true);
});
check('logs: Klick-Bewertung erst ab 30 Aufrufen, sonst „zu wenig Daten"', () => {
  assert.strictEqual(logs.recordClick({ page: '/p', views: 10, clicks: 400 }).ok, false);
  logs.recordClick({ page: '/p', date: '2026-10-16', views: 10, clicks: 2 });
  const thin = logs.clickReport({ days: 30 });
  assert.strictEqual(thin.rows[0].grade, null);
  assert.ok(thin.rows[0].why.includes('zu wenig Daten'));
  logs.recordClick({ page: '/seite', date: '2026-10-16', views: 240, clicks: 31, dwell_s: 84, bounces: 90 });
  const full = logs.clickReport({ days: 30 });
  const row = full.rows.find((x) => x.page === '/seite');
  assert.ok(['A', 'B', 'C'].includes(row.grade), 'Bewertung erwartet');
  assert.ok(full.distribution);
});
check('logs: Einnahmen nur mit Beleg, Ampel und Trend ehrlich', () => {
  const noProof = logs.recordRevenue({ month: '2026-09', kind: 'WERBUNG', amount: 50 });
  assert.strictEqual(noProof.row.state, 'OHNE BELEG');
  logs.recordRevenue({ month: '2026-10', kind: 'ABO', amount: 129, costs: 22, proof: 'B-1' });
  const r = logs.revenueReport({ months: 12 });
  assert.strictEqual(r.ampel, 'GRÜN');
  assert.ok(r.trend.hint.includes('mindestens 3 Monate'));
  const ret = logs.retention({ days: 90 });
  assert.ok(ret.rule.includes('löschen nein'));
  assert.ok(logs.summary().line.includes('Protokoll'));
});

// ---------------------------------------------------------------- Text und Reim
check('lyric_writer: Aufbau, Reim und Silben aus eigener Quelle', () => {
  const st = lyricWriter.status();
  assert.strictEqual(st.structures, 4);
  assert.ok(st.moods >= 6);
  const w = lyricWriter.write({ subject: 'Aufbruch aus der Creed Street', structure: 'popsong', mood: 'aufbruch', lang: 'de' });
  assert.strictEqual(w.ok, true);
  assert.ok(w.draft.line_count > 8);
  assert.ok(w.draft.hook.length > 4);
  assert.strictEqual(lyricWriter.actions.draft({ id: w.draft.id }).draft.structure, w.draft.structure);
});
check('lyric_writer: Reimverzeichnis wächst zur Laufzeit, Thema ist Pflicht', () => {
  const r = lyricWriter.rhymes({ word: 'Nacht', lang: 'de' });
  assert.strictEqual(r.ending, 'acht');
  assert.ok(r.rhymes.includes('Pracht'));
  assert.strictEqual(r.syllables, 1);
  const add = lyricWriter.actions.rhyme_add({ ending: 'acht', words: ['Tracht'] });
  assert.strictEqual(add.ok, true);
  assert.ok(lyricWriter.rhymes({ word: 'Nacht', lang: 'de' }).rhymes.includes('Tracht'));
  assert.strictEqual(lyricWriter.write({ structure: 'popsong' }).ok, false);
});

// ---------------------------------------------------------------- Musik-Abteilungen
check('music_departments: 20 Abteilungen mit Mensch-Toren', () => {
  const st = musicDepartments.status();
  assert.strictEqual(st.departments, 20);
  assert.ok(st.human_gates >= 10);
  assert.strictEqual(musicDepartments.ticket({ department: 'gibtsnicht', task: 'x' }).ok, false);
  const board = musicDepartments.board();
  assert.strictEqual(board.departments, 20);
  assert.ok(board.rows.every((r) => r.tasks > 0));
});
check('music_departments: Vorgang läuft bis zum Mensch-Tor und wartet dort', () => {
  const t = musicDepartments.ticket({ department: 'mastering', task: 'Master v1' });
  assert.strictEqual(t.ticket.state, 'OFFEN');
  const a1 = musicDepartments.advance({ id: t.ticket.id });
  const a2 = musicDepartments.advance({ id: t.ticket.id });
  const a3 = musicDepartments.advance({ id: t.ticket.id });
  assert.strictEqual(a3.ticket.state, 'WARTET AUF MENSCH');
  assert.ok(a1.step && a2.step && a3.step);
  const gate = musicDepartments.advance({ id: t.ticket.id });
  assert.strictEqual(gate.ok, false, 'ohne Mensch darf das Tor nicht aufgehen');
  assert.strictEqual(gate.needs, 'human');
  const open = musicDepartments.advance({ id: t.ticket.id, human: true, by: 'Test' });
  assert.strictEqual(open.ok, true);
  assert.strictEqual(open.ticket.state, 'ERLEDIGT');
});

// ---------------------------------------------------------------- Song-Orchester
check('song_orchestrator: Stile, Plan mit Aufbau, Ketten und Textgerüst', () => {
  const st = orchestrator.status();
  assert.ok(st.styles_readable >= 10);
  assert.strictEqual(st.steps.length, 7);
  const pl = orchestrator.plan({ prompt: 'dunkler Trap mit Schlager-Piano, 140 bpm', minutes: 3, variants: 2, lyrics: true });
  assert.strictEqual(pl.ok, true);
  assert.strictEqual(pl.plan.reading.style, 'trap');
  assert.strictEqual(pl.plan.reading.bpm, 140);
  assert.ok(pl.plan.totals.sections >= 4);
  assert.ok(pl.plan.totals.seconds >= 60, 'Länge zu kurz: ' + pl.plan.totals.seconds);
  assert.ok(Object.keys(pl.plan.chains).length >= 3);
  assert.ok(pl.plan.lyrics.hook.length > 4);
  assert.strictEqual(pl.plan.gates.length, 3);
  assert.strictEqual(orchestrator.actions.plan_get({ id: pl.plan.id }).plan.id, pl.plan.id);
});
check('song_orchestrator: Rendern erzeugt echte Dateien, Prüflauf und Ablage', () => {
  const pl = orchestrator.actions.plans().plans[0];
  const r = orchestrator.render({ id: pl.id, variants: 2, stems: true, department: 'produktion' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.render.variants.length, 2);
  for (const v of r.render.variants) {
    assert.ok(fs.existsSync(v.file), 'Datei fehlt: ' + v.file);
    assert.ok(v.bytes > 100000, 'Datei zu klein');
  }
  assert.ok(r.render.variants[0].stems.length >= 3, 'Stems fehlen');
  assert.ok(['BESTANDEN', 'PRÜFEN'].includes(r.render.qc.verdict));
  assert.strictEqual(r.render.qc.variants, 2);
  assert.ok(r.stored.where, 'Ablage fehlt');
  assert.ok(r.ticket && r.ticket.id, 'Vorgang in den Abteilungen fehlt');
  assert.strictEqual(orchestrator.actions.renders().count, 1);
});

// ---------------------------------------------------------------- Rundbrief
check('newsletter: doppelte Bestätigung, Versand nur an Bestätigte', () => {
  assert.strictEqual(newsletter.actions.provider().provider.ready, false);
  assert.strictEqual(newsletter.subscribe({ mail: 'keine-mail' }).ok, false);
  const s = newsletter.subscribe({ mail: 'freund@beispiel.de', topics: ['MUSIK'], source: 'webseite' });
  assert.strictEqual(s.subscriber.state, 'WARTET_AUF_BESTAETIGUNG');
  assert.ok(s.confirm_link.includes('/api/newsletter/confirm?token='));
  assert.ok(s.honesty.includes('ohne Klick'));
  const token = s.confirm_link.split('token=')[1];
  assert.strictEqual(newsletter.confirm({ token: 'falsch' }).ok, false);
  assert.strictEqual(newsletter.confirm({ token }).state, 'BESTAETIGT');
  const c = newsletter.campaign({ subject: 'Neuer Song', body: 'Creed Street im Oktober', topic: 'MUSIK' });
  assert.strictEqual(c.campaign.state, 'ENTWURF');
  const send = newsletter.send({ id: c.campaign.id });
  assert.strictEqual(send.plan.state, 'WARTET AUF VERSANDWEG');
  assert.strictEqual(send.plan.recipients, 1);
  assert.strictEqual(send.plan.recipients_by_topic, 'MUSIK');
  const un = newsletter.unsubscribe({ mail: 'freund@beispiel.de' });
  assert.strictEqual(un.state, 'ABGEMELDET');
  assert.ok(newsletter.status().left === 1);
  assert.strictEqual(newsletter.actions.list({ state: 'BESTAETIGT' }).count, 0);
});

// ---------------------------------------------------------------- Recht
check('legal: 5 Dokumente, Fassung, Prüfsumme je Fassung', () => {
  const st = legal.status();
  assert.strictEqual(st.documents, 5);
  assert.strictEqual(st.version, '2026.1');
  assert.ok(st.open_placeholders > 0, 'Platzhalter müssen ehrlich gezählt werden');
  const d = legal.digest('agb');
  assert.ok(d.sha256.length >= 16);
  assert.ok(d.fill_fields > 0);
  assert.strictEqual(legal.actions.digest({ id: 'gibtsnicht' }).ok, false);
});
check('legal: Zustimmung ist an die Fassung gebunden, Support-Knopf vorhanden', () => {
  const md = legal.markdown('agb', {}).markdown;
  assert.ok(md.includes('Support'));
  const acc = legal.accept({ who: 'Sabr47', docs: ['agb', 'datenschutz'] });
  assert.strictEqual(acc.ok, true);
  assert.strictEqual(acc.acceptance.docs[0].version, '2026.1');
  assert.ok(acc.acceptance.docs[0].sha256.length >= 16);
  assert.strictEqual(legal.accepted('Sabr47').count, 1);
  const btn = legal.supportButton({ lang: 'de' });
  assert.ok(btn.html.includes('Kontaktieren Sie unseren Support'));
  assert.ok(legal.list().docs.some((x) => x.id === 'lizenzen'));
});

// ---------------------------------------------------------------- Weißbuch
check('whitepaper: Weißbuch, Prüfbericht und Fahrplan aus lebenden Zahlen', () => {
  const w = whitepaper.markdown({ by: 'Test' });
  assert.ok(w.markdown.includes('Weißbuch'));
  assert.ok(w.markdown.includes('Prüfbericht'));
  assert.ok(w.markdown.includes('Fahrplan'));
  assert.ok(w.markdown.includes('Creed Street Studios 2026'));
  assert.ok(w.audit.modules.total > 100, 'Modulzahl zu klein');
  assert.ok(w.audit.routes > 600, 'Routenzahl zu klein');
  assert.strictEqual(w.audit.test_files >= 28, true, 'Testdateien werden gezählt');
  assert.ok(w.audit.open_points >= 6);
  assert.ok(whitepaper.roadmap().items.every((x) => x.why && x.why.length > 10));
  assert.strictEqual(whitepaper.actions.versions().count, 1);
  assert.ok(whitepaper.page({}).html.includes('<!doctype html>'));
  assert.ok(whitepaper.status().sections.length === 3);
});

// ---------------------------------------------------------------- Ideenkatalog
check('idea_catalog: 5 Nischen zu je 50 Einträgen mit Übernahme-Vermerk', () => {
  const st = ideaCatalog.status();
  assert.strictEqual(st.niches.length, 5);
  assert.ok(st.niches.every((n) => n.entries === 50), 'je Nische müssen es 50 sein');
  assert.strictEqual(st.entries, 250);
  assert.ok(st.adopted >= 200, 'zu wenige Übernahmen');
  assert.strictEqual(ideaCatalog.list({ niche: 'geld' }).entries, 50);
  assert.strictEqual(ideaCatalog.list({ niche: 'gibtsnicht' }).ok, false);
});
check('idea_catalog: jeder Eintrag sagt, was daraus wurde — oder dass es bewusst nicht übernommen wurde', () => {
  const items = ideaCatalog.list({ full: true }).items;
  assert.ok(items.every((x) => x.take && x.take.length > 3), 'Eintrag ohne Vermerk');
  assert.ok(ideaCatalog.adopted().rows.every((r) => r.became));
  assert.ok(ideaCatalog.actions.item({ name: 'Stripe' }).ok);
  assert.ok(ideaCatalog.actions.item({ name: 'gibtsnicht' }).ok === false);
});

// ---------------------------------------------------------------- Startintro
check('flash_intro: 10 Sekunden, Zeichen und Copyright, überspringbar nach 3 Sekunden', () => {
  const b = flashIntro.build({ seconds: 10 });
  assert.strictEqual(b.flash.seconds, 10);
  assert.strictEqual(b.flash.skippable, true);
  assert.ok(b.html.includes('© Creed Street Studios 2026'));
  assert.ok(b.html.includes('<svg'), 'Zeichen fehlt im Intro');
  assert.ok(b.html.includes('CREED STREET'));
  assert.ok(b.js.includes('can-skip'));
  assert.ok(b.css.includes('prefers-reduced-motion'), 'ruhige Fassung fehlt');
  assert.ok(b.js.length > 200);
});
check('flash_intro: ohne Überspringen läuft die volle Zeit, Palette wählbar', () => {
  const b = flashIntro.build({ seconds: 12, skippable: false, palette: 'gold' });
  assert.strictEqual(b.flash.skippable, false);
  assert.strictEqual(b.flash.skippable_after_s, null);
  assert.ok(!b.html.includes('class="skip"'));
  assert.ok(flashIntro.actions.palettes().palettes.includes('gold'));
  assert.ok(flashIntro.page({}).html.includes('aura-flash'));
  assert.ok(flashIntro.actions.played().count >= 2);
});

console.log(`\nround5_suite: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
