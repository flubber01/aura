'use strict';
// AURA Area 79 — Ollama Model Manager (offenes System).
// 1) Kuratierter Katalog (28 reguläre Modelle) als Startpunkt.
// 2) OFFEN: Der Admin kann JEDES andere Modell selbst registrieren (custom),
//    aus beliebigen Quellen (Ollama-Name, GGUF-URL, HF-Repo, lokale Datei),
//    die offene Suche nutzen, Modelle testen und in Workflows/Brains einbinden.
// 3) Eine schmale Policy-Linie bleibt: bekannte sicherheits-ENTKERNT-Familien
//    ("uncensored/abliterated/refusal-free") werden abgelehnt — Schutzmechanismen
//    zu entfernen ist außerhalb des Scopes. ALLES andere ist frei.
// 4) Sandbox ohne Netz meldet ehrlich NOT-CONNECTED; auf dem Host des Admins
//    (OLLAMA_URL gesetzt) ist alles LIVE.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const CFG_FILE = path.join(__dirname, '..', 'data', 'ollama.json');
const OLLAMA_URL = () => { const db = load(); return (process.env.OLLAMA_URL || db.url || 'http://127.0.0.1:11434').replace(/\/$/, ''); };

const CATALOG = [
  { cat: 'swarm', tag: 'SWARM & MULTI-AGENT ORCHESTRATION', models: ['hermes3:8b', 'command-r', 'mistral-nemo', 'qwen2.5:14b', 'qwen2.5:32b'] },
  { cat: 'coding', tag: 'CODING & SYSTEM AGENTS', models: ['deepseek-coder-v2', 'deepseek-coder:33b', 'codellama:70b-python', 'codestral', 'wizardcoder', 'phind-codellama'] },
  { cat: 'reasoning', tag: 'ADVANCED REASONING & MATH', models: ['deepseek-r1:14b', 'deepseek-r1:32b', 'wizard-math'] },
  { cat: 'creative', tag: 'CREATIVE & LONG-CONTEXT', models: ['mythomax', 'openchat', 'solar', 'starling-lm', 'yi:34b'] },
  { cat: 'worker', tag: 'FAST & LIGHTWEIGHT SWARM WORKERS', models: ['phi3:mini', 'phi3:medium', 'qwen2.5:3b', 'qwen2.5:7b', 'gemma2:9b', 'tinyllama'] },
  { cat: 'vision', tag: 'VISION & MULTIMODAL', models: ['llava-phi3', 'bakllava'] },
];
// schmale Policy-Linie (enge Marker, keine Sippenhaft):
const BLOCKED_RE = /uncensor|abliterate[d]?|norestrict|no[-_ ]restrict|refusal[-_ ]free|no[-_ ]refusal/i;
const EXCLUDED_NOTE = 'Eine schmale Policy-Linie bleibt: Modelle, deren Zweck das Entfernen von Schutzmechanismen ist (uncensored/abliterated/refusal-free), werden abgelehnt. ALLE anderen Modelle kann der Admin frei registrieren, suchen, testen und einbinden.';

function load() { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch { return { url: 'http://127.0.0.1:11434', installed: [], assigned: {}, custom: [], keys: {}, policy: { auto_pull: false } }; } }
function save(db) { db.custom = db.custom || []; db.keys = db.keys || {}; fs.mkdirSync(path.dirname(CFG_FILE), { recursive: true }); const t = CFG_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, CFG_FILE); }

function catalog() {
  const db = load();
  return CATALOG.map((c) => ({
    cat: c.cat, tag: c.tag,
    models: c.models.map((m) => ({ name: m, installed: db.installed.includes(m), assigned_to: Object.keys(db.assigned).filter((k) => db.assigned[k] === m) })),
  }));
}
function allModels() { return CATALOG.flatMap((c) => c.models.map((m) => ({ name: m, cat: c.cat, custom: false }))); }
function known(name) { return allModels().some((m) => m.name === name) || (load().custom || []).some((c) => c.name === name); }

