'use strict';
// AURA · Analyse: Verkehr, Nebenprodukte, Marktcharts und Trend-Vorhersage.
//
// Der ehrliche Kern dieses Moduls: Es werden ausschließlich ECHTE, eingetragene Zahlen gerechnet.
// Fehlt eine Zahl, steht dort „nicht gemessen" — es wird nichts geschätzt, hochgerechnet oder
// verschönert. Jede Vorhersage trägt ihr Verfahren, ihre Streuung und ihre Grenzen mit sich.
//
// Was gerechnet wird:
//  1. Verkehr (Traffic) je Seite/Kanal — aus eigenen Messungen (Webserver-Protokoll, Matomo, Sitemap)
//     samt Nebenprodukten (Unterseiten, Kampagnen-Landeseiten, Downloads).
//  2. Trend-Erkennung über Zeitreihen: gleitender Durchschnitt, Wachstumsrate, Beschleunigung,
//     Saisonalität (Wochentag), Ausreißer über die mittlere Abweichung.
//  3. Marktcharts: eigene Chart-Einträge (Position je Woche). Daraus Platzierungsverlauf,
//     Höchstposition, Verweildauer — und Trends, die man wirklich messen kann: Position steigt seit
//     N Wochen, Neueinstiege in Nachbargenres, Tempo der Neuzugänge.
//  4. Vorhersage: drei Verfahren, die jeweils sagen, was sie sind —
//       a) Trendfortschreibung (lineare Regression der letzten Punkte)
//       b) gleitender Durchschnitt mit Wachstumsrate
//       c) Saison-Muster (Wochentag/Release-Tag)
//     Ausgabe immer als Spanne (unten/oben), nie als eine Zahl, die Sicherheit vortäuscht.
//
// Warum keine „KI-Vorhersage": ohne echte Daten ist jede Vorhersage Theater. Dieses Modul verlangt
// Daten. Wo die herkommen können (eigene Zählung, Matomo, Chart-Eintrag), steht in den Anleitungen.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_ANALYTICS_FILE || path.join(__dirname, '..', 'data', 'analytics.json');

// Quellen, aus denen Zahlen kommen dürfen. Fremdes Scraping ist nicht dabei.
const SOURCES = [
  { id: 'manual', name: 'Handeingabe', how: 'Zahlen aus einem Anzeigenkonto oder einer Plattform-Auswertung eintragen', state: 'immer verfügbar' },
  { id: 'matomo', name: 'Matomo (eigene Installation)', how: 'Matomo-Token im Vault, API-Abfrage, volle Datenhoheit', state: 'braucht Schlüssel' },
  { id: 'webserver', name: 'Webserver-Protokoll (nginx/apache)', how: 'Zugriffsprotokoll der eigenen Seiten auszählen', state: 'lokal möglich' },
  { id: 'sitemap', name: 'Sitemap/Search-Console', how: 'Suchmaschinen-Auswertung der eigenen Seiten', state: 'Export einlesen' },
  { id: 'platform', name: 'Plattform-Auswertung (eigener Kanal)', how: 'Auswertung des eigenen Kanals exportieren', state: 'Export einlesen' },
  { id: 'charts', name: 'Marktcharts (Eintrag/Export)', how: 'Chart-Daten als Zeilen einfügen (Datum, Position, Titel, Genre)', state: 'Handeingabe oder Export' },
];

const METHODS = {
  trend_line: { name: 'Trendfortschreibung', math: 'Lineare Regression über die letzten Punkte, verlängert', caveat: 'Nimmt an, dass der bisherige Verlauf weitergeht. Bei Brüchen falsch.' },
  moving_avg: { name: 'Gleitender Durchschnitt + Wachstum', math: 'Durchschnitt der letzten 7 Punkte, multipliziert mit der Wachstumsrate', caveat: 'Träge: reagiert spät auf neue Entwicklungen.' },
  season: { name: 'Saisonmuster', math: 'Wochentags-Muster der eigenen Daten auf die Zielwoche gelegt', caveat: 'Braucht mindestens zwei volle Wochen Daten.' },
};

