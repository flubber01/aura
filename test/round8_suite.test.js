// Runde 8 — Produkt-Runde: Meilenstein-Badge in jeder shell-Seite, eigene Seiten auf
// ui_kit.shell() gehoben, Regression für zwei altbekannte Schwächen (Stil-Freitextfall,
// Orchestrator-Varianten) und Selbsttest des Resume-Skripts (deploy/resume.sh).
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const ok = (b, m) => { if (b) { pass++; console.log('  ok ' + m); } else { fail++; console.log('  FEHLER ' + m); } };
const ROOT = path.join(__dirname, '..');

// 1) ui_kit: Badge in jeder shell-Seite + Client-Logik
const ui = require(path.join(ROOT, 'backend/src/lib/ui_kit'));
const html = ui.shell({ title: 'Test', body: '<p>x</p>' });
ok(html.includes('id="ms-badge"'), 'shell() trägt das Meilenstein-Badge im Kopf');
ok(ui.CLIENT_JS.includes('/api/milestones/kurz'), 'Client-JS holt /api/milestones/kurz');
ok(ui.CLIENT_JS.includes('initMilestones'), 'Client-JS hat initMilestones');
ok(ui.CLIENT_JS.includes('auraToast'), 'neue Verleihung läuft über den Toast');
ok(ui.NAV.some(([h]) => h === '/meilensteine') && ui.NAV.some(([h]) => h === '/montage'), 'NAV enthält Meilensteine und Montage');
ok(ui.CSS.includes('.ms-badge'), 'CSS kennt .ms-badge');

// 2) milestones: kurz() Form + Seite auf shell, Heartbeat bleibt
const ms = require(path.join(ROOT, 'backend/src/lib/milestones'));
const k = ms.kurz('round8-test');
ok(['START', 'BRONZE', 'SILBER', 'GOLD', 'PLATIN'].includes(k.stufe), 'kurz().stufe gültig: ' + k.stufe);
ok(typeof k.verliehen === 'number' && typeof k.katalog === 'number', 'kurz() zählt verliehen/katalog');
ok(k.naechster === null || (typeof k.naechster.prozent === 'number' && k.naechster.prozent >= 0 && k.naechster.prozent <= 100), 'kurz().naechster sauber (null oder 0–100 %)');
const msPage = ms.page('round8-test');
ok(msPage.includes('id="ms-badge"') && msPage.includes('<nav'), 'Meilenstein-Seite nutzt ui_kit.shell');
ok(msPage.includes('/api/milestones/track') && msPage.includes('SID'), 'Heartbeat der Seite bleibt erhalten');
ok(ms.statusRoute().kurz_pfad === '/api/milestones/kurz', 'statusRoute nennt kurz_pfad');

// 3) verbund: Montage-Seite auf shell
const vb = require(path.join(ROOT, 'backend/src/lib/verbund'));
const mo = vb.pageMontage();
ok(mo.includes('id="ms-badge"') && mo.includes('<nav'), 'Montage-Seite nutzt ui_kit.shell');
ok(mo.includes('/api/montage/status'), 'Montage-Seite verlinkt die Rohdaten');

// 4) Regression: Stil-Freitextfall (altbekannte Schwäche — gefangen und festgehalten)
const styles = require(path.join(ROOT, 'backend/src/lib/styles_catalog'));
const frei = styles.find('ich will einen gospel song');
ok(frei && typeof frei === 'object', 'find() versteht Freitext („ich will einen gospel song“)');
ok(frei && /gospel/i.test(JSON.stringify(frei)), 'Freitext findet den Gospel-Stil');
ok(styles.find('') === null && styles.find(null) === null, 'find() bleibt bei leerem Input null (ehrlich)');

// 5) Regression: Orchestrator-Varianten sind wirklich verschieden
const orc = require(path.join(ROOT, 'backend/src/lib/song_orchestrator'));
const plan = orc.plan({ prompt: 'ruhiger lofi track zum testen', variants: 2 });
ok(plan && plan.ok, 'Orchestrator plant');
if (plan && plan.ok) {
  const r = orc.render({ id: plan.plan.id, variants: 2 });
  ok(r && r.ok, 'Orchestrator rendert');
  if (r && r.ok) {
    ok(Array.isArray(r.render.variants) && r.render.variants.length === 2, 'zwei Varianten erzeugt');
    ok(r.render.qc.all_different === true, 'Varianten sind wirklich verschieden (qc.all_different)');
  }
}

// 6) resume.sh: sauber, Schlüssel-Schritte vorhanden, DRY_RUN läuft durch
const SH = path.join(ROOT, 'deploy/resume.sh');
ok(fs.existsSync(SH), 'deploy/resume.sh existiert');
const sh = fs.readFileSync(SH, 'utf8');
for (const w of ['imageio-ffmpeg', 'dist-stand', 'setsid nohup', 'validate', 'E2B_SANDBOX_ID', 'api/health']) {
  ok(sh.includes(w), 'resume.sh enthält „' + w + '“');
}
try { execFileSync('bash', ['-n', SH], { stdio: 'pipe' }); ok(true, 'resume.sh: bash -n sauber'); } catch (e) { ok(false, 'resume.sh: bash -n sauber — ' + e.message); }
try {
  const out = execFileSync('bash', [SH], { env: Object.assign({}, process.env, { DRY_RUN: '1', PORT: '8099', SKIP_VALIDATE: '1' }), encoding: 'utf8', timeout: 60000 });
  ok(out.includes('DRY_RUN=1'), 'DRY_RUN meldet sich im Kopf');
  ok(out.includes('fertig'), 'DRY_RUN läuft bis zum Ende durch');
  ok(!out.includes('Server live'), 'DRY_RUN startet nichts');
} catch (e) { ok(false, 'resume.sh DRY_RUN läuft durch — ' + e.message); }

console.log(`\nround8_suite: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
