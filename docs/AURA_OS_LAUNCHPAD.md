# AURA OS Launchpad — Area 96

**Status:** local product/access layer.  It extends Area 95's self-hostable creator operating profile with an honest front door for artist pilots, plans, creator operations and future product packaging.

## What is working locally

- **Visible product catalog:** 48-hour restricted test; Base (EUR 0); Pro Annual (EUR 11.99 monthly equivalent / EUR 143.88 billed annually); Pro Monthly (EUR 18.99); Epic Annual (EUR 19.99 monthly equivalent / EUR 239.88 billed annually); Epic Monthly (EUR 29.99, no long-term commitment); and a Royalty Contract path (EUR 0 upfront only as a local contract-review intent, never an automatic royalty/right activation).
- **Local Access Profiles and team directory:** records who owns, operates, edits or reviews the work. This is not authentication, user provisioning or an email-invite service.
- **NasihatBeatZ 47 Artist Cell pilot:** a local profile, Area-95 Artist Cell and Presence Blueprint can be created. Each planned social/page lane is explicitly `PAGE_OR_ACCOUNT_NOT_CREATED`; no external profile is created or claimed.
- **Creator mission pipeline:** a rights-confirmed own-content brief generates local social, script and newsletter draft references through AURA's existing Studio; it can create a local Social Growth launch brief. It cannot post, send, deploy, spend or connect an account.
- **Consent-aware newsletter registry:** records consent version and source, leaves records pending until an official external double-opt-in evidence reference exists, and makes local newsletter drafts only.
- **Companions:** Haley (friendly growth), Britney (launch), Nova (studio/visual) and Echo (release/metrics) are local workflow personas. They do not claim an external agent or autonomous publishing system.
- **Voice safety:** browser-side, user-triggered microphone capture can help the operator make an attestation. AURA stores **no audio**, makes no biometric/liveness claim and never turns the record into voice cloning.
- **Hardware / MIDI:** Web MIDI browser discovery and locally saved workflow mappings / cue pads. No AURA hardware control, DAW transport control or audio capture is claimed.
- **STUDIO47 Cloud-DAW:** an Epic-oriented local interest record, visibly `NOT_CONNECTED`. No browser DAW, GPU, music generation, audio storage, billing or cloud access is provisioned.
- **Installability:** `/aura-os/launchpad` has a small PWA shell/manifest for current Windows, macOS and Android browsers. It is an installable web shell, not a native client claim; live data still needs the self-hosted AURA backend. Native wrappers are planned, not built.

## Product guards

1. **No payment processor.** A plan button records a local `CHECKOUT_NOT_CONNECTED` price intent. It does not debit, invoice, refund or renew.
2. **No identity/auth claim.** A profile is a local record, not a login, account or verification result.
3. **No unproven external state.** Presence blueprints, social handoffs, newsletter records and STUDIO47 requests describe the next safe step — not a completed external action.
4. **Operator-first controls.** Mutating actions require the existing AURA `approved_by` + `admin_authorization` evidence. The client asks for this rather than silently assuming authority.
5. **Local JSON is prototype storage.** A commercial multi-tenant offering needs deliberate auth, tenant isolation, encrypted storage, backups, consent retention/deletion processes, official billing and support operations.

## Guided NasihatBeatZ 47 pilot

1. Open **AURA OS** and create/make ready the `NasihatBeatZ 47 · Artist Cell` workspace with the `Release Flywheel`.
2. Open **Launchpad**, create the local `NasihatBeatZ 47` Access Profile and add only real local collaborators/roles.
3. Build a **Presence Blueprint**. Treat every selected lane as a checklist: manually create/claim pages via the respective official platform, then register only verified owned accounts in Social Growth.
4. When original material and rights confirmations exist, create one **Content Mission**. Review local packs, then use the explicit Social Growth handoff.
5. If desired, create a newsletter consent record only for a person who really consented, then connect a compliant mail provider later for actual double-opt-in and delivery.
6. Pick a Pro/Epic price intent only to express the product configuration desired. Pro/Epic clean branding starts only with a real active entitlement; the Royalty path stays contract-review-only. The STUDIO47 request remains a waitlist/roadmap signal until actual infrastructure, billing and provisioning exist.

## API surface

- `GET /api/aura-os-plus/status`
- `GET /api/aura-os-plus/data`
- `GET /api/aura-os-plus/profiles`
- `POST /api/aura-os-plus/profiles/create`
- `POST /api/aura-os-plus/trial/start`
- `POST /api/aura-os-plus/plan/intent`
- `POST /api/aura-os-plus/members/add`
- `POST /api/aura-os-plus/newsletter/subscribers/add`
- `POST /api/aura-os-plus/newsletter/drafts/create`
- `POST /api/aura-os-plus/companions/create`
- `POST /api/aura-os-plus/companions/guidance`
- `POST /api/aura-os-plus/voice/consent`
- `POST /api/aura-os-plus/hardware/add`
- `POST /api/aura-os-plus/presence/create`
- `POST /api/aura-os-plus/missions/create`
- `POST /api/aura-os-plus/missions/:id/handoff`
- `POST /api/aura-os-plus/studio47/request`

Every write endpoint rejects requests without documented local admin evidence and contains no credential field.
