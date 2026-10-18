'use strict';
// Builds deliberately allowlisted ZIPs in memory. Runtime ledgers, secrets,
// dependencies, media, caches and user-upload paths are never eligible.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..', '..');
const PREFIX = 'AURA_STUDIO_COMMAND_SOURCE/';
const FULL_PREFIX = 'AURA_COMPLETE_SAFE_SOURCE_BACKUP/';
const FILES = [
  'README.md',
  'backend/pages/aura_os.js',
  'backend/pages/creator_passport.js',
  'backend/pages/jarvis.js',
  'backend/pages/admin_copilot.js',
  'backend/pages/admin_dashboard.js',
  'backend/pages/login.js',
  'backend/pages/workflows.js',
  'backend/pages/console.js',
  'backend/pages/studio_command.js',
  'backend/pages/downloads.js',
  'backend/src/lib/aura_os.js',
  'backend/src/lib/admin_copilot.js',
  'backend/src/lib/admin_auth.js',
  'backend/src/lib/release_gate.js',
  'backend/src/lib/workflow_builder.js',
  'backend/src/lib/ollama_manager.js',
  'backend/src/lib/hermes_bridge.js',
  'backend/src/lib/creator_passport.js',
  'backend/src/lib/jarvis.js',
  'backend/src/lib/registry.js',
  'backend/src/lib/studio_command.js',
  'backend/src/lib/studio_source_bundle.js',
  'backend/src/routes/api_core.js',
  'backend/src/routes/api_areas.js',
  'backend/src/routes/pages_routes.js',
  'test/validate.js',
  'docs/AURA_STUDIO_COMMAND.md',
  'docs/AURA_OS_BOOT_AND_SHORTCUTS.md',
  'docs/AURA_STUDIO_REFERENCE_RADAR.md',
  'docs/AURA_STUDIO_BACKUP_AND_DRIVE.md',
  'docs/AURA_JARVIS_OPERATING_INTELLIGENCE.md',
  'docs/AURA_ADMIN_COPILOT.md',
  'docs/AURA_WORKFLOW_OPERATING_MODEL.md',
  'docs/AURA_CLEAN_REBUILD_AND_CUTOVER.md',
  'docs/AURA_PRODUCTION_HARDENING.md',
];
const FULL_ROOTS = ['backend', 'db', 'deploy', 'docs', 'ingest', 'test', 'extracted/AURA-Web-Deploy'];
const FULL_ROOT_FILES = ['README.md', '.gitignore'];
const TEXT_EXTENSIONS = new Set(['.js', '.json', '.md', '.txt', '.sh', '.sql', '.yml', '.yaml', '.service', '.example', '.html', '.conf', '.webmanifest']);
const NO_EXTENSION_SOURCE_FILES = new Set(['Dockerfile']);
const BLOCKED_PREFIXES = ['.git/', '.cache/', 'node_modules/', 'uploads/', 'backend/src/data/'];
const BLOCKED_SEGMENTS = new Set(['artifacts', 'secrets', 'cache']);
const BLOCKED_FILES = new Set(['backend/data/sentinel.json', 'deploy/.env']);

// ZIP-Werkzeug kommt aus src/lib/zip_stored.js — dieselbe Implementierung nutzt auch
// der Modul-Import (Area 70). Zweimal dasselbe Rad wäre hier nur doppelte Fehlerfläche.
const { pack } = require('./zip_stored');
function toRelative(absolute) { return path.relative(ROOT, absolute).split(path.sep).join('/'); }
function isSafeFullFile(relative) {
  const base = path.posix.basename(relative);
  if (BLOCKED_FILES.has(relative) || BLOCKED_PREFIXES.some((prefix) => relative.startsWith(prefix))) return false;
  if (relative.startsWith('extracted/') && !relative.startsWith('extracted/AURA-Web-Deploy/')) return false;
  if (relative.split('/').some((part) => BLOCKED_SEGMENTS.has(part))) return false;
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return false;
  if (/\.(zip|gz|tgz|png|jpe?g|gif|webp|mp4|mov|mp3|wav|pdf|pem|key|p12|pfx)$/i.test(base)) return false;
  return TEXT_EXTENSIONS.has(path.posix.extname(base)) || FULL_ROOT_FILES.includes(relative) || base === '.gitignore' || NO_EXTENSION_SOURCE_FILES.has(base);
}
function collectSafeProjectFiles() {
  const found = [];
  function walk(absolute) {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(absolute, entry.name);
      const relative = toRelative(target);
      if (entry.isSymbolicLink() || !isSafeFullFile(relative) && !entry.isDirectory()) continue;
      if (entry.isDirectory()) {
        if (!BLOCKED_PREFIXES.some((prefix) => relative + '/' === prefix) && !relative.split('/').some((part) => BLOCKED_SEGMENTS.has(part))) walk(target);
      } else if (entry.isFile() && isSafeFullFile(relative)) found.push(relative);
    }
  }
  for (const file of FULL_ROOT_FILES) if (fs.existsSync(path.join(ROOT, file))) found.push(file);
  // Fehlende Wurzelverzeichnisse (z. B. in einem isolierten Test-/Deploy-Verzeichnis)
  // werden übersprungen statt die ganze Backup-Erzeugung mit 500 abzubrechen.
  for (const directory of FULL_ROOTS) { const abs = path.join(ROOT, directory); if (fs.existsSync(abs)) walk(abs); }
  return [...new Set(found)].sort();
}
function readAllowed(relative) {
  const absolute = path.resolve(ROOT, relative);
  if (!absolute.startsWith(ROOT + path.sep)) throw new Error('Invalid source bundle allowlist path');
  return fs.readFileSync(absolute);
}
function buildBundle({ files, prefix, packageName, filename, scope }) {
  const at = new Date().toISOString();
  const source = files.map((relative) => ({ relative, data: readAllowed(relative) }));
  const manifest = {
    package: packageName,
    generated_at: at,
    scope,
    included_files: source.map((x) => ({ path: x.relative, sha256: crypto.createHash('sha256').update(x.data).digest('hex') })),
    excluded: ['.git history/config', 'backend/src/data runtime ledgers', 'backend/data/sentinel.json', '.env and secrets', 'node_modules and caches', 'media, renders, user data and external assets'],
    restore_boundary: 'This is a source/docs/config backup only. Reinstall dependencies, review security and rerun validation before use. It does not restore runtime data, credentials, media, rights or external accounts.',
  };
  const entries = source.map((x) => ({ name: prefix + x.relative, data: x.data }));
  entries.push({ name: prefix + 'BUNDLE_MANIFEST.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') });
  return { body: pack(entries), manifest, filename };
}
function buildStudioSourceBundle() {
  return buildBundle({
    files: FILES,
    prefix: PREFIX,
    packageName: 'AURA Studio Command + J.A.R.V.I.S. experience source bundle',
    filename: 'AURA_STUDIO_COMMAND_SOURCE.zip',
    scope: 'focused allowlisted source and documentation only',
  });
}
function buildCompleteSafeSourceBackup() {
  return buildBundle({
    files: collectSafeProjectFiles(),
    prefix: FULL_PREFIX,
    packageName: 'AURA complete safe source, documentation and configuration backup',
    filename: 'AURA_COMPLETE_SAFE_SOURCE_BACKUP.zip',
    scope: 'all current safe project source, documentation, static configuration, deployment templates and tests; explicitly excludes runtime, secrets, dependencies, caches and media',
  });
}
module.exports = { buildStudioSourceBundle, buildCompleteSafeSourceBackup, FILES, collectSafeProjectFiles };
