# Area 102 Backup and Google Drive Handoff

## Scope

This document governs the archival handoff of AURA's complete safe source, documentation and static-configuration package to the connected Google Drive. The downloadable complete archive includes current source, docs, static configuration, deployment templates and tests, while preserving a hard exclusion boundary. It does not treat Drive as a replacement for an encrypted production-media, credential, legal, customer-data or database backup system.

## On-demand download

The owner-downloadable archive is generated locally in memory at:

```text
GET /api/download/aura-complete-safe-source-backup.zip
```

It includes a `BUNDLE_MANIFEST.json` containing a per-file SHA-256 inventory. The compact Studio Command/J.A.R.V.I.S. handoff remains available at `/api/download/aura-studio-command-source.zip`.

## What belongs in the handoff

- `backend/src/lib/studio_command.js`
- `backend/pages/studio_command.js`
- `backend/pages/aura_os.js`
- `backend/src/lib/registry.js`
- `backend/src/routes/api_areas.js`
- `backend/src/routes/pages_routes.js`
- `test/validate.js`
- `README.md`
- all current safe `backend/`, `db/`, `deploy/`, `docs/`, `ingest/` and `test/` text source/configuration files
- safe text source/configuration from the bundled legacy web-deploy source under `extracted/AURA-Web-Deploy/` (not its media assets)
- root `README.md` and `.gitignore`
- static configuration, deployment templates and tests required to understand and reproduce the safe source state
- a manifest containing the source revision, included files, SHA-256 checksums and validation outcome

## What must not be uploaded by the source backup job

- `.git/` history, credentials or Git configuration
- `backend/src/data/` runtime ledgers (including `studio_command.json`, Passport records, profile records and any user-created data)
- `backend/data/sentinel.json`
- `.env`, `deploy/.env`, secrets, keys, tokens and OAuth material
- `node_modules/`, caches, generated artifacts, logs, coverage/build output or `.cache/`
- raw media, proxies, renders, customer footage, personal data, release forms, client files or unknown third-party assets

The repository's `.gitignore` already excludes the runtime data tree and key generated paths. A Drive backup must apply the same exclusion policy explicitly rather than trusting an archive created from an arbitrary working directory.

## Secure handoff procedure

1. Run syntax checks and the full validation sweep while the local server is active.
2. Build the **complete safe source/docs/config** archive from the fixed safe roots and explicit exclusions; retain the smaller Area 102/J.A.R.V.I.S. archive as a focused handoff when useful.
3. Produce a manifest with the current commit identifier (or local revision label), UTC time, included file list, SHA-256 values and the validation result.
4. Inspect the archive file list for forbidden paths and scan the manifest for accidental secrets/private identifiers before upload.
5. Upload the archive and manifest to a clearly named private Drive folder. Do not create public links or relax sharing settings from AURA.
6. Confirm the returned Drive item IDs and retained filenames. The operator must set/verify the Drive's access policy, retention and deletion policy in their own organization.
7. Keep a second backup and test restoration into a clean temporary directory before relying on the archive for disaster recovery.

## Restore boundary

Restoring this package restores source, page templates, tests and documentation only. It does not recreate an approved production environment, dependencies, runtime records, media assets, external connections, rights clearance or deployment secrets. Re-run setup, security review, dependency installation and validation in the target environment.

## Drive record template

For each upload record:

| Field | Record |
|---|---|
| Complete archive filename / SHA-256 | `AURA_COMPLETE_SAFE_SOURCE_BACKUP_YYYY-MM-DD.zip` / checksum |
| Focused optional handoff | `AURA_STUDIO_COMMAND_SOURCE_YYYY-MM-DD.zip` / checksum |
| Manifest filename / SHA-256 | `AURA_COMPLETE_SAFE_SOURCE_BACKUP_MANIFEST_YYYY-MM-DD.json` / checksum |
| Validation | command + pass/fail total |
| Source revision | commit SHA or local revision label |
| Drive folder/item IDs | returned by the Drive connector |
| Uploaded by / approved by | human operator identity |
| Sharing state | private/restricted confirmation |
| Restore-test date | date + verifier |

This document does not claim that uploading a file establishes legal, retention, encryption, compliance or rights adequacy. Those remain the operator's responsibility.
