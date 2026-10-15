# AURA Remote Approval Deck & Official Connector Gates — Area 98

## Purpose

Area 98 lets a self-hosted AURA operator stay in charge while away from the primary computer. It presents a concise, local **review deck** containing continuity coverage cards, product-image packages, content missions and newsletter drafts. The owner can record a decision remotely only through a specifically configured, allowlisted official transport.

This is deliberately not a remote-autopost system. A recorded remote decision **does not** publish, message, render, spend money, connect an account, deploy a site or start a payment.

## Telegram / BotFather path

AURA already contains Area 78, an official Telegram Bot API adapter. Area 98 integrates with it as a potential self-hosted transport:

1. The owner creates a bot through **@BotFather**.
2. The bot token goes only into the self-hosted environment or secret manager as `TELEGRAM_BOT_TOKEN`; it is never entered into an AURA browser form or committed.
3. The owner configures `TELEGRAM_ALLOWED_CHATS` with their own chat IDs.
4. On their own hardware, the operator uses Area 78 to probe and start the official Bot API poller.
5. In Area 98, the owner creates a Telegram Remote Profile with the same trusted sender/chat IDs.
6. After a documented official transport/allowlist check, the owner deliberately arms the profile.
7. The operator builds a local review deck. Area 78 can then render:
   - `/review`
   - `/continuity`
   - `/approve CARD-ID ONE-TIME-CODE`

Inbound approval is accepted only when all of these are true:

- the Remote Profile is armed;
- the sender chat ID is allowlisted;
- the adapter supplies an official transport receipt, such as the Telegram update receipt;
- the card belongs to that owner profile;
- the one-time confirmation code matches;
- the card is still pending.

The result is `REMOTE_OWNER_APPROVED_LOCAL_ONLY`: a local decision/audit record, **not** a publish action.

## WhatsApp Cloud API and Meta Business path

WhatsApp and Meta Business are represented as official gates rather than fake connectors.

Before a real integration, the owner needs to independently complete the official Meta process, including as applicable:

- business/app verification;
- a controlled WhatsApp Business sender;
- provider-side secret storage;
- validated webhook signature handling;
- documented customer opt-in and recipient policy;
- approved template/category and privacy workflow;
- official OAuth/business asset authorization;
- human approval policy for any public-facing or customer-facing activity.

Area 98 can build a **local Meta / WhatsApp Connector Dossier**. It is preparation material only: it is not submitted, does not contact Meta, and does not assert partnership, approval, endorsement or access.

## Review deck sources

- Area 97 time-off plans and local coverage cards;
- Area 97 Product Image Asset Reactor packages;
- Area 96 content missions;
- Area 96 newsletter drafts.

Each card carries its safety state. The deck never turns a draft into a publication command.

## GitHub / capability-review boundary

AURA's Area 94 Capability Radar holds the locally versioned source links, adoption plans and source-review process for potential reusable building blocks. In this closed coding session, a new live GitHub scan cannot be claimed or performed. The implementation therefore uses only the already local/indexed capability material and explicit official connector documentation—not a fabricated fresh repository finding.

## API

- `GET /api/remote-approval/status`
- `GET /api/remote-approval/data`
- `POST /api/remote-approval/profiles/create`
- `POST /api/remote-approval/profiles/:id/arm`
- `POST /api/remote-approval/decks/create`
- `POST /api/remote-approval/inbound/decision`
- `POST /api/remote-approval/meta/dossier`

The product UI is `/remote-approval`.
