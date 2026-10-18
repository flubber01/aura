// Prüfsatz Verbund: Concat-Repos, externe Steckplätze (ehrlich, ein Link), Cross-Chain,
// Montage offen, n8n-Katalog, CLI erreicht alles.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
process.env.AURA_MILESTONES_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vb-')), 'milestones.json');
const verbund = require('../backend/src/lib/verbund');
const CLI = path.join(__dirname, '..', 'bin', 'aura-cli.js');
const cli = (args, env) => execFileSync(process.execPath, [CLI].concat(args), { env: Object.assign({}, process.env, env || {}), cwd: os.tmpdir() }).toString();

const results = [];
const t = (name, fn) => {
  try { fn(); results.push('  ok   ' + name); }
  catch (e) { results.push('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
};

t('Concat-Repos: Kennungen eindeutig, je genau ein Link, Ereignis aus dem Meilenstein-Katalog', () => {
  const ids = new Set();
  for (const r of verbund.REPOS) {
    assert.ok(!ids.has(r.id), 'doppelte Kennung ' + r.id);
    ids.add(r.id);
    assert.ok(typeof r.link === 'string' && r.link.length > 0, r.id + ' ohne Link');
    assert.ok(r.event === null || r.event === 'inhalt' || r.event === 'klick', r.id + ' mit unbekanntem Ereignis');
    assert.ok(r.n8n && r.n8n.startsWith('wf-'), r.id + ' ohne n8n-Workflow');
  }
  assert.ok(verbund.REPOS.length >= 8, 'zu wenige Glieder');
});

t('Externe Steckplätze: je genau ein Link-Eintrag, Status ehrlich formuliert', () => {
  for (const e of verbund.EXTERN) {
    assert.ok('link' in e, e.id + ' ohne Link-Feld');
    assert.ok(typeof e.status === 'string' && e.status.length > 20, e.id + ' ohne Status');
    if (e.link === null) assert.ok(/NICHT|VOM MENSCHEN/i.test(e.status), e.id + ': null-Link ohne ehrlichen Status');
  }
  const ohne = verbund.EXTERN.filter((e) => e.link === null);
  assert.ok(ohne.length >= 4, 'erwartet mehrere offene Steckplätze');
});

t('Cross-Chain: Erzeuger-Routen buchen Inhalt, sonstige POSTs Aktion, GET nichts', () => {
  assert.strictEqual(verbund.crosschain('/api/spoken/podcast', 'POST'), 'inhalt');
  assert.strictEqual(verbund.crosschain('/api/video/plan', 'POST'), 'inhalt');
  assert.strictEqual(verbund.crosschain('/api/dist/feed', 'POST'), 'inhalt');
  assert.strictEqual(verbund.crosschain('/api/intro/agentic', 'POST'), 'inhalt');
  assert.strictEqual(verbund.crosschain('/api/sonst/was', 'POST'), 'klick');
  assert.strictEqual(verbund.crosschain('/api/spoken/status', 'GET'), null);
});

t('Kette: jedes Glied trägt Ereignis, n8n-Workflow und Rohrdaten-Feld', () => {
  const k = verbund.kette();
  assert.ok(k.glieder.length === verbund.REPOS.length);
  for (const g of k.glieder) {
    assert.ok('rohre' in g, g.id + ' ohne Rohr-Feld');
    assert.ok(g.n8n);
  }
  assert.ok(k.extern.length === verbund.EXTERN.length);
  assert.ok(k.ereignisse.zeit && k.ereignisse.klick);
});

t('Montage: offen, mit Video-, Effekte-, Kamera- und Intro-Teil', () => {
  const m = verbund.montage();
  assert.strictEqual(m.offen, true);
  assert.strictEqual(m.abteilung, 'MONTAGE');
  assert.ok(m.video && typeof m.video === 'object');
  assert.ok(m.effekte && typeof m.effekte === 'object');
  assert.ok(m.kamera && typeof m.kamera === 'object');
  assert.ok(m.intro.route.includes('intro'));
  assert.ok(verbund.pageMontage().includes('MONTAGE — OFFEN'));
});

t('n8n-Katalog: mindestens sechs Workflows, jeder mit Trigger und Knotenfolge', () => {
  const n = verbund.n8nWorkflows();
  assert.ok(n.workflows.length >= 6);
  for (const w of n.workflows) {
    assert.ok(w.trigger && w.trigger.length > 5, w.id + ' ohne Trigger');
    assert.ok(Array.isArray(w.knoten) && w.knoten.length >= 3, w.id + ' ohne Knotenfolge');
  }
  assert.strictEqual(n.webhook_route, '/api/n8n/webhook');
});

t('CLI: hilfe, status, verbund, kette, montage, n8n laufen durch', () => {
  for (const c of ['hilfe', 'status', 'verbund', 'kette', 'montage', 'n8n']) {
    const o = cli([c]);
    assert.ok(o.length > 20, c + ' ohne Ausgabe');
  }
  assert.ok(cli(['kette']).includes('glieder'));
  assert.ok(cli(['n8n']).includes('wf-intro'));
});

t('CLI: track und meilensteine buchen und lesen denselben Nutzer', () => {
  const env = { AURA_MILESTONES_FILE: process.env.AURA_MILESTONES_FILE };
  const r1 = JSON.parse(cli(['track', 'cli-user', 'zeit', '10'], env));
  assert.ok(r1.ok);
  assert.deepStrictEqual(r1.neu.map((m) => m.id), ['zeit-10']);
  const r2 = JSON.parse(cli(['meilensteine', 'cli-user'], env));
  assert.strictEqual(r2.werte.zeit, 10);
  assert.strictEqual(r2.gesamt_verliehen, 1);
});

t('CLI: intro legt ein echtes PNG ab', () => {
  const o = JSON.parse(cli(['intro', '8.5', '640', '360']));
  assert.ok(o.ok && o.bytes > 1000);
  const d = fs.readFileSync(o.datei);
  assert.strictEqual(d.slice(1, 4).toString(), 'PNG');
  fs.unlinkSync(o.datei);
});

t('CLI: unbekannter Befehl endet mit Fehler', () => {
  let code = 0;
  try { execFileSync(process.execPath, [CLI, 'gibt-es-nicht'], { stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assert.strictEqual(code, 1);
});

console.log(results.join('\n'));
const fail = results.filter((r) => r.startsWith('  FAIL')).length;
console.log('\nVerbund: ' + (results.length - fail) + ' pass / ' + fail + ' fail');
