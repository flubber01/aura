'use strict';
// Route module: area-specific APIs (moved verbatim from server.js).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { teams } = require('../lib/datasets');
const store = require('../lib/store');
const registry = require('../lib/registry');
const hierarchy = require('../lib/hierarchy');
const ops = require('../lib/ops');
const mail = require('../lib/mail_adapter');
const watcher = require('../lib/txt_watcher');
const ultraChat = require('../lib/ultra_chat');
const wfBuilder = require('../lib/workflow_builder');
const deepResearch = require('../lib/research');
const seo = require('../lib/seo');
const traffic = require('../lib/traffic');
const selfRepair = require('../lib/self_repair');
const config = require('../lib/config');
const containers = require('../lib/module_container');
const jarvis = require('../lib/jarvis');
const learningCore = require('../lib/learning_core');
const moduleSystem = require('../lib/module_system');
const imageGen = require('../lib/image_gen');
const mcpManager = require('../lib/mcp_manager');
const contentForge = require('../lib/content_forge');
const contentCommand = require('../lib/content_command');
const auraHeart = require('../lib/aura_heart');
const creatorDesk = require('../lib/creator_desk');
const labelDesk = require('../lib/label_desk');
const mediaNewsroom = require('../lib/media_newsroom');
const socialControl = require('../lib/social_control');
const growthNexus = require('../lib/growth_nexus');
const capabilityRadar = require('../lib/capability_radar');
const auraOs = require('../lib/aura_os');
const auraOsPlus = require('../lib/aura_os_plus');
const creatorContinuity = require('../lib/creator_continuity');
const remoteApproval = require('../lib/remote_approval');
const creatorCollaboration = require('../lib/creator_collaboration');
const creatorRevenue = require('../lib/creator_revenue');
const creatorPassport = require('../lib/creator_passport');
const studioCommand = require('../lib/studio_command');
const serviceFabric = require('../lib/service_fabric');
const kidsStory = require('../lib/kids_story');
const reportDaemon = require('../lib/report_daemon');
const routineControl = require('../lib/routine_control');
const studio = require('../lib/studio');
const testLab = require('../lib/test_lab');
const telegramAgent = require('../lib/telegram_agent');
const ollamaManager = require('../lib/ollama_manager');
const adminCopilot = require('../lib/admin_copilot');
const clusterControl = require('../lib/cluster_control');
const hermesBridge = require('../lib/hermes_bridge');
const releaseGate = require('../lib/release_gate');
const yellowPages = require('../lib/yellow_pages');
const mediaPipeline = require('../lib/media_pipeline');
const contentIncubator = require('../lib/content_incubator');
const editorialIncubator = require('../lib/editorial_incubator');
const communityIncubator = require('../lib/community_incubator');
const dispatcher = require('../lib/omnichannel_dispatcher');
const wordpressBridge = require('../lib/wordpress_bridge');
const n8nBridge = require('../lib/n8n_bridge');
const knowledgeSync = require('../lib/knowledge_sync');
const hardwareRouter = require('../lib/hardware_router');
const computeRouter = require('../lib/compute_router');
const cloudConnector = require('../lib/cloud_connector');
const meshEngine = require('../lib/mesh_engine');
const telemetryStream = require('../lib/telemetry_stream');
const varianceLifecycle = require('../lib/variance_lifecycle');
const financeEngine = require('../lib/finance_engine');
const gatewayHealth = require('../lib/gateway_health');
const deliveryMonitor = require('../lib/delivery_monitor');
const visionBridge = require('../lib/vision_bridge');
const vault = require('../lib/vault');
const agentIntercom = require('../lib/agent_intercom');
const harnessKit = require('../lib/harness_kit');
const sentinelWatch = require('../lib/sentinel');
const brainMapper = require('../lib/brain_mapper');
const controlTower = require('../lib/control_tower');
const crosslinkPolicy = require('../lib/crosslink_policy');
const functionRegistry = require('../lib/function_registry');
const { dailyReport } = require('../lib/report');

const ROOT = path.join(__dirname, '..', '..', '..');
const DATA = path.join(__dirname, '..', '..', 'data');

