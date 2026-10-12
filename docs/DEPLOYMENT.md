# AURA — DEPLOYMENT HANDBOOK (every aspect)

> Branch `arena/0ee9c54c-aura` · Node ≥ 22 · zero npm dependencies (built-ins only).
> Alles LIVE-gelabelt, was echt ist. SIM/Demo-Modi sind markiert. Keine Fake-Zahlen.

---

## 0. TL;DR — eine Zeile, ohne Schnickschnack

```bash
curl -fsSL https://raw.githubusercontent.com/flubber01/aura/arena/0ee9c54c-aura/deploy/master-install.sh | bash
```

Startet Backend + UI auf **:8080**. Danach: `/hub` öffnen, `/cluster` für den 4-Server-Bind.

---

## 1. Voraussetzungen

| Bedarf | Minimum | Empfehlung |
|---|---|---|
| OS | Debian 11+, Ubuntu 22.04+ | Debian 12 |
| Node.js | 22.x | 22 LTS |
| RAM | 512 MB | 2 GB |
| Disk | 200 MB | 2 GB (Backups/Logs) |
| Netzwerk | ausgehend HTTPS | ausgehend HTTPS (GitHub-API für Deep Research) |
| npm-Dependencies | **keine** | — |

AURA braucht **keine Datenbank**: alle Zustände liegen in JSON-Dateien
(`backend/data/` = Konfig-DBs, `backend/src/data/` = Laufzeit: Store, Checkpoints,
Feedback, Schedule, Log-Vault). Das macht Deploy, Backup und Restore trivial.

---

## 2. Deployment-Varianten

### 2.1 Bare Metal / VPS (empfohlener Start)

```bash
git clone https://github.com/flubber01/aura.git && cd aura
git checkout arena/0ee9c54c-aura
node backend/server.js          # oder: PORT=9000 node backend/server.js
```

Produktion → systemd (siehe 2.2).

### 2.2 systemd-Unit (autostart + crash-restart, gehärtet)

Fertige gehärtete Unit liegt im Repo: **`deploy/aura.service`** (NoNewPrivileges,
ProtectSystem=strict, MemoryDenyWriteExecute, RestrictAddressFamilies auf
IPv4/IPv6/Unix, MemoryMax 1G, WriteAccess nur auf `backend/src/data`).
Env-Werte kommen aus **`deploy/.env.example`** → nach `deploy/.env` kopieren.

```bash
sudo cp deploy/aura.service /etc/systemd/system/aura.service
sudo cp deploy/.env.example /opt/aura/deploy/.env   # Keys eintragen
```

Minimal-Variante ohne Hardening:

```ini
[Unit]
Description=AURA Agent Command Center
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=aura
WorkingDirectory=/opt/aura
ExecStart=/usr/bin/node backend/server.js
Restart=always
RestartSec=3
Environment=PORT=8080
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -s /usr/sbin/nologin aura
sudo chown -R aura:aura /opt/aura
sudo systemctl daemon-reload && sudo systemctl enable --now aura
journalctl -u aura -f            # Live-Logs
```

AURA ergänzt das intern: der Self-Repair-Daemon (Area 66) loggt zusätzlich
strukturiert nach `backend/src/data/aura.log.jsonl` (Rotation ab 2 MB, Keep 3).

### 2.3 Docker

```bash
docker compose -f deploy/docker-compose.yml up -d
```

`deploy/docker-compose.yml` bindet `8080:8080` und mountet die Daten-Verzeichnisse
als Volumes (`./backend/data`, `./backend/src/data`) — damit überleben Backups,
Logs und Konfig-DBs Container-Neustarts.

### 2.4 Kubernetes / k3s (4-Server-Collective)

```bash
kubectl apply -f deploy/k8s.yml
```

Das Manifest definiert Deployment (1 Replikat empfohlen — Single-Writer auf die
JSON-DBs), Service auf 8080 und Health-Probes:

- **liveness**: `GET /api/health` (muss `status:"ok"` liefern)
- **readiness**: `GET /api/health`

Für den vollen 4-Server-Bind (k3s + Ansible-Kit) → UI `/cluster`: IPs eintragen,
1-Click-Kit generieren. **Regeln des Kits:** nur eigene/autorisierte Hardware,
SSH-Key-only, Control-Plane nie öffentlich.

### 2.5 Firebase Hosting (nur statische UI-Extrakte)

```bash
firebase deploy --only hosting
```

