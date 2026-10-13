# AURA Central Module System (Area 70)

Unified interface for attaching future modules and integrations to AURA.
Manifest-based discovery, documented lifecycle, permission-gated context —
bridged into the EXISTING registry (`registry.js`), container isolation
(Area 67) and audit/log infrastructure. No parallel registration system.

## 1. Architecture

```
backend/modules/                 <- module directory (one subfolder per module)
  <modul>/aura.module.json       <- manifest (required)
  <modul>/<entry>.js             <- entry point (contract implementation)

backend/src/lib/module_system.js <- loader, lifecycle, permissions, context
backend/src/data/module_system.json <- persisted approvals/enabled/config (atomic writes)

Registry bridge:  registry.status() shows pkg modules (mode "pkg", area "pkg:<id>")
Execution:        POST /api/modulehub/<id>/execute (kill-switch aware)
Isolation:        timeouts on all hooks, error quarantine after 3 fails,
                  learning-core fingerprinting (Area 69) on failure
```

## 2. Manifest schema (`aura.module.json`)

| Feld           | Pflicht | Beschreibung |
|----------------|---------|--------------|
| `id`           | ja      | eindeutige ID, `^[a-z0-9][a-z0-9_-]{1,63}$` |
| `name`         | ja      | Anzeigename |
| `version`      | ja      | semver-artig, z. B. `1.0.0` |
| `description`  | ja      | Zweck des Moduls |
| `author`       | ja      | Urheber |
| `entry`        | ja      | relativer `.js`-Pfad OHNE `..` (Path-Traversal-Schutz) |
| `type`         | ja      | `module` \| `integration` \| `skill` \| `workflow` |
| `permissions`  | nein    | Array aus dem Rechte-Katalog (unten); Standard: leer (least privilege) |
| `configSchema` | nein    | `{feld: {type: string\|number\|boolean, def, label, min?, max?, required?}}` |
| `capabilities` | nein    | `[{action, description, input}]` — nur deklarierte Aktionen sind ausführbar |
| `dependencies` | nein    | Array von Modul-IDs; `aura-core` = Host-Anforderung |
| `healthCheck`  | nein    | Name der Health-Methode (Konvention: `healthCheck`) |

Validierung: Manifest-Fehler ⇒ Zustand `invalid` mit verständlicher Fehlerliste.
Doppelte IDs: das erste Verzeichnis gewinnt, Duplikate bleiben `invalid`.

## 3. Lifecycle

`discover → validate → configure → initialize → ready → execute → shutdown`

Zusätzliche Zustände: `needs_approval` (Drittanbieter-Freigabe fehlt),
`needs_config` (Pflicht-/ungültige Konfiguration), `error` (Quarantäne nach
3 Fehlern oder Init-Crash), `disabled` (manuell deaktiviert), `invalid`
(Manifest fehlerhaft), `absent` (von Platte verschwunden).

Persistiert werden Approval, Enabled-Flag und Config-Werte in
`backend/src/data/module_system.json` (atomar: tmp + rename).
Änderungen an der Konfiguration re-initialisieren das Modul kontrolliert
(shutdown → initialize).

## 4. Modul-Vertrag (Entry-Export)

```js
module.exports = {
  initialize(context) {},              // optional
  getCapabilities() {},                // optional (Manifest ist Quelle der Wahrheit)
  execute(action, input, context) {},  // erforderlich
  healthCheck(context) {},             // optional -> {ok:true}
  shutdown(context) {},                // optional
};
```

**Legacy-Adapter:** Bestehende AURA-Module der Form `{meta, actions:{...}}`
werden automatisch gewrappt (`execute(action,input)` dispatcht in
`actions[action]`). Bestehende Module verlieren dadurch nichts — die alte
Route `POST /api/modules/:area/action/:name` bleibt unverändert.

## 5. AURA-Kontext (permission-gated)

Der Kontext wird pro Aufruf gebaut und enthält NUR die im Manifest
deklarierten Rechte. **Secrets (API-Keys, Tokens) werden niemals
weitergegeben.**

| Recht            | Gewährt |
|------------------|---------|
| `log:write`      | `context.log(level, msg, detail)` → Self-Repair-Log |
| `audit:write`    | `context.audit(event, detail)` → dauerhafte Audit-Trail |
| `config:read`    | `context.config.get(key, fallback)` → globale Config |
| `events:pub`     | `context.events.emit(topic, payload)` |
| `events:sub`     | `context.events.on(topic, fn)` |
| `health:read`    | `context.health()` → Registry-Zähler + Uptime |
| `storage:kv`     | `context.store.get/set` → modulisolierte persistente KV-Daten |
| `skills:read`    | `context.skills()` → Skill-Liste |
| `schedule:read`  | `context.schedule()` → Schedule-Status |
| `ai:route`       | `context.routing()` → Routing-Status (nie Keys) |

