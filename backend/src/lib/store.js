'use strict';
// Persistent JSON store with atomic writes (tasks + audit trail).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'store.json');
const AUDIT_CAP = 500;

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { tasks: [], audit: [], created_at: new Date().toISOString() }; }
}
function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

let state = load();

module.exports = {
  get: () => state,
  addTask(task) {
    state.tasks.push(task);
    if (state.tasks.length > 1000) state.tasks = state.tasks.slice(-1000);
    save(state);
    return task;
  },
  tasks: () => state.tasks.slice(-100).reverse(),
  audit(entry) {
    state.audit.push({ at: new Date().toISOString(), ...entry });
    if (state.audit.length > AUDIT_CAP) state.audit = state.audit.slice(-AUDIT_CAP);
    save(state);
  },
  auditLog: () => state.audit.slice(-100).reverse(),
};
