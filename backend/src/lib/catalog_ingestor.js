'use strict';
// 19 · Yellow Pages / catalog ingestor — normalizes tool/API catalog records
// from ingest/apis.txt, dedupes and validates URLs. NEVER fetches or executes
// anything a catalog lists (per inventory safety note).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', '..', 'ingest', 'apis.txt');

function ingest() {
  const lines = fs.readFileSync(FILE, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const seen = new Set(), records = [], rejected = [];
  for (const line of lines) {
    const [name, url, category] = line.split('|').map((s) => (s || '').trim());
    let u;
    try { u = new URL(url); } catch { rejected.push({ line, reason: 'invalid URL' }); continue; }
    if (!/^https?:$/.test(u.protocol)) { rejected.push({ line, reason: 'only http(s) allowed' }); continue; }
    const key = u.origin + u.pathname.replace(/\/$/, '');
    if (seen.has(key)) { rejected.push({ line, reason: 'duplicate' }); continue; }
    seen.add(key);
    records.push({ name, url: u.href, category: category || 'uncategorized', license: 'verify-before-use', provenance: 'ingest/apis.txt' });
  }
  return { records: records.length, rejected: rejected.length, items: records, rejected_lines: rejected };
}

module.exports = {
  meta: { area: '19', id: 'catalog_ingestor', name: 'Yellow Pages / catalog ingestor', state: 'live' },
  ingest,
  status: () => ({ source: 'ingest/apis.txt', executes_listed_scripts: false, fetches_urls: false }),
  actions: { ingest, status: () => module.exports.status() },
};
