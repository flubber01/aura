#!/usr/bin/env node
'use strict';
// Telegram control poller — run OUTSIDE the sandbox (needs egress).
// TELEGRAM_BOT_TOKEN from secret manager; TELEGRAM_ALLOWED_CHATS=123,456
// AURA_ADMIN_TOKEN must match the server, otherwise /api/control-center answers 401.
// Only allowlisted chats can command AURA; /kill engages the kill switch.
// Riskante Aktionen laufen über die Steuerzentrale: /run <aktion> erzeugt eine Freigabe
// (AP-…), die ein Mensch mit /approve AP-… bestätigt.
const AURA = (process.env.AURA_URL || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN = process.env.AURA_ADMIN_TOKEN || '';
const ALLOW = (process.env.TELEGRAM_ALLOWED_CHATS || '').split(',').map((s) => s.trim()).filter(Boolean);
// WICHTIG: Diese Datei darf beim Laden NICHT den Host-Prozess beenden.
// Früher stand hier `process.exit(1)` — dadurch starb jeder Prozess, der das Modul nur einband
// (z. B. der Handbuch-Generator, der alle Module prüft). Jetzt gilt: ohne Token bleibt der Poller
// einfach AUS, mit klarer Meldung, und der Rest des Systems läuft weiter.
const ENABLED = !!TOKEN;
if (!ENABLED) console.error('telegram_poller: kein TELEGRAM_BOT_TOKEN — Poller bleibt AUS (Server läuft weiter).');
let offset = 0;

const api = (m, b) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());

