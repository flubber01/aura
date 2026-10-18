'use strict';
// AURA Area 95 — AURA OS.
// A product layer over AURA's existing areas: one creator/label workspace keeps
// identity, assets, release work, audience growth and verified learning in one
// operating profile. It is a self-hostable application operating system, not a
// claim that AURA replaces the device OS. Workspaces create local maps only;
// they never publish, deploy, spend, connect accounts or collect credentials.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'aura_os.json');
const CAP = 400;
const STAGES = ['draft', 'mapped', 'review', 'ready'];
const MODES = [
  { id: 'artist_cell', name: 'Artist Cell', buyer: 'Independent artist', promise: 'One home for sound, visual world, releases, owned audience and campaign learning.', areas: ['89 Creator Desk', '90 Label Desk', '91 Media Studio', '102 Studio Command', '92 Social Growth', '93 Growth Nexus'] },
  { id: 'label_cell', name: 'Label / Collective Cell', buyer: 'Label or collective', promise: 'Roster, rights, release packets, 66 destination lanes and campaign operations without one spreadsheet per artist.', areas: ['90 Label Desk', '91 Media Studio', '102 Studio Command', '92 Social Growth', '93 Growth Nexus'] },
  { id: 'creator_cell', name: 'Creator Business Cell', buyer: 'Creator / educator / brand', promise: 'Original content, media packages, owned pages and reusable growth loops in a single operating profile.', areas: ['87 Content Command', '91 Media Studio', '102 Studio Command', '92 Social Growth', '93 Growth Nexus'] },
  { id: 'newsroom_cell', name: 'Newsroom Cell', buyer: 'Independent media team', promise: 'Watchlists, context notes, original briefs, speaking-avatar planning and channel packaging without feed-copy shortcuts.', areas: ['91 Newsroom', '87 Content Command', '92 Social Growth'] },
  { id: 'studio_agency_cell', name: 'Studio / Agency Cell', buyer: 'Operator team', promise: 'Several client or artist operating profiles with rights-aware handoffs and reviewable growth work.', areas: ['74 Service Fabric', '91 Media Studio', '102 Studio Command', '93 Growth Nexus', '94 Capability Radar'] },
];
const FLIGHTS = [
  { id: 'release_flywheel', name: 'Release Flywheel', for_modes: ['artist_cell', 'label_cell'], result: 'A release moves from rights and master to launch, owned conversion and verified learning.', chain: ['Artist / brand identity', 'Rights + master + artwork', 'Studio Command: shot/sequence/review manifest', 'Media master + derivatives', 'Social routes + page / UTM', 'Budgeted flight plan', 'Official metrics → next creative decision'] },
  { id: 'always_on_content', name: 'Always-On Content Engine', for_modes: ['artist_cell', 'creator_cell', 'newsroom_cell'], result: 'One documented idea becomes a coordinated set of original formats instead of disconnected posts.', chain: ['Documented idea / source', 'Own point of view', 'Media package', 'Channel-specific routes', 'Owned archive / page', 'Weekly learn loop'] },
  { id: 'audio_visual_drop', name: 'Audio → Visual Drop', for_modes: ['artist_cell', 'label_cell', 'studio_agency_cell'], result: 'A STUDIO47-ready music idea becomes a rights-aware audiovisual production map.', chain: ['Audio / stems / MIDI ledger', 'Passport + Studio Command shot/sequence plan', 'Voice / avatar script if wanted', 'Cover / motion variants', 'Short-form pack', 'Release / growth handoff'] },
  { id: 'news_signal_to_bulletin', name: 'Signal → Original Bulletin', for_modes: ['newsroom_cell', 'creator_cell'], result: 'A watchlist signal becomes an original, contextual bulletin with a reviewable production path.', chain: ['Allowed source / watchlist', 'Context and fact note', 'Original editorial angle', 'Ticker / avatar script', 'Media package', 'Reviewed channel plan'] },
  { id: 'client_growth_sprint', name: 'Client Growth Sprint', for_modes: ['studio_agency_cell'], result: 'One client brief gets a transparent map from deliverable through landing page and metrics.', chain: ['Client brief', 'Creative source of truth', 'Studio Command review/delivery brief', 'Social / owned page handoff', 'Paid guardrails', 'Verified report + next test'] },
];
const PRODUCT_PRINCIPLES = [
  ['one_record', 'Ein Record statt Tool-Chaos', 'Ein Master, eine Rechtebasis, ein Campaign Graph und ein Metrics-Spine statt zehn Kopien desselben Projekts.'],
  ['local_first', 'Local-first als Kostenbremse', 'Planung, Briefe, Checklisten, Asset-Ledger und Review bleiben im eigenen AURA-Stack; externe Dienste werden nur dort ergänzt, wo sie wirklich etwas leisten.'],
  ['gated_connectors', 'Verbindungen sind Produkt-Module', 'OAuth, APIs, CMS, Ads und Distribution sind keine Voraussetzung für den Start. Sie werden pro Bedarf offiziell verbunden und bleiben bis dahin ehrlich getrennt.'],
  ['human_control', 'Kein Agenten-Zirkus', 'Statt hundert Agent-Settings: wenige sichtbare Arbeitszellen, konkrete Handoffs, ein Admin-Review und ein klarer nächster Schritt.'],
  ['proof_not_hype', 'Wirkung wird belegt', 'Produkterfolg entsteht aus echten Releases, offiziellen Zahlen und wiederholbaren Workflows — nicht aus versprochener Autonomie.'],
];

