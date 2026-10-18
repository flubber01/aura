'use strict';
// AURA — Selbstbearbeitungs-Werkbank (Area 103 · /selfwork).
//
// Ablauf, immer mit dem Menschen als Tor:
//   1. POST /api/selfwork/propose  — deterministischer Kontext (git status, editierbare
//      Dateien, Schlüsselwort-Auszüge) → lokales Modell schreibt einen Unified Diff
//   2. Prüfen, ohne etwas anzuwenden: git apply --check in einem temporären Worktree,
//      node --check auf berührten Dateien, berührte Tests laufen lassen
//   3. GET /api/selfwork/proposals — Vorschläge mit Protokoll {checks[], diff, ok}
//   4. POST /api/selfwork/apply    — erst nach deinem Klick: git apply + lokaler Commit
//      auf Branch selfwork-local. Kein Push, kein Neustart, kein Merge.
//   5. POST /api/selfwork/revert   — nimmt genau diesen Vorschlag zurück.
//
// Harte Grenzen:
//   · erlaubte Pfade: backend/pages/**, backend/src/lib/**, backend/src/routes/**, test/**
//   · verboten: backend/src/data/**, deploy/**, .git/**, node_modules/** und alles mit
//     Geheimnis-Mustern (Schlüssel, Token, Kennwörter)
//   · kein Code geht ins Netz: der Kontext geht ausschließlich an das konfigurierte
//     lokale Ollama (OLLAMA_URL). Steht dort kein Schleifen-Adresse, wird das im
//     Protokoll als Hinweis ausgewiesen — nicht verschwiegen.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ollama = require('./ollama_llm');

const ROOT = path.join(__dirname, '..', '..', '..');             // Repository-Wurzel
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'selfwork.json');
const DIFF_DIR = path.join(DATA_DIR, 'selfwork');                // Runtime, liegt nie im Git
const BRANCH = 'selfwork-local';

const ALLOWED_PREFIXES = ['backend/pages/', 'backend/src/lib/', 'backend/src/routes/', 'test/'];
const FORBIDDEN_PREFIXES = ['backend/src/data/', 'backend/data/', 'deploy/', '.git/', 'node_modules/', 'extracted/', 'google_drive/', '_uploads/', 'backend/modules/'];
const ALLOWED_EXTENSIONS = ['.js'];
const MAX_DIFF_BYTES = 256 * 1024;
const MAX_CONTEXT_FILES = 400;
const MAX_EXCERPT_LINES = 60;
const MAX_FILE_SNIFF_BYTES = 96 * 1024;
const CHECK_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 120000;

const SECRET_PATTERNS = [
  /(authorization\s*[:=]\s*bearer\s+)\S+/i,
  /(password|passwd|passwort|token|secret|api[_-]?key|access[_-]?key)\s*[:=]\s*['"]?[^'"\s,;]+/i,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY/,
];

const BOUNDARY = 'Nichts wird gepusht oder automatisch neu gestartet. Der Vorschlag liegt lokal, der Commit landet auf Branch selfwork-local. Der Weg nach main bleibt dein PR-Ritual.';

const SYSTEM_PROMPT = [
  'Du bist der lokale Code-Handwerker von AURA und schreibst ausschließlich einen Unified Diff.',
  'Antworte NUR mit dem Diff. Kein Gruß, keine Erklärung, kein Markdown drumherum.',
  'Form: Zeilen mit "--- a/<pfad>", "+++ b/<pfad>", "@@ … @@" und +/-/Kontextzeilen mit einem Leerzeichen davor.',
  'Neue Datei: "--- /dev/null" und "+++ b/<pfad>".',
  'Erlaubte Pfade: backend/pages/**, backend/src/lib/**, backend/src/routes/**, test/** — sonst ist der Vorschlag ungültig.',
  'Verboten: backend/src/data/**, deploy/**, .git, node_modules, Umgebungsvariablen, Geheimnisse, Schlüssel und Netzwerkaufrufe.',
  'Halte den Änderungsumfang klein und prüfbar. Erfinde keine Dateien, die nicht im Kontext genannt sind.',
].join('\n');

// ---------------------------------------------------------------------------
// Git — immer als eigener Prozess, mit fester Identität und ohne Shell
// ---------------------------------------------------------------------------

const GIT_ENV = {
  GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'AURA Selbstbearbeitung',
  GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'selfwork@aura.local',
  GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'AURA Selbstbearbeitung',
  GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'selfwork@aura.local',
  GIT_TERMINAL_PROMPT: '0',
};

function git(args, options) {
  const opts = Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: Object.assign({}, process.env, GIT_ENV) }, options || {});
  let out;
  try { out = spawnSync('git', args, opts); }
  catch (e) { return { ok: false, code: -1, stdout: '', stderr: String(e && e.message || e) }; }
  return {
    ok: out.status === 0,
    code: out.status === null ? -1 : out.status,
    stdout: String(out.stdout || ''),
    stderr: String(out.stderr || ''),
    error: out.error ? String(out.error.message || out.error) : null,
  };
}

