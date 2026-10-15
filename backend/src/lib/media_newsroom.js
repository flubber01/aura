'use strict';
// AURA Area 91 — Media, DJ, Avatar & Newsroom.
// One expandable working lane for owned/licensed assets, audio/video projects,
// DJ set plans, speaking-avatar scripts and curated news watchlists. It stores
// rights evidence and production plans; actual external fetches, avatar render
// and publication are adapter-gated and never claimed as complete.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const studio = require('./studio');
const forge = require('./content_forge');
const mediaPipeline = require('./media_pipeline');
const schedule = require('./schedule');

const FILE = path.join(__dirname, '..', 'data', 'media_newsroom.json');
const CAP = 400;
const ASSET_TYPES = ['midi', 'sample', 'stem', 'loop', 'sound_design', 'sound_fx', 'voice_asset', 'avatar_asset', 'video_clip', 'visual', 'cover', 'project_template', 'link'];
const LICENSES = ['owned', 'cc0', 'cc_by', 'royalty_free_commercial', 'licensed', 'needs_review'];
const PROJECT_KINDS = ['daw_video', 'dj_set', 'avatar_video', 'news_bulletin', 'podcast_visual', 'release_visual'];
const STAGES = ['brief', 'production_plan', 'review', 'approved'];
const MEDIA_ROLES = [
  ['media_producer', 'Media Producer', 'führt Audio, Video, Avatar und Lieferplan zusammen'],
  ['daw_arranger', 'DAW Arranger', 'Arrangement, Stems, Tempo, Key, Übergänge'],
  ['sound_designer', 'Sound Designer', 'eigene/erlaubte Sounds, FX, Atmosphäre, Foley'],
  ['mix_master_qc', 'Mix & Master QC', 'Lautheit, Clipping, Stems, Exportcheck'],
  ['video_editor', 'Video Editor', 'Schnitt, Audio-/Video-Sync, Untertitel, Deliverables'],
  ['motion_visual_designer', 'Motion & Visual Designer', 'Cover, Loops, Visual Identity, Motion-Briefs'],
  ['dj_programmer', 'DJ Set Programmer', 'BPM, Key, Energieverlauf, Cues, Übergänge'],
  ['broadcast_operator', 'Broadcast Operator', 'Stream-/Show-Runbook, Szenen, Fallbacks'],
  ['avatar_producer', 'Avatar Producer', 'Script, freigegebene Figur, Szenen und Renderbrief'],
  ['voice_rights_qc', 'Voice Rights QC', 'eigene/erlaubte Stimme, Consent, keine Imitation'],
  ['news_scout', 'News Scout', 'kuratierte Quellen, Fundzeit, Kontext und Relevanz'],
  ['fact_context_editor', 'Fact & Context Editor', 'Zeitlinie, Gegenprüfung, eigener Kontext'],
  ['ticker_editor', 'Ticker Editor', 'knappe, datierte, quellenklare Tickertexte'],
  ['rights_asset_librarian', 'Rights & Asset Librarian', 'Lizenzbelege, Attribution, Freigabestatus'],
  ['channel_packager', 'Channel Packager', 'Video, Short, Artikel, Newsletter, Social Packs'],
  ['media_calendar_operator', 'Media Calendar Operator', 'Batching, Review-Slots, Release-Slots'],
];
const MEDIA_SKILLS = [
  'MIDI- und Stem-Katalogisierung', 'BPM/Key/Energie-Setplanung', 'Audio-/Video-Synchronisationsbrief', 'Untertitel- und Shot-Plan', 'Sound-Design- und FX-Cue-Sheet', 'Rights-/Attribution-Tracking', 'Avatar-Skript und Voice-Consent', 'Ticker-/Newsbrief mit Quellenkontext', 'Multi-Format-Content-Packaging', 'Render- und Export-Checkliste',
];
function empty() { return { assets: [], projects: [], watchlists: [], links: [], audit: [] }; }
function load() { try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...empty(), ...db, assets: Array.isArray(db.assets) ? db.assets : [], projects: Array.isArray(db.projects) ? db.projects : [], watchlists: Array.isArray(db.watchlists) ? db.watchlists : [], links: Array.isArray(db.links) ? db.links : [], audit: Array.isArray(db.audit) ? db.audit : [] }; } catch { return empty(); } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function text(v, max = 500) { return String(v || '').trim().slice(0, max); }
function err(msg, code = 400) { const e = new Error(msg); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) { const by = text((input || {}).approved_by || (input || {}).admin, 80); const authorization = text((input || {}).admin_authorization, 260); if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization'); return { by, authorization }; }
function safeRef(value, label = 'Quelle') { const x = text(value, 1000); if (!x) throw err(label + ' fehlt'); if (/^https?:\/\//i.test(x)) { try { const u = new URL(x); if (u.protocol !== 'https:') throw 0; return u.toString(); } catch { throw err(label + ' muss HTTPS verwenden oder ein lokaler Asset-Ref sein'); } } if (/^[a-zA-Z0-9_./ -]+$/.test(x)) return x; throw err(label + ' enthält ein unzulässiges Format'); }
function addAsset(input = {}) {
  const a = requireAdmin(input, 'Aufnahme eines Media-Assets'); const type = text(input.type, 40); const license = text(input.license, 50); const name = text(input.name, 180); const source = safeRef(input.source_ref, 'Asset-Quelle'); const evidence = text(input.license_evidence, 1500);
  if (!ASSET_TYPES.includes(type) || !LICENSES.includes(license) || name.length < 2) throw err('Name, gültiger Asset-Typ und Lizenzstatus sind Pflicht');
  if (evidence.length < 15) throw err('Lizenz-/Rechtebeleg dokumentieren (mindestens 15 Zeichen)');
  const db = load(); const asset = { id: id('asset'), name, type, source_ref: source, license, license_evidence: evidence, attribution: text(input.attribution, 500), bpm: Number(input.bpm) || null, musical_key: text(input.musical_key, 30), duration_s: Number(input.duration_s) || null, tags: text(input.tags, 500).split(',').map((x) => text(x, 50)).filter(Boolean), state: license === 'needs_review' ? 'NEEDS_LICENSE_REVIEW' : 'APPROVED_FOR_USE', created_at: now(), created_by: a.by, approval: a };
  db.assets.unshift(asset); if (db.assets.length > CAP) db.assets.length = CAP; audit(db, 'media_asset_added', { asset: asset.id, type, license, by: a.by }); save(db); return asset;
}
function listAssets() { return load().assets.slice(0, CAP); }
function addQuickLink(input = {}) {
  const a = requireAdmin(input, 'Aufnahme eines Media-/News-Links'); const name = text(input.name, 180); const url = safeRef(input.url, 'Link'); const category = text(input.category, 80) || 'general'; if (name.length < 2) throw err('Linkname fehlt');
  const db = load(); const link = { id: id('link'), name, url, category, note: text(input.note, 800), rights_note: text(input.rights_note, 600), created_at: now(), created_by: a.by, approval: a };
  db.links.unshift(link); if (db.links.length > CAP) db.links.length = CAP; audit(db, 'media_link_added', { link: link.id, category, by: a.by }); save(db); return link;
}
function listLinks() { return load().links.slice(0, CAP); }
function createProject(input = {}) {
  const a = requireAdmin(input, 'Anlage eines Media-Studios-Projekts'); const kind = text(input.kind, 50); const title = text(input.title, 180); const brief = text(input.brief, 2800); if (!PROJECT_KINDS.includes(kind) || title.length < 2 || brief.length < 30) throw err('Projektart, Titel und eigener Produktionsbrief (mindestens 30 Zeichen) sind Pflicht');
  const db = load(); const project = { id: id('media'), kind, title, artist_or_brand: text(input.artist_or_brand, 160), brief, stage: 'brief', asset_ids: [], assets: [], workflow: mediaWorkflow(kind), artifacts: [], review_notes: '', approval: null, calendar_entry_id: null, created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, versions: [] };
  db.projects.unshift(project); if (db.projects.length > CAP) db.projects.length = CAP; audit(db, 'media_project_created', { project: project.id, kind, by: a.by }); save(db); return project;
}
function mediaWorkflow(kind) {
  const common = ['Creative Lead: eigene Richtung', 'Rights Librarian: Asset-/Lizenzcheck', 'Media Producer: Produktionsplan', 'QA: Review', 'Admin: Freigabe'];
  const byKind = { daw_video: ['DAW Arranger: BPM/Key/Arrangement', 'Sound Designer: FX/Cues', 'Video Editor: Sync/Shot-Plan'], dj_set: ['DJ Programmer: Energie/BPM/Key', 'Broadcast Operator: Cue-/Fallback-Plan'], avatar_video: ['Avatar Producer: Szene/Bewegung', 'Voice Rights QC: erlaubte Stimme', 'Video Editor: Lippen-/Audio-Sync-Adapter'], news_bulletin: ['News Scout: Quellenlage', 'Fact & Context Editor: Fakten/Einordnung', 'Ticker Editor: Kurzfassungen'], podcast_visual: ['Podcast Editor: Segmentplan', 'Motion Designer: Visual Loop'], release_visual: ['Label/Artist Lead: Release-Welt', 'Motion Designer: Cover/Teaser', 'Channel Packager: Formate'] };
  return [...common, ...(byKind[kind] || [])];
}
function attachAsset(projectId, assetId) {
  const db = load(); const project = db.projects.find((x) => x.id === String(projectId)); const asset = db.assets.find((x) => x.id === String(assetId)); if (!project) throw err('Media-Projekt unbekannt', 404); if (!asset) throw err('Asset unbekannt', 404); if (asset.state !== 'APPROVED_FOR_USE') throw err('Dieses Asset braucht erst Lizenz-/Rechte-Review'); if (!project.asset_ids.includes(asset.id)) { project.asset_ids.push(asset.id); project.assets.push({ id: asset.id, name: asset.name, type: asset.type, license: asset.license, bpm: asset.bpm, musical_key: asset.musical_key }); project.updated_at = now(); audit(db, 'media_asset_attached', { project: project.id, asset: asset.id }); save(db); } return project;
}
function buildProductionPlan(projectId) {
  const db = load(); const p = db.projects.find((x) => x.id === String(projectId)); if (!p) throw err('Media-Projekt unbekannt', 404); if (p.stage !== 'brief') throw err('Produktionsplan nur aus einem frischen Brief bauen');
  const assetText = p.assets.map((a) => a.name + ' [' + a.type + (a.bpm ? ' ' + a.bpm + ' BPM' : '') + (a.musical_key ? ' ' + a.musical_key : '') + ']').join(' | ') || 'noch keine Assets zugeordnet';
  const context = 'Projekt ' + p.title + '. Artist/Brand: ' + (p.artist_or_brand || 'AURA').toString() + '. Eigener Produktionsbrief: ' + p.brief + '. Freigegebene Assets: ' + assetText + '. Workflow: ' + p.workflow.join(' → ') + '.';
  const artifacts = [];
  if (p.kind === 'daw_video' || p.kind === 'release_visual' || p.kind === 'avatar_video' || p.kind === 'news_bulletin') {
    const mp = mediaPipeline.plan({ title: p.title, story: context, max_shots: 12, age_band: 'general' });
    artifacts.push({ id: id('plan'), type: 'audio_video_shot_plan', engine: 'area09_media_pipeline', media_project: mp.project.id, shots: mp.project.shots.length, created_at: now() });
  }
  if (p.kind === 'dj_set') {
    const sorted = p.assets.filter((x) => x.bpm).sort((a, b) => (a.bpm || 0) - (b.bpm || 0));
    artifacts.push({ id: id('plan'), type: 'dj_set_map', engine: 'local_set_planner', tracks: sorted.map((x, i) => ({ order: i + 1, asset: x.name, bpm: x.bpm, key: x.musical_key || 'not set' })), created_at: now() });
  }
  if (p.kind === 'avatar_video' || p.kind === 'news_bulletin' || p.kind === 'podcast_visual') {
    const out = studio.generate({ studio: 'script', topic: context, duration_s: p.kind === 'news_bulletin' ? 90 : 60, style: p.kind === 'avatar_video' ? 'eigene Avatar-Ansprache mit klarer Quellen-/Rechtekennzeichnung' : 'eigener redaktioneller Sprechtext' });
    artifacts.push({ id: id('plan'), type: 'speaking_script', engine: out.studio, forge_item: out.forge_item || null, labels: (out.labels || []).concat(['NO-VOICE-IMITATION']), created_at: now() });
  }
  const brief = forge.create({ brief: '[Media Newsroom / production brief] ' + context, type: 'script' });
  artifacts.push({ id: id('plan'), type: 'production_runbook', engine: 'content_forge', forge_item: brief.id, labels: (brief.labels || []).concat(['MEDIA-DEPARTMENT', 'HUMAN-REVIEW-REQUIRED']), created_at: now() });
  p.artifacts = artifacts; p.stage = 'production_plan'; p.updated_at = now(); p.versions.push({ at: now(), to: 'production_plan', note: 'local media production plan built' }); audit(db, 'media_plan_built', { project: p.id, artifacts: artifacts.length }); save(db); return { project: p, artifacts, note: 'Produktionsplan erstellt. Browser-Speech ist lokal möglich; externe TTS-/Avatar-Renderadapter bleiben NOT-CONNECTED, bis du sie offiziell einrichtest.' };
}
function advanceProject(projectId, input = {}) {
  const db = load(); const p = db.projects.find((x) => x.id === String(projectId)); if (!p) throw err('Media-Projekt unbekannt', 404); const target = text(input.stage, 50); const pos = STAGES.indexOf(p.stage), next = STAGES.indexOf(target); if (next !== pos + 1) throw err('Projektstufen laufen nacheinander: aktuell ' + p.stage + ', nächster Schritt ' + STAGES[pos + 1]);
  if (target === 'review') { const note = text(input.review_notes, 2000); if (note.length < 20) throw err('Audio, Video, Asset-Rechte und Kanal-Fit dokumentieren (mindestens 20 Zeichen)'); p.review_notes = note; }
  if (target === 'approved') { const a = requireAdmin(input, 'Media-Projektfreigabe'); p.approval = { at: now(), by: a.by, authorization: a.authorization }; }
  p.stage = target; p.updated_at = now(); p.versions.push({ at: now(), to: target, by: text(input.approved_by || input.admin, 80) || 'workflow' }); audit(db, 'media_project_stage', { project: p.id, stage: target }); save(db); return p;
}
function calendarProject(projectId, input = {}) {
  const db = load(); const p = db.projects.find((x) => x.id === String(projectId)); if (!p) throw err('Media-Projekt unbekannt', 404); if (p.stage !== 'approved') throw err('Kalender erst nach Media-Review und Admin-Freigabe'); if (p.calendar_entry_id) throw err('Projekt hat bereits einen Kalendertermin', 409); const a = requireAdmin(input, 'Media-Kalendertermin'); const added = schedule.add({ day: text(input.day, 12) || 'wed', role: 'media_producer', service: 'Media & Newsroom', start: text(input.start, 10) || '11:00', duration_min: Number(input.duration_min) || 60, task: p.title + ' · ' + text(input.task, 240) }); p.calendar_entry_id = added.entry.id; p.updated_at = now(); audit(db, 'media_calendar_added', { project: p.id, schedule: added.entry.id, by: a.by }); save(db); return { project: p, schedule: added };
}
function listProjects() { return load().projects.slice(0, CAP); }
function addWatchlist(input = {}) {
  const a = requireAdmin(input, 'Anlage einer News-Watchlist'); const name = text(input.name, 180); const niche = text(input.niche, 140); const source = safeRef(input.source_ref, 'Watchlist-Quelle'); const kind = text(input.source_kind, 40) || 'manual_research'; if (!name || !niche || !['manual_research', 'owned_rss', 'official_rss', 'licensed_feed'].includes(kind)) throw err('Name, Nische und zulässiger Quellentyp sind Pflicht');
  const db = load(); const watch = { id: id('watch'), name, niche, source_ref: source, source_kind: kind, rights_note: text(input.rights_note, 800), cadence: text(input.cadence, 80) || '12h sprint', state: 'ACTIVE_CURATED', created_at: now(), created_by: a.by, approval: a, notes: [] }; db.watchlists.unshift(watch); if (db.watchlists.length > CAP) db.watchlists.length = CAP; audit(db, 'news_watchlist_added', { watch: watch.id, by: a.by }); save(db); return watch;
}
function addNewsNote(watchId, input = {}) {
  const db = load(); const w = db.watchlists.find((x) => x.id === String(watchId)); if (!w) throw err('Watchlist unbekannt', 404); const title = text(input.title, 180); const url = safeRef(input.url, 'Fund-URL'); const context = text(input.context, 1200); if (title.length < 3 || context.length < 20) throw err('Fundtitel und eigener Kontext sind Pflicht'); const note = { id: id('news'), title, url, context, found_at: now() }; w.notes.unshift(note); if (w.notes.length > 200) w.notes.length = 200; audit(db, 'news_note_added', { watch: w.id, note: note.id }); save(db); return note;
}
function buildNewsBrief(watchId) {
  const db = load(); const w = db.watchlists.find((x) => x.id === String(watchId)); if (!w) throw err('Watchlist unbekannt', 404); if (!w.notes.length) throw err('Für einen Newsbrief erst mindestens einen dokumentierten Fund hinzufügen'); const context = 'Newsroom-Watchlist: ' + w.name + ' / ' + w.niche + '. Dokumentierte Funde: ' + w.notes.slice(0, 12).map((n) => n.title + ' — eigener Kontext: ' + n.context).join(' | ') + '. Ergebnis ist eigene Einordnung, keine Artikelkopie.'; const out = studio.generate({ studio: 'script', topic: context, duration_s: 90, style: 'datierter News-Ticker mit eigener Einordnung und klarer Quellenlage' }); const item = forge.create({ brief: '[Media Newsroom / original news brief] ' + context, type: 'script' }); audit(db, 'news_brief_built', { watch: w.id, forge_item: item.id }); save(db); return { watchlist: w.id, script: out, forge_item: item.id, note: 'Lokaler News-/Ticker-Entwurf. Kein automatischer Zeitungs-/Feed-Repost und keine externe Veröffentlichung.' };
}
function listWatchlists() { return load().watchlists.slice(0, CAP); }
const STUDIO47 = { id: 'studio47', name: 'STUDIO47', state: 'COMING_SOON', note: 'eigene künftige self-hosted Music-/Audio-Lane für Generation, DAW, MIDI, Stems, Sound Design und Video-Sync.' };
function status() { const db = load(); return { area: '91', mode: 'LIVE', studio47: STUDIO47, media_department: { roles: MEDIA_ROLES.map(([id, name, usecase]) => ({ id, name, usecase })), skills: MEDIA_SKILLS }, assets: { total: db.assets.length, approved: db.assets.filter((x) => x.state === 'APPROVED_FOR_USE').length, needs_review: db.assets.filter((x) => x.state === 'NEEDS_LICENSE_REVIEW').length }, projects: { total: db.projects.length, by_kind: Object.fromEntries(PROJECT_KINDS.map((k) => [k, db.projects.filter((x) => x.kind === k).length])) }, watchlists: { total: db.watchlists.length, active: db.watchlists.filter((x) => x.state === 'ACTIVE_CURATED').length, notes: db.watchlists.reduce((n, x) => n + x.notes.length, 0) }, links: { total: db.links.length }, adapters: [{ id: 'browser_speech', name: 'Browser SpeechSynthesis', state: 'LIVE_LOCAL', note: 'lokale Browser-Sprachausgabe für freigegebene Skripte' }, { id: 'avatar_render', name: 'Avatar Render Adapter', state: 'NOT-CONNECTED', note: 'offiziellen/autorisierten Avatar-Renderdienst oder eigene Rendering-Engine einrichten' }, { id: 'tts_provider', name: 'TTS Provider', state: 'NOT-CONNECTED', note: 'nur eigene/autorisierte Stimmen; keine Sprecherimitation' }, { id: 'ffmpeg_render', name: 'FFmpeg Render', state: 'HOST_PROBE', note: 'Area 09 prüft den echten Host-Status beim Rendern' }], policy: ['Assets nur mit dokumentierter Quelle und Lizenzbasis', 'needs_review-Assets können nicht an Projekte gehängt werden', 'Keine Voice-/Persona-Imitation ohne nachweisbare Autorisierung', 'Newswatch nur manuell, eigene, offizielle oder lizenzierte Quellen', 'Newsbriefs sind eigene Einordnung, keine Kopie', 'Externe Render-/Publish-Adapter bleiben ehrlich gelabelt'] }; }
module.exports = { meta: { area: '91', id: 'media_newsroom', name: 'Media Studio & Newsroom (DAW + video + DJ + avatar + curated news)', state: 'live' }, actions: { status: () => status(), asset_add: (p) => addAsset(p || {}), link_add: (p) => addQuickLink(p || {}), project_create: (p) => createProject(p || {}), project_asset: (p) => attachAsset((p || {}).project_id, (p || {}).asset_id), project_build: (p) => buildProductionPlan((p || {}).project_id), project_advance: (p) => advanceProject((p || {}).project_id, p || {}), project_calendar: (p) => calendarProject((p || {}).project_id, p || {}), watch_add: (p) => addWatchlist(p || {}), watch_note: (p) => addNewsNote((p || {}).watch_id, p || {}), news_brief: (p) => buildNewsBrief((p || {}).watch_id) }, status, addAsset, listAssets, addQuickLink, listLinks, createProject, attachAsset, buildProductionPlan, advanceProject, calendarProject, listProjects, addWatchlist, addNewsNote, buildNewsBrief, listWatchlists, ASSET_TYPES, LICENSES, PROJECT_KINDS, STAGES, MEDIA_ROLES, MEDIA_SKILLS, STUDIO47 };
