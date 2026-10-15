# Steuerzentrale — `/control`

Stand: 2026-10-13 · Branch `arena/3b63f072-aura` (noch nicht in `main`)

Jede Aktion hat einen **Schalter** (an/aus), eine **Risikostufe** und eine **Freigabe-Pflicht**. Riskante Aktionen laufen nur, wenn ein Mensch sie freigibt. Bots und Agenten können nicht freigeben.

## Aktionen

| Aktion | Risiko | Freigabe | Standard |
|---|---|---|---|
| Status lesen, Bericht lesen | niedrig | nein | an |
| Snapshot (Backup) | mittel | nein | an |
| Vollsync der Module | mittel | **ja** | an |
| Board-Aufgabe anlegen | mittel | nein | an |
| Link-Liste übernehmen (`/upload`) | hoch | **ja** | an |
| Veröffentlichung freigeben (Growth) | hoch | **ja** | an |
| Autonome Selbstheilung | hoch | **ja** | **aus** |
| Skill installieren | hoch | **ja** | **aus** |
| Kill-Switch auslösen | mittel | nein | an |
| Kill-Switch lösen | hoch | **ja** | an |

Der globale Kill-Switch sperrt alles außer Status und Bericht.

## Ablauf einer riskanten Aktion

1. Anfrage: `POST /api/control/run/<aktion>` → Antwort `202` mit Freigabe-ID `AP-…`.
2. Ein Mensch entscheidet: `POST /api/control/approvals/AP-…` mit `decision: approve|deny` und `by` (Name, kein Bot).
3. Freigegebene Aktion läuft. Eine Freigabe lässt sich nur einmal entscheiden. Offene Freigaben verfallen nach 24 h, höchstens 20 gleichzeitig.

## Telegram

Der Poller (`backend/src/lib/telegram_poller.js`) läuft außerhalb der Sandbox. Nur Chats aus `TELEGRAM_ALLOWED_CHATS` dürfen Befehle geben.

| Befehl | Wirkung |
|---|---|
| `/status`, `/report`, `/learn` | nur lesen |
| `/snapshot` | Backup, direkt |
| `/sync` | Vollsync, braucht Freigabe |
| `/kill` | Kill-Switch auslösen |
| `/revive CONFIRM` | Kill-Switch lösen (mit Bestätigungswort) |
| `/tools` | alle Aktionen mit Schalter und Freigabe anzeigen |
| `/on <id>`, `/off <id>` | Schalter setzen |
| `/run <id>` | Aktion anstoßen, erzeugt ggf. eine Freigabe |
| `/pending` | offene Freigaben |
| `/approve AP-…`, `/deny AP-…` | entscheiden |

Aktionen, die nur im Web gehen (Upload, Veröffentlichung, Selbstheilung, Skill-Installation, Board-Aufgabe), kann Telegram nicht ausführen.

Optional: `AURA_ADMIN_TOKEN` setzen, dann braucht jede Schreibaktion den Token. Der Poller schickt ihn aus seiner Umgebung mit.

## Routen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/control` | Seite |
| GET | `/api/control` | Aktionen und offene Freigaben |
| POST | `/api/control/action/<id>/enable\|disable` | Schalter (Mensch, Token) |
| POST | `/api/control/run/<id>` | Aktion anstoßen (Token, Kill-Switch) |
| POST | `/api/control/approvals/AP-…` | entscheiden (Mensch, Token) |

Speicher: `backend/src/data/control.json` (git-ignoriert).

## Tests

```bash
node --test test/control_center.test.js
```

## Noch nicht drin

- **Hermes-Tools als Module** (276 Python-Dateien): eigenes Projekt, mit eigener Sicherheitsprüfung pro Tool.
- **Cactus Needle 3** als lokaler Tool-Router: Lizenz Apache 2.0, Gewichte von Hugging Face. Die Binary sendet Telemetrie standardmäßig. Vor einem Einsatz `NEEDLE_TELEMETRY=0` und `DO_NOT_TRACK=1` setzen. Ohne Live-Test am Zielsystem nicht aktiviert.
- **„Canva-Board“ von Julian Goldie:** nicht gefunden. Seine Veröffentlichungen beschreiben das Hermes-Kanban-Board. Das haben wir mit `/board`.