function repo() {
  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || inside.stdout.trim() !== 'true') return { is_repo: false, branch: null, head: null, dirty: [], reason: 'Kein Git-Repository — Vorschläge werden trotzdem geprüft, ein Commit ist dann nicht möglich.' };
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim() || null;
  const head = git(['rev-parse', 'HEAD']).stdout.trim() || null;
  const status = git(['status', '--porcelain', '--untracked-files=normal']);
  const dirty = status.stdout.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 40);
  const selfworkBranch = git(['rev-parse', '--verify', '--quiet', 'refs/heads/' + BRANCH]);
  return {
    is_repo: true,
    branch,
    head: head ? head.slice(0, 12) : null,
    dirty,
    dirty_count: dirty.length,
    branch_selfwork_vorhanden: selfworkBranch.ok && Boolean(selfworkBranch.stdout.trim()),
  };
}

// ---------------------------------------------------------------------------
// Dateiliste und Kontext (deterministisch — gleiche Eingabe, gleiches Ergebnis)
// ---------------------------------------------------------------------------

function editableFiles() {
  const found = [];
  const walk = (relative) => {
    const absolute = path.join(ROOT, relative);
    let entries = [];
    try { entries = fs.readdirSync(absolute, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relative + entry.name + (entry.isDirectory() ? '/' : '');
      if (entry.isDirectory()) { if (!rel.endsWith('/node_modules/')) walk(rel); continue; }
      if (!entry.isFile()) continue;
      if (!isAllowedPath(rel)) continue;
      let size = 0;
      try { size = fs.statSync(path.join(ROOT, rel)).size; } catch { continue; }
      found.push({ path: rel, bytes: size });
      if (found.length >= MAX_CONTEXT_FILES) return;
    }
  };
  for (const prefix of ALLOWED_PREFIXES) walk(prefix);
  return found;
}

function isAllowedPath(rel) {
  const value = String(rel || '');
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!ALLOWED_EXTENSIONS.includes(path.posix.extname(normalized))) return false;
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) return false;
  if (FORBIDDEN_PREFIXES.some((p) => normalized.startsWith(p))) return false;
  return ALLOWED_PREFIXES.some((p) => normalized.startsWith(p));
}

function keywords(text) {
  const stop = new Set(['und', 'oder', 'der', 'die', 'das', 'mit', 'von', 'für', 'auf', 'eine', 'einen', 'dem', 'den', 'des', 'nicht', 'soll', 'sollte', 'bitte', 'dass', 'wenn', 'aber', 'auch', 'nach', 'vor', 'bei', 'aus', 'wie', 'was', 'wer', 'warum', 'dann', 'jetzt', 'neue', 'neuen', 'neuer', 'über', 'unter']);
  const words = String(text || '').toLowerCase().match(/[a-zäöüß]{4,}/g) || [];
  const seen = [];
  for (const word of words) if (!stop.has(word) && !seen.includes(word)) seen.push(word);
  return seen.slice(0, 8);
}

function excerpts(auftrag, files) {
  const terms = keywords(auftrag);
  if (!terms.length) return [];
  const lines = [];
  for (const file of files) {
    if (lines.length >= MAX_EXCERPT_LINES) break;
    let text = '';
    try {
      const handle = fs.openSync(path.join(ROOT, file.path), 'r');
      const buffer = Buffer.alloc(Math.min(file.bytes, MAX_FILE_SNIFF_BYTES));
      const read = fs.readSync(handle, buffer, 0, buffer.length, 0);
      fs.closeSync(handle);
      text = buffer.subarray(0, read).toString('utf8');
    } catch { continue; }
    const fileLines = text.split('\n');
    fileLines.forEach((line, index) => {
      if (lines.length >= MAX_EXCERPT_LINES) return;
      const lower = line.toLowerCase();
      if (terms.some((term) => lower.includes(term))) lines.push({ file: file.path, line: index + 1, text: line.trim().slice(0, 200) });
    });
  }
  return lines;
}

