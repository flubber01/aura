'use strict';
// AURA — verbindliche Modul-Schnittstelle v2 (maschinenlesbar, prüfend).
//
// Dies ist die EINE Quelle der Wahrheit für Dritt-Module (Connector):
//   · docs/MODULE_SPEC.md        — die lesbare Fassung derselben Regeln
//   · backend/src/lib/module_import.js — der Prüfpfad, der diese Regeln erzwingt
//
// Nichts hier führt Code aus. Alle Funktionen sind rein: rein → raus, keine Seiteneffekte.
// Der Import (Area 70) nutzt validateManifest() und scanForbidden(); der Modul-Loader
// (docs/MODULE_SPEC.md Abschnitt 1–6) bleibt für im Repo liegende Module zuständig.

const SPEC_VERSION = '2.0.0';

// ---------------------------------------------------------------------------
// 1. Manifest-Schema (beschreibend, JSON-Schema-Form — für Werkzeuge und Dokumentation)
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z][a-z0-9-]{1,40}$/;          // beginnt mit Buchstabe: keine Kollision mit Bereichsnummern
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const TYPES = ['module', 'integration', 'skill', 'workflow'];
const ROUTE_METHODS = ['GET'];

// Rechte, die ein IMPORTIERTES Dritt-Modul bekommen darf. Alles andere → Prüfung rot.
// Bewusst nicht enthalten: alles, was Geheimnisse, Netz oder Schreibzugriff bedeutet.
const PERMISSIONS = {
  'log:write': 'ctx.log(level, meldung, detail) — eigene Logzeile',
  'audit:write': 'ctx.audit(ereignis, detail) — Eintrag im Audit-Protokoll',
  'config:read': 'ctx.config — eigene Konfiguration (nie globale Geheimnisse)',
  'health:read': 'ctx.health() — Zähler der Registry und Laufzeit (nur lesen)',
  'registry:read': 'ctx.services.registry.counts() — Modul-Zähler (nur lesen)',
  'skills:read': 'ctx.skills() — verdrahtete Fähigkeiten (nur lesen)',
  'schedule:read': 'ctx.schedule() — Terminübersicht (nur lesen)',
  'events:pub': 'ctx.events.emit(thema, daten) — internes Ereignis senden',
  'events:sub': 'ctx.events.on(thema, funktion) — internes Ereignis empfangen',
  'storage:kv': 'ctx.store.get/set — dem Modul zugeordnete Schlüssel/Werte',
  'ai:route': 'ctx.routing() — Modell-Router-Status (nie Schlüssel)',
};

// Erlaubte AURA-Kontext-Endpunkte: ausdrücklich nur lesend (GET), ohne Geheimnisse.
const ROUTE_ALLOWLIST = [
  { method: 'GET', path: '/api/health', returns: 'Backend-Zustand, Laufzeit, Bereichszähler' },
  { method: 'GET', path: '/api/modules', returns: 'Registry aller Bereiche (Zustand, nie Geheimnisse)' },
  { method: 'GET', path: '/api/modules/live', returns: 'vereinte Registry inkl. Modul-Modus' },
  { method: 'GET', path: '/api/modulehub', returns: 'Modulhub-Übersicht (eigene Metadaten)' },
  { method: 'GET', path: '/api/modulehub/catalog', returns: 'Rechte-Katalog, Typen, Zustände, Vertrag' },
  { method: 'GET', path: '/api/skills', returns: 'Fähigkeitskatalog' },
  { method: 'GET', path: '/api/schedule', returns: 'Terminübersicht' },
  { method: 'GET', path: '/api/report', returns: 'Bericht aus echten Zählern' },
  { method: 'GET', path: '/api/types', returns: 'Typenkatalog' },
];

