'use strict';
// Prüft Kampagnen-Planer, Kalender und Handbücher gegen echte Läufe (eigene Temp-Dateien).
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-cmp-'));
process.env.AURA_CAMPAIGNS_FILE = path.join(tmp, 'campaigns.json');
process.env.AURA_CALENDAR_FILE = path.join(tmp, 'calendar.json');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const cp = require('../backend/src/lib/campaign_planner');
const cal = require('../backend/src/lib/calendar');
const hb = require('../backend/src/lib/handbooks');

const RELEASE = '2026-12-05';

t('Kampagne: Plan rechnet vom Releasetag rückwärts', () => {
  const out = cp.create({ title: 'Creedstreet Anthem', artist: 'Sabr47', release_date: RELEASE, genre: 'rap', pitch: 'Harter Trap über die Creedstreet', distro: ['spotify', 'apple-music'] });
  assert.ok(out.ok, JSON.stringify(out));
  const rel = out.campaign.tasks.find((x) => x.stage === 'release');
  const pitch = out.campaign.tasks.find((x) => x.stage === 'pitch');
  assert.strictEqual(rel.due, RELEASE);
  assert.ok(pitch.due < rel.due, 'Pitch muss vor dem Release liegen');
  assert.strictEqual(out.campaign.tasks.length, cp.STAGES.length);
});

t('Kampagne: Reihenfolge der Stufen ist wirklich rückwärts sortiert', () => {
  const rows = cp.releaseBoard().rows;
  const plan = cp.plan(rows[0].id);
  const dates = plan.timeline.map((x) => x.due);
  for (let i = 1; i < dates.length; i++) assert.ok(dates[i] >= dates[i - 1], `Stufe ${plan.timeline[i].stage} liegt vor der vorigen`);
});

t('Kampagne: Stufe mit menschlicher Freigabe geht ohne Mensch NICHT auf done', () => {
  const id = cp.releaseBoard().rows[0].id;
  const no = cp.advance(id, 'signoff', { by: 'AURA' });
  assert.strictEqual(no.ok, false);
  assert.strictEqual(no.needs, 'human');
  const yes = cp.advance(id, 'signoff', { human_approved: true, approved_by: 'Auraos', proof: 'Entscheidung dokumentiert' });
  assert.ok(yes.ok, JSON.stringify(yes));
  assert.strictEqual(yes.stage.state, 'done');
  assert.strictEqual(yes.stage.approved_by, 'Auraos');
});

t('Kampagne: Schritt ohne Menschenpflicht läuft normal weiter', () => {
  const id = cp.releaseBoard().rows[0].id;
  const out = cp.advance(id, 'production', { proof: 'song-1234abcd' });
  assert.ok(out.ok, JSON.stringify(out));
  assert.strictEqual(out.campaign_state, 'IN_PROGRESS');
});

t('Kampagne: Kanäle kommen aus dem Connectoren-Katalog, Lücken werden benannt', () => {
  const out = cp.create({ title: 'Ohne Kanäle', release_date: '2027-01-15', social: ['telegram'], promo: [] });
  const gaps = out.campaign.pipelines.gaps.map((g) => g.group);
  assert.ok(gaps.includes('promo'), 'fehlende Promo-Kanäle müssen als Lücke erscheinen');
  assert.ok(out.campaign.pipelines.channels.includes('social'));
});

t('Kampagne: fehlendes/ungültiges Datum wird abgelehnt statt geraten', () => {
  assert.strictEqual(cp.create({ title: 'X' }).ok, false);
  assert.strictEqual(cp.create({ title: 'X', release_date: 'keine-Zahl' }).ok, false);
});

t('Kampagne: Ziele sind als Ziele gekennzeichnet und es wird keine Reichweite erzeugt', () => {
  const c = cp.create({ title: 'Ziele', release_date: '2027-02-01', streams_target: 100000 });
  assert.ok(/keine Prognose|Zielwerte/.test(c.campaign.goal.note));
  const st = cp.status();
  assert.ok(st.honesty.some((h) => /Klicks/.test(h)));
});

t('Kalender: sammelt Termine aus den Bereichen', () => {
  const ev = cal.events('2026-09-01', 200);
  assert.ok(ev.count > 0, 'es müssen Termine ankommen');
  const types = new Set(ev.days.flatMap((d) => d.items.map((i) => i.type)));
  assert.ok(types.has('release'), 'Release-Termin fehlt: ' + [...types].join(','));
  assert.ok(types.has('gate'), 'menschliche Freigaben fehlen');
});