function buildContext(auftrag) {
  const files = editableFiles();
  return {
    auftrag: String(auftrag || '').slice(0, 2000),
    repo: repo(),
    dateien_anzahl: files.length,
    dateien: files.map((f) => f.path),
    auszuege: excerpts(auftrag, files),
    grenzen: {
      erlaubt: ALLOWED_PREFIXES.slice(),
      verboten: FORBIDDEN_PREFIXES.slice(),
      endungen: ALLOWED_EXTENSIONS.slice(),
      branch: BRANCH,
    },
  };
}

// ---------------------------------------------------------------------------
// Diff verstehen
// ---------------------------------------------------------------------------

function extractDiff(text) {
  const raw = String(text || '');
  const withoutFences = raw.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  const lines = withoutFences.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\+\+\+\s|^---\s|diff --git\s)/.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return { ok: false, diff: '', files: [], errors: ['Die Antwort enthält keinen Unified Diff (kein "+++"/"---"/"diff --git").'] };
  let end = lines.length - 1;
  while (end > start && !lines[end].trim()) end--;
  const body = lines.slice(start, end + 1);
  // Abschneiden, wenn nach dem Diff noch Prosa folgt (Zeile, die zu keinem Diff gehört)
  const cut = body.findIndex((line, index) => index > 0 && line.trim() && !/^(diff --git|\+\+\+|---|@@|index |new file|deleted file|similarity |rename |old mode|new mode|\+|-| |\\|\s*$)/.test(line));
  const diffLines = cut > 0 ? body.slice(0, cut) : body;
  const diff = diffLines.join('\n') + '\n';
  const files = [];
  for (const line of diffLines) {
    const plus = /^\+\+\+\s+(?:b\/)?(.+?)(?:\t|$)/.exec(line);
    const minus = /^---\s+(?:a\/)?(.+?)(?:\t|$)/.exec(line);
    const target = (plus && plus[1]) || (minus && minus[1]);
    if (!target) continue;
    if (target === '/dev/null') continue;
    if (!files.includes(target)) files.push(target);
  }
  return { ok: files.length > 0, diff, files, errors: files.length ? [] : ['Im Diff wurde keine Zieldatei erkannt.'] };
}

function pathViolations(files) {
  const violations = [];
  for (const file of files) {
    if (!isAllowedPath(file)) violations.push(`${file}: nicht in der Erlaubnisliste (${ALLOWED_PREFIXES.join(', ')})`);
  }
  return violations;
}

