# AURA · Gesamtaudit, Konfiguration und Installation

Stand: 2026-10-13 · Branch `arena/3b63f072-aura` · letzter Commit `45baa96`
Noch **nicht** in `main`. Merge nur nach ausdrücklicher Freigabe („merge trotz offener Punkte“).

Dieses Dokument fasst zusammen, was da ist, wie man es installiert, konfiguriert und prüft, und was **nicht** gebaut oder **nicht** getestet ist. Es ersetzt keine der Detaildokumente, verlinkt aber alle.

---

## 1. Zweck (Use Case)

AURA ist eine lokale Kommandozentrale für KI-Agenten und Automatisierung:
- **Steuern:** Schalter pro Aktion, Freigaben für riskante Schritte, Kill-Switch, Telegram-Befehle.
- **Planen und koordinieren:** Agent Board (Kanban mit Freigabe-Toren), Hierarchie, Zeitplan.
- **Sprechen:** JARVIS-Konsole mit Mikrofon (Browser-Spracherkennung), optional Ollama für freie Antworten.
- **Inhalte vorbereiten (Phase 2):** Repurposing, Traffic-Mesh, Label-Pipeline, Analytics. Veröffentlichung immer nur mit menschlicher Freigabe.
- **Daten pflegen:** geprüfter Upload für Link-Listen (Yellow Pages, API-Katalog) und Skill-Katalog (nur Metadaten).

**Harte Grenzen (gelten überall):** keine Credential-Ernte, keine Umgehung von CAPTCHA, Cloudflare oder Plattformschutz, kein Fremd-Mining, keine gekauften Follower, keine Fake-Views, keine heimlichen Mehrfachkonten, keine Identitätsfälschung. Veröffentlichung nur über offizielle APIs auf eigenen Konten, mit Admin-Freigabe.

---

## 2. Ebenen (Benennung)

Vom Nutzer festgelegt:

| Ebene | Bezeichnung | Rolle |
|---|---|---|
| 0 | **Du** | oberste Instanz, entscheidet über alles Riskante |
| 1 | **Super Ultra Master Brain** | oberster KI-Platz unter dir |
| 2 | **Ultra Master Brain** | Ebene darunter |
| 3 | **Department Chief / Head** | leitet eine Abteilung |
| 4 | **Minions / Worker** | führen einzelne Aufgaben aus |

Beförderung eines Modells auf eine höhere Ebene: nur nach gemessener Leistung in Logik und Arbeit, und nur mit deiner Bestätigung.

**Stand im Code:** Die Begriffe im Code und in der Doku heißen noch anders (ULTRA / SUPER / T2 / T3 in `hierarchy.js`, `hierarchy.json`, `README.md`). Die Umbenennung ist **offen**.

---

## 3. Architektur

- **Ein Node-Server** (`backend/server.js`), Port 8080 (Standard), bindet an `0.0.0.0`.
- **Libs** in `backend/src/lib/`: Steuerzentrale, Upload, Skill-Katalog, Agent Board, JARVIS, Ollama-Adapter, Autonomie-Schleife, Growth-Module, Telegram-Poller (separater Prozess), u. a.
- **Seiten** in `backend/pages/`: je eine Datei pro Seite.
- **Daten** in `backend/src/data/` (Laufzeit, Teile gitignoriert) und `backend/data/` (Katalog und Stammdaten, getrackt).
- **Keine Datenbank.** Speicher sind JSON-Dateien.

---

## 4. Installation

### 4.1 Voraussetzungen
- Linux (Debian/Ubuntu getestet im Skript, sonst sinngemäß)
- **Node.js ≥ 22** (im Repo getestet mit v22)
- git, curl
- Port 8080 frei
- Optional: Ollama (lokal oder im Netz), Telegram-Bot-Token, Vision-Modell

### 4.2 Lokal starten (empfohlen für Test)
```bash
git clone https://github.com/flubber01/aura.git
cd aura
git checkout arena/3b63f072-aura
node backend/server.js
# Browser: http://<host>:8080/hub
```

### 4.3 Docker
`deploy/docker-compose.yml`, Start über `deploy/start_swarm.sh up|down|status` (Web :8080, Backend :8090, Healthchecks, read-only).

### 4.4 systemd
`deploy/aura.service` als Vorlage. Umgebungsvariablen dort setzen, nicht im Code.

### 4.5 Ein-Klick-Installation
`deploy/master-install.sh` (Debian/Ubuntu, nur eigene Hardware).

> **Achtung:** Das Skript nimmt standardmäßig den Branch `arena/0ee9c54c-aura`, nicht `arena/3b63f072-aura`. Vor dem Lauf setzen:
> `AURA_BRANCH=arena/3b63f072-aura bash deploy/master-install.sh`
> Das Skript startet den Server mit `nohup`, Log in `/var/log/aura-backend.log`. Health-Check über `/api/health`. Mit `RUN_VALIDATE=0` lässt sich die Prüfung überspringen.

