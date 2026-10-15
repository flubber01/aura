# Daten-Upload (Link-Listen) — `/upload`

Stand: 2026-10-13 · Branch `arena/3b63f072-aura` (noch nicht in `main`)

Hier lädst du Link-Listen hoch, zum Beispiel Yellow Pages oder den API-Katalog. Jeder Upload läuft in zwei Schritten: **Vorschau** und **Übernahme**.

## Ablauf

1. **Vorschau** (`POST /api/upload/preview`): prüft alles und schreibt nichts. Du siehst Anzahl, Ablehnungen mit Zeile und Grund, und ob Neu oder Aktualisiert.
2. **Übernahme** (`POST /api/upload/commit`): nur wenn die Vorschau ohne Ablehnungen ist. Verlangt deinen Namen, und wenn `AURA_ADMIN_TOKEN` gesetzt ist, das Token im Header `x-aura-token`. Der Kill-Switch sperrt die Übernahme mit 423.

**Alles oder nichts:** Ein abgelehnter Eintrag stoppt die ganze Übernahme.

**Backup:** Vor jeder Übernahme wird die alte Datei nach `backend/src/data/backups/` kopiert.

## Quellen

| Quelle | Format | Modus |
|---|---|---|
| `yellowpages` | JSON: `{"links": [{name, url, category, desc}]}` oder ein Array | **Zusammenführen:** neue URLs werden ergänzt, bekannte aktualisiert |
| `apis` | Text, eine Zeile pro Eintrag: `name \| url \| category` | **Ersetzen:** `ingest/apis.txt` wird durch die geprüfte Liste ersetzt |

Neue Quelle hinzufügen: ein Eintrag in `KINDS` in `backend/src/lib/data_upload.js`.

## Prüfregeln

- Nur **https**-Links.
- Name 2–80 Zeichen, Beschreibung höchstens 300, Kategorie 1–40 Zeichen (a-z, 0-9, `_ . -`).
- Höchstens 500 Einträge, höchstens 1 MB.
- Keine Dubletten innerhalb der Datei.
- **Verboten** sind Inhalte, die Umgehung, Fremd-Mining, gekaufte Reichweite, Credential-Sammlung oder Plattform-Umgehung bewerben. Das Muster steht in `FORBIDDEN`. Treffer werden abgelehnt, auch mit Name und Beschreibung.

Prüfen heißt nicht freigeben. Lizenz, Compliance (z. B. Glücksspiel oder Erwachsenen-Inhalte) und Verwendbarkeit prüft weiterhin ein Mensch.

## Änderung gegenüber vorher

Die alte Route `POST /api/config/upload` hat Yellow Pages **ohne Token, ohne Kill-Switch und ohne Prüfung** geschrieben. Sie ist jetzt:
- für `yellowpages` auf **410 Gone** umgestellt und verweist auf `/upload`,
- für die übrigen Ziele (`departments`, `teams`, `skills`) mit Kill-Switch und Token gesichert.

## Routen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/upload` | Seite |
| GET | `/api/upload/kinds` | verfügbare Quellen |
| POST | `/api/upload/preview` | Vorschau, schreibt nichts |
| POST | `/api/upload/commit` | Übernahme (Name, Token, Kill-Switch) |

## Tests

```bash
node --test test/data_upload.test.js     # Regeln, Vorschau, Ablehnungspfade (schreibt nichts)
node test/validate.js                    # gegen den laufenden Server
```
