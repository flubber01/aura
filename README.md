# AURA Agent Command Center — full-stack build

Static frontend (from `AURA-Web-Deploy.zip`) + zero-dependency Node backend + modular brain system.
Everything runs with `node backend/server.js` → http://localhost:8080 (binds 0.0.0.0).

## Screens & pages
| Path | What |
|---|---|
| `/` | original AURA Command Center UI |
| `/hub` | multi-screen: blue 3D brain (5D) · Matrix · JARVIS · Command — all animated, live data |
| `/jarvis` | **AURA Admin Copilot** — owner chat workspace for a selected local loopback Ollama model, bounded system context and real workflow shortcuts; no action tools |
| `/admin` | **AURA Admin Console** — local-source-of-truth cockpit for server-refreshed Ollama models/profiles, departments/roles, release evidence and safe workflow simulations |
| `/login` | **Owner Login** — opt-in production bootstrap/login surface; requires external environment secrets before authentication enforcement is enabled |
| `/aura-os#intelligence` (expanded: `/intelligence`) | **AURA OS Intelligence** — deterministic read-only live briefings for system, Today View, Studio posture, workflow routing and source-bundle handoff |
| `/console` | **AURA Control Surface** — searchable live module registry with callable-action visibility and policy states |
| `/downloads` | **Download Vault** — on-demand complete safe source/docs/config archive plus a focused Studio Command + J.A.R.V.I.S. ZIP, alongside generated catalogs |
| `/brain` | 5-dimensional radial layout (Perceive/Reason/Act/Remember/Govern) |
| `/master` | Living Master Control HUD (real telemetry only; restricted shows policy, never fake data) |
| `/hierarchy` | ULTRA → SUPER (+side servers) → DEPARTMENT HEADS → MINIONS; deploy bundles (role/prompt/skills to ANY AI), feedback learning, vita DB, ultra chat, minion live stream |
| `/skills` | skill DB (13 wired, ~1.3M★), 7 departments, 15 roles, prompt library |
| `/pipelines` | WF-1…WF-21 versioned workflow map and safe human-gated handoff notes |
| `/workflows` | **Workflow Control** — local draft → simulation → explicit approval → documented handoff lifecycle; no execution adapters |
| `/aura-os` | **AURA OS** — self-hostable Creator Operating Layer: Artist/Label/Creator Cells, Product Flights, embedded Intelligence HUD and one reviewable Operating Profile |
| `/aura-os/launchpad` | **AURA OS Launchpad (Area 96)** — local pricing/trial intents, NasihatBeatZ 47 presence blueprints, consent-aware newsletter drafts, Companions, Live-Voice-Consent, MIDI profiles and STUDIO47 interest lane |
| `/creator-continuity` | **Creator Continuity & Asset Reactor (Area 97)** — time-off coverage drafts, rights-gated avatar/voice settings, return guardrails and product image → multi-format production briefs |
| `/remote-approval` | **Remote Approval Deck (Area 98)** — allowlisted Telegram/BotFather readiness, WhatsApp/Meta official gates, remote review cards and audit-only owner decisions |
| `/creator-collaboration` | **Creator Collaboration Room (Area 99)** — self-hosted multi-city brainstorm rooms, participant codes, local Content-Bot facilitation and messenger bridge gates |
| `/creator-revenue` | **Creator Revenue (Area 100)** — one creator referral code, anti-fraud attribution, validated-credit ledger and provider-safe payment simulation (no real payment connection) |
| `/creator-passport` and `/today` | **Creator Project / Release Passport (Area 101)** — local project spine, rights-aware asset/version graph, owner review, release-readiness preflight and Today View |
| `/studio-command` | **Studio Command (Area 102)** — 9 departments, 50+ studio roles, 40 capability cards, camera/sequence/review manifests, delivery briefs and browser shortcuts |
| [`docs/AURA_REMOTE_APPROVAL_CONNECTORS.md`](docs/AURA_REMOTE_APPROVAL_CONNECTORS.md) | Area 98: BotFather/Telegram remote-review path, WhatsApp/Meta official connector gates, approval audit and partnership dossier boundary |
| [`docs/AURA_COLLABORATION_MONETIZATION.md`](docs/AURA_COLLABORATION_MONETIZATION.md) | Areas 96/99: three-tier monetization, fair branding policy, royalty-review path and self-hosted Creator Collaboration Rooms |
| [`docs/AURA_REVENUE_REFERRAL_SIMULATION.md`](docs/AURA_REVENUE_REFERRAL_SIMULATION.md) | Area 100: referral policy, payment-simulation lifecycle, provider replacement contract, production gates and competitive-product gap map |
| [`docs/AURA_RELEASE_PASSPORT.md`](docs/AURA_RELEASE_PASSPORT.md) | Area 101: project passport, asset/version graph, rights controls, owner preflight, Today View and handoff boundary |
| [`docs/AURA_STUDIO_COMMAND.md`](docs/AURA_STUDIO_COMMAND.md) | Area 102: Studio Command team, 40 capability cards, API, stage gates, delivery truth and validation |
| [`docs/AURA_OS_BOOT_AND_SHORTCUTS.md`](docs/AURA_OS_BOOT_AND_SHORTCUTS.md) | AURA OS boot identity, local command palette and configurable browser shortcuts |
| [`docs/AURA_STUDIO_REFERENCE_RADAR.md`](docs/AURA_STUDIO_REFERENCE_RADAR.md) | Source/workflow reference radar and mandatory license/security/owner adoption gate |
| [`docs/AURA_STUDIO_BACKUP_AND_DRIVE.md`](docs/AURA_STUDIO_BACKUP_AND_DRIVE.md) | Area 102 source/docs backup scope, exclusions, secure Drive handoff and restore boundary |
| [`docs/AURA_JARVIS_OPERATING_INTELLIGENCE.md`](docs/AURA_JARVIS_OPERATING_INTELLIGENCE.md) | AURA OS Intelligence deterministic briefing contract, workflow integration, safety boundary and on-demand ZIP handoff |
| [`docs/AURA_ADMIN_COPILOT.md`](docs/AURA_ADMIN_COPILOT.md) | Admin Copilot: local loopback Ollama chat, compact context, workflow shortcuts and strict no-action boundary |
| [`docs/AURA_INFRASTRUCTURE_CONTROL_ROOM.md`](docs/AURA_INFRASTRUCTURE_CONTROL_ROOM.md) | Separate AURA base-project infrastructure model: protected Main Core, optional Project Arms, preflight and no-remote-execution boundary |
| [`docs/AURA_WORKFLOW_OPERATING_MODEL.md`](docs/AURA_WORKFLOW_OPERATING_MODEL.md) | Governed workflow lifecycle, WF-14…WF-21 pack, audit-chain boundary and Hermes planning contract |
| [`docs/AURA_CLEAN_REBUILD_AND_CUTOVER.md`](docs/AURA_CLEAN_REBUILD_AND_CUTOVER.md) | Parallel clean rebuild, verification, safe cutover, rollback window and later Hermes isolation plan |
| [`docs/AURA_PRODUCTION_HARDENING.md`](docs/AURA_PRODUCTION_HARDENING.md) | Owner auth, CORS boundary, non-destructive preflight, isolated restore verification, model capacity and WF-20 release evidence |
| [`docs/MODULE_SPEC.md`](docs/MODULE_SPEC.md) | **Runde 10 / E**: verbindliche, maschinenlesbare Modul-Schnittstelle v2 (`routes[]`, `permissions[]`, `selftest`), Verbotsliste, Import-Prüfprotokoll |
| `/selfwork` | **Selbstbearbeitungs-Werkbank (Area 103)** — lokales Modell schreibt einen Unified Diff, AURA prüft im temporären Worktree (`git apply --check`, `node --check`, berührte Tests), du klickst „Anwenden“ → lokaler Commit auf `selfwork-local`; kein Push, kein Neustart |
| `/containers` | **Module Hub (Area 70)** — Manifest-Module, Lifecycle, Rechte **und** die Import-Schleuse: ZIP/Basis64 → Quarantäne → 8 Prüfungen → deine Freigabe |
| `/capability-radar` | Source-to-workflow adoption lab: curated original sources → local prototype → integration spec → approval |
| `/yellowpages` | 57 curated links (free-for.dev, thereisanaiforthat, n8n, Kaggle, Vercel…) |
| `/deploy` | HF search, 1-click Ollama, repo deploy kits, MCP/notebook Schnittstellen, mail |
| `/cluster` | **AURA Infrastructure Control Room** — protected Main Core plus optional Project Arms, declared capacity, local preflight and connection-manifest handoff; no remote execution |
| `/ops` | kill switch, 12h/4h/24h backup schedule, Telegram control deck, agentic mail |
| `/terminal` | sandboxed inbound terminal (non-root, audited, kill-gated) |
| `/minibot` | mini-bot AI setup wizard (BotFather) |

