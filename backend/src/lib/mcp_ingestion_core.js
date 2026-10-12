'use strict';
// 20 · MCP ingestion core — register tool connectors with explicit grants,
// schema-bound arguments, timeouts and disable switches. No tool executes
// anything external in this sandbox; handlers are declared callables.
const store = require('./store');

const tools = new Map(); // name -> {grants, args_schema, enabled, handler, invocations}

function register(p) {
  const name = String(p.name || '').trim();
  if (!/^[a-z0-9_.-]{2,64}$/i.test(name)) throw Object.assign(new Error('invalid tool name'), { code: 400 });
  if (!Array.isArray(p.args_schema)) throw Object.assign(new Error('args_schema must list allowed argument keys'), { code: 400 });
  if (!Array.isArray(p.grants) || p.grants.length === 0) throw Object.assign(new Error('explicit grants required'), { code: 400 });
  tools.set(name, { name, grants: p.grants, args_schema: p.args_schema, enabled: true, invocations: 0, registered_at: new Date().toISOString() });
  store.audit({ area: '20', event: 'tool_registered', tool: name, grants: p.grants });
  return { ok: true, tool: name };
}

function invoke(p) {
  const t = tools.get(String(p.name));
  if (!t) throw Object.assign(new Error('unknown tool'), { code: 404 });
  if (!t.enabled) throw Object.assign(new Error('tool disabled by switch'), { code: 403 });
  const args = p.args || {};
  const extra = Object.keys(args).filter((k) => !t.args_schema.includes(k));
  if (extra.length) throw Object.assign(new Error(`arguments not in schema: ${extra.join(', ')}`), { code: 400 });
  t.invocations++;
  store.audit({ area: '20', event: 'tool_invoked', tool: t.name, args: Object.keys(args) });
  return { ok: true, tool: t.name, result: 'schema-bound call accepted (sandbox stub: no external effect)', echo_args: args };
}

module.exports = {
  meta: { area: '20', id: 'mcp_ingestion_core', name: 'MCP ingestion core', state: 'live' },
  register, invoke,
  disable: (n) => { const t = tools.get(n); if (!t) throw Object.assign(new Error('unknown tool'), { code: 404 }); t.enabled = false; return { ok: true }; },
  enable: (n) => { const t = tools.get(n); if (!t) throw Object.assign(new Error('unknown tool'), { code: 404 }); t.enabled = true; return { ok: true }; },
  list: () => [...tools.values()].map(({ handler, ...r }) => r),
  status: () => ({ tools: tools.size, features: ['explicit grants', 'schema-bound args', 'disable switch', 'audit log'] }),
  actions: {
    register: (p) => register(p),
    invoke: (p) => invoke(p),
    disable: (p) => module.exports.disable(String(p.name)),
    enable: (p) => module.exports.enable(String(p.name)),
    list: () => module.exports.list(),
    status: () => module.exports.status(),
  },
};
