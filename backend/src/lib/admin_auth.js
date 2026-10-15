'use strict';
// Minimal zero-dependency owner authentication for production deployments.
// It is deliberately opt-in: AURA_AUTH_REQUIRED=true blocks non-public API/page
// access. Without that environment flag, status remains visible but existing local
// development behavior is retained. Passwords are scrypt hashes; session cookies
// are signed and runtime-only.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'admin_auth.json');
const SESSION_TTL_MS = Math.max(15 * 60 * 1000, Math.min(7 * 24 * 60 * 60 * 1000, Number(process.env.AURA_SESSION_TTL_HOURS || 12) * 60 * 60 * 1000));
const EPHEMERAL_SECRET = crypto.randomBytes(48).toString('hex');
const PUBLIC_API = new Set(['/api/health', '/api/auth/status', '/api/auth/bootstrap', '/api/auth/login']);
const PUBLIC_PAGES = new Set(['/login']);

function bool(value) { return /^(1|true|yes|on)$/i.test(String(value || '')); }
function now() { return new Date().toISOString(); }
function clean(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function error(message, code) { const e = new Error(message); e.code = code || 400; return e; }
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { schema_version: 1, sessions: [], ...db, sessions: Array.isArray(db.sessions) ? db.sessions : [] };
  } catch { return { schema_version: 1, owner: null, sessions: [] }; }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n'); fs.renameSync(tmp, FILE);
}
function configuredSecret() { return process.env.AURA_SESSION_SECRET || EPHEMERAL_SECRET; }
function sessionSecretMode() { return process.env.AURA_SESSION_SECRET ? 'ENV_CONFIGURED' : 'EPHEMERAL_PROCESS_ONLY'; }
function required() { return bool(process.env.AURA_AUTH_REQUIRED); }
function cookies(req) {
  const raw = String((req.headers || {}).cookie || ''); const out = {};
  for (const part of raw.split(';')) { const index = part.indexOf('='); if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); }
  return out;
}
function sign(id) { return crypto.createHmac('sha256', configuredSecret()).update(id).digest('base64url'); }
function secureCookie(req) { return bool(process.env.AURA_COOKIE_SECURE) || String((req.headers || {})['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'; }
function cookieHeader(name, value, req, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge || 0))}${secureCookie(req) ? '; Secure' : ''}`;
}
function passwordHash(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function validPassword(password) {
  const p = String(password || '');
  return p.length >= 14 && p.length <= 256 && /[A-Za-z]/.test(p) && /\d/.test(p);
}
function cleanup(db) {
  const before = db.sessions.length; const current = Date.now();
  db.sessions = db.sessions.filter((session) => Date.parse(session.expires_at || '') > current);
  return db.sessions.length !== before;
}
function actor(req) {
  const pair = cookies(req).aura_admin_session || ''; const [id, signature] = pair.split('.');
  if (!id || !signature) return null;
  const expected = sign(id);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const db = load(); let changed = cleanup(db);
  const session = db.sessions.find((entry) => entry.id === id);
  if (!session || Date.parse(session.expires_at || '') <= Date.now()) { if (changed) save(db); return null; }
  session.last_seen_at = now(); changed = true; if (changed) save(db);
  return { id: session.user_id, name: session.name, role: session.role, csrf_token: session.csrf_token, expires_at: session.expires_at, authenticated: true };
}
function sameOrigin(req) {
  const origin = String((req.headers || {}).origin || '');
  if (!origin) return true; // non-browser clients authenticate by the signed cookie; SameSite=Strict protects browser cookies.
  try {
    const originUrl = new URL(origin); const host = String((req.headers || {}).host || '');
    return originUrl.host === host;
  } catch { return false; }
}
function status(req) {
  const db = load(); const active = db.sessions.filter((session) => Date.parse(session.expires_at || '') > Date.now()).length;
  const currentActor = req ? actor(req) : null;
  return {
    mode: required() ? 'AUTH_REQUIRED' : (db.owner ? 'AUTH_READY_NOT_ENFORCED' : 'SETUP_REQUIRED_NOT_ENFORCED'),
    enforcement: required(), owner_configured: !!db.owner,
    bootstrap_available: !db.owner && !!process.env.AURA_AUTH_BOOTSTRAP_TOKEN,
    bootstrap_note: !db.owner && !process.env.AURA_AUTH_BOOTSTRAP_TOKEN ? 'Set AURA_AUTH_BOOTSTRAP_TOKEN outside Git before creating the first owner.' : null,
    session_secret_mode: sessionSecretMode(), session_ttl_hours: Math.round(SESSION_TTL_MS / 3600000), active_sessions: active,
    actor: currentActor ? { id: currentActor.id, name: currentActor.name, role: currentActor.role, expires_at: currentActor.expires_at } : null,
    production_checklist: ['Set AURA_AUTH_BOOTSTRAP_TOKEN only for initial owner creation, then remove it.', 'Set AURA_SESSION_SECRET to a high-entropy external secret.', 'Set AURA_AUTH_REQUIRED=true only after owner login was verified.', 'Serve through HTTPS and a restrictive reverse proxy.'],
  };
}
function issueSession(db, user, req) {
  cleanup(db);
  const id = crypto.randomBytes(24).toString('base64url'); const csrf = crypto.randomBytes(24).toString('base64url');
  const session = { id, user_id: user.id, name: user.name, role: user.role, csrf_token: csrf, created_at: now(), last_seen_at: now(), expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() };
  db.sessions.push(session); db.sessions = db.sessions.slice(-30); save(db);
  return { session, set_cookie: cookieHeader('aura_admin_session', id + '.' + sign(id), req, SESSION_TTL_MS / 1000) };
}
function bootstrap(body, req) {
  const db = load(); if (db.owner) throw error('An owner is already configured.', 409);
  const expected = String(process.env.AURA_AUTH_BOOTSTRAP_TOKEN || '');
  if (!expected) throw error('Bootstrap is disabled until AURA_AUTH_BOOTSTRAP_TOKEN is set outside Git.', 409);
  const received = String((body || {}).bootstrap_token || '');
  if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) throw error('Invalid bootstrap token.', 403);
  const name = clean((body || {}).name, 80); const password = String((body || {}).password || '');
  if (name.length < 3) throw error('Owner name must contain at least 3 characters.');
  if (!validPassword(password)) throw error('Password must be 14+ characters and contain letters and numbers.');
  const salt = crypto.randomBytes(24).toString('hex');
  db.owner = { id: 'owner-' + crypto.randomBytes(6).toString('hex'), name, role: 'owner', password_salt: salt, password_hash: passwordHash(password, salt), created_at: now() };
  const issued = issueSession(db, db.owner, req);
  return { ok: true, owner: { id: db.owner.id, name: db.owner.name, role: db.owner.role }, csrf_token: issued.session.csrf_token, set_cookie: issued.set_cookie, note: 'Owner created. Remove AURA_AUTH_BOOTSTRAP_TOKEN and set AURA_SESSION_SECRET before enabling AURA_AUTH_REQUIRED.' };
}
function login(body, req) {
  const db = load(); if (!db.owner) throw error('No owner is configured. Bootstrap is required first.', 409);
  const password = String((body || {}).password || ''); const candidate = passwordHash(password, db.owner.password_salt);
  if (candidate.length !== db.owner.password_hash.length || !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(db.owner.password_hash))) throw error('Invalid credentials.', 401);
  const issued = issueSession(db, db.owner, req);
  return { ok: true, actor: { id: db.owner.id, name: db.owner.name, role: db.owner.role }, csrf_token: issued.session.csrf_token, set_cookie: issued.set_cookie };
}
function logout(req) {
  const raw = cookies(req).aura_admin_session || ''; const id = raw.split('.')[0]; const db = load();
  db.sessions = db.sessions.filter((session) => session.id !== id); save(db);
  return { ok: true, set_cookie: cookieHeader('aura_admin_session', '', req, 0) };
}
function guard(req, pathname) {
  const currentActor = actor(req);
  if (!required()) return { allow: true, actor: currentActor, mode: 'NOT_ENFORCED' };
  if (PUBLIC_API.has(pathname) || PUBLIC_PAGES.has(pathname) || !pathname.startsWith('/api/') && !['/admin', '/jarvis', '/workflows', '/console', '/ops', '/models', '/cluster'].includes(pathname)) return { allow: true, actor: currentActor, mode: 'PUBLIC' };
  if (!currentActor) return { allow: false, code: 401, error: 'Authentication required. Open /login.', actor: null };
  if (!sameOrigin(req)) return { allow: false, code: 403, error: 'Cross-origin admin request blocked.', actor: null };
  return { allow: true, actor: currentActor, mode: 'AUTHENTICATED' };
}
module.exports = { status, bootstrap, login, logout, actor, guard, required, validPassword };
