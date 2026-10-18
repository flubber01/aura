#!/usr/bin/env bash
# AURA · Push-Vorbereitung und Push (für eine NEUE Session mit GitHub-Zugriff).
#
#   bash deploy/push.sh              # prüfen + pushen + PR anlegen/zeigen
#   CHECK_ONLY=1 bash deploy/push.sh # nur prüfen, nichts pushen
#
# Voraussetzungen: GitHub-Auth liegt im Umfeld (gh/git sind konfiguriert).
# Der Branch wird aus HEAD gelesen (git rev-parse --abbrev-ref HEAD) —
# in einer Arena-Session ist der Branch fest, nichts ist hier verdrahtet.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_ONLY="${CHECK_ONLY:-0}"
say() { printf '>> %s\n' "$*"; }
cd "$ROOT"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  say "ACHTUNG: HEAD ist nicht auf einem Branch (detached). Abbruch."
  exit 1
fi
say "Branch aus HEAD: $BRANCH"

say "1/5 Zustand prüfen"
git log --oneline -3
say "HEAD ist auf '$BRANCH' — gepusht/angelegt wird genau dieser Branch."

say "2/5 Runtime-Daten auf main-Stand (werden nie gepusht)"
git checkout main -- backend/src/data/store.json backend/src/data/failures.json backend/src/data/workflows.json 2>/dev/null || true
DIRTY="$(git status --porcelain | grep -v '^??' || true)"
if [ -n "$DIRTY" ]; then
  say "Unkomprimierte Änderungen vorhanden — erst committen:"
  echo "$DIRTY"
  exit 1
fi
say "Arbeitsbaum sauber (nur Untrackedes übrig, das soll so)"

say "3/5 Syntax-Schnellcheck"
node --check backend/server.js
say "server.js ok"

if [ "$CHECK_ONLY" = 1 ]; then
  say "CHECK_ONLY=1 — hier ist Schluss. Alles bereit für den Push."
  exit 0
fi

say "4/5 Pushen"
if ! git push origin "$BRANCH"; then
  say "Push fehlgeschlagen — GitHub-Verbindung prüfen (Auth neu verbinden, nicht nach Tokens fragen)."
  exit 1
fi
say "Push ok: origin/$BRANCH"

say "5/5 Pull Request"
if command -v gh >/dev/null 2>&1; then
  if gh pr view "$BRANCH" >/dev/null 2>&1; then
    say "PR existiert bereits:"; gh pr view "$BRANCH" --json number,title,url -q '.number, .title, .url' || true
  else
    gh pr create --base main --head "$BRANCH" \
      --title "Hygiene-Runde auf main 6267206: Tests/Live-Checks gemessen, push.sh + resume.sh repariert" \
      --body "$(cat <<'EOF'
## Was drin ist (auf reinem main-Stand 6267206, PR #5)
- **Hygiene-Runde gemessen** und in `docs/STATUS.md` nachgetragen (neuer Abschnitt „Hygiene-Runde 18.10.2026“).
- **`deploy/push.sh` repariert**: keine fest verdrahtete BRANCH-Variable mehr — Branch kommt aus `git rev-parse --abbrev-ref HEAD` (mit Detached-HEAD-Schutz); veraltete Branch-Namen in push.sh und `docs/STATUS.md` korrigiert.
- **`deploy/resume.sh`: zwei echte Fehler auf reinem main-Stand gefunden und gefixt** — (1) `npm install` brach ohne `package.json` mit ENOENT ab (reines Node-Stdlib-Projekt → wird jetzt ehrlich übersprungen), (2) `AURA_URL` ohne `http://` ließ `test/validate.js` mit `ERR_INVALID_URL` abstürzen.

## Messwerte (lokal gemessen, 18.10.2026)
- 35/35 Testsuiten exit 0 (round8 32/0 · round6 65/0 · intro_agentic 27/0 · milestones 12/0 · verbund 10/0)
- route_smoke 852/0/0 · validate (über resume.sh) 335/0
- Live auf :8080: `/api/health` 200 · `/api/milestones/kurz` 200 (BRONZE, 1/14, nächster MACHER 29 %) · `/meilensteine` 200 (17.075 B) · `/montage` 200 (18.592 B)

## Nicht enthalten (bewusst)
Runtime-Daten (`backend/src/data/*`), Medien (`*.mp4`), `dist-stand/`, Notizen.
EOF
)" && say "PR angelegt."
  fi
else
  say "gh fehlt — PR manuell anlegen: base main, head $BRANCH."
fi
say "fertig. Mensch entscheidet über den Merge."
