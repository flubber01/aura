'use strict';
// Route module: Phase-2 Growth & Studio APIs, Agent Board, geprüfter Upload,
// Erweiterungsmodule (Manifest/Lebenszyklus), Eskalation, Skill-Katalog und
// LLM-Kette. Portiert aus dem Referenzstand PR #3 (arena/3b63f072-aura) und in
// die Dispatcher-Architektur eingebunden: handle(ctx) -> true, wenn geantwortet.
//
// Sicherheitsregeln unverändert: schreibende Routen sind kill-gated (423) und
// verlangen — wo im Referenzstand vorgesehen — das Admin-Token im Header
// x-aura-token (AURA_ADMIN_TOKEN). Es wird nie etwas veröffentlicht.
const ops = require('../lib/ops');
const moduleLoader = require('../lib/module_loader');
const repurposeEngine = require('../lib/repurpose_engine');
const crosslinkMesh = require('../lib/crosslink_mesh');
const labelPipeline = require('../lib/label_pipeline');
const analyticsHub = require('../lib/analytics_hub');
const agentBoard = require('../lib/agent_board');
const dataUpload = require('../lib/data_upload');
const skillCatalog = require('../lib/skill_catalog');
const escalation = require('../lib/escalation');
const musicStudio = require('../lib/music_studio');
const studioRelease = require('../lib/studio_release');
const creatorWatch = require('../lib/creator_watch');
const youtubePipeline = require('../lib/youtube_pipeline');
const channelPipelines = require('../lib/channel_pipelines');
const ultraScout = require('../lib/ultra_scout');
const ypHelp = require('../lib/yp_help');
const apiFailover = require('../lib/api_failover');
const ollamaLlm = require('../lib/ollama_llm');

const pageGrowth = require('../../pages/growth');
const pageUpload = require('../../pages/upload');
const pageBoard = require('../../pages/board');

const j = (res, code, obj, send) => (send(res, code, 'application/json', JSON.stringify(obj, null, 2)), true);

