'use strict';
// AURA Area 94 — Capability Radar & Adoption Lab.
// A local, reviewable bridge between the curated source index already carried by
// AURA and real workflow upgrades. It never clones, installs, calls or publishes
// through a listed project. Every source is an original-link reference and every
// adoption stays a human-approved local plan until a separately configured adapter
// is available.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'capability_radar.json');
const CAP = 400;
const STAGES = ['scoped', 'source_review', 'local_prototype', 'integration_spec', 'approval_ready', 'approved'];

const SOURCES = [
  { id: 'hyperframes', name: 'HyperFrames', original_url: 'https://github.com/heygen-com/hyperframes', category: 'render', readiness: 'AURA_ADAPTER_PATH', fit: ['91 Media Studio', '92 Social Growth'], outcome: 'HTML-Szenen in einen überprüfbaren Video-Renderweg überführen.', bridge: 'Area 09/91 Media Planning → Area 92 derivative brief', delivery: 'self-host / authorized adapter review' },
  { id: 'voicebox', name: 'VoiceBox', original_url: 'https://github.com/jamiepine/voicebox', category: 'voice', readiness: 'ADOPTION_REVIEW', fit: ['91 Media Studio', 'STUDIO47'], outcome: 'Eigene bzw. nachweislich autorisierte Stimmen in Narration- und Avatar-Briefs führen.', bridge: 'Area 91 speaking script → authorized voice adapter', delivery: 'self-host / consent-gated voice lane' },
  { id: 'comfyui', name: 'ComfyUI', original_url: 'https://github.com/comfyanonymous/ComfyUI', category: 'visual', readiness: 'AURA_ADAPTER_PRESENT', fit: ['71 ImageGen', '91 Media Studio'], outcome: 'Node-basierte Visual- und Cover-Varianten für eigene Releases und Kampagnen.', bridge: 'Area 71 configured engine → Media / Social asset brief', delivery: 'already has a local AURA gateway path' },
  { id: 'a1111_webui', name: 'Stable Diffusion WebUI', original_url: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', category: 'visual', readiness: 'AURA_ADAPTER_PRESENT', fit: ['71 ImageGen', '91 Media Studio'], outcome: 'Alternative REST-Renderlane für Creative-Varianten.', bridge: 'Area 71 fallback engine → media asset workflow', delivery: 'already has a local AURA gateway path' },
  { id: 'n8n', name: 'n8n', original_url: 'https://github.com/n8n-io/n8n', category: 'automation', readiness: 'AURA_ADAPTER_PATH', fit: ['15 secure dispatch', '93 Growth Nexus'], outcome: 'Reviewbare Webhook- und Hintergrundjob-Ketten für freigegebene interne Handoffs.', bridge: 'Area 93 local recipe → Area 15 signed dispatch design', delivery: 'self-host / signed callback review' },
  { id: 'agent_reach', name: 'Agent-Reach', original_url: 'https://github.com/Panniantong/Agent-Reach', category: 'research', readiness: 'ADOPTION_REVIEW', fit: ['21 News Analysis', '91 Newsroom'], outcome: 'Lesender Quellenzugriff über zulässige, offizielle Schnittstellen statt Ad-hoc-Scraping.', bridge: 'News watch → source note → original newsroom brief', delivery: 'official API + read-only scopes only' },
  { id: 'hindsight', name: 'Hindsight', original_url: 'https://github.com/vectorize-io/hindsight', category: 'memory', readiness: 'ADOPTION_REVIEW', fit: ['69 Learning', '93 Growth Nexus'], outcome: 'Kampagnenentscheidungen, Learnings und verworfene Varianten langfristig wiederfinden.', bridge: 'verified metric import → campaign learning memory', delivery: 'deletable, auditable memory service' },
  { id: 'openshell', name: 'NVIDIA OpenShell', original_url: 'https://github.com/NVIDIA/OpenShell', category: 'runtime', readiness: 'ADOPTION_REVIEW', fit: ['29 Mesh', '72 MCP'], outcome: 'Abgegrenzte Runtime für klar erlaubte Agenten- und Toolaufgaben.', bridge: 'planned capability → sandboxed execution design', delivery: 'least-privilege self-host review' },
  { id: 'anythingllm', name: 'AnythingLLM', original_url: 'https://github.com/mintplex-labs/anything-llm', category: 'knowledge', readiness: 'ADOPTION_REVIEW', fit: ['18 Knowledge Sync', '91 Newsroom'], outcome: 'Lokale Wissensräume für eigene Briefs, Rechtebelege und Produktionsdokumente.', bridge: 'owned documents → searchable project workspace', delivery: 'self-host / source access review' },
  { id: 'uptime_kuma', name: 'Uptime Kuma', original_url: 'https://github.com/louislam/uptime-kuma', category: 'reliability', readiness: 'AURA_ADAPTER_PATH', fit: ['34 Gateway Health', '74 Service Fabric'], outcome: 'Übersichtliche Verfügbarkeit für selbst betriebene Render-, Site- und Connector-Lanes.', bridge: 'known self-hosted endpoint → health observation', delivery: 'self-host / no credential capture in AURA' },
  { id: 'excalidraw', name: 'Excalidraw', original_url: 'https://github.com/excalidraw/excalidraw', category: 'planning', readiness: 'ADOPTION_REVIEW', fit: ['93 Growth Nexus', '74 Service Fabric'], outcome: 'Schnelle visuelle Campaign-, Release- und System-Maps für Reviews.', bridge: 'Campaign Graph → visual review board', delivery: 'self-host / export-only workflow' },
  { id: 'a2a', name: 'Agent2Agent Protocol', original_url: 'https://github.com/a2aproject/A2A', category: 'protocol', readiness: 'AURA_SURFACE_PRESENT', fit: ['84 Intercom', '72 MCP'], outcome: 'Standardisierte Agent-Übergaben mit klaren Karten und Aufgaben.', bridge: 'AURA Agent Card → explicit delegated task contract', delivery: 'AURA has a local A2A surface; remote peers need separate approval' },
  { id: 'official_plugins', name: 'Official Plugin Directory', original_url: 'https://github.com/anthropics/claude-plugins-official', category: 'connectors', readiness: 'REFERENCE_CATALOG', fit: ['72 MCP', '70 Module Hub'], outcome: 'Kuratiertes Ausgangsmaterial für mögliche Tool- und Connector-Reviews.', bridge: 'candidate → manifest review → explicit grants', delivery: 'reference only until reviewed' },
  { id: 'api_megalist', name: 'API Mega List', original_url: 'https://github.com/cporter202/API-mega-list', category: 'catalog', readiness: 'AURA_INDEX_PRESENT', fit: ['19 Yellow Pages', '15/72/93'], outcome: 'Breite Discoverability für offizielle API-Kandidaten und Nischen-Use-Cases.', bridge: 'category → connector brief → Vault/Fabric review', delivery: 'reference index; no blind connector admission' },
  { id: 'public_apis', name: 'Public APIs', original_url: 'https://github.com/public-apis/public-apis', category: 'catalog', readiness: 'REFERENCE_CATALOG', fit: ['19 Yellow Pages', '61 Workflow Builder'], outcome: 'Zusätzliche Startpunkte für sauber prüfbare öffentliche Datenquellen.', bridge: 'candidate → policy and provenance review', delivery: 'reference only until reviewed' },
  { id: 'awesome_selfhosted', name: 'awesome-selfhosted', original_url: 'https://github.com/awesome-selfhosted/awesome-selfhosted', category: 'infrastructure', readiness: 'REFERENCE_CATALOG', fit: ['74 Service Fabric', '34 Gateway Health'], outcome: 'Self-hosted Alternativen für den langfristigen unabhängigen Stack.', bridge: 'service candidate → private deployment plan → health check', delivery: 'reference only until reviewed' },
  { id: 'impeccable', name: 'Impeccable', original_url: 'https://github.com/pbakaus/impeccable', category: 'design', readiness: 'WORKFLOW_GUIDANCE', fit: ['48 UI/UX', 'all AURA pages'], outcome: 'Design-Qualitätsgates für alle neuen Oberflächen und Workflows.', bridge: 'product brief → design gate → AURA UI build', delivery: 'guidance source only' },
  { id: 'uiux_pro_max', name: 'UI/UX Pro Max', original_url: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill', category: 'design', readiness: 'WORKFLOW_GUIDANCE', fit: ['48 UI/UX', '94 Adoption Lab'], outcome: 'Schnellere, konsistentere Frontend-Entscheidungen für neue Operator-Tools.', bridge: 'workflow brief → interaction/design system pass', delivery: 'guidance source only' },
  { id: 'superpowers', name: 'Superpowers', original_url: 'https://github.com/obra/superpowers', category: 'engineering', readiness: 'WORKFLOW_GUIDANCE', fit: ['77 Test Lab', '85 Harness Kit'], outcome: 'Plan-Execute-Verify-Rhythmus für stabilen Ausbau statt Tool-Sammeln.', bridge: 'adoption plan → testable implementation → verification', delivery: 'methodology source only' },
  { id: 'ecc', name: 'ECC', original_url: 'https://github.com/affaan-m/ECC', category: 'engineering', readiness: 'WORKFLOW_GUIDANCE', fit: ['69 Learning', '85 Harness Kit'], outcome: 'Messbare Verbesserung von Harness, Memory und Arbeitsgeschwindigkeit.', bridge: 'observed bottleneck → benchmark → local improvement plan', delivery: 'methodology source only' },
  { id: 'unsloth', name: 'Unsloth', original_url: 'https://github.com/unslothai/unsloth', category: 'models', readiness: 'ADOPTION_REVIEW', fit: ['79 Model Bay', '27 Compute'], outcome: 'Eigene lokale Modell-Lane für klar begrenzte, autorisierte Workloads.', bridge: 'model candidate → own hardware evaluation → compute route', delivery: 'own hardware / model-license review' },
  { id: 'awesome_claude_skills', name: 'Awesome Claude Skills', original_url: 'https://github.com/ComposioHQ/awesome-claude-skills', category: 'catalog', readiness: 'REFERENCE_CATALOG', fit: ['19 Catalog Ingestor', '72 MCP'], outcome: 'Kandidatenpool für Skills, die erst durch AURAs Prüfpfad gehen.', bridge: 'candidate → source review → skill registry admission', delivery: 'reference only until reviewed' },
  { id: 'moneyprinterturbo', name: 'MoneyPrinterTurbo', original_url: 'https://github.com/harry0703/moneyprinterTurbo', category: 'video', readiness: 'REFERENCE_CATALOG', fit: ['91 Media Studio', '92 Social Growth'], outcome: 'Ideengeber für lokale Skript-zu-Video-Lanes und Produktionschecklisten.', bridge: 'original script → internal video plan → human review', delivery: 'reference only; no unattended upload route' },
  { id: 'openmausbot', name: 'OpenMausBot', original_url: 'https://github.com/milind-soni/openmausebot', category: 'agent', readiness: 'REFERENCE_CATALOG', fit: ['85 Harness Kit', '84 Intercom'], outcome: 'Referenzmaterial für lokale Agenten-Harness-Patterns.', bridge: 'pattern review → AURA-local tool policy', delivery: 'reference only; own accounts and official APIs only' },
];

const PLAYBOOKS = [
  { id: 'studio47_audio_visual_cell', name: 'STUDIO47 Audio → Visual Cell', sources: ['voicebox', 'comfyui', 'hyperframes'], areas: ['91', '71', '92'], outcome: 'Aus einem eigenen Track- oder Setbrief werden lizenzklare Assets, Voice-/Avatar-Skript, Visual-Brief und Short-Form-Handoff.', steps: ['Rechtebelegte Audio-/Stem-Auswahl', 'DAW-/Video-Produktionsplan', 'eigene Visual-Varianten', 'Social-Cutdown-Brief', 'Human Review'] },
  { id: 'release_wave_factory', name: 'Release Wave Factory', sources: ['n8n', 'hindsight', 'api_megalist'], areas: ['90', '92', '93'], outcome: 'Release, Page, Social, Paid-Plan und spätere echte Kennzahlen werden zu einer lernenden Kampagnenwelle.', steps: ['Release-QC', 'Social/Routing', 'Owned Page + UTM', 'lokale Review-Recipes', 'verified metrics → learn loop'] },
  { id: 'avatar_news_bulletin', name: 'Avatar & News Bulletin Desk', sources: ['voicebox', 'agent_reach', 'hyperframes'], areas: ['91', '21'], outcome: 'Kuratierten Quellenfunden folgen eigene Einordnung, freigegebenes Avatar-Skript und ein Video-Runbook.', steps: ['Watchlist', 'Fund mit Kontext', 'eigener Ticker-Brief', 'authorisierte Stimme', 'Render-/Channel-Review'] },
  { id: 'creative_variance_engine', name: 'Creative Variance Engine', sources: ['comfyui', 'a1111_webui', 'impeccable'], areas: ['71', '40', '91'], outcome: 'Cover, Motion, Thumbnail und Ad-Creatives werden als klare Variantenmatrix statt Bauchgefühl geplant.', steps: ['Creative hypothesis', 'variant brief', 'local render route', 'rights/QC review', 'official outcome import'] },
  { id: 'campaign_memory_loop', name: 'Campaign Memory Loop', sources: ['hindsight', 'ecc', 'superpowers'], areas: ['93', '69', '77'], outcome: 'Jede echte Kampagnenentscheidung kann mit Ergebnis, Kontext und nächstem Test wiedergefunden werden.', steps: ['verified metric snapshot', 'human finding', 'memory candidate review', 'next experiment plan', 'test/verification'] },
  { id: 'trusted_connector_intake', name: 'Trusted Connector Intake', sources: ['official_plugins', 'api_megalist', 'a2a'], areas: ['72', '70', '38'], outcome: 'Neue Tools gelangen über einen klaren Prüfpfad in AURA statt direkt in produktive Workflows.', steps: ['source selection', 'license/ToS review', 'permission map', 'sandbox/local prototype', 'explicit approval'] },
  { id: 'self_hosted_creator_stack', name: 'Self-Hosted Creator Stack', sources: ['awesome_selfhosted', 'uptime_kuma', 'openshell'], areas: ['74', '34', '29'], outcome: 'Selbst betriebene Produktionsdienste können geplant, abgeschottet und beobachtet werden.', steps: ['service candidate', 'deployment design', 'least privilege', 'health check', 'operator runbook'] },
  { id: 'knowledge_room', name: 'Owned Knowledge Room', sources: ['anythingllm', 'agent_reach', 'public_apis'], areas: ['18', '19', '91'], outcome: 'Eigene Dokumente, Rechtebelege, Release-Notizen und Quellensignale bleiben strukturiert auffindbar.', steps: ['owned corpus boundary', 'source/provenance note', 'workspace plan', 'access policy', 'reviewable retrieval'] },
  { id: 'operator_design_system', name: 'Operator Design System', sources: ['uiux_pro_max', 'impeccable', 'excalidraw'], areas: ['48', '93', '94'], outcome: 'Komplexe AURA-Workflows werden als schnelle, sichtbare Operator-Flows gestaltet.', steps: ['workflow map', 'decision points', 'UI brief', 'accessibility check', 'operator feedback'] },
];

function empty() { return { adoptions: [], audit: [] }; }
function load() { try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...empty(), ...db, adoptions: Array.isArray(db.adoptions) ? db.adoptions : [], audit: Array.isArray(db.audit) ? db.audit : [] }; } catch { const fresh = empty(); try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* read-only ok */ } return fresh; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function text(v, max = 1000) { return String(v || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) { const by = text((input || {}).approved_by || (input || {}).admin, 80); const authorization = text((input || {}).admin_authorization, 300); if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization'); return { by, authorization }; }
function sourceById(value) { return SOURCES.find((x) => x.id === String(value)); }
function adoptionView(adoption) { const source = sourceById(adoption.source_id); return { ...adoption, source: source ? { id: source.id, name: source.name, original_url: source.original_url, readiness: source.readiness, delivery: source.delivery } : null, execution_state: 'LOCAL_ADOPTION_PLAN_ONLY', external_state: 'NO_SOURCE_FETCH_NO_INSTALL_NO_EXTERNAL_ACTION' }; }

function targets() {
  const media = require('./media_newsroom').listProjects();
  const social = require('./social_control').listLaunches();
  const growth = require('./growth_nexus').listBlueprints();
  return [
    { ref: 'aura_core:AURA', type: 'aura_core', id: 'AURA', title: 'AURA Core / general operating stack', state: 'LIVE' },
    ...media.map((x) => ({ ref: 'media_project:' + x.id, type: 'media_project', id: x.id, title: x.title, state: x.stage })),
    ...social.map((x) => ({ ref: 'social_launch:' + x.id, type: 'social_launch', id: x.id, title: x.title, state: x.stage })),
    ...growth.map((x) => ({ ref: 'growth_blueprint:' + x.id, type: 'growth_blueprint', id: x.id, title: x.title, state: x.stage })),
  ];
}
function targetByRef(value) { return targets().find((x) => x.ref === String(value)); }
function createAdoption(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines Capability-Adoption-Plans'); const source = sourceById(text(input.source_id, 100)); if (!source) throw err('Unbekannte Capability-Quelle', 404);
  const target = targetByRef(text(input.target_ref, 180) || 'aura_core:AURA'); if (!target) throw err('Verknüpftes AURA-Ziel ist nicht mehr vorhanden', 404);
  const scope = text(input.scope, 2400); const owner = text(input.owner, 120); if (scope.length < 25 || owner.length < 2) throw err('Konkreter Umfang (mind. 25 Zeichen) und Owner sind Pflicht');
  const title = text(input.title, 180) || (source.name + ' → ' + target.title);
  const adoption = { id: id('adopt'), title, source_id: source.id, target_ref: target.ref, target_snapshot: { type: target.type, id: target.id, title: target.title, state: target.state }, scope, owner, stage: 'scoped', source_review: null, integration_spec: null, approval: null, created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, versions: [{ at: now(), to: 'scoped', by: a.by, note: 'local source-to-workflow adoption plan created' }] };
  db.adoptions.unshift(adoption); if (db.adoptions.length > CAP) db.adoptions.length = CAP; audit(db, 'capability_adoption_created', { adoption: adoption.id, source: source.id, target: target.ref, by: a.by }); save(db); return adoptionView(adoption);
}
function buildBrief(adoptionId) {
  const db = load(); const p = db.adoptions.find((x) => x.id === String(adoptionId)); if (!p) throw err('Adoption-Plan unbekannt', 404); const source = sourceById(p.source_id); if (!source) throw err('Quellenreferenz unbekannt', 404);
  const checklist = [
    'Original prüfen: ' + source.original_url,
    'Lizenz, Version/Commit, Maintainer- und Sicherheitslage selbst dokumentieren.',
    'Benötigte Berechtigungen und Datenflüsse minimal halten; Secrets ausschließlich im Vault/Provider-Flow.',
    'Zuerst lokalen, nicht-produktiven Prototyp bauen; kein automatischer Install/Clone/Deploy durch AURA.',
    'Für externe Connectoren: offizielles OAuth/API-Setup und eigene Freigabe separat durchführen.',
    'Nachweisbar testen, dann erst eine explizite Freigabe für den begrenzten Umfang erteilen.',
  ];
  audit(db, 'capability_brief_built', { adoption: p.id, source: source.id }); save(db);
  return { adoption: adoptionView(p), mode: 'LOCAL_INTEGRATION_BRIEF', original_source: source.original_url, checklist, note: 'Dieser Brief erzeugt nur eine lokale Prüfliste. Er lädt keinen Code, installiert nichts und löst keinen externen Vorgang aus.' };
}
function advanceAdoption(adoptionId, input = {}) {
  const db = load(); const p = db.adoptions.find((x) => x.id === String(adoptionId)); if (!p) throw err('Adoption-Plan unbekannt', 404);
  const target = text(input.stage, 80); const pos = STAGES.indexOf(p.stage); const next = STAGES.indexOf(target); if (next !== pos + 1) throw err('Stufen laufen nacheinander: aktuell ' + p.stage + ', nächster Schritt ' + STAGES[pos + 1]);
  if (target === 'source_review') {
    const license_review = text(input.license_review, 1200), security_review = text(input.security_review, 1600), source_revision = text(input.source_revision, 160);
    if (license_review.length < 15 || security_review.length < 25 || source_revision.length < 4) throw err('Source Review braucht Lizenz-/Nutzungsnotiz, Sicherheitsnotiz und konkrete Version/Revision oder Prüfdatum');
    p.source_review = { at: now(), license_review, security_review, source_revision, by: text(input.reviewer, 80) || p.owner };
  }
  if (target === 'integration_spec') {
    const notes = text(input.integration_notes, 2200); if (notes.length < 25) throw err('Integration Spec braucht mindestens 25 Zeichen zu Adapter, Grenzen, Datenfluss und Testweg');
    p.integration_spec = { at: now(), notes, by: text(input.reviewer, 80) || p.owner };
  }
  if (target === 'approved') { const a = requireAdmin(input, 'Freigabe eines Capability-Adoption-Plans'); p.approval = { at: now(), by: a.by, authorization: a.authorization }; }
  p.stage = target; p.updated_at = now(); p.versions.push({ at: now(), to: target, by: text(input.reviewer, 80) || text(input.approved_by || input.admin, 80) || p.owner, note: text(input.note, 600) }); audit(db, 'capability_adoption_stage', { adoption: p.id, source: p.source_id, stage: target }); save(db); return adoptionView(p);
}
function listAdoptions() { return load().adoptions.slice(0, CAP).map(adoptionView); }
function status() { const db = load(); const byReadiness = Object.fromEntries([...new Set(SOURCES.map((x) => x.readiness))].map((s) => [s, SOURCES.filter((x) => x.readiness === s).length])); return { area: '94', mode: 'LIVE', name: 'Capability Radar & Adoption Lab', source_index: { total: SOURCES.length, local_indexed: SOURCES.length, by_readiness: byReadiness, categories: [...new Set(SOURCES.map((x) => x.category))].sort() }, playbooks: { total: PLAYBOOKS.length, ids: PLAYBOOKS.map((x) => x.id) }, adoptions: { total: db.adoptions.length, by_stage: Object.fromEntries(STAGES.map((s) => [s, db.adoptions.filter((x) => x.stage === s).length])) }, policy: ['Original links are visible on every source card', 'Source index is locally curated; it is not a claim of a live GitHub scan', 'No clone, install, code execution, source fetch, credential entry, publish, deploy or spend happens through this Area', 'Every adoption goes source review → local prototype → integration spec → explicit approval', 'Future connectors remain separate official/authorized integrations with their own receipts and gates'] }; }

module.exports = { meta: { area: '94', id: 'capability_radar', name: 'Capability Radar & Adoption Lab (source index → reviewable workflow upgrades)', state: 'live' }, actions: { status: () => status(), adoption_create: (p) => createAdoption(p || {}), adoption_brief: (p) => buildBrief((p || {}).adoption_id), adoption_advance: (p) => advanceAdoption((p || {}).adoption_id, p || {}) }, status, listSources: () => SOURCES.map((x) => ({ ...x })), listPlaybooks: () => PLAYBOOKS.map((x) => ({ ...x, sources: x.sources.map((id) => sourceById(id)).filter(Boolean).map((s) => ({ id: s.id, name: s.name, original_url: s.original_url })) })), targets, createAdoption, buildBrief, advanceAdoption, listAdoptions, STAGES, SOURCES, PLAYBOOKS };
