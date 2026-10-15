'use strict';
// AURA — Daten-Upload für Link-Listen (Yellow Pages, API-Katalog).
//
// Ablauf: Vorschau (prüft, schreibt nichts) → Übernahme (nur mit Name, Token, Kill-Switch aus).
// Alles-oder-nichts: Gibt es auch nur einen abgelehnten Eintrag, wird nichts übernommen.
// Vor jeder Übernahme wird die alte Datei gesichert.
//
// Neue Quelle hinzufügen = einen Eintrag in KINDS. Mehr ist nicht nötig.
const fs = require('fs');
const path = require('path');
const store = require('./store');
const registry = require('./registry');
const creatorWatch = require('./creator_watch');

const MAX_BYTES = 1_000_000;
const MAX_ITEMS = 500;
const ROOT = path.join(__dirname, '..', '..', '..');
const BACKUPS = path.join(__dirname, '..', 'data', 'backups');

// Verbotene Inhalte (Regeln aus dem Projekt): Umgehung, Fremd-Mining, gekaufte Reichweite,
// Credential-Sammlung, Plattform-Umgehung. Treffer = Ablehnung, keine Ausnahme per Upload.
const FORBIDDEN = /captcha.?bypass|bypass.?captcha|faucet|crypto.?mining|cryptominer|botnet|socks5?.?(ban|evasion)|follower.?(kauf|buy|shop)|buy.?(followers|likes|views)|smm.?panel|fake.?(views|likes|followers)|token.?harvest|credential.?(harvest|dump)|account.?farm/i;

const isHttps = (u) => { try { return new URL(u).protocol === 'https:'; } catch { return false; } };
const isRoleLike = (name) => {
  const n = String(name || '').trim().toLowerCase();
  return /agent|bot|system/i.test(n) || registry.skills.roles().some((r) => r.id === n);
};

// ---------- Parser + Prüfung je Quelle ----------
function checkItem(it) {
  if (!it.name || it.name.length < 2 || it.name.length > 80) return 'name: 2–80 Zeichen';
  if (!isHttps(it.url)) return 'url: nur https erlaubt';
  if (!/^[\w.-]{1,40}$/.test(it.category)) return 'category: 1–40 Zeichen (a-z, 0-9, _ . -)';
  if ((it.desc || '').length > 300) return 'desc: höchstens 300 Zeichen';
  const hit = FORBIDDEN.exec(it.name + ' ' + (it.desc || '') + ' ' + it.url);
  if (hit) return 'verboten (' + hit[0] + '): Inhalt verstößt gegen die Projektregeln';
  return null;
}

function finish(kind, items, rejected, total) {
  const seen = new Set();
  const accepted = [];
  for (const it of items) {
    let key;
    try { const u = new URL(it.url); key = u.origin + u.pathname.replace(/\/$/, ''); } catch { key = it.url; }
    if (seen.has(key)) { rejected.push({ name: it.name, reason: 'doppelt in dieser Datei' }); continue; }
    seen.add(key);
    accepted.push(it);
  }
  return { kind, total, accepted, rejected };
}

function parseYellowpages(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { error: 'kein gültiges JSON: ' + e.message }; }
  const list = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.links) ? obj.links : null);
  if (!list) return { error: 'erwartet ein Array oder {"links": [...]}' };
  if (list.length > MAX_ITEMS) return { error: 'höchstens ' + MAX_ITEMS + ' Einträge pro Upload' };
  const items = [], rejected = [];
  list.forEach((raw, i) => {
    const it = {
      name: String(raw.name || '').trim(), url: String(raw.url || '').trim(),
      category: String(raw.category || 'uncategorized').trim(), desc: String(raw.desc || '').trim(),
    };
    const why = checkItem(it);
    if (why) rejected.push({ line: i + 1, name: it.name || '(ohne Name)', reason: why });
    else items.push(it);
  });
  return finish('yellowpages', items, rejected, list.length);
}

function parseApis(text) {
  const lines = String(text).split('\n');
  const items = [], rejected = [];
  let total = 0;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    total++;
    const [name = '', url = '', category = 'uncategorized'] = t.split('|').map((s) => s.trim());
    const it = { name, url, category: category || 'uncategorized', desc: '' };
    const why = checkItem(it);
    if (why) rejected.push({ line: i + 1, name: name || '(ohne Name)', reason: why });
    else items.push(it);
  });
  if (total > MAX_ITEMS) return { error: 'höchstens ' + MAX_ITEMS + ' Zeilen pro Upload' };
  return finish('apis', items, rejected, total);
}

// ---------- Quellen (Tabelle) ----------
const KINDS = {
  yellowpages: {
    label: 'Yellow Pages (Link-Liste, JSON)',
    file: path.join(__dirname, '..', '..', 'data', 'yellowpages.json'),
    parse: parseYellowpages,
    mode: 'merge', // neue URLs werden ergänzt, bekannte aktualisiert
  },
  creators: {
    label: 'Creator-Liste (JSON, Zeilen "Name | Link | Themen | bell" oder YouTube-Takeout-CSV)',
    file: creatorWatch.FILE,
    parse: (t) => creatorWatch.parseUpload(t, { checkItem }),
    mode: 'merge', // nach URL: bekannte aktualisiert, neue ergänzt
  },
  apis: {
    label: 'API-Katalog (ingest/apis.txt, Format: name | url | category)',
    file: path.join(ROOT, 'ingest', 'apis.txt'),
    parse: parseApis,
    mode: 'replace', // Datei wird durch die geprüfte Liste ersetzt (Backup vorher)
  },
};

