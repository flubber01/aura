# Integrations & Schnittstellen

## Wired skills (safety-reviewed) — see /skills & data/skills.json
hyperframes · impeccable · agent-reach (read-only) · openshell · hindsight · voicebox ·
unsloth · ui-ux-pro-max · superpowers · awesome-claude-skills · karpathy-skills · ECC · official plugin dir.

## MCP Schnittstelle
Register tools via area 20 (explicit grants, schema-bound args, disable switch, audit).
Config generator on /deploy produces Claude-Desktop/generic JSON using `backend/src/lib/mcp_bridge.js` (stdio line protocol → backend).

## Mail Schnittstelle (area 57)
compose → human approval → provider adapter OUTSIDE sandbox (Gmail OAuth / own IMAP / Telegram relay). No bulk outreach.

## Social chain (WF-7)
official APIs only (Bluesky, Mastodon, Telegram, YouTube, WordPress, GitHub); specialists draft+review; mandatory gates audited; refusal otherwise.

## Notebooks
`/api/notebook-export` (.md of live state) → NotebookLM/Jupyter/Observable.

## Link directory
`/yellowpages` (57 entries incl. free-for.dev, thereisanaiforthat, n8n, Kaggle, Vercel, k3s…).
Camoufox listed ONLY for own-site fingerprint-leak audits; evasion use refused.

## Refused (permanent)
token harvest/validate · SOCKS/CGNAT ban-evasion · stealth multi-account outreach ·
CAPTCHA/platform bypass · third-party mining · human impersonation / synthetic biometrics.
