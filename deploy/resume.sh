#!/usr/bin/env bash
# AURA-Resume: bringt das System nach einem Sandbox-Reset mit EINEM Befehl zurück.
#
#   bash deploy/resume.sh                  # Standard: Port 8080
#   PORT=8090 bash deploy/resume.sh        # anderer Port
#   DRY_RUN=1 bash deploy/resume.sh        # zeigt nur, was es tun würde
#   SKIP_VALIDATE=1 bash deploy/resume.sh  # ohne Prüf-Sweep
#
# Schritte: ffmpeg (aus PyPI, einzige erlaubte Quelle) → node_modules →
# Stand-Tarball (dist-stand/) → Server starten → Health → validate →
# Install-Einzeiler ausgeben. Idempotent: was schon da ist, wird übersprungen.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_VALIDATE="${SKIP_VALIDATE:-0}"
LOG="$ROOT/aura-backend.log"
say() { printf '>> %s\n' "$*"; }
cd "$ROOT"
say "AURA-Resume in $ROOT (Port $PORT, DRY_RUN=$DRY_RUN)"

# 1) ffmpeg — Intro-Render brauchen es; /tmp ist nach Resets leer.
if [ ! -x /tmp/ffbin/ffmpeg ] && ! command -v ffmpeg >/dev/null 2>&1; then
  say "ffmpeg fehlt — hole imageio-ffmpeg von PyPI"
  if [ "$DRY_RUN" != 1 ]; then
    pip install --break-system-packages -q imageio-ffmpeg
    BIN="$(ls /usr/local/lib/python3*/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-* 2>/dev/null | head -1 || true)"
    if [ -n "$BIN" ]; then
      mkdir -p /tmp/ffbin && cp "$BIN" /tmp/ffbin/ffmpeg && chmod +x /tmp/ffbin/ffmpeg
    fi
  fi
fi
if [ -x /tmp/ffbin/ffmpeg ] || command -v ffmpeg >/dev/null 2>&1; then
  say "ffmpeg: vorhanden ✔"
else
  say "ffmpeg: NICHT verfügbar — Intro-Routen melden dann ehrlich 409 BLOCKED_NO_FFMPEG"
fi

# 2) Abhängigkeiten (node_modules überlebt Resets normalerweise — für den Fall).
#    Kein package.json = reines Node-Stdlib-Projekt: npm install würde mit
#    ENOENT abbrechen, also ehrlich überspringen statt zu scheitern.
if [ ! -d node_modules ]; then
  if [ -f package.json ]; then
    say "node_modules fehlt — npm install"
    [ "$DRY_RUN" != 1 ] && npm install --no-audit --no-fund
  else
    say "kein package.json — reines Node-Stdlib-Projekt, npm install übersprungen ✔"
  fi
fi

# 3) Stand-Tarball für die Install-Routen (liegt IM Repo, überlebt Resets).
if [ ! -f dist-stand/aura-stand.tar.gz ]; then
  say "Stand-Tarball fehlt — baue dist-stand/aura-stand.tar.gz"
  [ "$DRY_RUN" != 1 ] && mkdir -p dist-stand && tar czf dist-stand/aura-stand.tar.gz \
    --exclude=.git --exclude='*.mp4' --exclude=intro-vorschau.png \
    --exclude=backend/src/data --exclude='*.log' --exclude=dist-stand .
else
  say "Stand-Tarball: $(ls -l dist-stand/aura-stand.tar.gz | awk '{print $5}') B ✔"
fi

# 4) Server — starten, wenn er nicht läuft.
if curl -s -m 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
  say "Server läuft bereits auf :$PORT ✔"
else
  say "Starte Server auf :$PORT (Log: $LOG)"
  if [ "$DRY_RUN" != 1 ]; then
    PATH="/tmp/ffbin:$PATH" PORT="$PORT" setsid nohup node backend/server.js >> "$LOG" 2>&1 &
    OK=0
    for _ in $(seq 1 30); do
      sleep 1
      if curl -s -m 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then OK=1; break; fi
    done
    [ "$OK" = 1 ] && say "Server live auf :$PORT ✔" || { say "FEHLER: Server nicht erreichbar — Log prüfen"; exit 1; }
  fi
fi

# 5) Prüf-Sweep — die ehrliche Zahl.
if [ "$SKIP_VALIDATE" = 1 ]; then
  say "validate übersprungen (SKIP_VALIDATE=1)"
elif [ "$DRY_RUN" != 1 ]; then
  AURA_URL="http://127.0.0.1:$PORT" node test/validate.js | tail -1 || say "validate meldet Fehler — Ausgabe oben prüfen"
fi

# 6) Install-Einzeiler (in der Sandbox mit Preview-Link, sonst lokal).
if [ -n "${E2B_SANDBOX_ID:-}" ]; then
  say "Install-Einzeiler: curl -fsSL https://$PORT-$E2B_SANDBOX_ID.e2b.app/api/stand/install.sh | bash"
else
  say "Install-Einzeiler (lokal): curl -fsSL http://127.0.0.1:$PORT/api/stand/install.sh | AURA_DIR=\$HOME/aura-zweig PORT=8090 bash"
fi
say "fertig."
