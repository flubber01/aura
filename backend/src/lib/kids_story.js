'use strict';
// AURA Area 08 — Kids Story Pipeline (voll ausgebaut, vorher placeholder).
// Local, deterministic story engine with a child-safety filter. Honest:
// no external LLM is connected — stories come from composable templates and
// are labeled AUTO-DRAFT; a human reviews before any use. Content Forge
// (Area 73) reuses safetyCheck() for all story-type generations.
const crypto = require('crypto');

// hard blocklist: anything matching refuses generation (child protection)
const BLOCK = /(gewalt|blut|waffe|krieg|sex|nackt|droge|alkohol|zigarette|messie|angst einjagen|horror|töten|schlag)/i;
const HEROES = ['der kleine Roboter BLIP', 'die mutige Eule Luna', 'der neugierige Fuchs Finn', 'das freundliche Wolkenmädchen Nia', 'der schlaue Käfer Konrad'];
const PLACES = ['im Leuchtwald', 'in der Sternenwerkstatt', 'auf der Regenbogeninsel', 'im Bücherbaumhaus', 'auf dem Mondspielplatz'];
const LESSONS = [' Ehrlichkeit macht stark.', ' Zusammen schaffen wir mehr.', ' Geduld führt zum Ziel.', ' Mut heißt helfen, nicht prahlen.', ' Neugier ist gut — Fragen ist besser.'];
const BEATS = [
  'Eines Morgens entdeckte {hero} etwas Seltsames {place}: ein leuchtender Pfad aus Fragen.',
  '{hero} traf unterwegs drei Freunde, und jeder kannte ein anderes Stück der Lösung.',
  'Gemeinsam probierten sie Ideen aus, hörten einander zu und reparierten, was kaputt war.',
  'Am Ende strahlte {place} heller als zuvor, und alle wussten warum.',
];

function safetyCheck(text) {
  const m = String(text || '').match(BLOCK);
  return m ? { ok: false, reason: 'blockierter Begriff: "' + m[0] + '" (Kinderschutz-Filter)' } : { ok: true };
}

function generate(input = {}) {
  const theme = String(input.theme || 'Freundschaft').trim().slice(0, 120);
  const age = Math.max(3, Math.min(10, Number(input.age) || 5));
  const check = safetyCheck(theme + ' ' + (input.brief || ''));
  if (!check.ok) { const e = new Error('Kinderschutz-Filter: ' + check.reason); e.code = 400; throw e; }
  const seed = crypto.createHash('sha256').update(theme + Date.now()).digest();
  const hero = HEROES[seed[0] % HEROES.length];
  const place = PLACES[seed[1] % PLACES.length];
  const lesson = LESSONS[seed[2] % LESSONS.length];
  const paragraphs = BEATS.map((b) => b.replace(/{hero}/g, hero).replace(/{place}/g, place));
  return {
    id: 'story-' + seed.toString('hex').slice(0, 8),
    theme, age_band: age <= 5 ? '3-5' : age <= 7 ? '6-7' : '8-10',
    hero, place, title: hero + ' und das Geheimnis von ' + theme,
    story: paragraphs.join('\n\n') + '\n\nWas wir lernen:' + lesson,
    safety: { checked: true, filter: 'area-08 blocklist', passed: true },
    labels: ['AUTO-DRAFT', 'LOCAL-TEMPLATE-ENGINE', 'HUMAN-REVIEW-REQUIRED'],
    note: 'ehrlich: lokale Vorlagen-Engine ohne externes LLM — vor Veröffentlichung menschlich prüfen',
  };
}

function status() {
  return { area: '08', mode: 'LIVE', engine: 'local-template (kein externes LLM)', filter: 'blocklist aktiv', used_by: ['Area 73 Content Forge (type=story)'] };
}

module.exports = {
  meta: { area: '08', id: 'kids_story', name: 'Kids Story Pipeline (safety-filtered local engine)', state: 'live' },
  actions: { story: (p) => generate(p || {}), status: () => status(), safety_check: (p) => safetyCheck((p || {}).text) },
  generate, safetyCheck, status,
};
