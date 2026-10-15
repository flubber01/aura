'use strict';
// AURA Unified Analytics (Phase 2, §31 B4) — ein Dashboard über offizielle APIs,
// ehrliche Labels. Jede Zahl trägt ihre Quelle:
//   LIVE           = per offizieller API abgerufen (Adapter außerhalb der Sandbox, source='api')
//   IMPORTED       = vom Admin aus einem offiziellen Export eingetragen (source='manual_export')
//   CONFIGURED     = Token gesetzt, aber noch kein Abruf
//   NOT-CONNECTED  = kein Token / keine Daten
// Es gibt keine geschätzten oder erfundenen Werte. Empfehlungen entstehen nur aus
// LIVE/IMPORTED-Daten und brauchen eine Mindestanzahl Datenpunkte.
const growthStore = require('./growth_store');

const CONNECTORS = {
  youtube: { name: 'YouTube Data/Analytics API', env: 'AURA_YT_TOKEN' },
  spotify: { name: 'Spotify Web API (Artists-Daten)', env: 'AURA_SPOTIFY_TOKEN' },
  facebook: { name: 'Facebook Graph API (Page Insights)', env: 'AURA_FB_TOKEN' },
  tiktok: { name: 'TikTok Business API', env: 'AURA_TIKTOK_TOKEN' },
  telegram: { name: 'Telegram Bot API (Kanal, Bot als Admin)', env: 'AURA_TG_TOKEN' },
};
const PLATFORMS = Object.keys(CONNECTORS);
const METRICS = ['views', 'watch_time_s', 'likes', 'comments', 'shares'];
const MIN_POINTS = 3;     // mindestens so viele Datenpunkte, bevor eine Empfehlung kommt
const MAX_AGE_DAYS = 90;  // ältere Zeilen werden nicht bewertet

// Connector-Zustand. Token wird NUR als "vorhanden ja/nein" gelesen, nie ausgegeben.
// Ein LIVE-Status braucht einen tatsächlichen API-Abruf (recordPull), den die Sandbox
// nicht ausführen kann.
function connectorStates(db) {
  return PLATFORMS.map((p) => {
    const c = CONNECTORS[p];
    const hasToken = Boolean(process.env[c.env]);
    const apiRows = db.analytics_rows.filter((r) => r.platform === p && r.source === 'api');
    const importRows = db.analytics_rows.filter((r) => r.platform === p && r.source === 'manual_export');
    let state = 'NOT-CONNECTED';
    let reason = 'kein Token (' + c.env + ') und keine Daten';
    if (apiRows.length) { state = 'LIVE'; reason = apiRows.length + ' API-Zeilen gespeichert'; }
    else if (hasToken) { state = 'CONFIGURED'; reason = 'Token gesetzt, noch kein API-Abruf'; }
    else if (importRows.length) { state = 'IMPORTED'; reason = importRows.length + ' Zeilen aus manuellem Export'; }
    return { platform: p, name: c.name, state, reason, token_present: hasToken, rows_api: apiRows.length, rows_imported: importRows.length };
  });
}

function validateRow(r) {
  const errs = [];
  if (!PLATFORMS.includes(r.platform)) errs.push('platform unbekannt');
  if (!r.content_ref || String(r.content_ref).length < 2 || String(r.content_ref).length > 200) errs.push('content_ref required (2–200 Zeichen, z. B. Asset-ID oder RP-/REL-ID)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || ''))) errs.push('date im Format YYYY-MM-DD');
  const age = Math.round((Date.now() - Date.parse(r.date)) / 86400000);
  if (age > MAX_AGE_DAYS) errs.push('Datum älter als ' + MAX_AGE_DAYS + ' Tage');
  for (const m of METRICS) {
    if (r[m] === undefined) continue;
    const v = Number(r[m]);
    if (!Number.isFinite(v) || v < 0 || v > 1e12) errs.push(m + ' muss eine Zahl ≥ 0 sein');
  }
  if (!METRICS.some((m) => r[m] !== undefined)) errs.push('mindestens eine Metrik angeben');
  return errs;
}

// Manueller Import aus einem offiziellen Export (Admin-Vorgang).
function importRows(platform, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, errors: ['rows: nicht-leere Liste erwartet'] };
  if (rows.length > 500) return { ok: false, errors: ['max. 500 Zeilen pro Import'] };
  const errors = [];
  const clean = [];
  rows.forEach((r, i) => {
    const row = { ...r, platform };
    const e = validateRow(row);
    if (e.length) errors.push('Zeile ' + (i + 1) + ': ' + e.join('; '));
    else clean.push({
      platform, content_ref: String(row.content_ref), date: row.date,
      views: Number(row.views) || 0, watch_time_s: Number(row.watch_time_s) || 0,
      likes: Number(row.likes) || 0, comments: Number(row.comments) || 0, shares: Number(row.shares) || 0,
      source: 'manual_export', imported_at: new Date().toISOString(),
    });
  });
  if (errors.length) return { ok: false, errors };
  const db = growthStore.load();
  db.analytics_rows.push(...clean);
  db.analytics_rows = db.analytics_rows.slice(-5000);
  growthStore.save(db);
  return { ok: true, imported: clean.length };
}

// Rangliste je Inhalt, nur aus LIVE/IMPORTED-Zeilen. Empfehlungen nur bei genug Datenpunkten.
function dashboard() {
  const db = growthStore.load();
  const states = connectorStates(db);
  const byContent = new Map();
  for (const r of db.analytics_rows) {
    const k = r.content_ref;
    if (!byContent.has(k)) byContent.set(k, { content_ref: k, points: 0, platforms: new Set(), sources: new Set(), totals: { views: 0, watch_time_s: 0, likes: 0, comments: 0, shares: 0 } });
    const e = byContent.get(k);
    e.points++;
    e.platforms.add(r.platform);
    e.sources.add(r.source === 'api' ? 'LIVE' : 'IMPORTED');
    for (const m of METRICS) e.totals[m] += Number(r[m]) || 0;
  }
  const ranking = [...byContent.values()]
    .map((e) => ({ ...e, platforms: [...e.platforms], sources: [...e.sources] }))
    .sort((a, b) => b.totals.views - a.totals.views);

  const enough = ranking.filter((e) => e.points >= MIN_POINTS);
  const recommendations = enough.length < 3
    ? [{ kind: 'none', text: 'Noch keine belastbare Empfehlung: mindestens 3 Inhalte mit je ' + MIN_POINTS + ' Datenpunkten nötig.' }]
    : [
      ...enough.slice(0, 3).map((e) => ({ kind: 'double', content_ref: e.content_ref, text: 'Format verdoppeln (WF-18 erneut): meiste Views (' + e.totals.views + ', Quelle ' + e.sources.join('/') + ')' })),
      ...enough.slice(-1).map((e) => ({ kind: 'review', content_ref: e.content_ref, text: 'Prüfen/pausieren: wenigste Views (' + e.totals.views + ')' })),
    ];

  return {
    labels: { LIVE: 'per offizieller API', IMPORTED: 'manueller Export', CONFIGURED: 'Token da, kein Abruf', 'NOT-CONNECTED': 'nicht verbunden' },
    connectors: states,
    rows: db.analytics_rows.length,
    ranking: ranking.slice(0, 20),
    recommendations,
    note: 'Keine gekauften Likes/Views, kein synthetisches Engagement. Zahlen stammen nur aus LIVE- oder IMPORTED-Quellen.',
  };
}

module.exports = { importRows, dashboard, connectorStates, validateRow, CONNECTORS, PLATFORMS, METRICS, MIN_POINTS };
