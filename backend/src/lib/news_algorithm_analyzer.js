'use strict';
// 21 · Daily news / algorithm analyzer — analyzes a FEED PAYLOAD supplied by
// the caller (no fetching in sandbox; no browser-stealth logic, per review notes).
function analyze(p) {
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) throw Object.assign(new Error('items[] required (title, url, published_at)'), { code: 400 });
  const now = Date.now(), windowDays = Number(p.window_days) || 7;
  const fresh = [], stale = [], bad = [];
  for (const it of items) {
    if (!it || typeof it.title !== 'string' || typeof it.url !== 'string') { bad.push(it); continue; }
    const t = Date.parse(it.published_at || '');
    if (Number.isNaN(t)) { bad.push(it); continue; }
    (now - t <= windowDays * 86400000 ? fresh : stale).push({ title: it.title.slice(0, 120), url: it.url, age_days: Math.round((now - t) / 86400000) });
  }
  return { window_days: windowDays, fresh: fresh.length, stale: stale.length, invalid: bad.length, summary: fresh.slice(0, 10), policy: 'curated sources only; human-reviewable summaries; no auto-mutation of stealth/evasion logic' };
}

module.exports = {
  meta: { area: '21', id: 'news_algorithm_analyzer', name: 'Daily news / algorithm analyzer', state: 'live' },
  analyze,
  status: () => ({ fetches: false, input: 'caller-supplied feed payload' }),
  actions: { analyze: (p) => analyze(p), status: () => module.exports.status() },
};
