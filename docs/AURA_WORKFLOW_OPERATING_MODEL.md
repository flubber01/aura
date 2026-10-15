# AURA Governed Workflow Operating Model

## Purpose

AURA workflows are **versioned planning and governance templates**, not autonomous jobs. They make a project process explicit, preserve a local audit record and prepare a human-reviewed handoff. They never obtain a credential, call a provider, manipulate a host, deploy, publish, push Git, merge a pull request, make a payment or grant an approval by themselves.

The operational UI is `/workflows`; the original role-based definition editor stays at `/builder`.

## Lifecycle

```text
DRAFT → SIMULATED → AWAITING_APPROVAL → APPROVED → HANDED_OFF → CLOSED
                                  └────→ REJECTED → DRAFT
```

- **DRAFT** — a local owner, scope and the template's required inputs are recorded.
- **SIMULATED** — AURA produces a deterministic local planning trace. No worker or adapter executes.
- **AWAITING_APPROVAL** — a named local operator submits the run for a human decision.
- **APPROVED** — a named operator records `APPROVE_WORKFLOW`. This is not external authorization.
- **HANDED_OFF** — a named operator records `HANDOFF_WORKFLOW`. It creates no outbound request; an operator may use the reviewed handoff outside AURA.
- **REJECTED** — a decision is documented and the run may return to draft.
- **CLOSED** — the local record is complete.

Every state change requires an operator label and note. These labels are an AURA audit field, **not a substitute for production authentication or a cryptographic signature**.

## Local audit chain

A run has an append-only-in-practice local timeline. Each event includes the prior event hash and a SHA-256 hash of its own canonical fields. `GET /api/workflow-runs/:id/audit` detects a broken local sequence.

This provides tamper-evident application evidence only. It is not a legal signature, remote immutable ledger, identity provider or compliance certification.

Runtime runs are stored in `backend/src/data/workflow_runs.json`, which is deliberately ignored by Git and excluded from the safe-source archive.

## APIs

```text
GET   /api/builder/workflows
POST  /api/builder/workflows                  # custom definition, local only
POST  /api/builder/simulate                   # deterministic simulation

GET   /api/workflow-runs
POST  /api/workflow-runs                      # create DRAFT
GET   /api/workflow-runs/:id
GET   /api/workflow-runs/:id/audit
POST  /api/workflow-runs/:id/simulate
POST  /api/workflow-runs/:id/submit
POST  /api/workflow-runs/:id/approve          # requires confirm: APPROVE_WORKFLOW
POST  /api/workflow-runs/:id/reject
POST  /api/workflow-runs/:id/reopen
POST  /api/workflow-runs/:id/handoff          # requires confirm: HANDOFF_WORKFLOW
POST  /api/workflow-runs/:id/close
POST  /api/workflow-runs/:id/artifacts
POST  /api/workflow-runs/:id/incident
```

`artifacts` accept only small metadata: name, summary, optional safe relative/HTTP(S) reference and optional checksum. AURA does not upload media, copy a private document or fetch an external URL through this endpoint.

## Built-in workflow pack

WF-1 through WF-13 remain existing baseline definitions. WF-8 is now **Protected Infrastructure Handoff**; it no longer describes a cluster installation or host-control path.

### WF-14 — Video Production Control Loop
Brief, audience and rights source → editorial/rights review → local render handoff → human distribution decision. AURA does not render, upload or publish.

### WF-15 — Self-hosted Service Intake
Service request → data/architecture review → network/RBAC/backup and rollback checklist → owner-approved manual handoff. AURA does not install, configure, probe or connect to a service.

### WF-16 — Local Model and RAG Evaluation
Use case and data classification → installed-local-model evaluation rubric → privacy/quality report → owner model selection. AURA does not pull models, ingest documents or activate a RAG index.

### WF-17 — API and Connector Onboarding
Provider and data-flow review → least-privilege permission matrix → secret-manager handoff → test/revoke plan. AURA does not create accounts, store API keys or call a provider.

### WF-18 — Backup and Restore Drill
Archive checksum/integrity → isolated restore review → dependency reinstall checklist → evidence report. It never overwrites production, restores credentials or claims production-state recovery.

### WF-19 — Security Incident Triage
Incident report → severity/scope → non-secret evidence references → containment recommendation → human response handoff. It never scans a host or performs a firewall/network action.

### WF-20 — Release Candidate Quality Gate
Change summary → test/security evidence → safe archive checksum → explicit human release decision. It does not push, tag, merge, publish or deploy.

### WF-21 — Asset Rights and Media Intake
Asset reference → license/attribution/allowed-use record → expiry/review plan → approved or restricted handoff. It stores small metadata only, not media binaries, and cannot verify legal ownership.

## Hermes boundary

`GET /api/hermes-bridge/status` and `/api/hermes-bridge/preflight` expose only a planning contract. Hermes is **not installed, configured or connected** by this feature.

Any future Hermes work must start with the fresh archive/restore evidence, local Git checkpoint, rootless isolation design, no secret exposure, a capability-by-capability owner decision, narrow HTTP schemas, revocation test and incident plan. The planned capabilities default to disabled and can at most propose an AURA workflow draft; they cannot approve, hand off or execute a workflow.
