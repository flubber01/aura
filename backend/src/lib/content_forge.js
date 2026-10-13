'use strict';
// AURA Area 73 — Content Forge: content automation via MINION workers.
//
// Builds on the hierarchy (63 role-minions), the WF presets (WF-1/6/7/9) and
// Area 60 schedule. Minions AUTO-CREATE and AUTO-MODIFY content through
// pipeline steps; AUTO-POST is hard-gated: nothing is published without
// explicit human approval, and publishing to external platforms needs an
// official-API adapter with credentials (NOT-CONNECTED here, honestly).
// Synthetic engagement / stealth posting is refused with 403 by policy.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'content_forge.json');
const ITEM_CAP = 200, LEDGER_CAP = 200;

const CONTENT_TYPES = ['article', 'story', 'social_draft', 'image_brief', 'script', 'newsletter'];
// publishing channels: only official/owned channels exist; every external one
// is NOT-CONNECTED until an official-API adapter with credentials is added.
const CHANNELS = [
  { id: 'aura-ledger', name: 'AURA internes Archiv', kind: 'internal', state: 'LIVE' },
  { id: 'wordpress', name: 'WordPress (REST)', kind: 'official-api', state: 'NOT-CONNECTED', note: 'Area 14 — offizielle REST-API, benötigt eigene Zugangsdaten' },
  { id: 'mastodon', name: 'Mastodon (official API)', kind: 'official-api', state: 'NOT-CONNECTED', note: 'offizielle API + App-Token nötig' },
  { id: 'youtube', name: 'YouTube (official API)', kind: 'official-api', state: 'NOT-CONNECTED', note: 'Google OAuth + Quota nötig' },
];
// policy block: any channel resembling engagement automation is refused
const FORBIDDEN_CHANNEL = /(bot|fake|stealth|spam|mass|follow|like|view|sub4sub|engagement)/i;

const PIPELINES = {
  create: ['research_minion: brief zerlegen + Faktenlage', 'writer_minion: Rohfassung', 'editor_minion: Stil + Klarheit', 'qa_minion: Fakten-/Sicherheitscheck', 'gate: menschliche Freigabe'],
  modify: ['editor_minion: Änderung anwenden', 'qa_minion: Integritätscheck', 'gate: menschliche Freigabe'],
  post: ['compliance_minion: Richtlinien-Check', 'operator_minion: offizieller Kanal-Adapter', 'ledger: Audit-Eintrag'],
};

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { items: [], routines: [], ledger: [] }; }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE);
}
function lazy(name) { return require('./' + name); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(3).toString('hex'); }
function now() { return new Date().toISOString(); }

