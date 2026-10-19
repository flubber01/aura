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

## 9. Admin-Token im Browser war gestern — Anmeldung per E-Mail+Passwort

Der Betreiber meldet sich auf `/login` mit E-Mail + Passwort an (HTML-Formular,
funktioniert auch ohne JavaScript). Gültige Sitzung = Admin-Rechte für alle
Routen, die früher `x-aura-token` verlangten — `/board`, `/upload` & Co. fragen
den Token nicht mehr ab, solange das Sitzungs-Cookie gilt.

```bash
# Owner einrichten (einmalig, per Terminal — Datei wird nie committet):
node backend/src/scripts/create-owner.js

# Owner-Datensatz prüfen (Pfad per AURA_AUTH_FILE umlenkbar):
cat backend/src/data/auth_owner.json        # nur E-Mail + scrypt-Hash, chmod 600

# Anmeldung händisch testen (ohne Browser):
curl -i -X POST http://127.0.0.1:8080/api/auth/login-form \
  -d 'email=DIR@EXAMPLE.DE&password=DEIN_PASSWORT&next=/hub'   # 302 + Set-Cookie
curl -i -X POST http://127.0.0.1:8080/api/auth/login-form \
  -d 'email=DIR@EXAMPLE.DE&password=FALSCH&next=/hub'          # 401, KEIN Cookie
```

- **Sitzungen sind prozess-lokal** (12 h): nach Server-Neustart neu anmelden.
- Der Admin-Token (`x-aura-token`, `AURA_ADMIN_TOKEN`) bleibt der Notfallweg für
  CLI/validate (`AURA_VALIDATE_TOKEN`) — nicht mehr der Alltag im Browser.
- **AURA_AUTH_REQUIRED=true** (Vollsperrung aller Seiten) bleibt Standard-AUS und
  kommt erst NACH dem HTTPS-Dach: TLS-Reverse-Proxy → Owner-Login prüfen → dann
  die Vollsperrung setzen.

## 10. Modell fehlt in der Liste

Auf `/jarvis` (und `/selfwork`) erscheint jedes lokale Modell aus Ollama
`/api/tags` — ohne Filter, ohne Qualitäts-Schranken. Embedding-Modelle bleiben
sichtbar und sind markiert („Embedding — für Chat ungeeignet").

```bash
ollama list                 # was Ollama wirklich hat
curl -s http://127.0.0.1:11434/api/tags   # dieselbe Liste roh
```

1. Modell in `ollama list`, aber nicht im Dropdown? → **Seite neu laden** (die
   Liste wird zum Seitenaufruf und bei jedem JS-Refresh frisch vom Server geholt).
2. Modell fehlt auch in `ollama list`? → `ollama pull <modell>` auf dem Host,
   dann Seite neu laden.
3. Standard ist `OLLAMA_MODEL` (auf dem VPS: `phi3:mini` · Standard) — als
   „· Standard" in der Liste gekennzeichnet, nie still vorausgewählt.

**Eherne Regel:** erst `api/repro` + `api/logs` sammeln, dann handeln.
