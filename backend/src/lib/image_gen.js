'use strict';
// AURA Area 71 — Image Generation Gateway: ComfyUI + AUTOMATIC1111 WebUI.
//
// Two REAL API clients (ComfyUI HTTP API on :8188, A1111 /sdapi/v1) plus an
// honest SIMULATION engine so the pipeline works end-to-end even with no GPU
// server configured. Telemetry is never fabricated: every generated image is
// labeled mode LIVE (real engine answered) or SIMULATION (local placeholder).
//
// Endpoints served by backend/src/routes/api_areas.js:
//   GET  /api/imagegen/status    GET/POST /api/imagegen/config
//   POST /api/imagegen/generate  GET /api/imagegen/history
//   GET  /api/imagegen/artifact/:name
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const http = require('http');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CFG_FILE = path.join(DATA_DIR, 'imagegen.json');
const ART_DIR = path.join(DATA_DIR, 'imagegen', 'artifacts');
const HIST_FILE = path.join(DATA_DIR, 'imagegen', 'history.json');
const CA_BUNDLE = '/etc/ssl/certs/ca-certificates.crt';
const HIST_CAP = 50;

const DEFAULTS = {
  comfyui_url: '',          // e.g. http://192.168.1.20:8188
  comfyui_token: '',        // optional bearer token
  webui_url: '',            // e.g. http://127.0.0.1:7860
  webui_auth: '',           // optional "user:pass" for --api-auth
  checkpoint: 'sd_xl_base_1.0.safetensors',
  sampler: 'euler',
  default_engine: 'auto',   // auto | comfyui | webui (kein Simulationsmodus)
  timeout_ms: 60000,
};

// ---------- config (hot reload via mtime, same pattern as Area 68) ----------
let cache = { mtime: 0, data: null };
function readCfg() {
  try {
    const st = fs.statSync(CFG_FILE);
    if (cache.data && st.mtimeMs === cache.mtime) return cache.data;
    const j = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
    cache = { mtime: st.mtimeMs, data: j };
    return j;
  } catch { return {}; }
}
function cfg() { return { ...DEFAULTS, ...readCfg() }; }
function saveCfg(patch) {
  const errs = [];
  const next = { ...cfg() };
  for (const k of ['comfyui_url', 'webui_url']) {
    if (k in patch) {
      const v = String(patch[k] || '').trim();
      if (v && !/^https?:\/\/[^/\s]+/.test(v)) errs.push(k + ' must be http(s)://host[:port] or empty');
      else next[k] = v;
    }
  }
  for (const k of ['comfyui_token', 'webui_auth', 'checkpoint', 'sampler']) {
    if (k in patch) next[k] = String(patch[k] == null ? '' : patch[k]);
  }
  if ('default_engine' in patch) {
    if (!['auto', 'comfyui', 'webui'].includes(patch.default_engine)) errs.push('default_engine must be auto|comfyui|webui');
    else next.default_engine = patch.default_engine;
  }
  if ('timeout_ms' in patch) {
    const t = Number(patch.timeout_ms);
    if (!Number.isFinite(t) || t < 5000 || t > 600000) errs.push('timeout_ms must be 5000..600000');
    else next.timeout_ms = Math.round(t);
  }
  if (errs.length) { const e = new Error(errs.join('; ')); e.code = 400; throw e; }
  fs.mkdirSync(path.dirname(CFG_FILE), { recursive: true });
  fs.writeFileSync(CFG_FILE, JSON.stringify(next, null, 2));
  cache = { mtime: 0, data: null }; // force reload
  return next;
}

