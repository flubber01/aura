'use strict';
// 03 · Cognitive Learning Core — validates incoming tasks, assigns a role
// round-robin, stores traceable results with trace IDs. Bounded queue.
const crypto = require('crypto');
const store = require('./store');
const registry = () => require('./role_registry');

const MAX_TASK_LEN = 2000;
const MAX_PENDING = 100;
let rr = 0;

function submit(payload) {
  const task = typeof payload.task === 'string' ? payload.task.trim() : '';
  if (!task) throw Object.assign(new Error('task must be a non-empty string'), { code: 400 });
  if (task.length > MAX_TASK_LEN) throw Object.assign(new Error(`task too long (max ${MAX_TASK_LEN})`), { code: 400 });
  const pending = store.get().tasks.filter((t) => t.state === 'queued').length;
  if (pending >= MAX_PENDING) throw Object.assign(new Error('task queue full (bounded concurrency)'), { code: 429 });
  const roles = registry().roles();
  const role = roles.length ? roles[rr++ % roles.length] : 'unassigned';
  const rec = {
    trace_id: crypto.randomUUID(),
    task, role,
    state: 'done', // synchronous demo execution; real routing happens server-side per review notes
    result: `acknowledged by role '${role}' — heuristic routing, no external calls`,
    at: new Date().toISOString(),
  };
  store.addTask(rec);
  store.audit({ area: '03', event: 'task_submitted', trace_id: rec.trace_id, role });
  return rec;
}

module.exports = {
  meta: { area: '03', id: 'cognitive_learning_core', name: 'Cognitive Learning Core', state: 'live' },
  submit,
  status() {
    const t = store.get().tasks;
    return { tasks_total: t.length, bounded_queue: MAX_PENDING, max_task_len: MAX_TASK_LEN };
  },
  actions: {
    submit: (p) => submit(p),
    list: () => store.tasks(),
    status: () => module.exports.status(),
  },
};
