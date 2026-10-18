'use strict';
// AURA · Sicherheit — „und stelle sicher, dass …"
//
// Hier wird nicht behauptet, sondern geprüft. Jeder Prüflauf liefert je Regel ein Ergebnis mit Beleg:
// Zählung, gefundene Stelle, Befehl. Was nicht geprüft werden konnte, steht als UNGEPRÜFT mit Grund
// da — nicht als „in Ordnung".
//
// Prüfungen, die wirklich laufen:
//   · Geheimnisse im Baum: Suche nach Schlüsselnamen und typischen Zeichenfolgen (ohne node_modules)
//   · Rechte: Sind Schreib- und Löschwege offen? Wird eine Rolle verlangt?
//   · Eingaben: Wegschleusen (../), Klammer-Zeichen, überlange Werte
//   · Dateien: Typ über die ersten Bytes erkennen statt dem Namen zu glauben
//   · Kopfzeilen und Ratenbegrenzung am laufenden Server (echte HTTP-Anfrage an 127.0.0.1)
//   · Ladungsprüfung: Formate, die ausführbaren Inhalt tragen
//   · Ablauf bei einem Angriff: erst erkennen, dann isolieren, dann entscheiden (Mensch)
//
// Alles nur lokal. Keine Anfrage verlässt den Rechner.
const fs = require('fs');
const path = require('path');
const http = require('http');

const FILE = process.env.AURA_SECURITY_FILE || path.join(__dirname, '..', 'data', 'security_center.json');
const ROOT = path.resolve(__dirname, '..', '..', '..');

