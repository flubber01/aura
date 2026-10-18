'use strict';
// AURA Area 38 — Identity Vault / Inbox Orchestration (LIVE, sicher redesign).
// Echter Secret-Manager: AES-256-GCM-Verschlüsselung AT REST, Schlüssel NUR
// aus ENV/deploy/.env (nie im Repo), kein Logging von Werten, Audit-Pflicht
// bei jedem Zugriff. Inbox-Orchestration: Mail-Adapter-Konfiguration (Area OPS).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FILE = process.env.AURA_VAULT_FILE || path.join(__dirname, '..', 'data', 'vault.enc.json');
const ENV_FILE = path.join(__dirname, '..', '..', '..', 'deploy', '.env');
function parseEnvFile(f) { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])); } catch { return {}; } }

function key() {
  const env = { ...parseEnvFile(ENV_FILE), ...process.env };
  const k = env.AURA_VAULT_KEY || '';
  if (!k) return null;
  return crypto.createHash('sha256').update(k).digest();
}
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const k = key();
    if (!k) return { entries: [], locked: true, reason: 'AURA_VAULT_KEY nicht gesetzt (deploy/.env)' };
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(raw.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(raw.tag, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(raw.data, 'base64')), decipher.final()]).toString('utf8');
    return { entries: JSON.parse(plain), locked: false };
  } catch { return { entries: [], locked: false }; }
}
function save(entries) {
  const k = key();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  if (!k) return false;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(entries), 'utf8'), cipher.final()]);
  fs.writeFileSync(FILE, JSON.stringify({ algo: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: enc.toString('base64'), updated_at: new Date().toISOString() }, null, 2));
  return true;
}
function audit(entry) { try { require('./store').audit({ area: '38', ...entry }); } catch {} }

function addSecret(body) {
  const name = String((body || {}).name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60);
  const value = String(body.value || '');
  if (!name || !value) { const e = new Error('name + value fehlen'); e.code = 400; throw e; }
  const st = load();
  if (st.locked) { const e = new Error(st.reason); e.code = 423; throw e; }
  const entries = st.entries.filter((x) => x.name !== name);
  entries.push({ name, value, scope: String(body.scope || 'general').slice(0, 60), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (!save(entries)) { const e = new Error('AURA_VAULT_KEY fehlt — nichts wurde gespeichert'); e.code = 423; throw e; }
  audit({ action: 'vault.add', name });
  return { ok: true, name, encrypted: true, note: 'Wert ist AES-256-GCM-verschlüsselt gespeichert und erscheint in keiner Ausgabe' };
}
function listSecrets() {
  const st = load();
  if (st.locked) return { ok: true, locked: true, reason: st.reason, entries: [] };
  return { ok: true, locked: false, entries: st.entries.map((x) => ({ name: x.name, scope: x.scope, updated_at: x.updated_at })) };
}
function getSecret(name) {
  const st = load();
  if (st.locked) { const e = new Error(st.reason); e.code = 423; throw e; }
  const x = st.entries.find((y) => y.name === String(name).toLowerCase());
  if (!x) { const e = new Error('Secret nicht gefunden'); e.code = 404; throw e; }
  audit({ action: 'vault.read', name: x.name });
  return { ok: true, name: x.name, value: x.value, note: 'Zugriff wurde protokolliert (Audit)' };
}
function removeSecret(name) {
  const st = load();
  if (st.locked) { const e = new Error(st.reason); e.code = 423; throw e; }
  const before = st.entries.length;
  const entries = st.entries.filter((x) => x.name !== String(name).toLowerCase());
  save(entries);
  audit({ action: 'vault.remove', name: String(name) });
  return { ok: true, removed: before - entries.length };
}
function inboxes() {
  const mail = require('./mail_adapter');
  return { mail_adapter: mail.status ? mail.status() : Object.keys(mail), note: 'Inbox-Orchestration läuft über den OPS-Mail-Gate (Compose → Freigabe → Adapter)' };
}
function status() {
  const st = load();
  return { area: '38', mode: 'LIVE', locked: st.locked, reason: st.reason || null, secrets: st.locked ? null : st.entries.length, crypto: 'AES-256-GCM at rest · Schlüssel nur aus ENV/deploy/.env · Audit bei jedem Zugriff', rule: 'keine Credentials in committeten Dateien, kein Logging von Werten' };
}

module.exports = {
  meta: { area: '38', id: 'vault', name: 'Identity vault (AES-256-GCM secrets) + inbox orchestration', state: 'live' },
  actions: { status: () => status(), add: (p) => addSecret(p || {}), list: () => listSecrets(), read: (p) => getSecret(String((p || {}).name)), remove: (p) => removeSecret(String((p || {}).name)), inboxes: () => inboxes() },
  status, addSecret, listSecrets, getSecret, removeSecret, inboxes,
};
