'use strict';
// 16 · Self-healing logger — bounded ring buffer; errors are flagged and
// "healed" by demoting them to recoverable entries instead of crashing.
const RING_CAP = 200;
const ring = [];
let heals = 0;

function push(level, msg, meta) {
  ring.push({ at: new Date().toISOString(), level, msg, meta: meta || null });
  if (ring.length > RING_CAP) ring.shift();
}
module.exports = {
  meta: { area: '16', id: 'self_healing_logger', name: 'Self-healing logger', state: 'live' },
  info: (m, meta) => push('info', m, meta),
  warn: (m, meta) => push('warn', m, meta),
  error(m, meta) {
    push('error', m, meta);
    heals += 1; // healed = absorbed without crash, retained for review
    push('healed', `absorbed: ${m}`, meta);
  },
  status() {
    const errors = ring.filter((e) => e.level === 'error').length;
    return { entries: ring.length, cap: RING_CAP, errors_recent: errors, healed_total: heals };
  },
  actions: {
    tail: () => ring.slice(-50),
    simulate_error: () => { module.exports.error('simulated failure (drill)'); return { healed: true }; },
    status: () => module.exports.status(),
  },
};