### 4.6 Kubernetes
`deploy/k8s.yml` (Vorlage, nicht im Sandbox-Test geprüft).

### 4.7 Telegram-Poller
Läuft **außerhalb** der Sandbox, braucht Internet zu `api.telegram.org`:
```bash
TELEGRAM_BOT_TOKEN=… TELEGRAM_ALLOWED_CHATS=<deine Chat-ID> AURA_URL=http://<server>:8080 \
  node backend/src/lib/telegram_poller.js
```

### 4.7b Android über Termux
Anleitung: [`docs/TERMUX.md`](TERMUX.md). Installation mit `bash deploy/termux/install.sh` (Node 22+, Port 8080). Autostart über Termux:Boot mit `deploy/termux/boot.sh`. Auf echtem Handy noch nicht getestet.

### 4.8 Cluster (4 Root-Server)
`/cluster`: IPs und Rollen eingeben, Kit herunterladen, `ansible-playbook -i hosts.ini playbook.yml`. Nicht in dieser Sandbox geprüft.

---

## 5. Konfiguration

### 5.1 Umgebungsvariablen

| Variable | Pflicht | Zweck | Standard |
|---|---|---|---|
| `PORT` | nein | HTTP-Port des Servers | 8080 |
| `AURA_ADMIN_TOKEN` | empfohlen | Schreibzugriff auf Board, Upload, Steuerzentrale. Header `x-aura-token` | leer (kein Schutz!) |
| `AURA_AUTONOMY_AUTO` | nein | `1` = Autonomie-Schleife heilt selbst. Sonst nur Vorschläge | aus |
| `AURA_SCHED_DEMO` | nein | Demo-Modus: Stunden werden zu Sekunden im Zeitplan | aus |
| `AURA_CONTROL_FILE` | nein | Pfad der Steuerzentrale-Datei (für Tests) | `backend/src/data/control.json` |
| `OLLAMA_URL` | nein | Ollama-Endpunkt für JARVIS-Freitext. Ohne Wert: aus | leer |
| `OLLAMA_MODEL` | nein | Modellname bei Ollama | `llama3.2` |
| `OLLAMA_TIMEOUT_MS` | nein | Zeitlimit je Anfrage | siehe Code |
| `OPENROUTER_API_KEY` | nein | Cloud-Endpunkt für den API-Failover (`backend/src/lib/api_failover.js`). Ohne Schlüssel wird er übersprungen. | leer |
| `OPENROUTER_BASE_URL` | nein | Basis-URL, nur https (http nur localhost) | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | nein | Modell für OpenRouter | `openrouter/auto` |
| `AURA_LLM_CHAIN` | nein | Reihenfolge der Endpunkte, z. B. `ollama,openrouter` | `ollama,openrouter` |
| `AURA_LLM_COOLDOWN_MS` | nein | Abklingzeit nach Fehler (verdoppelt sich, max. 10 min) | `60000` |
| `AURA_ESCALATION_TIMEOUT_MS` | nein | Frist, bis der Mensch bei kritischen Ereignissen bestätigt (min. 60 s) | `900000` (15 min) |
| `EMERGENCY_TELEGRAM_CHAT` | nein | Chat-ID für Notfall-Nachrichten über Telegram (braucht `TELEGRAM_BOT_TOKEN`) | leer |
| `TWILIO_ACCOUNT_SID` | nein | Twilio-Konto für Notfall-SMS und Anruf | leer |
| `TWILIO_AUTH_TOKEN` | nein | Twilio-Token (nur Umgebungsvariable, nie in Dateien) | leer |
| `TWILIO_FROM` | nein | Absendernummer im E.164-Format, z. B. `+4921100000` | leer |
| `EMERGENCY_PHONE` | nein | Deine Nummer für SMS (E.164, z. B. `+49…`) | leer |
| `EMERGENCY_PHONE_CALL` | nein | Nummer für Anruf, falls abweichend | wie `EMERGENCY_PHONE` |
| `TELEGRAM_BOT_TOKEN` | für Telegram | Bot-Token, nur im Secret-Manager | leer |
| `TELEGRAM_ALLOWED_CHATS` | für Telegram | Kommagetrennte Chat-IDs, nur diese dürfen Befehle geben | leer = **keine** Sperre |
| `AURA_URL` | für Telegram | Adresse des AURA-Servers aus Sicht des Pollers | `http://localhost:8080` |

> `TELEGRAM_ALLOWED_CHATS` leer heißt: der Poller startet mit der Warnung „NONE“. Das muss im Betrieb gesetzt sein.

