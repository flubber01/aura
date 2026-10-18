'use strict';
// Prüft Agent-zu-Agent-Rufe, die Gehirn-Konsole und die Freigabe-Tür des Menschen.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-aha-'));
process.env.AURA_AGENT_CALLS_FILE = path.join(tmp, 'agent_calls.json');
process.env.AURA_CONSOLE_FILE = path.join(tmp, 'brain_console.json');
process.env.AURA_HUMAN_FINAL_FILE = path.join(tmp, 'human_final.json');

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const ac = require('../backend/src/lib/agent_calls');
const bc = require('../backend/src/lib/brain_console');
const hf = require('../backend/src/lib/human_final');

(async () => {
  // ------------------------------------------------------------ Agenten-Rufe
  await t('Katalog: Agenten und ihre Fähigkeiten kommen aus den Modulen, nicht aus einer Liste', () => {
    const c = ac.catalog();
    assert.ok(c.length > 100, 'zu wenige Agenten: ' + c.length);
    const hb = c.find((m) => m.id === 'handbooks');
    assert.ok(hb && hb.actions.includes('module'), 'handbooks fehlt oder ohne Fähigkeiten');
    for (const m of c.slice(0, 20)) assert.ok(m.actions.length > 0, m.id + ' ohne Fähigkeiten');
  });

  await t('Ruf: unbekannter Agent und unbekannte Fähigkeit werden abgelehnt', async () => {
    const a = await ac.call({ from: 'brain', to: 'gibtsnicht', action: 'status' });
    assert.strictEqual(a.ok, false);
    assert.match(a.error, /nicht im Katalog/);
    const b = await ac.call({ from: 'brain', to: 'handbooks', action: 'zaubern' });
    assert.strictEqual(b.ok, false);
    assert.match(b.error, /kann "zaubern" nicht/);
  });

  await t('Ruf: echter Aufruf liefert das Ergebnis des gerufenen Agenten', async () => {
    const r = await ac.call({ from: 'brain', to: 'handbooks', action: 'status' });
    assert.ok(r.ok, JSON.stringify(r));
    assert.strictEqual(r.call.to, 'handbooks');
    assert.ok(r.call.ok, 'Ergebnis nicht ok');
    assert.ok(r.call.ms >= 0);
    assert.ok(r.result.modules > 100, 'Ergebnis leer');
  });

  await t('Sperrliste: nach außen wirkende und geldkostende Fähigkeiten sind für Agenten gesperrt', async () => {
    const money = await ac.call({ from: 'brain', to: 'human_final', action: 'decide' });
    assert.strictEqual(money.ok, false, 'ein Agent darf die Freigabe-Tür nicht aufrufen');
    assert.strictEqual(money.needs, 'human');
    const publish = await ac.call({ from: 'brain', to: 'web_empire', action: 'status' });
    assert.ok(publish.ok, 'harmloser Aufruf muss weiterhin gehen');
    assert.ok(ac.BLOCKED_AGENTS.includes('human_final'));
    assert.ok(ac.BLOCKED_ACTIONS.includes('release'));
    const rel = ac.canCall('release_gate', 'release');
    assert.strictEqual(rel.ok, false);
    assert.ok(ac.HUMAN_ONLY.length >= 10);
  });

  await t('Schutz: kein Selbstaufruf, keine Zyklen, Tiefe begrenzt', async () => {
    assert.match((await ac.call({ from: 'brain', to: 'brain', action: 'status' })).error, /nicht selbst/);
    const cycle = await ac.call({ from: 'a', to: 'b', action: 'status', chain: ['a', 'b'] });
    assert.strictEqual(cycle.ok, false);
    assert.match(cycle.error, /Zyklus|schon dran/);
    const deep = await ac.call({ from: 'a', to: 'handbooks', action: 'status', depth: ac.MAX_DEPTH + 1 });
    assert.strictEqual(deep.ok, false);
    assert.strictEqual(deep.stopped, 'depth');
  });

  await t('Ruf: Fehler des gerufenen Agenten wird protokolliert, nicht verschluckt', async () => {
    const r = await ac.call({ from: 'brain', to: 'handbooks', action: 'module', payload: { id: 'gibtsnicht' } });
    assert.ok(r.ok, 'der Ruf selbst lief');
    assert.strictEqual(r.ok, true, 'der Ruf selbst lief durch');
    assert.strictEqual(r.call.ok, false, 'Fehler muss als nicht-ok im Protokoll stehen');
    assert.ok(/ok=false/.test(r.call.result_summary), 'Kurzfassung zeigt den Fehler nicht: ' + r.call.result_summary);
  });

  await t('Kette: läuft der Reihe nach und hält bei einem Fehler an', async () => {
    const gut = await ac.chain({ from: 'mensch', steps: [{ to: 'handbooks', action: 'status' }, { to: 'royalty_free', action: 'status' }] });
    assert.ok(gut.ok, JSON.stringify(gut).slice(0, 200));
    assert.strictEqual(gut.steps, 2);
    const kaputt = await ac.chain({ from: 'mensch', steps: [{ to: 'handbooks', action: 'status' }, { to: 'gibtsnicht', action: 'x' }] });
    assert.strictEqual(kaputt.ok, false);
    assert.strictEqual(kaputt.stopped_at, 'gibtsnicht');
    assert.strictEqual((await ac.chain({ from: 'mensch', steps: [] })).ok, false);
  });

  await t('Protokoll: jeder Ruf ist nachvollziehbar (wer, wen, womit, wie lange)', () => {
    const tr = ac.trace(10);
    assert.ok(tr.count >= 5);
    for (const c of tr.calls) { assert.ok(c.from && c.to && c.action); assert.ok(Array.isArray(c.chain) && c.chain.length >= 1); assert.strictEqual(typeof c.ms, 'number'); }
  });

  // ------------------------------------------------------------ Gehirn-Konsole
  await t('Konsole: Köpfe werden geladen und ihre Erreichbarkeit ehrlich gemeldet', () => {
    const d = bc.directory();
    assert.ok(d.count >= 15, 'zu wenige Köpfe: ' + d.count);
    for (const h of d.heads) assert.ok(['live', 'nicht ladbar'].includes(h.state), h.id + ' unbekannter Zustand: ' + h.state);
    assert.ok(d.heads.filter((h) => h.reachable).length >= 10, 'zu wenige erreichbare Köpfe');
  });

  await t('Konsole: Stichwort findet den zuständigen Kopf', () => {
    assert.strictEqual(bc.headFor('wie ist der zustand der module').head.id, 'brain');
    assert.strictEqual(bc.headFor('welcher ton-effekt für gesang').head.id, 'studio');
    assert.strictEqual(bc.headFor('welche lizenzen sind frei').head.id, 'ressourcen');
    assert.strictEqual(bc.headFor('wann muss der release fertig sein').head.id, 'campaign');
    assert.strictEqual(bc.headFor('gibts ein problem bei den diensten').head.id, 'watchdog');
  });

  await t('Konsole: Antwort kommt aus dem Modul des Kopfes, nicht erfunden', () => {
    const r = bc.reply(null, 'welche ton effekte gibt es');
    assert.strictEqual(r.answered_by, 'studio');
    assert.ok(r.facts && r.facts.builtin >= 14, 'Fakten fehlen: ' + JSON.stringify(r.facts).slice(0, 120));
    assert.ok(/Tonstudio/.test(r.answer));
  });

  await t('Konsole: keine Zuständigkeit → ehrliche Absage mit Vorschlägen', () => {
    const r = bc.reply(null, 'blafasel xyz');
    assert.strictEqual(r.answered_by, null);
    assert.ok(/Kein Kopf/.test(r.answer));
    assert.ok(r.suggest.length >= 15);
  });

  await t('Konsole: Sitzung führt Buch über die Gespräche des Menschen', () => {
    const s = bc.openSession({ who: 'Auraos' });
    assert.ok(s.ok);
    const a1 = bc.say({ session: s.session.id, text: 'wie viele quellen mit freier lizenz haben wir', who: 'Auraos' });
    assert.ok(a1.ok, JSON.stringify(a1).slice(0, 150));
    assert.strictEqual(a1.turn.head, 'ressourcen');
    const a2 = bc.say({ session: s.session.id, text: 'wie ist der zustand' });
    assert.strictEqual(a2.turn.head, 'brain');
    const tr = bc.transcript(s.session.id);
    assert.strictEqual(tr.count, 2);
    assert.ok(tr.turns.every((x) => x.who && x.answer));
    assert.strictEqual(bc.transcript('gibtsnicht').ok, false);
    assert.strictEqual(bc.say({ text: '' }).ok, false);
  });

  await t('Konsole: Rundfrage holt Antwort von allen Köpfen', () => {
    const r = bc.askAll('wie ist der zustand');
    assert.ok(r.ok);
    assert.ok(r.answers.length >= 10, 'zu wenige Antworten: ' + r.answers.length);
    assert.strictEqual(bc.askAll('').ok, false);
  });

  await t('Konsole: Regel „nur Vorschlag" steht im Status', () => {
    const st = bc.status();
    assert.ok(/letzte Wort/.test(st.rule));
    assert.ok(st.reachable >= 10);
  });

  // ------------------------------------------------------------ Letztes Wort
  await t('Letztes Wort: Veröffentlichen, Geld und KI-Anbieter brauchen immer einen Menschen', () => {
    for (const k of ['PUBLISH', 'SPEND', 'AI_PROVIDER', 'DISTRIBUTE', 'SECURITY_EJECT']) assert.strictEqual(hf.needsHuman(k), true, k + ' sollte Menschenpflicht haben');
    assert.strictEqual(hf.needsHuman('STATUS'), false);
    assert.ok(hf.REQUIRES_HUMAN.length >= 8);
  });

  await t('Letztes Wort: ohne Menschen keine Entscheidung — auch nicht mit guten Absichten', () => {
    const p = hf.propose({ kind: 'PUBLISH', what: 'Song „Creedstreet" veröffentlichen', by: 'AURA' });
    assert.ok(p.ok, JSON.stringify(p));
    assert.strictEqual(p.entry.status, 'PROPOSED');
    const ohneMensch = hf.decide(p.entry.id, { decision: 'APPROVED' });
    assert.strictEqual(ohneMensch.ok, false);
    assert.strictEqual(ohneMensch.needs, 'human');
    const ohneName = hf.decide(p.entry.id, { decision: 'APPROVED', human: true });
    assert.strictEqual(ohneName.ok, false);
    assert.strictEqual(ohneName.needs, 'name');
    const falsch = hf.decide(p.entry.id, { decision: 'VIELLEICHT', human: true, by: 'Auraos' });
    assert.strictEqual(falsch.ok, false);
  });

  await t('Letztes Wort: Tür bleibt zu, bis ein Mensch freigibt — danach offen', () => {
    const zu = hf.guard({ kind: 'PUBLISH' });
    assert.strictEqual(zu.ok, false);
    assert.strictEqual(zu.gate, 'zu');
    assert.ok(/keine menschliche Freigabe/.test(zu.error));
    const p = hf.propose({ kind: 'PUBLISH', what: 'Release am 5.12.' });
    hf.decide(p.entry.id, { decision: 'APPROVED', human: true, by: 'Auraos', reason: 'Freigegeben' });
    const offen = hf.guard({ kind: 'PUBLISH', id: p.entry.id });
    assert.ok(offen.ok, JSON.stringify(offen));
    assert.strictEqual(offen.entry.decided_by, 'Auraos');
  });

  await t('Letztes Wort: Ablehnung bleibt Ablehnung, zweite Entscheidung nur bewusst', () => {
    const p = hf.propose({ kind: 'DELETE', what: 'alte Testdaten löschen' });
    const no = hf.decide(p.entry.id, { decision: 'REJECTED', human: true, by: 'Auraos' });
    assert.ok(no.ok);
    assert.strictEqual(no.entry.status, 'REJECTED');
    const nochmal = hf.decide(p.entry.id, { decision: 'APPROVED', human: true, by: 'Auraos' });
    assert.strictEqual(nochmal.ok, false, 'zweite Entscheidung ohne override nicht erlaubt');
    const override = hf.decide(p.entry.id, { decision: 'APPROVED', human: true, by: 'Auraos', override: true });
    assert.ok(override.ok);
    assert.strictEqual(hf.guard({ kind: 'DELETE', id: p.entry.id }).ok, true);
  });

  await t('Letztes Wort: Liste der offenen Vorschläge und Prüfpfad', () => {
    const o = hf.open();
    assert.ok(o.count >= 1);
    assert.ok(o.pending.every((x) => x.status === undefined));
    const st = hf.status();
    assert.ok(st.by_status.APPROVED >= 1);
    assert.ok(st.audit_entries >= 3);
    assert.ok(/Prüfung/.test(st.rule));
    const l = hf.ledger({ status: 'APPROVED' });
    assert.ok(l.count >= 1);
    assert.strictEqual(hf.propose({ kind: 'PUBLISH' }).ok, false);
  });

  console.log(`\nagents_human: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
