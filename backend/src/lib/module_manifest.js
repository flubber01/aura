'use strict';
// AURA — Manifest-Prüfung für Erweiterungsmodule (aura.module.json).
// Reine Funktionen: keine Dateizugriffe außer dem Pfadschutz, keine Ausführung, keine Seiteneffekte.
// Spezifikation: docs/MODULE_SPEC.md
const fs = require('fs');
const path = require('path');

const TYPES = ['module', 'integration', 'skill', 'workflow'];
const PERMISSIONS = ['registry:read', 'audit:write', 'network', 'secrets:read', 'mcp:invoke', 'llm:route'];
// Dienste, von denen ein Modul abhängen darf (im Prozess verfügbar).
const SERVICES = ['registry', 'audit', 'mcp', 'llm'];
const ID_RE = /^[a-z][a-z0-9-]{1,40}$/;   // beginnt mit Buchstabe, damit keine Bereichsnummern wie „02“ kollidieren
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const FIELD_TYPES = ['string', 'number', 'boolean'];
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_TIMEOUT_MS = 60000;

function parseVersion(v) {
  const m = SEMVER_RE.exec(String(v || ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function cmp(a, b) { for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; }

// Versionsbereich: „*“, „1.2.3“ (genau), „>=1.2.0“, „^1.2.0“ (gleiche Hauptversion, mindestens).
function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v) return false;
  const r = String(range || '*').trim();
  if (r === '*' || r === '') return true;
  if (r.startsWith('>=')) { const b = parseVersion(r.slice(2)); return !!b && cmp(v, b) >= 0; }
  if (r.startsWith('^')) { const b = parseVersion(r.slice(1)); return !!b && v[0] === b[0] && cmp(v, b) >= 0; }
  const e = parseVersion(r); return !!e && cmp(v, e) === 0;
}

// Pfadschutz: Eintrag muss relativ sein, darf nicht aus dem Modulordner heraus und keine Symlinks nach außen.
function safeEntry(moduleDir, entry) {
  if (typeof entry !== 'string' || !entry.trim()) return { ok: false, reason: 'entry fehlt' };
  if (path.isAbsolute(entry) || entry.includes('\0')) return { ok: false, reason: 'entry muss ein relativer Pfad sein' };
  const abs = path.resolve(moduleDir, entry);
  const rel = path.relative(path.resolve(moduleDir), abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { ok: false, reason: 'entry verlässt den Modulordner' };
  if (!fs.existsSync(abs)) return { ok: false, reason: 'entry-Datei nicht gefunden: ' + entry };
  let real;
  try { real = fs.realpathSync(abs); } catch { return { ok: false, reason: 'entry nicht lesbar' }; }
  let realDir; try { realDir = fs.realpathSync(moduleDir); } catch { return { ok: false, reason: 'Modulordner nicht lesbar' }; }
  if (!(real === realDir || real.startsWith(realDir + path.sep))) return { ok: false, reason: 'entry zeigt außerhalb des Modulordners (Symlink)' };
  return { ok: true, abs: real };
}

function validateConfigSchema(schema) {
  const errs = [];
  if (schema === undefined) return { errs, schema: {} };
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return { errs: ['configSchema muss ein Objekt sein'], schema: {} };
  for (const [key, f] of Object.entries(schema)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(key)) { errs.push('configSchema: ungültiger Schlüssel „' + key + '“'); continue; }
    if (!f || !FIELD_TYPES.includes(f.type)) { errs.push('configSchema.' + key + ': type string | number | boolean'); continue; }
    if (f.secret && f.default !== undefined) errs.push('configSchema.' + key + ': Geheimnisse haben keinen Standardwert');
    if (f.enum && (!Array.isArray(f.enum) || f.enum.some((x) => typeof x !== f.type))) errs.push('configSchema.' + key + ': enum passt nicht zum Typ');
  }
  return { errs, schema };
}

// Prüft ein geparstes Manifest. Liefert {ok, errors[], warnings[], manifest (normalisiert)}.
function validateManifest(raw, moduleDir) {
  const errors = [], warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Manifest ist kein Objekt'], warnings };
  const m = raw;
  if (!ID_RE.test(String(m.id || ''))) errors.push('id: 2–41 Zeichen, Kleinbuchstaben, Ziffern, Bindestrich, beginnt mit Buchstabe');
  if (!String(m.name || '').trim() || String(m.name).length > 80) errors.push('name: 1–80 Zeichen');
  if (!parseVersion(m.version)) errors.push('version: semver x.y.z');
  if (!String(m.description || '').trim() || String(m.description).length > 500) errors.push('description: 1–500 Zeichen');
  if (!String(m.author || '').trim() || String(m.author).length > 80) errors.push('author: 1–80 Zeichen');
  if (!TYPES.includes(m.type)) errors.push('type: ' + TYPES.join(' | '));
  if (!Array.isArray(m.permissions)) errors.push('permissions: Liste (auch leer)');
  else {
    const unknown = m.permissions.filter((p) => !PERMISSIONS.includes(p));
    if (unknown.length) errors.push('permissions unbekannt: ' + unknown.join(', ') + ' (erlaubt: ' + PERMISSIONS.join(', ') + ')');
  }
  const cs = validateConfigSchema(m.configSchema);
  errors.push(...cs.errs);
  if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) errors.push('capabilities: mindestens eine Fähigkeit');
  const capNames = new Set();
  for (const c of (Array.isArray(m.capabilities) ? m.capabilities : [])) {
    if (!c || !/^[a-z][a-z0-9_]{1,40}$/.test(String(c.name || ''))) { errors.push('capability.name: a-z, 0-9, _ (2–41 Zeichen)'); continue; }
    if (capNames.has(c.name)) errors.push('capability „' + c.name + '“ doppelt');
    capNames.add(c.name);
    const perms = Array.isArray(c.permissions) ? c.permissions : [];
    const bad = perms.filter((p) => !(Array.isArray(m.permissions) && m.permissions.includes(p)));
    if (bad.length) errors.push('capability „' + c.name + '“ braucht Rechte, die nicht im Manifest stehen: ' + bad.join(', '));
  }
  const deps = Array.isArray(m.dependencies) ? m.dependencies : [];
  if (m.dependencies !== undefined && !Array.isArray(m.dependencies)) errors.push('dependencies: Liste');
  for (const d of deps) {
    if (d && d.service) { if (!SERVICES.includes(d.service)) errors.push('dependency service „' + d.service + '“ unbekannt'); continue; }
    if (!d || !ID_RE.test(String(d.id || ''))) { errors.push('dependency: {id, version} oder {service}'); continue; }
    if (d.version !== undefined && !(parseVersion(String(d.version).replace(/^(>=|\^)/, '')) || d.version === '*')) errors.push('dependency ' + d.id + ': version ungültig');
  }
  const hc = m.healthCheck;
  if (hc !== undefined && typeof hc !== 'boolean') errors.push('healthCheck: true/false');
  if (m.timeoutMs !== undefined && (!Number.isInteger(m.timeoutMs) || m.timeoutMs < 100 || m.timeoutMs > MAX_TIMEOUT_MS)) errors.push('timeoutMs: 100–' + MAX_TIMEOUT_MS);
  if (m.mode !== undefined && !['simulation', 'live'].includes(m.mode)) errors.push('mode: simulation | live');
  if (m.type === 'integration' && m.mode === undefined) warnings.push('Integration ohne mode: wird als simulation geführt');
  if (m.type === 'integration' && m.mode === 'live' && !m.healthCheck) errors.push('Integration mit mode live braucht healthCheck');

  if (moduleDir !== undefined) {
    const e = safeEntry(moduleDir, m.entry);
    if (!e.ok) errors.push('entry: ' + e.reason);
  } else if (!String(m.entry || '').trim()) errors.push('entry fehlt');

  return {
    ok: errors.length === 0, errors, warnings,
    manifest: errors.length ? null : {
      id: m.id, name: m.name, version: m.version, description: m.description, author: m.author,
      entry: m.entry, type: m.type, permissions: m.permissions, configSchema: cs.schema,
      capabilities: m.capabilities, dependencies: deps, healthCheck: !!m.healthCheck,
      timeoutMs: m.timeoutMs || 10000, mode: m.type === 'integration' ? (m.mode || 'simulation') : (m.mode || null),
    },
  };
}

// Liest aura.module.json im Ordner. Begrenzt die Größe und prüft JSON.
function readManifest(moduleDir) {
  const file = path.join(moduleDir, 'aura.module.json');
  let stat; try { stat = fs.statSync(file); } catch { return { ok: false, errors: ['aura.module.json fehlt'] }; }
  if (!stat.isFile()) return { ok: false, errors: ['aura.module.json ist keine Datei'] };
  if (stat.size > MAX_MANIFEST_BYTES) return { ok: false, errors: ['Manifest größer als 64 KB'] };
  let raw; try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { ok: false, errors: ['kein gültiges JSON: ' + e.message] }; }
  return { ok: true, raw, file };
}

module.exports = {
  TYPES, PERMISSIONS, SERVICES, MAX_TIMEOUT_MS,
  parseVersion, satisfies, safeEntry, validateManifest, readManifest,
};
