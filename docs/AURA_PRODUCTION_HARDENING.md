# AURA Production Hardening, Model Capacity and Release Gates

## Scope

This document covers the work required before AURA is exposed beyond a tightly controlled local environment, moved to a clean target server, or connected to any future Hermes bridge.

It does not install Ollama, pull a model, install Hermes, deploy AURA or create a server account.

## 1. Owner authentication

AURA now contains a zero-dependency owner authentication layer.

### Required production environment values

Store these outside Git and outside source archives:

```dotenv
AURA_AUTH_BOOTSTRAP_TOKEN=<single-use/high-entropy setup secret>
AURA_SESSION_SECRET=<at-least-32-random-characters>
AURA_AUTH_REQUIRED=true
AURA_COOKIE_SECURE=true
```

Initial setup sequence:

1. Start the clean target privately over HTTPS.
2. Set `AURA_AUTH_BOOTSTRAP_TOKEN` and `AURA_SESSION_SECRET` in the deployment secret store or protected environment file.
3. Open `/login`, enter the bootstrap token, owner name and a strong password.
4. Confirm `/api/auth/status` reports an owner.
5. Remove `AURA_AUTH_BOOTSTRAP_TOKEN` from the environment and restart the service.
6. Enable `AURA_AUTH_REQUIRED=true` only after a new owner login succeeds.

Authentication uses a signed HttpOnly `SameSite=Strict` session cookie and scrypt password hashes. AURA does not store the raw password or bootstrap token.

Without `AURA_AUTH_REQUIRED=true`, AURA remains intentionally compatible with a local development/test setup, but this is **not suitable for public exposure**. The Admin Console shows this state explicitly.

## 2. CORS and origin boundary

The backend no longer sends a wildcard `Access-Control-Allow-Origin: *` header. Browser surfaces use same-origin relative API paths. In authentication-enforced mode, protected routes require a valid signed session and reject cross-origin requests.

Put AURA behind an HTTPS reverse proxy and expose only required routes. Do not host it through an arbitrary embedding origin.

## 3. Non-destructive preflight

Run from a clean source checkout:

```bash
node backend/tools/aura_preflight.js
node backend/tools/aura_preflight.js --json
```

The preflight checks Node version, required files, source syntax, selected production environment safeguards and runtime-boundary hints. It makes no system change.

## 4. Isolated restore verification

Verify a safe-source archive before any cutover:

```bash
node backend/tools/restore_verify.js \
  --archive /secure/path/AURA_COMPLETE_SAFE_SOURCE_BACKUP.zip \
  --sha256 <archive-sha256> \
  --port 18081
```

The tool verifies the SHA-256 (when supplied), ZIP integrity, source boundaries, extracts to a fresh OS temporary directory, starts a temporary AURA instance on an isolated high port, checks core pages/APIs and removes the temporary directory. It never writes to the Main Core or restores credentials/runtime state.

## 5. Model server profiles

`GET /api/ollama/server-profiles` exposes curated local model profiles with conservative disk/RAM/VRAM planning figures and actual installation state from the local Ollama `/api/tags` response.

- `INSTALLED_LOCAL` means the local Ollama server reported that model.
- `REQUESTED_NOT_VERIFIED` means AURA has only a local request record; it is not proof of a completed pull.
- `AVAILABLE_TO_PLAN` means it is a source-controlled candidate only.

Disk capacity is not compute capacity. Even with 800 GB available storage, choose models based on measured RAM, VRAM, GPU, CPU, thermal headroom and the real downloaded tag size. Pull and benchmark one model at a time.

`POST /api/ollama/pull` now requires the explicit confirmation token `QUEUE_MODEL_PULL`. Direct model tests use `/api/ollama/test` and work only for an actually installed, locally reported model.

## 6. WF-20 release candidate gate

Release evidence API:

```text
GET  /api/releases
POST /api/releases
GET  /api/releases/:id/report
POST /api/releases/:id/amend
POST /api/releases/:id/claim
POST /api/releases/:id/review
POST /api/releases/:id/approve
POST /api/releases/:id/reject
POST /api/releases/:id/close
```

A candidate records:

- commit/version;
- passing/failing validation evidence;
- safe archive SHA-256 and optional archive/manifest references;
- rollback plan and known limitations;
- append-only local audit-chain events.

High-value constraints:

- evidence can be amended only while a candidate is in `DRAFT`; the prior and corrected values remain in the audit chain;
- a candidate with failing tests cannot enter review;
- approval requires `APPROVE_RELEASE_CANDIDATE`;
- the owner and approver must differ (four-eyes rule);
- approval requires a rollback acknowledgement;
- the record does not tag, push, publish or deploy anything.

## 7. Hermes remains later

These measures prepare a narrow bridge but do not connect one. Hermes remains `NOT_INSTALLED_NOT_CONNECTED` until the clean target, owner authentication, restore drill, release gate, rootless isolation, secret boundary, capability selection and revoke procedure are all independently approved.
