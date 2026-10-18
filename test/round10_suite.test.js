// Runde 10 — Dritt-Connector mit Fehlerfrei-Schleuse (E) + Selbstbearbeitungs-Werkbank (F).
// Prüft die reinen Funktionen und die Schleuse selbst: Pakete, Verbotsliste, Selbsttest im
// Sandkasten, Prüfprotokoll, Erlaubnislisten der Selbstbearbeitung, Doc/Code-Gleichlauf.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
// Umgebungen VOR dem Laden setzen: der Import liest sie beim require.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-round10-'));
process.env.AURA_MODULE_QUARANTINE_DIR = path.join(TMP, 'quarantine');
process.env.AURA_MODULE_IMPORTS_FILE = path.join(TMP, 'imports.json');

let pass = 0, fail = 0;
const ok = (bedingung, meldung) => { if (bedingung) { pass++; console.log('  ok ' + meldung); } else { fail++; console.log('  FEHLER ' + meldung); } };

const spec = require(path.join(ROOT, 'backend/src/lib/module_spec'));
const zip = require(path.join(ROOT, 'backend/src/lib/zip_stored'));
const moduleImport = require(path.join(ROOT, 'backend/src/lib/module_import'));
const selfwork = require(path.join(ROOT, 'backend/src/lib/selfwork'));
const nav = require(path.join(ROOT, 'backend/src/lib/nav'));
const SANDBOX = path.join(ROOT, 'backend/src/preload/module_selftest_sandbox.js');

// ---------------------------------------------------------------------------
// 1) Schnittstelle v2: Manifest-Prüfung
// ---------------------------------------------------------------------------
const gueltig = {
  id: 'wetter-kontext', name: 'Wetter-Kontext', version: '1.2.3', description: 'Beispiel', author: 'Du',
  type: 'module', entry: 'index.js', permissions: ['log:write'], routes: [{ method: 'GET', path: '/api/health', purpose: 'Zustand' }],
  selftest: { entry: 'selftest.js', timeout_ms: 5000 },
};
ok(spec.validateManifest(gueltig).ok === true, 'Manifest: vollständiges Beispiel ist gültig');
ok(spec.validateManifest({ ...gueltig, selftest: undefined }).ok === false, 'Manifest: ohne selftest ungültig');
ok(spec.validateManifest({ ...gueltig, routes: undefined }).ok === false, 'Manifest: ohne routes[] ungültig');
ok(spec.validateManifest({ ...gueltig, routes: [{ method: 'POST', path: '/api/kill' }] }).ok === false, 'Manifest: schreibende Route abgelehnt');
ok(spec.validateManifest({ ...gueltig, permissions: ['secrets:read'] }).ok === false, 'Manifest: secrets:read ist für Dritt-Module verboten');
ok(spec.validateManifest({ ...gueltig, configSchema: { key: { type: 'string', secret: true } } }).ok === false, 'Manifest: configSchema mit Geheimnis abgelehnt');
ok(spec.validateManifest({ ...gueltig, entry: '../index.js' }).ok === false, 'Manifest: entry mit „..“ abgelehnt');
ok(spec.validateManifest({ ...gueltig, id: '2-bereich' }).ok === false, 'Manifest: ID darf nicht mit Ziffer beginnen');
ok(spec.routeAllowed('GET', '/api/health') && !spec.routeAllowed('GET', '/api/kill') && !spec.routeAllowed('POST', '/api/health'), 'Erlaubnisliste: nur GET, nur bekannte Pfade');

// ---------------------------------------------------------------------------
// 2) Verbotsliste (statischer Scan)
// ---------------------------------------------------------------------------
const treffer = (code) => spec.scanForbidden([{ rel: 'index.js', content: code }]).map((h) => h.id);
ok(treffer("const cp = require('child_process');").includes('child_process_require'), 'Scan: child_process erkannt');
ok(treffer('execSync("ls");').includes('child_process_call'), 'Scan: execSync erkannt');
ok(treffer("require('http').request({});").includes('network_require'), 'Scan: require(http) erkannt');
ok(treffer("await fetch('http://example.invalid');").includes('network_call'), 'Scan: fetch erkannt');
ok(treffer("fs.writeFileSync('/tmp/x','y');").includes('fs_write'), 'Scan: fs-Schreiben erkannt');
ok(treffer('const t = process.env.TOKEN;').includes('secrets_env'), 'Scan: process.env erkannt');
ok(treffer('eval("1+1");').includes('eval'), 'Scan: eval erkannt');
ok(treffer("require('../../src/lib/config');").includes('escape_require'), 'Scan: require(../) erkannt');
ok(treffer("// require('child_process')").length === 0, 'Scan: reine Kommentarzeile zählt nicht');
ok(spec.scanForbidden([{ rel: 'index.js', content: "module.exports = { execute: () => ({ ok: true }) };" }]).length === 0, 'Scan: harmloses Modul bleibt sauber');

