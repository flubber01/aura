'use strict';
// Route module: area-specific APIs (moved verbatim from server.js).

// Admin-Token-Gate (gleiche Logik wie in api_growth_studio.js): ist AURA_ADMIN_TOKEN
// gesetzt, verlangen schreibende Routen den Header x-aura-token. Ohne gesetzten Token
// bleibt der lokale Betrieb unveraendert.
const adminSoft = (req, ctx) => {
  const t = process.env.AURA_ADMIN_TOKEN || '';
  if (!t) return true;                                                        // kein Token konfiguriert: lokaler Betrieb
  if (String(req.headers['x-aura-token'] || '') === t) return true;            // Header-Token stimmt
  return !!(ctx && ctx.actor);                                                // oder angemeldeter Besitzer (/login-Session)
};

const fs = require('fs');
const controlCenter = require('../lib/control_center'); // Steuerzentrale: Aktionsschalter + menschliche Freigaben
const webEmpire = require('../lib/web_empire');
const watchdog = require('../lib/watchdog');
const connectors = require('../lib/connectors');
const songbook = require('../lib/songbook'); // Song-Werkstatt: Prompt→Ton (lokal gerendert) + Varianten/Stems
const artists = require('../lib/artist_accounts');
const videoStudio = require('../lib/video_studio'); // Video-Effektketten (ffmpeg)
const resources = require('../lib/resources');
const campaignPlanner = require('../lib/campaign_planner'); // Kampagnen-Planer: Pitch → Release → Pipelines
const calendarLib = require('../lib/calendar'); // Kalender: Termine aus allen Bereichen + ICS-Export
const handbooks = require('../lib/handbooks'); // Handbücher, aus dem laufenden System erzeugt
const royaltyFree = require('../lib/royalty_free'); // Lizenzfreie/offene Tonquellen mit Lizenzprüfung
const dawPlugins = require('../lib/daw_plugins'); // Tonstudio-Plug-ins: Kette, Parameter, Kriterien
const speech = require('../lib/speech'); // Sprachfunktion: Sprechen/Hören, Motoren ehrlich geprüft
const videoDepartment = require('../lib/video_department'); // Video-Abteilung: nur Video, mit messbarer Abnahme
const eyes = require('../lib/eyes'); // Augen: Bilder messen, Bildschirm-Ordner ansehen
// ---- Runde 6: Stile · Verteiler · gesprochenes Wort · Duett · Kamera · Effekte · Rohrleitungen · Sicherheit ----
const styles = require('../lib/styles_catalog');            // Stilkatalog: jeder gängige Stil mit Zahlen und Renderer-Zuordnung
const distributors = require('../lib/distributors');        // Verteiler mit originalen Adressen, geraden Wegen und Kennungen
const spoken = require('../lib/spoken_word');               // Podcast, Hörbuch, Audiobibel: Plan, Kapitel, Feed, Tonmessung
const duet = require('../lib/duet');                        // Duett: ausrichten, stimmen, Harmonie, Dopplung, mischen
const camera = require('../lib/camera_director');           // Kamera-Regie: Optik, Bewegung, Schnitt, Licht, Drehplan
const effects = require('../lib/visual_effects');           // Effekte und Specials als geprüfte Filterketten
const pipes = require('../lib/workflow_pipes');             // Alle Rohrleitungen des Hauses
const security = require('../lib/security_center');         // Sicherheit: prüfen, isolieren, entscheiden
const agenticIntro = require('../lib/agentic_intro');       // Intro nach Vorlage: Hirn-Hub, fünf Felder mit laufendem Workflow, Fundament
const milestones = require('../lib/milestones');             // Meilensteine: Zeit, Sessions, Tage, Werke, Klicks
const verbundLib = require('../lib/verbund');                // Verbund: Concat-Repos, Cross-Chain, Montage, n8n-Katalog

// Schutz-Kopfzeilen, die der Server wirklich setzt (siehe backend/server.js).
const securityHeadersForInfo = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self' https:; base-uri 'self'; form-action 'self'",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Resource-Policy': 'same-site',
  note: 'frame-ancestors erlaubt die eigene Vorschau ausdrücklich; über AURA_FRAME_ANCESTORS einschränkbar.',
};
const mediaImport = require('../lib/media_import'); // Medien-Import: Link → Entwurf, Rechte benannt
const agentCalls = require('../lib/agent_calls'); // Agenten rufen Agenten (Tiefe, Sperrliste, Protokoll)
const brainConsole = require('../lib/brain_console'); // Gehirn-Konsole: Mensch spricht mit Gehirn und Köpfen
const humanFinal = require('../lib/human_final'); // Letztes Wort des Menschen als Prüftür
const securityResponse = require('../lib/security_response'); // Erkennen → isolieren → prüfen → ausschließen
const selfCall = require('../lib/self_call'); // Alarmleiter bis zum Anruf beim Menschen
const plugins = require('../lib/plugins'); // Plug-in-System mit Rechten und Register
const avatarStudio = require('../lib/avatar_studio'); // Avatar/Kunstfigur + Podcast + Kurzvideo
const billingPlans = require('../lib/billing_plans'); // Bezahlpläne, Grenzen, Belege
const advertising = require('../lib/advertising'); // Werbeflächen und Kampagnen (ohne Klickkauf)
const hermes = require('../lib/hermes_bridge'); // Hermes: Vertrag + Fähigkeitsschicht (einzeln, befristet) // Katalog freier Werkzeuge und Listen // Artist-Konten mit eigenem Login (Multi-Login, getrennte Sicht) // Anbieter-Anbindung: eigene Kanäle + autorisierte Partner, Keys im Vault // Aufsicht: 3-Strike-Neustart, Sleep-Mode, Live-Uebersicht // Web Empire / Eigene Seiten: Registry, Link-Slots, ehrliche Messwerte
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
const repair = require('../lib/repair');
const learningCore = require('../lib/learning_core');
const moduleSystem = require('../lib/module_system');
const moduleImport = require('../lib/module_import'); // Dritt-Connector: Import + Fehlerfrei-Schleuse (Approve bleibt beim Menschen)
const selfwork = require('../lib/selfwork'); // Selbstbearbeitungs-Werkbank: Vorschlag → Prüfung → dein Klick
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
const support = require('../lib/support');
const contentStore = require('../lib/content_store');
const analytics = require('../lib/analytics_forecast');
const autoMonitor = require('../lib/auto_monitor');
const messenger = require('../lib/artist_messenger');
const userArea = require('../lib/user_area');
const socialLogin = require('../lib/social_login');
const dawDevices = require('../lib/daw_devices');
const uiKit = require('../lib/ui_kit');
const bootIntro = require('../lib/boot_intro');
const siteProjects = require('../lib/site_projects');
const hermesFlow = require('../lib/hermes_process');
const payments = require('../lib/payment_providers');
const i18n = require('../lib/i18n');
const themes = require('../lib/themes');
const branding = require('../lib/branding');
const adEngine = require('../lib/ad_engine');
const sponsor = require('../lib/sponsor');
const referral = require('../lib/referral');
const logs = require('../lib/logs_analytics');
const lyricWriter = require('../lib/lyric_writer');
const musicDepartments = require('../lib/music_departments');
const orchestrator = require('../lib/song_orchestrator');
const newsletter = require('../lib/newsletter');
const legal = require('../lib/legal');
const whitepaper = require('../lib/whitepaper');
const ideaCatalog = require('../lib/idea_catalog');
const flashIntro = require('../lib/flash_intro');
const paymentCheck = require('../lib/payment_validation');
const { dailyReport } = require('../lib/report');

const ROOT = path.join(__dirname, '..', '..', '..');
const DATA = path.join(__dirname, '..', '..', 'data');

