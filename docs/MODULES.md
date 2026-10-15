# AURA — MODULE & AREAS (generiert aus der Registry)

> Area 67 schützt jede Live-Area: Timeout-Guard, Circuit Breaker, Quarantäne.
> Area 69 lernt jeden Fehler-Fingerprint: jeder eindeutige Fehler max. 1× ungelöst,
> Rezidive werden mit dem gelernten Fix sofort geblockt (rekursive Lernkurve).
> Area 70 ist das zentrale Modul-System: Manifest-Loader, Lifecycle, Rechte-Katalog,
> Approval-Gate — externe Module aus backend/modules/ ohne Codeänderung anbinden.
> Details: docs/RUNBOOK.md + docs/CONFIGURATION.md + docs/MODULE_SYSTEM.md.


| Area | Name | Zustand | Aktionen |
|---|---|---|---|
| 01 | Bootstrap & container runtime | live | — |
| 02 | Role registry / department templates | live | list, status |
| 03 | Cognitive Learning Core | live | submit, list, status |
| 04 | Tri-Vector Consensus Engine | live | evaluate, status |
| 05 | Multi-response / integrity control | live | compare, status |
| 06 | OpenRouter provider pinger | live | status, probe |
| 07 | Media metadata privacy pipeline | live | strip, status |
| 08 | Kids Story Pipeline (safety-filtered local engine) | live | story, status, safety_check |
| 09 | Kids Media Pipeline (Shot-Plan + SRT + Render-Adapter) | live | status, plan, srt, render |
| 10 | Content Incubation Engine (Ideen-Lifecycle + Scoring) | live | status, submit, list, advance, archive, brief |
| 11 | Editorial Incubation (Pipeline + 4-Augen-Sign-off) | live | status, create, list, stage, edit, calendar |
| 12 | Community Incubation (Feedback/Events, kein Fake-Engagement) | live | status, feedback_add, feedback_close, event_add, signup, template_save |
| 13 | Omnichannel Dispatcher (Queue + Consent + Idempotenz) | live | status, enqueue, flush, list |
| 14 | WordPress Gutenberg/REST (Drafts + Duplikat-Schutz) | live | status, publish, list |
| 15 | n8n Secure Dispatch / Kaggle Relay (HMAC + TTL + Allowlist) | live | status, webhook_add, webhook_remove, dispatch, compute_optin |
| 16 | Self-healing logger | live | tail, simulate_error, status |
| 17 | Daily Report Daemon (schedule-wired, live data) | live | status, enable, run |
| 18 | GitHub/NotebookLM Knowledge Sync (Manifest + Cache) | live | status, repo_add, repo_remove, sync, sync_all, notebooklm_add |
| 19 | Yellow Pages (admin-Wissensbasis + Brain-Feed, maximiert) | live | status, list, add, update, delete, restore, categories, ingest, feed, brain_bundle, export |
| 20 | MCP ingestion core | live | register, invoke, disable, enable, list, status |
| 21 | Daily news / algorithm analyzer | live | analyze, status |
| 22 | Local edge cache | live | set, get, status |
| 23 | Swarm / cross-platform sync | live | export, import, list, status |
| 24 | Chrono backup / SQL snapshots | live | snapshot, restore, list, status |
| 25 | Synaptic heartbeat bridge | live | beats, status |
| 26 | Master Hardware Router (Capability-Routing + Probes) | live | status, device_add, device_remove, route, release, probe |
| 27 | Intranet Compute Router (Knoten + Job-Scheduling) | live | status, node_register, heartbeat, submit, complete |
| 28 | Cloud Environment Connector (Opt-in + Pläne) | live | status, optin, overview, plan |
| 29 | Sandbox Mesh Engine (Join/Heartbeat/Routing-Table) | live | status, join, leave, heartbeat, table |
| 30 | Streaming Telemetry / Remote Workers (echte Metriken, SSE) | live | status, snapshot, stream, worker_register, worker_heartbeat, workers |
| 31 | OmniRoute Financial Engine (Kosten-Ledger + Budgets, kein Trading) | live | status, budget, rates, usage, spend |
| 32 | Crypto faucet engines / brokers | restricted | — |
| 33 | Mining / unMineable control | restricted | — |
| 34 | Gateway Health Monitor (Latenz/Uptime, legales Redesign) | live | status, endpoint_add, endpoint_remove, check, report |
| 35 | Delivery Monitor (Zustellung eigener Inhalte, Redesign) | live | status, ingest, mark, quota |
| 36 | CAPTCHA learning / bypass hub | restricted | — |
| 37 | Vision Bridge / MCP Vision (Consent-Gate + Ollama-llava) | live | status, analyze, history |
| 38 | Identity Vault (AES-256-GCM) + Inbox-Orchestrierung | live | status, add, list, read, remove, inboxes |
| 39 | Algorithm matrix / A/B testing | live | assign, status |
| 40 | Variance Lifecycle / Swarm Evolution (mit Governance) | live | status, create, score, promote, retire, list |
| 41 | HyperFrames (HeyGen) | skill | — |
| 42 | Impeccable design language | skill | — |
| 43 | Agent-Reach (agent eyes) | skill | — |
| 44 | NVIDIA OpenShell | skill | — |
| 45 | Hindsight — agent memory | skill | — |
| 46 | VoiceBox — open voice studio | skill | — |
| 47 | Unsloth — local LLM training | skill | — |
| 48 | UI/UX Pro Max skill | skill | — |
| 49 | Autonomous loop / learning curve | live | start, stop, tick, curve, status |
| 50 | Superpowers framework | skill | — |
| 51 | Awesome Claude Skills | skill | — |
| 52 | Karpathy behavior skills | skill | — |
| 53 | ECC harness optimization | skill | — |
| 54 | Official plugin directory | skill | — |
| 58 | OmniRoute model router | live | route, status, set_budget |
| 59 | TXT/JSON hot-reload watcher + backup vault | live | status, start, stop |
| 60 | Schedule planner | live | list, add, remove, recommend, status |
| 61 | Workflow Builder (roles → gates → JSON → sim) | live | status |
| 62 | Deep Research (live GitHub-API fan-out) | live | status |
| 63 | SEO Center (on-site audit + sitemap/robots) | live | status |
| 64 | Backup Vault (verified snapshots + restore) | live | status |
| 65 | Honest traffic telemetry (real counts, no bots) | live | status |
| 66 | Massive Logging + Self-Repair Daemon | live | status, run_check, simulate_error |
| 67 | Module Containers (crash isolation + circuit breaker) | live | status, drill, reset |
| 68 | Global Config (schema-validated, hot-reloaded) | live | status |
| 69 | Recursive Learning Core (max 1 failure per fingerprint) | live | status, simulate |
| 70 | Central Module System (manifest loader + lifecycle + permissions) | live | status, scan, approve, enable, disable, configure, execute, health, catalog |
| 71 | Image Generation Gateway (ComfyUI + WebUI) | live | status, probe, generate |
| 72 | MCP Server Manager (add/delete/install/uninstall + usage) | live | status, add, install, uninstall, remove, use |
| 73 | Content Forge (minion automation, human-gated publishing) | live | status, create, modify, approve, post, routine_add, routine_run |
| 74 | Service Fabric (self-installable services + modes) | live | status, add, remove, install, uninstall, enable, probe, mode |
| 75 | Routine & Link Control (toggle on/off + add/delete) | live | status, toggle, link_add, link_remove |
| 76 | Creative Studio Suite (7 studios, real generators) | live | status, generate |
| 77 | Test Lab (force-run + expect-failure view) | live | status, run, suite |
| 78 | Telegram Agent (official Bot API, allowlisted commands) | live | status, probe, start, stop |
| 79 | Ollama Model Manager (offen: Katalog + custom + Suche + Test) | live | status, catalog, probe, pull, custom_add, custom_remove, search, test, keys, install-script |
| 80 | Brain Mapper (Super/Ultra Master Brain Role-Mapping) | live | status, map, assign, unassign, tier-default |
| 81 | Control Tower (Admin-Direktiven + Safety-Floor + Fault-Ack) | live | status, all, orders, set, ack |
| 82 | Crosslink Policy (neue Crosslinks je Modul allow/restrict) | live | status, overview, set |
| 83 | Function Registry (add/ignore, Delete mit Warnung + Soft-Delete) | live | status, add, ignore, reactivate, delete, restore |
| 84 | Agent Intercom (Chat Heads/Supers/Ultra + Besprechungen) | live | status, channels, messages, post, say, meeting, clear |
| 85 | Harness-Kit (Claude Code/Cursor/OpenClaw unter REGEL 1) | live | status, claude_md, agents_md, hooks, guard, skills |
| 86 | Sentinel — Live-Sicherheitswache & Scanner (Ports/Verbindungen/Quarantäne) | live | scan, block, unblock, events, status |
| pkg:crash-dummy | Crash Dummy (v1.0.0) | pkg | boom, slow, ok |
| pkg:echo-integration | Echo Integration (v1.0.0) | pkg | ping |
| pkg:hello-tool | Hello Tool (v1.0.0) | pkg | greet, stats |