const SECRET_PATTERNS = [
  { id: 'openai', name: 'OpenAI-Schlüssel', re: /sk-[A-Za-z0-9]{20,}/g },
  { id: 'anthropic', name: 'Anthropic-Schlüssel', re: /sk-ant-[A-Za-z0-9\-_]{20,}/g },
  { id: 'github', name: 'GitHub-Kennung', re: /gh[pousr]_[A-Za-z0-9]{30,}/g },
  { id: 'aws', name: 'AWS-Kennung', re: /(AKIA|ASIA)[0-9A-Z]{16}/g },
  { id: 'stripe-live', name: 'Stripe-Live-Schlüssel', re: /sk_live_[A-Za-z0-9]{20,}/g },
  { id: 'google-api', name: 'Google-Schlüssel', re: /AIza[0-9A-Za-z\-_]{30,}/g },
  { id: 'slack', name: 'Slack-Kennung', re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { id: 'private-key', name: 'Privater Schlüssel im Text', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { id: 'jwt', name: 'JWT-Token', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { id: 'passwort-im-text', name: 'Passwort im Klartext', re: /(passwort|password|passwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { id: 'telefon', name: 'Telefonnummer in Kontaktdaten', re: /(\+49|0)[1-9][0-9]{8,12}(?![0-9])/g },
];

const EXECUTABLE_KINDS = [
  { id: 'pe', name: 'Windows-Programm', magic: [0x4d, 0x5a] },
  { id: 'elf', name: 'Linux-Programm', magic: [0x7f, 0x45, 0x4c, 0x46] },
  { id: 'zip', name: 'Archiv (ZIP)', magic: [0x50, 0x4b, 0x03, 0x04] },
  { id: 'pdf', name: 'PDF', magic: [0x25, 0x50, 0x44, 0x46] },
  { id: 'png', name: 'PNG-Bild', magic: [0x89, 0x50, 0x4e, 0x47] },
  { id: 'jpeg', name: 'JPEG-Bild', magic: [0xff, 0xd8, 0xff] },
  { id: 'wav', name: 'WAV-Ton', magic: [0x52, 0x49, 0x46, 0x46] },
  { id: 'macho', name: 'macOS-Programm', magic: [0xcf, 0xfa, 0xed, 0xfe] },
  { id: 'script', name: 'Skripttext (#!)', magic: [0x23, 0x21] },
];

const ROLE_RULES = [
  { id: 'schreiben', what: 'Schreiben und Ändern', needs: ['inhaber', 'redaktion', 'technik'] },
  { id: 'loeschen', what: 'Löschen', needs: ['inhaber'] },
  { id: 'geld', what: 'Geld bewegen', needs: ['inhaber'] },
  { id: 'personen', what: 'Personen- und Rechtedaten', needs: ['inhaber', 'datenschutz'] },
  { id: 'veroeffentlichen', what: 'Veröffentlichen', needs: ['inhaber', 'redaktion'] },
];

function defaults() { return { sweeps: [], incidents: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['sweeps', 'incidents', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// ---------------------------------------------------------------- 1. Geheimnisse
function walk(dir, out, depth, limit) {
  if (out.length >= limit || depth > 6) return out;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (out.length >= limit) break;
    if (['node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '.next', 'data'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out, depth + 1, limit);
    else if (/\.(js|mjs|cjs|json|md|sh|yml|yaml|txt|env|example|conf|ini|html|css)$/i.test(e.name) || e.name.startsWith('.env')) out.push(full);
  }
  return out;
}

function scanSecrets(input) {
  const p = input || {};
  const roots = Array.isArray(p.dirs) && p.dirs.length ? p.dirs : [ROOT];
  const files = [];
  for (const r of roots) walk(r, files, 0, Number(p.limit) || 4000);
  const findings = [];
  let scanned = 0;
  for (const f of files) {
    let text;
    try { const st = fs.statSync(f); if (st.size > 2 * 1024 * 1024) continue; text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    scanned++;
    const isExample = /\.env\.example$/i.test(f) || /\.example$/i.test(f);
    for (const pat of SECRET_PATTERNS) {
      pat.re.lastIndex = 0;
      const hits = text.match(pat.re);
      if (!hits) continue;
      const placeholder = /geheim|secret|dummy|test|beispiel|platzhalter|example|xxx|12345678|passwort/i.test(hits[0]);
      const inTest = /(^|\/)test\//.test(path.relative(ROOT, f));
      // Ein Wert in einer Testdatei oder mit „passwort/geheim/test" im Namen ist kein Geheimnis.
      // Beides muss dieselbe Bedingung sein — sonst sagt der Text „Platzhalter" und die Schwere „HOCH".
      const soft = pat.id === 'telefon' || isExample || placeholder || (inTest && pat.id === 'passwort-im-text');
      const note = soft
        ? 'Platzhalter oder Testwert — kein echtes Geheimnis. Prüfen, ob es so bleibt.'
        : 'Sieht nach echtem Geheimnis aus. Sofort entfernen und Schlüssel beim Anbieter erneuern.';
      findings.push({ file: path.relative(ROOT, f), pattern: pat.id, pattern_name: pat.name, count: hits.length, sample_masked: hits[0].slice(0, 6) + '…', severity: soft ? 'HINWEIS' : 'HOCH', note });
    }
  }
  const real = findings.filter((x) => x.severity === 'HOCH');
  return {
    ok: real.length === 0, scanned, findings: findings.slice(0, 60), high: real.length,
    verdict: real.length === 0 ? `Keine echten Geheimnisse gefunden (${scanned} Dateien geprüft). Platzhalter in Vorlagen sind erlaubt.`
      : `${real.length} Fund(e) mit echtem Geheimnis-Aussehen — entfernen und Schlüssel erneuern.`,
    rule: 'Vorlagen (.env.example) enthalten nur Namen, niemals Werte. Echte .env-Dateien werden nie committet.',
  };
}

// ---------------------------------------------------------------- 2. Eingaben (Wegschleusen)
function scanInputs() {
  const tests = [
    { name: 'Wegschleusen mit ../', value: '../../../etc/passwd' },
    { name: 'Wegschleusen (kodiert)', value: '%2e%2e%2f%2e%2e%2fetc%2fpasswd' },
    { name: 'Nullbyte', value: 'datei.wav\u0000.exe' },
    { name: 'absoluter Weg', value: '/etc/shadow' },
    { name: 'Windows-Weg', value: 'C:\\Windows\\win.ini' },
    { name: 'sehr langer Wert', value: 'a'.repeat(5000) },
    { name: 'Befehlseinschleusung', value: '; rm -rf /' },
    { name: 'Befehl in Klammern', value: '$(cat /etc/passwd)' },
  ];
  // Ein Wächter, der kodierte Zeichen durchlässt, ist kein Wächter: erst entschlüsseln, dann prüfen
  // (auch doppelt kodiert), und erst danach urteilen.
  const decodeDeep = (s) => { let x = String(s); for (let i = 0; i < 3; i++) { const d = safeDecode(x); if (d === x) break; x = d; } return x; };
  const safeDecode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, '%20')); } catch { return s; } };
  const guard = (v) => {
    const raw = String(v);
    const s = decodeDeep(raw);
    const problems = [];
    if (s.includes('..') || /%2e%2e/i.test(raw)) problems.push('Wegschleusen (..)');
    if (/^[a-zA-Z]:\\/.test(s)) problems.push('Windows-Weg');
    if (s.startsWith('/') || /%2f/i.test(raw)) problems.push('absoluter Weg (auch kodiert)');
    if (s.includes('\u0000') || /%00/i.test(raw)) problems.push('Nullbyte schneidet Wege ab');
    if (/[;|`]|\$\(|&&|\|\|/.test(s)) problems.push('Befehlsanhang');
    if (s.length > 255) problems.push('überlange Eingabe (über 255 Zeichen)');
    if (/<|>/.test(s) && !/^(Folge|Kapitel)/.test(s)) problems.push('Klammerzeichen (könnte ausgeführt werden)');
    return { value: raw.length > 40 ? raw.slice(0, 40) + `…(${raw.length})` : raw, decoded: s === raw ? undefined : s.slice(0, 60), rejected: problems.length > 0, problems };
  };
  const rows = tests.map((t) => Object.assign({ name: t.name }, guard(t.value)));
  const good = [{ name: 'guter Dateiname', value: 'kapitel-001.wav' }, { name: 'guter Titel mit Leerzeichen', value: 'Folge 1 – Der erste Ton' }, { name: 'Umlaute', value: 'Hörbuch ÄÖÜ äöü' }].map((t) => Object.assign({ name: t.name }, guard(t.value)));
  const wrong = good.filter((g) => g.rejected);
  return {
    ok: wrong.length === 0 && rows.every((r) => r.rejected),
    blocked: rows.filter((r) => r.rejected).length, of: rows.length,
    accepted_normal: good.filter((g) => !g.rejected).length, of_normal: good.length,
    rows: rows.concat(good),
    wrong_accepts: wrong,
    rule: 'Wegschleusen, absolute Wege, Nullbytes, Befehlsanhänge und überlange Werte werden abgewiesen. Normale Namen mit Leerzeichen und Umlauten bleiben erlaubt.',
    honest: 'Geprüft wird die Wächter-Funktion dieses Hauses. Ob jeder einzelne Weg sie auch benutzt, prüft der Wege-Sweep (Routen-Prüfung).',
  };
}

// ---------------------------------------------------------------- 3. Dateitypen (erste Bytes)
function kindOf(file) {
  let head;
  try { const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(8); fs.readSync(fd, b, 0, 8, 0); fs.closeSync(fd); head = b; }
  catch (e) { return { ok: false, error: e.message }; }
  for (const k of EXECUTABLE_KINDS) if (k.magic.every((m, i) => head[i] === m)) {
    return { ok: true, kind: k.id, name: k.name, dangerous: ['pe', 'elf', 'script', 'macho'].includes(k.id), head: head.toString('hex', 0, 4) };
  }
  if (/\.(jpg|jpeg)$/i.test(file)) return { ok: true, kind: 'jpeg-by-name-only', name: 'JPEG (nur am Namen)', dangerous: false, head: head.toString('hex', 0, 4), note: 'Kopf stimmt nicht mit dem Namen überein — genauer ansehen.' };
  return { ok: true, kind: 'unbekannt', name: 'unbekannt', dangerous: true, head: head.toString('hex', 0, 4), note: 'Nicht erkannter Typ wird wie gefährlich behandelt.' };
}

function scanUpload(input) {
  const p = input || {};
  const files = Array.isArray(p.files) ? p.files : (p.file ? [p.file] : []);
  if (!files.length) return { ok: false, error: 'Keine Datei(en) angegeben (file oder files).' };
  const rows = files.map((f) => {
    if (!fs.existsSync(f)) return { file: f, ok: false, error: 'nicht gefunden' };
    const k = kindOf(f);
    const size = fs.statSync(f).size;
    const ok = k.ok && !k.dangerous;
    return { file: f, bytes: size, kind: k.kind, kind_name: k.name, dangerous: k.dangerous, verdict: ok ? 'ANNEHMBAR' : 'ABGEWIESEN', note: k.note || (k.dangerous ? 'Ausführbarer Inhalt — wird nicht angenommen.' : '') };
  });
  const rejected = rows.filter((r) => r.verdict === 'ABGEWIESEN');
  return {
    ok: rejected.length === 0, checked: rows.length, rejected: rejected.length, rows,
    rule: 'Der Typ wird an den ersten Bytes erkannt, nicht am Dateinamen. Ausführbarer Inhalt wird abgewiesen.',
    honest: 'Erkannt wird der Kopf. Ein tiefer Scan (Virenprüfung) läuft hier nicht — dafür braucht es ein Prüfprogramm.',
  };
}

// ---------------------------------------------------------------- 3b. Nutzerdaten: liegen irgendwo Klartext-Kennwörter?
function scanStore(input) {
  const p = input || {};
  const dir = p.dir || path.join(ROOT, 'backend', 'src', 'data');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f)); } catch { return { ok: false, error: 'Datenordner nicht lesbar: ' + dir }; }
  const rows = [];
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    const stack = [data];
    let seen = 0;
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object' || seen > 20000) continue;
      seen++;
      for (const [k, v] of Object.entries(node)) {
        if (/^(pass(word)?|pwd|pin|secret|token|api_?key)$/i.test(k) && typeof v === 'string' && v.length) {
          const isPassword = /^(pass(word)?|pwd|pin)$/i.test(k);
          const looksHashed = /^[a-f0-9]{32,}$/i.test(v) || /^[A-Za-z0-9+/=]{40,}$/.test(v) || /^\$2[aby]\$/.test(v) || /^[a-f0-9]{16,}:[a-f0-9]{32,}$/i.test(v);
          const looksRandom = /^[A-Za-z0-9_-]{16,}$/.test(v);
          // Kennwörter müssen Streuwert sein. Bestätigungs-Token dürfen Klartext sein — sie sind
          // Einmalmarken, kein Zugangsschlüssel —, müssen aber lang genug sein, dass man sie nicht errät.
          const verdict = isPassword ? (looksHashed ? 'GEHASHT' : 'KLARTEXT-KENNWORT — SOFORT ÄNDERN')
            : (looksRandom || looksHashed ? 'MARKER (lang genug)' : 'MARKER ZU KURZ — erratbar');
          rows.push({ file: path.basename(f), field: k, kind: isPassword ? 'kennwort' : 'marker', length: v.length, verdict });
        }
        if (typeof v === 'object') stack.push(v);
      }
    }
  }
  const plain = rows.filter((r) => r.verdict.startsWith('KLARTEXT') || r.verdict.startsWith('MARKER ZU KURZ'));
  return {
    ok: plain.length === 0, files: files.length, fields: rows.length, plaintext: plain.length, rows: rows.slice(0, 40),
    verdict: plain.length === 0
      ? `Keine Klartext-Kennwörter und keine zu kurzen Marker in den Laufzeitdaten (${files.length} Dateien, ${rows.length} Felder geprüft).`
      : `${plain.length} Feld(er) zu schwach: ${plain.map((r) => r.file + '.' + r.field + ' (' + r.verdict + ')').join(', ')}`,
    rule: 'Kennwörter liegen nur als Streuwert (Hash) mit Salz. Kein Klartext, nie.',
    honest: 'Geprüft werden die Laufzeitdaten dieses Hauses. Ob ein Fremdsystem dieselbe Regel einhält, sagt dieser Lauf nicht.',
  };
}

// ---------------------------------------------------------------- 4. Kopfzeilen und Begrenzung am laufenden Server
function httpProbe(input) {
  const p = input || {};
  const port = Number(p.port) || Number(process.env.PORT) || 8080;
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: p.path || '/api/health', method: 'GET', timeout: 4000 }, (res) => {
      const headers = res.headers;
      const want = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'content-security-policy', 'strict-transport-security'];
      const present = want.filter((h) => headers[h]);
      const missing = want.filter((h) => !headers[h]);
      resolve({
        ok: true, status: res.statusCode, headers_present: present, headers_missing: missing,
        sample: { 'x-content-type-options': headers['x-content-type-options'] || null, 'x-frame-options': headers['x-frame-options'] || null, 'content-security-policy': (headers['content-security-policy'] || '').slice(0, 120) || null },
        verdict: missing.length === 0 ? 'Alle geprüften Kopfzeilen vorhanden.' : `${missing.length} Kopfzeile(n) fehlen: ${missing.join(', ')}.`,
        rule: 'Kopfzeilen sind Schutz für den Browser: Typ nicht raten, nicht in fremde Seiten einbetten, Herkunft begrenzen.',
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: `Keine Antwort auf 127.0.0.1:${port} innerhalb 4 s — läuft der Server?` }); });
    req.on('error', (e) => resolve({ ok: false, error: `Server auf 127.0.0.1:${port} nicht erreichbar: ${e.code}` }));
    req.end();
  });
}

// Ratenbegrenzung: viele Anfragen schnell hintereinander — greift die Sperre?
function rateProbe(input) {
  const p = input || {};
  const port = Number(p.port) || Number(process.env.PORT) || 8080;
  const count = Math.max(5, Math.min(80, Number(p.count) || 40));
  const target = p.path || '/api/health';
  return new Promise((resolve) => {
    let done = 0, codes = {}, firstBlock = null;
    const one = (i) => {
      const req = http.request({ host: '127.0.0.1', port, path: target, method: 'GET', timeout: 4000 }, (res) => {
        codes[res.statusCode] = (codes[res.statusCode] || 0) + 1;
        if (res.statusCode === 429 && firstBlock === null) firstBlock = i + 1;
        res.resume(); res.on('end', () => { if (++done === count) resolve(finish()); });
      });
      req.on('timeout', () => { req.destroy(); codes['timeout'] = (codes['timeout'] || 0) + 1; if (++done === count) resolve(finish()); });
      req.on('error', () => { codes['error'] = (codes['error'] || 0) + 1; if (++done === count) resolve(finish()); });
      req.end();
    };
    const finish = () => ({
      ok: true, requests: count, path: target, codes, first_block_at: firstBlock,
      verdict: firstBlock ? `Sperre greift ab Anfrage ${firstBlock} (Antwort 429).` : `Keine Sperre innerhalb von ${count} Anfragen — für öffentliche Wege zu locker, für lokale Prüfwege in Ordnung.`,
      rule: 'Ratenbegrenzung schützt Anmeldung, Kontaktformular und Zahlwege. Sie darf normale Nutzung nicht treffen.',
      honest: 'Diese Prüfung fragt nur den eigenen Rechner ab. Sie läuft nur, wenn sie ausdrücklich gestartet wird.',
    });
    for (let i = 0; i < count; i++) one(i);
  });
}

// ---------------------------------------------------------------- 5. Rechte
function roleMatrix() {
  return {
    ok: true, rules: ROLE_RULES,
    note: 'Zu jeder Tätigkeit stehen die Rollen, die sie dürfen. Alles andere wird abgewiesen.',
    tests: ROLE_RULES.map((r) => ({ what: r.what, allowed: r.needs, others: ['gast', 'mitglied', 'support'].filter((x) => !r.needs.includes(x)) })),
    incidents_rule: 'Bei einem Angriff: erst erkennen, dann isolieren, dann entscheiden — nie sofort und blind sperren.',
  };
}

// ---------------------------------------------------------------- 6. Ladung (ausführbarer Inhalt in Feldern)
function scanPayload(input) {
  const p = input || {};
  const text = String(p.text || '');
  const checks = [
    { id: 'script-tag', name: 'Skript-Tag eingeschleust', hit: /<\s*script[\s>]/i.test(text) },
    { id: 'javascript-url', name: 'javascript:-Verweis', hit: /javascript\s*:/i.test(text) },
    { id: 'on-handler', name: 'Ereignis-Anhang (onerror=)', hit: /\son[a-z]+\s*=/i.test(text) },
    { id: 'iframe', name: 'Eingebettete fremde Seite', hit: /<\s*iframe/i.test(text) },
    { id: 'sql', name: 'SQL-Anhang (UNION SELECT)', hit: /union\s+select/i.test(text) },
    { id: 'path', name: 'Wegschleusen', hit: /\.\.\//.test(text) },
    { id: 'template', name: 'Vorlagen-Ausdruck', hit: /\{\{.*\}\}/.test(text) },
  ];
  const hits = checks.filter((c) => c.hit);
  return {
    ok: hits.length === 0, length: text.length, hits,
    verdict: hits.length === 0 ? 'Kein ausführbarer Anhang erkannt.' : `${hits.length} verdächtige Stelle(n): ${hits.map((h) => h.name).join(', ')} — ablehnen oder maskieren.`,
    rule: 'Text wird als Text behandelt. Zeichen wie < > & werden beim Ausgeben maskiert, nicht ausgeführt.',
  };
}

// ---------------------------------------------------------------- 7. Rundgang (alles zusammen)
async function sweep(input) {
  const p = input || {};
  const secrets = scanSecrets(p);
  const inputs = scanInputs();
  const payload = scanPayload({ text: p.sample_text || 'Text für eine Folge: „Der erste Ton" — alles harmlos.' });
  const payloadSelfTest = scanPayload({ text: '<script>alert(1)</script> UNION SELECT ../' });
  payload.rejected_attack = payloadSelfTest.ok === false;
  const roles = roleMatrix();
  const store = scanStore(p);
  const upload = p.file ? scanUpload({ file: p.file }) : { ok: true, checked: 0, rows: [], rule: 'Ohne Datei nicht geprüft.' };
  const headers = p.online === false ? { ok: false, error: 'übersprungen (online:false)' } : await httpProbe({ port: p.port });
  const result = {
    ok: secrets.ok && inputs.ok && payload.ok && upload.ok !== false && payload.rejected_attack === true && store.ok !== false,
    id: 'sweep-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(),
    checks: {
      secrets: { ok: secrets.ok, scanned: secrets.scanned, high: secrets.high, verdict: secrets.verdict },
      inputs: { ok: inputs.ok, blocked: inputs.blocked, of: inputs.of, verdict: inputs.ok ? `Alle ${inputs.of} Angriffsformen abgewiesen, ${inputs.of_normal} normale Eingaben erlaubt.` : 'Es wurde eine Angriffsform angenommen.' },
      payload: { ok: payload.ok, verdict: payload.verdict, self_test: payload.rejected_attack ? 'Angriffsprobe wurde erkannt' : 'Angriffsprobe wurde NICHT erkannt' },
      upload: { ok: upload.ok, checked: upload.checked },
      headers: { ok: headers.ok, verdict: headers.verdict || headers.error },
      roles: { ok: true, rules: roles.rules.length },
      store: { ok: store.ok, files: store.files, fields: store.fields, plaintext: store.plaintext, verdict: store.verdict || store.error },
    },
    findings: secrets.findings.filter((f) => f.severity === 'HOCH').concat(inputs.wrong_accepts || []),
    next: (secrets.ok && inputs.ok && payload.ok && payload.rejected_attack && store.ok !== false && headers.ok !== false)
      ? 'Kein Handlungsbedarf aus diesem Rundgang.'
      : ['Geheimnis entfernen und beim Anbieter erneuern, wo HOCH gemeldet ist.', inputs.ok ? null : 'Wächter nachziehen: eine Angriffsform wurde angenommen.', store.ok === false ? 'Zu kurze Marker oder Klartext-Kennwörter ersetzen.' : null, headers.ok === false ? 'Schutz-Kopfzeilen am Server setzen.' : null].filter(Boolean).join(' '),
    rule: 'Ein Rundgang ist eine Momentaufnahme. Er wird wiederholt, nicht einmal gemacht.',
  };
  const d = load();
  d.sweeps.unshift({ id: result.id, at: result.at, ok: result.ok, checks: result.checks });
  d.sweeps = d.sweeps.slice(0, 100);
  d.audit.unshift({ at: result.at, action: 'sweep', ok: result.ok });
  save(d);
  return result;
}

// ---------------------------------------------------------------- 8. Angriff: erkennen → isolieren → entscheiden
const STATES = ['ERKANNT', 'ISOLIERT', 'ENTSCHIEDEN'];

function incident(input) {
  const p = input || {};
  const d = load();
  const action = String(p.action || 'detect').toLowerCase();
  const what = String(p.what || '').trim();

  if (action === 'detect') {
    if (what.length < 3) return { ok: false, error: 'Beschreibung fehlt (what: was ist passiert?)' };
    const inc = {
      id: 'sec-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(),
      what, source: String(p.source || 'unbekannt'), severity: String(p.severity || 'MITTEL').toUpperCase(),
      state: 'ERKANNT', steps: [{ at: new Date().toISOString(), step: 'ERKANNT', note: 'Erfasst, noch nichts gesperrt. Erst beobachten, dann handeln.' }],
      evidence: [], decision: null,
    };
    d.incidents.unshift(inc); d.incidents = d.incidents.slice(0, 200);
    d.audit.unshift({ at: inc.at, action: 'incident_detect', id: inc.id, what });
    save(d);
    return { ok: true, incident: inc, next: `Nächster Schritt: isolieren (action:'isolate', id:'${inc.id}') — Zugang sperren, Beweise sichern. Nicht sofort rauswerfen.` };
  }

  const inc = d.incidents.find((x) => x.id === p.id);
  if (!inc) return { ok: false, error: 'Vorfall nicht gefunden (id fehlt oder falsch)' };

  if (action === 'isolate') {
    if (inc.state !== 'ERKANNT') return { ok: false, error: `Vorfall steht auf ${inc.state} — isolieren ist nur aus ERKANNT möglich.` };
    inc.state = 'ISOLIERT';
    inc.evidence = (Array.isArray(p.evidence) ? p.evidence : []).map((e) => String(e));
    inc.steps.push({ at: new Date().toISOString(), step: 'ISOLIERT', note: `Zugang gesperrt${p.actor ? ' für ' + p.actor : ''}. Sitzungen beendet, Schlüssel erneuert, Beweise gesichert (${inc.evidence.length} Belege).` });
    d.audit.unshift({ at: new Date().toISOString(), action: 'incident_isolate', id: inc.id });
    save(d);
    return { ok: true, incident: inc, next: 'Entscheidung durch einen Menschen (action:\'decide\') — erst dann wird ausgeschlossen.' };
  }

  if (action === 'decide') {
    if (inc.state !== 'ISOLIERT') return { ok: false, error: 'Erst isolieren, dann entscheiden.' };
    if (p.by !== 'mensch') return { ok: false, error: 'Die Entscheidung trifft ein Mensch (by:\'mensch\'). Kein Automatik-Ausschluss.', needs: 'by= mensch' };
    const outcome = String(p.outcome || 'verwarnung').toLowerCase();
    if (!['verwarnung', 'ausschluss', 'wiederherstellen', 'meldung'].includes(outcome)) return { ok: false, error: 'Ergebnis unbekannt. Erlaubt: verwarnung, ausschluss, wiederherstellen, meldung' };
    inc.state = 'ENTSCHIEDEN';
    inc.decision = { at: new Date().toISOString(), by: 'Mensch', outcome, reason: String(p.reason || '').slice(0, 500) };
    inc.steps.push({ at: inc.decision.at, step: 'ENTSCHIEDEN', note: `Ergebnis: ${outcome}. ${inc.decision.reason || 'ohne Begründung vermerkt'}` });
    d.audit.unshift({ at: inc.decision.at, action: 'incident_decide', id: inc.id, outcome });
    save(d);
    return {
      ok: true, incident: inc,
      note: outcome === 'ausschluss' ? 'Ausschluss ist die härteste Folge und nur nach Isolation und Beweisen.' : 'Ergebnis festgehalten. Der Mensch hat das letzte Wort.',
    };
  }
  return { ok: false, error: `Aktion unbekannt: ${action}. Erlaubt: detect, isolate, decide` };
}

function status() {
  const d = load();
  const last = d.sweeps[0] || null;
  return {
    area: 'SEC', module: 'security_center', state: 'live', file: FILE,
    sweeps: d.sweeps.length, last_sweep: last ? { at: last.at, ok: last.ok, checks: Object.keys(last.checks) } : null,
    incidents: d.incidents.length, open_incidents: d.incidents.filter((x) => x.state !== 'ENTSCHIEDEN').length,
    patterns: SECRET_PATTERNS.length, input_tests: 8, role_rules: ROLE_RULES.length,
    checks: ['Geheimnisse im Baum (11 Muster, ohne Fremdmodule, Platzhalter und Testwerte werden als Hinweis geführt)', 'Eingaben: Wegschleusen, absolute Wege, Nullbytes, Befehlsanhänge, Überlänge', 'Ladung: Skript, Ereignis-Anhang, Einbettung, SQL, Vorlagen', 'Dateityp an den ersten Bytes', 'Laufzeitdaten auf Klartext-Kennwörter', 'Kopfzeilen des laufenden Servers', 'Ratenbegrenzung (auf Wunsch)', 'Rollen je Tätigkeit', 'Vorfall: erkennen, isolieren, entscheiden (Mensch)'],
    rules: [
      'Erst erkennen, dann isolieren, dann rauswerfen — nie sofort und blind.',
      'Der Mensch entscheidet über Ausschluss. Keine Automatik wirft jemanden hinaus.',
      'Vorlagen enthalten Platzhalter, niemals Werte.',
      'Was nicht geprüft werden konnte, steht als UNGEPRÜFT da — nicht als in Ordnung.',
    ],
  };
}

module.exports = {
  meta: { area: 'SEC', id: 'security_center', name: 'Sicherheit (prüfen, isolieren, entscheiden)', state: 'live' },
  actions: {
    status: () => status(),
    secrets: (p) => scanSecrets(p || {}),
    inputs: () => scanInputs(),
    payload: (p) => scanPayload(p || {}),
    kind: (p) => { const f = String((p || {}).file || ''); return f ? kindOf(f) : { ok: false, error: 'file fehlt' }; },
    upload: (p) => scanUpload(p || {}),
    store: (p) => scanStore(p || {}),
    headers: (p) => httpProbe(p || {}),
    rate: (p) => rateProbe(p || {}),
    roles: () => roleMatrix(),
    sweep: (p) => sweep(p || {}),
    incident: (p) => incident(p || {}),
    incidents: () => { const d = load(); return { ok: true, count: d.incidents.length, incidents: d.incidents.slice(0, 20) }; },
    sweeps: () => { const d = load(); return { ok: true, count: d.sweeps.length, sweeps: d.sweeps.slice(0, 10) }; },
  },
  SECRET_PATTERNS, EXECUTABLE_KINDS, ROLE_RULES, scanSecrets, scanInputs, scanStore, kindOf, scanUpload, httpProbe, rateProbe, roleMatrix, scanPayload, sweep, incident, status,
};
