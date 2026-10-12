#!/usr/bin/env bash
# AURA bootstrap — idempotent, least privilege, safe shutdown.
# Deliberately does NOT remount /dev/shm or touch host devices (review notes).
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-up}" in
  up)
    docker compose up -d --wait
    docker compose ps
    echo "AURA up: web :8080 / backend :8090"
    ;;
  down)
    docker compose down --remove-orphans
    ;;
  status)
    docker compose ps
    ;;
  *)
    echo "usage: start_swarm.sh [up|down|status]" >&2
    exit 2
    ;;
esac