## 6. API

| Route | Methode | Funktion |
|-------|---------|----------|
| `/api/modulehub` | GET | Gesamtstatus (Module, Zustände, Ledger, Katalog) |
| `/api/modulehub/catalog` | GET | Rechte-Katalog, Typen, Zustände, Vertrag |
| `/api/modulehub/scan` | POST | Modulverzeichnis neu einlesen |
| `/api/modulehub/:id/approve` | POST | `{on:true\|false}` — Freigabe erteilen/entziehen |
| `/api/modulehub/:id/enable` | POST | aktivieren (nur nach Approval) |
| `/api/modulehub/:id/disable` | POST | deaktivieren (shutdown wird aufgerufen) |
| `/api/modulehub/:id/config` | POST | `{values:{...}}` — schema-validiert |
| `/api/modulehub/:id/execute` | POST | `{action, input}` — Kill-Switch-geschützt |
| `/api/modulehub/:id/health` | GET | Health-Check des Moduls |

UI: Die zentrale Modulverwaltung ist in die bestehende Container-Konsole
integriert (`/containers`, Sektion „MODULE HUB“) — gleiche Bausteine,
gleiches Design, keine zweite Administrationsoberfläche.

## 7. Sicherheit

- **Least privilege:** Kontext enthält nur deklarierte Rechte; Standard leer.
- **Approval-Pflicht:** Ein gültiges Manifest macht ein Drittanbieter-Modul
  NICHT vertrauenswürdig. Vor der ersten Aktivierung ist eine explizite
  Freigabe erforderlich (`/approve`); Entzug deaktiviert das Modul sofort.
- **Schema-Validierung:** Manifest, Config und Fähigkeiten werden streng
  geprüft; undeklarierte Aktionen werden abgelehnt (404-artig).
- **Path-Traversal-Schutz:** `entry` darf weder absolut sein noch `..`
  enthalten; zusätzlich wird der normalisierte Pfad gegen das Modulverzeichnis geprüft.
- **Timeouts:** init 5 s · execute 10 s · health 5 s.
- **Fehlerbegrenzung:** 3 Execute-Fehler ⇒ Zustand `error` (Quarantäne),
  Fingerprint an die Lern-Kurve (Area 69), Audit-Eintrag; Re-Enable
  initialisiert neu und setzt den Fehlerzähler zurück.
- **Audit:** Approval/Enable/Disable/Config/Execute/Fehler werden geloggt
  (Self-Repair-Log + Audit-Trail) und im Lifecycle-Ledger angezeigt.
- **Kill-Switch:** Bei engaged Kill-Switch liefert `execute` 423.

### Dokumentierte Grenze (Ehrlichkeit)

Module laufen **im Serverprozess** (in-process). Echte OS-Level-Isolation
(eigener Prozess/Container je Modul) ist in dieser Umgebung nicht
implementiert; Schutz erfolgt über Timeouts, Fehler-Quarantäne,
Rechte-Gating und Approval. Für Module mit feindlichem Code muss vor
Produktivbetrieb eine Prozess-Sandbox ergänzt werden.

## 8. Integrationen (ehrliche Zustände)

Module vom Typ `integration` melden einen von fünf Zuständen — ein
registriertes Tool gilt NIE automatisch als funktionierende Verbindung:

| Zustand | Bedeutung |
|---------|-----------|
| `connected` | tatsächlich verbunden UND per Health-Check verifiziert |
| `configured-unreachable` | eingerichtet, aber nicht erreichbar |
| `config-required` | Konfiguration erforderlich |
| `not-connected` | nicht verbunden / deaktiviert |
| `simulation` | Demo-/Simulationsbetrieb (klar gekennzeichnet) |

Referenz: `backend/modules/echo-integration` (SIMULATION, bis ein echter
Adapter + Verbindungstest existiert).

## 9. Ein neues Modul hinzufügen (Walkthrough)

1. Verzeichnis anlegen: `backend/modules/mein-modul/`
2. `aura.module.json` nach Schema oben erstellen.
3. `index.js` mit dem Vertrag aus Abschnitt 4 implementieren.
4. In der UI (`/containers` → MODULE HUB) „Neu einlesen“ klicken —
   das Modul wird automatisch entdeckt. **Kein Eintrag in Quelldateien nötig.**
5. Freigeben (`✓ Freigeben`) → aktivieren → optional konfigurieren → Aktionen ausführen.

## 10. Beispielmodule

| Modul | Zeigt |
|-------|-------|
| `hello-tool` | vollen Vertrag, Config-Hot-Apply, `storage:kv`, Kontext-Health |
| `echo-integration` | ehrliche Integrations-Zustände inkl. SIMULATION |
| `crash-dummy` | Fehlerisolierung (`boom`), Timeout (`slow`), Kontroll-Aktion (`ok`) |
