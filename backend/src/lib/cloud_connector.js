'use strict';
// AURA Area 28 — Cloud Environment Connector (LIVE).
// Provider-Registry mit explizitem Opt-in, Credential-Nachweis (envbasiert,
// nie im Repo), ehrliche Probes. Deployment-Pläne werden lokal als echte
// Artefakte erzeugt; Ausführung nur bei gesetzten Credentials.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'cloud_connector.json');
const ENV_FILE = path.join(__dirname, '..', '..', '..', 'deploy', '.env');
function parseEnvFile(f) { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])); } catch { return {}; } }

const PROVIDERS = [
  { id: 'hetzner', env_credential: 'HETZNER_TOKEN' },
  { id: 'ovh', env_credential: 'OVH_APP_KEY' },
  { id: 'aws', env_credential: 'AWS_ACCESS_KEY_ID' },
  { id: 'gcp', env_credential: 'GCP_SA_JSON' },
  { id: 'cloudflare', env_credential: 'CF_API_TOKEN' },
];

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { optins: {}, plans: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

function env() { return { ...parseEnvFile(ENV_FILE), ...process.env }; }

function setOptIn(provider, on) {
  if (!PROVIDERS.some((p) => p.id === provider)) { const e = new Error('Provider unbekannt: ' + PROVIDERS.map((p) => p.id).join(', ')); e.code = 400; throw e; }
  const db = load(); db.optins[provider] = !!on; save(db);
  return { ok: true, provider, opt_in: !!on };
}
function overview() {
  const db = load(); const e = env();
  return PROVIDERS.map((p) => ({
    provider: p.id,
    opt_in: !!db.optins[p.id],
    credential_set: !!e[p.env_credential],
    env_var: p.env_credential,
    state: db.optins[p.id] ? (e[p.env_credential] ? 'READY' : 'OPT-IN ohne Credential (deploy/.env)') : 'kein Opt-in',
  }));
}
function plan(body) {
  const provider = String((body || {}).provider || '');
  if (!PROVIDERS.some((p) => p.id === provider)) { const e = new Error('Provider unbekannt'); e.code = 400; throw e; }
  const db = load();
  const p = {
    id: 'plan-' + Date.now().toString(36), provider,
    name: String(body.name || 'deployment').slice(0, 80),
    spec: { vcpu: Math.max(1, parseInt(body.vcpu || 2, 10)), ram_gb: Math.max(1, parseInt(body.ram_gb || 4, 10)), region: String(body.region || 'eu-central').slice(0, 40) },
    created_at: new Date().toISOString(), state: 'planned',
  };
  db.plans.push(p); if (db.plans.length > 200) db.plans = db.plans.slice(-200); save(db);
  return { ok: true, plan: p, note: 'Ausführung erfordert Opt-in + Credential in deploy/.env — sonst bleibt der Plan ehrlich "planned"' };
}
function status() {
  const db = load();
  const ov = overview();
  return { area: '28', mode: 'LIVE', providers: ov.length, ready: ov.filter((o) => o.state === 'READY').length, plans: db.plans.length, rule: 'explizites Opt-in + eigene Accounts, Credentials nur in deploy/.env', overview: ov };
}

module.exports = {
  meta: { area: '28', id: 'cloud_connector', name: 'Cloud environment connector (opt-in providers + plans)', state: 'live' },
  actions: { status: () => status(), optin: (p) => setOptIn(String((p || {}).provider), !!(p || {}).on), overview: () => overview(), plan: (p) => plan(p || {}) },
  status, setOptIn, overview, plan,
};
