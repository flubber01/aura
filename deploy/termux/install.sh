#!/data/data/com.termux/files/usr/bin/bash
# AURA auf dem Android-Handy über Termux installieren und starten.
#
# Voraussetzung: Termux aus F-Droid (NICHT aus dem Play Store, die dortige Version ist veraltet).
# Optional: Termux:Boot (Autostart), Termux:API (Wake-Lock, Apps öffnen).
#
#   bash deploy/termux/install.sh          # einmal installieren und starten
#   AURA_BRANCH=arena/3b63f072-aura bash deploy/termux/install.sh
#
# Danach im Handy-Browser: http://localhost:8080/hub
set -euo pipefail

REPO_URL="${AURA_REPO_URL:-https://github.com/flubber01/aura.git}"
BRANCH="${AURA_BRANCH:-arena/3b63f072-aura}"
DIR="${AURA_DIR:-$HOME/aura}"
PORT="${PORT:-8080}"

echo "[1/4] Pakete installieren (nodejs-lts, git)…"
pkg update -y
pkg install -y nodejs-lts git

echo "[2/4] Repo holen (Branch: $BRANCH)…"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout "$BRANCH"
  git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$DIR"
fi

echo "[3/4] Node-Version prüfen…"
node -e 'const m=+process.versions.node.split(".")[0]; if(m<22){console.error("Node 22+ nötig, gefunden "+process.version); process.exit(1)}'

echo "[4/4] Server starten auf Port $PORT (0.0.0.0)…"
echo "Im Handy-Browser öffnen: http://localhost:$PORT/hub"
cd "$DIR"
if command -v termux-wake-lock >/dev/null 2>&1; then termux-wake-lock || true; fi
PORT="$PORT" exec node backend/server.js