// ---------- deterministic local draft engine (honest: no LLM connected) ----
function minionFor(step) {
  try {
    const nodes = lazy('hierarchy').tree();
    const hit = nodes.find((n) => n.tier === 3 && n.id.includes(step.split('_')[0]));
    return hit ? hit.id : 'minion_writer';
  } catch { return 'minion_' + step; }
}
function draftFromBrief(brief, type) {
  const topic = String(brief || '').trim().slice(0, 200) || 'unbenanntes Thema';
  const stamp = now();
  const bodies = {
    article: `# ${topic}\n\nEinleitung: Dieser Text ist ein AUTO-DRAFT der AURA Content Forge (lokale Vorlagen-Engine, kein externes LLM verbunden). Abschnitt 1 ordnet das Thema ein, Abschnitt 2 liefert Kernpunkte, Abschnitt 3 fasst zusammen.\n\n## Kernpunkte\n- Punkt 1 zu „${topic}“\n- Punkt 2: Einordnung & Kontext\n- Punkt 3: Nächste Schritte\n\n## Fazit\nRedaktionelle Endprüfung durch einen Menschen erforderlich (Gate WF-7).`,
    story: `Es war einmal ein Team, das „${topic}“ verstehen wollte. Mit jedem Versuch lernten die kleinen Helfer mehr — und am Ende wussten sie: Ehrlichkeit macht jede Geschichte stärker.\n\n(AUTO-DRAFT · kindgerechte Vorlage · Area 08 Filter aktiv · menschliche Prüfung nötig)`,
    social_draft: `Entwurf für einen Beitrag über „${topic}“.\n\nHook: Warum „${topic}“ gerade wichtig ist.\nKern: 3 klare Aussagen statt Hype.\nCTA: Lesen, prüfen, entscheiden.\n\n(AUTO-DRAFT · Veröffentlichung NUR nach menschlicher Freigabe über offizielle APIs — kein synthetisches Engagement)`,
    image_brief: `Bild-Briefing zu „${topic}“: Motiv, Stimmung (neon/dunkel), Komposition, Details. Übergabe an Area 71 Gateway (ComfyUI/WebUI oder SIMULATION).\n\n(AUTO-DRAFT · Generierung erbt die Ehrlichkeits-Labels von Area 71)`,
    script: `SKRIPT — ${topic}\n[INTRO] 10s: Hook.\n[TEIL 1] 30s: Problem & Kontext.\n[TEIL 2] 40s: Lösung in 3 Schritten.\n[OUTRO] 10s: Zusammenfassung + CTA.\n\n(AUTO-DRAFT · menschliche Freigabe nötig)`,
    newsletter: `Newsletter-Entwurf zu „${topic}“: Betreff-Vorschlag, 3 Absätze, ein Link-Block, Abmeldehinweis (Pflicht). \n\n(AUTO-DRAFT · Versand nur nach Freigabe + Double-Opt-in-Empfängerliste)`,
  };
  return bodies[type] || bodies.article;
}

// ---------- item operations ----------
function create(input = {}) {
  const type = CONTENT_TYPES.includes(input.type) ? input.type : 'article';
  const brief = String(input.brief || '').trim().slice(0, 500);
  if (!brief) { const e = new Error('brief fehlt'); e.code = 400; throw e; }
  if (type === 'story') {
    const bad = lazy('kids_story').safetyCheck(brief);
    if (!bad.ok) { const e = new Error('Area-08-Kinderschutzfilter: ' + bad.reason); e.code = 400; throw e; }
  }
  const db = load();
  const item = {
    id: id('ct'), type, brief, title: brief.slice(0, 80),
    body: draftFromBrief(brief, type),
    status: 'draft', labels: ['AUTO-DRAFT', 'LOCAL-TEMPLATE-ENGINE'],
    pipeline: PIPELINES.create, workers: PIPELINES.create.slice(0, 4).map((s) => minionFor(s)),
    versions: [], createdBy: 'forge/auto', createdAt: now(), updatedAt: now(),
    workflow_ref: type === 'story' ? 'WF-1' : type === 'image_brief' ? 'WF-9' : 'WF-7',
  };
  db.items.unshift(item);
  if (db.items.length > ITEM_CAP) db.items.length = ITEM_CAP;
  db.ledger.unshift({ at: now(), event: 'created', item: item.id, by: 'forge/auto' });
  save(db);
  return item;
}

