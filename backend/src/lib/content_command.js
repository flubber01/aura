'use strict';
// AURA Area 87 — Content Command.
// One honest control plane for: authorized sources -> source records -> an
// ORIGINAL editorial angle -> format packages -> review -> admin-approved
// release plans. It deliberately does NOT scrape arbitrary pages, clone
// creators, invent provenance, or publish without an explicit Admin gate.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'content_command.json');
const CAP = 300;
const SOURCE_KINDS = ['manual_research', 'owned_rss', 'official_rss', 'licensed_feed'];
const RIGHTS = ['owned', 'official_feed', 'licensed', 'manual_research'];
const STAGES = ['brief', 'facts_checked', 'original_draft', 'review', 'approved', 'release_queued'];
const FORMAT_TYPES = ['long_video', 'short', 'article', 'newsletter', 'telegram_post', 'social_post', 'site_update', 'podcast_outline', 'redesign_brief'];
const CHANNELS = [
  { id: 'aura-review', name: 'AURA Review Archive', kind: 'internal', state: 'LIVE' },
  { id: 'youtube', name: 'YouTube', kind: 'official-api', state: 'NOT-CONNECTED', note: 'Google OAuth + YouTube Data API + owner setup required' },
  { id: 'telegram', name: 'Telegram', kind: 'official-api', state: 'NOT-CONNECTED', note: 'own BotFather token + chat allowlist required' },
  { id: 'wordpress', name: 'Own WordPress Sites', kind: 'official-api', state: 'NOT-CONNECTED', note: 'own-site REST credentials required' },
  { id: 'spotify', name: 'Spotify / Distributor', kind: 'distribution', state: 'NOT-CONNECTED', note: 'distributor workflow and release rights required' },
  { id: 'youtube-music', name: 'YouTube Music / Distributor', kind: 'distribution', state: 'NOT-CONNECTED', note: 'distributor workflow and release rights required' },
  { id: 'tiktok', name: 'TikTok', kind: 'official-api', state: 'NOT-CONNECTED', note: 'official account/API access required' },
];

