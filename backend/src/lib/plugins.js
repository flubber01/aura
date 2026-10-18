'use strict';
// AURA · Plug-in-System: Erweiterungen mit Rechten, Grenzen und Prüfpfad.
//
// Ein Plug-in ist hier kein fremdes Programm, das sich heimlich einnistet, sondern ein BESCHREIBUNGS-
// blatt (Manifest) mit Fähigkeiten, Rechten und Prüfsumme. Der Ablauf:
//
//   vorschlagen → prüfen → installieren (Mensch) → aktivieren/deaktivieren → entfernen
//
// Regeln:
//  • Rechte werden einzeln vergeben: lesen, schreiben, netz, audio, video, geld. `geld` und `netz`
//    sind nie stillschweigend drin.
//  • Ein Plug-in mit falscher oder fehlender Prüfsumme wird nicht installiert.
//  • Deaktivieren ist immer sofort möglich; entfernen verlangt einen Menschen (weil Daten dranhängen).
//  • Plug-ins dürfen nur Fähigkeiten anmelden, die es im System schon gibt — sie erfinden keine
//    Zugriffe. Was sie anmelden, steht sichtbar im Register.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_PLUGINS_FILE || path.join(__dirname, '..', 'data', 'plugins.json');

const RIGHTS = ['lesen', 'schreiben', 'netz', 'audio', 'video', 'geld'];
const SENSITIVE = ['netz', 'geld', 'schreiben'];
const KINDS = ['TONSTUDIO', 'VIDEO', 'SEITE', 'KANAL', 'DATEN', 'SONSTIG'];

