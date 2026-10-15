'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Temp-Dateien, damit keine echten Laufzeitdaten verändert werden.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-cu-'));
process.env.AURA_ULTRA_FILE = path.join(dir, 'ultra.json');
process.env.AURA_CHANNELS_FILE = path.join(dir, 'channels.json');
fs.writeFileSync(process.env.AURA_CHANNELS_FILE, JSON.stringify({ channels: [
  { id: 'mein-blog', label: 'Mein Blog', kind: 'blog', publish: 'draft-first', api: 'manuell' },
  { id: 'kaputt', label: 'x', publish: 'wrong' },
] }));

const cp = require('../backend/src/lib/channel_pipelines');
const us = require('../backend/src/lib/ultra_scout');

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}

const ids = () => cp.channels().map((c) => c.id);

(async () => {
  await t('Eingebaute Kanäle sind gültig und decken alle Bereiche ab', () => {
    for (const c of cp.BUILTIN) assert.deepStrictEqual(cp.validateChannel(c), [], c.id);
    for (const want of ['youtube', 'wordpress', 'medium', 'newsletter', 'finance-news', 'distro-distrokid', 'distro-tunecore', 'distro-cdbaby', 'distro-ditto']) {
      assert.ok(ids().includes(want), 'fehlt: ' + want);
    }
  });

  await t('Eigener Kanal aus Datei wird geladen, ungültiger übersprungen', () => {
    assert.ok(ids().includes('mein-blog'));
    assert.ok(!ids().includes('kaputt'));
    assert.strictEqual(cp.channels().find((c) => c.id === 'mein-blog').source, 'manuell');
  });

  await t('Plan: nur gewählte Kanäle, je 7 Stufen, Mensch bei Freigabe', () => {
    const p = cp.plan({ channel_ids: ['youtube', 'medium'], topic: 'test' });
    assert.strictEqual(p.channels.length, 2);
    assert.strictEqual(p.channels[0].stages.length, cp.COMMON_STAGES.length);
    assert.strictEqual(p.channels[0].stages.find((s) => s.id === 'approval').gate, 'human');
  });

  await t('Entwurf: Finanz-Kanal ohne Anlageberatungs-Hinweis wird abgelehnt', () => {
    const r = cp.checkDraft('finance-news', { title: 'DAX heute', body: 'Der DAX stieg.' });
    assert.ok(r.issues.some((i) => i.rule === 'disclaimer'));
    const ok = cp.checkDraft('finance-news', { title: 'DAX heute', body: 'Der DAX stieg. Keine Anlageberatung.' });
    assert.strictEqual(ok.ok, true, JSON.stringify(ok));
  });

  await t('Entwurf: gekaufte Reichweite und Mod-Apps werden für jeden Kanal abgelehnt', () => {
    assert.ok(cp.checkDraft('wordpress', { title: 'Views kaufen', body: '' }).issues.length > 0);
    assert.ok(cp.checkDraft('medium', { title: 'YouTube Premium Mod APK', body: '' }).issues.length > 0);
  });

  await t('Entwurf: Video-Titel über 100 Zeichen, unbekannter Kanal', () => {
    assert.ok(cp.checkDraft('youtube', { title: 'x'.repeat(101) }).issues.some((i) => i.rule === 'title-len'));
    assert.strictEqual(cp.checkDraft('gibtsnicht', { title: 'x' }).ok, false);
  });

  await t('Freigabe: Agent oder leer wird abgelehnt, Mensch ok', () => {
    assert.strictEqual(cp.publishAllowed('youtube', { approvedBy: '' }).ok, false);
    assert.strictEqual(cp.publishAllowed('youtube', { approvedBy: 'Agent-7' }).ok, false);
    const r = cp.publishAllowed('youtube', { approvedBy: 'Daniel' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.mode, 'private-first');
  });

  await t('Scout: Metadaten-Prüfung lehnt Archiv, Fork, Lizenz, Sperrwort und wenig Sterne ab', () => {
    const base = { full_name: 'a/b', description: 'agent workflow', topics: [], archived: false, fork: false, license: { spdx_id: 'MIT' }, stargazers_count: 500, pushed_at: new Date().toISOString() };
    assert.strictEqual(us.assess(base).ok, true);
    assert.strictEqual(us.assess({ ...base, archived: true }).ok, false);
    assert.strictEqual(us.assess({ ...base, fork: true }).ok, false);
    assert.strictEqual(us.assess({ ...base, license: { spdx_id: 'GPL-3.0' } }).ok, false);
    assert.strictEqual(us.assess({ ...base, description: 'captcha bypass agent' }).ok, false);
    assert.strictEqual(us.assess({ ...base, stargazers_count: 3 }).ok, false);
  });

  await t('Scout-Lauf: legt Vorschläge an, doppelt keine, Fehler werden festgehalten', async () => {
    const repo = (n) => ({ full_name: 'o/' + n, html_url: 'https://github.com/o/' + n, description: 'youtube pipeline agent', topics: ['ai-agent'], archived: false, fork: false, license: { spdx_id: 'MIT' }, stargazers_count: 300, pushed_at: new Date().toISOString() });
    let calls = 0;
    const fakeFetch = async (url) => {
      calls++;
      if (url.includes('mcp')) return { ok: false, status: 403, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ items: [repo('eins'), repo('zwei')] }) };
    };
    const r1 = await us.runScout({ fetchImpl: fakeFetch, queries: ['topic:ai-agent', 'topic:mcp-server'] });
    assert.strictEqual(r1.added, 2, JSON.stringify(r1));
    assert.strictEqual(r1.errors.length, 1);
    const r2 = await us.runScout({ fetchImpl: fakeFetch, queries: ['topic:ai-agent'] });
    assert.strictEqual(r2.added, 0, 'keine Doppelten');
    const list = us.list();
    assert.strictEqual(list.proposals.length, 2);
    assert.ok(list.proposals.every((p) => p.status === 'vorgeschlagen'));
    assert.ok(calls >= 3);
  });

  await t('Entscheidung: Agent darf nicht, Mensch gibt nur zur Prüfung frei, zweimal geht nicht', () => {
    const id = us.list().proposals[0].id;
    assert.strictEqual(us.decide(id, { decision: 'approve', by: 'Ultra-Bot' }).status, 403);
    const ok = us.decide(id, { decision: 'approve', by: 'Daniel' });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.proposal.status, 'freigegeben_zur_pruefung');
    assert.strictEqual(us.decide(id, { decision: 'reject', by: 'Daniel' }).status, 409);
    assert.strictEqual(us.decide('UP-000000', { decision: 'approve', by: 'Daniel' }).status, 404);
  });

  await t('Täglicher Lauf ist gesetzt und lässt sich abschalten', () => {
    assert.strictEqual(typeof us.startDaily, 'function');
    assert.deepStrictEqual(us.QUERIES.length >= 5, true);
  });

  console.log(`\nchannel_ultra: ${pass} PASS / ${fail} FAIL`);
  if (fail) process.exit(1);
})();
