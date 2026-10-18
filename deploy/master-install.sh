#!/usr/bin/env bash
# AURA master 1-click install — fresh Debian/Ubuntu box, own hardware only.
#
# Öffentliches Repo:
#   curl -fsSL https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh | bash
#
# PRIVATES Repo (so ist flubber01/aura eingestellt) — Token nötig, sonst liefert
# raw.githubusercontent.com 404 und es passiert schlicht nichts:
#   TOKEN=<dein_github_pat>   # fein granuliert, nur "Contents: Read" für dieses Repo
#   curl -fsSL -H "Authorization: Bearer $TOKEN" \
#     https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh \
#     | AURA_TOKEN="$TOKEN" bash
#
# Schon entpackt/geklont? Dann reicht:
#   AURA_DIR=/pfad/zu/aura bash deploy/master-install.sh
#
# Umgebungsvariablen:
#   AURA_TOKEN   GitHub-Token für privates Repo (sonst anonym)
#   AURA_BRANCH  Branch (Standard: main)
#   AURA_DIR     Zielordner (Standard: ./aura)
#   PORT         HTTP-Port (Standard: 8080)
#   AURA_LOG     Logdatei (Standard: /var/log/aura-backend.log, wenn root, sonst ./aura-backend.log)
#   RUN_VALIDATE 1 = Repro-Sweep am Ende (Standard), 0 = überspringen
#   OLLAMA_URL / OLLAMA_MODEL / OLLAMA_TIMEOUT_MS
#                werden NICHT überschrieben; ohne Vorgabe findet das Skript ein
#                laufendes Ollama auf 127.0.0.1:11434 selbst (Auto-Fund unten)
set -uo pipefail   # bewusst OHNE -e: jeder Schritt meldet selbst und wir wollen den Log sehen

BRANCH="${AURA_BRANCH:-main}"
PORT="${PORT:-8080}"
DIR="${AURA_DIR:-aura}"
REPO="https://github.com/flubber01/aura.git"
TOKEN="${AURA_TOKEN:-${GITHUB_TOKEN:-}}"

say()  { printf '>> %s\n' "$*"; }
warn() { printf '!! %s\n' "$*" >&2; }
die()  { printf '!! %s\n' "$*" >&2; exit 1; }

say "AURA master install (branch: $BRANCH, port: $PORT, dir: $DIR)"

# ---------- Werkzeuge ----------
have() { command -v "$1" >/dev/null 2>&1; }
SUDO=""
if [ "$(id -u)" != "0" ]; then have sudo && SUDO="sudo" || warn "kein root und kein sudo — apt/node-Installation könnte scheitern"; fi
apt_install() { $SUDO apt-get update && $SUDO apt-get install -y "$@"; }

have curl || { say "installiere curl"; apt_install curl || die "curl fehlt und ließ sich nicht installieren"; }
have git  || { say "installiere git";  apt_install git  || die "git fehlt und ließ sich nicht installieren"; }

# ---------- Node >= 22 ----------
NODE_MAJOR=0; have node && NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR:-0}" -lt 22 ]; then
  say "installiere Node 22 (gefunden: ${NODE_MAJOR:-keins})"
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash - || die "Node-Repo-Setup fehlgeschlagen (Netz?)"
  apt_install nodejs || die "Node-Installation fehlgeschlagen"
fi
NODE="$(command -v node)"; say "node: $NODE ($(node -v))"

# ---------- Repo holen ----------
# Bei privatem Repo braucht git ein Token im Remote.
auth_url() {
  if [ -n "$TOKEN" ]; then printf 'https://x-access-token:%s@github.com/flubber01/aura.git' "$TOKEN"; else printf '%s' "$REPO"; fi
}

if [ -d "$DIR/.git" ]; then
  say "Repo vorhanden: $DIR — aktualisiere (Branch $BRANCH)"
  cd "$DIR" || die "cd $DIR fehlgeschlagen"
  git remote set-url origin "$(auth_url)" 2>/dev/null || true
  if git fetch origin "$BRANCH"; then
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH" || warn "git checkout $BRANCH fehlgeschlagen"
  else
    warn "git fetch fehlgeschlagen (Netz? privates Repo ohne AURA_TOKEN?)."
    test -f backend/server.js || die "kein Update möglich und lokal fehlt backend/server.js"
    warn "starte mit dem bereits vorhandenen Stand weiter."
  fi
  if git rev-parse --verify -q "origin/$BRANCH" >/dev/null && ! git merge --ff-only "origin/$BRANCH" 2>/dev/null; then
    warn "Fast-forward nicht möglich (typisch: geänderte Laufzeitdateien in backend/src/data)."
    warn "Deine Daten bleiben unangetastet. So bringst du es auf den neuen Stand:"
    warn "  cd $DIR && git stash push backend/src/data/*.json && git merge --ff-only origin/$BRANCH"
  fi
elif [ -f "$DIR/backend/server.js" ]; then
  say "Ordner $DIR ist kein Git-Checkout, enthält aber backend/server.js — nutze ihn unverändert"
  cd "$DIR" || die "cd $DIR fehlgeschlagen"