function secretHits(diff) {
  const hits = [];
  for (const line of String(diff || '').split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) { hits.push(line.trim().slice(0, 160)); break; }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Prüfungen — in einem temporären Worktree, nie im Arbeitsbaum
// ---------------------------------------------------------------------------

function checkEntry(status, detail, extra) {
  return Object.assign({ status, detail: String(detail || '').slice(0, 1500) }, extra || {});
}

function runChecks(diff, files) {
  const checks = [];
  const state = repo();

  checks.push({ id: 'diff_format', label: 'Unified Diff erkannt und geparst', status: files.length ? 'ok' : 'fail', detail: files.length ? files.length + ' Datei(en): ' + files.join(', ') : 'keine Zieldatei erkannt' });

  const violations = pathViolations(files);
  checks.push({ id: 'pfade', label: 'Pfade in der Erlaubnisliste (backend/pages, backend/src/lib, backend/src/routes, test)', status: violations.length ? 'fail' : 'ok', detail: violations.length ? violations.join(' · ') : files.map((f) => '✔ ' + f).join(' · ') || 'keine Datei' });

  const secrets = secretHits(diff);
  checks.push({ id: 'geheimnisse', label: 'Keine Geheimnis-Muster in hinzugefügten Zeilen', status: secrets.length ? 'fail' : 'ok', detail: secrets.length ? secrets.join(' · ') : 'keine Treffer' });

  if (!state.is_repo) {
    checks.push({ id: 'git_apply_check', label: 'git apply --check im temporären Worktree', status: 'uebersprungen', detail: state.reason });
    checks.push({ id: 'node_check', label: 'node --check auf berührten JavaScript-Dateien', status: 'uebersprungen', detail: 'ohne Git-Repository nicht prüfbar' });
    checks.push({ id: 'tests', label: 'berührte Tests laufen lassen', status: 'uebersprungen', detail: 'ohne Git-Repository nicht prüfbar' });
    checks.push({ id: 'commit', label: 'Commit auf Branch ' + BRANCH + ' möglich', status: 'fail', detail: state.reason });
    return { checks, worktree: null };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-selfwork-'));
  const worktree = path.join(tmp, 'wt');
  const patchFile = path.join(tmp, 'vorschlag.diff');
  fs.writeFileSync(patchFile, diff);

  const add = git(['worktree', 'add', '--detach', worktree, 'HEAD']);
  if (!add.ok) {
    checks.push({ id: 'git_apply_check', label: 'git apply --check im temporären Worktree', status: 'fail', detail: 'Worktree nicht anlegbar: ' + (add.stderr || add.stdout || 'unbekannt').trim().slice(0, 300) });
    checks.push({ id: 'node_check', label: 'node --check auf berührten JavaScript-Dateien', status: 'uebersprungen', detail: 'Worktree fehlt' });
    checks.push({ id: 'tests', label: 'berührte Tests laufen lassen', status: 'uebersprungen', detail: 'Worktree fehlt' });
    return { checks, worktree: null, cleanup: () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} } };
  }

  const cleanup = () => {
    git(['worktree', 'remove', '--force', worktree]);
    git(['worktree', 'prune']);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  };

  const dry = spawnSync('git', ['-C', worktree, 'apply', '--check', patchFile], { encoding: 'utf8', env: Object.assign({}, process.env, GIT_ENV) });
  const dryOk = dry.status === 0;
  checks.push({ id: 'git_apply_check', label: 'git apply --check im temporären Worktree (gegen HEAD, ohne deinen Arbeitsbaum)', status: dryOk ? 'ok' : 'fail', detail: dryOk ? 'Patch passt sauber auf HEAD' : String(dry.stderr || dry.stdout || 'Patch passt nicht').trim().slice(0, 400) });

  let nodeOk = true;
  const nodeDetail = [];
  if (dryOk) {
    const applied = spawnSync('git', ['-C', worktree, 'apply', patchFile], { encoding: 'utf8', env: Object.assign({}, process.env, GIT_ENV) });
    if (applied.status !== 0) {
      nodeOk = false;
      nodeDetail.push('Anwenden im Worktree fehlgeschlagen: ' + String(applied.stderr || '').trim().slice(0, 200));
    } else {
      for (const file of files) {
        const target = path.join(worktree, file);
        if (!fs.existsSync(target)) { nodeDetail.push(file + ': nach dem Anwenden nicht gefunden'); continue; }
        const out = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8', timeout: CHECK_TIMEOUT_MS });
        if (out.status !== 0) { nodeOk = false; nodeDetail.push(file + ': ' + String(out.stderr || 'Syntaxfehler').split('\n').filter(Boolean).slice(0, 2).join(' · ').slice(0, 240)); }
        else nodeDetail.push(file + ': Syntax ok');
      }
    }
  } else {
    nodeOk = false;
    nodeDetail.push('übersprungen — git apply --check war rot');
  }
  checks.push({ id: 'node_check', label: 'node --check auf berührten JavaScript-Dateien (im Worktree, nach dem Anwenden)', status: nodeOk ? 'ok' : 'fail', detail: nodeDetail.join(' · ') || 'keine Datei berührt' });

  const testFiles = dryOk ? files.filter((f) => f.startsWith('test/') && f.endsWith('.test.js')) : [];
  if (!testFiles.length) {
    checks.push({ id: 'tests', label: 'berührte Tests laufen lassen', status: 'uebersprungen', detail: 'keine Testdatei berührt (nur test/**/*.test.js wird automatisch ausgeführt)' });
  } else {
    const results = [];
    let allOk = true;
    for (const file of testFiles) {
      const out = spawnSync(process.execPath, ['--test', file], { cwd: worktree, encoding: 'utf8', timeout: TEST_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, env: Object.assign({}, process.env, GIT_ENV) });
      const ok = out.status === 0;
      if (!ok) allOk = false;
      results.push(file + ': ' + (ok ? 'grün' : 'rot (Exit ' + out.status + ')' + (out.stderr ? ' — ' + String(out.stderr).trim().split('\n').slice(-3).join(' ').slice(0, 200) : '')));
    }
    checks.push({ id: 'tests', label: 'berührte Tests laufen lassen (node --test im Worktree)', status: allOk ? 'ok' : 'fail', detail: results.join(' · ') });
  }

  return { checks, worktree, cleanup };
}

