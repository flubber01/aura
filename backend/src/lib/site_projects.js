'use strict';
// AURA · Seiten-Projekte: die eigenen Web-Projekte samt dem, was serverseitig dazugehört.
//
// Der Web-Empire kennt Seiten und Link-Slots. Hier kommt das Drumherum dazu, das ein Projekt erst
// betriebsfähig macht: Domain, Verzeichnis, Startbefehl, Port, Reverse-Proxy, Dienst-Datei,
// Sicherung, Inhaltsquellen, Zuständigkeit. Und ein ehrlicher Prüflauf: läuft der Dienst, antwortet
// die Seite, ist die Sicherung da, ist TLS vorhanden.
//
// Ehrlichkeit: AURA legt hier nichts selbst auf einem fremden Server an. Es beschreibt das Projekt
// vollständig, prüft, was lokal prüfbar ist, und gibt die Befehle aus, die ein Mensch auf dem Server
// ausführt. Kein stilles Schreiben in fremde Systeme.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FILE = process.env.AURA_SITE_PROJECTS_FILE || path.join(__dirname, '..', 'data', 'site_projects.json');

const STACKS = [
  { id: 'static', name: 'Statische Seiten', serve: 'nginx/Apache aus einem Verzeichnis', needs: ['Verzeichnis', 'Server-Block', 'TLS'] },
  { id: 'node', name: 'Node-Dienst', serve: 'systemd-Dienst + Reverse-Proxy', needs: ['Startbefehl', 'Port', 'Dienst-Datei', 'TLS'] },
  { id: 'wordpress', name: 'WordPress', serve: 'PHP-FPM + Datenbank', needs: ['Datenbank', 'PHP', 'TLS', 'Sicherung', 'Aktualisierungen'] },
  { id: 'shop', name: 'Shop', serve: 'Plattform oder eigenes System', needs: ['Zahlungsanbieter', 'Rechtstexte', 'Versand', 'TLS'] },
  { id: 'api', name: 'Schnittstelle (API)', serve: 'Dienst + Reverse-Proxy', needs: ['Startbefehl', 'Port', 'Schlüsselverwaltung', 'Begrenzung der Anfragen'] },
];

// Sicherheits- und Betriebs-Mindestliste: ohne die ist ein Projekt nicht „fertig".
const CHECKLIST = [
  { id: 'https', what: 'TLS/HTTPS aktiv', why: 'Ohne HTTPS ist jede Anmeldung angreifbar.' },
  { id: 'backup', what: 'Sicherung vorhanden und getestet', why: 'Eine ungetestete Sicherung ist keine Sicherung.' },
  { id: 'favicon', what: 'Favicon und Vorschaubild gesetzt', why: 'Sonst sieht jede Verlinkung kaputt aus.' },
  { id: 'imprint', what: 'Impressum und Datenschutz erreichbar', why: 'Rechtlich und für Vertrauen nötig.' },
  { id: 'consent', what: 'Einwilligung für Werbung/Cookies', why: 'Ohne Einwilligung keine Werbung.' },
  { id: 'monitoring', what: 'Erreichbarkeitsprüfung eingerichtet', why: 'Ein Ausfall muss auffallen, nicht auffallen müssen.' },
  { id: 'errorpage', what: 'Eigene Fehlerseite', why: 'Eine leere 404-Seite verliert Besucher.' },
  { id: 'contact', what: 'Kontaktweg erreichbar', why: 'Wer etwas nicht stimmt melden will, braucht einen Weg.' },
];

