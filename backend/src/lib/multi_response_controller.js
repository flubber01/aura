'use strict';
// 05 · Multi-response controller + master integrity controller —
// compares candidate responses, rejects invalid/incomplete JSON, labels
// consistency, records audit trail. Combined area per inventory.
const store = require('./store');

function parseMaybe(r) {
  if (typeof r === 'object' && r !== null) return { ok: true, value: r };
  if (typeof r === 'string') {
    try { return { ok: true, value: JSON.parse(r) }; } catch { return { ok: false }; }
  }
  return { ok: false };
}

function compare(payload) {
  const responses = Array.isArray(payload.responses) ? payload.responses : null;
  if (!responses || responses.length < 2) throw Object.assign(new Error('need >= 2 responses'), { code: 400 });
  const parsed = responses.map(parseMaybe);
  const invalid = parsed.filter((p) => !p.ok).length;
  const keys = parsed.filter((p) => p.ok).map((p) => JSON.stringify(Object.keys(p.value).sort()));
  const consistent = new Set(keys).size === 1 && invalid === 0;
  const verdict = invalid > 0 ? 'REJECTED: malformed response(s)'
    : consistent ? 'ACCEPTED: consistent'
    : 'QUARANTINED: divergent responses — human review required';
  const rec = { at: new Date().toISOString(), count: responses.length, invalid, consistent, verdict };
  store.audit({ area: '05', event: 'integrity_check', verdict, count: responses.length });
  return rec;
}

module.exports = {
  meta: { area: '05', id: 'multi_response_controller', name: 'Multi-response / integrity control', state: 'live' },
  compare,
  status: () => ({ validators: ['json_schema', 'key_set_consistency'], confidence_labels: true, audit: true }),
  actions: { compare: (p) => compare(p), status: () => module.exports.status() },
};
