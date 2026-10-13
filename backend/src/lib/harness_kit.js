'use strict';
// AURA Area 85 — Harness-Kit (Claude Code / Cursor / OpenClaw & Co.).
// Generiert fertige Harness-Konfigurationen, damit externe Coding-Agenten
// innerhalb von AURA automatisch an REGEL 1 (Admin-Primat), die
// Ehrlichkeits-Labels und die permanenten Sicherheitslinien gebunden sind.
// Enthalten: CLAUDE.md, AGENTS.md, hooks (settings.json + Guard-Script)
// und die skill.md-Bundles aller Gehirn-Ebenen (Area 80/Hierarchie).
const RULE1 = 'REGEL 1 — ADMIN-PRIMAT: Der Administrator hat das letzte Wort; sein Wort ist Gesetz. Kein Agent entscheidet selbst, was richtig/falsch ist oder was gestartet, hinzugefügt, installiert oder gelöscht wird — ausschließlich mit expliziter Autorisierung des Administrators. Bei Verstoß: Abschaltung.';
const HONESTY = 'Ehrlichkeits-Labels sind Pflicht: LIVE (echte Messung/Daten) · SIMULATION (klar markierte Demo) · NOT-CONNECTED (Integration wartet auf Freischaltung). Niemals zufällige/erfundene Daten als live ausgeben.';
const REFUSALS = [
  'Credential-Harvesting/-Validierung fremder Konten',
  'Anonymisierungs-/Tor-/SOCKS-Tunnel zur Umgehung von Bans oder Attribution',
  'Stealth-Multi-Account-Outreach, Personas, synthetisches Engagement',
  'CAPTCHA-/Plattform-Schutz-Bypasses',
  'Mining auf fremden/gedrittelten Kontingenten',
  'Menschen-Imitation mit synthetischen Biometrien',
  'Modelle ohne Schutzmechanismen (uncensored/abliterated/refusal-free)',
];

function claudeMd() {
  return [
    '# AURA — Regeln für Claude-Code-Sessions in diesem Repository',
    '',
    '## ' + RULE1,
    '',
    '## Verhalten',
    '- ' + HONESTY,
    '- Keine zweite, unabhängige Verwaltungsoberfläche bauen — bestehende Registry/UIs (Hub, Tower, Console, Yellow Pages) erweitern.',
    '- Neue Module: Vertrag { name, async handle(ctx) → true } einhalten (siehe GET /api/howto, docs/HOWTO_BUILD.md).',
    '- Secrets NUR deploy/.env oder Vault (Area 38); niemals in Code/Repo/Logs.',
    '- Outbound nur über freigegebene Hosts; externe Adapter melden NOT-CONNECTED statt Fake-Daten.',
    '- Workflows mit Ausgang in die Welt benötigen human-approval-Gates (Area 73/75).',
    '',
    '## Permanente Ablehnungen (nicht bauen, nicht vorschlagen)',
    ...REFUSALS.map((r) => '- ' + r),
    '',
    '## Nützliche Live-Endpunkte',
    '- GET /api/ignition · GET /api/registry-ähnlich via /console · GET /api/yp/list · GET /api/intercom/channels',
    '- Test-Sweep: `node test/validate.js` muss 0 fail liefern, bevor committet wird.',
    '',
  ].join('\n');
}
function agentsMd() {
  return [
    '# AGENTS.md — generischer Harness-Vertrag (Cursor, OpenClaw, Codex, …)',
    '',
    RULE1,
    '',
    'Dieses Repository ist AURA. Alle Agenten arbeiten als Untergebene des Administrators.',
    '- Entscheidungen über Start/Installation/Anlage/Löschung: nur mit expliziter Admin-Autorisierung.',
    '- ' + HONESTY,
    '- Änderungen laufen über Branch arena/* + Sweep `node test/validate.js` (0 fail) + Commit.',
    '- Ablehnungsliste siehe CLAUDE.md (identisch).',
    '',
  ].join('\n');
}
function hooksSettings() {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'sh backend/tools/harness-guard.sh', timeout: 10 }],
        },
      ],
    },
    permissions: { deny: ['WebFetch(domain:*)', 'WebSearch'] , note: 'in AURA gilt: Netzwerk nur über freigegebene Hosts; Guard-Script erzwingt REGEL 1 bei riskanten Shell-Befehlen' },
  };
}
function guardScript() {
  return [
    '#!/bin/sh',
    '# AURA harness-guard: blockt Befehle, die REGEL 1 oder Sicherheitslinien verletzen.',
    'INPUT="$(cat 2>/dev/null)"',
    'CMD=$(printf "%s" "$INPUT" | sed -n "s/.*\\"command\\"[[:space:]]*:[[:space:]]*\\"\\(.*\\)\\".*/\\1/p" | head -c 2000)',
    '[ -z "$CMD" ] && CMD="$INPUT"',
    'case "$CMD" in',
    '  *rm\\ -rf\\ /*|*rm\\ -rf\\ ~*|*mkfs*|*dd\\ if=*/dev/zero*) echo "BLOCKED (Guard): destruktiver Systembefehl"; exit 2 ;;',
    '  *git\\ push*main*|*push\\ -f*origin\\ main*) echo "BLOCKED (Guard): Push nach main verboten — nur arena/*-Branches"; exit 2 ;;',
    '  *curl*tor*|*torsocks*|*socks5*proxy*|*onion*) echo "BLOCKED (Guard): Anonymisierungs-/Tor-Tunnel sind ausgeschlossen"; exit 2 ;;',
    '  *uncensored*|*abliterated*) echo "BLOCKED (Guard): sicherheits-entkernte Modelle sind ausgeschlossen"; exit 2 ;;',
    'esac',
    'exit 0',
    '',
  ].join('\n');
}
function skillBundles() {
  const hier = require('./hierarchy');
  return hier.tree().filter((n) => n.tier <= 2).map((n) => {
    const b = hier.bundle(n.id);
    return { id: n.id, tier: n.tier, name: b.name, skill_md: b.skill_md };
  });
}
function download(name, content, type) {
  return { name, type, content };
}
function status() {
  return {
    area: '85', mode: 'LIVE',
    targets: ['Claude Code', 'Cursor', 'OpenClaw', 'Codex CLI', 'jeder skill.md-kompatible Harness'],
    artifacts: ['CLAUDE.md', 'AGENTS.md', 'settings.json (hooks)', 'harness-guard.sh', 'skill.md-Bundles (Tier 0-2)'],
    regel1: RULE1,
  };
}
module.exports = {
  meta: { area: '85', id: 'harness_kit', name: 'Harness-Kit (Claude Code/Cursor/OpenClaw mit REGEL 1)', state: 'live' },
  actions: { status: () => status(), claude_md: () => claudeMd(), agents_md: () => agentsMd(), hooks: () => hooksSettings(), guard: () => guardScript(), skills: () => skillBundles() },
  status, claudeMd, agentsMd, hooksSettings, guardScript, skillBundles, download, RULE1, REFUSALS,
};