function modify(itemId, instruction) {
  const ins = String(instruction || '').trim().slice(0, 300);
  if (!ins) { const e = new Error('instruction fehlt'); e.code = 400; throw e; }
  const db = load();
  const it = db.items.find((x) => x.id === itemId);
  if (!it) { const e = new Error('unknown content item'); e.code = 404; throw e; }
  it.versions.push({ at: now(), instruction: ins, body_before: it.body.slice(0, 4000) });
  const mode = /^(kürz|kurz|summar|tl;?dr)/i.test(ins) ? 'summarize' : /^(titel|headline|überschrift)/i.test(ins) ? 'retitle' : /^(umformul|rewrite|neu schreiben)/i.test(ins) ? 'rewrite' : 'annotate';
  if (mode === 'summarize') it.body = it.body.split('\n').slice(0, 4).join('\n') + '\n\n[Gekürzt per Auto-Modify: ' + ins + ']';
  else if (mode === 'retitle') it.title = ins.replace(/^(titel|headline|überschrift)[:\s-]*/i, '').slice(0, 80);
  else if (mode === 'rewrite') it.body = it.body + '\n\n[Auto-Rewrite angestoßen: ' + ins + ' — lokale Engine, Details durch menschliche Redaktion]';
  else it.body = it.body + '\n\n[Auto-Modify: ' + ins + ']';
  it.status = 'draft'; // jede Änderung fällt ins Review-Gate zurück
  it.updatedAt = now();
  if (!it.labels.includes('AUTO-MODIFIED')) it.labels.push('AUTO-MODIFIED');
  db.ledger.unshift({ at: now(), event: 'modified', item: it.id, instruction: ins });
  if (db.ledger.length > LEDGER_CAP) db.ledger.length = LEDGER_CAP;
  save(db);
  return it;
}

function approve(itemId, decision) {
  const db = load();
  const it = db.items.find((x) => x.id === itemId);
  if (!it) { const e = new Error('unknown content item'); e.code = 404; throw e; }
  it.status = decision === 'reject' ? 'rejected' : 'approved';
  it.updatedAt = now();
  db.ledger.unshift({ at: now(), event: decision === 'reject' ? 'rejected' : 'approved', item: it.id, by: 'human' });
  save(db);
  return it;
}

function post(itemId, channelId) {
  const db = load();
  const it = db.items.find((x) => x.id === itemId);
  if (!it) { const e = new Error('unknown content item'); e.code = 404; throw e; }
  if (FORBIDDEN_CHANNEL.test(String(channelId))) {
    const e = new Error('BLOCKED BY POLICY: Engagement-Automatisierung/Stealth-Kanäle sind dauerhaft verboten (403)'); e.code = 403; throw e;
  }
  if (it.status !== 'approved' && it.status !== 'queued') {
    const e = new Error('HUMAN GATE: Content muss zuerst von einem Menschen freigegeben werden (approve) — kein Auto-Post ohne Freigabe'); e.code = 403; throw e;
  }
  const ch = CHANNELS.find((c) => c.id === channelId);
  if (!ch) { const e = new Error('unknown channel; verfügbar: ' + CHANNELS.map((c) => c.id).join(', ')); e.code = 404; throw e; }
  if (ch.state !== 'LIVE') {
    db.ledger.unshift({ at: now(), event: 'post_blocked', item: it.id, channel: ch.id, reason: ch.state });
    save(db);
    const e = new Error('ehrlicher Status: Kanal ' + ch.id + ' ist ' + ch.state + ' — ' + (ch.note || 'offizielle API + Zugangsdaten nötig')); e.code = 502; throw e;
  }
  it.status = 'published'; it.publishedTo = ch.id; it.updatedAt = now();
  db.ledger.unshift({ at: now(), event: 'published', item: it.id, channel: ch.id, by: 'human-approved' });
  save(db);
  return it;
}