const MANIFEST_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://aura.local/schemas/aura.module.v2.json',
  title: 'AURA Modul-Manifest (Schnittstelle v2)',
  type: 'object',
  required: ['id', 'name', 'version', 'description', 'author', 'type', 'entry', 'permissions', 'routes', 'selftest'],
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,40}$', description: 'Kleinbuchstaben, Ziffern, Bindestrich; beginnt mit Buchstabe' },
    name: { type: 'string', minLength: 1, maxLength: 80 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$', description: 'semver x.y.z' },
    description: { type: 'string', minLength: 1, maxLength: 500 },
    author: { type: 'string', minLength: 1, maxLength: 80 },
    type: { type: 'string', enum: TYPES },
    entry: { type: 'string', pattern: '^[A-Za-z0-9._/-]+\\.js$', description: 'relative .js-Datei im Modulordner, kein ".."' },
    permissions: { type: 'array', items: { type: 'string', enum: Object.keys(PERMISSIONS) }, uniqueItems: true },
    routes: {
      type: 'array',
      description: 'AURA-Endpunkte, die das Modul aufrufen will. Nur GET, nur aus der Erlaubnisliste, leer erlaubt.',
      items: {
        type: 'object',
        required: ['method', 'path'],
        properties: { method: { type: 'string', enum: ROUTE_METHODS }, path: { type: 'string' }, purpose: { type: 'string', maxLength: 200 } },
      },
    },
    selftest: {
      type: 'object',
      required: ['entry'],
      description: 'Selbsttest: läuft als eigener Kindprozess, 10 Sekunden, ohne Netz.',
      properties: {
        entry: { type: 'string', pattern: '^[A-Za-z0-9._/-]+\\.js$' },
        timeout_ms: { type: 'integer', minimum: 100, maximum: 10000 },
      },
    },
    configSchema: { type: 'object', description: 'eigene Konfigurationsfelder (nie secret:true — Geheimnisse sind verboten)' },
    capabilities: { type: 'array', description: 'angebotene Aktionen: {action|name, description, input}' },
    dependencies: { type: 'array' },
    healthCheck: { type: 'boolean' },
    timeoutMs: { type: 'integer', minimum: 100, maximum: 60000 },
  },
};

// ---------------------------------------------------------------------------
// 2. Grenzen des Importpfads
// ---------------------------------------------------------------------------

const LIMITS = {
  spec_version: SPEC_VERSION,
  max_upload_bytes: 4 * 1024 * 1024,   // Paket (entpackt) höchstens 4 MiB
  max_files: 40,                       // höchstens 40 Dateien pro Paket
  max_file_bytes: 256 * 1024,          // Einzeldatei höchstens 256 KiB
  max_manifest_bytes: 64 * 1024,
  selftest_timeout_ms: 10000,          // harte Grenze: 10 Sekunden
  selftest_output_bytes: 64 * 1024,
  max_path_depth: 4,
};