// ---------------------------------------------------------------------------
// 3) ZIP-Werkzeug (ein Rad für Bundles und Import)
// ---------------------------------------------------------------------------
const paket = zip.pack([{ name: 'a/one.txt', data: Buffer.from('eins') }, { name: 'a/two.txt', data: Buffer.from('zwei'), compress: true }]);
const entpackt = zip.unpack(paket);
ok(entpackt.ok && entpackt.entries.length === 2, 'ZIP: gespeicherte und deflate-Einträge rundlaufend');
ok(entpackt.entries.find((e) => e.rel === 'a/one.txt').content.toString() === 'eins'
  && entpackt.entries.find((e) => e.rel === 'a/two.txt').content.toString() === 'zwei', 'ZIP: Inhalte unverändert');
const kaputt = Buffer.from(paket); kaputt[40] = kaputt[40] ^ 0xff; // mitten in den Nutzdaten des ersten Eintrags
ok(zip.unpack(kaputt).ok === false, 'ZIP: Prüfsummenfehler wird erkannt');
ok(zip.unpack(Buffer.from('kein zip')).ok === false, 'ZIP: Unsinn wird abgelehnt');

// ---------------------------------------------------------------------------
// 4) Import-Schleuse
// ---------------------------------------------------------------------------
const b64 = (s) => Buffer.from(s).toString('base64');
const paketVon = (dateien, optionen) => ({ data: zip.pack(dateien.map((d) => ({ name: (optionen && optionen.wurzel ? optionen.wurzel + '/' : '') + d.rel, data: Buffer.from(d.inhalt) })), { compress: true }).toString('base64') });
const manifestFuer = (id) => JSON.stringify({ id, name: 'Probe ' + id, version: '1.0.0', description: 'probe', author: 'test', type: 'module', entry: 'index.js', permissions: [], routes: [], selftest: { entry: 'selftest.js' } });
const guteDateien = (id) => [
  { rel: 'aura.module.json', inhalt: manifestFuer(id) },
  { rel: 'index.js', inhalt: "module.exports = { initialize() {}, execute: (a) => ({ ok: true, pong: a }), healthCheck: () => ({ ok: true }), shutdown() {} };" },
  { rel: 'selftest.js', inhalt: "const m = require('./index.js'); const r = m.execute('ping'); console.log(JSON.stringify({ ok: r.ok })); process.exit(r.ok ? 0 : 1);" },
];

