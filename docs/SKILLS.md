# Skill-Katalog — `/skills`

Stand: 2026-10-13 · Branch `arena/3b63f072-aura` (noch nicht in `main`)

## Was drin ist

`backend/data/skill_catalog.json`: **232 Einträge** aus zwei öffentlichen Quellen, nur Metadaten (Name, Kurzbeschreibung, Kategorie, Lizenz, Link).

| Quelle | Anzahl | Lizenz |
|---|---|---|
| Hermes · eingebaut (NousResearch/hermes-agent, `skills/`) | 58 | MIT |
| Hermes · optional (NousResearch/hermes-agent, `optional-skills/`) | 155 | MIT |
| Anthropic · Skills (anthropics/skills) | 19 | je Skill, z. B. „Proprietary“ bei docx |

Status: `verfuegbar` 218 · `pruefen` 7 · `gesperrt` 7.

## Was NICHT drin ist

- **Kein Skill-Text.** Der Katalog speichert keine SKILL.md-Inhalte. Die Lizenz mancher Anthropic-Skills verbietet das Weiterverteilen.
- **Keine Community-Skills.** Der offizielle Hub listet rund 100.000 Skills, davon etwa 98.000 aus externen Registries (ClawHub, skills.sh). Die lassen sich nicht sauber prüfen und stammen von fremden Entwicklern. Sie kommen nur nach Einzelprüfung und Sicherheitsscan dazu.
- **Keine Tools als Code.** Die Tools von Hermes (Web-Suche, Bildgenerierung, Browser) sind eigene Module mit eigener Sicherheitsprüfung und kommen nicht über diesen Katalog.

## Einstufung

Der Generator `scripts/build_skill_catalog.js` ordnet automatisch ein:
- **gesperrt:** Kategorie `payments` (Zahlungen ohne Freigabe), Umgehung (bypass, captcha, stealth), Trading, OSINT, Credential-Sammlung, Bot-/Mining-Themen, Checkout.
- **pruefen:** Krypto/Wallet, Glücksspiel, Erwachsenen-Inhalte, Veröffentlichung/Deploy (braucht Admin-Freigabe).
- **verfuegbar:** alles andere. Das heißt nur „auf der Liste“, nicht „installiert“.

Jeder Eintrag hat `installed: false`. Es wird nichts automatisch installiert oder ausgeführt.

## Neu bauen

```bash
git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /tmp/hermes
git clone --depth 1 https://github.com/anthropics/skills.git /tmp/anth
node scripts/build_skill_catalog.js /tmp/hermes /tmp/anth
node --test test/skill_catalog.test.js
```

## Routen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/skills` | Seite mit Suche und Filter |
| GET | `/api/skill-catalog?q=&source=&status=&category=&limit=` | Katalog als JSON (nur Lesen) |

Hinweis: `/api/skills` gehört weiterhin zur bestehenden Skill-Registry (13 Einträge) und ist unverändert.
