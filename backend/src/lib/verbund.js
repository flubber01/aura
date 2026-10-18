// Verbund: das Concat-Repo-Verzeichnis und die Cross-Chain über alle Abteilungen.
// Intern: jede Abteilung ein Glied der Kette (Modul → Rohr → Meilenstein-Ereignis → n8n-Workflow → ein Link).
// Extern: Connector-Steckplätze mit EHRLICHEM Status — aus dieser Sandbox sind nur die
// Paketregistries (npm/pypi) erreichbar, deshalb wird nichts/live behauptet, was nicht läuft.
// Kein Zugang wird vorgetäuscht; fehlende Links trägt der Mensch nach (Mensch hat das letzte Wort).
'use strict';
const videoDepartment = require('./video_department');
const effects = require('./visual_effects');
const camera = require('./camera_director');
const spoken = require('./spoken_word');
const distributors = require('./distributors');
const styles = require('./styles_catalog');
const agenticIntro = require('./agentic_intro');
const pipes = require('./workflow_pipes');
const milestones = require('./milestones');

// ---------------------------------------------------------------- Concat-Repos (intern)
// Ein Glied = ein „Repo" im Kopf: eigenes Modul, eigene Routen, eigener Status.
const REPOS = [
  { id: 'musik', name: 'Musik & Stile', module: 'styles_catalog.js + music_render.js', link: '/stile', event: 'inhalt', n8n: 'wf-musik-render' },
  { id: 'montage', name: 'Montage (Video, Effekte, Kamera)', module: 'video_department.js + visual_effects.js + camera_director.js', link: '/montage', event: 'inhalt', n8n: 'wf-montage' },
  { id: 'spoken', name: 'Podcast, Hörbuch, Audiobibel', module: 'spoken_word.js', link: '/api/spoken/status', event: 'inhalt', n8n: 'wf-spoken' },
  { id: 'vertrieb', name: 'Verteiler & Kennungen', module: 'distributors.js', link: '/api/dist/status', event: 'inhalt', n8n: 'wf-vertrieb' },
  { id: 'intro', name: 'Intro Agentic AI', module: 'agentic_intro.js', link: '/api/intro/agentic/start', event: 'inhalt', n8n: 'wf-intro' },
  { id: 'rohre', name: 'Workflow-Rohre (epic workflow)', module: 'workflow_pipes.js', link: '/api/runde6/status', event: 'klick', n8n: 'wf-rohre' },
  { id: 'meilensteine', name: 'Meilensteine', module: 'milestones.js', link: '/meilensteine', event: null, n8n: 'wf-meilensteine' },
  { id: 'sicherheit', name: 'Sicherheitszentrale', module: 'security_center.js', link: '/api/security/status', event: 'klick', n8n: 'wf-sicherheit' },
];

// ---------------------------------------------------------------- Externe Steckplätze
// Genau EIN Link je Connector (oder null, wenn der Mensch ihn noch bestätigt).
const EXTERN = [
  { id: 'n8n', name: 'n8n-Workflows', link: '/api/n8n/workflows', status: 'LOKAL KATALOGISIERT: Webhook-Route /api/n8n/webhook läuft, kein live n8n-Server aus dieser Sandbox erreichbar.' },
  { id: 'scrapegraphai', name: 'ScrapeGraphAI', link: null, status: 'NICHT ERREICHBAR: Sandbox lässt nur npm/pypi zu; Scraping-Ziele liegen draußen. Steckplatz definiert, Zugang vom Menschen zu bestätigen.' },
  { id: 'ragflow', name: 'RAGFlow', link: null, status: 'NICHT ERREICHBAR: eigener Server nötig. Steckplatz definiert (Dokumente → RAG-Antwort), Zugang vom Menschen zu bestätigen.' },
  { id: 'voicestudio', name: 'VoiceStudio', link: null, status: 'NICHT ERREICHBAR: TTS/Studio extern. Eigener Renderer bleibt die ehrliche Quelle, Steckplatz für Übergabe definiert.' },
  { id: 'noosmedia', name: 'NoosMedia', link: null, status: 'NICHT ERREICHBAR: Posting-Ziel extern. Verteiler-Feed liegt bereit (/api/dist/links), Zugang vom Menschen zu bestätigen.' },
  { id: 'unlimited-org', name: 'unlimited.org', link: null, status: 'NICHT PRÜFBAR: Domain aus dieser Sandbox nicht erreichbar, Inhalt unbekannt — nichts behaupten, Mensch entscheidet.' },
  { id: 'opencreator', name: 'OpenCreator-Repo', link: null, status: 'NICHT PRÜFBAR: GitHub aus dieser Sandbox nicht erreichbar (Session ohne Push). Repo-Link vom Menschen zu bestätigen.' },
  { id: 'aura-repo', name: 'AURA-Repo (dieses)', link: 'https://github.com/flubber01/aura', status: 'LOKAL VORHANDEN: Klon und Commits laufen; Push/PR erst in einer neuen Session.' },
];