Hinweis: Firebase hostet nur die statische Frontend-Extraktion (`extracted/...`).
Die API (`/api/*`) läuft auf dem Backend — für Vollbetrieb Reverse-Proxy nutzen (2.6).

### 2.6 Reverse Proxy (nginx/Caddy) + HTTPS

Caddy (auto-TLS):

```
aura.example.org {
    reverse_proxy 127.0.0.1:8080
}
```

nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name aura.example.org;
    # ssl_certificate ...;
    location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; }
    location /api/terminal { deny all; }   # Terminal nie exponieren
}
```

**Terminal-Endpoints niemals öffentlich exponieren** (`/terminal`, `/api/terminal`).

---

## 3. Umgebungsvariablen

| Variable | Default | Wirkung |
|---|---|---|
| `PORT` | `8080` | HTTP-Port |
| `OPENROUTER_API_KEY` | — | aktiviert die OpenRouter-Cloud-Lane in OmniRoute (sonst nur lokale Lanes) |
| `TELEGRAM_BOT_TOKEN` | — | Telegram-Poller LIVE statt NOT-CONNECTED |
| `NODE_ENV` | — | `production` empfohlen für systemd |

Budget-Caps der Cloud-Lane: `omniroute` blockt ab `budget.spent_eur ≥ monthly_cap_eur`
(Default 20 €). Data-private Tasks routen immer local-first — unabhängig vom Key.

---

## 4. Daten-Layout (Backup-Relevanz)

```
backend/data/            # Konfig-DBs (watcher-überwacht, auto-heal)
  yellowpages.json  teams.json  departments.json
  skills.json  hierarchy.json  modules.json
backend/src/data/        # Laufzeit
  store.json  feedback.json  schedule.json  vita.json
  checkpoints/  autosave/
  backups/               # Area-64 Vault (verifizierte Snapshots, Keep 25/Datei)
  aura.log.jsonl(.1-3)   # Area-66 Logs (rotierend)
  workflows.json         # Area-61 Custom Workflows
```

**Backup-Strategie (eingebaut):**
1. Area 24 (chrono) + OPS-Scheduler: 12h Super-Brain, 4h andere DBs, 24h Full-Sync.
2. Area 59 (txt-watcher): überwacht **9 Dateien** (5 Konfig- + 4 Laufzeit-DBs);
   jede validierte Änderung → sofortiger Vault-Snapshot; Syntaxfehler → Rollback
   auf letzte gute Kopie (Laufzeit-DBs im Quiet-Mode gegen Audit-Loops).
3. Area 64: `GET /api/backups` (Liste + Verifikation), `POST /api/backups/restore {file}`.
4. Area 66: prüft alle 20 s alle 9 DBs + 15 Seiten-Render-Probes; kaputte Datei
   → Auto-Restore aus letztem verifiziertem Vault-Snapshot.

**Restore-Runbook:**
```bash
curl -s localhost:8080/api/backups | jq '.backups[0:5]'          # neueste valide finden
curl -s -X POST localhost:8080/api/backups/restore \
     -H 'content-type: application/json' -d '{"file":"teams.2026-10-10T15-32-34-128Z.json"}'
