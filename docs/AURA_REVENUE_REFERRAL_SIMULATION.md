# AURA Creator Revenue — Referral Credits, Payment Simulation & Product Capability Map

**Scope:** Area 100 is a local-first referral and commercial-control-plane prototype. It does not receive money, create a payment-provider account/session, store payment credentials, send a webhook, issue a receipt, pay commission, or alter a real subscription.

## 1. Referral program policy

### Creator-code rule

- Every eligible AURA creator profile receives **one immutable local referral code** only, e.g. `AURA-4FA92B1C`.
- The code may be shared deliberately as a local referral path; AURA does not create trackers, cookies, ad audiences or public provider checkout links.
- A referred creator can have **one immutable attribution**, which must be written before checkout.
- A code can be paused by an authorized owner but is never silently reissued as a new code.

### Qualified purchase rule

A future real credit is eligible only if every condition is satisfied:

1. Referral attribution existed before checkout.
2. The referred person purchased a paid Pro or Epic plan through a verified official provider integration.
3. A signed provider webhook/event is validated server-side.
4. Settlement/payment status is confirmed according to the provider's documented lifecycle.
5. Refund, chargeback, cancellation and fraud windows are checked.
6. AURA's fraud and terms policy accepts the event.
7. The credit ledger records the result exactly once.

No registration, trial, local plan intent, simulated capture, screenshot, self-declared bank transfer or unchecked callback qualifies.

### Reward policy

| Qualified referred plan | Referral credit for the referrer | Additional marker |
|---|---:|---|
| Pro Monthly / Epic Monthly | 30 days of matching-tier extension credit | Creator Momentum marker |
| Pro Annual / Epic Annual | 60 days of matching-tier extension credit | Annual Creator Accelerator review marker |
| 48h Test / Base | no credit | not a paid purchase |
| Royalty contract route | no automatic credit | individual human/legal/business process only |

The current implementation records the same economics as **test-only simulation credits**. It deliberately does not extend access, remove watermarks, change a price, send cash, issue an invoice or change a real billing record.

### Anti-abuse controls implemented now

- one code per creator profile;
- one pre-checkout attribution per referred profile;
- self-referral profile match refused;
- matching local contact email hash refused;
- duplicate attribution refused;
- suspicious validated records create a manual-risk case instead of a reward;
- an authorized human can document an approve/reject decision for a risk case; an approved case creates only a test-only simulation credit;
- a simulation reversal revokes its still-simulated rewards;
- no cash payout capability.

For production, add account authentication, server-side device/network risk signals consistent with privacy law, rate limits, verified provider event ids, idempotency keys, referral terms, tax/payout legal review, data-retention rules and an appeal workflow. Do not treat basic local profile fields as sufficient fraud prevention.

## 2. Payment-adapter simulation

Area 100 holds an adapter map for **PayPal, Klarna, Revolut Pay, Stripe Billing, Paddle and Mollie**. Every adapter is `NOT_CONNECTED_SIMULATION_ONLY`.

### Local simulation lifecycle

```text
SIMULATED_CHECKOUT_CREATED
  → SIMULATED_CAPTURED_UNVALIDATED        (explicit local “approved” callback simulation)
  → SIMULATED_PURCHASE_VALIDATED_NO_REAL_MONEY
  → SIMULATED_REWARD_GRANTED_TEST_ONLY    (only if referral passes local checks)
  → SIMULATED_REDEMPTION_RECORDED_NO_BILLING_CHANGE

or
SIMULATED_DECLINED
SIMULATED_REVERSED → SIMULATED_REWARD_REVOKED
```

The word “approved” in this flow means **only that an admin chose a test scenario**. It is not a PayPal/Klarna/Revolut/Stripe/Paddle/Mollie signal and it never activates a commercial entitlement.

### Provider replacement contract

When a provider is genuinely integrated, the provider-specific adapter must replace only the simulation event source while preserving the referral ledger contract:

1. create a provider checkout/session on the provider's official API;
2. retain no raw payment credential in AURA;
3. receive the provider's documented signed server-to-server webhook;
4. verify signatures, event ids, account/merchant context and replay/idempotency;
5. map provider payment/settlement/refund/dispute/cancellation states into an explicit normalized purchase record;
6. only then run qualified-purchase and fraud checks;
7. grant a non-cash account credit through the actual billing provider's supported mechanism;
8. reverse/hold the credit for refund, chargeback or fraud events;
9. produce an auditable customer/admin support trail.

Each provider still needs its own approved merchant account, production credentials stored in a secret manager, privacy/terms review, tax/invoice configuration, refund/cancellation path and test/live separation. A provider name in the AURA UI is not an integration claim.

## 3. Product capability map — what AURA should build next

