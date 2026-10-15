# AURA Backend — Architektur (Dispatcher-Refaktor)

Die Hauptdatei `backend/server.js` ist ein **reiner Dispatcher** (~115 Zeilen):
HTTP-Shell, Telemetrie (Area 65), Request-Logging (Area 66), Fehlerzaun mit
Lern-Kurven-Anbindung (Area 69), Kill-Switch-Wächter und Static-Fallback.
**Keine Route und keine Seitendarstellung mehr in der Hauptdatei.**

## Schichten

```
backend/
  server.js                    Dispatcher: lädt Route-Module, ruft sie auf
  src/
    dispatcher.js              lädt aktive Route-Module (api_core → api_areas → pages_routes)
    routes/
      api_core.js              Katalog-/Registry-APIs (health, modules, action-dispatch,
                               types, downloads, report, stream, repro, brain/master)
      api_areas.js             Area-APIs (61…70, ops/kill, hierarchy/vita, telegram/mail,
                               terminal, ignition, config-upload …)
      pages_routes.js          alle HTML-Seiten (hub, brain, master, jarvis, containers …)
    lib/
      datasets.js              gemeinsame Boot-Daten (modules/integrations/teams/yellowpages)
      types_catalog.js         ALL-TYPES-Katalog + Download-Artefakt-Renderer
      report.js                Report-Builder
      registry.js              zentrale Area-Registry (inkl. Area-70-Brücke, mode 'pkg')
      module_container.js      Area 67: Crash-Isolation/Circuit Breaker
      module_system.js         Area 70: Manifest-Loader/Lifecycle/Rechte (docs/MODULE_SYSTEM.md)
      …                        weitere Areas (self_repair, learning_core, config, …)
  pages/                       eine Datei pro HTML-Seite (hub.js, brain.js, master.js, …)
  modules/                     externe Module (Drop-in via aura.module.json, Area 70)
  data/                        Config-/Katalog-DBs (JSON, hot-reload + Self-Healing)
  src/data/                    Laufzeit-DBs (config.json, failures.json, snapshots, …)
```

## Request-Fluss

1. `server.js` nimmt den Request, misst Traffic (Area 65), loggt strukturiert (Area 66).
2. `dispatcher.dispatch(ctx)` ruft die Route-Module der Reihe nach auf;
   jedes Modul liefert `true`, sobald es geantwortet hat.
3. unbehandelt + `/api/*` → 404-JSON · unbehandelt + kein API → Static-Fallback.
4. Jeder Fehler läuft in den Lernkern (Area 69) und wird als HTTP-500 beantwortet,
   ohne den Server zu gefährden.

## Vertrag für neue Route-Module

```js
module.exports = {
  name: 'mein_modul',
  async handle(ctx) {           // ctx: {req, res, url, p, method, send, readBody, syntaxFail, ROOT, PUBLIC_DIR}
    const { p, res, send } = ctx;
    if (p === '/api/meins') return send(res, 200, 'application/json', '{"ok":true}'), true;
    return false;               // nicht zuständig → nächstes Modul
  },
};
```
Eintrag in `src/dispatcher.js → ROUTE_MODULES` genügt. Interne Area-Logik
gehört nach `src/lib/`, externe/zukünftige Erweiterungen als Manifest-Modul
nach `backend/modules/` (Area 70).

## Rückwärtskompatibilität

- Alle bestehenden Endpunkte, Statuscodes und Datenformate unverändert
  (bewiesen durch 108/108 Validierungs-Checks nach dem Refaktor).
- `POST /api/modules/:area/action/:name` läuft weiter über Area 67 (Container).
- Kill-Switch, Enforcements (403/423/429) und ehrliche Labels bleiben erhalten.
