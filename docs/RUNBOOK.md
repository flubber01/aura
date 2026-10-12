# AURA — OPERATIONS RUNBOOK

> Für den Fall der Fälle: klare Schritte, keine Improvisation. Alle Befehle
> gegen `http://localhost:8080` (oder euren Host). Jeder Schritt ist reversibel.

## 1. Triage in 30 Sekunden

```bash
curl -s localhost:8080/api/health          # lebt der Server?
curl -s localhost:8080/api/selfrepair      # Probleme? fehlgeschlagene Reparaturen?
curl -s "localhost:8080/api/logs?level=ERROR&n=50"   # was ist passiert?
```

| Befund | Weiter mit |
|---|---|
| health nicht erreichbar | §2 Server tot |
| `counters.problems` steigt | §3 Daten heilen |
| Modul liefert 429 | §4 Quarantäne |
| Aktionen liefern 423 | §5 Kill-Switch |
| fehlerhafte UI-Seite | §6 Seiten-Probe |

## 2. Server startet nicht / ist tot

1. `journalctl -u aura -n 50` bzw. `/var/log/aura-backend.log` lesen.
2. Häufigste Ursache: korrumpierte Daten-Datei. Boot ist seit safeLoad tolerant,
   aber für sauberen Start aus dem Vault restoren:
   ```bash
   curl -s localhost:8080/api/backups     # läuft er noch (anderer Port?)
   # andernfalls manuell: neuestes valides Snapshot aus backend/src/data/backups/
   cp backend/src/data/backups/teams.<TIMESTAMP>.json backend/data/teams.json
   ```
3. `systemctl restart aura` bzw. `node backend/server.js`.
4. Validieren: `node test/validate.js` → 73+ PASS erwartet.

## 3. Daten-Datei korrupt (Auto-Heal oder manuell)

**Automatisch:** Area 59 heilt Syntaxfehler in <2 s aus der letzten guten Kopie,
Area 66 heilt alle 20 s aus dem letzten **verifizierten** Vault-Snapshot.

**Manuell:**
```bash
curl -s localhost:8080/api/backups | jq '.backups[0:10]'          # validierte Liste
curl -s -X POST localhost:8080/api/backups/restore \
     -H 'content-type: application/json' -d '{"file":"teams.<TS>.json"}'
curl -s localhost:8080/api/watcher | jq '.events[-5:]'            # Heilung bestätigen
```

## 4. Modul in Quarantäne (429)

Der Container-Circuit-Breaker hat ein Modul isoliert, **damit der Rest weiterläuft**.

```bash
curl -s localhost:8080/api/containers | jq '.containers[]|select(.container!="healthy")'
```

- Nach `containers.cooldown_ms` (Default 60 s) probiert das System das Modul
  automatisch erneut (**Auto-Probe**) — meist ist nichts zu tun.
- Dauert die Quarantäne an: Fehler im Modul selbst suchen (`last_error` im Status,
  dazu `api/logs?level=ERROR`). Kein blindes Restarten.
- Drill zum Testen der Isolation: `POST /api/containers/drill {"area":"16"}`
  → Modul quarantined für 5 s → Aktion liefert 429 → danach Auto-Probe.

## 5. Kill-Switch (423 auf Aktionen)

Auto-engaged bei: uncaught Exception, unhandled Rejection, ≥ `kill.syntax_fail_threshold`
Syntax-Fails in `kill.window_min` (Default: 3 in 5 min).

```bash
curl -s localhost:8080/api/ops | jq '.kill_switch'                 # Grund lesen
# Ursache klären (Logs!), dann:
curl -s -X POST localhost:8080/api/kill -H 'content-type: application/json' \
     -d '{"arm":false,"reason":"Incident #… behoben"}'
```

Während engaged: Actions/Mail/Terminal → 423. Lesen/Status bleibt erlaubt.

## 6. Seite rendert nicht

Area 66 probt alle 15 Seiten-Renderer bei jedem Check:

```bash
curl -s localhost:8080/api/selfrepair | jq '.lastReport.pages_ok'   # 15/15 = gut
```

Bei `<15/15`: `lastReport` zeigt keine Details je Seite — lokal `node --check pages/<x>.js`
und zuletzt geänderte Seiten zuerst prüfen.

## 7. Repro-Check (eine Zeile Systembeweis)

```bash
curl -s localhost:8080/api/repro | jq
```

Liefert: Commit, Node-Version, Daten-Datei-Zustände, Seiten-Probe, Vault-Zähler,
quarantined-Container, Kill-Switch-Stand. Ideal als Anhang an jedes Incident-Ticket.

## 8. Eskalationspfad

1. Self-Repair heilt selbst (Daten, Logs, Rotation) → nur beobachten.
2. Quarantäne → abwarten der Auto-Probe, dann Fehleranalyse.
3. Kill-Switch → Ursache fixen, dann revive.
4. Server tot → §2; wenn Vault intakt: kein Datenverlust.

**Eherne Regel:** erst `api/repro` + `api/logs` sammeln, dann handeln.
