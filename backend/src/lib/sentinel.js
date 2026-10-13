'use strict';
// AURA Area 86 — SENTINEL: Live-Sicherheitswache & Scanner.
// Echte Daten aus /proc/net/tcp(6): offene Ports, aktive Verbindungen, Anomalien.
// Policy (vom Administrator vorgegeben): TRACE-FIRST — ein Angreifer wird zuerst
// beobachtet und dokumentiert (Beweise sammeln), DANN isoliert (Quarantäne) und
// dem Admin gemeldet. Loopback ist immer vertraut (Admin-Konsole). Kein Hack-Back:
// wir verteidigen, wir greifen niemals zurück.
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'data', 'sentinel.json');
const STATES = { '01': 'ESTABLISHED', '02': 'SYN_SENT', '05': 'SYN_RECV', '06': 'TIME_WAIT', '08': 'CLOSE_WAIT', '0A': 'LISTEN' };

function defaults() { return { events: [], blocklist: [], scans: [] }; }
function load() { try { return { ...defaults(), ...JSON.parse(fs.readFileSync(DATA, 'utf8')) }; } catch { return defaults(); } }
function save(db) { try { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); } catch {} }

function isLoopback(ip) { return ip === '127.0.0.1' || ip === '::1' || ip === '0:0:0:0:0:0:0:1' || ip === '::ffff:127.0.0.1'; }

function hexToIpPort(s, v6) {
  const [ipHex, portHex] = String(s).split(':');
  const port = parseInt(portHex, 16);
  if (!v6) {
    const ip = [3, 2, 1, 0].map((i) => parseInt(ipHex.substr(i * 2, 2), 16)).join('.');
    return { ip, port };
  }
  const bytes = [];
  for (let g = 0; g < 4; g++) { const word = ipHex.substr(g * 8, 8); for (let b = 3; b >= 0; b--) bytes.push(parseInt(word.substr(b * 2, 2), 16)); }
  if (bytes.slice(0, 12).join(',') === '0,0,0,0,0,0,0,0,0,0,255,255') return { ip: '::ffff:' + bytes.slice(12).join('.'), port };
  const hextets = []; for (let i = 0; i < 16; i += 2) hextets.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
  return { ip: hextets.join(':'), port };
}

