# AURA OS Intelligence

> Legacy/API note: the deterministic briefing endpoint remains `POST /api/jarvis` for backwards compatibility. The owner-facing name is now **AURA OS Intelligence**.

## Purpose

AURA OS Intelligence is AURA's **read-only local operating-intelligence** layer. It turns current local AURA module data into a compact briefing with visible signals, a workflow context and safe next navigation/prompt choices. It lives inside AURA OS at `/aura-os#intelligence`; its expanded HUD is `/intelligence`.

It is not presented as a general autonomous agent, an external executive, a legal reviewer, a production operator or a provider connector. It does not approve, render, export, publish, upload, deliver, send messages, connect accounts, spend money, restart infrastructure or make owner decisions.

## Operator experience

The expanded `/intelligence` HUD and embedded AURA OS panel are focused command surfaces rather than raw JSON chat transcripts. `/jarvis` is now the separate local-model **AURA Admin Copilot**; see [`AURA_ADMIN_COPILOT.md`](AURA_ADMIN_COPILOT.md).

- current intent and headline
- plain-language local briefing
- signal cards with a state (`good`, `warn`, `critical`, `neutral`)
- an optional workflow spine with the current local stage
- explicit next choices that either ask a new local briefing or navigate to an AURA page
- collapsed diagnostic payload for inspection rather than a default wall of JSON
- optional browser-native voice output only; no voice data leaves the browser

The console uses only relative AURA routes. Browser voice uses `SpeechSynthesis` if enabled by the operator; it is not a recording feature and does not call an external voice provider.

## Live briefings and sources

| Intent | Local source(s) | What J.A.R.V.I.S. reports | What it does not do |
|---|---|---|---|
| `status` | module registry, Ops, module containers, repair report, Learning Core | module count, kill-switch state, isolation posture and learning generation | revive/engage a switch or change operations |
| `containers` | Area 67 module-container status | healthy/flagged container posture and circuit-breaker limit | free, restart or unquarantine a container |
| `learning` | Area 69 Learning Core | generation, known failure fingerprints and blocked recurrences | treat a metric as an autonomous decision |
| `backups` | local vault/snapshot index | snapshot count, verification count and newest record | restore or overwrite anything |
| `logs` | local self-repair report | check/problem/repair counters | silently repair/erase a problem |
| `traffic` | local request telemetry | observed request counts and routes | claim audience, reach or customer metrics |
| `today`, `passport`, `rights` | Area 101 Today View | local Passport work, owner-review cards and Studio summary | read email, external metrics or send reminders |
| `studio`, `video`, `post` | Area 102 Studio Command | departments, capability map, local project/preflight posture and production spine | operate camera/NLE/VFX/color/sound/render/export/delivery tooling |
| `workflow` | AURA OS, Passport, Studio Command, registry | controlled local handoff map | execute a handoff externally |
| `research` | configured research endpoint | clearly labelled external-reference radar | adopt code/assets/models/providers without review |
| `download`, `zip` | source-bundle builder | source/docs ZIP handoff route and exclusions | package runtime data, secrets, media or user data |

## Output contract

`POST /api/jarvis` returns a structured, backwards-compatible live briefing:

```json
{
  "mode": "LIVE",
  "persona": "J.A.R.V.I.S.",
  "deterministic": true,
  "intent": "studio",
  "headline": "Studio Command · Production posture",
  "reply": "Plain-language local briefing",
  "signals": [{"label":"External renders","value":"0","state":"good"}],
  "next": [{"label":"Open Studio Command","href":"/studio-command","kind":"navigate"}],
  "workflow": {"title":"Local production spine","steps":["…"]},
  "data": {},
  "boundary": "Read-only local briefing…"
}
```

The `data` field is diagnostic context. UI consumers should prefer `headline`, `reply`, `signals`, `workflow` and `next`, and should not treat any response as an authorization to take an action.

## Workflow embedding

J.A.R.V.I.S. binds the relevant local operating layers without creating a new parallel workflow:

1. **AURA OS (Area 95)** maps an operator/creator/studio working cell.
2. **Creator Project / Release Passport (Area 101)** holds local source, rights, version and owner-review references.
3. **Studio Command (Area 102)** holds shot, sequence, review and delivery requirement manifests.
4. **Today View** exposes local priorities and Studio summary.
5. **J.A.R.V.I.S.** reports and routes the operator to the appropriate existing local layer.

Human review remains necessary for rights, quality, client/owner decisions, accessibility, final export, actual delivery and all provider/platform actions.

## ZIP handoff and safe archive

The **Download Vault** at `/downloads` and J.A.R.V.I.S. `download zip` intent expose two on-demand ZIPs:

```text
GET /api/download/aura-complete-safe-source-backup.zip
GET /api/download/aura-studio-command-source.zip
```

- **Complete safe archive**: all current safe project source, documentation, static configuration, deployment templates and tests. It is the archive intended for an owner-operated source backup.
- **Focused handoff**: the compact Studio Command + J.A.R.V.I.S. package containing the relevant AURA OS, Passport, Studio, J.A.R.V.I.S., Console, route, test and documentation files.

Both ZIPs are built in memory from fixed safe roots/allowlists. Each adds `BUNDLE_MANIFEST.json` with a SHA-256 digest per included file. The complete archive never traverses unknown paths and only accepts text-based project source/configuration in `backend`, `db`, `deploy`, `docs`, `ingest`, `test` and the bundled legacy web-deploy source, plus the root README and `.gitignore`.

Both explicitly exclude:

- `.git` and repository metadata
- all `backend/src/data/` runtime records and `backend/data/sentinel.json`
- secrets, `.env` files, credentials and API keys
- dependencies, caches, builds and logs
- raw media, proxies, renders, customer data and external assets

Neither ZIP is a deployable production snapshot. Reinstall dependencies, manage secrets separately, perform security/right review and rerun `node test/validate.js` in the target environment.

## Validation

The validation suite checks that J.A.R.V.I.S. returns structured live status, learning, Studio/no-render and download-handoff briefings. It also verifies that both on-demand ZIPs have valid signatures, include their required source/manifest entries and do not contain excluded runtime or secret paths.
