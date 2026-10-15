'use strict';
// hello-tool — Referenzimplementierung des AURA-Modulvertrags (Area 70).
// Vertrag: initialize(context) · getCapabilities() · execute(action, input, context)
//          · healthCheck() · shutdown()
// Dieser Code läuft NACH Manifest-Validierung, Approval und Rechteprüfung.

let startedAt = null;
let calls = 0;

module.exports = {
  initialize(context) {
    startedAt = new Date().toISOString();
    if (context.log) context.log('INFO', 'hello-tool initialized', { config: context.config });
    if (context.audit) context.audit('module_initialized', { version: context.module.version });
    return { ok: true, started_at: startedAt };
  },

  getCapabilities() {
    return ['greet', 'stats'];
  },

  execute(action, input, context) {
    calls++;
    if (action === 'greet') {
      const name = String((input && input.name) || 'world').slice(0, 80);
      let text = (context.config.greeting || 'Hello') + ', ' + name + '!';
      if (context.config.loud) text = text.toUpperCase();
      if (context.store) {
        const n = (context.store.get('greets') || 0) + 1;
        context.store.set('greets', n);
      }
      return { ok: true, message: text, greets_stored: context.store ? context.store.get('greets') : null };
    }
    if (action === 'stats') {
      return {
        ok: true,
        started_at: startedAt,
        calls_this_session: calls,
        system: context.health ? context.health() : 'health:read nicht deklariert',
        note: 'über den permission-gatewayten AURA-Kontext — keine Secrets, nur definierte APIs',
      };
    }
    throw Object.assign(new Error('unknown action "' + action + '"'), { code: 404 });
  },

  healthCheck(context) {
    return { ok: true, connected: true, uptime_since: startedAt, config_fields: Object.keys(context.config || {}) };
  },

  shutdown(context) {
    if (context.log) context.log('INFO', 'hello-tool shutdown');
    startedAt = null;
    return { ok: true };
  },
};
