'use strict';
// AURA · Nutzer-Bereich: ein Konto für das ganze Projekt — und für alles, was daran hängt.
//
// Der Nutzer-Bereich ist der eine Ort, an dem ein Mensch sieht: wer bin ich hier, was darf ich,
// was gehört mir, was liegt bei mir, was wartet auf meine Freigabe. Er ersetzt kein Modul — er holt
// sich die Zahlen aus den Modulen (Songs, Videos, Kampagnen, Rechnungen, Tickets, Sitzungen).
//
// Rollen und Rechte sind nicht dekorativ: `can()` ist die Prüfung, die andere Teile aufrufen können.
//   owner  — alles, einschließlich Freigaben und Nutzerverwaltung
//   admin  — alles außer Nutzer löschen und Geheimnisse
//   artist — eigene Inhalte, eigene Kanäle, eigene Sicht
//   editor — Inhalte vorbereiten, nichts veröffentlichen
//   viewer — nur ansehen
//
// Und die Regel, die über allem steht: Freigaben (veröffentlichen, Geld ausgeben) kann NUR die Rolle
// owner/admin — und auch die nur als Mensch, über die Freigabe-Tür.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_USERS_FILE || path.join(__dirname, '..', 'data', 'users.json');

const ROLES = {
  owner: { rank: 50, label: 'Inhaber', can: ['*'] },
  admin: { rank: 40, label: 'Verwaltung', can: ['view', 'create', 'edit', 'schedule', 'decide', 'manage_users', 'support_reply'] },
  artist: { rank: 30, label: 'Künstler', can: ['view', 'create', 'edit', 'own_only'] },
  editor: { rank: 20, label: 'Redaktion', can: ['view', 'create'] },
  viewer: { rank: 10, label: 'Betrachter', can: ['view'] },
};

const PREFERENCES = {
  language: ['de', 'en'],
  theme: ['system', 'dark', 'light'],
  landing: ['/konto', '/studio-live', '/messenger', '/analyse', '/start'],
  greeting: ['du', 'sie'],
};

