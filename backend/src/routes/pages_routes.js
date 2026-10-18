'use strict';
// Route module: all HTML page routes (moved verbatim from server.js).
const pageHub = require('../../pages/hub');
const pagePipelines = require('../../pages/pipelines');
const pageYellowpages = require('../../pages/yellowpages');
const pageDeploy = require('../../pages/deploy');
const pageCluster = require('../../pages/cluster');
const pageSkills = require('../../pages/skills');
const pageConsole = require('../../pages/console');
const pageBrain = require('../../pages/brain');
const pageMaster = require('../../pages/master');
const pageDownloads = require('../../pages/downloads');
const pageRepair = require('../../pages/repair');
const pageSelfwork = require('../../pages/selfwork');
const pageBuilder = require('../../pages/builder');
const pageWorkflows = require('../../pages/workflows');
const pageResearch = require('../../pages/research');
const pageSeo = require('../../pages/seo');
const pageLogs = require('../../pages/logs');
const pageConfig = require('../../pages/configpage');
const pageContainers = require('../../pages/containers');
const pageJarvis = require('../../pages/jarvis');
const pageAdminCopilot = require('../../pages/admin_copilot');
const pageAdminDashboard = require('../../pages/admin_dashboard');
const pageLogin = require('../../pages/login');
const pageHierarchy = require('../../pages/hierarchy');
const pageOps = require('../../pages/ops');
const pageTerminal = require('../../pages/terminal');
const pageMinibot = require('../../pages/minibot');
const pageIgnition = require('../../pages/ignition');
const pageArcade = require('../../pages/arcade');
const pageSchedule = require('../../pages/schedule');
const pageImagegen = require('../../pages/imagegen');
const pageMcp = require('../../pages/mcp');
const pageForge = require('../../pages/forge');
const pageControl = require('../../pages/control');
const pageStudio = require('../../pages/studio');
const pageTower = require('../../pages/tower');
const pageModels = require('../../pages/models');
const pageGrid = require('../../pages/grid');
const pageIntercom = require('../../pages/intercom');
const pageContentCommand = require('../../pages/content_command');
const pageAuraHeart = require('../../pages/aura_heart');
const pageCreatorDesk = require('../../pages/creator_desk');
const pageLabelDesk = require('../../pages/label_desk');
const pageMediaNewsroom = require('../../pages/media_newsroom');
const pageSocialControl = require('../../pages/social_control');
const pageGrowthNexus = require('../../pages/growth_nexus');
const pageCapabilityRadar = require('../../pages/capability_radar');
const pageAuraOs = require('../../pages/aura_os');
const pageAuraOsPlus = require('../../pages/aura_os_plus');
const pageCreatorContinuity = require('../../pages/creator_continuity');
const pageRemoteApproval = require('../../pages/remote_approval');
const pageCreatorCollaboration = require('../../pages/creator_collaboration');
const pageCreatorRevenue = require('../../pages/creator_revenue');
const pageCreatorPassport = require('../../pages/creator_passport');
const pageStudioCommand = require('../../pages/studio_command');

const HTML = 'text/html; charset=utf-8';

// Alle Seiten bekommen denselben kleinen fetch-Wrapper: Ist in der Sitzung ein
// Admin-Token hinterlegt (sessionStorage 'aura_token', wie auf /board und /upload),
// wird er bei eigenen /api/-Aufrufen automatisch mitgeschickt. Damit bleiben die
// Seiten bedienbar, sobald AURA_ADMIN_TOKEN im Server gesetzt ist — ohne dass jede
// Seite einzeln angepasst werden muss.
const TOKEN_SNIPPET = `<script>(function(){try{var t=function(){try{return sessionStorage.getItem('aura_token')||''}catch(e){return ''}};var f=window.fetch;window.fetch=function(u,o){o=o||{};try{var url=typeof u==='string'?u:(u&&u.url)||'';var tok=t();if(tok&&url.indexOf('/api/')===0){o.headers=Object.assign({},o.headers||{},{'x-aura-token':tok})}}catch(e){}return f.call(this,u,o)}}catch(e){}})();</script>`;
function withTokenSnippet(html) {
  return typeof html === 'string' && html.includes('</head>') ? html.replace('</head>', TOKEN_SNIPPET + '</head>') : html;
}