function empty() { return { sources: [], items: [], collections: [], packages: [], deliveries: [], audit: [] }; }
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...empty(), ...db, sources: Array.isArray(db.sources) ? db.sources : [], items: Array.isArray(db.items) ? db.items : [], collections: Array.isArray(db.collections) ? db.collections : [], packages: Array.isArray(db.packages) ? db.packages : [], deliveries: Array.isArray(db.deliveries) ? db.deliveries : [], audit: Array.isArray(db.audit) ? db.audit : [] };
  } catch {
    // AURA_SEED_WRITE: fehlende/kaputte Datei einmalig mit den Defaults anlegen
    const fresh = empty(); try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* read-only ok */ } return fresh;
  }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE);
}
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) {
  db.audit.unshift({ at: now(), event, ...detail });
  if (db.audit.length > CAP) db.audit.length = CAP;
}
function text(v, max = 500) { return String(v || '').trim().slice(0, max); }
function decodeXml(s) { return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); }
function field(block, names) {
  for (const name of names) {
    const m = String(block).match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
    if (m) return decodeXml(m[1]);
  }
  return '';
}
function urlSafe(value, label = 'URL') {
  let u;
  try { u = new URL(String(value)); } catch { throw err(label + ' muss eine gültige HTTPS-URL sein'); }
  if (u.protocol !== 'https:') throw err(label + ' muss HTTPS verwenden');
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1' || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) throw err(label + ' darf kein lokaler/privater Host sein');
  return u.toString();
}
function requireAdmin(input, action) {
  const who = text((input || {}).approved_by || (input || {}).admin, 80);
  const authorization = text((input || {}).admin_authorization, 240);
  if (!who || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization');
  return { who, authorization };
}
function parseRss(xml) {
  const blocks = String(xml || '').match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  return blocks.slice(0, 50).map((b) => {
    let link = field(b, ['link', 'guid', 'id']);
    const linkAttr = String(b).match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
    if (linkAttr) link = linkAttr[1];
    return {
      title: field(b, ['title']).slice(0, 180),
      url: link,
      published_at: field(b, ['pubDate', 'published', 'updated', 'date']) || null,
      excerpt: field(b, ['description', 'summary', 'content:encoded', 'content']).slice(0, 900),
    };
  }).filter((x) => x.title && x.url);
}

function createSource(input = {}) {
  const name = text(input.name, 120);
  const kind = text(input.kind, 40) || 'manual_research';
  const rights = text(input.rights, 40) || 'manual_research';
  if (name.length < 2) throw err('Quellenname fehlt');
  if (!SOURCE_KINDS.includes(kind)) throw err('unbekannter Quellentyp: ' + kind);
  if (!RIGHTS.includes(rights)) throw err('unbekannter Rechte-/Nutzungsstatus');
  let feedUrl = null;
  if (kind !== 'manual_research') {
    feedUrl = urlSafe(input.feed_url, 'Feed-URL');
  }
  const db = load();
  if (feedUrl && db.sources.some((s) => s.feed_url === feedUrl)) throw err('diese Feed-URL ist bereits registriert', 409);
  const source = { id: id('src'), name, kind, rights, feed_url: feedUrl, enabled: input.enabled !== false, state: kind === 'manual_research' ? 'MANUAL' : 'READY', niche: text(input.niche, 120), note: text(input.note, 600), created_at: now(), last_fetch_at: null, item_count: 0 };
  db.sources.push(source); audit(db, 'source_created', { source: source.id, kind, rights }); save(db);
  return source;
}
function listSources() { return load().sources.slice().reverse(); }

function addItem(input = {}) {
  const db = load();
  const sourceId = text(input.source_id, 80);
  const source = sourceId ? db.sources.find((s) => s.id === sourceId) : null;
  if (sourceId && !source) throw err('Quelle unbekannt', 404);
  const title = text(input.title, 180);
  const canonical = urlSafe(input.url, 'Quellen-URL');
  if (title.length < 3) throw err('Titel fehlt');
  if (db.items.some((x) => x.url === canonical)) throw err('dieser Fund ist bereits in der Inbox', 409);
  const item = { id: id('srcitem'), source_id: source ? source.id : null, source_name: source ? source.name : text(input.source_name, 120) || 'Manueller Fund', title, url: canonical, published_at: text(input.published_at, 50) || null, excerpt: text(input.excerpt, 900), relevance: text(input.relevance, 600), niche: text(input.niche, 120) || (source && source.niche) || '', rights: source ? source.rights : 'manual_research', status: 'inbox', fetched_at: now(), created_at: now() };
  db.items.unshift(item); if (db.items.length > CAP) db.items.length = CAP;
  if (source) source.item_count = db.items.filter((x) => x.source_id === source.id).length;
  audit(db, 'source_item_added', { item: item.id, source: item.source_id, mode: source ? source.kind : 'manual' }); save(db);
  return item;
}
async function fetchSource(sourceId) {
  const db = load(); const source = db.sources.find((s) => s.id === String(sourceId));
  if (!source) throw err('Quelle unbekannt', 404);
  if (!source.enabled) throw err('Quelle ist pausiert', 409);
  if (!['owned_rss', 'official_rss', 'licensed_feed'].includes(source.kind) || !source.feed_url) throw err('Aktiver Abruf ist nur für registrierte eigene/offizielle/lizenzierte RSS-Feeds erlaubt');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
  let raw;
  try {
    const res = await fetch(source.feed_url, { signal: controller.signal, headers: { 'User-Agent': 'AURA-ContentCommand/1.0 (+authorized RSS metadata intake)' } });
    if (!res.ok) throw err('Feed antwortet HTTP ' + res.status, 502);
    raw = await res.text();
  } catch (e) { throw err('Feed-Abruf fehlgeschlagen: ' + String(e.message || e).slice(0, 180), e.code || 502); }
  finally { clearTimeout(timer); }
  const entries = parseRss(raw); let added = 0;
  for (const entry of entries) {
    let canonical;
    try { canonical = urlSafe(entry.url, 'Feed-Eintrag'); } catch { continue; }
    if (db.items.some((x) => x.url === canonical)) continue;
    db.items.unshift({ id: id('srcitem'), source_id: source.id, source_name: source.name, title: entry.title, url: canonical, published_at: entry.published_at, excerpt: entry.excerpt, relevance: '', niche: source.niche || '', rights: source.rights, status: 'inbox', fetched_at: now(), created_at: now() }); added += 1;
  }
  if (db.items.length > CAP) db.items.length = CAP;
  source.last_fetch_at = now(); source.last_fetch_state = 'LIVE'; source.item_count = db.items.filter((x) => x.source_id === source.id).length;
  audit(db, 'source_fetched', { source: source.id, added, discovered: entries.length }); save(db);
  return { ok: true, source: source.id, name: source.name, discovered: entries.length, added, mode: 'LIVE_RSS_METADATA_ONLY', note: 'Es wurden nur RSS-Metadaten/kurze Auszüge gespeichert — keine Artikelkopien. Eigene Recherche und Originalbeitrag bleiben Pflicht.' };
}
function listItems() { return load().items.slice(0, CAP); }

// A collection is a deliberately opened editorial research window. It preserves
// which records were chosen during a niche sprint without treating source text
// itself as reusable copy. Closing it never publishes anything; it only makes a
// documented multi-source brief available for the normal approval chain.
function collectionView(collection) {
  const end = new Date(collection.ends_at).getTime();
  return { ...collection, time_state: collection.status === 'CLOSED' ? 'CLOSED_BY_ADMIN' : (Date.now() >= end ? 'WINDOW_ELAPSED_NEEDS_ADMIN_CLOSE' : 'OPEN_COLLECTING') };
}
function createCollection(input = {}) {
  const niche = text(input.niche, 120);
  const title = text(input.title, 180) || (niche ? niche + ' · Nischen-Sammelfenster' : '');
  const hours = Number(input.hours || 12);
  if (niche.length < 2) throw err('Nische für das Sammelfenster fehlt');
  if (!Number.isFinite(hours) || hours < 1 || hours > 72) throw err('Sammelfenster muss zwischen 1 und 72 Stunden liegen');
  const a = requireAdmin(input, 'Start eines Nischen-Sammelfensters');
  const db = load(); const opened = now(); const ends = new Date(Date.now() + Math.round(hours * 60 * 60 * 1000)).toISOString();
  const collection = { id: id('niche'), title, niche, hours: Math.round(hours * 10) / 10, status: 'OPEN', opened_at: opened, ends_at: ends, closed_at: null, item_ids: [], opened_by: a.who, open_authorization: a.authorization, close_approval: null };
  db.collections.unshift(collection); if (db.collections.length > CAP) db.collections.length = CAP;
  audit(db, 'niche_collection_opened', { collection: collection.id, niche, hours: collection.hours, by: a.who }); save(db);
  return collectionView(collection);
}
function listCollections() { return load().collections.slice(0, CAP).map(collectionView); }
function addItemToCollection(collectionId, itemId) {
  const db = load(); const collection = db.collections.find((x) => x.id === String(collectionId));
  const item = db.items.find((x) => x.id === String(itemId));
  if (!collection) throw err('Nischen-Sammelfenster unbekannt', 404);
  if (!item) throw err('Inbox-Fund unbekannt', 404);
  if (collection.status !== 'OPEN') throw err('Dieses Sammelfenster ist bereits geschlossen', 409);
  if (Date.now() >= new Date(collection.ends_at).getTime()) throw err('Die Sammelzeit ist abgelaufen. Bitte das Fenster bewusst schließen oder ein neues öffnen.', 409);
  if (!collection.item_ids.includes(item.id)) collection.item_ids.push(item.id);
  item.collection_ids = Array.isArray(item.collection_ids) ? item.collection_ids : [];
  if (!item.collection_ids.includes(collection.id)) item.collection_ids.push(collection.id);
  audit(db, 'niche_collection_item_added', { collection: collection.id, item: item.id }); save(db);
  return collectionView(collection);
}
function closeCollection(collectionId, input = {}) {
  const db = load(); const collection = db.collections.find((x) => x.id === String(collectionId));
  if (!collection) throw err('Nischen-Sammelfenster unbekannt', 404);
  if (collection.status !== 'OPEN') throw err('Dieses Sammelfenster ist bereits geschlossen', 409);
  const a = requireAdmin(input, 'Schließen und Bündeln eines Nischen-Sammelfensters');
  collection.status = 'CLOSED'; collection.closed_at = now(); collection.close_approval = { by: a.who, authorization: a.authorization };
  audit(db, 'niche_collection_closed', { collection: collection.id, sources: collection.item_ids.length, by: a.who }); save(db);
  return collectionView(collection);
}

function createPackage(input = {}) {
  const db = load();
  const collectionId = text(input.collection_id, 80);
  const collection = collectionId ? db.collections.find((x) => x.id === collectionId) : null;
  if (collectionId && !collection) throw err('Nischen-Sammelfenster unbekannt', 404);
  if (collection && collection.status !== 'CLOSED') throw err('Das Nischen-Sammelfenster muss bewusst geschlossen werden, bevor daraus ein Gesamtpaket entsteht');
  let sourceIds = Array.isArray(input.source_item_ids) ? input.source_item_ids.map((x) => text(x, 80)).filter(Boolean) : text(input.source_item_ids, 500).split(/[\s,]+/).filter(Boolean);
  if (collection && !sourceIds.length) sourceIds = [...collection.item_ids];
  if (collection && sourceIds.some((sid) => !collection.item_ids.includes(sid))) throw err('Ein Mehrquellen-Paket darf nur die dokumentierten Funde dieses Sammelfensters verwenden');
  if (collection && sourceIds.length < 2) throw err('Ein Nischen-Gesamtpaket braucht mindestens zwei dokumentierte Funde — sonst ist es kein Mehrquellen-Redesign');
  const selected = sourceIds.map((sid) => db.items.find((x) => x.id === sid)).filter(Boolean);
  if (!selected.length) throw err('mindestens ein Quellen-Fund aus der Inbox muss ausgewählt werden');
  if (selected.length !== sourceIds.length) throw err('mindestens ein ausgewählter Quellen-Fund existiert nicht', 404);
  const angle = text(input.original_angle, 1000);
  if (angle.length < 20) throw err('Der eigene Blickwinkel muss mindestens 20 Zeichen enthalten — reine Umschreibung ist kein Content-Paket');
  const formats = (Array.isArray(input.formats) ? input.formats : text(input.formats, 500).split(/[\s,]+/)).map((x) => text(x, 40)).filter((x) => FORMAT_TYPES.includes(x));
  if (!formats.length) throw err('mindestens ein Ziel-Format auswählen: ' + FORMAT_TYPES.join(', '));
  const title = text(input.title, 180) || angle.slice(0, 100);
  const pkg = { id: id('pkg'), title, source_item_ids: selected.map((x) => x.id), sources: selected.map((x) => ({ id: x.id, title: x.title, url: x.url, rights: x.rights, niche: x.niche || '' })), collection: collection ? { id: collection.id, title: collection.title, niche: collection.niche, planned_hours: collection.hours, opened_at: collection.opened_at, closed_at: collection.closed_at, source_count: selected.length, rule: 'Mehrquellen-Synthese: Quellen liefern Fakten und Kontext; das Ergebnis braucht eigene Analyse, Struktur und Gestaltung.' } : null, original_angle: angle, audience: text(input.audience, 180), formats: [...new Set(formats)], department_plan: [
    { role: 'Research / Fact Check', state: 'pending', output: 'Fakten, Zeitlinie, Quellenprüfung' },
    { role: 'Editorial / Original Angle', state: 'pending', output: 'eigene These, Struktur, Nutzen' },
    { role: 'Studio / Format Pack', state: 'pending', output: 'Video, Short, Artikel, Newsletter usw.' },
    { role: 'SEO / Rights / QA', state: 'pending', output: 'Rechte, Links, Metadaten, Qualitätscheck' },
    { role: 'Publisher', state: 'blocked_admin_gate', output: 'offizielle Adapter erst nach Freigabe' },
  ], artifacts: [], stage: 'brief', facts_notes: '', original_contribution: '', review_notes: '', approval: null, created_at: now(), updated_at: now(), versions: [] };
  db.packages.unshift(pkg); if (db.packages.length > CAP) db.packages.length = CAP;
  selected.forEach((x) => { x.status = 'packaged'; }); audit(db, 'package_created', { package: pkg.id, sources: selected.length, formats: pkg.formats, collection: collection ? collection.id : null, mode: collection ? 'MULTI_SOURCE_ORIGINAL_REDESIGN' : 'STANDARD_ORIGINAL_PACKAGE' }); save(db);
  return pkg;
}
function advancePackage(packageId, input = {}) {
  const db = load(); const pkg = db.packages.find((x) => x.id === String(packageId));
  if (!pkg) throw err('Content-Paket unbekannt', 404);
  const target = text(input.stage, 40);
  if (!STAGES.includes(target)) throw err('unbekannte Paket-Stufe');
  const pos = STAGES.indexOf(pkg.stage), next = STAGES.indexOf(target);
  if (next !== pos + 1) throw err('Stufen müssen nacheinander laufen: aktuell ' + pkg.stage + ', nächster Schritt ' + STAGES[pos + 1]);
  if (target === 'facts_checked') {
    const notes = text(input.facts_notes, 2500); if (notes.length < 20) throw err('Fakten-/Quellenprüfung dokumentieren (mindestens 20 Zeichen)'); pkg.facts_notes = notes;
  }
  if (target === 'original_draft') {
    const contribution = text(input.original_contribution, 2500); if (contribution.length < 30) throw err('Eigene redaktionelle Leistung dokumentieren (mindestens 30 Zeichen)'); pkg.original_contribution = contribution;
  }
  if (target === 'review') pkg.review_notes = text(input.review_notes, 2500);
  if (target === 'approved') {
    const a = requireAdmin(input, 'Freigabe'); pkg.approval = { at: now(), by: a.who, authorization: a.authorization };
  }
  if (target === 'release_queued') requireAdmin(input, 'Release-Planung');
  pkg.versions.push({ at: now(), from: pkg.stage, to: target, by: text(input.approved_by || input.admin, 80) || 'workflow', note: text(input.note, 500) });
  pkg.stage = target; pkg.updated_at = now();
  const plan = pkg.department_plan.find((x) => target === 'facts_checked' ? x.role.startsWith('Research') : target === 'original_draft' ? x.role.startsWith('Editorial') : target === 'review' ? x.role.startsWith('SEO') : target === 'approved' ? x.role.startsWith('Publisher') : false);
  if (plan) plan.state = target === 'approved' ? 'ready_after_admin_approval' : 'done';
  audit(db, 'package_stage', { package: pkg.id, stage: target }); save(db);
  return pkg;
}
function buildArtifacts(packageId) {
  const db = load(); const pkg = db.packages.find((x) => x.id === String(packageId));
  if (!pkg) throw err('Content-Paket unbekannt', 404);
  if (!['original_draft', 'review', 'approved', 'release_queued'].includes(pkg.stage)) throw err('Studio-/Forge-Ausgaben erst nach Faktencheck und dokumentierter eigener Leistung bauen');
  if (Array.isArray(pkg.artifacts) && pkg.artifacts.length) throw err('Dieses Paket hat bereits Artefakte. Für eine neue Fassung zuerst eine neue Paket-Version anlegen.', 409);
  const studio = require('./studio');
  const forge = require('./content_forge');
  const collectionContext = pkg.collection ? (' Nischen-Sammelfenster: ' + pkg.collection.niche + ', geplant ' + pkg.collection.planned_hours + ' Stunden, ' + pkg.collection.source_count + ' dokumentierte Quellen. Die Quellen liefern nur Fakten und Kontext; die neue Form, Schlussfolgerung und Gestaltung kommen aus der dokumentierten eigenen Redaktion.') : '';
  const context = 'Originales Paket: ' + pkg.title + '. Eigener Angle: ' + pkg.original_angle + '. Quellen dienen nur der Faktenbasis: ' + pkg.sources.map((s) => s.title).join(' | ') + '.' + collectionContext;
  const artifacts = [];
  for (const format of pkg.formats) {
    let out;
    if (format === 'long_video') out = studio.generate({ studio: 'script', topic: context, duration_s: 600, style: 'eigenständige Analyse, keine Kopie' });
    else if (format === 'short') out = studio.generate({ studio: 'script', topic: context, duration_s: 60, style: 'eigener Short mit Kontext' });
    else if (format === 'article') out = studio.generate({ studio: 'article', topic: context, audience: pkg.audience || 'allgemein', tone: 'eigenständig und sachlich', sections: 6 });
    else if (format === 'newsletter') out = studio.generate({ studio: 'newsletter', topic: context, segment: pkg.audience || 'eigene Community' });
    else if (format === 'telegram_post') out = studio.generate({ studio: 'social', topic: context, platform: 'Telegram (eigener Kanal, Freigabe nötig)', variants: 3 });
    else if (format === 'social_post') out = studio.generate({ studio: 'social', topic: context, platform: 'offizieller eigener Kanal, Freigabe nötig', variants: 3 });
    else if (format === 'podcast_outline') out = studio.generate({ studio: 'podcast', topic: context, minutes: 20 });
    else if (format === 'site_update') {
      const item = forge.create({ brief: '[Content Command / site update] ' + context, type: 'article' });
      out = { studio: 'content_forge', id: item.id, forge_item: item.id, labels: item.labels || ['AUTO-DRAFT', 'HUMAN-REVIEW-REQUIRED'] };
    } else if (format === 'redesign_brief') {
      const item = forge.create({ brief: '[Content Command / original multi-source redesign brief] ' + context + ' Faktennotiz: ' + (pkg.facts_notes || 'vor Build dokumentiert') + '. Eigener Beitrag: ' + (pkg.original_contribution || 'vor Build dokumentiert') + '.', type: 'article' });
      out = { studio: 'content_forge', id: item.id, forge_item: item.id, labels: (item.labels || []).concat(['MULTI-SOURCE-ORIGINAL-REDESIGN', 'HUMAN-REVIEW-REQUIRED']) };
    }
    if (out) artifacts.push({ id: id('asset'), format, engine: out.studio || 'content_forge', artifact_id: out.id || null, forge_item: out.forge_item || null, labels: out.labels || [], created_at: now() });
  }
  pkg.artifacts = artifacts; pkg.updated_at = now();
  const studioPlan = pkg.department_plan.find((x) => x.role.startsWith('Studio'));
  if (studioPlan) studioPlan.state = 'done';
  audit(db, 'package_artifacts_built', { package: pkg.id, formats: pkg.formats, artifacts: artifacts.length }); save(db);
  return { package: pkg, artifacts, note: 'Artefakte wurden durch die vorhandenen lokalen Studio-/Forge-Engines gebaut und klar als LOCAL-TEMPLATE-ENGINE / HUMAN-REVIEW-REQUIRED gelabelt. Sie sind keine extern veröffentlichten Inhalte.' };
}
function queueRelease(packageId, input = {}) {
  const db = load(); const pkg = db.packages.find((x) => x.id === String(packageId));
  if (!pkg) throw err('Content-Paket unbekannt', 404);
  if (pkg.stage !== 'release_queued') throw err('Release erst nach allen Prüfungen und Admin-Freigabe planen');
  const a = requireAdmin(input, 'Release-Plan');
  const ids = (Array.isArray(input.channels) ? input.channels : text(input.channels, 500).split(/[\s,]+/)).map((x) => text(x, 40)).filter(Boolean);
  const chosen = ids.map((cid) => CHANNELS.find((x) => x.id === cid)).filter(Boolean);
  if (!chosen.length || chosen.length !== ids.length) throw err('mindestens einen bekannten Release-Kanal auswählen');
  const delivery = { id: id('rel'), package_id: pkg.id, planned_at: text(input.planned_at, 40) || null, channels: chosen.map((x) => ({ id: x.id, name: x.name, state: x.state, kind: x.kind })), status: 'PLANNED_ADMIN_APPROVED', approval: { at: now(), by: a.who, authorization: a.authorization }, created_at: now(), note: text(input.note, 800) };
  db.deliveries.unshift(delivery); if (db.deliveries.length > CAP) db.deliveries.length = CAP;
  audit(db, 'release_queued', { release: delivery.id, package: pkg.id, channels: chosen.map((x) => x.id) }); save(db);
  return { delivery, note: 'Plan gespeichert. LIVE ist nur AURA Review Archive; externe Kanäle bleiben ehrlich NOT-CONNECTED, bis du offizielle Zugänge eingerichtet und erneut freigegeben hast.' };
}
function status() {
  const db = load(); const by = (s) => db.packages.filter((x) => x.stage === s).length;
  return { area: '87', mode: 'LIVE', name: 'Content Command — source → original package → admin-gated release', sources: { total: db.sources.length, ready_rss: db.sources.filter((x) => x.state === 'READY' && x.enabled).length, manual: db.sources.filter((x) => x.kind === 'manual_research').length }, inbox: { total: db.items.length, pending: db.items.filter((x) => x.status === 'inbox').length }, collections: { total: db.collections.length, open: db.collections.filter((x) => x.status === 'OPEN').length, closed: db.collections.filter((x) => x.status === 'CLOSED').length, source_records: db.collections.reduce((n, x) => n + (Array.isArray(x.item_ids) ? x.item_ids.length : 0), 0) }, packages: Object.fromEntries(STAGES.map((s) => [s, by(s)])), artifacts: { total: db.packages.reduce((n, x) => n + (Array.isArray(x.artifacts) ? x.artifacts.length : 0), 0) }, releases: { total: db.deliveries.length, planned: db.deliveries.filter((x) => x.status === 'PLANNED_ADMIN_APPROVED').length }, channels: CHANNELS, policy: ['Nur eigene/offizielle/lizenzierte Feed-Metadaten oder manuell recherchierte Quellen', 'Keine Artikel-/Video-Kopien, keine Sprecherimitation', 'Eigener Blickwinkel + Faktencheck vor Draft', 'Externe Veröffentlichung nur nach expliziter Admin-Freigabe und über offizielle Adapter', 'LIVE / NOT-CONNECTED nie fälschen'] };
}
function listPackages() { return load().packages.slice(0, CAP); }
function listDeliveries() { return load().deliveries.slice(0, CAP); }

module.exports = {
  meta: { area: '87', id: 'content_command', name: 'Content Command (authorized source intelligence + original multi-format release plans)', state: 'live' },
  actions: {
    status: () => status(), source_add: (p) => createSource(p || {}), source_fetch: (p) => fetchSource((p || {}).source_id), item_add: (p) => addItem(p || {}), collection_open: (p) => createCollection(p || {}), collection_add_item: (p) => addItemToCollection((p || {}).collection_id, (p || {}).item_id), collection_close: (p) => closeCollection((p || {}).collection_id, p || {}), package_create: (p) => createPackage(p || {}), package_advance: (p) => advancePackage((p || {}).package_id, p || {}), package_build: (p) => buildArtifacts((p || {}).package_id), release_queue: (p) => queueRelease((p || {}).package_id, p || {}),
  },
  status, createSource, listSources, fetchSource, addItem, listItems, createCollection, listCollections, addItemToCollection, closeCollection, createPackage, advancePackage, buildArtifacts, queueRelease, listPackages, listDeliveries, CHANNELS, SOURCE_KINDS, RIGHTS, STAGES, FORMAT_TYPES,
};
