#!/usr/bin/env node
'use strict';
// Telegram control poller — run OUTSIDE the sandbox (needs egress).
// TELEGRAM_BOT_TOKEN from secret manager; TELEGRAM_ALLOWED_CHATS=123,456
// Only allowlisted chats can command AURA; /kill engages the kill switch.
const AURA = (process.env.AURA_URL || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ALLOW = (process.env.TELEGRAM_ALLOWED_CHATS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!TOKEN) { console.error('set TELEGRAM_BOT_TOKEN (from secret manager)'); process.exit(1); }
let offset = 0;
const api = (m, b) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
async function handle(msg) {
  const chat = String(msg.chat.id);
  if (ALLOW.length && !ALLOW.includes(chat)) return api('sendMessage', { chat_id: msg.chat.id, text: '⛔ not allowlisted' });
  const cmd = (msg.text || '').split('@')[0].replace('/', '');
  let out = '';
  try {
    if (cmd === 'status') out = JSON.stringify(await (await fetch(AURA + '/api/ops')).json());
    else if (cmd === 'report') out = JSON.stringify(await (await fetch(AURA + '/api/report')).json()).slice(0, 3800);
    else if (cmd === 'tasks') out = JSON.stringify((await (await fetch(AURA + '/api/modules/03/action/list')).json()).slice(0, 5), null, 1);
    else if (cmd === 'snapshot') out = JSON.stringify(await (await fetch(AURA + '/api/ops/super', { method: 'POST' })).json());
    else if (cmd === 'sync') out = JSON.stringify(await (await fetch(AURA + '/api/ops/sync', { method: 'POST' })).json());
    else if (cmd === 'learn') out = JSON.stringify(await (await fetch(AURA + '/api/hierarchy/knowledge')).json());
    else if (cmd === 'brains') out = JSON.stringify(await (await fetch(AURA + '/api/hierarchy/knowledge')).json());
    else if (cmd === 'kill') out = JSON.stringify(await (await fetch(AURA + '/api/kill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arm: true, reason: 'telegram /kill by ' + chat }) })).json());
    else if (cmd === 'revive') out = (msg.text.split(' ')[1] === 'CONFIRM') ? JSON.stringify(await (await fetch(AURA + '/api/kill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arm: false, reason: 'telegram revive CONFIRM' }) })).json()) : 'type: /revive CONFIRM';
    else out = 'commands: /status /report /tasks /snapshot /sync /learn /brains /kill /revive';
  } catch (e) { out = 'error: ' + e.message; }
  return api('sendMessage', { chat_id: msg.chat.id, text: String(out).slice(0, 4000) });
}
setInterval(async () => {
  try {
    const r = await api('getUpdates', { offset, timeout: 20 });
    for (const u of r.result || []) { offset = u.update_id + 1; if (u.message) await handle(u.message); }
  } catch (e) { console.error('poll err', e.message); }
}, 25000);
console.log('telegram poller running; allowlist:', ALLOW.length ? ALLOW.join(',') : 'NONE (set TELEGRAM_ALLOWED_CHATS!)');
