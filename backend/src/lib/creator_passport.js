'use strict';
// AURA Area 101 — Creator Project / Release Passport.
// A local-first source of truth connecting a creator project to its rights,
// asset/version graph, task spine, review/readiness and AURA handoff references.
// It stores only local metadata and references: no media upload, render, DAW,
// distribution, provider delivery, legal agreement or external action occurs.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auraOsPlus = require('./aura_os_plus');
const auraOs = require('./aura_os');

const FILE = path.join(__dirname, '..', 'data', 'creator_passport.json');
const CAP = 700;
const PROJECT_TYPES = [
  { id: 'music_release', name: 'Music Release', promise: 'Song, single, EP or album release candidate', required_assets: ['master_candidate', 'artwork_brief', 'metadata_sheet'], optional_assets: ['audio_demo', 'vocal_take', 'stem_manifest', 'midi_manifest', 'lyrics_document', 'video_brief', 'content_pack'] },
  { id: 'beat_pack', name: 'Beat / Producer Pack', promise: 'Licensable beat or producer delivery candidate', required_assets: ['beat_master', 'artwork_brief', 'metadata_sheet'], optional_assets: ['stem_manifest', 'midi_manifest', 'content_pack', 'delivery_master'] },
  { id: 'creator_product', name: 'Creator Product Drop', promise: 'Product, digital offer, physical drop or service package', required_assets: ['product_photo', 'product_copy', 'metadata_sheet'], optional_assets: ['artwork_brief', 'video_brief', 'content_pack', 'campaign_brief'] },
  { id: 'video_series', name: 'Video / Content Series', promise: 'Owned multi-episode visual/content series', required_assets: ['video_brief', 'content_pack', 'metadata_sheet'], optional_assets: ['video_master', 'artwork_source', 'lyrics_document', 'campaign_brief'] },
  { id: 'client_delivery', name: 'Client Delivery', promise: 'Rights-aware client work / delivery candidate', required_assets: ['delivery_master', 'metadata_sheet'], optional_assets: ['contract_evidence', 'product_copy', 'content_pack', 'artwork_brief'] },
];
const ASSET_TYPES = [
  { id: 'idea_note', lane: 'IDEA', name: 'Idea / Voice Note Reference', note: 'A local thought, note or user-owned voice-note reference; AURA does not ingest audio.' },
  { id: 'reference_brief', lane: 'IDEA', name: 'Creative Reference Brief', note: 'Describe the desired direction without copying protected work or asserting rights over third-party material.' },
  { id: 'rights_evidence', lane: 'RIGHTS', name: 'Rights / License Evidence', note: 'A local evidence reference; not a legal determination or contract execution.' },
  { id: 'contract_evidence', lane: 'RIGHTS', name: 'Contract / Permission Reference', note: 'A local reference to signed/off-platform material; not a contract generated or verified by AURA.' },
  { id: 'audio_demo', lane: 'PRODUCTION', name: 'Audio Demo Reference', note: 'Pointer to an owner-controlled demo; no audio upload, analysis or render is performed.' },
  { id: 'beat_master', lane: 'PRODUCTION', name: 'Beat / Instrumental Master Candidate', note: 'Metadata reference only; verify rights and final quality externally.' },
  { id: 'vocal_take', lane: 'PRODUCTION', name: 'Vocal Take / Performance Reference', note: 'Metadata reference only; no voice clone, biometric verification or voice generation.' },
  { id: 'stem_manifest', lane: 'PRODUCTION', name: 'Stem Manifest', note: 'A non-destructive list/reference of stems, not actual separation or export.' },
  { id: 'midi_manifest', lane: 'PRODUCTION', name: 'MIDI Manifest', note: 'A local MIDI reference/metadata record; no MIDI file conversion or DAW playback.' },
  { id: 'master_candidate', lane: 'PRODUCTION', name: 'Master Candidate', note: 'A reviewable candidate reference; no mastering, loudness measurement or delivery claim.' },
  { id: 'delivery_master', lane: 'PRODUCTION', name: 'Client Delivery Master', note: 'A local delivery reference pending external quality, rights and client acceptance checks.' },
  { id: 'lyrics_document', lane: 'PACKAGING', name: 'Lyrics / Copy Document', note: 'Local text-reference metadata; creator remains responsible for originality and rights.' },
  { id: 'artwork_source', lane: 'PACKAGING', name: 'Artwork Source', note: 'A source/reference with separate image/trademark/portrait rights review.' },
  { id: 'artwork_brief', lane: 'PACKAGING', name: 'Artwork / Cover Brief', note: 'A local production brief; no image is generated, edited or published.' },
  { id: 'video_brief', lane: 'PACKAGING', name: 'Video / Visual Brief', note: 'A local production brief; no video is rendered or published.' },
  { id: 'video_master', lane: 'PACKAGING', name: 'Video Master Reference', note: 'A local reference; no upload, platform delivery or external metrics claim.' },
  { id: 'product_photo', lane: 'PACKAGING', name: 'Product Photo Reference', note: 'A source/reference; product, image, trademark and availability claims remain owner-reviewed.' },
  { id: 'product_copy', lane: 'PACKAGING', name: 'Product Copy', note: 'Local copy draft/reference; no storefront, ad or sale is created.' },
  { id: 'metadata_sheet', lane: 'PACKAGING', name: 'Metadata Sheet', note: 'Local metadata checklist; no ISRC, UPC or distributor delivery is performed.' },
  { id: 'content_pack', lane: 'PACKAGING', name: 'Content Pack', note: 'Local hooks/caption/script pack; no post, mail or ad action is performed.' },
  { id: 'campaign_brief', lane: 'REVIEW', name: 'Campaign / Launch Brief', note: 'Local campaign map; no spend, audience targeting or platform action is performed.' },
];
const RELATIONS = ['derives_from', 'uses', 'replaces', 'contains', 'delivered_as', 'inspired_by_owned_reference'];
const RIGHTS = [
  { id: 'owned', state: 'RIGHTS_CONFIRMED_LOCAL_OWNER_ASSERTION', needs_evidence: false },
  { id: 'licensed', state: 'LICENSE_DOCUMENTED_LOCAL_REFERENCE', needs_evidence: true },
  { id: 'permission_pending', state: 'PENDING_OWNER_REVIEW', needs_evidence: true },
  { id: 'third_party_unverified', state: 'BLOCKED_UNCLEAR_RIGHTS', needs_evidence: false },
];
const TASK_LANES = ['IDEA', 'RIGHTS', 'PRODUCTION', 'PACKAGING', 'REVIEW', 'RELEASE_READINESS', 'LEARNING'];
const HANDOFF_AREAS = [
  { id: '95', name: 'AURA OS Workspace', state: 'LOCAL_REFERENCE_ONLY' },
  { id: '96', name: 'Launchpad / Content Mission', state: 'LOCAL_REFERENCE_ONLY' },
  { id: '97', name: 'Continuity / Asset Reactor', state: 'LOCAL_REFERENCE_ONLY' },
  { id: '98', name: 'Remote Approval Deck', state: 'LOCAL_REFERENCE_ONLY' },
  { id: '99', name: 'Creator Collaboration Room', state: 'LOCAL_REFERENCE_ONLY' },
  { id: '100', name: 'Creator Revenue / Referral', state: 'LOCAL_REFERENCE_ONLY' },
  { id: '102', name: 'Studio Command / Video & Post', state: 'LOCAL_REFERENCE_ONLY' },
];

