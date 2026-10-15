'use strict';
// AURA Dispatcher — the server core is a thin HTTP shell; ALL request logic
// lives in route modules loaded here. Each route module exports
//   { name, async handle(ctx) }  — handle() returns true when it responded.
// Order matters: core APIs -> area APIs -> pages -> (static fallback in server.js).
const ROUTE_MODULES = ['api_core', 'api_areas', 'pages_routes'];

const loaded = ROUTE_MODULES.map((n) => {
  const mod = require('./routes/' + n);
  if (typeof mod.handle !== 'function') throw new Error('route module ' + n + ' must export handle(ctx)');
  return { name: n, mod };
});

async function dispatch(ctx) {
  for (const r of loaded) {
    const handled = await r.mod.handle(ctx);
    if (handled === true) return true;
  }
  return false;
}

module.exports = { dispatch, modules: loaded.map((r) => r.name) };
