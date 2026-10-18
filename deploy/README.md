# AURA Deploy Kit

| Datei | Zweck |
|---|---|
| `master-install.sh` | 1-Click-Install (Node 22, Repo, Boot, Health-Check) — **die eine Zeile** |
| `docker-compose.yml` | Docker-Start mit Daten-Volumes |
| `k8s.yml` | k3s/K8s-Manifest inkl. Health-Probes (`/api/health`) |
| `start_swarm.sh` | Swarm-Helfer (up/down/status) |

**Vollständige Anleitung für jeden Aspekt:** [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
— Bare Metal · systemd · Docker · k3s · Firebase · Reverse-Proxy/TLS ·
Umgebungsvariablen · Backup/Restore-Runbook · Monitoring · Hardening ·
Troubleshooting · Validierung (`node test/validate.js`).

Eine Zeile, ohne Schnickschnack (öffentliches Repo):

```bash
curl -fsSL https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh | bash
```

**Privates Repo (aktueller Zustand):** ohne Token liefert `raw.githubusercontent.com` **404** und es passiert nichts.

```bash
TOKEN=<github_pat_...>   # fein granular, nur "Contents: Read"
curl -fsSL -H "Authorization: Bearer $TOKEN" \
  https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh \
  | AURA_TOKEN="$TOKEN" bash
```