function defaults() { return { traffic: [], charts: [], forecasts: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['traffic', 'charts', 'forecasts', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// ---------------------------------------------------------------- Verkehr eintragen
function traffic(input) {
  const data = load();
  const p = input || {};
  const source = SOURCES.find((s) => s.id === String(p.source || 'manual'));
  if (!source) return { ok: false, error: `Quelle unbekannt. Erlaubt: ${SOURCES.map((s) => s.id).join(', ')}` };
  const page = String(p.page || '').trim();
  if (!page) return { ok: false, error: 'page fehlt (z. B. "/master-web-empire/01_igaming_toplists")' };
  const views = Number(p.views);
  if (!Number.isFinite(views) || views < 0) return { ok: false, error: 'views muss eine Zahl ≥ 0 sein' };
  const row = {
    id: 'tr-' + Math.random().toString(16).slice(2, 10),
    date: String(p.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    page, source: source.id,
    views, visitors: Number.isFinite(Number(p.visitors)) ? Number(p.visitors) : null,
    clicks: Number.isFinite(Number(p.clicks)) ? Number(p.clicks) : null,
    conversions: Number.isFinite(Number(p.conversions)) ? Number(p.conversions) : null,
    side_product: p.side_product || null,     // Nebenprodukt: Unterseite, Download, Kampagnen-Landeseite
    channel: String(p.channel || 'organisch'), // organisch, werbung, social, direkt, empfehlung
    revenue_eur: Number.isFinite(Number(p.revenue_eur)) ? Number(p.revenue_eur) : null,
    entered_at: new Date().toISOString(),
  };
  data.traffic.unshift(row); data.traffic = data.traffic.slice(0, 20000);
  data.audit.unshift({ at: row.entered_at, action: 'traffic', id: row.id, page, views });
  save(data);
  return { ok: true, entry: row, note: 'Nur echte Zahlen eintragen. Erfundene Werte machen jede Auswertung wertlos.' };
}

// Ist-Zustand: was ist gemessen, was fehlt?
function overview(days) {
  const data = load();
  const since = new Date(Date.now() - (Number(days) || 30) * 86400000).toISOString().slice(0, 10);
  const rows = data.traffic.filter((r) => r.date >= since);
  const pages = {}; const channels = {}; const sides = {};
  for (const r of rows) {
    const p = (pages[r.page] = pages[r.page] || { views: 0, visitors: 0, clicks: 0, conversions: 0, revenue_eur: 0, days: new Set() });
    p.views += r.views; p.visitors += r.visitors || 0; p.clicks += r.clicks || 0; p.conversions += r.conversions || 0; p.revenue_eur += r.revenue_eur || 0; p.days.add(r.date);
    channels[r.channel] = (channels[r.channel] || 0) + r.views;
    if (r.side_product) sides[r.side_product] = (sides[r.side_product] || 0) + r.views;
  }
  const pageRows = Object.entries(pages).map(([page, v]) => ({ page, views: v.views, visitors: v.visitors, clicks: v.clicks, conversion_rate: v.views ? Math.round((v.conversions / v.views) * 10000) / 100 : null, revenue_eur: Math.round(v.revenue_eur * 100) / 100, days_measured: v.days.size })).sort((a, b) => b.views - a.views);
  return {
    ok: true, days: Number(days) || 30, entries: rows.length,
    totals: { views: pageRows.reduce((a, p) => a + p.views, 0), visitors: pageRows.reduce((a, p) => a + p.visitors, 0), clicks: pageRows.reduce((a, p) => a + p.clicks, 0), revenue_eur: Math.round(pageRows.reduce((a, p) => a + p.revenue_eur, 0) * 100) / 100 },
    pages: pageRows.slice(0, 50), channels, side_products: sides,
    measured: rows.length > 0,
    honesty: rows.length ? 'Alle Zahlen sind eingetragene Messwerte.' : 'Keine Messwerte im Zeitraum — hier steht bewusst nichts statt einer Schätzung.',
    sources: SOURCES,
  };
}

// Analyse einer Zeitreihe: Trend, Wachstum, Ausreißer, Wochentag.
function series(values) {
  const v = values.map(Number).filter((x) => Number.isFinite(x));
  if (v.length < 3) return { ok: false, error: 'zu wenige Punkte (mindestens 3)' };
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 0;
  const ma7 = v.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, n);
  // Regression
  const xs = v.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (v[i] - mean), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  const first = v.slice(0, Math.max(1, Math.floor(n / 3))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(n / 3));
  const last = v.slice(-Math.max(1, Math.floor(n / 3))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(n / 3));
  const growth = first ? (last - first) / first : null;
  const outliers = v.map((x, i) => ({ i, x, z: sd ? Math.abs(x - mean) / sd : 0 })).filter((o) => o.z > 2);
  return {
    ok: true, n, mean: Math.round(mean * 100) / 100, sd: Math.round(sd * 100) / 100,
    moving_avg_7: Math.round(ma7 * 100) / 100, slope: Math.round(slope * 1000) / 1000,
    growth_rate: growth === null ? null : Math.round(growth * 1000) / 1000,
    trend: slope > 0.05 * (mean || 1) ? 'STEIGEND' : slope < -0.05 * (mean || 1) ? 'FALLEND' : 'SEITWÄRTS',
    acceleration: n >= 6 ? Math.round(((v.slice(-3).reduce((a, b) => a + b, 0) - v.slice(-6, -3).reduce((a, b) => a + b, 0)) / 3) * 100) / 100 : null,
    outliers, volatility: mean ? Math.round((sd / mean) * 1000) / 1000 : null,
  };
}

// Verkehrsanalyse je Seite aus den eigenen Messwerten.
function analyze(input) {
  const data = load();
  const p = input || {};
  const page = String(p.page || '').trim();
  if (!page) return { ok: false, error: 'page fehlt' };
  const rows = data.traffic.filter((r) => r.page === page).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!rows.length) return { ok: false, error: `für "${page}" gibt es keine Messwerte — zuerst eintragen (POST /api/analytics/traffic)`, honesty: 'Ohne Daten keine Analyse.' };
  const daily = [];
  for (const r of rows) { const d = daily.find((x) => x.date === r.date); if (d) d.views += r.views; else daily.push({ date: r.date, views: r.views }); }
  const s = series(daily.map((d) => d.views));
  const weekday = {};
  for (const d of daily) { const w = new Date(d.date + 'T12:00:00Z').getUTCDay(); weekday[w] = (weekday[w] || 0) + d.views; }
  return {
    ok: true, page, points: daily.length, daily,
    analysis: s,
    weekday_totals: weekday,
    best_day: daily.slice().sort((a, b) => b.views - a.views)[0] || null,
    interpretation: s.ok ? `${s.trend} · Wachstum ${s.growth_rate === null ? 'nicht messbar' : (s.growth_rate * 100).toFixed(1) + ' %'} · Streuung ${(s.volatility * 100).toFixed(1)} %` : 'zu wenig Daten',
    note: 'Alles aus eingetragenen Messwerten. Keine Hochrechnung ohne Datenbasis.',
  };
}

// ---------------------------------------------------------------- Marktcharts
// Eintrag: eine Woche, eine Position, ein Titel. Mehr braucht es nicht.
function chartEntry(input) {
  const data = load();
  const p = input || {};
  const week = String(p.week || '').slice(0, 10);
  const title = String(p.title || '').trim();
  const position = Number(p.position);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { ok: false, error: 'week (JJJJ-MM-TT, Wochenstart) fehlt' };
  if (!title) return { ok: false, error: 'title fehlt' };
  if (!Number.isInteger(position) || position < 1 || position > 500) return { ok: false, error: 'position muss 1…500 sein' };
  const row = { id: 'ch-' + Math.random().toString(16).slice(2, 10), week, position, title, genre: String(p.genre || 'unbekannt'), chart: String(p.chart || 'eigene Liste'), entered_at: new Date().toISOString() };
  data.charts.unshift(row); data.charts = data.charts.slice(0, 20000);
  data.audit.unshift({ at: row.entered_at, action: 'chart', week, position, title });
  save(data);
  return { ok: true, entry: row };
}

function chartAnalysis(filter) {
  const data = load();
  const f = filter || {};
  let rows = data.charts;
  if (f.chart) rows = rows.filter((r) => r.chart === f.chart);
  if (f.genre) rows = rows.filter((r) => r.genre === f.genre);
  if (!rows.length) return { ok: false, error: 'keine Chart-Einträge vorhanden', honesty: 'Ohne Chart-Daten keine Trendaussage.' };
  const byTitle = {};
  for (const r of rows) { (byTitle[r.title] = byTitle[r.title] || []).push(r); }
  const titles = Object.entries(byTitle).map(([title, list]) => {
    const sorted = list.slice().sort((a, b) => (a.week < b.week ? -1 : 1));
    const positions = sorted.map((x) => x.position);
    const best = Math.min(...positions);
    const weeks = sorted.length;
    const half = Math.max(1, Math.floor(weeks / 2));
    const firstAvg = positions.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const lastAvg = positions.slice(-half).reduce((a, b) => a + b, 0) / half;
    return {
      title, genre: sorted[sorted.length - 1].genre, weeks_on_chart: weeks, best_position: best,
      current_position: positions[positions.length - 1],
      direction: lastAvg < firstAvg - 1 ? 'STEIGT' : lastAvg > firstAvg + 1 ? 'FÄLLT' : 'HÄLT',
      velocity: Math.round((firstAvg - lastAvg) * 10) / 10,
      new_entry: weeks >= 1 && sorted[sorted.length - 1].position <= 100 && weeks <= 3,
    };
  }).sort((a, b) => b.velocity - a.velocity);

  const weeks = [...new Set(rows.map((r) => r.week))].sort();
  const newPerWeek = weeks.map((w) => ({ week: w, new_entries: rows.filter((r) => r.week === w && r.position <= 100).length }));
  const recent = newPerWeek.slice(-4);
  const before = newPerWeek.slice(-8, -4);
  const entryRate = before.length ? (recent.reduce((a, x) => a + x.new_entries, 0) / recent.length) / ((before.reduce((a, x) => a + x.new_entries, 0) / before.length) || 1) : null;

  const genres = {};
  for (const t of titles) { const g = (genres[t.genre] = genres[t.genre] || { titles: 0, avg_velocity: 0, rising: 0 }); g.titles++; g.avg_velocity += t.velocity; if (t.direction === 'STEIGT') g.rising++; }
  for (const g of Object.values(genres)) g.avg_velocity = Math.round((g.avg_velocity / g.titles) * 10) / 10;

  return {
    ok: true, entries: rows.length, titles: titles.length, weeks: weeks.length,
    rising: titles.filter((t) => t.direction === 'STEIGT').slice(0, 15),
    falling: titles.filter((t) => t.direction === 'FÄLLT').slice(0, 8),
    new_entries: titles.filter((t) => t.new_entry).slice(0, 15),
    genres: Object.fromEntries(Object.entries(genres).sort((a, b) => b[1].avg_velocity - a[1].avg_velocity)),
    entry_rate_change: entryRate === null ? null : Math.round(entryRate * 100) / 100,
    entry_rate_note: entryRate === null ? 'zu wenige Wochen für einen Vergleich' : (entryRate > 1.1 ? 'mehr Neueinstiege als vorher — der Markt bewegt sich schneller' : entryRate < 0.9 ? 'weniger Neueinstiege — der Markt ist festgefahren' : 'Neueinstiege etwa gleich'),
    note: 'Aus eingetragenen Chart-Zeilen gerechnet. Keine Plattform wird abgefragt oder ausgelesen.',
  };
}

// ---------------------------------------------------------------- Vorhersage
// Drei Verfahren, jedes mit Namen, Verfahren, Spanne und Grenzen. Nie eine einzelne Wunschzahl.
function forecast(input) {
  const data = load();
  const p = input || {};
  const page = String(p.page || '').trim();
  const weeks = Math.min(26, Math.max(1, Number(p.weeks) || 4));
  if (!page) return { ok: false, error: 'page fehlt' };
  const rows = data.traffic.filter((r) => r.page === page).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (rows.length < 7) return { ok: false, error: `für "${page}" gibt es nur ${rows.length} Messpunkte — für eine Vorhersage braucht es mindestens 7 Tage`, honesty: 'Ohne Datenbasis wird nicht gerechnet. Eine Vorhersage aus dem Nichts wäre Theater.' };
  const daily = [];
  for (const r of rows) { const d = daily.find((x) => x.date === r.date); if (d) d.views += r.views; else daily.push({ date: r.date, views: r.views }); }
  const s = series(daily.map((d) => d.views));
  const last = daily[daily.length - 1].views;
  const horizon = weeks * 7;

  const trendVal = Math.max(0, last + s.slope * horizon);
  const growth = s.growth_rate === null ? 0 : s.growth_rate;
  const avgVal = Math.max(0, s.moving_avg_7 * Math.pow(1 + growth / daily.length, horizon));
  // Saison: auf den Wochentag des Zieltags
  const weekdayValues = {};
  for (const d of daily) { const w = new Date(d.date + 'T12:00:00Z').getUTCDay(); (weekdayValues[w] = weekdayValues[w] || []).push(d.views); }
  const wdAvg = (w) => (weekdayValues[w] && weekdayValues[w].length ? weekdayValues[w].reduce((a, b) => a + b, 0) / weekdayValues[w].length : s.mean);
  const seasonVal = wdAvg(new Date(Date.now() + horizon * 86400000).getUTCDay());

  const values = [trendVal, avgVal, seasonVal].filter((x) => Number.isFinite(x));
  const low = Math.round(Math.min(...values) * (1 - Math.min(0.5, s.volatility || 0.2)));
  const high = Math.round(Math.max(...values) * (1 + Math.min(0.5, s.volatility || 0.2)));
  const prediction = {
    id: 'fc-' + Math.random().toString(16).slice(2, 10),
    at: new Date().toISOString(), page, weeks_ahead: weeks, basis_points: daily.length,
    methods: {
      trend_line: { value: Math.round(trendVal), ...METHODS.trend_line },
      moving_avg: { value: Math.round(avgVal), ...METHODS.moving_avg },
      season: { value: Math.round(seasonVal), ...METHODS.season },
    },
    range: { low, high, unit: 'Aufrufe je Tag' },
    confidence: s.n >= 21 ? 'mittel (drei Wochen Daten)' : s.n >= 14 ? 'niedrig-mittel (zwei Wochen)' : 'niedrig (weniger als zwei Wochen)',
    caveats: ['Keine Vorhersage ist ein Versprechen.', 'Werbung, Release oder Ausfall verändert alles — die Spanne ist deshalb breit gehalten.', 'Bei unter zwei Wochen Daten ist die Saisonannahme schwach.'],
    honesty: 'Gerechnet aus eigenen Messwerten, nicht geschätzt.',
  };
  data.forecasts.unshift(prediction); data.forecasts = data.forecasts.slice(0, 500);
  data.audit.unshift({ at: prediction.at, action: 'forecast', page, weeks });
  save(data);
  return { ok: true, forecast: prediction };
}

// Trendlage gesamt: was sollte man als Nächstes machen? Immer mit Begründung und Quelle.
function trendBriefing(input) {
  const data = load();
  const p = input || {};
  const charts = chartAnalysis({ genre: p.genre });
  const ov = overview(p.days || 30);
  const risingGenres = charts.ok ? Object.entries(charts.genres).slice(0, 3) : [];
  const risingTitles = charts.ok ? charts.rising.slice(0, 5) : [];
  return {
    ok: true,
    at: new Date().toISOString(),
    traffic: { measured: ov.measured, views: ov.totals.views, top_pages: ov.pages.slice(0, 5) },
    charts: charts.ok ? { weeks: charts.weeks, rising: risingTitles.map((t) => ({ title: t.title, genre: t.genre, velocity: t.velocity })), entry_rate_note: charts.entry_rate_note } : { note: charts.error },
    recommendation: risingGenres.length
      ? `Aufmerksamkeit auf ${risingGenres.map((g) => g[0]).join(', ')} — dort steigen Titel am schnellsten (${risingGenres[0][1].avg_velocity > 0 ? '+' : ''}${risingGenres[0][1].avg_velocity} Plätze/Woche im Mittel).`
      : 'Keine Chart-Daten — Empfehlung erst nach Eintragen echter Chart-Zeilen.',
    guardrail: 'Diese Empfehlung ist eine Auswertung eingetragener Zahlen. Sie ersetzt keine Entscheidung und erzeugt keine Reichweite.',
  };
}

function status() {
  const d = load();
  return {
    area: 'ANA', module: 'analytics_forecast', state: 'live', file: FILE,
    traffic_entries: d.traffic.length, chart_entries: d.charts.length, forecasts: d.forecasts.length,
    sources: SOURCES.map((s) => ({ id: s.id, state: s.state })),
    methods: Object.keys(METHODS),
    rules: ['Nur echte, eingetragene Zahlen — keine Schätzung, keine Hochrechnung aus dem Nichts.', 'Jede Vorhersage nennt Verfahren, Spanne, Datenbasis und Grenzen.', 'Keine Plattform wird abgefragt oder ausgelesen; Exporte und eigene Messungen sind die Quelle.', 'Trendempfehlungen sind Auswertungen, keine Versprechen.'],
  };
}

module.exports = {
  meta: { area: 'ANA', id: 'analytics_forecast', name: 'Analyse (Verkehr, Nebenprodukte, Charts, Trendvorhersage)', state: 'live' },
  actions: { status: () => status(), sources: () => ({ ok: true, sources: SOURCES, methods: METHODS }), traffic: (p) => traffic(p || {}), overview: (p) => overview((p || {}).days), analyze: (p) => analyze(p || {}), chart: (p) => chartEntry(p || {}), charts: (p) => chartAnalysis(p || {}), forecast: (p) => forecast(p || {}), briefing: (p) => trendBriefing(p || {}) },
  SOURCES, METHODS, traffic, overview, analyze, series, chartEntry, chartAnalysis, forecast, trendBriefing, status,
};
