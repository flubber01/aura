'use strict';
// J.A.R.V.I.S. — read-only operating intelligence for AURA.
// Every briefing is assembled from live local modules. It can explain and
// route to a workflow, but it does not take owner, provider, media, publish,
// payment or deployment actions.
const registry = require('./registry');

const memory = [];
function remember(role, text, intent) {
  memory.push({ at: new Date().toISOString(), role, intent: intent || null, text: String(text || '').slice(0, 700) });
  if (memory.length > 30) memory.shift();
}
function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }
function link(label, href, detail) { return { label, href, detail: detail || '', kind: 'navigate' }; }
function prompt(label, value, detail) { return { label, prompt: value, detail: detail || '', kind: 'prompt' }; }
function say(input) {
  return {
    mode: 'LIVE', persona: 'J.A.R.V.I.S.', deterministic: true,
    intent: input.intent || 'briefing', headline: input.headline || 'AURA briefing',
    reply: input.reply || '', signals: input.signals || [], next: input.next || [],
    workflow: input.workflow || null, data: input.data || null, action: input.action || null,
    boundary: 'Read-only local briefing. J.A.R.V.I.S. does not approve, render, publish, connect accounts, send messages, spend money or trigger external provider actions.',
  };
}
function healthSnapshot() {
  const ops = safe(() => require('./ops').status(), { kill_switch: { on: false }, scheduler_running: false });
  const counts = registry.counts();
  const containers = safe(() => require('./module_container').status(), { containers: [], policy: { limits: { maxFails: '?' } } });
  const repair = safe(() => require('./self_repair').report(), { counters: { checks: 0, problems: 0, repaired: 0, failed: 0 } });
  const learning = safe(() => require('./learning_core').curve(), { generation: 0, unique_failures: 0, totals: { blocked: 0 } });
  const traffic = safe(() => require('./traffic').report(), { totalRequests: 0, lastMinute: 0, top: [] });
  const unhealthy = (containers.containers || []).filter((x) => x.container !== 'healthy');
  return { ops, counts, containers, repair, learning, traffic, unhealthy };
}
function signal(label, value, state, detail) { return { label, value: String(value), state: state || 'neutral', detail: detail || '' }; }
function systemBrief() {
  const s = healthSnapshot();
  const stable = !s.ops.kill_switch.on && !s.unhealthy.length && !s.repair.counters.failed;
  return say({
    intent: 'status', headline: stable ? 'Systemlage stabil' : 'Systemlage braucht Aufmerksamkeit',
    reply: `${s.counts.live} von ${s.counts.total} Bereichen sind live. Der Kill Switch ist ${s.ops.kill_switch.on ? 'aktiv' : 'nicht aktiv'}; ${s.unhealthy.length ? s.unhealthy.length + ' Container brauchen Aufmerksamkeit.' : 'die Container-Isolation meldet keinen offenen Alarm.'}`,
    signals: [
      signal('Live modules', `${s.counts.live} / ${s.counts.total}`, stable ? 'good' : 'warn', `${s.counts.restricted} dauerhaft policy-restricted`),
      signal('Kill switch', s.ops.kill_switch.on ? 'ENGAGED' : 'READY', s.ops.kill_switch.on ? 'critical' : 'good', s.ops.kill_switch.on ? (s.ops.kill_switch.reason || 'manual/emergency state') : 'Actions remain human-gated'),
      signal('Containers', `${(s.containers.containers || []).length - s.unhealthy.length} healthy`, s.unhealthy.length ? 'warn' : 'good', s.unhealthy.length ? s.unhealthy.map((x) => '#' + x.area).join(', ') : 'Circuit breakers armed'),
      signal('Learning core', `Gen ${s.learning.generation}`, 'neutral', `${s.learning.unique_failures} known failure fingerprints`),
    ],
    next: [prompt('Operations check', 'containers'), prompt('Today priorities', 'today'), prompt('Studio posture', 'studio workflow'), link('Open Control Tower', '/tower', 'operator-level directives and health')],
    data: { areas: s.counts, kill_switch: s.ops.kill_switch, repair: s.repair.counters },
  });
}
function studioBrief() {
  const st = safe(() => require('./studio_command').status(), null);
  const d = safe(() => require('./studio_command').data(), { projects: [] });
  const open = (d.projects || []).filter((x) => x.stage !== 'DELIVERY_READY');
  const blocked = (d.projects || []).filter((x) => x.preflight && x.preflight.state === 'LOCAL_STUDIO_PREFLIGHT_BLOCKED');
  return say({
    intent: 'studio', headline: 'Studio Command · Production posture',
    reply: st ? `${st.studio_team.departments} lokale Departments und ${st.studio_team.roles} Rollen strukturieren ${d.projects.length} Studio-Projekt(e). ${blocked.length ? blocked.length + ' lokale Preflights sind blockiert.' : 'Kein offener Studio-Preflight-Blocker wird gemeldet.'} Die Arbeitsfläche bleibt ein Manifest-Layer — keine Kamera-, NLE-, Render- oder Delivery-Engine.` : 'Studio Command status is not available.',
    signals: st ? [
      signal('Departments', st.studio_team.departments, 'neutral', `${st.studio_team.roles} workflow roles`),
      signal('Capability map', st.studio_team.capability_cards, 'neutral', 'transparent planning coverage, not execution'),
      signal('Open studio work', open.length, open.length ? 'warn' : 'good', `${blocked.length} preflight-blocked`),
      signal('External renders', '0', 'good', 'not a renderer or export engine'),
    ] : [],
    workflow: { title: 'Local production spine', current: open[0] ? open[0].stage : 'No active local Studio Project', steps: ['Rights / source boundary', 'Shot plan', 'Sequence manifest', 'Picture-lock review', 'VFX / color / sound plan', 'Accessibility QC', 'Local delivery readiness'] },
    next: [link('Open Studio Command', '/studio-command', 'shot cards, sequence manifests and review notes'), prompt('Show Today priorities', 'today'), prompt('Explain delivery boundary', 'studio delivery')],
    data: st ? { operations: st.operations, policy: st.policy } : null,
  });
}
function creatorBrief() {
  const today = safe(() => require('./creator_passport').today(), null);
  if (!today) return say({ intent: 'today', headline: 'Today View unavailable', reply: 'The local Passport summary is not available right now.', next: [link('Open Project Passport', '/creator-passport')] });
  const first = today.focus && today.focus[0];
  return say({
    intent: 'today', headline: 'Creator operations · Today',
    reply: first ? `Die höchste lokale Priorität lautet: ${first.title}. ${today.focus.length} priorisierte lokale Punkte und ${today.owner_reviews.length} Owner-Review-Karten liegen vor. Studio Command meldet ${today.studio.total} lokale Studio-Projekt(e). Keine Inbox, externe Metrik oder Erinnerung wird gelesen oder versendet.` : `Keine offenen Passport-Prioritäten. Studio Command meldet ${today.studio.total} lokale Studio-Projekt(e); das ist kein Freigabe- oder Veröffentlichungsentscheid.`,
    signals: [
      signal('Local focus', (today.focus || []).length, (today.focus || []).length ? 'warn' : 'good', first ? first.kind + ' · ' + first.title : 'No open local Passport item'),
      signal('Owner reviews', (today.owner_reviews || []).length, (today.owner_reviews || []).length ? 'warn' : 'good', 'never auto-decided by J.A.R.V.I.S.'),
      signal('Studio projects', today.studio.total, 'neutral', `${today.studio.delivery_ready_local} locally delivery-ready — never exported/delivered`),
      signal('Revenue ledger', today.revenue.state, 'neutral', `${today.revenue.pending} local simulation record(s) pending`),
    ],
    next: [link('Open Today View', '/today', 'local priorities only'), link('Open Project Passport', '/creator-passport', 'asset/version and rights graph'), link('Open Studio Command', '/studio-command', 'production manifests')],
    data: { focus: today.focus, studio: today.studio, revenue: today.revenue, collaboration: today.collaboration },
  });
}
function learningBrief() {
  const lc = safe(() => require('./learning_core').curve(), { generation: 0, unique_failures: 0, totals: { blocked: 0 } });
  return say({ intent: 'learning', headline: 'Learning core · bounded recurrence control', reply: `Der Learning Core steht bei Generation ${lc.generation}. ${lc.unique_failures} unterschiedliche Failure-Fingerprints sind bekannt; ${lc.totals.blocked} Wiederholungen wurden über gelernte Regeln blockiert. Das ist keine autonome Produktentscheidung, sondern eine lokale Fehler- und Schutzspur.`, signals: [signal('Generation', lc.generation, 'neutral'), signal('Known failures', lc.unique_failures, 'neutral'), signal('Blocked recurrences', lc.totals.blocked, 'good')], next: [link('Open Brain', '/brain'), link('Open Logs', '/logs'), prompt('System status', 'status')], data: lc.totals });
}
function containerBrief() {
  const s = healthSnapshot();
  return say({ intent: 'containers', headline: s.unhealthy.length ? 'Container attention required' : 'Container fleet stable', reply: s.unhealthy.length ? `${s.unhealthy.length} Container brauchen Aufmerksamkeit: ${s.unhealthy.map((x) => '#' + x.area + ' · ' + x.container).join(', ')}. Isolierung schützt die übrigen Module.` : `Alle ${(s.containers.containers || []).length} Module-Container sind gesund. Nach ${s.containers.policy.limits.maxFails} Fehlern greift die Quarantäne; kein Container wird von J.A.R.V.I.S. automatisch freigegeben.`, signals: [signal('Healthy', (s.containers.containers || []).length - s.unhealthy.length, s.unhealthy.length ? 'warn' : 'good'), signal('Quarantined', s.unhealthy.length, s.unhealthy.length ? 'critical' : 'good'), signal('Circuit threshold', s.containers.policy.limits.maxFails, 'neutral')], next: [link('Open Containers', '/containers'), link('Open Ops', '/ops'), prompt('System status', 'status')], data: { flagged: s.unhealthy } });
}
function opsBrief(kind) {
  const s = healthSnapshot();
  if (kind === 'backups') {
    const b = safe(() => require('./txt_watcher').backups(), { count: 0, verified: 0, backups: [] });
    return say({ intent: 'backups', headline: 'Backup posture · local vault records', reply: `${b.count} Snapshot(s), davon ${b.verified} verifiziert. Neuester lokaler Snapshot: ${b.backups[0] ? b.backups[0].file : 'keiner'}. Restore bleibt ein bewusstes Operator-Verfahren; J.A.R.V.I.S. startet keine Wiederherstellung.`, signals: [signal('Snapshots', b.count, 'neutral'), signal('Verified', b.verified, b.verified ? 'good' : 'warn'), signal('Newest', b.backups[0] ? b.backups[0].file : 'None', 'neutral')], next: [link('Open Ops', '/ops'), prompt('System status', 'status')], data: b.backups.slice(0, 3) });
  }
  if (kind === 'logs') return say({ intent: 'logs', headline: 'Repair & log posture', reply: `Seit Boot: ${s.repair.counters.checks} Health Checks, ${s.repair.counters.problems} Probleme, ${s.repair.counters.repaired} protokollierte Reparaturen und ${s.repair.counters.failed} fehlgeschlagene Reparaturversuche. Logs sind Diagnostik, kein Beweis für externe Wirkung.`, signals: [signal('Checks', s.repair.counters.checks, 'neutral'), signal('Problems', s.repair.counters.problems, s.repair.counters.problems ? 'warn' : 'good'), signal('Repair failures', s.repair.counters.failed, s.repair.counters.failed ? 'critical' : 'good')], next: [link('Open Logs', '/logs'), link('Open Ops', '/ops')], data: s.repair.counters });
  if (kind === 'traffic') return say({ intent: 'traffic', headline: 'Observed request traffic', reply: `${s.traffic.totalRequests} Requests wurden seit Boot gemessen, ${s.traffic.lastMinute} in der letzten Minute. Das sind lokale Gateway-Zählungen, keine Reichweiten- oder Kundenmetriken.`, signals: [signal('Since boot', s.traffic.totalRequests, 'neutral'), signal('Last minute', s.traffic.lastMinute, 'neutral'), signal('Top route', s.traffic.top[0] ? s.traffic.top[0].route : 'n/a', 'neutral')], next: [link('Open Traffic', '/ops'), prompt('System status', 'status')], data: s.traffic.top.slice(0, 5) });
  return systemBrief();
}
function workflowBrief() {
  const s = healthSnapshot(); const studio = safe(() => require('./studio_command').status(), { operations: { projects: 0 } });
  return say({ intent: 'workflow', headline: 'AURA workflow map · controlled handoffs', reply: 'AURA verbindet lokale Operating Layers statt stillschweigend externe Arbeit auszuführen: Creator Passport organisiert Rights/Versions, Studio Command organisiert die Produktionsmanifeste, AURA OS mappt die Arbeitszelle und J.A.R.V.I.S. priorisiert nur lesend. Jede echte Freigabe, Render-, Export-, Provider- oder Veröffentlichungsaktion bleibt menschlich und separat.', signals: [signal('Passport layer', 'Area 101', 'neutral', 'rights-aware local source graph'), signal('Studio layer', studio.operations.projects + ' project(s)', 'neutral', 'camera/post delivery manifests only'), signal('AURA OS', 'Area 95', 'neutral', 'local operating profile'), signal('Assistant', 'Read-only', 'good', `${s.counts.live} live modules observed`)], workflow: { title: 'Creator → Studio → reviewable readiness', current: 'Human-gated local operations', steps: ['Create a rights/source boundary', 'Map Passport assets and versions', 'Plan shot / sequence / review in Studio Command', 'Resolve local blocking notes', 'Owner reviews local readiness', 'Use separately approved tooling for any actual execution'] }, next: [link('Open AURA OS', '/aura-os'), link('Open Project Passport', '/creator-passport'), link('Open Studio Command', '/studio-command')], data: { areas: s.counts, studio: studio.operations } });
}
function helpBrief() {
  return say({ intent: 'help', headline: 'AURA OS Intelligence · useful local briefings', reply: 'Ich kann Systemlage, Container, Lernkurve, Backups, Logs, lokalen Traffic, Today View, Studio Command und den AURA-Workflow zusammenfassen. Recherche wird als klar gekennzeichnete Live-Suche delegiert. Ich löse keine externen Aktionen aus.', signals: [signal('Mode', 'LIVE / deterministic', 'good', 'local state is queried at request time'), signal('Authority', 'Read-only', 'good', 'no owner or provider action')], next: [prompt('System status', 'status'), prompt('Today priorities', 'today'), prompt('Studio workflow', 'studio workflow'), prompt('Workflow map', 'workflow'), prompt('Research', 'research self hosted video workflow'), link('Download complete safe backup ZIP', '/api/download/aura-complete-safe-source-backup.zip', 'full safe source/docs/config archive'), link('Download focused source ZIP', '/api/download/aura-studio-command-source.zip', 'Studio Command + J.A.R.V.I.S. handoff')] });
}
function think(message) {
  const m = String(message || '').trim(); const q = m.toLowerCase();
  if (!m) return helpBrief();
  if (/^(hi|hallo|hey|guten|servus|jarvis)/.test(q) && q.length < 30) return systemBrief();
  if (/download|zip|bundle|source package|quell|archiv/.test(q)) return say({ intent: 'download', headline: 'Complete safe backup ready on demand', reply: 'Für die vollständige sichere Archivierung gibt es jetzt ein ZIP mit dem aktuellen AURA-Quellcode, allen Dokumentationen, statischer Konfiguration, Deployment-Vorlagen und Tests. Runtime-Ledger, Geheimnisse, Medien, Dependencies, Caches und private Daten bleiben ausdrücklich ausgeschlossen. Zusätzlich bleibt das kompakte Studio-/J.A.R.V.I.S.-Handoff verfügbar.', signals: [signal('Complete archive', 'ZIP', 'good', 'safe source, docs, config, templates and tests'), signal('Runtime data', 'Excluded', 'good'), signal('Secrets / media', 'Excluded', 'good')], next: [link('Download complete safe backup ZIP', '/api/download/aura-complete-safe-source-backup.zip', 'full safe archive, built in memory'), link('Download focused source ZIP', '/api/download/aura-studio-command-source.zip', 'Studio Command + J.A.R.V.I.S. handoff'), link('Open Downloads', '/downloads')], data: { url: '/api/download/aura-complete-safe-source-backup.zip' } });
  if (/studio|video|post|vfx|color|farbe|sound|schnitt|kamera|delivery/.test(q)) return studioBrief();
  if (/today|passport|release|rights|rechte|asset|version/.test(q)) return creatorBrief();
  if (/lern|learn|failure|fehler|curve|kurve|generation/.test(q)) return learningBrief();
  if (/container|quarant|circuit|crash|isolat/.test(q)) return containerBrief();
  if (/backup|vault|restore|snapshot/.test(q)) return opsBrief('backups');
  if (/log|error|fehler.*(zeig|list)|zeige.*error/.test(q)) return opsBrief('logs');
  if (/traffic|requests|zugriffe|besuch/.test(q)) return opsBrief('traffic');
  if (/workflow|builder|pipeline|ablauf|prozess/.test(q)) return workflowBrief();
  if (/research|recherch|such|finde|github/.test(q)) {
    const topic = m.replace(/.*?(research|recherchier(?:e)?|suche|finde)\s*(nach|über|about|for)?\s*/i, '').trim() || q;
    return say({ intent: 'research', headline: 'Research delegation prepared', reply: `Ich starte eine klar gekennzeichnete Live-Recherche zu „${topic}“. Ergebnisse werden als externe Treffer dargestellt und nicht in AURA integriert. Jede Übernahme braucht Lizenz-, Security-, Kompatibilitäts- und Owner-Review.`, signals: [signal('Mode', 'Live lookup', 'neutral', 'external result radar only'), signal('Integration', 'Not implied', 'good', 'review gate remains mandatory')], next: [link('Open Research Lab', '/research')], data: { delegate: 'research', topic }, action: 'research' });
  }
  if (/rolle|role|abteilung|department|identit/.test(q)) {
    const roles = registry.skills.roles(); return say({ intent: 'roles', headline: 'AURA role coverage', reply: `${roles.length} Spezialistenrollen über ${registry.skills.departments().length} Departments sind als lokale Prompt-/Workflow-Definitionen registriert. Rollen sind keine behaupteten Mitarbeiter und keine autonome externe Vertretung.`, signals: [signal('Roles', roles.length, 'neutral'), signal('Departments', registry.skills.departments().length, 'neutral')], next: [link('Open Skills', '/skills'), prompt('Workflow map', 'workflow')], data: { roles: roles.length } });
  }
  if (/kill|ops|emergency|notfall/.test(q)) return systemBrief();
  if (/status|health|geht|läuft|laeuft|alive|bericht|report|zustand|all good|alles gut/.test(q)) return systemBrief();
  if (/hilfe|help|was kannst|can you|fähig/.test(q)) return helpBrief();
  return say({ intent: 'clarify', headline: 'Intent needs a clear operating topic', reply: 'Ich arbeite absichtlich mit klaren lokalen Intents statt erfundener Antworten. Frage zum Beispiel nach „Status“, „Today“, „Studio Workflow“, „Container“, „Learning“, „Backups“, „Logs“, „Workflow“ oder „Download ZIP“.', next: [prompt('System status', 'status'), prompt('Today priorities', 'today'), prompt('Studio workflow', 'studio workflow'), prompt('Help', 'help')] });
}
function ask(message) {
  const out = think(message); remember('user', message, out.intent); remember('jarvis', out.reply, out.intent);
  return { ...out, memory: memory.slice(-12), llm: { used: false, reason: 'sync-Pfad' } };
}
// Async-Variante: die deterministische Engine liefert die Fakten; ist OLLAMA_URL
// gesetzt, formuliert Ollama sie aus (lokal, eigener Host). Bei jedem Fehler
// bleibt die Antwort der Engine unverändert bestehen.
async function askAsync(message) {
  const out = think(message);
  let llm = { used: false, reason: 'keine Frage' };
  const q = String(message || '').trim();
  if (q) {
    const facts = out.reply + (out.data ? '\n' + JSON.stringify(out.data).slice(0, 2000) : '');
    const p = await require('./ollama_llm').phrase({ question: q, facts });
    if (p.used) {
      out.reply = p.text;
      out.mode = 'LOCAL-LLM · ollama:' + p.model;
      llm = { used: true, model: p.model };
    } else {
      llm = { used: false, reason: p.reason };
    }
  }
  remember('user', message, out.intent); remember('jarvis', out.reply, out.intent);
  return { ...out, memory: memory.slice(-12), llm };
}
module.exports = { meta: { area: 'JARVIS', id: 'jarvis', name: 'J.A.R.V.I.S. live operating intelligence', state: 'live' }, ask, askAsync, memory: () => memory.slice(-30), healthSnapshot };
