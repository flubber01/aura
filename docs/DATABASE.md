# Databases — current, backups, adding new ones

## Current stores (backend/src/data)
| File | Content | Backup rhythm |
|---|---|---|
| store.json | tasks + audit (atomic writes, capped) | 12h (super) + 24h sync |
| feedback.json | per-brain learning counters | 4h |
| vita.json | consent-only knowledge entries | 4h |
| snapshots/ | checksummed full snapshots (chrono, verified restore) | on-demand + 12h + 24h |
| checkpoints/ | swarm sync checkpoints (sha256, capped 20) | loop + 24h |
| autosave/ | other-DB bundles (capped 10) | 4h |

## PostgreSQL equivalent
`db/schema.sql`: roles, tasks, audit_log, mcp_tools, snapshots, catalog_records.
Apply via migration tooling; snippets are not "applied migrations".

## Adding a NEW database / integration (checklist)
1. Define JSON store or SQL table; add to `db/schema.sql`.
2. Add it to the backup roster in `ops.js` (pick 4h or 12h bucket).
3. Register module in `registry.js` (state: live/placeholder/review/restricted).
4. Cross-link in `skills.json`/`teams.json`/workflows so use cases combine.
5. Expose via `/api/...` + add to `/console` + `/api/types` download catalog.
6. Secrets → secret manager only; add audit events; add kill-gate if it can act outward.

## Vita (user knowledge) rules
consent mandatory (GDPR Art. 6/7) · retention ≤730d · DELETE endpoint (erasure) ·
biometrics/fingerprints/health/special categories hard-rejected by regex.
