# Agent Board & J.A.R.V.I.S. — Betrieb und Grenzen

Stand: 2026-10-13 · Branch `arena/3b63f072-aura` (noch nicht in `main`)

## Agent Board (`/board`)

Kanban für Agenten. Aufgaben laufen in dieser festen Reihenfolge:

`backlog → assigned → in_progress → review → done`, dazu `blocked` bei Hilfsanfragen.

| Regel | Umsetzung |
|---|---|
| Zuweisung nach Fähigkeit | freie Rolle aus den angegebenen Abteilungen mit der geringsten Auslastung, deterministisch |
| WIP-Limit | höchstens 3 aktive Aufgaben je Rolle (`WIP_LIMIT` in `backend/src/lib/agent_board.js`) |
| Hilfe anfordern | Status `blocked`, Vorschlag einer freien Rolle aus der gewünschten Abteilung |
| Übergabe | nur als Antwort auf eine offene Hilfsanfrage, nur an eine Rolle aus der angefragten Abteilung |
| Einreichen | nur die zugewiesene Rolle, Ergebnis mind. 10 Zeichen |
| Freigabe | nur ein Mensch mit Namen. Rollen-IDs und Namen mit „agent“, „bot“ oder „system“ werden abgelehnt |
| Rückgabe | Grund mind. 5 Zeichen, zurück nach `in_progress` |
| Kill-Switch | alle schreibenden Routen antworten mit 423 |

**Grenze:** Die Agenten führen die Arbeit auf dem Board nicht selbst aus. Ergebnisse werden eingetragen, von einem Menschen oder später von einem angebundenen Workflow.

### Admin-Token (optional, empfohlen für Deployments)

Setzt man `AURA_ADMIN_TOKEN`, verlangen alle schreibenden Board-Routen den Header `x-aura-token`. Ohne Header kommt `401`. Die Seite fragt das Token einmal pro Sitzung ab und merkt es sich nur im `sessionStorage` des Browsers.

Ohne `AURA_ADMIN_TOKEN` sind die Schreibrouten offen. Das ist nur für lokale Tests vertretbar.

Das ist kein vollwertiges Login. Benutzerkonten, Rollen und Sitzungen fehlen noch.

### Routen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/board` | Seite |
| GET | `/api/board` | Spalten, Aufgaben, Rollen mit Auslastung |
| POST | `/api/board/task` | Aufgabe anlegen |
| POST | `/api/board/:id/{assign,start,request_help,handoff,submit,approve,reject}` | Übergänge |

## J.A.R.V.I.S. (`/jarvis`)

Die Antwort kommt immer zuerst aus der deterministischen Engine (`backend/src/lib/jarvis.js`) mit Live-Daten. Ist Ollama konfiguriert, formuliert das Modell diese Fakten nur um. Es darf nichts dazu erfinden.

| Variable | Standard | Bedeutung |
|---|---|---|
| `OLLAMA_URL` | nicht gesetzt | Adresse, unter der der **Server** Ollama erreicht, z. B. `http://localhost:11434`. Ohne diese Variable ist Ollama aus. |
| `OLLAMA_MODEL` | `llama3.2` | Modell, das vorher mit `ollama pull` geladen wurde |
| `OLLAMA_TIMEOUT_MS` | `20000` | Zeitlimit, zwischen 1000 und 120000 |

Fällt Ollama aus oder ist die Antwort leer, antwortet die Engine wie ohne Ollama. Die Antwort zeigt dann `mode: LIVE` und den Grund in `llm.reason`.

Der Status steht unter `GET /api/jarvis/llm`. Die Seite zeigt ihn oben an.

**Mikrofon:** Der Button „Sprechen“ nutzt die Browser-Spracherkennung (Chrome oder Edge). Die Aufnahme geht an den Spracherkennungsdienst des Browsers, nicht an AURA. Ohne Erlaubnis startet nichts.

**Sprachausgabe:** Deutsch (`de-DE`). Die Stimme hängt davon ab, was der Browser installiert hat.

## Tests

```bash
node --test test/jarvis_llm.test.js     # 8 Unit-Tests, Fake-Ollama im Prozess, kein Server nötig
node backend/server.js &                # Server starten
node test/validate.js                   # 121 Checks gegen den laufenden Server
```

`validate.js` verändert `store.json` und `failures.json`. Danach mit `git checkout --` zurücksetzen.
