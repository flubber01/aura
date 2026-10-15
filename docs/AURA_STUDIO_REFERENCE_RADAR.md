# Studio Command: Open-Source and Professional Workflow Reference Radar

## Why this document exists

The Studio Command catalog was designed as a **capability and workflow radar**. It identifies planning concepts that a production team may need without importing code, packages, media, models, plugins, LUTs, assets, claims of compatibility or licenses from another project.

Nothing in the sources below was vendored into AURA. Nothing below changes AURA's current local-manifest-only boundary. A reference is not an integration approval.

## Reference set used for the initial catalog

| Reference | Observed planning themes | AURA use of the observation | Not adopted |
|---|---|---|---|
| [Sprocket](https://github.com/SprocketVideo/Sprocket) | non-destructive projects/timelines, tracks, proxy/cache ideas, keyframes, color and export architecture | timeline/sequence, version and delivery-brief categories | source code, video/media stack, export behavior, claims of interoperability |
| [Oak Video Editor](https://github.com/OakVideoEditorCommunity/oak) | keyboard workflow, OpenFX/OCIO/LUT concepts, proxy/interchange and color management | shortcut UX and color-management planning cards | plugins, OCIO configs, LUTs, code or license assumptions |
| [OpenReel Video](https://github.com/zhaikong/openreel-video) | browser/local-first editorial concepts, tracks, effects, captions, keyframes, saves | local-first sequence/review and caption planning categories | browser editor implementation or media code |
| [OpenCut](https://github.com/sowjithanumola/OpenCut) | browser editor, transitions, color, audio, captions and keyboard concepts | broad NLE capability comparison | code, dependencies and compatibility assertion |
| [OpenCut-AI](https://github.com/Ekaanth/OpenCut-AI) | transcript-first editing, multicam, captions, smart reframe concepts | capability radar only | model use, AI claims, media processing or plugin integration |
| [Ziflow video production workflow](https://www.ziflow.com/blog/video-production-workflow) | production stages, centralized work, time/range review comments and package review | staged review workflow and timecode-note vocabulary | service workflow, accounts, delivery or SaaS integration |
| [Assemble film post-production template](https://www.onassemble.com/template-library/film-post-production-workflow-template) | capture/editorial/VFX placeholders/conform/color/delivery sequencing | local stage spine | template content or service integration |
| [Georgia Tech video post-production guidance](https://comm.gatech.edu/campus-resources/video-postproduction) | bins/labels, editorial cuts, audio cleanup and caption/accessibility considerations | media organization, sound and accessibility cards | assets, media, tooling or institutional endorsement |

References are named for traceability and feature vocabulary. They do not imply endorsement, affiliation, commercial relationship, API access or license compatibility.

## Adoption gate for every future integration

Before any code, package, asset, plugin, model, model weight, preset, font, stock element, LUT, codec, container image, SaaS API or workflow is actually integrated, the owner must document all gates below.

1. **Scope** — Define the narrow operational result, data flow and which Area would own it.
2. **License and rights** — Identify exact version, license/SPDX identifier, dependency licenses, attribution, redistribution, commercial, model-weight and asset terms. Obtain legal/rights review where appropriate.
3. **Security** — Perform source provenance review, lockfile/dependency scan, secret/data-path review, input validation, SSRF/network/command-execution review, sandboxing and update ownership assessment.
4. **Compatibility** — Verify runtime, OS, hardware, GPU/driver, codec, color management, accessibility, browser and interoperability compatibility in a non-production environment.
5. **Deployment** — Define build reproducibility, pinned versions/checksums, SBOM, rollback, resource limits, observability, incident owner and end-of-life/update process.
6. **Data and privacy** — Map whether raw media, likeness, voices, personal data, client data or telemetry leave the local environment. Apply retention, access, consent, encryption and deletion controls.
7. **Rights and owner approval** — Confirm source/music/image/voice/likeness/location/release/brand rights and obtain explicit owner approval for the actual use, not merely a planning record.
8. **Capability grant** — Start least-privilege. A media adapter should not receive storage, render, network, publish or account privileges it does not need. Any provider/production action must require a separate human confirmation.
9. **Pilot and acceptance** — Test with synthetic/authorized material, document expected outputs and failure states, confirm no unexpected external action, then approve a constrained pilot.
10. **Record and review** — Add the decision, version, approver, residual risk and revocation/rollback plan to the relevant Passport/Studio records.

No integration is “approved by research,” and no external reference overrides AURA's owner, administrator, rights or kill-switch controls.

## Professional workflow coverage vs. execution claims

Studio Command can presently structure the following professional workflow questions locally: What is the shot intent? Which sequence/track structure is planned? Is a VFX placeholder known? Is the color/look intent documented? Is a sound/accessibility note blocking? Which version was reviewed at a timecode? What delivery shapes need a later export team?

It does **not** presently answer execution questions such as: Can AURA control the camera? Ingest footage? Create proxies? Open/edit a timeline? Run VFX? Apply a LUT? Mix audio? Analyze scopes? Produce captions? Render/export a file? Host/send a review? Deliver a client master? Publish to a platform? The answer to every one is **no** until a separately reviewed, explicitly enabled adapter is built and approved.