### 5.2 Konfigurationsdatei (`backend/src/data/config.json`, über `/config`)

| Schlüssel | Typ | Standard | Bereich | Bedeutung |
|---|---|---|---|---|
| `system.name` | Text | AURA Agent Command Center | – | Anzeigename |
| `budget.monthly_cap_eur` | Zahl | 20 | 0–500 | Monatslimit für Cloud-Routing (EUR) |
| `kill.syntax_fail_threshold` | Zahl | 3 | 1–20 | Syntaxfehler bis Kill-Switch |
| `kill.window_min` | Zahl | 5 | 1–60 | Zeitfenster in Minuten |
| `watcher.interval_ms` | Zahl | 1500 | 300–30000 | Hot-Reload-Intervall |
| `self_repair.interval_ms` | Zahl | 20000 | 5000–600000 | Selbstprüfung |
| `containers.max_fails` | Zahl | 3 | 1–10 | Fehler bis Quarantäne |
| `containers.cooldown_ms` | Zahl | 60000 | 1000–3600000 | Quarantäne-Wartezeit |
| `containers.timeout_ms` | Zahl | 15000 | 500–120000 | Zeitlimit je Aktion |

Überschreibbar per Umgebung: `PORT`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`.
Das Schema kennt nur Zahlen und Texte. Schalter (Ja/Nein) laufen deshalb über Umgebungsvariablen oder die Steuerzentrale.

### 5.3 Steuerzentrale (`/control`, Datei `backend/src/data/control.json`)
Schalter pro Aktion, Standardwerte im Abschnitt 6.

### 5.4 Katalog (`scripts/build_skill_catalog.js`)
Zwei Pfade als Argumente (lokale Klone). Erzeugt `backend/data/skill_catalog.json`.

---

## 6. Sicherheit und Freigaben

### 6.1 Schutzschichten
1. **Kill-Switch** (`/api/kill`): Status 423 für alle Schreibaktionen. Ausnahmen: Status und Bericht lesen. Auslösen (`arm:true`) ist immer erlaubt. Lösen (`arm:false`) braucht den Admin-Token, wenn `AURA_ADMIN_TOKEN` gesetzt ist. Über Telegram zusätzlich das Wort `CONFIRM`. Dieser Schutz kam im Audit dazu (vorher war Lösen ohne Token möglich).
2. **Admin-Token** (`AURA_ADMIN_TOKEN`): 401, wenn Header `x-aura-token` fehlt oder falsch ist. **Ohne Token ist jede Schreibaktion offen.** Vor dem Betrieb setzen.
3. **Steuerzentrale:** jede Aktion hat Schalter, Risiko und Freigabe-Pflicht.
4. **Freigaben:** nur Menschen (Namen mit `agent`, `bot`, `system`, `auto`, `daemon`, `validator` werden abgelehnt). Eine Freigabe lässt sich nur einmal entscheiden. Verfall nach 24 h. Höchstens 20 offene.
5. **Autonomie-Schleife:** ohne `AURA_AUTONOMY_AUTO=1` nur Vorschläge, keine automatischen Heilungen. Löschungen werden nie automatisch ausgeführt.

### 6.2 Steuerzentrale: Aktionen und Standardwerte

| Aktion | Risiko | Freigabe | Standard |
|---|---|---|---|
| Status lesen | niedrig | nein | an |
| Bericht lesen | niedrig | nein | an |
| Snapshot (Backup) | mittel | nein | an |
| Vollsync der Module | mittel | **ja** | an |
| Board-Aufgabe anlegen | mittel | nein | an |
| Link-Liste übernehmen (`/upload`) | hoch | **ja** | an |
| Veröffentlichung freigeben (Growth) | hoch | **ja** | an |
| Autonome Selbstheilung | hoch | **ja** | **aus** |
| Skill installieren | hoch | **ja** | **aus** |
| Kill-Switch auslösen | mittel | nein | an |
| Kill-Switch lösen | hoch | **ja** | an |

> Die Aktion `screen_look` (Bildschirm ansehen) ist **nicht** im Katalog. Siehe Abschnitt 10.

### 6.3 Upload-Regeln (`/upload`)
- Nur `https`-Links.
- Name 2–80 Zeichen, Beschreibung höchstens 300, Kategorie 1–40 (a–z, 0–9, `_ . -`).
- Höchstens 500 Einträge, höchstens 1 MB.
- Keine Dubletten.
- Verboten (Muster `FORBIDDEN` in `data_upload.js`): Captcha-Bypass, Faucets, Mining, Botnets, SOCKS-Ban-Umgehung, gekaufte Follower und Likes, SMM-Panels, Fake-Views, Token-Ernte, Credential-Dumps, Account-Farmen.
- Alles-oder-nichts: ein abgelehnter Eintrag stoppt die Übernahme.
- Backup vor jeder Übernahme in `backend/src/data/backups/`.

### 6.4 Skill-Katalog
- Nur Metadaten (Name, Kurzbeschreibung, Lizenz, Link). Kein Skill-Text wird kopiert.
- `installed: false` bei jedem Eintrag. Nichts wird installiert oder ausgeführt.
- Gesperrt: Zahlungs-Kategorie, Umgehung, Trading, OSINT, Credential-Sammlung, Bots, Mining, Checkout.
- Prüfen: Krypto und Wallets, Glücksspiel, Erwachsenen-Inhalte, Veröffentlichung/Deploy.

### 6.5 Telegram
- Nur Chats aus `TELEGRAM_ALLOWED_CHATS`.
- `/kill` schaltet den Kill-Switch. `/revive` braucht `CONFIRM`.
- Riskante Befehle nur über Freigabe. Web-only-Aktionen (Upload, Veröffentlichung, Selbstheilung, Skill-Installation, Board-Aufgabe) kann Telegram nicht ausführen.

### 6.6 Bekannte Schwächen der Sicherheit
- Ohne `AURA_ADMIN_TOKEN` ist der Schreibschutz aus.
- Das Board hat nur ein Token, **kein Nutzerkonto**. Wer das Token hat, handelt als Mensch. Namen werden nicht authentifiziert, nur auf Muster geprüft.
- Der Telegram-Poller läuft mit einem Token im Klartext in der Umgebung. Nur im Secret-Manager halten.

---

## 7. Schnittstellen

### 7.1 Seiten (GET)

| Pfad | Zweck |
|---|---|
| `/` | leitet auf `/hub` um |
| `/hub` | Startseite: Navigation, 3D-Gehirn, Serverwerte |
| `/master` | Master-HUD. Zwei Knöpfe: unten links „screens“ (18 Zweitbildschirme), unten rechts „3D ▶“ |
| `/brain` | 3D-Gehirn (5D-Layout) |
| `/board` | Agent Board (Kanban) |
| `/growth` | Phase 2: Repurposing, Mesh, Releases, Analytics |
| `/jarvis` | JARVIS-Konsole, Mikrofon, optional Ollama |
| `/upload` | Daten-Upload mit Vorschau |
| `/skills` | Skill-Katalog |
| `/control` | Steuerzentrale |
| `/hierarchy` | Hierarchie und Rollen |
| `/ops` | Kill-Switch, Backups, Telegram-Kit, Mail |
| `/console` | Konsole, 60 Bereiche |
| `/logs` | Logs |
| `/containers` | Container und Quarantäne |
| `/schedule` | Zeitplan |
| `/research` | Recherche |
| `/seo` | SEO |
| `/pipelines` | Pipelines |
| `/yellowpages` | Yellow Pages |
| `/config` | Konfiguration |
| `/deploy` | Modelle, Ollama, Modelfile |
| `/minibot` | Mini-Bot-Assistent |
| `/terminal` | Terminal (lesend) |
| `/builder` | Workflow-Builder |
| `/cluster` | 4-Root-Server-Kit |
| `/ignition` | Start-Ablauf |
| `/arcade` | Spielbereich |
| `/downloads` | Downloads |
| `/sitemap.xml`, `/robots.txt` | Standard |

### 7.2 API (Auswahl, vollständig im Code)

| Bereich | Routen |
|---|---|
| Gesundheit | `GET /api/health`, `GET /api/repro`, `GET /api/report`, `GET /api/master`, `GET /api/brain` |
| Config | `GET /api/config`, `GET /api/config/schema`, `POST /api/config`, `POST /api/config/reset`, `POST /api/config/upload` (Yellow Pages: 410) |
| Kill-Switch | `POST /api/kill` |
| Ops | `GET /api/ops`, `POST /api/ops/super`, `POST /api/ops/sync`, `POST /api/ops/others` |
| Backups | `GET /api/backups`, `POST /api/backups/restore` |
| Steuerzentrale | `GET /api/control`, `POST /api/control/action/<id>/enable\|disable`, `POST /api/control/run/<id>`, `POST /api/control/approvals/AP-…` |
| Board | `GET /api/board`, `POST /api/board/task`, `POST /api/board/<id>/<aktion>` (assign, start, request_help, handoff, submit, approve, reject) |
| Upload | `GET /api/upload/kinds`, `POST /api/upload/preview`, `POST /api/upload/commit` |
| Skills | `GET /api/skills` (alte Registry, 13 Einträge), `GET /api/skill-catalog?q=&source=&status=&category=&limit=` |
| JARVIS | `POST /api/jarvis`, `GET /api/jarvis/llm`, `GET /api/jarvis/memory` |
| LLM-Failover | `GET /api/llm/chain` (Status je Endpunkt, ohne Schlüssel). Tests: `node --test test/api_failover.test.js` |
| Studio | `GET /studio` (Seite), `GET /api/studio/groove?style=&bars=&swing=&humanize=&seed=`, `GET /api/studio/orchestrate?form=&bars=`, `GET /api/music/skills?q=`. Tests: `node --test test/music_studio.test.js` |
| Notfall-Kanäle | Nur für Eskalationen (`backend/src/lib/notify.js`). Telegram, SMS, Anruf je nach Konfiguration. Ohne Konfiguration kein Versand. Tests: `node --test test/notify.test.js` |
| Eskalation | `GET /api/escalations`, `POST /api/escalations/ESC-…/ack` (Token), `POST /api/escalations/raise` (Token, Art `kill_switch` oder `integrity_loss`). Frist ohne Bestätigung → eingefroren (Kill-Switch an, kein Lernen, keine Heilung). Nur der Mensch hebt auf (`revive` mit Token). Tests: `node --test test/escalation.test.js` |
| Growth | `GET/POST /api/growth/repurpose`, `GET/POST /api/growth/mesh`, `POST /api/growth/mesh/asset`, `GET/POST /api/growth/releases`, `POST /api/growth/releases/<id>/advance`, `GET /api/growth/analytics`, `POST /api/growth/analytics/import` |
| Hierarchie | `GET /api/hierarchy`, `GET /api/hierarchy/knowledge`, `GET /api/roles`, `GET /api/departments`, `GET /api/teams` |
| Zeitplan | `GET /api/schedule`, `POST /api/schedule/add`, `POST /api/schedule/remove`, `GET /api/schedule/recommend`, `GET /api/schedule/csv` |
| Lernen | `GET /api/learning`, `POST /api/learning/outcome`, `POST /api/learning/simulate` |
| Telegram | `GET /api/telegram/kit` |
| Mail | `GET /api/mail`, `POST /api/mail/compose`, `POST /api/mail/approve` |
| Sonstiges | `GET /api/yellowpages`, `POST /api/yellowpages/suggest`, `GET /api/workflows`, `GET /api/modules`, `GET /api/logs`, `GET /api/vita`, `GET /api/stream`, `GET /api/watcher` |

Sicherheitsstufen: Lesezugriffe sind offen. Schreibzugriffe brauchen Admin-Token (wenn gesetzt), und Kill-Switch sperrt sie.

---

## 8. Daten und Speicher

| Datei | Inhalt | Git |
|---|---|---|
| `backend/src/data/store.json`, `failures.json` | Laufzeit, von Tests verändert | getrackt, nach Tests zurücksetzen |
| `backend/src/data/growth.json` | Board- und Growth-Laufzeit | ignoriert |
| `backend/src/data/control.json` | Schalter und Freigaben | ignoriert |
| `backend/src/data/backups/` | Backups vor Upload-Übernahmen, Autosave | ignoriert (137+ Dateien, **keine Aufbewahrungsregel**) |
| `backend/src/data/config.json` | Konfiguration | getrackt |
| `backend/src/data/yellowpages.json` | 64 Links | getrackt |
| `backend/data/skill_catalog.json` | 232 Katalog-Einträge | getrackt |
| `backend/data/skills.json` | alte Skill-Registry, 13 Einträge | getrackt |
| `backend/data/growth_assets.json` | leer | getrackt |
| `ingest/apis.txt` | API-Katalog, 27 Zeilen | getrackt |
| `ingest/identities.txt` | 8 Zeilen | getrackt |

---

## 9. Modelle

### 9.1 Vorhanden
- **Ollama** (JARVIS-Freitext): Modell über `OLLAMA_MODEL` frei wählbar, solange es in Ollama vorhanden ist. Ohne `OLLAMA_URL` ist die Funktion aus. Fallback auf die Regel-Engine bei Fehlern. **Gegen einen echten Endpunkt nicht getestet**, nur gegen einen Dummy-Server (8 Tests).
- **OmniRoute** (Routing-Entscheidung): kennt die Lanes `unsloth_local`, `ollama_local`, `openrouter`. Die Auswahl wird protokolliert. **Ein echter Aufruf an OpenRouter oder einen anderen Cloud-Anbieter ist nicht gebaut.**

### 9.2 Nicht vorhanden
- **Modell-Registry** (`models.json`): nur freigegebene Modelle erreichbar, unbekannte werden abgelehnt. Vereinbart, **nicht gebaut**.
- **Adapter für Cloud-Anbieter** (z. B. Minimax, OpenAI, Anthropic): nicht gebaut. Pro Anbieter ein eigenes Modul, Schlüssel nur aus dem Secret-Manager.
- **Platzhalter mit Mindestgrößen** (Head, Abteilungschef, Minion) und **Beförderung** nach Leistungsmessung: nicht gebaut.
- **Chat mit Agenten/Abteilungschefs**: nicht gebaut. Vorhanden sind nur JARVIS und das Board.
- **Vision-Modell** für Bilder: nicht gebaut.

---

## 10. Funktionen, die **nicht** gebaut sind

| Thema | Stand |
|---|---|
| Bildschirm sehen („Augen“, Option 3) | **nicht gebaut.** Der letzte Anlauf hat nicht gegriffen. Vorgesehen wäre: Einzelaufnahme über den Browser-Dialog, Freigabe in der Steuerzentrale, Auswertung nur über lokales Vision-Modell, keine Speicherung |
| Hermes-Tools (276 Module) | nicht übernommen. Eigenes Projekt, je Tool eine Sicherheitsprüfung |
| Cactus Needle 3 | nicht eingebaut. Lizenz Apache 2.0. Telemetrie standardmäßig an, abschaltbar über `NEEDLE_TELEMETRY=0` und `DO_NOT_TRACK=1`. Nicht getestet |
| Community-Skills (rund 100.000 im Hub) | nicht eingebaut. Nicht erreichbar aus der Sandbox (ClawHub, skills.sh). Fremde Entwickler, Einzelprüfung nötig |
| „Canva-Board“ von Julian Goldie | nicht gefunden. Gemeint ist vermutlich das Hermes-Kanban-Board, das wir mit `/board` haben |
| Agent-Reach (Augen über Social-Media) | nicht eingebaut. Nutzt eingeloggte Browser-Cookies und umgeht Anti-Bot-Schutz. Passt nicht zu den Regeln |
| Routinen an Workflows binden, Modul-Schalter | nicht gebaut. Vorschlag steht, nicht bestätigt |
| Mega-Liste (21.000 Einträge) | nicht geliefert, nicht eingebaut |
| Plattform-Anbindung (Telegram live, Social Media) | nicht gebaut außer Telegram-Poller. Nicht live getestet |
| Benutzerkonten am Board | nicht gebaut, nur Token |
| Umbenennung ULTRA/SUPER/T2/T3 im Code | offen |

---

## 11. Tests und Prüfung

### 11.1 Befehle

```bash
# Server muss laufen (Port 8080)
node backend/server.js &
node test/validate.js                       # Sweep über Seiten und APIs
node --test test/control_center.test.js     # 9 Tests
node --test test/skill_catalog.test.js      # 8 Tests
node --test test/data_upload.test.js        # 13 Tests
node --test test/jarvis_llm.test.js         # 8 Tests (Dummy-Ollama)
```

Nach `validate.js`: `backend/src/data/store.json` und `failures.json` mit `git checkout --` zurücksetzen, `growth.json` löschen, falls vorhanden.

### 11.2 Stand
- `validate.js`: **133 PASS / 0 FAIL** (letzter Lauf, nach Commit `45baa96`).
- Unit-Tests: **38 grün** (9 + 8 + 13 + 8).

### 11.3 Nicht geprüft
- **Browser-Ansicht:** Layout, Mikrofon, die zwei Knöpfe auf `/master`, die Zweitbildschirme, `/upload`, `/control`, `/skills`. Die Sandbox hat keinen Browser.
- **Telegram live:** die Sandbox erreicht `api.telegram.org` nicht.
- **Ollama live:** kein echter Endpunkt erreichbar.
- **Cluster und Kubernetes:** nicht in der Sandbox.

---

## 12. Commits dieser Arbeitsreihe (auf dem Branch, nicht in `main`)

| Commit | Inhalt |
|---|---|
| `3809ab5` | Phase 2: Repurposing, Mesh, Label-Pipeline, Analytics |
| `593c630` | JARVIS-Mikrofon |
| `a25162c` | JARVIS mit Ollama-Adapter (aus) |
| `8c6736a` | Agent Board |
| `743ce06`, `6536d8b` | JARVIS-Link-Leiste |
| `ab3e6dc`, `02d9995` | Hub: Serverwerte, Navigation |
| `2d7870b` | Checks für Board und JARVIS |
| `4ff566a` | Board: Admin-Token, Ollama-Tests, Doku |
| `cbc1779` | Autonomie-Schalter (aus) |
| `54e1ee6` | Daten-Upload mit Vorschau und Freigabe |
| `8a45ec7` | Skill-Katalog (232 Einträge, nur lesen) |
| `e8a7653` | Steuerzentrale mit Freigaben und Telegram-Befehlen |
| `45baa96` | Master-Seite: zwei Knöpfe, 18 Zweitbildschirme |
| (Audit-Commit) | Sicherheitsfix: Kill-Switch lösen braucht Admin-Token; dieses Dokument |

Basis `main`: `2e407b0` (Merge von PR #1).

---

## 13. Abnahme-Checkliste (vor dem Merge)

1. Server starten, `/hub` und `/master` öffnen. Knöpfe, Zweitbildschirme und 3D-Gehirn im Browser prüfen.
2. `AURA_ADMIN_TOKEN` setzen. Ohne Token sind Schreibaktionen offen.
3. `/control` öffnen: Schalter und Freigaben einmal durchspielen.
4. `/upload`: Vorschau mit einer verbotenen Zeile zeigen (muss abgelehnt werden).
5. `/skills`: Suche und Filter prüfen.
6. `node test/validate.js`: 133/0 erwartet. Danach Laufzeitdateien zurücksetzen.
7. Telegram-Poller auf einem Rechner mit Internet mit eigenem Chat testen. Ohne `TELEGRAM_ALLOWED_CHATS` nicht starten.
8. Ollama: `OLLAMA_URL` und `OLLAMA_MODEL` setzen, `/api/jarvis/llm` prüfen.
9. `deploy/master-install.sh`: `AURA_BRANCH` setzen, sonst läuft der alte Branch.
10. Entscheidung treffen: Umbenennung der Ebenen, Modell-Registry, Bildschirm-Funktion.
11. Nur mit ausdrücklichem „merge trotz offener Punkte“ nach `main` mergen.

---

## 14. Doku-Stand und Abweichungen

- `docs/MODULES.md` nennt 66 Bereiche (29 live, 13 Skills, 16 Platzhalter, 5 Review, 3 gesperrt). Das Master-Dokument (Drive) nennt 86 Bereiche und 67 live. **Abweichung, nicht aufgelöst.**
- Die Mitte des Master-Dokuments fehlt im Drive-Export. Das PDF „Master Setup (1)“ ist nicht geliefert.
- Die Mission-Control-Anzeige auf `extracted/AURA-Web-Deploy/public/index.html` ist eine **Simulation**, keine echten Serverwerte.
- Alte Routen `/api/skills` (13 Einträge, Registry) und neue `/api/skill-catalog` (232 Einträge) stehen nebeneinander. Die Konsole nutzt `/api/skills`.

Weitere Detaildokumente: `ARCHITECTURE.md`, `SETUP.md`, `DEPLOYMENT.md`, `CONFIGURATION.md`, `RUNBOOK.md`, `BOARD-JARVIS.md`, `CONTROL.md`, `UPLOAD.md`, `SKILLS.md`, `GROWTH.md`, `INTEGRATIONS.md`, `DATABASE.md`, `MODULES.md` (im Ordner `docs/`).

## YouTube-Pipeline und Creator-Beobachtung (Task 34)

- **Creator-Liste**: `backend/data/creators.json` (modular, von Hand erweiterbar). Felder: `id`, `name`, `platform` (youtube, x, tiktok, instagram, website, newsletter, telegram, other), `url` (nur https), `website`, `topics`, `enabled`, `watch`, `note`. Prüfung in `backend/src/lib/creator_watch.js`. Es gibt keinen automatischen Abruf. Beobachtung nur öffentlich über offizielle API oder RSS, nie per Login, nie mit Umgehung.
- **Pipeline**: `backend/src/lib/youtube_pipeline.js`. Stufen: Recherche, Skript, Produktion, Metadaten, Thumbnail-Brief, Freigabe (Mensch), Upload als privat, Veröffentlichung (Mensch), Auswertung.
- **Prüfregeln**: Titel 1–100 Zeichen, Beschreibung höchstens 5000 Bytes, Tags höchstens 500 Zeichen, KI-Kennzeichnung bei synthetischen Inhalten, keine Angebote für gekaufte Views, Abos oder Likes, keine Werbung für Mod-Apps. Uploads ohne menschliche Freigabe werden abgelehnt.
- **Routen**: `GET /api/creators?platform&topic&enabled`, `GET /api/youtube/plan?topic&creators=a,b`, `POST /api/youtube/check` (Admin-Token nötig, `mode: "check"` oder `"upload"`). Der Upload-Modus baut nur den Körper für `videos.insert` und sendet nichts.
- **Offen**: Echte Anbindung an die YouTube Data API (OAuth-Zugang), automatischer Creator-Abruf, KI-Kennzeichnungsfeld gegen aktuelle API-Doku prüfen. Eine Seite im Browser fehlt noch.
- **Tests**: `test/youtube_pipeline.test.js` 11/11.

### Nachtrag: Creator-Import (Upload)

- **Upload-Art** `creators` im Daten-Upload (`/upload`). Vorschau schreibt nichts, Übernahme alles-oder-nichts mit Name und Admin-Token. Abgelehnte Zeilen bleiben sichtbar.
- **Drei Formate**: JSON (`[...]` oder `{"creators": [...]}`), Zeilen `Name | Link | Themen | bell` (bell: ja/yes/true/1/glocke), YouTube-Takeout-CSV der Abos (Spalten `Channel Id, Channel Url, Channel Title`).
- **Link-Erkennung**: Plattform aus dem Host (youtube, x, tiktok, instagram, soundcloud, bandcamp, spotify, telegram, open-data für musicbrainz/discogs/wikidata, sonst website). YouTube-Kanäle werden auf die kanonische Form gebracht. Mit Kanal-ID wird der öffentliche RSS-Feed (`feeds/videos.xml`) ergänzt.
- **Glocke (`bell`)**: Ist nur ein Hinweisfeld. Die YouTube-API und der Takeout-Export liefern den Glocken-Status nicht. Er muss von Hand oder im Textformat gesetzt werden.
- **Zusammenführen**: nach URL. Bekannte Einträge werden aktualisiert, neue angehängt. Vor Übernahme wird nach `backend/src/data/backups/` gesichert (wie bei den übrigen Quellen).
- **Routen**: `GET /api/creators?platform&topic&enabled&bell`.
- **Tests**: `test/creator_import.test.js` 11/11 (Temp-Datei, die echte Liste bleibt unangetastet). `data_upload.test.js` und `validate.js` auf drei Upload-Arten angepasst.

### Multi-Kanal-Pipeline und Ultra-Scout (neu)

- **Kanäle** (`backend/src/lib/channel_pipelines.js`): YouTube, WordPress, Medium, Newsletter, Börsen-News (nur Information, Pflicht-Hinweis „Keine Anlageberatung“), Musik-Distributoren (DistroKid, TuneCore, CD Baby, Ditto, manuell). Eigene Kanäle in `backend/data/channels.json` (ist Nutzerdaten, nicht ignoriert).
- **Grundregel**: Entwurf zuerst, Mensch prüft und gibt frei. Publish-Modus je Kanal: privat zuerst (YouTube), Entwurf zuerst (WordPress), nur Entwurf (Medium), nur Mensch (Newsletter, Distributoren), Prüfung durch Mensch (Börsen-News).
- **Routen**: `GET /api/channels`, `GET /api/channels/plan?channels=a,b&topic=`, `POST /api/channels/check` und `POST /api/channels/publish-check` (Admin-Token, Body `{channel, meta}` bzw. `{channel, approved_by}`).
- **Ultra-Scout** (`backend/src/lib/ultra_scout.js`): Läuft täglich nach dem Start (erster Lauf nach 10 Minuten). Liest nur öffentliche GitHub-Metadaten (Suche nach sechs Topics). Filter: Lizenz (MIT, Apache-2.0, BSD, ISC, MPL-2.0), nicht archiviert, kein Fork, Mindeststerne (Standard 50, `AURA_ULTRA_MIN_STARS`), Aktualität, Sperrwörter. Vorschläge landen in `backend/data/ultra_proposals.json` (gitignoriert).
- **Keine Ausführung**: Der Scout installiert und führt nichts aus. Freigabe heißt nur „zur weiteren Prüfung“. Echte Tests in einer Sandbox brauchen eine eigene Isolation und sind noch nicht gebaut.
- **Abschalten**: `AURA_ULTRA_SCOUT=0`. Optionaler Token: `GITHUB_TOKEN`, sonst gelten die niedrigen unauthentifizierten Limits.
- **Routen**: `GET /api/ultra/proposals`, `POST /api/ultra/scout/run` (Admin), `POST /api/ultra/proposals/UP-xxxxxx/decide` (Admin, Body `{decision: approve|reject, by}`).
- **Tests**: `test/channel_ultra.test.js` 11/11, `youtube_pipeline` 11/11, `creator_import` 11/11, `validate.js` 135/0.

### Modul-Schnittstelle (Erweiterungen)

- Vollständige Spezifikation: `docs/MODULE_SPEC.md` (Manifest, Lebenszyklus, Vertrag, Rechte, Konfiguration, API, Grenzen).
- Loader: `backend/src/lib/module_loader.js`, Manifest-Prüfung: `backend/src/lib/module_manifest.js`.
- Module liegen unter `backend/modules/<ordner>/`. Beispiel: `example-hello`.
- Registry: Erweiterungen werden ergänzt (`registry.status()` mit `mode: module`). Die 40 bestehenden Bereiche bleiben unverändert.
- Routen: `GET /api/modules/ext`, `POST /api/modules/ext/...` (Admin-Token). Oberfläche: Block „Erweiterungsmodule“ in `/console`.
- Tests: `test/module_loader.test.js` 21/21. `validate.js` 137/0.
- Offen: echte Prozess-Isolation, Netzwerksperre, Signaturprüfung, Paket-Updates.
