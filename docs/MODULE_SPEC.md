# AURA Modul-Schnittstelle (Spezifikation v1)

Diese Schnittstelle ist der einzige Weg, wie neue Module und Integrationen an AURA angebunden werden.
Jedes Modul entwickelt man unabhängig: Ordner anlegen, Manifest schreiben, Einstiegsdatei schreiben.
Andere Dateien werden dafür nicht geändert.

## 1. Ordnerlayout

```
backend/modules/
  mein-modul/
    aura.module.json   ← Manifest (Pflicht)
    index.js           ← Einstiegspunkt (Pfad steht im Feld entry)
```

- Ordner, deren Name mit `.` oder `_` beginnt, werden ignoriert.
- Der Modulordner ist die Grenze. Ein `entry` darf nicht aus ihm herausführen (`..`, absolute Pfade, Symlinks nach außen).
- Verzeichnis per Umgebungsvariable `AURA_MODULES_DIR` änderbar (z. B. für Tests).

## 2. Manifest `aura.module.json`

| Feld | Pflicht | Regel |
|---|---|---|
| `id` | ja | 2–41 Zeichen, Kleinbuchstaben, Ziffern, Bindestrich, beginnt mit Buchstabe. Eindeutig. Zweistellige Bereichsnummern sind verboten. |
| `name` | ja | 1–80 Zeichen |
| `version` | ja | semver `x.y.z` |
| `description` | ja | 1–500 Zeichen, Zweck des Moduls |
| `author` | ja | 1–80 Zeichen |
| `type` | ja | `module` · `integration` · `skill` · `workflow` |
| `entry` | ja | relativer Pfad zur Einstiegsdatei im Modulordner |
| `permissions` | ja | Liste aus der festen Rechteliste (Abschnitt 4). Leer ist erlaubt. |
| `configSchema` | nein | Objekt mit Konfigurationsfeldern (Abschnitt 5) |
| `capabilities` | ja | mindestens eine Fähigkeit (Abschnitt 3.2) |
| `dependencies` | nein | Liste aus `{ "id": "modul-id", "version": "^1.0.0" }` oder `{ "service": "registry" }` |
| `healthCheck` | nein | `true`, wenn das Modul `healthCheck()` implementiert |
| `timeoutMs` | nein | 100–60000, Standard 10000. Gilt für jede Aktion und für Start und Health. |
| `mode` | Integrationen | Pflicht und nur `live`. Simulation gibt es nicht. Integrationen brauchen `healthCheck: true`. |

Versionsbereiche: `*`, `1.2.3` (genau), `>=1.2.0`, `^1.0.0` (gleiche Hauptversion, mindestens).
Dienste für `dependencies.service`: `registry`, `audit`, `mcp`, `llm`.

Beispiel: `backend/modules/example-hello/aura.module.json`.

## 3. Lebenszyklus und Vertrag

### 3.1 Zustände

```
discover → validate → configure → approve → enable → initialize → ready → execute → shutdown
```

Status, die die API zeigt:

| Status | Bedeutung |
|---|---|
| `ungueltig` | Manifest fehlerhaft, doppelte ID oder Pfadverletzung. Grund steht in `errors`. |
| `abhaengigkeit_fehlt` | Abhängiges Modul fehlt oder ist ungültig |
| `version_konflikt` | Abhängiges Modul hat eine nicht passende Version |
| `konfiguration_erforderlich` | Pflichtfeld oder Geheimnis fehlt. Liste in `missing_config`. |
| `freigabe_erforderlich` | Noch nie freigegeben, oder Datei hat sich seit der Freigabe geändert |
| `deaktiviert` | Freigegeben, aber nicht aktiviert |
| `freigegeben` | Aktiviert und bereit zum Start |
| `bereit` | Läuft |
| `fehlerhaft` | Startfehler oder Quarantäne nach 3 Fehlern in Folge |

### 3.2 Vertrag der Einstiegsdatei

Die Datei exportiert ein Objekt. Alle Methoden sind optional, fehlende werden durch einen Adapter ersetzt.

```js
module.exports = {
  // Einmal beim Start. ctx: siehe Abschnitt 6.
  initialize(ctx) {},

  // Optional. Standard: Liste aus capabilities im Manifest.
  getCapabilities() { return [{ name: 'greet', description: '…' }]; },

  // Pflicht für neue Module. Eine Aktion aus den capabilities.
  execute(action, input, ctx) { return { text: 'Hallo' }; },

  // Optional. Standard: { status: 'unbekannt' }. Liefert { status: 'ok'|'fehler', detail }.
  healthCheck() { return { status: 'ok' }; },

  // Optional. Wird beim Deaktivieren, Neuladen und bei geänderter Datei aufgerufen.
  shutdown() {},
};
```

