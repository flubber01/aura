'use strict';
// Read-only diagnostic snapshot and deterministic runbook matching. Advice only:
// this module never spawns commands or writes runtime/configuration files.
const fs = require('fs');
const path = require('path');
const runbooks = require('./runbooks');
const ollama = require('./ollama_llm');

const DATA = path.join(__dirname, '..', 'data');
const MAX_LOG_BYTES = 256 * 1024;
const MAX_VALIDATE_BYTES = 128 * 1024;
const BOUNDARY = 'Nichts wurde ausgeführt — der Mensch führt jeden Schritt selbst aus.';

function redact(text) {
  return String(text || '')
    .replace(/(authorization\s*[:=]\s*bearer\s+)\S+/gi, '$1[ENTFERNT]')
    .replace(/\b((?:password|passwd|passwort|token|secret|api[_-]?key)\s*[:=]\s*)([^\s,;]+)/gi, '$1[ENTFERNT]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[KENNUNG ENTFERNT]')
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g, '[KENNUNG ENTFERNT]')
    .replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[KENNUNG ENTFERNT]');
}

function readTail(file, maxBytes = MAX_LOG_BYTES, maxLines = 40) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const st = fs.fstatSync(fd);
    const bytes = Math.min(st.size, maxBytes);
    const start = Math.max(0, st.size - bytes);
    const buffer = Buffer.alloc(bytes);
    const count = fs.readSync(fd, buffer, 0, bytes, start);
    let text = buffer.subarray(0, count).toString('utf8');
    if (start > 0) {
      const newline = text.indexOf('\n');
      text = newline < 0 ? '' : text.slice(newline + 1);
    }
    const lines = text.split(/\r?\n/).filter(Boolean).slice(-maxLines).map((line) => redact(line).slice(0, 2000));
    return { available: true, path: file, lines, message: lines.length ? '' : 'Logdatei ist lesbar, enthält aber noch keine Zeilen.' };
  } catch (error) {
    const denied = error && (error.code === 'EACCES' || error.code === 'EPERM');
    const absent = error && error.code === 'ENOENT';
    return {
      available: false,
      path: file,
      lines: [],
      message: denied ? 'Keine Berechtigung zum Lesen dieser Logdatei.' : absent ? 'Keine Berechtigung oder Logdatei nicht vorhanden.' : 'Logdatei konnte nicht gelesen werden: ' + String(error && error.code || 'unbekannter Fehler'),
    };
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch {} }
  }
}

function logSnapshot() {
  const configured = String(process.env.AURA_LOG || './aura-backend.log').trim() || './aura-backend.log';
  return readTail(path.isAbsolute(configured) ? path.normalize(configured) : path.resolve(process.cwd(), configured));
}

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function validateSnapshot() {
  const configured = String(process.env.AURA_VALIDATE_RESULT || path.join(DATA, 'validate-result.json')).trim() || path.join(DATA, 'validate-result.json');
  const file = path.isAbsolute(configured) ? path.normalize(configured) : path.resolve(process.cwd(), configured);
  try {
    const st = fs.statSync(file);
    if (!st.isFile()) return { available: false, path: file, message: 'Der Validate-Ergebnis-Pfad ist keine Datei.' };
    if (st.size > MAX_VALIDATE_BYTES) return { available: false, path: file, message: 'Validate-Ergebnis ist größer als die sichere Lesegrenze von 128 KiB.' };
    const raw = fs.readFileSync(file, 'utf8');
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (parsed && typeof parsed === 'object') {
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const pass = Number(parsed.pass ?? parsed.passed ?? parsed.summary?.pass ?? items.filter((item) => item && item.ok).length);
      const fail = Number(parsed.fail ?? parsed.failed ?? parsed.summary?.fail ?? items.filter((item) => item && item.ok === false).length);
      return {
        available: true,
        path: file,
        at: parsed.at || parsed.finished_at || parsed.timestamp || null,
        pass: Number.isFinite(pass) ? pass : null,
        fail: Number.isFinite(fail) ? fail : null,
        summary: Number.isFinite(pass) && Number.isFinite(fail) ? `${pass} pass / ${fail} fail` : 'Validate-Ergebnis gelesen; keine pass/fail-Zahlen enthalten.',
      };
    }
    return { available: true, path: file, summary: 'Text-Ergebnisdatei gelesen.', lines: raw.split(/\r?\n/).filter(Boolean).slice(-20).map((line) => redact(line).slice(0, 1000)) };
  } catch (error) {
    const denied = error && (error.code === 'EACCES' || error.code === 'EPERM');
    return {
      available: false,
      path: file,
      message: denied ? 'Keine Berechtigung zum Lesen des Validate-Ergebnisses.' : error && error.code === 'ENOENT' ? 'Kein gespeichertes Validate-Ergebnis gefunden.' : 'Validate-Ergebnis konnte nicht gelesen werden.',
    };
  }
}

