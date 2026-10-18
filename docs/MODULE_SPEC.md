# AURA Modul-Schnittstelle (Spezifikation)

> **Zwei Wege, eine Datei.** Dieses Dokument ist die verbindliche Schnittstellen-Beschreibung für
> Erweiterungen. Teil **A** gilt für **Dritt-Module**, die über die Import-Schleuse hereinkommen
> (ZIP oder Basis64-Text → Prüfung → deine Freigabe). Teil **B** gilt für Module, die du selbst als
> Ordner in `backend/modules/` anlegst.
>
> **Maschinenlesbar:** Teil A ist nicht nur Prosa. Die prüfende Fassung derselben Regeln liegt in
> `backend/src/lib/module_spec.js` und ist über `GET /api/modulehub/import` als JSON abrufbar.
> Ein Test (`test/round10_suite.test.js`) stellt sicher, dass Dokument und Code nicht auseinanderlaufen.

| Teil | Gilt für | Erzwingt der Code | Freigabe |
|---|---|---|---|
| **A — Schnittstelle v2** | importierte Dritt-Module (ZIP/Basis64) | `POST /api/modulehub/import` · `backend/src/lib/module_spec.js` | ausschließlich `POST /api/modulehub/<id>/approve` |
| **B — Schnittstelle v1** | Ordner in `backend/modules/` (eigene Module) | `backend/src/lib/module_manifest.js` + `module_loader.js` | `POST /api/modules/ext/<id>/approve` |

---

# Teil A — Schnittstelle v2 (verbindlich für Dritt-Module)

**Spec-Version:** `2.0.0` · **Code:** `backend/src/lib/module_spec.js` · **Prüfpfad:** `backend/src/lib/module_import.js`

## A1. Ordnerlayout

```
mein-modul.zip                 ← ein Ordner (oder die Dateien direkt)
  aura.module.json             ← Manifest (Pflicht)
  index.js                     ← Einstieg (Pfad steht im Feld entry)
  selftest.js                  ← Selbsttest (Pfad steht im Feld selftest.entry)
```

Grenzen je Paket (fest in `module_spec.js`, dort `LIMITS`):

| Grenze | Wert |
|---|---|
| Paketgröße (entpackt) | 4 MiB |
| Dateien | 40 |
| Einzeldatei | 256 KiB |
| Manifest | 64 KiB |
| Pfadtiefe | 4 Ebenen |
| Selbsttest-Laufzeit | 10 000 ms (hart) |

Unzulässig im Archiv: absolute Pfade, `..`, Rückwärtsschrägstriche, Null-Bytes, Symlink-Pfade.
Ein Treffer bedeutet **sofort rot** — das Paket wird nicht übernommen.

## A2. Manifest `aura.module.json`

| Feld | Pflicht | Regel |
|---|---|---|
| `id` | ja | `^[a-z][a-z0-9-]{1,40}$` — beginnt mit Buchstabe (damit keine Kollision mit Bereichsnummern), eindeutig |
| `name` | ja | 1–80 Zeichen |
| `version` | ja | semver `x.y.z` |
| `description` | ja | 1–500 Zeichen, Zweck des Moduls |
| `author` | ja | 1–80 Zeichen |
| `type` | ja | `module` · `integration` · `skill` · `workflow` |
| `entry` | ja | relative `.js`-Datei im Modulordner, kein `..`, nicht absolut |
| `permissions` | ja | Liste aus A4 — leer erlaubt. Jedes unbekannte Recht macht das Manifest ungültig |
| `routes` | ja | Liste aus A3 — leer erlaubt. Jede Route muss in der Erlaubnisliste stehen |
| `selftest` | ja | Objekt `{ entry, timeout_ms? }` — ohne Selbsttest kein Import |
| `configSchema` | nein | eigene Konfigurationsfelder. **`secret: true` ist für Dritt-Module verboten** |
| `capabilities` | nein | angebotene Aktionen `{ action \| name, description, input }` |
| `dependencies` | nein | Liste aus Modul-IDs oder `{ "service": "registry\|audit\|mcp\|llm" }` |
| `healthCheck` | nein | `true`, wenn das Modul `healthCheck()` implementiert |
| `timeoutMs` | nein | 100–60000, Standard 10000 |