async function handle(ctx) {
  const { req, res, url, p, send, readBody, syntaxFail } = ctx;

  // ---------- Area 71: Image Generation Gateway (ComfyUI + WebUI) ----------
  if (p === '/api/imagegen/status') return send(res, 200, 'application/json', JSON.stringify(await imageGen.status(), null, 2)), true;
  if (p === '/api/imagegen/config' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify((await imageGen.status()).config, null, 2)), true;
  if (p === '/api/imagegen/config' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — config locked' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify({ ok: true, config: imageGen.saveCfg(body) }, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/imagegen/generate' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — generation locked' })), true;
    let body; try { body = JSON.parse(await readBody(req, 8e6) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try {
      const r = await imageGen.generate(body);
      return send(res, r.ok === false ? 502 : 200, 'application/json', JSON.stringify(r, null, 2)), true;
    } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/imagegen/history') return send(res, 200, 'application/json', JSON.stringify({ entries: imageGen.history() }, null, 2)), true;
  const art = p.match(/^\/api\/imagegen\/artifact\/(.+)$/);
  if (art) {
    const f = imageGen.artifactPath(art[1]);
    if (!f || !fs.existsSync(f)) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown artifact' })), true;
    return send(res, 200, 'image/png', fs.readFileSync(f), { 'Cache-Control': 'public, max-age=86400' }), true;
  }

  // ---------- Area 72: MCP Server Manager ----------
  const mcpJsonRpc = async () => { // AURA als MCP-Server über HTTP (JSON-RPC 2.0)
    let body; try { body = JSON.parse(await readBody(req, 2e6) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })), true; }
    const reply = { jsonrpc: '2.0', id: body.id ?? null };
    mcpManager.builtinUsed(String(body.method));
    try {
      if (body.method === 'initialize') reply.result = { protocolVersion: '2025-06-19', capabilities: { tools: {} }, serverInfo: { name: 'aura-mcp', version: '1.0.0' } };
      else if (body.method === 'tools/list') {
        const tools = [
          { name: 'aura_status', description: 'AURA registry counts + live modules', inputSchema: { type: 'object', properties: {} } },
          { name: 'aura_report', description: 'Daily report from live data', inputSchema: { type: 'object', properties: {} } },
          { name: 'aura_modulehub', description: 'Area 70 module hub', inputSchema: { type: 'object', properties: {} } },
          { name: 'aura_image_sim', description: 'SIMULATION-labeled demo image', inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } },
          { name: 'aura_content_draft', description: 'Content Forge auto-draft (human-gated publish)', inputSchema: { type: 'object', properties: { brief: { type: 'string' } }, required: ['brief'] } },
        ];
        reply.result = { tools };
      } else if (body.method === 'tools/call') {
        const name = String((body.params || {}).name), args = (body.params || {}).arguments || {};
        let out;
        if (name === 'aura_status') out = registry.counts();
        else if (name === 'aura_report') out = dailyReport();
        else if (name === 'aura_modulehub') out = moduleSystem.status();
        else if (name === 'aura_image_sim') out = await imageGen.generate({ engine: 'sim', prompt: String(args.prompt || 'aura'), width: 256, height: 256 });
        else if (name === 'aura_content_draft') out = contentForge.create({ brief: String(args.brief || '') });
        else { reply.error = { code: -32602, message: 'unknown tool ' + name }; return send(res, 200, 'application/json', JSON.stringify(reply)), true; }
        reply.result = { content: [{ type: 'text', text: JSON.stringify(out).slice(0, 20000) }], isError: false };
      } else if (body.method === 'ping') reply.result = {};
      else reply.error = { code: -32601, message: 'method not found: ' + body.method };
    } catch (e) { reply.error = { code: -32603, message: String(e && e.message || e) }; }
    return send(res, 200, 'application/json', JSON.stringify(reply)), true;
  };
  if (p === '/api/mcp' && req.method === 'POST') return mcpJsonRpc();
  if (p === '/api/mcp/builtin-used' && req.method === 'POST') { await readBody(req, 1e4); return send(res, 200, 'application/json', JSON.stringify({ ok: true })), true; }
  if (p === '/api/mcp/status') return send(res, 200, 'application/json', JSON.stringify(mcpManager.status(), null, 2)), true;
  if (p === '/api/mcp/servers') return send(res, 200, 'application/json', JSON.stringify({ servers: mcpManager.listServers() }, null, 2)), true;
  if (p === '/api/mcp/servers/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify({ ok: true, server: mcpManager.addServer(body) }, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const mcpOp = p.match(/^\/api\/mcp\/servers\/([\w-]+)\/(install|uninstall|remove|enable|disable|use|test)$/);
  if (mcpOp) {
    const [ , sid, op ] = mcpOp;
    if (['remove', 'install', 'uninstall'].includes(op) && ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body = {};
    if (req.method === 'POST') { try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { body = {}; } }
    try {
      if (op === 'install') return send(res, 200, 'application/json', JSON.stringify(mcpManager.install(sid), null, 2)), true;
      if (op === 'uninstall') return send(res, 200, 'application/json', JSON.stringify(mcpManager.uninstall(sid), null, 2)), true;
      if (op === 'remove') return send(res, 200, 'application/json', JSON.stringify(mcpManager.removeServer(sid), null, 2)), true;
      if (op === 'enable') return send(res, 200, 'application/json', JSON.stringify(mcpManager.setEnabled(sid, true), null, 2)), true;
      if (op === 'disable') return send(res, 200, 'application/json', JSON.stringify(mcpManager.setEnabled(sid, false), null, 2)), true;
      if (op === 'use') return send(res, 200, 'application/json', JSON.stringify(mcpManager.use(sid, body.tool), null, 2)), true;
      if (op === 'test') return send(res, 200, 'application/json', JSON.stringify(await mcpManager.testServer(sid), null, 2)), true;
    } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 73: Content Forge (minion automation) ----------
  if (p === '/api/content/status') return send(res, 200, 'application/json', JSON.stringify(contentForge.status(), null, 2)), true;
  if (p === '/api/content/items') return send(res, 200, 'application/json', JSON.stringify({ items: contentForge.list() }, null, 2)), true;
  if (p === '/api/content/ledger') return send(res, 200, 'application/json', JSON.stringify({ ledger: contentForge.ledger() }, null, 2)), true;
  if (p === '/api/content/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentForge.create(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content/modify' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentForge.modify(String(body.id), String(body.instruction || '')), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content/approve' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentForge.approve(String(body.id), body.decision === 'reject' ? 'reject' : 'approve'), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content/post' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentForge.post(String(body.id), String(body.channel || '')), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content/routines') return send(res, 200, 'application/json', JSON.stringify({ routines: contentForge.routines() }, null, 2)), true;
  if (p === '/api/content/routines/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentForge.addRoutine(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const rtOp = p.match(/^\/api\/content\/routines\/([\w-]+)\/(run|remove|enable|disable)$/);
  if (rtOp) {
    const [ , rid, op ] = rtOp;
    if (op === 'run' && ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try {
      if (op === 'run') return send(res, 200, 'application/json', JSON.stringify(contentForge.runRoutine(rid), null, 2)), true;
      if (op === 'remove') return send(res, 200, 'application/json', JSON.stringify(contentForge.removeRoutine(rid), null, 2)), true;
      if (op === 'enable') return send(res, 200, 'application/json', JSON.stringify(contentForge.toggleRoutine(rid, true), null, 2)), true;
      if (op === 'disable') return send(res, 200, 'application/json', JSON.stringify(contentForge.toggleRoutine(rid, false), null, 2)), true;
    } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 93: Growth Nexus (cross-area campaign graph → calendar → verified metrics) ----------
  if (p === '/api/growth-nexus/status') return send(res, 200, 'application/json', JSON.stringify(growthNexus.status(), null, 2)), true;
  if (p === '/api/growth-nexus/catalog') return send(res, 200, 'application/json', JSON.stringify(growthNexus.catalog(), null, 2)), true;
  if (p === '/api/growth-nexus/blueprints') return send(res, 200, 'application/json', JSON.stringify({ blueprints: growthNexus.listBlueprints() }, null, 2)), true;
  if (p === '/api/growth-nexus/automations') return send(res, 200, 'application/json', JSON.stringify({ automations: growthNexus.listAutomations() }, null, 2)), true;
  if (p === '/api/growth-nexus/blueprints/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 5e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(growthNexus.createBlueprint(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const gnGraph = p.match(/^\/api\/growth-nexus\/blueprints\/([\w-]+)\/graph\/build$/);
  if (gnGraph && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(growthNexus.buildGraph(gnGraph[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const gnPreflight = p.match(/^\/api\/growth-nexus\/blueprints\/([\w-]+)\/preflight$/);
  if (gnPreflight && req.method === 'GET') { try { const all = growthNexus.listBlueprints(); const blueprint = all.find((x) => x.id === gnPreflight[1]); if (!blueprint) throw Object.assign(new Error('Growth-Blueprint unbekannt'), { code: 404 }); return send(res, 200, 'application/json', JSON.stringify(growthNexus.localPreflight(blueprint), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  const gnAdvance = p.match(/^\/api\/growth-nexus\/blueprints\/([\w-]+)\/advance$/);
  if (gnAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(growthNexus.advanceBlueprint(gnAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const gnMilestone = p.match(/^\/api\/growth-nexus\/blueprints\/([\w-]+)\/milestones\/add$/);
  if (gnMilestone && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(growthNexus.addMilestone(gnMilestone[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const gnMetrics = p.match(/^\/api\/growth-nexus\/blueprints\/([\w-]+)\/metrics\/import$/);
  if (gnMetrics && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(growthNexus.addMetrics(gnMetrics[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/growth-nexus/automations/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(growthNexus.addAutomation(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 95: AURA OS (self-hosted creator operating profiles) ----------
  if (p === '/api/aura-os/status') return send(res, 200, 'application/json', JSON.stringify(auraOs.status(), null, 2)), true;
  if (p === '/api/aura-os/catalog') return send(res, 200, 'application/json', JSON.stringify(auraOs.catalog(), null, 2)), true;
  if (p === '/api/aura-os/workspaces') return send(res, 200, 'application/json', JSON.stringify({ workspaces: auraOs.listWorkspaces() }, null, 2)), true;
  if (p === '/api/aura-os/workspaces/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 5e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(auraOs.createWorkspace(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const osMap = p.match(/^\/api\/aura-os\/workspaces\/([\w-]+)\/map\/build$/);
  if (osMap && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(auraOs.buildMap(osMap[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const osPreflight = p.match(/^\/api\/aura-os\/workspaces\/([\w-]+)\/preflight$/);
  if (osPreflight && req.method === 'GET') { try { const w = auraOs.listWorkspaces().find((x) => x.id === osPreflight[1]); if (!w) throw Object.assign(new Error('AURA-OS-Workspace unbekannt'), { code: 404 }); return send(res, 200, 'application/json', JSON.stringify(auraOs.preflight(w), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  const osAdvance = p.match(/^\/api\/aura-os\/workspaces\/([\w-]+)\/advance$/);
  if (osAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(auraOs.advanceWorkspace(osAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const osBrief = p.match(/^\/api\/aura-os\/workspaces\/([\w-]+)\/brief$/);
  if (osBrief && req.method === 'GET') { try { return send(res, 200, 'application/json', JSON.stringify(auraOs.buildBrief(osBrief[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  // ---------- Area 96: AURA OS Access, Companion & Creator Launchpad ----------
  if (p === '/api/aura-os-plus/status') return send(res, 200, 'application/json', JSON.stringify(auraOsPlus.status(), null, 2)), true;
  if (p === '/api/aura-os-plus/data') return send(res, 200, 'application/json', JSON.stringify(auraOsPlus.data(), null, 2)), true;
  if (p === '/api/aura-os-plus/profiles') return send(res, 200, 'application/json', JSON.stringify({ profiles: auraOsPlus.data().profiles }, null, 2)), true;
  const osPlusPost = async (action) => {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 6e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(action(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  };
  if (p === '/api/aura-os-plus/profiles/create' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.createProfile(body));
  if (p === '/api/aura-os-plus/trial/start' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.startTrial(body));
  if (p === '/api/aura-os-plus/plan/intent' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.createPlanIntent(body));
  if (p === '/api/aura-os-plus/members/add' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.addMember(body));
  if (p === '/api/aura-os-plus/newsletter/subscribers/add' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.addSubscriber(body));
  if (p === '/api/aura-os-plus/newsletter/drafts/create' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.createNewsletterDraft(body));
  if (p === '/api/aura-os-plus/companions/create' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.createCompanion(body));
  if (p === '/api/aura-os-plus/companions/guidance' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.guidance(body));
  if (p === '/api/aura-os-plus/voice/consent' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.registerVoiceConsent(body));
  if (p === '/api/aura-os-plus/hardware/add' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.addHardwareProfile(body));
  if (p === '/api/aura-os-plus/presence/create' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.createPresenceKit(body));
  if (p === '/api/aura-os-plus/missions/create' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.createMission(body));
  const osPlusMission = p.match(/^\/api\/aura-os-plus\/missions\/([\w-]+)\/handoff$/);
  if (osPlusMission && req.method === 'POST') return osPlusPost((body) => auraOsPlus.handoffMission(osPlusMission[1], body));
  if (p === '/api/aura-os-plus/studio47/request' && req.method === 'POST') return osPlusPost((body) => auraOsPlus.requestStudio47Cloud(body));

  // ---------- Area 97: Creator Continuity & Product Asset Reactor ----------
  if (p === '/api/creator-continuity/status') return send(res, 200, 'application/json', JSON.stringify(creatorContinuity.status(), null, 2)), true;
  if (p === '/api/creator-continuity/data') return send(res, 200, 'application/json', JSON.stringify(creatorContinuity.data(), null, 2)), true;
  const continuityPost = async (action) => {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 8e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(action(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  };
  if (p === '/api/creator-continuity/settings/create' && req.method === 'POST') return continuityPost((body) => creatorContinuity.createSettings(body));
  if (p === '/api/creator-continuity/plans/create' && req.method === 'POST') return continuityPost((body) => creatorContinuity.createPlan(body));
  const continuityPlanActivate = p.match(/^\/api\/creator-continuity\/plans\/([\w-]+)\/activate$/);
  if (continuityPlanActivate && req.method === 'POST') return continuityPost((body) => creatorContinuity.activatePlan(continuityPlanActivate[1], body));
  const continuityPlanCycle = p.match(/^\/api\/creator-continuity\/plans\/([\w-]+)\/cycle$/);
  if (continuityPlanCycle && req.method === 'POST') return continuityPost((body) => creatorContinuity.runCycle(continuityPlanCycle[1], body));
  if (p === '/api/creator-continuity/assets/create' && req.method === 'POST') return continuityPost((body) => creatorContinuity.createAssetDrop(body));
  const continuityAssetHandoff = p.match(/^\/api\/creator-continuity\/assets\/([\w-]+)\/handoff$/);
  if (continuityAssetHandoff && req.method === 'POST') return continuityPost((body) => creatorContinuity.handoffAssetDrop(continuityAssetHandoff[1], body));

  // ---------- Area 98: Remote Approval Deck & official connector gates ----------
  if (p === '/api/remote-approval/status') return send(res, 200, 'application/json', JSON.stringify(remoteApproval.status(), null, 2)), true;
  if (p === '/api/remote-approval/data') return send(res, 200, 'application/json', JSON.stringify(remoteApproval.data(), null, 2)), true;
  const remoteApprovalPost = async (action) => {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 8e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(action(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  };
  if (p === '/api/remote-approval/profiles/create' && req.method === 'POST') return remoteApprovalPost((body) => remoteApproval.createProfile(body));
  const remoteArm = p.match(/^\/api\/remote-approval\/profiles\/([\w-]+)\/arm$/);
  if (remoteArm && req.method === 'POST') return remoteApprovalPost((body) => remoteApproval.armProfile(remoteArm[1], body));
  if (p === '/api/remote-approval/decks/create' && req.method === 'POST') return remoteApprovalPost((body) => remoteApproval.createDeck(body));
  if (p === '/api/remote-approval/inbound/decision' && req.method === 'POST') return remoteApprovalPost((body) => remoteApproval.inboundDecision(body));
  if (p === '/api/remote-approval/meta/dossier' && req.method === 'POST') return remoteApprovalPost((body) => remoteApproval.metaDossier(body));

  // ---------- Area 99: Creator Collaboration Room & Content Bot ----------
  if (p === '/api/creator-collaboration/status') return send(res, 200, 'application/json', JSON.stringify(creatorCollaboration.status(), null, 2)), true;
  if (p === '/api/creator-collaboration/data') return send(res, 200, 'application/json', JSON.stringify(creatorCollaboration.data(), null, 2)), true;
  const collaborationPost = async (action) => {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 8e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(action(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  };
  if (p === '/api/creator-collaboration/rooms/create' && req.method === 'POST') return collaborationPost((body) => creatorCollaboration.createRoom(body));
  const collaborationParticipant = p.match(/^\/api\/creator-collaboration\/rooms\/([\w-]+)\/participants\/add$/);
  if (collaborationParticipant && req.method === 'POST') return collaborationPost((body) => creatorCollaboration.addParticipant(collaborationParticipant[1], body));
  if (p === '/api/creator-collaboration/messages/post' && req.method === 'POST') return collaborationPost((body) => creatorCollaboration.postMessage(body));
  const collaborationRound = p.match(/^\/api\/creator-collaboration\/rooms\/([\w-]+)\/bot\/round$/);
  if (collaborationRound && req.method === 'POST') return collaborationPost((body) => creatorCollaboration.botRound(collaborationRound[1], body));

  // ---------- Area 100: Creator Revenue, Referral Credits & Payment Simulation ----------
  if (p === '/api/creator-revenue/status') return send(res, 200, 'application/json', JSON.stringify(creatorRevenue.status(), null, 2)), true;
  if (p === '/api/creator-revenue/data') return send(res, 200, 'application/json', JSON.stringify(creatorRevenue.data(), null, 2)), true;
  const revenuePost = async (action) => {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 6e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(action(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  };
  if (p === '/api/creator-revenue/referral/code/ensure' && req.method === 'POST') return revenuePost((body) => creatorRevenue.ensureCode(body));
  const revenueCodePause = p.match(/^\/api\/creator-revenue\/referral\/code\/([\w-]+)\/pause$/);
  if (revenueCodePause && req.method === 'POST') return revenuePost((body) => creatorRevenue.pauseCode(revenueCodePause[1], body));
  if (p === '/api/creator-revenue/checkouts/create' && req.method === 'POST') return revenuePost((body) => creatorRevenue.createCheckout(body));
  const revenueSimulate = p.match(/^\/api\/creator-revenue\/checkouts\/([\w-]+)\/simulate$/);
  if (revenueSimulate && req.method === 'POST') return revenuePost((body) => creatorRevenue.simulateCallback(revenueSimulate[1], body));
  const revenueValidate = p.match(/^\/api\/creator-revenue\/checkouts\/([\w-]+)\/validate$/);
  if (revenueValidate && req.method === 'POST') return revenuePost((body) => creatorRevenue.validatePurchase(revenueValidate[1], body));
  const revenueRisk = p.match(/^\/api\/creator-revenue\/risk-cases\/([\w-]+)\/resolve$/);
  if (revenueRisk && req.method === 'POST') return revenuePost((body) => creatorRevenue.resolveRiskCase(revenueRisk[1], body));
  const revenueReverse = p.match(/^\/api\/creator-revenue\/checkouts\/([\w-]+)\/reverse$/);
  if (revenueReverse && req.method === 'POST') return revenuePost((body) => creatorRevenue.reverseSimulation(revenueReverse[1], body));
  const revenueRedeem = p.match(/^\/api\/creator-revenue\/credits\/([\w-]+)\/redeem-simulation$/);
  if (revenueRedeem && req.method === 'POST') return revenuePost((body) => creatorRevenue.redeemSimulationCredit(revenueRedeem[1], body));

  // ---------- Area 101: Creator Project / Release Passport & Today View ----------
  if (p === '/api/creator-passport/status') return send(res, 200, 'application/json', JSON.stringify(creatorPassport.status(), null, 2)), true;
  if (p === '/api/creator-passport/data') return send(res, 200, 'application/json', JSON.stringify(creatorPassport.data(), null, 2)), true;
  if (p === '/api/creator-passport/today') return send(res, 200, 'application/json', JSON.stringify(creatorPassport.today({ profile_id: url.searchParams.get('profile_id') || '' }), null, 2)), true;
  const passportPost = async (action) => {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 8e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(action(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  };
  if (p === '/api/creator-passport/passports/create' && req.method === 'POST') return passportPost((body) => creatorPassport.createPassport(body));
  if (p === '/api/creator-passport/assets/add' && req.method === 'POST') return passportPost((body) => creatorPassport.addAsset(body));
  if (p === '/api/creator-passport/edges/add' && req.method === 'POST') return passportPost((body) => creatorPassport.addEdge(body));
  if (p === '/api/creator-passport/contributors/add' && req.method === 'POST') return passportPost((body) => creatorPassport.addContributor(body));
  if (p === '/api/creator-passport/tasks/add' && req.method === 'POST') return passportPost((body) => creatorPassport.addTask(body));
  const passportTaskState = p.match(/^\/api\/creator-passport\/tasks\/([\w-]+)\/state$/);
  if (passportTaskState && req.method === 'POST') return passportPost((body) => creatorPassport.setTaskState(passportTaskState[1], body));
  if (p === '/api/creator-passport/handoffs/link' && req.method === 'POST') return passportPost((body) => creatorPassport.linkHandoff(body));
  const passportReviewRequest = p.match(/^\/api\/creator-passport\/passports\/([\w-]+)\/reviews\/request$/);
  if (passportReviewRequest && req.method === 'POST') return passportPost((body) => creatorPassport.requestReview(passportReviewRequest[1], body));
  const passportReviewDecision = p.match(/^\/api\/creator-passport\/reviews\/([\w-]+)\/decide$/);
  if (passportReviewDecision && req.method === 'POST') return passportPost((body) => creatorPassport.decideReview(passportReviewDecision[1], body));
  const passportPackage = p.match(/^\/api\/creator-passport\/passports\/([\w-]+)\/package$/);
  if (passportPackage && req.method === 'POST') return passportPost((body) => creatorPassport.buildPackage(passportPackage[1], body));

  // ---------- Area 102: Studio Command — Camera, Post, VFX, Color, Sound & Delivery Ops ----------
  if (p === '/api/studio-command/status') return send(res, 200, 'application/json', JSON.stringify(studioCommand.status(), null, 2)), true;
  if (p === '/api/studio-command/data') return send(res, 200, 'application/json', JSON.stringify(studioCommand.data(), null, 2)), true;
  const studioCommandPost = async (action) => {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 8e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(action(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  };
  if (p === '/api/studio-command/projects/create' && req.method === 'POST') return studioCommandPost((body) => studioCommand.createProject(body));
  if (p === '/api/studio-command/shots/add' && req.method === 'POST') return studioCommandPost((body) => studioCommand.addShot(body));
  if (p === '/api/studio-command/sequences/add' && req.method === 'POST') return studioCommandPost((body) => studioCommand.addSequence(body));
  if (p === '/api/studio-command/notes/add' && req.method === 'POST') return studioCommandPost((body) => studioCommand.addNote(body));
  const studioStage = p.match(/^\/api\/studio-command\/projects\/([\w-]+)\/advance$/);
  if (studioStage && req.method === 'POST') return studioCommandPost((body) => studioCommand.advanceStage(studioStage[1], body));
  const studioNote = p.match(/^\/api\/studio-command\/notes\/([\w-]+)\/resolve$/);
  if (studioNote && req.method === 'POST') return studioCommandPost((body) => studioCommand.resolveNote(studioNote[1], body));
  if (p === '/api/studio-command/shortcuts/create' && req.method === 'POST') return studioCommandPost((body) => studioCommand.createShortcut(body));

  // ---------- Area 94: Capability Radar (curated source index → local adoption plans) ----------
  if (p === '/api/capability-radar/status') return send(res, 200, 'application/json', JSON.stringify(capabilityRadar.status(), null, 2)), true;
  if (p === '/api/capability-radar/sources') return send(res, 200, 'application/json', JSON.stringify({ sources: capabilityRadar.listSources() }, null, 2)), true;
  if (p === '/api/capability-radar/playbooks') return send(res, 200, 'application/json', JSON.stringify({ playbooks: capabilityRadar.listPlaybooks() }, null, 2)), true;
  if (p === '/api/capability-radar/targets') return send(res, 200, 'application/json', JSON.stringify({ targets: capabilityRadar.targets() }, null, 2)), true;
  if (p === '/api/capability-radar/adoptions') return send(res, 200, 'application/json', JSON.stringify({ adoptions: capabilityRadar.listAdoptions() }, null, 2)), true;
  if (p === '/api/capability-radar/adoptions/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(capabilityRadar.createAdoption(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const crBrief = p.match(/^\/api\/capability-radar\/adoptions\/([\w-]+)\/brief$/);
  if (crBrief && req.method === 'GET') { try { return send(res, 200, 'application/json', JSON.stringify(capabilityRadar.buildBrief(crBrief[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  const crAdvance = p.match(/^\/api\/capability-radar\/adoptions\/([\w-]+)\/advance$/);
  if (crAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(capabilityRadar.advanceAdoption(crAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 92: Social Control Plane (owned account registry → short-form → route/ad plans) ----------
  if (p === '/api/social-control/status') return send(res, 200, 'application/json', JSON.stringify(socialControl.status(), null, 2)), true;
  if (p === '/api/social-control/accounts') return send(res, 200, 'application/json', JSON.stringify({ accounts: socialControl.listAccounts() }, null, 2)), true;
  if (p === '/api/social-control/web-properties') return send(res, 200, 'application/json', JSON.stringify({ properties: socialControl.listWebProperties() }, null, 2)), true;
  if (p === '/api/social-control/launches') return send(res, 200, 'application/json', JSON.stringify({ launches: socialControl.listLaunches() }, null, 2)), true;
  if (p === '/api/social-control/accounts/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.addAccount(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/social-control/web-properties/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.addWebProperty(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scWebConnection = p.match(/^\/api\/social-control\/web-properties\/([\w-]+)\/connection-request$/);
  if (scWebConnection && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.requestWebConnection(scWebConnection[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scConnection = p.match(/^\/api\/social-control\/accounts\/([\w-]+)\/connection-request$/);
  if (scConnection && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.requestConnection(scConnection[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/social-control/lanes/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.addCustomLane(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/social-control/launches/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 5e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.createLaunch(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scDerivatives = p.match(/^\/api\/social-control\/launches\/([\w-]+)\/derivatives\/build$/);
  if (scDerivatives && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.buildDerivatives(scDerivatives[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scRoutes = p.match(/^\/api\/social-control\/launches\/([\w-]+)\/routes\/build$/);
  if (scRoutes && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.buildRoutes(scRoutes[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scWebHandoff = p.match(/^\/api\/social-control\/launches\/([\w-]+)\/web-handoff\/build$/);
  if (scWebHandoff && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.buildWebHandoff(scWebHandoff[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scPreflight = p.match(/^\/api\/social-control\/launches\/([\w-]+)\/preflight$/);
  if (scPreflight && req.method === 'GET') { try { return send(res, 200, 'application/json', JSON.stringify(socialControl.preflight(scPreflight[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  const scPaid = p.match(/^\/api\/social-control\/launches\/([\w-]+)\/paid-plan$/);
  if (scPaid && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.preparePaidActivation(scPaid[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scAdvance = p.match(/^\/api\/social-control\/launches\/([\w-]+)\/advance$/);
  if (scAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.advanceLaunch(scAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const scQueue = p.match(/^\/api\/social-control\/launches\/([\w-]+)\/dispatch\/queue$/);
  if (scQueue && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(socialControl.queueForDispatch(scQueue[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 91: Media Studio & Newsroom (assets → DAW/video/DJ/avatar → curated news) ----------
  if (p === '/api/media-newsroom/status') return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.status(), null, 2)), true;
  if (p === '/api/media-newsroom/assets') return send(res, 200, 'application/json', JSON.stringify({ assets: mediaNewsroom.listAssets() }, null, 2)), true;
  if (p === '/api/media-newsroom/links') return send(res, 200, 'application/json', JSON.stringify({ links: mediaNewsroom.listLinks() }, null, 2)), true;
  if (p === '/api/media-newsroom/projects') return send(res, 200, 'application/json', JSON.stringify({ projects: mediaNewsroom.listProjects() }, null, 2)), true;
  if (p === '/api/media-newsroom/watchlists') return send(res, 200, 'application/json', JSON.stringify({ watchlists: mediaNewsroom.listWatchlists() }, null, 2)), true;
  if (p === '/api/media-newsroom/assets/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.addAsset(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/media-newsroom/links/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.addQuickLink(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/media-newsroom/projects/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.createProject(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const mnAttach = p.match(/^\/api\/media-newsroom\/projects\/([\w-]+)\/assets\/([\w-]+)\/attach$/);
  if (mnAttach && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.attachAsset(mnAttach[1], mnAttach[2]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const mnBuild = p.match(/^\/api\/media-newsroom\/projects\/([\w-]+)\/build$/);
  if (mnBuild && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.buildProductionPlan(mnBuild[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const mnAdvance = p.match(/^\/api\/media-newsroom\/projects\/([\w-]+)\/advance$/);
  if (mnAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.advanceProject(mnAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const mnCalendar = p.match(/^\/api\/media-newsroom\/projects\/([\w-]+)\/calendar$/);
  if (mnCalendar && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.calendarProject(mnCalendar[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/media-newsroom/watchlists/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.addWatchlist(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const mnNewsNote = p.match(/^\/api\/media-newsroom\/watchlists\/([\w-]+)\/notes\/add$/);
  if (mnNewsNote && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.addNewsNote(mnNewsNote[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const mnNewsBrief = p.match(/^\/api\/media-newsroom\/watchlists\/([\w-]+)\/brief\/build$/);
  if (mnNewsBrief && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(mediaNewsroom.buildNewsBrief(mnNewsBrief[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 90: CreedStreet47 Label Desk (roster → rights → release plans) ----------
  if (p === '/api/label-desk/status') return send(res, 200, 'application/json', JSON.stringify(labelDesk.status(), null, 2)), true;
  if (p === '/api/label-desk/releases') return send(res, 200, 'application/json', JSON.stringify({ releases: labelDesk.listReleases() }, null, 2)), true;
  const ldPreflight = p.match(/^\/api\/label-desk\/releases\/([\w-]+)\/preflight$/);
  if (ldPreflight && req.method === 'GET') { try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.releasePreflight(ldPreflight[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  const ldDestinations = p.match(/^\/api\/label-desk\/releases\/([\w-]+)\/destinations$/);
  if (ldDestinations && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.setDestinations(ldDestinations[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ldConfirm = p.match(/^\/api\/label-desk\/entities\/(label|artist)\/([\w-]+)\/confirm$/);
  if (ldConfirm && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.confirmEntity(ldConfirm[1], ldConfirm[2], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/label-desk/direct-setup/request' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.requestDirectSetup(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/label-desk/releases/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.createRelease(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ldAdvance = p.match(/^\/api\/label-desk\/releases\/([\w-]+)\/advance$/);
  if (ldAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.advanceRelease(ldAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ldPromo = p.match(/^\/api\/label-desk\/releases\/([\w-]+)\/promo\/build$/);
  if (ldPromo && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.buildPromoPack(ldPromo[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ldCalendar = p.match(/^\/api\/label-desk\/releases\/([\w-]+)\/calendar$/);
  if (ldCalendar && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(labelDesk.addReleaseToCalendar(ldCalendar[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 89: Creator, Channel & Music Desk (owned templates + official adapters) ----------
  if (p === '/api/creator-desk/status') return send(res, 200, 'application/json', JSON.stringify(creatorDesk.status(), null, 2)), true;
  if (p === '/api/creator-desk/profiles') return send(res, 200, 'application/json', JSON.stringify({ profiles: creatorDesk.listProfiles() }, null, 2)), true;
  if (p === '/api/creator-desk/templates') return send(res, 200, 'application/json', JSON.stringify({ templates: creatorDesk.listTemplates() }, null, 2)), true;
  if (p === '/api/creator-desk/campaigns') return send(res, 200, 'application/json', JSON.stringify({ campaigns: creatorDesk.listCampaigns() }, null, 2)), true;
  if (p === '/api/creator-desk/music-releases') return send(res, 200, 'application/json', JSON.stringify({ releases: creatorDesk.listMusicReleases() }, null, 2)), true;
  if (p === '/api/creator-desk/profiles/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.addProfile(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const cdConnection = p.match(/^\/api\/creator-desk\/profiles\/([\w-]+)\/connection-request$/);
  if (cdConnection && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.requestConnection(cdConnection[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/creator-desk/templates/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.addTemplate(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/creator-desk/campaigns/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.createCampaign(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const cdCampaignBuild = p.match(/^\/api\/creator-desk\/campaigns\/([\w-]+)\/build$/);
  if (cdCampaignBuild && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.buildCampaignDrafts(cdCampaignBuild[1]), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const cdCampaignAdvance = p.match(/^\/api\/creator-desk\/campaigns\/([\w-]+)\/advance$/);
  if (cdCampaignAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.advanceCampaign(cdCampaignAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const cdCampaignCalendar = p.match(/^\/api\/creator-desk\/campaigns\/([\w-]+)\/calendar$/);
  if (cdCampaignCalendar && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.addCampaignToCalendar(cdCampaignCalendar[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/creator-desk/music-releases/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.createMusicRelease(body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const cdMusicAdvance = p.match(/^\/api\/creator-desk\/music-releases\/([\w-]+)\/advance$/);
  if (cdMusicAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(creatorDesk.advanceMusicRelease(cdMusicAdvance[1], body), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 88: AURA Heart (read-only purpose + real connected state) ----------
  if (p === '/api/aura-heart/status') return send(res, 200, 'application/json', JSON.stringify(auraHeart.status(), null, 2)), true;

  // ---------- Area 87: Content Command (sources → original packages → release plans) ----------
  if (p === '/api/content-command/status') return send(res, 200, 'application/json', JSON.stringify(contentCommand.status(), null, 2)), true;
  if (p === '/api/content-command/sources') return send(res, 200, 'application/json', JSON.stringify({ sources: contentCommand.listSources() }, null, 2)), true;
  if (p === '/api/content-command/items') return send(res, 200, 'application/json', JSON.stringify({ items: contentCommand.listItems() }, null, 2)), true;
  if (p === '/api/content-command/collections') return send(res, 200, 'application/json', JSON.stringify({ collections: contentCommand.listCollections() }, null, 2)), true;
  if (p === '/api/content-command/packages') return send(res, 200, 'application/json', JSON.stringify({ packages: contentCommand.listPackages() }, null, 2)), true;
  if (p === '/api/content-command/releases') return send(res, 200, 'application/json', JSON.stringify({ deliveries: contentCommand.listDeliveries() }, null, 2)), true;
  if (p === '/api/content-command/sources/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.createSource(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ccFetch = p.match(/^\/api\/content-command\/sources\/([\w-]+)\/fetch$/);
  if (ccFetch && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(await contentCommand.fetchSource(ccFetch[1]), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content-command/items/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.addItem(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content-command/collections/open' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.createCollection(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ccCollectionItem = p.match(/^\/api\/content-command\/collections\/([\w-]+)\/items\/([\w-]+)\/add$/);
  if (ccCollectionItem && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.addItemToCollection(ccCollectionItem[1], ccCollectionItem[2]), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ccCollectionClose = p.match(/^\/api\/content-command\/collections\/([\w-]+)\/close$/);
  if (ccCollectionClose && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.closeCollection(ccCollectionClose[1], body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content-command/packages/create' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.createPackage(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ccAdvance = p.match(/^\/api\/content-command\/packages\/([\w-]+)\/advance$/);
  if (ccAdvance && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 4e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.advancePackage(ccAdvance[1], body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ccBuild = p.match(/^\/api\/content-command\/packages\/([\w-]+)\/build$/);
  if (ccBuild && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.buildArtifacts(ccBuild[1]), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/content-command/releases/queue' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(contentCommand.queueRelease(String(body.package_id), body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 74: Service Fabric (self-installable services + modes) --
  if (p === '/api/services/status') return send(res, 200, 'application/json', JSON.stringify(await serviceFabric.status(), null, 2)), true;
  if (p === '/api/services/add' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify({ ok: true, service: serviceFabric.addService(body) }, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const svcOp = p.match(/^\/api\/services\/([\w:-]+)\/(remove|install|uninstall|enable|disable|probe)$/);
  if (svcOp) {
    const [ , sid, op ] = svcOp;
    try {
      if (op === 'remove') return send(res, 200, 'application/json', JSON.stringify(serviceFabric.removeService(sid), null, 2)), true;
      if (op === 'install') return send(res, 200, 'application/json', JSON.stringify({ ok: true, service: serviceFabric.setInstalled(sid, true) }, null, 2)), true;
      if (op === 'uninstall') return send(res, 200, 'application/json', JSON.stringify({ ok: true, service: serviceFabric.setInstalled(sid, false) }, null, 2)), true;
      if (op === 'enable') return send(res, 200, 'application/json', JSON.stringify({ ok: true, service: serviceFabric.setEnabled(sid, true) }, null, 2)), true;
      if (op === 'disable') return send(res, 200, 'application/json', JSON.stringify({ ok: true, service: serviceFabric.setEnabled(sid, false) }, null, 2)), true;
      if (op === 'probe') return send(res, 200, 'application/json', JSON.stringify(await serviceFabric.probeService(sid), null, 2)), true;
    } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/services/mode' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(serviceFabric.setMode(String(body.id), !!body.on), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Areas 08 + 17 (voll ausgebaut) ----------
  if (p === '/api/kids-story' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(kidsStory.generate(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/kids-story/status') return send(res, 200, 'application/json', JSON.stringify(kidsStory.status(), null, 2)), true;
  if (p === '/api/report-daemon') return send(res, 200, 'application/json', JSON.stringify(reportDaemon.status(), null, 2)), true;
  if (p === '/api/report-daemon/enable' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { body = {}; }
    return send(res, 200, 'application/json', JSON.stringify(reportDaemon.setEnabled(body.on !== false), null, 2)), true;
  }
  if (p === '/api/report-daemon/run' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(reportDaemon.runNow(), null, 2)), true;

  // ---------- Area 75: Routine & Link Control ----------
  if (p === '/api/control') return send(res, 200, 'application/json', JSON.stringify(routineControl.status(), null, 2)), true;
  if (p === '/api/control/toggle' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(routineControl.toggle(String(body.id), body.on !== false), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/control/links/add' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify({ ok: true, link: routineControl.addLink(body) }, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const lnkOp = p.match(/^\/api\/control\/links\/([\w-]+)\/(remove|enable|disable)$/);
  if (lnkOp) {
    try {
      if (lnkOp[2] === 'remove') return send(res, 200, 'application/json', JSON.stringify(routineControl.removeLink(lnkOp[1]), null, 2)), true;
      return send(res, 200, 'application/json', JSON.stringify(routineControl.toggleLink(lnkOp[1], lnkOp[2] === 'enable'), null, 2)), true;
    } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 76: Creative Studio Suite ----------
  if (p === '/api/studio/status') return send(res, 200, 'application/json', JSON.stringify(studio.status(), null, 2)), true;
  if (p === '/api/studio/generate' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(studio.generate(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 77: Test Lab (force-run + expect-fail) ----------
  if (p === '/api/testlab/status') return send(res, 200, 'application/json', JSON.stringify(testLab.status(), null, 2)), true;
  if (p === '/api/testlab/run' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(await testLab.runOne(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/testlab/suite' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(await testLab.suite(), null, 2)), true;

  // ---------- Area 78: Telegram Agent ----------
  if (p === '/api/telegram/status') return send(res, 200, 'application/json', JSON.stringify(await telegramAgent.status(), null, 2)), true;
  if (p === '/api/telegram/probe' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(await telegramAgent.probe(), null, 2)), true;
  if (p === '/api/telegram/start' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(await telegramAgent.startPoller(), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/telegram/stop' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(telegramAgent.stopPoller(), null, 2)), true;

  // ---------- Hot-CRUD: departments/skills ohne Neustart & ohne Crash ----------
  if (p === '/api/depts/add' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(registry.skills.addDepartment(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/depts/remove' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(registry.skills.removeDepartment(String(body.id)), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/skills/add' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(registry.skills.addSkill(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/skills/remove' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(registry.skills.removeSkill(String(body.id)), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- How-to-Build-Doku für externe Builder-Agenten ----------
  if (p === '/api/howto') {
    const howto = {
      purpose: 'Fehlerfreie Aufbau-Anleitung für externe Agenten (z. B. ChatGPT), die AURA-Module/Schnittstellen bauen',
      golden_rules: [
        '1. Neue Logik NIEMALS in backend/server.js — nur Route-Module (src/routes/), Lib-Module (src/lib/) oder Seiten (pages/).',
        '2. Vor JEDEM Neustart: node --check <jede geänderte Datei>. Syntaxfehler killen den Server.',
        '3. Nach Neustart IMMER: node test/validate.js — 0 fail ist die Definition von fertig.',
        '4. Cross-Requires zwischen Lib-Modulen LAZY in Funktionen (nie top-level) — sonst Zirkel-Crash.',
        '5. Daten-Dateien nur atomar schreiben (tmp → JSON.parse-Selbstcheck → rename).',
        '6. Ehrlichkeit: SIMULATION/LIVE/NOT-CONNECTED labeln; nie Zufallsdaten als live ausgeben.',
        '7. Secrets nie committen (deploy/.env ist gitignored); keine Tokens/Keys in Code oder Daten-JSON.',
      ],
      contracts: {
        lib_module: "'use strict'; module.exports = { meta: { area: 'NN', id, name, state: 'live' }, actions: { name: (payload)=>result }, ... } — Actions laufen automatisch in Area-67-Containern (Timeout+Quarantäne). Danach in src/lib/registry.js live-Map eintragen.",
        route_module: 'Datei in src/routes/: module.exports = { name, async handle(ctx) } — ctx={req,res,url,p,method,send,readBody,syntaxFail}; return true wenn geantwortet, sonst false. In src/dispatcher.js ROUTE_MODULES eintragen.',
        page: 'backend/pages/x.js exportiert () => htmlString; Route in src/routes/pages_routes.js; Hub-Karte in pages/hub.js; Ignition-Eintrag in api_areas.js /api/ignition catalog.',
        external_module: 'Area 70: backend/modules/<name>/aura.module.json (Spec: docs/MODULE_SYSTEM.md) — Approval-Gate beachten.',
        department: 'POST /api/depts/add {id,name,areas,prompt:"... {role} ...",roles:[{id,title,usecase}]} — hot, ohne Neustart.',
        skill: 'POST /api/skills/add {id,name,repo:"owner/repo",desc,crosslinks:["69"],stars} — hot, ohne Neustart.',
      },
      endpoints: 'GET /api/modules/live (alle Areas+Actions) · GET /api/howto (diese Doku) · docs/HOWTO_BUILD.md (Langform) · POST /api/testlab/run {area,action,payload,expect:"ok"|"fail",force:true} zum gefahrlosen Testen',
      crash_prevention: 'Alles läuft in Containern (Area 67): ein crashendes Modul wird isoliert+quarantänisiert, Server lebt weiter. Kill-Switch: POST /api/kill {arm:true}.',
    };
    return send(res, 200, 'application/json', JSON.stringify(howto, null, 2)), true;
  }

  // ---------- Area 79: Ollama Model Manager ----------
  if (p === '/api/ollama/status') return send(res, 200, 'application/json', JSON.stringify(await ollamaManager.status(), null, 2)), true;
  if (p === '/api/ollama/server-profiles') return send(res, 200, 'application/json', JSON.stringify(await ollamaManager.serverProfiles(), null, 2)), true;
  if (p === '/api/ollama/catalog') return send(res, 200, 'application/json', JSON.stringify({ excluded_note: ollamaManager.EXCLUDED_NOTE, catalog: ollamaManager.catalog() }, null, 2)), true;
  if (p === '/api/ollama/probe' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(await ollamaManager.probe(), null, 2)), true;
  if (p === '/api/ollama/pull' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    if (body.confirm !== 'QUEUE_MODEL_PULL') return send(res, 400, 'application/json', JSON.stringify({ ok: false, requires_confirmation: true, warning: 'Model pulls may consume substantial disk, RAM and bandwidth. Confirm with {"confirm":"QUEUE_MODEL_PULL"} after checking the server profile.' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(await ollamaManager.pull(String(body.name)), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/ollama/install-script') return send(res, 200, 'text/x-shellscript; charset=utf-8', ollamaManager.installScript(), { 'Content-Disposition': 'attachment; filename="aura-ollama-install.sh"' }), true;

  // ---------- Area 80: Brain Role Mapper ----------
  if (p === '/api/brainmap') return send(res, 200, 'application/json', JSON.stringify(brainMapper.map(), null, 2)), true;
  if (p === '/api/brainmap/status') return send(res, 200, 'application/json', JSON.stringify(brainMapper.status(), null, 2)), true;
  if (p === '/api/brainmap/assign' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(brainMapper.assign(String(body.node), body.agent), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/brainmap/unassign' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(brainMapper.unassign(String(body.node)), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/brainmap/tier-default' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(brainMapper.setTierDefault(body.tier, body.agent), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 81: Control Tower (directives + fault ack) ----------
  if (p === '/api/controltower/status') return send(res, 200, 'application/json', JSON.stringify(controlTower.status(), null, 2)), true;
  if (p === '/api/controltower/all') return send(res, 200, 'application/json', JSON.stringify(controlTower.all(), null, 2)), true;
  if (p === '/api/controltower/orders') {
    const t = url.searchParams.get('target') || '';
    return send(res, 200, 'application/json', JSON.stringify(controlTower.ordersFor(t), null, 2)), true;
  }
  if (p === '/api/controltower/set' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(controlTower.setDirective(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/controltower/ack' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(controlTower.ackFault(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const ctOp = p.match(/^\/api\/controltower\/directives\/([\w:-]+)\/([\w-]+)\/(on|off|remove)$/);
  if (ctOp) {
    try {
      if (ctOp[3] === 'remove') return send(res, 200, 'application/json', JSON.stringify(controlTower.removeDirective(ctOp[1], ctOp[2]), null, 2)), true;
      return send(res, 200, 'application/json', JSON.stringify(controlTower.toggleDirective(ctOp[1], ctOp[2], ctOp[3] === 'on'), null, 2)), true;
    } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 82: Cross-link Policy ----------
  if (p === '/api/crosslink/status') return send(res, 200, 'application/json', JSON.stringify(crosslinkPolicy.status(), null, 2)), true;
  if (p === '/api/crosslink/overview') return send(res, 200, 'application/json', JSON.stringify(crosslinkPolicy.overview(), null, 2)), true;
  if (p === '/api/crosslink/set' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(crosslinkPolicy.setPolicy(String(body.module), String(body.mode)), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Area 19 maximiert: Yellow Pages Wissensbasis (CRUD + Brain-Feed) ----------
  if (p === '/api/yp/status') return send(res, 200, 'application/json', JSON.stringify(yellowPages.status(), null, 2)), true;
  if (p === '/api/yp/list') {
    const q = url.searchParams.get('q') || undefined, category = url.searchParams.get('category') || undefined, kind = url.searchParams.get('kind') || undefined;
    return send(res, 200, 'application/json', JSON.stringify({ entries: yellowPages.list({ q, category, kind }) }, null, 2)), true;
  }
  if (p === '/api/yp/categories' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ categories: yellowPages.load().categories }, null, 2)), true;
  if (p === '/api/yp/categories' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.addCategory(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/yp/categories/delete' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(yellowPages.deleteCategory(String(body.id || '')), null, 2)), true;
  }
  if (p === '/api/yp/entries' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 3e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.addEntry(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/yp/entries/update' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 3e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    const { id, ...patch } = body;
    try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.updateEntry(String(id || ''), patch), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/yp/entries/delete' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.deleteEntry(String(body.id || '')), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/yp/entries/restore' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.restoreEntry(String(body.id || '')), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/yp/ingest' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(yellowPages.ingestFromCatalog(), null, 2)), true;
  if (p === '/api/yp/feed' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ feed: yellowPages.brainFeed() }, null, 2)), true;
  if (p === '/api/yp/feed' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 3e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.feedToBrain(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/yp/feed/toggle' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.toggleFeed(String(body.id || '')), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/yp/feed/delete' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(yellowPages.deleteFeed(String(body.id || '')), null, 2)), true;
  }
  if (p === '/api/yp/brain-bundle') {
    const category = url.searchParams.get('category') || undefined;
    return send(res, 200, 'application/json', JSON.stringify(yellowPages.brainBundle(category), null, 2)), true;
  }
  if (p === '/api/yp/export') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="aura-yellowpages-export.json"' });
    res.end(JSON.stringify({ exported_at: new Date().toISOString(), ...yellowPages.load() }, null, 2));
    return true;
  }
  if (p === '/api/yellowpages') return send(res, 200, 'application/json', JSON.stringify(yellowPages.legacyView(), null, 2)), true;

  // ---------- Area 79 offen: custom Modelle + Suche + Test + Keys ----------
  if (p === '/api/ollama/custom' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ custom: ollamaManager.customModels() }, null, 2)), true;
  if (p === '/api/ollama/custom' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(ollamaManager.addCustom(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/ollama/custom/remove' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(ollamaManager.removeCustom(String(body.name || '')), null, 2)), true;
  }
  if (p === '/api/ollama/search') {
    const q = url.searchParams.get('q') || '';
    try { return send(res, 200, 'application/json', JSON.stringify(await ollamaManager.search(q), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/ollama/test' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 5e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(await ollamaManager.testModel(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/ollama/keys' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ ok: true, keys: ollamaManager.keysMasked() }, null, 2)), true;
  if (p === '/api/ollama/keys' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(ollamaManager.setKeys(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Areas 09–15,18,26–31,34/35,37/38,40: neue Live-Module ----------
  if (p === '/api/media/status') return send(res, 200, 'application/json', JSON.stringify(mediaPipeline.status(), null, 2)), true;
  if (p === '/api/media/plan' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(mediaPipeline.plan(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/media/render' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } return send(res, 200, 'application/json', JSON.stringify(await mediaPipeline.render(b), null, 2)), true; }

  if (p === '/api/incubator/status') return send(res, 200, 'application/json', JSON.stringify(contentIncubator.status(), null, 2)), true;
  if (p === '/api/incubator/submit' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(contentIncubator.submit(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/incubator/list') return send(res, 200, 'application/json', JSON.stringify({ ideas: contentIncubator.list({ stage: url.searchParams.get('stage') || undefined }) }, null, 2)), true;
  if (p === '/api/incubator/advance' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(contentIncubator.advance(String(b.id || '')), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/editorial/status') return send(res, 200, 'application/json', JSON.stringify(editorialIncubator.status(), null, 2)), true;
  if (p === '/api/editorial/create' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(editorialIncubator.create(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/editorial/list') return send(res, 200, 'application/json', JSON.stringify({ pieces: editorialIncubator.list(url.searchParams.get('stage') || undefined) }, null, 2)), true;
  if (p === '/api/editorial/stage' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(editorialIncubator.setStage(String(b.id || ''), String(b.stage || ''), b.approver), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/community/status') return send(res, 200, 'application/json', JSON.stringify(communityIncubator.status(), null, 2)), true;
  if (p === '/api/community/feedback' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(communityIncubator.addFeedback(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/community/event' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(communityIncubator.addEvent(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/dispatch/status') return send(res, 200, 'application/json', JSON.stringify(dispatcher.status(), null, 2)), true;
  if (p === '/api/dispatch/enqueue' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(dispatcher.enqueue(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/dispatch/flush' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(await dispatcher.flush(), null, 2)), true;
  if (p === '/api/dispatch/list') return send(res, 200, 'application/json', JSON.stringify(dispatcher.list(), null, 2)), true;

  if (p === '/api/wordpress/status') return send(res, 200, 'application/json', JSON.stringify(wordpressBridge.status(), null, 2)), true;
  if (p === '/api/wordpress/publish' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await wordpressBridge.publishPost(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/n8n/status') return send(res, 200, 'application/json', JSON.stringify(n8nBridge.status(), null, 2)), true;
  if (p === '/api/n8n/webhook' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(n8nBridge.addWebhook(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/n8n/dispatch' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await n8nBridge.dispatch(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/ksync/status') return send(res, 200, 'application/json', JSON.stringify(knowledgeSync.status(), null, 2)), true;
  if (p === '/api/ksync/repo' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(knowledgeSync.addRepo(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/ksync/sync' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } return send(res, 200, 'application/json', JSON.stringify(await knowledgeSync.syncRepo(String(b.owner || ''), String(b.repo || '')), null, 2)), true; }

  if (p === '/api/hardware/status') return send(res, 200, 'application/json', JSON.stringify(hardwareRouter.status(), null, 2)), true;
  if (p === '/api/hardware/device' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(hardwareRouter.addDevice(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/hardware/route' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(hardwareRouter.route(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/compute/status') return send(res, 200, 'application/json', JSON.stringify(computeRouter.status(), null, 2)), true;
  if (p === '/api/compute/node' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(computeRouter.registerNode(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/compute/submit' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(computeRouter.submitJob(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/cloud/status') return send(res, 200, 'application/json', JSON.stringify(cloudConnector.status(), null, 2)), true;
  if (p === '/api/cloud/optin' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(cloudConnector.setOptIn(String(b.provider || ''), !!b.on), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/mesh/status') return send(res, 200, 'application/json', JSON.stringify(meshEngine.status(), null, 2)), true;
  if (p === '/api/mesh/join' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(meshEngine.join(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/mesh/table') return send(res, 200, 'application/json', JSON.stringify(meshEngine.routingTable(), null, 2)), true;

  if (p === '/api/telemetry/status') return send(res, 200, 'application/json', JSON.stringify(telemetryStream.status(), null, 2)), true;
  if (p === '/api/telemetry/snapshot') return send(res, 200, 'application/json', JSON.stringify(telemetryStream.snapshot(), null, 2)), true;
  if (p === '/api/telemetry/stream') return telemetryStream.stream(res), true;

  if (p === '/api/variance/status') return send(res, 200, 'application/json', JSON.stringify(varianceLifecycle.status(), null, 2)), true;
  if (p === '/api/variance/create' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(varianceLifecycle.createVariant(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/variance/promote' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(varianceLifecycle.promote(String(b.id || ''), b.approver), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/finance/status') return send(res, 200, 'application/json', JSON.stringify(financeEngine.status(), null, 2)), true;
  if (p === '/api/finance/budget' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(financeEngine.setBudget(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/finance/usage' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(financeEngine.recordUsage(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/gateway/status') return send(res, 200, 'application/json', JSON.stringify(gatewayHealth.status(), null, 2)), true;
  if (p === '/api/gateway/check' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(await gatewayHealth.checkAll(), null, 2)), true;
  if (p === '/api/gateway/report') return send(res, 200, 'application/json', JSON.stringify(gatewayHealth.report(), null, 2)), true;

  if (p === '/api/delivery/status') return send(res, 200, 'application/json', JSON.stringify(deliveryMonitor.status(), null, 2)), true;
  if (p === '/api/delivery/ingest' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(deliveryMonitor.ingestFromDispatcher(), null, 2)), true;
  if (p === '/api/delivery/quota') return send(res, 200, 'application/json', JSON.stringify(deliveryMonitor.quota(), null, 2)), true;

  if (p === '/api/vision/status') return send(res, 200, 'application/json', JSON.stringify(visionBridge.status(), null, 2)), true;
  if (p === '/api/vision/analyze' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 9e6) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await visionBridge.analyze(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/vault/status') return send(res, 200, 'application/json', JSON.stringify(vault.status(), null, 2)), true;
  if (p === '/api/vault/add' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(vault.addSecret(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/vault/list') return send(res, 200, 'application/json', JSON.stringify(vault.listSecrets(), null, 2)), true;
  if (p === '/api/vault/remove' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } return send(res, 200, 'application/json', JSON.stringify(vault.removeSecret(String(b.name || '')), null, 2)), true; }

  // ---------- Area 85: Harness-Kit (Claude Code / Cursor / OpenClaw) ----------
  if (p === '/api/harness/status') return send(res, 200, 'application/json', JSON.stringify(harnessKit.status(), null, 2)), true;
  if (p === '/api/harness/claude-md') { res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="CLAUDE.md"' }); res.end(harnessKit.claudeMd()); return true; }
  if (p === '/api/harness/agents-md') { res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="AGENTS.md"' }); res.end(harnessKit.agentsMd()); return true; }
  if (p === '/api/harness/hooks') { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="settings.json"' }); res.end(JSON.stringify(harnessKit.hooksSettings(), null, 2)); return true; }
  if (p === '/api/harness/guard') { res.writeHead(200, { 'Content-Type': 'text/x-sh; charset=utf-8', 'Content-Disposition': 'attachment; filename="harness-guard.sh"' }); res.end(harnessKit.guardScript()); return true; }
  if (p === '/api/harness/skills') return send(res, 200, 'application/json', JSON.stringify({ bundles: harnessKit.skillBundles() }, null, 2)), true;

  // ---------- Area 86: Sentinel — Live-Sicherheitswache & Scanner ----------
  if (p === '/api/sentinel/status') return send(res, 200, 'application/json', JSON.stringify(sentinelWatch.status(), null, 2)), true;
  if (p === '/api/sentinel/scan') return send(res, 200, 'application/json', JSON.stringify(sentinelWatch.scan(), null, 2)), true;
  if (p === '/api/sentinel/events') return send(res, 200, 'application/json', JSON.stringify(sentinelWatch.events(), null, 2)), true;
  if (p === '/api/sentinel/block' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(sentinelWatch.block(String(body.ip || ''), body.reason), null, 2)), true; }
    catch (e) { return send(res, e.code || 400, 'application/json', JSON.stringify({ error: String(e.message || e) })), true; }
  }
  if (p === '/api/sentinel/unblock' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(sentinelWatch.unblock(String(body.ip || '')), null, 2)), true;
  }

  // ---------- A2A-Surface: Agent Card + message/send (Agent2Agent-Protokoll) ----------
  if (p === '/api/a2a/agent-card' || p === '/.well-known/agent.json') return send(res, 200, 'application/json', JSON.stringify({
    name: 'AURA', description: 'AURA Agent Command Center — Flotte aus Heads, Supers und ULTRA MASTER BRAIN unter REGEL 1 (Admin-Primat).',
    version: '1.0.0', protocolVersion: '0.3.0', url: '/api/a2a',
    capabilities: { streaming: false, pushNotifications: false },
    skills: [{ id: 'aura-ask', name: 'aura-ask', description: 'Frage das ULTRA MASTER BRAIN — antwortet aus Live-Systemdaten.' }],
    security: 'REGEL 1: nur mit Autorisierung des Administrators; keine autonomen Fremdaktionen.',
  }, null, 2)), true;
  if (p === '/api/a2a' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    const msg = body.params && body.params.message && Array.isArray(body.params.message.parts) ? body.params.message.parts.map((x) => x.text || '').join(' ') : String(body.msg || '');
    let answer = 'REGEL 1: keine Nachricht übergeben.';
    try { if (msg.trim()) answer = require('../lib/ultra_chat').ask(msg); } catch {}
    return send(res, 200, 'application/json', JSON.stringify({ jsonrpc: '2.0', id: body.id || null, result: { kind: 'message', role: 'agent', parts: [{ kind: 'text', text: answer }], status: { state: 'completed' } } }, null, 2)), true;
  }

  // ---------- Area 84: Agent Intercom (Chat Heads/Supers/Ultra) ----------
  if (p === '/api/intercom/status') return send(res, 200, 'application/json', JSON.stringify(agentIntercom.status(), null, 2)), true;
  if (p === '/api/intercom/channels') return send(res, 200, 'application/json', JSON.stringify({ channels: agentIntercom.channels() }, null, 2)), true;
  if (p === '/api/intercom/messages') return send(res, 200, 'application/json', JSON.stringify({ messages: agentIntercom.messages(url.searchParams.get('channel') || undefined, Number(url.searchParams.get('limit')) || undefined) }, null, 2)), true;
  if (p === '/api/intercom/post' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(agentIntercom.adminPost(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/intercom/say' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(await agentIntercom.speak(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/intercom/meeting' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(await agentIntercom.meeting(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/intercom/clear' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(agentIntercom.clear(body.channel), null, 2)), true;
  }

  // ---------- Area 83: Function Registry (add/ignore/soft-delete) ----------
  if (p === '/api/functions/status') return send(res, 200, 'application/json', JSON.stringify(functionRegistry.status(), null, 2)), true;
  if (p === '/api/functions') return send(res, 200, 'application/json', JSON.stringify({ functions: functionRegistry.list() }, null, 2)), true;
  if (p === '/api/functions/add' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(functionRegistry.add(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const fnOp = p.match(/^\/api\/functions\/([\w-]+)\/(ignore|reactivate|delete|restore)$/);
  if (fnOp) {
    let body = {};
    if (req.method === 'POST') { try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { body = {}; } }
    try {
      if (fnOp[2] === 'ignore') return send(res, 200, 'application/json', JSON.stringify(functionRegistry.setState(fnOp[1], 'ignored'), null, 2)), true;
      if (fnOp[2] === 'reactivate') return send(res, 200, 'application/json', JSON.stringify(functionRegistry.setState(fnOp[1], 'active'), null, 2)), true;
      if (fnOp[2] === 'delete') return send(res, 200, 'application/json', JSON.stringify(functionRegistry.deleteFn(fnOp[1], body.token), null, 2)), true;
      if (fnOp[2] === 'restore') return send(res, 200, 'application/json', JSON.stringify(functionRegistry.restore(fnOp[1]), null, 2)), true;
    } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  if (p === '/api/yellowpages/suggest' && req.method === 'POST') {
    // cross-usage: Deep Research findings → Yellow-Pages-Wissensbasis, human-gated als 'review'
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    const url2 = String(body.url || ''); const name = String(body.name || '').slice(0, 80);
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url2)) return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'only https://github.com/owner/repo suggestions' })), true;
    try {
      const r = yellowPages.addEntry({ name: name || url2.split('/').slice(-2).join('/'), url: url2, category: 'deep-research', desc: String(body.desc || '').slice(0, 180) || 'suggested via AURA Deep Research', kind: 'link', tags: ['research'] });
      yellowPages.updateEntry(r.entry.id, { status: 'review' });
      store.audit({ area: 'YP', event: 'research_suggestion', url: url2 });
      return send(res, 201, 'application/json', JSON.stringify({ ok: true, status: 'review', id: r.entry.id })), true;
    } catch (e) {
      if (e.code === 409) return send(res, 200, 'application/json', JSON.stringify({ ok: true, duplicate: true, url: url2 })), true;
      return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true;
    }
  }
  if (p === '/api/teams') return send(res, 200, 'application/json', JSON.stringify(JSON.parse(fs.readFileSync(path.join(DATA, 'teams.json'), 'utf8')).teams, null, 2)), true;
  if (p === '/api/socialchain' && req.method === 'POST') {
    const raw = await new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e5) req.destroy(); }); req.on('end', () => r(d)); });
    let cfg; try { cfg = JSON.parse(raw); } catch { return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })), true; }
    if (!cfg.gates || cfg.gates.human_approval !== true || cfg.gates.no_synthetic_engagement !== true) {
      return send(res, 403, 'application/json', JSON.stringify({ error: 'REFUSED: human approval + no synthetic engagement are mandatory' })), true;
    }
    store.audit({ area: 'WF-7', event: 'social_chain_configured', platform: cfg.platform, specialists: cfg.specialists });
    return send(res, 200, 'application/json', JSON.stringify({ ok: true, audited: true })), true;
  }

  // ---- Area 61: Governed Workflow Builder + local-only workflow runs ----
  // Workflow runs are records and simulations only: no provider call, host action,
  // deployment, publish operation or credential handling exists on this surface.
  if (p === '/api/workflow-runs' && req.method === 'GET') {
    return send(res, 200, 'application/json', JSON.stringify(wfBuilder.listRuns({ state: url.searchParams.get('state'), workflow_id: url.searchParams.get('workflow_id') }), null, 2)), true;
  }
  if (p === '/api/workflow-runs' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 5e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { return send(res, 201, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.createRun(body) }, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const workflowRunMatch = p.match(/^\/api\/workflow-runs\/([A-Za-z0-9_-]+)(?:\/(simulate|submit|approve|reject|handoff|close|reopen|artifacts|incident|audit))?$/);
  if (workflowRunMatch) {
    const [, runId, action] = workflowRunMatch;
    if (req.method === 'GET' && !action) {
      try { return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.getRun(runId), audit: wfBuilder.auditRun(runId) }, null, 2)), true; }
      catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
    }
    if (req.method === 'GET' && action === 'audit') {
      try { return send(res, 200, 'application/json', JSON.stringify({ ok: true, audit: wfBuilder.auditRun(runId) }, null, 2)), true; }
      catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
    }
    if (req.method === 'POST' && action) {
      let body; try { body = JSON.parse(await readBody(req, 5e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
      try {
        if (action === 'simulate') return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.simulateRun(runId, body) }, null, 2)), true;
        if (action === 'submit') return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.updateState(runId, 'AWAITING_APPROVAL', body) }, null, 2)), true;
        if (action === 'approve') return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.updateState(runId, 'APPROVED', body) }, null, 2)), true;
        if (action === 'reject') return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.updateState(runId, 'REJECTED', body) }, null, 2)), true;
        if (action === 'handoff') return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.updateState(runId, 'HANDED_OFF', body) }, null, 2)), true;
        if (action === 'close') return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.updateState(runId, 'CLOSED', body) }, null, 2)), true;
        if (action === 'reopen') return send(res, 200, 'application/json', JSON.stringify({ ok: true, run: wfBuilder.updateState(runId, 'DRAFT', body) }, null, 2)), true;
        if (action === 'artifacts') return send(res, 201, 'application/json', JSON.stringify({ ok: true, ...wfBuilder.addArtifact(runId, body) }, null, 2)), true;
        if (action === 'incident') return send(res, 201, 'application/json', JSON.stringify({ ok: true, ...wfBuilder.reportIncident(runId, body) }, null, 2)), true;
      } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
    }
  }
  if (p === '/api/builder/workflows' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(wfBuilder.list(), null, 2)), true;
  if (p === '/api/builder/workflows' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })), true; }
    const r = wfBuilder.add(body);
    return send(res, r.ok ? 201 : 400, 'application/json', JSON.stringify(r, null, 2)), true;
  }
  if (p.startsWith('/api/builder/workflows/') && req.method === 'DELETE') {
    return send(res, 200, 'application/json', JSON.stringify(wfBuilder.remove(decodeURIComponent(p.split('/').pop())))), true;
  }
  if (p === '/api/builder/simulate' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e5)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(wfBuilder.simulate(body.id), null, 2)), true;
  }

  // ---- WF-20: release candidate evidence gate (local record, never deployment) ----
  if (p === '/api/releases' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(releaseGate.list(), null, 2)), true;
  if (p === '/api/releases' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 5e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { return send(res, 201, 'application/json', JSON.stringify({ ok: true, candidate: releaseGate.create(body) }, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const releaseRoute = p.match(/^\/api\/releases\/([A-Za-z0-9_-]+)(?:\/(amend|claim|review|approve|reject|close|report))?$/);
  if (releaseRoute) {
    const [, releaseId, action] = releaseRoute;
    if (req.method === 'GET' && (!action || action === 'report')) {
      try { return send(res, 200, 'application/json', JSON.stringify({ ok: true, ...releaseGate.report(releaseId) }, null, 2)), true; }
      catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
    }
    if (req.method === 'POST' && action) {
      let body; try { body = JSON.parse(await readBody(req, 5e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
      try {
        if (action === 'amend') return send(res, 200, 'application/json', JSON.stringify({ ok: true, candidate: releaseGate.amendEvidence(releaseId, body) }, null, 2)), true;
        if (action === 'claim') return send(res, 200, 'application/json', JSON.stringify({ ok: true, candidate: releaseGate.claimOwner(releaseId, body) }, null, 2)), true;
        const state = action === 'review' ? 'READY_FOR_APPROVAL' : action === 'approve' ? 'APPROVED_FOR_HANDOFF' : action === 'reject' ? 'REJECTED' : action === 'close' ? 'CLOSED' : null;
        if (!state) throw Object.assign(new Error('unknown release action'), { code: 404 });
        return send(res, 200, 'application/json', JSON.stringify({ ok: true, candidate: releaseGate.transition(releaseId, state, body) }, null, 2)), true;
      } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
    }
  }

  // ---- Area 62: Deep Research (real GitHub-API data) ----
  if (p === '/api/research') {
    const r = await deepResearch.research(url.searchParams.get('q') || '', { perQuery: url.searchParams.get('per') });
    return send(res, r.ok ? 200 : 400, 'application/json', JSON.stringify(r, null, 2)), true;
  }
  if (p === '/api/research/export') {
    const r = await deepResearch.research(url.searchParams.get('q') || '', {});
    if (!r.ok) return send(res, 400, 'application/json', JSON.stringify(r)), true;
    return send(res, 200, 'text/markdown; charset=utf-8', deepResearch.toMarkdown(r),
      { 'Content-Disposition': 'attachment; filename="aura-research-' + (r.topic || 'topic').replace(/[^a-z0-9]+/gi, '_').slice(0, 40) + '.md"' }), true;
  }

  // ---- Area 63: SEO Center + technical files ----
  if (p === '/api/seo') return send(res, 200, 'application/json', JSON.stringify(seo.auditAll(), null, 2)), true;
  if (p === '/sitemap.xml') return send(res, 200, 'application/xml', seo.sitemap(req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] + '://' + req.headers.host : 'http://' + req.headers.host)), true;
  if (p === '/robots.txt') return send(res, 200, 'text/plain', seo.robots('http://' + req.headers.host)), true;

  // ---- Area 64: backup vault (verified snapshots + restore) ----
  if (p === '/api/backups' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(watcher.backups(), null, 2)), true;
  if (p === '/api/backups/restore' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(watcher.restore(body.file))), true;
  }

  // ---- Area 65: honest traffic telemetry ----
  if (p === '/api/traffic') return send(res, 200, 'application/json', JSON.stringify(traffic.report(), null, 2)), true;

  // ---- Area 66: massive logging + self-repair ----
  if (p === '/api/logs') {
    const n = Number(url.searchParams.get('n')) || 100;
    const level = url.searchParams.get('level') || '';
    return send(res, 200, 'application/json', JSON.stringify({ mode: 'LIVE', level: level || 'ALL', lines: selfRepair.tail(n, level || undefined) }, null, 2)), true;
  }
  if (p === '/api/selfrepair' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(selfRepair.report(), null, 2)), true;
  if (p === '/api/selfrepair/run' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(selfRepair.runChecks(), null, 2)), true;
  if (p === '/api/selfrepair/drill' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(selfRepair.actions.simulate_error(), null, 2)), true;

  // ---- Area 67: module containers (crash isolation) ----
  if (p === '/api/containers' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(containers.status(), null, 2)), true;
  if (p === '/api/containers/drill' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(containers.drill(String(body.area || '16'), body), null, 2)), true;
  }

  // ---- Area 70: central module system (manifest loader + lifecycle) ----
  if (p === '/api/modulehub' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.status(), null, 2)), true;
  if (p === '/api/modulehub/catalog' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.actions.catalog(), null, 2)), true;
  if (p === '/api/modulehub/scan' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.scan(), null, 2)), true;
  const mh = p.match(/^\/api\/modulehub\/([a-z0-9_-]+)\/(approve|enable|disable|health)$/i);
  if (mh) {
    const id = mh[1].toLowerCase(), op = mh[2].toLowerCase();
    let body = {};
    if (req.method === 'POST') { try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; } }
    if (op === 'approve') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.approve(id, body.on), null, 2)), true;
    if (op === 'enable') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.enable(id), null, 2)), true;
    if (op === 'disable') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.disable(id), null, 2)), true;
    return send(res, 200, 'application/json', JSON.stringify(moduleSystem.health(id), null, 2)), true;
  }
  const mhc = p.match(/^\/api\/modulehub\/([a-z0-9_-]+)\/(config|execute)$/i);
  if (mhc) {
    const id = mhc[1].toLowerCase(), op = mhc[2].toLowerCase();
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    if (op === 'config') {
      const r = moduleSystem.configure(id, body.values || body);
      return send(res, r.ok ? 200 : 400, 'application/json', JSON.stringify(r, null, 2)), true;
    }
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — module execution locked' })), true;
    const r = await moduleSystem.execute(id, String(body.action || 'status'), body.input || {});
    return send(res, r.ok ? 200 : (r.fails >= 3 ? 429 : 500), 'application/json', JSON.stringify(r, null, 2)), true;
  }

  // ---- Area 68: global config ----
  if (p === '/api/config/schema') return send(res, 200, 'application/json', JSON.stringify(config.schema(), null, 2)), true;
  if (p === '/api/config' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ file: config.file, config: config.current() }, null, 2)), true;
  if (p === '/api/config' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })), true; }
    const r = config.set(body);
    return send(res, r.ok ? 200 : 400, 'application/json', JSON.stringify(r, null, 2)), true;
  }
  if (p === '/api/config/reset' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(config.reset(), null, 2)), true;

  // ---- AURA Infrastructure Control Room: local inventory, never remote execution ----
  if (p === '/api/cluster/status') return send(res, 200, 'application/json', JSON.stringify(clusterControl.status(), null, 2)), true;
  if (p === '/api/cluster/preflight') return send(res, 200, 'application/json', JSON.stringify(clusterControl.preflight(), null, 2)), true;
  if (p === '/api/cluster/handoff') return send(res, 200, 'application/json', JSON.stringify(clusterControl.handoff(), null, 2)), true;
  if (p === '/api/cluster/core' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(clusterControl.configureCore(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/cluster/arms' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 3e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(clusterControl.addArm(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  const clusterArm = p.match(/^\/api\/cluster\/arms\/([a-z0-9-]+)\/(pool|remove)$/i);
  if (clusterArm && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { const out = clusterArm[2] === 'pool' ? clusterControl.setArmPool(clusterArm[1], body) : clusterControl.removeArm(clusterArm[1], body); return send(res, 200, 'application/json', JSON.stringify(out, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---- Hermes future bridge: planning manifest only, no installation or connection ----
  if (p === '/api/hermes-bridge/status') return send(res, 200, 'application/json', JSON.stringify(hermesBridge.status(), null, 2)), true;
  if (p === '/api/hermes-bridge/preflight') return send(res, 200, 'application/json', JSON.stringify(hermesBridge.preflight(), null, 2)), true;

  // ---- Admin Copilot: local Ollama conversation for the project owner ----
  if (p === '/api/admin-copilot/status') return send(res, 200, 'application/json', JSON.stringify(await adminCopilot.status(), null, 2)), true;
  if (p === '/api/admin-copilot/model' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(adminCopilot.setModel(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/admin-copilot/chat' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { const out = await adminCopilot.chat(body); return send(res, out.ok === false ? 409 : 200, 'application/json', JSON.stringify(out, null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---- AURA OS Intelligence (deterministic local operating briefings) ----
  if (p === '/api/jarvis' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(jarvis.ask(body.msg || body.q || body.text || body.message || ''), null, 2)), true;
  }
  if (p === '/api/jarvis/memory') return send(res, 200, 'application/json', JSON.stringify(jarvis.memory(), null, 2)), true;

  // ---- Area 69: recursive learning core (max 1 failure per fingerprint) ----
  if (p === '/api/learning' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(learningCore.curve(), null, 2)), true;
  if (p === '/api/learning/simulate' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(learningCore.actions.simulate(), null, 2)), true;
  if (p === '/api/learning/outcome' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(learningCore.reportOutcome(String(body.fingerprint || ''), body.ok !== false), null, 2)), true;
  }

  // ---------- hierarchy / vita ----------
  if (p === '/api/hierarchy') return send(res, 200, 'application/json', JSON.stringify(hierarchy.tree(), null, 2)), true;
  if (p === '/api/hierarchy/knowledge') return send(res, 200, 'application/json', JSON.stringify(hierarchy.knowledge(), null, 2)), true;
  let m2 = p.match(/^\/api\/hierarchy\/([a-z0-9_]+)\/bundle$/);
  if (m2) { const b = hierarchy.bundle(m2[1]); return b ? (send(res, 200, 'application/json', JSON.stringify(b, null, 2)), true) : (send(res, 404, 'application/json', JSON.stringify({ error: 'unknown node' })), true); }
  m2 = p.match(/^\/api\/hierarchy\/([a-z0-9_]+)\/stats$/);
  if (m2) return send(res, 200, 'application/json', JSON.stringify(hierarchy.stats(m2[1]), null, 2)), true;
  m2 = p.match(/^\/api\/hierarchy\/([a-z0-9_]+)\/feedback$/);
  if (m2 && req.method === 'POST') {
    const raw = await readBody(req); let body;
    try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })), true; }
    const r = hierarchy.recordFeedback(m2[1], body);
    return r ? (send(res, 200, 'application/json', JSON.stringify(r)), true) : (send(res, 404, 'application/json', JSON.stringify({ error: 'unknown node' })), true);
  }
  if (p === '/api/vita' && req.method !== 'POST') return send(res, 200, 'application/json', JSON.stringify(hierarchy.vitaList(), null, 2)), true;
  if (p === '/api/vita' && req.method === 'POST') {
    const raw = await readBody(req); let body;
    try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(hierarchy.vitaAdd(body))), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })), true; }
  }
  m2 = p.match(/^\/api\/vita\/([a-z0-9-]+)$/);
  if (m2 && req.method === 'DELETE') return send(res, 200, 'application/json', JSON.stringify(hierarchy.vitaDelete(m2[1]))), true;

  // ---------- ops: kill switch, scheduler, telegram, mail ----------
  if (p === '/api/ops') return send(res, 200, 'application/json', JSON.stringify(ops.status(), null, 2)), true;
  if (p === '/api/ops/super' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(ops.runSuper() || { ok: true })), true;
  if (p === '/api/ops/others' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(ops.runOthers() || { ok: true })), true;
  if (p === '/api/ops/sync' && req.method === 'POST') return send(res, 200, 'application/json', JSON.stringify(ops.runFullSync() || { ok: true })), true;
  if (p === '/api/kill' && req.method === 'POST') {
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    return send(res, 200, 'application/json', JSON.stringify(body.arm ? ops.kill(body.reason) : ops.revive(body.reason))), true;
  }
  if (p === '/api/ops/restart' && req.method === 'POST') {
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    if (body.confirm !== 'RESTART') return send(res, 400, 'application/json', JSON.stringify({ requires_confirmation: true, warning: '⚠ Server wird neu gestartet. Bestätige mit {"confirm":"RESTART"}.' })), true;
    const out = ops.restartNow(body.reason);
    return send(res, 200, 'application/json', JSON.stringify({ ok: true, restarting: true, note: 'Neustart eingeleitet — Antwort wird gesendet, dann übernimmt der Nachfolger.', ops: out })), true;
  }
  if (p === '/api/telegram/kit') return send(res, 200, 'application/json', JSON.stringify(ops.telegramKit(), null, 2)), true;
  if (p === '/api/mail') return send(res, 200, 'application/json', JSON.stringify(mail.list(), null, 2)), true;
  if (p === '/api/mail/compose' && req.method === 'POST') {
    const raw = await readBody(req); let body;
    try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(mail.compose(body))), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })), true; }
  }
  if (p === '/api/mail/approve' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    try { return send(res, 200, 'application/json', JSON.stringify(mail.approve(String(body.id)))), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })), true; }
  }

  // ---------- config upload (easy update system) ----------
  if (p === '/api/config/upload' && req.method === 'POST') {
    const raw = await readBody(req); let body;
    try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON — upload must be a JSON file' })), true; }
    const T = { yellowpages: (c) => Array.isArray(c.links), departments: (c) => Array.isArray(c.departments), teams: (c) => Array.isArray(c.teams), skills: (c) => Array.isArray(c.skills) };
    if (!T[body.target] || !T[body.target](body.config || {})) return send(res, 400, 'application/json', JSON.stringify({ error: 'target must be one of ' + Object.keys(T).join('/') + ' with a valid shape' })), true;
    const file = path.join(DATA, body.target + '.json');
    const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    const next = { ...cur, ...body.config, schema_version: (cur.schema_version || 1), updated_at: new Date().toISOString(), via: 'config-upload' };
    fs.writeFileSync(file + '.tmp', JSON.stringify(next, null, 2)); fs.renameSync(file + '.tmp', file);
    store.audit({ area: 'CFG', event: 'config_uploaded', target: body.target });
    return send(res, 200, 'application/json', JSON.stringify({ ok: true, target: body.target, note: 'yellowpages/teams apply immediately; departments/skills apply on restart' })), true;
  }

  // ---------- sandboxed inbound terminal ----------
  if (p === '/api/terminal' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED — terminal locked' })), true;
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    const cmd = String(body.cmd || '').trim();
    if (!cmd || cmd.length > 500) return send(res, 400, 'application/json', JSON.stringify({ error: 'command required (<=500 chars)' })), true;
    store.audit({ area: 'TERM', event: 'exec', cmd: cmd.slice(0, 200) });
    return await new Promise((resolve) => {
      execFile('bash', ['-c', cmd], { cwd: ROOT, timeout: 5000, maxBuffer: 1e6 }, (err, stdout, stderr) => {
        resolve((send(res, 200, 'application/json', JSON.stringify({ out: stdout.slice(0, 8000), err: (stderr || '').slice(0, 2000), error: err && err.killed ? 'timeout (5s)' : err ? err.message.slice(0, 200) : null })), true));
      });
    });
  }

  // ---------- ultra brain chat ----------
  if (p === '/api/ultra/chat' && req.method === 'POST') {
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    return send(res, 200, 'application/json', JSON.stringify({ answer: ultraChat.ask(body.msg) })), true;
  }

  // ---------- schedule + watcher + ignition ----------
  if (p === '/api/schedule') return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.list(), null, 2)), true;
  if (p === '/api/schedule/add' && req.method === 'POST') {
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.add(body))), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })), true; }
  }
  if (p === '/api/schedule/remove' && req.method === 'POST') {
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.remove(String(body.id)))), true;
  }
  if (p === '/api/schedule/recommend') return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.recommend(), null, 2)), true;
  if (p === '/api/schedule/csv') return send(res, 200, 'text/csv; charset=utf-8', registry.get('60').mod.csv(), { 'Content-Disposition': 'attachment; filename="aura-schedule.csv"' }), true;
  if (p === '/api/watcher') return send(res, 200, 'application/json', JSON.stringify(watcher.status(), null, 2)), true;
  if (p === '/api/ignition') {
    const a = store.get().audit;
    const byArea = {};
    for (const e of a) byArea[e.area] = (byArea[e.area] || 0) + 1;
    const yp = yellowPages.legacyView();
    const curve = registry.get('49').mod.learning().curve.map((c) => c.success_rate);
    const c = registry.counts();
    return send(res, 200, 'application/json', JSON.stringify({
      counts: c,
      roles: registry.skills.roles().length,
      teams: teams.teams.length,
      workflows: registry.skills.workflows().length,
      yellowpages: { total: yp.links.length, blocked: yp.links.filter((l) => l.status === 'blocked').length, review: yp.links.filter((l) => l.status === 'review').length },
      ops: ops.status(),
      catalog: [
        { path: '/', name: 'Command Center UI', desc: 'original AURA interface', status: 'LIVE', h: 'ok' },
        { path: '/hub', name: 'Multi-Screen Hub', desc: '3D brain · Matrix · JARVIS · Command', status: 'LIVE', h: 'ok' },
        { path: '/brain', name: 'Brain 2.0', desc: '5-dimensional radial layout', status: 'LIVE', h: 'ok' },
        { path: '/master', name: 'Master HUD', desc: 'living control grid', status: 'LIVE', h: 'ok' },
        { path: '/hierarchy', name: 'Brain Hierarchy', desc: 'ultra→super→heads→minions + chat', status: 'LIVE', h: 'ok' },
        { path: '/console', name: 'Console', desc: '60-area registry', status: 'LIVE', h: 'ok' },
        { path: '/skills', name: 'Skill DB', desc: 'skills · 63 roles · prompts', status: 'LIVE', h: 'ok' },
        { path: '/pipelines', name: 'Pipelines', desc: 'WF-1…WF-8 + social chain', status: 'LIVE', h: 'ok' },
        { path: '/builder', name: 'Workflow Builder', desc: 'roles → chain → gates → JSON → sim', status: 'LIVE', h: 'ok' },
        { path: '/research', name: 'Deep Research', desc: 'live GitHub-API fan-out, star-ranked', status: 'LIVE', h: 'ok' },
        { path: '/seo', name: 'SEO Center', desc: 'on-site audit + sitemap + robots', status: 'LIVE', h: 'ok' },
        { path: '/cluster', name: 'Root-Server Collective', desc: 'k3s kit ready · servers pending', status: 'NOT-CONN', h: 'warn' },
        { path: '/yellowpages', name: 'Yellow Pages (Area 19)', desc: yp.links.length + ' Einträge · admin CRUD + Brain-Feed', status: 'LIVE', h: 'ok' },
        { path: '/models', name: 'Model Bay (Area 79)', desc: 'offene Modelle · Suche · custom · Test-Konsole · Keys', status: 'LIVE', h: 'ok' },
        { path: '/grid', name: 'Mission Grid (Areas 09–40)', desc: '19 ausgebaute Live-Module auf einem Screen', status: 'LIVE', h: 'ok' },
        { path: '/deploy', name: 'Deploy', desc: 'HF · Ollama · repo kits · MCP', status: 'LIVE', h: 'ok' },
        { path: '/ops', name: 'OPS Control', desc: 'kill switch · backups · telegram · mail', status: 'LIVE', h: 'ok' },
        { path: '/logs', name: 'Logs & Self-Repair', desc: 'JSONL logs · rotation · auto-heal ledger', status: 'LIVE', h: 'ok' },
        { path: '/containers', name: 'Module Containers', desc: 'crash isolation · circuit breaker · quarantine', status: 'LIVE', h: 'ok' },
        { path: '/containers', name: 'Module Hub (Area 70)', desc: 'manifest loader · lifecycle · permissions · approval gate', status: 'LIVE', h: 'ok' },
        { path: '/imagegen', name: 'Image Generation Gateway (Area 71)', desc: 'ComfyUI + WebUI clients · honest SIM fallback', status: 'LIVE', h: 'ok' },
        { path: '/mcp', name: 'MCP Manager (Area 72)', desc: 'AURA as MCP server + user server add/install/uninstall/usage', status: 'LIVE', h: 'ok' },
        { path: '/forge', name: 'Content Forge (Area 73)', desc: 'minion automation · human-gated publishing', status: 'LIVE', h: 'ok' },
        { path: '/forge', name: 'Service Fabric (Area 74)', desc: 'self-installable services + system modes', status: 'LIVE', h: 'ok' },
        { path: '/control', name: 'Routine & Link Control (Area 75)', desc: 'toggle on/off aller Kern-/Gehirn-Routinen + parallele Links', status: 'LIVE', h: 'ok' },
        { path: '/studio', name: 'Creative Studio Suite (Area 76)', desc: '7 real generator studios far beyond kids books', status: 'LIVE', h: 'ok' },
        { path: '/control', name: 'Test Lab (Area 77)', desc: 'admin force-run + expect-failure view', status: 'LIVE', h: 'ok' },
        { path: '/control', name: 'Telegram Agent (Area 78)', desc: 'official Bot API · allowlisted commands · honest probe', status: 'LIVE', h: 'ok' },
        { path: '/tower', name: 'Ollama Manager (Area 79)', desc: 'curated model catalog · honest probe · install script', status: 'LIVE', h: 'ok' },
        { path: '/tower', name: 'Brain Role Mapper (Area 80)', desc: 'agent ↔ Ultra/Super/Head/Minion roles', status: 'LIVE', h: 'ok' },
        { path: '/tower', name: 'Control Tower (Area 81)', desc: 'admin directives + fault ack · safety floor', status: 'LIVE', h: 'ok' },
        { path: '/tower', name: 'Cross-link Policy (Area 82)', desc: 'allow/restrict new cross-links per module', status: 'LIVE', h: 'ok' },
        { path: '/tower', name: 'Function Registry (Area 83)', desc: 'add/ignore/soft-delete + warning token', status: 'LIVE', h: 'ok' },
        { path: '/intercom', name: 'Agent Intercom (Area 84)', desc: 'Chat Heads/Supers/Ultra · Besprechungen · echte Stimmen', status: 'LIVE', h: 'ok' },
        { path: '/api/harness/status', name: 'Harness-Kit (Area 85)', desc: 'CLAUDE.md/AGENTS.md/Hooks/skill-Bundles mit REGEL 1 · Claude Code & Co.', status: 'LIVE', h: 'ok' },
        { path: '/config', name: 'Config', desc: 'global config · hot-reload · schema-validated', status: 'LIVE', h: 'ok' },
        { path: '/jarvis', name: 'AURA Admin Copilot', desc: 'local Ollama owner conversation · workflow shortcuts · no action tools', status: 'LOCAL-MODEL', h: 'ok' },
        { path: '/aura-os#intelligence', name: 'AURA OS Intelligence', desc: 'deterministic local operating briefings embedded in AURA OS', status: 'LIVE', h: 'ok' },
        { path: '/schedule', name: 'Schedule', desc: 'who where when', status: 'LIVE', h: 'ok' },
        { path: '/terminal', name: 'Terminal', desc: 'sandboxed inbound shell', status: 'LIVE', h: 'ok' },
        { path: '/minibot', name: 'Mini-Bot Wizard', desc: 'BotFather setup help', status: 'LIVE', h: 'ok' },
        { path: '/arcade', name: 'Arcade', desc: 'mini games (side project)', status: 'LIVE', h: 'ok' },
        { path: '/downloads', name: 'Downloads', desc: 'ALL-TYPES catalogs', status: 'LIVE', h: 'ok' },
        { path: '/api/stream', name: 'SSE Stream', desc: 'minion live stream', status: 'LIVE', h: 'ok' },
      ],
      services: registry.status().filter((m) => m.mode === 'live'),
      charts: {
        audit_by_area: Object.entries(byArea).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => ({ k, v })),
        learning: curve.length ? curve : [1, 1],
        modes: [{ k: 'live', v: c.live }, { k: 'skill', v: c.skills }, { k: 'placeholder', v: c.placeholder }, { k: 'review', v: c.review }, { k: 'restricted', v: c.restricted }],
      },
      feed: store.auditLog().slice(0, 12),
    }, null, 2)), true;
  }

  return false;
}

module.exports = { name: 'api_areas', handle };
