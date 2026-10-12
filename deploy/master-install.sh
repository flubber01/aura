#!/usr/bin/env bash
# AURA master 1-click install — fresh Debian/Ubuntu box, own hardware only.
# One line:  curl -fsSL <raw-url>/deploy/master-install.sh | bash
set -euo pipefail
BRANCH="${AURA_BRANCH:-arena/0ee9c54c-aura}"
PORT="${PORT:-8080}"
echo ">> AURA master install (branch: $BRANCH, port: $PORT)"

command -v curl >/dev/null || { apt-get update && apt-get install -y curl; }
command -v git  >/dev/null || { apt-get update && apt-get install -y git; }

# node 22
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
fi

# repo
test -d aura || git clone https://github.com/flubber01/aura.git aura
cd aura
git fetch origin "$BRANCH" && git checkout "$BRANCH" && git pull origin "$BRANCH" || true

# boot backend (static UI included) — systemd empfohlen: docs/DEPLOYMENT.md §2.2
PORT="$PORT" nohup node backend/server.js > /var/log/aura-backend.log 2>&1 &

# health check
echo ">> waiting for /api/health ..."
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" | grep -q '"ok"'; then
    echo ">> AURA LIVE on :$PORT — /hub · /ignition · /logs · /cluster · /config · /containers"
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/api/health" | grep -q '"ok"' || { echo "!! health check failed — see /var/log/aura-backend.log" >&2; exit 1; }

# 1-click reproduction proof (full validation sweep; set RUN_VALIDATE=0 to skip)
if [ "${RUN_VALIDATE:-1}" = "1" ] && [ -f test/validate.js ]; then
  echo ">> running reproduction sweep (test/validate.js) ..."
  OUT="$(mktemp)"
  if AURA_URL="http://127.0.0.1:$PORT" node test/validate.js > "$OUT" 2>&1; then
    tail -1 "$OUT"; echo ">> reproduction verified ✔"
  else
    grep -E "FAIL|===" "$OUT"; echo "!! validation reported failures — full log: $OUT"
  fi
fi
echo ">> done."
