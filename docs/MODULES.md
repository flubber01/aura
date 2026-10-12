# AURA — MODULE & AREAS (generiert aus der Registry)

> Area 67 schützt jede Live-Area: Timeout-Guard, Circuit Breaker, Quarantäne.
> Area 69 lernt jeden Fehler-Fingerprint: jeder eindeutige Fehler max. 1× ungelöst,
> Rezidive werden mit dem gelernten Fix sofort geblockt (rekursive Lernkurve).
> Details: docs/RUNBOOK.md + docs/CONFIGURATION.md.

| Area | Name | Zustand | Aktionen |
|---|---|---|---|
| 01 | Bootstrap & container runtime | live | — |
| 02 | Role registry / department templates | live | list, status |
| 03 | Cognitive Learning Core | live | submit, list, status |
| 04 | Tri-Vector Consensus Engine | live | evaluate, status |
| 05 | Multi-response / integrity control | live | compare, status |
| 06 | OpenRouter provider pinger | live | status, probe |
| 07 | Media metadata privacy pipeline | live | strip, status |
| 08 | Kids Story Pipeline | placeholder | — |
| 09 | Kids Media / mimetic video pipeline | placeholder | — |
| 10 | Content incubation engine | placeholder | — |
| 11 | Editorial incubation | placeholder | — |
| 12 | Community incubation | placeholder | — |
| 13 | Omnichannel dispatcher | placeholder | — |
| 14 | WordPress Gutenberg / REST | placeholder | — |
| 15 | n8n secure dispatch / Kaggle relay | placeholder | — |
| 16 | Self-healing logger | live | tail, simulate_error, status |
| 17 | Daily report daemon | placeholder | — |
| 18 | GitHub / NotebookLM knowledge sync | placeholder | — |
| 19 | Yellow Pages / catalog ingestor | live | ingest, status |
| 20 | MCP ingestion core | live | register, invoke, disable, enable, list, status |
| 21 | Daily news / algorithm analyzer | live | analyze, status |
| 22 | Local edge cache | live | set, get, status |
| 23 | Swarm / cross-platform sync | live | export, import, list, status |
| 24 | Chrono backup / SQL snapshots | live | snapshot, restore, list, status |
| 25 | Synaptic heartbeat bridge | live | beats, status |
| 26 | Master hardware router | placeholder | — |
| 27 | Intranet compute router | placeholder | — |
| 28 | Cloud environment connector | placeholder | — |
| 29 | Sandbox mesh engine | placeholder | — |
| 30 | Streaming telemetry / remote workers | placeholder | — |
| 31 | OmniRoute financial engine | review | — |
| 32 | Crypto faucet engines / brokers | restricted | — |
| 33 | Mining / unMineable control | restricted | — |
| 34 | Proxy / gateway health monitor | review | — |
| 35 | Shadow-ban sentinel | review | — |
| 36 | CAPTCHA learning / bypass hub | restricted | — |
| 37 | Visual agent eyes / MCP Vision | review | — |
| 38 | Identity vault / inbox orchestration | review | — |
| 39 | Algorithm matrix / A/B testing | live | assign, status |
| 40 | Variance lifecycle / swarm evolution | placeholder | — |
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
| 67 | Module Containers (crash isolation + circuit breaker) | live | status, drill |
| 68 | Global Config (schema-validated, hot-reloaded) | live | status |
| 69 | Recursive Learning Core (max 1 failure per fingerprint) | live | status, simulate |

## Zählstand

- gesamt: **66** · live: **29** · Skills: **13**
- placeholder: 16 · review: 5 · restricted: **3** (Faucets, Mining, CAPTCHA-Bypass — dauerhaft 403)

## J.A.R.V.I.S.

- Echter Assistent über Live-Daten: `/jarvis` + `POST /api/jarvis`.
- Intents: status · learning · containers · backups · logs · traffic · roles · workflows · research · kill-switch.
- Browser-Sprachausgabe (SpeechSynthesis, offline-fähig, kein externer Dienst).

_Generiert am 2026-10-10 aus der laufenden Registry._
