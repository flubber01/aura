'use strict';
// AURA Area 37 — Visual Agent Eyes / MCP Vision (LIVE, sicher redesign).
// Bildanalyse NUR mit explizitem Consent-Flag und nur an Bildern, die der
// Admin selbst übergibt (keine Screen-Captures, kein fremdes Material).
// Backend: lokales Ollama-Vision-Modell (llava-Familie) — ehrlicher Status.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'vision.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { analyses: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

async function analyze(body) {
  const b = body || {};
  if (b.consent !== true) { const e = new Error('consent=true ist Pflicht — Bildanalyse nur mit expliziter Einwilligung des Admins'); e.code = 400; throw e; }
  const image = String(b.image_base64 || '').slice(0, 8_000_000);
  const imageUrl = String(b.image_url || '').slice(0, 500);
  const prompt = String(b.prompt || 'Beschreibe das Bild sachlich.').slice(0, 500);
  if (!image && !imageUrl) { const e = new Error('image_base64 oder image_url angeben'); e.code = 400; throw e; }
  const ollama = require('./ollama_manager');
  const p = await ollama.probe(1200);
  if (p.state !== 'LIVE') {
    const db = load();
    db.analyses.push({ id: 'vis-' + Date.now().toString(36), state: p.state, at: new Date().toISOString(), note: 'angefragt, wartet auf Vision-Backend' });
    if (db.analyses.length > 300) db.analyses = db.analyses.slice(-300);
    save(db);
    return { ok: false, state: p.state, note: 'ehrlich: ohne laufendes Ollama (llava) keine Analyse — auf deinem Host läuft sie wirklich' };
  }
  const http = require('http');
  const u = new URL(ollama.load().url || 'http://127.0.0.1:11434');
  return new Promise((resolve) => {
    const req = http.request({ hostname: u.hostname, port: u.port || 11434, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 120000 }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const db = load();
          db.analyses.push({ id: 'vis-' + Date.now().toString(36), state: 'LIVE', at: new Date().toISOString(), chars: (j.response || '').length });
          save(db);
          resolve({ ok: res.statusCode === 200, state: 'LIVE', description: (j.response || '').slice(0, 2000) });
        } catch { resolve({ ok: false, state: 'LIVE', error: 'Antwort nicht lesbar' }); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ ok: false, state: 'NOT-CONNECTED', error: e.message }));
    req.write(JSON.stringify({ model: 'llava-phi3', prompt, images: image ? [image] : undefined, stream: false }));
    req.end();
  });
}
function history() { return load().analyses.slice().reverse().slice(0, 50); }
function status() {
  return { area: '37', mode: 'LIVE', backend: 'Ollama Vision (llava-Familie, Area 79)', rules: ['consent=true Pflicht', 'nur admin-übergebene Bilder', 'keine Screen-Captures', 'ehrlicher NOT-CONNECTED-Status ohne Backend'], analyses: load().analyses.length };
}

module.exports = {
  meta: { area: '37', id: 'vision_bridge', name: 'Visual agent eyes / MCP Vision (consent-gated, ollama llava)', state: 'live' },
  actions: { status: () => status(), analyze: (p) => analyze(p || {}), history: () => history() },
  status, analyze, history,
};
