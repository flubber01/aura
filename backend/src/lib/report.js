'use strict';
// Daily/on-demand report builder (previously inline in server.js).
const registry = require('./registry');
const store = require('./store');


function dailyReport() {
  const counts = registry.counts();
  return {
    generated_at: new Date().toISOString(),
    scheduler: 'on-demand (interval disabled by default)',
    modules: counts,
    tasks: { total: store.get().tasks.length, last_5: store.tasks().slice(0, 5).map((t) => ({ trace_id: t.trace_id, role: t.role, state: t.state })) },
    audit_recent: store.auditLog().slice(0, 5),
    note: 'Telemetry shown here is real backend state; demo dashboards in the UI remain simulations.',
  };
}
module.exports = { dailyReport };
