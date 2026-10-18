'use strict';
// Prüft die Sicherheits-Antwort (Reihenfolge detect → isolieren → prüfen → ausschließen),
// den Selbst-Anruf und das Plug-in-System.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-sec-'));
process.env.AURA_SECURITY_FILE = path.join(tmp, 'security_response.json');
process.env.AURA_SELF_CALL_FILE = path.join(tmp, 'self_call.json');
process.env.AURA_PLUGINS_FILE = path.join(tmp, 'plugins.json');
process.env.AURA_HUMAN_FINAL_FILE = path.join(tmp, 'human_final.json');
process.env.AURA_ARTISTS_FILE = path.join(tmp, 'artists.json');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const sec = require('../backend/src/lib/security_response');
const sc = require('../backend/src/lib/self_call');
const plg = require('../backend/src/lib/plugins');
const hf = require('../backend/src/lib/human_final');

// ------------------------------------------------------------ Reihenfolge
t('Sicherheit: die Reihenfolge ist im Status festgeschrieben', () => {
  const st = sec.status();
  assert.deepStrictEqual(st.stages, ['DETECT', 'ISOLATE', 'REVIEW', 'EJECT']);
  assert.ok(/Ausschluss ist immer der letzte Schritt/.test(st.order));
  assert.ok(st.honesty.some((h) => /umkehrbar/.test(h)));
});

t('Sicherheit: einzelner Beleg sperrt NICHTS', () => {
  const r = sec.report({ subject: 'konto-a', signal: 'failed_logins' });
  assert.ok(r.ok);
  assert.strictEqual(r.escalated, false);
  assert.strictEqual(r.stage, 'DETECT');
  assert.ok(/nichts gesperrt/.test(r.note));
  assert.strictEqual(sec.cases({}).count, 0);
});

t('Sicherheit: unbekanntes Signal wird abgelehnt statt geraten', () => {
  const r = sec.report({ subject: 'konto-a', signal: 'gefuehl' });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /unbekanntes Signal/);
  assert.strictEqual(sec.report({}).ok, false);
});

t('Sicherheit: Schwelle + Punktzahl ergeben einen Fall — weiterhin ohne Sperre', () => {
  for (let i = 0; i < 6; i++) sec.report({ subject: 'konto-b', signal: 'failed_logins' });
  sec.report({ subject: 'konto-b', signal: 'wrong_scope' });
  const r = sec.report({ subject: 'konto-b', signal: 'secret_probe' });
  assert.ok(r.escalated, 'Fall hätte angelegt werden müssen: ' + JSON.stringify(r));
  assert.strictEqual(r.stage, 'DETECT');
  assert.ok(/NICHTS gesperrt/.test(r.note));
  const c = sec.cases({}).cases[0];
  assert.ok(c.evidence_count >= 1);
});

t('Sicherheit: Punktzahl wächst mit Belegen und bleibt bei 100 gedeckelt', () => {
  for (let i = 0; i < 50; i++) sec.report({ subject: 'konto-c', signal: 'rapid_fire' });
  const s = sec.scoreOf('konto-c');
  assert.ok(s.total <= 100);
  assert.ok(s.parts.length >= 1);
});

t('Sicherheit: Isolation ist umkehrbar und beendet Sitzungen', () => {
  const id = sec.cases({}).cases.find((c) => c.subject === 'konto-b').id;
  const iso = sec.isolate(id, { by: 'AURA-Sicherheit' });
  assert.ok(iso.ok, JSON.stringify(iso));
  assert.strictEqual(iso.case.stage, 'ISOLATE');
  assert.ok(iso.reversible);
  const back = sec.undo(id, { by: 'Auraos' });
  assert.ok(back.ok);
  assert.strictEqual(back.case.stage, 'DETECT');
});

t('Sicherheit: Ausschluss geht NICHT ohne Prüfung und NICHT ohne Menschen', () => {
  const id = sec.cases({}).cases.find((c) => c.subject === 'konto-b').id;
  const zuFrueh = sec.eject(id, { by: 'AURA' });
  assert.strictEqual(zuFrueh.ok, false);
  assert.match(zuFrueh.error, /Erst prüfen/);
  sec.review(id);
  const ohneMensch = sec.eject(id, { by: 'AURA' });
  assert.strictEqual(ohneMensch.ok, false);
  assert.strictEqual(ohneMensch.needs, 'human');
  assert.ok(ohneMensch.proposal, 'ohne Vorschlag kann kein Mensch entscheiden');
  assert.strictEqual(ohneMensch.proposal.status, 'PROPOSED');
});

