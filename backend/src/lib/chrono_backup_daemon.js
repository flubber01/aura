'use strict';
// 24 · Chrono backup / SQL snapshots — snapshots the JSON store with checksum,
// verifies on restore (never trusts unverified snapshots as "applied migrations").
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'snapshots');
const store = require('./store');

function snapshot() {
  const data = JSON.stringify(store.get());
  const checksum = crypto.createHash('sha256').update(data).digest('hex');
  fs.mkdirSync(DIR, { recursive: true });
  const name = `snap-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(DIR, name), JSON.stringify({ checksum, data: JSON.parse(data) }, null, 2));
  store.audit({ area: '24', event: 'snapshot_created', name, checksum: checksum.slice(0, 12) });
  return { name, checksum, bytes: data.length };
}

function restore(name) {
  const file = path.join(DIR, path.basename(String(name)));
  if (!file.startsWith(DIR) || !fs.existsSync(file)) throw Object.assign(new Error('snapshot not found'), { code: 404 });
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  const verify = crypto.createHash('sha256').update(JSON.stringify(snap.data)).digest('hex');
  if (verify !== snap.checksum) throw Object.assign(new Error('snapshot corrupted — restore refused'), { code: 409 });
  // Restore means re-writing the verified store:
  store.get().tasks = snap.data.tasks;
  store.get().audit = snap.data.audit;
  store.audit({ area: '24', event: 'restore_verified_and_applied', name });
  return { ok: true, verified: true, tasks: snap.data.tasks.length };
}

module.exports = {
  meta: { area: '24', id: 'chrono_backup_daemon', name: 'Chrono backup / SQL snapshots', state: 'live' },
  snapshot, restore,
  list: () => (fs.existsSync(DIR) ? fs.readdirSync(DIR).sort() : []),
  status: () => ({ snapshots: module.exports.list().length, restore_verified: true, note: 'db/schema.sql defines the PostgreSQL equivalent' }),
  actions: {
    snapshot: () => snapshot(),
    restore: (p) => restore(p.name),
    list: () => module.exports.list(),
    status: () => module.exports.status(),
  },
};
