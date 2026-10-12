'use strict';
// 23 · Swarm / cross-platform sync — LOCAL checkpoint export/import with
// sha256 checksums (no external nodes in sandbox). Idempotent imports.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'checkpoints');

function exportCheckpoint() {
  const payload = {
    exported_at: new Date().toISOString(),
    tasks_hash: crypto.createHash('sha256').update(JSON.stringify(require('./store').get().tasks)).digest('hex'),
    modules_hash: crypto.createHash('sha256').update(JSON.stringify(require('./registry').status().map((m) => m.area + m.state))).digest('hex'),
  };
  payload.checksum = crypto.createHash('sha256').update(JSON.stringify({ ...payload })).digest('hex');
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `checkpoint-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return { file: path.basename(file), checksum: payload.checksum };
}

function importCheckpoint(name) {
  const file = path.join(DIR, path.basename(String(name)));
  if (!file.startsWith(DIR)) throw Object.assign(new Error('bad name'), { code: 400 });
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { checksum, ...rest } = payload;
  const verify = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
  if (verify !== checksum) throw Object.assign(new Error('checksum mismatch — refusing import'), { code: 409 });
  return { ok: true, verified: true, checkpoint: path.basename(file) };
}

module.exports = {
  meta: { area: '23', id: 'swarm_sync_daemon', name: 'Swarm / cross-platform sync', state: 'live' },
  exportCheckpoint, importCheckpoint,
  list: () => (fs.existsSync(DIR) ? fs.readdirSync(DIR).sort() : []),
  status: () => ({ checkpoints: module.exports.list().length, transport: 'local files (sandbox)', conflict_resolution: 'checksum-verified import' }),
  actions: {
    export: () => exportCheckpoint(),
    import: (p) => importCheckpoint(p.name),
    list: () => module.exports.list(),
    status: () => module.exports.status(),
  },
};
