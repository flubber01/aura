'use strict';
// AURA Area 93 — Growth Nexus & Automation.
// Cross-area campaign control: it joins approved content, media, creator,
// label, social, owned pages, paid-flight plans, calendar milestones and
// official metrics imports into one reviewable campaign graph. It deliberately
// creates local briefs/checklists/queues only — never fake posts, ad spend,
// analytics or a provider connection.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const schedule = require('./schedule');

const FILE = path.join(__dirname, '..', 'data', 'growth_nexus.json');
const CAP = 400;
const STAGES = ['brief', 'handoffs_ready', 'review', 'approved'];
const AUTOMATION_TRIGGERS = ['content_package_approved', 'media_project_approved', 'creator_campaign_planned', 'label_release_planned', 'social_launch_queue_ready', 'official_metrics_imported'];
const AUTOMATION_ACTIONS = ['create_growth_alert', 'prepare_social_launch_brief', 'prepare_page_handoff_brief', 'prepare_paid_flight_checklist', 'request_human_review', 'prepare_learn_loop'];
const METRIC_SOURCES = ['official_platform_export', 'official_ads_export', 'owned_analytics_export', 'manual_verified_report'];

function empty() { return { blueprints: [], automations: [], audit: [] }; }
function load() {
  try {
    const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...empty(), ...db, blueprints: Array.isArray(db.blueprints) ? db.blueprints : [], automations: Array.isArray(db.automations) ? db.automations : [], audit: Array.isArray(db.audit) ? db.audit : [] };
  } catch { return empty(); }
}
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, FILE); }
function now() { return new Date().toISOString(); }
function id(prefix) { return prefix + '-' + crypto.randomBytes(4).toString('hex'); }
function text(v, max = 800) { return String(v || '').trim().slice(0, max); }
function err(message, code = 400) { const e = new Error(message); e.code = code; return e; }
function audit(db, event, detail = {}) { db.audit.unshift({ at: now(), event, ...detail }); if (db.audit.length > CAP) db.audit.length = CAP; }
function requireAdmin(input, action) {
  const by = text((input || {}).approved_by || (input || {}).admin, 80);
  const authorization = text((input || {}).admin_authorization, 280);
  if (!by || authorization.length < 3) throw err('REGEL 1: ' + action + ' braucht approved_by und eine explizite admin_authorization');
  return { by, authorization };
}
function sources() {
  // Lazy requires keep all areas independently bootable and avoid cycles.
  const content = require('./content_command');
  const creator = require('./creator_desk');
  const label = require('./label_desk');
  const media = require('./media_newsroom');
  const social = require('./social_control');
  return { content, creator, label, media, social };
}
function catalog() {
  const { content, creator, label, media, social } = sources();
  return {
    content_packages: content.listPackages().map((x) => ({ id: x.id, title: x.title, stage: x.stage, formats: x.formats || [] })),
    creator_campaigns: creator.listCampaigns().map((x) => ({ id: x.id, title: x.title, stage: x.stage, profiles: (x.profile_ids || []).length })),
    label_releases: label.listReleases().map((x) => ({ id: x.id, title: x.title, stage: x.stage, artist: x.artist_name || x.artist_id, catalog_no: x.internal_catalog_no })),
    media_projects: media.listProjects().map((x) => ({ id: x.id, title: x.title, stage: x.stage, kind: x.kind })),
    social_launches: social.listLaunches().map((x) => ({ id: x.id, title: x.title, stage: x.stage, routes: (x.routes || []).length, page_handoff: !!x.web_handoff, paid_flight: !!x.paid_activation })),
    web_properties: social.listWebProperties().map((x) => ({ id: x.id, name: x.name, kind: x.kind, base_url: x.base_url, connection_state: x.connection_state })),
  };
}
function byId(items, value) { return items.find((x) => x.id === String(value)); }
function view(db, blueprint) {
  return { ...blueprint, external_state: 'NO_EXTERNAL_ACTION_BY_NEXUS', milestones: Array.isArray(blueprint.milestones) ? blueprint.milestones : [], metrics: Array.isArray(blueprint.metrics) ? blueprint.metrics : [] };
}
function assertSourceLink(input, cat) {
  const links = {
    content_package_id: text(input.content_package_id, 100), creator_campaign_id: text(input.creator_campaign_id, 100), label_release_id: text(input.label_release_id, 100), media_project_id: text(input.media_project_id, 100), social_launch_id: text(input.social_launch_id, 100), web_property_id: text(input.web_property_id, 100),
  };
  if (!Object.values(links).some(Boolean)) throw err('Mindestens ein freigegebenes Work-Objekt aus Content, Creator, Label, Media, Social oder Web auswählen');
  if (links.content_package_id && !byId(cat.content_packages, links.content_package_id)) throw err('Content-Paket unbekannt', 404);
  if (links.creator_campaign_id && !byId(cat.creator_campaigns, links.creator_campaign_id)) throw err('Creator-Kampagne unbekannt', 404);
  if (links.label_release_id && !byId(cat.label_releases, links.label_release_id)) throw err('Label-Release unbekannt', 404);
  if (links.media_project_id && !byId(cat.media_projects, links.media_project_id)) throw err('Media-Projekt unbekannt', 404);
  if (links.social_launch_id && !byId(cat.social_launches, links.social_launch_id)) throw err('Social-Launch unbekannt', 404);
  if (links.web_property_id && !byId(cat.web_properties, links.web_property_id)) throw err('Web Property unbekannt', 404);
  return links;
}
function createBlueprint(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Anlage eines Growth-Blueprints'); const cat = catalog();
  const title = text(input.title, 180); const goal = text(input.goal, 400); const audience = text(input.audience, 400); const links = assertSourceLink(input, cat);
  if (title.length < 3 || goal.length < 12) throw err('Blueprint-Titel und konkretes Wachstumsziel sind Pflicht');
  const blueprint = { id: id('growth'), title, goal, audience, links, stage: 'brief', graph: null, review_notes: '', approval: null, milestones: [], metrics: [], created_at: now(), updated_at: now(), created_by: a.by, authorization: a.authorization, versions: [{ at: now(), to: 'brief', by: a.by, note: 'cross-area growth blueprint created' }] };
  db.blueprints.unshift(blueprint); if (db.blueprints.length > CAP) db.blueprints.length = CAP; audit(db, 'growth_blueprint_created', { blueprint: blueprint.id, by: a.by }); save(db); return view(db, blueprint);
}
function buildGraph(blueprintId) {
  const db = load(); const blueprint = db.blueprints.find((x) => x.id === String(blueprintId)); if (!blueprint) throw err('Growth-Blueprint unbekannt', 404);
  if (blueprint.stage !== 'brief') throw err('Campaign Graph kann nur einmal direkt nach dem Brief gebaut werden');
  const cat = catalog(); const l = blueprint.links; const nodes = [];
  const push = (type, item, state, handoff) => { if (item) nodes.push({ type, id: item.id, title: item.title || item.name, state, handoff }); };
  push('content_package', l.content_package_id ? byId(cat.content_packages, l.content_package_id) : null, l.content_package_id ? byId(cat.content_packages, l.content_package_id).stage : null, 'Originality / facts / format source');
  push('creator_campaign', l.creator_campaign_id ? byId(cat.creator_campaigns, l.creator_campaign_id) : null, l.creator_campaign_id ? byId(cat.creator_campaigns, l.creator_campaign_id).stage : null, 'Owned channel campaign source');
  push('label_release', l.label_release_id ? byId(cat.label_releases, l.label_release_id) : null, l.label_release_id ? byId(cat.label_releases, l.label_release_id).stage : null, 'Music distribution + promo source');
  push('media_project', l.media_project_id ? byId(cat.media_projects, l.media_project_id) : null, l.media_project_id ? byId(cat.media_projects, l.media_project_id).stage : null, 'Video/audio production source');
  push('social_launch', l.social_launch_id ? byId(cat.social_launches, l.social_launch_id) : null, l.social_launch_id ? byId(cat.social_launches, l.social_launch_id).stage : null, 'Short-form, routes, ads, queue');
  push('web_property', l.web_property_id ? byId(cat.web_properties, l.web_property_id) : null, l.web_property_id ? byId(cat.web_properties, l.web_property_id).connection_state : null, 'Landing page, UTM and conversion target');
  blueprint.graph = { built_at: now(), nodes, workflow: ['Content / release source', 'Media / master', 'Social cutdown + route plan', 'Owned page + UTM', 'Paid flight cap', 'Review + calendar', 'Official metrics import → next iteration'], state: 'LOCAL_HANDOFF_MAP_READY' };
  blueprint.stage = 'handoffs_ready'; blueprint.updated_at = now(); blueprint.versions.push({ at: now(), to: 'handoffs_ready', by: 'growth_nexus', note: nodes.length + ' cross-area handoffs mapped' }); audit(db, 'growth_graph_built', { blueprint: blueprint.id, nodes: nodes.length }); save(db); return view(db, blueprint);
}
function localPreflight(blueprint) {
  const cat = catalog(); const { label } = sources(); const l = blueprint.links; const get = (list, key) => l[key] ? byId(list, l[key]) : null;
  const content = get(cat.content_packages, 'content_package_id'); const creator = get(cat.creator_campaigns, 'creator_campaign_id'); const release = get(cat.label_releases, 'label_release_id'); const media = get(cat.media_projects, 'media_project_id'); const social = get(cat.social_launches, 'social_launch_id'); const web = get(cat.web_properties, 'web_property_id');
  let releasePf = null; try { if (release) releasePf = label.releasePreflight(release.id); } catch {}
  const checks = [
    { id: 'graph', name: 'Cross-area Campaign Graph gebaut', pass: !!blueprint.graph && (blueprint.graph.nodes || []).length > 0, blocking: true },
    { id: 'content', name: 'Content-Paket freigegeben/geplant oder nicht verknüpft', pass: !content || ['approved', 'release_queued'].includes(content.stage), blocking: true },
    { id: 'creator', name: 'Creator-Kampagne freigegeben/geplant oder nicht verknüpft', pass: !creator || ['approved', 'release_planned'].includes(creator.stage), blocking: true },
    { id: 'media', name: 'Media-Projekt freigegeben oder nicht verknüpft', pass: !media || media.stage === 'approved', blocking: true },
    { id: 'label', name: 'Label-Release lokal vollständig/geplant oder nicht verknüpft', pass: !release || (release.stage === 'distribution_planned' && (!releasePf || releasePf.score_pct >= 80)), blocking: true },
    { id: 'social', name: 'Social-Routen vorbereitet oder nicht verknüpft', pass: !social || ['routes_ready', 'review', 'approved', 'queue_ready'].includes(social.stage), blocking: true },
    { id: 'page', name: 'Owned Page referenziert oder nicht verknüpft', pass: !web || !!web.base_url, blocking: true },
    { id: 'calendar', name: 'Mindestens ein Growth-Milestone geplant', pass: (blueprint.milestones || []).length > 0, blocking: false },
    { id: 'connections', name: 'Offizielle Social-/CMS-/Ads-Verbindungen aktiv', pass: false, blocking: false, note: 'Nexus behauptet keine Connected-States; echte Connector-Receipts kommen aus den jeweiligen Areas.' },
    { id: 'approval', name: 'Nexus-Admin-Freigabe dokumentiert', pass: !!blueprint.approval, blocking: false },
  ];
  const passed = checks.filter((x) => x.pass).length;
  return { blueprint_id: blueprint.id, stage: blueprint.stage, checks, score_pct: Math.round((passed / checks.length) * 100), local_ready: checks.filter((x) => x.blocking).every((x) => x.pass), external_state: 'NO_EXTERNAL_ACTION_BY_NEXUS', note: 'Dieser Score bewertet lokale Handoffs und Freigaben. Er ist kein Reichweiten-, Umsatz-, Werbe- oder Live-Status.' };
}
function advanceBlueprint(blueprintId, input = {}) {
  const db = load(); const blueprint = db.blueprints.find((x) => x.id === String(blueprintId)); if (!blueprint) throw err('Growth-Blueprint unbekannt', 404);
  const target = text(input.stage, 60); const pos = STAGES.indexOf(blueprint.stage); const next = STAGES.indexOf(target); if (next !== pos + 1) throw err('Stufen laufen nacheinander: aktuell ' + blueprint.stage + ', nächster Schritt ' + STAGES[pos + 1]);
  if (target === 'review') { const note = text(input.review_notes, 1600); if (note.length < 20) throw err('Review von Creative, Handoffs, Page, Budget und Zuständigkeiten dokumentieren (mindestens 20 Zeichen)'); blueprint.review_notes = note; }
  if (target === 'approved') { const a = requireAdmin(input, 'Growth-Nexus-Freigabe'); const pf = localPreflight(blueprint); if (!pf.local_ready) throw err('Lokaler Campaign Graph noch nicht vollständig: ' + pf.checks.filter((x) => x.blocking && !x.pass).map((x) => x.name).join(', ')); blueprint.approval = { at: now(), by: a.by, authorization: a.authorization }; }
  blueprint.stage = target; blueprint.updated_at = now(); blueprint.versions.push({ at: now(), to: target, by: text(input.approved_by || input.admin, 80) || 'workflow', note: text(input.note, 600) }); audit(db, 'growth_blueprint_stage', { blueprint: blueprint.id, stage: target }); save(db); return view(db, blueprint);
}
function addMilestone(blueprintId, input = {}) {
  const db = load(); const blueprint = db.blueprints.find((x) => x.id === String(blueprintId)); if (!blueprint) throw err('Growth-Blueprint unbekannt', 404);
  if (!['review', 'approved'].includes(blueprint.stage)) throw err('Milestones erst nach aufgebautem Graph und Review anlegen');
  const a = requireAdmin(input, 'Growth-Milestone'); const task = text(input.task, 280); if (task.length < 3) throw err('Milestone-Task fehlt');
  const added = schedule.add({ day: text(input.day, 12) || 'mon', role: 'growth_operator', service: 'Growth Nexus', start: text(input.start, 10) || '10:00', duration_min: Number(input.duration_min) || 30, task: blueprint.title + ' · ' + task });
  const milestone = { id: id('mile'), schedule_entry_id: added.entry.id, task, kind: text(input.kind, 80) || 'review', created_at: now(), created_by: a.by };
  blueprint.milestones.push(milestone); blueprint.updated_at = now(); audit(db, 'growth_milestone_added', { blueprint: blueprint.id, milestone: milestone.id, schedule: added.entry.id, by: a.by }); save(db); return { blueprint: view(db, blueprint), schedule: added, milestone };
}
function addMetrics(blueprintId, input = {}) {
  const db = load(); const blueprint = db.blueprints.find((x) => x.id === String(blueprintId)); if (!blueprint) throw err('Growth-Blueprint unbekannt', 404);
  const a = requireAdmin(input, 'Import offizieller Kennzahlen'); const source = text(input.source, 80); if (!METRIC_SOURCES.includes(source)) throw err('Nur offizielle oder manuell verifizierte Reporting-Quellen sind zulässig');
  const ref = text(input.source_reference, 500); if (ref.length < 8) throw err('Quelle/Export-Referenz dokumentieren');
  const numbers = ['impressions', 'views', 'clicks', 'conversions', 'spend_eur'].reduce((out, key) => { const n = Number(input[key] || 0); if (!Number.isFinite(n) || n < 0) throw err('Ungültiger Wert für ' + key); out[key] = key === 'spend_eur' ? Math.round(n * 100) / 100 : Math.round(n); return out; }, {});
  const metric = { id: id('metric'), source, source_reference: ref, period: text(input.period, 120), numbers, imported_at: now(), imported_by: a.by, approval: a, state: 'OFFICIAL_OR_VERIFIED_IMPORT' };
  blueprint.metrics.unshift(metric); if (blueprint.metrics.length > 100) blueprint.metrics.length = 100; blueprint.updated_at = now(); audit(db, 'growth_metrics_imported', { blueprint: blueprint.id, metric: metric.id, source, by: a.by }); save(db);
  const ctr = numbers.impressions ? Math.round((numbers.clicks / numbers.impressions) * 10000) / 100 : null; const cvr = numbers.clicks ? Math.round((numbers.conversions / numbers.clicks) * 10000) / 100 : null;
  return { blueprint: view(db, blueprint), metric, derived: { ctr_pct: ctr, conversion_rate_pct: cvr, cpc_eur: numbers.clicks ? Math.round((numbers.spend_eur / numbers.clicks) * 100) / 100 : null }, note: 'Nur aus deinem offiziellen/verifizierten Import abgeleitete Kennzahlen. Keine simulierte Reichweite oder Performance.' };
}
function addAutomation(input = {}) {
  const db = load(); const a = requireAdmin(input, 'Growth-Automation-Recipe'); const trigger = text(input.trigger, 100); const action = text(input.action, 100); const blueprintId = text(input.blueprint_id, 100);
  if (!AUTOMATION_TRIGGERS.includes(trigger) || !AUTOMATION_ACTIONS.includes(action)) throw err('Unbekannter Trigger oder lokale Automation-Aktion');
  if (blueprintId && !db.blueprints.some((x) => x.id === blueprintId)) throw err('Verknüpfter Blueprint unbekannt', 404);
  const recipe = { id: id('recipe'), name: text(input.name, 160) || (trigger + ' → ' + action), trigger, action, blueprint_id: blueprintId || null, state: 'ARMED_LOCAL_ONLY', enabled: input.enabled !== false, note: text(input.note, 800), created_at: now(), created_by: a.by, approval: a, policy: 'Erstellt nur lokale Hinweise/Briefe/Checklisten. Kein Post, kein Geldfluss, kein CMS-Deploy und kein externer API-Call.' };
  db.automations.unshift(recipe); if (db.automations.length > CAP) db.automations.length = CAP; audit(db, 'growth_automation_created', { recipe: recipe.id, trigger, action, by: a.by }); save(db); return recipe;
}
function listBlueprints() { const db = load(); return db.blueprints.slice(0, CAP).map((x) => view(db, x)); }
function listAutomations() { return load().automations.slice(0, CAP); }
function status() {
  const db = load(); const cat = catalog();
  return { area: '93', mode: 'LIVE', name: 'Growth Nexus & Automation — cross-area campaign graph and local workflow recipes', source_counts: { content_packages: cat.content_packages.length, creator_campaigns: cat.creator_campaigns.length, label_releases: cat.label_releases.length, media_projects: cat.media_projects.length, social_launches: cat.social_launches.length, web_properties: cat.web_properties.length }, blueprints: { total: db.blueprints.length, by_stage: Object.fromEntries(STAGES.map((x) => [x, db.blueprints.filter((b) => b.stage === x).length])), milestones: db.blueprints.reduce((n, x) => n + (x.milestones || []).length, 0), official_metric_imports: db.blueprints.reduce((n, x) => n + (x.metrics || []).length, 0) }, automations: { total: db.automations.length, armed_local_only: db.automations.filter((x) => x.state === 'ARMED_LOCAL_ONLY' && x.enabled).length, triggers: AUTOMATION_TRIGGERS, actions: AUTOMATION_ACTIONS }, workflow: ['Content / Creator / Label / Media sources', 'Social routes + cutdown assets', 'Owned page + UTM handoff', 'Paid flight guard', 'Calendar milestone + human review', 'Official metrics import → next iteration'], policy: ['Cross-area map, local briefs and calendar handoffs only', 'No external post, CMS deploy, ad spend or account change by Nexus', 'Metrics accepted only from official or manually verified reports', 'Automation recipes are ARMED_LOCAL_ONLY until a future official integration is configured and separately approved'] };
}

module.exports = {
  meta: { area: '93', id: 'growth_nexus', name: 'Growth Nexus & Automation (cross-area campaign graphs + local recipes)', state: 'live' },
  actions: { status: () => status(), blueprint_create: (p) => createBlueprint(p || {}), graph_build: (p) => buildGraph((p || {}).blueprint_id), blueprint_advance: (p) => advanceBlueprint((p || {}).blueprint_id, p || {}), preflight: (p) => { const db = load(); const b = db.blueprints.find((x) => x.id === String((p || {}).blueprint_id)); if (!b) throw err('Growth-Blueprint unbekannt', 404); return localPreflight(b); }, milestone_add: (p) => addMilestone((p || {}).blueprint_id, p || {}), metrics_import: (p) => addMetrics((p || {}).blueprint_id, p || {}), automation_add: (p) => addAutomation(p || {}) },
  status, catalog, createBlueprint, buildGraph, localPreflight, advanceBlueprint, addMilestone, addMetrics, addAutomation, listBlueprints, listAutomations, STAGES, AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS, METRIC_SOURCES,
};
