'use strict';
// File-system pulse watcher: hot-reloads editable data files (edit via /terminal
// nano/vim or config upload). Validates JSON; on syntax error ROLLS BACK to the
// last good copy instead of crashing — the crash/error repair flow.
const fs = require('fs');
const path = require('path');
const store = require('./store');

const DATA = path.join(__dirname, '..', '..', 'data');
const BACKUPS = path.join(__dirname, '..', 'data', 'backups'); // area 64 vault
const WATCHED = ['yellowpages.json', 'teams.json', 'departments.json', 'skills.json', 'schedule.json',
  'store.json', 'feedback.json', 'workflows.json', 'vita.json', 'config.json'];
// per-file home dir: config DBs vs runtime DBs
const DIRS = {
  'yellowpages.json': DATA, 'teams.json': DATA, 'departments.json': DATA, 'skills.json': DATA,
  'schedule.json': path.join(__dirname, '..', 'data'),
  'store.json': path.join(__dirname, '..', 'data'),
  'feedback.json': path.join(__dirname, '..', 'data'),
  'workflows.json': path.join(__dirname, '..', 'data'),
  'vita.json': path.join(__dirname, '..', 'data'),
  'config.json': path.join(__dirname, '..', 'data'),
};
// runtime DBs heal quietly — store.audit during their change events would
// write store.json again and loop forever
const QUIET = new Set(['store.json', 'feedback.json', 'workflows.json', 'vita.json', 'config.json']);
const dirOf = (f) => DIRS[f] || DATA;
const KEEP_BACKUPS = 25;
const lastGood = {};
const events = [];
let running = false;

// ---- Area 64: backup vault (verified snapshots on disk + restore) ----
function snapshot(file, txt) {
  try {
    fs.mkdirSync(BACKUPS, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const name = file.replace(/\.json$/, '') + '.' + ts + '.json';
    fs.writeFileSync(path.join(BACKUPS, name), txt);
    // prune to newest KEEP_BACKUPS per file
    const mine = fs.readdirSync(BACKUPS).filter((f) => f.startsWith(file.replace(/\.json$/, '') + '.')).sort();
    for (const old of mine.slice(0, Math.max(0, mine.length - KEEP_BACKUPS))) {
      try { fs.unlinkSync(path.join(BACKUPS, old)); } catch {}
    }
  } catch {}
}

function backups() {
  try {
    const list = fs.readdirSync(BACKUPS).filter((f) => f.endsWith('.json')).map((f) => {
      const p = path.join(BACKUPS, f);
      const st = fs.statSync(p);
      let valid = false;
      try { JSON.parse(fs.readFileSync(p, 'utf8')); valid = true; } catch {}
      return { file: f, source: f.split('.')[0] + '.json', bytes: st.size, at: st.mtime.toISOString(), valid };
    }).sort((a, b) => b.at.localeCompare(a.at));
    return { dir: BACKUPS, count: list.length, verified: list.filter((b) => b.valid).length, backups: list };
  } catch { return { dir: BACKUPS, count: 0, verified: 0, backups: [] }; }
}

function restore(name) {
  const p = path.join(BACKUPS, path.basename(String(name || '')));
  if (!p.startsWith(BACKUPS) || !fs.existsSync(p)) return { ok: false, error: 'backup not found' };
  const txt = fs.readFileSync(p, 'utf8');
  const src = path.basename(p).split('.')[0] + '.json';
  if (!WATCHED.includes(src)) return { ok: false, error: 'backup does not map to a watched file' };
  try { validate(src, txt); } catch (e) { return { ok: false, error: 'backup itself is corrupt: ' + e.message }; }
  fs.writeFileSync(path.join(dirOf(src), src), txt); // watcher picks it up → hot_reload_ok
  log({ event: 'restored_from_backup', file: src, backup: path.basename(p) });
  return { ok: true, file: src, backup: path.basename(p) };
}

function log(e) { events.push({ at: new Date().toISOString(), ...e }); if (events.length > 100) events.shift(); store.audit({ area: 'WATCH', ...e }); }

function validate(file, txt) {
  const j = JSON.parse(txt); // throws on syntax error
  if (file === 'yellowpages.json' && !Array.isArray(j.links)) throw new Error('links[] missing');
  if (file === 'teams.json' && !Array.isArray(j.teams)) throw new Error('teams[] missing');
  if (file === 'departments.json' && !Array.isArray(j.departments)) throw new Error('departments[] missing');
  if (file === 'skills.json' && !Array.isArray(j.skills)) throw new Error('skills[] missing');
  if (file === 'schedule.json' && !Array.isArray(j)) throw new Error('schedule must be an array');
  if (file === 'store.json' && (!Array.isArray(j.tasks) || !Array.isArray(j.audit))) throw new Error('tasks[]/audit[] missing');
  if (file === 'workflows.json' && !Array.isArray(j.workflows)) throw new Error('workflows[] missing');
  if (file === 'vita.json' && !Array.isArray(j)) throw new Error('vita must be an array');
  if (file === 'feedback.json' && (typeof j !== 'object' || Array.isArray(j) || j === null)) throw new Error('feedback must be an object');
  if (file === 'config.json' && (typeof j !== 'object' || Array.isArray(j) || j === null)) throw new Error('config must be an object');
  return j;
}

function check(file) {
  const p = path.join(dirOf(file), file);
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch { return; }
  // runtime DBs must NOT be audited via store on change — that writes
  // store.json and re-fires the watcher forever. Ring-buffer events only.
  const emit = QUIET.has(file)
    ? (e) => { events.push({ at: new Date().toISOString(), ...e }); if (events.length > 100) events.shift(); }
    : log;
  try {
    validate(file, txt);
    if (lastGood[file] !== txt) {
      snapshot(file, txt); // verified → vault it
      lastGood[file] = txt;
      emit({ event: 'hot_reload_ok', file });
    }
  } catch (e) {
    emit({ event: 'syntax_error_rollback', file, error: e.message });
    if (lastGood[file]) {
      fs.writeFileSync(p, lastGood[file]); // rollback
      try { // Area 69: learn the corruption fingerprint, rollback = learned fix
        const lc = require('./learning_core');
        const sig = 'syntax:' + file;
        lc.recordFailure(sig, { error: e.message });
        lc.reportOutcome(sig, true);
      } catch {}
    }
  }
}

function start(intervalMs) {
  if (running) return { already_running: true };
  running = true;
  const iv = Math.max(300, Number(intervalMs) || 1500);
  for (const f of WATCHED) {
    try {
      const txt = fs.readFileSync(path.join(dirOf(f), f), 'utf8');
      validate(f, txt);
      lastGood[f] = txt;
      snapshot(f, txt); // boot snapshot into the vault
    } catch {}
    fs.watchFile(path.join(dirOf(f), f), { interval: iv }, () => check(f));
  }
  return { started: true, watched: WATCHED, interval_ms: iv, vault: BACKUPS };
}
function stop() { for (const f of WATCHED) fs.unwatchFile(path.join(dirOf(f), f)); running = false; return { stopped: true }; }

module.exports = {
  meta: { area: '59', id: 'txt_watcher', name: 'TXT/JSON hot-reload watcher + backup vault', state: 'live' },
  start, stop, backups, restore,
  status: () => ({ running, watched: WATCHED, vault: backups().count + ' snapshots / ' + backups().verified + ' verified', events: events.slice(-20) }),
  actions: { status: () => module.exports.status(), start: () => start(), stop: () => stop() },
};
