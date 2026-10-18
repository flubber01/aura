'use strict';
// AURA · Log- und Auswertungssystem — mit Klick-Bewertung und Einnahmen-Bewertung.
//
// Drei Teile, ein Gedanke: es wird nur ausgewertet, was wirklich gemessen wurde.
//
// 1. PROTOKOLL (Log): alle Quellen des Hauses an einem Ort — Ereignis-Protokoll, Fehlerakte, Läufe der
//    Selbstüberwachung, Support, Sicherheit, Werbung, Wirtschaft. Suche über alle, Klassen, Alter,
//    Vorschläge zum Aufräumen (löschen nie automatisch).
// 2. KLICK-BEWERTUNG: Aufrufe, Klicks, Verweildauer je Seite und Weg. Bewertung A–E aus echten Zahlen,
//    mit klarer Regel: unter einer Mindestmenge gibt es **keine** Note, sondern „zu wenig Daten".
// 3. EINNAHMEN-BEWERTUNG: Einnahmen je Quelle (Abo, Verkauf, Werbung, Förderung, Plattform), Kosten,
//    Deckungsbeitrag, Trend und Ampel — ohne Schätzung, mit Spanne, wenn der Trend wackelt.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_LOGS_FILE || path.join(__dirname, '..', 'data', 'logs_analytics.json');

// Mindestmengen, damit eine Note überhaupt erlaubt ist. Darunter: „zu wenig Daten".
const MIN_SAMPLE = { clicks: 30, revenue_months: 3 };

function defaults() { return { clicks: [], revenue: [], reports: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['clicks', 'revenue', 'reports', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function safe(fn, fallback) { try { const r = fn(); return r === undefined ? fallback : r; } catch { return fallback; } }

// ---------------------------------------------------------------- 1. Protokoll
function sources() {
  return [
    { id: 'audit', name: 'Ereignis-Protokoll des Hauses', how: 'store.auditLog()' },
    { id: 'errors', name: 'Fehlerakte', how: 'failures.json' },
    { id: 'monitor', name: 'Läufe der Selbstüberwachung', how: 'auto_monitor.runs' },
    { id: 'support', name: 'Support-Anliegen', how: 'support.list()' },
    { id: 'security', name: 'Sicherheitsfälle', how: 'security_response.cases()' },
    { id: 'ads', name: 'Werbung (Einblendungen, Klicks)', how: 'ad_engine.stats()' },
    { id: 'economy', name: 'Wirtschaft (Belege, Abos, Förderbeiträge)', how: 'billing/payments/sponsor' },
    { id: 'traffic', name: 'Verkehr und Charts', how: 'analytics_forecast' },
    { id: 'jobs', name: 'Aufträge und Läufe', how: 'video_department / report_daemon' },
  ];
}

function collect(source) {
  const out = [];
  const push = (row) => out.push(row);
  // Jede Quelle kann ein Feld, eine Liste oder eine Kurzform liefern — deshalb wird immer geprüft.
  const arr = (v) => {
    if (Array.isArray(v)) return v;
    if (!v || typeof v !== 'object') return [];
    for (const k of ['rows', 'entries', 'items', 'tickets', 'runs', 'cases', 'list', 'data']) if (Array.isArray(v[k])) return v[k];
    return [];
  };
  if (!source || source === 'audit') for (const r of arr(safe(() => require('./store').auditLog(), []))) push({ source: 'audit', at: r.at || r.time || null, text: `${r.area || ''} ${r.event || ''}`.trim(), data: r });
  if (!source || source === 'errors') for (const r of arr(safe(() => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'failures.json'), 'utf8')), null)?.failures || [])) push({ source: 'errors', at: r.at || null, text: String(r.error || r.message || 'Fehler'), data: r });
  if (!source || source === 'monitor') for (const r of arr(safe(() => require('./auto_monitor').actions.runs(), { runs: [] }))) push({ source: 'monitor', at: r.at, text: `${r.checked} Regeln, ${r.breached} Befund(e)`, data: r });
  if (!source || source === 'support') for (const r of arr(safe(() => require('./support').list({}), {}))) push({ source: 'support', at: r.at, text: `${r.number} ${r.category}/${r.priority} ${r.state}`, data: r });
  if (!source || source === 'security') for (const c of arr(safe(() => require('./security_response').actions.cases(), {}))) push({ source: 'security', at: c.at, text: `${c.id || ''} ${c.state || ''} ${c.kind || ''}`, data: c });
  return out;
}