function incidentSnapshot() {
  const securityFile = path.resolve(process.env.AURA_SECURITY_FILE || path.join(DATA, 'security_center.json'));
  const security = safeJson(securityFile);
  const securityEntries = security && Array.isArray(security.incidents) ? security.incidents.slice(0, 10).map((item) => ({
    id: redact(item.id || ''), at: item.at || null, severity: redact(item.severity || ''), state: redact(item.state || ''), what: redact(item.what || '').slice(0, 300),
  })) : [];

  const workflow = safeJson(path.join(DATA, 'workflow_runs.json'));
  const workflowEntries = workflow && Array.isArray(workflow.runs) ? workflow.runs.flatMap((run) => (Array.isArray(run.incidents) ? run.incidents.map((item) => ({
    id: redact(item.id || ''), at: item.reported_at || item.at || null, severity: redact(item.severity || ''), state: redact(item.state || ''), summary: redact(item.summary || '').slice(0, 300), workflow_id: redact(run.workflow_id || ''),
  })) : [])).slice(-10).reverse() : [];

  let repairLedger = [];
  try {
    const entries = require('./self_repair').report().repairs || [];
    repairLedger = entries.slice(-10).reverse().map((item) => ({ at: item.at || null, action: redact(item.action || ''), ok: item.ok === true }));
  } catch {}
  return {
    security: { file: securityFile, count: securityEntries.length, entries: securityEntries },
    workflows: { count: workflowEntries.length, entries: workflowEntries },
    repair_ledger: { count: repairLedger.length, entries: repairLedger },
  };
}

function configurationSnapshot() {
  const cfg = ollama.cfg();
  const rawUrl = String(process.env.OLLAMA_URL || '').trim();
  const rawModel = String(process.env.OLLAMA_MODEL || '').trim();
  return {
    ollama_url: { set: Boolean(rawUrl), valid: cfg.configured, endpoint: cfg.configured ? cfg.base : null },
    ollama_model: { set: Boolean(rawModel), value: cfg.model },
    timeout_ms: cfg.timeoutMs,
  };
}

async function status() {
  const configuration = configurationSnapshot();
  const probe = await ollama.status();
  const ollamaStatus = {
    configured: probe.configured === true,
    reachable: probe.reachable === true,
    model: probe.model || configuration.ollama_model.value,
    model_present: probe.model_present === true,
    models: Array.isArray(probe.models) ? probe.models : [],
    ...(probe.hint ? { hint: probe.hint } : {}),
    ...(probe.error ? { error: redact(probe.error) } : {}),
  };
  return {
    mode: 'READ_ONLY_LOCAL_REPAIR_STATUS',
    generated_at: new Date().toISOString(),
    log: logSnapshot(),
    validate: validateSnapshot(),
    incidents: incidentSnapshot(),
    ollama: ollamaStatus,
    configuration,
    runbooks: runbooks.list(),
    boundary: 'Read-only snapshot: keine Datei, Konfiguration, Installation oder Prozesssteuerung wird verändert.',
  };
}

function compactContext(snapshot) {
  return {
    log_tail: (snapshot.log.lines || []).slice(-6).map((line) => line.slice(0, 360)),
    log_state: snapshot.log.available ? 'lesbar' : snapshot.log.message,
    validate: snapshot.validate.available ? snapshot.validate.summary : snapshot.validate.message,
    incidents: {
      security: (snapshot.incidents.security.entries || []).slice(0, 2).map((item) => `${item.severity} ${item.state}: ${item.what}`),
      workflow: (snapshot.incidents.workflows.entries || []).slice(0, 2).map((item) => `${item.severity} ${item.state}: ${item.summary}`),
    },
    ollama: {
      configured: snapshot.ollama.configured,
      reachable: snapshot.ollama.reachable,
      model: snapshot.ollama.model,
      model_present: snapshot.ollama.model_present,
      models: snapshot.ollama.models.slice(0, 8),
    },
  };
}

