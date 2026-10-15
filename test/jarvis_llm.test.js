'use strict';
// Unit tests für die optionale Ollama-Anbindung von J.A.R.V.I.S.
// Lauf: node --test test/jarvis_llm.test.js
// Kein laufender Server nötig. Ein Fake-Ollama läuft im selben Prozess.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

const BACKEND = require('path').join(__dirname, '..', 'backend');
const llm = require(BACKEND + '/src/lib/ollama_llm');
const jarvis = require(BACKEND + '/src/lib/jarvis');

function fakeOllama(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => handler(req, b, res));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port }));
  });
}

test.beforeEach(() => { delete process.env.OLLAMA_URL; delete process.env.OLLAMA_MODEL; });
test.afterEach(() => { delete process.env.OLLAMA_URL; delete process.env.OLLAMA_MODEL; });

test('ohne OLLAMA_URL: Engine antwortet, Modus LIVE, llm.used=false', async () => {
  const out = await jarvis.askAsync('status');
  assert.strictEqual(out.llm.used, false);
  assert.strictEqual(out.mode, 'LIVE');
  assert.ok(out.reply.length > 0);
});

test('nur http/https werden akzeptiert', () => {
  process.env.OLLAMA_URL = 'ftp://evil.example';
  assert.strictEqual(llm.cfg().configured, false);
  process.env.OLLAMA_URL = 'not a url';
  assert.strictEqual(llm.cfg().configured, false);
  process.env.OLLAMA_URL = 'http://localhost:11434/irgendwas';
  assert.strictEqual(llm.cfg().configured, true);
  assert.strictEqual(llm.cfg().base, 'http://localhost:11434');
});

test('mit Fake-Ollama: Antwort kommt vom Modell, Fakten aus der Engine im Prompt', async () => {
  const engineReply = jarvis.ask('status').reply; // Referenz: reine Engine-Antwort
  let seen = null;
  const fake = await fakeOllama((req, body, res) => {
    if (req.url === '/api/chat') {
      seen = JSON.parse(body);
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ message: { role: 'assistant', content: 'Alles läuft, Sir.' } }));
    }
    res.statusCode = 404; res.end('{}');
  });
  try {
    process.env.OLLAMA_URL = fake.url;
    process.env.OLLAMA_MODEL = 'llama3.2';
    const out = await jarvis.askAsync('status');
    assert.strictEqual(out.reply, 'Alles läuft, Sir.');
    assert.strictEqual(out.mode, 'LOCAL-LLM · ollama:llama3.2');
    assert.strictEqual(out.llm.used, true);
    assert.strictEqual(seen.stream, false);
    assert.strictEqual(seen.model, 'llama3.2');
    const userMsg = seen.messages.find((m) => m.role === 'user').content;
    assert.ok(userMsg.includes('FAKTEN:'), 'Prompt enthält den FAKTEN-Block');
    assert.ok(userMsg.includes(engineReply.slice(0, 40)), 'Engine-Fakten stecken im Prompt');
    const sys = seen.messages.find((m) => m.role === 'system').content;
    assert.ok(/NUR die Fakten/.test(sys), 'System-Prompt verbietet Erfindungen');
  } finally { fake.srv.close(); }
});

test('Ollama-Fehler (HTTP 500): Fallback auf die Engine, Grund steht drin', async () => {
  const fake = await fakeOllama((req, body, res) => { res.statusCode = 500; res.end('boom'); });
  try {
    process.env.OLLAMA_URL = fake.url;
    const out = await jarvis.askAsync('status');
    assert.strictEqual(out.llm.used, false);
    assert.match(out.llm.reason, /HTTP 500/);
    assert.strictEqual(out.mode, 'LIVE');
    assert.ok(out.reply.length > 0);
  } finally { fake.srv.close(); }
});

test('leere Modellantwort: Fallback', async () => {
  const fake = await fakeOllama((req, body, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: { role: 'assistant', content: '   ' } }));
  });
  try {
    process.env.OLLAMA_URL = fake.url;
    const out = await jarvis.askAsync('status');
    assert.strictEqual(out.llm.used, false);
    assert.strictEqual(out.llm.reason, 'leere Antwort');
  } finally { fake.srv.close(); }
});

test('nicht erreichbarer Host: Fallback mit Verbindungsfehler', async () => {
  process.env.OLLAMA_URL = 'http://127.0.0.1:9'; // Port 9 (discard), nichts lauscht dort
  const out = await jarvis.askAsync('status');
  assert.strictEqual(out.llm.used, false);
  assert.ok(out.llm.reason.length > 0);
  assert.strictEqual(out.mode, 'LIVE');
});

test('llm.status: erreichbar, Modell vorhanden', async () => {
  const fake = await fakeOllama((req, body, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'llama3.2:latest' }] }));
    res.statusCode = 404; res.end('{}');
  });
  try {
    process.env.OLLAMA_URL = fake.url;
    process.env.OLLAMA_MODEL = 'llama3.2';
    const s = await llm.status();
    assert.strictEqual(s.configured, true);
    assert.strictEqual(s.reachable, true);
    assert.strictEqual(s.model_present, true);
  } finally { fake.srv.close(); }
});

test('llm.status ohne Konfiguration: ehrlich "nicht konfiguriert"', async () => {
  const s = await llm.status();
  assert.strictEqual(s.configured, false);
  assert.strictEqual(s.reachable, false);
  assert.ok(s.hint);
});