function defaults() { return { users: [], sessions: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['users', 'sessions', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// ---------------------------------------------------------------- Rechte
function can(role, action, context) {
  const r = ROLES[String(role || '').toLowerCase()];
  if (!r) return { ok: false, allowed: false, error: `Rolle "${role}" gibt es nicht` };
  if (r.can.includes('*')) return { ok: true, allowed: true, role, action };
  if (r.can.includes(action)) return { ok: true, allowed: true, role, action, own_only: r.can.includes('own_only') };
  return { ok: false, allowed: false, role, action, error: `Rolle "${role}" darf "${action}" nicht.`, allowed_roles: Object.entries(ROLES).filter(([, v]) => v.can.includes('*') || v.can.includes(action)).map(([k]) => k) };
}

// ---------------------------------------------------------------- Nutzer
function create(input) {
  const d = load();
  const p = input || {};
  const name = String(p.name || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) return { ok: false, error: 'name: 3–32 Zeichen, Buchstaben/Zahlen/._-' };
  if (d.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Name ist schon vergeben' };
  const role = Object.keys(ROLES).includes(String(p.role || '').toLowerCase()) ? String(p.role).toLowerCase() : 'viewer';
  const u = {
    id: 'u-' + Math.random().toString(16).slice(2, 10),
    name, display_name: String(p.display_name || name).slice(0, 60),
    role, artist_ref: p.artist_ref || null,
    active: true,
    preferences: {
      language: PREFERENCES.language.includes(p.language) ? p.language : 'de',
      theme: PREFERENCES.theme.includes(p.theme) ? p.theme : 'system',
      landing: PREFERENCES.landing.includes(p.landing) ? p.landing : '/konto',
      greeting: PREFERENCES.greeting.includes(p.greeting) ? p.greeting : 'du',
    },
    created_at: new Date().toISOString(),
    note: 'Anmeldung erfolgt über Artist-Konten (Passwort) oder über einen verbundenen Kanal (Social-Login).',
  };
  d.users.unshift(u); d.users = d.users.slice(0, 200);
  d.audit.unshift({ at: u.created_at, action: 'create_user', id: u.id, role });
  save(d);
  return { ok: true, user: u, permissions: ROLES[role] };
}

function setRole(id, role) {
  const d = load();
  const u = d.users.find((x) => x.id === id || x.name === id);
  if (!u) return { ok: false, error: 'Nutzer nicht gefunden' };
  if (!ROLES[String(role || '').toLowerCase()]) return { ok: false, error: `Rolle unbekannt. Erlaubt: ${Object.keys(ROLES).join(', ')}` };
  const alt = u.role;
  u.role = String(role).toLowerCase();
  d.audit.unshift({ at: new Date().toISOString(), action: 'set_role', id: u.id, from: alt, to: u.role });
  save(d);
  return { ok: true, user: { id: u.id, name: u.name, role: u.role }, changed_from: alt };
}

function preferences(id, patch) {
  const d = load();
  const u = d.users.find((x) => x.id === id || x.name === id);
  if (!u) return { ok: false, error: 'Nutzer nicht gefunden' };
  const p = patch || {};
  const applied = [];
  for (const [k, allowed] of Object.entries(PREFERENCES)) {
    if (p[k] === undefined) continue;
    if (!allowed.includes(p[k])) return { ok: false, error: `"${k}" kann nicht "${p[k]}" sein. Erlaubt: ${allowed.join(', ')}` };
    u.preferences[k] = p[k]; applied.push(k);
  }
  if (!applied.length) return { ok: false, error: `nichts zu ändern. Felder: ${Object.keys(PREFERENCES).join(', ')}` };
  d.audit.unshift({ at: new Date().toISOString(), action: 'preferences', id: u.id, applied });
  save(d);
  return { ok: true, preferences: u.preferences, applied };
}

// ---------------------------------------------------------------- Übersicht (holt Zahlen aus den Modulen)
function safe(fn, fallback) { try { const v = fn(); return v === undefined || v === null ? fallback : v; } catch { return fallback; } }

function dashboard(id) {
  const d = load();
  const u = d.users.find((x) => x.id === id || x.name === id);
  if (!u) return { ok: false, error: 'Nutzer nicht gefunden' };

  const tiles = [];
  const songs = safe(() => require('./songbook').status(), {});
  if (songs.counts) tiles.push({ key: 'Songs', value: songs.counts.songs || 0, sub: `${songs.counts.released || 0} veröffentlicht` });
  const campaigns = safe(() => require('./campaign_planner').releaseBoard(), { rows: [] });
  tiles.push({ key: 'Releases geplant', value: (campaigns.rows || []).length, sub: campaigns.next_release ? `nächster: ${campaigns.next_release.release_date}` : 'keiner geplant' });
  const vids = safe(() => require('./video_department').board(), { open: 0 });
  tiles.push({ key: 'Video-Aufträge', value: vids.open || 0, sub: 'offen in der Abteilung' });
  const gates = safe(() => require('./human_final').open(), { count: 0 });
  tiles.push({ key: 'Warten auf dich', value: gates.count || 0, sub: 'menschliche Freigaben' });
  const invoices = safe(() => require('./billing_plans').status(), {});
  tiles.push({ key: 'Belege', value: invoices.invoices || 0, sub: invoices.payment_mode || 'lokal geführt' });
  const tickets = safe(() => require('./support').open(), { count: 0 });
  tiles.push({ key: 'Support', value: tickets.count || 0, sub: 'offene Anliegen' });
  const devices = safe(() => require('./daw_devices').status(), {});
  tiles.push({ key: 'Studio-Geräte', value: devices.detected_devices || 0, sub: devices.system_mode || 'nicht abgefragt' });
  const storage = safe(() => require('./content_store').status(), {});
  tiles.push({ key: 'Inhalte gespeichert', value: storage.items || 0, sub: storage.bytes_human || '0 B' });

  return {
    ok: true,
    user: { id: u.id, name: u.name, display_name: u.display_name, role: u.role, role_label: ROLES[u.role].label, preferences: u.preferences },
    permissions: ROLES[u.role].can,
    tiles,
    quick_actions: ['/studio-live', '/messenger', '/analyse', '/support'].concat(can(u.role, 'decide').allowed ? ['/console'] : []),
    note: u.role === 'artist' ? 'Künstler-Sicht: nur eigene Inhalte und eigene Kanäle.' : 'Voll- oder Teil-Sicht je nach Rolle.',
  };
}

function list() {
  const d = load();
  return {
    ok: true, count: d.users.length,
    users: d.users.map((u) => ({ id: u.id, name: u.name, display_name: u.display_name, role: u.role, active: u.active, landing: u.preferences.landing })),
    roles: Object.entries(ROLES).map(([id, r]) => ({ id, label: r.label, rank: r.rank, can: r.can })),
  };
}

// Eine echte Prüfung für andere Module: darf dieser Nutzer diese Handlung?
function check(input) {
  const p = input || {};
  const d = load();
  const u = d.users.find((x) => x.id === p.user || x.name === p.user);
  if (!u) return { ok: false, allowed: false, error: 'Nutzer nicht gefunden' };
  const c = can(u.role, String(p.action || 'view'));
  const needsHuman = ['decide', 'publish', 'spend'].includes(String(p.action || ''));
  return { ...c, user: u.name, human_required: needsHuman, note: needsHuman ? 'Auch mit Recht bleibt es eine menschliche Entscheidung — Freigabe-Tür beachten.' : null };
}

function status() {
  const d = load();
  const byRole = {};
  for (const u of d.users) byRole[u.role] = (byRole[u.role] || 0) + 1;
  return {
    area: 'USER', module: 'user_area', state: 'live', file: FILE,
    users: d.users.length, by_role: byRole,
    roles: Object.keys(ROLES), preferences: Object.keys(PREFERENCES),
    rules: ['Rollen sind Rechteprüfungen, keine Etiketten.', 'Veröffentlichen und Geld ausgeben bleiben menschlich — auch für den Inhaber.', 'Künstler sehen ihre eigenen Inhalte; fremde Konten sind gesperrt.', 'Der Bereich erfindet keine Zahlen: er holt sie aus den Modulen.'],
  };
}

module.exports = {
  meta: { area: 'USER', id: 'user_area', name: 'Nutzer-Bereich (Rollen, Rechte, Übersicht)', state: 'live' },
  actions: { status: () => status(), roles: () => ({ ok: true, roles: ROLES, preferences: PREFERENCES }), create: (p) => create(p || {}), role: (p) => setRole((p || {}).id, (p || {}).role), preferences: (p) => preferences((p || {}).id, p || {}), dashboard: (p) => dashboard((p || {}).id), list: () => list(), check: (p) => check(p || {}) },
  ROLES, PREFERENCES, can, create, setRole, preferences, dashboard, list, check, status,
};
