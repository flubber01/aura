# AURA — Funktionsverzeichnis A–Z

Automatisch erzeugt mit `node scripts/build_function_index.js`. Nicht von Hand bearbeiten.

Stand: 2026-10-13 · Routen: 98 · Module: 100 · Seiten: 38 · Tests: 16

Spalten: **Name** · **Typ** · **Datei** · **Test** (Verweis in test/) · **Verbunden** (im Server/Skript eingebunden) · **Doku** (Verweis in docs/).

## Lücken

- agent_intercom: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- cloud_connector: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- community_incubator: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- compute_router: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- content_incubator: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- control_tower: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- crosslink_policy: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- delivery_monitor: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- editorial_incubator: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- finance_engine: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- forge: Seite nicht im Server verlinkt
- function_registry: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- gateway_health: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- hardware_router: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- harness_kit: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- image_gen: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- imagegen: Seite nicht im Server verlinkt
- intercom: Seite nicht im Server verlinkt
- knowledge_sync: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- mcp_manager: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- media_pipeline: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- mesh_engine: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- models: Seite nicht im Server verlinkt
- n8n_bridge: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- report_daemon: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- routine_control: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- sentinel: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- studio: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- telemetry_stream: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- test_lab: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- tower: Seite nicht im Server verlinkt
- variance_lifecycle: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- vault: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- vision_bridge: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- wordpress_bridge: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)
- yellow_pages: Modul ohne Verbindung (nicht in server.js oder Skript eingebunden)

## Index