t('Sicherheit: mit menschlicher Freigabe wird ausgeschlossen — Beleg bleibt', () => {
  const id = sec.cases({}).cases.find((c) => c.subject === 'konto-b').id;
  const prop = hf.open().pending.find((p) => p.kind === 'SECURITY_EJECT');
  hf.decide(prop.id, { decision: 'APPROVED', human: true, by: 'Auraos', reason: 'Belege eindeutig' });
  const out = sec.eject(id, { by: 'Auraos' });
  assert.ok(out.ok, JSON.stringify(out));
  assert.strictEqual(out.case.stage, 'EJECT');
  assert.strictEqual(out.case.closed, true);
  assert.ok(out.case.decision.by === 'Auraos');
  assert.strictEqual(sec.undo(id).ok, false, 'Ausschluss darf nicht einfach zurückgenommen werden');
});

t('Sicherheit: Sammelprüfung sammelt nur Belege', () => {
  const s = sec.sweep();
  assert.ok(s.ok);
  assert.strictEqual(typeof s.found, 'number');
  assert.ok(/Nur Belege/.test(s.note));
});

// ------------------------------------------------------------ Selbst-Anruf
t('Selbst-Anruf: ohne Anbieter gibt es KEINEN Anruf, ehrlich benannt', () => {
  const ps = sc.providerState();
  assert.ok(ps.providers.length >= 4);
  assert.strictEqual(ps.call_ready, false);
  assert.ok(/NUR MELDUNG|ANRUF MÖGLICH/.test(ps.mode));
  assert.ok(/KEIN Anruf/.test(ps.honesty));
});

t('Selbst-Anruf: Alarm läuft die Leiter ab und sagt, was passiert ist', () => {
  const r = sc.alert({ trigger: 'attack_confirmed', reason: 'Fall konto-b: bestätigter Angriff' });
  assert.ok(r.ok, JSON.stringify(r));
  const l = r.escalation.ladder;
  assert.strictEqual(l[0].what, 'Protokoll');
  assert.ok(l[0].ok, 'Protokoll muss immer klappen');
  const call = l.find((x) => x.what === 'Anruf');
  assert.ok(call, 'Anruf-Sprosse fehlt');
  assert.ok(call.skipped || call.pending);
  if (call.skipped) assert.ok(/Kein Anruf-Anbieter|nicht erlaubt/.test(call.detail), 'Grund fehlt: ' + call.detail);
  assert.ok(l.some((x) => x.what === 'Handanruf'));
});

t('Selbst-Anruf: mittlere Auslöser rufen nicht an, unbekannte werden abgelehnt', () => {
  const r = sc.alert({ trigger: 'human_needed' });
  const call = r.escalation.ladder.find((x) => x.what === 'Anruf');
  assert.ok(call.skipped && /ruft nicht an/.test(call.detail));
  assert.strictEqual(sc.alert({ trigger: 'panik' }).ok, false);
});

t('Selbst-Anruf: Bestätigung und Wiederholung mit Obergrenze (kein Dauerfeuer)', () => {
  const r = sc.alert({ trigger: 'watchdog_down' });
  const ack = sc.ack(r.escalation.id, { by: 'Auraos' });
  assert.ok(ack.ok);
  assert.strictEqual(ack.escalation.state, 'BESTAETIGT');
  const r2 = sc.alert({ trigger: 'watchdog_down' });
  let last = null;
  for (let i = 0; i < 4; i++) last = sc.retry(r2.escalation.id, { max: 3 });
  assert.strictEqual(last.ok, false);
  assert.ok(/Obergrenze/.test(last.error));
  assert.strictEqual(sc.ack('gibtsnicht').ok, false);
});

t('Selbst-Anruf: Nummern erscheinen nur maskiert', () => {
  const r = sc.alert({ trigger: 'attack_confirmed', allow_call: true, number: '017612345678' });
  assert.ok(!JSON.stringify(r).includes('017612345678'), 'Nummer steht im Klartext in der Ausgabe!');
  assert.strictEqual(sc.mask('017612345678'), '••••5678');
  assert.strictEqual(sc.mask('12'), '••••');
  const call = r.escalation.ladder.find((x) => x.what === 'Anruf');
  // Ohne verbundenen Anbieter bleibt der Anruf aus — genau das muss dort stehen.
  assert.ok(call.skipped && /Kein Anruf-Anbieter/.test(call.detail), 'Grund fehlt: ' + call.detail);
  assert.ok(/Schlüssel/.test(call.install || '') || /Vault/.test(call.install || ''), 'Installationshinweis fehlt');
});

