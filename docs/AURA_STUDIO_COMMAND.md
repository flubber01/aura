# AURA Studio Command (Area 102)

## Purpose and truth boundary

**Studio Command** is AURA's local, reviewable operating model for premium video production and post-production. It connects a creative brief to camera planning, editorial structure, VFX/motion, color, sound, accessibility, rights review and delivery requirements.

It is deliberately **not** an NLE, camera controller, media store, codec engine, renderer, transcoder, uploader, publisher, review-link service, client-delivery service, payment service or external-account connector. A local `DELIVERY_READY` result means that its *manifest preflight* is complete; it never creates a media file or takes an external action.

This distinction is exposed in the UI, status endpoint and records:

- project: `NO_CAPTURE_NO_INGEST_NO_EDIT_NO_RENDER_NO_EXPORT_NO_PUBLICATION`
- shot card: `LOCAL_SHOT_CARD_READY_NO_CAMERA_CONTROL`
- sequence: `LOCAL_TIMELINE_MANIFEST_NO_NLE_ENGINE`
- delivery preflight: `NO_MEDIA_RENDER_NO_EXPORT_NO_DELIVERY_NO_PUBLICATION`

## Entry points and integration

| Surface | Role |
|---|---|
| `/studio-command` | Interactive Studio Command workspace |
| `/api/studio-command/status` | Honest operational status and stated boundaries |
| `/api/studio-command/data` | Departments, capability catalog, projects, presets, shortcuts and audit summary |
| `/aura-os` | AURA OS navigation, boot identity and command-palette entry point |
| `/creator-passport` | Optional upstream Project/Release Passport reference |
| `/today` | Existing local priority layer; Studio records do not send work, reminders or messages |

A Studio Project can optionally reference one existing Area 101 Project Passport. This creates only a local reference: it does not ingest a Passport asset, alter rights, synchronize media, or release/distribute anything. The Passport can also keep a local Area 102 handoff reference. Today View summarizes Studio stages and unresolved blocking Studio notes for the same profile; it still sends no reminder or message. An AURA OS workspace may link a Studio Project into its operating map, again as a local record only.

## Studio team: nine local departments

These are named operational roles and local work cards, not claims that AURA employs people or autonomously operates a production.

| Department | Local specialist roles |
|---|---|
| Creative Direction | Showrunner; Creative Director; Narrative Editor; Brand / Style Director |
| Production & Camera | Director of Photography; Camera Operator; 1st Assistant Camera; Gaffer / Lighting Planner; Grip / Rigging Planner; Production Coordinator; Location / Safety Planner |
| Editorial & Story | Lead Editor; Assistant Editor; Story Producer; Multicam Editor; Short-form Editor; Transcript / Logging Editor |
| VFX, Motion & Graphics | VFX Supervisor; Compositor; Motion Designer; Title / Typography Designer; Tracking & Roto Planner; 3D / Previs Planner; Graphics QC |
| Color & Finishing | Colorist; Color Assist; Conform Editor; Look Development Artist; HDR / SDR Delivery QC |
| Sound Post | Dialogue Editor; Sound Designer; Foley Planner; Re-recording Mixer; Music Supervisor; Loudness / Mix QC |
| Accessibility & Localization | Caption Editor; Subtitle QC; Audio Description Planner; Localization Coordinator; Inclusive Design Reviewer |
| Media Ops, Rights & Data | Media Asset Manager; DIT / Ingest Planner; Proxy / Archive Planner; Rights & Release Librarian; Metadata Steward; Security / Backup Steward |
| Review, Delivery & Growth | Executive Producer; Client / Owner Reviewer; Delivery Producer; Platform Packaging Planner; Campaign Cutdown Producer; Verified Metrics Analyst |

The supplied catalog contains 52 roles across the nine departments. Roles turn an agreed creative/production brief into clear cards and review prompts; they do not make owner, legal or client decisions.

## Transparent 40-capability catalog

The catalog answers **what workflow coverage AURA can structure today**, not what media technology it performs. Its status values have the following meaning:

- `LIVE_LOCAL_MANIFEST` / `LOCAL_PROJECT_MANIFEST`: a local structured record is supported.
- `LIVE_LOCAL_BROWSER`: a browser-only behavior is supported.
- `LOCAL_STYLE_MANIFEST` / `LOCAL_REFERENCE_ONLY`: a brief or reference record is supported.
- `LOCAL_BRIEF_ADAPTER_REQUIRED` / `ADAPTER_REQUIRED`: no media execution is included; a separately approved adapter would be needed.

| Domain | Capability IDs / use cases |
|---|---|
| Editorial & organization | `timeline_multitrack`, `bins_metadata`, `proxy_workflow`, `multicam`, `timecode`, `trim_tools`, `nested_sequences`, `markers`, `undo_history` |
| Editorial motion & graphics | `keyframes`, `speed_ramps`, `transitions`, `titles_typography`, `motion_graphics` |
| VFX | `vfx_placeholders`, `tracking_roto`, `chroma_key` |
| Color & finishing | `color_management`, `primary_grade`, `secondary_grade`, `luts`, `scopes` |
| Sound | `audio_dialogue`, `sound_design`, `mix_loudness`, `music_rights` |
| Accessibility & localization | `captions`, `subtitles`, `audio_description` |
| Review, quality & versioning | `review_comments`, `version_compare`, `qc_checklist` |
| Delivery & archive | `delivery_presets`, `master_archive`, `social_cutdowns`, `thumbnail` |
| Production planning & control | `camera_shotlist`, `call_sheet`, `style_bible`, `shortcut_command` |