// ---------------------------------------------------------------------------
// Vorschläge: anlegen, listen, anwenden, zurücknehmen
// ---------------------------------------------------------------------------

function load() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { vorschlaege: [] }; }
}
function save(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}
function diffFile(id) { return path.join(DIFF_DIR, id + '.diff'); }

function protocol(entry) {
  return {
    id: entry.id, at: entry.at, auftrag: entry.auftrag, modell: entry.modell,
    status: entry.status, ok: entry.ok === true, diff: entry.diff,
    dateien: entry.dateien, checks: entry.checks, llm: entry.llm,
    commit: entry.commit || null, taken: entry.taken || [],
    boundary: BOUNDARY,
  };
}

async function propose(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const auftrag = String(payload.auftrag || '').trim().slice(0, 2000);
  if (!auftrag) {
    const error = new Error('Bitte beschreibe den Auftrag im Feld „auftrag“.');
    error.code = 400;
    throw error;
  }
  const context = buildContext(auftrag);
  const modell = String(payload.modell || '').trim() || null;
  const id = 'sw-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex');

  const llm = await ollama.chat({
    model: modell,
    system: SYSTEM_PROMPT,
    prompt: 'AUFTRAG:\n' + auftrag + '\n\nKONTEXT (deterministisch, nur aus dem lokalen Repository):\n' + JSON.stringify(context).slice(0, 6000) + '\n\nAntworte ausschließlich mit dem Unified Diff.',
  });

  const base = { id, at: new Date().toISOString(), auftrag, modell: modell || (llm.model || null), status: 'vorgeschlagen', taken: [], boundary: BOUNDARY };

  if (!llm.used) {
    const entry = Object.assign({}, base, {
      ok: false, diff: '', dateien: [],
      checks: [{ id: 'diff_format', label: 'Unified Diff erkannt und geparst', status: 'fail', detail: 'kein Diff erzeugt' },
        { id: 'modell', label: 'Lokales Modell erreichbar', status: 'fail', detail: llm.reason || 'nicht erreichbar' }],
      llm: { used: false, reason: llm.reason || 'lokales Modell nicht verfügbar' },
    });
    const state = load(); state.vorschlaege.push(entry); save(state);
    return protocol(entry);
  }

  const parsed = extractDiff(llm.text);
  let checks = [];
  let diff = '';
  let files = [];
  let ok = false;

  if (!parsed.ok) {
    checks = [{ id: 'diff_format', label: 'Unified Diff erkannt und geparst', status: 'fail', detail: parsed.errors.join(' · ') }];
  } else if (Buffer.byteLength(parsed.diff) > MAX_DIFF_BYTES) {
    checks = [{ id: 'diff_format', label: 'Unified Diff erkannt und geparst', status: 'fail', detail: 'Diff größer als ' + Math.round(MAX_DIFF_BYTES / 1024) + ' KiB' }];
  } else {
    diff = parsed.diff;
    files = parsed.files;
    const run = runChecks(diff, files);
    checks = run.checks;
    if (run.cleanup) run.cleanup();
    ok = checks.every((c) => c.status !== 'fail');
  }

  if (ok && files.length) {
    fs.mkdirSync(DIFF_DIR, { recursive: true });
    fs.writeFileSync(diffFile(id), diff);
  }

  const entry = Object.assign({}, base, { ok, diff, dateien: files, checks, llm: { used: true, model: llm.model } });
  const state = load();
  state.vorschlaege.push(entry);
  if (state.vorschlaege.length > 30) state.vorschlaege = state.vorschlaege.slice(-30);
  save(state);
  return protocol(entry);
}

function list() {
  return load().vorschlaege.slice(-20).reverse().map(protocol);
}

function find(id) {
  return load().vorschlaege.find((entry) => entry.id === id) || null;
}

