'use strict';
// AURA Area 92 — Social Control Plane.
// This is an owned-account, official-connector-first operating layer. It
// produces platform-specific creative, short-form and paid-activation plans,
// but it never stores account passwords/tokens and never claims an external
// post, ad spend, analytics result or account connection that has not happened.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mediaNewsroom = require('./media_newsroom');

const FILE = path.join(__dirname, '..', 'data', 'social_control.json');
const CAP = 500;
const LAUNCH_STAGES = ['brief', 'derivatives_ready', 'routes_ready', 'review', 'approved', 'queue_ready'];

// A lane is a specific, useful publishing surface — not a claim that an AURA
// account, API contract or ad account already exists there.
const LANES = [
  ['youtube_video', 'YouTube Video', 'Video', 'official_oauth_api', ['long_video', 'premiere', 'thumbnail', 'chapters', 'captions'], true],
  ['youtube_shorts', 'YouTube Shorts', 'Video', 'official_oauth_api', ['short_vertical', 'captions', 'title', 'thumbnail'], true],
  ['youtube_community', 'YouTube Community', 'Video', 'official_oauth_api', ['community_post', 'poll', 'image'], false],
  ['youtube_live', 'YouTube Live', 'Video', 'official_oauth_api', ['live_schedule', 'trailer', 'chat_moderation_plan'], false],
  ['tiktok_video', 'TikTok Video', 'Video', 'official_content_posting_api', ['short_vertical', 'captions', 'sound', 'cover'], true],
  ['tiktok_photo', 'TikTok Photo Mode', 'Video', 'official_content_posting_api', ['carousel_vertical', 'caption', 'sound'], false],
  ['instagram_reels', 'Instagram Reels', 'Meta', 'official_graph_api', ['short_vertical', 'cover', 'captions', 'collab_plan'], true],
  ['instagram_feed', 'Instagram Feed / Carousel', 'Meta', 'official_graph_api', ['square', 'portrait', 'carousel', 'caption'], true],
  ['instagram_stories', 'Instagram Stories', 'Meta', 'official_graph_api', ['story_vertical', 'link_sticker_plan', 'poll_plan'], false],
  ['instagram_broadcast', 'Instagram Broadcast Channel', 'Meta', 'official_graph_api', ['announcement', 'link', 'poll'], false],
  ['facebook_reels', 'Facebook Reels', 'Meta', 'official_graph_api', ['short_vertical', 'caption', 'cover'], true],
  ['facebook_page', 'Facebook Page Feed', 'Meta', 'official_graph_api', ['video', 'image', 'carousel', 'link'], true],
  ['facebook_stories', 'Facebook Stories', 'Meta', 'official_graph_api', ['story_vertical', 'link_plan'], false],
  ['threads_post', 'Threads', 'Meta', 'official_threads_api', ['text_post', 'image', 'video'], false],
  ['x_video', 'X Video', 'Social', 'official_api', ['short_video', 'caption', 'thread_plan'], true],
  ['x_post', 'X Post / Thread', 'Social', 'official_api', ['text_post', 'thread', 'image'], false],
  ['bluesky_post', 'Bluesky', 'Social', 'official_api', ['text_post', 'image', 'video'], false],
  ['mastodon_post', 'Mastodon', 'Social', 'official_api', ['text_post', 'video', 'alt_text'], false],
  ['snapchat_spotlight', 'Snapchat Spotlight', 'Social', 'official_api', ['short_vertical', 'caption', 'sound'], true],
  ['pinterest_pin', 'Pinterest Pins', 'Social', 'official_api', ['vertical_pin', 'idea_pin', 'link'], true],
  ['linkedin_video', 'LinkedIn Video', 'Professional', 'official_api', ['video', 'subtitle', 'professional_copy'], true],
  ['linkedin_page', 'LinkedIn Page Update', 'Professional', 'official_api', ['post', 'document', 'link'], true],
  ['twitch_clips', 'Twitch Clips', 'Live', 'official_api', ['clip', 'title', 'category'], false],
  ['twitch_schedule', 'Twitch Schedule', 'Live', 'official_api', ['schedule', 'go_live_notice'], false],
  ['discord_announcement', 'Discord Announcement', 'Community', 'official_bot_or_webhook', ['announcement', 'embed', 'event'], false],
  ['telegram_channel', 'Telegram Channel', 'Community', 'official_bot_api', ['post', 'media', 'button'], false],
  ['reddit_community', 'Reddit Community', 'Community', 'manual_or_authorized_api', ['community_post', 'comment_plan'], false],
  ['whatsapp_channel', 'WhatsApp Channel', 'Community', 'official_business_api', ['channel_update', 'media', 'link'], false],
  ['website_article', 'Owned Website Article', 'Owned', 'official_cms_api', ['article', 'embed', 'seo_meta'], false],
  ['website_video', 'Owned Website Video', 'Owned', 'official_cms_api', ['video_embed', 'landing_page', 'cta'], false],
  ['newsletter', 'Owned Newsletter', 'Owned', 'official_email_api', ['newsletter', 'cta', 'segment_plan'], false],
  ['substack', 'Substack Publication', 'Owned', 'manual_official_publish', ['post', 'video_embed', 'email'], false],
  ['patreon', 'Patreon', 'Owned', 'official_api_or_manual', ['member_post', 'early_access', 'tiers'], false],
  ['kofi', 'Ko-fi', 'Owned', 'manual_official_publish', ['supporter_post', 'shop_link'], false],
  ['spotify_artist_canvas', 'Spotify for Artists Canvas', 'Music', 'distributor_or_artist_tool', ['canvas_vertical', 'metadata'], false],
  ['spotify_artist_clips', 'Spotify for Artists Clips', 'Music', 'artist_tool_setup_required', ['short_vertical', 'artist_pitch'], false],
  ['youtube_music_catalog', 'YouTube Music Catalog', 'Music', 'distributor_delivery', ['release_metadata', 'artwork', 'audio_master'], false],
  ['apple_music_catalog', 'Apple Music Catalog', 'Music', 'distributor_delivery', ['release_metadata', 'artwork', 'audio_master'], false],
  ['soundcloud_track', 'SoundCloud', 'Music', 'official_api_or_manual', ['audio', 'artwork', 'description'], false],
  ['bandcamp_release', 'Bandcamp', 'Music', 'manual_official_publish', ['audio', 'merch', 'release_copy'], false],
  ['audiomack_release', 'Audiomack', 'Music', 'official_or_distributor_setup', ['audio', 'artwork', 'metadata'], false],
  ['mixcloud_show', 'Mixcloud', 'Music', 'official_or_manual', ['dj_mix', 'tracklist', 'show_notes'], false],
  ['beatport_release', 'Beatport', 'DJ Store', 'distributor_delivery', ['electronic_metadata', 'audio_master', 'artwork'], false],
  ['traxsource_release', 'Traxsource', 'DJ Store', 'distributor_delivery', ['electronic_metadata', 'audio_master', 'artwork'], false],
  ['google_business_profile', 'Google Business Profile', 'Discovery', 'official_api', ['update', 'event', 'video'], false],
  ['vimeo_video', 'Vimeo', 'Video', 'official_api', ['video', 'showcase', 'embed'], false],
];
const DEFAULT_LANES = ['youtube_video', 'youtube_shorts', 'tiktok_video', 'instagram_reels', 'instagram_stories', 'facebook_reels', 'threads_post', 'telegram_channel', 'website_video', 'newsletter'];
const AD_OBJECTIVES = ['video_views', 'traffic', 'engagement', 'lead_generation', 'website_conversions', 'music_release_awareness'];
const WEB_PROPERTY_TYPES = ['landing_page', 'artist_site', 'label_site', 'release_page', 'shop', 'editorial', 'community_hub', 'portfolio'];
const OPTIMIZATION_EVENTS = ['landing_page_view', 'view_content', 'sign_up', 'lead', 'pre_save_click', 'shop_click', 'purchase'];
const GROWTH_WORKFLOWS = [
  { id: 'wf-master-to-wave', name: 'Master → Social Wave', steps: ['Freigegebener Master / Media-Projekt', '10 Cutdown-/Caption-/Cover-Spezifikationen', 'Plattform- und Subfunktionsrouten', 'Review + Admin-Gate', 'lokale Queue / offizieller Connector'] },
  { id: 'wf-social-to-page', name: 'Social → Owned Page', steps: ['Zielseite auswählen', 'UTM-Matrix pro Lane erzeugen', 'Landing-Page CTA + SEO/Accessibility Checklist', 'CMS-/Tracking-Setup anfordern', 'Page-Handoff NOT_DEPLOYED bis zur echten CMS-Übernahme'] },
  { id: 'wf-paid-flight', name: 'Paid Flight mit Budget-Guard', steps: ['Creative auswählen', 'Objective + Event + Zielseite', 'Daily + Total Cap', 'Audience-Hypothese + Placement-Plan', 'finale Freigabe', 'erst dann offizielles Werbekonto'] },
  { id: 'wf-learn-loop', name: 'Growth-Learn Loop', steps: ['offizielle Reporting-Daten importieren', 'Creative/CTA/Landing-Page vergleichen', 'Gewinner als neue Variante markieren', 'nächsten Short-/Page-Test vorbereiten', 'nie Engagement simulieren'] },
];