// ------------------------------------------------------------ Plug-ins
const GOOD = { id: 'eq-plus', name: 'EQ Plus', kind: 'TONSTUDIO', version: '1.0.0', what: 'Zusätzlicher Entzerrer', rights: ['audio', 'lesen'], hooks: ['daw_plugins'] };

t('Plug-ins: Manifest wird geprüft, Prüfsumme wird berechnet', () => {
  const v = plg.validate(GOOD);
  assert.ok(v.ok, JSON.stringify(v.problems));
  assert.ok(v.checksum.length === 16);
  const bad = plg.validate({ id: 'X', name: '', kind: 'QUATSCH', rights: ['zauber'] });
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.problems.length >= 3, 'Probleme nicht benannt: ' + bad.problems.join(' | '));
});

t('Plug-ins: heikle Rechte machen die Installation menschlich — und ohne Mensch passiert nichts', () => {
  const p = plg.propose({ ...GOOD, id: 'netz-tool', name: 'Netz-Werkzeug', rights: ['netz', 'lesen'] });
  assert.ok(p.ok);
  assert.strictEqual(p.plugin.human_required, true);
  const ohne = plg.install('netz-tool', {});
  assert.strictEqual(ohne.ok, false);
  assert.strictEqual(ohne.needs, 'human');
  const ohneName = plg.install('netz-tool', { human: true });
  assert.strictEqual(ohneName.ok, false);
  assert.strictEqual(ohneName.needs, 'name');
  const mit = plg.install('netz-tool', { human: true, by: 'Auraos' });
  assert.ok(mit.ok, JSON.stringify(mit));
});

t('Plug-ins: nachträgliche Änderung an der Beschreibung fällt auf', () => {
  plg.propose({ ...GOOD, id: 'dreht-sich', rights: ['lesen'] });
  plg.install('dreht-sich', { human: true, by: 'Auraos' });
  assert.strictEqual(plg.install('dreht-sich', { human: true, by: 'Auraos' }).ok, true, 'vorher noch gültig');
  // Prüfsumme im Datensatz manipulieren, wie es ein Angreifer täte
  const f = process.env.AURA_PLUGINS_FILE;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  d.plugins.find((p) => p.id === 'dreht-sich').checksum = '0000000000000000';
  fs.writeFileSync(f, JSON.stringify(d));
  const out = plg.install('dreht-sich', { human: true, by: 'Auraos' });
  assert.strictEqual(out.ok, false);
  assert.match(out.error, /Prüfsumme/);
});

t('Plug-ins: aktivieren ist bei heiklen Rechten menschlich, abschalten nie blockiert', () => {
  assert.strictEqual(plg.toggle('netz-tool', true, {}).ok, false);
  assert.ok(plg.toggle('netz-tool', true, { human: true, by: 'Auraos' }).ok);
  assert.ok(plg.toggle('netz-tool', false, {}).ok, 'Abschalten muss immer gehen');
  assert.strictEqual(plg.toggle('gibtsnicht', true, {}).ok, false);
  assert.strictEqual(plg.install('nicht-vorgeschlagen', { human: true, by: 'x' }).ok, false);
});

t('Plug-ins: Register zeigt, welche Rechte aktiv im Umlauf sind', () => {
  plg.toggle('netz-tool', true, { human: true, by: 'Auraos' });
  const r = plg.register();
  assert.ok(r.active.some((p) => p.id === 'netz-tool'));
  assert.ok(r.sensitive_active.includes('netz-tool'));
  assert.strictEqual(r.by_right.netz >= 1, true);
  assert.ok(/Was hier nicht steht, läuft nicht/.test(r.rule));
});

t('Plug-ins: Entfernen verlangt einen Menschen, Liste filtert nach Art', () => {
  assert.strictEqual(plg.remove('netz-tool', {}).ok, false);
  assert.ok(plg.remove('netz-tool', { human: true, by: 'Auraos' }).ok);
  const l = plg.list({ kind: 'TONSTUDIO' });
  assert.ok(l.items.every((p) => p.kind === 'TONSTUDIO'));
  const st = plg.status();
  assert.ok(st.rules.some((x) => /Kein Download/.test(x)));
});

console.log(`\nsecurity_plugins: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