function search(input) {
  const p = input || {};
  const limit = Math.max(1, Math.min(500, Number(p.limit) || 60));
  const text = p.text ? String(p.text).toLowerCase() : null;
  const rows = collect(p.source ? String(p.source) : null)
    .filter((r) => (text ? r.text.toLowerCase().includes(text) : true))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, limit);
  const bySource = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + 1;
  return { ok: true, found: rows.length, by_source: bySource, rows, sources: sources().length, note: 'Gelesen wird aus den lebenden Modulen — nichts wird doppelt gespeichert.' };
}

function classes() {
  // Fehlerklassen aus dem, was wirklich vorkommt — nicht aus einer Wunschliste.
  const rows = collect('errors');
  const buckets = { NETZ: /network|ECONN|timeout|fetch/i, DATEI: /ENOENT|EACCES|file|datei/i, EINGABE: /invalid|fehlt|ungültig|JSON/i, MODUL: /module|require|nicht ladbar/i, RECHTS: /refus|verboten|nicht erlaubt|gesperrt/i, TECHNIK: /.*/ };
  const out = {};
  for (const r of rows) {
    const key = Object.keys(buckets).find((k) => buckets[k].test(r.text)) || 'TECHNIK';
    out[key] = (out[key] || 0) + 1;
  }
  return { ok: true, total: rows.length, classes: out, note: 'Klassen werden aus den echten Fehlertexten gebildet.' };
}

function retention(input) {
  const p = input || {};
  const days = Math.max(1, Number(p.days) || 90);
  const cutoff = Date.now() - days * 86400000;
  const rows = collect(null).filter((r) => r.at && new Date(r.at).getTime() < cutoff);
  const bySource = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + 1;
  return {
    ok: true, older_than_days: days, candidates: rows.length, by_source: bySource,
    rule: 'Vorschlagen ja, löschen nein. Ein Aufräumen entscheidet ein Mensch (Freigabe-Tür, kind DELETE).',
    suggestion: rows.length ? `Älter als ${days} Tage: ${rows.length} Einträge. Vor dem Löschen exportieren (Sammelausgabe im Speicher).` : 'Nichts vorzuschlagen.',
  };
}

// ---------------------------------------------------------------- 2. Klick-Bewertung
function recordClick(input) {
  const p = input || {};
  const page = String(p.page || '').trim();
  if (!page) return { ok: false, error: 'page fehlt' };
  const d = load();
  const row = {
    at: String(p.date || new Date().toISOString().slice(0, 10)),
    page,
    views: Math.max(0, Number(p.views) || 0),
    clicks: Math.max(0, Number(p.clicks) || 0),
    dwell_s: Math.max(0, Number(p.dwell_s) || 0),
    bounces: Math.max(0, Number(p.bounces) || 0),
    source: String(p.source || 'unbekannt'),
  };
  if (row.clicks > row.views) return { ok: false, error: 'clicks können nicht größer als views sein — Zahlen prüfen' };
  d.clicks.unshift(row); d.clicks = d.clicks.slice(0, 20000);
  d.audit.unshift({ at: new Date().toISOString(), action: 'click_row', page, views: row.views, clicks: row.clicks });
  save(d);
  return { ok: true, row, note: 'Ein gemessener Wert. Keine Klicks werden erzeugt, keiner hochgerechnet.' };
}

function clickReport(input) {
  const p = input || {};
  const days = Math.max(1, Number(p.days) || 30);
  const cutoff = Date.now() - days * 86400000;
  const d = load();
  const rows = d.clicks.filter((r) => new Date(r.at).getTime() >= cutoff);
  if (!rows.length) return { ok: true, measured: false, pages: 0, note: 'Keine gemessenen Klick-Werte im Zeitraum — deshalb keine Note. Eine Bewertung ohne Messung wäre geraten.' };
  const byPage = {};
  for (const r of rows) {
    const b = byPage[r.page] = byPage[r.page] || { page: r.page, views: 0, clicks: 0, dwell: 0, rows: 0, bounces: 0 };
    b.views += r.views; b.clicks += r.clicks; b.dwell += r.dwell_s; b.rows++; b.bounces += r.bounces;
  }
  const pages = Object.values(byPage).map((b) => {
    const ctr = b.views ? b.clicks / b.views : 0;
    const dwell = b.rows ? b.dwell / b.rows : 0;
    const bounce = b.views ? b.bounces / b.views : 0;
    let grade = null, why = null;
    if (b.views < MIN_SAMPLE.clicks) { why = `zu wenig Daten (${b.views} Aufrufe, für eine Note nötig: ${MIN_SAMPLE.clicks})`; }
    else {
      const score = Math.round(Math.min(100, (ctr * 900) + (Math.min(dwell, 240) / 240) * 35 + (1 - bounce) * 20));
      grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'E';
      why = `Klickrate ${(ctr * 100).toFixed(1)} %, Verweildauer Ø ${Math.round(dwell)} s, Absprünge ${(bounce * 100).toFixed(0)} %`;
    }
    return { page: b.page, views: b.views, clicks: b.clicks, ctr: Number((ctr * 100).toFixed(2)), dwell_avg_s: Math.round(dwell), bounce_rate: Number((bounce * 100).toFixed(1)), grade, why };
  }).sort((a, b) => b.views - a.views);
  const graded = pages.filter((p2) => p2.grade);
  const dist = graded.reduce((a, p2) => { a[p2.grade] = (a[p2.grade] || 0) + 1; return a; }, {});
  return {
    ok: true, measured: true, days, pages: pages.length, graded: graded.length,
    distribution: dist,
    rows: pages.slice(0, 40),
    best: graded.slice().sort((a, b) => (a.grade > b.grade ? 1 : -1))[0] || null,
    worst: graded.slice().sort((a, b) => (a.grade < b.grade ? 1 : -1))[0] || null,
    rules: [`Note erst ab ${MIN_SAMPLE.clicks} Aufrufen je Seite — vorher steht „zu wenig Daten".`, 'Klickrate ist gemessen, nicht erzeugt.', 'Verweildauer und Absprünge kommen aus echten Werten, nicht aus Schätzungen.'],
  };
}