function laneFrom(tuple) {
  const [id, name, group, connection, formats, ads] = tuple;
  return { id, name, group, connection, formats, ads_supported: ads, state: 'NOT_CONNECTED', note: 'Planungs-Lane. Account, OAuth/API- oder Distributor-Zugang und finale Freigabe sind noch nicht eingerichtet.' };
}
function empty() { return { accounts: [], web_properties: [], launches: [], custom_lanes: [], audit: [] }; }
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...empty(), ...db, accounts: Array.isArray(db.accounts) ? db.accounts : [], web_properties: Array.isArray(db.web_properties) ? db.web_properties : [], launches: Array.isArray(db.launches) ? db.launches : [], custom_lanes: Array.isArray(db.custom_lanes) ? db.custom_lanes : [], audit: Array.isArray(db.audit) ? db.audit : [] };
  } catch { return empty(); }
}
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function text(v, max = 600) { return String(v || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) {
  const by = text((input || {}).approved_by || (input || {}).admin, 80);
  const authorization = text((input || {}).admin_authorization, 280);
  if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization');
  return { by, authorization };
}
function safeHttps(value, label, required = false) {
  const raw = text(value, 1000);
  if (!raw && !required) return '';
  let u; try { u = new URL(raw); } catch { throw err(label + ' muss eine gültige HTTPS-URL sein'); }
  if (u.protocol !== 'https:') throw err(label + ' muss HTTPS verwenden');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) throw err(label + ' darf keinen lokalen/privaten Host verwenden');
  return u.toString();
}
function allLanes(db = load()) {
  const builtIn = LANES.map(laneFrom);
  const custom = db.custom_lanes.map((x) => ({ ...x, state: 'NOT_CONNECTED', note: 'Eigene Planungs-Lane. Offiziellen Zugang und Rechteprüfung vor Einsatz einrichten.' }));
  return builtIn.concat(custom);
}
function lane(db, laneId) { return allLanes(db).find((x) => x.id === String(laneId)); }
function ids(input, max = 80) {
  const raw = Array.isArray(input) ? input : text(input, 2000).split(/[\s,]+/);
  return [...new Set(raw.map((x) => text(x, 90)).filter(Boolean))].slice(0, max);
}
function accountView(db, account) {
  const l = lane(db, account.lane_id);
  return { ...account, lane_name: l ? l.name : account.lane_id, lane_group: l ? l.group : 'unknown', connection: l ? l.connection : 'unknown', external_state: account.connection_state === 'CONNECTED' ? 'CONNECTION_DECLARATION_REQUIRES_HOST_VERIFICATION' : 'NOT_CONNECTED' };
}
function launchView(db, launch) {
  const accounts = db.accounts || [];
  const routes = (launch.routes || []).map((r) => {
    const l = lane(db, r.lane_id);
    const account = accounts.find((a) => a.id === r.account_id);
    return { ...r, lane_name: l ? l.name : r.lane_id, lane_group: l ? l.group : '', account_label: account ? account.label : null, connection_state: account ? account.connection_state : 'NO_ACCOUNT', external_state: 'NOT_PUBLISHED' };
  });
  return { ...launch, routes, selected_lanes: (launch.selected_lane_ids || []).map((lid) => lane(db, lid)).filter(Boolean), external_state: 'NOT_PUBLISHED' };
}

