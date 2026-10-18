# Setup — every part

> **Produktion/Deploy?** → [`DEPLOYMENT.md`](./DEPLOYMENT.md) — systemd, Docker, k3s,
> Reverse-Proxy, Backup-Restore, Monitoring, Hardening, Troubleshooting.

## Backend (required, everything else is a page on top)
```bash
node backend/server.js                 # :8080, all pages + APIs
```

## Docker / compose
`bash deploy/start_swarm.sh up|down|status` (web :8080 + backend :8090, healthchecks, read-only).

## 4-root-server collective
`/cluster` → enter IPs/roles → download kit.sh/playbook.yml/hosts.ini → `ansible-playbook -i hosts.ini playbook.yml` (the 1-click bind; k3s + firewall hardening).

## Telegram control
`/api/telegram/kit` or `/ops`: BotFather steps, token→secret manager, allowlist your chat, run `backend/src/lib/telegram_poller.js` on an egress machine with `AURA_URL`.

## Mini-bots
`/minibot` wizard → generates mini_bot.js wearing any hierarchy role.

## Models
`/deploy`: HF search (browser), Ollama 1-clicks, Modelfile `FROM hf.co/…`, Unsloth local lane (own hardware).

## Skills to any AI
`/hierarchy` or `/skills`: copy system prompt / skill.md / JSON into Claude Projects, GPT custom instructions, API system message, or harness skill folders.

## Config updates via file upload
`POST /api/config/upload {target, config}` with a JSON file; targets: yellowpages | departments | teams | skills. Audited; yellowpages/teams live immediately, others on restart.

## Firebase (original zip path)
README inside `extracted/AURA-Web-Deploy/` — `firebase deploy --only hosting`.