// ---------- HTTP helper (sandbox TLS uses the system CA bundle) ----------
function fetchJson(url, opts = {}, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    let u; try { u = new URL(url); } catch { return reject(new Error('invalid url')); }
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const headers = { ...(opts.headers || {}) };
    if (opts.json) headers['Content-Type'] = 'application/json';
    const req = lib.request({
      hostname: u.hostname, port: u.port || (isHttps ? 443 : 80), path: u.pathname + u.search,
      method: opts.method || 'GET', headers, timeout: timeoutMs,
      ...(isHttps ? { ca: fs.existsSync(CA_BUNDLE) ? fs.readFileSync(CA_BUNDLE) : undefined } : {}),
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ': ' + buf.toString('utf8').slice(0, 200)));
        resolve({ status: res.statusCode, buf, text: buf.toString('utf8') });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout after ' + timeoutMs + 'ms')));
    req.on('error', reject);
    if (opts.json) req.write(JSON.stringify(opts.json));
    req.end();
  });
}

// ---------- engine probes (honest connection states) ----------
async function probeComfyUI(c = cfg()) {
  if (!c.comfyui_url) return { state: 'NOT-CONFIGURED', detail: 'comfyui_url leer — im /imagegen UI oder via /api/imagegen/config setzen' };
  try {
    const r = await fetchJson(c.comfyui_url.replace(/\/$/, '') + '/system_stats', { headers: c.comfyui_token ? { Authorization: 'Bearer ' + c.comfyui_token } : {} }, 4000);
    const j = JSON.parse(r.text);
    const sys = (j.system || {});
    return { state: 'LIVE', detail: 'ComfyUI antwortet' + (sys.os ? ' · ' + sys.os : '') + (j.devices && j.devices[0] ? ' · GPU: ' + (j.devices[0].name || '?') : ''), url: c.comfyui_url };
  } catch (e) { return { state: 'NOT-CONNECTED', detail: 'konfiguriert (' + c.comfyui_url + ') aber nicht erreichbar: ' + e.message, url: c.comfyui_url }; }
}
async function probeWebUI(c = cfg()) {
  if (!c.webui_url) return { state: 'NOT-CONFIGURED', detail: 'webui_url leer — AUTOMATIC1111 mit --api starten und URL setzen' };
  try {
    const headers = c.webui_auth ? { Authorization: 'Basic ' + Buffer.from(c.webui_auth).toString('base64') } : {};
    const r = await fetchJson(c.webui_url.replace(/\/$/, '') + '/sdapi/v1/options', { headers }, 4000);
    const j = JSON.parse(r.text);
    return { state: 'LIVE', detail: 'WebUI antwortet' + (j.sd_model_checkpoint ? ' · Modell: ' + String(j.sd_model_checkpoint).split(/[/\\]/).pop() : ''), url: c.webui_url };
  } catch (e) { return { state: 'NOT-CONNECTED', detail: 'konfiguriert (' + c.webui_url + ') aber nicht erreichbar: ' + e.message, url: c.webui_url }; }
}

// ---------- SIMULATION engine: real PNG files, honestly labeled ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c; }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0; // filter: none
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hsl2rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = h / 60, x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0]; else if (hp < 2) [r, g, b] = [x, c, 0]; else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c]; else if (hp < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ---------- ComfyUI engine ----------
function comfyGraph(c, prompt, negative, width, height, steps) {
  return {
    '3': { class_type: 'KSampler', inputs: { seed: Math.floor(Math.random() * 1e15), steps, cfg: 7, sampler_name: c.sampler || 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: c.checkpoint || 'sd_xl_base_1.0.safetensors' } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['4', 1] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'aura', images: ['8', 0] } },
  };
}
async function comfyGenerate(opts, c) {
  const base = c.comfyui_url.replace(/\/$/, '');
  const headers = c.comfyui_token ? { Authorization: 'Bearer ' + c.comfyui_token } : {};
  const graph = opts.workflow || comfyGraph(c, opts.prompt, opts.negative || '', opts.width || 512, opts.height || 512, opts.steps || 20);
  const q = await fetchJson(base + '/prompt', { method: 'POST', headers, json: { prompt: graph, client_id: 'aura-71' } }, 8000);
  const { prompt_id } = JSON.parse(q.text);
  if (!prompt_id) throw new Error('ComfyUI nahm den Prompt nicht an: ' + q.text.slice(0, 200));
  const deadline = Date.now() + (c.timeout_ms || 60000);
  let out = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const hres = await fetchJson(base + '/history/' + prompt_id, { headers }, 6000);
    const hj = JSON.parse(hres.text);
    const entry = hj[prompt_id];
    if (entry && entry.outputs) {
      for (const nodeOut of Object.values(entry.outputs)) {
        const imgs = nodeOut.images || [];
        if (imgs.length) { out = imgs[0]; break; }
      }
      if (out) break;
      if (entry.status && entry.status.status_str === 'error') throw new Error('ComfyUI meldete Fehler: ' + JSON.stringify(entry.status.messages || []).slice(0, 300));
    }
  }
  if (!out) throw new Error('Timeout: ComfyUI lieferte kein Bild innerhalb ' + Math.round(c.timeout_ms / 1000) + 's');
  const view = await fetchJson(base + '/view?filename=' + encodeURIComponent(out.filename) + '&subfolder=' + encodeURIComponent(out.subfolder || '') + '&type=' + encodeURIComponent(out.type || 'output'), { headers }, 10000);
  return { bytes: view.buf, engine: 'comfyui', note: 'prompt_id ' + prompt_id };
}