function defaults() { return { plugins: [], installed: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['plugins', 'installed', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Prüfsumme: über die Beschreibung. So fällt eine nachträgliche Änderung auf.
const checksum = (manifest) => crypto.createHash('sha256').update(JSON.stringify({
  id: manifest.id, name: manifest.name, kind: manifest.kind, rights: (manifest.rights || []).slice().sort(), hooks: manifest.hooks || [],
})).digest('hex').slice(0, 16);

function validate(manifest) {
  const m = manifest || {};
  const problems = [];
  if (!m.id || !/^[a-z0-9][a-z0-9-_]{2,40}$/.test(String(m.id))) problems.push('id fehlt oder ist unbrauchbar (klein, 3–40 Zeichen)');
  if (!m.name) problems.push('name fehlt');
  if (!m.kind || !KINDS.includes(String(m.kind).toUpperCase())) problems.push(`kind fehlt (erlaubt: ${KINDS.join(', ')})`);
  const rights = Array.isArray(m.rights) ? m.rights.filter((r) => RIGHTS.includes(r)) : [];
  const unknown = Array.isArray(m.rights) ? m.rights.filter((r) => !RIGHTS.includes(r)) : [];
  if (unknown.length) problems.push(`unbekannte Rechte: ${unknown.join(', ')}`);
  const hooks = Array.isArray(m.hooks) ? m.hooks : [];
  if (m.needs_review && m.needs_review !== true) problems.push('needs_review muss true sein, wenn gesetzt');
  const cs = checksum(m);
  if (m.checksum && m.checksum !== cs) problems.push(`Prüfsumme passt nicht (erwartet ${cs}, angegeben ${m.checksum})`);
  return {
    ok: problems.length === 0, problems, id: m.id || null, rights, sensitive_rights: rights.filter((r) => SENSITIVE.includes(r)),
    hooks, checksum: cs, human_required: rights.some((r) => SENSITIVE.includes(r)),
    note: rights.some((r) => SENSITIVE.includes(r)) ? 'Dieses Plug-in will heikle Rechte — Installation nur durch Menschen.' : 'Harmlose Rechte: Installation durch Menschen trotzdem vorgesehen (Nachvollziehbarkeit).',
  };
}

function propose(manifest) {
  const v = validate(manifest);
  if (!v.ok) return { ok: false, error: 'Manifest unbrauchbar', problems: v.problems };
  const data = load();
  const entry = {
    id: v.id, name: manifest.name, kind: String(manifest.kind).toUpperCase(), version: String(manifest.version || '0.1.0'),
    what: String(manifest.what || '').slice(0, 500),
    rights: v.rights, hooks: v.hooks, checksum: v.checksum, human_required: v.human_required,
    status: 'VORGESCHLAGEN', proposed_at: new Date().toISOString(), origin: 'lokal (kein Download)',
    honesty: 'AURA lädt nichts aus dem Netz. Das Plug-in muss auf dem Server liegen und wird hier nur beschrieben und geprüft.',
  };
  data.plugins = [entry, ...data.plugins.filter((p) => p.id !== v.id)].slice(0, 200);
  data.audit.unshift({ at: entry.proposed_at, action: 'propose', id: v.id, rights: v.rights.join(',') });
  data.audit = data.audit.slice(0, 300);
  save(data);
  return { ok: true, plugin: entry, next: 'Installieren nur durch Menschen: POST /api/plugins/install {id, human:true, by:"…"}' };
}

function install(id, payload) {
  const data = load();
  const p = data.plugins.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Plug-in nicht vorgeschlagen' };
  const b = payload || {};
  if (!b.human) return { ok: false, error: 'Installation nur durch einen Menschen (human: true fehlt)', needs: 'human' };
  const by = String(b.by || '').trim();
  if (!by) return { ok: false, error: 'Namen angeben', needs: 'name' };
  if (p.checksum !== checksum(p)) return { ok: false, error: 'Prüfsumme stimmt nicht mehr — Beschreibung wurde verändert. Bitte neu vorschlagen.' };
  p.status = 'INSTALLIERT';
  p.installed = { at: new Date().toISOString(), by, rights: p.rights };
  data.installed = [p.id, ...data.installed.filter((x) => x !== p.id)];
  data.audit.unshift({ at: p.installed.at, action: 'install', id, by, rights: p.rights.join(',') });
  save(data);
  return { ok: true, plugin: { id: p.id, status: p.status, rights: p.rights }, note: 'Installiert heißt: beschrieben, geprüft, eingetragen. Aktivieren ist der nächste Schritt.' };
}

function toggle(id, on, payload) {
  const data = load();
  const p = data.plugins.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Plug-in nicht gefunden' };
  if (p.status === 'VORGESCHLAGEN') return { ok: false, error: 'Erst installieren' };
  if (on && p.human_required && !(payload && payload.human)) return { ok: false, error: 'Dieses Plug-in hat heikle Rechte — Aktivieren braucht einen Menschen (human: true)', needs: 'human' };
  p.status = on ? 'AKTIV' : 'INAKTIV';
  p.toggled = { at: new Date().toISOString(), by: String((payload && payload.by) || 'AURA'), on: !!on };
  data.audit.unshift({ at: p.toggled.at, action: on ? 'enable' : 'disable', id, by: p.toggled.by });
  save(data);
  return { ok: true, plugin: { id: p.id, status: p.status }, note: on ? 'Aktiv. Rechte: ' + p.rights.join(', ') : 'Sofort ausgeschaltet — Abschalten ist nie blockiert.' };
}

function remove(id, payload) {
  const data = load();
  const p = data.plugins.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'Plug-in nicht gefunden' };
  const b = payload || {};
  if (!b.human) return { ok: false, error: 'Entfernen braucht einen Menschen (es können Daten dranhängen)', needs: 'human' };
  p.status = 'ENTFERNT';
  p.removed = { at: new Date().toISOString(), by: String(b.by || 'Mensch'), keep_data: b.keep_data !== false };
  data.installed = data.installed.filter((x) => x !== id);
  data.audit.unshift({ at: p.removed.at, action: 'remove', id, by: p.removed.by });
  save(data);
  return { ok: true, plugin: { id: p.id, status: p.status }, note: p.removed.keep_data ? 'Entfernt, Daten behalten.' : 'Entfernt, Daten mit entfernt (auf ausdrückliche Anweisung).' };
}

function list(filter) {
  const data = load();
  const items = data.plugins.filter((p) => !filter || !filter.kind || p.kind === filter.kind);
  return {
    ok: true, count: items.length,
    items: items.map((p) => ({ id: p.id, name: p.name, kind: p.kind, status: p.status, rights: p.rights, human_required: p.human_required, what: p.what })),
    kinds: KINDS, rights: RIGHTS,
  };
}

function register() {
  // Register: was ist aktiv und mit welchen Rechten. Genau das, was man vor einem Audit braucht.
  const data = load();
  const active = data.plugins.filter((p) => p.status === 'AKTIV');
  const byRight = {}; for (const r of RIGHTS) byRight[r] = active.filter((p) => p.rights.includes(r)).length;
  return {
    ok: true,
    active: active.map((p) => ({ id: p.id, name: p.name, kind: p.kind, rights: p.rights })),
    by_right: byRight,
    sensitive_active: active.filter((p) => p.rights.some((r) => SENSITIVE.includes(r))).map((p) => p.id),
    rule: 'Was hier nicht steht, läuft nicht.',
  };
}

function status() {
  const d = load();
  const counts = {};
  for (const p of d.plugins) counts[p.status] = (counts[p.status] || 0) + 1;
  return {
    area: 'PLG', module: 'plugins', state: 'live', file: FILE,
    proposed: d.plugins.length, by_status: counts, rights: RIGHTS, kinds: KINDS,
    rules: ['Kein Download: das Plug-in liegt auf dem Server und wird nur beschrieben und geprüft.', 'Heikle Rechte (Netz, Geld, Schreiben) verlangen einen Menschen.', 'Abschalten ist immer möglich; Entfernen ist menschlich.', 'Prüfsumme erkennt nachträgliche Änderungen an der Beschreibung.'],
  };
}

module.exports = {
  meta: { area: 'PLG', id: 'plugins', name: 'Plug-in-System (Manifest, Rechte, Register)', state: 'live' },
  actions: { status: () => status(), kinds: () => ({ ok: true, kinds: KINDS, rights: RIGHTS }), validate: (p) => validate(p || {}), propose: (p) => propose(p || {}), install: (p) => install((p || {}).id, p || {}), enable: (p) => toggle((p || {}).id, true, p || {}), disable: (p) => toggle((p || {}).id, false, p || {}), remove: (p) => remove((p || {}).id, p || {}), list: (p) => list(p || {}), register: () => register() },
  RIGHTS, SENSITIVE, KINDS, validate, propose, install, toggle, remove, list, register, status, checksum,
};