**Adapter für bestehende Module:** Hat eine Datei nur ein Objekt `actions` mit Funktionen
(`{ actions: { ping: (input, ctx) => … } }`), wird sie als Legacy-Modul behandelt.
`execute` wird dann an `actions[action]` weitergeleitet.

**Eingaben** werden vor dem Aufruf gegen das Schema der Fähigkeit geprüft (Pflichtfelder, Typen, unbekannte Felder).

### 3.3 Fähigkeiten (`capabilities`)

```json
{ "name": "greet", "description": "…", "permissions": ["audit:write"],
  "input": { "name": { "type": "string", "required": true } } }
```

- `name`: `a-z`, `0-9`, `_`, 2–41 Zeichen.
- `permissions`: muss eine Teilmenge der Modul-`permissions` sein. Sonst wird das Manifest abgelehnt.
- `input`: Felder mit `type` (`string` · `number` · `boolean`) und optional `required`.

## 4. Berechtigungen

Feste Liste. Unbekannte Rechte machen das Manifest ungültig.

| Recht | Gibt im Kontext frei |
|---|---|
| `registry:read` | `ctx.services.registry.counts()` |
| `audit:write` | `ctx.audit(event, detail)` (Eintrag im Audit-Protokoll) |
| `secrets:read` | `ctx.getSecret(key)` für Geheimnisse des Moduls |
| `mcp:invoke` | `ctx.services.mcp.invoke({ name, args })` (MCP-Ingestion, derzeit Stub) |
| `llm:route` | reserviert. Der Modell-Router ist noch nicht angebunden. |
| `network` | deklarativ. Die Laufzeit erzwingt keine Netzwerksperre (siehe Abschnitt 9). |

Standard: keine Rechte. Die Freigabe durch einen Menschen gewährt **genau** die im Manifest deklarierten Rechte.
Ändert sich das Manifest oder die Einstiegsdatei, ist die Freigabe ungültig.

## 5. Konfiguration (`configSchema`)

```json
"configSchema": {
  "greeting": { "type": "string", "default": "Hallo", "description": "…" },
  "shout":    { "type": "boolean", "default": false },
  "api_key":  { "type": "string", "secret": true, "required": true }
}
```

- Typen: `string`, `number`, `boolean`. Optional `enum`, `min`, `max` (bei number), `default`, `required`.
- **Geheimnisse** (`secret: true`) haben keinen Standardwert. Sie kommen nur aus der Umgebungsvariable
  `AURA_MOD_<MODUL-ID>_<SCHLÜSSEL>` (Bindestriche werden zu `_`, alles groß). Sie werden nie in Dateien
  gespeichert, nie über die API gesetzt und nie ausgegeben. Die API zeigt nur „gesetzt“ oder „fehlt“.
- Nicht-geheime Werte setzt man über `POST /api/modules/ext/<id>/config`. Gespeichert in `backend/data/module_config.json`.

## 6. Kontext `ctx` (Auszug)

| Feld | Inhalt |
|---|---|
| `id`, `name`, `version` | Modul-Identität |
| `config` | nicht-geheime Konfiguration, eingefroren |
| `log(msg)` | Protokollzeile, sichtbar in der Konsole (max. 50) |
| `getSecret(key)` | nur mit `secrets:read` |
| `audit(event, detail)` | nur mit `audit:write` |
| `services.registry` | nur mit `registry:read` |
| `services.mcp` | nur mit `mcp:invoke` |

Module bekommen keine internen Objekte (Store, Kill-Switch, Konfigurationsdatei, Admin-Token).

## 7. Management-API