// ---------- routines (recurring auto-create/auto-modify — NEVER auto-post) --
function addRoutine(input = {}) {
  const brief = String(input.brief || '').trim().slice(0, 400);
  if (!brief) { const e = new Error('brief fehlt'); e.code = 400; throw e; }
  const intervalMin = Math.max(5, Math.min(43200, Number(input.interval_min) || 1440));
  const db = load();
  if (db.routines.length >= 24) { const e = new Error('max 24 Routinen'); e.code = 409; throw e; }
  const r = {
    id: id('rt'), name: String(input.name || brief.slice(0, 60)).slice(0, 80),
    type: CONTENT_TYPES.includes(input.type) ? input.type : 'article',
    brief, interval_min: intervalMin, enabled: true,
    action: input.action === 'modify' ? 'modify' : 'create', // Routinen erzeugen/ändern NIE automatisch Posts
    last_run: null, next_run: new Date(Date.now() + intervalMin * 60000).toISOString(), runs: 0,
  };
  db.routines.push(r); save(db);
  return r;
}
function removeRoutine(rid) {
  const db = load(); const n = db.routines.length;
  db.routines = db.routines.filter((r) => r.id !== rid);
  if (db.routines.length === n) { const e = new Error('unknown routine'); e.code = 404; throw e; }
  save(db); return { ok: true, removed: rid };
}
function toggleRoutine(rid, on) {
  const db = load(); const r = db.routines.find((x) => x.id === rid);
  if (!r) { const e = new Error('unknown routine'); e.code = 404; throw e; }
  r.enabled = !!on;
  if (on) r.next_run = new Date(Date.now() + r.interval_min * 60000).toISOString();
  save(db); return r;
}
function runRoutine(rid) {
  const db = load(); const r = db.routines.find((x) => x.id === rid);
  if (!r) { const e = new Error('unknown routine'); e.code = 404; throw e; }
  let result;
  if (r.action === 'modify') {
    const target = db.items.find((x) => x.type === r.type && x.status !== 'rejected');
    if (!target) { const e = new Error('kein passendes Content-Item für modify-Routine'); e.code = 409; throw e; }
    result = modify(target.id, 'Routinen-Update: ' + r.brief);
  } else {
    result = create({ brief: '[Routine ' + r.name + '] ' + r.brief, type: r.type });
  }
  const db2 = load(); const r2 = db2.routines.find((x) => x.id === rid);
  r2.last_run = now(); r2.runs += 1; r2.next_run = new Date(Date.now() + r2.interval_min * 60000).toISOString();
  save(db2);
  return { routine: r2, produced: { id: result.id, status: result.status, note: 'Routine erzeugt NIE automatische Posts — Publish bleibt menschlich freigepflichtet' } };
}
// daemon tick — called by server interval; creates due drafts only
function tick() {
  const db = load(); let fired = 0;
  const due = db.routines.filter((r) => r.enabled && r.next_run && new Date(r.next_run) <= new Date());
  for (const r of due) { try { runRoutine(r.id); fired += 1; } catch {} }
  return fired;
}

function ledger() { return load().ledger.slice(0, 100); }
function status() {
  const db = load();
  const by = (s) => db.items.filter((i) => i.status === s).length;
  return {
    area: '73', mode: 'LIVE',
    note: 'Minions erstellen/ändern Content automatisch (AUTO-DRAFT, lokale Engine) — Publish NUR mit menschlicher Freigabe über offizielle Kanäle; kein synthetisches Engagement',
    items: { total: db.items.length, draft: by('draft'), approved: by('approved'), published: by('published'), rejected: by('rejected') },
    routines: { total: db.routines.length, enabled: db.routines.filter((r) => r.enabled).length },
    pipelines: PIPELINES,
    channels: CHANNELS,
    crosslinks: ['hierarchy minions (63 Rollen)', 'WF-1/6/7/9', 'Area 60 schedule', 'Area 71 image_brief → Gateway', 'Area 64 vault snapshot bei publish'],
  };
}

module.exports = {
  meta: { area: '73', id: 'content_forge', name: 'Content Forge (minion automation, human-gated publishing)', state: 'live' },
  actions: {
    status: () => status(),
    create: (p) => create(p || {}),
    modify: (p) => modify(String((p || {}).id), (p || {}).instruction),
    approve: (p) => approve(String((p || {}).id), (p || {}).decision),
    post: (p) => post(String((p || {}).id), String((p || {}).channel)),
    routine_add: (p) => addRoutine(p || {}),
    routine_run: (p) => runRoutine(String((p || {}).id)),
  },
  status, create, modify, approve, post,
  addRoutine, removeRoutine, toggleRoutine, runRoutine, tick, ledger,
  list: () => load().items.slice(0, 100), routines: () => load().routines,
  CHANNELS, CONTENT_TYPES,
};