## Quick start
```bash
node backend/server.js            # everything on :8080
bash deploy/master-install.sh     # fresh box, 1-click
bash deploy/start_swarm.sh up     # docker compose web+backend
```
## Docs (every aspect)

| Doc | Inhalt |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | **Deploy-Handbook**: Bare Metal, systemd, Docker, k3s, Firebase, TLS, Backup/Restore, Monitoring, Hardening |
| [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) | **Area 68**: globale Config, Schema, Hot-Reload, alle Parameter |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | **Ops-Runbook**: Triage, Heilung, Quarantäne, Kill-Switch, Repro-Check |
| [`docs/MODULES.md`](docs/MODULES.md) | **65 Areas** + Container-Crash-Isolation (generiert aus der Registry) |
| [`docs/MODULE_SPEC.md`](docs/MODULE_SPEC.md) | **Modul-Schnittstelle**: Teil A v2 (Import/Dritt-Module, maschinenlesbar) · Teil B v1 (eigene Module im Repo) |
| [`docs/AURA_OS_PRODUCT_BRIEF.md`](docs/AURA_OS_PRODUCT_BRIEF.md) | AURA OS: Product thesis, operating cells, resource strategy, pilot and packaging path |
| [`docs/AURA_OS_LAUNCHPAD.md`](docs/AURA_OS_LAUNCHPAD.md) | Area 96: local access catalog, pricing, product boundaries, NasihatBeatZ 47 pilot, PWA and launch workflow |
| [`docs/AURA_CONTINUITY_ASSET_REACTOR.md`](docs/AURA_CONTINUITY_ASSET_REACTOR.md) | Area 97: time-off creator coverage, avatar/voice rights gates, owner review and product image → multi-format render briefs |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/SETUP.md`](docs/SETUP.md) · [`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Architektur, Setup, Datenmodell, Integrationen |

