'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Eigene Temp-Datei, damit die echte creators.json nie verändert wird.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aura-cr-')), 'creators.json');
fs.writeFileSync(tmp, JSON.stringify({ schema_version: 1, platforms: [], creators: [] }));
process.env.AURA_CREATORS_FILE = tmp;

const cw = require('../backend/src/lib/creator_watch');
const du = require('../backend/src/lib/data_upload');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}

t('YouTube-Link: @Handle wird erkannt, RSS-Feed nur mit Kanal-ID', () => {
  const h = cw.normalizeYoutube('https://www.youtube.com/@JulianGoldie');
  assert.strictEqual(h.canonical, 'https://www.youtube.com/@JulianGoldie');
  assert.strictEqual(h.feed, null);
  const c = cw.normalizeYoutube('https://www.youtube.com/channel/UC1234567890abcdefghijKL');
  assert.ok(c.feed.startsWith('https://www.youtube.com/feeds/videos.xml?channel_id=UC'));
});

t('YouTube-Link: http, Video-Link und Müll werden abgelehnt', () => {
  assert.strictEqual(cw.normalizeYoutube('http://www.youtube.com/@x'), null);
  assert.strictEqual(cw.normalizeYoutube('https://www.youtube.com/watch?v=abc'), null);
  assert.strictEqual(cw.normalizeYoutube('kein link'), null);
});

t('Plattform wird aus dem Host erkannt', () => {
  assert.strictEqual(cw.detectPlatform('https://x.com/a'), 'x');
  assert.strictEqual(cw.detectPlatform('https://musicbrainz.org/artist/1'), 'open-data');
  assert.strictEqual(cw.detectPlatform('https://soundcloud.com/a'), 'soundcloud');
  assert.strictEqual(cw.detectPlatform('https://beispiel.de'), 'website');
});

t('Upload Zeilenformat: Name | Link | Themen | bell', () => {
  const r = cw.parseUpload('# Kommentar\nJulian Goldie | https://x.com/JulianGoldieSEO | seo, ai | ja\nKanal Zwei | https://www.youtube.com/@zwei | music |\n', {});
  assert.strictEqual(r.accepted.length, 2, JSON.stringify(r));
  const a = r.accepted[0];
  assert.strictEqual(a.platform, 'x');
  assert.strictEqual(a.bell, true);
  assert.deepStrictEqual(a.topics, ['seo', 'ai']);
  assert.strictEqual(r.accepted[1].bell, false);
});

t('Upload Takeout-CSV: Titel mit Komma, Kanal-URL, kein Glocken-Status', () => {
  const csv = 'Channel Id,Channel Url,Channel Title\nUCabcdefghijklmnopqrstuv,https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv,"Foo, Bar Studio"\n';
  const r = cw.parseUpload(csv, {});
  assert.strictEqual(r.accepted.length, 1, JSON.stringify(r));
  assert.strictEqual(r.accepted[0].name, 'Foo, Bar Studio');
  assert.strictEqual(r.accepted[0].platform, 'youtube');
  assert.strictEqual(r.accepted[0].bell, false);
  assert.ok(r.accepted[0].feed);
});

t('Upload JSON: {"creators": [...]} ', () => {
  const r = cw.parseUpload(JSON.stringify({ creators: [{ name: 'Test Person', url: 'https://musicbrainz.org/artist/abc', topics: ['musik'], bell: true }] }), {});
  assert.strictEqual(r.accepted.length, 1, JSON.stringify(r));
  assert.strictEqual(r.accepted[0].platform, 'open-data');
});

t('Upload: http-Link und Kaufbegriffe werden abgelehnt', () => {
  const r = cw.parseUpload('Böse | http://x.com/a\nFake Views Kaufen | https://x.com/b\n', {});
  assert.strictEqual(r.accepted.length, 0);
  assert.strictEqual(r.rejected.length, 2);
});

t('Doppelte IDs bekommen Suffix', () => {
  const ids = new Set(['julian-goldie']);
  const e = cw.buildEntry({ name: 'Julian Goldie', url: 'https://x.com/other' }, ids);
  assert.strictEqual(e.id, 'julian-goldie-2');
});

t('Zusammenführen: neu wird ergänzt, gleiche URL aktualisiert', () => {
  const r1 = cw.parseUpload('A Person | https://x.com/apers | seo | ja\n', {});
  assert.deepStrictEqual(cw.mergeAccepted(r1.accepted), { added: 1, updated: 0 });
  const r2 = cw.parseUpload('A Person neu | https://x.com/apers | seo, ki | nein\n', {});
  assert.deepStrictEqual(cw.mergeAccepted(r2.accepted), { added: 0, updated: 1 });
  const cur = cw.load().creators.find((c) => c.url === 'https://x.com/apers');
  assert.strictEqual(cur.name, 'A Person neu');
  assert.strictEqual(cur.bell, false);
  assert.strictEqual(cw.load().creators.length, 1);
  assert.strictEqual(cw.check().ok, true, JSON.stringify(cw.check()));
});

t('Upload-Art creators ist registriert und liefert Vorschau ohne Schreiben', () => {
  assert.ok(du.KINDS().some((k) => k.id === 'creators'));
  const before = fs.readFileSync(tmp, 'utf8');
  const pv = du.preview('creators', 'Neu Eintrag | https://x.com/neuer\n');
  assert.strictEqual(pv.ok, true, JSON.stringify(pv));
  assert.strictEqual(pv.can_commit, true);
  assert.strictEqual(fs.readFileSync(tmp, 'utf8'), before, 'Vorschau darf nichts schreiben');
});

t('Upload-Vorschau: ein abgelehnter Eintrag blockiert alles (Alles-oder-nichts)', () => {
  const pv = du.preview('creators', 'Gut | https://x.com/gut\nSchlecht | http://x.com/schlecht\n');
  assert.strictEqual(pv.can_commit, false);
});

console.log(`\ncreator_import: ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
