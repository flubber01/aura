'use strict';
// AURA Area 78 — Telegram Agent: official Bot API integration.
// Token is read from (in order) env TELEGRAM_BOT_TOKEN, backend/src/data/
// secrets.json, deploy/.env — NEVER from committed files. Connectivity is
// probed honestly via getMe; the in-process poller only runs when started
// AND the probe succeeded (no blind retry loops).
const fs = require('fs');
const path = require('path');
const https = require('https');

const SECRETS = path.join(__dirname, '..', 'data', 'secrets.json');
const ENV_FILE = path.join(__dirname, '..', '..', '..', 'deploy', '.env');
const CA_BUNDLE = '/etc/ssl/certs/ca-certificates.crt';

let pollTimer = null;
let offset = 0;
let lastProbe = null;

function parseEnvFile(file) {
  try {
    const out = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && !line.trim().startsWith('#')) out[m[1]] = m[2];
    }
    return out;
  } catch { return {}; }
}
function token() {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN.trim();
  try { const s = JSON.parse(fs.readFileSync(SECRETS, 'utf8')); if (s.telegram_bot_token) return String(s.telegram_bot_token).trim(); } catch {}
  const env = parseEnvFile(ENV_FILE);
  return env.TELEGRAM_BOT_TOKEN || '';
}
function allowedChats() {
  const raw = process.env.TELEGRAM_ALLOWED_CHATS || parseEnvFile(ENV_FILE).TELEGRAM_ALLOWED_CHATS || '';
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

function tgCall(method, body, timeoutMs = 8000) {
  const tok = token();
  if (!tok) return Promise.reject(new Error('kein Token gesetzt (deploy/.env oder TELEGRAM_BOT_TOKEN)'));
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const req = https.request({
      hostname: 'api.telegram.org', port: 443, path: '/bot' + tok + '/' + method,
      method: 'POST', timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      ca: fs.existsSync(CA_BUNDLE) ? fs.readFileSync(CA_BUNDLE) : undefined,
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ ok: false, description: 'bad gateway response', raw: d.slice(0, 200) }); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout nach ' + timeoutMs + 'ms')));
    req.on('error', (e) => reject(e));
    req.write(payload); req.end();
  });
}

async function probe() {
  const t0 = Date.now();
  if (!token()) { lastProbe = { state: 'NOT-CONFIGURED', detail: 'kein Token in deploy/.env / secrets.json / ENV', at: new Date().toISOString() }; return lastProbe; }
  try {
    const r = await tgCall('getMe', {});
    if (r.ok) lastProbe = { state: 'LIVE', detail: 'Bot verbunden: @' + r.result.username + ' (' + r.result.first_name + ')', bot: r.result, ms: Date.now() - t0, at: new Date().toISOString() };
    else lastProbe = { state: 'NOT-CONNECTED', detail: 'Telegram lehnte ab: ' + String(r.description || 'unbekannt'), ms: Date.now() - t0, at: new Date().toISOString() };
  } catch (e) {
    lastProbe = { state: 'NOT-CONNECTED', detail: 'api.telegram.org nicht erreichbar: ' + String(e.message).slice(0, 90) + ' (Sandbox ohne Egress → auf eigener Hardware läuft es)', ms: Date.now() - t0, at: new Date().toISOString() };
  }
  return lastProbe;
}

// ---------- in-process poller (commands mirror telegram_poller.js) ----------
async function handleMsg(msg) {
  const allow = allowedChats();
  const chat = String(msg.chat.id);
  const base = 'http://127.0.0.1:' + (process.env.PORT || 8080);
  if (allow.length && !allow.includes(chat)) return tgCall('sendMessage', { chat_id: msg.chat.id, text: '⛔ Chat nicht auf der Allowlist (TELEGRAM_ALLOWED_CHATS setzen)' });
  const cmd = String(msg.text || '').split('@')[0].replace('/', '').split(' ')[0];
  const grab = async (p, opts) => { const r = await fetch(base + p, opts); return r.json(); };
  let out;
  try {
    if (cmd === 'status') out = JSON.stringify(await grab('/api/ops'));
    else if (cmd === 'report') out = JSON.stringify(await grab('/api/report')).slice(0, 3800);
    else if (cmd === 'forge') out = JSON.stringify(await grab('/api/content/status'));
    else if (cmd === 'control') out = JSON.stringify((await grab('/api/control')).routines.map((r) => r.id + '=' + (r.enabled ? 'ON' : 'OFF')).join(' · '));
    else if (cmd === 'snapshot') out = JSON.stringify(await grab('/api/ops/super', { method: 'POST' }));
    else if (cmd === 'kill') out = JSON.stringify(await grab('/api/kill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arm: true, reason: 'telegram /kill by ' + chat }) }));
    else if (cmd === 'revive') out = String(msg.text).includes('CONFIRM') ? JSON.stringify(await grab('/api/kill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arm: false, reason: 'telegram /revive CONFIRM' }) })) : '/revive CONFIRM tippen';
    else out = 'Befehle: /status /report /forge /control /snapshot /kill /revive CONFIRM';
  } catch (e) { out = 'Fehler: ' + e.message; }
  return tgCall('sendMessage', { chat_id: msg.chat.id, text: String(out).slice(0, 4000) });
}

async function startPoller() {
  if (pollTimer) return { ok: true, note: 'Poller lief bereits', running: true };
  const p = await probe();
  if (p.state !== 'LIVE') {
    const e = new Error('ehrlicher Start-Block: Bot ist ' + p.state + ' (' + p.detail + ') — Poller startet nur gegen eine echte Verbindung'); e.code = 409; throw e;
  }
  pollTimer = setInterval(async () => {
    try {
      const r = await tgCall('getUpdates', { offset, timeout: 20 }, 30000);
      for (const u of r.result || []) { offset = u.update_id + 1; if (u.message) { await handleMsg(u.message).catch(() => {}); } }
    } catch {}
  }, 25000);
  return { ok: true, running: true, note: 'Poller aktiv (offizieller Bot-API-Long-Poll, 25s)', allowlist: allowedChats() };
}
function stopPoller() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } return { ok: true, running: false }; }

async function status() {
  const hasToken = !!token();
  const p = lastProbe && (Date.now() - new Date(lastProbe.at).getTime() < 60000) ? lastProbe : await probe();
  return {
    area: '78', mode: p.state === 'LIVE' ? 'LIVE' : hasToken ? p.state : 'NOT-CONFIGURED',
    token_source: process.env.TELEGRAM_BOT_TOKEN ? 'env' : (fs.existsSync(SECRETS) ? 'secrets.json' : (parseEnvFile(ENV_FILE).TELEGRAM_BOT_TOKEN ? 'deploy/.env' : 'none')),
    allowlist: allowedChats().length ? allowedChats().length + ' Chats' : 'LEER — unbedingt TELEGRAM_ALLOWED_CHATS setzen!',
    poller: { running: !!pollTimer },
    last_probe: p,
    commands: ['/status', '/report', '/forge', '/control', '/snapshot', '/kill', '/revive CONFIRM'],
    note: 'offizielle Bot API; Commands brauchen eine Chat-Allowlist; Sandbox hat keinen Egress zu api.telegram.org — auf eigener Hardware verbindet sich der Agent sofort',
  };
}

module.exports = {
  meta: { area: '78', id: 'telegram_agent', name: 'Telegram Agent (official Bot API, allowlisted commands)', state: 'live' },
  actions: { status: () => status(), probe: () => probe(), start: () => startPoller(), stop: () => stopPoller() },
  status, probe, startPoller, stopPoller, token, allowedChats,
};