// ---------------------------------------------------------------- 3. Einnahmen-Bewertung
const REVENUE_KINDS = ['ABO', 'VERKAUF', 'WERBUNG', 'FOERDERUNG', 'PLATTFORM', 'LIZENZ', 'SONSTIG'];

function recordRevenue(input) {
  const p = input || {};
  const month = String(p.month || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: 'month (JJJJ-MM) fehlt' };
  const kind = String(p.kind || '').toUpperCase();
  if (!REVENUE_KINDS.includes(kind)) return { ok: false, error: `kind unbekannt. Erlaubt: ${REVENUE_KINDS.join(', ')}` };
  const amount = Number(p.amount);
  if (!Number.isFinite(amount)) return { ok: false, error: 'amount fehlt' };
  const d = load();
  const row = {
    at: new Date().toISOString(), month, kind,
    amount_eur: Number(amount.toFixed(2)),
    costs_eur: Number((Number(p.costs) || 0).toFixed(2)),
    source: String(p.source || 'unbekannt'),
    proof: String(p.proof || '') || null,
    state: p.proof ? 'BELEGT' : 'OHNE BELEG',
  };
  d.revenue.unshift(row); d.revenue = d.revenue.slice(0, 5000);
  d.audit.unshift({ at: row.at, action: 'revenue_row', month, kind, amount: row.amount_eur, state: row.state });
  save(d);
  return { ok: true, row, honesty: row.state === 'BELEGT' ? 'Beleg vorhanden.' : 'Ohne Beleg wird der Wert geführt, aber ausdrücklich als unbelegt gekennzeichnet.' };
}

