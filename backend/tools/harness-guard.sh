#!/bin/sh
# AURA harness-guard: blockt Befehle, die REGEL 1 oder Sicherheitslinien verletzen.
# Wird als Claude-Code-PreToolUse-Hook eingebunden (siehe /api/harness/hooks).
INPUT="$(cat 2>/dev/null)"
CMD=$(printf "%s" "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -c 2000)
[ -z "$CMD" ] && CMD="$INPUT"
case "$CMD" in
  *rm\ -rf\ /*|*rm\ -rf\ ~*|*mkfs*|*dd\ if=*/dev/zero*) echo "BLOCKED (Guard): destruktiver Systembefehl"; exit 2 ;;
  *git\ push*main*|*push\ -f*origin\ main*) echo "BLOCKED (Guard): Push nach main verboten — nur arena/*-Branches"; exit 2 ;;
  *curl*tor*|*torsocks*|*socks5*proxy*|*onion*) echo "BLOCKED (Guard): Anonymisierungs-/Tor-Tunnel sind ausgeschlossen"; exit 2 ;;
  *uncensored*|*abliterated*) echo "BLOCKED (Guard): sicherheits-entkernte Modelle sind ausgeschlossen"; exit 2 ;;
esac
exit 0