// ---------------------------------------------------------------------------
// 3. Verbotsliste — statische Muster. Ein Treffer ist immer ein roter Check.
//    Begründung: Module laufen im selben Node-Prozess; ein Muster ist billiger als eine Reue.
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERNS = [
  { id: 'child_process_require', re: /require\s*\(\s*['"](?:node:)?child_process['"]\s*\)/, why: 'Kindprozesse sind verboten (exec/spawn/fork)' },
  { id: 'child_process_call', re: /\b(?:execSync|execFileSync|spawnSync|spawn|exec|execFile|fork)\s*\(/, why: 'Prozessstart ist verboten' },
  { id: 'vm_require', re: /require\s*\(\s*['"](?:node:)?(?:vm|worker_threads|inspector)['"]\s*\)/, why: 'Fremdcode-Ausführung jenseits der Prüfung ist verboten' },
  { id: 'eval', re: /\beval\s*\(|new\s+Function\s*\(/, why: 'eval/new Function umgeht die statische Prüfung' },
  { id: 'network_require', re: /require\s*\(\s*['"](?:node:)?(?:http|https|http2|net|tls|dgram|dns)['"]\s*\)/, why: 'Netzwerk ist verboten (nur deklarierte Kontext-Endpunkte, keine eigenen Sockets)' },
  { id: 'network_call', re: /\b(?:https?)\.request\s*\(|\b(?:https?)\.get\s*\(|\bfetch\s*\(|new\s+WebSocket\s*\(|\bXMLHttpRequest\b|\baxios\b|\bnode-fetch\b/, why: 'eigene Netzaufrufe sind verboten' },
  { id: 'fs_write', re: /\b(?:writeFileSync|appendFileSync|writeFile|appendFile|truncateSync|createWriteStream|unlinkSync|rmSync|rmdirSync|mkdirSync|renameSync|copyFileSync|symlinkSync|chmodSync|utimesSync)\b/, why: 'Schreibzugriff auf das Dateisystem ist verboten' },
  { id: 'fs_write_handle', re: /\bfs\.promises\.(?:writeFile|appendFile|rm|mkdir|unlink|copyFile|truncate)\b/, why: 'Schreibzugriff auf das Dateisystem ist verboten' },
  { id: 'secrets_env', re: /process\.env\b/, why: 'Geheimnisse liegen in der Umgebung — Zugriff ist verboten' },
  { id: 'secrets_file', re: /(?:\.env\b|secrets\.json|id_rsa|\.pem\b|BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY)/, why: 'Schlüssel- und Geheimdateien sind tabu' },
  { id: 'escape_require', re: /require\s*\(\s*['"]\.\.\//, why: 'Ein Module darf nur eigene Dateien laden, nicht aus dem Ordner heraus' },
  { id: 'absolute_require', re: /require\s*\(\s*['"]\//, why: 'absolute Pfade beim Laden sind verboten' },
  { id: 'host_internals', re: /require\s*\(\s*['"][^'"]*backend\/src\/lib\//, why: 'interne AURA-Bibliotheken sind für Module gesperrt' },
  { id: 'process_lowlevel', re: /\bprocess\.binding\s*\(|\bprocess\.dlopen\s*\(/, why: 'niedrige Prozess-Eingriffe sind verboten' },
];

const SCAN_EXTENSIONS = ['.js', '.mjs', '.cjs', '.json'];

// ---------------------------------------------------------------------------
// 4. Prüffunktionen (rein)
// ---------------------------------------------------------------------------

function validateManifest(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Manifest ist kein JSON-Objekt'], manifest: null };
  const m = raw;

  for (const key of MANIFEST_SCHEMA.required) {
    if (m[key] === undefined || m[key] === null) errors.push(`Pflichtfeld "${key}" fehlt`);
  }
  if (m.id !== undefined && !ID_RE.test(String(m.id))) errors.push('id: 2–41 Zeichen, a–z, 0–9, Bindestrich, beginnt mit Buchstabe');
  if (m.name !== undefined && (!String(m.name).trim() || String(m.name).length > 80)) errors.push('name: 1–80 Zeichen');
  if (m.version !== undefined && !SEMVER_RE.test(String(m.version))) errors.push('version: semver x.y.z');
  if (m.description !== undefined && (!String(m.description).trim() || String(m.description).length > 500)) errors.push('description: 1–500 Zeichen');
  if (m.author !== undefined && (!String(m.author).trim() || String(m.author).length > 80)) errors.push('author: 1–80 Zeichen');
  if (m.type !== undefined && !TYPES.includes(m.type)) errors.push('type: ' + TYPES.join(' | '));
  if (m.entry !== undefined) {
    const entry = String(m.entry);
    if (entryPath.isUnsafe(entry)) errors.push('entry: relativer Pfad, kein "..", endet auf .js');
  }
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) errors.push('permissions: Liste (leer erlaubt)');
    else for (const p of m.permissions) if (!PERMISSIONS[p]) errors.push(`permissions: unbekanntes Recht "${p}" (erlaubt: ${Object.keys(PERMISSIONS).join(', ')})`);
  }
  if (m.routes !== undefined) {
    if (!Array.isArray(m.routes)) errors.push('routes: Liste (leer erlaubt)');
    else m.routes.forEach((r, i) => {
      if (!r || typeof r !== 'object') { errors.push(`routes[${i}]: Objekt {method, path}`); return; }
      const method = String(r.method || '').toUpperCase();
      if (!ROUTE_METHODS.includes(method)) errors.push(`routes[${i}].method: nur ${ROUTE_METHODS.join(', ')} erlaubt`);
      if (!routeAllowed(method, r.path)) errors.push(`routes[${i}].path: "${r.path}" steht nicht in der Erlaubnisliste (${ROUTE_ALLOWLIST.map((x) => x.path).join(', ')})`);
    });
  }
  if (m.selftest !== undefined) {
    if (!m.selftest || typeof m.selftest !== 'object' || Array.isArray(m.selftest)) errors.push('selftest: Objekt {entry}');
    else {
      if (!m.selftest.entry || entryPath.isUnsafe(String(m.selftest.entry))) errors.push('selftest.entry: relative .js-Datei im Modulordner');
      if (m.selftest.timeout_ms !== undefined && (!Number.isInteger(m.selftest.timeout_ms) || m.selftest.timeout_ms < 100 || m.selftest.timeout_ms > LIMITS.selftest_timeout_ms)) {
        errors.push(`selftest.timeout_ms: 100–${LIMITS.selftest_timeout_ms}`);
      }
    }
  }
  if (m.configSchema !== undefined) {
    if (!m.configSchema || typeof m.configSchema !== 'object' || Array.isArray(m.configSchema)) errors.push('configSchema: Objekt');
    else for (const [key, field] of Object.entries(m.configSchema)) {
      if (field && field.secret === true) errors.push(`configSchema.${key}: Geheimnisse sind für Dritt-Module verboten`);
    }
  }
  if (m.capabilities !== undefined && !Array.isArray(m.capabilities)) errors.push('capabilities: Liste');
  if (m.timeoutMs !== undefined && (!Number.isInteger(m.timeoutMs) || m.timeoutMs < 100 || m.timeoutMs > 60000)) errors.push('timeoutMs: 100–60000');

  return { ok: errors.length === 0, errors, manifest: errors.length ? null : m };
}

// reiner Pfad-Helfer (kein Dateisystem): true, wenn der Einstieg unzulässig ist
const entryPath = {
  isUnsafe(entry) {
    const value = String(entry || '');
    if (!value.endsWith('.js')) return true;
    if (value.includes('..') || value.includes('\0')) return true;
    return /^([A-Za-z]:)?[/\\]/.test(value);
  },
};

function routeAllowed(method, target) {
  const wanted = String(target || '').split('?')[0];
  return ROUTE_ALLOWLIST.some((r) => r.method === String(method || '').toUpperCase() && r.path === wanted);
}

// Statischer Scan: liefert Treffer je Datei. Keine Ausführung.
function scanForbidden(files) {
  const hits = [];
  for (const file of files) {
    const ext = (file.rel.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!SCAN_EXTENSIONS.includes(ext)) continue;
    if (ext === '.json') continue; // JSON kann keine Anweisungen enthalten
    const lines = String(file.content || '').split(/\r?\n/);
    for (const pattern of FORBIDDEN_PATTERNS) {
      lines.forEach((line, index) => {
        if (line.trimStart().startsWith('//')) return;                 // Kommentarzeilen zählen nicht
        const stripped = line.replace(/\/\/[^\n]*$/, '');              // Kommentar am Zeilenende abtrennen
        if (pattern.re.test(stripped)) {
          hits.push({ file: file.rel, line: index + 1, id: pattern.id, why: pattern.why, text: line.trim().slice(0, 160) });
        }
      });
    }
  }
  return hits;
}

function describe() {
  return {
    spec_version: SPEC_VERSION,
    schema: MANIFEST_SCHEMA,
    permissions: PERMISSIONS,
    route_allowlist: ROUTE_ALLOWLIST,
    forbidden_patterns: FORBIDDEN_PATTERNS.map((p) => ({ id: p.id, why: p.why, pattern: p.re.source })),
    limits: LIMITS,
    types: TYPES,
  };
}

module.exports = {
  SPEC_VERSION, ID_RE, SEMVER_RE, TYPES, PERMISSIONS, ROUTE_ALLOWLIST, MANIFEST_SCHEMA,
  FORBIDDEN_PATTERNS, LIMITS, SCAN_EXTENSIONS,
  validateManifest, scanForbidden, routeAllowed, describe,
};
