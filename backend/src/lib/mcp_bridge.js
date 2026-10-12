#!/usr/bin/env node
'use strict';
// MCP Schnittstelle — line-protocol bridge: stdin JSON lines -> AURA backend.
// Usage: node mcp_bridge.js <area>
// stdin line:  {"action":"status"}  or  {"action":"list"} ...
// stdout line: backend JSON result. No external calls; inherits AURA_URL.
const AREA = process.argv[2] || '03';
const URLB = (process.env.AURA_URL || 'http://localhost:8080').replace(/\/$/, '');
const rl = require('readline');
rl.createInterface({ input: process.stdin }).on('line', async (line) => {
  try {
    const msg = JSON.parse(line);
    const res = await fetch(`${URLB}/api/modules/${AREA}/action/${msg.action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg.payload || {}),
    });
    console.log(JSON.stringify({ area: AREA, ok: res.ok, status: res.status, result: await res.json() }));
  } catch (e) {
    console.log(JSON.stringify({ area: AREA, ok: false, error: String(e && e.message || e) }));
  }
});
