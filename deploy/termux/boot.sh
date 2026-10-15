#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot-Skript: startet AURA automatisch nach dem Einschalten des Handys.
# Einmal kopieren nach ~/.termux/boot/aura.sh (Termux:Boot muss installiert sein):
#   mkdir -p ~/.termux/boot && cp ~/aura/deploy/termux/boot.sh ~/.termux/boot/aura.sh
set -eu
sleep 15   # kurz warten, bis das Netz oben ist
DIR="${AURA_DIR:-$HOME/aura}"
cd "$DIR"
if command -v termux-wake-lock >/dev/null 2>&1; then termux-wake-lock || true; fi
PORT="${PORT:-8080}" nohup node backend/server.js > "$HOME/aura-server.log" 2>&1 &
