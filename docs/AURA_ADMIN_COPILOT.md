# AURA Admin Copilot and AURA OS Intelligence

## Purpose

AURA now exposes two deliberately different owner-facing support layers:

1. **AURA OS Intelligence** is the former J.A.R.V.I.S. operating-briefing experience. It is deterministic, read-only and embedded in **AURA OS** at `/aura-os#intelligence`. Its expanded HUD is `/intelligence`.
2. **AURA Admin Copilot** is the project administrator's conversational workbench at `/jarvis`. It talks to a locally running small Ollama model through a local loopback endpoint. The separate `/admin` route is the Admin Console: a non-chat operator overview for current local model inventory, departments, roles, workflow templates and safe template simulations.

This split prevents a presentation-style briefing HUD from being mistaken for a real conversational assistant.

## Admin Copilot contract

The Admin Copilot offers:

- a chat with the selected **locally installed** Ollama model
- a compact, non-secret snapshot of AURA module counts, kill-switch state, AURA OS workspace counts, Passport task counts and Studio Command counts
- direct workflow shortcuts for Today, AURA OS, Passport, Studio Command, Ops, Logs, Containers, Console and Models
- quick prompts for daily priorities, safety/ops checks, workflow mapping and simple state explanations
- browser-tab-only conversation context; this module does not persist chat history

It does **not** provide action tools. A model answer is an advisory response, not an approval or evidence that a task happened.

The Copilot rejects non-loopback Ollama endpoints. It will never use a remote model provider, external LLM API, token or hidden browser-to-localhost call. Browser code uses relative AURA API paths; the backend alone talks to the configured local Ollama service.

## Local model setup

On the machine that runs AURA:

```bash
ollama pull qwen2.5:3b
ollama serve
```

Then open `/jarvis`, select `qwen2.5:3b` (or another locally installed model) and save the selection. `phi3:mini` and other actual locally installed models are also supported. AURA checks `/api/tags` and shows a truthful unavailable state when Ollama or the selected model is missing.

The project is not shipped with a model binary or a claim that a model is already available. Model pull/install remains an explicit administrator decision on the owner's host.

## APIs

```text
GET  /api/admin-copilot/status
POST /api/admin-copilot/model   { "model": "qwen2.5:3b" }
POST /api/admin-copilot/chat    { "message": "…", "history": [ ... ] }
POST /api/jarvis                { "msg": "status" }
```

`/api/admin-copilot/chat` returns `409` with a clear setup state if Ollama is unavailable, the selected model is absent, or the configured endpoint is not loopback. It never silently falls back to a remote model or fabricates an answer.

## AURA OS Intelligence contract

`POST /api/jarvis` remains a deterministic, structured local briefing interface. It reports status, Today/Passport posture, Studio workflow, containers, learning, backups, logs, traffic, research routing and safe archive handoff. It cannot publish, render, deploy, pay, create provider accounts, make owner decisions or perform external actions.

The AURA OS embedded Intelligence HUD provides working shortcut buttons for **Systemlage**, **Today**, **Workflow** and **Backups**, plus clear paths to the Admin Copilot and expanded Intelligence HUD.

## Safety boundaries

- No secret, token, credential, media or raw private project record is injected into the Admin Copilot snapshot.
- No local model response may authorize a right, payment, publication, deployment, provider call or owner review.
- The model sees only the current request, short browser-tab history and the compact snapshot supplied with that request.
- Full production access control, authentication, encrypted backups and formal approval flows remain separate work.