function empty() { return { passports: [], assets: [], edges: [], tasks: [], contributors: [], handoffs: [], reviews: [], audit: [] }; }
function load() { try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...empty(), ...db, ...Object.fromEntries(Object.keys(empty()).map((k) => [k, Array.isArray(db[k]) ? db[k] : []])) }; } catch { return empty(); } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(5).toString('hex'); }
function text(value, max = 1200) { return String(value || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ id: id('passport-audit'), at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) { const by = text((input || {}).approved_by || (input || {}).admin, 80); const authorization = text((input || {}).admin_authorization, 360); if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization'); return { by, authorization }; }
function typeById(value) { return PROJECT_TYPES.find((x) => x.id === String(value)); }
function assetTypeById(value) { return ASSET_TYPES.find((x) => x.id === String(value)); }
function rightsById(value) { return RIGHTS.find((x) => x.id === String(value)); }
function profileById(value) { return (auraOsPlus.data().profiles || []).find((x) => x.id === String(value)); }
function passportById(db, value) { return db.passports.find((x) => x.id === String(value)); }
function validDate(value) { const v = text(value, 20); return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v + 'T12:00:00Z').getTime()) ? v : ''; }
function taskSeed(type) { return [
  { lane: 'IDEA', title: 'Kernidee, Zielgruppe und Creator-Promise festhalten', priority: 'high' },
  { lane: 'RIGHTS', title: 'Alle Quellen, Rechte und offenen Erlaubnisse prüfen', priority: 'urgent' },
  { lane: 'PRODUCTION', title: 'Ersten eigenen Produktions-/Quell-Asset-Referenzpunkt anlegen', priority: 'high' },
  { lane: 'PACKAGING', title: 'Metadata-, Cover/Visual- und Content-Pack-Plan vervollständigen', priority: 'high' },
  { lane: 'REVIEW', title: 'Owner Review: Aussage, Rechte, Qualität und Grenzen prüfen', priority: 'urgent' },
  { lane: 'RELEASE_READINESS', title: type.name + ' Preflight ausführen; nur bei bestandenem Gate ready markieren', priority: 'urgent' },
  { lane: 'LEARNING', title: 'Nach dem echten, separaten Launch verifizierte Learnings importieren', priority: 'medium' },
]; }
function createPassport(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines Creator Project / Release Passport'); const profile = profileById(text(input.profile_id, 100)); const type = typeById(text(input.project_type, 80)); const title = text(input.title, 180); const promise = text(input.core_promise, 1400);
  if (!profile || !type || title.length < 3 || promise.length < 25) throw err('AURA-Profile, Projekttyp, Titel und ein konkretes Kernversprechen (mindestens 25 Zeichen) sind Pflicht');
  const workspaceId = text(input.workspace_id, 100); if (workspaceId && !(auraOs.listWorkspaces() || []).some((x) => x.id === workspaceId)) throw err('Verknüpfter AURA-OS-Workspace ist unbekannt', 404);
  const passport = { id: id('passport'), profile_id: profile.id, workspace_id: workspaceId || null, project_type: type.id, title, artist_or_brand: text(input.artist_or_brand, 160) || profile.display_name, audience: text(input.audience, 240), core_promise: promise, creative_direction: text(input.creative_direction, 1200), metadata: { genre_or_category: text(input.genre_or_category, 100), bpm: text(input.bpm, 20), key: text(input.key, 20), language: text(input.language, 50), explicit_flag: input.explicit_flag === true, release_or_drop_window: validDate(input.release_or_drop_window) || null }, state: 'LOCAL_PROJECT_PASSPORT_ACTIVE', stage: 'IDEA', created_at: now(), created_by: a.by, approval: a, policy: 'This passport is a local operating record. It does not upload or transform media, determine legal rights, create a contract, distribute a release, publish content or operate an external account.' };
  db.passports.unshift(passport); const seed = taskSeed(type).map((x) => ({ id: id('passport-task'), passport_id: passport.id, ...x, state: 'TODO', owner: profile.display_name, due_on: null, linked_asset_id: null, created_at: now(), created_by: a.by })); db.tasks.unshift(...seed); audit(db, 'passport_created', { passport: passport.id, profile: profile.id, type: type.id, tasks: seed.length, by: a.by }); save(db); return passportView(db, passport);
}
function safeAsset(asset) { return { ...asset, rights_statement: asset.rights_statement || '', evidence_reference: asset.evidence_reference || '' }; }
function passportView(db, passport) { const type = typeById(passport.project_type); const assets = db.assets.filter((x) => x.passport_id === passport.id); const tasks = db.tasks.filter((x) => x.passport_id === passport.id); const preflight = preflightFor(db, passport); return { ...passport, type, assets: assets.map(safeAsset), asset_count: assets.length, edges: db.edges.filter((x) => x.passport_id === passport.id), tasks, contributors: db.contributors.filter((x) => x.passport_id === passport.id), handoffs: db.handoffs.filter((x) => x.passport_id === passport.id), reviews: db.reviews.filter((x) => x.passport_id === passport.id), preflight, external_state: 'LOCAL_METADATA_AND_REFERENCE_GRAPH_ONLY' }; }
function assetVersion(db, parent) { const root = parent.root_asset_id || parent.id; return db.assets.filter((x) => x.passport_id === parent.passport_id && (x.root_asset_id || x.id) === root).length + 1; }
function addAsset(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Hinzufügen eines Asset- oder Versions-Referenzpunkts'); const passport = passportById(db, text(input.passport_id, 100)); const kind = assetTypeById(text(input.asset_type, 80)); const right = rightsById(text(input.rights_mode, 80)); const title = text(input.title, 180); const ref = text(input.local_reference, 900); const statement = text(input.rights_statement, 1600); const evidence = text(input.evidence_reference, 600); const parentId = text(input.parent_asset_id, 100);
  if (!passport || !kind || !right || title.length < 3 || ref.length < 3) throw err('Passport, Asset-Typ, Rechte-Modus, Titel und lokaler Referenzpunkt sind Pflicht');
  if (right.id === 'owned' && statement.length < 30) throw err('Für eigene Assets eine konkrete Rechte-/Ownership-Bestätigung mit mindestens 30 Zeichen dokumentieren');
  if (right.needs_evidence && evidence.length < 5) throw err('Für diesen Rechte-Modus eine lokale Evidenz-/Lizenz-/Erlaubnisreferenz dokumentieren');
  const parent = parentId ? db.assets.find((x) => x.id === parentId && x.passport_id === passport.id) : null; if (parentId && !parent) throw err('Parent-Asset gehört nicht zu diesem Passport', 404);
  const asset = { id: id('asset'), passport_id: passport.id, asset_type: kind.id, lane: kind.lane, title, local_reference: ref, rights_mode: right.id, rights_state: right.state, rights_statement: statement, evidence_reference: evidence || null, version: parent ? assetVersion(db, parent) : 1, parent_asset_id: parent ? parent.id : null, root_asset_id: parent ? (parent.root_asset_id || parent.id) : null, state: right.state === 'BLOCKED_UNCLEAR_RIGHTS' ? 'BLOCKED_RIGHTS_REVIEW_REQUIRED' : 'LOCAL_REFERENCE_READY', created_at: now(), created_by: a.by, approval: a, note: kind.note };
  if (!asset.root_asset_id) asset.root_asset_id = asset.id; db.assets.unshift(asset); if (parent) db.edges.unshift({ id: id('edge'), passport_id: passport.id, from_asset_id: asset.id, to_asset_id: parent.id, relation: 'derives_from', created_at: now(), created_by: a.by });
  audit(db, 'passport_asset_added', { passport: passport.id, asset: asset.id, type: kind.id, parent: parent && parent.id, by: a.by }); save(db); return { asset: safeAsset(asset), passport: passportView(db, passport) };
}
function addEdge(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Verknüpfen von Asset-Versionen'); const passport = passportById(db, text(input.passport_id, 100)); const from = db.assets.find((x) => x.id === text(input.from_asset_id, 100)); const to = db.assets.find((x) => x.id === text(input.to_asset_id, 100)); const relation = text(input.relation, 80);
  if (!passport || !from || !to || from.passport_id !== passport.id || to.passport_id !== passport.id || from.id === to.id || !RELATIONS.includes(relation)) throw err('Passport, zwei unterschiedliche Passport-Assets und eine erlaubte Relation sind Pflicht');
  if (db.edges.some((x) => x.from_asset_id === from.id && x.to_asset_id === to.id && x.relation === relation)) throw err('Diese Asset-Relation existiert bereits', 409);
  const edge = { id: id('edge'), passport_id: passport.id, from_asset_id: from.id, to_asset_id: to.id, relation, note: text(input.note, 500), created_at: now(), created_by: a.by }; db.edges.unshift(edge); audit(db, 'passport_asset_edge_added', { passport: passport.id, edge: edge.id, by: a.by }); save(db); return edge;
}
function addContributor(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines Contributor-/Credit-Claims'); const passport = passportById(db, text(input.passport_id, 100)); const name = text(input.credit_name, 160); const role = text(input.role, 100); const rights = text(input.rights_confirmation, 1400); const share = input.share_pct === '' || input.share_pct === undefined ? null : Number(input.share_pct);
  if (!passport || name.length < 2 || role.length < 2 || rights.length < 30) throw err('Passport, Credit-Name, Rolle und konkrete Rechte-/Contribution-Bestätigung (mind. 30 Zeichen) sind Pflicht'); if (share !== null && (!Number.isFinite(share) || share < 0 || share > 100)) throw err('Share muss zwischen 0 und 100 liegen oder leer bleiben');
  const contributor = { id: id('contributor'), passport_id: passport.id, credit_name: name, role, share_pct: share, rights_confirmation: rights, state: 'LOCAL_CONTRIBUTION_CLAIM_PENDING_EXTERNAL_AGREEMENT', created_at: now(), created_by: a.by, approval: a, note: 'This is not a split sheet, contract, payment instruction or legal rights determination.' }; db.contributors.unshift(contributor); audit(db, 'passport_contributor_added', { passport: passport.id, contributor: contributor.id, by: a.by }); save(db); return contributor;
}
function addTask(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Hinzufügen einer Passport-Aufgabe'); const passport = passportById(db, text(input.passport_id, 100)); const lane = text(input.lane, 50); const title = text(input.title, 300); const priority = ['low', 'medium', 'high', 'urgent'].includes(text(input.priority, 30)) ? text(input.priority, 30) : 'medium'; const asset = text(input.linked_asset_id, 100) ? db.assets.find((x) => x.id === text(input.linked_asset_id, 100) && x.passport_id === passport?.id) : null;
  if (!passport || !TASK_LANES.includes(lane) || title.length < 5 || (text(input.linked_asset_id, 100) && !asset)) throw err('Passport, Lane, aussagekräftiger Task-Titel und ggf. ein Passport-Asset sind Pflicht');
  const task = { id: id('passport-task'), passport_id: passport.id, lane, title, priority, state: 'TODO', owner: text(input.owner, 120) || passport.artist_or_brand, due_on: validDate(input.due_on) || null, linked_asset_id: asset ? asset.id : null, created_at: now(), created_by: a.by }; db.tasks.unshift(task); audit(db, 'passport_task_added', { passport: passport.id, task: task.id, by: a.by }); save(db); return task;
}
function setTaskState(taskId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Ändern einer Passport-Aufgabe'); const task = db.tasks.find((x) => x.id === String(taskId)); if (!task) throw err('Passport-Task unbekannt', 404); const next = text(input.state, 40); if (!['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'].includes(next)) throw err('Task-State muss TODO, IN_PROGRESS, BLOCKED oder DONE sein');
  task.state = next; task.updated_at = now(); task.updated_by = a.by; task.update_note = text(input.note, 800); audit(db, 'passport_task_state_changed', { passport: task.passport_id, task: task.id, state: next, by: a.by }); save(db); return task;
}
function linkHandoff(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Verknüpfen eines AURA-Workflow-Records'); const passport = passportById(db, text(input.passport_id, 100)); const target = HANDOFF_AREAS.find((x) => x.id === text(input.target_area, 10)); const record = text(input.record_id, 140); const purpose = text(input.purpose, 800);
  if (!passport || !target || record.length < 3 || purpose.length < 12) throw err('Passport, AURA-Zielbereich, Record-ID und konkreter Zweck sind Pflicht');
  const handoff = { id: id('handoff'), passport_id: passport.id, target_area: target.id, target_name: target.name, record_id: record, purpose, state: 'LOCAL_AURA_REFERENCE_LINKED', external_state: 'NO_EXTERNAL_ACTION_TRIGGERED', created_at: now(), created_by: a.by, approval: a }; db.handoffs.unshift(handoff); audit(db, 'passport_handoff_linked', { passport: passport.id, handoff: handoff.id, target: target.id, by: a.by }); save(db); return handoff;
}
function requirementsFor(passport) { return (typeById(passport.project_type) || { required_assets: [] }).required_assets || []; }
function preflightFor(db, passport) {
  const assets = db.assets.filter((x) => x.passport_id === passport.id); const contributors = db.contributors.filter((x) => x.passport_id === passport.id); const tasks = db.tasks.filter((x) => x.passport_id === passport.id); const required = requirementsFor(passport);
  const checks = [
    { id: 'profile', pass: !!profileById(passport.profile_id), blocking: true, note: 'AURA Access Profile must still exist.' },
    { id: 'promise', pass: passport.core_promise.length >= 25, blocking: true, note: 'A clear owner-controlled project promise is recorded.' },
    { id: 'assets', pass: assets.length >= 2, blocking: true, note: 'At least two local asset/reference nodes establish a traceable graph.' },
    { id: 'required_assets', pass: required.every((kind) => assets.some((x) => x.asset_type === kind && x.rights_state !== 'BLOCKED_UNCLEAR_RIGHTS')), blocking: true, note: 'Required asset kinds for this project type are present and not rights-blocked.' },
    { id: 'rights', pass: !assets.some((x) => ['PENDING_OWNER_REVIEW', 'BLOCKED_UNCLEAR_RIGHTS'].includes(x.rights_state)), blocking: true, note: 'No asset remains with pending or unclear rights.' },
    { id: 'contributors', pass: !contributors.some((x) => !x.rights_confirmation || x.rights_confirmation.length < 30), blocking: true, note: 'Every recorded contributor carries a local contribution/rights statement.' },
    { id: 'review_task', pass: tasks.some((x) => x.lane === 'REVIEW' && x.state === 'DONE'), blocking: true, note: 'An owner review task has been consciously marked done.' },
    { id: 'release_task', pass: tasks.some((x) => x.lane === 'RELEASE_READINESS' && x.state === 'DONE'), blocking: true, note: 'A release-readiness task has been consciously marked done.' },
  ];
  const blocking = checks.filter((x) => x.blocking && !x.pass); return { state: blocking.length ? 'LOCAL_PREFLIGHT_BLOCKED' : 'LOCAL_PREFLIGHT_READY_FOR_OWNER_DECISION', ready: !blocking.length, checks, blocking_checks: blocking.map((x) => x.id), disclaimer: 'Passing this local preflight does not distribute a release, publish content, establish legal rights, deliver to a client, collect payment or create an external account.' };
}
function requestReview(passportId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anforderung einer Owner-Review im Release Passport'); const passport = passportById(db, passportId); if (!passport) throw err('Passport unbekannt', 404); const preflight = preflightFor(db, passport); const review = { id: id('passport-review'), passport_id: passport.id, requested_scope: text(input.scope, 500) || 'Rights, source graph, package, metadata, creator claim and release readiness', preflight_snapshot: preflight, state: preflight.ready ? 'PENDING_OWNER_RELEASE_DECISION' : 'PREFLIGHT_BLOCKED_OWNER_REVIEW_REQUIRED', external_state: 'NOT_DISTRIBUTED_NOT_PUBLISHED_NOT_SENT', created_at: now(), created_by: a.by, approval: a }; db.reviews.unshift(review); passport.stage = 'REVIEW'; audit(db, 'passport_review_requested', { passport: passport.id, review: review.id, ready: preflight.ready, by: a.by }); save(db); return review;
}
function decideReview(reviewId, input = {}) {
  const db = load(); const a = requireAdmin(input, 'Owner-Entscheidung über Release Passport'); const review = db.reviews.find((x) => x.id === String(reviewId)); if (!review) throw err('Passport-Review unbekannt', 404); if (!['PENDING_OWNER_RELEASE_DECISION', 'PREFLIGHT_BLOCKED_OWNER_REVIEW_REQUIRED'].includes(review.state)) throw err('Diese Passport-Review wurde bereits entschieden', 409); const decision = text(input.decision, 20).toLowerCase(); const note = text(input.decision_note, 1200); if (!['approve', 'return'].includes(decision) || note.length < 12) throw err('Entscheidung approve oder return und eine nachvollziehbare Notiz (mind. 12 Zeichen) sind Pflicht'); const passport = passportById(db, review.passport_id); const livePreflight = preflightFor(db, passport);
  if (decision === 'approve' && !livePreflight.ready) throw err('Approval ist blockiert: Preflight hat noch offene Pflichtpunkte: ' + livePreflight.blocking_checks.join(', '), 409);
  review.state = decision === 'approve' ? 'OWNER_APPROVED_LOCAL_RELEASE_READY' : 'RETURNED_TO_LOCAL_WORK'; review.decided_at = now(); review.decided_by = a.by; review.decision_note = note; review.preflight_at_decision = livePreflight; passport.stage = decision === 'approve' ? 'RELEASE_READINESS' : 'PRODUCTION'; passport.state = decision === 'approve' ? 'LOCAL_RELEASE_READY_NOT_DISTRIBUTED' : 'LOCAL_PROJECT_PASSPORT_ACTIVE'; audit(db, 'passport_review_decided', { passport: passport.id, review: review.id, decision, by: a.by }); save(db); return { review, passport: passportView(db, passport), note: decision === 'approve' ? 'Owner approved local readiness only. Nothing was distributed, published, sent, rendered or charged.' : 'Passport returned to local work; no external action occurred.' };
}
function packageFor(db, passport) { const view = passportView(db, passport); return { passport_id: passport.id, title: passport.title, type: view.type.name, state: 'LOCAL_RELEASE_OR_PRODUCT_PACKAGE_READY', rights_packet: view.assets.map((x) => ({ asset: x.id, title: x.title, rights_state: x.rights_state, evidence_reference: x.evidence_reference })).filter((x) => x.rights_state), version_graph: { nodes: view.assets.map((x) => ({ id: x.id, type: x.asset_type, version: x.version, state: x.state })), edges: view.edges }, credits: view.contributors.map((x) => ({ credit_name: x.credit_name, role: x.role, share_pct: x.share_pct, state: x.state })), metadata: passport.metadata, content_and_handoffs: view.handoffs, release_preflight: view.preflight, external_state: 'NO_MEDIA_EXPORT_NO_RENDER_NO_DISTRIBUTION_NO_PUBLICATION' }; }
function buildPackage(passportId, input = {}) { const db = load(); const a = requireAdmin(input, 'Aufbau eines lokalen Release-/Product-Package'); const passport = passportById(db, passportId); if (!passport) throw err('Passport unbekannt', 404); const pkg = packageFor(db, passport); audit(db, 'passport_package_built', { passport: passport.id, by: a.by }); save(db); return pkg; }
function priorityScore(task) { return ({ urgent: 400, high: 300, medium: 200, low: 100 })[task.priority] + (task.state === 'BLOCKED' ? 80 : task.state === 'IN_PROGRESS' ? 40 : 0) + (task.due_on && task.due_on <= new Date().toISOString().slice(0, 10) ? 60 : 0); }
function studioToday(profileId) {
  try {
    const rows = require('./studio_command').data().projects.filter((x) => !profileId || x.profile_id === profileId);
    const blocking = rows.flatMap((p) => p.notes.filter((x) => x.severity === 'blocking' && x.state !== 'RESOLVED').map((x) => ({ kind: 'STUDIO_REVIEW', score: 480, passport_id: p.passport_id || null, passport_title: 'Studio · ' + p.title, title: 'Studio review: ' + p.title, detail: (x.timecode || 'project-level') + ' · ' + x.body, href: '/studio-command' })));
    const stages = rows.filter((p) => p.stage !== 'DELIVERY_READY').map((p) => ({ kind: 'STUDIO', score: p.preflight.state === 'LOCAL_STUDIO_PREFLIGHT_BLOCKED' ? 360 : 230, passport_id: p.passport_id || null, passport_title: 'Studio · ' + p.title, title: 'Studio stage: ' + p.title, detail: p.stage + ' · ' + p.preflight.state, href: '/studio-command' }));
    return { total: rows.length, delivery_ready_local: rows.filter((x) => x.stage === 'DELIVERY_READY').length, projects: rows.map((x) => ({ id: x.id, title: x.title, stage: x.stage, preflight: x.preflight.state, passport_id: x.passport_id })), focus: [...blocking, ...stages], state: 'LOCAL_STUDIO_READ_ONLY' };
  } catch { return { total: 0, delivery_ready_local: 0, projects: [], focus: [], state: 'NO_STUDIO_LOOKUP' }; }
}
function today(input = {}) {
  const db = load(); const profileId = text(input.profile_id, 100); const passports = db.passports.filter((x) => !profileId || x.profile_id === profileId).filter((x) => x.state !== 'ARCHIVED_LOCAL'); const assetBlocks = passports.flatMap((p) => db.assets.filter((x) => x.passport_id === p.id && ['PENDING_OWNER_REVIEW', 'BLOCKED_UNCLEAR_RIGHTS'].includes(x.rights_state)).map((x) => ({ kind: 'RIGHTS', score: 500, passport_id: p.id, passport_title: p.title, title: x.title, detail: x.rights_state, href: '/creator-passport#passport-' + p.id })));
  const taskFocus = passports.flatMap((p) => db.tasks.filter((x) => x.passport_id === p.id && x.state !== 'DONE').map((x) => ({ kind: x.lane, score: priorityScore(x), passport_id: p.id, passport_title: p.title, task_id: x.id, title: x.title, detail: x.state + ' · ' + x.priority + (x.due_on ? ' · due ' + x.due_on : ''), href: '/creator-passport#passport-' + p.id })));
  const missing = passports.flatMap((p) => { const preflight = preflightFor(db, p); return preflight.checks.filter((x) => !x.pass).map((x) => ({ kind: 'PREFLIGHT', score: x.id === 'rights' ? 490 : 350, passport_id: p.id, passport_title: p.title, title: 'Preflight: ' + x.id, detail: x.note, href: '/creator-passport#passport-' + p.id })); });
  const reviews = db.reviews.filter((x) => passports.some((p) => p.id === x.passport_id) && ['PENDING_OWNER_RELEASE_DECISION', 'PREFLIGHT_BLOCKED_OWNER_REVIEW_REQUIRED'].includes(x.state)).map((x) => ({ review_id: x.id, passport_id: x.passport_id, state: x.state }));
  let revenue = { credits: 0, pending: 0, state: 'NO_REVENUE_LOOKUP' }; try { const r = require('./creator_revenue').data(); revenue = { credits: r.credits.filter((x) => !profileId || x.referrer_profile_id === profileId).length, pending: r.checkouts.filter((x) => !profileId || x.profile_id === profileId).filter((x) => /UNVALIDATED|CREATED/.test(x.state)).length, state: 'LOCAL_SIMULATION_LEDGER_READ_ONLY' }; } catch {}
  let collaboration = { rooms: 0, rounds: 0, state: 'NO_COLLAB_LOOKUP' }; try { const c = require('./creator_collaboration').data(); const rooms = c.rooms.filter((x) => !profileId || x.profile_id === profileId); collaboration = { rooms: rooms.length, rounds: c.rounds.filter((x) => rooms.some((r) => r.id === x.room_id)).length, state: 'LOCAL_COLLABORATION_READ_ONLY' }; } catch {}
  const studio = studioToday(profileId); const focus = [...assetBlocks, ...taskFocus, ...missing, ...studio.focus].sort((a, b) => b.score - a.score).slice(0, 7); return { generated_at: now(), scope: profileId || 'all local passports', headline: focus[0] ? focus[0].title : 'No open local creator work', focus, owner_reviews: reviews, projects: passports.map((p) => ({ id: p.id, title: p.title, stage: p.stage, state: p.state, preflight: preflightFor(db, p).state })), revenue, collaboration, studio, policy: 'Today View summarizes only local AURA records. It never reads a third-party inbox, retrieves external metrics, sends reminders, posts content or makes business decisions without an owner.' };
}
function data() { const db = load(); return { project_types: PROJECT_TYPES, asset_types: ASSET_TYPES, rights_modes: RIGHTS, relations: RELATIONS, task_lanes: TASK_LANES, handoff_areas: HANDOFF_AREAS, passports: db.passports.map((x) => passportView(db, x)), today: today(), audit: db.audit.slice(0, 100), external_state: 'LOCAL_CREATOR_PROJECT_GRAPH_ONLY' }; }
function status() { const db = load(); const active = db.passports.filter((x) => x.state !== 'ARCHIVED_LOCAL'); return { area: '101', mode: 'LIVE', name: 'Creator Project / Release Passport & Today View', passport: { total: db.passports.length, active: active.length, assets: db.assets.length, version_edges: db.edges.length, tasks_open: db.tasks.filter((x) => x.state !== 'DONE').length, local_reviews: db.reviews.length }, workflows: { stages: TASK_LANES, project_types: PROJECT_TYPES.map((x) => ({ id: x.id, name: x.name })), integrations: HANDOFF_AREAS, today_view: 'LIVE_LOCAL_PRIORITY_SUMMARY' }, policy: ['Passport stores local project metadata and references, never media bytes or external uploads.', 'Asset/Version Graph is non-destructive metadata only; no stem split, DAW edit, audio render, image/video render or export is performed.', 'Rights status is a local owner record, not legal advice, copyright clearance, contract creation or legal determination.', 'Local release-ready approval never distributes, publishes, sends, charges, delivers to a client or opens a provider account.', 'Today View reads only local AURA records and never autonomously messages, schedules, posts or decides for the owner.'] }; }
module.exports = { meta: { area: '101', id: 'creator_passport', name: 'Creator Project / Release Passport & Today View', state: 'live' }, actions: { status: () => status(), passport_create: (p) => createPassport(p || {}), asset_add: (p) => addAsset(p || {}), edge_add: (p) => addEdge(p || {}), contributor_add: (p) => addContributor(p || {}), task_add: (p) => addTask(p || {}), task_set_state: (p) => setTaskState((p || {}).task_id, p || {}), handoff_link: (p) => linkHandoff(p || {}), review_request: (p) => requestReview((p || {}).passport_id, p || {}), review_decide: (p) => decideReview((p || {}).review_id, p || {}), package_build: (p) => buildPackage((p || {}).passport_id, p || {}), today: (p) => today(p || {}) }, status, data, createPassport, addAsset, addEdge, addContributor, addTask, setTaskState, linkHandoff, preflightFor, requestReview, decideReview, buildPackage, today, PROJECT_TYPES, ASSET_TYPES, RIGHTS, RELATIONS, HANDOFF_AREAS };
