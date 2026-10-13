'use strict';
// Beispielmodul „example-hello“. Zeigt den vollständigen Vertrag:
// initialize(ctx), getCapabilities(), execute(action, input, ctx), healthCheck(), shutdown().
// Keine externen Zugriffe. Rechte kommen aus aura.module.json und werden über ctx geprüft.

let started = false;

module.exports = {
  initialize(ctx) {
    started = true;
    ctx.log('Beispielmodul gestartet (Version ' + ctx.version + ')');
  },

  execute(action, input, ctx) {
    if (action === 'greet') {
      const text = ctx.config.greeting + ', ' + input.name + '!';
      if (ctx.audit) ctx.audit('greet', { name_length: String(input.name).length });
      return { text: ctx.config.shout ? text.toUpperCase() : text };
    }
    if (action === 'count_modules') {
      return { registry_entries: ctx.services.registry.counts().total };
    }
    throw new Error('unbekannte Aktion: ' + action);
  },

  healthCheck() {
    return started ? { status: 'ok', detail: 'Beispielmodul läuft' } : { status: 'fehler', detail: 'nicht initialisiert' };
  },

  shutdown() {
    started = false;
  },
};