function parsePhrasedSteps(text) {
  const lines = String(text || '').replace(/```[\s\S]*?```/g, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.map((line) => line.replace(/^\s*(?:(?:\d+\s*[.)])|[-*•])\s*/, '').trim()).filter(Boolean);
  if (bulletLines.length >= 2) return bulletLines;
  return String(text || '').split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
}

async function advise(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const errorText = String(payload.fehler || '').trim().slice(0, 1000);
  if (!errorText) {
    const error = new Error('Bitte beschreibe den Fehler im Feld „fehler“.');
    error.code = 400;
    throw error;
  }

  const snapshot = await status();
  const context = compactContext(snapshot);
  const matchText = [errorText, JSON.stringify(context)].join('\n');
  const requestedIds = Array.isArray(payload.runbook_ids) ? payload.runbook_ids.filter((id) => typeof id === 'string').slice(0, 10) : [];
  const requested = requestedIds.length ? requestedIds : null;
  const selected = runbooks.match(matchText, { ids: requested });
  const sourceSteps = [];
  for (const book of selected) {
    for (const step of book.steps.slice(0, selected.length > 1 ? 2 : 4)) sourceSteps.push({
      runbook_id: book.id,
      label: book.title,
      text: step.text,
      commands: step.commands.slice(),
    });
  }
  const chosenSteps = sourceSteps.slice(0, 4);
  const instruction = `Formuliere diese lokalen Diagnose-Schritte in einfachem, knappem Deutsch als genau ${chosenSteps.length} nummerierte Punkte. Bleib bei den vorgegebenen Fakten, erfinde nichts und ändere oder ergänze keine Befehle.`;
  const facts = JSON.stringify({
    gemeldeter_fehler: errorText,
    lokaler_kontext: context,
    vorgegebene_schritte: chosenSteps.map((step) => ({ runbook: step.label, text: step.text, befehle: step.commands })),
    grenze: BOUNDARY,
  }).slice(0, 3800);

  const phrased = await ollama.phrase({ question: instruction, facts });
  const generatedSteps = phrased.used ? parsePhrasedSteps(phrased.text) : [];
  const acceptedPhrasing = phrased.used && generatedSteps.length === chosenSteps.length;
  const steps = chosenSteps.map((step, index) => ({
    ...step,
    text: acceptedPhrasing ? redact(generatedSteps[index]).slice(0, 500) : step.text,
  }));
  const reply = acceptedPhrasing
    ? `Die Diagnose-Schritte wurden mit dem lokalen Modell ${phrased.model} formuliert. Auswahl und Befehle stammen unverändert aus dem lokalen Runbook-Katalog.`
    : `Das lokale Modell ist ${snapshot.ollama.configured ? 'nicht erreichbar, hat nicht geantwortet oder lieferte keine passende Punkteliste' : 'nicht konfiguriert'}. Hier ist die deterministische Runbook-Empfehlung zu „${errorText}“; die Fakten stammen aus dem lokalen Katalog und dem lesenden Status-Snapshot.`;
  const llmUsed = acceptedPhrasing;

  return {
    runbooks: selected.map((book) => ({
      id: book.id, title: book.title, summary: book.summary, score: book.score,
      diagnostics: book.diagnostics.map((item) => ({ ...item })),
    })),
    steps,
    reply,
    mode: llmUsed ? 'LOCAL-LLM · ollama:' + phrased.model : 'DETERMINISTIC-RUNBOOK · ohne lokales LLM',
    llm: llmUsed ? { used: true, model: phrased.model } : { used: false, reason: phrased.reason || 'lokales Modell nicht verfügbar oder Antwortformat ungültig' },
    context,
    boundary: BOUNDARY,
  };
}

module.exports = { status, advise, BOUNDARY, logSnapshot, validateSnapshot, incidentSnapshot };
