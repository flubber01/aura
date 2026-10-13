'use strict';
// Beispiel-Integration im Simulationsmodus. Ruft nichts Externes auf.
// Ein Simulations-Modul darf sich nie als „verbunden“ ausgeben: connection bleibt „simulation“.

module.exports = {
  initialize(ctx) {
    ctx.log('Simulation gestartet. Keine externe Verbindung.');
  },

  execute(action, input, ctx) {
    if (action === 'ping') {
      // Geheimnis wird nur geprüft, nicht ausgegeben.
      const hasKey = !!ctx.getSecret('api_key');
      return { simulated: true, endpoint: ctx.config.endpoint, key_present: hasKey, note: 'Simulation: keine Anfrage gesendet' };
    }
    throw new Error('unbekannte Aktion: ' + action);
  },

  healthCheck() {
    return { status: 'simulation', detail: 'Simulation, kein Verbindungstest' };
  },

  shutdown() {},
};
