'use strict';
// Prüft die zweite Ausbaustufe (Runde 4): Support, Speicher, Analyse, Selbstüberwachung, Messenger,
// Nutzerbereich, Social-Login, DAW-Geräte, Design-Bausteine, Startvideo, Seiten-Projekte,
// Hermes im ganzen Prozess und die Zahlungsdienstleister.
//
// Alle Dateien liegen in einem Temp-Ordner; die Prüfung berührt keine echten Daten.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-r4-'));
process.env.AURA_SUPPORT_FILE = path.join(tmp, 'support.json');
process.env.AURA_CONTENT_FILE = path.join(tmp, 'content.json');
process.env.AURA_CONTENT_DIR = path.join(tmp, 'content');
process.env.AURA_ANALYTICS_FILE = path.join(tmp, 'analytics.json');
process.env.AURA_AUTO_MONITOR_FILE = path.join(tmp, 'monitor.json');
process.env.AURA_MESSENGER_FILE = path.join(tmp, 'messenger.json');
process.env.AURA_USERS_FILE = path.join(tmp, 'users.json');
process.env.AURA_SOCIAL_LOGIN_FILE = path.join(tmp, 'social.json');
process.env.AURA_DAW_DEVICES_FILE = path.join(tmp, 'daw.json');
process.env.AURA_UI_FILE = path.join(tmp, 'ui.json');
process.env.AURA_INTRO_DIR = path.join(tmp, 'intro');
process.env.AURA_INTRO_FILE = path.join(tmp, 'intro.json');
process.env.AURA_SITE_PROJECTS_FILE = path.join(tmp, 'projects.json');
process.env.AURA_HERMES_FLOW_FILE = path.join(tmp, 'flow.json');
process.env.AURA_HERMES_SKILLS_FILE = path.join(tmp, 'skills.json');
process.env.AURA_PAYMENTS_FILE = path.join(tmp, 'payments.json');
process.env.AURA_WEB_EMPIRE_FILE = path.join(tmp, 'web_empire.json');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const support = require('../backend/src/lib/support');
const store = require('../backend/src/lib/content_store');
const ana = require('../backend/src/lib/analytics_forecast');
const monitor = require('../backend/src/lib/auto_monitor');
const msg = require('../backend/src/lib/artist_messenger');
const users = require('../backend/src/lib/user_area');
const social = require('../backend/src/lib/social_login');
const daw = require('../backend/src/lib/daw_devices');
const ui = require('../backend/src/lib/ui_kit');
const intro = require('../backend/src/lib/boot_intro');
const projects = require('../backend/src/lib/site_projects');
const flow = require('../backend/src/lib/hermes_process');
const pay = require('../backend/src/lib/payment_providers');
const hermes = require('../backend/src/lib/hermes_bridge');