t('Kalender: Release-Termin liegt genau auf dem geplanten Tag', () => {
  const ev = cal.events('2026-11-01', 90);
  const day = ev.days.find((d) => d.date === RELEASE);
  assert.ok(day, RELEASE + ' fehlt im Kalender');
  assert.ok(day.items.some((i) => i.type === 'release'));
});

t('Kalender: eigener Termin rein und wieder raus', () => {
  const add = cal.add({ title: 'Studio-Session', date: '2026-11-20', type: 'session', human: false });
  assert.ok(add.ok, JSON.stringify(add));
  const ev = cal.events('2026-11-19', 3);
  assert.ok(ev.days.some((d) => d.items.some((i) => i.title === 'Studio-Session')));
  assert.ok(cal.remove(add.entry.id).ok);
  assert.strictEqual(cal.remove('gibtsnicht').ok, false);
  assert.strictEqual(cal.add({ title: '', date: '2026-01-01' }).ok, false);
});

t('Kalender: mehrere menschliche Freigaben am selben Tag werden als Konflikt gemeldet', () => {
  cal.add({ title: 'Freigabe A', date: '2026-12-01', type: 'gate', human: true });
  cal.add({ title: 'Freigabe B', date: '2026-12-01', type: 'gate', human: true });
  const c = cal.conflicts('2026-12-01', 2);
  assert.ok(c.count >= 1, 'Konflikt nicht erkannt');
  assert.ok(/Freigaben/.test(c.conflicts[0].reason));
});

t('Kalender: ICS-Export ist gültiges Kalender-Format', () => {
  const ics = cal.ics('2026-11-01', 60);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trim().endsWith('END:VCALENDAR'));
  assert.ok((ics.match(/BEGIN:VEVENT/g) || []).length >= 1);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:'));
  assert.ok(ics.split('\r\n').length > 5);
});

t('Handbücher: Kapitel entstehen aus dem laufenden System', () => {
  const c = hb.chapters();
  assert.ok(c.counts.modules > 100, 'Modulzahl zu klein: ' + c.counts.modules);
  assert.ok(c.counts.areas > 20, 'Bereiche zu klein: ' + c.counts.areas);
  assert.ok(c.counts.quickstart_steps >= 5);
  assert.ok(c.chapter_5_documents.length > 20, 'Dokumente fehlen');
});

t('Handbücher: nicht ladbare Module werden ehrlich benannt, nicht verschwiegen', () => {
  const c = hb.chapters();
  const broken = c.chapter_2_areas.flatMap((a) => a.entries).filter((e) => !e.loadable);
  for (const b of broken) assert.ok(b.error, 'Modul ' + b.id + ' als nicht ladbar ohne Fehlertext');
  assert.ok(c.counts.loadable <= c.counts.modules);
});

t('Handbücher: alle GERADE gebauten Module sind ladbar und stehen im Buch', () => {
  const c = hb.chapters();
  const ids = new Set(c.chapter_2_areas.flatMap((a) => a.entries).map((e) => e.id));
  for (const want of ['campaign_planner', 'calendar', 'handbooks', 'songbook', 'video_studio']) {
    assert.ok(ids.has(want), want + ' fehlt im Handbuch');
  }
  const bad = c.chapter_2_areas.flatMap((a) => a.entries).filter((e) => ['campaign_planner', 'calendar', 'handbooks'].includes(e.id) && !e.loadable);
  assert.strictEqual(bad.length, 0, 'neue Module nicht ladbar');
});

t('Handbücher: Markdown ist vollständig und nennt die Freigabe-Regel', () => {
  const md = hb.markdown();
  assert.ok(md.startsWith('# '));
  assert.ok(md.includes('Der Mensch hat das letzte Wort'));
  assert.ok(md.includes('Schnellstart'));
  assert.ok(md.length > 4000, 'Markdown zu dünn: ' + md.length);
});

t('Handbücher: einzelne Modulseite zeigt Fähigkeiten', () => {
  const page = hb.actions.module({ id: 'songbook' });
  assert.ok(page.ok, JSON.stringify(page));
  assert.ok(page.actions.includes('create'));
  assert.strictEqual(hb.actions.module({ id: 'gibtsnicht' }).ok, false);
});

console.log(`\ncampaign_calendar: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
