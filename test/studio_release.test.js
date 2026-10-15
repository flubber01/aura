#!/usr/bin/env node
'use strict';
// Tests für den Studio-Release-Plan (nur lesend)
const assert = require('assert');
const { releasePlan, HUMAN_STEPS } = require('../backend/src/lib/studio_release');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' — ' + e.message); }
}

t('Alle Label-Stufen vorhanden und nummeriert', () => {
  const p = releasePlan();
  assert.ok(p.stages.length >= 9);
  assert.deepStrictEqual(p.stages.map((s) => s.step), p.stages.map((_, i) => i + 1));
});

t('Freigabe- und Veröffentlichungsschritte sind Mensch-pflichtig', () => {
  const p = releasePlan();
  for (const s of p.stages) if (HUMAN_STEPS.has(s.id)) assert.strictEqual(s.human_required, true);
  assert.ok(p.stages.some((s) => s.id === 'admin_approved' && s.human_required));
});

t('Standard: alle Distributoren, alle human-only', () => {
  const p = releasePlan();
  assert.ok(p.distributors.length >= 4);
  for (const d of p.distributors) assert.strictEqual(d.publish, 'human-only');
});

t('Auswahl per channelIds filtert Distributoren', () => {
  const p = releasePlan({ channelIds: ['distro-distrokid'] });
  assert.deepStrictEqual(p.distributors.map((d) => d.id), ['distro-distrokid']);
});

t('Unbekannte Kanäle werden gemeldet, nicht still ignoriert', () => {
  const p = releasePlan({ channelIds: ['distro-gibtsnicht'] });
  assert.deepStrictEqual(p.unknown_channels, ['distro-gibtsnicht']);
  assert.strictEqual(p.distributors.length, 0);
});

t('Plan ist ausdrücklich nur lesend', () => {
  assert.strictEqual(releasePlan().read_only, true);
});

console.log(`studio_release: ${pass} PASS / ${fail} FAIL`);
process.exitCode = fail ? 1 : 0;
