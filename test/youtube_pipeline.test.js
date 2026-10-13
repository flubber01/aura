'use strict';
const assert = require('assert');
const yt = require('../backend/src/lib/youtube_pipeline');
const cw = require('../backend/src/lib/creator_watch');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}

t('Creator-Liste ist gültig', () => {
  const c = cw.check();
  assert.strictEqual(c.ok, true, JSON.stringify(c.problems));
  assert.ok(c.count >= 1);
});

t('Julian Goldie ist in der Liste, nur https', () => {
  const j = cw.list({}).find((c) => c.id === 'julian-goldie');
  assert.ok(j);
  assert.ok(j.url.startsWith('https://'));
});

t('validate lehnt http, falsche Plattform und Kaufbegriffe ab', () => {
  const pf = ['youtube', 'x'];
  assert.ok(cw.validate({ id: 'abc', name: 'A', platform: 'x', url: 'http://x.com/a', topics: [] }, pf).length > 0);
  assert.ok(cw.validate({ id: 'abc', name: 'A', platform: 'foo', url: 'https://x.com/a', topics: [] }, pf).length > 0);
  assert.ok(cw.validate({ id: 'abc', name: 'Views kaufen', platform: 'x', url: 'https://x.com/a', topics: [] }, pf).length > 0);
  assert.strictEqual(cw.validate({ id: 'abc-1', name: 'A', platform: 'x', url: 'https://x.com/a', topics: ['seo'] }, pf).length, 0);
});

t('Thema-Filter findet Creator', () => {
  assert.ok(cw.list({ topic: 'seo' }).some((c) => c.id === 'julian-goldie'));
});

t('Metadaten: gültig', () => {
  const r = yt.checkMeta({ title: 'Test', description: 'Hallo', tags: ['a', 'b'], synthetic: false });
  assert.strictEqual(r.ok, true);
});

t('Metadaten: Titel über 100 Zeichen wird abgelehnt', () => {
  const r = yt.checkMeta({ title: 'x'.repeat(101) });
  assert.ok(r.issues.some((i) => i.rule === 'title-len'));
});

t('Metadaten: KI-Inhalt ohne Kennzeichnung wird abgelehnt', () => {
  const r = yt.checkMeta({ title: 'T', synthetic: true, ai_disclosure: false });
  assert.ok(r.issues.some((i) => i.rule === 'ai-disclosure'));
  assert.strictEqual(yt.checkMeta({ title: 'T', synthetic: true, ai_disclosure: true }).ok, true);
});

t('Metadaten: gekaufte Views und Mod-Apps werden abgelehnt', () => {
  assert.ok(yt.checkMeta({ title: 'Jetzt views kaufen' }).issues.some((i) => i.rule === 'no-fake-engagement'));
  assert.ok(yt.checkMeta({ title: 'YouTube Premium Mod APK' }).issues.some((i) => i.rule === 'no-modded-apps'));
});

t('Upload ohne Mensch wird abgelehnt', () => {
  assert.strictEqual(yt.uploadBody({ title: 'T' }, {}).ok, false);
  assert.strictEqual(yt.uploadBody({ title: 'T' }, { approvedBy: 'agent-1' }).ok, false);
  assert.strictEqual(yt.uploadBody({ title: 'T' }, { approvedBy: 'system' }).ok, false);
});

t('Upload-Körper ist immer privat und Trockenlauf', () => {
  const r = yt.uploadBody({ title: 'T', synthetic: true, ai_disclosure: true }, { approvedBy: 'daniel' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.dryRun, true);
  assert.strictEqual(r.request.body.status.privacyStatus, 'private');
  assert.strictEqual(r.request.body.status.containsSyntheticMedia, true);
});

t('Plan hat alle Stufen, Freigabe ist Mensch-Tor', () => {
  const p = yt.plan({ topic: 'seo', creator_ids: ['julian-goldie'] });
  assert.strictEqual(p.stages.length, yt.STAGES.length);
  assert.ok(p.stages.find((s) => s.id === 'approval').gate === 'human');
  assert.ok(p.sources.some((s) => s.id === 'julian-goldie'));
});

console.log(`\nyoutube_pipeline: ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