The 40 cards intentionally compare broad professional/NLE categories without pretending that AURA now edits clips, creates effects, operates a camera, calculates scopes, produces captions, renders a master, or uploads a deliverable.

## Supported local project types

`music_video`, `product_film`, `artist_visualizer`, `short_form_series`, `podcast_video`, `interview_documentary`, `event_recap`, `education_course`, `live_session`, `client_delivery`, `short_film`, and `brand_campaign`.

A new project requires all of the following:

1. an existing Area 96 local profile,
2. a recognized project type,
3. a title of at least three characters,
4. a concrete brief of at least 30 characters,
5. `approved_by`, and
6. a substantive `admin_authorization`.

Optional fields preserve visual direction, a Passport reference, format/frame-rate decisions and a rights/privacy/safety boundary. The default boundary says to use only owned, licensed or documented-permission material and not to imitate a person’s biometric identity, voice or likeness.

## Workflow and review gates

Studio Command models this production spine:

1. `DEVELOPMENT`
2. `PRE_PRODUCTION`
3. `CAPTURE_PLAN`
4. `INGEST_PLAN`
5. `ASSEMBLY`
6. `ROUGH_CUT`
7. `PICTURE_LOCK_REVIEW`
8. `VFX_MOTION_PLAN`
9. `COLOR_FINISH_PLAN`
10. `SOUND_POST_PLAN`
11. `ACCESSIBILITY_QC`
12. `DELIVERY_READY`

Stages must progress one at a time. `PICTURE_LOCK_REVIEW` requires at least one local Sequence Manifest. `DELIVERY_READY` requires no unresolved `blocking` review note. A preflight is local-ready only when it has a rights boundary, a shot card, a sequence, no open blocking note and the final stage. There is no automatic stage advance and no implied owner/client approval.

### Primary records

| Record | Stored planning data | Explicit exclusion |
|---|---|---|
| Studio Project | brief, type, visual/risk boundary, optional Passport link, stage cards | no camera/media job |
| Shot Card | scene, story goal, framing, movement, lens/light/audio/safety notes | no hardware control |
| Sequence Manifest | title, purpose, aspect, target duration, intended tracks and edit intent | no timeline engine or clip processing |
| Review Note | optional timecode, department, severity, text and resolution | no review-link/send action |
| Delivery Preset | aspect and delivery requirement brief | no codec/export job |
| Shortcut | browser combo and AURA-local route | no OS-level key hook or external automation |

## API contract

All mutation routes are subject to the AURA-wide kill switch and require `approved_by` plus an explicit `admin_authorization`. Invalid JSON is rejected; input strings are bounded; project/profile/passport references are checked; stage transitions are sequential.

| Method | Endpoint | Local effect |
|---|---|---|
| GET | `/api/studio-command/status` | status, team count, policies |
| GET | `/api/studio-command/data` | catalog and local records |
| POST | `/api/studio-command/projects/create` | creates a local Studio Project |
| POST | `/api/studio-command/shots/add` | adds a Shot Card |
| POST | `/api/studio-command/sequences/add` | adds a Sequence Manifest |
| POST | `/api/studio-command/notes/add` | adds a timecode/project-level review note |
| POST | `/api/studio-command/projects/:id/advance` | advances exactly one stage after gates |
| POST | `/api/studio-command/notes/:id/resolve` | resolves a local note with a documented resolution |
| POST | `/api/studio-command/shortcuts/create` | records a shortcut definition |

Runtime records are stored at `backend/src/data/studio_command.json`. The complete `backend/src/data/` runtime tree is intentionally ignored by Git. It may contain local project data and is not a source deliverable.

## Delivery presets

The local catalog includes briefs for a 16:9 master, vertical Shorts/Reels/TikTok, 4:5 feed, 1:1 square, client-review master and SRT/VTT sidecar. Every entry is `EXPORT_BRIEF_ONLY`. Codec, bitrate, color-space, loudness, caption validation, encryption, DRM, platform policy and actual delivery remain decisions for the appointed production/technical team and separately authorized tooling.

## Security, rights and production hygiene

- Record a source/permission boundary before planning production.
- Treat release forms, music synchronization, stock, fonts, LUTs, plugins, locations, trademarks, client assets, faces, voices and personal data as owner/legal review topics; a field in AURA is not legal clearance.
- Do not insert real credentials, unredacted client media paths, secrets or private personal data into a brief or note.
- Keep raw and proxy media in an access-controlled workflow outside this local manifest layer until a separately reviewed media architecture exists.
- Require human owner/client sign-off for picture lock, final creative, legal/rights, accessibility, mastering and delivery.
- Test an adapter in a non-production environment before granting it any media, storage, render, provider or account capability.

## Validation

`test/validate.js` exercises Area 102 end-to-end against the running server: it creates a Passport-linked local Studio Project, shot card, sequence manifest and blocking review note; advances through the staged workflow; proves Delivery Ready is blocked until resolution; saves a browser shortcut; asserts the no-render/no-export boundary; then removes its test records from the ignored runtime ledger.

Run the full sweep with:

```bash
node backend/server.js
node test/validate.js
```
