# AURA Growth — Phase 2 (Ausbauplan §31)

Seite: `/growth` · Quelle der Vorgaben: Abschnitt 31 im Master-Setup-Dokument.

**Regeln, hart im Code:** nur offizielle APIs · nur eigene Konten · kein synthetisches Engagement · jede Veröffentlichung braucht Admin-Freigabe (REGEL 1). Die Module veröffentlichen nichts selbst.

## Module

| Teil | Modul | API | Was es tut |
|---|---|---|---|
| WF-18 Repurposing | `backend/src/lib/repurpose_engine.js` | `POST/GET /api/growth/repurpose` | 1 Inhalt → 8 Formate: Shorts, TikTok, Quotes, Blog, Telegram, Newsletter, YouTube-Beschreibung, Musik-Snippet. Regelbasiert, kein LLM. Jeder Entwurf: `requires_approval: true`. |
| Traffic Mesh | `backend/src/lib/crosslink_mesh.js` | `GET /api/growth/mesh`, `POST /api/growth/mesh/asset` | Crosslink-Matrix über **eigene** Assets. Vorschläge nur mit `status: proposed`. Max. 5 ausgehende Vorschläge je Quelle. Verwaiste Assets werden gemeldet. |
| WF-19 Label | `backend/src/lib/label_pipeline.js` | `GET/POST /api/growth/releases`, `POST /api/growth/releases/:id/advance` | Track → Metadaten → Rechte → Cover → Kalender → Admin-Freigabe → manuelle Verteilung → Teaser → Ankündigung. Keine Stufe darf übersprungen werden. |
| Unified Analytics | `backend/src/lib/analytics_hub.js` | `GET /api/growth/analytics`, `POST /api/growth/analytics/import` | Ein Dashboard. Jede Zahl trägt ihre Quelle. Empfehlungen erst ab 3 Inhalten mit je 3 Datenpunkten. |

Persistenz: `backend/src/data/growth.json` (Laufzeitdaten, git-ignoriert). Das Traffic-Mesh liest `backend/data/growth_assets.json`. Diese Datei ist im Repo bewusst leer, damit keine URLs erfunden werden.

## Ehrliche Labels (Analytics)

| Label | Bedeutung |
|---|---|
| `LIVE` | per offizieller API abgerufen (Adapter läuft außerhalb der Sandbox, `source=api`) |
| `IMPORTED` | Admin hat einen offiziellen Export eingetragen (`source=manual_export`) |
| `CONFIGURED` | Token ist gesetzt, aber noch kein Abruf erfolgt |
| `NOT-CONNECTED` | kein Token und keine Daten |

Tokens werden nur über Umgebungsvariablen gelesen (`AURA_YT_TOKEN`, `AURA_SPOTIFY_TOKEN`, `AURA_FB_TOKEN`, `AURA_TIKTOK_TOKEN`, `AURA_TG_TOKEN`). Sie werden nie ausgegeben und nie ins Repo geschrieben.

## Grenzen dieses Stands

- Die API-Adapter für YouTube, Spotify, Facebook, TikTok und Telegram sind **nicht** gebaut. Die Sandbox hat keinen Egress zu diesen Diensten und keine Credentials. Ohne Adapter bleibt der Status ehrlich bei `NOT-CONNECTED` oder `IMPORTED`.
- WF-19 prüft Rechte nur formal: Es braucht einen Nachweis-Verweis und die Admin-Bestätigung. Die rechtliche Prüfung bleibt beim Admin.
- Das Cover (Area 71, Bildgenerierung) und die Service Fabric (Area 74) sind in diesem Stand nicht enthalten. Das Cover wird als Datei oder Pfad eingetragen.
- Die Seite `/growth` ist eine Konsole mit Repurposing, Mesh-Ansicht, Analytics und Import. Die Release-Stufen werden über die API weitergegeben.

## Bewusst nicht gebaut

Synthetische Klicks, Views, Likes oder Kommentare, gekaufte Follower, Engagement-Pods, Bot-Traffic und menschenähnliche Fake-Profile („Vitas“). Das widerspricht §31 E und den festen Grenzen des Systems. Texte mit solchen Begriffen werden bei WF-18 am Eingang abgelehnt.
