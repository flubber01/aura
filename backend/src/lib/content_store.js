'use strict';
// AURA · Inhalts-Speicher: für JEDE Sache, bei der Inhalt entsteht, einen ordentlichen Platz.
//
// Überall im OS entsteht Material: Songs (Songbook), Videos (Video-Abteilung), Texte (Kampagnen,
// Presse), Bilder (Augen/Kunstfigur), Ton-Spuren (Stems), Pläne. Bisher lag jedes Stück in seinem
// Modul. Hier kommen sie zusammen — mit:
//   • Versionen: jede Fassung bleibt erhalten, nichts wird überschrieben (Rückgriff möglich)
//   • Suche über Titel, Text, Marken und Art
//   • Ablage nach Datum (JJJJ/MM) und Art, damit ein Ordner nie 10 000 Dateien auf einmal hat
//   • Belegen: Woher kommt das Stück (Modul + ID), wer hat es erzeugt, ist es freigegeben?
//   • Sammelausgabe: ein Paket mit allem zu einem Projekt, als Datei-Manifest (JSON)
//   • Aufräum-Regel: Fristen, aber Löschen ist IMMER eine menschliche Entscheidung
//
// Ehrlichkeit: gespeichert wird, was da ist. Der Speicher erfindet keine Inhalte, er verwaltet sie.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.AURA_CONTENT_DIR || path.join(__dirname, '..', 'data', 'content');
const FILE = process.env.AURA_CONTENT_FILE || path.join(__dirname, '..', 'data', 'content_index.json');

const KINDS = ['SONG', 'STEM', 'VIDEO', 'BILD', 'TEXT', 'PRESSE', 'IDEE', 'PROTOKOLL', 'SONSTIG'];
const STATES = ['ENTWURF', 'IN_PRUEFUNG', 'FREIGEGEBEN', 'VEROEFFENTLICHT', 'ARCHIV'];

function defaults() { return { items: [], bundles: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['items', 'bundles', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

const human = (b) => { if (b === 0) return '0 B'; const u = ['B', 'KB', 'MB', 'GB']; const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024))); return `${Math.round((b / Math.pow(1024, i)) * 10) / 10} ${u[i]}`; };

// Ablagepfad: nach Jahr/Monat und Art — nicht alles in einen Topf.
function folderFor(kind, when) {
  const d = new Date(when || Date.now());
  return path.join(DIR, `${d.getUTCFullYear()}`, String(d.getUTCMonth() + 1).padStart(2, '0'), String(kind).toLowerCase());
}

// Inhalt anmelden. Ist eine Datei dabei, wird sie in die Ablage KOPIERT (Original bleibt unberührt).
function register(input) {
  const data = load();
  const p = input || {};
  const kind = String(p.kind || '').toUpperCase();
  const title = String(p.title || '').trim();
  if (!KINDS.includes(kind)) return { ok: false, error: `kind unbekannt. Erlaubt: ${KINDS.join(', ')}` };
  if (!title) return { ok: false, error: 'title fehlt' };
  const now = new Date().toISOString();
  const item = {
    id: 'cs-' + crypto.randomBytes(4).toString('hex'),
    kind, title: title.slice(0, 160),
    body: p.body ? String(p.body).slice(0, 100000) : null,
    tags: (Array.isArray(p.tags) ? p.tags : []).map((t) => String(t).toLowerCase().slice(0, 30)).slice(0, 12),
    source: { module: String(p.source_module || p.module || 'unbekannt'), ref: p.source_ref || p.ref || null },
    artist: p.artist || null, project: p.project || null,
    created_by: String(p.by || 'AURA'), created_at: now,
    state: STATES.includes(String(p.state || '').toUpperCase()) ? String(p.state).toUpperCase() : 'ENTWURF',
    versions: [], files: [], bytes: 0,
  };
  if (p.file && fs.existsSync(p.file)) {
    try {
      const buf = fs.readFileSync(p.file);
      const destDir = folderFor(kind, now);
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, `${item.id}${path.extname(p.file) || ''}`);
      fs.writeFileSync(dest, buf);
      item.files.push({ role: String(p.role || 'haupt'), path: dest, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) });
      item.bytes += buf.length;
    } catch (e) { item.files_error = 'Datei konnte nicht abgelegt werden: ' + e.message; }
  }
  item.versions.push({ v: 1, at: now, by: item.created_by, note: 'angelegt' });
  data.items.unshift(item); data.items = data.items.slice(0, 5000);
  data.audit.unshift({ at: now, action: 'register', id: item.id, kind });
  save(data);
  return { ok: true, item: { id: item.id, kind: item.kind, title: item.title, folder: folderFor(kind, now), files: item.files.length, bytes: item.bytes }, where: folderFor(kind, now) };
}