async function handle(ctx) {
  const { req, res, url, p, send, readBody, syntaxFail } = ctx;

  // ---------- Area 71: Image Generation Gateway (ComfyUI + WebUI) ----------
  if (p === '/api/imagegen/status') return send(res, 200, 'application/json', JSON.stringify(await imageGen.status(), null, 2)), true;
  if (p === '/api/imagegen/config' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify((await imageGen.status()).config, null, 2)), true;
  if (p === '/api/imagegen/config' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/mcp' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return mcpJsonRpc(); }
  if (p === '/api/mcp/builtin-used' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; await readBody(req, 1e4); return send(res, 200, 'application/json', JSON.stringify({ ok: true })), true; }
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
  if (p === '/api/kids-story' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(kidsStory.generate(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/kids-story/status') return send(res, 200, 'application/json', JSON.stringify(kidsStory.status(), null, 2)), true;
  if (p === '/api/report-daemon') return send(res, 200, 'application/json', JSON.stringify(reportDaemon.status(), null, 2)), true;
  if (p === '/api/report-daemon/enable' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { body = {}; }
    return send(res, 200, 'application/json', JSON.stringify(reportDaemon.setEnabled(body.on !== false), null, 2)), true;
  }
  if (p === '/api/report-daemon/run' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(reportDaemon.runNow(), null, 2)), true; }


  // ---------- Steuerzentrale (control_center): Schalter pro Aktion + Freigaben nur durch Menschen ----------
  // Eigener Pfad (/api/control-center), damit /api/control (Routine-Schalter, Area 75) unveraendert bleibt.
  if (p === '/api/control-center') return send(res, 200, 'application/json', JSON.stringify({
    area: 'CTRL', mode: 'LIVE', human_only: true,
    note: 'Riskante Aktionen erzeugen eine Freigabe; nur ein Mensch entscheidet. Der Kill-Switch sperrt alles.',
    actions: controlCenter.actions(), pending: controlCenter.pending(),
  }, null, 2)), true;

  {
    const ccGate = (res, out) => send(res, out.ok ? 200 : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const ccBy = (body, fallback) => String((body && body.by) || fallback || '').slice(0, 60);
    const ccSwitch = p.match(/^\/api\/control-center\/action\/([a-z_]+)\/(enable|disable)$/);
    if (ccSwitch && req.method === 'POST') {
      if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })), true;
      let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { body = {}; }
      const who = ccBy(body, ctx && ctx.actor && ctx.actor.name) || '';
      return ccGate(res, controlCenter.setEnabled(ccSwitch[1], ccSwitch[2] === 'enable', who)), true;
    }
    const ccRun = p.match(/^\/api\/control-center\/run\/([a-z_]+)$/);
    if (ccRun && req.method === 'POST') {
      if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })), true;
      let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { body = {}; }
      const who = ccBy(body, ctx && ctx.actor && ctx.actor.name) || '';
      const out = controlCenter.gate(ccRun[1], { by: who, args: (body && body.args) || {}, killed: ops.isKilled() });
      return ccGate(res, out), true;
    }
    const ccDecide = p.match(/^\/api\/control-center\/(approve|deny)\/(AP-[a-z0-9]+)$/);
    if (ccDecide && req.method === 'POST') {
      if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })), true;
      let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { body = {}; }
      const who = ccBy(body, ctx && ctx.actor && ctx.actor.name) || '';
      return ccGate(res, controlCenter.decide(ccDecide[2], ccDecide[1] === 'approve' ? 'approve' : 'deny', who)), true;
    }
  }

  // ---------- Web Empire / Eigene Seiten (Erweiterung des Analyseboards, kein zweites Master-Panel) ----------
  // Spez: nur freigegebene eigene/autorisierten Seiten, Rotation nur im freigegebenen Pool,
  // ehrliche Labels LIVE/SIM/NOT-CONNECTED, KEINE automatische Traffic-/Klick-Erzeugung.
  if (p === '/api/web-empire') return send(res, 200, 'application/json', JSON.stringify(webEmpire.status(), null, 2)), true;
  {
    const weSend = (res, out) => {
      const { ok, code, ...rest } = out || {};
      return send(res, ok ? (code || 200) : (code || 400), 'application/json', JSON.stringify(out, null, 2));
    };
    const weBy = (body, ctx) => String((body && body.by) || (ctx && ctx.actor && ctx.actor.name) || '').slice(0, 60);
    const weBody = async (req, limit) => { try { return JSON.parse((await readBody(req, limit || 1e5)) || '{}'); } catch { return {}; } };
    const needAdmin = (req, ctx, res) => {
      if (adminSoft(req, ctx)) return false;
      send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' }));
      return true;
    };

    // Registrierung: erzeugt PENDING + Freigabe (REGEL 1). Fremde Seiten werden abgelehnt.
    if (p === '/api/web-empire/sites/register' && req.method === 'POST') {
      if (needAdmin(req, ctx, res)) return true;
      const body = await weBody(req);
      return weSend(res, webEmpire.registerSite(body, weBy(body, ctx))), true;
    }
    // Freigabe-Entscheidung: nur ein Mensch.
    const weDecide = p.match(/^\/api\/web-empire\/approvals\/(AP-[a-z0-9]+)\/(approve|deny)$/);
    if (weDecide && req.method === 'POST') {
      if (needAdmin(req, ctx, res)) return true;
      const body = await weBody(req);
      return weSend(res, webEmpire.decide(weDecide[1], weDecide[2], weBy(body, ctx))), true;
    }
    if (p === '/api/web-empire/approvals') return send(res, 200, 'application/json', JSON.stringify({ pending: webEmpire.pending() }, null, 2)), true;
    // Seiten-Konfiguration: Module-Flags, genau eine der fuenf Stilvarianten, Blanko-Header/Footer zentral.
    const weUpdate = p.match(/^\/api\/web-empire\/sites\/([a-z0-9._-]+)\/update$/);
    if (weUpdate && req.method === 'POST') {
      if (needAdmin(req, ctx, res)) return true;
      const body = await weBody(req);
      return weSend(res, webEmpire.updateSite(weUpdate[1], body, weBy(body, ctx))), true;
    }
    // Messwerte lesen (ehrliche Labels).
    const weMetrics = p.match(/^\/api\/web-empire\/sites\/([a-z0-9._-]+)\/metrics$/);
    if (weMetrics && req.method === 'GET') return weSend(res, webEmpire.metrics(weMetrics[1])), true;
    // Messwerte einliefern: Auth ist der Seiten-Schluessel (signiert), nicht der Admin-Token.
    if (weMetrics && req.method === 'POST') {
      const body = await weBody(req, 1e6);
      const key = String((body && body.key) || req.headers['x-aura-site-key'] || '');
      return weSend(res, webEmpire.ingest(weMetrics[1], key, body, body && body.signature)), true;
    }
    // Slots: anlegen, Pool vorschlagen (Freigabe), ausliefern, Health setzen.
    if (p === '/api/web-empire/slots/add' && req.method === 'POST') {
      if (needAdmin(req, ctx, res)) return true;
      const body = await weBody(req);
      return weSend(res, webEmpire.addSlot(body, weBy(body, ctx))), true;
    }
    const wePool = p.match(/^\/api\/web-empire\/slots\/([A-Za-z0-9_]{3,48})\/pool$/);
    if (wePool && req.method === 'POST') {
      if (needAdmin(req, ctx, res)) return true;
      const body = await weBody(req);
      return weSend(res, webEmpire.setPool(wePool[1].toUpperCase(), body.pool, weBy(body, ctx))), true;
    }
    const weResolve = p.match(/^\/api\/web-empire\/slots\/([A-Za-z0-9_]{3,48})\/resolve$/);
    if (weResolve && req.method === 'GET') return weSend(res, webEmpire.resolveSlot(weResolve[1].toUpperCase(), ctx && ctx.actor && ctx.actor.name)), true;
    const weHealth = p.match(/^\/api\/web-empire\/slots\/([A-Za-z0-9_]{3,48})\/health$/);
    if (weHealth && req.method === 'POST') {
      if (needAdmin(req, ctx, res)) return true;
      const body = await weBody(req);
      return weSend(res, webEmpire.markHealth(weHealth[1].toUpperCase(), body.partner, body.up !== false, weBy(body, ctx))), true;
    }
  }

  // ---------- Watchdog: Dienst-Aufsicht (3-Strike, Sleep-Mode, Live-Uebersicht) ----------
  // Startet eigene Dienste neu. Erzeugt keinen Traffic, kein Engagement, ueberwacht keine fremden Systeme.
  if (p === '/api/watchdog') return send(res, 200, 'application/json', JSON.stringify(watchdog.status(), null, 2)), true;
  if (p === '/api/watchdog/preflight') return send(res, 200, 'application/json', JSON.stringify(watchdog.preflight(), null, 2)), true;
  {
    const wdSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const wdBy = (body, ctx) => String((body && body.by) || (ctx && ctx.actor && ctx.actor.name) || '').slice(0, 60);
    const wdBody = async (req) => { try { return JSON.parse((await readBody(req, 1e4)) || '{}'); } catch { return {}; } };
    const wdGuard = (req, ctx, res) => {
      if (adminSoft(req, ctx)) return false;
      send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' }));
      return true;
    };
    const wdAct = p.match(/^\/api\/watchdog\/service\/([a-z0-9-]{2,48})\/(start|stop|revive|beat)$/);
    if (wdAct && req.method === 'POST') {
      if (wdGuard(req, ctx, res)) return true;
      const body = await wdBody(req);
      const who = wdBy(body, ctx);
      const name = wdAct[1];
      if (wdAct[2] === 'start') return wdSend(res, watchdog.startService(name, { by: who })), true;
      if (wdAct[2] === 'stop') return wdSend(res, watchdog.stopService(name, who)), true;
      if (wdAct[2] === 'revive') return wdSend(res, watchdog.revive(name, who)), true;
      return wdSend(res, watchdog.beat(name, body.note)), true;
    }
    if (p === '/api/watchdog/sleep' && req.method === 'POST') {
      if (wdGuard(req, ctx, res)) return true;
      const body = await wdBody(req);
      return wdSend(res, watchdog.sleep(body.reason, wdBy(body, ctx))), true;
    }
    if (p === '/api/watchdog/wake' && req.method === 'POST') {
      if (wdGuard(req, ctx, res)) return true;
      const body = await wdBody(req);
      return wdSend(res, watchdog.wake(wdBy(body, ctx))), true;
    }
    // Absturz melden (z. B. von einem Dienst selbst): zaehlt Strikes und startet ggf. neu.
    if (p === '/api/watchdog/report' && req.method === 'POST') {
      if (wdGuard(req, ctx, res)) return true;
      const body = await wdBody(req);
      const name = String((body && body.name) || '');
      if (!name) return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'name fehlt' })), true;
      return wdSend(res, watchdog.crash(name, new Error(String((body && body.error) || 'gemeldeter Fehler')), { by: wdBy(body, ctx) })), true;
    }
  }

  // ---------- Connectoren: eigene Kanäle + autorisierte Partner über offizielle APIs ----------
  // Schlüssel liegen nur verschlüsselt im Vault und erscheinen in keiner Ausgabe.
  // Veröffentlichen ist Freigabe-pflichtig (REGEL 1). Anbieter, die Engagement verkaufen, sind gesperrt.
  if (p === '/api/connectors') return send(res, 200, 'application/json', JSON.stringify(connectors.list(), null, 2)), true;
  if (p === '/api/connectors/status') return send(res, 200, 'application/json', JSON.stringify(connectors.status(), null, 2)), true;
  if (p === '/api/connectors/assess') {
    const q = (url.searchParams.get('provider') || '');
    return send(res, 200, 'application/json', JSON.stringify(connectors.assessProvider(q), null, 2)), true;
  }
  {
    const coSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const coBy = (body, ctx) => String((body && body.by) || (ctx && ctx.actor && ctx.actor.name) || '').slice(0, 60);
    const coBody = async (req, limit) => { try { return JSON.parse((await readBody(req, limit || 2e5)) || '{}'); } catch { return {}; } };
    const coGuard = (req, ctx, res) => {
      if (adminSoft(req, ctx)) return false;
      send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' }));
      return true;
    };
    const coAct = p.match(/^\/api\/connectors\/([a-z0-9-]{2,40})\/(connect|disconnect|test|publish)$/);
    if (coAct && req.method === 'POST') {
      if (coGuard(req, ctx, res)) return true;
      const body = await coBody(req);
      const who = coBy(body, ctx);
      const id = coAct[1];
      if (coAct[2] === 'connect') return coSend(res, connectors.connect(id, body.keys || {}, who)), true;
      if (coAct[2] === 'disconnect') return coSend(res, connectors.disconnect(id, who)), true;
      if (coAct[2] === 'test') return coSend(res, connectors.test(id, who)), true;
      return coSend(res, connectors.requestPublish(id, body.payload || {}, who)), true;
    }
  }

  // ---------- Songbook: Song-Werkstatt (lokaler Ton + KI über eigenen Schlüssel) ----------
  if (p === '/api/songbook') return send(res, 200, 'application/json', JSON.stringify(songbook.list(url.searchParams.get('artist') ? { artist: url.searchParams.get('artist') } : {}), null, 2)), true;
  if (p === '/api/songbook/status') return send(res, 200, 'application/json', JSON.stringify(songbook.status(), null, 2)), true;
  if (p === '/api/music/render/info') return send(res, 200, 'application/json', JSON.stringify(require('../lib/music_render').info(), null, 2)), true;
  {
    const sbSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const sbBy = (body, ctx) => String((body && body.by) || (ctx && ctx.actor && ctx.actor.name) || '').slice(0, 60);
    const sbBody = async (req, limit) => { try { return JSON.parse((await readBody(req, limit || 1e5)) || '{}'); } catch { return {}; } };
    const sbGuard = (req, ctx, res) => {
      if (adminSoft(req, ctx)) return false;
      send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' }));
      return true;
    };
    if (p === '/api/songbook/create' && req.method === 'POST') {
      if (sbGuard(req, ctx, res)) return true;
      const body = await sbBody(req);
      return sbSend(res, songbook.create(body, sbBy(body, ctx))), true;
    }
    const sbAct = p.match(/^\/api\/songbook\/(song-[a-f0-9]{8})\/(render|variations|extend|stems|lyrics|status)$/);
    if (sbAct && req.method === 'POST') {
      if (sbGuard(req, ctx, res)) return true;
      const body = await sbBody(req);
      const who = sbBy(body, ctx);
      if (sbAct[2] === 'render') return sbSend(res, songbook.render(sbAct[1], who)), true;
      if (sbAct[2] === 'variations') return sbSend(res, songbook.variations(sbAct[1], body.count, who)), true;
      if (sbAct[2] === 'extend') return sbSend(res, songbook.extend(sbAct[1], body.bars, who)), true;
      if (sbAct[2] === 'stems') return sbSend(res, songbook.stems(sbAct[1], who)), true;
      if (sbAct[2] === 'lyrics') return sbSend(res, songbook.lyrics(sbAct[1], body.lyrics || body.text, who)), true;
      return sbSend(res, songbook.setStatus(sbAct[1], body.status, who)), true;
    }
    if (p === '/api/songbook/playlist/add' && req.method === 'POST') {
      if (sbGuard(req, ctx, res)) return true;
      const body = await sbBody(req);
      return sbSend(res, songbook.playlistAdd(body.name, body.songs, sbBy(body, ctx))), true;
    }
    // Audio ausliefern (nur aus dem Ausgabeverzeichnis — kein Pfad-Durchgriff)
    const mxFile = p.match(/^\/api\/music\/audio\/(mx-[a-f0-9]{8}(?:\.[a-z]+)?\.wav)$/);
    if (mxFile && req.method === 'GET') {
      const mr = require('../lib/music_render');
      const file = path.join(mr.OUT_DIR, mxFile[1]);
      if (!fs.existsSync(file)) return send(res, 404, 'application/json', JSON.stringify({ error: 'Datei nicht gefunden' })), true;
      const st = fs.statSync(file);
      res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': st.size, 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
      return true;
    }
  }

  // ---------- Artist-Konten: eigener Login je Künstler, getrennte Sicht (Multi-Login) ----------
  if (p === '/api/artists') return send(res, 200, 'application/json', JSON.stringify(artists.status(), null, 2)), true;
  if (p === '/api/artists/sessions') return send(res, 200, 'application/json', JSON.stringify(artists.sessionList(), null, 2)), true;
  {
    const arSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const arBody = async (req, limit) => { try { return JSON.parse((await readBody(req, limit || 5e4)) || '{}'); } catch { return {}; } };
    const arGuard = (req, ctx, res) => {
      if (adminSoft(req, ctx)) return false;
      send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' }));
      return true;
    };
    if (p === '/api/artists/create' && req.method === 'POST') {
      if (arGuard(req, ctx, res)) return true;
      const body = await arBody(req);
      return arSend(res, artists.createArtist(body, String(body.by || ''))), true;
    }
    if (p === '/api/artists/login' && req.method === 'POST') {
      const body = await arBody(req);
      return arSend(res, artists.login(body.artist || body.id, body.password, { ip: (req.socket && req.socket.remoteAddress) || '' })), true;
    }
    if (p === '/api/artists/logout' && req.method === 'POST') {
      const body = await arBody(req);
      return arSend(res, artists.logout(String(body.token || req.headers['x-aura-artist-token'] || ''), body.by)), true;
    }
    if (p === '/api/artists/whoami') {
      const t = String((url.searchParams.get('token') || req.headers['x-aura-artist-token'] || ''));
      return arSend(res, artists.whoami(t)), true;
    }
    const arView = p.match(/^\/api\/artists\/([a-z0-9._-]{3,40})\/view$/);
    if (arView) {
      const t = String((url.searchParams.get('token') || req.headers['x-aura-artist-token'] || ''));
      const me = artists.whoami(t);
      const who = me.ok ? me.artist.id : '';
      return arSend(res, artists.view(arView[1], who)), true;
    }
    const arCh = p.match(/^\/api\/artists\/([a-z0-9._-]{3,40})\/channels\/link$/);
    if (arCh && req.method === 'POST') {
      if (arGuard(req, ctx, res)) return true;
      const body = await arBody(req);
      return arSend(res, artists.linkChannel(arCh[1], body, String(body.by || ''))), true;
    }
    const arPw = p.match(/^\/api\/artists\/([a-z0-9._-]{3,40})\/password$/);
    if (arPw && req.method === 'POST') {
      if (arGuard(req, ctx, res)) return true;
      const body = await arBody(req);
      return arSend(res, artists.resetPassword(arPw[1], body.password, String(body.by || ''))), true;
    }
    if (p === '/api/artists/sessions/kill' && req.method === 'POST') {
      if (arGuard(req, ctx, res)) return true;
      const body = await arBody(req);
      return arSend(res, artists.killSession(body.artist, String(body.by || ''))), true;
    }
  }

  // ---------- Video-Werkstatt: Effekt-Ketten auf ffmpeg ----------
  if (p === '/api/video/status') return send(res, 200, 'application/json', JSON.stringify(videoStudio.status(), null, 2)), true;
  if (p === '/api/video/effects') return send(res, 200, 'application/json', JSON.stringify({ ok: true, effects: videoStudio.effects(), ffmpeg: videoStudio.ffmpegStatus() }, null, 2)), true;
  {
    const vsSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const vsBody = async (req, limit) => { try { return JSON.parse((await readBody(req, limit || 5e4)) || '{}'); } catch { return {}; } };
    const vsGuard = (req, ctx, res) => {
      if (adminSoft(req, ctx)) return false;
      send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' }));
      return true;
    };
    if (p === '/api/video/preview' && req.method === 'GET') {
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, effects: videoStudio.effects(), ffmpeg: videoStudio.ffmpegStatus(), note: 'POST mit {input, effects:[...]} liefert die fertige Filterkette und den Befehl.' }, null, 2)), true;
    }
    if (p === '/api/video/preview' && req.method === 'POST') {
      const body = await vsBody(req);
      return vsSend(res, videoStudio.preview(body)), true;
    }
    if (p === '/api/video/jobs' && req.method === 'POST') {
      if (vsGuard(req, ctx, res)) return true;
      const body = await vsBody(req);
      return vsSend(res, videoStudio.createJob(body, String(body.by || (ctx && ctx.actor && ctx.actor.name) || ''))), true;
    }
    const vjRun = p.match(/^\/api\/video\/jobs\/(vj-[a-f0-9]{8})\/run$/);
    if (vjRun && req.method === 'POST') {
      if (vsGuard(req, ctx, res)) return true;
      const body = await vsBody(req);
      const out = await videoStudio.run(vjRun[1], String(body.by || ''));
      return vsSend(res, out), true;
    }
  }

  // ---------- Ressourcen-Katalog (Nachschlagewerk, installiert nichts) ----------
  if (p === '/api/resources') {
    const q = url.searchParams;
    return send(res, 200, 'application/json', JSON.stringify(resources.list({ cat: q.get('cat'), q: q.get('q') }), null, 2)), true;
  }
  if (p === '/api/resources/status') return send(res, 200, 'application/json', JSON.stringify(resources.status(), null, 2)), true;
  if (p === '/api/resources/assess') return send(res, 200, 'application/json', JSON.stringify(resources.assess(url.searchParams.get('item') || url.searchParams.get('url') || ''), null, 2)), true;

  // ---------- Kampagnen-Planer, Kalender, Handbücher ----------
  if (p === '/api/campaigns/status') return send(res, 200, 'application/json', JSON.stringify(campaignPlanner.status(), null, 2)), true;
  if (p === '/api/campaigns/board') return send(res, 200, 'application/json', JSON.stringify(campaignPlanner.releaseBoard(), null, 2)), true;
  if (p === '/api/campaigns/list') return send(res, 200, 'application/json', JSON.stringify(campaignPlanner.list({ artist: url.searchParams.get('artist'), state: url.searchParams.get('state') }), null, 2)), true;
  if (p === '/api/campaigns/plan') {
    const out = campaignPlanner.plan(url.searchParams.get('id'));
    return send(res, out.ok ? 200 : 404, 'application/json', JSON.stringify(out, null, 2)), true;
  }
  if (p === '/api/calendar/status') return send(res, 200, 'application/json', JSON.stringify(calendarLib.status(), null, 2)), true;
  if (p === '/api/calendar') {
    const out = calendarLib.events(url.searchParams.get('from'), Number(url.searchParams.get('days')) || 30);
    return send(res, 200, 'application/json', JSON.stringify(out, null, 2)), true;
  }
  if (p === '/api/calendar/conflicts') return send(res, 200, 'application/json', JSON.stringify(calendarLib.conflicts(url.searchParams.get('from'), Number(url.searchParams.get('days')) || 30), null, 2)), true;
  if (p === '/api/calendar/ics') return send(res, 200, 'text/calendar; charset=utf-8', calendarLib.ics(url.searchParams.get('from'), Number(url.searchParams.get('days')) || 60)), true;
  if (p === '/api/handbooks/status') return send(res, 200, 'application/json', JSON.stringify(handbooks.status(), null, 2)), true;
  if (p === '/api/handbooks') return send(res, 200, 'application/json', JSON.stringify(handbooks.chapters(), null, 2)), true;
  if (p === '/api/handbooks/module') {
    const out = handbooks.actions.module({ id: url.searchParams.get('id') });
    return send(res, out.ok ? 200 : 404, 'application/json', JSON.stringify(out, null, 2)), true;
  }
  if (p === '/api/handbooks/markdown') return send(res, 200, 'text/markdown; charset=utf-8', handbooks.markdown()), true;
  {
    const cpSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const cpBody = async (req) => { try { return JSON.parse((await readBody(req, 5e4)) || '{}'); } catch { return {}; } };
    const cpGuard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    if (p === '/api/campaigns/create' && req.method === 'POST') {
      if (cpGuard(req, ctx, res)) return true;
      const body = await cpBody(req);
      return cpSend(res, campaignPlanner.create({ ...body, by: String(body.by || (ctx && ctx.actor && ctx.actor.name) || '') })), true;
    }
    if (p === '/api/campaigns/advance' && req.method === 'POST') {
      if (cpGuard(req, ctx, res)) return true;
      const body = await cpBody(req);
      return cpSend(res, campaignPlanner.advance(body.id, body.stage, { ...body, by: String(body.by || '') })), true;
    }
    if (p === '/api/calendar/add' && req.method === 'POST') {
      if (cpGuard(req, ctx, res)) return true;
      return cpSend(res, calendarLib.add(await cpBody(req))), true;
    }
    if (p === '/api/calendar/remove' && req.method === 'POST') {
      if (cpGuard(req, ctx, res)) return true;
      const body = await cpBody(req);
      return cpSend(res, calendarLib.remove(body.id)), true;
    }
  }

  // ---------- Ton: lizenzfreie Quellen, Plug-in-Ketten, Sprache ----------
  if (p === '/api/audio/sources') return send(res, 200, 'application/json', JSON.stringify(royaltyFree.list({ kind: url.searchParams.get('kind'), q: url.searchParams.get('q'), commercial: url.searchParams.get('commercial') }), null, 2)), true;
  if (p === '/api/audio/sources/status') return send(res, 200, 'application/json', JSON.stringify(royaltyFree.status(), null, 2)), true;
  if (p === '/api/plugins/audio') return send(res, 200, 'application/json', JSON.stringify({ ok: true, plugins: dawPlugins.status().builtin, list: dawPlugins.actions.plugins().plugins }, null, 2)), true;
  if (p === '/api/plugins/audio/status') return send(res, 200, 'application/json', JSON.stringify(dawPlugins.status(), null, 2)), true;
  if (p === '/api/plugins/audio/presets') return send(res, 200, 'application/json', JSON.stringify(dawPlugins.actions.presets(), null, 2)), true;
  if (p === '/api/plugins/audio/chains') return send(res, 200, 'application/json', JSON.stringify(dawPlugins.actions.chains(), null, 2)), true;
  if (p === '/api/speech/status') return send(res, 200, 'application/json', JSON.stringify(speech.status(), null, 2)), true;
  if (p === '/api/speech/engines') return send(res, 200, 'application/json', JSON.stringify(speech.engines(), null, 2)), true;
  if (p === '/api/speech/voices') return send(res, 200, 'application/json', JSON.stringify(speech.actions.voices(), null, 2)), true;
  {
    const txSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const txBody = async (req) => { try { return JSON.parse((await readBody(req, 2e5)) || '{}'); } catch { return {}; } };
    const txGuard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    if (p === '/api/audio/license' && req.method === 'POST') return txSend(res, royaltyFree.assess(await txBody(req))), true;
    if (p === '/api/plugins/audio/validate' && req.method === 'POST') return txSend(res, dawPlugins.validate((await txBody(req)).chain)), true;
    if (p === '/api/plugins/audio/build' && req.method === 'POST') return txSend(res, dawPlugins.buildFilters((await txBody(req)).chain)), true;
    if (p === '/api/plugins/audio/save' && req.method === 'POST') {
      if (txGuard(req, ctx, res)) return true;
      return txSend(res, dawPlugins.saveChain(await txBody(req))), true;
    }
    if (p === '/api/speech/plan' && req.method === 'POST') return txSend(res, speech.plan(await txBody(req))), true;
    if (p === '/api/speech/podcast' && req.method === 'POST') return txSend(res, speech.podcastOutline((await txBody(req)).parts)), true;
    if (p === '/api/speech/project' && req.method === 'POST') {
      if (txGuard(req, ctx, res)) return true;
      return txSend(res, speech.createProject(await txBody(req))), true;
    }
  }

  // ---------- Video-Abteilung, Augen, Medien-Import ----------
  if (p === '/api/video/dept/status') return send(res, 200, 'application/json', JSON.stringify(videoDepartment.status(), null, 2)), true;
  if (p === '/api/video/dept') return send(res, 200, 'application/json', JSON.stringify(videoDepartment.board(), null, 2)), true;
  if (p === '/api/video/dept/roles') return send(res, 200, 'application/json', JSON.stringify(videoDepartment.actions.roles(), null, 2)), true;
  if (p === '/api/eyes/status') return send(res, 200, 'application/json', JSON.stringify(eyes.status(), null, 2)), true;
  if (p === '/api/eyes/notes') return send(res, 200, 'application/json', JSON.stringify(eyes.notes(url.searchParams.get('limit')), null, 2)), true;
  if (p === '/api/eyes/scan') return send(res, 200, 'application/json', JSON.stringify(eyes.scan(url.searchParams.get('dir')), null, 2)), true;
  if (p === '/api/eyes/look') {
    const out = eyes.look({ file: url.searchParams.get('file') });
    return send(res, out.ok ? 200 : 400, 'application/json', JSON.stringify(out, null, 2)), true;
  }
  if (p === '/api/media/status') return send(res, 200, 'application/json', JSON.stringify(mediaImport.status(), null, 2)), true;
  if (p === '/api/media/platforms') return send(res, 200, 'application/json', JSON.stringify(mediaImport.actions.platforms(), null, 2)), true;
  if (p === '/api/media/imports') return send(res, 200, 'application/json', JSON.stringify(mediaImport.list({ platform: url.searchParams.get('platform'), state: url.searchParams.get('state') }), null, 2)), true;
  {
    const vdSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const vdBody = async (req) => { try { return JSON.parse((await readBody(req, 2e5)) || '{}'); } catch { return {}; } };
    const vdGuard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    if (p === '/api/video/dept/ticket' && req.method === 'POST') {
      if (vdGuard(req, ctx, res)) return true;
      return vdSend(res, videoDepartment.ticket(await vdBody(req))), true;
    }
    if (p === '/api/video/dept/deliver' && req.method === 'POST') {
      if (vdGuard(req, ctx, res)) return true;
      const body = await vdBody(req);
      return vdSend(res, videoDepartment.deliver(body.id, body.station, body)), true;
    }
    if (p === '/api/video/dept/qa' && req.method === 'POST') {
      if (vdGuard(req, ctx, res)) return true;
      const body = await vdBody(req);
      return vdSend(res, videoDepartment.qa(body.id, body.probe)), true;
    }
    if (p === '/api/media/preview' && req.method === 'POST') {
      const body = await vdBody(req);
      return vdSend(res, await mediaImport.preview(body)), true;
    }
    if (p === '/api/media/draft' && req.method === 'POST') {
      if (vdGuard(req, ctx, res)) return true;
      return vdSend(res, mediaImport.draft(await vdBody(req))), true;
    }
  }

  // ---------- Agenten-Rufe, Gehirn-Konsole, letztes Wort ----------
  if (p === '/api/agentcalls/status') return send(res, 200, 'application/json', JSON.stringify(agentCalls.status(), null, 2)), true;
  if (p === '/api/agentcalls/catalog') return send(res, 200, 'application/json', JSON.stringify(agentCalls.actions.catalog(), null, 2)), true;
  if (p === '/api/agentcalls/trace') return send(res, 200, 'application/json', JSON.stringify(agentCalls.trace(url.searchParams.get('limit')), null, 2)), true;
  if (p === '/api/agentcalls/blocked') return send(res, 200, 'application/json', JSON.stringify(agentCalls.actions.blocked(), null, 2)), true;
  if (p === '/api/console/status') return send(res, 200, 'application/json', JSON.stringify(brainConsole.status(), null, 2)), true;
  if (p === '/api/console/heads') return send(res, 200, 'application/json', JSON.stringify(brainConsole.directory(), null, 2)), true;
  if (p === '/api/console/transcript') return send(res, 200, 'application/json', JSON.stringify(brainConsole.transcript(url.searchParams.get('session')), null, 2)), true;
  if (p === '/api/human/status') return send(res, 200, 'application/json', JSON.stringify(humanFinal.status(), null, 2)), true;
  if (p === '/api/human/open') return send(res, 200, 'application/json', JSON.stringify(humanFinal.open(), null, 2)), true;
  if (p === '/api/human/require') return send(res, 200, 'application/json', JSON.stringify(humanFinal.actions.require(), null, 2)), true;
  if (p === '/api/human/ledger') return send(res, 200, 'application/json', JSON.stringify(humanFinal.ledger({ status: url.searchParams.get('status') }), null, 2)), true;
  {
    const hfSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const hfBody = async (req) => { try { return JSON.parse((await readBody(req, 2e5)) || '{}'); } catch { return {}; } };
    const hfGuard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    if (p === '/api/human/propose' && req.method === 'POST') {
      if (hfGuard(req, ctx, res)) return true;
      return hfSend(res, humanFinal.propose(await hfBody(req))), true;
    }
    if (p === '/api/human/decide' && req.method === 'POST') {
      if (hfGuard(req, ctx, res)) return true;
      const body = await hfBody(req);
      return hfSend(res, humanFinal.decide(body.id, body)), true;
    }
    if (p === '/api/human/guard' && req.method === 'GET') {
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, kinds: humanFinal.REQUIRES_HUMAN, note: 'POST {kind, id?} prüft, ob für dieses Vorhaben eine menschliche Freigabe vorliegt.' }, null, 2)), true;
    }
    if (p === '/api/human/guard' && req.method === 'POST') return hfSend(res, humanFinal.guard(await hfBody(req))), true;
    if (p === '/api/agentcalls/call' && req.method === 'POST') {
      if (hfGuard(req, ctx, res)) return true;
      return hfSend(res, await agentCalls.call(await hfBody(req))), true;
    }
    if (p === '/api/agentcalls/chain' && req.method === 'POST') {
      if (hfGuard(req, ctx, res)) return true;
      return hfSend(res, await agentCalls.chain(await hfBody(req))), true;
    }
    if (p === '/api/console/session' && req.method === 'POST') {
      if (hfGuard(req, ctx, res)) return true;
      return hfSend(res, brainConsole.openSession(await hfBody(req))), true;
    }
    if (p === '/api/console/say' && req.method === 'POST') {
      if (hfGuard(req, ctx, res)) return true;
      return hfSend(res, brainConsole.say(await hfBody(req))), true;
    }
  }

  // ---------- Sicherheit, Selbst-Anruf, Plug-ins ----------
  if (p === '/api/security/status') return send(res, 200, 'application/json', JSON.stringify(securityResponse.status(), null, 2)), true;
  if (p === '/api/security/signals') return send(res, 200, 'application/json', JSON.stringify(securityResponse.actions.signals(), null, 2)), true;
  if (p === '/api/security/cases') return send(res, 200, 'application/json', JSON.stringify(securityResponse.cases({ stage: url.searchParams.get('stage') }), null, 2)), true;
  if (p === '/api/security/sweep') return send(res, 200, 'application/json', JSON.stringify(securityResponse.sweep(), null, 2)), true;
  if (p === '/api/selfcall/status') return send(res, 200, 'application/json', JSON.stringify(selfCall.status(), null, 2)), true;
  if (p === '/api/selfcall/providers') return send(res, 200, 'application/json', JSON.stringify(selfCall.providerState(), null, 2)), true;
  if (p === '/api/selfcall/triggers') return send(res, 200, 'application/json', JSON.stringify(selfCall.actions.triggers(), null, 2)), true;
  if (p === '/api/selfcall/log') return send(res, 200, 'application/json', JSON.stringify(selfCall.actions.log(), null, 2)), true;
  if (p === '/api/plugins/status') return send(res, 200, 'application/json', JSON.stringify(plugins.status(), null, 2)), true;
  if (p === '/api/plugins/list') return send(res, 200, 'application/json', JSON.stringify(plugins.list({ kind: url.searchParams.get('kind') }), null, 2)), true;
  if (p === '/api/plugins/register') return send(res, 200, 'application/json', JSON.stringify(plugins.register(), null, 2)), true;
  if (p === '/api/plugins/kinds') return send(res, 200, 'application/json', JSON.stringify(plugins.actions.kinds(), null, 2)), true;
  {
    const secSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const secBody = async (req) => { try { return JSON.parse((await readBody(req, 2e5)) || '{}'); } catch { return {}; } };
    const secGuard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    if (p === '/api/security/report' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      return secSend(res, securityResponse.report(await secBody(req))), true;
    }
    if (p === '/api/security/isolate' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, securityResponse.isolate(body.id, body)), true;
    }
    if (p === '/api/security/undo' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, securityResponse.undo(body.id, body)), true;
    }
    if (p === '/api/security/review' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      return secSend(res, securityResponse.review((await secBody(req)).id)), true;
    }
    if (p === '/api/security/eject' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, securityResponse.eject(body.id, body)), true;
    }
    if (p === '/api/selfcall/alert' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      return secSend(res, selfCall.alert(await secBody(req))), true;
    }
    if (p === '/api/selfcall/ack' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, selfCall.ack(body.id, body)), true;
    }
    if (p === '/api/plugins/propose' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      return secSend(res, plugins.propose(await secBody(req))), true;
    }
    if (p === '/api/plugins/install' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, plugins.install(body.id, body)), true;
    }
    if (p === '/api/plugins/enable' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, plugins.toggle(body.id, true, body)), true;
    }
    if (p === '/api/plugins/disable' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, plugins.toggle(body.id, false, body)), true;
    }
    if (p === '/api/plugins/remove' && req.method === 'POST') {
      if (secGuard(req, ctx, res)) return true;
      const body = await secBody(req);
      return secSend(res, plugins.remove(body.id, body)), true;
    }
  }

  // ---------- Avatar/Podcast, Bezahlpläne, Werbung ----------
  if (p === '/api/avatar/status') return send(res, 200, 'application/json', JSON.stringify(avatarStudio.status(), null, 2)), true;
  if (p === '/api/avatar/list') return send(res, 200, 'application/json', JSON.stringify(avatarStudio.list({}), null, 2)), true;
  if (p === '/api/avatar/archetypes') return send(res, 200, 'application/json', JSON.stringify(avatarStudio.actions.archetypes(), null, 2)), true;
  if (p === '/api/billing/status') return send(res, 200, 'application/json', JSON.stringify(billingPlans.status(), null, 2)), true;
  if (p === '/api/billing/plans') return send(res, 200, 'application/json', JSON.stringify(billingPlans.actions.plans(), null, 2)), true;
  if (p === '/api/billing/payment') return send(res, 200, 'application/json', JSON.stringify(billingPlans.paymentState(), null, 2)), true;
  if (p === '/api/billing/list') return send(res, 200, 'application/json', JSON.stringify(billingPlans.actions.list(), null, 2)), true;
  if (p === '/api/ads/status') return send(res, 200, 'application/json', JSON.stringify(advertising.status(), null, 2)), true;
  if (p === '/api/ads/inventory') return send(res, 200, 'application/json', JSON.stringify(advertising.inventory(), null, 2)), true;
  if (p === '/api/ads/positions') return send(res, 200, 'application/json', JSON.stringify(advertising.actions.positions(), null, 2)), true;
  if (p === '/api/ads/campaigns') return send(res, 200, 'application/json', JSON.stringify(advertising.actions.campaigns(), null, 2)), true;
  {
    const bizSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const bizBody = async (req) => { try { return JSON.parse((await readBody(req, 2e5)) || '{}'); } catch { return {}; } };
    const bizGuard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    if (p === '/api/avatar/create' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      return bizSend(res, avatarStudio.create(await bizBody(req))), true;
    }
    if (p === '/api/avatar/check' && req.method === 'GET') {
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, avatars: avatarStudio.list({}).items, note: 'POST {avatar, text} prüft einen Text gegen die Persona (verbotene Wörter, Kennzeichnung).' }, null, 2)), true;
    }
    if (p === '/api/avatar/check' && req.method === 'POST') {
      const body = await bizBody(req);
      return bizSend(res, avatarStudio.checkText(body.avatar, body.text)), true;
    }
    if (p === '/api/avatar/episode' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      return bizSend(res, avatarStudio.episode(await bizBody(req))), true;
    }
    if (p === '/api/billing/quote' && req.method === 'POST') return bizSend(res, billingPlans.quote(await bizBody(req))), true;
    if (p === '/api/billing/subscribe' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      return bizSend(res, billingPlans.subscribe(await bizBody(req))), true;
    }
    if (p === '/api/billing/cancel' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      const body = await bizBody(req);
      return bizSend(res, billingPlans.cancel(body.who)), true;
    }
    if (p === '/api/billing/invoice' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      return bizSend(res, billingPlans.invoice(await bizBody(req))), true;
    }
    if (p === '/api/billing/limits' && req.method === 'POST') return bizSend(res, billingPlans.checkLimits(await bizBody(req))), true;
    if (p === '/api/ads/check' && req.method === 'GET') {
      return send(res, 200, 'application/json', JSON.stringify({ ok: true, positions: advertising.SLOT_POSITIONS, rules: advertising.REFUSED_REQUESTS.map((r) => r.why), note: 'POST {text} prüft einen Wunsch gegen die Sperrliste (keine Klick-/Reichweiten-Erzeugung).' }, null, 2)), true;
    }
    if (p === '/api/ads/check' && req.method === 'POST') {
      const body = await bizBody(req);
      return bizSend(res, advertising.checkRequest(body.text)), true;
    }
    if (p === '/api/ads/slot' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      return bizSend(res, advertising.slot(await bizBody(req))), true;
    }
    if (p === '/api/ads/campaign' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      return bizSend(res, advertising.campaign(await bizBody(req))), true;
    }
    if (p === '/api/ads/measure' && req.method === 'POST') {
      if (bizGuard(req, ctx, res)) return true;
      const body = await bizBody(req);
      return bizSend(res, advertising.measure(body.id, body)), true;
    }
  }

  // ---------- Hermes-Fähigkeiten ----------
  if (p === '/api/hermes/status') return send(res, 200, 'application/json', JSON.stringify(hermes.status(), null, 2)), true;
  if (p === '/api/hermes/preflight') return send(res, 200, 'application/json', JSON.stringify(hermes.preflight(), null, 2)), true;
  if (p === '/api/hermes/skills') return send(res, 200, 'application/json', JSON.stringify(hermes.skills(), null, 2)), true;
  if (p === '/api/hermes/skills/status') return send(res, 200, 'application/json', JSON.stringify(hermes.skillStatus(), null, 2)), true;
  if (p === '/api/hermes/skills/use') {
    return send(res, 200, 'application/json', JSON.stringify(hermes.useSkill({ skill: url.searchParams.get('skill') }), null, 2)), true;
  }
  {
    const hSend = (res, out) => send(res, out.ok ? (out.code || 200) : (out.code || 400), 'application/json', JSON.stringify(out, null, 2));
    const hBody = async (req) => { try { return JSON.parse((await readBody(req, 2e5)) || '{}'); } catch { return {}; } };
    const hGuard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    if (p === '/api/hermes/skills/grant' && req.method === 'POST') {
      if (hGuard(req, ctx, res)) return true;
      return hSend(res, hermes.grantSkill(await hBody(req))), true;
    }
    if (p === '/api/hermes/skills/revoke' && req.method === 'POST') {
      if (hGuard(req, ctx, res)) return true;
      return hSend(res, hermes.revokeSkill(await hBody(req))), true;
    }
  }

  // ---------- Zweite Ausbaustufe: Support · Inhalt · Analyse · Überwachung · Messenger · Nutzer · Social · DAW · Design · Startvideo · Projekte · Hermes-Ablauf · Zahlungen ----------
  // Muster wie in den übrigen Blöcken: GET erklärt den Pfad (immer 200), POST arbeitet und ist ohne
  // Admin-Token gesperrt. Body wird genau einmal gelesen.
  {
    const r4Body = async (req) => { try { return JSON.parse((await readBody(req, 2e5)) || '{}'); } catch { return {}; } };
    const r4Send = (res, out) => send(res, out && out.code ? out.code : (out && out.ok === false ? 400 : 200), 'application/json', JSON.stringify(out, null, 2));
    const r4Guard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    const r4Info = (path, does, body) => ({ ok: true, path, method: 'POST mit JSON-Body (Admin-Token im Header x-aura-token)', does, body_example: body || null, hint: 'Ohne Token: 401. Schreiben erst nach Prüfung.' });

    // ---- Support / Kontaktieren Sie uns ----
    if (p === '/api/support/status') return send(res, 200, 'application/json', JSON.stringify(support.status(), null, 2)), true;
    if (p === '/api/support/categories') return send(res, 200, 'application/json', JSON.stringify(support.actions.categories(), null, 2)), true;
    if (p === '/api/support/contact') return send(res, 200, 'application/json', JSON.stringify(support.contact(), null, 2)), true;
    if (p === '/api/support/tickets') return send(res, 200, 'application/json', JSON.stringify(support.list({ state: url.searchParams.get('state') || undefined }), null, 2)), true;
    if (p === '/api/support/ticket') {
      const id = url.searchParams.get('id');
      if (!id) return send(res, 200, 'application/json', JSON.stringify({ ok: true, hint: '?id=A-0001 anhängen', open: support.list({ state: 'NEU' }).count }, null, 2)), true;
      return send(res, 200, 'application/json', JSON.stringify(support.get({ id }), null, 2)), true;
    }
    if (p === '/api/support/submit' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, support.submit(body)), true; }
    if (p === '/api/support/submit') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/support/submit', 'Anliegen anlegen (Nummer, Zustand, Belege automatisch)', { subject: 'Fehler beim Rendern', text: 'Was passiert ist', category: 'FEHLER', priority: 'hoch' }), null, 2)), true;
    if (p === '/api/support/reply' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, support.reply(String(body.id || ''), body)), true; }
    if (p === '/api/support/reply') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/support/reply', 'Antwort an den Melder anhängen', { id: 'A-0001', text: 'Wir haben es gefunden.' }), null, 2)), true;
    if (p === '/api/support/state' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, support.setState(String(body.id || ''), body.state, body)), true; }
    if (p === '/api/support/state') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/support/state', 'Zustand eines Anliegens setzen (NEU → IN_ARBEIT → … → GESCHLOSSEN)', { id: 'A-0001', state: 'IN_ARBEIT' }), null, 2)), true;
    if (p === '/api/support/diagnostics') return send(res, 200, 'application/json', JSON.stringify(support.diagnostics(), null, 2)), true;

    // ---- Inhalt: Ablage mit Fassungen ----
    if (p === '/api/store/status') return send(res, 200, 'application/json', JSON.stringify(contentStore.status(), null, 2)), true;
    if (p === '/api/store/kinds') return send(res, 200, 'application/json', JSON.stringify(contentStore.actions.kinds(), null, 2)), true;
    if (p === '/api/store/list') return send(res, 200, 'application/json', JSON.stringify(contentStore.search({ q: url.searchParams.get('q') || undefined, kind: url.searchParams.get('kind') || undefined, tag: url.searchParams.get('tag') || undefined }), null, 2)), true;
    if (p === '/api/store/item') {
      const id = url.searchParams.get('id');
      if (!id) return send(res, 200, 'application/json', JSON.stringify({ ok: true, hint: '?id=<kennung> anhängen' }, null, 2)), true;
      return send(res, 200, 'application/json', JSON.stringify(contentStore.get({ id }), null, 2)), true;
    }
    if (p === '/api/store/bundles') return send(res, 200, 'application/json', JSON.stringify(contentStore.actions.bundles(), null, 2)), true;
    if (p === '/api/store/retention') return send(res, 200, 'application/json', JSON.stringify(contentStore.retention(), null, 2)), true;
    if (p === '/api/store/register' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, contentStore.register(body)), true; }
    if (p === '/api/store/register') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/store/register', 'Inhalt ablegen (Ablage JAHR/MONAT/ART, Prüfsumme, Fassung 1)', { title: 'Song: Creed Street', kind: 'text', text: 'Inhalt…', tags: ['song'] }), null, 2)), true;
    if (p === '/api/store/version' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, contentStore.version(String(body.id || ''), body)), true; }
    if (p === '/api/store/version') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/store/version', 'Neue Fassung anlegen statt überschreiben', { id: '<kennung>', text: 'geänderter Inhalt', note: 'zweiter Durchlauf' }), null, 2)), true;
    if (p === '/api/store/state' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, contentStore.setState(String(body.id || ''), body.state, body)), true; }
    if (p === '/api/store/state') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/store/state', 'Zustand setzen — VEROEFFENTLICHT nur mit human: true', { id: '<kennung>', state: 'VEROEFFENTLICHT', human: true, by: 'Name' }), null, 2)), true;
    if (p === '/api/store/bundle' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, contentStore.bundle(body)), true; }
    if (p === '/api/store/bundle') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/store/bundle', 'Sammelausgabe mit Manifest und Prüfsumme schnüren', { kind: 'video', name: 'Monatsausgabe' }), null, 2)), true;

    // ---- Analyse: Traffic, Charts, Vorhersage ----
    if (p === '/api/analytics/status') return send(res, 200, 'application/json', JSON.stringify(analytics.status(), null, 2)), true;
    if (p === '/api/analytics/sources') return send(res, 200, 'application/json', JSON.stringify(analytics.actions.sources(), null, 2)), true;
    if (p === '/api/analytics/overview') return send(res, 200, 'application/json', JSON.stringify(analytics.overview(Number(url.searchParams.get('days')) || 30), null, 2)), true;
    if (p === '/api/analytics/analyze') return send(res, 200, 'application/json', JSON.stringify(analytics.analyze({ page: url.searchParams.get('page') || undefined }), null, 2)), true;
    if (p === '/api/analytics/charts') return send(res, 200, 'application/json', JSON.stringify(analytics.actions.charts(), null, 2)), true;
    if (p === '/api/analytics/forecast') return send(res, 200, 'application/json', JSON.stringify(analytics.forecast({ page: url.searchParams.get('page') || undefined, weeks: Number(url.searchParams.get('weeks')) || 4 }), null, 2)), true;
    if (p === '/api/analytics/briefing') return send(res, 200, 'application/json', JSON.stringify(analytics.trendBriefing(), null, 2)), true;
    if (p === '/api/analytics/traffic' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, analytics.traffic(body)), true; }
    if (p === '/api/analytics/traffic') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/analytics/traffic', 'Einen echten Messwert eintragen (Datum, Aufrufe, Besucher, Quelle)', { page: '/master-web-empire/01_igaming_toplists', date: '2026-10-16', views: 120, visitors: 95, source: 'webserver', side_product: 'vergleich' }), null, 2)), true;
    if (p === '/api/analytics/chart' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, analytics.chartEntry(body)), true; }
    if (p === '/api/analytics/chart') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/analytics/chart', 'Chart-Eintrag erfassen (Rang, Genre, Neueinstieg)', { chart: 'de-singles', rank: 12, title: 'Beispiel', genre: 'pop' }), null, 2)), true;

    // ---- Selbstüberwachung ----
    if (p === '/api/monitor/status') return send(res, 200, 'application/json', JSON.stringify(autoMonitor.status(), null, 2)), true;
    if (p === '/api/monitor/rules') return send(res, 200, 'application/json', JSON.stringify(autoMonitor.rules(), null, 2)), true;
    if (p === '/api/monitor/findings') return send(res, 200, 'application/json', JSON.stringify(autoMonitor.findings(), null, 2)), true;
    if (p === '/api/monitor/runs') return send(res, 200, 'application/json', JSON.stringify(autoMonitor.actions.runs(), null, 2)), true;
    if (p === '/api/monitor/run' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, autoMonitor.run(body)), true; }
    if (p === '/api/monitor/run') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/monitor/run', 'Alle Regeln prüfen (liest nur, schaltet nichts)', { alert: true }), null, 2)), true;

    // ---- Messenger mit Künstlern (Brainstorming) ----
    if (p === '/api/messenger/status') return send(res, 200, 'application/json', JSON.stringify(messenger.status(), null, 2)), true;
    if (p === '/api/messenger/list') return send(res, 200, 'application/json', JSON.stringify(messenger.list(), null, 2)), true;
    if (p === '/api/messenger/history') return send(res, 200, 'application/json', JSON.stringify(messenger.history(url.searchParams.get('channel') || null), null, 2)), true;
    if (p === '/api/messenger/result' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, messenger.result(body.channel || body.id, body)), true; }
    if (p === '/api/messenger/result') {
      const cid = url.searchParams.get('channel');
      if (!cid) return send(res, 200, 'application/json', JSON.stringify({ ok: true, hint: 'POST mit { channel } hält das Ergebnis fest; GET ?channel=<kennung> liest es' }, null, 2)), true;
      return send(res, 200, 'application/json', JSON.stringify(messenger.result(cid), null, 2)), true;
    }
    if (p === '/api/messenger/channel' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, messenger.channel(body)), true; }
    if (p === '/api/messenger/channel') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/messenger/channel', 'Kanal anlegen: direkt, crew oder brainstorm', { kind: 'brainstorm', topic: 'Trap mit Schlager-Piano?', members: ['Sabr47'] }), null, 2)), true;
    if (p === '/api/messenger/post' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, messenger.post(body)), true; }
    if (p === '/api/messenger/post') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/messenger/post', 'Beitrag schreiben (eine Stimme pro Person)', { channel: 'brainstorm-…', user: 'Sabr47', text: 'Ich finde die Idee gut.' }), null, 2)), true;
    if (p === '/api/messenger/vote' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, messenger.vote(body)), true; }
    if (p === '/api/messenger/vote') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/messenger/vote', 'Punkte vergeben (1–5, einmal pro Person und Idee)', { channel: 'brainstorm-…', user: 'Sabr47', post: '<kennung>', points: 5 }), null, 2)), true;
    if (p === '/api/messenger/advance' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, messenger.advance(body.channel || body.id)), true; }
    if (p === '/api/messenger/advance') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/messenger/advance', 'Runde weiterschalten: ideen → bewerten → ergebnis', { channel: 'brainstorm-…' }), null, 2)), true;
    if (p === '/api/messenger/draft' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, messenger.toDraft(body)), true; }
    if (p === '/api/messenger/draft') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/messenger/draft', 'Aus dem Ergebnis einen Entwurf machen (song, video, campaign, content)', { channel: 'brainstorm-…', what: 'song', style: 'trap' }), null, 2)), true;

    // ---- Nutzerbereich: Rollen, Rechte, Übersicht ----
    if (p === '/api/users/status') return send(res, 200, 'application/json', JSON.stringify(userArea.status(), null, 2)), true;
    if (p === '/api/users/list') return send(res, 200, 'application/json', JSON.stringify(userArea.list(), null, 2)), true;
    if (p === '/api/users/roles') return send(res, 200, 'application/json', JSON.stringify(userArea.actions.roles(), null, 2)), true;
    if (p === '/api/users/dashboard') return send(res, 200, 'application/json', JSON.stringify(userArea.dashboard(url.searchParams.get('user') || undefined), null, 2)), true;
    if (p === '/api/users/check') return send(res, 200, 'application/json', JSON.stringify(userArea.check({ user: url.searchParams.get('user') || undefined, action: url.searchParams.get('action') || 'view' }), null, 2)), true;
    if (p === '/api/users/create' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, userArea.create(body)), true; }
    if (p === '/api/users/create') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/users/create', 'Nutzer mit Rolle anlegen (owner, admin, artist, editor, viewer)', { name: 'Sabr47', role: 'artist' }), null, 2)), true;
    if (p === '/api/users/role' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, userArea.setRole(body.user || body.id, body.role)), true; }
    if (p === '/api/users/role') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/users/role', 'Rolle ändern — wird protokolliert', { user: 'Sabr47', role: 'editor', by: 'Auraos' }), null, 2)), true;
    if (p === '/api/users/preferences' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, userArea.preferences(body.user || body.id, body.values || body)), true; }
    if (p === '/api/users/preferences' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(userArea.preferences(url.searchParams.get('user') || undefined), null, 2)), true;

    // ---- Login über Social-Media-Kanäle ----
    if (p === '/api/social/status') return send(res, 200, 'application/json', JSON.stringify(socialLogin.status(), null, 2)), true;
    if (p === '/api/social/providers') return send(res, 200, 'application/json', JSON.stringify(socialLogin.providerState(), null, 2)), true;
    if (p === '/api/social/links') return send(res, 200, 'application/json', JSON.stringify(socialLogin.actions.links(), null, 2)), true;
    if (p === '/api/social/start' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, socialLogin.start(body)), true; }
    if (p === '/api/social/start') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/social/start', 'Anmeldung beginnen (state, nonce, PKCE-Verfahren) — ohne Vault-Schlüssel ehrlich NOT-CONNECTED', { provider: 'google', redirect: '/konto' }), null, 2)), true;
    if (p === '/api/social/callback' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, socialLogin.callback(body)), true; }
    if (p === '/api/social/callback') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/social/callback', 'Rückmeldung des Anbieters prüfen (state + nonce müssen stimmen)', { state: '<state>', code: '<code>' }), null, 2)), true;
    if (p === '/api/social/link' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, socialLogin.link(body)), true; }
    if (p === '/api/social/link') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/social/link', 'Kanal verknüpfen — nur mit menschlicher Bestätigung (human: true)', { user: 'Sabr47', provider: 'youtube', handle: '@meinkanal', human: true }), null, 2)), true;
    if (p === '/api/social/unlink' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, socialLogin.unlink(body.user || body.id, body)), true; }
    if (p === '/api/social/unlink') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/social/unlink', 'Verknüpfung lösen — braucht ebenfalls einen Menschen', { user: 'Sabr47', provider: 'youtube', handle: '@meinkanal', human: true }), null, 2)), true;

    // ---- Externe Geräte an der DAW ----
    if (p === '/api/daw/status') return send(res, 200, 'application/json', JSON.stringify(dawDevices.status(), null, 2)), true;
    if (p === '/api/daw/kinds') return send(res, 200, 'application/json', JSON.stringify(dawDevices.actions.kinds(), null, 2)), true;
    if (p === '/api/daw/devices') return send(res, 200, 'application/json', JSON.stringify(dawDevices.list(), null, 2)), true;
    if (p === '/api/daw/mappings') return send(res, 200, 'application/json', JSON.stringify(dawDevices.actions.mappings(), null, 2)), true;
    if (p === '/api/daw/probe') return send(res, 200, 'application/json', JSON.stringify(dawDevices.probe(), null, 2)), true;
    if (p === '/api/daw/latency') return send(res, 200, 'application/json', JSON.stringify(dawDevices.latency({ buffer: Number(url.searchParams.get('buffer')) || 256, rate: Number(url.searchParams.get('rate')) || 48000 }), null, 2)), true;
    if (p === '/api/daw/add' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, dawDevices.addDevice(body)), true; }
    if (p === '/api/daw/add') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/daw/add', 'Gerät eintragen (Klasse: keyboard, pad, fader, mikrofon, interface, …)', { kind: 'keyboard', name: 'Mein MIDI-Keyboard', port: 'Midi Through' }), null, 2)), true;
    if (p === '/api/daw/learn' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, dawDevices.learn(body)), true; }
    if (p === '/api/daw/learn') return send(res, 200, 'application/json', JSON.stringify({ ok: true, hint: 'POST mit { signal: "CC 74", fx: "reverb", param: "mix" } — bindet einen echten Regler an einen echten Effekt.' }), true);
    if (p === '/api/daw/apply' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, dawDevices.apply(body)), true; }
    if (p === '/api/daw/apply') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/daw/apply', 'Wert anwenden (7 Bit, 14 Bit, Pitch Bend; Kurven linear/log/exp)', { signal: 'CC 74', value: 96, fx: 'reverb', param: 'mix' }), null, 2)), true;
    if (p === '/api/daw/note' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, dawDevices.note(body)), true; }
    if (p === '/api/daw/note') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/daw/note', 'Note rechnen (MIDI-Nummer → Name und Frequenz)', { note: 60 }), null, 2)), true;

    // ---- Design-Bausteine (Knöpfe, Regler, Flächen) ----
    if (p === '/api/design/status') return send(res, 200, 'application/json', JSON.stringify(uiKit.status(), null, 2)), true;
    if (p === '/api/design/components' || p === '/design') return send(res, 200, 'text/html; charset=utf-8', uiKit.componentsPage()), true;
    if (p === '/start') return send(res, 200, 'text/html; charset=utf-8', uiKit.startPage()), true;
    if (p === '/api/design/css') return send(res, 200, 'text/css; charset=utf-8', uiKit.CSS), true;
    if (p === '/api/design/js') return send(res, 200, 'application/javascript; charset=utf-8', uiKit.CLIENT_JS), true;
    if (p === '/api/design/nav') return send(res, 200, 'application/json', JSON.stringify({ ok: true, nav: uiKit.NAV }, null, 2)), true;

    // ---- Startvideo (10 Sekunden) ----
    if (p === '/api/intro/status') return send(res, 200, 'application/json', JSON.stringify(bootIntro.status(), null, 2)), true;
    if (p === '/api/intro/palettes') return send(res, 200, 'application/json', JSON.stringify(bootIntro.actions.palettes(), null, 2)), true;
    if (p === '/api/intro/list') return send(res, 200, 'application/json', JSON.stringify(bootIntro.list(), null, 2)), true;
    if (p === '/api/intro/frames') return send(res, 200, 'application/json', JSON.stringify(bootIntro.actions.frames_dir(), null, 2)), true;
    if (p === '/api/intro/render' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, await bootIntro.render(body)), true; }
    if (p === '/api/intro/render') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/intro/render', 'Startvideo rendern (10 s, 24 Bilder/s, Ton aus dem eigenen Renderer, ffmpeg kodiert)', { seconds: 10, title: 'AURA', subtitle: 'SYSTEM STARTET', music_style: 'cinematic', palette: 'aurora' }), null, 2)), true;

    // ---- Seiten-Projekte (Server, Betrieb, Prüflauf) ----
    if (p === '/api/projects/status') return send(res, 200, 'application/json', JSON.stringify(siteProjects.status(), null, 2)), true;
    if (p === '/api/projects/list') return send(res, 200, 'application/json', JSON.stringify(siteProjects.list(), null, 2)), true;
    if (p === '/api/projects/stacks') return send(res, 200, 'application/json', JSON.stringify(siteProjects.actions.stacks(), null, 2)), true;
    if (p === '/api/projects/get') {
      const id = url.searchParams.get('id');
      if (!id) return send(res, 200, 'application/json', JSON.stringify(siteProjects.list(), null, 2)), true;
      return send(res, 200, 'application/json', JSON.stringify(siteProjects.get(id), null, 2)), true;
    }
    if (p === '/api/projects/pack' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, siteProjects.deploymentPack(body.id)), true; }
    if (p === '/api/projects/pack') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/projects/pack', 'Deploy-Paket: nginx-Block, Dienst-Datei, Befehle — zum Ausführen durch einen Menschen', { id: '<projekt>', domain: 'beispiel.de' }), null, 2)), true;
    if (p === '/api/projects/create' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, siteProjects.create(body)), true; }
    if (p === '/api/projects/create') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/projects/create', 'Seiten-Projekt anlegen (Art, Domain, Verzeichnis, Startbefehl, Port)', { name: 'igaming-toplists', stack: 'node', domain: 'beispiel.de', dir: '/var/www/seite', port: 3000, start_cmd: 'node server.js' }), null, 2)), true;
    if (p === '/api/projects/verify' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, siteProjects.verify(body.id)), true; }
    if (p === '/api/projects/verify') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/projects/verify', 'Prüflauf: Verzeichnis, Port, Domain, Startbefehl — sagt ehrlich, was lokal prüfbar ist', { id: '<projekt>' }), null, 2)), true;
    if (p === '/api/projects/import-empire' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, siteProjects.importEmpire(body)), true; }
    if (p === '/api/projects/import-empire') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/projects/import-empire', 'Seiten aus dem Web-Empire als Projekte übernehmen', { domain: 'beispiel.de', owner: 'Auraos' }), null, 2)), true;

    // ---- Hermes im ganzen Prozess ----
    if (p === '/api/hermes/flow/status') return send(res, 200, 'application/json', JSON.stringify(hermesFlow.status(), null, 2)), true;
    if (p === '/api/hermes/flow/processes') return send(res, 200, 'application/json', JSON.stringify(hermesFlow.processes(), null, 2)), true;
    if (p === '/api/hermes/flow/plan') return send(res, 200, 'application/json', JSON.stringify(hermesFlow.plan({ process: url.searchParams.get('process') || 'song' }), null, 2)), true;
    if (p === '/api/hermes/flow/trace') return send(res, 200, 'application/json', JSON.stringify(hermesFlow.trace({ id: url.searchParams.get('id') || undefined }), null, 2)), true;
    if (p === '/api/hermes/flow/run' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, hermesFlow.run(body)), true; }
    if (p === '/api/hermes/flow/run') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/hermes/flow/run', 'Ablauf durchlaufen lassen — hält an jeder Menschenschwelle an; human: true fährt darüber', { process: 'song', human: false, input: {} }), null, 2)), true;

    // ---- Zahlungsdienstleister ----
    if (p === '/api/payments/status') return send(res, 200, 'application/json', JSON.stringify(payments.status(), null, 2)), true;
    if (p === '/api/payments/providers') return send(res, 200, 'application/json', JSON.stringify(payments.state(), null, 2)), true;
    if (p === '/api/payments/purposes') return send(res, 200, 'application/json', JSON.stringify(payments.actions.purposes(), null, 2)), true;
    if (p === '/api/payments/checkouts') return send(res, 200, 'application/json', JSON.stringify(payments.actions.checkouts(), null, 2)), true;
    if (p === '/api/payments/choose') return send(res, 200, 'application/json', JSON.stringify(payments.choose({ purpose: url.searchParams.get('purpose') || 'einmalig', region: url.searchParams.get('region') || 'DE' }), null, 2)), true;
    if (p === '/api/payments/checkout' && req.method === 'POST') { if (r4Guard(req, ctx, res)) return true; const body = await r4Body(req); return r4Send(res, payments.checkout(body)), true; }
    if (p === '/api/payments/checkout') return send(res, 200, 'application/json', JSON.stringify(r4Info('/api/payments/checkout', 'Zahlung planen und rechnen — ohne Schlüssel und ohne Mensch wird nichts ausgelöst', { provider: 'stripe', amount: 29.99, currency: 'EUR', purpose: 'Monatsabo', human: false }), null, 2)), true;
  }

  // ---------- Dritte Ausbaustufe: Sprachen · Aussehen · Marke · Werbung im OS · Empfehlungen · Förderung · Protokoll · Text&Reim · Musik-Abteilungen · Song-Orchester · Rundbrief · Recht · Weißbuch · Ideenkatalog · Startintro ----------
  {
    const r5Body = async (req) => { try { return JSON.parse((await readBody(req, 2e6)) || '{}'); } catch { return {}; } };
    // Achtung: manche Module liefern ein Feld „code“ (Werbecode!). Als Statuscode gilt nur eine Zahl.
    const r5Send = (res, out) => { const st = out && typeof out.code === 'number' ? out.code : (out && out.ok === false ? 400 : 200); return send(res, st, 'application/json', JSON.stringify(out, null, 2)); };
    const r5Guard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    const r5Info = (path, does, body) => ({ ok: true, path, method: 'POST mit JSON-Body (Admin-Token im Header x-aura-token)', does, body_example: body || null });

    // ---- Sprachen des Betriebssystems ----
    if (p === '/api/i18n/status') return send(res, 200, 'application/json', JSON.stringify(i18n.status(), null, 2)), true;
    if (p === '/api/i18n/languages') return send(res, 200, 'application/json', JSON.stringify(i18n.actions.languages(), null, 2)), true;
    if (p === '/api/i18n/coverage') return send(res, 200, 'application/json', JSON.stringify(i18n.coverage(), null, 2)), true;
    if (p === '/api/i18n/catalog') return send(res, 200, 'application/json', JSON.stringify(i18n.catalog(url.searchParams.get('lang') || undefined), null, 2)), true;
    if (p === '/api/i18n/translate' && req.method === 'POST') { const body = await r5Body(req); return r5Send(res, i18n.actions.translate(body)), true; }
    if (p === '/api/i18n/translate') return send(res, 200, 'application/json', JSON.stringify({ ok: true, hint: 'POST { key:"nav.support", lang:"tr" } oder GET ?key=&lang=', result: url.searchParams.get('key') ? i18n.actions.translate({ key: url.searchParams.get('key'), lang: url.searchParams.get('lang') }) : null }, null, 2)), true;
    if (p === '/api/i18n/default' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, i18n.setDefault(body.lang, body)), true; }
    if (p === '/api/i18n/default') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/i18n/default', 'Grundsprache setzen', { lang: 'de' }), null, 2)), true;
    if (p === '/api/i18n/text' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, i18n.setText(body.key, body.lang, body.value, body)), true; }
    if (p === '/api/i18n/text') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/i18n/text', 'Einen Satz in einer Sprache überschreiben', { key: 'nav.support', lang: 'tr', value: 'Destek' }), null, 2)), true;

    // ---- Aussehen: Themes und Hintergründe ----
    if (p === '/api/themes/status') return send(res, 200, 'application/json', JSON.stringify(themes.status(), null, 2)), true;
    if (p === '/api/themes/list') return send(res, 200, 'application/json', JSON.stringify(themes.actions.list(), null, 2)), true;
    if (p === '/api/themes/css') return send(res, 200, 'text/css; charset=utf-8', themes.css(url.searchParams.get('theme') || undefined, url.searchParams.get('background') || undefined)), true;
    if (p === '/api/themes/for-user') return send(res, 200, 'application/json', JSON.stringify(themes.forUser(url.searchParams.get('user') || undefined), null, 2)), true;
    if (p === '/api/themes/set' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, themes.set(body)), true; }
    if (p === '/api/themes/set') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/themes/set', 'Aussehen je Nutzer wählen', { user: 'Sabr47', theme: 'neon', background: 'stage' }), null, 2)), true;

    // ---- Marke: Zeichen, Copyright, Kennzeichnung, Fußzeile ----
    if (p === '/api/branding/status') return send(res, 200, 'application/json', JSON.stringify(branding.status(), null, 2)), true;
    if (p === '/api/branding/logo.svg' || p === '/api/branding/svg') return send(res, 200, 'image/svg+xml; charset=utf-8', branding.logoSvg({ size: Number(url.searchParams.get('size')) || 240, transparent: url.searchParams.get('transparent') === '1', mono: url.searchParams.get('mono') === '1' })), true;
    if (p === '/api/branding/logo') return send(res, 200, 'application/json', JSON.stringify({ ok: true, svg: branding.logoSvg({ size: 240 }), brand: branding.BRAND.owner, year: branding.BRAND.year, copyright: branding.BRAND.line }, null, 2)), true;
    if (p === '/api/branding/footer') return send(res, 200, 'application/json', JSON.stringify(branding.footer({ lang: url.searchParams.get('lang') || undefined }), null, 2)), true;
    if (p === '/api/branding/marks') return send(res, 200, 'application/json', JSON.stringify(branding.actions.marks(), null, 2)), true;
    if (p === '/api/branding/mark' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, branding.watermark(body)), true; }
    if (p === '/api/branding/mark') return send(res, 200, 'application/json', JSON.stringify(Object.assign(r5Info('/api/branding/mark', 'Kennzeichnung planen (Bild, Video, Ton, Text, Seite)', { kind: 'VIDEO', target: 'clip.mp4', opacity: 0.3 }), { preview: branding.watermark({ kind: url.searchParams.get('kind') || 'SEITE' }) }), null, 2)), true;

    // ---- Werbung im OS: Kurzmeldung alle 6 Minuten, Anzeige alle 11 ----
    if (p === '/api/adsched/status') return send(res, 200, 'application/json', JSON.stringify(adEngine.status(), null, 2)), true;
    if (p === '/api/adsched/rhythms') return send(res, 200, 'application/json', JSON.stringify(adEngine.actions.rhythms(), null, 2)), true;
    if (p === '/api/adsched/stats') return send(res, 200, 'application/json', JSON.stringify(adEngine.stats(), null, 2)), true;
    if (p === '/api/adsched/client.js') return send(res, 200, 'application/javascript; charset=utf-8', adEngine.client()), true;
    if (p === '/api/adsched/schedule' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); if (typeof body.enabled === 'boolean') return r5Send(res, adEngine.setEnabled(body.enabled, body)), true; return r5Send(res, adEngine.schedule(body)), true; }
    if (p === '/api/adsched/schedule') return send(res, 200, 'application/json', JSON.stringify(adEngine.schedule({ minutes: Number(url.searchParams.get('minutes')) || 60 }), null, 2)), true;
    if (p === '/api/adsched/slot' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, adEngine.slot(body)), true; }
    if (p === '/api/adsched/slot') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/adsched/slot', 'Meldung einsetzen: rhythm flash (alle 6 Min, nicht wegklickbar) oder banner (alle 11 Min, wegklickbar)', { rhythm: 'flash', headline: 'Neuer Song ist draußen', body: 'Creed Street · ab jetzt überall', target: '/musik' }), null, 2)), true;
    if (p === '/api/adsched/record' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, adEngine.record(body)), true; }
    if (p === '/api/adsched/record') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/adsched/record', 'Echtes Ereignis zählen (view, watched, click) — nur was wirklich passiert', { what: 'view', slot_id: '<kennung>', rhythm: 'flash' }), null, 2)), true;

    // ---- Förderung / Foundry ----
    if (p === '/api/sponsor/status') return send(res, 200, 'application/json', JSON.stringify(sponsor.status(), null, 2)), true;
    if (p === '/api/sponsor/tiers') return send(res, 200, 'application/json', JSON.stringify(sponsor.tiers(), null, 2)), true;
    if (p === '/api/sponsor/list') return send(res, 200, 'application/json', JSON.stringify(sponsor.actions.list(), null, 2)), true;
    if (p === '/api/sponsor/ticker') return send(res, 200, 'application/json', JSON.stringify(sponsor.footerTicker({ lang: url.searchParams.get('lang') || undefined }), null, 2)), true;
    if (p === '/api/sponsor/page') return send(res, 200, 'application/json', JSON.stringify(sponsor.page({ lang: url.searchParams.get('lang') || undefined }), null, 2)), true;
    if (p === '/api/sponsor/foerdern') { const pg = sponsor.page({ lang: url.searchParams.get('lang') || undefined }); return send(res, 200, 'text/html; charset=utf-8', pg.html), true; }
    if (p === '/api/sponsor/add' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, sponsor.add(body)), true; }
    if (p === '/api/sponsor/add') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/sponsor/add', 'Förderer aufnehmen (Stufe: freund, foerderer, partner, foundry, einmalig)', { name: 'Beispiel GmbH', tier: 'partner', link: 'https://beispiel.de', paid: false }), null, 2)), true;
    if (p === '/api/sponsor/state' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, sponsor.setState(body)), true; }
    if (p === '/api/sponsor/state') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/sponsor/state', 'Zustand setzen — BEZAHLT nur mit Beleg', { id: '<kennung>', state: 'BEZAHLT', proof: 'Rechnung 2026-014' }), null, 2)), true;

    // ---- Empfehlungen: Freund werben, beide profitieren ----
    if (p === '/api/referral/status') return send(res, 200, 'application/json', JSON.stringify(referral.status(), null, 2)), true;
    if (p === '/api/referral/program') return send(res, 200, 'application/json', JSON.stringify(referral.actions.program(), null, 2)), true;
    if (p === '/api/referral/codes') return send(res, 200, 'application/json', JSON.stringify(referral.actions.codes(), null, 2)), true;
    if (p === '/api/referral/ranking') return send(res, 200, 'application/json', JSON.stringify(referral.ranking(), null, 2)), true;
    if (p === '/api/referral/code' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, referral.code(body)), true; }
    if (p === '/api/referral/code') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/referral/code', 'Werbecode anlegen (Link zum Weitergeben)', { user: 'Sabr47' }), null, 2)), true;
    if (p === '/api/referral/event' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, referral.event(body)), true; }
    if (p === '/api/referral/event') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/referral/event', 'Echtes Ereignis buchen — Selbstwerbung und Doppelbuchung werden abgelehnt', { code: 'SABR47-XXXX', who: 'neuer-freund', type: 'signup' }), null, 2)), true;
    if (p === '/api/referral/claim' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, referral.claim(body)), true; }
    if (p === '/api/referral/claim') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/referral/claim', 'Prämien im Konto einlösen — nur mit Mensch (human: true)', { code: 'SABR47-XXXX', human: true, by: 'Auraos' }), null, 2)), true;

    // ---- Protokoll, Klick-Bewertung, Einnahmen-Bewertung ----
    if (p === '/api/logs/status') return send(res, 200, 'application/json', JSON.stringify(logs.status(), null, 2)), true;
    if (p === '/api/logs/sources') return send(res, 200, 'application/json', JSON.stringify(logs.actions.sources(), null, 2)), true;
    if (p === '/api/logs/search') return send(res, 200, 'application/json', JSON.stringify(logs.search({ text: url.searchParams.get('q') || undefined, source: url.searchParams.get('source') || undefined, limit: Number(url.searchParams.get('limit')) || 60 }), null, 2)), true;
    if (p === '/api/logs/classes') return send(res, 200, 'application/json', JSON.stringify(logs.classes(), null, 2)), true;
    if (p === '/api/logs/retention') return send(res, 200, 'application/json', JSON.stringify(logs.retention({ days: Number(url.searchParams.get('days')) || 90 }), null, 2)), true;
    if (p === '/api/logs/clicks') return send(res, 200, 'application/json', JSON.stringify(logs.clickReport({ days: Number(url.searchParams.get('days')) || 30 }), null, 2)), true;
    if (p === '/api/logs/revenue') return send(res, 200, 'application/json', JSON.stringify(logs.revenueReport({ months: Number(url.searchParams.get('months')) || 12 }), null, 2)), true;
    if (p === '/api/logs/summary') return send(res, 200, 'application/json', JSON.stringify(logs.summary(), null, 2)), true;
    if (p === '/api/logs/click' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, logs.recordClick(body)), true; }
    if (p === '/api/logs/click') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/logs/click', 'Gemessenen Klick-Wert eintragen (Aufrufe, Klicks, Verweildauer, Absprünge)', { page: '/master-web-empire/01_igaming_toplists', date: '2026-10-16', views: 240, clicks: 31, dwell_s: 84, bounces: 90 }), null, 2)), true;
    if (p === '/api/logs/revenue-row' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, logs.recordRevenue(body)), true; }
    if (p === '/api/logs/revenue-row') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/logs/revenue-row', 'Einnahme erfassen (Art: ABO, VERKAUF, WERBUNG, FOERDERUNG, PLATTFORM, LIZENZ, SONSTIG)', { month: '2026-10', kind: 'ABO', amount: 129.0, costs: 22.0, proof: 'Beleg 2026-014' }), null, 2)), true;

    // ---- Text und Reim ----
    if (p === '/api/music/lyrics/status') return send(res, 200, 'application/json', JSON.stringify(lyricWriter.status(), null, 2)), true;
    if (p === '/api/music/lyrics/structures') return send(res, 200, 'application/json', JSON.stringify(lyricWriter.actions.structures(), null, 2)), true;
    if (p === '/api/music/lyrics/drafts') return send(res, 200, 'application/json', JSON.stringify(lyricWriter.actions.drafts(), null, 2)), true;
    if (p === '/api/music/lyrics/draft') return send(res, 200, 'application/json', JSON.stringify(lyricWriter.actions.draft({ id: url.searchParams.get('id') }), null, 2)), true;
    if (p === '/api/music/lyrics/rhymes') return send(res, 200, 'application/json', JSON.stringify(lyricWriter.rhymes({ word: url.searchParams.get('word') || 'Nacht', lang: url.searchParams.get('lang') || 'de' }), null, 2)), true;
    if (p === '/api/music/lyrics/rhyme-add' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, lyricWriter.actions.rhyme_add(body)), true; }
    if (p === '/api/music/lyrics/rhyme-add') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/music/lyrics/rhyme-add', 'Reime ergänzen', { ending: 'acht', words: ['Pracht', 'Schlacht'], lang: 'de' }), null, 2)), true;
    if (p === '/api/music/lyrics/write' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, lyricWriter.write(body)), true; }
    if (p === '/api/music/lyrics/write') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/music/lyrics/write', 'Textgerüst schreiben (Aufbau, Reim, Silben, Haken)', { subject: 'Aufbruch aus der Creed Street', structure: 'popsong', mood: 'aufbruch', lang: 'de' }), null, 2)), true;

    // ---- Musik-Abteilungen ----
    if (p === '/api/music/departments/status') return send(res, 200, 'application/json', JSON.stringify(musicDepartments.status(), null, 2)), true;
    if (p === '/api/music/departments/list') return send(res, 200, 'application/json', JSON.stringify(musicDepartments.actions.departments(), null, 2)), true;
    if (p === '/api/music/departments/board') return send(res, 200, 'application/json', JSON.stringify(musicDepartments.board(), null, 2)), true;
    if (p === '/api/music/departments/tickets') return send(res, 200, 'application/json', JSON.stringify(musicDepartments.actions.list({ department: url.searchParams.get('department') || undefined }), null, 2)), true;
    if (p === '/api/music/departments/ticket' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, musicDepartments.ticket(body)), true; }
    if (p === '/api/music/departments/ticket') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/music/departments/ticket', 'Vorgang in einer Abteilung anlegen', { department: 'mischung', task: 'Creed Street Mix v3', song: 'Creed Street' }), null, 2)), true;
    if (p === '/api/music/departments/advance' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, musicDepartments.advance(body)), true; }
    if (p === '/api/music/departments/advance') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/music/departments/advance', 'Nächsten Schritt gehen — Abschluss nur mit Mensch (human: true)', { id: '<kennung>', human: false }), null, 2)), true;

    // ---- Song-Orchester („Suno"-Arbeitsweise) ----
    if (p === '/api/music/orchestrator/status') return send(res, 200, 'application/json', JSON.stringify(orchestrator.status(), null, 2)), true;
    if (p === '/api/music/orchestrator/styles') return send(res, 200, 'application/json', JSON.stringify(orchestrator.actions.styles(), null, 2)), true;
    if (p === '/api/music/orchestrator/plans') return send(res, 200, 'application/json', JSON.stringify(orchestrator.actions.plans(), null, 2)), true;
    if (p === '/api/music/orchestrator/renders') return send(res, 200, 'application/json', JSON.stringify(orchestrator.actions.renders(), null, 2)), true;
    if (p === '/api/music/orchestrator/plan' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, orchestrator.plan(body)), true; }
    if (p === '/api/music/orchestrator/plan') {
      const pid = url.searchParams.get('id');
      if (pid) return send(res, 200, 'application/json', JSON.stringify(orchestrator.actions.plan_get({ id: pid }), null, 2)), true;
      return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/music/orchestrator/plan', 'Aus einer Beschreibung einen vollständigen Bauplan machen (Aufbau, Ketten, Text, Prüfschritte)', { prompt: 'dunkler Trap mit Schlager-Piano, 140 bpm', minutes: 3, variants: 3, lyrics: true }), null, 2)), true;
    }
    if (p === '/api/music/orchestrator/render' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, orchestrator.render(body)), true; }
    if (p === '/api/music/orchestrator/render') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/music/orchestrator/render', 'Plan rendern: Varianten + Stems als echte Dateien, Prüflauf, Ablage im Speicher', { id: '<plan>', variants: 3, stems: true, department: 'produktion' }), null, 2)), true;

    // ---- Rundbrief ----
    if (p === '/api/newsletter/status') return send(res, 200, 'application/json', JSON.stringify(newsletter.status(), null, 2)), true;
    if (p === '/api/newsletter/campaigns') return send(res, 200, 'application/json', JSON.stringify(newsletter.actions.campaigns(), null, 2)), true;
    if (p === '/api/newsletter/sends') return send(res, 200, 'application/json', JSON.stringify(newsletter.actions.sends(), null, 2)), true;
    if (p === '/api/newsletter/list') return send(res, 200, 'application/json', JSON.stringify(newsletter.actions.list({ state: url.searchParams.get('state') || undefined }), null, 2)), true;
    if (p === '/api/newsletter/provider') return send(res, 200, 'application/json', JSON.stringify(newsletter.actions.provider(), null, 2)), true;
    if (p === '/api/newsletter/confirm') return send(res, 200, 'application/json', JSON.stringify(newsletter.confirm({ token: url.searchParams.get('token') }), null, 2)), true;
    if (p === '/api/newsletter/subscribe' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, newsletter.subscribe(body)), true; }
    if (p === '/api/newsletter/subscribe') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/newsletter/subscribe', 'Anmelden mit doppelter Bestätigung (ohne Klick wird nichts gesendet)', { mail: 'freund@beispiel.de', topics: ['MUSIK', 'WERKSTATT'], source: 'webseite' }), null, 2)), true;
    if (p === '/api/newsletter/unsubscribe' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, newsletter.unsubscribe(body)), true; }
    if (p === '/api/newsletter/unsubscribe') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/newsletter/unsubscribe', 'Abmelden in einem Klick, ohne Rückfrage', { mail: 'freund@beispiel.de' }), null, 2)), true;
    if (p === '/api/newsletter/campaign' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, newsletter.campaign(body)), true; }
    if (p === '/api/newsletter/campaign') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/newsletter/campaign', 'Rundbrief anlegen (Betreff, Text, Interessengebiet)', { subject: 'Neuer Song ist draußen', body: 'Creed Street im Oktober …', topic: 'MUSIK' }), null, 2)), true;
    if (p === '/api/newsletter/send' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, newsletter.send(body)), true; }
    if (p === '/api/newsletter/send') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/newsletter/send', 'Versandplan bauen — ohne Versandweg wird nichts verschickt', { id: '<rundbrief>' }), null, 2)), true;

    // ---- Recht: AGB, Datenschutz, Impressum, Widerruf, Lizenzen, Support-Knopf ----
    if (p === '/api/legal/status') return send(res, 200, 'application/json', JSON.stringify(legal.status(), null, 2)), true;
    if (p === '/api/legal/list') return send(res, 200, 'application/json', JSON.stringify(legal.list(), null, 2)), true;
    if (p === '/api/legal/digest') return send(res, 200, 'application/json', JSON.stringify(legal.actions.digest({ id: url.searchParams.get('id') || 'agb' }), null, 2)), true;
    if (p === '/api/legal/markdown') return send(res, 200, 'text/markdown; charset=utf-8', legal.markdown(url.searchParams.get('id') || undefined, {}).markdown), true;
    if (p === '/api/legal/licenses') return send(res, 200, 'application/json', JSON.stringify({ ok: true, doc: legal.digest('lizenzen'), markdown: legal.markdown('lizenzen', { with_support: false }).markdown }, null, 2)), true;
    if (p === '/api/legal/button') return send(res, 200, 'application/json', JSON.stringify(legal.supportButton({ lang: url.searchParams.get('lang') || undefined }), null, 2)), true;
    if (p === '/api/legal/accepted') return send(res, 200, 'application/json', JSON.stringify(legal.accepted(url.searchParams.get('who') || undefined), null, 2)), true;
    if (p === '/api/legal/accept' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, legal.accept(body)), true; }
    if (p === '/api/legal/accept') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/legal/accept', 'Zustimmung festhalten (an die Fassung gebunden)', { who: 'Sabr47', docs: ['agb', 'datenschutz'] }), null, 2)), true;

    // ---- Weißbuch mit Prüfbericht und Fahrplan ----
    if (p === '/api/whitepaper/status') return send(res, 200, 'application/json', JSON.stringify(whitepaper.status(), null, 2)), true;
    if (p === '/api/whitepaper/markdown') return send(res, 200, 'text/markdown; charset=utf-8', whitepaper.markdown({}).markdown), true;
    if (p === '/api/whitepaper/page') { const pg = whitepaper.page({}); return send(res, 200, 'text/html; charset=utf-8', pg.html), true; }
    if (p === '/api/whitepaper/audit') return send(res, 200, 'application/json', JSON.stringify(whitepaper.audit(), null, 2)), true;
    if (p === '/api/whitepaper/roadmap') return send(res, 200, 'application/json', JSON.stringify(whitepaper.roadmap(), null, 2)), true;
    if (p === '/api/whitepaper/versions') return send(res, 200, 'application/json', JSON.stringify(whitepaper.actions.versions(), null, 2)), true;

    // ---- Ideenkatalog (5 Nischen × 50) ----
    if (p === '/api/ideas/status') return send(res, 200, 'application/json', JSON.stringify(ideaCatalog.status(), null, 2)), true;
    if (p === '/api/ideas/niches') return send(res, 200, 'application/json', JSON.stringify(ideaCatalog.actions.niches(), null, 2)), true;
    if (p === '/api/ideas/adopted') return send(res, 200, 'application/json', JSON.stringify(ideaCatalog.adopted(), null, 2)), true;
    if (p === '/api/ideas/item') return send(res, 200, 'application/json', JSON.stringify(ideaCatalog.actions.item({ name: url.searchParams.get('name') }), null, 2)), true;
    if (p === '/api/ideas/list') return send(res, 200, 'application/json', JSON.stringify(ideaCatalog.list({ niche: url.searchParams.get('niche') || undefined, full: url.searchParams.get('full') === '1' }), null, 2)), true;

    // ---- Zahlungs-Validierungen (rechnen, nicht raten) ----
    if (p === '/api/paycheck/status') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.status(), null, 2)), true;
    if (p === '/api/paycheck/procedures') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.actions.procedures(), null, 2)), true;
    if (p === '/api/paycheck/history') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.actions.history(), null, 2)), true;
    if (p === '/api/paycheck/iban') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.iban(url.searchParams.get('iban')), null, 2)), true;
    if (p === '/api/paycheck/bic') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.bic(url.searchParams.get('bic')), null, 2)), true;
    if (p === '/api/paycheck/vat') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.vatDe(url.searchParams.get('vat')), null, 2)), true;
    if (p === '/api/paycheck/amount') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.amount({ amount: url.searchParams.get('amount'), currency: url.searchParams.get('currency') || 'EUR' }), null, 2)), true;
    if (p === '/api/paycheck/coupon') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.coupon(url.searchParams.get('coupon')), null, 2)), true;
    if (p === '/api/paycheck/validate' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, paymentCheck.validate(body)), true; }
    if (p === '/api/paycheck/validate') return send(res, 200, 'application/json', JSON.stringify(r5Info('/api/paycheck/validate', 'Zahlungsdaten prüfen: Karte (Luhn), IBAN (Mod 97), BIC, USt-IdNr., Betrag, Mandat, Gutschein. Kartennummern werden nach der Prüfung verworfen — nur Marke und letzte vier Stellen kommen zurück.', { method: 'karte', purpose: 'ABO', amount: '29,99', currency: 'EUR', card: { number: '4111111111111111', cvc: '123', exp: '12/28' } }), null, 2)), true;
    if (p === '/api/paycheck/coupon-make' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, paymentCheck.actions.coupon_make(body)), true; }
    if (p === '/api/paycheck/coupon-make') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.actions.coupon_make({ seed: url.searchParams.get('seed') }), null, 2)), true;
    if (p === '/api/paycheck/creditor-make' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, paymentCheck.actions.creditor_make(body)), true; }
    if (p === '/api/paycheck/creditor-make') return send(res, 200, 'application/json', JSON.stringify(paymentCheck.actions.creditor_make({ seed: url.searchParams.get('seed') }), null, 2)), true;

    // ---- Startintro im Browser ----
    if (p === '/api/intro/flash/status') return send(res, 200, 'application/json', JSON.stringify(flashIntro.status(), null, 2)), true;
    if (p === '/api/intro/flash/palettes') return send(res, 200, 'application/json', JSON.stringify(flashIntro.actions.palettes(), null, 2)), true;
    if (p === '/api/intro/flash/played') return send(res, 200, 'application/json', JSON.stringify(flashIntro.actions.played(), null, 2)), true;
    if (p === '/api/intro/flash/start') { const pg = flashIntro.page({}); return send(res, 200, 'text/html; charset=utf-8', pg.html), true; }
    if (p === '/api/intro/flash' && req.method === 'POST') { if (r5Guard(req, ctx, res)) return true; const body = await r5Body(req); return r5Send(res, flashIntro.build(body)), true; }
    if (p === '/api/intro/flash') return send(res, 200, 'application/json', JSON.stringify(flashIntro.build({ seconds: Number(url.searchParams.get('seconds')) || 10, palette: url.searchParams.get('palette') || 'creed', skippable: url.searchParams.get('skippable') !== '0' }), null, 2)), true;
  }

  // ---------- Vierte Ausbaustufe (Runde 6): Stilkatalog · Verteiler mit Original-Adressen · Podcast/Hörbuch/Audiobibel · Duett · Kamera-Regie · Effekte · Rohrleitungen · Sicherheit ----------
  {
    const r6Body = async (req) => { try { return JSON.parse((await readBody(req, 2e6)) || '{}'); } catch { return {}; } };
    const r6Send = (res, out) => { const st = out && typeof out.code === 'number' ? out.code : (out && out.ok === false ? 400 : 200); return send(res, st, 'application/json', JSON.stringify(out, null, 2)); };
    const r6Guard = (req, ctx, res) => { if (adminSoft(req, ctx)) return false; send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig.' })); return true; };
    const r6Info = (path, does, body) => ({ ok: true, path, method: 'POST mit JSON-Body (Admin-Token im Header x-aura-token)', does, body_example: body || null });
    const q = (k, d) => url.searchParams.get(k) || d;

    // ---- Intro nach Vorlage: Hirn-Hub in der Mitte, Strahlen zu fünf Feldern, in jedem Feld ein
    //      laufender Workflow, unten das Fundament. Vorschau als Einzelbilder, Video über ffmpeg. ----
    if (p === '/api/intro/agentic/status') return send(res, 200, 'application/json', JSON.stringify(agenticIntro.status(), null, 2)), true;
    if (p === '/api/intro/agentic/workflows') return send(res, 200, 'application/json', JSON.stringify(agenticIntro.actions.workflows(), null, 2)), true;
    if (p === '/api/intro/agentic/list') return send(res, 200, 'application/json', JSON.stringify(agenticIntro.list(), null, 2)), true;
    if (p === '/api/intro/agentic/build') return send(res, 200, 'application/json', JSON.stringify(agenticIntro.actions.build({ seconds: Number(q('seconds', 12)) }), null, 2)), true;
    if (p === '/api/intro/agentic/frame.png') {
      const r = agenticIntro.picture({ seconds: Number(q('seconds', 6)), width: Number(q('width', 1280)), height: Number(q('height', 720)) });
      return send(res, 200, 'image/png', r.png, { 'Cache-Control': 'no-store' }), true;
    }
    if (p === '/api/intro/agentic/frame') return send(res, 200, 'application/json', JSON.stringify(agenticIntro.actions.frame({ seconds: Number(q('seconds', 6)), width: Number(q('width', 1280)), height: Number(q('height', 720)) }), null, 2)), true;
    if (p === '/api/intro/agentic/start') { const pg = agenticIntro.page({ seconds: Number(q('seconds', 12)) }); return send(res, 200, 'text/html; charset=utf-8', pg.html), true; }
    if (p === '/api/intro/agentic' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, await agenticIntro.render(body)), true; }
    if (p === '/api/intro/agentic') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/intro/agentic', 'Intro „Agentic AI" rendern: Hirn-Hub, fünf Felder mit laufendem Workflow, Fundament. Ton aus dem eigenen Musik-Renderer, ffmpeg kodiert zu MP4.', { seconds: 12, fps: 25, width: 1280, height: 720, out_width: 1920, out_height: 1080, music_style: 'cinematic' }), null, 2)), true;

    // ---- Meilensteine: wer Zeit, Sessions, Tage, Werke und Klicks sammelt, bekommt Stufen verliehen ----
    if (p === '/api/milestones/kurz') return send(res, 200, 'application/json', JSON.stringify(milestones.kurz(q('user', 'gast')))), true;
    if (p === '/api/milestones/katalog') return send(res, 200, 'application/json', JSON.stringify(milestones.katalog(), null, 2)), true;
    if (p === '/api/milestones/status') return send(res, 200, 'application/json', JSON.stringify(milestones.status(q('user', 'gast')), null, 2)), true;
    if (p === '/api/milestones/track' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return send(res, 200, 'application/json', JSON.stringify(milestones.track(body.user || 'gast', body.event, body.wert, body), null, 2)), true; }
    if (p === '/api/milestones/track') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/milestones/track', 'Ereignis melden: zeit (Minuten), session, tag, inhalt, klick. Antwort trägt aktuelle Werte und neu verliehene Meilensteine.', { user: 'gast', event: 'zeit', wert: 1, session: 's1' }), null, 2)), true;
    if (p === '/api/milestones/check' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return send(res, 200, 'application/json', JSON.stringify({ ok: true, neu: milestones.pruefen(body.user || 'gast') }, null, 2)), true; }
    if (p === '/meilensteine' || p === '/api/milestones/page') return send(res, 200, 'text/html; charset=utf-8', milestones.page(q('user', 'gast'))), true;

    // ---- Install-Stand als Download: damit ein fremder Rechner den Stand in EINER Zeile holen kann ----
    if (p === '/api/stand/patch') {
      const f = require('path').join(__dirname, '..', '..', '..', 'ARBEITSSTAND.patch');
      if (fs.existsSync(f)) {
        const st = fs.statSync(f);
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="ARBEITSSTAND.patch"', 'content-length': st.size, 'x-aura-security': 'headers-on' });
        fs.createReadStream(f).pipe(res);
        return true;
      }
      return send(res, 404, 'application/json', JSON.stringify({ error: 'Patch-Datei nicht gefunden — in der Session neu bauen mit: git format-patch 2e407b0..HEAD --stdout > ARBEITSSTAND.patch' })), true;
    }
    if (p === '/api/stand/tar.gz') {
      const f = require('path').join(__dirname, '..', '..', '..', 'dist-stand', 'aura-stand.tar.gz');
      if (fs.existsSync(f)) {
        const st = fs.statSync(f);
        res.writeHead(200, { 'content-type': 'application/gzip', 'content-disposition': 'attachment; filename="aura-stand.tar.gz"', 'content-length': st.size, 'x-aura-security': 'headers-on' });
        fs.createReadStream(f).pipe(res);
        return true;
      }
      return send(res, 404, 'application/json', JSON.stringify({ error: 'Stand-Datei nicht gefunden' })), true;
    }

    // ---- Install-Skript als Ein-Zeiler: keine && oder ; beim Kopieren nötig ----
    if (p === '/api/stand/install.sh') {
      const script = [
        '#!/usr/bin/env bash',
        '# AURA Ein-Zeilen-Install: Stand holen, neuer Ordnerzweig, Installer. Ziel/Port per Umgebungsvariable.',
        'set -euo pipefail',
        'H="' + String(req.headers.host || '127.0.0.1:8080') + '"',
        'QUELLE="${AURA_QUELLE:-}"',
        'if [ -z "$QUELLE" ]; then QUELLE="https://$H"; fi',
        'hole() { curl -fsSL "$QUELLE/api/stand/tar.gz" || curl -fsSL "http://$H/api/stand/tar.gz"; }',
        'D="${AURA_DIR:-$HOME/aura-zweig-1}"',
        'P="${PORT:-8090}"',
        'echo ">> hole Stand von $QUELLE nach $D (Port $P)"',
        'mkdir -p "$D"',
        'hole | tar xz -C "$D"',
        'cd "$D"',
        'AURA_DIR="$D" PORT="$P" RUN_VALIDATE=1 bash deploy/master-install.sh',
        ''
      ].join('\n');
      return send(res, 200, 'text/plain; charset=utf-8', script), true;
    }

    // ---- Verbund: Concat-Repos, Cross-Chain über alle Abteilungen, Montage offen, n8n-Katalog ----
    if (p === '/api/verbund') return send(res, 200, 'application/json', JSON.stringify(verbundLib.status(), null, 2)), true;
    if (p === '/api/verbund/kette') return send(res, 200, 'application/json', JSON.stringify(verbundLib.kette(), null, 2)), true;
    if (p === '/api/n8n/workflows') return send(res, 200, 'application/json', JSON.stringify(verbundLib.n8nWorkflows(), null, 2)), true;
    if (p === '/api/montage/status') return send(res, 200, 'application/json', JSON.stringify(verbundLib.montage(), null, 2)), true;
    if (p === '/montage') return send(res, 200, 'text/html; charset=utf-8', verbundLib.pageMontage()), true;

    // ---- Stilkatalog: jeder gängige Stil mit Tempo, Takt, Instrumenten und Renderer-Zuordnung ----
    if (p === '/api/styles/status') return send(res, 200, 'application/json', JSON.stringify(styles.status(), null, 2)), true;
    if (p === '/api/styles/list') return send(res, 200, 'application/json', JSON.stringify(styles.actions.list({ family: q('family', undefined), full: url.searchParams.get('full') === '1' }), null, 2)), true;
    if (p === '/api/styles/families') return send(res, 200, 'application/json', JSON.stringify(styles.actions.families(), null, 2)), true;
    if (p === '/api/styles/get') return send(res, 200, 'application/json', JSON.stringify(styles.actions.get({ id: q('id', '') }), null, 2)), true;
    if (p === '/api/styles/match') return send(res, 200, 'application/json', JSON.stringify(styles.read(q('text', '')) || { ok: false, error: 'Kein Stil im Text erkannt' }, null, 2)), true;
    if (p === '/api/styles/render-plan') return send(res, 200, 'application/json', JSON.stringify(styles.toRender(q('id', q('text', 'pop')), { bars: Number(q('bars', '8')) }), null, 2)), true;

    // ---- Verteiler: Original-Adressen, gerade Wege, Kennungen ----
    if (p === '/api/dist/status') return send(res, 200, 'application/json', JSON.stringify(distributors.status(), null, 2)), true;
    if (p === '/api/dist/list') return send(res, 200, 'application/json', JSON.stringify(distributors.list({ kind: q('kind', undefined), full: url.searchParams.get('full') === '1' }), null, 2)), true;
    if (p === '/api/dist/links') return send(res, 200, 'application/json', JSON.stringify(distributors.links({ kind: q('kind', undefined) }), null, 2)), true;
    if (p === '/api/dist/get') return send(res, 200, 'application/json', JSON.stringify(distributors.actions.get({ id: q('id', '') }), null, 2)), true;
    if (p === '/api/dist/straight') return send(res, 200, 'application/json', JSON.stringify(distributors.straightLine(q('kind', 'podcast')), null, 2)), true;
    if (p === '/api/dist/straight-lines') return send(res, 200, 'application/json', JSON.stringify(distributors.actions.straight_lines(), null, 2)), true;
    if (p === '/api/dist/kinds') return send(res, 200, 'application/json', JSON.stringify(distributors.actions.kinds(), null, 2)), true;
    if (p === '/api/dist/ean') return send(res, 200, 'application/json', JSON.stringify(distributors.ean13(q('prefix', '426'), q('number', '000000001')), null, 2)), true;
    if (p === '/api/dist/isrc') return send(res, 200, 'application/json', JSON.stringify(distributors.isrc({ country: q('country', 'DE'), registrant: q('registrant', 'CSX'), year: q('year', '26'), number: q('number', '1') }), null, 2)), true;

    // ---- Gesprochenes Wort: Podcast · Hörbuch · Audiobibel ----
    if (p === '/api/spoken/status') return send(res, 200, 'application/json', JSON.stringify(spoken.status(), null, 2)), true;
    if (p === '/api/spoken/formats') return send(res, 200, 'application/json', JSON.stringify(spoken.actions.formats(), null, 2)), true;
    if (p === '/api/spoken/bible') return send(res, 200, 'application/json', JSON.stringify(spoken.bibleBooks({ testament: q('testament', undefined) }), null, 2)), true;
    if (p === '/api/spoken/productions') return send(res, 200, 'application/json', JSON.stringify(spoken.actions.productions(), null, 2)), true;
    if (p === '/api/spoken/feeds') return send(res, 200, 'application/json', JSON.stringify(spoken.actions.feeds(), null, 2)), true;
    if (p === '/api/spoken/readings') return send(res, 200, 'application/json', JSON.stringify(spoken.actions.readings(), null, 2)), true;
    if (p === '/api/spoken/reading-time' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.readingTime(body.text, body)), true; }
    if (p === '/api/spoken/reading-time') return send(res, 200, 'application/json', JSON.stringify(spoken.readingTime(q('text', 'Ein Satz zum Messen.'), { chapters: Number(q('chapters', '0')) }), null, 2)), true;
    if (p === '/api/spoken/outline' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.outline(body)), true; }
    if (p === '/api/spoken/podcast' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.podcastEpisode(body)), true; }
    if (p === '/api/spoken/podcast') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/spoken/podcast', 'Podcast-Folge planen: Abschnitte, Kapitelmarken in Sekunden, Stimmen, Bett aus dem Stilkatalog.', { title: 'Folge 1: Der erste Ton', format: 'interview', minutes: 30, voices: ['moderator', 'gast'] }), null, 2)), true;
    if (p === '/api/spoken/feed' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.podcastFeed(body)), true; }
    if (p === '/api/spoken/feed') return send(res, 200, 'application/json', JSON.stringify(spoken.podcastFeed({ title: q('title', 'Creed Street Podcast'), base_url: q('base', 'https://example.invalid') }), null, 2)), true;
    if (p === '/api/spoken/feed.xml') { const f = spoken.podcastFeed({ title: q('title', 'Creed Street Podcast'), base_url: q('base', 'https://example.invalid') }); return send(res, 200, 'application/rss+xml; charset=utf-8', f.xml), true; }
    if (p === '/api/spoken/audiobook' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.audiobook(body)), true; }
    if (p === '/api/spoken/audiobook') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/spoken/audiobook', 'Hörbuch aus Text: Teile, Kapitel, Lesezeit je Kapitel, Aufnahmeplan, UPC, Lautheitsziel.', { title: 'Beispielhörbuch', author: 'Creed Street', text: 'Kapitel 1\n\nText …' }), null, 2)), true;
    if (p === '/api/spoken/bible-plan' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.biblePlan(body)), true; }
    if (p === '/api/spoken/bible-plan') return send(res, 200, 'application/json', JSON.stringify(spoken.biblePlan({ days: Number(q('days', '365')), from: q('from', 'Genesis') }), null, 2)), true;
    if (p === '/api/spoken/bible-progress' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.actions.bible_progress(body)), true; }
    if (p === '/api/spoken/measure' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, spoken.measure(body.file), true); }
    if (p === '/api/spoken/measure') return send(res, 200, 'application/json', JSON.stringify(spoken.measure(q('file', '')), null, 2)), true;

    // ---- Duett: zu zweit singen ----
    if (p === '/api/duet/status') return send(res, 200, 'application/json', JSON.stringify(duet.status(), null, 2)), true;
    if (p === '/api/duet/styles') return send(res, 200, 'application/json', JSON.stringify(duet.actions.styles(), null, 2)), true;
    if (p === '/api/duet/sessions') return send(res, 200, 'application/json', JSON.stringify(duet.actions.sessions(), null, 2)), true;
    if (p === '/api/duet/renders') return send(res, 200, 'application/json', JSON.stringify(duet.actions.renders(), null, 2)), true;
    if (p === '/api/duet/analyze') return send(res, 200, 'application/json', JSON.stringify(duet.actions.analyze({ file: q('file', '') }), null, 2)), true;
    if (p === '/api/duet/pitch-profile') return send(res, 200, 'application/json', JSON.stringify(duet.actions.pitch_profile({ file: q('file', ''), segments: Number(q('segments', '8')) }), null, 2)), true;
    if (p === '/api/duet/notes') return send(res, 200, 'application/json', JSON.stringify(duet.actions.notes({ hz: q('hz', '') }), null, 2)), true;
    if (p === '/api/duet/session' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, duet.session(body)), true; }
    if (p === '/api/duet/session') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/duet/session', 'Duett-Sitzung anlegen. Ohne Einverständnis der zweiten Person (consent: true) wird nichts gerechnet.', { partner: 'Freundin', style: 'terz', song: 'Zweite Stimme', consent: true }), null, 2)), true;
    if (p === '/api/duet/take' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, duet.take(body)), true; }
    if (p === '/api/duet/take') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/duet/take', 'Aufnahme an eine Sitzung hängen (WAV-Datei auf diesem Rechner).', { id: 'du-xxxxxx', who: 'ich', file: '/pfad/aufnahme.wav' }), null, 2)), true;
    if (p === '/api/duet/mix' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, duet.duet(body)), true; }
    if (p === '/api/duet/mix') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/duet/mix', 'Ausrichten, Stimmen ziehen, Harmonie, Dopplung, Mischen, Messen. Höchstens zwei Halbtöne Korrektur je Stimme.', { id: 'du-xxxxxx', style: 'terz', key: 'A', mode: 'moll' }), null, 2)), true;

    // ---- Kamera-Regie ----
    if (p === '/api/cam/status') return send(res, 200, 'application/json', JSON.stringify(camera.status(), null, 2)), true;
    if (p === '/api/cam/catalog') return send(res, 200, 'application/json', JSON.stringify(camera.actions.catalog(), null, 2)), true;
    if (p === '/api/cam/storyboards') return send(res, 200, 'application/json', JSON.stringify(camera.actions.storyboards(), null, 2)), true;
    if (p === '/api/cam/optics') return send(res, 200, 'application/json', JSON.stringify(camera.optics({ sensor: q('sensor', 'vollformat'), focal: Number(q('focal', '50')), distance_m: Number(q('distance', '3')) || undefined, aperture: Number(q('aperture', '2.8')) }), null, 2)), true;
    if (p === '/api/cam/motion') return send(res, 200, 'application/json', JSON.stringify(camera.motion({ movement: q('movement', 'schwenk'), degrees: Number(q('degrees', '45')), speed_deg_s: Number(q('speed', '8')) || undefined, seconds: Number(q('seconds', '6')) || undefined }), null, 2)), true;
    if (p === '/api/cam/cutting') return send(res, 200, 'application/json', JSON.stringify(camera.cutting({ minutes: Number(q('minutes', '5')), avg_shot_seconds: Number(q('avg', '6')) }), null, 2)), true;
    if (p === '/api/cam/axis') return send(res, 200, 'application/json', JSON.stringify(camera.axisCheck({ positions_m: { a_cam_x: Number(q('a_x', '2')), b_cam_x: Number(q('b_x', '-3')), person_x: Number(q('person_x', '0')) } }), null, 2)), true;
    if (p === '/api/cam/format') return send(res, 200, 'application/json', JSON.stringify(camera.formatPlan({ ratio: q('ratio', '16:9'), height: Number(q('height', '1080')), fps: Number(q('fps', '25')), seconds: Number(q('seconds', '600')) }), null, 2)), true;
    if (p === '/api/cam/maximize') return send(res, 200, 'application/json', JSON.stringify(camera.maximize({ minutes: Number(q('minutes', '10')), existing_shots: Number(q('shots', '20')) }), null, 2)), true;
    if (p === '/api/cam/storyboard' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, camera.storyboard(body)), true; }
    if (p === '/api/cam/storyboard') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/cam/storyboard', 'Einstellungsliste aus Szenen bauen: Größe, Bewegung, Licht, Kadrierung, Prüfliste.', { scenes: [{ name: 'Ankunft', minutes: 2 }, { name: 'Gespräch', minutes: 4 }], style: 'mittel' }), null, 2)), true;
    if (p === '/api/cam/day' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, camera.shootDay(body)), true; }
    if (p === '/api/cam/day') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/cam/day', 'Drehtag mit Zeitfenstern, Puffern und Reihenfolge.', { start: '09:00', scenes: [{ name: 'Außen', minutes: 60 }, { name: 'Interview', minutes: 90 }] }), null, 2)), true;

    // ---- Effekte und Specials ----
    if (p === '/api/fx/status') return send(res, 200, 'application/json', JSON.stringify(effects.status(), null, 2)), true;
    if (p === '/api/fx/list') return send(res, 200, 'application/json', JSON.stringify(effects.search({ q: q('q', undefined), family: q('family', undefined) }), null, 2)), true;
    if (p === '/api/fx/families') return send(res, 200, 'application/json', JSON.stringify(effects.actions.families(), null, 2)), true;
    if (p === '/api/fx/presets') return send(res, 200, 'application/json', JSON.stringify(effects.actions.presets(), null, 2)), true;
    if (p === '/api/fx/get') return send(res, 200, 'application/json', JSON.stringify(effects.actions.get({ id: q('id', '') }), null, 2)), true;
    if (p === '/api/fx/check') return send(res, 200, 'application/json', JSON.stringify(effects.checkFilter(q('filter', 'gblur=sigma=6')), null, 2)), true;
    if (p === '/api/fx/chain' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, effects.chain(body)), true; }
    if (p === '/api/fx/chain') return send(res, 200, 'application/json', JSON.stringify(effects.chain({ effects: (q('effects', 'farbe-grundlook,stoerung-filmkorn,schnitt-blende')).split(',') }), null, 2)), true;
    if (p === '/api/fx/preset') return send(res, 200, 'application/json', JSON.stringify(effects.applyPreset({ preset: q('preset', 'musikvideo-nacht') }), null, 2)), true;

    // ---- Rohrleitungen (alle Straßen des Hauses) ----
    if (p === '/api/pipes/status') return send(res, 200, 'application/json', JSON.stringify(pipes.status(), null, 2)), true;
    if (p === '/api/pipes/list') return send(res, 200, 'application/json', JSON.stringify(pipes.list({ area: q('area', undefined) }), null, 2)), true;
    if (p === '/api/pipes/get') return send(res, 200, 'application/json', JSON.stringify(pipes.actions.get({ id: q('id', '') }), null, 2)), true;
    if (p === '/api/pipes/coverage') return send(res, 200, 'application/json', JSON.stringify(pipes.coverage(), null, 2)), true;
    if (p === '/api/pipes/runs') return send(res, 200, 'application/json', JSON.stringify(pipes.actions.runs(), null, 2)), true;
    if (p === '/api/pipes/run' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, pipes.run(body)), true; }
    if (p === '/api/pipes/run') return send(res, 200, 'application/json', JSON.stringify(pipes.run({ pipe: q('pipe', 'podcast'), input: { title: q('title', 'Folge 1'), minutes: Number(q('minutes', '25')) } }), null, 2)), true;

    // ---- Sicherheit ----
    if (p === '/api/sec/status') return send(res, 200, 'application/json', JSON.stringify(security.status(), null, 2)), true;
    if (p === '/api/sec/roles') return send(res, 200, 'application/json', JSON.stringify(security.roleMatrix(), null, 2)), true;
    if (p === '/api/sec/inputs') return send(res, 200, 'application/json', JSON.stringify(security.scanInputs(), null, 2)), true;
    if (p === '/api/sec/store') return send(res, 200, 'application/json', JSON.stringify(security.scanStore({}), null, 2)), true;
    if (p === '/api/sec/incidents') return send(res, 200, 'application/json', JSON.stringify(security.actions.incidents(), null, 2)), true;
    if (p === '/api/sec/sweeps') return send(res, 200, 'application/json', JSON.stringify(security.actions.sweeps(), null, 2)), true;
    if (p === '/api/sec/kopfzeilen') return send(res, 200, 'application/json', JSON.stringify({ ok: true, headers: securityHeadersForInfo }), true);
    if (p === '/api/sec/secrets') return send(res, 200, 'application/json', JSON.stringify(security.scanSecrets({ limit: Number(q('limit', '600')) }), null, 2)), true;
    if (p === '/api/sec/kind') return send(res, 200, 'application/json', JSON.stringify(security.kindOf(q('file', '')), null, 2)), true;
    if (p === '/api/sec/sweep' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, await security.sweep(body)), true; }
    if (p === '/api/sec/sweep') return send(res, 200, 'application/json', JSON.stringify(await security.sweep({ limit: Number(q('limit', '800')), online: url.searchParams.get('online') !== '0' }), null, 2)), true;
    if (p === '/api/sec/upload' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, security.scanUpload(body), true); }
    if (p === '/api/sec/incident' && req.method === 'POST') { if (r6Guard(req, ctx, res)) return true; const body = await r6Body(req); return r6Send(res, security.incident(body)), true; }
    if (p === '/api/sec/incident') return send(res, 200, 'application/json', JSON.stringify(r6Info('/api/sec/incident', 'Vorfall führen: detect (erfassen) → isolate (sperren, Belege sichern) → decide (Mensch entscheidet).', { action: 'detect', what: 'Auffällige Anmeldungen', severity: 'MITTEL' }), null, 2)), true;

    // ---- Seiten: Stile als Knöpfe (Studio) und Werkstatt-Übersicht ----
    if (p === '/stile' || p === '/api/styles/page') {
      const st = styles.status();
      const fam = styles.FAMILIES.map((f) => ({
        id: f.id, name: f.name, count: f.styles.length,
        rows: f.styles.map((x) => ({ id: x.id, name: x.name, bpm: x.bpm[0], meter: x.meter, mood: x.mood, g: x.render.g, inst: x.instruments.slice(0, 3).join(', ') })),
      }));
      const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stile · Creed Street Studios</title>
<style>body{background:#0d0f14;color:#e9edf5;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 8px;color:#ffd200}.sub{color:#9aa4b8;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.card{background:#151922;border:1px solid #222836;border-radius:10px;padding:12px}.card b{display:block}.card small{color:#9aa4b8}.tags{color:#7fd1a0;font-size:12px;margin-top:6px}.btn{display:inline-block;margin-top:8px;padding:6px 10px;border-radius:8px;background:#ffd200;color:#111;text-decoration:none;font-weight:600;font-size:12px}a.plain{color:#8ab4ff;font-size:12px}</style></head><body>
<h1>Stilkatalog</h1><div class="sub">${st.families} Familien · ${st.styles} Stile · jeder Stil nennt Tempo, Takt, Instrumente, Stimmung, Herkunft und das Renderer-Gerüst. Knopf = fertiger Render-Plan.</div>
${fam.map((f) => `<h2>${f.name} <small>(${f.count})</small></h2><div class="grid">${f.rows.map((x) => `<div class="card"><b>${x.name}</b><small>${x.bpm} bpm · ${x.meter} · Gerüst ${x.g}</small><div class="tags">${x.mood}<br>${x.inst}</div><a class="btn" href="/api/styles/render-plan?id=${x.id}&amp;bars=8">Render-Plan</a> <a class="plain" href="/api/styles/get?id=${x.id}">Daten</a></div>`).join('')}</div>`).join('')}
</body></html>`;
      return send(res, 200, 'text/html; charset=utf-8', html), true;
    }
    if (p === '/werkstatt' || p === '/api/runde6/page') {
      const blocks = [
        { t: 'Meilensteine', s: milestones.statusRoute(), go: '/meilensteine' },
        { t: 'Podcast', s: spoken.status(), go: '/api/spoken/status' },
        { t: 'Hörbuch & Audiobibel', s: spoken.status(), go: '/api/spoken/bible-plan?days=365' },
        { t: 'Duett', s: duet.status(), go: '/api/duet/status' },
        { t: 'Kamera-Regie', s: camera.status(), go: '/api/cam/status' },
        { t: 'Effekte & Specials', s: effects.status(), go: '/api/fx/status' },
        { t: 'Verteiler', s: distributors.status(), go: '/api/dist/status' },
        { t: 'Rohrleitungen', s: pipes.status(), go: '/api/pipes/status' },
        { t: 'Sicherheit', s: security.status(), go: '/api/sec/status' },
      ];
      const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Werkstatt · Creed Street Studios</title>
<style>body{background:#0d0f14;color:#e9edf5;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px}h1{font-size:22px;margin:0 0 4px}.sub{color:#9aa4b8;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.card{background:#151922;border:1px solid #222836;border-radius:12px;padding:14px}.card b{color:#ffd200;font-size:15px}ul{margin:8px 0 0;padding-left:18px;color:#b9c2d4;font-size:13px}a{color:#8ab4ff}</style></head><body>
<h1>Werkstatt</h1><div class="sub">Runde 6: Podcast · Hörbücher · Audiobibeln · Verteiler mit Original-Adressen · Duett · Kamera · Effekte · alle Rohrleitungen · Sicherheit. <a href="/stile">Stilkatalog</a></div>
<div class="grid">${blocks.map((b) => `<div class="card"><b>${b.t}</b><ul>${Object.entries(b.s).slice(0, 5).map(([k, v]) => `<li>${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 70)}</li>`).join('')}</ul><a href="${b.go}">Rohdaten</a></div>`).join('')}</div>
</body></html>`;
      return send(res, 200, 'text/html; charset=utf-8', html), true;
    }

    // ---- Übersicht der neuen Bereiche (eine Seite, die alles auflistet) ----
    if (p === '/api/runde6/status') return send(res, 200, 'application/json', JSON.stringify({
      ok: true, area: 'ROUND6', state: 'live',
      bereiche: [
        { id: 'styles', path: '/api/styles/status', was: 'Jeder gängige Stil, auch fürs Studio und für die Rohrleitungen' },
        { id: 'dist', path: '/api/dist/status', was: 'Verteiler mit originalen Adressen und geraden Wegen' },
        { id: 'spoken', path: '/api/spoken/status', was: 'Podcast, Hörbuch, Audiobibel (Plan, Kapitel, Feed, Tonmessung)' },
        { id: 'duet', path: '/api/duet/status', was: 'Duett: ausrichten, stimmen, Harmonie, Dopplung, mischen' },
        { id: 'cam', path: '/api/cam/status', was: 'Kamera-Regie: Optik, Bewegung, Schnitt, Licht, Drehplan' },
        { id: 'fx', path: '/api/fx/status', was: 'Effekte und Specials mit geprüften Filterketten' },
        { id: 'pipes', path: '/api/pipes/status', was: 'Alle Rohrleitungen des Hauses' },
        { id: 'sec', path: '/api/sec/status', was: 'Sicherheit: prüfen, isolieren, entscheiden' },
        { id: 'intro2', path: '/api/intro/agentic/status', was: 'Intro nach Vorlage: Hirn-Hub, fünf Workflow-Felder, Fundament (Vorschau und Video)' },
      ],
      seiten: [
        { id: 'stile', path: '/stile', was: 'Stilkatalog als Seite mit Knöpfen (Render-Plan je Stil)' },
        { id: 'werkstatt', path: '/werkstatt', was: 'Werkstatt-Übersicht aller neuen Bereiche' },
        { id: 'intro', path: '/api/intro/agentic/start', was: 'Intro „Agentic AI" als laufende Vorschau (Hirn-Hub, fünf Felder, Fundament)' },
      ],
      counts: { styles: styles.status().styles, verteiler: distributors.status().total, rohre: pipes.status().pipes, effekte: effects.status().effects, stufen: pipes.status().stages },
      human_rule: 'Jede Rohrleitung endet bei einem Menschen. Kein Ausschluss, keine Veröffentlichung, keine Zahlung ohne Freigabe.',
    }, null, 2)), true;
  }

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
  if (p === '/api/testlab/suite' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(await testLab.suite(), null, 2)), true; }

  // ---------- Area 78: Telegram Agent ----------
  if (p === '/api/telegram/status') return send(res, 200, 'application/json', JSON.stringify(await telegramAgent.status(), null, 2)), true;
  if (p === '/api/telegram/probe' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(await telegramAgent.probe(), null, 2)), true; }
  if (p === '/api/telegram/start' && req.method === 'POST') {
    if (ops.isKilled()) return send(res, 423, 'application/json', JSON.stringify({ error: 'KILL SWITCH ENGAGED' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(await telegramAgent.startPoller(), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/telegram/stop' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(telegramAgent.stopPoller(), null, 2)), true; }

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
  if (p === '/api/ollama/probe' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(await ollamaManager.probe(), null, 2)), true; }
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
  if (p === '/api/yp/categories/delete' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/yp/ingest' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; try { return send(res, 200, 'application/json', JSON.stringify(yellowPages.ingestFromCatalog(), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
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
  if (p === '/api/yp/feed/delete' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/ollama/custom/remove' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/ollama/keys' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(ollamaManager.setKeys(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---------- Areas 09–15,18,26–31,34/35,37/38,40: neue Live-Module ----------
  if (p === '/api/media/status') return send(res, 200, 'application/json', JSON.stringify(mediaPipeline.status(), null, 2)), true;
  if (p === '/api/media/plan' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(mediaPipeline.plan(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/media/render' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await mediaPipeline.render(b), null, 2)), true; } catch (e) { return send(res, e.code || 400, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

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
  if (p === '/api/dispatch/flush' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(await dispatcher.flush(), null, 2)), true; }
  if (p === '/api/dispatch/list') return send(res, 200, 'application/json', JSON.stringify(dispatcher.list(), null, 2)), true;

  if (p === '/api/wordpress/status') return send(res, 200, 'application/json', JSON.stringify(wordpressBridge.status(), null, 2)), true;
  if (p === '/api/wordpress/publish' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await wordpressBridge.publishPost(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/n8n/status') return send(res, 200, 'application/json', JSON.stringify(n8nBridge.status(), null, 2)), true;
  if (p === '/api/n8n/webhook' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(n8nBridge.addWebhook(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/n8n/dispatch' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 3e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await n8nBridge.dispatch(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/ksync/status') return send(res, 200, 'application/json', JSON.stringify(knowledgeSync.status(), null, 2)), true;
  if (p === '/api/ksync/repo' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(knowledgeSync.addRepo(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/ksync/sync' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await knowledgeSync.syncRepo(String(b.owner || ''), String(b.repo || '')), null, 2)), true; } catch (e) { return send(res, e.code || 400, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/hardware/status') return send(res, 200, 'application/json', JSON.stringify(hardwareRouter.status(), null, 2)), true;
  if (p === '/api/hardware/device' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(hardwareRouter.addDevice(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/hardware/route' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(hardwareRouter.route(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/compute/status') return send(res, 200, 'application/json', JSON.stringify(computeRouter.status(), null, 2)), true;
  if (p === '/api/compute/node' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(computeRouter.registerNode(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/compute/submit' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(computeRouter.submitJob(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

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
  if (p === '/api/finance/usage' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(financeEngine.recordUsage(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/gateway/status') return send(res, 200, 'application/json', JSON.stringify(gatewayHealth.status(), null, 2)), true;
  if (p === '/api/gateway/check' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(await gatewayHealth.checkAll(), null, 2)), true; }
  if (p === '/api/gateway/report') return send(res, 200, 'application/json', JSON.stringify(gatewayHealth.report(), null, 2)), true;

  if (p === '/api/delivery/status') return send(res, 200, 'application/json', JSON.stringify(deliveryMonitor.status(), null, 2)), true;
  if (p === '/api/delivery/ingest' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(deliveryMonitor.ingestFromDispatcher(), null, 2)), true; }
  if (p === '/api/delivery/quota') return send(res, 200, 'application/json', JSON.stringify(deliveryMonitor.quota(), null, 2)), true;

  if (p === '/api/vision/status') return send(res, 200, 'application/json', JSON.stringify(visionBridge.status(), null, 2)), true;
  if (p === '/api/vision/analyze' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 9e6) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(await visionBridge.analyze(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }

  if (p === '/api/vault/status') return send(res, 200, 'application/json', JSON.stringify(vault.status(), null, 2)), true;
  if (p === '/api/vault/add' && req.method === 'POST') { let b; try { b = JSON.parse(await readBody(req, 1e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } try { return send(res, 200, 'application/json', JSON.stringify(vault.addSecret(b), null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/vault/list') return send(res, 200, 'application/json', JSON.stringify(vault.listSecrets(), null, 2)), true;
  if (p === '/api/vault/remove' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let b; try { b = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; } return send(res, 200, 'application/json', JSON.stringify(vault.removeSecret(String(b.name || '')), null, 2)), true; }

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
  if (p === '/api/sentinel/block' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
    let body; try { body = JSON.parse(await readBody(req, 1e4) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(sentinelWatch.block(String(body.ip || ''), body.reason), null, 2)), true; }
    catch (e) { return send(res, e.code || 400, 'application/json', JSON.stringify({ error: String(e.message || e) })), true; }
  }
  if (p === '/api/sentinel/unblock' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/a2a' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/intercom/meeting' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON body' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(await agentIntercom.meeting(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }
  if (p === '/api/intercom/clear' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/builder/simulate' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true;
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
  if (p === '/api/backups/restore' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    if (!body || typeof body.file !== 'string' || !body.file.trim()) return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'file fehlt: Name der Backup-Datei aus GET /api/backups nötig.' })), true;
    try { return send(res, 200, 'application/json', JSON.stringify(watcher.restore(body.file.trim()))), true; }
    catch (e) { return send(res, e.code || 400, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
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
  if (p === '/api/selfrepair/run' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true; return send(res, 200, 'application/json', JSON.stringify(selfRepair.runChecks(), null, 2)), true; }
  if (p === '/api/selfrepair/drill' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true; return send(res, 200, 'application/json', JSON.stringify(selfRepair.actions.simulate_error(), null, 2)), true; }

  // ---- Area 67: module containers (crash isolation) ----
  if (p === '/api/containers' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(containers.status(), null, 2)), true;
  if (p === '/api/containers/drill' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(containers.drill(String(body.area || '16'), body), null, 2)), true;
  }

  // ---- Area 70: central module system (manifest loader + lifecycle) ----
  if (p === '/api/modulehub' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.status(), null, 2)), true;
  if (p === '/api/modulehub/catalog' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(moduleSystem.actions.catalog(), null, 2)), true;
  if (p === '/api/modulehub/scan' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; return send(res, 200, 'application/json', JSON.stringify(moduleSystem.scan(), null, 2)), true; }
  // ---- Area 70: Dritt-Connector mit Fehlerfrei-Schleuse (Import prüft, der Mensch gibt frei) ----
  if (p === '/api/modulehub/import' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(moduleImport.status(), null, 2)), true;
  if (p === '/api/modulehub/import' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let body; try { body = JSON.parse(await readBody(req, 8e6) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; } try { const out = await moduleImport.importPackage(body); return send(res, out.ok ? 200 : 422, 'application/json', JSON.stringify(out, null, 2)), true; } catch (e) { return send(res, 500, 'application/json', JSON.stringify({ ok: false, error: String(e && e.message || e) })), true; } }
  if (p === '/api/modulehub/imports' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ mode: 'IMPORT_QUEUE', spec_version: moduleImport.status().spec_version, imports: moduleImport.list() }, null, 2)), true;
  if (p === '/api/modulehub/imports/discard' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; } const out = moduleImport.discard(String(body.id || '')); return send(res, out.ok ? 200 : 404, 'application/json', JSON.stringify(out, null, 2)), true; }
  const mh = p.match(/^\/api\/modulehub\/([a-z0-9_-]+)\/(approve|enable|disable|health)$/i);
  if (mh) {
    const id = mh[1].toLowerCase(), op = mh[2].toLowerCase();
    let body = {};
    if (req.method === 'POST') { try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; } }
    if (op === 'approve') {
      // Das bestehende Approve-Gate bleibt das EINZIGE Tor: wartet ein geprüfter Import,
      // wird er hier aus der Quarantäne installiert und danach wie jedes Modul freigegeben.
      if (body.on !== false) {
        const staged = moduleImport.installIfStaged(id);
        if (staged.installed) moduleSystem.scan();
        else if (staged.result && staged.result.ok === false) return send(res, 400, 'application/json', JSON.stringify(staged.result, null, 2)), true;
      }
      return send(res, 200, 'application/json', JSON.stringify(moduleSystem.approve(id, body.on), null, 2)), true;
    }
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

  // ---- Area 103: Selbstbearbeitungs-Werkbank (lokales Modell schreibt, Mensch entscheidet) ----
  if (p === '/api/selfwork/status' && req.method === 'GET') { try { return send(res, 200, 'application/json', JSON.stringify(await selfwork.status(), null, 2)), true; } catch (e) { return send(res, 500, 'application/json', JSON.stringify({ ok: false, error: String(e && e.message || e) })), true; } }
  if (p === '/api/selfwork/proposals' && req.method === 'GET') { try { return send(res, 200, 'application/json', JSON.stringify(selfwork.list(), null, 2)), true; } catch (e) { return send(res, 500, 'application/json', JSON.stringify({ ok: false, error: String(e && e.message || e) })), true; } }
  if (p === '/api/selfwork/propose' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let body; try { body = JSON.parse(await readBody(req, 2e5) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; } try { const out = await selfwork.propose(body); return send(res, out.ok ? 200 : 422, 'application/json', JSON.stringify(out, null, 2)), true; } catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; } }
  if (p === '/api/selfwork/apply' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; } try { const out = selfwork.apply(String(body.id || '')); return send(res, out.ok ? 200 : 400, 'application/json', JSON.stringify(out, null, 2)), true; } catch (e) { return send(res, 500, 'application/json', JSON.stringify({ ok: false, error: String(e && e.message || e) })), true; } }
  if (p === '/api/selfwork/revert' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true; let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; } try { const out = selfwork.revert(String(body.id || '')); return send(res, out.ok ? 200 : 400, 'application/json', JSON.stringify(out, null, 2)), true; } catch (e) { return send(res, 500, 'application/json', JSON.stringify({ ok: false, error: String(e && e.message || e) })), true; } }

  // ---- Area 68: global config ----
  if (p === '/api/config/schema') return send(res, 200, 'application/json', JSON.stringify(config.schema(), null, 2)), true;
  if (p === '/api/config' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ file: config.file, config: config.current() }, null, 2)), true;
  if (p === '/api/config' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, errors: ['invalid JSON'] })), true; }
    const r = config.set(body);
    return send(res, r.ok ? 200 : 400, 'application/json', JSON.stringify(r, null, 2)), true;
  }
  if (p === '/api/config/reset' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true; return send(res, 200, 'application/json', JSON.stringify(config.reset(), null, 2)), true; }

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

  // ---- Provider-independent repair guidance: local reads and human-run commands only ----
  if (p === '/api/repair/status' && req.method === 'GET') {
    try { return send(res, 200, 'application/json', JSON.stringify(await repair.status(), null, 2)), true; }
    catch (e) { return send(res, 500, 'application/json', JSON.stringify({ ok: false, error: String(e && e.message || e) })), true; }
  }
  if (p === '/api/repair/advise' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4) || '{}'); }
    catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(await repair.advise(body), null, 2)), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ ok: false, error: e.message })), true; }
  }

  // ---- AURA OS Intelligence (deterministic local operating briefings) ----
  if (p === '/api/jarvis' && req.method === 'POST') {
    let body; try { body = JSON.parse(await readBody(req, 2e4)); } catch { return send(res, 400, 'application/json', JSON.stringify({ ok: false, error: 'invalid JSON' })), true; }
    return send(res, 200, 'application/json', JSON.stringify(await jarvis.askAsync(body.msg || body.q || body.text || body.message || ''), null, 2)), true;
  }
  if (p === '/api/jarvis/memory') return send(res, 200, 'application/json', JSON.stringify(jarvis.memory(), null, 2)), true;

  // ---- Area 69: recursive learning core (max 1 failure per fingerprint) ----
  if (p === '/api/learning' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(learningCore.curve(), null, 2)), true;
  if (p === '/api/learning/simulate' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true; return send(res, 200, 'application/json', JSON.stringify(learningCore.actions.simulate(), null, 2)), true; }
  if (p === '/api/learning/outcome' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true;
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
  if (p === '/api/ops/super' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true; return send(res, 200, 'application/json', JSON.stringify(ops.runSuper() || { ok: true })), true; }
  if (p === '/api/ops/others' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true; return send(res, 200, 'application/json', JSON.stringify(ops.runOthers() || { ok: true })), true; }
  if (p === '/api/ops/sync' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true; return send(res, 200, 'application/json', JSON.stringify(ops.runFullSync() || { ok: true })), true; }
  if (p === '/api/kill' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht.' })), true;
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
  if (p === '/api/schedule/add' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true;
    const raw = await readBody(req); let body; try { body = JSON.parse(raw || '{}'); } catch { syntaxFail(); return send(res, 400, 'application/json', JSON.stringify({ error: 'invalid JSON' })), true; }
    try { return send(res, 200, 'application/json', JSON.stringify(registry.get('60').mod.add(body))), true; }
    catch (e) { return send(res, e.code || 500, 'application/json', JSON.stringify({ error: e.message })), true; }
  }
  if (p === '/api/schedule/remove' && req.method === 'POST') { if (!adminSoft(req, ctx)) return send(res, 401, 'application/json', JSON.stringify({ ok: false, error: 'Admin-Token noetig: AURA_ADMIN_TOKEN ist gesetzt, Header x-aura-token fehlt oder stimmt nicht (oder als Besitzer anmelden).' })), true;
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