function addAccount(input = {}) {
  const db = load(); const l = lane(db, text(input.lane_id, 90));
  const label = text(input.label, 140); const owner = text(input.owner_or_operator, 120);
  if (!l) throw err('Unbekannte Social-Lane');
  if (label.length < 2 || owner.length < 2) throw err('Konto-/Kanalname und verantwortlicher Operator sind Pflicht');
  if (input.owned_confirmed !== true) throw err('Bitte bestätige, dass du diesen Account besitzt oder nachweislich verwalten darfst');
  const a = requireAdmin(input, 'Anlage eines Social-Accounts');
  const profileUrl = safeHttps(input.profile_url, 'Profil-URL', false);
  const account = { id: id('socialacct'), lane_id: l.id, label, profile_url: profileUrl, owner_or_operator: owner, ownership_note: text(input.ownership_note, 800), owned_confirmed: true, connection_state: 'NOT_CONNECTED', setup_state: 'LOCAL_RECORD_ONLY', credential_policy: 'NO_PASSWORDS_OR_TOKENS_STORED', created_at: now(), created_by: a.by, approval: a };
  db.accounts.unshift(account); audit(db, 'social_account_created', { account: account.id, lane: l.id, by: a.by }); save(db); return accountView(db, account);
}
function requestConnection(accountId, input = {}) {
  const db = load(); const account = db.accounts.find((x) => x.id === String(accountId));
  if (!account) throw err('Social-Account unbekannt', 404);
  const l = lane(db, account.lane_id); const a = requireAdmin(input, 'offizielles Connector-Setup');
  account.connection_state = 'SETUP_REQUESTED'; account.setup_state = 'OFFICIAL_SETUP_REQUIRED'; account.connection_requested_at = now(); account.connection_requested_by = a.by; account.connection_authorization = a.authorization;
  audit(db, 'social_connection_requested', { account: account.id, lane: account.lane_id, by: a.by }); save(db);
  return { account: accountView(db, account), setup: { lane: l, required: l ? l.connection : 'official connection', rule: 'OAuth/API- oder Distributor-Autorisierung nur im offiziellen Anbieter-Flow bzw. im Host-Secret-Store. Keine Passwörter, Tokens oder Cookies in AURA-Formulare eintragen.' } };
}
function addCustomLane(input = {}) {
  const db = load(); const name = text(input.name, 120); const group = text(input.group, 80) || 'Custom'; const connection = text(input.connection, 120) || 'official_setup_required'; const formats = ids(input.formats, 20); const a = requireAdmin(input, 'Erweiterung der Social-Lane-Matrix');
  if (name.length < 2) throw err('Name der neuen Plattform-/Subfunktion fehlt');
  if (!formats.length) throw err('Mindestens ein Format für die neue Lane angeben');
  const custom = { id: 'custom_' + id('lane').slice(5), name, group, connection, formats, ads_supported: input.ads_supported === true, created_at: now(), created_by: a.by, note: text(input.note, 500) };
  db.custom_lanes.push(custom); audit(db, 'social_custom_lane_added', { lane: custom.id, by: a.by }); save(db); return lane(db, custom.id);
}

