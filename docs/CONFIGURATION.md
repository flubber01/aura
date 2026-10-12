# AURA — CONFIGURATION (Area 68)

> Eine Quelle der Wahrheit für alle Tuning-Parameter: schema-validiert,
> hot-reloaded, vault-gesichert. UI: **`/config`** · API: **`/api/config`**

## 1. Wo liegt was?

| Ort | Zweck |
|---|---|
| `backend/src/data/config.json` | Overrides (wird bei erstem Speichern angelegt) |
| Code-Defaults (`src/lib/config.js` SCHEMA) | gelten, solange kein Override existiert |
| Env-Variablen | schlagen Datei-Werte, wo angegeben (`PORT`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`) |

**Priorität:** Env > config.json > Default.

## 2. Alle Parameter

| Section.Key | Typ | Default | Min–Max | Wirkung |
|---|---|---|---|---|
| `system.name` | string | AURA Agent Command Center | — | Anzeigename |
| `budget.monthly_cap_eur` | number | 20 | 0–500 | OpenRouter-Cloud-Lane wird ab diesem Monatswert blockiert. OmniRoute liest den Wert **live** (Hot-Reload), solange kein `set_budget` den Cap gepinnt hat |
| `kill.syntax_fail_threshold` | number | 3 | 1–20 | so viele API-Syntax-Fails… |
| `kill.window_min` | number | 5 | 1–60 | …in diesem Fenster → Kill-Switch auto-engaged |
| `watcher.interval_ms` | number | 1500 | 300–30000 | Hot-Reload-Poll der 10 beobachteten Dateien (Neustart nötig) |
| `self_repair.interval_ms` | number | 20000 | 5000–600000 | Health-Loop-Takt von Area 66 (Neustart nötig) |
| `containers.max_fails` | number | 3 | 1–10 | Fails bis Quarantäne eines Moduls |
| `containers.cooldown_ms` | number | 60000 | 1000–3600000 | Quarantäne-Dauer bis Auto-Probe |
| `containers.timeout_ms` | number | 15000 | 500–120000 | Timeout-Guard pro Modul-Action |

## 3. API

```bash
curl localhost:8080/api/config                       # aktuelle Werte
curl localhost:8080/api/config/schema                # Schema + Defaults + aktuelle Werte
curl -X POST localhost:8080/api/config \
     -H 'content-type: application/json' \
     -d '{"budget":{"monthly_cap_eur":30},"containers":{"max_fails":5}}'
curl -X POST localhost:8080/api/config/reset         # zurück auf Defaults
```

Validierungsfehler liefern **400** mit exakter Liste (`unknown section`, `< min`, …).
Unbekannte Keys werden abgelehnt — kein stilles Ignorieren.

## 4. Hot-Reload-Mechanik

- `config.get()` liest mit **mtime-Cache** (2-Zustand: Dateiänderung → sofort neue Werte).
- Zahlenwerte (Budget, Container-Limits, Kill-Schwelle) wirken **ohne Neustart**.
- Intervalle (Watcher, Self-Repair) werden beim Boot gelesen → Neustart für Übernahme.
- `config.json` ist Watcher-Datei Nr. 10: korrupt geschrieben → Rollback auf letzte
  valide Kopie; jede valide Änderung → Vault-Snapshot (Area 64).

## 5. Beziehung zu anderen Systemen

- **Area 67 Container:** Limits kommen live aus `containers.*`.
- **Area 66 Self-Repair:** Takt aus `self_repair.interval_ms`.
- **Area 59 Watcher:** Takt aus `watcher.interval_ms`.
- **Area 58 OmniRoute:** Budget-Cap live aus `budget.monthly_cap_eur`.
- **Kill-Switch:** Schwellen aus `kill.*`.

_Kurz: eine Datei, ein UI, ein API — der Rest des Systems zieht sich die Werte live._
