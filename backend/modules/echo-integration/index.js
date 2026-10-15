'use strict';
// echo-integration — Beispiel für den ehrlichen Integrations-Adapter (Area 70).
// WICHTIG: ein registriertes Tool gilt NICHT automatisch als funktionierende
// externe Integration. healthCheck meldet deshalb ehrlich SIMULATION, solange
// kein echter, konfigurierter Dienst geprüft wurde.

module.exports = {
  initialize(context) {
    if (context.log) context.log('INFO', 'echo-integration initialized', { endpoint_configured: !!(context.config && context.config.endpoint) });
    return { ok: true };
  },

  getCapabilities() { return ['ping']; },

  execute(action, input, context) {
    if (action !== 'ping') throw Object.assign(new Error('unknown action "' + action + '"'), { code: 404 });
    const endpoint = (context.config && context.config.endpoint) || '';
    if (!endpoint) {
      return { ok: false, state: 'not-connected', note: 'Kein Endpunkt konfiguriert — es wurde NICHTS extern ausgeführt.' };
    }
    // Kein echter Netzwerkzugriff: ehrlich als Simulation melden statt Erfolg vortäuschen.
    return { ok: true, state: 'simulation', endpoint, echo: input || {}, note: 'SIMULATION: Demo-Daten, kein echter externer Aufruf. Erst mit echtem Adapter + Verbindungstest gilt die Integration als connected.' };
  },

  healthCheck(context) {
    const endpoint = (context.config && context.config.endpoint) || '';
    if (!endpoint) return { ok: true, connected: false, simulation: false, note: 'config-required: kein Endpunkt gesetzt' };
    return { ok: true, connected: false, simulation: true, note: 'SIMULATION: Endpunkt gesetzt, aber nicht echt verbunden/verifiziert' };
  },

  shutdown() { return { ok: true }; },
};