// Serveraufrufe: Admin-Token mitschicken, wenn konfiguriert.
const aura = async (path, { method = 'GET', body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (ADMIN) headers['x-aura-token'] = ADMIN;
  const r = await fetch(AURA + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await r.json(); } catch { /* leer */ }
  return { status: r.status, data };
};

// Was eine freigegebene Aktion am Server auslöst. Nur diese Aktionen sind verdrahtet.
const EXEC = {
  snapshot: () => aura('/api/ops/super', { method: 'POST' }),
  sync: () => aura('/api/ops/sync', { method: 'POST' }),
  kill: () => aura('/api/kill', { method: 'POST', body: { arm: true, reason: 'telegram /kill' } }),
  revive: () => aura('/api/kill', { method: 'POST', body: { arm: false, reason: 'telegram revive' } }),
};
const WEB_ONLY = ['upload_commit', 'growth_publish', 'autonomy_heal', 'skill_install', 'board_task'];
const CC = '/api/control-center';

async function runAction(id, by) {
  const { status, data } = await aura(`${CC}/run/${encodeURIComponent(id)}`, { method: 'POST', body: { by } });
  if (data.status === 'pending_approval') return `Freigabe nötig: ${data.approval.id} · ${id}\n→ /approve ${data.approval.id}  oder  /deny ${data.approval.id}`;
  if (data.status === 'run') {
    if (!EXEC[id]) return `${id} ist freigegeben, aber über Telegram nicht verdrahtet. Bitte im Web unter /control ausführen.`;
    const out = await EXEC[id]();
    return `ausgeführt: ${id} (HTTP ${out.status})`;
  }
  return `abgelehnt (HTTP ${status}): ${data.error || JSON.stringify(data)}`;
}

async function handle(msg) {
  const chat = String(msg.chat.id);
  if (ALLOW.length && !ALLOW.includes(chat)) return api('sendMessage', { chat_id: msg.chat.id, text: '⛔ not allowlisted' });
  const parts = String(msg.text || '').trim().split(/\s+/);
  const cmd = (parts[0] || '').split('@')[0].replace('/', '');
  const arg = (parts[1] || '').trim();
  const by = 'telegram:' + chat;
  let out = '';
  try {
    if (cmd === 'status') out = JSON.stringify((await aura('/api/ops')).data).slice(0, 3800);
    else if (cmd === 'report') out = JSON.stringify((await aura('/api/report')).data).slice(0, 3800);
    else if (cmd === 'tasks') out = JSON.stringify((await aura('/api/modules/03/action/list')).data).slice(0, 3800);
    else if (cmd === 'snapshot') out = await runAction('snapshot', by);
    else if (cmd === 'sync') out = await runAction('sync', by);
    else if (cmd === 'learn' || cmd === 'brains') out = JSON.stringify((await aura('/api/hierarchy/knowledge')).data).slice(0, 3800);
    else if (cmd === 'kill') out = JSON.stringify((await EXEC.kill()).data).slice(0, 3800);
    else if (cmd === 'revive') out = (arg === 'CONFIRM') ? JSON.stringify((await EXEC.revive()).data).slice(0, 3800) : 'type: /revive CONFIRM';

    // ---------- Steuerzentrale ----------
    else if (cmd === 'tools') {
      const { data } = await aura(CC);
      const list = data.actions || [];
      out = list.length ? list.map((a) => `${a.enabled ? '✅' : '⏸'} ${a.id} · ${a.risk}${a.approval ? ' · Freigabe' : ''} — ${a.name}`).join('\n') : 'keine Aktionen gemeldet (401? Admin-Token prüfen)';
    } else if (cmd === 'on' || cmd === 'off') {
      if (!arg) out = 'Nutzung: /on <aktion> oder /off <aktion> (Liste: /tools)';
      else { const { status, data } = await aura(`${CC}/action/${encodeURIComponent(arg)}/${cmd === 'on' ? 'enable' : 'disable'}`, { method: 'POST', body: { by } }); out = data.ok ? `✅ ${data.id} ist jetzt ${data.enabled ? 'AN' : 'AUS'}` : `abgelehnt (HTTP ${status}): ${data.error}`; }
    } else if (cmd === 'pending') {
      const { data } = await aura(CC);
      const pend = data.pending || [];
      out = pend.length ? pend.map((x) => `${x.id} · ${x.action} · von ${x.by} · ${x.at}`).join('\n') + '\n→ /approve <id> oder /deny <id>' : 'keine offenen Freigaben';
    } else if (cmd === 'run') {
      if (!arg) out = 'Nutzung: /run <aktion> (Liste: /tools)';
      else if (WEB_ONLY.includes(arg)) out = `${arg} läuft nur im Web (/control), nicht über Telegram.`;
      else out = await runAction(arg, by);
    } else if (cmd === 'approve' || cmd === 'deny') {
      if (!arg) out = 'Nutzung: /approve AP-xxxxx bzw. /deny AP-xxxxx (Liste: /pending)';
      else {
        const { status, data } = await aura(`${CC}/${cmd}/${encodeURIComponent(arg)}`, { method: 'POST', body: { by } });
        if (!data.ok) out = `abgelehnt (HTTP ${status}): ${data.error}`;
        else {
          out = `✅ ${arg} ${cmd === 'approve' ? 'freigegeben' : 'abgelehnt'} (durch ${data.approval.decided_by})`;
          // Freigegebene Aktion direkt ausführen, wenn verdrahtet
          if (cmd === 'approve' && EXEC[data.approval.action]) { const r = await EXEC[data.approval.action](); out += `\nausgeführt: ${data.approval.action} (HTTP ${r.status})`; }
          else if (cmd === 'approve') out += `\n${data.approval.action} bitte im Web unter /control ausführen (nicht über Telegram verdrahtet).`;
        }
      }
    } else out = 'Befehle: /status /report /tasks /tools /on /off /run /pending /approve /deny /snapshot /sync /learn /brains /kill /revive CONFIRM';
  } catch (e) { out = 'error: ' + e.message; }
  return api('sendMessage', { chat_id: msg.chat.id, text: String(out).slice(0, 4000) });
}

let timer = null;
function start() {
  if (!ENABLED) return { ok: false, error: 'kein TELEGRAM_BOT_TOKEN gesetzt — Poller bleibt aus' };
  if (timer) return { ok: true, already: true };
  timer = setInterval(async () => {
  try {
    const r = await api('getUpdates', { offset, timeout: 20 });
    for (const u of r.result || []) { offset = u.update_id + 1; if (u.message) await handle(u.message); }
  } catch (e) { console.error('poll err', e.message); }
  }, 25000);
  console.log('telegram poller running; allowlist:', ALLOW.length ? ALLOW.join(',') : 'NONE (set TELEGRAM_ALLOWED_CHATS!)', '· admin token:', ADMIN ? 'gesetzt' : 'NICHT gesetzt (Schreibbefehle werden 401 liefern)');
  return { ok: true, allowlist: ALLOW.length, admin_token: !!ADMIN };
}
function stop() { if (timer) { clearInterval(timer); timer = null; } return { ok: true, running: false }; }
function status() { return { ok: true, module: 'telegram_poller', enabled: ENABLED, running: !!timer, allowlist: ALLOW.length, admin_token: !!ADMIN, commands: 'Befehle: /status /report /tasks /tools /on /off /run /pending /approve /deny /snapshot /sync /learn /brains /kill /revive CONFIRM' }; }

module.exports = { start, stop, status, handle, ENABLED };

// Direkt gestartet (node telegram_poller.js) → wie bisher loslaufen.
if (require.main === module) start();
