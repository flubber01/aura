'use strict';
// 39 · Algorithm matrix / A/B testing — deterministic variant assignment and
// in-memory exposure counts. No tracking beyond explicitly passed subject ids.
const counts = {};
function fnv(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; }

function assign(p) {
  const subject = String(p.subject || '');
  const experiment = String(p.experiment || '');
  if (!subject || !experiment) throw Object.assign(new Error('subject + experiment required'), { code: 400 });
  const variants = Array.isArray(p.variants) && p.variants.length >= 2 ? p.variants.map(String) : ['control', 'variant_a'];
  const variant = variants[fnv(experiment + '/' + subject) % variants.length];
  const key = experiment + ':' + variant;
  counts[key] = (counts[key] || 0) + 1;
  return { experiment, subject_hash: fnv(subject).toString(16), variant, deterministic: true };
}

module.exports = {
  meta: { area: '39', id: 'algorithm_matrix', name: 'Algorithm matrix / A/B testing', state: 'live' },
  assign,
  status: () => ({ exposures: counts, assignment: 'deterministic fnv hash' }),
  actions: { assign: (p) => assign(p), status: () => module.exports.status() },
};
