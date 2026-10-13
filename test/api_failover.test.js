'use strict';
// Unit-Tests für den API-Failover.  Lauf: node --test test/api_failover.test.js
// Kein Internet nötig: Fake-Endpunkte laufen auf 127.0.0.1 im selben Prozess.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

const BACKEND = require('path').join(__dirname, '..', 'backend');
const fo = require(BACKEND + '/src/lib/api_failover');

function fake(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => handler(req, b, res));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}
const okOllama = (req, b, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message: { content: 'ollama-antwort' } })); };
const failHttp = (req, b, res) => { res.writeHead(500); res.end('boom'); };
const okOpenRouter = (req, b, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { content: 'openrouter-antwort' } }] }));
};
const emptyOpenRouter = (req, b, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ choices: [] })); };

const KEYS = ['OLLAMA_URL', 'OLLAMA_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_BASE_URL', 'OPENROUTER_MODEL', 'AURA_LLM_CHAIN', 'AURA_LLM_COOLDOWN_MS'];
const MSG = [{ role: 'user', content: 'hallo' }];
let servers = [];
const clean = () => { for (const k of KEYS) delete process.env[k]; fo.resetCooldowns(); };
test.beforeEach(clean);
test.afterEach(() => { clean(); for (const s of servers) s.srv.close(); servers = []; });

test('Primär fällt aus, Fallback antwortet', async () => {
  const ol = await fake(failHttp); const orr = await fake(okOpenRouter); servers.push(ol, orr);
  process.env.OLLAMA_URL = ol.url; process.env.OPENROUTER_API_KEY = 'test-key'; process.env.OPENROUTER_BASE_URL = orr.url + '/v1';
  const r = await fo.complete(MSG);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.endpoint, 'openrouter');
  assert.strictEqual(r.text, 'openrouter-antwort');
  assert.strictEqual(r.tried[0].id, 'ollama');
  assert.strictEqual(r.tried[0].ok, false);
});

test('Primär gesperrt (Cooldown) wird übersprungen', async () => {
  const ol = await fake(failHttp); const orr = await fake(okOpenRouter); servers.push(ol, orr);
  process.env.OLLAMA_URL = ol.url; process.env.OPENROUTER_API_KEY = 'k'; process.env.OPENROUTER_BASE_URL = orr.url + '/v1';
  await fo.complete(MSG);
  const r2 = await fo.complete(MSG);
  assert.strictEqual(r2.endpoint, 'openrouter');
  assert.deepStrictEqual(r2.tried[0], { id: 'ollama', skipped: 'cooldown' });
});

test('leere Antwort zählt als Fehler', async () => {
  const orr = await fake(emptyOpenRouter); servers.push(orr);
  process.env.OPENROUTER_API_KEY = 'k'; process.env.OPENROUTER_BASE_URL = orr.url + '/v1'; process.env.AURA_LLM_CHAIN = 'openrouter';
  const r = await fo.complete(MSG);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.tried[0].ok, false);
});

test('alle Endpunkte kaputt → ehrlicher Fehler, kein Wurf', async () => {
  const ol = await fake(failHttp); servers.push(ol);
  process.env.OLLAMA_URL = ol.url; process.env.AURA_LLM_CHAIN = 'ollama';
  const r = await fo.complete(MSG);
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /fehlgeschlagen/);
});

test('ohne Konfiguration: ok=false mit Hinweis', async () => {
  const r = await fo.complete(MSG);
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /keine Endpunkte/);
});

test('unverschlüsseltes Remote-Ziel wird nicht genutzt', async () => {
  process.env.OPENROUTER_API_KEY = 'k'; process.env.OPENROUTER_BASE_URL = 'http://example.com/v1';
  const s = fo.status();
  const or = s.chain.find((e) => e.id === 'openrouter');
  assert.ok(or, 'openrouter steht in der Liste');
  assert.strictEqual(or.configured, false); // http außerhalb localhost wird abgelehnt
});

test('Status zeigt keinen Schlüssel', async () => {
  process.env.OPENROUTER_API_KEY = 'SEHR-GEHEIM-123';
  process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
  const txt = JSON.stringify(fo.status());
  assert.ok(!txt.includes('SEHR-GEHEIM-123'));
});