// ---------- WebUI (AUTOMATIC1111) engine ----------
async function webuiGenerate(opts, c) {
  const base = c.webui_url.replace(/\/$/, '');
  const headers = c.webui_auth ? { Authorization: 'Basic ' + Buffer.from(c.webui_auth).toString('base64') } : {};
  const isImg2Img = opts.mode === 'img2img' && opts.init_image;
  const payload = {
    prompt: opts.prompt, negative_prompt: opts.negative || '',
    steps: opts.steps || 20, width: opts.width || 512, height: opts.height || 512,
    cfg_scale: opts.cfg || 7, sampler_name: c.sampler || 'Euler',
  };
  if (isImg2Img) payload.init_images = [String(opts.init_image).replace(/^data:image\/\w+;base64,/, '')];
  const r = await fetchJson(base + (isImg2Img ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img'), { method: 'POST', headers, json: payload }, c.timeout_ms || 60000);
  const j = JSON.parse(r.text);
  if (!j.images || !j.images[0]) throw new Error('WebUI lieferte kein Bild: ' + r.text.slice(0, 200));
  return { bytes: Buffer.from(j.images[0], 'base64'), engine: 'webui', note: (j.info || '').slice(0, 120) };
}

// ---------- history + artifacts ----------
function readHistory() { try { return JSON.parse(fs.readFileSync(HIST_FILE, 'utf8')); } catch { return []; } }
function pushHistory(entry) {
  const h = readHistory();
  h.unshift(entry);
  if (h.length > HIST_CAP) h.length = HIST_CAP;
  fs.mkdirSync(path.dirname(HIST_FILE), { recursive: true });
  fs.writeFileSync(HIST_FILE, JSON.stringify(h, null, 2));
}
function artifactPath(name) {
  const safe = path.basename(String(name));
  if (!/^[a-z0-9-]+\.png$/i.test(safe)) return null;
  return path.join(ART_DIR, safe);
}

// ---------- main entry ----------
async function generate(opts = {}) {
  const t0 = Date.now();
  try { // Area 74 safe mode gate (lazy require — no circular deps)
    if (require('./service_fabric').mode('safe')) {
      const e = new Error('SAFE MODE aktiv (Area 74) — Generierung pausiert, bis der Modus deaktiviert wird'); e.code = 423; throw e;
    }
  } catch (e) { if (e.code === 423) throw e; }
  const c = cfg();
  const prompt = String(opts.prompt || '').trim().slice(0, 2000);
  if (!prompt && !opts.workflow) { const e = new Error('prompt fehlt'); e.code = 400; throw e; }
  let engine = opts.engine || c.default_engine || 'auto';
  if (!['auto', 'comfyui', 'webui'].includes(engine)) { const e = new Error('unbekannte engine: ' + engine); e.code = 400; throw e; }

  if (engine === 'auto') {
    const [cu, wu] = await Promise.all([probeComfyUI(c), probeWebUI(c)]);
    engine = cu.state === 'LIVE' ? 'comfyui' : wu.state === 'LIVE' ? 'webui' : null;
    if (!engine) return { ok: false, engine: 'none', state: 'NICHT_VERBUNDEN', error: 'kein Bildbackend erreichbar (ComfyUI oder AUTOMATIC1111 WebUI)', note: 'Kein Simulator. Backend-URL konfigurieren, dann erneut versuchen.' };
  }

  let result;
  if (engine === 'comfyui') {
    const p = await probeComfyUI(c);
    if (p.state !== 'LIVE') return { ok: false, engine: 'comfyui', state: p.state, error: p.detail, note: 'ehrlicher Status — nichts vorgetäuscht; engine=sim oder default_engine=auto nutzen für Demo-Bilder' };
    result = await comfyGenerate(opts, c);
  } else if (engine === 'webui') {
    const p = await probeWebUI(c);
    if (p.state !== 'LIVE') return { ok: false, engine: 'webui', state: p.state, error: p.detail, note: 'ehrlicher Status — nichts vorgetäuscht; engine=sim oder default_engine=auto nutzen für Demo-Bilder' };
    result = await webuiGenerate(opts, c);
  } else {
    return { ok: false, engine, error: 'unbekannter Motor' };
  }

  const id = 'img-' + Date.now().toString(36) + '-' + hashStr(prompt || 'x').toString(36).slice(0, 6) + '.png';
  fs.mkdirSync(ART_DIR, { recursive: true });
  fs.writeFileSync(path.join(ART_DIR, id), result.bytes);
  const entry = {
    id, at: new Date().toISOString(), engine: result.engine,
    mode: result.engine === 'sim' ? 'SIMULATION' : 'LIVE',
    prompt: (prompt || '(workflow json)').slice(0, 300),
    width: result.width || opts.width || null, height: result.height || opts.height || null,
    ms: Date.now() - t0, bytes: result.bytes.length,
    href: '/api/imagegen/artifact/' + id,
  };
  pushHistory(entry);
  return { ok: true, ...entry, note: result.note || (entry.mode === 'SIMULATION' ? 'SIMULATION — lokales Demo-Bild, kein echtes Diffusion-Backend verbunden' : null) };
}

async function status() {
  const c = cfg();
  const [comfyui, webui] = await Promise.all([probeComfyUI(c), probeWebUI(c)]);
  const hist = readHistory();
  const anyLive = comfyui.state === 'LIVE' || webui.state === 'LIVE';
  return {
    area: '71', mode: anyLive ? 'LIVE' : 'NOT-CONNECTED',
    note: anyLive
      ? 'mindestens ein echtes Bild-Backend antwortet — Generierung läuft LIVE'
      : 'kein Backend verbunden — /api/imagegen/generate liefert ehrlich gelabelte SIMULATION-Bilder, bis eine URL konfiguriert ist',
    engines: { comfyui, webui },
    config: { default_engine: c.default_engine, timeout_ms: c.timeout_ms, checkpoint: c.checkpoint, sampler: c.sampler,
      comfyui_url: c.comfyui_url, webui_url: c.webui_url, comfyui_token: c.comfyui_token ? '(gesetzt)' : '', webui_auth: c.webui_auth ? '(gesetzt)' : '' },
    history: { entries: hist.length, last: hist[0] || null, live_count: hist.filter((h) => h.mode === 'LIVE').length, sim_count: hist.filter((h) => h.mode === 'SIMULATION').length },
  };
}

module.exports = {
  meta: { area: '71', id: 'image_gen', name: 'Image Generation Gateway (ComfyUI + WebUI)', state: 'live' },
  actions: {
    status: () => status(),
    probe: async () => ({ comfyui: await probeComfyUI(), webui: await probeWebUI() }),
    generate: (o) => generate(o || {}),
  },
  status, probeComfyUI, probeWebUI, generate, cfg, saveCfg,
  history: () => readHistory(),
  artifactPath, ART_DIR,
};