function apply(id) {
  const state = load();
  const entry = state.vorschlaege.find((item) => item.id === id);
  if (!entry) return { ok: false, error: 'Unbekannter Vorschlag: ' + id };
  if (entry.status === 'angewendet') return { ok: false, error: 'Vorschlag ist bereits angewendet' };
  if (!entry.ok) return { ok: false, error: 'Vorschlag ist nicht grün — die Prüfungen müssen bestanden sein, bevor du ihn anwendest' };

  const file = diffFile(id);
  if (!fs.existsSync(file)) return { ok: false, error: 'Diff-Datei fehlt — bitte Vorschlag erneut erstellen' };
  const diff = fs.readFileSync(file, 'utf8');
  const patch = path.join(os.tmpdir(), 'aura-apply-' + id + '.diff');
  fs.writeFileSync(patch, diff);

  const dry = git(['apply', '--check', patch]);
  if (!dry.ok) return { ok: false, error: 'git apply --check ist jetzt rot: ' + String(dry.stderr || '').trim().slice(0, 300) };

  const applied = git(['apply', patch]);
  if (!applied.ok) return { ok: false, error: 'git apply fehlgeschlagen: ' + String(applied.stderr || '').trim().slice(0, 300) };

  // Commit auf Branch selfwork-local — OHNE den Arbeitsbaum umzuschalten.
  // Dafür wird ein eigener Index benutzt (GIT_INDEX_FILE): der echte Index bleibt unberührt.
  const tmpIndex = path.join(os.tmpdir(), 'aura-index-' + id);
  const indexEnv = Object.assign({}, process.env, GIT_ENV, { GIT_INDEX_FILE: tmpIndex });
  try { fs.rmSync(tmpIndex, { force: true }); } catch {}
  const baseTree = spawnSync('git', ['read-tree', 'HEAD'], { cwd: ROOT, encoding: 'utf8', env: indexEnv });
  const add = spawnSync('git', ['add', '--'].concat(entry.dateien), { cwd: ROOT, encoding: 'utf8', env: indexEnv });
  const tree = spawnSync('git', ['write-tree'], { cwd: ROOT, encoding: 'utf8', env: indexEnv });

  let commit = null;
  if (tree.status === 0) {
    const head = git(['rev-parse', '--verify', '--quiet', 'refs/heads/' + BRANCH]);
    const parent = head.ok && head.stdout.trim() ? head.stdout.trim() : git(['rev-parse', 'HEAD']).stdout.trim();
    const message = 'selfwork: ' + String(entry.auftrag).slice(0, 100).replace(/\s+/g, ' ');
    const made = spawnSync('git', ['commit-tree', tree.stdout.trim(), '-p', parent, '-m', message, '-m', 'Vorschlag ' + entry.id + ' · Modell: ' + (entry.modell || 'unbekannt') + ' · Prüfprotokoll grün.'],
      { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, GIT_ENV) });
    if (made.status === 0) {
      const sha = made.stdout.trim();
      const ref = git(['update-ref', 'refs/heads/' + BRANCH, sha]);
      commit = ref.ok ? sha : null;
    }
  }
  try { fs.rmSync(tmpIndex, { force: true }); } catch {}
  try { fs.unlinkSync(patch); } catch {}

  entry.status = commit ? 'angewendet' : 'angewendet_ohne_commit';
  entry.commit = commit;
  entry.applied_at = new Date().toISOString();
  entry.taken = (entry.taken || []).concat([{ at: entry.applied_at, aktion: 'apply', commit }]);
  save(state);

  return {
    ok: true, id, commit, branch: BRANCH, status: entry.status,
    dateien: entry.dateien,
    hinweis: commit ? 'Commit liegt auf Branch ' + BRANCH + '. Dein Arbeitsbaum bleibt auf ' + (repo().branch || '—') + '. Es wurde nichts gepusht und nichts neu gestartet.'
      : 'Änderung angewendet, aber es konnte kein Commit erzeugt werden (Git meldet: ' + String(tree.stderr || add.stderr || baseTree.stderr || '').trim().slice(0, 200) + ').',
    boundary: BOUNDARY,
  };
}

