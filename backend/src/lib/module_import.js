'use strict';
// AURA — Dritt-Connector mit Fehlerfrei-Schleuse (Area 70 / Modulhub).
//
// Weg eines fremden Moduls:
//   POST /api/modulehub/import  →  Paket annehmen (ZIP oder Basis64-Text)
//                               →  in QUARANTÄNE entpacken (Runtime, nie im Git)
//                               →  Prüfungen: Manifest · node --check · Verbotsliste · Selbsttest
//                               →  Ergebnis {checks[], ok, reason} — ehrlich, mit Gründen
//   Nur bei ok: Modul wartet als pending_approval. Freigabe ausschließlich über das
//   bestehende Approve-Gate (POST /api/modulehub/<id>/approve) durch den Owner.
//   Keine Auto-Freigabe, kein Auto-Laden.
//
// Alle Dateien liegen bewusst unter backend/src/data/ (in .gitignore).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const spec = require('./module_spec');
const zip = require('./zip_stored');

const DATA_DIR = path.join(__dirname, '..', 'data');
const QUARANTINE_DIR = process.env.AURA_MODULE_QUARANTINE_DIR || path.join(DATA_DIR, 'modulehub-quarantine');
const IMPORTS_FILE = process.env.AURA_MODULE_IMPORTS_FILE || path.join(DATA_DIR, 'modulehub_imports.json');
const SANDBOX = path.join(__dirname, '..', 'preload', 'module_selftest_sandbox.js');

const MAX_RECORDS = 40;

// ---------------------------------------------------------------------------
// kleine Helfer
// ---------------------------------------------------------------------------