async function handle(ctx) {
  const { req, res, url, p, send, readBody } = ctx;
  const sp = url && url.searchParams ? url.searchParams : new URL(req.url, 'http://x').searchParams;
  // Admin-Gate (Runde 11): Cookie ODER x-aura-token. Eine gültige /login-Sitzung
  // hat Admin-Rechte für alle Routen, die heute den Header verlangen — der Token
  // bleibt intern für validate/CLI (AURA_VALIDATE_TOKEN) und als Notfallweg.
  const adminOk = () => {
    const t = process.env.AURA_ADMIN_TOKEN || '';
    if (ctx && ctx.actor) return true;                                        // gültige Sitzung (Cookie)
    return !!t && req.headers['x-aura-token'] === t;
  };
  const adminSoft = () => {
    const t = process.env.AURA_ADMIN_TOKEN || '';
    if (!t) return true;                                                       // kein Token konfiguriert: lokaler Betrieb
    if (req.headers['x-aura-token'] === t) return true;                        // Header-Token stimmt
    return !!(ctx && ctx.actor);                                               // oder angemeldeter Besitzer (/login-Session)
  };

  // ---- Seiten: Growth, Upload, Agent Board ----
  if (p === '/growth') return send(res, 200, 'text/html; charset=utf-8', pageGrowth(analyticsHub.PLATFORMS)), true;
  if (p === '/upload') return send(res, 200, 'text/html; charset=utf-8', pageUpload()), true;
  if (p === '/board') return send(res, 200, 'text/html; charset=utf-8', pageBoard()), true;

  // ---- Studio: Groove, Orchestrierung, Release-Plan (nur lesend) ----
  if (p === '/api/studio/groove' && req.method === 'GET') {
    try { return j(res, 200, musicStudio.groove({ style: sp.get('style') || 'boom-bap', bars: sp.get('bars'), swing: sp.get('swing'), humanize: sp.get('humanize'), seed: sp.get('seed') }), send); }
    catch (e) { return j(res, 422, { ok: false, error: e.message }, send); }
  }
  if (p === '/api/studio/orchestrate' && req.method === 'GET') {
    try { return j(res, 200, musicStudio.orchestrate({ form: sp.get('form') || undefined, bars: sp.get('bars') }), send); }
    catch (e) { return j(res, 422, { ok: false, error: e.message }, send); }
  }
  if (p === '/api/studio/release' && req.method === 'GET') {
    const channelIds = (sp.get('channels') || '').split(',').map((s) => s.trim()).filter(Boolean);
    return j(res, 200, studioRelease.releasePlan({ channelIds }), send);
  }
  if (p === '/api/music/skills' && req.method === 'GET') {
    return j(res, 200, { q: sp.get('q') || '', results: musicStudio.skills(sp.get('q') || '', sp.get('limit') || 20) }, send);
  }

  // ---- Creator Watch (nur Vorschläge/Metadaten) ----
  if (p === '/api/creators' && req.method === 'GET') {
    return j(res, 200, {
      platform: sp.get('platform') || '', topic: sp.get('topic') || '',
      creators: creatorWatch.list({ platform: sp.get('platform') || '', topic: sp.get('topic') || '', enabled: sp.get('enabled') || '', bell: sp.get('bell') || '' }),
      check: creatorWatch.check(),
    }, send);
  }

  // ---- YouTube-Pipeline (Trockenlauf: sendet nie etwas an YouTube) ----
  if (p === '/api/youtube/plan' && req.method === 'GET') {
    return j(res, 200, youtubePipeline.plan({ topic: sp.get('topic') || '', creator_ids: (sp.get('creators') || '').split(',').filter(Boolean) }), send);
  }
  if (p === '/api/youtube/check' && req.method === 'POST') {
    if (!adminOk()) return j(res, 401, { ok: false, error: 'Admin-Token nötig (Header x-aura-token, AURA_ADMIN_TOKEN muss gesetzt sein)' }, send);
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    const out = body.mode === 'upload' ? youtubePipeline.uploadBody(body.meta || {}, { approvedBy: body.approved_by || '' }) : youtubePipeline.checkMeta(body.meta || {});
    return j(res, 200, out, send);
  }

  // ---- Multi-Kanal-Pipeline (Trockenlauf, Publikation nur mit Mensch + Token) ----
  if (p === '/api/channels' && req.method === 'GET') {
    return j(res, 200, {
      channels: channelPipelines.channels().map((c) => ({ id: c.id, label: c.label, kind: c.kind, publish: c.publish, api: c.api, source: c.source })),
      note: channelPipelines.meta.name,
    }, send);
  }
  if (p === '/api/channels/plan' && req.method === 'GET') {
    return j(res, 200, channelPipelines.plan({ channel_ids: (sp.get('channels') || '').split(',').filter(Boolean), topic: sp.get('topic') || '' }), send);
  }
  if ((p === '/api/channels/check' || p === '/api/channels/publish-check') && req.method === 'POST') {
    if (!adminOk()) return j(res, 401, { ok: false, error: 'Admin-Token nötig (AURA_ADMIN_TOKEN muss gesetzt sein)' }, send);
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    const out = p === '/api/channels/check'
      ? channelPipelines.checkDraft(body.channel, body.meta || {})
      : channelPipelines.publishAllowed(body.channel, { approvedBy: body.approved_by || '' });
    return j(res, 200, out, send);
  }

  // ---- Ultra-Scout (Vorschläge; Lauf und Entscheidung nur mit Admin-Token) ----
  if (p === '/api/ultra/proposals' && req.method === 'GET') return j(res, 200, ultraScout.list(), send);
  if (p === '/api/ultra/scout/run' && req.method === 'POST') {
    if (!adminOk()) return j(res, 401, { ok: false, error: 'Admin-Token nötig' }, send);
    try { return j(res, 200, await ultraScout.runScout(), send); }
    catch (e) { return j(res, 500, { ok: false, error: e.message }, send); }
  }
  const dm = p.match(/^\/api\/ultra\/proposals\/(UP-[0-9a-f]{6})\/decide$/);
  if (dm && req.method === 'POST') {
    if (!adminOk()) return j(res, 401, { ok: false, error: 'Admin-Token nötig' }, send);
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    const r = ultraScout.decide(dm[1], { decision: body.decision, by: body.by });
    return j(res, r.status, r, send);
  }

  // ---- Growth: Repurposing · Traffic Mesh · WF-19 Label · Unified Analytics ----
  if (p === '/api/growth/repurpose' && req.method === 'GET') return j(res, 200, repurposeEngine.list(), send);
  if (p === '/api/growth/repurpose' && req.method === 'POST') {
    if (ops.isKilled()) return j(res, 423, { error: 'KILL SWITCH ENGAGED' }, send);
    let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return j(res, 400, { ok: false, errors: ['invalid JSON'] }, send); }
    const r = repurposeEngine.repurpose(body);
    return j(res, r.ok ? 201 : 400, r, send);
  }
  if (p === '/api/growth/mesh' && req.method === 'GET') return j(res, 200, crosslinkMesh.matrix(), send);
  if (p === '/api/growth/mesh/asset' && req.method === 'POST') {
    if (ops.isKilled()) return j(res, 423, { error: 'KILL SWITCH ENGAGED' }, send);
    let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return j(res, 400, { ok: false, errors: ['invalid JSON'] }, send); }
    const r = crosslinkMesh.addAsset(body);
    return j(res, r.ok ? 201 : 400, r, send);
  }
  if (p === '/api/growth/releases' && req.method === 'GET') return j(res, 200, labelPipeline.list(), send);
  if (p === '/api/growth/releases' && req.method === 'POST') {
    if (ops.isKilled()) return j(res, 423, { error: 'KILL SWITCH ENGAGED' }, send);
    let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return j(res, 400, { ok: false, errors: ['invalid JSON'] }, send); }
    const r = labelPipeline.create(body);
    return j(res, r.ok ? 201 : 400, r, send);
  }
  if (p.startsWith('/api/growth/releases/') && p.endsWith('/advance') && req.method === 'POST') {
    if (ops.isKilled()) return j(res, 423, { error: 'KILL SWITCH ENGAGED' }, send);
    let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return j(res, 400, { ok: false, errors: ['invalid JSON'] }, send); }
    const id = decodeURIComponent(p.split('/')[4] || '');
    const r = labelPipeline.advance(id, body.target, body);
    return j(res, r.ok ? 200 : (r.code || 400), r, send);
  }
  if (p === '/api/growth/analytics' && req.method === 'GET') return j(res, 200, analyticsHub.dashboard(), send);
  if (p === '/api/growth/analytics/import' && req.method === 'POST') {
    if (ops.isKilled()) return j(res, 423, { error: 'KILL SWITCH ENGAGED' }, send);
    let body; try { body = JSON.parse(await readBody(req, 2e6)); } catch { return j(res, 400, { ok: false, errors: ['invalid JSON'] }, send); }
    const r = analyticsHub.importRows(body.platform, body.rows);
    return j(res, r.ok ? 201 : 400, r, send);
  }

  // ---- Geprüfter Upload für Link-Listen (Vorschau schreibt nichts) ----
  if (p === '/api/upload/kinds' && req.method === 'GET') return j(res, 200, dataUpload.KINDS(), send);
  if (p === '/api/upload/preview' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1.5e6) || '{}'); } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    const r = dataUpload.preview(body.kind, body.text);
    return j(res, r.status, r, send);
  }
  if (p === '/api/upload/commit' && req.method === 'POST') {
    if (ops.isKilled()) return j(res, 423, { error: 'KILL SWITCH ENGAGED — upload locked' }, send);
    if (!adminSoft()) return j(res, 401, { ok: false, error: 'Admin-Token fehlt oder falsch' }, send);
    let body; try { body = JSON.parse(await readBody(req, 1.5e6) || '{}'); } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    const r = dataUpload.commit(body.kind, body.text, body.by);
    return j(res, r.status, r, send);
  }

  // ---- Agent Board (Kanban für Agenten; Freigabe nur durch Menschen) ----
  if (p === '/api/board' && req.method === 'GET') return j(res, 200, agentBoard.board(), send);
  if (p.startsWith('/api/board/') && req.method === 'POST') {
    if (ops.isKilled()) return j(res, 423, { error: 'KILL SWITCH ENGAGED — board locked' }, send);
    if (!adminSoft()) return j(res, 401, { ok: false, error: 'Admin-Token fehlt oder falsch (Header x-aura-token)' }, send);
    let body = {};
    try { const raw = await readBody(req, 2e4); body = raw ? JSON.parse(raw) : {}; } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    if (p === '/api/board/task') {
      const r = agentBoard.createTask(body);
      return j(res, r.status, r.ok ? { ok: true, task: r.task } : { ok: false, error: r.error }, send);
    }
    const m = p.match(/^\/api\/board\/(T-[0-9a-f]{6})\/(assign|start|request_help|handoff|submit|approve|reject)$/);
    if (m) {
      const r = agentBoard.act(m[1], m[2], body.by, body);
      return j(res, r.status, r.ok ? { ok: true, task: r.task } : { ok: false, error: r.error }, send);
    }
    return j(res, 404, { error: 'unknown board route' }, send);
  }

  // ---- Eskalation (Notfall-Kanäle; Ack durch Menschen) ----
  if (p === '/api/escalations' && req.method === 'GET') return j(res, 200, escalation.status(), send);
  if (p === '/api/escalations/raise' && req.method === 'POST') {
    if (!adminSoft()) return j(res, 401, { ok: false, error: 'Admin-Token fehlt oder falsch' }, send);
    let body; try { body = JSON.parse(await readBody(req, 20000) || '{}'); } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    try { return j(res, 200, { ok: true, escalation: escalation.raise({ kind: body.kind, reason: body.reason }) }, send); }
    catch (e) { return j(res, 422, { ok: false, error: e.message }, send); }
  }
  const escAck = p.match(/^\/api\/escalations\/(ESC-[0-9a-f]{6})\/ack$/);
  if (escAck && req.method === 'POST') {
    if (!adminSoft()) return j(res, 401, { ok: false, error: 'Admin-Token fehlt oder falsch' }, send);
    let body; try { body = JSON.parse(await readBody(req, 4000) || '{}'); } catch { body = {}; }
    const r = escalation.ack(escAck[1], body.by || 'nutzer');
    return j(res, r.ok ? 200 : r.code, r, send);
  }

  // ---- Yellow-Pages-Hilfe + Skill-Katalog (nur Lesen) ----
  if (p === '/api/yellowpages/help' && req.method === 'GET') {
    return j(res, 200, { q: sp.get('q') || '', results: ypHelp.find(sp.get('q') || '', sp.get('limit') || 5) }, send);
  }
  if (p === '/api/skill-catalog' && req.method === 'GET') {
    return j(res, 200, skillCatalog.search({ q: sp.get('q') || '', source: sp.get('source') || '', status: sp.get('status') || '', category: sp.get('category') || '', limit: sp.get('limit') || 100 }), send);
  }

  // ---- LLM-Kette: Failover-Status und Ollama-Brücke ----
  if (p === '/api/llm/chain') return j(res, 200, apiFailover.status(), send);
  if (p === '/api/jarvis/llm') return j(res, 200, await ollamaLlm.status(), send);

  // ---- Erweiterungsmodule (Manifest, Freigabe, Lebenszyklus). Schreibend nur mit Admin-Token. ----
  if (p === '/api/modules/ext' && req.method === 'GET') return j(res, 200, moduleLoader.list(), send);
  if (p.startsWith('/api/modules/ext')) {
    const L = moduleLoader;
    const extSend = (r) => (send(res, r.status || (r.ok ? 200 : 400), 'application/json', JSON.stringify(r, null, 2)), true);
    const deny = () => j(res, 401, { ok: false, error: 'Admin-Token nötig (AURA_ADMIN_TOKEN gesetzt und Header x-aura-token)' }, send);
    if (p === '/api/modules/ext/discover' && req.method === 'POST') {
      if (!adminOk()) return deny();
      return extSend(await L.reload());
    }
    const em = p.match(/^\/api\/modules\/ext\/([a-z][a-z0-9-]{1,40})(\/[a-z_]+(?:\/[a-z][a-z0-9_]{1,40})?)?$/);
    if (!em) return j(res, 404, { ok: false, error: 'unbekannter Modul-Endpunkt' }, send);
    const id = em[1];
    const sub = (em[2] || '').slice(1);
    if (!sub) {
      if (req.method !== 'GET') return j(res, 405, { ok: false, error: 'nur GET' }, send);
      const v = L.get(id);
      return v ? j(res, 200, v, send) : j(res, 404, { ok: false, error: 'Modul nicht gefunden' }, send);
    }
    if (req.method !== 'POST') return j(res, 405, { ok: false, error: 'nur POST' }, send);
    if (!adminOk()) return deny();
    let body = {};
    try { body = JSON.parse((await readBody(req, 1e5)) || '{}'); } catch { return j(res, 400, { ok: false, error: 'invalid JSON' }, send); }
    if (sub === 'approve') return extSend(L.approve(id, body));
    if (sub === 'enable') return extSend(await L.enable(id, body));
    if (sub === 'disable') return extSend(await L.disable(id, body));
    if (sub === 'config') {
      const r = L.setConfig(id, body);
      if (r.ok && L.get(id) && L.get(id).enabled) await L.start(id);
      const fresh = L.get(id);
      return extSend({ ...r, status_detail: fresh ? fresh.status : r.status_detail });
    }
    if (sub === 'health') return extSend(await L.health(id));
    const am = sub.match(/^action\/([a-z][a-z0-9_]{1,40})$/);
    if (am) {
      if (ops.isKilled()) return j(res, 423, { ok: false, error: 'KILL SWITCH ENGAGED — Modul-Aktionen gesperrt' }, send);
      return extSend(await L.execute(id, am[1], body.input));
    }
    return j(res, 404, { ok: false, error: 'unbekannter Endpunkt' }, send);
  }

  return false;
}

module.exports = { name: 'api_growth_studio', handle };