function webPropertyView(property) {
  return { ...property, external_state: property.connection_state === 'CONNECTED' ? 'CONNECTION_DECLARATION_REQUIRES_HOST_VERIFICATION' : 'NOT_DEPLOYED' };
}
function addWebProperty(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage einer Owned Web Property');
  const name = text(input.name, 160); const kind = text(input.kind, 80) || 'landing_page'; const owner = text(input.owner_or_operator, 120);
  if (!WEB_PROPERTY_TYPES.includes(kind)) throw err('Unbekannter Property-Typ');
  if (name.length < 2 || owner.length < 2) throw err('Name und verantwortlicher Operator sind Pflicht');
  if (input.owned_confirmed !== true) throw err('Bitte bestätige die Eigentums-/Verwaltungsberechtigung für diese Web Property');
  const baseUrl = safeHttps(input.base_url, 'Basis-URL', true);
  const property = { id: id('webprop'), name, kind, base_url: baseUrl, owner_or_operator: owner, owned_confirmed: true, ownership_note: text(input.ownership_note, 900), cms_kind: text(input.cms_kind, 100) || 'not_declared', tracking_plan: text(input.tracking_plan, 900), connection_state: 'NOT_CONNECTED', setup_state: 'LOCAL_RECORD_ONLY', credential_policy: 'NO_CMS_PASSWORDS_OR_TOKENS_STORED', created_at: now(), created_by: a.by, approval: a };
  db.web_properties.unshift(property); audit(db, 'web_property_created', { property: property.id, kind, by: a.by }); save(db); return webPropertyView(property);
}
function requestWebConnection(propertyId, input = {}) {
  const db = load(); const property = db.web_properties.find((x) => x.id === String(propertyId)); if (!property) throw err('Web Property unbekannt', 404);
  const a = requireAdmin(input, 'offizielles CMS-/Tracking-Setup');
  property.connection_state = 'SETUP_REQUESTED'; property.setup_state = 'OFFICIAL_CMS_OR_TRACKING_SETUP_REQUIRED'; property.connection_requested_at = now(); property.connection_requested_by = a.by; property.connection_authorization = a.authorization;
  audit(db, 'web_property_connection_requested', { property: property.id, by: a.by }); save(db);
  return { property: webPropertyView(property), setup: { required: 'CMS API / deploy credential / analytics or tag-manager access must be set up through the owned host and official provider flow', rule: 'Keine CMS-Passwörter, Tokens, Cookies oder Tag-Manager-Secrets in AURA eingeben.' } };
}
function slug(value) { return text(value, 160).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'campaign'; }
function buildWebHandoff(launchId, input = {}) {
  const db = load(); const launch = db.launches.find((x) => x.id === String(launchId)); if (!launch) throw err('Social-Launch unbekannt', 404);
  if (!['routes_ready', 'review', 'approved', 'queue_ready'].includes(launch.stage) || !(launch.routes || []).length) throw err('Website-Handoff erst nach den Plattformrouten erstellen');
  const property = db.web_properties.find((x) => x.id === text(input.web_property_id, 100)); if (!property) throw err('Bitte eine vorhandene Owned Web Property auswählen', 404);
  const a = requireAdmin(input, 'Website-/Landing-Page-Handoff'); const campaign = slug(input.campaign_slug || launch.title); const routePath = text(input.landing_path, 320).replace(/^\/+/, '');
  const landingUrl = property.base_url.replace(/\/$/, '') + (routePath ? '/' + routePath : '');
  const utm = (launch.routes || []).map((r) => ({ route_id: r.id, lane_id: r.lane_id, url: landingUrl + (landingUrl.includes('?') ? '&' : '?') + 'utm_source=' + encodeURIComponent(r.lane_id) + '&utm_medium=social&utm_campaign=' + encodeURIComponent(campaign) + '&utm_content=' + encodeURIComponent(r.format || 'creative') }));
  launch.web_handoff = { id: id('webhandoff'), web_property_id: property.id, property_name: property.name, campaign_slug: campaign, landing_url: landingUrl, optimization_event: text(input.optimization_event, 80) || 'landing_page_view', utm, page_checklist: ['One clear headline + visual match to social creative', 'Mobile-first speed and readable captions/alt text', 'One primary CTA with consent-aware measurement', 'Music/release/legal/advertising disclosure reviewed', 'UTM targets checked before publishing'], state: 'WEB_HANDOFF_READY', external_state: 'NOT_DEPLOYED', created_at: now(), created_by: a.by, approval: a };
  launch.updated_at = now(); audit(db, 'social_web_handoff_built', { launch: launch.id, property: property.id, handoff: launch.web_handoff.id, by: a.by }); save(db); return launchView(db, launch);
}
function listWebProperties() { return load().web_properties.slice(0, CAP).map(webPropertyView); }

