'use strict';
// Prüft die Hermes-Fähigkeitsschicht: einzeln vergeben, befristet, entziehbar, Nie-Liste bleibt.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-hs-'));
process.env.AURA_HERMES_SKILLS_FILE = path.join(tmp, 'hermes_skills.json');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  ok  ' + name); pass++; } catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; } };

const h = require('../backend/src/lib/hermes_bridge');

t('Hermes: der alte Vertrag bleibt bestehen (Manifest + Preflight)', () => {
  const m = h.status();
  assert.strictEqual(m.mode, 'NOT_INSTALLED_NOT_CONNECTED');
  assert.ok(m.manifest_sha256 && m.manifest_sha256.length === 64);
  assert.ok(m.never_granted.length >= 5);
  assert.strictEqual(h.preflight().mode, 'BLOCKED_PENDING_OWNER_APPROVAL');
});

t('Hermes: jede Fähigkeit startet AUS', () => {
  const c = h.skills();
  assert.strictEqual(c.total, 5);
  assert.strictEqual(c.granted, 0);
  assert.ok(c.skills.every((s) => s.granted === false));
  assert.ok(c.skills.every((s) => s.human_required === true));
  assert.ok(/ALLES AUS/.test(h.skillStatus().mode));
});

t('Hermes: ohne Verleihung sagt die Tür NEIN — mit Begründung', () => {
  const r = h.useSkill({ skill: 'read_public_docs' });
  assert.strictEqual(r.allowed, false);
  assert.match(r.error, /nicht vergeben/);
  assert.strictEqual(r.needs, 'human');
  assert.strictEqual(h.useSkill({ skill: 'zauberei' }).allowed, false);
});

t('Hermes: vergeben nur mit Mensch und Namen', () => {
  assert.strictEqual(h.grantSkill({ skill: 'read_public_docs' }).ok, false);
  assert.strictEqual(h.grantSkill({ skill: 'read_public_docs', human: true }).needs, 'name');
  assert.strictEqual(h.grantSkill({ skill: 'gibtsnicht', human: true, by: 'Auraos' }).ok, false);
});

t('Hermes: nach der Verleihung ist genau diese Fähigkeit offen — befristet', () => {
  const g = h.grantSkill({ skill: 'read_public_docs', human: true, by: 'Auraos', days: 7 });
  assert.ok(g.ok, JSON.stringify(g));
  assert.strictEqual(g.grant.by, 'Auraos');
  assert.ok(new Date(g.grant.expires_at) > new Date());
  const use = h.useSkill({ skill: 'read_public_docs' });
  assert.strictEqual(use.allowed, true);
  assert.strictEqual(use.granted_by, 'Auraos');
  assert.ok(/liest|lesen/i.test(use.boundary.allows));
  assert.ok(use.boundary.denies.length > 0, 'Grenze muss auch sagen, was NICHT geht');
  // Andere Fähigkeiten bleiben zu
  assert.strictEqual(h.useSkill({ skill: 'propose_draft' }).allowed, false);
});

t('Hermes: Verleihungen laufen wirklich ab', () => {
  const f = process.env.AURA_HERMES_SKILLS_FILE;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  d.grants[0].expires_at = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(f, JSON.stringify(d));
  const r = h.useSkill({ skill: 'read_public_docs' });
  assert.strictEqual(r.allowed, false);
  assert.match(r.error, /abgelaufen/);
  const after = JSON.parse(fs.readFileSync(f, 'utf8')).grants[0];
  assert.strictEqual(after.state, 'ABGELAUFEN', 'abgelaufene Verleihung muss als abgelaufen vermerkt werden');
});

t('Hermes: Entzug wirkt sofort und nur ein Mensch darf entziehen', () => {
  h.grantSkill({ skill: 'read_status', human: true, by: 'Auraos', days: 30 });
  assert.strictEqual(h.useSkill({ skill: 'read_status' }).allowed, true);
  const ohneMensch = h.revokeSkill({ skill: 'read_status' });
  assert.strictEqual(ohneMensch.ok, false);
  assert.strictEqual(ohneMensch.needs, 'human');
  // Ohne Angabe wird nicht geraten: erst muss klar sein, welche Verleihung gemeint ist.
  const mehrdeutig = h.revokeSkill({ human: true, by: 'Auraos' });
  assert.strictEqual(mehrdeutig.ok, false);
  assert.match(mehrdeutig.error, /bitte id oder skill angeben/);
  assert.ok(mehrdeutig.active.length >= 1);
  const r = h.revokeSkill({ human: true, by: 'Auraos', skill: 'read_status', reason: 'nicht mehr nötig' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(h.useSkill({ skill: 'read_status' }).allowed, false);
});

t('Hermes: erneutes Vergeben ersetzt die alte Verleihung statt sie zu stapeln', () => {
  h.grantSkill({ skill: 'propose_draft', human: true, by: 'Auraos', days: 5 });
  h.grantSkill({ skill: 'propose_draft', human: true, by: 'Auraos', days: 10 });
  const d = JSON.parse(fs.readFileSync(process.env.AURA_HERMES_SKILLS_FILE, 'utf8'));
  const aktiv = d.grants.filter((g) => g.skill === 'propose_draft' && g.state === 'GEWAEHRT');
  assert.strictEqual(aktiv.length, 1, 'es darf nur eine gültige Verleihung geben');
});

t('Hermes: Tagesgrenze wird geklemmt, Audit ist vorhanden', () => {
  const g = h.grantSkill({ skill: 'suggest_skill', human: true, by: 'Auraos', days: 9999 });
  assert.ok(g.ok);
  assert.ok(g.grant.days <= 365, 'Tage nicht begrenzt: ' + g.grant.days);
  const st = h.skillStatus();
  assert.ok(st.audit.length >= 3);
  assert.ok(st.rules.some((r) => /Nie-Liste/.test(r)));
});

t('Hermes: die Nie-Liste bleibt gesperrt, egal was vergeben ist', () => {
  const st = h.skillStatus();
  assert.strictEqual(st.never_usable, h.NEVER_GRANTED.length);
  assert.ok(h.NEVER_GRANTED.some((n) => /root|sudo/i.test(n)));
  assert.ok(h.skills().never_usable.length >= 5);
});

t('Hermes: Fähigkeiten über die Brücken-Aktionen erreichbar (Verdrahtung)', () => {
  assert.strictEqual(typeof h.actions.status, 'function');
  assert.strictEqual(typeof h.actions.grant, 'function');
  assert.strictEqual(h.actions.skills().ok, true);
  assert.ok(h.actions.skillStatus().skills >= 5);
  assert.strictEqual(h.actions.use({ skill: 'suggest_skill' }).allowed, true);
});

console.log(`\nhermes_skills: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