function empty() { return { workspaces: [], audit: [] }; }
function load() { try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...empty(), ...db, workspaces: Array.isArray(db.workspaces) ? db.workspaces : [], audit: Array.isArray(db.audit) ? db.audit : [] }; } catch { const fresh = empty(); try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* read-only ok */ } return fresh; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function text(value, max = 1000) { return String(value || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) { const by = text((input || {}).approved_by || (input || {}).admin, 80); const authorization = text((input || {}).admin_authorization, 300); if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization'); return { by, authorization }; }
function modeById(value) { return MODES.find((x) => x.id === String(value)); }
function flightById(value) { return FLIGHTS.find((x) => x.id === String(value)); }
function sources() { return { creator: require('./creator_desk'), label: require('./label_desk'), media: require('./media_newsroom'), social: require('./social_control'), nexus: require('./growth_nexus'), content: require('./content_command'), radar: require('./capability_radar'), studioCommand: require('./studio_command') }; }
function catalog() {
  const { creator, label, media, social, nexus, content, studioCommand } = sources();
  return {
    creator_campaigns: creator.listCampaigns().map((x) => ({ id: x.id, title: x.title, stage: x.stage })),
    label_releases: label.listReleases().map((x) => ({ id: x.id, title: x.title, stage: x.stage, artist: x.artist_name || x.artist_id })),
    media_projects: media.listProjects().map((x) => ({ id: x.id, title: x.title, stage: x.stage, kind: x.kind })),
    social_launches: social.listLaunches().map((x) => ({ id: x.id, title: x.title, stage: x.stage, routes: (x.routes || []).length })),
    growth_blueprints: nexus.listBlueprints().map((x) => ({ id: x.id, title: x.title, stage: x.stage, metrics: (x.metrics || []).length })),
    content_packages: content.listPackages().map((x) => ({ id: x.id, title: x.title, stage: x.stage })),
    studio_projects: studioCommand.data().projects.map((x) => ({ id: x.id, title: x.title, stage: x.stage, kind: x.project_type })),
  };
}
function byId(items, value) { return items.find((x) => x.id === String(value)); }
function assertLinks(input, cat) {
  const links = { content_package_id: text(input.content_package_id, 100), creator_campaign_id: text(input.creator_campaign_id, 100), label_release_id: text(input.label_release_id, 100), media_project_id: text(input.media_project_id, 100), social_launch_id: text(input.social_launch_id, 100), growth_blueprint_id: text(input.growth_blueprint_id, 100), studio_project_id: text(input.studio_project_id, 100) };
  const sets = { content_package_id: cat.content_packages, creator_campaign_id: cat.creator_campaigns, label_release_id: cat.label_releases, media_project_id: cat.media_projects, social_launch_id: cat.social_launches, growth_blueprint_id: cat.growth_blueprints, studio_project_id: cat.studio_projects };
  for (const [key, value] of Object.entries(links)) if (value && !byId(sets[key], value)) throw err('Verknüpftes AURA-Objekt nicht gefunden: ' + key, 404);
  return links;
}
function workspaceView(workspace) { const mode = modeById(workspace.mode); const flight = flightById(workspace.flight_id); return { ...workspace, mode_info: mode ? { id: mode.id, name: mode.name, buyer: mode.buyer, areas: mode.areas } : null, flight: flight ? { id: flight.id, name: flight.name, chain: flight.chain } : null, external_state: 'NO_EXTERNAL_ACTION_BY_AURA_OS', workspace_state: workspace.stage === 'ready' ? 'READY_LOCAL_OPERATING_PROFILE' : 'LOCAL_OPERATING_PROFILE_IN_PROGRESS' }; }
function createWorkspace(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines AURA-OS-Workspaces'); const mode = modeById(text(input.mode, 80)); const flight = flightById(text(input.flight_id, 80)); if (!mode || !flight || !flight.for_modes.includes(mode.id)) throw err('Produktmodus und passender Flight sind Pflicht');
  const name = text(input.name, 180), owner = text(input.owner, 120), goal = text(input.goal, 1000), audience = text(input.audience, 500); if (name.length < 3 || owner.length < 2 || goal.length < 20) throw err('Workspace-Name, Owner und konkretes Ziel (mind. 20 Zeichen) sind Pflicht');
  const cat = catalog(); const links = assertLinks(input, cat);
  const workspace = { id: id('os'), name, mode: mode.id, flight_id: flight.id, owner, goal, audience, links, stage: 'draft', map: null, review_notes: '', approval: null, created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, versions: [{ at: now(), to: 'draft', by: a.by, note: 'AURA OS local operating profile created' }] };
  db.workspaces.unshift(workspace); if (db.workspaces.length > CAP) db.workspaces.length = CAP; audit(db, 'aura_os_workspace_created', { workspace: workspace.id, mode: mode.id, flight: flight.id, by: a.by }); save(db); return workspaceView(workspace);
}
function buildMap(workspaceId) {
  const db = load(); const w = db.workspaces.find((x) => x.id === String(workspaceId)); if (!w) throw err('AURA-OS-Workspace unbekannt', 404); if (w.stage !== 'draft') throw err('Operating Map kann nur direkt aus einem frischen Workspace gebaut werden');
  const cat = catalog(); const l = w.links; const find = (items, key) => l[key] ? byId(items, l[key]) : null; const picked = [
    ['Content source', find(cat.content_packages, 'content_package_id')], ['Creator campaign', find(cat.creator_campaigns, 'creator_campaign_id')], ['Label release', find(cat.label_releases, 'label_release_id')], ['Media master', find(cat.media_projects, 'media_project_id')], ['Social launch', find(cat.social_launches, 'social_launch_id')], ['Growth graph', find(cat.growth_blueprints, 'growth_blueprint_id')], ['Studio Command', find(cat.studio_projects, 'studio_project_id')],
  ].filter((x) => x[1]).map(([role, item]) => ({ role, id: item.id, title: item.title, state: item.stage, status: 'LINKED_AURA_OBJECT' }));
  const mode = modeById(w.mode), flight = flightById(w.flight_id); const spine = [
    { id: 'identity', title: 'Identity & ownership', state: 'OPERATOR_DEFINED', note: w.owner + ' steuert Brand, Rechtebasis und finale Entscheidungen.' },
    { id: 'master', title: 'Master / creative source of truth', state: picked.some((x) => x.role === 'Media master' || x.role === 'Label release') ? 'LINKED' : 'TO_START', note: 'Ein Master und ein Asset-/Rights-Ledger statt Kopien in mehreren Tools.' },
    { id: 'studio', title: 'Studio plan & post review', state: picked.some((x) => x.role === 'Studio Command') ? 'LINKED' : 'TO_START', note: 'Shot cards, sequence intent, timecode review and delivery requirements remain local manifests; no camera, NLE or renderer is invoked.' },
    { id: 'audience', title: 'Audience & owned destination', state: picked.some((x) => x.role === 'Social launch') ? 'LINKED' : 'TO_START', note: 'Social-Routen, Owned Page und UTM bleiben ein gemeinsamer Handoff.' },
    { id: 'growth', title: 'Campaign graph & learning', state: picked.some((x) => x.role === 'Growth graph') ? 'LINKED' : 'TO_START', note: 'Ein Campaign Graph sammelt Zuständigkeit, Freigabe und spätere verifizierte Kennzahlen.' },
    { id: 'capabilities', title: 'Capability / connector intake', state: 'REVIEW_GATED', note: 'Neue Tools gehen über Area 94 statt in unkontrollierte Einzellösungen.' },
  ];
  w.map = { built_at: now(), mode: { name: mode.name, buyer: mode.buyer, areas: mode.areas }, flight: { name: flight.name, chain: flight.chain }, linked_objects: picked, spine, resource_strategy: ['Eine gemeinsame Identitäts- und Rechtebasis', 'Ein Master- und Asset-Record pro Werk', 'Ein Campaign Graph statt getrennter Social-/Page-/Ad-Listen', 'Local-first Briefe, Checklisten und Reviews', 'Externe Dienste nur als offiziell verbundene, bedarfsbasierte Module'], market_thesis: 'AURA OS bündelt Creator Operations in wenige sichtbare Zellen statt in eine unverbundene Sammlung von Agenten und SaaS-Tools.', state: 'LOCAL_OS_MAP_READY' };
  w.stage = 'mapped'; w.updated_at = now(); w.versions.push({ at: now(), to: 'mapped', by: 'aura_os', note: picked.length + ' existing AURA objects linked into operating map' }); audit(db, 'aura_os_map_built', { workspace: w.id, linked: picked.length }); save(db); return workspaceView(w);
}
function preflight(workspace) {
  const m = workspace.map || {}; const linked = m.linked_objects || []; const checks = [
    { id: 'mode', name: 'Produktmodus und Flight klar', pass: !!modeById(workspace.mode) && !!flightById(workspace.flight_id), blocking: true },
    { id: 'map', name: 'AURA OS Operating Map gebaut', pass: !!workspace.map && workspace.map.state === 'LOCAL_OS_MAP_READY', blocking: true },
    { id: 'owner', name: 'Owner festgelegt', pass: text(workspace.owner).length >= 2, blocking: true },
    { id: 'goal', name: 'konkretes Operating-Ziel dokumentiert', pass: text(workspace.goal).length >= 20, blocking: true },
    { id: 'creative', name: 'mindestens ein echter Work-Record verknüpft', pass: linked.length > 0, blocking: false, note: 'Ein OS-Workspace darf auch als vorbereiteter Operating Profile starten.' },
    { id: 'review', name: 'Review dokumentiert', pass: text(workspace.review_notes).length >= 20, blocking: false },
    { id: 'approval', name: 'Admin-Freigabe dokumentiert', pass: !!workspace.approval, blocking: false },
    { id: 'connections', name: 'Offizielle externe Connectoren', pass: false, blocking: false, note: 'Nicht durch AURA OS behauptet; Connector-Receipts bleiben in den jeweiligen Fachbereichen.' },
  ];
  return { workspace_id: workspace.id, stage: workspace.stage, checks, score_pct: Math.round((checks.filter((x) => x.pass).length / checks.length) * 100), local_ready: checks.filter((x) => x.blocking).every((x) => x.pass), external_state: 'NO_EXTERNAL_ACTION_BY_AURA_OS', note: 'AURA OS bewertet nur das lokale Operating Profile. Der Score ist keine Umsatz-, Reichweiten-, Tool- oder Marktbehauptung.' };
}
function advanceWorkspace(workspaceId, input = {}) {
  const db = load(); const w = db.workspaces.find((x) => x.id === String(workspaceId)); if (!w) throw err('AURA-OS-Workspace unbekannt', 404); const target = text(input.stage, 80); const pos = STAGES.indexOf(w.stage), next = STAGES.indexOf(target); if (next !== pos + 1) throw err('Stufen laufen nacheinander: aktuell ' + w.stage + ', nächster Schritt ' + STAGES[pos + 1]);
  if (target === 'review') { const note = text(input.review_notes, 1800); if (note.length < 20) throw err('Review muss Produktversprechen, Rechte-/Datenpfad, Owner und nächsten lokalen Test beschreiben (mind. 20 Zeichen)'); w.review_notes = note; }
  if (target === 'ready') { const a = requireAdmin(input, 'AURA-OS-Workspace-Freigabe'); const pf = preflight(w); if (!pf.local_ready) throw err('Operating Profile ist noch nicht lokal bereit: ' + pf.checks.filter((x) => x.blocking && !x.pass).map((x) => x.name).join(', ')); w.approval = { at: now(), by: a.by, authorization: a.authorization }; }
  w.stage = target; w.updated_at = now(); w.versions.push({ at: now(), to: target, by: text(input.approved_by || input.reviewer || input.admin, 80) || w.owner, note: text(input.note, 600) }); audit(db, 'aura_os_workspace_stage', { workspace: w.id, stage: target }); save(db); return workspaceView(w);
}
function buildBrief(workspaceId) { const db = load(); const w = db.workspaces.find((x) => x.id === String(workspaceId)); if (!w) throw err('AURA-OS-Workspace unbekannt', 404); const view = workspaceView(w); const map = w.map || {}; return { workspace: view, mode: 'LOCAL_AURA_OS_PRODUCT_BRIEF', pitch: 'AURA OS is the operator layer for a creator or label: one source of truth for work, rights, audience and verified learning — with integrations added only when they are needed.', operating_units: (map.spine || []).map((x) => ({ title: x.title, state: x.state, note: x.note })), next_moves: ['Mit einem echten Artist-/Label-/Creator-Workspace starten.', 'Einen Master oder Content-Record als Source of Truth verknüpfen.', 'Eine Release- oder Content-Flight bis zum Nexus führen.', 'Nur offizielle Metrics importieren und das nächste Creative-/Channel-Experiment ableiten.'], commercial_hypothesis: ['Solo Artist: klare Launch- und Asset-Zelle statt Toolhopping.', 'Label / Collective: Rechte, Releases und mehrere Artist-Wellen in einer Struktur.', 'Studio / Agency: wiederholbare Client-Operating-Profiles mit Review-Pfaden.', 'AURA OS sollte erst mit echten Operatoren, echten Zeitersparnis-Messungen und einem wiederholbaren Onboarding validiert werden.'], note: 'Brief only. No business account, deployment, external connector, payment, post or campaign is created.' }; }
function listWorkspaces() { return load().workspaces.slice(0, CAP).map(workspaceView); }
function status() { const db = load(); const { media, social, nexus, label, content, radar, studioCommand } = sources(); const states = Object.fromEntries(STAGES.map((s) => [s, db.workspaces.filter((x) => x.stage === s).length])); return { area: '95', mode: 'LIVE', name: 'AURA OS — self-hostable creator operating system product layer', product_state: 'LOCAL_PRODUCT_OPERATING_LAYER', modes: MODES, flights: FLIGHTS, principles: PRODUCT_PRINCIPLES.map(([id, title, text]) => ({ id, title, text })), workspaces: { total: db.workspaces.length, by_stage: states }, current_spine: { content_packages: content.listPackages().length, label_releases: label.listReleases().length, media_projects: media.listProjects().length, social_launches: social.listLaunches().length, growth_blueprints: nexus.listBlueprints().length, studio_projects: studioCommand.data().projects.length, capability_sources: radar.listSources().length }, packaging: { runtime: 'one self-hosted Node service + local JSON state for the current AURA build', start: 'node backend/server.js', deployment: 'systemd / Docker / k3s options already present in deploy/', note: 'Production multi-tenant SaaS needs deliberate tenant isolation, authentication, billing, storage, backup and compliance work; those are not claimed by this local product layer.' }, policy: ['AURA OS is a product/operating layer, not a device OS claim', 'One workspace packages existing AURA areas; it does not duplicate them', 'No automatic publish, deploy, spend, connector action or credential capture', 'No invented market traction, customer outcomes, revenue or time savings', 'Official integrations and human approval remain mandatory'] }; }

module.exports = { meta: { area: '95', id: 'aura_os', name: 'AURA OS (self-hostable creator operating system product layer)', state: 'live' }, actions: { status: () => status(), workspace_create: (p) => createWorkspace(p || {}), map_build: (p) => buildMap((p || {}).workspace_id), preflight: (p) => { const db = load(); const w = db.workspaces.find((x) => x.id === String((p || {}).workspace_id)); if (!w) throw err('AURA-OS-Workspace unbekannt', 404); return preflight(w); }, workspace_advance: (p) => advanceWorkspace((p || {}).workspace_id, p || {}), brief: (p) => buildBrief((p || {}).workspace_id) }, status, catalog, createWorkspace, buildMap, preflight, advanceWorkspace, buildBrief, listWorkspaces, MODES, FLIGHTS, STAGES, PRODUCT_PRINCIPLES };