### Maschinenlesbares Schema

Derselbe Stand liegt unter `GET /api/modulehub/import` (Feld `schema`) und in
`backend/src/lib/module_spec.js` (`MANIFEST_SCHEMA`).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://aura.local/schemas/aura.module.v2.json",
  "title": "AURA Modul-Manifest (Schnittstelle v2)",
  "type": "object",
  "required": ["id", "name", "version", "description", "author", "type", "entry", "permissions", "routes", "selftest"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,40}$", "description": "Kleinbuchstaben, Ziffern, Bindestrich; beginnt mit Buchstabe" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$", "description": "semver x.y.z" },
    "description": { "type": "string", "minLength": 1, "maxLength": 500 },
    "author": { "type": "string", "minLength": 1, "maxLength": 80 },
    "type": { "type": "string", "enum": ["module", "integration", "skill", "workflow"] },
    "entry": { "type": "string", "pattern": "^[A-Za-z0-9._/-]+\\.js$", "description": "relative .js-Datei im Modulordner, kein \"..\"" },
    "permissions": { "type": "array", "items": { "type": "string", "enum": ["log:write", "audit:write", "config:read", "health:read", "registry:read", "skills:read", "schedule:read", "events:pub", "events:sub", "storage:kv", "ai:route"] }, "uniqueItems": true },
    "routes": {
      "type": "array",
      "description": "AURA-Endpunkte, die das Modul aufrufen will. Nur GET, nur aus der Erlaubnisliste, leer erlaubt.",
      "items": {
        "type": "object",
        "required": ["method", "path"],
        "properties": { "method": { "type": "string", "enum": ["GET"] }, "path": { "type": "string" }, "purpose": { "type": "string", "maxLength": 200 } }
      }
    },
    "selftest": {
      "type": "object",
      "required": ["entry"],
      "description": "Selbsttest: läuft als eigener Kindprozess, 10 Sekunden, ohne Netz.",
      "properties": {
        "entry": { "type": "string", "pattern": "^[A-Za-z0-9._/-]+\\.js$" },
        "timeout_ms": { "type": "integer", "minimum": 100, "maximum": 10000 }
      }
    },
    "configSchema": { "type": "object", "description": "eigene Konfigurationsfelder (nie secret:true — Geheimnisse sind verboten)" },
    "capabilities": { "type": "array", "description": "angebotene Aktionen: {action|name, description, input}" },
    "dependencies": { "type": "array" },
    "healthCheck": { "type": "boolean" },
    "timeoutMs": { "type": "integer", "minimum": 100, "maximum": 60000 }
  }
}
```

## A3. `routes[]` — erlaubte API-Oberfläche (nur lesend)

Ein Modul darf **keine eigenen Netzaufrufe** machen (siehe A6). Es darf ausschließlich diese
AURA-Kontext-Endpunkte deklarieren — und bekommt auch nur diese:

| Methode | Pfad | Liefert |
|---|---|---|
| GET | `/api/health` | Backend-Zustand, Laufzeit, Bereichszähler |
| GET | `/api/modules` | Registry aller Bereiche (Zustand, nie Geheimnisse) |
| GET | `/api/modules/live` | vereinte Registry inkl. Modul-Modus |
| GET | `/api/modulehub` | Modulhub-Übersicht |
| GET | `/api/modulehub/catalog` | Rechte-Katalog, Typen, Zustände, Vertrag |
| GET | `/api/skills` | Fähigkeitskatalog |
| GET | `/api/schedule` | Terminübersicht |
| GET | `/api/report` | Bericht aus echten Zählern |
| GET | `/api/types` | Typenkatalog |

Regeln: nur `GET`, nur exakt diese Pfade, kein Query-Missbrauch. Alles andere → Prüfung `manifest` rot.

## A4. `permissions[]` — Rechte

Die Freigabe durch einen Menschen gewährt **genau** die deklarierten Rechte. Unbekannte Rechte machen
das Manifest ungültig. Geheimnisse gibt es für Dritt-Module **nicht** — kein `secrets:read`, keine
Umgebungsvariablen, keine Konfigurations-Geheimnisse.

| Recht | Gibt im Kontext frei |
|---|---|
| `log:write` | `ctx.log(level, meldung, detail)` — eigene Logzeile |
| `audit:write` | `ctx.audit(ereignis, detail)` — Eintrag im Audit-Protokoll |
| `config:read` | `ctx.config` — eigene Konfiguration (nie globale Geheimnisse) |
| `health:read` | `ctx.health()` — Zähler der Registry und Laufzeit (nur lesen) |
| `registry:read` | `ctx.services.registry.counts()` — Modul-Zähler (nur lesen) |
| `skills:read` | `ctx.skills()` — verdrahtete Fähigkeiten (nur lesen) |
| `schedule:read` | `ctx.schedule()` — Terminübersicht (nur lesen) |
| `events:pub` | `ctx.events.emit(thema, daten)` — internes Ereignis senden |
| `events:sub` | `ctx.events.on(thema, funktion)` — internes Ereignis empfangen |
| `storage:kv` | `ctx.store.get/set` — dem Modul zugeordnete Schlüssel/Werte |
| `ai:route` | `ctx.routing()` — Modell-Router-Status (nie Schlüssel) |

Standard: keine Rechte. Module bekommen keine internen Objekte (Store, Kill-Switch, Konfigurationsdatei,
Admin-Token) und **niemals** `process.env`.

## A5. `selftest` — der eigene Prüflauf

```json
"selftest": { "entry": "selftest.js", "timeout_ms": 5000 }
```

- Läuft als **eigener Kindprozess**: `node --require backend/src/preload/module_selftest_sandbox.js selftest.js`.
- **10 Sekunden** harte Grenze, danach `SIGKILL`.
- Der Sandkasten (`backend/src/preload/module_selftest_sandbox.js`) sperrt: Netzwerk (`net`, `tls`, `dgram`,
  `dns`, `http`, `https`, `http2`, `fetch`), Kindprozesse, `vm`/`worker_threads`, alle schreibenden
  `fs`-Zugriffe und `process.env` (leer).
- Bewertung: **Exit 0 = bestanden**. Alles andere ist rot, inklusive Zeitüberschreitung (Exit 124).
- Ausgabe auf `stdout` darf ein JSON-Protokoll sein (`{"ok":true,"pruefungen":[…]}`) — es wird im
  Prüfprotokoll mitgeführt.
- **Ehrlich gesagt:** das ist eine API-Sperre im Node-Prozess, kein Betriebssystem-Sandkasten. Native
  Erweiterungen könnten sie umgehen. Deshalb bleibt deine Freigabe das eigentliche Tor.

## A6. Verbotsliste (statischer Scan — ein Treffer ist rot)

Der Scan läuft über jede `.js`/`.mjs`/`.cjs`-Datei, Zeile für Zeile; reine Kommentarzeilen zählen nicht.

| Muster-Id | Erwischt | Warum verboten |
|---|---|---|
| `child_process_require` | `require('child_process')` | Prozessstart jeder Art |
| `child_process_call` | `execSync(`, `spawn(`, `exec(`, `fork(`, `execFile(` | Prozessstart jeder Art |
| `vm_require` | `require('vm')`, `worker_threads`, `inspector` | Fremdcode jenseits der Prüfung |
| `eval` | `eval(`, `new Function(` | umgeht die statische Prüfung |
| `network_require` | `require('http'/'https'/'net'/'tls'/'dgram'/'dns')` | eigene Sockets sind tabu |
| `network_call` | `http.request(`, `fetch(`, `new WebSocket(`, `axios` | eigene Netzaufrufe sind tabu |
| `fs_write` | `writeFileSync`, `appendFileSync`, `unlinkSync`, `rmSync`, `mkdirSync`, `createWriteStream`, … | Schreibzugriff auf das Dateisystem |
| `fs_write_handle` | `fs.promises.writeFile/appendFile/rm/…` | Schreibzugriff auf das Dateisystem |
| `secrets_env` | `process.env` | dort liegen Geheimnisse |
| `secrets_file` | `.env`, `secrets.json`, `id_rsa`, `BEGIN PRIVATE KEY` | Schlüssel- und Geheimdateien |
| `escape_require` | `require('../…')` | ein Modul lädt nur eigene Dateien |
| `absolute_require` | `require('/…')` | absolute Pfade beim Laden |
| `host_internals` | `require('…backend/src/lib/…')` | interne AURA-Bibliotheken sind gesperrt |
| `process_lowlevel` | `process.binding(`, `process.dlopen(` | niedrige Prozess-Eingriffe |

## A7. Import: Prüfprotokoll

`POST /api/modulehub/import` (Admin-Token nötig) nimmt ein Paket an und antwortet immer mit
`{ checks[], ok, reason }` — ehrlich, mit Gründen. HTTP 200 bei `ok:true`, **422** bei `ok:false`.

| Prüfung | Was sie misst |
|---|---|
| `paket` | Paket angenommen (ZIP/Basis64), Größen- und Pfadgrenzen, Prüfsummen je Eintrag |
| `manifest` | Manifest gegen Schnittstelle v2 (inkl. `routes[]`, `permissions[]`, `selftest`) |
| `einstieg` | `entry` und `selftest.entry` vorhanden und im Modulordner |
| `quarantaene` | sauber entpackt unter `backend/src/data/modulehub-quarantine/` (Runtime, nie im Git) |
| `syntax` | `node --check` für jede JavaScript-Datei |
| `verbote` | statischer Scan gegen A6 |
| `konflikt` | Modul-ID gegen Modulhub und Warteschlange (Kollision wird benannt, nicht verschwiegen) |
| `selftest` | A5 als Kindprozess mit 10 s und ohne Netz |

`ok` ist genau dann `true`, wenn **keine** Prüfung rot ist. Übersprungene Prüfungen zählen nicht als rot,
werden aber sichtbar ausgewiesen.

## A8. Lebenszyklus nach dem Import

```
import → [Prüfungen grün] → pending_approval → (dein Klick) approve → enable → ready
                          ↘ [eine Prüfung rot] → abgelehnt (bleibt in der Quarantäne, wird nie geladen)
```

| Status | Bedeutung |
|---|---|
| `pending_approval` | Prüfungen grün, wartet auf dich. Liegt in der Quarantäne, ist **nicht** geladen |
| `abgelehnt` | mindestens eine Prüfung rot. `reason` nennt die Gründe |
| nach `approve` | aus der Quarantäne nach `backend/modules/<id>` installiert, dann wie jedes Modul |

**Keine Auto-Freigabe, kein Auto-Laden.** Das einzige Tor ist das bestehende Approve-Gate:

```bash
curl -X POST localhost:8080/api/modulehub/<id>/approve \
  -H "x-aura-token: $AURA_ADMIN_TOKEN" -H 'content-type: application/json' -d '{"on":true}'
```

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/modulehub/import` | Spec, Grenzen, Erlaubnislisten, Verbotsliste, Zähler |
| POST | `/api/modulehub/import` | Paket prüfen (`{data}` Basis64-ZIP oder `{files:[…]}`) |
| GET | `/api/modulehub/imports` | Warteschlange mit Prüfprotokollen |
| POST | `/api/modulehub/imports/discard` | `{id}` — Import verwerfen |

Oberfläche: Abschnitt **„Dritt-Modul importieren“** auf `/containers` (Module Hub, Area 70).

## A9. Vollständiges Beispiel

`aura.module.json`:

```json
{
  "id": "wetter-kontext",
  "name": "Wetter-Kontext (Beispiel)",
  "version": "1.0.0",
  "description": "Zeigt die Schnittstelle v2: deklarierte Lese-Route, zwei Rechte und ein Selbsttest.",
  "author": "Du",
  "type": "module",
  "entry": "index.js",
  "permissions": ["log:write", "health:read"],
  "routes": [
    { "method": "GET", "path": "/api/health", "purpose": "Backend-Zustand für die eigene Health-Aussage" }
  ],
  "selftest": { "entry": "selftest.js", "timeout_ms": 5000 },
  "configSchema": {
    "ort": { "type": "string", "default": "Duisburg", "description": "Ortsname für die Ausgabe" }
  },
  "capabilities": [
    { "action": "zustand", "description": "Meldet den gemerkten Ort und den Health-Zähler.", "input": {} }
  ],
  "healthCheck": true,
  "timeoutMs": 5000
}
```

`index.js`:

```js
'use strict';
let bereit = false;

module.exports = {
  initialize(ctx) {
    bereit = true;
    if (ctx.log) ctx.log('INFO', 'wetter-kontext gestartet', { ort: ctx.config.ort });
  },
  execute(action, input, ctx) {
    if (action !== 'zustand') throw new Error('unbekannte Aktion: ' + action);
    const zaehler = ctx.health ? ctx.health() : null;
    return { ort: ctx.config.ort, bereiche: zaehler ? zaehler.counts.total : null };
  },
  healthCheck() { return bereit ? { status: 'ok' } : { status: 'fehler' }; },
  shutdown() { bereit = false; },
};
```

`selftest.js`:

```js
'use strict';
const modul = require('./index.js');
const ctx = { config: { ort: 'Testort' }, log() {}, health: () => ({ counts: { total: 3 } }) };
modul.initialize(ctx);
const out = modul.execute('zustand', {}, ctx);
const ok = out.ort === 'Testort' && out.bereiche === 3;
console.log(JSON.stringify({ ok, pruefungen: [{ name: 'zustand', ok }] }));
process.exit(ok ? 0 : 1);
```

Paket bauen und einliefern:

```bash
cd /tmp && mkdir -p wetter-kontext && cd wetter-kontext
# drei Dateien anlegen (oben), dann:
zip -r ../wetter-kontext.zip aura.module.json index.js selftest.js
curl -X POST localhost:8080/api/modulehub/import \
  -H "x-aura-token: $AURA_ADMIN_TOKEN" -H 'content-type: application/json' \
  -d "{\"name\":\"wetter-kontext\",\"data\":\"$(base64 -w0 ../wetter-kontext.zip)\"}"
```

Antwort (gekürzt):

```json
{
  "ok": true,
  "status": "pending_approval",
  "checks": [
    { "id": "paket", "status": "ok", "detail": "3 Datei(en) · 2 KiB entpackt" },
    { "id": "selftest", "status": "ok", "detail": "Selbsttest bestanden (Exit 0)" }
  ],
  "boundary": "Nur deine Freigabe zählt. Es wird nichts automatisch geladen oder gestartet."
}
```

Danach: `/containers` → Modulhub → **„✓ Freigeben“**. Fertig.

Mitgeliefertes, vollständiges Beispiel im Repo: `backend/modules/example-hello/`
(`aura.module.json`, `index.js`, `selftest.js`) — es erfüllt Schnittstelle v2 und Schnittstelle v1
gleichzeitig.

---

# Teil B — Schnittstelle v1 (eigene Module im Repo)

Gilt für Module, die du selbst als Ordner unter `backend/modules/` anlegst. Erzwingt der Code in
`backend/src/lib/module_manifest.js` und `backend/src/lib/module_loader.js`.

## B1. Ordnerlayout

```
backend/modules/
  mein-modul/
    aura.module.json   ← Manifest (Pflicht)
    index.js           ← Einstiegspunkt (Pfad steht im Feld entry)
```

- Ordner, deren Name mit `.` oder `_` beginnt, werden ignoriert.
- Der Modulordner ist die Grenze. Ein `entry` darf nicht aus ihm herausführen (`..`, absolute Pfade, Symlinks nach außen).
- Verzeichnis per Umgebungsvariable `AURA_MODULES_DIR` änderbar (z. B. für Tests).

## B2. Manifest `aura.module.json`

| Feld | Pflicht | Regel |
|---|---|---|
| `id` | ja | 2–41 Zeichen, Kleinbuchstaben, Ziffern, Bindestrich, beginnt mit Buchstabe. Eindeutig. Zweistellige Bereichsnummern sind verboten. |
| `name` | ja | 1–80 Zeichen |
| `version` | ja | semver `x.y.z` |
| `description` | ja | 1–500 Zeichen, Zweck des Moduls |
| `author` | ja | 1–80 Zeichen |
| `type` | ja | `module` · `integration` · `skill` · `workflow` |
| `entry` | ja | relativer Pfad zur Einstiegsdatei im Modulordner |
| `permissions` | ja | Liste aus der festen Rechteliste (B5). Leer ist erlaubt. |
| `configSchema` | nein | Objekt mit Konfigurationsfeldern (B6) |
| `capabilities` | ja | mindestens eine Fähigkeit (B4) |
| `dependencies` | nein | Liste aus `{ "id": "modul-id", "version": "^1.0.0" }` oder `{ "service": "registry" }` |
| `healthCheck` | nein | `true`, wenn das Modul `healthCheck()` implementiert |
| `timeoutMs` | nein | 100–60000, Standard 10000. Gilt für jede Aktion und für Start und Health. |
| `mode` | Integrationen | Pflicht und nur `live`. Simulation gibt es nicht. Integrationen brauchen `healthCheck: true`. |
| `routes` · `selftest` | empfohlen | Werden von der v1 nicht verlangt, machen das Modul aber importfähig (Teil A). |

Versionsbereiche: `*`, `1.2.3` (genau), `>=1.2.0`, `^1.0.0` (gleiche Hauptversion, mindestens).
Dienste für `dependencies.service`: `registry`, `audit`, `mcp`, `llm`.

## B3. Lebenszyklus und Vertrag

```
discover → validate → configure → approve → enable → initialize → ready → execute → shutdown
```

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

Die Einstiegsdatei exportiert ein Objekt; alle Methoden sind optional, fehlende werden durch einen
Adapter ersetzt:

```js
module.exports = {
  initialize(ctx) {},
  getCapabilities() { return [{ name: 'greet', description: '…' }]; },
  execute(action, input, ctx) { return { text: 'Hallo' }; },
  healthCheck() { return { status: 'ok' }; },
  shutdown() {},
};
```

**Adapter für bestehende Module:** Hat eine Datei nur ein Objekt `actions` mit Funktionen
(`{ actions: { ping: (input, ctx) => … } }`), wird sie als Legacy-Modul behandelt.
`execute` wird dann an `actions[action]` weitergeleitet.
Im Modulhub (Area 70) gilt zusätzlich: `capabilities[].name` wird wie `capabilities[].action` gelesen,
damit beide Fassungen dieselben Module beschreiben können.

## B4. Fähigkeiten (`capabilities`)

```json
{ "name": "greet", "description": "…", "permissions": ["audit:write"],
  "input": { "name": { "type": "string", "required": true } } }
```

- `name`: `a-z`, `0-9`, `_`, 2–41 Zeichen.
- `permissions`: muss eine Teilmenge der Modul-`permissions` sein. Sonst wird das Manifest abgelehnt.
- `input`: Felder mit `type` (`string` · `number` · `boolean`) und optional `required`.

## B5. Berechtigungen (v1)

| Recht | Gibt im Kontext frei |
|---|---|
| `registry:read` | `ctx.services.registry.counts()` |
| `audit:write` | `ctx.audit(event, detail)` (Eintrag im Audit-Protokoll) |
| `secrets:read` | `ctx.getSecret(key)` für Geheimnisse des Moduls — **nur für eigene Repo-Module, nie für Importe** |
| `mcp:invoke` | `ctx.services.mcp.invoke({ name, args })` (MCP-Ingestion, derzeit Stub) |
| `llm:route` | reserviert. Der Modell-Router ist noch nicht angebunden. |
| `network` | deklarativ. Die Laufzeit erzwingt keine Netzwerksperre (siehe B10). |

Standard: keine Rechte. Ändert sich das Manifest oder die Einstiegsdatei, ist die Freigabe ungültig.

## B6. Konfiguration (`configSchema`)

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

## B7. Kontext `ctx` (Auszug)

| Feld | Inhalt |
|---|---|
| `id`, `name`, `version` | Modul-Identität |
| `config` | nicht-geheime Konfiguration, eingefroren |
| `log(msg)` | Protokollzeile, sichtbar in der Konsole (max. 50) |
| `getSecret(key)` | nur mit `secrets:read` |
| `audit(event, detail)` | nur mit `audit:write` |
| `services.registry` | nur mit `registry:read` |
| `services.mcp` | nur mit `mcp:invoke` |

## B8. Management-API (v1)

Lesen ohne Token. Alles Schreibende braucht `x-aura-token` (Wert von `AURA_ADMIN_TOKEN`).

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

## B9. Integrationen: ehrlicher Status

| `connection` | Bedeutung |
|---|---|
| `nicht_verbunden` | Ein Geheimnis oder Pflichtfeld fehlt |
| `eingerichtet_nicht_erreichbar` | Health-Check ist fehlgeschlagen |
| `eingerichtet_ungeprueft` | Konfiguriert, aber noch kein erfolgreicher Health-Check |
| `verbunden_getestet` | `mode` ist `live`, Health-Check erfolgreich, Status `bereit` |

Ein registriertes Werkzeug zählt nie automatisch als funktionierende Integration.

## B10. Sicherheit und Grenzen (wichtig)

- **Kein Sandkasten.** Module laufen im selben Node-Prozess wie AURA. Die Rechteprüfung gilt für die
  Schnittstelle (`ctx`), nicht für Systemaufrufe. Deshalb: **Dritt-Module nur nach Prüfung freigeben.**
- Beim **Import** (Teil A) ist es anders: dort prüft AURA statisch und führt den Selbsttest in einem
  gesperrten Kindprozess aus. Das ist mehr Sicherheit, aber immer noch kein Betriebssystem-Sandkasten.
- **Timeouts** fangen nur asynchrone Hänger ab. Eine Endlosschleife ohne `await` blockiert den Prozess.
- **Quarantäne:** 3 Fehler in Folge stoppen das Modul. Der Server läuft weiter.
- **Audit:** Freigabe, Aktivierung, Deaktivierung, Konfiguration, Aktionen und Quarantäne landen im Audit-Protokoll.
- **Pfadschutz:** Jeder `entry` wird aufgelöst und muss innerhalb des Modulordners liegen.
- **Größenlimit:** Manifest höchstens 64 KB.
- **Keine automatische Ausführung unbekannter Module.** Neue Module bleiben gesperrt, bis ein Mensch freigibt.

Noch nicht gebaut: Prozess-Isolation (eigener Worker oder Container pro Modul), OS-Netzwerksperre,
Signaturprüfung von Modulpaketen, Update aus einem Paket-Repository.

## B11. Konfiguration

| Variable | Standard | Zweck |
|---|---|---|
| `AURA_MODULES_DIR` | `backend/modules` | Modulordner (v1-Loader; Modulhub nutzt `backend/modules`) |
| `AURA_MODULE_STATE_FILE` | `backend/data/module_state.json` | Freigaben und Aktivierung (Laufzeit) |
| `AURA_MODULE_CONFIG_FILE` | `backend/data/module_config.json` | nicht-geheime Konfiguration (Laufzeit) |
| `AURA_MODULE_QUARANTINE_DIR` | `backend/src/data/modulehub-quarantine` | Quarantäne des Imports (Laufzeit) |
| `AURA_MODULE_IMPORTS_FILE` | `backend/src/data/modulehub_imports.json` | Import-Warteschlange (Laufzeit) |
| `AURA_MOD_<ID>_<KEY>` | — | Geheimnisse je Modul |
| `AURA_ADMIN_TOKEN` | — | schreibende Routen |

## B12. Tests

- `node test/module_loader.test.js` — Erkennung, ungültige Manifeste, doppelte IDs, Abhängigkeiten,
  Versionskonflikte, Freigabe nur durch Mensch, Eingabeprüfung, Timeout, Quarantäne, Legacy-Adapter,
  Geheimnisse, Hash-Änderung, Pfadschutz.
- `node test/round10_suite.test.js` — Schnittstelle v2, Verbotsliste, ZIP-Werkzeug, Import-Schleuse
  (kaputtes Paket rot, Beispielmodul grün), Selbstbearbeitungs-Werkbank.
- `node test/validate.js` — Import über HTTP (kaputt → `ok:false`; `example-hello` → `ok:true`,
  `pending_approval`), `/selfwork`-Seite, Propose/Apply/Revert gegen ein lokales Modell.