function projectFor(input) {
  const mediaId = text(input.media_project_id, 100);
  if (!mediaId) return null;
  const project = mediaNewsroom.listProjects().find((x) => x.id === mediaId);
  if (!project) throw err('Media-Projekt unbekannt', 404);
  if (project.stage !== 'approved') throw err('Das verknüpfte Media-Projekt muss erst geprüft und freigegeben sein');
  return project;
}
function createLaunch(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines Social-Launches');
  const title = text(input.title, 180); const project = projectFor(input); const sourceRef = text(input.source_video_ref, 700);
  if (title.length < 3) throw err('Launch-Titel fehlt');
  if (!project && sourceRef.length < 4) throw err('Ein freigegebenes Media-Projekt oder eine lokale/owned Video-Referenz ist Pflicht');
  const rights = text(input.rights_confirmation, 1800); if (rights.length < 30) throw err('Rechte-/Werbe-/Musikfreigabe bitte nachvollziehbar dokumentieren (mindestens 30 Zeichen)');
  const chosen = ids(input.lane_ids && input.lane_ids.length ? input.lane_ids : DEFAULT_LANES, 60);
  if (!chosen.length || chosen.some((x) => !lane(db, x))) throw err('Mindestens eine bekannte Social-Lane auswählen');
  const launch = {
    id: id('launch'), title, campaign_goal: text(input.campaign_goal, 240) || 'audience_growth', audience: text(input.audience, 300), cta: text(input.cta, 300),
    media_project_id: project ? project.id : null, source_video_ref: project ? ('media-project:' + project.id) : sourceRef, rights_confirmation: rights,
    selected_lane_ids: chosen, stage: 'brief', derivative_pack: [], routes: [], paid_activation: null, approval: null, created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, versions: [{ at: now(), to: 'brief', by: a.by, note: 'local social launch brief created' }],
  };
  db.launches.unshift(launch); if (db.launches.length > CAP) db.launches.length = CAP; audit(db, 'social_launch_created', { launch: launch.id, lanes: chosen.length, project: launch.media_project_id, by: a.by }); save(db); return launchView(db, launch);
}
function derivativeSpecs(sourceRef) {
  const stamp = now();
  return [
    { id: id('asset'), type: 'master_16x9_reference', aspect: '16:9', duration_s: 'full', source_ref: sourceRef, state: 'SOURCE_REFERENCE_READY', purpose: 'Longform master / YouTube / website' },
    { id: id('asset'), type: 'short_hook_01', aspect: '9:16', duration_s: 15, cut_window: '00:00–00:15', state: 'RENDER_PLAN_READY', purpose: 'Hook-first Reel / TikTok / Short / ad' },
    { id: id('asset'), type: 'short_story_02', aspect: '9:16', duration_s: 30, cut_window: '00:15–00:45', state: 'RENDER_PLAN_READY', purpose: 'Narrative vertical cutdown' },
    { id: id('asset'), type: 'short_value_03', aspect: '9:16', duration_s: 58, cut_window: '00:45–01:43', state: 'RENDER_PLAN_READY', purpose: 'Standalone short with CTA' },
    { id: id('asset'), type: 'ad_bumper_04', aspect: '9:16', duration_s: 6, cut_window: 'select strongest 6 seconds', state: 'RENDER_PLAN_READY', purpose: 'Paid vertical bumper' },
    { id: id('asset'), type: 'feed_square_05', aspect: '1:1', duration_s: 15, cut_window: 'hook + proof + CTA', state: 'RENDER_PLAN_READY', purpose: 'Feed / social paid placement' },
    { id: id('asset'), type: 'story_06', aspect: '9:16', duration_s: 15, cut_window: 'hook + swipe/click CTA', state: 'RENDER_PLAN_READY', purpose: 'Stories / channel update' },
    { id: id('asset'), type: 'thumbnail_cover_07', aspect: '16:9 + 9:16', duration_s: 0, state: 'DESIGN_BRIEF_READY', purpose: 'YouTube thumbnail and vertical cover' },
    { id: id('asset'), type: 'captions_subtitles_08', aspect: 'all', duration_s: 'matches cut', state: 'TEXT_TRACK_READY', purpose: 'SRT/caption pass, accessibility and silent autoplay' },
    { id: id('asset'), type: 'music_visualizer_09', aspect: '9:16', duration_s: 30, state: 'RENDER_PLAN_READY', purpose: 'Release teaser / music visualizer' },
  ].map((x) => ({ ...x, created_at: stamp }));
}
function buildDerivatives(launchId) {
  const db = load(); const launch = db.launches.find((x) => x.id === String(launchId));
  if (!launch) throw err('Social-Launch unbekannt', 404);
  if (launch.stage !== 'brief') throw err('Derivate können nur einmal direkt nach dem Brief gebaut werden');
  launch.derivative_pack = derivativeSpecs(launch.source_video_ref); launch.stage = 'derivatives_ready'; launch.updated_at = now(); launch.versions.push({ at: now(), to: launch.stage, by: 'social_content_orchestrator', note: 'vertical short, ad and caption render manifests built' });
  audit(db, 'social_derivative_pack_built', { launch: launch.id, assets: launch.derivative_pack.length }); save(db);
  return { launch: launchView(db, launch), note: 'Es wurde ein lokales Render-/Schnitt-Paket erstellt: Shorts, Reels, Story-, Feed- und Ad-Cutdowns inklusive Caption-/Cover-Vorgaben. Das ist kein behaupteter Video-Render; die Referenzen sind bereit für den autorisierten Renderer.' };
}
function assetForLane(assets, laneId) {
  if (/youtube_video|website_video|vimeo_video/.test(laneId)) return assets.find((x) => x.type === 'master_16x9_reference');
  if (/feed|linkedin|pinterest|community|substack|newsletter|website_article|patreon|kofi|telegram|discord|whatsapp|reddit|threads|x_post|bluesky|mastodon/.test(laneId)) return assets.find((x) => x.type === 'feed_square_05') || assets.find((x) => x.type === 'short_hook_01');
  if (/music|soundcloud|bandcamp|audiomack|mixcloud|beatport|traxsource|spotify|apple/.test(laneId)) return assets.find((x) => x.type === 'music_visualizer_09') || assets.find((x) => x.type === 'thumbnail_cover_07');
  return assets.find((x) => x.type === 'short_value_03') || assets.find((x) => x.type === 'short_hook_01');
}
function buildRoutes(launchId) {
  const db = load(); const launch = db.launches.find((x) => x.id === String(launchId));
  if (!launch) throw err('Social-Launch unbekannt', 404);
  if (launch.stage !== 'derivatives_ready') throw err('Erst das Derivative-Pack bauen');
  const routes = launch.selected_lane_ids.map((laneId) => {
    const l = lane(db, laneId); const asset = assetForLane(launch.derivative_pack, laneId); const account = db.accounts.find((x) => x.lane_id === laneId);
    return { id: id('route'), lane_id: laneId, account_id: account ? account.id : null, asset_id: asset ? asset.id : null, format: asset ? asset.type : 'copy_only', copy: { hook: 'Hook aus dem ersten sichtbaren/gesprochenen Moment ableiten', value: 'eigenen Nutzen, Kontext oder Release-Moment präzise erklären', cta: launch.cta || 'Zur vollständigen Version / zum Release wechseln', disclosure: 'Rechte, Musik, Werbung und Partnerschaften vor Veröffentlichung pro Plattform prüfen' }, caption_state: 'READY_FOR_HUMAN_EDIT', scheduling_state: 'NOT_SCHEDULED', publication_state: 'NOT_PUBLISHED', connection_gate: account ? account.connection_state : 'NO_ACCOUNT', platform_capabilities: l.formats };
  });
  launch.routes = routes; launch.stage = 'routes_ready'; launch.updated_at = now(); launch.versions.push({ at: now(), to: launch.stage, by: 'social_content_orchestrator', note: routes.length + ' lane-specific publish plans built' });
  audit(db, 'social_routes_built', { launch: launch.id, routes: routes.length }); save(db);
  return { launch: launchView(db, launch), note: 'Jede Ziel-Lane hat nun eine eigene Asset-Zuordnung, Caption-/Hook-/CTA-Plan und einen ehrlichen Connector-Gate-Status. Es wurde nichts extern gepostet.' };
}
function preparePaidActivation(launchId, input = {}) {
  const db = load(); const launch = db.launches.find((x) => x.id === String(launchId));
  if (!launch) throw err('Social-Launch unbekannt', 404);
  if (!['routes_ready', 'review', 'approved', 'queue_ready'].includes(launch.stage)) throw err('Werbeplan erst nach den Plattform-Routen erstellen');
  const a = requireAdmin(input, 'Erstellung eines Paid-Activation-Plans'); const objective = text(input.objective, 60) || 'video_views';
  if (!AD_OBJECTIVES.includes(objective)) throw err('Unbekanntes Kampagnenziel');
  const event = text(input.optimization_event, 80) || 'landing_page_view'; if (!OPTIMIZATION_EVENTS.includes(event)) throw err('Unbekanntes Optimierungs-Event');
  const currency = text(input.currency, 6).toUpperCase() || 'EUR'; const cap = Number(input.daily_cap); const totalInput = input.total_cap === undefined || input.total_cap === '' ? cap * 14 : Number(input.total_cap);
  if (!Number.isFinite(cap) || cap <= 0 || cap > 100000) throw err('Tageslimit muss zwischen 0 und 100000 liegen');
  if (!Number.isFinite(totalInput) || totalInput < cap || totalInput > 10000000) throw err('Gesamtlimit muss mindestens dem Tageslimit entsprechen und plausibel sein');
  const propertyId = text(input.web_property_id, 100); const property = propertyId ? db.web_properties.find((x) => x.id === propertyId) : null;
  if (propertyId && !property) throw err('Gewählte Owned Web Property existiert nicht', 404);
  const routeIds = ids(input.route_ids, 60); const routes = routeIds.length ? launch.routes.filter((x) => routeIds.includes(x.id)) : launch.routes.filter((x) => lane(db, x.lane_id).ads_supported);
  if (!routes.length) throw err('Mindestens eine Ads-fähige Route auswählen');
  const startAt = text(input.start_at, 40) || null; const endAt = text(input.end_at, 40) || null;
  launch.paid_activation = { id: id('paid'), objective, optimization_event: event, daily_cap: Math.round(cap * 100) / 100, total_cap: Math.round(totalInput * 100) / 100, currency, start_at: startAt, end_at: endAt, web_property_id: property ? property.id : null, landing_url: property ? property.base_url : null, audience_hypothesis: text(input.audience_hypothesis, 800), placement_plan: text(input.placement_plan, 1000) || 'Placement-Fit pro ausgewählter Ads-Lane vor echter Aktivierung bestätigen', creative_checklist: ['Hook in den ersten 1–2 Sekunden', 'Caption/Text ohne unzulässige Versprechen', 'CTA und Zielseite passen zusammen', 'Musik-/Personen-/Markenrechte bestätigt', 'Format und Safe Zones pro Placement prüfen'], routes: routes.map((x) => ({ route_id: x.id, lane_id: x.lane_id, asset_id: x.asset_id })), spend_state: 'NOT_ACTIVATED', external_state: 'NO_AD_ACCOUNT_CONNECTED', created_at: now(), created_by: a.by, approval: a, note: 'Lokaler Werbe-Flight mit Daily- und Total-Cap. Er setzt kein Budget um, startet keine Auktion und erzeugt keine Anzeigen ohne ein offiziell verbundenes Werbekonto und einen finalen Freigabeschritt.' };
  launch.updated_at = now(); audit(db, 'social_paid_plan_created', { launch: launch.id, paid: launch.paid_activation.id, routes: routes.length, by: a.by }); save(db); return launchView(db, launch);
}
function preflight(launchId) {
  const db = load(); const launch = db.launches.find((x) => x.id === String(launchId)); if (!launch) throw err('Social-Launch unbekannt', 404);
  const accounts = db.accounts || []; const selected = (launch.selected_lane_ids || []).map((x) => lane(db, x)).filter(Boolean);
  const webProperty = launch.web_handoff ? db.web_properties.find((x) => x.id === launch.web_handoff.web_property_id) : null;
  const routeCount = (launch.routes || []).length; const connections = (launch.routes || []).filter((x) => { const a = accounts.find((y) => y.id === x.account_id); return a && a.connection_state === 'CONNECTED'; }).length;
  const needs = [
    { id: 'rights', name: 'Rechte / Musik / Werbeaussage dokumentiert', pass: String(launch.rights_confirmation || '').length >= 30, blocking: true },
    { id: 'source', name: 'Freigegebene Video- oder Owned-Source referenziert', pass: !!launch.source_video_ref, blocking: true },
    { id: 'derivatives', name: 'Shorts-, Reels-, Ad- und Caption-Pack vorbereitet', pass: (launch.derivative_pack || []).length >= 8, blocking: true },
    { id: 'routes', name: 'Eigene Plattform-/Subfunktions-Routen aufgebaut', pass: routeCount === selected.length && routeCount > 0, blocking: true },
    { id: 'accounts', name: 'Owned-Account je Route hinterlegt', pass: (launch.routes || []).every((r) => !!r.account_id), blocking: false },
    { id: 'connections', name: 'Offizielle Plattformverbindungen aktiv', pass: selected.length > 0 && connections === selected.length, blocking: false },
    { id: 'web_handoff', name: 'Owned Page / UTM-Handoff vollständig oder nicht angefordert', pass: !launch.web_handoff || (!!launch.web_handoff.landing_url && (launch.web_handoff.utm || []).length === routeCount && launch.web_handoff.external_state === 'NOT_DEPLOYED'), blocking: true },
    { id: 'web_connection', name: 'CMS-/Tracking-Verbindung aktiv', pass: !launch.web_handoff || !!(webProperty && webProperty.connection_state === 'CONNECTED'), blocking: false },
    { id: 'ads', name: 'Paid-Activation hat Daily-/Total-Cap oder ist nicht angefordert', pass: !launch.paid_activation || (launch.paid_activation.daily_cap > 0 && launch.paid_activation.total_cap >= launch.paid_activation.daily_cap && launch.paid_activation.spend_state === 'NOT_ACTIVATED'), blocking: true },
    { id: 'human', name: 'Admin-Freigabe dokumentiert', pass: !!launch.approval, blocking: false },
  ];
  const passed = needs.filter((x) => x.pass).length; const externalBlockers = needs.filter((x) => !x.pass && !x.blocking).map((x) => x.id);
  return { launch_id: launch.id, stage: launch.stage, checks: needs, score_pct: Math.round((passed / needs.length) * 100), local_ready: needs.filter((x) => x.blocking).every((x) => x.pass), connected_routes: connections, total_routes: selected.length, external_blockers: externalBlockers, external_state: 'NOT_PUBLISHED', advertising_state: launch.paid_activation ? launch.paid_activation.spend_state : 'NOT_REQUESTED', note: 'Preflight bewertet nur lokale Vorbereitung. Eine Plattform-Connection oder Paid Activation wird niemals als aktiv behauptet, solange offizielle OAuth/API-/Ad-Account-Schritte fehlen.' };
}
function advanceLaunch(launchId, input = {}) {
  const db = load(); const launch = db.launches.find((x) => x.id === String(launchId)); if (!launch) throw err('Social-Launch unbekannt', 404);
  const target = text(input.stage, 60); const pos = LAUNCH_STAGES.indexOf(launch.stage); const next = LAUNCH_STAGES.indexOf(target);
  if (next !== pos + 1) throw err('Stufen laufen nacheinander: aktuell ' + launch.stage + ', nächster Schritt ' + LAUNCH_STAGES[pos + 1]);
  if (target === 'review') { const note = text(input.review_notes, 1600); if (note.length < 20) throw err('Creative, Rights, Captions, CTA und Plattform-Fit mindestens 20 Zeichen dokumentieren'); launch.review_notes = note; }
  if (target === 'approved' || target === 'queue_ready') {
    const a = requireAdmin(input, target === 'approved' ? 'Social-Freigabe' : 'Queue-Freigabe');
    if (target === 'approved') { const pf = preflight(launchId); if (!pf.local_ready) throw err('Lokaler Preflight ist noch nicht vollständig: ' + pf.checks.filter((x) => x.blocking && !x.pass).map((x) => x.name).join(', ')); launch.approval = { at: now(), by: a.by, authorization: a.authorization }; }
    if (target === 'queue_ready' && !launch.approval) throw err('Erst prüfen und freigeben');
  }
  launch.stage = target; launch.updated_at = now(); launch.versions.push({ at: now(), to: target, by: text(input.approved_by || input.admin, 80) || 'workflow', note: text(input.note, 600) }); audit(db, 'social_launch_stage', { launch: launch.id, stage: target }); save(db); return launchView(db, launch);
}
function queueForDispatch(launchId, input = {}) {
  const db = load(); const launch = db.launches.find((x) => x.id === String(launchId)); if (!launch) throw err('Social-Launch unbekannt', 404);
  if (launch.stage !== 'queue_ready') throw err('Launch erst durch Review, Freigabe und Queue-Ready führen');
  const a = requireAdmin(input, 'lokale Dispatcher-Queue');
  const blocked = [];
  for (const route of launch.routes || []) {
    const account = db.accounts.find((x) => x.id === route.account_id);
    route.scheduling_state = 'LOCAL_QUEUE_READY'; route.publication_state = 'NOT_PUBLISHED'; route.queued_at = now();
    if (!account || account.connection_state !== 'CONNECTED') blocked.push({ route_id: route.id, lane_id: route.lane_id, reason: !account ? 'NO_OWNED_ACCOUNT' : account.connection_state });
  }
  launch.dispatch = { queued_at: now(), queued_by: a.by, authorization: a.authorization, total_routes: (launch.routes || []).length, blocked, external_state: 'NOT_PUBLISHED' }; launch.updated_at = now(); audit(db, 'social_dispatch_queued_locally', { launch: launch.id, blocked: blocked.length, by: a.by }); save(db);
  return { launch: launchView(db, launch), dispatch: launch.dispatch, note: blocked.length ? 'Lokale Queue gespeichert. Keine externe Übertragung: ' + blocked.length + ' Route(n) haben noch keine bestätigte offizielle Connection.' : 'Lokale Queue gespeichert. Ein echter Provider-Dispatch bleibt erst nach hostseitiger offizieller Connector-Implementierung möglich; externer Zustand bleibt NOT_PUBLISHED.' };
}
function listAccounts() { const db = load(); return db.accounts.slice(0, CAP).map((x) => accountView(db, x)); }
function listLaunches() { const db = load(); return db.launches.slice(0, CAP).map((x) => launchView(db, x)); }
function status() {
  const db = load(); const lanes = allLanes(db); const groups = Object.fromEntries([...new Set(lanes.map((x) => x.group))].map((g) => [g, lanes.filter((x) => x.group === g).length]));
  return { area: '92', mode: 'LIVE', name: 'Social Growth Control Plane — social content, pages, ads and official connection gates', platform_lanes: { total: lanes.length, groups, lanes }, accounts: { total: db.accounts.length, not_connected: db.accounts.filter((x) => x.connection_state === 'NOT_CONNECTED').length, setup_requested: db.accounts.filter((x) => x.connection_state === 'SETUP_REQUESTED').length, connected: db.accounts.filter((x) => x.connection_state === 'CONNECTED').length }, web_properties: { total: db.web_properties.length, not_connected: db.web_properties.filter((x) => x.connection_state === 'NOT_CONNECTED').length, setup_requested: db.web_properties.filter((x) => x.connection_state === 'SETUP_REQUESTED').length, connected: db.web_properties.filter((x) => x.connection_state === 'CONNECTED').length, types: Object.fromEntries(WEB_PROPERTY_TYPES.map((k) => [k, db.web_properties.filter((x) => x.kind === k).length])) }, launches: { total: db.launches.length, by_stage: Object.fromEntries(LAUNCH_STAGES.map((s) => [s, db.launches.filter((x) => x.stage === s).length])), routes: db.launches.reduce((n, x) => n + (x.routes || []).length, 0), web_handoffs: db.launches.filter((x) => x.web_handoff).length, paid_flights: db.launches.filter((x) => x.paid_activation).length, not_published: db.launches.reduce((n, x) => n + (x.routes || []).filter((r) => r.publication_state !== 'PUBLISHED').length, 0) }, growth_workflows: GROWTH_WORKFLOWS, content_bot: { id: 'social_content_orchestrator', state: 'LIVE_LOCAL', capabilities: ['video-to-short/reel/ad cutdown manifests', 'platform-specific copies, captions and CTAs', 'owned-account register + official connector handoff', 'owned web property + landing-page/UTM handoff', 'paid flight plan with hard daily and total cap', 'local preflight and dispatch queue'], limits: ['no passwords, tokens or cookies stored', 'no fake connected accounts, ad spend or analytics', 'no external post, message, follow, comment, page deployment or ad spend without a real official connector and final admin authorization', 'no synthetic engagement, bulk following or platform-bypass behavior'] }, policy: ['Nur eigene oder nachweislich autorisierte Accounts, Web Properties und Werbekonten', 'Secrets nur im Host-Secret-Store/official OAuth flow — nie in AURA-Formulare, Code oder Daten-JSON', 'Jede Route hat NOT_PUBLISHED bis ein echter offizieller Provider-Receipt vorliegt', 'Jeder Page-Handoff hat NOT_DEPLOYED bis ein echter CMS-/Deploy-Receipt vorliegt', 'Paid Activation erzeugt nur einen Budget-/Flight-Plan; kein Spend ohne verbundenes Werbekonto und finalen Admin-Gate', 'Musik-Distribution (YouTube Music, Spotify, Apple Music, DJ Stores) bleibt Distributor-/Partner-Workflow mit Rechten und Metadaten'] };
}