Eine Zeile, ohne Schnickschnack (öffentliches Repo):
```bash
curl -fsSL https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh | bash
```

**Privates Repo (aktueller Zustand):** ohne Token liefert `raw.githubusercontent.com` **404** und es passiert nichts.
Fein granulierten Token (nur `Contents: Read`) anlegen und mitgeben:
```bash
TOKEN=<github_pat_...>
curl -fsSL -H "Authorization: Bearer $TOKEN" \
  https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh \
  | AURA_TOKEN="$TOKEN" bash
```
Alternativ direkt klonen:
```bash
git clone https://x-access-token:$TOKEN@github.com/flubber01/aura.git aura && cd aura
AURA_DIR="$PWD" bash deploy/master-install.sh
```

## Runde 10: zwei neue Tore, beide hinter deinem Klick
| Weg | Was automatisch passiert | Was nur du auslöst |
|---|---|---|
| **Dritt-Modul importieren** (`/containers` → Module Hub) | Paket in Quarantäne entpacken, Manifest v2 prüfen, `node --check`, Verbotsliste scannen, Selbsttest als Kindprozess (10 s, ohne Netz) | Freigabe (`POST /api/modulehub/<id>/approve`) → erst dann Installation und Registry-Eintrag |
| **Selbst bearbeiten** (`/selfwork`) | Kontext bauen, lokales Modell schreibt Diff, Prüfungen im temporären Worktree, Protokoll | „Anwenden“ → lokaler Commit auf `selfwork-local`; Promote nach main bleibt dein PR-Ritual |

Harte Grenzen der Werkbank: nur `backend/pages/**`, `backend/src/lib/**`, `backend/src/routes/**`, `test/**`.
Tabu: `backend/src/data/**`, `deploy/**`, `.git`, alles mit Geheimnis-Mustern. Kein Code ins Netz.

## Safety (hard lines, enforced in code)
No credential harvesting/validation, no SOCKS ban-evasion, no stealth multi-account outreach,
no CAPTCHA/platform bypass, no third-party mining, no human impersonation or synthetic biometrics.
Restricted areas 32/33/36 → 403 on every action. Kill switch auto-engages on critical errors.