Lesen ohne Token. Alles Schreibende braucht `x-aura-token` (Wert von `AURA_ADMIN_TOKEN`). Ist die Variable nicht gesetzt, ist Schreiben gesperrt.

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/modules/ext` | alle Module mit Status, Fähigkeiten, Rechten, Konfiguration, Fehlern |
| GET | `/api/modules/ext/<id>` | ein Modul (auch über Ordnernamen erreichbar) |
| POST | `/api/modules/ext/discover` | neu erkennen, Hashes prüfen, freigegebene und aktivierte Module wieder starten |
| POST | `/api/modules/ext/<id>/approve` | Freigabe `{ "by": "Name" }` |
| POST | `/api/modules/ext/<id>/enable` | aktivieren `{ "by": "Name" }`, braucht Freigabe |
| POST | `/api/modules/ext/<id>/disable` | deaktivieren `{ "by": "Name" }` |
| POST | `/api/modules/ext/<id>/config` | `{ "by": "Name", "values": { … } }` |
| POST | `/api/modules/ext/<id>/health` | Status prüfen |
| POST | `/api/modules/ext/<id>/action/<name>` | Aktion `{ "input": { … } }`. Respektiert den Kill-Switch (423). |

`by` darf kein Agent sein. Namen mit `agent`, `system`, `bot` oder `auto` werden abgelehnt (403).
Freigabe, Aktivierung und Konfiguration sind menschliche Entscheidungen.

Die Oberfläche steht als Block „Erweiterungsmodule“ in der bestehenden Konsole (`/console`). Sie nutzt dieselbe API.

## 8. Integrationen: ehrlicher Status

Eine Integration gilt nur dann als verbunden, wenn sie live läuft **und** der Verbindungstest bestanden hat.

| `connection` | Bedeutung |
|---|---|
| `nicht_verbunden` | Ein Geheimnis oder Pflichtfeld fehlt |
| `eingerichtet_nicht_erreichbar` | Health-Check ist fehlgeschlagen |
| `eingerichtet_ungeprueft` | Konfiguriert, aber noch kein erfolgreicher Health-Check |
| `verbunden_getestet` | `mode` ist `live`, Health-Check erfolgreich, Status `bereit` |

Ein registriertes Werkzeug zählt nie automatisch als funktionierende Integration.

## 9. Sicherheit und Grenzen (wichtig)

- **Kein Sandkasten.** Module laufen im selben Node-Prozess wie AURA. Die Rechteprüfung gilt für die Schnittstelle
  (`ctx`), nicht für Systemaufrufe. Ein Modul kann `require('fs')` oder `require('http')` nutzen. Deshalb:
  **Dritt-Module nur nach Prüfung des Quellcodes freigeben.** Eine gültige Manifest-Datei macht ein Modul nicht vertrauenswürdig.
- **Timeouts** fangen nur asynchrone Hänger ab. Eine Endlosschleife ohne `await` blockiert den Prozess.
- **Quarantäne:** 3 Fehler in Folge stoppen das Modul. Aktivieren oder Neuladen hebt sie auf. Der Server läuft weiter.
- **Audit:** Freigabe, Aktivierung, Deaktivierung, Konfiguration, Aktionen (Erfolg und Fehler, ohne Eingabewerte) und Quarantäne landen im Audit-Protokoll.
- **Pfadschutz:** Jeder `entry` wird aufgelöst und muss innerhalb des Modulordners liegen. Symlinks nach außen werden abgelehnt.
- **Größenlimit:** Manifest höchstens 64 KB.
- **Keine automatische Ausführung unbekannter Module.** Neue Module bleiben im Status `freigabe_erforderlich`, bis ein Mensch freigibt.

Noch nicht gebaut: Prozess-Isolation (eigener Worker-Prozess oder Container pro Modul), Netzwerksperre, Signaturprüfung von Modulpaketen, Update aus einem Paket-Repository.

## 10. Beispielmodul hinzufügen (ohne weitere Änderungen)

1. Ordner `backend/modules/mein-modul/` anlegen.
2. `aura.module.json` nach Abschnitt 2 schreiben.
3. `index.js` mit `execute` schreiben.
4. Server neu starten oder in der Konsole „Neu erkennen“ klicken.
5. In der Konsole Freigeben → Aktivieren. Oder per API:

```bash
curl -X POST localhost:8080/api/modules/ext/mein-modul/approve -H "x-aura-token: $AURA_ADMIN_TOKEN" -H 'content-type: application/json' -d '{"by":"Dein Name"}'
curl -X POST localhost:8080/api/modules/ext/mein-modul/enable  -H "x-aura-token: $AURA_ADMIN_TOKEN" -H 'content-type: application/json' -d '{"by":"Dein Name"}'
curl -X POST localhost:8080/api/modules/ext/mein-modul/action/greet -H "x-aura-token: $AURA_ADMIN_TOKEN" -H 'content-type: application/json' -d '{"input":{"name":"Welt"}}'
```

Mitgelieferte Beispiele: `example-hello` (Modul mit Konfiguration und Rechten). Eine Integration-Vorlage mit echtem Health-Check folgt erst, wenn ein echter Dienst angebunden wird.

## 11. Konfiguration des Loaders

| Variable | Standard | Zweck |
|---|---|---|
| `AURA_MODULES_DIR` | `backend/modules` | Modulordner |
| `AURA_MODULE_STATE_FILE` | `backend/data/module_state.json` | Freigaben und Aktivierung (Laufzeit, nicht in Git) |
| `AURA_MODULE_CONFIG_FILE` | `backend/data/module_config.json` | nicht-geheime Konfiguration (Laufzeit, nicht in Git) |
| `AURA_MOD_<ID>_<KEY>` | — | Geheimnisse je Modul |
| `AURA_ADMIN_TOKEN` | — | schreibende Routen |

## 12. Tests

`node test/module_loader.test.js` (22 Fälle): Erkennung, ungültige Manifeste, doppelte IDs, Abhängigkeiten,
Versionskonflikte, Freigabe nur durch Mensch, Eingabeprüfung, Timeout, Quarantäne, Legacy-Adapter, Ablehnung von Simulationsmodus,
Geheimnisse, Hash-Änderung, Pfadschutz, Rückwärtskompatibilität der Registry.