The market standard is moving beyond a prompt-to-song toy. Current AI-music products emphasize a browser DAW, multitrack editing, stems, MIDI, rights/licensing clarity, collaboration and an artist route to release. AURA should differentiate by joining that production layer to ownership, review, commercial operations and self-hosted collaboration.

| Capability | Market signal | AURA position today | Next build boundary |
|---|---|---|---|
| Prompt-to-music/audio generation | common creator entry point | no claimed AURA audio model | connect only a consented/licensed local or official generator; preserve provenance |
| Browser DAW / timeline | pro creator expectation | STUDIO47 is an interest/roadmap lane | project/track model, timeline UI and local file workflow before claiming a DAW |
| Stem editing and separation | core advanced workflow | only render/asset briefs | non-destructive stem manifest, permissions and actual enabled engine required |
| MIDI, tempo, key and arrangement | pro workflow bridge | browser MIDI mapping exists | add editable project metadata and import/export contracts; no fake export |
| Audio uploads / sample use | creators work from their own material | no storage/engine claim | ownership declaration, rights evidence, consent and content-addressed asset inventory |
| Section rewrite / variations | expected iteration control | Content Bot can formulate review cards | version graph and owner-approved variations before any generation adapter |
| Mixing / mastering path | release-ready quality | no mastering claim | human/engine review queue, loudness targets, QA manifest and provider transparency |
| Commercial license clarity | required for artist/client use | royalty route is review-only | per-asset provenance and rights pack; legal review before commercial claims |
| Artist metadata / distribution readiness | important for release | Label/Creator Desks plan metadata | ISRC/UPC/delivery checklist only until a distribution partner is actually connected |
| Content ID / claims safety | material commercial risk | no claim-management integration | rights evidence, dispute log and human approval; no automated claims |
| Visual / music-video package | expected creator bundle | Area 97 makes render briefs | require a connected renderer and rights-safe asset source to render anything |
| Collaboration | leading products add shared projects | Area 99 local room + review cards | deployment auth/TLS plus official adapters before remote transport claim |
| Team roles / approvals | professional workflow need | local roles + remote approval gates | real identity/RBAC/audit before multi-tenant production |
| Credits / usage metering | common monetization pattern | price catalog, no real billing | metering ledger only after usage source and payment adapter are verified |
| Referral / affiliate growth | modern creator business lever | Area 100 local ledger + simulation | signed provider events, terms, fraud, taxes and non-cash billing credits |
| Owned audience / newsletter | reduce platform dependency | consent/draft workflow | official mail provider + double opt-in and unsubscribe processing |
| Distribution / platform delivery | customer expects it eventually | lane maps only | official DSP/distributor contracts and human release gate |
| Analytics / learning loop | retention and product proof | verified import / local dashboards | connect only official/authorized metrics sources with source labels |
| Mobile / PWA workflow | creator expectation | installable shell | offline drafts, encrypted local cache and sync conflict rules |
| Trust & safety | competitive differentiator | admin gates, rights prompts, local-first | policy, consent, provenance, incident response and external review remain product requirements |

### Build order that protects quality

1. **Revenue production readiness:** auth, terms, referral conditions, provider selection, test/live environments, signed webhook verifier, idempotency, ledger reconciliation, refunds/chargebacks, support tooling.
2. **Creator project spine:** owned asset library, project/track/stem metadata, version history, rights/provenance pack, collaboration permissions.
3. **STUDIO47 workflow:** timeline and project manifest first; then only authorized audio engine adapters, MIDI/stem import-export and transparent render queue.
4. **Release operation:** owner-approved metadata package, distribution-readiness checklists, official destination adapters and verifiable reporting.
5. **Growth loop:** experiment briefs, owned-audience consent, referral analytics, verified conversion imports and creator-facing learning reports.

## 4. Competitive reference signals (not copied product logic)

The comparison is based on public, product-level descriptions retrieved on 2026-10-14. AURA does not assert parity with any company.

- Suno's public Studio material describes browser-based multitrack work, stems, MIDI, editing/arrangement controls and exports; its public release notes list timeline, audio/MIDI/stem workflow features. Source: [Suno Studio / DAW overview](https://suno.com/hub/best-daw-for-music-production) and [Suno release notes](https://suno.com/release-notes).
- Suno's public pricing material describes free and paid tiers with creator credits, advanced editing and commercial rights on paid offerings. Source: [Suno song maker pricing overview](https://suno.com/hub/top-ai-song-maker).
- SOUNDRAW publicly presents commercial-license-oriented plans, genre/mood/mixer controls and tiered MP3/WAV/stem workflows. Source: [SOUNDRAW product page](https://soundraw.io/).

The useful AURA lesson is not to clone brand, UI or protected material. It is to retain the use case: **fast musical ideation plus professional control**, then improve it with AURA's local-first rights, review, owned-audience, collaboration, product and transparent commercial-operation spine.