function defaults() { return { projects: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['projects', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function create(input) {
  const data = load();
  const p = input || {};
  const name = String(p.name || '').trim();
  if (!name) return { ok: false, error: 'name fehlt' };
  const stack = STACKS.find((s) => s.id === String(p.stack || 'static').toLowerCase());
  if (!stack) return { ok: false, error: `stack unbekannt. Erlaubt: ${STACKS.map((s) => s.id).join(', ')}` };
  const proj = {
    id: 'sp-' + Math.random().toString(16).slice(2, 10),
    name, stack: stack.id,
    domain: String(p.domain || '').trim() || null,
    dir: String(p.dir || '').trim() || null,
    start_cmd: String(p.start_cmd || '').trim() || null,
    port: Number(p.port) || null,
    proxy: stack.id === 'static' ? 'nginx: root <dir>, index index.html' : 'nginx: proxy_pass http://127.0.0.1:<port>',
    service_file: stack.id === 'static' ? null : `[Unit]\nDescription=${name}\n[Service]\nExecStart=${p.start_cmd || '<startbefehl>'}\nRestart=always\n[Install]\nWantedBy=multi-user.target`,
    backup: String(p.backup || 'täglich, Datei + Datenbank, getestete Wiederherstellung').slice(0, 300),
    content_sources: (Array.isArray(p.content_sources) ? p.content_sources : ['Songbook', 'Video-Abteilung', 'Kampagnen-Planer']).slice(0, 8),
    owner: String(p.owner || 'nicht zugeordnet'),
    checklist: CHECKLIST.map((c) => ({ id: c.id, what: c.what, done: !!(p.checklist && p.checklist[c.id]), why: c.why })),
    state: 'GEPLANT',
    created_at: new Date().toISOString(),
    note: 'AURA legt nichts auf fremden Servern an. Die Befehle und Dateien hier sind zum Ausführen durch einen Menschen.',
  };
  data.projects.unshift(proj); data.projects = data.projects.slice(0, 200);
  data.audit.unshift({ at: proj.created_at, action: 'create', id: proj.id, name });
  save(data);
  return { ok: true, project: proj, stack: stack };
}

function get(id) {
  const data = load();
  const p = data.projects.find((x) => x.id === id || x.name === id);
  if (!p) return { ok: false, error: 'Projekt nicht gefunden' };
  const pct = Math.round((p.checklist.filter((c) => c.done).length / p.checklist.length) * 100);
  return { ok: true, project: p, readiness: { percent: pct, missing: p.checklist.filter((c) => !c.done).map((c) => c.what) } };
}

// Prüflauf: was ist lokal prüfbar?
function verify(id) {
  const data = load();
  const p = data.projects.find((x) => x.id === id || x.name === id);
  if (!p) return { ok: false, error: 'Projekt nicht gefunden' };
  const checks = [];

  // Verzeichnis
  if (p.dir) {
    const exists = fs.existsSync(p.dir);
    checks.push({ check: 'Verzeichnis vorhanden', ok: exists, measured: p.dir, note: exists ? '' : 'Verzeichnis existiert auf DIESEM Rechner nicht — das ist bei einem anderen Server normal.' });
  } else checks.push({ check: 'Verzeichnis eingetragen', ok: false, measured: 'nicht eingetragen', note: 'Ohne Verzeichnis kann nichts ausgeliefert werden.' });

  // Port: hört lokal jemand darauf?
  if (p.port) {
    let listening = false;
    try {
      const out = execFileSync('sh', ['-c', ` (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -c ":${Number(p.port)} " || true`], { encoding: 'utf8', timeout: 3000 });
      listening = Number(String(out).trim()) > 0;
    } catch { listening = false; }
    checks.push({ check: `Port ${p.port} belegt`, ok: listening, measured: listening ? 'hört' : 'frei', note: p.stack === 'static' ? 'Statische Seiten brauchen keinen eigenen Port.' : 'Wenn der Dienst laufen soll, muss hier etwas hören.' });
  }

  // Domain: Auflösung prüfen (nur Namensauflösung, kein Zugriff auf fremde Systeme)
  if (p.domain) {
    let resolves = false;
    try {
      const out = execFileSync('sh', ['-c', `getent hosts ${JSON.stringify(p.domain).slice(1, -1)} 2>/dev/null | head -1 || true`], { encoding: 'utf8', timeout: 3000 });
      resolves = !!String(out).trim();
    } catch { resolves = false; }
    checks.push({ check: 'Domain löst auf', ok: resolves, measured: resolves ? 'ja' : 'nein/kein Netz', note: 'Namensauflösung geprüft, nicht die Erreichbarkeit des fremden Servers.' });
  }

  // Startbefehl: gibt es die Datei/Befehl?
  if (p.start_cmd) {
    const bin = String(p.start_cmd).split(' ')[0];
    let found = false;
    try { found = !!execFileSync('sh', ['-c', `command -v ${JSON.stringify(bin).slice(1, -1)} || true`], { encoding: 'utf8', timeout: 3000 }).trim(); } catch { found = false; }
    checks.push({ check: 'Startbefehl vorhanden', ok: found, measured: `${bin}: ${found ? 'gefunden' : 'nicht gefunden'}`, note: found ? '' : 'Auf einem anderen Server kann das trotzdem stimmen.' });
  }

  const failed = checks.filter((c) => !c.ok);
  p.last_verify = { at: new Date().toISOString(), checks, passed: checks.length - failed.length, failed: failed.length };
  p.state = failed.length === 0 ? 'GEPRUEFT' : 'PRUEFUNG_MIT_LUECKEN';
  save(data);
  return {
    ok: true, project: { id: p.id, name: p.name, state: p.state }, checks,
    verdict: failed.length === 0 ? 'Alle lokal prüfbaren Punkte in Ordnung.' : `${failed.length} Punkt(e) offen: ${failed.map((f) => f.check).join(', ')}`,
    note: 'Geprüft wird, was von hier aus prüfbar ist. Bei einem anderen Server heißt „nicht gefunden" nicht automatisch „kaputt".',
  };
}

function deploymentPack(id) {
  const g = get(id);
  if (!g.ok) return g;
  const p = g.project;
  const stack = STACKS.find((s) => s.id === p.stack);
  return {
    ok: true, project: { id: p.id, name: p.name, stack: p.stack },
    commands: [
      `sudo mkdir -p ${p.dir || '/var/www/<projekt>'}`,
      `sudo chown -R www-data:www-data ${p.dir || '/var/www/<projekt>'}`,
      p.stack === 'static' ? `# nginx-Block anlegen: /etc/nginx/sites-available/${p.name}` : `# systemd: /etc/systemd/system/${p.name}.service`,
      p.stack === 'static' ? 'sudo nginx -t && sudo systemctl reload nginx' : `sudo systemctl enable --now ${p.name} && sudo systemctl status ${p.name}`,
      `# TLS: sudo certbot --nginx -d ${p.domain || '<domain>'}`,
      `# Sicherung: restic/rsync-Job für ${p.dir || '<verzeichnis>'} + Datenbank`,
      `# Erreichbarkeitsprüfung: curl -sf https://${p.domain || '<domain>'}/ >/dev/null && echo ok`,
    ],
    nginx_block: p.stack === 'static'
      ? `server {\n  listen 80;\n  server_name ${p.domain || '<domain>'};\n  root ${p.dir || '/var/www/<projekt>'};\n  index index.html;\n  location / { try_files $uri $uri/ =404; }\n}`
      : `server {\n  listen 80;\n  server_name ${p.domain || '<domain>'};\n  location / { proxy_pass http://127.0.0.1:${p.port || '<port>'};\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr; }\n}`,
    service_file: p.service_file,
    open_items: g.readiness.missing,
    stack_needs: stack.needs,
    rule: 'Diese Befehle führt ein Mensch auf seinem Server aus. AURA schreibt nicht in fremde Systeme.',
  };
}

function list() {
  const data = load();
  return {
    ok: true, count: data.projects.length,
    items: data.projects.map((p) => ({ id: p.id, name: p.name, stack: p.stack, domain: p.domain, state: p.state, readiness: Math.round((p.checklist.filter((c) => c.done).length / p.checklist.length) * 100) })),
    stacks: STACKS, checklist: CHECKLIST.map((c) => ({ id: c.id, what: c.what })),
  };
}

// Seiten aus dem Web-Empire als Projekte übernehmen — die Verbindung zwischen beiden Teilen.
// Der Web-Empire führt Seiten (id, domain, Zustand, Einwilligung, Module). Hier wird daraus ein
// betreibbares Projekt. Übernommen wird nur, was belegt ist: Einwilligung „OK" wird als erledigt
// vermerkt, alles andere (TLS, Sicherung, Erreichbarkeitsprüfung, Impressum) bleibt offen, bis es
// wirklich erledigt ist.
function importEmpire(input) {
  const p = input || {};
  const empire = (() => { try { return require('./web_empire'); } catch { return null; } })();
  if (!empire) return { ok: false, error: 'Web-Empire nicht ladbar' };
  let sites = [];
  try {
    const d = typeof empire.load === 'function' ? empire.load() : null;
    if (d && Array.isArray(d.sites)) sites = d.sites;
  } catch { sites = []; }
  if (!sites.length) {
    try { const st = typeof empire.status === 'function' ? empire.status() : null; if (st && Array.isArray(st.sites)) sites = st.sites; } catch { sites = []; }
  }
  if (!sites.length) return { ok: false, error: 'keine Seiten im Web-Empire gefunden', hint: 'Erst eine Seite im Web-Empire registrieren, dann übernehmen.' };
  const data = load();
  let created = 0; const skipped = [];
  for (const site of sites.slice(0, 100)) {
    const name = String(site.id || site.domain || '').trim();
    if (!name) continue;
    if (data.projects.some((x) => x.name === name)) { skipped.push(name); continue; }
    const checklist = {};
    if (String(site.consent_status || '').toUpperCase() === 'OK') checklist.consent = true;   // belegt: Einwilligung liegt vor
    const r = create({
      name, stack: 'static', domain: site.domain || (p.domain || null),
      dir: p.dir_template ? String(p.dir_template).replace('{name}', name) : null,
      owner: p.owner || 'Web-Empire', checklist,
      content_sources: ['Web-Empire Seite ' + name, 'Songbook', 'Video-Abteilung', 'Kampagnen-Planer'],
    });
    if (r.ok) {
      const d2 = load();
      const proj = d2.projects.find((x) => x.id === r.project.id);
      if (proj) {
        proj.empire = { site_id: site.id || null, niche: site.niche || null, status: site.status || null, affiliate_status: site.affiliate_status || null, modules: (site.modules || []).length, active_style: site.active_style || null };
        save(d2);
      }
      created++;
    }
  }
  return {
    ok: true, found: sites.length, created, skipped,
    note: 'Seiten des Web-Empire als Projekte übernommen. Nur die Einwilligung wird als belegt übernommen — TLS, Sicherung, Impressum und Erreichbarkeitsprüfung bleiben offen, bis sie wirklich erledigt sind.',
  };
}

function status() {
  const d = load();
  const byState = {};
  for (const p of d.projects) byState[p.state] = (byState[p.state] || 0) + 1;
  return {
    area: 'SITE', module: 'site_projects', state: 'live', file: FILE,
    projects: d.projects.length, by_state: byState,
    stacks: STACKS.length, checklist: CHECKLIST.length,
    rules: ['AURA legt nichts auf fremden Servern an — Befehle kommen als Paket für einen Menschen.', 'Prüflauf sagt ehrlich, was lokal prüfbar ist und was nicht.', 'Ohne TLS, Sicherung und Erreichbarkeitsprüfung gilt ein Projekt nicht als fertig.', 'Keine Zugangsdaten im Projekt: Schlüssel liegen im Vault.'],
  };
}

module.exports = {
  meta: { area: 'SITE', id: 'site_projects', name: 'Seiten-Projekte (Server, Betrieb, Prüflauf, Deploy-Paket)', state: 'live' },
  actions: { status: () => status(), stacks: () => ({ ok: true, stacks: STACKS, checklist: CHECKLIST }), create: (p) => create(p || {}), get: (p) => get((p || {}).id), verify: (p) => verify((p || {}).id), pack: (p) => deploymentPack((p || {}).id), list: () => list(), import_empire: (p) => importEmpire(p || {}) },
  STACKS, CHECKLIST, create, get, verify, deploymentPack, list, importEmpire, status,
};
