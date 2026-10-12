'use strict';
// Schedule planner: which role works where when. Conflict detection on
// overlapping times of the same role; recommended day generator; CSV export.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FILE = path.join(__dirname, '..', 'data', 'schedule.json');

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } }
function save(v) { fs.writeFileSync(FILE + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(FILE + '.tmp', FILE); }
let entries = load();

const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };

function conflicts(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.role !== b.role || a.day !== b.day) continue;
    const as = toMin(a.start), ae = as + a.duration_min, bs = toMin(b.start), be = bs + b.duration_min;
    if (as < be && bs < ae) out.push({ a: a.id, b: b.id, role: a.role, day: a.day });
  }
  return out;
}
function add(body) {
  const e = {
    id: crypto.randomUUID(), day: String(body.day || 'mon'), role: String(body.role || ''),
    service: String(body.service || ''), start: String(body.start || '09:00'),
    duration_min: Math.min(Number(body.duration_min) || 60, 720), task: String(body.task || ''),
  };
  if (!/^\d{2}:\d{2}$/.test(e.start)) throw Object.assign(new Error('start must be HH:MM'), { code: 400 });
  entries.push(e); save(entries);
  return { entry: e, conflicts: conflicts(entries) };
}
function remove(id) { entries = entries.filter((e) => e.id !== id); save(entries); return { ok: true, conflicts: conflicts(entries) }; }
function recommend() {
  // a sane suggested day: research morning, editorial midday, ops evening, gates last
  const plan = [
    { role: 'researcher', service: 'WF-2 research loop', start: '08:00', duration_min: 90 },
    { role: 'source_auditor', service: 'verify findings', start: '09:30', duration_min: 45 },
    { role: 'editor', service: 'WF-1 draft', start: '10:30', duration_min: 90 },
    { role: 'product_designer', service: 'WF-6 design pass', start: '13:00', duration_min: 60 },
    { role: 'senior_web_dev', service: 'build & verify', start: '14:00', duration_min: 120 },
    { role: 'qa_engineer', service: 'endpoint sweep', start: '16:00', duration_min: 60 },
    { role: 'operator', service: 'WF-4 ops + backups', start: '17:00', duration_min: 60 },
    { role: 'reviewer', service: 'compliance sign-off', start: '18:00', duration_min: 30 },
  ].map((p) => ({ ...p, id: crypto.randomUUID(), day: 'mon', task: p.service }));
  return plan;
}
function csv() {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  return ['day,role,service,start,duration_min,task', ...entries.map((e) => [e.day, e.role, e.service, e.start, e.duration_min, e.task].map(q).join(','))].join('\r\n');
}
module.exports = {
  meta: { area: '60', id: 'schedule', name: 'Schedule planner', state: 'live' },
  list: () => ({ entries, conflicts: conflicts(entries) }),
  add, remove, recommend, csv,
  status: () => ({ entries: entries.length, conflicts: conflicts(entries).length }),
  actions: {
    list: () => module.exports.list(),
    add: (p) => add(p),
    remove: (p) => remove(String(p.id)),
    recommend: () => recommend(),
    status: () => module.exports.status(),
  },
};