elif [ -d "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  die "Ordner $DIR existiert, ist nicht leer und enthält kein backend/server.js.
   Anderen Zielordner nehmen (AURA_DIR=/pfad/neu) oder den Ordner vorher leeren."
else
  say "klone Repo nach $DIR"
  git clone "$(auth_url)" "$DIR" || die "git clone fehlgeschlagen.
   Privates Repo? Dann AURA_TOKEN setzen (fein granular, nur Contents: Read) oder Repo öffentlich stellen.
   Ohne Token prüfen: git ls-remote $REPO (muss ohne Passwortabfrage klappen)"
  cd "$DIR" || die "cd $DIR fehlgeschlagen"
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH" || warn "Branch $BRANCH nicht gefunden — bleibe auf $(git rev-parse --abbrev-ref HEAD)"
fi
if git rev-parse --git-dir >/dev/null 2>&1; then
  git remote set-url origin "$REPO" 2>/dev/null || true   # Token nicht dauerhaft in .git/config lassen
  say "Stand: $(git rev-parse --abbrev-ref HEAD) · $(git log --oneline -1)"
else
  say "kein Git-Checkout — nutze den vorhandenen Stand unverändert"
fi

test -f backend/server.js || die "backend/server.js fehlt — falscher Ordner/Branch?"

# ---------- Laufzeitverzeichnis ----------
mkdir -p backend/src/data extracted/AURA-Web-Deploy/public 2>/dev/null || true

# ---------- Port prüfen ----------
if have ss && ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  warn "Port $PORT ist schon belegt:"
  ss -ltnp 2>/dev/null | grep ":$PORT " >&2 || true
  warn "Anderen Dienst stoppen/umstellen oder mit PORT=8090 erneut starten."
fi

# ---------- Ollama-Auto-Fund (lokales LLM für JARVIS) ----------
# Läuft auf dem Host schon ein Ollama (127.0.0.1:11434), wird es gefunden und
# dem Backend per Env übergeben — kein Modell wird installiert oder gepullt.
# Bereits gesetzte Env-Variablen haben Vorrang und werden nie überschrieben.
OLLAMA_TAGS="$(curl -s -m 3 http://127.0.0.1:11434/api/tags 2>/dev/null || true)"
if printf '%s' "$OLLAMA_TAGS" | grep -q '"models"'; then
  export OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
  if [ -z "${OLLAMA_MODEL:-}" ]; then
    # Erstes Nicht-Embedding-Modell aus der echten Liste (Embedder können nicht chatten).
    OLLAMA_MODEL="$(printf '%s' "$OLLAMA_TAGS" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const names=(JSON.parse(d).models||[]).map(m=>m.name||m.model||"").filter(Boolean);const chat=names.find(n=>{const s=n.toLowerCase();return !/(-embed|embed-)$/.test(s)&&!s.includes("all-minilm")&&!s.includes("nomic-embed-text");});process.stdout.write(chat||"");}catch{process.stdout.write("");}})' 2>/dev/null || true)"
    export OLLAMA_MODEL="${OLLAMA_MODEL:-phi3:mini}"
  fi
  export OLLAMA_TIMEOUT_MS="${OLLAMA_TIMEOUT_MS:-60000}"   # CPU-Boxen sind langsam
  say "Ollama gefunden auf 127.0.0.1:11434 ✔ — Backend startet mit OLLAMA_URL=$OLLAMA_URL · OLLAMA_MODEL=${OLLAMA_MODEL:-<Env>} · OLLAMA_TIMEOUT_MS=$OLLAMA_TIMEOUT_MS"
else
  say "Ollama: kein Dienst auf 127.0.0.1:11434 gefunden — Backend startet ohne lokales LLM (JARVIS meldet dann ehrlich NOT-CONNECTED, bis OLLAMA_URL gesetzt wird)"
fi

# ---------- Starten ----------
if [ -n "$SUDO" ] && [ -d /var/log ] && [ -w /var/log ]; then LOG="${AURA_LOG:-/var/log/aura-backend.log}"; else LOG="${AURA_LOG:-$PWD/aura-backend.log}"; fi
say "starte Backend (Log: $LOG)"
setsid nohup env PORT="$PORT" OLLAMA_URL="${OLLAMA_URL:-}" OLLAMA_MODEL="${OLLAMA_MODEL:-}" OLLAMA_TIMEOUT_MS="${OLLAMA_TIMEOUT_MS:-}" node backend/server.js >>"$LOG" 2>&1 < /dev/null &
PID=$!
disown 2>/dev/null || true
sleep 2
if ! kill -0 "$PID" 2>/dev/null; then
  warn "Prozess ist sofort beendet. Letzte Logzeilen:"
  tail -n 30 "$LOG" >&2 || true
  die "Start fehlgeschlagen (siehe oben)"
fi

# ---------- Health check ----------
say "warte auf /api/health ..."
OK=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok"'; then OK=1; break; fi
  sleep 1
done
if [ "$OK" != "1" ]; then
  warn "Health-Check fehlgeschlagen. Letzte Logzeilen:"
  tail -n 30 "$LOG" >&2 || true
  die "Backend antwortet nicht auf Port $PORT"
fi
say "AURA LIVE auf :$PORT — /hub · /console · /ops · /login · /downloads"
say "PID $PID · Log $LOG · Stopp: kill $PID"

# ---------- Repro-Sweep ----------
if [ "${RUN_VALIDATE:-1}" = "1" ] && [ -f test/validate.js ]; then
  say "Repro-Sweep (test/validate.js) läuft …"
  OUT="$(mktemp)"
  if AURA_URL="http://127.0.0.1:$PORT" node test/validate.js >"$OUT" 2>&1; then
    tail -1 "$OUT"; say "Reproduktion bestätigt ✔"
  else
    grep -E "FAIL|===" "$OUT" | tail -n 20
    warn "Sweep meldete Abweichungen — volles Log: $OUT"
  fi
fi
say "fertig."