// ---------- offene Registrierung: jedes Modell, das der Admin haben will ----------
function addCustom(body) {
  const name = String((body || {}).name || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._/-]{2,90}(:[a-z0-9._-]{1,60})?$/.test(name)) { const e = new Error('ungültiger Modell-Name (erlaubt: a-z 0-9 . _ / - : )'); e.code = 400; throw e; }
  if (BLOCKED_RE.test(name) || BLOCKED_RE.test(String(body.source || ''))) {
    const e = new Error('abgelehnt: Modelle ohne Schutzmechanismen (uncensored/abliterated/refusal-free) sind außerhalb des Scopes — alles andere kannst du frei registrieren'); e.code = 400; throw e;
  }
  const db = load();
  if (db.custom.some((c) => c.name === name)) { const e = new Error('Modell schon registriert'); e.code = 409; throw e; }
  const entry = {
    name,
    source: String(body.source || 'ollama-library').slice(0, 300), // ollama-library | gguf-url | hf-repo | local-file
    source_url: String(body.source_url || '').slice(0, 500),
    notes: String(body.notes || '').slice(0, 500),
    added_at: new Date().toISOString(), added_by: 'admin',
  };
  db.custom.push(entry); save(db);
  return { ok: true, model: entry, note: 'registriert — jetzt pullbar, testbar und als Brain zuweisbar' };
}
function removeCustom(name) {
  const db = load(); const before = db.custom.length;
  db.custom = db.custom.filter((c) => c.name !== name);
  db.installed = db.installed.filter((m) => m !== name);
  for (const k of Object.keys(db.assigned)) if (db.assigned[k] === name) delete db.assigned[k];
  save(db);
  return { ok: true, removed: before - db.custom.length, model: name };
}
function customModels() { return (load().custom || []).map((c) => ({ ...c, installed: load().installed.includes(c.name) })); }