async function handle(ctx) {
  const { res, p } = ctx;
  // HTML-Antworten laufen durch den Token-Wrapper, alle anderen unverändert.
  const rawSend = ctx.send;
  const send = (r, code, type, body, extra) => rawSend(r, code, type, type === HTML ? withTokenSnippet(body) : body, extra);

  if (p === '/skills') return send(res, 200, HTML, pageSkills()), true;
  if (p === '/hub') return send(res, 200, HTML, pageHub()), true;
  if (p === '/pipelines') return send(res, 200, HTML, pagePipelines()), true;
  if (p === '/yellowpages') return send(res, 200, HTML, pageYellowpages()), true;
  if (p === '/deploy') return send(res, 200, HTML, pageDeploy()), true;
  if (p === '/cluster') return send(res, 200, HTML, pageCluster()), true;
  if (p === '/builder') return send(res, 200, HTML, pageBuilder()), true;
  if (p === '/workflows') return send(res, 200, HTML, pageWorkflows()), true;
  if (p === '/repair') return send(res, 200, HTML, pageRepair()), true;
  if (p === '/selfwork') return send(res, 200, HTML, pageSelfwork()), true;
  if (p === '/research') return send(res, 200, HTML, pageResearch()), true;
  if (p === '/seo') return send(res, 200, HTML, pageSeo()), true;
  if (p === '/logs') return send(res, 200, HTML, pageLogs()), true;
  if (p === '/containers') return send(res, 200, HTML, pageContainers()), true;
  if (p === '/config') return send(res, 200, HTML, pageConfig()), true;
  // The former J.A.R.V.I.S. briefing surface now lives as AURA OS Intelligence.
  // /jarvis stays as the familiar entry point, but is now the admin's local-model workspace.
  if (p === '/login') return send(res, 200, HTML, pageLogin()), true;
  if (p === '/jarvis') return send(res, 200, HTML, pageAdminCopilot()), true;
  if (p === '/admin') return send(res, 200, HTML, pageAdminDashboard()), true;
  if (p === '/intelligence') return send(res, 200, HTML, pageJarvis()), true;
  if (p === '/brain') return send(res, 200, HTML, pageBrain()), true;
  if (p === '/master') return send(res, 200, HTML, pageMaster()), true;
  if (p === '/hierarchy') return send(res, 200, HTML, pageHierarchy()), true;
  if (p === '/ops') return send(res, 200, HTML, pageOps()), true;
  if (p === '/terminal') return send(res, 200, HTML, pageTerminal()), true;
  if (p === '/minibot') return send(res, 200, HTML, pageMinibot()), true;
  if (p === '/ignition') return send(res, 200, HTML, pageIgnition()), true;
  if (p === '/arcade') return send(res, 200, HTML, pageArcade()), true;
  if (p === '/schedule') return send(res, 200, HTML, pageSchedule()), true;
  if (p === '/imagegen') return send(res, 200, HTML, pageImagegen()), true;
  if (p === '/mcp') return send(res, 200, HTML, pageMcp()), true;
  if (p === '/forge') return send(res, 200, HTML, pageForge()), true;
  if (p === '/control') return send(res, 200, HTML, pageControl()), true;
  if (p === '/studio') return send(res, 200, HTML, pageStudio()), true;
  if (p === '/tower') return send(res, 200, HTML, pageTower()), true;
  if (p === '/models') return send(res, 200, HTML, pageModels()), true;
  if (p === '/grid') return send(res, 200, HTML, pageGrid()), true;
  if (p === '/intercom') return send(res, 200, HTML, pageIntercom()), true;
  if (p === '/content-command') return send(res, 200, HTML, pageContentCommand()), true;
  if (p === '/aura-heart') return send(res, 200, HTML, pageAuraHeart()), true;
  if (p === '/creator-desk') return send(res, 200, HTML, pageCreatorDesk()), true;
  if (p === '/label-desk') return send(res, 200, HTML, pageLabelDesk()), true;
  if (p === '/media-newsroom') return send(res, 200, HTML, pageMediaNewsroom()), true;
  if (p === '/social-control') return send(res, 200, HTML, pageSocialControl()), true;
  if (p === '/growth-nexus') return send(res, 200, HTML, pageGrowthNexus()), true;
  if (p === '/capability-radar') return send(res, 200, HTML, pageCapabilityRadar()), true;
  if (p === '/aura-os') return send(res, 200, HTML, pageAuraOs()), true;
  if (p === '/aura-os/launchpad') return send(res, 200, HTML, pageAuraOsPlus()), true;
  if (p === '/creator-continuity') return send(res, 200, HTML, pageCreatorContinuity()), true;
  if (p === '/remote-approval') return send(res, 200, HTML, pageRemoteApproval()), true;
  if (p === '/creator-collaboration') return send(res, 200, HTML, pageCreatorCollaboration()), true;
  if (p === '/creator-revenue') return send(res, 200, HTML, pageCreatorRevenue()), true;
  if (p === '/creator-passport' || p === '/today') return send(res, 200, HTML, pageCreatorPassport(p)), true;
  if (p === '/studio-command') return send(res, 200, HTML, pageStudioCommand()), true;
  if (p === '/console') return send(res, 200, HTML, pageConsole()), true;
  if (p === '/downloads') return send(res, 200, HTML, pageDownloads()), true;
  if (p === '/') { res.writeHead(302, { Location: '/hub' }); res.end(); return true; }

  return false;
}

module.exports = { name: 'pages_routes', handle };