function get(id) {
  const item = load().items.find((x) => x.id === id);
  return item ? { ok: true, item } : { ok: false, error: 'Eintrag nicht gefunden' };
}

// Neue Fassung: nichts wird überschrieben.
function version(id, input) {
  const data = load();
  const item = data.items.find((x) => x.id === id);
  if (!item) return { ok: false, error: 'Eintrag nicht gefunden' };
  const p = input || {};
  if (p.file && fs.existsSync(p.file)) {
    try {
      const buf = fs.readFileSync(p.file);
      const destDir = folderFor(item.kind, new Date().toISOString());
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, `${item.id}-v${item.versions.length + 1}${path.extname(p.file) || ''}`);
      fs.writeFileSync(dest, buf);
      item.files.push({ role: String(p.role || 'haupt'), path: dest, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16), v: item.versions.length + 1 });
      item.bytes += buf.length;
    } catch (e) { return { ok: false, error: 'Datei nicht ablegbar: ' + e.message }; }
  }
  if (p.body !== undefined) item.body = String(p.body).slice(0, 100000);
  const v = { v: item.versions.length + 1, at: new Date().toISOString(), by: String(p.by || 'AURA'), note: String(p.note || 'neue Fassung').slice(0, 300) };
  item.versions.push(v);
  data.audit.unshift({ at: v.at, action: 'version', id, v: v.v });
  save(data);
  return { ok: true, item: { id: item.id, versions: item.versions.length, files: item.files.length }, version: v };
}

function setState(id, state, payload) {
  const data = load();
  const item = data.items.find((x) => x.id === id);
  if (!item) return { ok: false, error: 'Eintrag nicht gefunden' };
  const s = String(state || '').toUpperCase();
  if (!STATES.includes(s)) return { ok: false, error: `Zustand unbekannt. Erlaubt: ${STATES.join(', ')}` };
  // Veröffentlichen ist eine menschliche Entscheidung — hier wird nur die Regel durchgesetzt.
  if (s === 'VEROEFFENTLICHT' && !(payload && payload.human)) {
    return { ok: false, error: 'Veröffentlichen braucht einen Menschen (human: true)', needs: 'human', tip: 'Freigabe-Tür: POST /api/human/propose {kind:"PUBLISH"}' };
  }
  const alt = item.state;
  item.state = s;
  item.state_history = [...(item.state_history || []), { from: alt, to: s, at: new Date().toISOString(), by: String((payload && payload.by) || 'AURA') }];
  data.audit.unshift({ at: new Date().toISOString(), action: 'state', id, from: alt, to: s });
  save(data);
  return { ok: true, item: { id: item.id, state: item.state }, from: alt };
}

function search(filter) {
  const data = load();
  const f = filter || {};
  let items = data.items;
  if (f.kind) items = items.filter((i) => i.kind === String(f.kind).toUpperCase());
  if (f.state) items = items.filter((i) => i.state === String(f.state).toUpperCase());
  if (f.artist) items = items.filter((i) => i.artist === f.artist);
  if (f.tag) items = items.filter((i) => i.tags.includes(String(f.tag).toLowerCase()));
  if (f.q) {
    const q = String(f.q).toLowerCase();
    items = items.filter((i) => (i.title + ' ' + (i.body || '') + ' ' + i.tags.join(' ')).toLowerCase().includes(q));
  }
  return {
    ok: true, count: items.length,
    items: items.slice(0, Number(f.limit) || 50).map((i) => ({ id: i.id, kind: i.kind, title: i.title, state: i.state, tags: i.tags, versions: i.versions.length, files: i.files.length, bytes: i.bytes, at: i.created_at, source: i.source })),
    kinds: KINDS, states: STATES,
  };
}

