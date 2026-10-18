'use strict';
// Unit tests für die optionale Ollama-Anbindung von J.A.R.V.I.S.
// Lauf: node --test test/jarvis_llm.test.js
// Kein laufender Server nötig. Ein Fake-Ollama läuft im selben Prozess.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BACKEND = require('path').join(__dirname, '..', 'backend');
const llm = require(BACKEND + '/src/lib/ollama_llm');
const jarvis = require(BACKEND + '/src/lib/jarvis');
const repair = require(BACKEND + '/src/lib/repair');

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
    assert.strictEqual(seen.options.num_predict, 120);
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

test('Repair-Runbooks: lokale Ollama formuliert die Schritte, Befehle bleiben aus dem Runbook', async () => {
  let chatRequest = null;
  const fake = await fakeOllama((req, body, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'phi3:mini' }] }));
    if (req.url === '/api/chat') {
      chatRequest = JSON.parse(body);
      return res.end(JSON.stringify({ message: { role: 'assistant', content: '1. Prüfe das installierte Modell.\n2. Vergleiche den Namen mit der lokalen Liste.\n3. Setze den richtigen Modellnamen.\n4. Prüfe JARVIS erneut.' } }));
    }
    res.statusCode = 404; res.end('{}');
  });
  try {
    process.env.OLLAMA_URL = fake.url;
    process.env.OLLAMA_MODEL = 'phi3:mini';
    const advice = await repair.advise({ fehler: 'JARVIS meldet Modell nicht gefunden' });
    assert.strictEqual(advice.mode, 'LOCAL-LLM · ollama:phi3:mini');
    assert.strictEqual(advice.steps.length, 4);
    assert.strictEqual(advice.steps[0].text, 'Prüfe das installierte Modell.');
    assert.ok(advice.steps[0].commands.length > 0);
    assert.ok(chatRequest && chatRequest.options.num_predict === 120);
  } finally { fake.srv.close(); }
});

test('Repair-Runbooks: deutsche Befehle, deterministischer Fallback und nur lesender Snapshot', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-repair-readonly-'));
  const keys = ['AURA_LOG', 'AURA_VALIDATE_RESULT', 'AURA_SECURITY_FILE', 'OLLAMA_URL', 'OLLAMA_MODEL'];
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;
    process.env.AURA_LOG = path.join(tmp, 'missing.log');
    process.env.AURA_VALIDATE_RESULT = path.join(tmp, 'missing-validate.json');
    process.env.AURA_SECURITY_FILE = path.join(tmp, 'missing-incidents.json');
    const status = await repair.status();
    assert.strictEqual(status.mode, 'READ_ONLY_LOCAL_REPAIR_STATUS');
    assert.strictEqual(status.log.available, false);
    assert.match(status.log.message, /Keine Berechtigung|nicht vorhanden/i);
    assert.strictEqual(status.validate.available, false);
    assert.ok(status.runbooks.length >= 9);
    const resultFile = path.join(tmp, 'last-validate.json');
    fs.writeFileSync(resultFile, JSON.stringify({ at: '2026-10-18T12:00:00.000Z', pass: 338, fail: 0 }));
    process.env.AURA_VALIDATE_RESULT = resultFile;
    const savedStatus = await repair.status();
    assert.strictEqual(savedStatus.validate.summary, '338 pass / 0 fail');
    assert.strictEqual(savedStatus.validate.at, '2026-10-18T12:00:00.000Z');
    const advice = await repair.advise({ fehler: 'JARVIS meldet: Modell nicht gefunden' });
    assert.ok(advice.runbooks.some((item) => item.id === 'modell-nicht-gefunden'));
    assert.ok(advice.steps.length >= 3);
    assert.ok(advice.steps.some((step) => step.commands.some((command) => /ollama list/.test(command))));
    assert.strictEqual(advice.mode, 'DETERMINISTIC-RUNBOOK · ohne lokales LLM');
    assert.strictEqual(advice.boundary, 'Nichts wurde ausgeführt — der Mensch führt jeden Schritt selbst aus.');
    for (const key of ['missing.log', 'missing-validate.json', 'missing-incidents.json']) assert.strictEqual(fs.existsSync(path.join(tmp, key)), false, key + ' darf nicht angelegt werden');
  } finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