## Zählstand

- gesamt: **86** · live: **67** · Skills: **13**
- placeholder: **0** · review: **0** · restricted: **3** (Faucets, Mining, CAPTCHA-Bypass — dauerhaft 403)



## Modul-System (Area 70) — externe Module

- Modul-Verzeichnis: `backend/modules/` · Manifest: `aura.module.json` · Spec: `docs/MODULE_SYSTEM.md`
- Lifecycle: discover → validate → configure → initialize → ready → execute → shutdown
- Sicherheit: Approval-Pflicht, Rechte-Katalog (least privilege), Schema-Validierung, Timeouts, Quarantäne nach 3 Fehlern, Audit.
- Verwaltung: /containers (Sektion MODULE HUB) · API: /api/modulehub/*

| Modul | Version | Typ | Status |
|---|---|---|---|
| crash-dummy | 1.0.0 | module | needs_approval |
| echo-integration | 1.0.0 | integration | live |
| hello-tool | 1.0.0 | module | live |

## Image Generation Gateway (Area 71) — ComfyUI + WebUI

- UI: `/imagegen` · API: `/api/imagegen/status|config|generate|history|artifact/:name`
- Backends: ComfyUI (POST /prompt → /history-Polling → /view) und AUTOMATIC1111 WebUI (/sdapi/v1/txt2img|img2img, startet mit `--api`).
- Ehrlichkeit: Engine-Zustände LIVE / NOT-CONFIGURED / NOT-CONNECTED; ohne verbundenes Backend erzeugt `engine=sim` ein lokal gerendertes, als **SIMULATION** gelabeltes PNG — niemals Fake-LIVE.
- Sicherheit: URL-Schema-Validierung, Path-Traversal-Schutz bei Artefakten, Kill-Switch blockt config+generate (423), keine Secret-Werte in Status-APIs.

## MCP Manager (Area 72)

- UI: `/mcp` · API: `/api/mcp/*` · AURA als MCP-Server: `POST /api/mcp` (HTTP-JSON-RPC) + `node backend/mcp_server.js` (stdio, in Claude Desktop/Cursor einbindbar).
- User-defined MCP-Server: add / install / uninstall / enable / disable / delete / use + Usage-Tracking je Server.
- Sicherheit: stdio-Spawn nur für Allowlist-Binaries (npx, uvx, node, python, python3, deno, bun); Secret-Werte bleiben außerhalb der Konfiguration.
- Ehrlichkeit: `configured-not-connected`, bis auf eigener Hardware ein Handshake gelingt (`POST /api/mcp/servers/:id/test`).

## Content Forge (Area 73) — Minion-Automatisierung

- UI: `/forge` · API: `/api/content/*` · 63 Rollen-Minions arbeiten die Pipelines create/modify/post ab.
- Auto-Create + Auto-Modify laufen automatisch (AUTO-DRAFT, lokale Engine, Versionen-Historie); Routinen feuern per Daemon-Tick.
- Auto-Post ist hart gegatet: 403 ohne menschliche Freigabe, externe Kanäle NOT-CONNECTED bis offizielle API-Adapter mit Zugangsdaten existieren, Engagement-Automatisierung dauerhaft 403.
- Querverbindungen: WF-1/6/7/9, Area 60 Schedule, Area 08 Kinderschutzfilter für Storys, Area 64 Vault, Ledger-Audit für jeden Publish-Versuch.

## Service Fabric (Area 74) — selbst einbaubare Services + Modi

- UI: `/forge` (Tabs) · API: `/api/services/*` · interne Services mit echten Health-Probes, eigene HTTP-Services add/install/uninstall/toggle/probe.
- System-Modi (safe/creative/quiet) schalten Verhalten ohne Neustart — Safe Mode blockt z. B. Bild-Generierung (423).
- System-Services sind lösch-geschützt (403); Usage-Tracking je Service.

## Routine & Link Control (Area 75) — /control

- Toggle on/off für JEDE Kern-/Gehirn-Routine (Autonomy-Loop, Watcher, Self-Repair, Forge-Tick, Report-Daemon, Telegram-Poller …) — persistiert, ohne Neustart.
- Parallele Verknüpfungen (Querverbindungen): add/delete/toggle zwischen Routinen, Workflows und Areas; Producer feuern aktive Ziele parallel (reine Lese-Verknüpfung, kein Auto-Post).

## Creative Studio Suite (Area 76) — /studio

- 7 echte Generator-Studios weit über Kinderbücher hinaus: Book (Kinder/Roman/Sachbuch inkl. Outline, Kapiteln, Cover-Brief), Article (Sections + SEO-Meta), Social (Hook-Varianten), Newsletter (DSGVO-Hinweis), Script (Szenen/Timings), Podcast (Run-down), Pitch (Problem→Ask).
- Jedes Artefakt wandert in die Forge-Bibliothek (Gate/Ledger greifen); Kinder-Genre läuft durch den Area-08-Schutzfilter; ehrliche LOCAL-TEMPLATE-ENGINE-Labels.

## Test Lab (Area 77) — Force-Run mit Expect-Failure-Ansicht

- POST /api/testlab/run: jede Live-Action force-runnbar (force=true setzt Container-Fails/Quarantäne zurück) — Admin kann neue/fehlerhafte Module jederzeit modular testen.
- expect:'fail' zeigt kontrollierte Crashs als ERWARTETES Ergebnis (MATCH ✔), statt sie zu verstecken; /api/testlab/suite fährt alle Live-Module.

## Telegram Agent (Area 78)

- Offizielle Bot-API-Anbindung: Token in deploy/.env (gitignored, nie im Repo), ehrlicher getMe-Probe-Status, Poller startet nur bei echter Verbindung, Befehle nur mit Chat-Allowlist (TELEGRAM_ALLOWED_CHATS).
- Befehle: /status /report /forge /control /snapshot /kill /revive CONFIRM. Sandbox ohne Egress zeigt ehrlich NOT-CONNECTED — auf eigener Hardware verbindet der Agent sofort.

## Crash-freie Laufzeit-Erweiterung (Hot-CRUD + How-to)

- POST /api/depts/add|remove und /api/skills/add|remove: validiert + atomar geschrieben + Hot-Reload — neue Departments/Rollen/Skills sofort nutzbar, ohne Neustart, ohne Syntax-Crash-Risiko.
- docs/HOWTO_BUILD.md + GET /api/howto: maschinenlesbare Aufbau-Anleitung für externe Builder-Agenten (Verträge, Crash-Vermeidung, Checkliste).

## Ollama Model Manager (Area 79) — kuratierter Modell-Katalog

- Kuratierter Katalog mit 28 regulären Modellen in 6 Klassen (Swarm, Coding, Reasoning, Creative, Worker, Vision): probe/pull/remove gegen eine lokale Ollama-Installation; Pulls werden als "queued/wanted" markiert, wenn die Sandbox Ollama nicht erreichen kann (ehrlicher NOT-CONNECTED-Status).
- Policy: KEINE uncensored/abliterated/refusal-free Modelle im Katalog — ein Pull solcher Modelle wird mit 400 abgelehnt; das Entfernen von Schutzmechanismen ist out of scope (bewusste, protokollierte Entscheidung statt globalem Bypass).
- GET /api/ollama/install-script: direkt herunterladbarer Installer (Content-Disposition attachment) für die eigene Hardware — lädt nur die freigegebenen regulären Modelle.

## Brain Mapper (Area 80) — modulare Gehirn-Rollen

- Rollenzuweisung aus der echten Hierarchie: Ultra Master Brain (Ultras) und Super Master Brain (Superbrains) als Department-Gehirne, dazu Head-/Minion-Slots; Abdeckung wird als Coverage gezählt.
- Explizites assign/unassign pro Rolle + "Tier-Default" stellt die Zuordnung auf die Ebenen-Standardwerte zurück; verwaiste Zuweisungen werden automatisch bereinigt.

## Control Tower (Area 81) — Direktiven, Safety-Floor & Fault-Ack

- Admin-Direktiven pro Ziel (Node/Department/Kollektiv): versioniert, aktivierbar/deaktivierbar, mit Grund-Pflicht und Audit-Log; jeder Direktivsatz wird zusammen mit einem unveränderlichen SAFETY_FLOOR ausgeliefert (keine Direktive kann Sicherheitsregeln aufheben).
- Direktiven, die Schutzmechanismen/Fehlerbehandlung pauschal abschalten wollen, werden mit 403 abgelehnt und protokolliert.
- Statt eines globalen "ignoriere alle Fehler/Regeln"-Schalters: gezieltes Fault-Ack (ackFault) pro Item — verlangt eine Grund (≥5 Zeichen), setzt Container-Fails zurück und wird geloggt; volle Admin-Kontrolle, kein Bot bricht aus.

## Crosslink Policy (Area 82) — neue Crosslinks je Modul

- Pro Live-Modul allow/restrict für NEUE Crosslinks (Default: allow); Producer (Content Forge, Studio, Test Lab) prüfen die Policy, bevor sie einen neuen Crosslink anlegen; Overview + Log zeigen jede Entscheidung.

## Function Registry (Area 83) — Funktionen verwalten mit Sicherheitsnetz

- Zentrale Registry der Kernfunktionen (inkl. geschützter Kill-Switch): add/ignore/reactivate mit Live-Spiegel in die Ausführungs-Whitelist.
- Delete ist zweistufig (Warnung + Bestätigungs-Token) und SOFT (wiederherstellbar) — versehentliches Klicken führt zu keinem Crash; geschützte Funktionen sind nicht löschbar (403).

## Sentinel (Area 86) — Live-Sicherheitswache & Scanner · /api/sentinel/*

- Echte Live-Daten aus `/proc/net/tcp(6)`: offene Ports (Abgleich gegen Erlaubnisliste 8080), aktive Verbindungen, Anomalien, Lage-Bewertung RUHIG/WACHSAM/ALARM.
- Policy (vom Administrator vorgegeben): **TRACE-FIRST** — ein Angreifer wird zuerst beobachtet und dokumentiert (Beweise in `data/sentinel.json`), DANN isoliert (Quarantäne → 403) und dem Admin gemeldet. Loopback ist immer vertraut (Admin-Konsole). Kein Hack-Back: Verteidigung ja, Zurückschlagen nein.
- Wächter im Request-Pfad (backend/server.js): verdächtige Pfade (kill/exec/Traversal/wp-login/.env/.git…) werden pro Fremd-IP gezählt; ab 25 Treffern in 10 Min → Auto-Quarantäne (vom Admin autorisiert).
- App-Level-DDoS-Bremse: 429 ab 200 Requests/10s pro Fremd-IP (Loopback ausgenommen). Für volumetrische Angriffe auf die künftigen Root-Server: Reverse-Proxy + fail2ban/CrowdSec davor (Empfehlung Doku §29).
- A2A-Surface (Agent2Agent-Protokoll): `/api/a2a/agent-card` (Agent Card) + `POST /api/a2a` (JSON-RPC message/send → ULTRA MASTER BRAIN). Peers von außen: NOT-CONNECTED (kein Egress) — ehrlich gelabelt.

## Harness-Kit (Area 85) — Claude Code / Cursor / OpenClaw unter REGEL 1 · /api/harness/*

- Generiert fertige Harness-Konfigurationen als Downloads (attachment): CLAUDE.md, AGENTS.md, settings.json mit PreToolUse-Hooks (harness-guard.sh blockt destruktive Befehle, Push nach main, Tor/SOCKS-Tunnel, uncensored-Modelle) sowie skill.md-Bundles aller Gehirn-Ebenen (Tier 0–2) — damit externe Coding-Agenten in AURA automatisch an REGEL 1 (Admin-Primat), Ehrlichkeits-Labels und die permanenten Ablehnungen gebunden sind.
- Mega-Listen-Integration (Task 22): Yellow Pages +8 Kategorien & 18 Einträge (u. a. MoneyPrinterTurbo, YouTube-Automation, OpenRouter, awesome-selfhosted, AnythingLLM, aio-sandbox, Excalidraw, Unsloth, OpenHuman, OpenMausBot; unbekannte Repos review-gated). Service Fabric +4 selfhost-Presets. Neue Workflows WF-14 (Video-Automation, eigener Kanal + human gate), WF-15 (Selfhost-Stack), WF-16 (Local-LLM Training & RAG).
- NICHT integriert: OnionClaw (Tor/Darkweb-Tunnel, anonyme Identitäts-Rotation, autonome Loops ohne menschliche Bestätigung) — fällt unter die permanenten Sicherheitslinien (Stealth/Anonymisierungs-Tunnel + Handeln ohne Admin-Freigabe).

## Agent Intercom (Area 84) — Chat der Agenten untereinander · /intercom

- Department HEADS, SUPER MASTER BRAINS und das ULTRA SUPER BRAIN bekommen eigene Kanäle und können sich abstimmen: #bridge (Kommandobrücke, alle Ebenen), #supers (Strategie-Runde), #heads (Abteilungsleiter). Mitglieder werden live aus der Hierarchie abgeleitet — neue Departments erscheinen automatisch.
- Ehrliche Stimmen: Ohne laufendes Ollama spricht jeder Agent aus den ECHTEN Live-Daten seines Verantwortungsbereichs (Flottenstatus, Audit, Lernbilanz) und ist klar als LOKAL gelabelt. Auf dem Host mit Ollama spricht der Agent über sein zugewiesenes Modell (Area 80, gelabelt LLM).
- Besprechungs-Modus: strukturierte Runde Heads → Supers → Ultra als Abschluss; jedes Wort wird persistiert (Verlauf pro Kanal, 500er-Cap). Admin kann in jedem Kanal mitposten; Nicht-Mitglieder werden abgelehnt (403).
- Cross-wired: Ultra-Brain antwortet auf "intercom"/"besprechung" mit Live-Beständen; Hub-Karte + Ignition-Eintrag vorhanden.

## Server-Neustart (Ops) — Restart-Funktion neben dem Kill-Switch

- POST /api/ops/restart mit {"confirm":"RESTART"}: Server fährt kontrolliert herunter und startet sich selbst neu (detached Re-Exec), während der Kill-Switch (ops.shutdown) unabhängig bleibt; ohne Bestätigung 400.

## Gelbe Seiten maximiert (Area 19) — /yellowpages

- Aus dem reinen Katalog-Ingestor wurde eine vollständige admin-verwaltete Wissensbasis: Kategorien, Links, Services, Wissen & How-tos selbst anlegen/bearbeiten/löschen (Soft-Delete mit Restore), Suche + Filter, JSON-Export als Download.
- Brain-Feed: beliebige Einträge oder ganze Kategorien lassen sich als Wissenspaket dem Super/Ultra-Brain bereitstellen (GET /api/yp/brain-bundle); das Ultra-Brain antwortet auf "wissen" mit Live-Beständen.
- Die bisherigen 62 kuratierten Links wurden automatisch migriert; /api/yellowpages bleibt abwärtskompatibel; Deep-Research-Vorschläge (/api/yellowpages/suggest) landen review-gated im neuen System; Katalog-Ingest (ingest/apis.txt) bleibt als Import zuschaltbar.

## Model Bay — offenes Modell-System (Area 79) — /models

- Der Admin ist NICHT auf den kuratierten Katalog beschränkt: jedes reguläre Modell kann selbst registriert werden (Ollama-Name, GGUF-Quelle, HF-Repo, lokale Datei), ist dann pullbar, testbar und als Brain zuweisbar (Area 80).
- Offene Suche: lokale Treffer + Live-Suche im Ollama-Netzwerk (ollama.com) — Netz-Treffer lassen sich per Klick als eigenes Modell registrieren; ohne Netz ehrlich NOT-CONNECTED.
- Test-Konsole: jedes registrierte Modell direkt mit Prompt anfragen (läuft gegen echtes Ollama auf dem Host); API-Keys/Endpunkte konfigurierbar (maskierte Anzeige, deploy/.env-Präferenz).
- Eine schmale Policy-Linie bleibt bestehen: Modelle, deren Zweck das Entfernen von Schutzmechanismen ist (uncensored/abliterated/refusal-free), werden weiterhin abgelehnt (400, protokolliert). Alles andere ist frei.

## Mission Grid — Areas 09–15, 18, 26–31, 34/35, 37/38, 40 auf LIVE — /grid

- Alle 14 Platzhalter- und 5 Review-Module wurden zu echten Live-Modulen ausgebaut (0 Platzhalter, 0 Review verbleiben); die 3 dauerhaft restricted Bereiche (32/33/36) bleiben bei 403.
- 09 Kids Media: Story → Shot-Plan mit Timing/Kamera → SRT-Export → Render-Adapter (ffmpeg-Erkennung, ehrlich).
- 10 Content Incubation: Ideen-Lebenszyklus intake→draft→ready mit echtem Scoring (clarity/spec/novelty).
- 11 Editorial Incubation: Redaktions-Pipeline mit 4-Augen-Sign-off (approver ≠ autor erzwungen).
- 12 Community Incubation: Feedback-Tracker, Events, Vorlagen — ausdrücklich OHNE synthetisches Engagement.
- 13 Omnichannel Dispatcher: echte Queue mit Consent-Pflicht (400 ohne), Idempotenz-Keys (409 bei Duplikat), Retry/Dead-Letter.
- 14 WordPress: REST-Client mit Application-Password (deploy/.env), Duplikat-Schutz über Titel-Hash, lokaler Entwurf ohne Verbindung.
- 15 n8n/Kaggle: HTTPS-Only-Allowlist, HMAC-SHA256-Signatur, TTL/Zeitstempel, Payload-Limit, Opt-in-Compute.
- 18 Knowledge Sync: GitHub-Repo-Registry + Sync-Manifest (SHAs) + lokaler Cache; NotebookLM als ehrliche manuelle Link-Registry.
- 26 Hardware Router: Geräte-Registry mit Capabilities, Routing per Capability-Match + geringste Last, TCP-Probes.
- 27 Compute Router: Intranet-Knoten mit Heartbeat/Stale-Erkennung und Job-Scheduling auf den freiesten Knoten, Queue für wartende Jobs.
- 28 Cloud Connector: Provider-Registry mit explizitem Opt-in + Credential-Nachweis (envbasiert, nie im Repo).
- 29 Mesh Engine: Join/Leave/Heartbeat + Routing-Tabelle — läuft als ehrliches 1-Knoten-Mesh, keine Simulation.
- 30 Telemetry Stream: echte Prozess-/Host-/Fleet-Metriken als SSE (2s-Takt) + Remote-Worker-Registry; alle Zahlen gemessen, nie erfunden.
- 31 Finance Engine (Redesign): Kosten-Ledger + Budgets + Alarme über reale OmniRoute-Nutzung — KEIN Trading.
- 34 Gateway Health (Redesign): Latenz/Uptime-Messung eigener/autorisierter Endpunkte inkl. Selbstcheck — keine Umgehungsfunktionen.
- 35 Delivery Monitor (Redesign): Zustellungs-Quoten eigener Inhalte aus Area 13 (offizielle APIs) — keine Manipulations-Heuristiken.
- 37 Vision Bridge (Redesign): Bildanalyse NUR mit consent=true und nur admin-übergebenen Bildern, Backend Ollama-llava.
- 38 Identity Vault (Redesign): AES-256-GCM-Verschlüsselung at rest, Schlüssel nur aus ENV/deploy/.env, Audit bei jedem Zugriff, kein Wert-Logging.
- 40 Variance Lifecycle: Varianten candidate→trial→promoted/retired mit Governance (Promotion nur mit Avg-Score ≥ 60 + Admin-Freigabe).
- Externe Adapter melden ohne Netz/Credentials ehrlich NOT-CONNECTED und sind auf dem Host des Admins sofort usage-ready.

## Vollausbau Area 08 + 17

- 08 Kids Story Pipeline: lokale Vorlagen-Engine mit Kinderschutz-Blocklist, Altersbänder, HUMAN-REVIEW-Label; von Area 73 für Story-Content genutzt.
- 17 Daily Report Daemon: pflegt automatisch einen Area-60-Schedule-Eintrag, baut Reports aus echten Live-Daten, in-process-Tick im Server.

## AURA OS Intelligence + Admin Copilot

- **AURA OS Intelligence:** deterministische Live-Briefings in `/aura-os#intelligence`, erweitert unter `/intelligence`, API-kompatibel über `POST /api/jarvis`.
- Intents: status · learning · containers · backups · logs · traffic · roles · workflows · research · kill-switch.
- Browser-Sprachausgabe im erweiterten Intelligence HUD (SpeechSynthesis, offline-fähig, kein externer Dienst).
- **AURA Admin Copilot:** `/jarvis` (auch `/admin`) für Gespräche mit einem explizit gewählten lokalen Loopback-Ollama-Modell, kompaktem Systemkontext und Workflow-Shortcuts. Keine Aktionswerkzeuge oder externe Modell-Fallbacks.


_Generiert am 2026-10-12 aus der laufenden Registry._
