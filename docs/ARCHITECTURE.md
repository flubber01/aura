# Architecture

## Layers
1. **Static UI** (`extracted/AURA-Web-Deploy/public`) — original HTML command center.
2. **Backend** (`backend/server.js`) — zero-dependency Node http server: static hosting, JSON APIs, HTML consoles, SSE stream, download service, kill-gated action dispatcher.
3. **Module library** (`backend/src/lib/*.js`) — 16 live modules (areas 02–25, 39, 49, 57) + registry for all 54 areas (live / skill / placeholder / review / restricted).
4. **Brain hierarchy** (`hierarchy.js` + `data/hierarchy.json`) — T0 ultra → T1 super (core + side-server failover) → T2 heads → T3 minions; heads/minions derive from `departments.json`.
5. **OPS** (`ops.js`) — scheduler (12h super-brain DB, 4h other DBs, 24h full checksummed sync), kill switch, Telegram control kit.

## Learning loop
minion reports → head verifies → super aggregates → ultra converts to strategy.
Implemented as `POST /api/hierarchy/:id/feedback`; per-node counters + fleet rate (`/api/hierarchy/knowledge`); autonomy loop (area 49) adds self-heal + checkpoints + success-rate curve.

## Data flow of a task
`POST /api/modules/03/action/submit` → validate+role+trace → store → audit → SSE `/api/stream` → HUDs.

## Egress policy
Sandbox has no outbound internet except package registries; all adapters are config-driven.
Anything needing egress (Telegram poller, providers, HF search) runs in the browser or on user machines.

## Kill switch
Engaged manually (/ops, Telegram /kill) or automatically (uncaught exception, unhandled rejection, 3 syntax failures/5min). While engaged: module actions, mail approval, terminal, social chain → 423.
