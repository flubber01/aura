'use strict';
// 22 · Local edge cache — bounded LRU with TTL. Volatile by design:
// this is cache, not durable storage (see inventory notes).
const MAX = 500;
const map = new Map(); // key -> {v, exp, last}

function prune() {
  const now = Date.now();
  for (const [k, e] of map) if (e.exp <= now) map.delete(k);
  while (map.size > MAX) map.delete(map.keys().next().value); // oldest inserted
}
module.exports = {
  meta: { area: '22', id: 'local_edge_cache', name: 'Local edge cache', state: 'live' },
  set(key, value, ttlSec = 300) {
    prune();
    map.set(key, { v: value, exp: Date.now() + ttlSec * 1000, last: Date.now() });
    return { ok: true, key, ttl_s: ttlSec };
  },
  get(key) {
    const e = map.get(key);
    if (!e) return { hit: false };
    if (e.exp <= Date.now()) { map.delete(key); return { hit: false, reason: 'expired' }; }
    e.last = Date.now();
    return { hit: true, value: e.v, expires_at: new Date(e.exp).toISOString() };
  },
  status() { prune(); return { entries: map.size, cap: MAX, durable: false }; },
  actions: {
    set: (p) => module.exports.set(String(p.key), p.value, Number(p.ttl_s) || 300),
    get: (p) => module.exports.get(String(p.key)),
    status: () => module.exports.status(),
  },
};