// ---------------------------------------------------------------- Cross-Chain
// Pfad → Meilenstein-Ereignis. POSTs auf Erzeuger-Routen buchen Inhalt, alles andere Aktion.
const CROSSCHAIN = [
  { passt: (p, m) => m === 'POST' && p.startsWith('/api/spoken'), event: 'inhalt' },
  { passt: (p, m) => m === 'POST' && p.startsWith('/api/video'), event: 'inhalt' },
  { passt: (p, m) => m === 'POST' && p.startsWith('/api/dist'), event: 'inhalt' },
  { passt: (p, m) => m === 'POST' && p.startsWith('/api/duett'), event: 'inhalt' },
  { passt: (p, m) => m === 'POST' && p.startsWith('/api/intro'), event: 'inhalt' },
  { passt: (p, m) => m === 'POST', event: 'klick' },
];
function crosschain(p, method) {
  for (const c of CROSSCHAIN) if (c.passt(p, method)) return c.event;
  return null;
}
function kette() {
  const rohre = pipes.status ? pipes.status() : null;
  return {
    beschreibung: 'Jede Abteilung: Modul → Meilenstein-Ereignis → n8n-Workflow → ein Link. Der Server bucht bei jedem erfolgreichen POST zentral das Ereignis (Cross-Chain-Hook in backend/server.js).',
    glieder: REPOS.map((r) => Object.assign({}, r, { rohre: rohre ? { rohre: rohre.rohre || null, stufen: rohre.stufen || null, mensch_tore: rohre.menschTore || rohre.mensch_tore || null } : null })),
    extern: EXTERN.map((e) => Object.assign({}, e)),
    ereignisse: milestones.EVENTS,
  };
}

// ---------------------------------------------------------------- Montage offenlegen
function montage() {
  const v = videoDepartment.status ? videoDepartment.status() : {};
  const e = effects.status ? effects.status() : (effects.list ? effects.list() : {});
  const c = camera.status ? camera.status() : {};
  return {
    abteilung: 'MONTAGE',
    offen: true,
    seite: '/montage',
    video: v,
    effekte: e,
    kamera: c,
    intro: { route: '/api/intro/agentic/start', status: agenticIntro.status().mode },
    rohre: pipes.status ? pipes.status() : null,
  };
}
function pageMontage() {
  const ui = require('./ui_kit');
  const m = montage();
  const z = (o) => '<pre class="mono" style="overflow:auto;max-height:360px">' + JSON.stringify(o, null, 2).replace(/</g, '&lt;') + '</pre>';
  const body = `<p>${ui.badge(m.offen ? 'MONTAGE — OFFEN' : 'MONTAGE — ABGESCHLOSSEN', m.offen ? 'warn' : 'ok')}</p>
<div class="grid g2">
  <div class="card"><h3>Video</h3>${z(m.video)}</div>
  <div class="card"><h3>Effekte</h3>${z(m.effekte)}</div>
  <div class="card"><h3>Kamera</h3>${z(m.kamera)}</div>
  <div class="card"><h3>Intro</h3>${z(m.intro)}</div>
</div>
<p class="hint">Rohdaten: <a href="/api/montage/status">/api/montage/status</a> · Verbund: <a href="/api/verbund">/api/verbund</a> · Kette: <a href="/api/verbund/kette">/api/verbund/kette</a></p>`;
  return ui.shell({ title: 'Montage', active: '/montage', body, note: 'Video-Abteilung, Effekte, Kamera-Regie und Intro an einer Stelle.' });
}

