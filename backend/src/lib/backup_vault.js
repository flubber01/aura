'use strict';
// AURA Area 64 — Backup Vault: verified on-disk snapshots of every watched
// data file (written by the txt watcher on each validated change + at boot),
// with integrity verification and one-call restore. Live data lives in 59;
// this area exposes the vault surface.
const watcher = require('./txt_watcher');

module.exports = {
  meta: { area: '64', id: 'backup_vault', name: 'Backup Vault (verified snapshots + restore)', state: 'live' },
  backups: watcher.backups,
  restore: watcher.restore,
  actions: {
    status: () => {
      const b = watcher.backups();
      return { snapshots: b.count, verified: b.verified, dir: b.dir, newest: b.backups[0] || null };
    },
  },
};
