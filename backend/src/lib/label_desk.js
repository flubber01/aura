'use strict';
// AURA Area 90 — CreedStreet47 Label Desk.
// A local label operating desk: artist roster, rights records, releases,
// release assets/metadata, promotion and calendar handoffs. It records direct
// partner/distributor plans but never submits music or fakes a DSP connection.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const schedule = require('./schedule');
const studio = require('./studio');
const forge = require('./content_forge');

const FILE = path.join(__dirname, '..', 'data', 'label_desk.json');
const CAP = 300;
const RELEASE_STAGES = ['concept', 'rights_splits', 'masters_assets', 'metadata_qc', 'distribution_ready', 'distribution_planned'];
const ROUTES = [
  { id: 'creedstreet47_direct_partner', name: 'CreedStreet47 Direct Partner Lane', state: 'NOT-CONNECTED', requires: 'Dein/Label-Partnervertrag, Plattform-/DDEX-/API-Zugang, technische Tests und deine Freigabe.' },
  { id: 'approved_distributor', name: 'Autorisierter Distributor', state: 'NOT-CONNECTED', requires: 'Von dir ausgewählter Distributor, bestätigte Rechte, Metadaten und Admin-Freigabe.' },
  { id: 'own_direct_sale', name: 'Eigener Direct Sale / Bandcamp / Shop', state: 'NOT-CONNECTED', requires: 'Eigener Shop-/Artist-Zugang, Steuer-/Zahlungssetup und erlaubter Veröffentlichungsweg.' },
];
const destination = (id, name, lane, state = 'ROUTE_SETUP_REQUIRED') => ({ id, name, lane, state });
// 66 target lanes: a planning matrix for distribution, UGC catalog, creator
// promotion and owned stores. A lane is never an asserted contract or live API.
const DESTINATIONS = [
  destination('spotify', 'Spotify', 'dsp_distribution'), destination('apple_music', 'Apple Music', 'dsp_distribution'), destination('itunes_store', 'iTunes Store', 'dsp_distribution'), destination('youtube_music', 'YouTube Music', 'dsp_distribution'), destination('amazon_music', 'Amazon Music', 'dsp_distribution'), destination('deezer', 'Deezer', 'dsp_distribution'), destination('tidal', 'TIDAL', 'dsp_distribution'), destination('qobuz', 'Qobuz', 'dsp_distribution'), destination('napster', 'Napster', 'dsp_distribution'), destination('pandora', 'Pandora', 'dsp_distribution'), destination('iheartradio', 'iHeartRadio', 'dsp_distribution'), destination('jiosaavn', 'JioSaavn', 'dsp_distribution'), destination('anghami', 'Anghami', 'dsp_distribution'), destination('boomplay', 'Boomplay', 'dsp_distribution'), destination('audiomack', 'Audiomack', 'dsp_distribution'), destination('joox', 'JOOX', 'dsp_distribution'), destination('kkbox', 'KKBOX', 'dsp_distribution'), destination('line_music', 'LINE MUSIC', 'dsp_distribution'), destination('awa', 'AWA', 'dsp_distribution'), destination('melon', 'Melon', 'dsp_distribution'), destination('flo', 'FLO', 'dsp_distribution'), destination('bugs', 'Bugs!', 'dsp_distribution'), destination('vibe', 'VIBE', 'dsp_distribution'), destination('netease_cloud_music', 'NetEase Cloud Music', 'dsp_distribution'), destination('qq_music', 'QQ Music', 'dsp_distribution'), destination('kugou', 'Kugou', 'dsp_distribution'), destination('kuwo', 'Kuwo', 'dsp_distribution'), destination('yandex_music', 'Yandex Music', 'dsp_distribution'), destination('zvuk', 'Zvuk', 'dsp_distribution'), destination('claro_musica', 'Claro Música', 'dsp_distribution'), destination('hungama', 'Hungama', 'dsp_distribution'), destination('seven_digital', '7digital', 'dsp_distribution'), destination('shazam', 'Shazam Discovery', 'dsp_distribution'),
  destination('beatport', 'Beatport', 'dj_store'), destination('traxsource', 'Traxsource', 'dj_store'), destination('juno_download', 'Juno Download', 'dj_store'), destination('soundcloud', 'SoundCloud', 'artist_platform'), destination('bandcamp', 'Bandcamp', 'artist_store'), destination('mixcloud', 'Mixcloud', 'dj_broadcast'),
  destination('tiktok_music_library', 'TikTok Music Library', 'ugc_catalog'), destination('instagram_music', 'Instagram Music', 'ugc_catalog'), destination('facebook_music', 'Facebook Music', 'ugc_catalog'), destination('snapchat_sounds', 'Snapchat Sounds', 'ugc_catalog'), destination('capcut_music', 'CapCut Music', 'ugc_catalog'), destination('youtube_content_id', 'YouTube Content ID', 'ugc_catalog'), destination('youtube_shorts', 'YouTube Shorts', 'ugc_catalog'), destination('roblox_ugc', 'Roblox UGC / Game Audio', 'ugc_catalog'), destination('twitch_music', 'Twitch Music / Stream', 'ugc_catalog'),
  destination('discord', 'Discord', 'creator_channel'), destination('telegram', 'Telegram', 'creator_channel'), destination('bluesky', 'Bluesky', 'creator_channel'), destination('x', 'X', 'creator_channel'), destination('threads', 'Threads', 'creator_channel'), destination('facebook_page', 'Facebook Page', 'creator_channel'), destination('instagram_business', 'Instagram Business', 'creator_channel'), destination('tiktok_account', 'TikTok Account', 'creator_channel'), destination('youtube_channel', 'YouTube Channel', 'creator_channel'), destination('linkedin_page', 'LinkedIn Page', 'creator_channel'), destination('pinterest', 'Pinterest', 'creator_channel'), destination('reddit', 'Reddit', 'creator_channel'),
  destination('newsletter', 'Eigener Newsletter', 'owned_channel'), destination('own_website', 'Eigene Website', 'owned_channel'), destination('shopify_store', 'Shopify Store', 'owned_store'), destination('woocommerce_store', 'WooCommerce Store', 'owned_store'), destination('gumroad_kofi', 'Gumroad / Ko-fi', 'owned_store'), destination('direct_download_store', 'Eigener Direct Download Store', 'owned_store'),
];
const STUDIO47 = { id: 'studio47', name: 'STUDIO47', state: 'COMING_SOON', note: 'künftige selbst gehostete Musik-/Audio-Lane: eigene Generation, DAW, Stems, MIDI, Sound Design, Video-Sync und Render-Adapter.' };

