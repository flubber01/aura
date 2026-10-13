#!/usr/bin/env node
'use strict';
// Telegram control poller — run OUTSIDE the sandbox (needs egress).
// TELEGRAM_BOT_TOKEN from secret manager; TELEGRAM_ALLOWED_CHATS=123,456
// AURA_ADMIN_TOKEN (optional, gleicher Wert wie am Server) für Schreibaktionen.
// Only allowlisted chats can command AURA; /kill engages the kill switch.
// Riskante Aktionen laufen nur über Freigabe: /run <aktion> erzeugt AP-…, /approve AP-… führt aus.
const AURA = (process.env.AURA_URL || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN = process.env.AURA_ADMIN_TOKEN || '';
const ALLOW = (process.env.TELEGRAM_ALLOWED_CHATS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!TOKEN) { console.error('set TELEGRAM_BOT_TOKEN (from secret manager)'); process.exit(1); }
let offset = 0;
const api = (m, b) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const aura = (path, { method = 'GET', body } = {}) => fetch(AURA + path, {
  method,
  headers: { 'Content-Type': 'application/json', ...(ADMIN ? { 'x-aura-token': ADMIN } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then((r) => r.json());

// Was eine freigegebene oder direkt erlaubte Aktion am Server auslöst.
// Nur die hier gelisteten Aktionen laufen über Telegram. Der Rest bleibt im Web.
const EXEC = {
  snapshot: () => aura('/api/ops/super', { method: 'POST' }),
  sync: () => aura('/api/ops/sync', { method: 'POST' }),
  kill: () => aura('/api/kill', { method: 'POST', body: { arm: true, reason: 'telegram /kill' } }),
};
const WEB_ONLY = ['upload_commit', 'growth_publish', 'autonomy_heal', 'skill_install', 'board_task'];

async function handle(msg) {
  const chat = String(msg.chat.id);
  if (ALLOW.length && !ALLOW.includes(chat)) return api('sendMessage', { chat_id: msg.chat.id, text: '⛔ not allowlisted' });
  const parts = (msg.text || '').trim().split(/\s+/);
  const cmd = (parts[0] || '').split('@')[0].replace('/', '');
  const arg = parts[1] || '';
  const by = 'telegram:' + chat;
  let out = '';
  try {
    if (cmd === 'status') out = JSON.stringify(await aura('/api/ops'));
    else if (cmd === 'report') out = JSON.stringify(await aura('/api/report')).slice(0, 3800);
    else if (cmd === 'tasks') out = JSON.stringify((await aura('/api/modules/03/action/list')).slice(0, 5), null, 1);
    else if (cmd === 'snapshot') out = JSON.stringify(await EXEC.snapshot());
    else if (cmd === 'sync') out = JSON.stringify(await EXEC.sync());
    else if (cmd === 'learn' || cmd === 'brains') out = JSON.stringify(await aura('/api/hierarchy/knowledge'));
    else if (cmd === 'kill') out = JSON.stringify(await EXEC.kill());
    else if (cmd === 'revive') out = (arg === 'CONFIRM') ? JSON.stringify(await aura('/api/kill', { method: 'POST', body: { arm: false, reason: 'telegram revive CONFIRM' } })) : 'type: /revive CONFIRM';

    // ---- Steuerung ----
    else if (cmd === 'tools') {
      const c = await aura('/api/control');
      out = c.actions.map((a) => `${a.enabled ? '✅' : '⏸'} ${a.id} · ${a.risk}${a.approval ? ' · Freigabe' : ''}`).join('\n');
    } else if (cmd === 'on' || cmd === 'off') {
      out = JSON.stringify(await aura(`/api/control/action/${arg}/${cmd === 'on' ? 'enable' : 'disable'}`, { method: 'POST', body: { by } }));
    } else if (cmd === 'pending') {
      const c = await aura('/api/control');
      out = c.pending.length ? c.pending.map((p) => `${p.id} · ${p.action} · von ${p.by}`).join('\n') : 'keine offenen Freigaben';
    } else if (cmd === 'run') {
      if (WEB_ONLY.includes(arg)) out = `${arg} läuft nur im Web (/control), nicht über Telegram.`;
      else {
        const r = await aura(`/api/control/run/${arg}`, { method: 'POST', body: { by } });
        if (r.status === 'run' && EXEC[arg]) out = 'ausgeführt: ' + JSON.stringify(await EXEC[arg]());
        else if (r.status === 'run') out = `${arg} erlaubt, aber über Telegram nicht verdrahtet.`;
        else if (r.status === 'pending_approval') out = `Freigabe nötig: ${r.approval.id} · ${arg}\n→ /approve ${r.approval.id}  oder  /deny ${r.approval.id}`;
        else out = r.error || JSON.stringify(r);
      }
    } else if (cmd === 'approve' || cmd === 'deny') {
      const r = await aura(`/api/control/approvals/${arg}`, { method: 'POST', body: { decision: cmd === 'approve' ? 'approve' : 'deny', by } });
      if (!r.ok) out = r.error || JSON.stringify(r);
      else if (cmd === 'deny') out = `abgelehnt: ${arg}`;
      else {
        const act = r.approval.action;
        if (WEB_ONLY.includes(act)) out = `${arg} freigegeben, Ausführung nur im Web.`;
        else if (EXEC[act]) out = `${arg} freigegeben, ausgeführt: ` + JSON.stringify(await EXEC[act]());
        else out = `${arg} freigegeben (${act}), aber über Telegram nicht verdrahtet.`;
      }
    } else {
      out = 'commands: /status /report /snapshot /kill /revive CONFIRM /learn /brains\n/tools /on <id> /off <id> /run <id> /pending /approve AP-… /deny AP-…';
    }
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