// ---------------------------------------------------------------- n8n-Workflows (Katalog)
const N8N = [
  { id: 'wf-intro', name: 'Intro rendern → Meilenstein', trigger: 'POST /api/n8n/webhook {art:"intro"}', knoten: ['webhook', 'intro.render', 'milestones.track(inhalt)', 'antwort'] },
  { id: 'wf-musik-render', name: 'Stil → Render → Feed', trigger: 'POST /api/n8n/webhook {art:"musik"}', knoten: ['webhook', 'styles.match', 'music.render', 'milestones.track(inhalt)'] },
  { id: 'wf-montage', name: 'Montage: Schnittplan → Effekte → Abnahme', trigger: 'POST /api/n8n/webhook {art:"montage"}', knoten: ['webhook', 'video.plan', 'effects.apply', 'video.abnahme', 'milestones.track(inhalt)'] },
  { id: 'wf-spoken', name: 'Kapitel → Sprechplan → Verzeichnisse', trigger: 'POST /api/n8n/webhook {art:"spoken"}', knoten: ['webhook', 'spoken.plan', 'dist.links', 'milestones.track(inhalt)'] },
  { id: 'wf-vertrieb', name: 'Feed → Kennungen → Häuser', trigger: 'POST /api/n8n/webhook {art:"vertrieb"}', knoten: ['webhook', 'dist.feed', 'dist.ids', 'milestones.track(inhalt)'] },
  { id: 'wf-rohre', name: 'Epic-Workflow: Stufe → Mensch-Tor → Protokoll', trigger: 'POST /api/n8n/webhook {art:"rohr"}', knoten: ['webhook', 'pipes.runStage', 'mensch.tor', 'selfRepair.log'] },
  { id: 'wf-meilensteine', name: 'Heartbeat sammeln → Schwellen prüfen → Einblendung', trigger: 'POST /api/milestones/track', knoten: ['track', 'milestones.pruefen', 'seite.einblendung'] },
  { id: 'wf-sicherheit', name: 'Vorfall: detect → isolate → raus (Mensch entscheidet)', trigger: 'POST /api/n8n/webhook {art:"vorfall"}', knoten: ['webhook', 'security.detect', 'security.isolate', 'mensch.entscheid'] },
];
function n8nWorkflows() {
  return {
    hinweis: 'Katalog aus dieser Sandbox: Die Webhook-Route läuft lokal, ein live n8n-Server ist nicht erreichbar. Jeder Workflow nennt Trigger und Knotenfolge, damit er draußen 1:1 nachgebaut werden kann.',
    webhook_route: '/api/n8n/webhook',
    workflows: N8N,
  };
}

function status() {
  return {
    verbund: 'concat-repos',
    intern: REPOS.length,
    extern: EXTERN.length,
    n8n_workflows: N8N.length,
    montage_offen: true,
    cli: 'bin/aura-cli.js (status | verbund | kette | montage | n8n | meilensteine | track | intro)',
    ehrlich: 'Externe Connector-Links sind null, bis der Mensch sie bestätigt; aus dieser Sandbox sind nur npm/pypi erreichbar.',
  };
}

module.exports = { REPOS, EXTERN, CROSSCHAIN, N8N, crosschain, kette, montage, pageMontage, n8nWorkflows, status };
