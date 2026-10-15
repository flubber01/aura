# AURA Clean Rebuild and Cutover Plan

## Decision

Use the currently running AURA server as a **controlled validation environment**. Do not install Hermes there yet, and do not erase the current Main Core merely because the code passes tests.

The safe production path is **parallel rebuild → verification → deliberate cutover → rollback window → decommission**. It is not a destructive in-place reinstall.

## Why this order

A working server is valuable evidence and a rollback point. Removing it before a clean replacement has passed functional, backup and restore checks converts a manageable deployment task into a recovery incident.

AURA's safe source archive intentionally excludes credentials, production runtime state, media, external accounts and rights. A clean rebuild therefore restores source/docs/configuration only; secrets and integrations must be configured again through their own secure owner-controlled process.

## Phase 0 — current validation server

1. Open `/admin` and press **Server aktualisieren**.
2. Confirm the displayed Ollama state is truthful. `NOT-CONNECTED` means there is no local model service to use yet.
3. Use the Admin Console's safe workflow tests. These call only AURA's deterministic simulation and never start an external action.
4. Record a WF-18 Backup and Restore Drill and a WF-20 Release Candidate Quality Gate.
5. Preserve the Git commit, safe archive, manifest and checksum.

## Phase 1 — build a clean replacement host

Prepare a separate owner-controlled target host or VM. It must be isolated from the current Main Core until it has passed verification.

- Create a non-root `aura` service account.
- Install a supported Node runtime and only project dependencies required by the reviewed source tree.
- Restore the verified safe archive to a new directory; do not copy unknown runtime files or `.env` files.
- Configure a new, least-privilege systemd/container service with a restart policy and an explicit data directory.
- Keep inbound access private until health, logging and recovery checks pass.
- Set up credentials in an external secret manager or the owner's deployment configuration, never in the source ZIP or AURA workflow records.

## Phase 2 — verify the replacement

On the replacement host:

1. Verify the archive checksum before extraction.
2. Start AURA as the non-root service account.
3. Run `node test/validate.js` against the replacement environment.
4. Open `/admin`, `/jarvis`, `/workflows`, `/cluster`, `/console` and `/downloads`.
5. Confirm the model panel reports the actual local Ollama state. Install/start Ollama only as a separate owner-approved operation; AURA must remain honest when it is absent.
6. Run an isolated WF-18 restore drill from the replacement host's safe archive.
7. Verify the kill switch, logs, backup policy, network exposure and manual rollback procedure.

Passing application tests does not prove external provider integrations, rights, production media availability or credentials. Review those separately.

## Phase 3 — controlled cutover

1. Freeze feature changes for the cutover window.
2. Create one final source archive and checksum from the approved commit.
3. Take a fresh backup of the current host according to the owner's infrastructure policy.
4. Put the current Main Core into a documented rollback-ready state; do **not** destroy it.
5. Switch traffic/DNS/reverse-proxy routing only after the replacement has passed all Phase 2 checks.
6. Watch health, logs, workflow records and local model status during a defined observation window.

## Phase 4 — rollback or decommission

- If the replacement fails: route back to the unchanged Main Core and record the issue in WF-19.
- If the replacement remains stable for the agreed observation window: remove the old server only with a specific owner authorization and a documented data/secret disposal procedure.
- Do not call an old server "empty" until the owner has verified that required external configuration and retention obligations are handled.

## Hermes is a separate later phase

Hermes remains `NOT_INSTALLED_NOT_CONNECTED` until the replacement is stable and the owner separately approves:

1. rootless isolated runtime;
2. no broad filesystem/host mounts;
3. no secrets or production runtime ledger access;
4. only individually enabled bridge capabilities;
5. tested revoke path, rate limits, audit record and incident process;
6. a limited first capability that can at most propose an AURA workflow draft.

No `curl | bash` installer command belongs in the Main Core cutover runbook.