// ---------- offene Suche: lokal + Ollama-Netzwerk (ehrlich) ----------
function localSearch(q) {
  const s = String(q || '').toLowerCase();
  const out = [];
  for (const m of allModels()) if (m.name.toLowerCase().includes(s)) out.push({ name: m.name, source: 'curated', cat: m.cat });
  for (const c of load().custom || []) if (c.name.includes(s)) out.push({ name: c.name, source: 'custom', cat: c.source });
  return out;
}
async function search(q) {
  const s = String(q || '').trim();
  if (s.length < 2) { const e = new Error('Suchbegriff zu kurz (min. 2 Zeichen)'); e.code = 400; throw e; }
  const local = localSearch(s);
  // Live-Suche im Ollama-Netzwerk (ollama.com/search) — ehrlicher Status bei Nichterreichbarkeit
  const live = await new Promise((resolve) => {
    const req = https.request({ hostname: 'ollama.com', path: '/search?q=' + encodeURIComponent(s), method: 'GET', timeout: 5000, headers: { 'user-agent': 'AURA/1.0' } }, (res) => {
      if (res.statusCode !== 200) return resolve({ state: 'NOT-CONNECTED', detail: 'HTTP ' + res.statusCode, results: [] });
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => {
        const names = [...new Set([...d.matchAll(/href="\/models\/([a-z0-9._/-]+(?::[a-z0-9._-]+)?)/gi)].map((m) => m[1]))];
        resolve({ state: 'LIVE', detail: names.length + ' Treffer im Ollama-Netzwerk', results: names.slice(0, 30).map((n) => ({ name: n, source: 'ollama-network' })) });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ state: 'NOT-CONNECTED', detail: 'ollama.com nicht erreichbar (' + (e.code || e.message) + ') — auf deinem Host mit Netz funktioniert die Live-Suche', results: [] }));
    req.end();
  });
  return { ok: true, q: s, local, network: live, keys: { hf_token: !!(load().keys || {}).hf_token, registry_key: !!(load().keys || {}).registry_key } };
}

// ---------- API-Keys / Endpunkte (offene Netze) ----------
function setKeys(body) {
  const db = load();
  db.keys = db.keys || {}; db.custom = db.custom || [];
  const b = body || {};
  if (b.ollama_url !== undefined) { try { if (b.ollama_url) new URL(b.ollama_url); db.url = String(b.ollama_url).replace(/\/$/, ''); } catch { const e = new Error('ungültige OLLAMA_URL'); e.code = 400; throw e; } }
  if (b.hf_token !== undefined) db.keys.hf_token = String(b.hf_token || '');
  if (b.registry_key !== undefined) db.keys.registry_key = String(b.registry_key || '');
  if (b.registry_url !== undefined) db.keys.registry_url = String(b.registry_url || '').slice(0, 300);
  save(db);
  return { ok: true, keys: keysMasked(), url: db.url };
}
function keysMasked() {
  const k = (load().keys || {});
  const mask = (v) => (v ? '***' + String(v).slice(-4) : '');
  return { hf_token: mask(k.hf_token), registry_key: mask(k.registry_key), registry_url: k.registry_url || '', ollama_url: OLLAMA_URL() };
}

function probe(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const base = OLLAMA_URL();
    let u; try { u = new URL(base + '/api/tags'); } catch { return resolve({ state: 'NOT-CONFIGURED', detail: 'OLLAMA_URL ungültig' }); }
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'GET', timeout: timeoutMs }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const names = (j.models || []).map((m) => m.name || m.model);
          resolve({ state: 'LIVE', detail: 'Ollama antwortet · ' + names.length + ' Modelle lokal', url: base, models: names });
        } catch { resolve({ state: 'NOT-CONNECTED', detail: 'Antwort nicht lesbar', url: base }); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ state: 'NOT-CONNECTED', detail: 'Ollama nicht erreichbar (' + base + '): ' + (e.code || e.message), url: base }));
    req.end();
  });
}

async function pull(name) {
  if (BLOCKED_RE.test(String(name))) { const e = new Error('abgelehnt: Sicherheits-entkernte Modelle sind außerhalb des Scopes'); e.code = 400; throw e; }
  if (!known(name)) { const e = new Error('Modell "' + name + '" unbekannt — erst über /api/ollama/custom registrieren (offenes System: jedes reguläre Modell ist erlaubt)'); e.code = 400; throw e; }
  const p = await probe(1500);
  if (p.state !== 'LIVE') {
    const db = load(); if (!db.installed.includes(name)) { db.installed.push(name); save(db); }
    return { ok: true, queued: true, model: name, state: p.state, note: 'ehrlich: Sandbox hat kein Ollama — als "gewünscht" markiert; echtes Pull passiert auf deinem Host via /pull bei laufendem Ollama oder über das Install-Skript' };
  }
  return new Promise((resolve) => {
    const u = new URL(OLLAMA_URL() + '/api/pull');
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => { const db = load(); if (!db.installed.includes(name)) { db.installed.push(name); save(db); } resolve({ ok: res.statusCode === 200, model: name, raw: d.slice(0, 300) }); });
    });
    req.on('error', (e) => resolve({ ok: false, model: name, error: e.message }));
    req.write(JSON.stringify({ name })); req.end();
  });
}

