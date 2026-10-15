# AURA OS Boot Identity and Browser Shortcuts

## What changed

AURA OS (`/aura-os`) now opens with a short, visual **AURA OS** boot identity: a single A mark, soft glow and brief flash on the local page. It is product identity, not a claim to boot or control a physical operating system.

The effect is intentionally lightweight:

- it exists only in the loaded browser page;
- it has no network request, tracking pixel, audio, media file or external dependency;
- it completes after roughly 980 ms and uses `sessionStorage` to avoid repeating in the same browser tab/session;
- `prefers-reduced-motion: reduce` disables the animations;
- it can neither change a device boot process nor control hardware.

AURA OS now links directly to `/studio-command` in its navigation and command palette.

## AURA Command palette

Press **Ctrl/Cmd + K** outside a form field on AURA OS to open its local navigation palette. It offers fixed internal AURA links: Today View, Project Passport, Studio Command, Collaboration, Creator Revenue and Remote Approval.

The palette filters while the user types and closes via **Escape** or backdrop click. It uses ordinary relative AURA routes; it does not access external sites, browser history, clipboard, native OS commands or account data.

## Configurable browser shortcuts

Area 102 adds a deliberate shortcut configuration form in `/studio-command`.

1. Enter a supported key combination such as `alt+1`, `ctrl+9`, `ctrl+shift+s` or `meta+k`.
2. Select one of the fixed AURA-local navigation actions.
3. Confirm the normal `approved_by` and `admin_authorization` prompts.
4. Save. The server records the audited local definition and the browser stores the active route binding in `localStorage` under `aura-studio-shortcuts`.

Supported targets are AURA-local routes only:

| Action | Route |
|---|---|
| Open AURA Today | `/today` |
| Open Project Passport | `/creator-passport` |
| Open Studio Command | `/studio-command` |
| Open Collaboration Room | `/creator-collaboration` |
| Open Creator Revenue | `/creator-revenue` |
| Open Launchpad | `/aura-os/launchpad` |
| Open Remote Approval | `/remote-approval` |
| Open AURA OS | `/aura-os` |

The valid grammar is up to three modifier prefixes (`ctrl`, `meta`, `alt`, `shift`) plus one letter or digit. Examples: `ctrl+k`, `alt+9`, `ctrl+shift+s`. Shortcut matching runs only inside AURA pages, ignores `input`, `textarea` and `select` elements, and uses `preventDefault()` only after a configured exact match.

A Studio Command shortcut becomes active immediately there. AURA OS also reads the same local-storage key so the setting works across those two local browser UIs. It is not a system-wide hotkey, browser extension, keyboard logger, remote-control mechanism or background service. Clearing site data/local storage removes browser-side bindings; the server's runtime audit record remains local and can only be changed through the guarded API.

## Collision and accessibility guidance

- Prefer `alt+number` for project navigation to reduce conflict with familiar browser/browser-assistive commands.
- Avoid binding Ctrl/Cmd+K if the command palette should remain the default entry point.
- Do not assume a physical layout: users with alternative keyboards or assistive technology should retain native browser shortcuts.
- The shortcut listener never activates while entering copy, notes, briefs or review text.
- Keyboard behavior is local navigation convenience only; no workflow stage, approval, rights assertion, payment, render, publication or provider action may be placed behind a shortcut.

## Implementation locations

| File | Responsibility |
|---|---|
| `backend/pages/aura_os.js` | boot shell/CSS, command palette and shared browser shortcut listener |
| `backend/pages/studio_command.js` | configuration UI plus Studio-side listener and localStorage write |
| `backend/src/lib/studio_command.js` | allowed action catalog, strict combo validation and auditable shortcut record |
| `backend/src/routes/api_areas.js` | guarded shortcut mutation endpoint |

All shortcut data is local. Runtime manifest records live under ignored `backend/src/data/studio_command.json`; Git contains no browser-local settings or user-created Studio data.