// ------------------------------------------------------------ Support
t('Support: Anliegen bekommt Nummer, Zustand und automatische Belege', () => {
  const r = support.submit({ title: 'Rendern bricht ab', text: 'Bei Sekunde 4 passiert nichts mehr.', category: 'FEHLER', priority: 'normal', from: 'Sabr47' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(r.ticket.number, 'A-0001');
  assert.strictEqual(r.ticket.state, 'NEU');
  assert.ok(r.attached.length >= 3, 'Belege fehlen');
  assert.ok(r.never_attached.some((x) => /Passwörter/.test(x)), 'Nie-Liste fehlt');
  assert.ok(r.never_attached.length >= 5);
});

t('Support: Sicherheit + dringend löst die Alarmleiter aus, normal nicht', () => {
  const a = support.submit({ title: 'Fremdzugriff erkannt', text: 'Unbekannte IP am Server.', category: 'SICHERHEIT', priority: 'dringend' });
  assert.ok(a.notified && a.notified.state, 'Alarm nicht ausgelöst: ' + JSON.stringify(a.notified));
  const b = support.submit({ title: 'Frage zur Bedienung', text: 'Wie lege ich eine Kampagne an?', category: 'FRAGE', priority: 'normal' });
  assert.strictEqual(b.notified, null);
});

t('Support: antworten setzt auf IN_ARBEIT, Zustand ist steuerbar, Diagnose liegt im Ticket', () => {
  const list = support.list({ state: 'NEU' });
  assert.ok(list.count >= 1);
  const id = list.tickets[0].id;
  assert.strictEqual(support.reply(id, { text: 'Wir sehen es uns an.', by: 'Auraos' }).ticket.state, 'IN_ARBEIT');
  assert.strictEqual(support.setState(id, 'GELOEST', { by: 'Auraos' }).ticket.state, 'GELOEST');
  const t2 = support.get(id);
  assert.ok(t2.ticket.replies.length >= 1);
  assert.ok(t2.ticket.diagnostics && Object.keys(t2.ticket.diagnostics.modules).length >= 5, 'Diagnose zu dünn');
  assert.ok(Array.isArray(t2.ticket.diagnostics.not_attached) && t2.ticket.diagnostics.not_attached.length >= 3);
  assert.strictEqual(support.contact().ways.length, 5);
});

// ------------------------------------------------------------ Speicher
t('Speicher: ablegen nummeriert Ordner nach Jahr/Monat/Art und zählt Fassungen', () => {
  const r = store.register({ title: 'Creed Street', kind: 'SONG', body: 'Textfassung 1', tags: ['Song', '2026'], by: 'Sabr47' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.match(r.where, /content[/\\]\d{4}[/\\]\d{2}[/\\]song$/);
  const id = r.item.id;
  const v = store.version(id, { body: 'Textfassung 2', note: 'Refrain geändert', by: 'Sabr47' });
  assert.strictEqual(v.version.v, 2);
  assert.strictEqual(store.get(id).item.versions.length, 2);
});

t('Speicher: Veröffentlichen braucht einen Menschen — sonst abgelehnt', () => {
  const id = store.search({}).items[0].id;
  const no = store.setState(id, 'VEROEFFENTLICHT');
  assert.strictEqual(no.ok, false);
  assert.strictEqual(no.needs, 'human');
  const yes = store.setState(id, 'VEROEFFENTLICHT', { human: true, by: 'Auraos' });
  assert.strictEqual(yes.ok, true);
  assert.strictEqual(yes.item.state, 'VEROEFFENTLICHT');
  assert.ok(store.get(id).item.state_history.length >= 1, 'Verlauf fehlt');
});

t('Speicher: suchen, Art unbekannt abgelehnt, Sammelausgabe mit Prüfsumme', () => {
  assert.strictEqual(store.search({ q: 'creed' }).count, 1);
  assert.strictEqual(store.search({ kind: 'VIDEO' }).count, 0);
  assert.strictEqual(store.register({ title: 'x', kind: 'QUATSCH' }).ok, false);
  const b = store.bundle({ ids: [store.search({ q: 'creed' }).items[0].id], name: 'Monatsausgabe' });
  assert.ok(b.ok && b.manifest && b.manifest.manifest_sha256, 'Manifest fehlt: ' + JSON.stringify(b).slice(0, 120));
  assert.ok(b.bundle && fs.existsSync(b.bundle.file), 'Manifest-Datei fehlt');
  const ret = store.retention();
  assert.strictEqual(ret.candidates, 0);
  assert.match(ret.rule, /löschen nein/, 'Aufräumen darf nichts löschen');
});

// ------------------------------------------------------------ Analyse
t('Analyse: ohne Messwerte keine Vorhersage, mit Messwerten Spanne + Vorbehalte', () => {
  assert.strictEqual(ana.forecast({ page: '/leer' }).ok, false);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    ana.traffic({ page: '/vergleich', date: d, views: 100 + i * 12, visitors: 80 + i * 8, clicks: 10 + i, source: 'webserver', side_product: 'vergleich-2026' });
  }
  const o = ana.overview(30);
  assert.strictEqual(o.entries, 14);
  assert.ok(o.side_products['vergleich-2026'], 'Nebenprodukt nicht erkannt');
  const f = ana.forecast({ page: '/vergleich', weeks: 4 });
  assert.ok(f.ok, JSON.stringify(f).slice(0, 200));
  assert.ok(f.forecast.range.low <= f.forecast.range.high);
  assert.strictEqual(Object.keys(f.forecast.methods).length, 3);
  assert.ok(f.forecast.caveats.length >= 1, 'Vorbehalte fehlen');
});

t('Analyse: Reihen rechnen Trend, Streuung und Ausreißer selbst aus', () => {
  const s = ana.series([10, 12, 11, 15, 14, 16, 18, 17, 19, 21, 90]);
  assert.ok(s.mean > 20 && s.mean < 30);
  assert.ok(s.slope > 0, 'Steigung nicht erkannt');
  assert.ok(s.outliers.length >= 1, 'Ausreißer nicht gefunden');
  const c = ana.chartEntry({ chart: 'de-singles', week: '2026-10-12', position: 12, title: 'Beispiel', genre: 'pop' });
  assert.ok(c.ok, JSON.stringify(c));
  assert.ok(ana.actions.charts().entries >= 1, 'Chart-Auswertung leer');
});

// ------------------------------------------------------------ Selbstüberwachung
t('Selbstüberwachung: elf Regeln, Durchlauf liefert Befund und Urteil, liest nur', () => {
  assert.strictEqual(monitor.rules().count, 11);
  const r = monitor.run({ alert: false });
  assert.strictEqual(r.run.checked, 11);
  assert.ok(typeof r.verdict === 'string' && r.verdict.length > 3);
  assert.ok(Array.isArray(r.results) && r.results.length === 11, 'Ergebnisliste fehlt');
  assert.strictEqual(monitor.status().rules, 11);
  assert.ok(monitor.status().rules_text.some((x) => /lesen nur/.test(x)));
});

// ------------------------------------------------------------ Messenger
t('Messenger: Ideenrunde, eine Stimme pro Person, Ergebnis erzwingt Sieger', () => {
  const ch = msg.channel({ kind: 'brainstorm', name: 'Trap mit Schlager-Piano?', members: ['Sabr47', 'Auraos'] });
  assert.ok(ch.ok, JSON.stringify(ch));
  const chId = ch.channel.id;
  const p1 = msg.post({ channel: chId, from: 'Sabr47', text: 'Schlager-Piano über 808-Bass', kind: 'idee' });
  assert.ok(p1.ok);
  assert.strictEqual(msg.advance(chId).ok, true);
  const ideas = JSON.parse(fs.readFileSync(process.env.AURA_MESSENGER_FILE, 'utf8')).ideas;
  assert.strictEqual(ideas.length, 1);
  assert.strictEqual(msg.vote({ idea: ideas[0].id, by: 'Sabr47', points: 5 }).ok, true);
  const twin = msg.vote({ idea: ideas[0].id, by: 'Sabr47', points: 4 });
  assert.strictEqual(twin.ok, false);
  assert.match(twin.error, /schon bewertet/);
  assert.strictEqual(msg.advance(chId).ok, true);
  const res = msg.result(chId);
  assert.ok(res.ok, JSON.stringify(res));
  assert.strictEqual(res.outcome.winner.points, 5);
  const draft = msg.toDraft({ channel: chId, what: 'song', style: 'trap', bpm: 140 });
  assert.ok(draft.ok, JSON.stringify(draft).slice(0, 200));
  assert.strictEqual(draft.created.type, 'song');
  assert.ok(draft.created.id && draft.path, 'Entwurf ohne Kennung oder Weg');
});

t('Messenger: Kanal mit Fremden abgelehnt, Doppelbeitrag aus einem Kanal nicht möglich', () => {
  const ch = msg.channel({ kind: 'direkt', name: 'Zwiegespräch', members: ['Sabr47', 'Auraos'] });
  assert.ok(ch.ok);
  assert.strictEqual(msg.channel({ kind: 'direkt', name: 'Zu dritt', members: ['a', 'b', 'c'] }).ok, false);
  assert.match(msg.post({ channel: ch.channel.id, from: 'Fremder', text: 'hallo' }).error, /nicht in diesem Kanal/);
});

// ------------------------------------------------------------ Nutzerbereich
t('Nutzerbereich: Rollen mit Rechten — viewer darf nicht entscheiden', () => {
  const list = users.actions.list();
  assert.ok(list.ok || Array.isArray(list.roles));
  const roles = JSON.parse(fs.readFileSync(process.env.AURA_USERS_FILE, 'utf8'));
  assert.ok(Array.isArray(roles.users));
  const u = users.create({ name: 'Sabr47', role: 'artist' });
  assert.ok(u.ok, JSON.stringify(u));
  const v = users.create({ name: 'Blick', role: 'viewer' });
  assert.ok(v.ok);
  assert.strictEqual(users.check({ user: 'Blick', action: 'decide' }).allowed, false);
  assert.strictEqual(users.check({ user: 'Sabr47', action: 'decide' }).human_required, true);
  assert.strictEqual(users.setRole(u.user.id, 'editor').ok, true);
  assert.ok(users.dashboard(u.user.id).tiles.length >= 5, 'Übersicht zu dünn');
  assert.ok(users.preferences(u.user.id, { theme: 'dark' }).ok, 'Einstellung nicht gespeichert');
  assert.strictEqual(users.preferences(u.user.id, { theme: 'neon' }).ok, false, 'ungültiger Wert muss abgelehnt werden');
});

// ------------------------------------------------------------ Social-Login
t('Social-Login: neun Anbieter, ohne Vault-Schlüssel ehrlich NOT-CONNECTED', () => {
  const st = social.status();
  assert.strictEqual(st.providers, 9);
  assert.strictEqual(st.ready, 0);
  const s = social.start({ provider: 'google', redirect: '/konto' });
  assert.strictEqual(s.ok, false);
  assert.strictEqual(s.status, 'NOT-CONNECTED');
  assert.ok(s.authorization_url_preview && s.authorization_url_preview.includes('state='), 'Vorschau-Adresse fehlt');
  assert.ok(s.needed.length >= 1, 'fehlende Schlüssel nicht benannt');
});

t('Social-Login: Verknüpfen und Lösen nur mit Menschen, Rückmeldung braucht gültigen state', () => {
  assert.strictEqual(social.link({ user: 'Sabr47', provider: 'spotify' }).ok, false, 'ohne handle darf nichts verknüpft werden');
  assert.strictEqual(social.link({ user: 'Sabr47', provider: 'youtube' }).ok, false, 'unbekannter Anbieter muss abgelehnt werden');
  assert.strictEqual(social.link({ user: 'Sabr47', provider: 'spotify', handle: 'sabr47', human: true, by: 'Auraos' }).ok, true);
  const prov = social.providerState();
  assert.strictEqual(prov.providers.length, 9);
  assert.ok(prov.providers.every((x) => x.state !== 'BEREIT'), 'ohne Schlüssel darf nichts bereit sein');
  const links = social.actions.links().links;
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].provider, 'spotify');
  const cb = social.callback({ state: 'erfunden', code: 'x' });
  assert.strictEqual(cb.ok, false);
  assert.strictEqual(social.unlink('sabr47', { human: true, by: 'Auraos' }).ok, true, 'Trennen über die Kennung muss gehen');
  assert.strictEqual(social.actions.links().links.length, 0);
  assert.strictEqual(social.unlink('sabr47', { human: true, by: 'Auraos' }).ok, false, 'doppeltes Trennen muss auffallen');
});

// ------------------------------------------------------------ DAW-Geräte
t('DAW: acht Geräteklassen, ehrliche Systemabfrage statt Behauptung', () => {
  assert.strictEqual(daw.actions.kinds().kinds.length, 8);
  const p = daw.probe();
  assert.ok(['MIDI/AUDIO ERKANNT', 'NUR AUDIO-KARTEN ERKANNT', 'NOT-CONNECTED'].includes(p.mode));
  assert.ok(typeof p.found === 'number');
  assert.match(p.honesty, /Ohne Treiber/);
});

t('DAW: Regler an echten Effekt binden, Wert anwenden, Note und Latenz rechnen', () => {
  const add = daw.addDevice({ kind: 'MIDI_KEYBOARD', name: 'Test-Keyboard' });
  assert.ok(add.ok, JSON.stringify(add));
  const learn = daw.learn({ cc: 74, target: 'daw_plugins.reverb.decay', device: add.device.id, name: 'Hall-Regler' });
  assert.ok(learn.ok, JSON.stringify(learn));
  assert.ok(learn.mapping.target.length > 0 && learn.mapping.cc === 74);
  const ap = daw.apply({ cc: 74, value: 96 });
  assert.ok(ap.ok && ap.patch && ap.patch.reverb, 'Patch fehlt: ' + JSON.stringify(ap));
  assert.ok(typeof ap.patch.reverb.decay === 'number');
  const n = daw.note({ note: 60 });
  assert.strictEqual(n.name, 'C4');
  assert.ok(Math.abs(n.frequency_hz - 261.63) < 0.05, 'Frequenz falsch: ' + n.frequency_hz);
  const lat = daw.latency({ buffer: 256, rate: 48000 });
  assert.ok(Math.abs(lat.round_trip_ms - 10.67) < 0.05, 'Latenz falsch: ' + lat.round_trip_ms);
  assert.strictEqual(lat.table.length, 5, 'Puffertabelle fehlt');
});

// ------------------------------------------------------------ Design-Bausteine
t('Design: Bausteineseite ist vollständig, ohne fremde Adressen', () => {
  const page = ui.componentsPage();
  assert.ok(page.length > 8000, 'Seite zu klein: ' + page.length);
  assert.match(page, /lang="de"/);
  assert.match(page, /viewport/);
  assert.ok(!/https?:\/\//.test(page), 'fremde Adresse in der Seite');
  assert.match(page, /role="slider"/);
  assert.match(page, /data-on=/);
  const c = ui.status();
  assert.ok(c.components.length >= 10, 'zu wenige Bausteine: ' + c.components.length);
  assert.strictEqual(ui.NAV.length, 8, 'NAV: ' + JSON.stringify(ui.NAV.map(([h]) => h)));
  assert.ok(ui.NAV.some(([h]) => h === '/meilensteine'), 'NAV ohne Meilensteine');
  assert.ok(ui.NAV.some(([h]) => h === '/montage'), 'NAV ohne Montage');
  for (const tot of ['/konto', '/studio-live', '/messenger', '/analyse', '/projekte', '/support']) {
    assert.ok(!ui.NAV.some(([h]) => h === tot), 'toter Link in NAV: ' + tot);
  }
  assert.ok(ui.startPage().includes('id="ms-badge"'), 'Startseite nutzt die shell');
});

// ------------------------------------------------------------ Startvideo
t('Startvideo: 10 Sekunden, 24 Bilder/s, eigene Schrift und eigene Töne', () => {
  const built = intro.renderToPPM({ width: 160, height: 90, seconds: 10, fps: 24, title: 'AURA' });
  assert.strictEqual(built.count, 240);
  const files = fs.readdirSync(built.frames_dir);
  assert.strictEqual(files.length, 240);
  assert.ok(fs.statSync(path.join(built.frames_dir, files[0])).size > 1000, 'Bild ist leer');
  assert.strictEqual(intro.status().components.length, 4);
  const f = intro.frame(160, 90, 5, 10, { title: 'AURA', subtitle: 'SYSTEM STARTET', palette: 'aurora', level: 0.8 });
  let nichtSchwarz = 0;
  for (let i = 0; i < f.px.length; i += 3) if (f.px[i] + f.px[i + 1] + f.px[i + 2] > 90) nichtSchwarz++;
  assert.ok(nichtSchwarz > 300, 'Bild ist praktisch schwarz');
});

// ------------------------------------------------------------ Seiten-Projekte
t('Seiten-Projekte: anlegen, Prüflauf mit offenen Punkten, Deploy-Paket', () => {
  const p = projects.create({ name: 'igaming-toplists', stack: 'node', domain: 'example.invalid', dir: '/tmp/gibtsnicht', start_cmd: 'node server.js', port: 4999, checklist: { https: true, backup: true } });
  assert.ok(p.ok, JSON.stringify(p));
  assert.strictEqual(projects.get(p.project.id).readiness.missing.length, 6);
  const v = projects.verify(p.project.id);
  assert.ok(v.checks.length >= 3);
  assert.match(v.note, /nicht automatisch/);
  const pack = projects.deploymentPack(p.project.id);
  assert.ok(pack.commands.length >= 5);
  assert.match(pack.nginx_block, /server_name/);
  assert.match(pack.rule, /Mensch/);
});

t('Seiten-Projekte: Seiten aus dem Web-Empire werden zu Projekten, Fehlendes bleibt offen', () => {
  const empire = require('../backend/src/lib/web_empire');
  empire.registerSite({ id: 'test-seite', domain: 'test-seite.example', niche: 'AI_TECH', affiliate_status: 'OWN', consent_status: 'OK' });
  const r = projects.importEmpire({ owner: 'Auraos' });
  assert.ok(r.ok, JSON.stringify(r).slice(0, 160));
  assert.ok(r.found >= 1);
  const l = projects.list();
  assert.ok(l.items.length >= 1);
  assert.ok(l.items.some((i) => i.readiness < 100), 'fertige Projekte ohne TLS/Sicherung wären gelogen');
});

// ------------------------------------------------------------ Hermes im Prozess
t('Hermes im Prozess: zwölf Abläufe, jede Stufe nennt Rolle und Menschenschwelle', () => {
  const p = flow.processes();
  assert.strictEqual(p.count, 12);
  const st = flow.status();
  assert.strictEqual(st.steps, 51);
  assert.strictEqual(st.human_gates, 11);
  assert.ok(st.rules.length >= 4);
});

t('Hermes im Prozess: ohne Mensch hält der Ablauf an, ohne Fähigkeit schweigt Hermes', () => {
  const r = flow.run({ process: 'video' });
  assert.strictEqual(r.trace.done, false);
  assert.strictEqual(r.trace.stopped_at.needs, 'human');
  assert.strictEqual(r.hermes_steps, 0);
  assert.match(r.trace.steps.find((s) => s.hermes && s.hermes.reason).hermes.reason, /nicht vergeben|nur zu/);
});

t('Hermes im Prozess: verliehene Fähigkeit wirkt mit, Entzug wirkt sofort', () => {
  assert.strictEqual(hermes.grantSkill({ skill: 'read_status' }).ok, false, 'ohne Mensch darf nichts verliehen werden');
  assert.strictEqual(hermes.grantSkill({ skill: 'read_status', human: true, by: 'Auraos', days: 2 }).ok, true);
  const r = flow.run({ process: 'geraet', human: true });
  assert.strictEqual(r.trace.done, true);
  assert.ok(r.hermes_steps >= 1, 'Hermes blieb ohne Wirkung');
  assert.strictEqual(flow.trace({ id: r.trace.id }).trace.id, r.trace.id);
  hermes.revokeSkill({ skill: 'read_status', human: true, by: 'Auraos' });
  assert.strictEqual(flow.run({ process: 'geraet', human: true }).hermes_steps, 0);
});

// ------------------------------------------------------------ Zahlungen
t('Zahlungen: 19 Wege, sechs Zwecke, ohne Schlüssel bleibt es beim lokalen Führen', () => {
  const st = pay.status();
  assert.strictEqual(st.providers, 19);
  assert.strictEqual(st.ready, 0);
  assert.match(st.mode, /LOKAL GEFÜHRT|verbunden/);
  assert.strictEqual(pay.actions.purposes().purposes.length, 6);
});

t('Zahlungen: Empfehlung nennt Punktzahl und Gründe, Zahlung braucht Schlüssel und Mensch', () => {
  const c = pay.choose({ purpose: 'abo' });
  assert.ok(c.ok, JSON.stringify(c));
  assert.ok(c.shortlist.length >= 3);
  assert.ok(typeof c.recommendation.score === 'number');
  assert.ok(c.recommendation.reasons.length >= 2, 'Empfehlung ohne Begründung');
  const co = pay.checkout({ provider: 'stripe', amount: 29.99, purpose: 'Monatsabo' });
  assert.strictEqual(co.ok, false);
  assert.strictEqual(co.charged, false);
  assert.strictEqual(co.blocked_by.length, 2);
  assert.ok(co.fee_estimate.fee > 0);
  const sepa = pay.checkout({ provider: 'sepa', amount: 29.99, human: true });
  assert.strictEqual(sepa.ok, true);
  assert.strictEqual(sepa.charged, false, 'diese Datei darf nie abbuchen');
  assert.strictEqual(pay.actions.checkouts().count, 2);
});

console.log(`\nround4_suite: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
