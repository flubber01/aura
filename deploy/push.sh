#!/usr/bin/env bash
# AURA · Push-Vorbereitung und Push (für eine NEUE Session mit GitHub-Zugriff).
#
#   bash deploy/push.sh              # prüfen + pushen + PR anlegen/zeigen
#   CHECK_ONLY=1 bash deploy/push.sh # nur prüfen, nichts pushen
#
# Voraussetzungen: GitHub-Auth liegt im Umfeld (gh/git sind konfiguriert),
# Branch arena/79a6521c-aura enthält die Konsolidierungs-Commits (git log -3).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="arena/79a6521c-aura"
CHECK_ONLY="${CHECK_ONLY:-0}"
say() { printf '>> %s\n' "$*"; }
cd "$ROOT"

say "1/5 Zustand prüfen"
git log --oneline -3
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT" != "$BRANCH" ]; then
  say "ACHTUNG: HEAD ist auf '$CURRENT', erwartet '$BRANCH'."
  say "Nicht selbst wechseln — in einer Arena-Session ist der Branch fest. Abbruch."
  exit 1
fi

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
      --title "Runden 4–8: Agentic-Intro, Meilensteine, Verbund, Installer, Runde 8" \
      --body "$(cat <<'EOF'
## Was drin ist
- **Agentic-Intro** (7e-Schlussframe-Renderer) + Cross-Chain-Hook: Intro-POST → DONE bucht Meilenstein.
- **Meilensteine**: 14 Stück, 5 Ketten, BRONZE→PLATIN; Badge im Kopf jeder ui_kit-Seite; `/api/milestones/kurz`.
- **Verbund/Montage**: 8 Systeme intern/extern/n8n; `/meilensteine` und `/montage` auf `ui_kit.shell()`.
- **Installer**: `deploy/master-install.sh`, `deploy/resume.sh` (Reset-Festigkeit), Download-Routen `/api/stand/{tar.gz,install.sh}`.
- **Runde 8**: QC-Fix Song-Orchestrator (MD5-Variantenvergleich), tote NAV-Links entfernt, `/design` + `/start` verdrahtet.

## Messwerte (lokal gemessen)
- 35 Testsuiten exit 0 (round8 32/0 · round4 25/0 · intro_agentic 27/0 · milestones 12/0 · verbund 10/0)
- route_smoke 851/0/0 · validate 335/0 · alle NAV-Links 200

## Nicht enthalten (bewusst)
Runtime-Daten (`backend/src/data/*`), Medien (`*.mp4`), `dist-stand/`, Notizen.
EOF
)" && say "PR angelegt."
  fi
else
  say "gh fehlt — PR manuell anlegen: base main, head $BRANCH."
fi
say "fertig. Mensch entscheidet über den Merge."
