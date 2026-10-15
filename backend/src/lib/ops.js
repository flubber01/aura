'use strict';
// OPS: backup scheduler (12h super / 4h others / 24h full sync), emergency
// kill switch, Telegram control palette (BotFather, official API).
const fs = require('fs');
const path = require('path');
const store = require('./store');
const chrono = require('./chrono_backup_daemon');
const swarm = require('./swarm_sync_daemon');
const logger = require('./self_healing_logger');

const DATA = path.join(__dirname, '..', 'data');
// demo mode shrinks hours->seconds so the schedule is observable in preview
const DEMO = process.env.AURA_SCHED_DEMO === '1';
const H = DEMO ? 1 / 3600 : 1; // hours factor
const SCHED = {
  super_brain_autosave_h: 12, // latest db of the super brain
  others_autosave_h: 4,       // feedback, vita, checkpoints
  full_sync_h: 24,            // all dbs synced + checksummed
};
let timers = [], killed = { on: false, reason: null, at: null };
let lastRuns = { super: null, others: null, full: null };

function runSuper() {
  try {
    const s = chrono.snapshot();
    lastRuns.super = new Date().toISOString();
    store.audit({ area: 'OPS', event: 'autosave_super_brain_db', name: s.name });
    logger.info('autosave super-brain db: ' + s.name);
    return s;
  } catch (e) { logger.error('super autosave failed: ' + e.message); }
}
function runOthers() {
  try {
    const dir = path.join(DATA, 'autosave');
    fs.mkdirSync(dir, { recursive: true });
    const payload = {
      at: new Date().toISOString(),
      feedback: JSON.parse(fs.readFileSync(path.join(DATA, 'feedback.json'), 'utf8').toString() || '{}'),
      vita: JSON.parse(fs.readFileSync(path.join(DATA, 'vita.json'), 'utf8').toString() || '[]'),
      store_tasks: store.get().tasks.length,
    };
    fs.writeFileSync(path.join(dir, 'others-' + Date.now() + '.json'), JSON.stringify(payload, null, 2));
    // bounded retention: keep 10
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('others-')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 10))) fs.rmSync(path.join(dir, f));
    lastRuns.others = new Date().toISOString();
    store.audit({ area: 'OPS', event: 'autosave_other_dbs' });
  } catch (e) { logger.error('others autosave failed: ' + e.message); }
}
function runFullSync() {
  try {
    const cp = swarm.exportCheckpoint();   // checksummed full-state checkpoint
    const s = chrono.snapshot();           // verified-restorable snapshot
    lastRuns.full = new Date().toISOString();
    store.audit({ area: 'OPS', event: 'full_db_sync', checkpoint: cp.file, snapshot: s.name });
    logger.info('24h full db sync: ' + cp.file + ' + ' + s.name);
    return { checkpoint: cp.file, snapshot: s.name };
  } catch (e) { logger.error('full sync failed: ' + e.message); }
}

function startScheduler() {
  if (timers.length) return { already_running: true };
  timers.push(setInterval(runSuper, 12 * 3600 * 1000 * H));
  timers.push(setInterval(runOthers, 4 * 3600 * 1000 * H));
  timers.push(setInterval(runFullSync, 24 * 3600 * 1000 * H));
  timers.forEach((t) => t.unref());
  runOthers(); // initial
  return { started: true, demo: DEMO, schedule: SCHED };
}
function stopScheduler() { timers.forEach(clearInterval); timers = []; return { stopped: true }; }

// ---------- kill switch ----------
function kill(reason) {
  killed = { on: true, reason: String(reason || 'manual'), at: new Date().toISOString() };
  stopScheduler();
  store.audit({ area: 'OPS', event: 'KILL_SWITCH_ENGAGED', reason: killed.reason });
  logger.error('KILL SWITCH: ' + killed.reason);
  return status();
}
function revive(reason) {
  killed = { on: false, reason: 'revived: ' + (reason || 'manual'), at: new Date().toISOString() };
  startScheduler();
  store.audit({ area: 'OPS', event: 'kill_switch_revived', reason: killed.reason });
  return status();
}
const isKilled = () => killed.on;

// ---------- restart server now ----------
// Controlled self re-exec: audit-logged, then a detached replacement process
// is spawned and this process exits so the supervisor/port frees cleanly.
// Under systemd (Restart=always) it comes back automatically; the spawned
// child covers environments without a supervisor.
function restartNow(reason) {
  const { spawn } = require('child_process');
  store.audit({ area: 'OPS', event: 'SERVER_RESTART_REQUESTED', reason: String(reason || 'manual') });
  logger.error('RESTART: ' + (reason || 'manual'));
  try {
    const serverPath = path.join(__dirname, '..', '..', 'server.js');
    // kurzer Delay, damit der Port frei wird, bevor der Nachfolger bindet
    const child = spawn('sh', ['-c', 'sleep 1.2; exec ' + JSON.stringify(process.execPath) + ' ' + JSON.stringify(serverPath)], { detached: true, stdio: 'ignore', env: process.env });
    child.unref();
  } catch (e) { logger.error('restart spawn failed: ' + e.message); }
  // give the response a moment to flush, then exit (supervisor restarts)
  setTimeout(() => process.exit(0), 400);
  return status();
}

function status() {
  return { kill_switch: killed, schedule: SCHED, demo_mode: DEMO, last_runs: lastRuns, scheduler_running: timers.length > 0 };
}

// ---------- telegram control (BotFather, official API) ----------
const TG_COMMANDS = [
  ['status', 'fleet health + kill state'],
  ['report', 'daily report JSON'],
  ['tasks', 'last 5 tasks'],
  ['snapshot', 'trigger super-brain autosave now'],
  ['sync', 'trigger 24h full sync now'],
  ['learn', 'learning curve stats'],
  ['kill', 'EMERGENCY KILL SWITCH (engages)'],
  ['revive', 'revive after kill (2nd confirmation word required)'],
  ['brains', 'hierarchy knowledge stats'],
];
function telegramKit() {
  return {
    botfather_steps: [
      '1. Open Telegram → @BotFather → /newbot → choose name + username (ends with bot).',
      '2. Copy the token; store it in your SECRET MANAGER as TELEGRAM_BOT_TOKEN (never in code/repo).',
      '3. /setcommands → paste the palette below.',
      '4. Run the poller on a machine WITH egress (not this sandbox): node backend/src/lib/telegram_poller.js',
      '5. Poller talks to your AURA backend over AURA_URL (tunnel or same host).',
    ],
    commands: TG_COMMANDS.map(([c, d]) => ({ command: c, description: d })),
    setcommands_payload: { commands: TG_COMMANDS.map(([c, d]) => ({ command: c, description: d })) },
    security: ['chat-id allowlist (TELEGRAM_ALLOWED_CHATS) — only YOUR chat may command the fleet', 'kill/revive require the allowlist + revive needs confirmation word', 'no secrets in bot messages'],
  };
}

module.exports = { startScheduler, stopScheduler, runSuper, runOthers, runFullSync, kill, revive, isKilled, restartNow, status, telegramKit, SCHED };
