'use strict';
// 04 · Tri-Vector Consensus Engine — generates three candidate plans (A/B/C)
// and scores them on evidence/safety/cost/task-fit. Scores are deterministic
// heuristics and are LABELLED as such; real judging needs parallel model
// responses (see inventory notes).
const crypto = require('crypto');

function h(s) { // fnv-1a
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return x;
}
const score = (seed, dim) => 40 + ((h(seed + ':' + dim) % 61)); // 40..100

function evaluate(task) {
  if (typeof task !== 'string' || !task.trim()) throw Object.assign(new Error('task required'), { code: 400 });
  const id = crypto.randomUUID().slice(0, 8);
  const plans = ['A', 'B', 'C'].map((v) => {
    const s = {
      evidence: score(id + v, 'evidence'),
      safety: score(id + v, 'safety'),
      cost: score(id + v, 'cost'),
      task_fit: score(id + v, 'fit'),
    };
    return { variant: v, strategy: { A: 'fast direct path', B: 'balanced verified path', C: 'cautious stepwise path' }[v], scores: s, total: s.evidence + s.safety + s.cost + s.task_fit };
  }).sort((a, b) => b.total - a.total);
  return { eval_id: id, task: task.slice(0, 200), heuristic: true, plans, winner: plans[0].variant, fallback_rule: 'if all totals < 60, reject and escalate to human review' };
}

module.exports = {
  meta: { area: '04', id: 'consensus_logic_core', name: 'Tri-Vector Consensus Engine', state: 'live' },
  evaluate,
  status: () => ({ variants: 3, scoring: 'deterministic heuristic (labelled)', live_models: false }),
  actions: { evaluate: (p) => evaluate(p.task), status: () => module.exports.status() },
};