```

---

## 5. Health, Monitoring, Observability

| Zweck | Endpoint |
|---|---|
| Liveness/Readiness | `GET /api/health` |
| Self-Repair-Status | `GET /api/selfrepair` |
| Sofort-Check auslösen | `POST /api/selfrepair/run` |
| Log-Tail (JSON) | `GET /api/logs?n=200&level=ERROR` |
| Traffic-Telemetrie | `GET /api/traffic` |
| Watcher-Events | `GET /api/watcher` |
| Kill-Switch-Status | `GET /api/ops` (`kill_switch`) |
| Master-Dashboard | `/ignition` (pollt selbst alle 5 s) |
| Log-Konsole UI | `/logs` |

Alerting-Basis (externes Monitoring, z. B. Uptime-Kuma/Prometheus blackbox):
- `/api/health` ≠ 200 → Seite down.
- `GET /api/selfrepair` → `counters.failed > 0` oder `counters.problems` steigend.
- `GET /api/logs?level=ERROR&n=50` → Error-Sturm-Regel (intern ab 10/5min geloggt).

**Kill-Switch-Operatik:** auto-engaged bei uncaught Exceptions, unhandled Rejections,
3 Syntax-Fails in 5 min. Manuell: `/ops` (KILL/REVIVE) oder `POST /api/kill`.
Während engaged: Actions/Mail/Terminal liefern **423**.

---

## 6. Updates & Rollback

```bash
cd /opt/aura && git fetch origin && git checkout <commit>   # pinnen = Rollback
sudo systemctl restart aura
```

- Vor Update: `curl -s localhost:8080/api/backups` prüfen (Vault gefüllt?).
- Rollback = altes Commit auschecken; Daten-Dateien bleiben (liegen außerhalb von Code-Änderungen, Vault hat Historie).
- Nach Update: `node test/validate.js` laufen lassen (vollständiger Validierungs-Sweep über alle Pages/APIs/Daten).

---

## 7. Security-Hardening-Checkliste

- [ ] Backend nur über Reverse-Proxy mit TLS exponieren
- [ ] `/terminal`, `/api/terminal` auf Netzwerkebene blockieren (nginx `deny all` / Firewall)
- [ ] systemd-User ohne Root, `NoNewPrivileges=true` optional ergänzen
- [ ] SSH-Key-only für alle Server des Collectives; Control-Plane nie öffentlich
- [ ] API-Keys nur via Secret-Store/Env, nie in Dateien im Repo
- [ ] Kill-Switch testen (`POST /api/kill {"arm":true}` → 423 prüfen → revive)
- [ ] Backups extern spiegeln (Vault-Ordner per rsync/restic)
- [ ] Ausgehende Verbindungen auf benötigte Hosts begrenzen (GitHub-API, OpenRouter optional)

**Eingebaute Grenzen (hart, nicht konfigurierbar):** keine synthetischen
Engagement-Pfade, keine Ban-Evasion, keine Fake-Identitäts-Daten mit echten
Telefon-/IMEI-/Biometrie-Werten, keine CAPTCHA-Bypasses, keine Mining-/Faucet-
Module (Areas liefern 403).

---

## 8. Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| `EADDRINUSE` beim Start | Port belegt | `kill $(fuser 8080/tcp)` oder `PORT=9000` |
| Boot-Crash an JSON-Datei | korrumpierte Konfig-DB | Datei aus Vault restoren (Abs. 4) — Boot ist seit safeLoad tolerant |
| Deep Research leer | kein ausgehendes HTTPS / TLS-Proxy | `ca-certificates` aktuell? Sandbox-Umgebungen: System-CA-Bundle wird automatisch genutzt |
| Cloud-Lane inaktiv | Key fehlt oder Budget-Cap erreicht | `OPENROUTER_API_KEY` setzen / Cap in omniroute anpassen |
| Telegram NOT-CONNECTED | Token fehlt | `TELEGRAM_BOT_TOKEN` setzen, dann LIVE |
| 423 auf Aktionen | Kill-Switch engaged | `/api/ops` prüfen → REVIVE |

---

## 9. Validierung nach jedem Deploy

```bash
node test/validate.js     # AURA_URL=http://host:8080 node test/validate.js
```

Prüft: 21+ Pages (200 + HTML), ~40 APIs (Status + JSON-Validität + Shape-Checks),
alle Konfig-DBs parse-bar, Container-Drill + Auto-Recovery, Config-CRUD.
Exit-Code 0 = deployfähig.

---

## 10. Crash-Isolation (Modul-Container, Area 67)

Jeder `POST /api/modules/:area/action/:name` läuft in einem eigenen Container:
**Timeout-Guard** (hängt eine Action, wird sie nach `containers.timeout_ms` abgebrochen),
**Circuit Breaker** (`containers.max_fails` Fehler in Folge) und **Quarantäne**
(Modul liefert 429, der Server und alle anderen Module laufen weiter). Nach
`containers.cooldown_ms` prüft das System das Modul automatisch erneut (Auto-Probe).
Ein abstürzendes Modul kann den Prozess nie mitreißen. UI: `/containers`.

## 11. Konfiguration & 1-Klick-Repro

- **Konfiguration:** `/config` bzw. `docs/CONFIGURATION.md` — Budget-Caps, Kill-Switch-
  Schwellen, Watcher-/Self-Repair-/Container-Parameter, hot-reloaded.
- **1-Klick-Repro:** `bash deploy/repro-check.sh` beweist Syntax + Voll-Sweep +
  Repro-Report in einem Rutsch. `GET /api/repro` liefert den Systembeweis als JSON.

---

_Stand: Area-66/67/68-Batch · alle Angaben entsprechen dem tatsächlichen Code-Verhalten._
