'use strict';
// AURA Area 89 — Creator, Channel & Music Desk.
// Local control plane for OWNED artist/brand profiles, user-authored creative
// templates, campaign drafts, calendar hand-offs, and the music/label release
// chain. It never stores OAuth secrets, impersonates accounts, or publishes
// externally. Each platform stays NOT-CONNECTED until its official setup is
// completed by the administrator on the deployment host.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const schedule = require('./schedule');
const studio = require('./studio');
const forge = require('./content_forge');
const contentCommand = require('./content_command');

const FILE = path.join(__dirname, '..', 'data', 'creator_desk.json');
const CAP = 300;
const CAMPAIGN_STAGES = ['brief', 'draft_ready', 'review', 'approved', 'release_planned'];
const MUSIC_STAGES = ['concept', 'production', 'selection_qc', 'master_artwork_metadata', 'distributor_ready', 'distribution_planned'];
const STUDIO47 = { id: 'studio47', name: 'STUDIO47', state: 'COMING_SOON', note: 'zukünftige eigene, selbst gehostete Music-/Audio-Engine mit DAW-, Stem-, MIDI-, Sound-Design- und Video-Sync-Lane.' };
const PLATFORMS = [
  { id: 'facebook_page', name: 'Facebook Page', group: 'Meta', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Bestätigte Seitenrolle, Meta-App, Page Access Token im Host-Secret-Store und Review der Veröffentlichungsrechte.' },
  { id: 'instagram_business', name: 'Instagram Business / Creator', group: 'Meta', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Verknüpfte Facebook-Seite, professionelles Konto, Meta Graph API und Host-Secret-Store.' },
  { id: 'threads', name: 'Threads', group: 'Meta', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Autorisierter Threads-Account und offizielle Meta-/Threads-API.' },
  { id: 'youtube', name: 'YouTube', group: 'Video', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Google OAuth, YouTube Data API und bestätigter Kanalzugriff.' },
  { id: 'tiktok', name: 'TikTok', group: 'Video', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'TikTok Content Posting API, berechtigtes Creator-/Business-Konto und App-Freigabe.' },
  { id: 'telegram', name: 'Telegram eigener Kanal', group: 'Community', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigener BotFather-Token, Chat-Allowlist und Kanalrechte im Host-Secret-Store.' },
  { id: 'discord', name: 'Discord Community', group: 'Community', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigener Bot oder Webhook, erlaubter Server/Kanal und Secret im Host-Store.' },
  { id: 'bluesky', name: 'Bluesky', group: 'Social', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigener Account, App Password/OAuth nach Plattformvorgabe im Host-Secret-Store.' },
  { id: 'x', name: 'X', group: 'Social', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigener X-Developer-Zugang, berechtigte App und API-Plan.' },
  { id: 'linkedin_page', name: 'LinkedIn Page', group: 'Social', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Seiten-Admin, LinkedIn OAuth und zugelassene Organisationsrechte.' },
  { id: 'pinterest', name: 'Pinterest', group: 'Social', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigener Business-Account und offizieller API-Zugang.' },
  { id: 'own_site', name: 'Eigene Website / CMS', group: 'Owned', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigene Domain/CMS-Zugangsdaten; nur erlaubte Zielseite und kein Massenposting.' },
  { id: 'newsletter', name: 'Eigener Newsletter', group: 'Owned', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigenes Newsletter-System, nachweisbare Einwilligungen und SMTP/API im Host-Secret-Store.' },
  { id: 'spotify_distributor', name: 'Spotify über Distributor', group: 'Music', state: 'NOT-CONNECTED', kind: 'distribution', setup: 'Distributor, bestätigte Rechte, Release-Metadaten und Admin-Freigabe.' },
  { id: 'youtube_music_distributor', name: 'YouTube Music über Distributor', group: 'Music', state: 'NOT-CONNECTED', kind: 'distribution', setup: 'Distributor, bestätigte Rechte, Release-Metadaten und Admin-Freigabe.' },
  { id: 'soundcloud', name: 'SoundCloud', group: 'Music', state: 'NOT-CONNECTED', kind: 'official-api', setup: 'Eigener Account und nach aktueller Plattformvorgabe zugelassener API-/Veröffentlichungszugang.' },
  { id: 'bandcamp', name: 'Bandcamp', group: 'Music', state: 'NOT-CONNECTED', kind: 'manual-distribution', setup: 'Eigener Artist-/Label-Zugang; Veröffentlichungsweg je nach aktueller Bandcamp-Funktion manuell prüfen.' },
];

function empty() { return { profiles: [], templates: [], campaigns: [], music_releases: [], audit: [] }; }
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...empty(), ...db, profiles: Array.isArray(db.profiles) ? db.profiles : [], templates: Array.isArray(db.templates) ? db.templates : [], campaigns: Array.isArray(db.campaigns) ? db.campaigns : [], music_releases: Array.isArray(db.music_releases) ? db.music_releases : [], audit: Array.isArray(db.audit) ? db.audit : [] };
  } catch {
    // AURA_SEED_WRITE: fehlende/kaputte Datei einmalig mit den Defaults anlegen
    const fresh = empty(); try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* read-only ok */ } return fresh;
  }
}
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function text(value, max = 500) { return String(value || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) {
  const by = text((input || {}).approved_by || (input || {}).admin, 80);
  const authorization = text((input || {}).admin_authorization, 260);
  if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization');
  return { by, authorization };
}
function platform(idValue) { return PLATFORMS.find((x) => x.id === String(idValue)); }
function profileView(profile) { const p = platform(profile.platform); return { ...profile, platform_name: p ? p.name : profile.platform, platform_setup: p ? p.setup : 'unbekannte Plattform', connection_state: profile.connection_state || 'NOT-CONNECTED' }; }

function addProfile(input = {}) {
  const platformId = text(input.platform, 80); const p = platform(platformId);
  const label = text(input.label, 140); const owner = text(input.owner_or_operator, 100);
  if (!p) throw err('Unbekannte Plattform');
  if (platformId === 'facebook_personal') throw err('Persönliche Facebook-Profile werden nicht automatisiert verwaltet. Bitte nur eine autorisierte Facebook Page / Business-Lane verwenden.');
  if (label.length < 2) throw err('Profil-/Kanalname fehlt');
  if (!owner) throw err('Verantwortliche Person / Operator fehlt');
  if (input.owned_confirmed !== true) throw err('Bitte bestätige, dass du diesen Kanal besitzt oder dafür nachweislich autorisiert bist');
  const a = requireAdmin(input, 'Anlage eines Owned-Channel-Profils');
  const db = load();
  const profile = { id: id('channel'), label, platform: platformId, owner_or_operator: owner, owned_confirmed: true, ownership_note: text(input.ownership_note, 600), connection_state: 'NOT-CONNECTED', connection_requested_at: null, created_at: now(), created_by: a.by, approval: a };
  db.profiles.unshift(profile); audit(db, 'owned_profile_created', { profile: profile.id, platform: platformId, by: a.by }); save(db); return profileView(profile);
}
function requestConnection(profileId, input = {}) {
  const db = load(); const profile = db.profiles.find((x) => x.id === String(profileId));
  if (!profile) throw err('Owned-Channel-Profil unbekannt', 404);
  const a = requireAdmin(input, 'Anforderung einer offiziellen Plattformverbindung');
  profile.connection_state = 'SETUP_REQUESTED'; profile.connection_requested_at = now(); profile.connection_requested_by = a.by; profile.connection_authorization = a.authorization;
  audit(db, 'official_connection_requested', { profile: profile.id, platform: profile.platform, by: a.by }); save(db);
  return { profile: profileView(profile), note: 'Nur lokale Setup-Anforderung gespeichert. Keine Zugangsdaten und kein externer Request wurden ausgeführt.' };
}
function listProfiles() { return load().profiles.slice(0, CAP).map(profileView); }

function addTemplate(input = {}) {
  const name = text(input.name, 140); const body = text(input.body, 8000); const visual = text(input.visual_direction, 1800); const scope = text(input.scope, 80) || 'artist_or_brand';
  if (name.length < 2 || body.length < 20) throw err('Vorlagenname und eigener Vorlagentext (mindestens 20 Zeichen) sind Pflicht');
  if (input.owned_confirmed !== true) throw err('Bitte bestätige, dass diese Vorlage von dir stammt oder dafür autorisiert ist');
  const a = requireAdmin(input, 'Speichern einer eigenen Content-Vorlage');
  const db = load(); const template = { id: id('tpl'), name, scope, body, visual_direction: visual, language: text(input.language, 30) || 'de', owned_confirmed: true, rights_note: text(input.rights_note, 600), created_at: now(), created_by: a.by, approval: a, versions: [{ at: now(), note: 'owned template recorded' }] };
  db.templates.unshift(template); if (db.templates.length > CAP) db.templates.length = CAP;
  audit(db, 'owned_template_created', { template: template.id, by: a.by }); save(db); return template;
}
function listTemplates() { return load().templates.slice(0, CAP); }

function createCampaign(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage einer Artist-/Owned-Channel-Kampagne');
  const title = text(input.title, 180); const concept = text(input.concept, 2600); const profileIds = (Array.isArray(input.profile_ids) ? input.profile_ids : text(input.profile_ids, 800).split(/[\s,]+/)).map((x) => text(x, 80)).filter(Boolean);
  if (title.length < 3 || concept.length < 30) throw err('Kampagnentitel und eigenständiges Konzept (mindestens 30 Zeichen) sind Pflicht');
  if (!profileIds.length) throw err('Mindestens ein Owned-Channel-Profil auswählen');
  const profiles = profileIds.map((pid) => db.profiles.find((p) => p.id === pid)).filter(Boolean);
  if (profiles.length !== profileIds.length) throw err('Mindestens ein ausgewähltes Channel-Profil existiert nicht', 404);
  if (profiles.some((p) => !p.owned_confirmed)) throw err('Alle Kanäle brauchen eine Eigentums-/Autorisierungsbestätigung');
  const templateId = text(input.template_id, 80); const template = templateId ? db.templates.find((t) => t.id === templateId) : null;
  if (templateId && !template) throw err('Vorlage unbekannt', 404);
  const contentPackageId = text(input.content_package_id, 80); let contentPackage = null;
  if (contentPackageId) {
    contentPackage = contentCommand.listPackages().find((p) => p.id === contentPackageId);
    if (!contentPackage) throw err('Content-Command-Paket unbekannt', 404);
    if (!['approved', 'release_queued'].includes(contentPackage.stage)) throw err('Verknüpfte Content-Command-Pakete müssen zuerst Review und Admin-Freigabe durchlaufen');
  }
  const ownAssetNotes = text(input.own_asset_notes, 2600);
  if (!contentPackage && ownAssetNotes.length < 20) throw err('Ohne freigegebenes Content-Paket bitte eigene Vorlage/Assets und Rechtebasis dokumentieren (mindestens 20 Zeichen)');
  const campaign = { id: id('campaign'), title, concept, profile_ids: profiles.map((p) => p.id), profiles: profiles.map((p) => ({ id: p.id, label: p.label, platform: p.platform, connection_state: p.connection_state })), template_id: template ? template.id : null, template_name: template ? template.name : null, content_package_id: contentPackage ? contentPackage.id : null, music_release_id: text(input.music_release_id, 80) || null, own_asset_notes: ownAssetNotes, stage: 'brief', created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, department_plan: [
    { role: 'Artist / Creative Lead', state: 'done', output: 'eigene Richtung, Vorlage und Rechtebasis dokumentiert' },
    { role: 'Research / Editorial', state: 'pending', output: 'Kontext, Caption- und Storyline-Varianten' },
    { role: 'Studio / Visual & Video', state: 'pending', output: 'Format-Briefs, Hooks, Visual Direction' },
    { role: 'Label / Music Production', state: 'pending', output: 'Release- oder Track-Übergabe falls verknüpft' },
    { role: 'Rights / QA', state: 'pending', output: 'Rechte, Marken, Metadaten, Kanal-Fit' },
    { role: 'Calendar / Publisher', state: 'blocked_admin_gate', output: 'Termin und offizieller Adapter erst nach Freigabe' },
  ], artifacts: [], calendar_entry_id: null, approval: null, versions: [] };
  db.campaigns.unshift(campaign); if (db.campaigns.length > CAP) db.campaigns.length = CAP;
  audit(db, 'owned_campaign_created', { campaign: campaign.id, profiles: profiles.length, by: a.by }); save(db); return campaign;
}
function buildCampaignDrafts(campaignId) {
  const db = load(); const campaign = db.campaigns.find((x) => x.id === String(campaignId));
  if (!campaign) throw err('Kampagne unbekannt', 404);
  if (campaign.stage !== 'brief') throw err('Entwürfe können nur aus einem frischen Kampagnen-Brief gebaut werden');
  const template = campaign.template_id ? db.templates.find((t) => t.id === campaign.template_id) : null;
  const seed = 'Eigene Kampagne: ' + campaign.title + '. Eigenes Konzept: ' + campaign.concept + '. Eigene Asset-/Rechtebasis: ' + (campaign.own_asset_notes || 'verknüpftes freigegebenes Content-Paket') + '. Vorlage: ' + (template ? template.body : 'keine Textvorlage') + '. Visual Direction: ' + (template ? template.visual_direction : 'von Creative Lead im Review festlegen') + '. Keine Nachahmung fremder Personen oder geschützter Vorlagen.';
  const artifacts = [];
  for (const profile of campaign.profiles) {
    const p = platform(profile.platform);
    const out = studio.generate({ studio: 'social', topic: seed, platform: (p ? p.name : profile.platform) + ' · eigener autorisierter Kanal', variants: 3 });
    artifacts.push({ id: id('draft'), profile_id: profile.id, platform: profile.platform, format: 'social_campaign_draft', engine: out.studio, forge_item: out.forge_item || null, labels: out.labels || [], created_at: now() });
  }
  const brief = forge.create({ brief: '[Creator Desk / owned-channel campaign brief] ' + seed, type: 'article' });
  artifacts.push({ id: id('draft'), format: 'creative_brief', engine: 'content_forge', forge_item: brief.id, labels: (brief.labels || []).concat(['OWNED-TEMPLATE', 'HUMAN-REVIEW-REQUIRED']), created_at: now() });
  campaign.artifacts = artifacts; campaign.stage = 'draft_ready'; campaign.updated_at = now(); campaign.versions.push({ at: now(), from: 'brief', to: 'draft_ready', note: 'local Studio/Forge drafts built' });
  const editorial = campaign.department_plan.find((x) => x.role.startsWith('Research')); const creative = campaign.department_plan.find((x) => x.role.startsWith('Studio'));
  if (editorial) editorial.state = 'done'; if (creative) creative.state = 'done';
  audit(db, 'owned_campaign_drafts_built', { campaign: campaign.id, artifacts: artifacts.length }); save(db);
  return { campaign, artifacts, note: 'Lokale Entwürfe wurden gebaut. Sie sind keine externen Posts und bleiben HUMAN-REVIEW-REQUIRED.' };
}
function advanceCampaign(campaignId, input = {}) {
  const db = load(); const campaign = db.campaigns.find((x) => x.id === String(campaignId));
  if (!campaign) throw err('Kampagne unbekannt', 404);
  const target = text(input.stage, 50); const pos = CAMPAIGN_STAGES.indexOf(campaign.stage); const next = CAMPAIGN_STAGES.indexOf(target);
  if (next !== pos + 1) throw err('Kampagnenstufen laufen nacheinander: aktuell ' + campaign.stage + ', nächster Schritt ' + CAMPAIGN_STAGES[pos + 1]);
  if (target === 'review') { const note = text(input.review_notes, 2200); if (note.length < 20) throw err('Review zu Rechten, Template-Eigentum und Kanal-Fit dokumentieren (mindestens 20 Zeichen)'); campaign.review_notes = note; }
  if (target === 'approved' || target === 'release_planned') { const a = requireAdmin(input, target === 'approved' ? 'Kampagnenfreigabe' : 'Release-Planung'); if (target === 'approved') campaign.approval = { at: now(), by: a.by, authorization: a.authorization }; }
  campaign.stage = target; campaign.updated_at = now(); campaign.versions.push({ at: now(), to: target, by: text(input.approved_by || input.admin, 80) || 'workflow', note: text(input.note, 500) });
  const rights = campaign.department_plan.find((x) => x.role.startsWith('Rights')); const publisher = campaign.department_plan.find((x) => x.role.startsWith('Calendar'));
  if (target === 'review' && rights) rights.state = 'done'; if (target === 'approved' && publisher) publisher.state = 'ready_after_admin_approval';
  audit(db, 'owned_campaign_stage', { campaign: campaign.id, stage: target }); save(db); return campaign;
}
function addCampaignToCalendar(campaignId, input = {}) {
  const db = load(); const campaign = db.campaigns.find((x) => x.id === String(campaignId));
  if (!campaign) throw err('Kampagne unbekannt', 404);
  if (!['approved', 'release_planned'].includes(campaign.stage)) throw err('Kalender-/Release-Arbeit erst nach Kampagnenfreigabe anlegen');
  if (campaign.calendar_entry_id) throw err('Diese Kampagne hat bereits einen Kalendertermin', 409);
  const a = requireAdmin(input, 'Kalendertermin für eine Kampagne');
  const entryResult = schedule.add({ day: text(input.day, 12) || 'mon', role: text(input.role, 60) || 'creator_lead', service: 'Creator / Channel Desk', start: text(input.start, 10) || '10:00', duration_min: Number(input.duration_min) || 45, task: campaign.title + ' · ' + text(input.task, 240) });
  campaign.calendar_entry_id = entryResult.entry.id; campaign.calendar_authorization = { by: a.by, at: now(), authorization: a.authorization }; campaign.updated_at = now();
  audit(db, 'campaign_calendar_added', { campaign: campaign.id, schedule: entryResult.entry.id, by: a.by }); save(db);
  return { campaign, schedule: entryResult };
}
function listCampaigns() { return load().campaigns.slice(0, CAP); }

function createMusicRelease(input = {}) {
  const a = requireAdmin(input, 'Anlage eines Musik-/Label-Release-Pakets');
  const artist = text(input.artist, 140); const title = text(input.title, 180); const source = text(input.production_source, 50) || 'daw';
  if (artist.length < 2 || title.length < 2) throw err('Artist und Track-/Release-Titel fehlen');
  if (!['suno_plus', 'daw', 'authorized_external'].includes(source)) throw err('Produktionsquelle muss suno_plus, daw oder authorized_external sein');
  const rights = text(input.rights_confirmation, 1800); const sunoPlan = text(input.suno_plan_note, 800);
  if (rights.length < 30) throw err('Rechte-/Mitwirkenden- und Lizenzbasis dokumentieren (mindestens 30 Zeichen)');
  if (source === 'suno_plus' && sunoPlan.length < 20) throw err('Für Suno+ die aktuelle Plan-/Lizenzbasis und den Prüfzeitpunkt dokumentieren (mindestens 20 Zeichen)');
  const db = load(); const release = { id: id('music'), artist, title, production_source: source, rights_confirmation: rights, suno_plan_note: source === 'suno_plus' ? sunoPlan : '', stage: 'concept', qc_notes: '', master_notes: '', metadata: {}, distributor: '', distributor_authorization: null, created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, versions: [], linked_campaign_ids: [] };
  db.music_releases.unshift(release); if (db.music_releases.length > CAP) db.music_releases.length = CAP;
  audit(db, 'music_release_created', { release: release.id, source, by: a.by }); save(db); return release;
}
function advanceMusicRelease(releaseId, input = {}) {
  const db = load(); const release = db.music_releases.find((x) => x.id === String(releaseId));
  if (!release) throw err('Musik-Release unbekannt', 404);
  const target = text(input.stage, 60); const pos = MUSIC_STAGES.indexOf(release.stage); const next = MUSIC_STAGES.indexOf(target);
  if (next !== pos + 1) throw err('Musikstufen laufen nacheinander: aktuell ' + release.stage + ', nächster Schritt ' + MUSIC_STAGES[pos + 1]);
  if (target === 'selection_qc') { const notes = text(input.qc_notes, 1800); if (notes.length < 20) throw err('Auswahl-/Qualitätskontrolle dokumentieren (mindestens 20 Zeichen)'); release.qc_notes = notes; }
  if (target === 'master_artwork_metadata') { const master = text(input.master_notes, 1800); const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}; if (master.length < 20 || !text(metadata.release_title || release.title, 180)) throw err('Master-/Artwork-Notiz und Release-Metadaten dokumentieren'); release.master_notes = master; release.metadata = { release_title: text(metadata.release_title || release.title, 180), artist: text(metadata.artist || release.artist, 140), genre: text(metadata.genre, 100), language: text(metadata.language, 40), explicit: Boolean(metadata.explicit), artwork_rights: text(metadata.artwork_rights, 600) }; }
  if (target === 'distributor_ready') { const distributor = text(input.distributor, 140); if (!distributor) throw err('Distributor fehlt'); const a = requireAdmin(input, 'Distributor-Übergabe'); release.distributor = distributor; release.distributor_authorization = { by: a.by, authorization: a.authorization, at: now() }; }
  if (target === 'distribution_planned') requireAdmin(input, 'Distribution-/Release-Planung');
  release.stage = target; release.updated_at = now(); release.versions.push({ at: now(), to: target, by: text(input.approved_by || input.admin, 80) || 'workflow', note: text(input.note, 500) });
  audit(db, 'music_release_stage', { release: release.id, stage: target }); save(db); return release;
}
function listMusicReleases() { return load().music_releases.slice(0, CAP); }
function status() {
  const db = load();
  return { area: '89', mode: 'LIVE', name: 'Creator, Channel & Music Desk', studio47: STUDIO47, profiles: { total: db.profiles.length, setup_requested: db.profiles.filter((x) => x.connection_state === 'SETUP_REQUESTED').length, connected: db.profiles.filter((x) => x.connection_state === 'LIVE').length }, templates: { total: db.templates.length }, campaigns: { total: db.campaigns.length, by_stage: Object.fromEntries(CAMPAIGN_STAGES.map((s) => [s, db.campaigns.filter((x) => x.stage === s).length])) }, music_releases: { total: db.music_releases.length, by_stage: Object.fromEntries(MUSIC_STAGES.map((s) => [s, db.music_releases.filter((x) => x.stage === s).length])) }, platforms: PLATFORMS, policy: ['Nur bestätigte eigene/autorisierte Profile', 'Keine persönliche Facebook-Profil-Automation', 'Vorlagen müssen eigene/autorisierte Assets sein', 'Keine künstlichen Likes, Views oder Kommentare', 'Keine externen Posts ohne offizielle Verbindung und explizite Admin-Freigabe', 'Suno+/Musikrechte und aktuelle Planbedingungen vor Distribution konkret prüfen'] };
}
module.exports = {
  meta: { area: '89', id: 'creator_desk', name: 'Creator, Channel & Music Desk (owned templates + official channels + label chain)', state: 'live' },
  actions: { status: () => status(), profile_add: (p) => addProfile(p || {}), connection_request: (p) => requestConnection((p || {}).profile_id, p || {}), template_add: (p) => addTemplate(p || {}), campaign_create: (p) => createCampaign(p || {}), campaign_build: (p) => buildCampaignDrafts((p || {}).campaign_id), campaign_advance: (p) => advanceCampaign((p || {}).campaign_id, p || {}), campaign_calendar: (p) => addCampaignToCalendar((p || {}).campaign_id, p || {}), music_create: (p) => createMusicRelease(p || {}), music_advance: (p) => advanceMusicRelease((p || {}).release_id, p || {}) },
  status, addProfile, requestConnection, listProfiles, addTemplate, listTemplates, createCampaign, buildCampaignDrafts, advanceCampaign, addCampaignToCalendar, listCampaigns, createMusicRelease, advanceMusicRelease, listMusicReleases, PLATFORMS, CAMPAIGN_STAGES, MUSIC_STAGES, STUDIO47,
};