function revert(id) {
  const state = load();
  const entry = state.vorschlaege.find((item) => item.id === id);
  if (!entry) return { ok: false, error: 'Unbekannter Vorschlag: ' + id };
  if (entry.status !== 'angewendet' && entry.status !== 'angewendet_ohne_commit') return { ok: false, error: 'Vorschlag ist nicht angewendet' };
  const file = diffFile(id);
  if (!fs.existsSync(file)) return { ok: false, error: 'Diff-Datei fehlt — Rücknahme nicht möglich' };
  const patch = path.join(os.tmpdir(), 'aura-revert-' + id + '.diff');
  fs.writeFileSync(patch, fs.readFileSync(file, 'utf8'));

  const dry = git(['apply', '--check', '--reverse', patch]);
  if (!dry.ok) return { ok: false, error: 'Rücknahme passt nicht mehr: ' + String(dry.stderr || '').trim().slice(0, 300) };
  const undone = git(['apply', '--reverse', patch]);
  if (!undone.ok) return { ok: false, error: 'Rücknahme fehlgeschlagen: ' + String(undone.stderr || '').trim().slice(0, 300) };
  try { fs.unlinkSync(patch); } catch {}

  // Branch-Zeiger zurücknehmen, aber nur, wenn die Spitze wirklich unser Commit ist.
  let branchZurueck = false;
  if (entry.commit) {
    const tip = git(['rev-parse', '--verify', '--quiet', 'refs/heads/' + BRANCH]);
    if (tip.ok && tip.stdout.trim() === entry.commit) {
      const parent = git(['rev-parse', entry.commit + '^']);
      if (parent.ok && parent.stdout.trim()) {
        const move = git(['update-ref', 'refs/heads/' + BRANCH, parent.stdout.trim()]);
        branchZurueck = move.ok;
      }
    }
  }

  entry.status = 'zurueckgenommen';
  entry.reverted_at = new Date().toISOString();
  entry.taken = (entry.taken || []).concat([{ at: entry.reverted_at, aktion: 'revert', branch_zurueck: branchZurueck }]);
  save(state);
  return { ok: true, id, status: entry.status, branch_zurueck: branchZurueck, dateien: entry.dateien, boundary: BOUNDARY };
}

// ---------------------------------------------------------------------------
// Status für die Oberfläche
// ---------------------------------------------------------------------------

function runbook() {
  return [
    { id: 'restart', label: 'AURA neu starten (nach deiner Freigabe)', commands: ['sudo systemctl restart aura', 'sudo systemctl status aura --no-pager', 'tail -n 40 "${AURA_LOG:-./aura-backend.log}"'] },
    { id: 'promote', label: 'Weg nach main — dein PR-Ritual', commands: ['git status --porcelain', 'git switch selfwork-local', 'git push -u origin selfwork-local', 'gh pr create --base main --head selfwork-local --title "selfwork: <kurzer Titel>" --body "Prüfprotokoll: node test/validate.js"', 'git switch main', 'git pull --ff-only origin main'] },
  ];
}

async function status() {
  const modelle = await ollama.models();
  const state = repo();
  return {
    mode: 'LOCAL_SELF_EDIT_WORKBENCH',
    area: '103',
    root: ROOT,
    branch_selfwork: BRANCH,
    repo: state,
    allowlist: { erlaubt: ALLOWED_PREFIXES, endungen: ALLOWED_EXTENSIONS, verboten: FORBIDDEN_PREFIXES },
    files: editableFiles().length,
    modelle,
    model_default: modelle.default,
    vorschlaege: load().vorschlaege.length,
    grenzen: {
      kein_push: true,
      kein_neustart: true,
      kein_merge: true,
      code_verlaesst_die_maschine_nicht: modelle.configured ? /^(https?:\/\/)?(127\.|localhost|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(String(modelle.endpoint || '')) : true,
      hinweis: modelle.configured
        ? 'Der Kontext geht ausschließlich an OLLAMA_URL = ' + modelle.endpoint
        : 'OLLAMA_URL ist nicht gesetzt — ohne lokales Modell gibt es keinen Vorschlag (ehrlich statt geraten).',
    },
    runbook: runbook(),
    boundary: BOUNDARY,
  };
}

module.exports = { status, propose, list, apply, revert, buildContext, extractDiff, isAllowedPath, runChecks, editableFiles, repo, ROOT, BRANCH, BOUNDARY, ALLOWED_PREFIXES, FORBIDDEN_PREFIXES, pathViolations, secretHits };
