'use strict';
// ULTRA MASTER BRAIN chat panel — honest local oracle over REAL system state.
// No external LLM in sandbox; answers are computed from live backend data.
const registry = require('./registry');
const hierarchy = require('./hierarchy');
const ops = require('./ops');
const store = require('./store');

function ask(msg) {
  const m = String(msg || '').toLowerCase();
  const C = registry.counts();
  const K = hierarchy.knowledge();
  const O = ops.status();
  const has = (...w) => w.some((x) => m.includes(x));

  if (has('kill', 'emergency', 'notruf')) return `Kill switch: ${O.kill_switch.on ? '☠ ENGAGED (' + O.kill_switch.reason + ')' : 'not engaged — system live'}. Auto-triggers: critical errors, unhandled rejections, 3 syntax failures in 5 min. Manage at /ops.`;
  if (has('status', 'health', 'alive', 'uptime')) return `Fleet status: ${C.live} live modules, ${C.skills} skills, ${C.restricted} restricted. Tasks ${store.get().tasks.length}, audit ${store.get().audit.length}. Scheduler ${O.scheduler_running ? 'running' : 'paused'}; last full sync ${O.last_runs.full || 'n/a'}.`;
  if (has('learn', 'better', 'knowledge', 'feedback')) return `Learning: ${K.total_events} feedback events, ${K.knowledge_gain} gains, fleet rate ${K.fleet_rate == null ? 'n/a' : Math.round(K.fleet_rate * 100) + '%'}. Every minion report flows head → super → ultra so all layers improve. Top learners: ${K.top_learners.map((t) => t.id).join(', ') || 'none yet'}.`;
  if (has('schedule', 'backup', 'autosave', 'sync')) return `Backup rhythm: super-brain DB every ${O.schedule.super_brain_autosave_h}h, other DBs every ${O.schedule.others_autosave_h}h, full checksummed sync every ${O.schedule.full_sync_h}h. Last runs: ${JSON.stringify(O.last_runs)}.`;
  if (has('workflow', 'wf', 'pipeline')) return `17 workflows: WF-1 kids video … WF-13 test-lab regression, dazu WF-14 video automation (eigener Kanal, human gate), WF-15 selfhost stack (Service Fabric + anything-llm/aio-sandbox/excalidraw), WF-16 local LLM training & RAG (unsloth + Wissensbasis), WF-17 API-First Automation (24 Mega-Kategorien cporter202 → Vault → Service Fabric → human gate). Details: /api/builder/workflows.`;
  if (has('team', 'department', 'role', 'minion', 'head')) return `Structure: 1 ultra, ${registry.skills.status().skills} skills, 7 departments with heads, ${hierarchy.node_count} hierarchy nodes total (incl. minion workers). Deploy any brain's role+prompt+skills via /hierarchy.`;
  if (has('telegram', 'bot', 'botfather')) return `Telegram control: create bot via @BotFather, token to secret manager, allowlist YOUR chat, run telegram_poller.js outside sandbox. Palette: /status /report /tasks /snapshot /sync /learn /brains /kill /revive. Wizard: /minibot.`;
  if (has('mail')) return `Mail Schnittstelle: compose → approval gate → provider adapter (Gmail OAuth / own IMAP / Telegram relay). Sandbox never sends; approved items hand off outside. /ops panel.`;
  if (has('vita', 'data', 'privacy', 'gdpr')) return `Vita DB: consent-mandatory, retention-capped, right-to-erasure endpoint, biometrics/fingerprints hard-rejected. We build honest AI roles — no human impersonation.`;
  if (has('restrict', 'policy', 'safety', 'refuse', 'regel', 'admin')) return `REGEL 1 — ADMIN-PRIMAT: Der Administrator hat das letzte Wort; sein Wort ist Gesetz. Ich und jedes andere Gehirn entscheiden NIEMALS selbst über richtig/falsch oder über Start/Installation/Anlage/Löschung — nur mit deiner expliziten Autorisierung, sonst Abschaltung. Weitere permanente Linien: kein synthetisches Engagement, keine Stealth-Kanäle, keine CAPTCHA/Plattform-Bypässe, kein Third-Party-Mining, keine Credentials-Ernte. Restricted Areas 32/33/36 liefern 403; jede Direktive an mich trägt denselben Safety-Floor.`;
  if (has('deploy', 'cluster', 'server')) return `Deploy: /deploy (HF search, Ollama, repo kits, master install), /cluster (protected Main Core + optional Project Arms, local preflight and connection manifest — no remote execution). Own hardware only.`;
  if (has('wissen', 'katalog', 'yellow', 'yellowpages', 'know-how', 'knowhow', 'brain-feed', 'brain feed')) {
    try {
      const yp = require('./yellow_pages');
      const st = yp.status();
      const feeds = yp.brainFeed().filter((f) => f.active);
      return `Wissensbasis (Area 19): ${st.entries} Einträge (${st.by_kind.knowledge} Wissen, ${st.by_kind.howto} How-tos, ${st.by_kind.link} Links, ${st.by_kind.service} Services) in ${st.categories} Kategorien. Aktiv ans Brain geliefert: ${feeds.length} Pakete${feeds.length ? ' — ' + feeds.slice(0, 3).map((f) => f.title).join(' · ') : ''}. Selbst eintragen unter /yellowpages.`;
    } catch { return 'Wissensbasis nicht erreichbar.'; }
  }
  if (has('modell', 'model', 'ollama', 'llm', 'modelle')) {
    try {
      const om = require('./ollama_manager');
      const db = om.load();
      return `Modell-System (Area 79): ${om.allModels().length} kuratierte + ${(db.custom || []).length} eigene Modelle. Offene Suche, Test-Konsole und Zuweisung als Brain unter /models bzw. /tower. Gewünscht/installiert: ${db.installed.length}. Policy: nur reguläre Modelle (keine sicherheits-entkernten).`;
    } catch { return 'Modell-System nicht erreichbar.'; }
  }
  if (has('intercom', 'agenten-chat', 'agentenchat', 'besprechung')) {
    try {
      const ic = require('./agent_intercom');
      const st = ic.status();
      return `Agent Intercom (Area 84): ${st.channels.map((c) => '#' + c.id + ' (' + c.members.length + ')').join(' · ')} · ${st.messages_total} Nachrichten. Heads, Supers und ich stimmen uns dort ab — unter /intercom.`;
    } catch { return 'Intercom nicht erreichbar.'; }
  }
  if (has('scanner', 'scan', 'ports', 'verbindungen', 'anomal', 'angriff', 'angreifer', 'ddos', 'spionage', 'firewall', 'sentinel', 'einbruch', 'sicherheitswache')) {
    try {
      const se = require('./sentinel');
      const s = se.scan();
      const blocked = se.status().blocklist.length;
      const ports = s.listeners.map((l) => l.port + (l.allowed ? '' : ' ⚠')).join(', ') || 'keine';
      const ext = s.established.filter((c) => !se.isLoopback(c.peer)).length;
      return `Sentinel (Area 86) LIVE-Scan: Lage ${s.verdict}. Offene Ports: ${ports} (Erlaubnisliste 8080). Aktive Verbindungen: ${s.established.length} (${ext} von Fremd-IPs). Anomalien: ${s.anomalies.length}${s.anomalies.length ? ' — ' + s.anomalies.slice(0, 2).map((a) => a.type + ': ' + a.detail).join(' · ') : ''}. Quarantäne-Liste: ${blocked} IPs. Policy: TRACE-FIRST — Angreifer werden erst dokumentiert (Beweise), dann isoliert, dann Admin-Report; Loopback ist immer vertraut, kein Hack-Back. DDoS: App-Level-Rate-Limit aktiv (429 ab 200 req/10s pro Fremd-IP); für deine Root-Server empfehle ich zusätzlich Reverse-Proxy + fail2ban (Doku §29). Sag \"scan\" für einen neuen Live-Scan.`;
    } catch { return 'Sentinel nicht erreichbar.'; }
  }
  if (has('mega-api', 'mega api', 'mega-liste', 'mega liste', 'api-mega', 'apis', 'api-kategorien', 'free api')) {
    try {
      const yp = require('./yellow_pages');
      const all = yp.list({});
      const mega = all.filter((e) => String(e.category || '').startsWith('mega-'));
      const cats = [...new Set(mega.map((e) => e.category))];
      return `API-Mega-Liste (cporter202): ${cats.length} Mega-Kategorien mit ${mega.length} verankerten Ordnern in der Wissensbasis — von Automation (5.653 APIs) über KI (1.555), Dev-Tools (4.065), E-Commerce (2.245) bis SEO (903) und Social (2.786). Use-Case-Matrix als Wissens-Paket: jede API kommt über WF-17 (API-First Automation) rein — Auswahl → Security Steward (Schlüssel NUR in Vault 38, Policy-Check) → Connector in Service Fabric → Fact Check → dein OK (human gate). Social/Leadgen nur offizielle APIs + eigene Daten, REGEL 1 überall.`;
    } catch { return 'Mega-API-Listen nicht erreichbar.'; }
  }
  if (has('prompt', 'prompts', 'vorlage', 'harness')) {
    try {
      const yp = require('./yellow_pages');
      const libs = yp.list({ category: 'prompt-libraries' });
      return `Prompt-Bibliotheken: ${libs.length} kuratierte Mega-Listen in der Wissensbasis (Kategorie prompt-libraries) — u. a. Awesome ChatGPT Prompts, die 100k-Prompt-Sammlung, LLM-Prompt-Library (alle Modell-Familien: OpenAI/Claude/Gemini/Llama/Mistral/xAI), System-Prompts von ChatGPT/Claude Code/Cursor, Eval- & Engineering-Sammlungen. Jailbreak-/Bypass-Sammlungen lehne ich permanent ab (REGEL 1 + Sicherheitslinien). Harness-Kit (Area 85): CLAUDE.md, AGENTS.md, Hooks+Guard und Skill-Bundles als Downloads unter /api/harness/* bzw. Panel /harness — damit Claude Code & Co. unter deinen Regeln laufen.`;
    } catch { return 'Prompt-Bibliotheken nicht erreichbar.'; }
  }
  if (has('hello', 'hi', 'hallo')) return 'ULTRA MASTER BRAIN online. Ask about status, learning, schedules, workflows, teams, telegram, mail, deploy, wissen, modelle, prompts, intercom — I answer from live system state.';
  return `I answer from LIVE data only. Try: status · learning · schedules · workflows · teams · telegram · mail · deploy · kill · policy. (${C.total} areas, ${C.live} live.)`;
}
module.exports = { ask };
