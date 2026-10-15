# AURA Creator Project / Release Passport — Area 101

## Purpose

Area 101 turns isolated planning tools into one local, project-centred operating spine. A Passport can represent a music release, beat/producer pack, creator product drop, video/content series or client delivery.

It is deliberately a **local metadata, task and reference graph**. It does not upload a file, edit a DAW project, split stems, generate music, render imagery/video, create a legal agreement, clear copyright, ship a client delivery, distribute to DSPs, publish content, send a message or charge money.

## Core flow

```text
Idea / creator promise
  → rights and source records
  → non-destructive asset/version graph
  → credits and contribution claims
  → packaging + metadata + content references
  → owner review and local readiness
  → separately approved external delivery / publication / learning import
```

The Passport does not replace specialist tools. It is the controlled record that lets a creator understand what exists, where it came from, what version is current, what is blocked and what needs a decision next.

## Project types

| Passport type | Required local references before the preflight can be ready |
|---|---|
| Music Release | master candidate, artwork brief, metadata sheet |
| Beat / Producer Pack | beat master, artwork brief, metadata sheet |
| Creator Product Drop | product photo, product copy, metadata sheet |
| Video / Content Series | video brief, content pack, metadata sheet |
| Client Delivery | delivery master, metadata sheet |

Each project starts with a seeded task spine: Idea, Rights, Production, Packaging, Review, Release Readiness and Learning.

## Asset/version graph

An Asset Node stores only a local reference plus project metadata. Supported nodes include idea notes, rights/contract references, audio demo references, beat/master candidates, vocal takes, stem/MIDI manifests, cover/visual briefs, product photos/copy, metadata sheets, content packs and campaign briefs.

- A new node starts as **V1**.
- Creating a node with a parent makes a later version and adds a `derives_from` edge.
- Additional relations are explicit: `uses`, `replaces`, `contains`, `delivered_as`, `inspired_by_owned_reference`.
- It is non-destructive: prior references remain visible rather than being silently overwritten.

A node can be marked as:

- `owned` → a local owner assertion and concrete rights statement are required;
- `licensed` → a local evidence/reference is required;
- `permission_pending` → blocks release readiness;
- `third_party_unverified` → blocks release readiness.

These are project controls, **not legal conclusions**. Real clearance, contracts, ownership disputes, copyright analysis, collection-society registrations and payments require appropriate professionals and/or connected official systems.

## Contributor / credit claims

A Passport can record contributors, role, optional claimed percentage and a concrete rights/contribution statement. This is helpful for visibility but is explicitly not a split sheet, contract, invoice, payout command or legal agreement.

## Preflight and owner review

The local preflight checks:

1. the Access Profile exists;
2. a meaningful project promise exists;
3. at least two Asset Nodes exist;
4. the project type's required asset types exist and are not rights-blocked;
5. no asset has pending/unclear rights;
6. every recorded contributor has a rights statement;
7. the Owner Review task is consciously marked `DONE`;
8. the Release Readiness task is consciously marked `DONE`.

Passing produces `LOCAL_PREFLIGHT_READY_FOR_OWNER_DECISION`. An owner can then approve only a **local** `LOCAL_RELEASE_READY_NOT_DISTRIBUTED` state. That state is not a release, legal authorization, upload, publication, delivery, billing action or entitlement.

## Connected AURA workflow references

A Passport can link existing local record IDs from:

- Area 95 — AURA OS Workspace;
- Area 96 — Launchpad / Content Mission;
- Area 97 — Continuity / Asset Reactor;
- Area 98 — Remote Approval Deck;
- Area 99 — Creator Collaboration Room;
- Area 100 — Creator Revenue / Referral.

These are local reference links only. They intentionally do not mutate the target object or trigger a cross-system action. This keeps the owner in control and allows the handoff to be made deliberately in the relevant workflow.

## Today View

`/today` and the top of `/creator-passport` synthesize local passport work into an honest priority list:

- unclear or pending rights first;
- blocked/urgent/in-progress tasks next;
- missing preflight requirements;
- pending owner reviews;
- read-only counts from local collaboration and revenue ledgers.

It never reads third-party messages, authenticates a user, sends reminders, posts content, schedules a release or decides for the owner.

## Recommended real-world build sequence

1. Use Passports in the AURA sandbox with small real projects and validate whether they reduce lost assets, unclear rights and release confusion.
2. Add real identity/RBAC and secure local storage before sensitive team use.
3. Add a user-controlled file/asset store with checksums, encryption, retention and permission rules.
4. Add actual DAW/audio/video adapters only when hosted or officially connected with permissions and clear model/provider disclosures.
5. Add official distributor, mailbox, social, commerce and billing adapters one by one with explicit owner action, signed webhooks, audit, cancellation/refund and error paths.
6. Measure genuine creator outcomes rather than inventing time, revenue or audience claims.