module.exports = {
  meta: { area: '92', id: 'social_control', name: 'Social Control Plane (owned accounts + short-form + paid activation plans)', state: 'live' },
  actions: { status: () => status(), account_add: (p) => addAccount(p || {}), connection_request: (p) => requestConnection((p || {}).account_id, p || {}), web_property_add: (p) => addWebProperty(p || {}), web_connection_request: (p) => requestWebConnection((p || {}).web_property_id, p || {}), web_handoff_build: (p) => buildWebHandoff((p || {}).launch_id, p || {}), lane_add: (p) => addCustomLane(p || {}), launch_create: (p) => createLaunch(p || {}), derivatives_build: (p) => buildDerivatives((p || {}).launch_id), routes_build: (p) => buildRoutes((p || {}).launch_id), paid_plan: (p) => preparePaidActivation((p || {}).launch_id, p || {}), preflight: (p) => preflight((p || {}).launch_id), launch_advance: (p) => advanceLaunch((p || {}).launch_id, p || {}), queue_dispatch: (p) => queueForDispatch((p || {}).launch_id, p || {}) },
  status, allLanes, addAccount, requestConnection, addWebProperty, requestWebConnection, buildWebHandoff, listWebProperties, addCustomLane, createLaunch, buildDerivatives, buildRoutes, preparePaidActivation, preflight, advanceLaunch, queueForDispatch, listAccounts, listLaunches, LANES, DEFAULT_LANES, LAUNCH_STAGES, AD_OBJECTIVES, WEB_PROPERTY_TYPES, OPTIMIZATION_EVENTS, GROWTH_WORKFLOWS,
};