// Sammelausgabe: alles zu einem Projekt in einem Manifest (mit Prüfsummen — so ist es nachprüfbar).
function bundle(input) {
  const data = load();
  const p = input || {};
  const items = data.items.filter((i) => (p.project ? i.project === p.project : false) || (p.ids ? p.ids.includes(i.id) : false));
  if (!items.length) return { ok: false, error: 'keine Einträge für dieses Paket (project oder ids angeben)' };
  const manifest = {
    created_at: new Date().toISOString(), project: p.project || null, title: String(p.title || p.project || 'Sammelausgabe'),
    count: items.length, total_bytes: items.reduce((a, i) => a + i.bytes, 0),
    items: items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, state: i.state, versions: i.versions.length, tags: i.tags, source: i.source, files: i.files.map((f) => ({ role: f.role, bytes: f.bytes, sha256: f.sha256, v: f.v || 1 })) })),
  };
  manifest.manifest_sha256 = crypto.createHash('sha256').update(JSON.stringify(manifest.items)).digest('hex');
  const dir = folderFor('SONSTIG', manifest.created_at);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `paket-${Date.now()}.json`);
  try { fs.writeFileSync(file, JSON.stringify(manifest, null, 2)); } catch (e) { return { ok: false, error: 'Manifest nicht schreibbar: ' + e.message }; }
  const entry = { id: 'bun-' + crypto.randomBytes(4).toString('hex'), file, count: items.length, bytes: manifest.total_bytes, at: manifest.created_at };
  data.bundles.unshift(entry); data.bundles = data.bundles.slice(0, 200);
  save(data);
  return { ok: true, bundle: entry, manifest };
}

// Aufräumen: was ist alt? Gelöscht wird NICHTS automatisch.
function retention() {
  const data = load();
  const now = Date.now();
  const old = data.items.filter((i) => i.state === 'ENTWURF' && (now - new Date(i.created_at).getTime()) > 90 * 86400000);
  return {
    ok: true, candidates: old.length,
    items: old.slice(0, 50).map((i) => ({ id: i.id, title: i.title, kind: i.kind, at: i.created_at, bytes: i.bytes })),
    rule: 'Vorschlagen ja, löschen nein. Löschen ist eine menschliche Entscheidung (Freigabe-Tür, kind DELETE).',
  };
}

function status() {
  const d = load();
  const byKind = {}; const byState = {};
  for (const i of d.items) { byKind[i.kind] = (byKind[i.kind] || 0) + 1; byState[i.state] = (byState[i.state] || 0) + 1; }
  const bytes = d.items.reduce((a, i) => a + i.bytes, 0);
  return {
    area: 'STORE', module: 'content_store', state: 'live', dir: DIR, file: FILE,
    items: d.items.length, bytes, bytes_human: human(bytes), by_kind: byKind, by_state: byState, bundles: d.bundles.length,
    kinds: KINDS, states: STATES,
    rules: ['Nichts wird überschrieben: jede Fassung bleibt.', 'Ablage nach Jahr/Monat/Art, damit kein Ordner überläuft.', 'Prüfsummen machen jede Fassung nachprüfbar.', 'Löschen ist immer eine menschliche Entscheidung.'],
  };
}

module.exports = {
  meta: { area: 'STORE', id: 'content_store', name: 'Inhalts-Speicher (Fassungen, Suche, Sammelausgabe)', state: 'live' },
  actions: { status: () => status(), kinds: () => ({ ok: true, kinds: KINDS, states: STATES }), register: (p) => register(p || {}), get: (p) => get((p || {}).id), version: (p) => version((p || {}).id, p || {}), state: (p) => setState((p || {}).id, (p || {}).state, p || {}), search: (p) => search(p || {}), bundle: (p) => bundle(p || {}), bundles: () => ({ ok: true, bundles: load().bundles }), retention: () => retention() },
  KINDS, STATES, register, get, version, setState, search, bundle, retention, status, folderFor,
};
