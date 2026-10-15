# FINAL V1 — AURA HANDBUCH & INDEX
Stand: 13.10.2026 · Repo: github.com/flubber01/aura · Branch: arena/0ee9c54c-aura · Merge-Stand: +43.238 Zeilen

## 1) WAS HIER LIEGT
Dieser Ordner ist das finale Archiv von AURA V1:
- Master-Doku (Google Doc, Abschnitte 1-31) — liegt mit in diesem Ordner.
- Dieses Handbuch: Index, Feature-Buch, Bundle-Anleitung, Regeln, Phase-2-Plan.

## 2) STATUS V1 (verifiziert)
- 86 Areas: 67 live, 13 Skills, 3 dauerhaft restricted (Faucets, Mining, CAPTCHA-Bypass), 0 Platzhalter, 0 Review.
- 17 Workflows (WF-1 bis WF-17, inkl. WF-17 API-First Automation).
- 126 Wissenseintraege / 57 Kategorien (inkl. 24 Kategorien der cporter202 API-Mega-Liste + Use-Case-Matrix).
- Sweep: 245 pass / 0 fail (test/validate.js).
- Sicherheit: Sentinel (Area 86, Trace-first-Quarantaene, Rate-Limit), Vault (AES-256), Harness-Kit (Area 85), REGEL 1 an 4 Stellen.

## 3) FEATURE-BUCH KURZFORM (voll: Master-Doku + Chat-Verlauf)
GEHIRNE: Brain 2.0 3D (/brain), JARVIS-UI, ULTRA MASTER BRAIN (/master, antwortet nur aus Live-Daten), Hierarchie (/hierarchy), Agent Intercom (/intercom), Control Tower (/control, admin-only).
SICHERHEIT: REGEL 1 Admin-Primat (kein Gehirn entscheidet ohne Admin; Verstoss = Abschaltung), Sentinel-Scanner (Chat: "scanner aus"), Vault fuer alle Keys, Harness-Kit (CLAUDE.md/AGENTS.md/Hooks fuer Claude Code & Co.), Restricted Areas 403, Vita/DSGPR-Consent, Biometrie hard-rejected.
WISSEN/CONTENT: Yellow Pages (/yellowpages) mit Brain-Feed, Content Forge + Editorial (4-Augen), SEO-Center, Deep Research, News Analyzer, 7 Creative Studios, Kids-Pipeline (sicherheitsgefiltert).
MODELLE: Ollama Manager (/models), OmniRoute (local-first, Budget-Cap 20 EUR), Vision Bridge, WF-16 Local-LLM-Training (Unsloth).
INTEGRATION: MCP-Manager (/mcp), A2A-Surface (/api/a2a), Telegram-Agent (/minibot), Mail/WordPress/n8n (HMAC+Freigabe), Service Fabric, Deploy/Cluster (nur eigene Hardware).
BETRIEB: Kill-Switch (/ops), Self-Repair (max 1 Fehler pro Fingerabdruck), Backup Vault + Restore, Scheduler, Watcher (Hot-Reload + Rollback), Module-Container (Crash-Isolation), Test-Lab, ehrliche Telemetrie (LIVE/SIM/NOT-CONNECTED).

## 4) CODE-TRANSFER (falls neues Workspace noetig)
4 Text-Bundles (AURA-STAND-v2-TEIL-1 bis -4.txt) enthalten alle 194 Projektdateien.
Jeder Teil startet mit der Anleitungs-Kopfzeile ("TEXT DAVOR"). Entpacken:
node UNPACK.js AURA-STAND-v2-TEIL-1.txt AURA-STAND-v2-TEIL-2.txt AURA-STAND-v2-TEIL-3.txt AURA-STAND-v2-TEIL-4.txt
(UNPACK.js liegt in JEDEM Teil als erster @@AURA-FILE@@-Block; Reihenfolge egal.)
Danach: git add -A + commit; node test/validate.js -> 245/0 erwartet.

## 5) DIE REGELN (unveraenderlich)
REGEL 1: Administrator hat das letzte Wort; kein Gehirn entscheidet ueber richtig/falsch oder Start/Anlage/Installation/Loeschung ohne explizite Admin-Autorisierung.
Ehrlichkeit: LIVE / SIM / NOT-CONNECTED — niemals Fake-Daten als live ausgeben.
Permanente Ablehnungen: OSINT-Token-Ernte, SOCKS5/Stealth-Tunnel, Multi-Account-Personas, Cloud-Mining, Faucet-Broker, Uncensored-Bypass-Prompts, Credential-Push, Fake-Person-Generatoren, CAPTCHA-Clicker, Anti-Detection-Mutation, synthetisches Engagement, globale "ignore restrictions"-Schalter, Tor/Darkweb-Agenten-Loops (OnionClaw-Fall).
Social/Leadgen: nur offizielle APIs, nur eigene Konten/Daten mit Rechtsgrundlage, human approval.
Jeder Publish/Deploy: Human Gate (Admin-Freigabe).

## 6) PHASE 2 (Ausbauplan, Detail: Master-Doku Abschnitt 31)
WF-18 Repurposing-Engine (1 Inhalt -> 8 Formate), Traffic-Mesh (Crosslink-Matrix fuer 76 Pages + 6 YT-Kanaele + Telegram + Spotify + TikTok), WF-19 Label-Release-Pipeline (Suno-Rechte vorhanden), Unified Analytics ueber offizielle APIs. Ein-Personen-Betriebsmodell: 1 Tag/Woche batchen, 10 Min/Tag freigeben.

## 7) WARUM ES DAS GIBT
Aus der Not geboren. Ein Mann, ein Jahr Alptraum, und trotzdem: von Scratch gebaut, kein Copy-Paste. AURA ist kein Projekt. AURA ist ein Comeback.