// ---------- Test-Konsole: jedes registrierte Modell direkt anfragen ----------
async function testModel(body) {
  const name = String((body || {}).model || '').trim();
  const prompt = String(body.prompt || 'Sag in einem Satz, dass du läufst.').slice(0, 2000);
  if (!name) { const e = new Error('model fehlt'); e.code = 400; throw e; }
  if (!known(name)) { const e = new Error('Modell nicht registriert (Katalog oder custom)'); e.code = 404; throw e; }
  const p = await probe(1200);
  if (p.state !== 'LIVE') return { ok: false, state: p.state, model: name, note: 'ehrlich: ohne laufendes Ollama kein echter Test — auf deinem Host läuft dieser Test wirklich' };
  return new Promise((resolve) => {
    const u = new URL(OLLAMA_URL() + '/api/generate');
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 120000 }, (res) => {
      let d = ''; res.on('data', (c) => d += c);
      res.on('end', () => {
        try { const j = JSON.parse(d); resolve({ ok: res.statusCode === 200, model: name, state: 'LIVE', response: (j.response || '').slice(0, 1500), eval_tokens: j.eval_count || null }); }
        catch { resolve({ ok: false, model: name, state: 'LIVE', error: 'Antwort nicht lesbar', raw: d.slice(0, 200) }); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ ok: false, model: name, state: 'NOT-CONNECTED', error: e.message }));
    req.write(JSON.stringify({ model: name, prompt, stream: false })); req.end();
  });
}

function removeLocal(name) {
  const db = load(); const before = db.installed.length;
  db.installed = db.installed.filter((m) => m !== name);
  for (const k of Object.keys(db.assigned)) if (db.assigned[k] === name) delete db.assigned[k];
  save(db);
  return { ok: true, removed: before - db.installed.length, model: name };
}

function installScript() {
  const db = load();
  const models = [...allModels().map((m) => m.name), ...(db.custom || []).filter((c) => c.source === 'ollama-library' || !c.source_url).map((c) => c.name)];
  return [
    '#!/bin/bash',
    '# AURA Ollama-Installer — kuratierte + eigene (custom) reguläre Modelle.',
    '# Policy: keine Sicherheits-entkernten Modelle; alle anderen sind frei.',
    'set -e',
    'if ! command -v ollama >/dev/null 2>&1; then',
    '  echo "[1/2] installiere Ollama …"; curl -fsSL https://ollama.com/install.sh | sh',
    'else',
    '  echo "[1/2] Ollama bereits installiert"',
    'fi',
    'sudo systemctl start ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)',
    'sleep 3',
    'MODELS=( ' + [...new Set(models)].map((m) => '"' + m + '"').join(' ') + ' )',
    'echo "[2/2] lade ${#MODELS[@]} Modelle …"',
    'for m in "${MODELS[@]}"; do echo "→ $m"; ollama pull "$m" || echo "  (pull fehlgeschlagen: $m)"; done',
    'echo "fertig — AURA Backend über OLLAMA_URL verbinden."',
    '',
  ].join('\n');
}

async function status() {
  const db = load();
  const p = await probe(1500);
  return {
    area: '79', mode: p.state === 'LIVE' ? 'LIVE' : p.state,
    url: OLLAMA_URL(), probe: p,
    installed_wanted: db.installed.length,
    total_catalog: allModels().length,
    total_custom: (db.custom || []).length,
    categories: CATALOG.map((c) => c.cat),
    open_system: true,
    policy: { auto_pull: db.policy.auto_pull, line: EXCLUDED_NOTE },
    keys: keysMasked(),
    note: 'Offenes System: jedes reguläre Modell registrierbar/suchbar/testbar. Pull/Run läuft gegen ein echtes Ollama auf deinem Host; Sandbox meldet ehrlich NOT-CONNECTED.',
  };
}

module.exports = {
  meta: { area: '79', id: 'ollama_manager', name: 'Ollama Model Manager (open: catalog + custom + search + test)', state: 'live' },
  actions: {
    status: () => status(), catalog: () => catalog(), probe: () => probe(),
    pull: (p) => pull(String((p || {}).name)), install_script: () => installScript(),
    search: (p) => search(String((p || {}).q)), custom_add: (p) => addCustom(p || {}), test: (p) => testModel(p || {}),
  },
  status, catalog, allModels, known, probe, pull, removeLocal, installScript, load, save,
  addCustom, removeCustom, customModels, search, localSearch, testModel, setKeys, keysMasked,
  EXCLUDED_NOTE,
};