function seeded() {
  return {
    label: { id: 'label-creedstreet47', name: 'CreedStreet47', state: 'LOCAL_DRAFT_NEEDS_RIGHTS_CONFIRMATION', source: 'user_requested_local_draft', confirmed_at: null, confirmation: null },
    artists: [
      { id: 'artist-sabr47', name: 'Sabr47', state: 'LOCAL_DRAFT_NEEDS_RIGHTS_CONFIRMATION', source: 'user_requested_local_draft', confirmed_at: null, confirmation: null },
      { id: 'artist-nasihatbeatz47', name: 'NasihatBeatZ 47', state: 'LOCAL_DRAFT_NEEDS_RIGHTS_CONFIRMATION', source: 'user_requested_local_draft', confirmed_at: null, confirmation: null },
    ],
    releases: [], audit: [], direct_setup_requests: [],
  };
}
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const seed = seeded();
    return { ...seed, ...db, label: db.label || seed.label, artists: Array.isArray(db.artists) ? db.artists : seed.artists, releases: Array.isArray(db.releases) ? db.releases : [], audit: Array.isArray(db.audit) ? db.audit : [], direct_setup_requests: Array.isArray(db.direct_setup_requests) ? db.direct_setup_requests : [] };
  } catch { return seeded(); }
}
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function text(v, max = 500) { return String(v || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) {
  const by = text((input || {}).approved_by || (input || {}).admin, 80);
  const authorization = text((input || {}).admin_authorization, 280);
  if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization');
  return { by, authorization };
}
function internalCatalogNo(db) { return 'CS47-' + new Date().getFullYear() + '-' + String((db.releases || []).length + 1).padStart(3, '0'); }
function labelView(label) { return { ...label, public_claim: 'Kein externes Label- oder Markenregister wird behauptet. Dieser Eintrag ist ein lokales AURA-Labelprofil.' }; }
function artistView(artist) { return { ...artist, public_claim: 'Kein externes Künstlerprofil wird behauptet. Dieser Eintrag ist ein lokales AURA-Rosterprofil.' }; }

function confirmEntity(kind, entityId, input = {}) {
  const db = load(); const a = requireAdmin(input, kind === 'label' ? 'Rechtebestätigung für CreedStreet47' : 'Rechtebestätigung für Artist-Roster');
  let entity;
  if (kind === 'label') { if (db.label.id !== String(entityId)) throw err('Label unbekannt', 404); entity = db.label; }
  else if (kind === 'artist') { entity = db.artists.find((x) => x.id === String(entityId)); if (!entity) throw err('Artist unbekannt', 404); }
  else throw err('Unbekannte Entität');
  const rightsNote = text(input.rights_note, 1000); if (rightsNote.length < 20) throw err('Bitte Rechte-/Vertretungsbasis dokumentieren (mindestens 20 Zeichen)');
  entity.state = 'ADMIN_CONFIRMED_LOCAL'; entity.confirmed_at = now(); entity.confirmation = { by: a.by, authorization: a.authorization, rights_note: rightsNote };
  audit(db, kind + '_rights_confirmed', { entity: entity.id, by: a.by }); save(db);
  return kind === 'label' ? labelView(entity) : artistView(entity);
}
function requestDirectSetup(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anforderung einer CreedStreet47 Direct-Partner-Lane');
  if (db.label.state !== 'ADMIN_CONFIRMED_LOCAL') throw err('CreedStreet47 zuerst lokal als Rechte-/Vertretungseinheit bestätigen');
  const request = { id: id('direct'), route: 'creedstreet47_direct_partner', state: 'SETUP_REQUESTED_NOT_CONNECTED', partner_scope: text(input.partner_scope, 500), requirements_note: text(input.requirements_note, 1200), requested_at: now(), requested_by: a.by, authorization: a.authorization };
  if (request.partner_scope.length < 10 || request.requirements_note.length < 20) throw err('Partnerumfang und vorhandene/fehlende Setup-Unterlagen dokumentieren');
  db.direct_setup_requests.unshift(request); audit(db, 'direct_partner_setup_requested', { request: request.id, by: a.by }); save(db);
  return { request, note: 'Lokale Setup-Aufgabe gespeichert. Es wurde kein DSP-/DDEX-/API-Request ausgeführt und keine Verbindung behauptet.' };
}
function createRelease(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines CreedStreet47 Release-Pakets');
  if (db.label.state !== 'ADMIN_CONFIRMED_LOCAL') throw err('CreedStreet47 zuerst lokal als Rechte-/Vertretungseinheit bestätigen');
  const artist = db.artists.find((x) => x.id === text(input.artist_id, 80));
  if (!artist) throw err('Artist aus dem CreedStreet47-Roster auswählen', 404);
  if (artist.state !== 'ADMIN_CONFIRMED_LOCAL') throw err('Artist zuerst mit Rechte-/Vertretungsbasis bestätigen');
  const title = text(input.title, 180); const type = text(input.release_type, 60) || 'single'; const concept = text(input.concept, 2200);
  if (title.length < 2 || concept.length < 30) throw err('Release-Titel und eigenständiges Konzept (mindestens 30 Zeichen) sind Pflicht');
  const release = { id: id('labelrelease'), internal_catalog_no: internalCatalogNo(db), label_id: db.label.id, label_name: db.label.name, artist_id: artist.id, artist_name: artist.name, title, release_type: type, concept, stage: 'concept', rights_notes: '', split_notes: '', asset_manifest: '', metadata: {}, route: null, route_plan: null, artifacts: [], calendar_entry_id: null, approval: null, created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, versions: [] };
  db.releases.unshift(release); if (db.releases.length > CAP) db.releases.length = CAP;
  audit(db, 'label_release_created', { release: release.id, artist: artist.id, by: a.by }); save(db); return release;
}
function advanceRelease(releaseId, input = {}) {
  const db = load(); const release = db.releases.find((x) => x.id === String(releaseId));
  if (!release) throw err('Label-Release unbekannt', 404);
  const target = text(input.stage, 60); const pos = RELEASE_STAGES.indexOf(release.stage); const next = RELEASE_STAGES.indexOf(target);
  if (next !== pos + 1) throw err('Release-Stufen laufen nacheinander: aktuell ' + release.stage + ', nächster Schritt ' + RELEASE_STAGES[pos + 1]);
  if (target === 'rights_splits') {
    const notes = text(input.rights_notes, 2200); const splits = text(input.split_notes, 2200);
    if (notes.length < 30 || splits.length < 10) throw err('Master-/Kompositionsrechte und Beteiligungs-/Split-Notizen dokumentieren');
    release.rights_notes = notes; release.split_notes = splits;
  }
  if (target === 'masters_assets') {
    const manifest = text(input.asset_manifest, 2400); if (manifest.length < 30) throw err('Master-/Stems-/Artwork-Asset-Manifest dokumentieren (mindestens 30 Zeichen)'); release.asset_manifest = manifest;
  }
  if (target === 'metadata_qc') {
    const m = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
    const releaseTitle = text(m.release_title || release.title, 180); const artistName = text(m.artist || release.artist_name, 140); const artwork = text(m.artwork_rights, 600);
    if (!releaseTitle || !artistName || artwork.length < 20) throw err('Release-Titel, Artist und Artwork-Rechte für die Metadaten-QC dokumentieren');
    release.metadata = { release_title: releaseTitle, artist: artistName, genre: text(m.genre, 100), language: text(m.language, 40), explicit: Boolean(m.explicit), copyright_line: text(m.copyright_line, 300), production_line: text(m.production_line, 300), artwork_rights: artwork, isrc: text(m.isrc, 30) || 'PENDING_REGISTRAR', upc_ean: text(m.upc_ean, 30) || 'PENDING_REGISTRAR' };
  }
  if (target === 'distribution_ready') {
    const route = ROUTES.find((x) => x.id === text(input.route, 80)); if (!route) throw err('Zulässigen Distribution-Weg auswählen');
    const a = requireAdmin(input, 'Distribution-Übergabe vorbereiten');
    const partnerRef = text(input.partner_contract_ref, 500); const technicalRef = text(input.technical_setup_ref, 500);
    if (route.id === 'creedstreet47_direct_partner' && (partnerRef.length < 4 || technicalRef.length < 4)) throw err('Für die Direct-Partner-Lane Vertrag-/Partnerreferenz und DDEX-/API-/Onboarding-Referenz dokumentieren');
    if (route.id === 'approved_distributor' && partnerRef.length < 2) throw err('Für den Distributor den autorisierten Provider dokumentieren');
    release.route = route.id; release.route_plan = { name: route.name, connection_state: route.state, partner_contract_ref: partnerRef, technical_setup_ref: technicalRef, destinations: Array.isArray(input.destinations) ? input.destinations.filter((x) => DESTINATIONS.some((d) => d.id === x)) : [], authorized_by: a.by, authorization: a.authorization, prepared_at: now() };
  }
  if (target === 'distribution_planned') { const a = requireAdmin(input, 'Distribution-/Release-Planung'); release.approval = { by: a.by, authorization: a.authorization, at: now() }; }
  release.stage = target; release.updated_at = now(); release.versions.push({ at: now(), to: target, by: text(input.approved_by || input.admin, 80) || 'workflow', note: text(input.note, 500) });
  audit(db, 'label_release_stage', { release: release.id, stage: target }); save(db); return release;
}
function buildPromoPack(releaseId) {
  const db = load(); const release = db.releases.find((x) => x.id === String(releaseId));
  if (!release) throw err('Label-Release unbekannt', 404);
  if (!['metadata_qc', 'distribution_ready', 'distribution_planned'].includes(release.stage)) throw err('Promo-Pack erst nach Asset- und Metadaten-QC erstellen');
  if (release.artifacts.length) throw err('Für dieses Release wurde bereits ein Promo-Pack gebaut', 409);
  const context = 'CreedStreet47 Release: ' + release.artist_name + ' — ' + release.title + '. Eigenes Konzept: ' + release.concept + '. Interne Katalognummer: ' + release.internal_catalog_no + '. Rechtebasis: ' + release.rights_notes + '. Keine fremde Stilimitation; nur eigene/autorisierte Assets.';
  const social = studio.generate({ studio: 'social', topic: context, platform: 'eigene autorisierte Artist-/Label-Kanäle', variants: 4 });
  const script = studio.generate({ studio: 'script', topic: context, duration_s: 45, style: 'eigener Release-Teaser, kein fremdes Material' });
  const press = forge.create({ brief: '[CreedStreet47 / owned release press and asset brief] ' + context, type: 'article' });
  release.artifacts = [
    { id: id('asset'), type: 'social_release_pack', engine: social.studio, forge_item: social.forge_item || null, labels: social.labels || [], created_at: now() },
    { id: id('asset'), type: 'short_teaser_script', engine: script.studio, forge_item: script.forge_item || null, labels: script.labels || [], created_at: now() },
    { id: id('asset'), type: 'press_asset_brief', engine: 'content_forge', forge_item: press.id, labels: (press.labels || []).concat(['CREEDSTREET47', 'HUMAN-REVIEW-REQUIRED']), created_at: now() },
  ];
  release.updated_at = now(); audit(db, 'label_release_promo_built', { release: release.id, artifacts: release.artifacts.length }); save(db);
  return { release, artifacts: release.artifacts, note: 'Lokales Promo-Pack gebaut. Kein externer Post und keine DSP-Einreichung wurden ausgeführt.' };
}
function addReleaseToCalendar(releaseId, input = {}) {
  const db = load(); const release = db.releases.find((x) => x.id === String(releaseId));
  if (!release) throw err('Label-Release unbekannt', 404);
  if (release.stage !== 'distribution_planned') throw err('Kalendertermin erst nach einem expliziten Distribution-Plan anlegen');
  if (release.calendar_entry_id) throw err('Dieser Release hat bereits einen Kalendertermin', 409);
  const a = requireAdmin(input, 'CreedStreet47 Release-Kalendertermin');
  const added = schedule.add({ day: text(input.day, 12) || 'fri', role: 'label_release_manager', service: 'CreedStreet47 Label Desk', start: text(input.start, 10) || '12:00', duration_min: Number(input.duration_min) || 45, task: release.artist_name + ' · ' + release.title + ' · ' + text(input.task, 240) });
  release.calendar_entry_id = added.entry.id; release.calendar_approval = { by: a.by, authorization: a.authorization, at: now() }; release.updated_at = now();
  audit(db, 'label_release_calendar_added', { release: release.id, schedule: added.entry.id }); save(db); return { release, schedule: added };
}
function listReleases() { return load().releases.slice(0, CAP); }
function setDestinations(releaseId, input = {}) {
  const db = load(); const release = db.releases.find((x) => x.id === String(releaseId));
  if (!release) throw err('Label-Release unbekannt', 404);
  if (!['distribution_ready', 'distribution_planned'].includes(release.stage) || !release.route_plan) throw err('Ziel-Lanes erst nach Distribution Ready konfigurieren');
  const a = requireAdmin(input, 'Auswahl der Release-Ziel-Lanes');
  const ids = (Array.isArray(input.destinations) ? input.destinations : text(input.destinations, 4000).split(/[\s,]+/)).map((x) => text(x, 80)).filter(Boolean);
  const chosen = [...new Set(ids)].filter((x) => DESTINATIONS.some((d) => d.id === x));
  if (!chosen.length) throw err('Mindestens eine gültige Ziel-Lane auswählen');
  release.route_plan.destinations = chosen; release.route_plan.destination_selection = { at: now(), by: a.by, authorization: a.authorization }; release.updated_at = now();
  audit(db, 'label_release_destinations_selected', { release: release.id, count: chosen.length, by: a.by }); save(db);
  return { release, destinations: DESTINATIONS.filter((d) => chosen.includes(d.id)), note: 'Ziel-Lanes sind lokal geplant. Kein Upload, kein Post und keine DSP-Einreichung wurde ausgelöst.' };
}
function releasePreflight(releaseId) {
  const db = load(); const r = db.releases.find((x) => x.id === String(releaseId)); if (!r) throw err('Label-Release unbekannt', 404);
  const checks = [
    { id: 'rights_splits', ok: Boolean(r.rights_notes && r.split_notes), label: 'Rechte & Splits dokumentiert' },
    { id: 'masters_assets', ok: Boolean(r.asset_manifest), label: 'Master-/Asset-Manifest dokumentiert' },
    { id: 'metadata', ok: Boolean(r.metadata && r.metadata.artwork_rights), label: 'Metadaten & Artwork-Rechte geprüft' },
    { id: 'promo', ok: Array.isArray(r.artifacts) && r.artifacts.length > 0, label: 'Promo-Pack gebaut' },
    { id: 'route', ok: Boolean(r.route_plan), label: 'Distribution-Weg geplant' },
    { id: 'destinations', ok: Boolean(r.route_plan && r.route_plan.destinations && r.route_plan.destinations.length), label: 'Ziel-Lanes ausgewählt' },
    { id: 'admin_plan', ok: r.stage === 'distribution_planned' && Boolean(r.approval), label: 'Admin-Distribution-Plan freigegeben' },
    { id: 'calendar', ok: Boolean(r.calendar_entry_id), label: 'Release-/Review-Termin im Kalender' },
  ];
  const passed = checks.filter((x) => x.ok).length;
  return { release_id: r.id, internal_catalog_no: r.internal_catalog_no, stage: r.stage, passed, total: checks.length, score_pct: Math.round((passed / checks.length) * 100), checks, external_state: 'NOT-SUBMITTED', note: 'Der Preflight misst nur lokale Vollständigkeit. Er ersetzt keine Partnerfreigabe und übermittelt nichts extern.' };
}
function status() {
  const db = load();
  return { area: '90', mode: 'LIVE', label: labelView(db.label), artists: db.artists.map(artistView), releases: { total: db.releases.length, by_stage: Object.fromEntries(RELEASE_STAGES.map((s) => [s, db.releases.filter((x) => x.stage === s).length])) }, routes: ROUTES, destinations: DESTINATIONS, destination_lanes: { total: DESTINATIONS.length, by_lane: Object.fromEntries([...new Set(DESTINATIONS.map((x) => x.lane))].map((lane) => [lane, DESTINATIONS.filter((x) => x.lane === lane).length])) }, studio47: STUDIO47, direct_setup_requests: db.direct_setup_requests.slice(0, 50), policy: ['Rechte-/Vertretungsbasis für Label und Artist zuerst bestätigen', 'Interne Katalognummern sind keine offiziellen ISRC/UPC/EAN-Codes', 'Kein DSP-/DDEX-/API-Request ohne echten Partnerzugang', 'Keine externe Distribution ohne Admin-Freigabe', 'Promo nutzt nur eigene/autorisierte Assets; keine fremden Stilkopien', 'Analytics erst nach offiziellen verbundenen Quellen als echt zeigen'] };
}
module.exports = {
  meta: { area: '90', id: 'label_desk', name: 'CreedStreet47 Label Desk (roster + rights + release ops)', state: 'live' },
  actions: { status: () => status(), entity_confirm: (p) => confirmEntity((p || {}).kind, (p || {}).entity_id, p || {}), direct_setup_request: (p) => requestDirectSetup(p || {}), release_create: (p) => createRelease(p || {}), release_advance: (p) => advanceRelease((p || {}).release_id, p || {}), release_destinations: (p) => setDestinations((p || {}).release_id, p || {}), release_preflight: (p) => releasePreflight((p || {}).release_id), promo_build: (p) => buildPromoPack((p || {}).release_id), release_calendar: (p) => addReleaseToCalendar((p || {}).release_id, p || {}) },
  status, confirmEntity, requestDirectSetup, createRelease, advanceRelease, setDestinations, releasePreflight, buildPromoPack, addReleaseToCalendar, listReleases, RELEASE_STAGES, ROUTES, DESTINATIONS, STUDIO47,
};
