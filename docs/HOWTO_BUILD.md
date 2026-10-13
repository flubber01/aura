# AURA — HOW TO BUILD (fehlerfreie Aufbau-Anleitung)

> Für externe Builder-Agenten (z. B. ChatGPT), die Module, Seiten oder
> Schnittstellen zu AURA hinzufügen. Wer diese Regeln befolgt, verursacht
> **keine Syntax-Crashs und keine Regressionen**. Machine-readable Kurzform:
> `GET /api/howto`.

## 0. Goldene Regeln (in dieser Reihenfolge)

1. **Niemals Logik in `backend/server.js`** — die Datei ist ein reiner
   Dispatcher (~115 Zeilen). Alles gehört in `src/routes/`, `src/lib/`, `pages/`.
2. **Vor jedem Neustart:** `node --check <jede geänderte Datei>`.
   Ein Syntaxfehler tötet den Server sofort.
3. **Nach jedem Neustart:** `node test/validate.js` — **0 fail ist die
   Definition von fertig**. Neue Features brauchen eigene Checks.
4. **Cross-Requires zwischen Lib-Modulen immer LAZY** (innerhalb von
   Funktionen, nie top-level) — sonst zirkuläre Requires → halb gebaute
   Objekte → Crash beim Boot.
5. **Daten-Dateien atomar schreiben:** tmp-Datei → `JSON.parse`-Selbstcheck →
   `fs.renameSync`. Der Watcher (Area 59) heilt zusätzlich.
6. **Ehrlichkeit:** Zustände LIVE / SIMULATION / NOT-CONNECTED labeln.
   Zufallsdaten niemals als Live-Daten ausgeben.
7. **Secrets nie committen:** `deploy/.env` und `backend/src/data/secrets.json`
   sind gitignored. Tokens/Keys gehören nur dorthin (oder in ENV).
8. **Publishing & Engagement:** kein Auto-Post ohne menschliche Freigabe,
   nur offizielle APIs, kein synthetisches Engagement (dauerhaft 403).

## 1. Lib-Modul bauen (neue Area)

```js
'use strict';
module.exports = {
  meta: { area: 'NN', id: 'mein_modul', name: 'Klartext-Name', state: 'live' },
  actions: {                          // dispatchbar via POST /api/modules/NN/action/<name>
    status: () => ({ mode: 'LIVE' }), // laufen automatisch in Area-67-Containern:
    do_it:  (p) => ({ ok: true, p }), // Timeout + Circuit Breaker + Quarantäne
  },
  status: () => ({ mode: 'LIVE' }),
};
```
Dann in `src/lib/registry.js` in die `live`-Map eintragen (`'NN': require(...)`)
und ggf. aus `statics` entfernen, falls die Area dort als placeholder stand.
Container-Schutz kommt automatisch — ein crashendes Modul isoliert sich selbst.

## 2. Route-Modul / neue Endpunkte

- Neue Endpunkte in ein bestehendes Route-Modul (`src/routes/api_core.js`,
  `api_areas.js`) oder ein neues Modul nach gleichem Vertrag:
  `module.exports = { name, async handle(ctx) }`, `ctx = { req, res, url, p,
  method, send, readBody, syntaxFail, ROOT, PUBLIC_DIR }`.
  **Return-Konvention:** `return send(...), true` wenn geantwortet, sonst `false`.
- Neues Modul zusätzlich in `src/dispatcher.js → ROUTE_MODULES` eintragen.
- Schreib-Aktionen gegen `ops.isKilled()` prüfen (423), JSON-Bodies mit
  try/catch parsen (400 + `syntaxFail()`).

## 3. UI-Seite bauen

1. `backend/pages/x.js` — exportiert `() => htmlString` (self-contained CSS/JS).
2. Route in `src/routes/pages_routes.js` (require + `if (p === '/x') ...`).
3. Hub-Karte in `pages/hub.js` (`.ccard`), Eintrag im Ignition-Katalog
   (`/api/ignition` in `api_areas.js`).
4. Ehrliche Status-Badges verwenden (LIVE/SIM/NOT-CONNECTED).

## 4. Externes Modul (Area 70)

`backend/modules/<name>/aura.module.json` — Manifest-Spec in
`docs/MODULE_SYSTEM.md`. Approval-Gate beachten: fremde Module werden nie per
Manifest allein vertraut. Beispiel-Module: hello-tool, echo-integration,
crash-dummy.

## 5. Laufzeit-Erweiterungen (hot, ohne Neustart, crash-sicher)

| Element | Endpoint | Pflichtfelder |
|---|---|---|
| Department | `POST /api/depts/add` | id, name, prompt mit `{role}`, roles[] |
| Department löschen | `POST /api/depts/remove` | id |
| Skill | `POST /api/skills/add` | id, name, repo `owner/repo`, crosslinks[] |
| Skill löschen | `POST /api/skills/remove` | id |
| MCP-Server | `POST /api/mcp/servers/add` | name, transport, command/url |
| Service | `POST /api/services/add` | name, url |
| Routine-Link | `POST /api/control/links/add` | from, to |

Alle Endpunkte validieren vor dem Schreiben (400 mit Fehlermeldung statt
Crash) und schreiben atomar — ein fehlerhaftes Input kann das System nicht
beschädigen.

## 6. Testen als Admin (Test Lab, Area 77)

```
POST /api/testlab/run
{ "area": "71", "action": "generate", "payload": {…},
  "expect": "ok" | "fail", "force": true }
```
- `force: true` setzt Container-Fails/Quarantäne zurück → Module sind auch
  nach Fehlern sofort wieder testbar.
- `expect: "fail"` dreht das Verdikt um: ein kontrollierter Crash wird als
  **erwartetes Ergebnis angezeigt** (Drill-Modus).
- `POST /api/testlab/suite` fährt `status` über **alle** Live-Module.
- Verdikt `MATCH ✔` / `MISMATCH ✖` + Output-Vorschau + ms.

## 7. Häufigste Crash-Ursachen (und ihre Vermeidung)

| Crash | Ursache | Vermeidung |
|---|---|---|
| Server startet nicht | Syntaxfehler | `node --check` vor Neustart |
| `Cannot access before initialization` | zirkulärer Require | lazy require in Funktionen |
| Daten-Datei korrupt | direktes Schreiben ohne Check | tmp → parse-check → rename |
| 404 auf neuer Route | Dispatcher-Eintrag fehlt | ROUTE_MODULES ergänzen |
| Aktion tot trotz Fix | Container-Quarantäne | `/api/testlab/run` mit force:true |
| Secrets im Repo | .env committet | deploy/.env ist gitignored — niemals `git add -f` |

## 8. Checkliste vor "fertig"

- [ ] `node --check` auf jeder geänderten Datei
- [ ] Server neu gestartet (stop/start — laufende Server halten alten Code!)
- [ ] `node test/validate.js` → 0 fail
- [ ] Registry + Hub + Ignition + MODULES.md aktualisiert
- [ ] Ehrliche Labels geprüft (nichts Simuliertes als live deklariert)
