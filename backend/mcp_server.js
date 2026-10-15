#!/usr/bin/env node
'use strict';
// AURA as MCP SERVER (stdio transport) — installable into any MCP client
// (Claude Desktop, Cursor, …):
//   { "mcpServers": { "aura": { "command": "node", "args": ["backend/mcp_server.js"] } } }
// Speaks JSON-RPC 2.0 line-by-line on stdin/stdout, routes tool calls into
// the running AURA backend (AURA_URL, default http://localhost:8080).
// Every call is also counted by Area 72 (usage) via /api/mcp/builtin-used.
const readline = require('readline');

const BASE = (process.env.AURA_URL || 'http://localhost:8080').replace(/\/$/, '');

const TOOLS = [
  { name: 'aura_status', description: 'AURA registry: counts + live module list', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'aura_report', description: 'Daily report (live system data)', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'aura_workflows', description: 'All workflows (presets + custom)', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'aura_modulehub', description: 'Area 70 module hub status', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'aura_image_sim', description: 'Generate a SIMULATION-labeled demo image (no GPU backend needed)', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } }, required: ['prompt'] } },
  { name: 'aura_research', description: 'Deep research via live GitHub API fan-out', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'aura_content_draft', description: 'Content Forge: auto-create a draft via minion pipeline (human review required before any publish)', inputSchema: { type: 'object', properties: { brief: { type: 'string' }, type: { type: 'string' } }, required: ['brief'] } },
];

async function auraFetch(path, opts) {
  const res = await fetch(BASE + path, opts);
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
async function callTool(name, args) {
  try {
    if (name === 'aura_status') { const r = await auraFetch('/api/modules/live'); return r.json; }
    if (name === 'aura_report') { const r = await auraFetch('/api/report'); return r.json; }
    if (name === 'aura_workflows') { const r = await auraFetch('/api/workflows'); return r.json; }
    if (name === 'aura_modulehub') { const r = await auraFetch('/api/modulehub'); return r.json; }
    if (name === 'aura_image_sim') {
      const r = await auraFetch('/api/imagegen/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ engine: 'sim', ...args }) });
      return r.json;
    }
    if (name === 'aura_research') { const r = await auraFetch('/api/research?q=' + encodeURIComponent(String(args.query || 'ai').slice(0, 80))); return r.json; }
    if (name === 'aura_content_draft') {
      const r = await auraFetch('/api/content/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: args.brief, type: args.type }) });
      return r.json;
    }
    return { error: 'unknown tool ' + name };
  } catch (e) { return { error: String(e && e.message || e), hint: 'is the AURA backend running on ' + BASE + '?' }; }
}

async function handle(msg) {
  const reply = { jsonrpc: '2.0', id: msg.id ?? null };
  try {
    if (msg.method === 'initialize') {
      reply.result = { protocolVersion: msg.params?.protocolVersion || '2025-06-19', capabilities: { tools: {} }, serverInfo: { name: 'aura-mcp', version: '1.0.0' }, instructions: 'AURA command backend: status, report, workflows, modulehub, sim-images, research, content drafts. Publish actions are human-gated by design.' };
    } else if (msg.method === 'notifications/initialized') { return null; }
    else if (msg.method === 'tools/list') { reply.result = { tools: TOOLS }; }
    else if (msg.method === 'tools/call') {
      const result = await callTool(String(msg.params?.name), msg.params?.arguments || {});
      reply.result = { content: [{ type: 'text', text: JSON.stringify(result, null, 2).slice(0, 20000) }], isError: !!result.error };
    } else if (msg.method === 'ping') { reply.result = {}; }
    else { reply.error = { code: -32601, message: 'method not found: ' + msg.method }; }
  } catch (e) { reply.error = { code: -32603, message: String(e && e.message || e) }; }
  return reply;
}

readline.createInterface({ input: process.stdin }).on('line', async (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const reply = await handle(msg);
  if (reply) console.log(JSON.stringify(reply));
  // usage counter (best effort, silent)
  try { await fetch(BASE + '/api/mcp/builtin-used', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: msg.method }) }); } catch {}
});
process.stderr.write('AURA MCP server (stdio) ready — backend ' + BASE + '\n');
