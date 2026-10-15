'use strict';
// crash-dummy — bewusst fehlerhaftes Testmodul (Area 70 Isolationstests).

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = {
  initialize() { return { ok: true }; },

  getCapabilities() { return ['boom', 'slow', 'ok']; },

  async execute(action, input) {
    if (action === 'boom') throw new Error('crash-dummy: absichtlicher Crash (Isolationstest)');
    if (action === 'slow') { await sleep(30000); return { ok: true, note: 'nie erreichbar — Timeout vorher' }; }
    if (action === 'ok') return { ok: true, note: 'Kontroll-Aktion erfolgreich', echo: input || {} };
    throw Object.assign(new Error('unknown action "' + action + '"'), { code: 404 });
  },

  healthCheck() { return { ok: true, connected: true, note: 'crash-dummy bereit für Drills' }; },

  shutdown() { return { ok: true }; },
};