function readSockets(file) {
  let txt; try { txt = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const v6 = file.endsWith('6');
  const out = [];
  for (const line of txt.trim().split('\n').slice(1)) {
    const c = line.trim().split(/\s+/);
    if (c.length < 4) continue;
    const local = hexToIpPort(c[1], v6), remote = hexToIpPort(c[2], v6);
    out.push({ local, remote, state: STATES[c[3]] || ('STATE_' + c[3]) });
  }
  return out;
}

function scan() {
  const sockets = [...readSockets('/proc/net/tcp'), ...readSockets('/proc/net/tcp6')];
  const listeners = [], established = [], anomalies = [];
  const allowedPorts = [Number(process.env.PORT || 8080)];
  for (const s of sockets) {
    if (s.state === 'LISTEN' && !listeners.some((l) => l.port === s.local.port)) listeners.push({ port: s.local.port, ip: s.local.ip, allowed: allowedPorts.includes(s.local.port) });
    if (s.state === 'ESTABLISHED') established.push({ local_port: s.local.port, peer: s.remote.ip, peer_port: s.remote.port });
  }
  for (const l of listeners) if (!l.allowed) anomalies.push({ level: 'high', type: 'unerwarteter-offener-port', detail: `Port ${l.port} lauscht (${l.ip}) — NICHT in der Erlaubnisliste ${JSON.stringify(allowedPorts)}` });
  const perPeer = {};
  for (const c of established) perPeer[c.peer] = (perPeer[c.peer] || 0) + 1;
  for (const [ip, n] of Object.entries(perPeer)) {
    if (!isLoopback(ip) && n >= 20) anomalies.push({ level: 'high', type: 'connection-flood', detail: `${n} gleichzeitige Verbindungen von ${ip}` });
  }
  const externalPeers = Object.keys(perPeer).filter((ip) => !isLoopback(ip));
  if (externalPeers.length) anomalies.push({ level: 'info', type: 'externe-peers', detail: `Verbundene Fremd-IPs (Preview-Proxy möglich): ${externalPeers.join(', ')}` });
  const verdict = anomalies.some((a) => a.level === 'high') ? 'ALARM' : (anomalies.length ? 'WACHSAM' : 'RUHIG');
  const result = { mode: 'LIVE', ts: new Date().toISOString(), verdict, listeners, established, anomalies, policy: 'TRACE-FIRST: dokumentieren → isolieren → Admin-Report. Loopback vertraut. Kein Hack-Back.' };
  const db = load(); db.scans.push({ ts: result.ts, verdict, anomalies: anomalies.length }); db.scans = db.scans.slice(-20); save(db);
  return result;
}

function recordEvent(ip, type, detail) {
  const db = load();
  db.events.push({ ts: new Date().toISOString(), ip, type, detail });
  db.events = db.events.slice(-500);
  save(db);
}

function block(ip, reason) {
  if (isLoopback(ip)) { const e = new Error('Loopback (Admin-Konsole) wird niemals blockiert'); e.code = 400; throw e; }
  const db = load();
  if (!db.blocklist.some((b) => b.ip === ip)) db.blocklist.push({ ip, reason: String(reason || 'manuelle Quarantäne'), ts: new Date().toISOString() });
  db.events.push({ ts: new Date().toISOString(), ip, type: 'quarantaene', detail: String(reason || 'manuelle Quarantäne') });
  db.events = db.events.slice(-500);
  save(db);
  return { ok: true, ip, quarantined: true };
}

function unblock(ip) {
  const db = load();
  const before = db.blocklist.length;
  db.blocklist = db.blocklist.filter((b) => b.ip !== ip);
  save(db);
  return { ok: true, ip, released: before > db.blocklist.length };
}

function isBlocked(ip) { if (!ip || isLoopback(ip)) return false; return load().blocklist.some((b) => b.ip === ip); }

// ---------- Live-Wächter im Request-Pfad (speicherresident, leichtgewichtig) ----------
const SUSPICIOUS = /\/api\/ops\/kill|\/terminal|\/exec|\.\.|\/wp-|\/phpmyadmin|\/\.env|\/\.git|\/cgi-bin/i;
const hits = new Map();       // ip -> [timestamps] verdächtige Treffer
const rate = new Map();       // ip -> [timestamps] alle Requests
const WINDOW = 10 * 60 * 1000, HITS_LIMIT = 25;      // Auto-Quarantäne-Schwelle (vom Admin autorisiert)
const RATE_WINDOW = 10 * 1000, RATE_LIMIT = 200;     // App-Level-DDoS-Bremse

function observe(ip, p) {
  if (!ip || isLoopback(ip)) return;
  if (!SUSPICIOUS.test(p)) return;
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  arr.push(now); hits.set(ip, arr);
  recordEvent(ip, 'verdacht', `${p} (${arr.length}/${HITS_LIMIT} im Fenster)`);
  if (arr.length >= HITS_LIMIT && !isBlocked(ip)) {
    block(ip, `Auto-Quarantäne: ${arr.length} verdächtige Zugriffe in ${WINDOW / 60000} min (Trace-first abgeschlossen, Beweise in events)`);
  }
}

function rateLimited(ip) {
  if (!ip || isLoopback(ip)) return false;
  const now = Date.now();
  const arr = (rate.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  arr.push(now); rate.set(ip, arr);
  if (rate.size > 5000) { for (const [k, v] of rate) if (v[v.length - 1] < now - 60000) rate.delete(k); }
  return arr.length > RATE_LIMIT;
}

function events() { const db = load(); return { events: db.events.slice(-100).reverse(), total: db.events.length }; }

function status() {
  const db = load();
  const last = db.scans[db.scans.length - 1] || null;
  return {
    mode: 'LIVE', area: '86', name: 'Sentinel — Live-Sicherheitswache & Scanner',
    policy: 'TRACE-FIRST: beobachten + dokumentieren → isolieren → Admin-Report. Loopback immer vertraut. Kein Hack-Back.',
    blocklist: db.blocklist, events_total: db.events.length,
    last_scan: last, ddos: 'App-Level-Rate-Limit LIVE (200 req/10s pro Fremd-IP, 429). Volumetrische Angriffe: Reverse-Proxy/fail2ban auf den Root-Servern empfohlen (Doku §29).',
  };
}

const meta = { area: '86', name: 'Sentinel — Live-Sicherheitswache & Scanner', state: 'live' };
const actions = {
  scan: () => scan(),
  block: (p) => block(String((p || {}).ip || ''), (p || {}).reason),
  unblock: (p) => unblock(String((p || {}).ip || '')),
  events: () => events(),
  status: () => status(),
};

module.exports = { meta, actions, scan, block, unblock, isBlocked, observe, rateLimited, events, status, isLoopback };