function kindOrError(kind) {
  const k = KINDS[kind];
  return k ? { k } : { error: 'unbekannte Quelle "' + kind + '" (erlaubt: ' + Object.keys(KINDS).join(', ') + ')' };
}

function preview(kind, text) {
  const { k, error } = kindOrError(kind);
  if (error) return { ok: false, status: 400, error };
  if (Buffer.byteLength(String(text || ''), 'utf8') > MAX_BYTES) return { ok: false, status: 413, error: 'Datei größer als 1 MB' };
  const r = k.parse(String(text || ''));
  if (r.error) return { ok: false, status: 400, error: r.error };
  let added = 0, updated = 0;
  if (kind === 'yellowpages' && k.mode === 'merge') {
    const cur = JSON.parse(fs.readFileSync(k.file, 'utf8')).links || [];
    const known = new Set(cur.map((l) => l.url));
    for (const it of r.accepted) (known.has(it.url) ? updated++ : added++);
  }
  if (kind === 'creators') {
    const cur = creatorWatch.load().creators;
    const known = new Set(cur.map((c) => c.url));
    for (const it of r.accepted) (known.has(it.url) ? updated++ : added++);
  }
  return {
    ok: true, status: 200, kind, mode: k.mode,
    total: r.total, accepted: r.accepted.length, rejected: r.rejected.length,
    would_add: added, would_update: updated,
    can_commit: r.rejected.length === 0 && r.accepted.length > 0,
    rejected_items: r.rejected.slice(0, 100),
    note: r.rejected.length ? 'Alles-oder-nichts: Mit abgelehnten Einträgen wird nichts übernommen.' : 'Vorschau ok. Übernahme braucht Name und Admin-Token.',
  };
}

function backupFile(file, kind) {
  if (!fs.existsSync(file)) return null;
  fs.mkdirSync(BACKUPS, { recursive: true });
  const ext = path.extname(file) || '.txt';
  const dest = path.join(BACKUPS, kind + '.' + new Date().toISOString().replace(/[:.]/g, '-') + ext);
  fs.copyFileSync(file, dest);
  return dest;
}

function commit(kind, text, by) {
  const { k, error } = kindOrError(kind);
  if (error) return { ok: false, status: 400, error };
  const who = String(by || '').trim();
  if (who.length < 2 || who.length > 40) return { ok: false, status: 400, error: 'by: Name der freigebenden Person angeben' };
  if (isRoleLike(who)) return { ok: false, status: 403, error: 'Übernahme nur durch einen Menschen' };
  const pv = preview(kind, text);
  if (!pv.ok) return pv;
  if (!pv.can_commit) return { ok: false, status: 422, error: pv.note, rejected_items: pv.rejected_items };

  const parsed = k.parse(String(text));
  const backup = backupFile(k.file, kind);
  let added = 0, updated = 0;
  if (kind === 'yellowpages') {
    const cur = JSON.parse(fs.readFileSync(k.file, 'utf8'));
    const links = cur.links || [];
    const byUrl = new Map(links.map((l) => [l.url, l]));
    for (const it of parsed.accepted) {
      const ex = byUrl.get(it.url);
      if (ex) { Object.assign(ex, { name: it.name, category: it.category, desc: it.desc || ex.desc || '' }); updated++; }
      else { const n = { name: it.name, url: it.url, category: it.category, desc: it.desc || '' }; links.push(n); byUrl.set(it.url, n); added++; }
    }
    const next = { ...cur, links, updated_at: new Date().toISOString(), via: 'upload' };
    fs.writeFileSync(k.file + '.tmp', JSON.stringify(next, null, 2));
    fs.renameSync(k.file + '.tmp', k.file);
  } else if (kind === 'creators') {
    const res = creatorWatch.mergeAccepted(parsed.accepted);
    added = res.added; updated = res.updated;
  } else {
    const body = parsed.accepted.map((it) => [it.name, it.url, it.category].join(' | ')).join('\n');
    const header = '# AURA catalog ingestor input — public tool/API links\n# Format: name | url | category\n';
    fs.writeFileSync(k.file + '.tmp', header + body + '\n');
    fs.renameSync(k.file + '.tmp', k.file);
    added = parsed.accepted.length;
  }
  store.audit({ area: 'UPLOAD', event: 'upload_commit', kind, by: who, added, updated, backup: backup ? path.basename(backup) : null });
  return { ok: true, status: 200, kind, added, updated, backup: backup ? path.basename(backup) : null };
}

module.exports = {
  meta: { area: 'UPLOAD', id: 'data_upload', name: 'Daten-Upload (Link-Listen, geprüft)', state: 'live' },
  KINDS: () => Object.entries(KINDS).map(([id, k]) => ({ id, label: k.label, mode: k.mode })),
  preview, commit, FORBIDDEN,
};