(async () => {
  // 4a) gutes Paket (mit Wurzelordner, deflate) → grün, pending_approval
  const gut = await moduleImport.importPackage(Object.assign({ name: 'zz-runde10-gut' }, paketVon(guteDateien('zz-runde10-gut'), { wurzel: 'zz-runde10-gut' })));
  ok(gut.ok === true && gut.status === 'pending_approval', 'Import: geprüftes Paket ist grün und wartet auf Freigabe (' + gut.status + ')');
  const ids = gut.checks.map((c) => c.id);
  ok(['paket', 'manifest', 'einstieg', 'quarantaene', 'syntax', 'verbote', 'konflikt', 'selftest'].every((id) => ids.includes(id)), 'Import: alle acht Prüfungen sind protokolliert');
  ok(gut.checks.every((c) => c.status === 'ok'), 'Import: jede Prüfung ist grün');
  ok(fs.existsSync(path.join(gut.staged_dir, 'aura.module.json')), 'Import: Paket liegt in der Quarantäne (Runtime)');
  ok(String(gut.staged_dir).startsWith(TMP), 'Import: Quarantäne liegt nicht im Repository');

  // 4b) kaputtes Paket → rot, mit Gründen, nicht übernommen
  const kaputtes = await moduleImport.importPackage({
    files: [
      { path: 'aura.module.json', content: b64(JSON.stringify({ id: 'zz-runde10-kaputt', name: 'kaputt', version: '1.0', description: 'd', author: 'a', type: 'module', entry: 'index.js', permissions: ['secrets:read'], routes: [], selftest: { entry: 'selftest.js' } })), encoding: 'base64' },
      { path: 'index.js', content: b64("require('child_process'); module.exports = {};"), encoding: 'base64' },
      { path: 'selftest.js', content: b64('process.exit(0);'), encoding: 'base64' },
    ],
  });
  ok(kaputtes.ok === false && kaputtes.status === 'abgelehnt', 'Import: kaputtes Paket wird abgelehnt');
  ok(kaputtes.checks.some((c) => c.id === 'manifest' && c.status === 'fail'), 'Import: falsches Manifest ist rot (version + unbekanntes Recht)');
  ok(kaputtes.checks.some((c) => c.id === 'verbote' && c.status === 'fail'), 'Import: Verbotsliste schlägt an');
  ok(typeof kaputtes.reason === 'string' && kaputtes.reason.length > 20, 'Import: Grund ist benannt (nicht „irgendwas“)');
  ok(kaputtes.checks.some((c) => c.id === 'selftest' && c.status === 'uebersprungen'), 'Import: Selbsttest läuft nicht, wenn vorher rot');

  // 4c) Syntaxfehler
  const syntax = await moduleImport.importPackage({ files: [{ path: 'aura.module.json', content: b64(manifestFuer('zz-runde10-syntax')), encoding: 'base64' }, { path: 'index.js', content: b64('function kaputt( {'), encoding: 'base64' }, { path: 'selftest.js', content: b64('process.exit(0);'), encoding: 'base64' }] });
  ok(syntax.ok === false && syntax.checks.some((c) => c.id === 'syntax' && c.status === 'fail'), 'Import: node --check fängt Syntaxfehler');

  // 4d) Pfadflucht im Archiv
  const flucht = await moduleImport.importPackage({ data: zip.pack([{ name: '../../evil.js', data: Buffer.from('boese') }]).toString('base64') });
  ok(flucht.ok === false && /Pfadflucht|unzulässig/i.test(JSON.stringify(flucht.checks)), 'Import: Pfadflucht im ZIP wird abgelehnt');

  // 4e) Selbsttest rot
  const rot = await moduleImport.importPackage({ files: [{ path: 'aura.module.json', content: b64(manifestFuer('zz-runde10-rot')), encoding: 'base64' }, { path: 'index.js', content: b64('module.exports={};'), encoding: 'base64' }, { path: 'selftest.js', content: b64('console.error("absichtlich kaputt"); process.exit(2);'), encoding: 'base64' }] });
  ok(rot.ok === false && rot.checks.some((c) => c.id === 'selftest' && c.status === 'fail' && /Exit 2/.test(c.detail)), 'Import: fehlschlagender Selbsttest ist rot (Exit 2)');

  // 4f) Zeitlimit des Selbsttests (hart 10 s)
  const started = Date.now();
  const langsam = await moduleImport.importPackage({ files: [{ path: 'aura.module.json', content: b64(manifestFuer('zz-runde10-langsam')), encoding: 'base64' }, { path: 'index.js', content: b64('module.exports={};'), encoding: 'base64' }, { path: 'selftest.js', content: b64('setTimeout(function(){}, 60000);'), encoding: 'base64' }] });
  const dauer = Date.now() - started;
  ok(langsam.ok === false && langsam.checks.some((c) => c.id === 'selftest' && /Zeitlimit/.test(c.detail)), 'Import: Selbsttest wird nach dem Zeitlimit abgebrochen');
  ok(dauer >= 9000 && dauer < 20000, 'Import: das Zeitlimit liegt bei 10 s (gemessen ' + dauer + ' ms)');

  // 4g) Warteschlange + Freigabe-Tor
  const liste = moduleImport.list();
  ok(liste.some((r) => r.id === 'zz-runde10-gut' && r.status === 'pending_approval' && r.installed === false), 'Warteschlange: gutes Paket wartet, ist nicht installiert');
  ok(liste.some((r) => r.status === 'abgelehnt' && r.installed === false), 'Warteschlange: abgelehnte Pakete sind nicht installiert');
  ok(moduleImport.installIfStaged('zz-runde10-kaputt').installed === false, 'Tor: ein abgelehntes Paket lässt sich nicht installieren');
  const status = moduleImport.status();
  ok(status.counts.pending_approval >= 1 && status.counts.abgelehnt >= 4, 'Status: Zähler sind ehrlich (' + JSON.stringify(status.counts) + ')');
  ok(moduleImport.discard('zz-runde10-gut').ok === true && !moduleImport.list().some((r) => r.id === 'zz-runde10-gut'), 'Warteschlange: Verwerfen räumt auf');

  // ---------------------------------------------------------------------------
  // 5) Sandkasten des Selbsttests (Netz, Schreiben, Umgebung, Kindprozesse)
  // ---------------------------------------------------------------------------
  const sandkasten = (code) => spawnSync(process.execPath, ['--require', SANDBOX, '-e', code], { encoding: 'utf8', timeout: 20000, cwd: TMP, env: { LANG: 'C.UTF-8', AURA_MODULE_SELFTEST: '1' } });
  const netz = sandkasten("try { require('http').request({host:'127.0.0.1'}); console.log('FREI'); } catch (e) { console.log('GESPERRT: ' + e.message); }");
  ok(/GESPERRT/.test(netz.stdout), 'Sandkasten: require(http) ist gesperrt');
  const schreiben = sandkasten("try { require('fs').writeFileSync('x.txt','y'); console.log('FREI'); } catch (e) { console.log('GESPERRT'); }");
  ok(/GESPERRT/.test(schreiben.stdout), 'Sandkasten: fs-Schreiben ist gesperrt');
  const umgebung = sandkasten("console.log(JSON.stringify(process.env));");
  ok(umgebung.stdout.trim() === '{}', 'Sandkasten: process.env ist leer (keine Geheimnisse)');
  const kind = sandkasten("try { require('child_process').spawn('ls'); console.log('FREI'); } catch (e) { console.log('GESPERRT'); }");
  ok(/GESPERRT/.test(kind.stdout), 'Sandkasten: Kindprozesse sind gesperrt');
  const lesen = sandkasten("console.log(require('fs').readFileSync('" + path.join(ROOT, 'backend/modules/example-hello/aura.module.json') + "','utf8').length > 0 ? 'LESBAR' : 'LEER');");
  ok(/LESBAR/.test(lesen.stdout), 'Sandkasten: Lesen bleibt erlaubt (kein Overblocking)');

  // ---------------------------------------------------------------------------
  // 6) Beispielmodul erfüllt beide Fassungen der Schnittstelle
  // ---------------------------------------------------------------------------
  const beispielOrdner = path.join(ROOT, 'backend/modules/example-hello');
  const beispiel = JSON.parse(fs.readFileSync(path.join(beispielOrdner, 'aura.module.json'), 'utf8'));
  ok(spec.validateManifest(beispiel).ok === true, 'Beispielmodul erfüllt Schnittstelle v2');
  const v1 = require(path.join(ROOT, 'backend/src/lib/module_manifest'));
  const v1Roh = v1.readManifest(beispielOrdner);
  ok(v1Roh.ok && v1.validateManifest(v1Roh.raw, beispielOrdner).ok, 'Beispielmodul erfüllt weiterhin Schnittstelle v1 (module_loader)');
  const selbsttest = spawnSync(process.execPath, ['--require', SANDBOX, 'selftest.js'], { cwd: beispielOrdner, encoding: 'utf8', timeout: 20000, env: { LANG: 'C.UTF-8', AURA_MODULE_SELFTEST: '1' } });
  ok(selbsttest.status === 0, 'Beispielmodul: Selbsttest läuft im Sandkasten grün durch');
  ok(/\"ok\": true/.test(selbsttest.stdout), 'Beispielmodul: Selbsttest protokolliert ok:true');

  // ---------------------------------------------------------------------------
  // 7) Selbstbearbeitungs-Werkbank: Erlaubnislisten und Diff-Verständnis
  // ---------------------------------------------------------------------------
  ok(selfwork.isAllowedPath('backend/pages/repair.js') && selfwork.isAllowedPath('backend/src/lib/selfwork.js')
    && selfwork.isAllowedPath('backend/src/routes/api_areas.js') && selfwork.isAllowedPath('test/round10_suite.test.js'), 'Selfwork: alle vier erlaubten Präfixe sind offen');
  ok(!selfwork.isAllowedPath('backend/src/data/selfwork.json') && !selfwork.isAllowedPath('deploy/push.sh')
    && !selfwork.isAllowedPath('.git/config') && !selfwork.isAllowedPath('backend/server.js')
    && !selfwork.isAllowedPath('README.md') && !selfwork.isAllowedPath('../outside.js'), 'Selfwork: alles außerhalb der Liste ist gesperrt (Daten, Deploy, .git, Wurzel, ..)');

  const miniDiff = [
    'diff --git a/backend/src/lib/zz_run10_probe.js b/backend/src/lib/zz_run10_probe.js',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/backend/src/lib/zz_run10_probe.js',
    '@@ -0,0 +1,2 @@',
    "+// Runde-10-Probe",
    '+module.exports = { probe: true };',
    '',
  ].join('\n');
  const geparst = selfwork.extractDiff('Klar!\n```diff\n' + miniDiff + '```\nViel Erfolg.');
  ok(geparst.ok && geparst.files.length === 1 && geparst.files[0] === 'backend/src/lib/zz_run10_probe.js', 'Selfwork: Diff wird aus der Antwort geschnitten (mit Prosa und Code-Fence)');
  const boeseDiff = miniDiff.replace('backend/src/lib/zz_run10_probe.js', 'deploy/boese.sh').replace('b/deploy/boese.sh', 'b/deploy/boese.sh');
  ok(selfwork.pathViolations(['deploy/boese.sh']).length === 1, 'Selfwork: Pfad-Verstoß wird erkannt');
  const kennung = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz012345'; // bewusst zerlegt: der Geheimnis-Scanner der Runde 6 soll hier nicht anschlagen
  ok(selfwork.secretHits('+const t = \'' + kennung + "';").length === 1, 'Selfwork: Geheimnis-Muster in +-Zeilen wird erkannt');
  ok(selfwork.secretHits('+// harmloser kommentar').length === 0, 'Selfwork: harmlose Zeilen bleiben unbeanstandet');

  const pruefung = selfwork.runChecks(geparst.diff, geparst.files);
  if (pruefung.cleanup) pruefung.cleanup();
  ok(pruefung.checks.every((c) => c.status !== 'fail'), 'Selfwork: Mini-Diff ist prüfbar grün (' + pruefung.checks.map((c) => c.id + ':' + c.status).join(', ') + ')');
  ok(pruefung.checks.some((c) => c.id === 'git_apply_check' && c.status === 'ok'), 'Selfwork: git apply --check läuft im temporären Worktree');
  ok(pruefung.checks.some((c) => c.id === 'node_check' && c.status === 'ok'), 'Selfwork: node --check auf berührten Dateien');
  const boesePruefung = selfwork.runChecks(boeseDiff, ['deploy/boese.sh']);
  if (boesePruefung.cleanup) boesePruefung.cleanup();
  ok(boesePruefung.checks.some((c) => c.id === 'pfade' && c.status === 'fail'), 'Selfwork: verbotener Pfad macht die Prüfung rot');
  ok(spawnSync('git', ['worktree', 'list'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim().split('\n').length === 1, 'Selfwork: Worktrees werden aufgeräumt (kein Müll im Repository)');

  const kontext = selfwork.buildContext('selftest diff probe');
  ok(kontext.dateien.length > 100 && kontext.dateien.every((d) => selfwork.isAllowedPath(d)), 'Selfwork: Kontext listet nur erlaubte Dateien');
  ok(Array.isArray(kontext.auszuege) && kontext.auszuege.every((a) => selfwork.isAllowedPath(a.file)), 'Selfwork: Schlüsselwort-Auszüge stammen nur aus erlaubten Dateien');
  ok(kontext.repo && typeof kontext.repo.branch === 'string' && Array.isArray(kontext.repo.dirty), 'Selfwork: git status ist Teil des Kontexts');
  ok(selfwork.BRANCH === 'selfwork-local', 'Selfwork: Commits landen auf Branch selfwork-local');

  // ---------------------------------------------------------------------------
  // 8) Oberflächen: Seite, Navigation, Routen, Doc-Gleichlauf
  // ---------------------------------------------------------------------------
  const seite = require(path.join(ROOT, 'backend/pages/selfwork'))();
  ok(/<html/.test(seite) && seite.length > 5000, 'Seite /selfwork liefert vollständiges HTML');
  ok(/Nichts wird gepusht oder automatisch neu gestartet/.test(seite), 'Seite /selfwork trägt das Warnbanner');
  ok(/\/api\/selfwork\/apply/.test(seite) && /\/api\/selfwork\/revert/.test(seite) && /\/api\/selfwork\/propose/.test(seite), 'Seite /selfwork hat Klick-Buttons für Vorschlag/Anwenden/Zurücknehmen');
  ok(/id="diffView"/.test(seite) && /id="checkList"/.test(seite), 'Seite /selfwork zeigt Diff-Ansicht und Prüfliste');
  ok(/selfwork-local/.test(seite) && /gh pr create/.test(seite), 'Seite /selfwork nennt Branch und Promote-Weg (PR-Ritual)');
  ok(/Kein Push/.test(seite) && /Kein Neustart/.test(seite), 'Seite /selfwork weist die Grenzen aus');
  ok(seite.includes(nav.html('/selfwork')), 'Seite /selfwork nutzt die gemeinsame Navigation');

  const gruppe = nav.GROUPS.find((g) => g.title === 'Betrieb & Sicherheit');
  ok(!!gruppe && gruppe.links.some((l) => l.href === '/selfwork'), 'Navigation: /selfwork liegt in der Gruppe „Betrieb & Sicherheit“');
  ok(new Set(nav.hrefs()).size === nav.hrefs().length, 'Navigation: keine doppelten Ziele');

  const containerSeite = require(path.join(ROOT, 'backend/pages/containers'))();
  ok(/Dritt-Modul importieren/.test(containerSeite) && /\/api\/modulehub\/import/.test(containerSeite), 'Modulehub: Import-Formular ist sichtbar');
  ok(/id="impQueue"/.test(containerSeite) && /id="impResult"/.test(containerSeite), 'Modulehub: Prüfprotokoll und Warteschlange sind sichtbar');

  const quellen = ['api_core.js', 'api_growth_studio.js', 'api_areas.js', 'pages_routes.js'].map((f) => fs.readFileSync(path.join(ROOT, 'backend/src/routes', f), 'utf8')).join('\n');
  ok(/\/api\/selfwork\/propose/.test(quellen) && /\/api\/selfwork\/apply/.test(quellen) && /\/api\/selfwork\/revert/.test(quellen) && /\/api\/selfwork\/proposals/.test(quellen), 'Routen: alle Selfwork-Endpunkte sind verdrahtet');
  ok(/\/api\/modulehub\/import/.test(quellen) && /\/api\/modulehub\/imports/.test(quellen), 'Routen: Import-Endpunkte sind verdrahtet');
  ok(/\/selfwork/.test(fs.readFileSync(path.join(ROOT, 'backend/src/routes/pages_routes.js'), 'utf8')), 'Routen: Seite /selfwork ist registriert');

  const doc = fs.readFileSync(path.join(ROOT, 'docs/MODULE_SPEC.md'), 'utf8');
  ok(doc.includes(spec.SPEC_VERSION), 'Doku: Spec-Version steht im Dokument (' + spec.SPEC_VERSION + ')');
  ok(Object.keys(spec.PERMISSIONS).every((p) => doc.includes(p)), 'Doku: jedes Recht ist im Dokument genannt');
  ok(spec.ROUTE_ALLOWLIST.every((r) => doc.includes(r.path)), 'Doku: jede erlaubte Route ist im Dokument genannt');
  ok(spec.FORBIDDEN_PATTERNS.every((p) => doc.includes(p.id)), 'Doku: jedes Verbotsmuster ist im Dokument genannt');
  ok(/A9\. Vollständiges Beispiel/.test(doc) && /selftest\.js/.test(doc), 'Doku: vollständiges Beispiel vorhanden');
  ok(spec.ROUTE_ALLOWLIST.every((r) => quellen.includes("p === '" + r.path + "'")), 'Doku↔Code: jede erlaubte Route existiert wirklich als Endpunkt');

  // ---------------------------------------------------------------------------
  // 9) Kein automatisches Anwenden: apply only auf grüne Vorschläge
  // ---------------------------------------------------------------------------
  const unbekannt = selfwork.apply('sw-gibt-es-nicht');
  ok(unbekannt.ok === false, 'Selfwork: unbekannter Vorschlag wird nicht angewendet');

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  console.log('\nround10_suite: ' + pass + ' bestanden / ' + fail + ' fehlgeschlagen');
  process.exit(fail ? 1 : 0);
})();