[#](##) · [A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [H](#h) · [I](#i) · [J](#j) · [K](#k) · [L](#l) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [R](#r) · [S](#s) · [T](#t) · [U](#u) · [V](#v) · [W](#w) · [Y](#y)

## #

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `/api/backups` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK |  |
| `/api/backups/restore` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK |  |
| `/api/board` | Route | `backend/server.js` | ja | ja | BOARD-JARVIS, GESAMTAUDIT |  |
| `/api/board/task` | Route | `backend/server.js` | ja | ja | BOARD-JARVIS, GESAMTAUDIT |  |
| `/api/brain` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/builder/simulate` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/builder/workflows` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/channels` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/channels/check` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/channels/plan` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/channels/publish-check` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/config` | Route | `backend/server.js` | ja | ja | CONFIGURATION, GESAMTAUDIT, SETUP, UPLOAD |  |
| `/api/config/reset` | Route | `backend/server.js` | ja | ja | CONFIGURATION, GESAMTAUDIT |  |
| `/api/config/schema` | Route | `backend/server.js` | ja | ja | CONFIGURATION, GESAMTAUDIT |  |
| `/api/config/upload` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, SETUP, UPLOAD |  |
| `/api/containers` | Route | `backend/server.js` | ja | ja | RUNBOOK |  |
| `/api/containers/drill` | Route | `backend/server.js` | ja | ja | RUNBOOK |  |
| `/api/control` | Route | `backend/server.js` | ja | ja | CONTROL, GESAMTAUDIT, HOWTO_BUILD |  |
| `/api/creators` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/departments` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/downloads` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/escalations` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/escalations/raise` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/growth/analytics` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, GROWTH |  |
| `/api/growth/analytics/import` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, GROWTH |  |
| `/api/growth/mesh` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, GROWTH |  |
| `/api/growth/mesh/asset` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, GROWTH |  |
| `/api/growth/releases` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, GROWTH |  |
| `/api/growth/repurpose` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, GROWTH |  |
| `/api/health` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK, TERMUX |  |
| `/api/hierarchy` | Route | `backend/server.js` | ja | ja | ARCHITECTURE, GESAMTAUDIT |  |
| `/api/hierarchy/knowledge` | Route | `backend/server.js` | ja | ja | ARCHITECTURE, GESAMTAUDIT |  |
| `/api/ignition` | Route | `backend/server.js` | ja | ja | HOWTO_BUILD |  |
| `/api/integrations` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/jarvis` | Route | `backend/server.js` | ja | ja | BOARD-JARVIS, GESAMTAUDIT, MODULES |  |
| `/api/jarvis/llm` | Route | `backend/server.js` | ja | ja | BOARD-JARVIS, GESAMTAUDIT |  |
| `/api/jarvis/memory` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/kill` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK |  |
| `/api/learning` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/learning/outcome` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/learning/simulate` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/llm/chain` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/logs` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK |  |
| `/api/mail` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/mail/approve` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/mail/compose` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/master` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/modules` | Route | `backend/server.js` | ja | ja | ARCHITECTURE, DEPLOYMENT, GESAMTAUDIT, HOWTO_BUILD, MODULE_SPEC, MODULE_SYSTEM |  |
| `/api/modules/ext` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, MODULE_SPEC |  |
| `/api/modules/ext/discover` | Route | `backend/server.js` | ja | ja | MODULE_SPEC |  |
| `/api/modules/live` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/music/skills` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/notebook-export` | Route | `backend/server.js` | ja | ja | INTEGRATIONS |  |
| `/api/ops` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK |  |
| `/api/ops/others` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/ops/super` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/ops/sync` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/report` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/repro` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK |  |
| `/api/research` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/research/export` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/roles` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/schedule` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/schedule/add` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/schedule/csv` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/schedule/recommend` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/schedule/remove` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/selfrepair` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, RUNBOOK |  |
| `/api/selfrepair/drill` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/selfrepair/run` | Route | `backend/server.js` | ja | ja | DEPLOYMENT |  |
| `/api/seo` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/skill-catalog` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, SKILLS |  |
| `/api/skills` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, HOWTO_BUILD, SKILLS |  |
| `/api/socialchain` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/stream` | Route | `backend/server.js` | ja | ja | ARCHITECTURE, GESAMTAUDIT |  |
| `/api/studio/groove` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/studio/orchestrate` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/studio/release` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/teams` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/telegram/kit` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, SETUP |  |
| `/api/terminal` | Route | `backend/server.js` | ja | ja | DEPLOYMENT |  |
| `/api/traffic` | Route | `backend/server.js` | ja | ja | DEPLOYMENT |  |
| `/api/types` | Route | `backend/server.js` | ja | ja | DATABASE |  |
| `/api/ultra/chat` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/ultra/proposals` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/ultra/scout/run` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/upload/commit` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, UPLOAD |  |
| `/api/upload/kinds` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, UPLOAD |  |
| `/api/upload/preview` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT, UPLOAD |  |
| `/api/vita` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/watcher` | Route | `backend/server.js` | ja | ja | DEPLOYMENT, GESAMTAUDIT, RUNBOOK |  |
| `/api/workflows` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/xrefs` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/yellowpages` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/yellowpages/help` | Route | `backend/server.js` | ja | ja | — |  |
| `/api/yellowpages/suggest` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/youtube/check` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |
| `/api/youtube/plan` | Route | `backend/server.js` | ja | ja | GESAMTAUDIT |  |

## A

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `agent_board` | Modul | `backend/src/lib/agent_board.js` | nein | ja | BOARD-JARVIS | AURA Agent Board — Kanban für Agenten (Rollen aus dem Skills-Registry). |
| `agent_intercom` | Modul | `backend/src/lib/agent_intercom.js` | nein | nein | — | AURA Area 84 — Agent Intercom: Chat der Agenten untereinander. |
| `algorithm_matrix` | Modul | `backend/src/lib/algorithm_matrix.js` | nein | ja | — | 39 · Algorithm matrix / A/B testing — deterministic variant assignment and |
| `analytics_hub` | Modul | `backend/src/lib/analytics_hub.js` | nein | ja | GROWTH | AURA Unified Analytics (Phase 2, §31 B4) — ein Dashboard über offizielle APIs, |
| `api_failover` | Modul | `backend/src/lib/api_failover.js` | ja | ja | GESAMTAUDIT | AURA — API-Failover für Sprachmodelle. |
| `arcade` | Seite | `backend/pages/arcade.js` | — | ja | GESAMTAUDIT | AURA Arcade — three tiny side-project games, live-feel neon. |
| `autonomy_loop` | Modul | `backend/src/lib/autonomy_loop.js` | nein | ja | — | 49 · Autonomous loop — self-healing checks, swarm checkpoint strategy and an |

## B

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `backup_vault` | Modul | `backend/src/lib/backup_vault.js` | nein | ja | — | AURA Area 64 — Backup Vault: verified on-disk snapshots of every watched |
| `board` | Seite | `backend/pages/board.js` | — | ja | BOARD-JARVIS, CONTROL, DEPLOYMENT, GESAMTAUDIT, GROWTH, ../README | AURA — Agent Board: Kanban, auf dem Agenten nach Fähigkeit Aufgaben übernehmen, |
| `brain` | Seite | `backend/pages/brain.js` | — | ja | ARCHITECTURE, DATABASE, GESAMTAUDIT, ../README | AURA — Brain 2.0 page + data (previously inline in server.js). |
| `brain_mapper` | Modul | `backend/src/lib/brain_mapper.js` | nein | ja | — | AURA Area 80 — Brain Role Mapper: modular assignment of WHICH agent/model |
| `brain3d` | Seite | `backend/pages/brain3d.js` | — | ja | — | AURA · real 3D brain renderer (canvas, zero dependencies) |
| `builder` | Seite | `backend/pages/builder.js` | — | ja | GESAMTAUDIT | AURA — Workflow Builder (Area 61): pick roles → chain → gates → JSON → simulate |

## C

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `catalog_ingestor` | Modul | `backend/src/lib/catalog_ingestor.js` | nein | ja | — | 19 · Yellow Pages / catalog ingestor — normalizes tool/API catalog records |
| `channel_pipelines` | Modul | `backend/src/lib/channel_pipelines.js` | ja | ja | GESAMTAUDIT | AURA — Multi-Kanal-Pipeline. Ein Ablauf für alle Ziele: Video, Blog, Newsletter, Börsen-News, Distributoren. |
| `chrono_backup_daemon` | Modul | `backend/src/lib/chrono_backup_daemon.js` | nein | ja | — | 24 · Chrono backup / SQL snapshots — snapshots the JSON store with checksum, |
| `cloud_connector` | Modul | `backend/src/lib/cloud_connector.js` | nein | nein | — | AURA Area 28 — Cloud Environment Connector (LIVE). |
| `cluster` | Seite | `backend/pages/cluster.js` | — | ja | DEPLOYMENT, GESAMTAUDIT, SETUP, ../README | Root-Server Collective: enter 4 servers -> 1-click kit that binds & bundles them (k3s + Ansible). |
| `cognitive_learning_core` | Modul | `backend/src/lib/cognitive_learning_core.js` | nein | ja | — | 03 · Cognitive Learning Core — validates incoming tasks, assigns a role |
| `community_incubator` | Modul | `backend/src/lib/community_incubator.js` | nein | nein | — | AURA Area 12 — Community Incubation (LIVE). |
| `compute_router` | Modul | `backend/src/lib/compute_router.js` | nein | nein | — | AURA Area 27 — Intranet Compute Router (LIVE). |
| `config` | Modul | `backend/src/lib/config.js` | ja | ja | ARCHITECTURE, CONFIGURATION, DEPLOYMENT, GESAMTAUDIT, MODULE_SPEC, MODULE_SYSTEM, SETUP, UPLOAD | AURA Area 68 — global config: defaults in code, overrides in |
| `configpage` | Seite | `backend/pages/configpage.js` | — | ja | — | AURA — Config Console (Area 68): schema-driven, hot-reloaded global config. |
| `consensus_logic_core` | Modul | `backend/src/lib/consensus_logic_core.js` | nein | ja | — | 04 · Tri-Vector Consensus Engine — generates three candidate plans (A/B/C) |
| `console` | Seite | `backend/pages/console.js` | — | ja | ARCHITECTURE, DATABASE, GESAMTAUDIT, MODULE_SPEC, ../README | AURA — Live Backend Console page (previously inline in server.js). |
| `containers` | Seite | `backend/pages/containers.js` | — | ja | CONFIGURATION, DEPLOYMENT, GESAMTAUDIT, MODULES, MODULE_SYSTEM, RUNBOOK | AURA — Container Console (Area 67): per-module crash isolation dashboard. |
| `content_forge` | Modul | `backend/src/lib/content_forge.js` | nein | ja | — | AURA Area 73 — Content Forge: content automation via MINION workers. |
| `content_incubator` | Modul | `backend/src/lib/content_incubator.js` | nein | nein | — | AURA Area 10 — Content Incubation Engine (LIVE). |
| `control` | Seite | `backend/pages/control.js` | — | ja | ARCHITECTURE, CONTROL, GESAMTAUDIT, HOWTO_BUILD, MODULES, SETUP, ../README | AURA · Steuerzentrale-Seite: Schalter pro Aktion, offene Freigaben entscheiden. |
| `control_center` | Modul | `backend/src/lib/control_center.js` | ja | ja | CONTROL, GESAMTAUDIT | AURA · Steuerzentrale: jede Aktion hat Risikostufe, Schalter und Freigabe. |
| `control_tower` | Modul | `backend/src/lib/control_tower.js` | nein | nein | — | AURA Area 81 — Control Tower: admin standing orders (Directives) for brains |
| `creator_watch` | Modul | `backend/src/lib/creator_watch.js` | ja | ja | GESAMTAUDIT | AURA — Creator-Beobachtungsliste (modular). Liest und schreibt backend/data/creators.json. |
| `crosslink_mesh` | Modul | `backend/src/lib/crosslink_mesh.js` | nein | ja | GROWTH | AURA Traffic Mesh (Phase 2, §31 B2) — Crosslink-Matrix über EIGENE Assets. |
| `crosslink_policy` | Modul | `backend/src/lib/crosslink_policy.js` | nein | nein | — | AURA Area 82 — Cross-link Policy: for EVERY module the admin can freely |

## D

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `data_upload` | Modul | `backend/src/lib/data_upload.js` | ja | ja | GESAMTAUDIT, UPLOAD | AURA — Daten-Upload für Link-Listen (Yellow Pages, API-Katalog). |
| `datasets` | Modul | `backend/src/lib/datasets.js` | nein | ja | — | Shared boot-time datasets (previously inline in server.js). Single source |
| `delivery_monitor` | Modul | `backend/src/lib/delivery_monitor.js` | nein | nein | — | AURA Area 35 — Shadow-Ban Sentinel (LIVE, sicher redesign als Delivery-Monitor). |
| `deploy` | Seite | `backend/pages/deploy.js` | — | ja | DEPLOYMENT, GESAMTAUDIT, HOWTO_BUILD, INTEGRATIONS, SETUP, TERMUX, ../README | Deploy & Schnittstellen: HF model search (browser-side), 1-click Ollama, |
| `downloads` | Seite | `backend/pages/downloads.js` | — | ja | GESAMTAUDIT, ../README | AURA — Downloads page (previously inline in server.js). |

## E

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `editorial_incubator` | Modul | `backend/src/lib/editorial_incubator.js` | nein | nein | — | AURA Area 11 — Editorial Incubation (LIVE). |
| `escalation` | Modul | `backend/src/lib/escalation.js` | ja | ja | GESAMTAUDIT | AURA — Eskalation an den Menschen bei kritischen Ereignissen. |
| `ext_modules_block` | Seite | `backend/pages/ext_modules_block.js` | — | ja | — | Liefert den HTML-Block „Erweiterungsmodule“ für die bestehende Konsole (/). |

## F

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `finance_engine` | Modul | `backend/src/lib/finance_engine.js` | nein | nein | — | AURA Area 31 — OmniRoute Financial Engine (LIVE, sicher redesign). |
| `forge` | Seite | `backend/pages/forge.js` | — | nein | — | AURA Areas 73+74 — Content Forge (minion automation) + Service Fabric UI. |
| `function_registry` | Modul | `backend/src/lib/function_registry.js` | nein | nein | — | AURA Area 83 — Function Capability Registry: admins can ADD, IGNORE or |

## G

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `gateway_health` | Modul | `backend/src/lib/gateway_health.js` | nein | nein | — | AURA Area 34 — Gateway Health Monitor (LIVE, legal redesign). |
| `grid` | Seite | `backend/pages/grid.js` | — | ja | — | Mission Grid — die 19 ausgebauten Live-Module (Areas 09–40) auf einem Screen. |
| `growth` | Seite | `backend/pages/growth.js` | — | ja | GESAMTAUDIT, GROWTH, ../README | AURA Phase 2 — Growth Console: WF-18 Repurposing, Traffic Mesh, WF-19 Label, Unified Analytics. |
| `growth_store` | Modul | `backend/src/lib/growth_store.js` | nein | ja | — | AURA Phase 2 — shared runtime store for the growth modules (WF-18, Traffic Mesh, |

## H

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `hardware_router` | Modul | `backend/src/lib/hardware_router.js` | nein | nein | — | AURA Area 26 — Master Hardware Router (LIVE). |
| `harness_kit` | Modul | `backend/src/lib/harness_kit.js` | nein | nein | — | AURA Area 85 — Harness-Kit (Claude Code / Cursor / OpenClaw & Co.). |
| `hierarchy` | Modul | `backend/src/lib/hierarchy.js` | ja | ja | ARCHITECTURE, DEPLOYMENT, GESAMTAUDIT, SETUP, ../README | Brain hierarchy engine: tree build, deployable bundles, learning feedback, |
| `hierarchy` | Seite | `backend/pages/hierarchy.js` | — | ja | ARCHITECTURE, DEPLOYMENT, GESAMTAUDIT, SETUP, ../README | Ultra -> Super -> Heads -> Minions: tree, deploy bundles, learning, vita DB. |
| `hub` | Seite | `backend/pages/hub.js` | — | ja | DEPLOYMENT, GESAMTAUDIT, GROWTH, HOWTO_BUILD, MODULES, MODULE_SYSTEM, SKILLS, TERMUX, ../README | AURA Multi-Screen Hub — 4 animated screens, layered themes, one live core. |

## I

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `ignition` | Seite | `backend/pages/ignition.js` | — | ja | DEPLOYMENT, GESAMTAUDIT, HOWTO_BUILD | IGNITION — master dashboard: ALL sites/projects/games/links/services under |
| `image_gen` | Modul | `backend/src/lib/image_gen.js` | nein | nein | — | AURA Area 71 — Image Generation Gateway: ComfyUI + AUTOMATIC1111 WebUI. |
| `imagegen` | Seite | `backend/pages/imagegen.js` | — | nein | — | AURA Area 71 — Image Generation Gateway UI (ComfyUI + WebUI). |
| `intercom` | Seite | `backend/pages/intercom.js` | — | nein | — | Agent Intercom — Chat der Agenten untereinander (Area 84). |

## J

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `jarvis` | Modul | `backend/src/lib/jarvis.js` | ja | ja | BOARD-JARVIS, GESAMTAUDIT, MODULES | AURA — J.A.R.V.I.S. (real one): conversational assistant wired to LIVE |
| `jarvis` | Seite | `backend/pages/jarvis.js` | — | ja | BOARD-JARVIS, GESAMTAUDIT, MODULES | AURA — J.A.R.V.I.S. live console: real assistant over real system state. |

## K

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `kids_story` | Modul | `backend/src/lib/kids_story.js` | nein | ja | — | AURA Area 08 — Kids Story Pipeline (voll ausgebaut, vorher placeholder). |
| `knowledge_sync` | Modul | `backend/src/lib/knowledge_sync.js` | nein | nein | — | AURA Area 18 — GitHub / NotebookLM Knowledge Sync (LIVE). |

## L

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `label_pipeline` | Modul | `backend/src/lib/label_pipeline.js` | nein | ja | GROWTH | AURA WF-19 — Label-Release-Pipeline (Phase 2, §31 B3). |
| `learning_core` | Modul | `backend/src/lib/learning_core.js` | nein | ja | — | AURA Area 69 — Recursive Learning Core: every failure gets a fingerprint. |
| `local_edge_cache` | Modul | `backend/src/lib/local_edge_cache.js` | nein | ja | — | 22 · Local edge cache — bounded LRU with TTL. Volatile by design: |
| `logs` | Seite | `backend/pages/logs.js` | — | ja | DEPLOYMENT, GESAMTAUDIT, MODULES, RUNBOOK, ../README | AURA — Log & Self-Repair Console (Area 66): live JSONL tail + repair ledger. |

## M

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `mail_adapter` | Modul | `backend/src/lib/mail_adapter.js` | nein | ja | — | Agentic Mail Schnittstelle — approval-gated outbox. Sandbox never sends |
| `master` | Seite | `backend/pages/master.js` | — | ja | DEPLOYMENT, GESAMTAUDIT, ../README | AURA — Master Control HUD page + data (previously inline in server.js). |
| `mcp` | Seite | `backend/pages/mcp.js` | — | ja | DATABASE, HOWTO_BUILD, INTEGRATIONS, MODULE_SPEC | AURA Area 72 — MCP Manager UI: user-defined MCP servers |
| `mcp_bridge` | Modul | `backend/src/lib/mcp_bridge.js` | nein | eigenständig | INTEGRATIONS | MCP Schnittstelle — line-protocol bridge: stdin JSON lines -> AURA backend. |
| `mcp_ingestion_core` | Modul | `backend/src/lib/mcp_ingestion_core.js` | nein | ja | — | 20 · MCP ingestion core — register tool connectors with explicit grants, |
| `mcp_manager` | Modul | `backend/src/lib/mcp_manager.js` | nein | nein | — | AURA Area 72 — MCP Server Manager. |
| `media_pipeline` | Modul | `backend/src/lib/media_pipeline.js` | nein | nein | — | AURA Area 09 — Kids Media / Video-Pipeline (LIVE). |
| `mesh_engine` | Modul | `backend/src/lib/mesh_engine.js` | nein | nein | — | AURA Area 29 — Sandbox Mesh Engine (LIVE). |
| `metadata_shredder` | Modul | `backend/src/lib/metadata_shredder.js` | nein | ja | — | 07 · Media metadata privacy pipeline — real JPEG EXIF scrubber (pure Node). |
| `minibot` | Seite | `backend/pages/minibot.js` | — | ja | GESAMTAUDIT, SETUP, ../README | Mini-bot AI setup help: wizard that generates a ready mini-bot kit |
| `models` | Seite | `backend/pages/models.js` | — | nein | GESAMTAUDIT | Model Bay — offenes Modell-System (Area 79): Suche, eigene Modelle, Test, Keys. |
| `module_container` | Modul | `backend/src/lib/module_container.js` | nein | ja | — | AURA Area 67 — Module Containers: every live-module action runs inside an |
| `module_loader` | Modul | `backend/src/lib/module_loader.js` | ja | ja | GESAMTAUDIT, MODULE_SPEC | AURA — Modul-Loader für Erweiterungsmodule (backend/modules/<ordner>/aura.module.json). |
| `module_manifest` | Modul | `backend/src/lib/module_manifest.js` | ja | ja | GESAMTAUDIT | AURA — Manifest-Prüfung für Erweiterungsmodule (aura.module.json). |
| `multi_response_controller` | Modul | `backend/src/lib/multi_response_controller.js` | nein | ja | — | 05 · Multi-response controller + master integrity controller — |
| `music_studio` | Modul | `backend/src/lib/music_studio.js` | ja | ja | GESAMTAUDIT | AURA Studio — Groove-Generator und Orchestrator (deterministisch, mit Seed). |

## N

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `n8n_bridge` | Modul | `backend/src/lib/n8n_bridge.js` | nein | nein | — | AURA Area 15 — n8n Secure Dispatch / Kaggle Relay (LIVE). |
| `news_algorithm_analyzer` | Modul | `backend/src/lib/news_algorithm_analyzer.js` | nein | ja | — | 21 · Daily news / algorithm analyzer — analyzes a FEED PAYLOAD supplied by |
| `notify` | Modul | `backend/src/lib/notify.js` | ja | ja | GESAMTAUDIT | AURA — Notfall-Benachrichtigung an den Menschen (Telegram, SMS, Anruf). |

## O

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `ollama_llm` | Modul | `backend/src/lib/ollama_llm.js` | ja | ja | — | AURA — J.A.R.V.I.S. phrasing via Ollama (own host, free, local). Optional. |
| `ollama_manager` | Modul | `backend/src/lib/ollama_manager.js` | nein | ja | — | AURA Area 79 — Ollama Model Manager (offenes System). |
| `omnichannel_dispatcher` | Modul | `backend/src/lib/omnichannel_dispatcher.js` | nein | ja | — | AURA Area 13 — Omnichannel Dispatcher (LIVE). |
| `omniroute` | Modul | `backend/src/lib/omniroute.js` | nein | ja | DEPLOYMENT | 58 · OmniRoute — MODEL router (OpenRouter cloud + Ollama/Unsloth local lanes) |
| `openrouter_pinger_daemon` | Modul | `backend/src/lib/openrouter_pinger_daemon.js` | nein | ja | — | 06 · OpenRouter provider pinger — configuration probe ONLY. |
| `ops` | Modul | `backend/src/lib/ops.js` | ja | ja | ARCHITECTURE, DATABASE, DEPLOYMENT, GESAMTAUDIT, HOWTO_BUILD, RUNBOOK, SETUP, ../README | OPS: backup scheduler (12h super / 4h others / 24h full sync), emergency |
| `ops` | Seite | `backend/pages/ops.js` | — | ja | ARCHITECTURE, DATABASE, DEPLOYMENT, GESAMTAUDIT, HOWTO_BUILD, RUNBOOK, SETUP, ../README | OPS Control Palette: kill switch, backup schedule, telegram control, mail. |

## P

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `pipelines` | Seite | `backend/pages/pipelines.js` | — | ja | GESAMTAUDIT, ../README | Pipelines: multi-pipeline fast setup + social connection chain with specialists. |

## R

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `registry` | Modul | `backend/src/lib/registry.js` | ja | ja | ARCHITECTURE, DATABASE, GESAMTAUDIT, HOWTO_BUILD, MODULES, MODULE_SPEC, MODULE_SYSTEM, ../README | Module registry — all 40 functional areas from the AURA inventory. |
| `report` | Modul | `backend/src/lib/report.js` | ja | ja | ARCHITECTURE, CONTROL, GESAMTAUDIT, MODULES | Daily/on-demand report builder (previously inline in server.js). |
| `report_daemon` | Modul | `backend/src/lib/report_daemon.js` | nein | nein | — | AURA Area 17 — Daily report daemon (voll ausgebaut, vorher placeholder). |
| `repurpose_engine` | Modul | `backend/src/lib/repurpose_engine.js` | nein | ja | GROWTH | AURA WF-18 — Repurposing-Engine (Phase 2, §31 B1): 1 Inhalt → 8 Formate. |
| `research` | Modul | `backend/src/lib/research.js` | ja | ja | GESAMTAUDIT, MODULES | AURA Area 62 — Deep Research: real web research against api.github.com |
| `research` | Seite | `backend/pages/research.js` | — | ja | GESAMTAUDIT, MODULES | AURA — Deep Research (Area 62): real GitHub-API research, star-ranked, no hallucination. |
| `role_registry` | Modul | `backend/src/lib/role_registry.js` | nein | ja | — | 02 · Role registry / department templates — parsed from ingest/identities.txt |
| `routine_control` | Modul | `backend/src/lib/routine_control.js` | nein | nein | — | AURA Area 75 — Routine & Link Control: ONE switchboard for every routine |

## S

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `schedule` | Modul | `backend/src/lib/schedule.js` | ja | ja | ARCHITECTURE, DEPLOYMENT, GESAMTAUDIT, MODULE_SYSTEM, SETUP, ../README | Schedule planner: which role works where when. Conflict detection on |
| `schedule` | Seite | `backend/pages/schedule.js` | — | ja | ARCHITECTURE, DEPLOYMENT, GESAMTAUDIT, MODULE_SYSTEM, SETUP, ../README | Schedule planner UI: who works where when, conflicts, recommend, CSV. |
| `self_healing_logger` | Modul | `backend/src/lib/self_healing_logger.js` | nein | ja | — | 16 · Self-healing logger — bounded ring buffer; errors are flagged and |
| `self_repair` | Modul | `backend/src/lib/self_repair.js` | nein | ja | CONFIGURATION, GESAMTAUDIT | AURA Area 66 — Massive Logging + Self-Repair Daemon. |
| `sentinel` | Modul | `backend/src/lib/sentinel.js` | nein | nein | MODULES | AURA Area 86 — SENTINEL: Live-Sicherheitswache & Scanner. |
| `seo` | Modul | `backend/src/lib/seo.js` | ja | ja | GESAMTAUDIT | AURA Area 63 — SEO Center: honest on-site SEO audit of AURA's own pages |
| `seo` | Seite | `backend/pages/seo.js` | — | ja | GESAMTAUDIT | AURA — SEO Center (Area 63): honest on-site audit of AURA's own pages + sitemap/robots. |
| `skill_catalog` | Modul | `backend/src/lib/skill_catalog.js` | ja | ja | GESAMTAUDIT, SKILLS | AURA · Skill-Katalog (nur lesen). Daten: backend/data/skill_catalog.json, |
| `skills` | Seite | `backend/pages/skills.js` | — | ja | DATABASE, DEPLOYMENT, GESAMTAUDIT, HOWTO_BUILD, INTEGRATIONS, MODULES, MODULE_SYSTEM, SETUP, SKILLS, UPLOAD, ../README | AURA · Skill-Katalog-Seite (nur Anzeige). Lädt /api/skills. |
| `skills_registry` | Modul | `backend/src/lib/skills_registry.js` | nein | ja | — | AURA Skills Registry + Skill DB + Department/Prompt library. |
| `store` | Modul | `backend/src/lib/store.js` | nein | ja | ARCHITECTURE, BOARD-JARVIS, DATABASE, DEPLOYMENT, GESAMTAUDIT, MODULES, MODULE_SYSTEM, RUNBOOK, SETUP, ../README | Persistent JSON store with atomic writes (tasks + audit trail). |
| `studio` | Modul | `backend/src/lib/studio.js` | ja | nein | GESAMTAUDIT, MODULES | AURA Area 76 — Creative Studio Suite: REAL generator modules for many |
| `studio` | Seite | `backend/pages/studio.js` | — | ja | GESAMTAUDIT, MODULES | AURA Studio — Groove-Generator, Orchestrator, Musik-Skill-Suche. |
| `studio_release` | Modul | `backend/src/lib/studio_release.js` | ja | ja | — | Studio → Release-Plan: Label-Stufen und Distributoren (DistroKid, TuneCore, CD Baby, Ditto, eigene). |
| `swarm_sync_daemon` | Modul | `backend/src/lib/swarm_sync_daemon.js` | nein | ja | — | 23 · Swarm / cross-platform sync — LOCAL checkpoint export/import with |
| `synaptic_heartbeat_bridge` | Modul | `backend/src/lib/synaptic_heartbeat_bridge.js` | nein | ja | — | 25 · Synaptic heartbeat bridge — process liveness beacon, keeps last 60 beats. |

## T

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `telegram_agent` | Modul | `backend/src/lib/telegram_agent.js` | nein | ja | — | AURA Area 78 — Telegram Agent: official Bot API integration. |
| `telegram_poller` | Modul | `backend/src/lib/telegram_poller.js` | nein | eigenständig | CONTROL, GESAMTAUDIT, SETUP | Telegram control poller — run OUTSIDE the sandbox (needs egress). |
| `telemetry_stream` | Modul | `backend/src/lib/telemetry_stream.js` | nein | nein | — | AURA Area 30 — Streaming Telemetry / Remote Workers (LIVE). |
| `terminal` | Seite | `backend/pages/terminal.js` | — | ja | ARCHITECTURE, DEPLOYMENT, GESAMTAUDIT, ../README | Sandboxed web terminal — runs as the sandbox user (NOT root, by design), |
| `test_lab` | Modul | `backend/src/lib/test_lab.js` | nein | nein | — | AURA Area 77 — Test Lab: admin force-run harness with EXPECT-FAILURE view. |
| `tower` | Seite | `backend/pages/tower.js` | — | nein | — | AURA — Command Tower UI: Brain-Mapping (80), Directives (81), |
| `traffic` | Modul | `backend/src/lib/traffic.js` | ja | ja | DEPLOYMENT, MODULES | AURA Area 65 — honest traffic telemetry: REAL request counts per route, |
| `txt_watcher` | Modul | `backend/src/lib/txt_watcher.js` | nein | ja | — | File-system pulse watcher: hot-reloads editable data files (edit via /terminal |
| `types_catalog` | Modul | `backend/src/lib/types_catalog.js` | nein | ja | — | ALL-TYPES catalog + downloadable artifact renderers (previously inline in server.js). |

## U

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `ultra_chat` | Modul | `backend/src/lib/ultra_chat.js` | nein | ja | — | ULTRA MASTER BRAIN chat panel — honest local oracle over REAL system state. |
| `ultra_scout` | Modul | `backend/src/lib/ultra_scout.js` | ja | ja | GESAMTAUDIT | AURA — Ultra-Scout: prüft einmal am Tag öffentliche GitHub-Repos (nur Metadaten, nur lesen) |
| `upload` | Seite | `backend/pages/upload.js` | — | ja | CONTROL, GESAMTAUDIT, SETUP, UPLOAD, ../README | AURA — Daten-Upload: Link-Listen hochladen, prüfen, Vorschau, dann übernehmen. |

## V

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `variance_lifecycle` | Modul | `backend/src/lib/variance_lifecycle.js` | nein | nein | — | AURA Area 40 — Variance Lifecycle / Swarm Evolution (LIVE, mit Governance). |
| `vault` | Modul | `backend/src/lib/vault.js` | nein | nein | CONFIGURATION, MODULES | AURA Area 38 — Identity Vault / Inbox Orchestration (LIVE, sicher redesign). |
| `vision_bridge` | Modul | `backend/src/lib/vision_bridge.js` | nein | nein | — | AURA Area 37 — Visual Agent Eyes / MCP Vision (LIVE, sicher redesign). |

## W

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `wordpress_bridge` | Modul | `backend/src/lib/wordpress_bridge.js` | nein | nein | — | AURA Area 14 — WordPress Gutenberg/REST Bridge (LIVE). |
| `workflow_builder` | Modul | `backend/src/lib/workflow_builder.js` | nein | ja | — | AURA Area 61 — Workflow Builder: pick roles from the 63-role registry, |

## Y

| Name | Typ | Datei | Test | Verbunden | Doku | Kurzbeschreibung |
|---|---|---|---|---|---|---|
| `yellow_pages` | Modul | `backend/src/lib/yellow_pages.js` | nein | nein | — | AURA Area 19 (maximiert) — Yellow Pages Wissensbasis. |
| `yellowpages` | Seite | `backend/pages/yellowpages.js` | — | ja | DEPLOYMENT, GESAMTAUDIT, INTEGRATIONS, SETUP, UPLOAD, ../README | Yellow Pages — searchable curated link lists. |
| `youtube_pipeline` | Modul | `backend/src/lib/youtube_pipeline.js` | ja | ja | GESAMTAUDIT | AURA — YouTube-Pipeline (Gerüst mit Freigabe-Toren). |
| `yp_help` | Modul | `backend/src/lib/yp_help.js` | ja | ja | — | AURA — Gelbe-Seiten-Hilfe für Agenten. |
