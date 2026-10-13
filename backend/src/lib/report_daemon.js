'use strict';
// AURA Area 17 — Daily report daemon (voll ausgebaut, vorher placeholder).
// Real scheduler wiring: registers/updates a schedule entry via Area 60,
// tracks last run, and builds the report from LIVE data via src/lib/report.
// Honest: the daemon tick runs in-process; no report leaves the system
// without a human requesting it (no external mail without Area-68 config).
const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '..', 'data', 'report_daemon.json');
function load() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { enabled: false, last_run: null, runs: 0, schedule_id: null }; } }
function save(s) { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }

function buildReport() { return require('./report').dailyReport(); }

function ensureScheduleEntry() {
  const sched = require('./schedule');
  const st = load();
  const list = (sched.list ? sched.list().entries : []);
  const existing = list.find((e) => e.service === 'Area 17 daily report');
  if (existing) { st.schedule_id = existing.id; save(st); return existing.id; }
  try {
    const r = sched.add({ day: 'mon', role: 'operator', service: 'Area 17 daily report', start: '07:30', duration_min: 15, task: 'daily report erzeugen' });
    st.schedule_id = r.entry.id; save(st); return r.entry.id;
  } catch { return null; }
}

function setEnabled(on) {
  const st = load();
  st.enabled = !!on;
  if (on) ensureScheduleEntry();
  save(st);
  return { ok: true, enabled: st.enabled, schedule_id: st.schedule_id };
}

function runNow() {
  const st = load();
  const report = buildReport();
  st.last_run = new Date().toISOString(); st.runs += 1;
  save(st);
  return { ok: true, ran_at: st.last_run, runs: st.runs, report };
}

// daemon tick — called by server interval; only fires once per 24h when enabled
function tick() {
  const st = load();
  if (!st.enabled) return false;
  if (st.last_run && Date.now() - new Date(st.last_run).getTime() < 24 * 3600 * 1000) return false;
  runNow();
  return true;
}

function status() {
  const st = load();
  return { area: '17', mode: 'LIVE', enabled: st.enabled, last_run: st.last_run, runs: st.runs, schedule_id: st.schedule_id, note: 'in-process Daemon (Area-60-Schedule-Eintrag wird automatisch gepflegt); Report aus echten Live-Daten' };
}

module.exports = {
  meta: { area: '17', id: 'report_daemon', name: 'Daily Report Daemon (schedule-wired, live data)', state: 'live' },
  actions: { status: () => status(), enable: (p) => setEnabled(!(p && p.on === false)), run: () => runNow() },
  status, setEnabled, runNow, tick, buildReport,
};