function safeRel(name) {
  // null Byte, Windows-Laufwerk, absoluter Pfad, Rückwärtsschrägstriche und ".." sind tabu
  const value = String(name || '');
  if (!value || value.includes('\0')) return null;
  if (/^[A-Za-z]:/.test(value) || value.startsWith('/') || value.startsWith('\\')) return null;
  if (value.includes('\\')) return null;
  const parts = value.split('/').filter((part) => part !== '' && part !== '.');
  if (!parts.length) return null;
  if (parts.some((part) => part === '..')) return null;
  const rel = parts.join('/');
  if (rel.length > 160 || parts.length > spec.LIMITS.max_path_depth) return null;
  return rel;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function records() {
  const data = readJson(IMPORTS_FILE, { imports: [] });
  return Array.isArray(data.imports) ? data.imports : [];
}
function saveRecords(list) {
  writeJson(IMPORTS_FILE, { spec_version: spec.SPEC_VERSION, at: new Date().toISOString(), imports: list.slice(-MAX_RECORDS) });
}

// ZIP: gemeinsames Werkzeug (src/lib/zip_stored.js) — Prüfsumme und Größe je Eintrag.
// Die Pfadbewertung (Pfadflucht, Tiefe, Grenzen) macht safeRel()/collectFiles() darunter.

// gemeinsamen Wurzelordner abziehen: "mein-modul/aura.module.json" → "aura.module.json"
function stripCommonRoot(entries) {
  if (!entries.length) return entries;
  const first = entries[0].rel.split('/');
  if (first.length < 2) return entries;
  const root = first[0];
  if (!entries.every((e) => e.rel.split('/')[0] === root && e.rel.split('/').length > 1)) return entries;
  return entries.map((e) => ({ ...e, rel: e.rel.split('/').slice(1).join('/') }));
}

// ---------------------------------------------------------------------------
// Paket annehmen: ZIP (Basis64) oder Dateiliste (Basis64/Text)
// ---------------------------------------------------------------------------

function collectFiles(payload) {
  const errors = [];
  const body = payload && typeof payload === 'object' ? payload : {};

  if (body.files !== undefined) {
    const list = Array.isArray(body.files) ? body.files
      : (body.files && typeof body.files === 'object' ? Object.entries(body.files).map(([rel, content]) => ({ path: rel, content })) : null);
    if (!list) return { ok: false, errors: ['files: Liste [{path, content, encoding}] oder Objekt {pfad: inhalt}'], entries: [] };
    const entries = [];
    let total = 0;
    for (const item of list) {
      const rel = safeRel(item && item.path);
      if (!rel) { errors.push('Dateipfad unzulässig: ' + String((item && item.path) || '—')); continue; }
      const encoding = String((item && item.encoding) || 'utf8').toLowerCase();
      let text = '';
      if (encoding === 'base64') {
        try { text = Buffer.from(String((item && item.content) || ''), 'base64').toString('utf8'); }
        catch { errors.push(rel + ': Basis64 nicht lesbar'); continue; }
      } else text = String((item && item.content) || '');
      const bytes = Buffer.byteLength(text);
      if (bytes > spec.LIMITS.max_file_bytes) { errors.push(rel + ': zu groß'); continue; }
      total += bytes;
      if (total > spec.LIMITS.max_upload_bytes) { errors.push('Paket insgesamt zu groß'); break; }
      entries.push({ rel, content: text, bytes });
    }
    if (entries.length > spec.LIMITS.max_files) errors.push('zu viele Dateien');
    return { ok: errors.length === 0, errors, entries };
  }

  const raw = String(body.data || body.zip || '');
  if (!raw) return { ok: false, errors: ['Weder "data" (Basis64-ZIP) noch "files" (Dateiliste) im Paket'], entries: [] };
  let buffer;
  try { buffer = Buffer.from(raw, 'base64'); }
  catch { return { ok: false, errors: ['Basis64 nicht lesbar'], entries: [] }; }
  if (!buffer.length) return { ok: false, errors: ['Paket ist leer'], entries: [] };
  if (buffer.length > spec.LIMITS.max_upload_bytes * 2) return { ok: false, errors: ['Paket zu groß'], entries: [] };
  const unzipped = zip.unpack(buffer);
  // Pfadschutz: jeder Eintrag muss durch dieselbe Prüfung wie Dateilisten (safeRel).
  // Ohne das würde ein ZIP mit "../../…" aus dem Quarantäne-Ordner heraus schreiben.
  const entries = [];
  for (const entry of stripCommonRoot(unzipped.entries)) {
    const rel = safeRel(entry.rel);
    if (!rel) { errors.push(`"${entry.rel}": unzulässiger Pfad im Archiv (Pfadflucht)`); continue; }
    entries.push({ rel, content: entry.content.toString('utf8'), bytes: entry.bytes });
  }
  return { ok: unzipped.ok && !errors.length, errors: errors.concat(unzipped.errors), entries };
}

// ---------------------------------------------------------------------------
// Prüfungen
// ---------------------------------------------------------------------------

function check(label, ok, detail, belege) {
  return { id: label.id, label: label.text, ok: ok === true, status: ok === true ? 'ok' : (ok === null ? 'uebersprungen' : 'fail'), detail: detail || '', ...(belege && belege.length ? { belege: belege.slice(0, 20) } : {}) };
}
const LABELS = {
  paket: { id: 'paket', text: 'Paket angenommen (ZIP oder Basis64-Text, Größen- und Pfadgrenzen)' },
  quarantaene: { id: 'quarantaene', text: 'in Quarantäne entpackt (Runtime-Ordner, Pfadschutz, Prüfsummen)' },
  manifest: { id: 'manifest', text: 'Manifest gegen Schnittstelle v2 geprüft (id, name, version, routes[], permissions[], selftest)' },
  einstieg: { id: 'einstieg', text: 'Einstiegs- und Selbsttest-Datei vorhanden und im Modulordner' },
  syntax: { id: 'syntax', text: 'node --check für jede JavaScript-Datei' },
  verbote: { id: 'verbote', text: 'Verbotsliste statisch gescannt (child_process, fs-Schreiben, Netz, Geheimnisse)' },
  selftest: { id: 'selftest', text: 'Selbsttest als eigener Kindprozess · 10 s · ohne Netz' },
  konflikt: { id: 'konflikt', text: 'Modul-ID gegen Modulhub und Warteschlange geprüft' },
};

// node --check auf den entpackten Dateien (kein Laden, kein Ausführen: --check parst nur)
function syntaxCheck(moduleDir, files) {
  const errors = [];
  for (const file of files) {
    if (!/\.(js|mjs|cjs)$/i.test(file.rel)) continue;
    const target = path.join(moduleDir, file.rel);
    if (!fs.existsSync(target)) { errors.push(file.rel + ': Datei fehlt nach dem Entpacken'); continue; }
    try {
      const out = require('child_process').spawnSync(process.execPath, ['--check', target], { encoding: 'utf8', timeout: 15000 });
      if (out.status !== 0) errors.push(`${file.rel}: ${String(out.stderr || 'Syntaxfehler').split('\n').filter(Boolean).slice(0, 2).join(' · ').slice(0, 240)}`);
    } catch (e) {
      errors.push(file.rel + ': Prüfung nicht möglich (' + e.message + ')');
    }
  }
  return errors;
}

function runSelftest(moduleDir, selftest) {
  return new Promise((resolve) => {
    const entry = String(selftest.entry || 'selftest.js');
    const target = path.join(moduleDir, entry);
    if (!fs.existsSync(target)) return resolve({ ok: false, detail: 'Selbsttest-Datei fehlt: ' + entry });
    let done = false;
    let child;
    const finish = (result) => { if (!done) { done = true; resolve(result); } };
    try {
      child = spawn(process.execPath, ['--require', SANDBOX, entry], {
        cwd: moduleDir,
        env: { LANG: 'C.UTF-8', AURA_MODULE_SELFTEST: '1' },   // bewusst ohne NODE_OPTIONS und ohne weitere Umgebungsvariablen
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: spec.LIMITS.selftest_timeout_ms,
        killSignal: 'SIGKILL',
      });
    } catch (e) { return finish({ ok: false, detail: 'Selbsttest nicht startbar: ' + e.message }); }

    let stdout = '', stderr = '';
    const cap = spec.LIMITS.selftest_output_bytes;
    child.stdout.on('data', (chunk) => { if (stdout.length < cap) stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { if (stderr.length < cap) stderr += chunk.toString('utf8'); });
    child.on('error', (e) => finish({ ok: false, detail: 'Selbsttest-Fehler: ' + e.message }));
    child.on('close', (code, signal) => {
      const tail = (text) => text.trim().split(/\r?\n/).slice(-6).join('\n').slice(0, 600);
      if (code === 0) {
        let protokoll = null;
        try { const parsed = JSON.parse(stdout.trim()); if (parsed && typeof parsed === 'object') protokoll = parsed; } catch {}
        return finish({ ok: true, detail: protokoll ? ('Selbsttest bestanden (Exit 0)' + (protokoll.ok === false ? ' — Protokoll meldet ok:false' : '')) : 'Selbsttest bestanden (Exit 0)', protokoll, ausgabe: tail(stdout) });
      }
      if (signal === 'SIGKILL' || code === null || code === 124) return finish({ ok: false, detail: `Selbsttest abgebrochen: Zeitlimit von ${spec.LIMITS.selftest_timeout_ms / 1000} s überschritten` });
      return finish({ ok: false, detail: `Selbsttest fehlgeschlagen (Exit ${code})`, ausgabe: tail(stderr || stdout) });
    });
  });
}

// ---------------------------------------------------------------------------
// der Import selbst
// ---------------------------------------------------------------------------

async function importPackage(payload) {
  const checks = [];
  const at = new Date().toISOString();

  const collected = collectFiles(payload);
  const files = collected.entries;
  checks.push(check(LABELS.paket, collected.ok && files.length > 0,
    collected.ok ? `${files.length} Datei(en) · ${Math.round(files.reduce((sum, f) => sum + f.bytes, 0) / 1024)} KiB entpackt` : collected.errors.join(' · '),
    collected.errors));

  const manifestFile = files.find((f) => f.rel === 'aura.module.json');
  let manifest = null;
  if (!manifestFile) {
    checks.push(check(LABELS.manifest, false, 'aura.module.json fehlt im Paket'));
  } else {
    if (manifestFile.bytes > spec.LIMITS.max_manifest_bytes) {
      checks.push(check(LABELS.manifest, false, 'Manifest größer als ' + Math.round(spec.LIMITS.max_manifest_bytes / 1024) + ' KiB'));
    } else {
      let parsed = null;
      let error = null;
      try { parsed = JSON.parse(manifestFile.content); } catch (e) { error = e.message; }
      if (error) checks.push(check(LABELS.manifest, false, 'kein gültiges JSON: ' + error));
      else {
        const result = spec.validateManifest(parsed);
        manifest = result.manifest;
        checks.push(check(LABELS.manifest, result.ok, result.ok ? 'Manifest erfüllt Schnittstelle v2' : result.errors.join(' · '), result.errors));
      }
    }
  }

  // Einstieg + Selbsttest-Datei
  if (manifest) {
    const missing = [manifest.entry, manifest.selftest && manifest.selftest.entry].filter(Boolean).filter((rel) => !files.some((f) => f.rel === rel));
    checks.push(check(LABELS.einstieg, missing.length === 0,
      missing.length ? 'fehlt im Paket: ' + missing.join(', ') : [manifest.entry, manifest.selftest.entry].join(' · ') + ' vorhanden',
      missing));
  } else {
    checks.push(check(LABELS.einstieg, null, 'übersprungen — Manifest ungültig'));
  }

  // 1) Quarantäne: entpacken, bevor irgendetwas geprüft wird (Ordnung ist Runtime, nie im Git)
  const stamp = at.replace(/[:.]/g, '-');
  const slug = (manifest && manifest.id) || String((payload && payload.name) || 'paket').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) || 'paket';
  const stagedDir = path.join(QUARANTINE_DIR, stamp + '-' + slug);
  let staged = false;
  if (files.length) {
    try {
      fs.mkdirSync(stagedDir, { recursive: true });
      for (const file of files) {
        const target = path.join(stagedDir, file.rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content);
      }
      staged = true;
      checks.push(check(LABELS.quarantaene, true, `${files.length} Datei(en) liegen in ${stagedDir}`));
    } catch (e) {
      checks.push(check(LABELS.quarantaene, false, 'Quarantäne-Ordner nicht schreibbar: ' + e.message));
    }
  } else {
    checks.push(check(LABELS.quarantaene, false, 'keine Datei entpackt'));
  }

  // 2) Syntax auf den entpackten Dateien
  const syntaxErrors = staged ? syntaxCheck(stagedDir, files) : ['nicht entpackt'];
  const jsFiles = files.filter((f) => /\.(js|mjs|cjs)$/i.test(f.rel));
  checks.push(check(LABELS.syntax, syntaxErrors.length === 0,
    syntaxErrors.length ? syntaxErrors.join(' · ') : `${jsFiles.length} JavaScript-Datei(en) fehlerfrei`,
    syntaxErrors));

  // 3) Verbotsliste
  const hits = spec.scanForbidden(files);
  checks.push(check(LABELS.verbote, hits.length === 0,
    hits.length ? hits.length + ' Treffer: ' + hits.slice(0, 4).map((h) => `${h.file}:${h.line} ${h.id}`).join(' · ')
      : `${jsFiles.length} Datei(en) sauber — keine verbotenen Muster`,
    hits.map((h) => `${h.file}:${h.line} · ${h.id} · ${h.why} · ${h.text}`)));

  let ok = checks.every((c) => c.status !== 'fail');

  // 4) Konfliktprüfung
  if (manifest) {
    let conflictDetail = 'keine Kollision';
    try {
      const moduleSystem = require('./module_system');
      const installed = moduleSystem.status();
      const sameId = (installed.modules || []).find((m) => m.id === manifest.id);
      const queued = records().find((r) => r.id === manifest.id && r.status === 'pending_approval');
      if (sameId) conflictDetail = `Modul-ID "${manifest.id}" ist bereits installiert (v${sameId.version}) — deine Freigabe ersetzt es`;
      else if (queued) conflictDetail = `Modul-ID "${manifest.id}" stand schon in der Warteschlange und wird durch diesen Import ersetzt`;
      checks.push(check(LABELS.konflikt, true, conflictDetail));
    } catch (e) {
      checks.push(check(LABELS.konflikt, null, 'Modulhub nicht erreichbar: ' + e.message));
    }
  } else {
    checks.push(check(LABELS.konflikt, null, 'übersprungen — Manifest ungültig'));
  }

  // 5) Selbsttest: eigener Kindprozess, 10 s, ohne Netz — nur wenn alles vorher grün war
  let selftestResult = null;
  if (ok && manifest && staged) {
    selftestResult = await runSelftest(stagedDir, manifest.selftest);
    checks.push(check(LABELS.selftest, selftestResult.ok, selftestResult.detail,
      selftestResult.ausgabe ? [selftestResult.ausgabe] : []));
  } else {
    checks.push(check(LABELS.selftest, null, ok ? 'übersprungen' : 'übersprungen — vorherige Prüfung rot'));
  }

  const finalOk = checks.every((c) => c.status !== 'fail');
  const finalReason = finalOk ? null : checks.filter((c) => c.status === 'fail').map((c) => c.label + ': ' + c.detail).join(' | ').slice(0, 1200);

  const record = {
    id: (manifest && manifest.id) || null,
    name: (manifest && manifest.name) || String((payload && payload.name) || 'ohne Namen'),
    version: (manifest && manifest.version) || null,
    autor: (manifest && manifest.author) || null,
    at,
    status: finalOk && manifest ? 'pending_approval' : 'abgelehnt',
    ok: finalOk,
    reason: finalReason,
    checks,
    staged_dir: stagedDir,
    files: files.map((f) => ({ rel: f.rel, bytes: f.bytes })),
    selftest: selftestResult ? { ok: selftestResult.ok, detail: selftestResult.detail } : null,
    installed: false,
    boundary: 'Nur deine Freigabe zählt. Es wird nichts automatisch geladen oder gestartet.',
  };

  if (!finalOk && !manifest) record.id = null;

  const list = records().filter((r) => !(r.id && manifest && r.id === manifest.id && r.status === 'pending_approval'));
  list.push(record);
  saveRecords(list);

  return record;
}

// ---------------------------------------------------------------------------
// Warteschlange
// ---------------------------------------------------------------------------

function list() {
  return records().map((r) => ({
    id: r.id, name: r.name, version: r.version, autor: r.autor, at: r.at, status: r.status,
    ok: r.ok, reason: r.reason, installed: r.installed === true, checks: r.checks, files: r.files,
    selftest: r.selftest || null, staged_dir: r.staged_dir,
  }));
}

function discard(id) {
  const list = records();
  const record = list.find((r) => r.id === id);
  if (!record) return { ok: false, error: 'kein Import mit der ID ' + id };
  try { fs.rmSync(record.staged_dir, { recursive: true, force: true }); } catch {}
  saveRecords(list.filter((r) => r.id !== id));
  return { ok: true, id, entfernt: true };
}

// Installieren: NUR aus der Quarantäne, NUR mit gültigem Prüfprotokoll.
// Aufgerufen wird das ausschließlich vom bestehenden Approve-Gate.
function install(id) {
  const list = records();
  const record = list.find((r) => r.id === id);
  if (!record) return { ok: false, error: 'kein Import mit der ID ' + id };
  if (!record.ok) return { ok: false, error: 'Import nicht freigabefähig — Prüfprotokoll ist nicht grün: ' + (record.reason || '') };
  if (record.installed) return { ok: true, id, bereits_installiert: true };
  if (!record.staged_dir || !fs.existsSync(record.staged_dir)) return { ok: false, error: 'Quarantäne-Ordner fehlt — bitte neu importieren' };

  const moduleSystem = require('./module_system');
  const target = path.join(moduleSystem.MODULES_DIR, String(id));
  try {
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(target)) fs.rmSync(path.join(target, name), { recursive: true, force: true });
    for (const name of fs.readdirSync(record.staged_dir)) {
      const source = path.join(record.staged_dir, name);
      if (!fs.statSync(source).isFile()) continue;
      const destination = path.join(target, safeRel(name) || name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  } catch (e) {
    return { ok: false, error: 'Installieren fehlgeschlagen: ' + e.message };
  }
  record.installed = true;
  record.installed_at = new Date().toISOString();
  saveRecords(list);
  try { moduleSystem.scan(); } catch {}
  return { ok: true, id, installed_dir: target, ersetzt: true };
}

// Das Approve-Gate ruft das auf: nur wenn ein freigabefähiger Import wartet, wird installiert.
function installIfStaged(id) {
  const record = records().find((r) => r.id === id && r.status === 'pending_approval' && r.ok === true);
  if (!record) return { installed: false };
  const result = install(id);
  return { installed: result.ok === true, result };
}

function status() {
  const list = records();
  return {
    mode: 'IMPORT_GATE',
    spec_version: spec.SPEC_VERSION,
    area: '70',
    quarantine_dir: QUARANTINE_DIR,
    modules_dir: (() => { try { return require('./module_system').MODULES_DIR; } catch { return null; } })(),
    counts: {
      imports: list.length,
      pending_approval: list.filter((r) => r.status === 'pending_approval').length,
      abgelehnt: list.filter((r) => r.status === 'abgelehnt').length,
      installiert: list.filter((r) => r.installed).length,
    },
    limits: spec.LIMITS,
    route_allowlist: spec.ROUTE_ALLOWLIST,
    permissions: spec.PERMISSIONS,
    forbidden_patterns: spec.FORBIDDEN_PATTERNS.map((p) => ({ id: p.id, why: p.why })),
    imports: list.map((r) => ({
      id: r.id, name: r.name, version: r.version, at: r.at, status: r.status, ok: r.ok,
      installed: r.installed === true, reason: r.reason,
      checks: (r.checks || []).map((c) => ({ id: c.id, label: c.label, status: c.status, detail: c.detail })),
    })),
    boundary: 'Import prüft nur. Freigabe, Aktivierung und Start bleiben Entscheidungen des Menschen.',
  };
}

module.exports = { status, importPackage, list, discard, install, installIfStaged, collectFiles, safeRel, QUARANTINE_DIR, IMPORTS_FILE };
