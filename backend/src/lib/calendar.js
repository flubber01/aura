'use strict';
// AURA · Kalender: eine Zeitachse für alles, was einen Termin hat.
//
// Der Kalender sammelt Termine aus den Bereichen, die es schon gibt (Kampagnen-Planer, Tagesplan,
// Routinen, Releases im Songbook, Label-Pipeline) und macht daraus EINE Liste plus iCalendar-Datei.
// Er führt kein zweites Termin-Gedächtnis: die Quelle bleibt das jeweilige Modul.
//
// Keine externen Kalender-Dienste, kein Versand. Freigaben bleiben beim Menschen.
const fs = require('fs');
const path = require('path');
const campaignPlanner = require('./campaign_planner');

const FILE = process.env.AURA_CALENDAR_FILE || path.join(__dirname, '..', 'data', 'calendar.json');
const DAY = 86400000;
const TYPES = ['release', 'task', 'gate', 'routine', 'session', 'custom'];

function defaults() { return { custom: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['custom', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }
const iso = (x) => new Date(x).toISOString().slice(0, 10);

// ---------------------------------------------------------------- Quellen einsammeln (jede einzeln abgesichert)
function safe(fn, fallback) { try { const v = fn(); return v === undefined || v === null ? fallback : v; } catch { return fallback; } }

function fromCampaigns() {
  return safe(() => {
    const board = campaignPlanner.releaseBoard();
    const out = [];
    for (const row of board.rows || []) {
      const c = campaignPlanner.plan(row.id);
      out.push({ date: row.release_date, type: 'release', title: `Release: ${row.title}`, source: 'campaign_planner', ref: row.id, human: true, state: row.state });
      for (const t of (c.timeline || [])) {
        out.push({ date: t.due, type: t.human ? 'gate' : 'task', title: `${t.name} — ${row.title}`, source: 'campaign_planner', ref: row.id, human: !!t.human, state: t.state });
      }
    }
    return out;
  }, []);
}

function fromSchedule() {
  return safe(() => {
    const s = require('./schedule');
    const l = s.list ? s.list() : { entries: [] };
    return (l.entries || []).map((e) => ({ date: String(e.date || e.day || '').slice(0, 10), type: 'session', title: e.title || e.task || 'Tagesplan-Eintrag', source: 'schedule', ref: e.id || null, human: false, state: e.state || 'geplant' })).filter((e) => e.date);
  }, []);
}

function fromSongbook() {
  return safe(() => {
    const sb = require('./songbook');
    const l = sb.list({});
    return (l.items || l.songs || []).filter((s) => s.status === 'RELEASED' || s.release_date).map((s) => ({ date: String(s.release_date || s.updated_at || '').slice(0, 10), type: 'release', title: `Songbook: ${s.title}`, source: 'songbook', ref: s.id, human: true, state: s.status }));
  }, []).filter((e) => e.date);
}

function fromRoutines() {
  return safe(() => {
    const rc = require('./routine_control');
    const st = rc.status ? rc.status() : {};
    const routines = Array.isArray(st.routines) ? st.routines : [];
    return routines.filter((r) => r && r.enabled !== false && r.schedule_hint).map((r) => ({ date: iso(Date.now()), type: 'routine', title: `Routine: ${r.name || r.id}`, source: 'routine_control', ref: r.id || null, human: false, state: 'läuft' }));
  }, []);
}

function events(from, days) {
  const start = String(from || iso(Date.now())).slice(0, 10);
  const end = iso(new Date(new Date(start + 'T12:00:00Z').getTime() + (Number(days) || 30) * DAY));
  const all = [...fromCampaigns(), ...fromSchedule(), ...fromSongbook(), ...fromRoutines(), ...load().custom];
  const inRange = all.filter((e) => e.date && e.date >= start && e.date <= end)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDay = {};
  for (const e of inRange) { (byDay[e.date] = byDay[e.date] || []).push(e); }
  return {
    ok: true, from: start, to: end, count: inRange.length,
    days: Object.entries(byDay).map(([date, items]) => ({ date, count: items.length, items })),
    human_gates: inRange.filter((e) => e.human).length,
    sources: [...new Set(inRange.map((e) => e.source))],
  };
}

function add(input) {
  const data = load();
  const title = String((input && input.title) || '').trim();
  const date = String((input && input.date) || '').slice(0, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'title und date (JJJJ-MM-TT) nötig' };
  const type = TYPES.includes(input.type) ? input.type : 'custom';
  const entry = { id: 'cal-' + Math.random().toString(16).slice(2, 10), date, title, type, source: 'custom', human: !!input.human, state: input.state || 'geplant', note: String(input.note || '').slice(0, 300), created_at: new Date().toISOString() };
  data.custom.push(entry);
  data.audit.unshift({ at: new Date().toISOString(), action: 'add', id: entry.id, date });
  data.audit = data.audit.slice(0, 300);
  save(data);
  return { ok: true, entry };
}

function remove(id) {
  const data = load();
  const before = data.custom.length;
  data.custom = data.custom.filter((e) => e.id !== id);
  if (data.custom.length === before) return { ok: false, error: 'Termin nicht gefunden' };
  save(data);
  return { ok: true, removed: id };
}

function conflicts(from, days) {
  const ev = events(from, days);
  const out = [];
  for (const d of ev.days) {
    const heavy = d.items.filter((i) => i.human);
    if (heavy.length > 1) out.push({ date: d.date, reason: `${heavy.length} Freigaben an einem Tag`, items: heavy.map((i) => i.title) });
  }
  return { ok: true, conflicts: out, count: out.length };
}

function ics(from, days) {
  const ev = events(from, days);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AURA//Kalender//DE', 'CALSCALE:GREGORIAN'];
  for (const d of ev.days) {
    for (const i of d.items) {
      const day = d.date.replace(/-/g, '');
      lines.push('BEGIN:VEVENT', `UID:${i.source}-${(i.ref || 'x')}-${day}@aura`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${String(i.title).replace(/[,;\n]/g, ' ')}`,
        `CATEGORIES:${i.type}${i.human ? ',Freigabe' : ''}`, `DESCRIPTION:Quelle: ${i.source}${i.human ? ' · menschliche Freigabe nötig' : ''}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function status() {
  const data = load();
  const ev = events(iso(Date.now()), 30);
  return {
    area: 'CAL', module: 'calendar', state: 'live', file: FILE,
    next_30_days: ev.count, human_gates: ev.human_gates, custom_entries: data.custom.length,
    sources: ['campaign_planner', 'schedule', 'songbook', 'routine_control', 'custom'],
    note: 'Der Kalender sammelt nur ein — jedes Modul bleibt Quelle seiner eigenen Termine. Kein externer Dienst, kein Versand.',
  };
}

module.exports = {
  meta: { area: 'CAL', id: 'calendar', name: 'Kalender (Release- und Terminachse, ICS-Export)', state: 'live' },
  actions: { status: () => status(), events: (p) => events((p || {}).from, (p || {}).days), add: (p) => add(p || {}), remove: (p) => remove((p || {}).id), conflicts: (p) => conflicts((p || {}).from, (p || {}).days), ics: (p) => ({ ok: true, ics: ics((p || {}).from, (p || {}).days) }) },
  events, add, remove, conflicts, ics, status, TYPES, FILE,
};