function revenueReport(input) {
  const p = input || {};
  const months = Math.max(1, Math.min(36, Number(p.months) || 12));
  const d = load();
  const rows = d.revenue.slice(0, 5000);
  if (!rows.length) return { ok: true, measured: false, months: 0, note: 'Keine Einnahmen erfasst — also keine Bewertung. Erfundene Einnahmen wären schlimmer als keine Zahl.' };
  const byMonth = {}, byKind = {};
  for (const r of rows) {
    byMonth[r.month] = byMonth[r.month] || { month: r.month, amount: 0, costs: 0, rows: 0, unproven: 0 };
    byMonth[r.month].amount += r.amount_eur; byMonth[r.month].costs += r.costs_eur; byMonth[r.month].rows++;
    if (r.state !== 'BELEGT') byMonth[r.month].unproven++;
    byKind[r.kind] = byKind[r.kind] || { kind: r.kind, amount: 0, costs: 0 };
    byKind[r.kind].amount += r.amount_eur; byKind[r.kind].costs += r.costs_eur;
  }
  const list = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-months)
    .map((m) => ({ month: m.month, amount_eur: Number(m.amount.toFixed(2)), costs_eur: Number(m.costs.toFixed(2)), margin_eur: Number((m.amount - m.costs).toFixed(2)), unproven_rows: m.unproven, margin_percent: m.amount ? Number((((m.amount - m.costs) / m.amount) * 100).toFixed(1)) : null }));
  const total = list.reduce((n, m) => n + m.amount_eur, 0);
  const totalCosts = list.reduce((n, m) => n + m.costs_eur, 0);
  const trend = list.length >= MIN_SAMPLE.revenue_months
    ? (() => {
      const half = Math.floor(list.length / 2);
      const a = list.slice(0, half).reduce((n, m) => n + m.amount_eur, 0) / Math.max(1, half);
      const b = list.slice(half).reduce((n, m) => n + m.amount_eur, 0) / Math.max(1, list.length - half);
      const change = a ? (b - a) / a : null;
      return { direction: change === null ? 'unbekannt' : change > 0.08 ? 'STEIGEND' : change < -0.08 ? 'FALLEND' : 'SEITWÄRTS', change_percent: change === null ? null : Number((change * 100).toFixed(1)) };
    })()
    : { direction: 'zu wenig Monate', change_percent: null, hint: `Für einen Trend mindestens ${MIN_SAMPLE.revenue_months} Monate erfassen` };
  const marginPercent = total ? ((total - totalCosts) / total) * 100 : 0;
  const ampel = !list.length ? 'GRAU' : marginPercent >= 40 ? 'GRÜN' : marginPercent >= 15 ? 'GELB' : 'ROT';
  const unproven = rows.filter((r) => r.state !== 'BELEGT').length;
  return {
    ok: true, measured: true, months: list.length,
    total_eur: Number(total.toFixed(2)), costs_eur: Number(totalCosts.toFixed(2)),
    margin_eur: Number((total - totalCosts).toFixed(2)), margin_percent: Number(marginPercent.toFixed(1)),
    ampel, trend,
    by_kind: Object.values(byKind).map((k) => ({ kind: k.kind, amount_eur: Number(k.amount.toFixed(2)), margin_eur: Number((k.amount - k.costs).toFixed(2)) })).sort((a, b) => b.amount_eur - a.amount_eur),
    months_rows: list,
    unproven_rows: unproven,
    honesty: [
      'Alle Zahlen kommen aus erfassten Belegen — nichts ist geschätzt.',
      unproven ? `${unproven} Zeile(n) ohne Beleg: gekennzeichnet, nicht versteckt.` : 'Alle Zeilen haben einen Beleg.',
      'Die Ampel bewertet den Deckungsbeitrag, nicht die Höhe der Einnahme: 100 € mit 60 % Deckung ist besser als 1000 € mit 2 %.',
      'Fördermittel aus Zusagen werden erst mit Beleg gezählt.',
    ],
  };
}

function summary() {
  const logs = search({ limit: 10 });
  const clicks = clickReport({ days: 30 });
  const revenue = revenueReport({ months: 12 });
  return {
    ok: true, at: new Date().toISOString(),
    log: { sources: sources().length, recent: logs.found },
    clicks: { pages: clicks.pages || 0, graded: clicks.graded || 0, distribution: clicks.distribution || {} },
    revenue: { measured: !!revenue.measured, margin_percent: revenue.margin_percent || null, ampel: revenue.ampel || 'GRAU' },
    line: `Protokoll: ${logs.found} Einträge · Klicks: ${clicks.graded || 0} bewertete Seiten · Einnahmen: ${revenue.measured ? `${revenue.margin_percent} % Deckung (${revenue.ampel})` : 'keine Erfassung'}`,
  };
}

function status() {
  const d = load();
  return {
    area: 'LOG', module: 'logs_analytics', state: 'live', file: FILE,
    sources: sources().length, click_rows: d.clicks.length, revenue_rows: d.revenue.length,
    min_sample: MIN_SAMPLE, revenue_kinds: REVENUE_KINDS,
    rules: ['Ohne Messung keine Note — dann steht „zu wenig Daten" da.', 'Fehlerklassen aus echten Fehlertexten.', 'Einnahmen nur aus Belegen, unbelegtes wird gekennzeichnet.', 'Aufräumen schlägt vor, löscht nie selbst.'],
  };
}

module.exports = {
  meta: { area: 'LOG', id: 'logs_analytics', name: 'Log- und Auswertung (Protokoll, Klick-Bewertung, Einnahmen-Bewertung)', state: 'live' },
  actions: {
    status: () => status(), sources: () => ({ ok: true, sources: sources() }), search: (p) => search(p || {}), classes: () => classes(), retention: (p) => retention(p || {}),
    click_in: (p) => recordClick(p || {}), clicks: (p) => clickReport(p || {}),
    revenue_in: (p) => recordRevenue(p || {}), revenue: (p) => revenueReport(p || {}), summary: () => summary(),
  },
  sources, search, classes, retention, recordClick, clickReport, recordRevenue, revenueReport, summary, status, MIN_SAMPLE, REVENUE_KINDS,
};
