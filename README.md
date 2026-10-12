# AURA Agent Command Center — full-stack build

Static frontend (from `AURA-Web-Deploy.zip`) + zero-dependency Node backend + modular brain system.
Everything runs with `node backend/server.js` → http://localhost:8080 (binds 0.0.0.0).

## Screens & pages
| Path | What |
|---|---|
| `/` | original AURA Command Center UI |
| `/hub` | multi-screen: blue 3D brain (5D) · Matrix · JARVIS · Command — all animated, live data |
| `/brain` | 5-dimensional radial layout (Perceive/Reason/Act/Remember/Govern) |
| `/master` | Living Master Control HUD (real telemetry only; restricted shows policy, never fake data) |
| `/console` | 54-area module registry, actions, states |
| `/hierarchy` | ULTRA → SUPER (+side servers) → DEPARTMENT HEADS → MINIONS; deploy bundles (role/prompt/skills to ANY AI), feedback learning, vita DB, ultra chat, minion live stream |
| `/skills` | skill DB (13 wired, ~1.3M★), 7 departments, 15 roles, prompt library |
| `/pipelines` | WF-1…WF-8 setups + social chain w/ specialists (human gates, audited) |
| `/yellowpages` | 57 curated links (free-for.dev, thereisanaiforthat, n8n, Kaggle, Vercel…) |
| `/deploy` | HF search, 1-click Ollama, repo deploy kits, MCP/notebook Schnittstellen, mail |
| `/cluster` | 4 root servers → 1-click k3s+Ansible bind (own hardware only) |
| `/ops` | kill switch, 12h/4h/24h backup schedule, Telegram control deck, agentic mail |
| `/terminal` | sandboxed inbound terminal (non-root, audited, kill-gated) |
| `/minibot` | mini-bot AI setup wizard (BotFather) |
| `/downloads` | external downloadable catalogs (ALL-TYPES txt/json/md/csv) |

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
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/SETUP.md`](docs/SETUP.md) · [`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Architektur, Setup, Datenmodell, Integrationen |

Eine Zeile, ohne Schnickschnack:
```bash
curl -fsSL https://raw.githubusercontent.com/flubber01/aura/arena/0ee9c54c-aura/deploy/master-install.sh | bash
```

## Safety (hard lines, enforced in code)
No credential harvesting/validation, no SOCKS ban-evasion, no stealth multi-account outreach,
no CAPTCHA/platform bypass, no third-party mining, no human impersonation or synthetic biometrics.
Restricted areas 32/33/36 → 403 on every action. Kill switch auto-engages on critical errors.
