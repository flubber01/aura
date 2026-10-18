# AURA — Status aller Bereiche (gemessen, nicht geschätzt)

Stand: 2026-10-18 · Branch `arena/3f656e82-aura` (auf main `6267206`, PR #5 gemergt) · Messmethode: Code-Inspektion + Live-Aufrufe gegen den laufenden Server.

Legende:
**LIVE** = funktioniert im Betrieb · **VERWALTUNG** = Datenhaltung/Planung ohne externen Aufruf ·
**GERÜST** = Schema/Struktur vorhanden, keine Funktion · **NEU** = in dieser Runde gebaut

---

## Kernbefund

> Im gesamten Projekt machen **nur 3 Dateien** echte externe Aufrufe:
> `notify.js`, `telegram_agent.js`, `telegram_poller.js` (alle Telegram/Notfall).
> Alles andere — Musik, Distro, Social, Werbung — ist **Verwaltungs- und Planungsschicht**.
> Es wurde nie eine echte Verbindung zu Spotify, YouTube, Meta, TikTok oder einem Partner aufgebaut.

Das ist keine Schwäche der Struktur, sondern der ehrliche Zustand: die Datenmodelle, Gates und Freigaben
sind da, die Anbindung fehlte. Genau die ist jetzt mit den **Connectoren** entstanden.

---

## Die Bereiche im Einzelnen

| # | Bereich | Dateien | Zustand | Was fehlt konkret |
|---|---|---|---|---|
| 1 | **AURA OS** | `aura_os.js` (115 Z.), `aura_os_plus.js` (89 Z.) + `/aura-os` | **LIVE** | nichts Kritisches — lokale Arbeitszellen-/Launchpad-Schicht |
| 2 | **Label / Distro** | `label_desk.js`, `label_pipeline.js`, `release_gate.js`, `studio_release.js` | **VERWALTUNG** | kennt Spotify/Apple/Deezer/TIDAL/Amazon/YouTube als **Namen**, führt aber **keinen einzigen echten Aufruf** aus. → über Connectoren (`DISTRO`) anbindbar |
| 3 | **Musik-DAW** | `music_studio.js` | **GERÜST** | kein Audio: **keine** Referenz auf ffmpeg/wav/mp3/Render/AudioContext. Enthält `groove`, `orchestrate`, `rng` = Kompositions-**Planung**, kein Ton |
| 4 | **Skills + Prompts** | `skills_registry.js`, `skill_catalog.js`, `data/skills.json`, `music_skills.json`, `skill_catalog.json` | **LIVE** (Katalog) | Katalog + Registry stehen; Skills laufen in Area-67-Containern |
| 5 | **Fan-Seiten** | — | **FEHLT** | keine Fanpage-Logik im Code. Nächster sinnvoller Weg: über `web_empire` als Seiten-Typ „FAN" führen |
| 6 | **API-Schlüssel** | `vault.js` (AES-256-GCM) + **`connectors.js` (neu)** | **NEU** | 22 Anbieter angebunden, Status ehrlich, Werte nur im Vault |
| 7 | **3rd-Party-Skills** | `mcp_manager.js` (204 Z.), `mcp_bridge.js`, `mcp_ingestion_core.js` | **LIVE, begrenzt** | stdio nur mit Binary-Allowlist, sonst `blocked` — Absicht |
| 8 | **„Open Studio"** | = **Studio Command** `/studio-command` (`studio_command.js`) | **LIVE** (Planung) | Film/Video-Handwerk: Shotlists, Call Sheets, Delivery-Manifeste. **Kein DAW, kein Renderer** |
| 9 | **Workflows / Pipelines** | `workflow_builder.js`, `channel_pipelines.js`, `media_pipeline.js`, `label_pipeline.js`, `youtube_pipeline.js` | **VERWALTUNG** | Abläufe definiert; Ausführung endet an der Freigabe |
| 10 | **Routinen / Cross-Linking** | `routine_control.js`, `crosslink_mesh.js`, `crosslink_policy.js` | **LIVE** | Schalter pro Routine, Cross-Link-Regeln mit Policy |
| 11 | **Auto Fetch / Rewrite / Post** | `catalog_ingestor.js`, `content_forge.js` | **TEIL** | Fetch ✅ · Rewrite ✅ (3 Stellen) · **Post: ❌ kein `fetch(`/`https://`** → Entwürfe entstehen, gehen aber nicht raus. Über Connectoren nachrüstbar |
| 12 | **Social-Kanäle steuern** | `social_control.js`, `channel_pipelines.js`, `omnichannel_dispatcher.js` | **VERWALTUNG** | 22× `post`, 15× `queue` — aber kein externer Aufruf. Dispatcher meldet ehrlich `NOT-CONNECTED`. → Connectoren `SOCIAL` |
| 13 | **Paid Plan / Werbung** | `creator_revenue.js` | **VERWALTUNG** | Umsatz-/Plan-Logik; `ADS`-Connectoren (AdSense, Google Ads, Meta Ads) jetzt anbindbar |
| 14 | **Schnittstelle für Seiten-Projekte** | **`web_empire.js` (neu)** | **NEU** | Registry, Freigabe, Link-Slots, ehrliche Messwerte — genau die Spezifikation aus den Google Docs |

Zusätzlich in dieser Runde: **`watchdog.js`** (Dienst-Aufsicht, 3-Strike) und **Steuerzentrale** (`/api/control-center`).

---

## Connectoren im Detail (neu)

22 Anbieter in 6 Kategorien. Alle über **offizielle APIs**, alle auf **eigene Kanäle** begrenzt.

| Kategorie | Anbieter | Zweck |
|---|---|---|
| **DISTRO** | Spotify, Apple Music, Deezer, TIDAL, SoundCloud | eigene Releases, Hörerzahlen |
| **SOCIAL** | YouTube, Meta (FB+IG), TikTok, X, LinkedIn, Telegram | eigene Kanäle posten + messen |
| **ADS** | AdSense, Google Ads, Meta Ads | eigene Kampagnen, eigenes Budget |
| **AFFILIATE** | Awin, Digistore24, Amazon PartnersNet, generischer Postback | Partner mit **offizieller API** bzw. rechtmäßigem Postback |
| **SITE** | WordPress, GA4, Matomo | eigene Seiten + eigene Messwerte |
| **AI** | OpenRouter | Cloud-Modelle mit Budget-Deckel |

### Status-Logik (ehrlich)

| Status | Bedeutung |
|---|---|
| `LOCKED` | `AURA_VAULT_KEY` fehlt → es kann **nichts** gespeichert werden. Antwort enthält die Anleitung |
| `NOT-CONNECTED` | Pflichtschlüssel fehlen |
| `PARTIAL` | alle Pflichtschlüssel da, optionale fehlen |
| `CONNECTED` | Schlüssel liegen im Vault — **ausdrücklich NICHT „getestet"** |
| `VERIFIED` | erst nach erfolgreichem echtem Testaufruf (noch nicht implementiert → `test()` sagt das ehrlich) |

### Sperrliste

**12 konkrete Dienste** aus der Rechercheliste sind dauerhaft gesperrt, plus **19 Muster**:
`followerfabrik · likesandmore · echtestreamskaufen · followercenter · followerpuls · socialfanclick ·
edenboost · getfans · socialboss · useviral · stormlikes · sidesmedia` → alle `403`.

Grund steht in der Spezifikation selbst: *„Dienste oder Links, die Follower, Likes, Views, Klicks oder
sonstiges künstliches Engagement verkaufen, werden nicht als Traffic-Quelle, Automatisierung oder
Affiliate-Workflow eingebunden."*

---

## Wo Schlüssel herkommen (je Anbieter)

| Anbieter | Portal | Was du holst |
|---|---|---|
| Spotify | developer.spotify.com/dashboard | Client ID + Client Secret |
| YouTube | console.cloud.google.com | API Key (+ OAuth Refresh für Uploads) |
| Meta | developers.facebook.com | App ID/Secret + Page Access Token |
| TikTok | developers.tiktok.com | Client Key + Secret |
| X | developer.x.com | API Key + Secret |
| LinkedIn | developer.linkedin.com | Client ID + Secret |
| Apple Music | developer.apple.com | MusicKit Token |
| Deezer / TIDAL / SoundCloud | jeweiliges Developer-Portal | App ID/Secret |
| AdSense / Google Ads | Google Ads Console | Publisher ID / Developer Token |
| Awin / Digistore24 / Amazon | Partner-Portal | API Token bzw. Access Keys |
| WordPress | eigene Seite → Benutzer → Application Passwords | Passwort |
| GA4 / Matomo | Cloud Console / eigene Matomo-Installation | Property ID + Service JSON / URL + Token |
| OpenRouter | openrouter.ai/keys | API Key |

**Wichtig:** `AURA_VAULT_KEY` vorher in `deploy/.env` setzen — sonst bleibt der Vault `LOCKED`
und es lässt sich kein einziger Schlüssel speichern (der Server sagt das dann auch so).

---

## Nächste Schritte (in dieser Reihenfolge)

1. **Content-Pipeline verkettend schließen**: `content_forge`-Entwurf → Connector → Freigabe → Post.
   Damit ist „automatisches fetching, rewriting und posting" vollständig — für eigene Kanäle.
2. **Echte Testaufrufe** je Connector implementieren (`test()` steht auf `UNVERIFIED`, kein Blindflug).
3. **Musik-DAW**: entweder echten Renderer anschließen (ffmpeg) oder ehrlich als Planungsschicht benennen.
4. **Fan-Seiten** als Seiten-Typ in `web_empire` aufnehmen.
5. **Restliche Google Docs** abgleichen: FINAL V1 Handbuch, Master Setup, Agentic Skill, SUPERV1.

---

# Nachtrag 2026-10-16 (zweite Runde)

## Neu gebaut und live geprüft

| Bereich | Datei | Zustand | Beleg |
|---|---|---|---|
| **Musik-Renderer** | `music_render.js` | **LIVE — echtes Audio** | 6 Stile, 16-Bit-PCM-WAV, peak 0.84 / RMS 0.17, Stems, seed-deterministisch. Vorher: **kein einziger Audio-Ausgabepfad im Projekt** |
| **Songbook (Suno-Arbeitsweise)** | `songbook.js` | **LIVE** | Prompt → Ton in einem Aufruf (8,2 s / 703 KB live gemessen), Varianten, Verlängern, Stems, Text, Playlists, Bibliothek, Freigabe-Pflicht |
| **Artist-Konten / Multi-Login** | `artist_accounts.js` | **LIVE** | scrypt-Hashes (kein Klartext), zwei Artists gleichzeitig angemeldet, getrennte Sicht, 8 Fehlversuche → Sperre |
| **Video-Werkstatt** | `video_studio.js` | **LIVE** | 26 Effekte; live gerendert: 640×360 → **720×720**, 114 KB, dekodierbar. Filterprüfung findet fehlende Filter (dieser Build: `drawtext`) statt blind zu rendern |
| **Ressourcen-Katalog** | `resources.js` | **LIVE** | 52 Einträge in 8 Kategorien, inkl. `free-for-dev`, Awesome-Listen, Painterly, ffmpeg-Doku |

## Antworten auf die offenen Punkte

| Frage | Antwort |
|---|---|
| Eigener Musik-Distributeur | **Grundlage steht:** Connectoren `DISTRO` (Spotify, Apple, Deezer, TIDAL, SoundCloud) + `label_desk`/`label_pipeline` + Songbook. Was fehlt: echter Testaufruf je Anbieter (steht auf `UNVERIFIED`) |
| Social-Managing (Sabr47) | **Kanäle je Artist anlegbar**, Status kommt ehrlich aus den Connectoren (`instagram` → `meta`). Posten selbst noch nicht, weil kein Schlüssel + kein Testaufruf |
| Multi-Login für Artists | **fertig** |
| Video-Tools und Effekte | **fertig und gerendert** — 24 von 26 Effekten in diesem Build verfügbar, Text/Wasserzeichen brauchen ffmpeg mit freetype |
| Suno nachgebaut | **Arbeitsweise ja** (Prompt, Tags, Text, Varianten, Verlängern, Stems, Bibliothek, Playlists). **Dienst nein** — Suno/Udio haben keinen offenen offiziellen API-Zugang und werden ehrlich als `NOT-API` geführt. KI-Musik läuft über `replicate`, `stability`, `elevenlabs` mit eigenem Schlüssel |
| Chat der Agenten untereinander | **bestand schon** — `/api/intercom/status · /channels · /messages · /post` |
| Skills von der Hermes-Seite | **offen** — `hermes_bridge.js` hat nur Manifest/Preflight (69 Zeilen), noch keine Skill-Schicht |
| GitHub-Brauchbares (free-for-dev, Paint-Tools …) | **Katalog steht** (52 Einträge). Aufnahme = Nachschlagewerk, nicht Einbindung |

## Nächste Schritte

1. **Hermes-Skill-Schicht** aufbauen (Brücke zu den Unter-Brains mit echten Fähigkeiten).
2. **Echte Testaufrufe** je Connector (`test()` von `UNVERIFIED` auf geprüft).
3. **Posten verkettend schließen**: Songbook-Entwurf → Connector → Freigabe → Post auf eigene Kanäle.
4. **Distribution**: Release aus dem Label-Desk an einen DISTRO-Connector übergeben.

---

# Dritte Runde 2026-10-16 — Ausbau nach der Wunschliste

Gemessen nach dem Ausbau: **Suite 886 PASS / 0 FAIL (27 Dateien)** · **Routen-Smoke 533 PASS / 0 FAIL (533 Routen)** · `validate.js` **335 / 0**.

## Was in dieser Runde dazukam

| Wunsch | Modul | Was es wirklich tut | Beleg |
|---|---|---|---|
| Kampagnen-Planer Pitch→Release | `campaign_planner.js` | 13 Stufen rückwärts vom Releasetag, 6 davon mit Menschen-Pflicht | live: 13 Stufen, Freigabe ohne Mensch abgelehnt, mit Mensch weiter |
| Pipelines | in `campaign_planner` | Kanäle aus dem Connectoren-Katalog, Lücken werden benannt | live: Lücken `social`, `promo` gemeldet |
| Kalender | `calendar.js` | sammelt aus Kampagnen/Tagesplan/Songbook/Routinen, ICS-Export | live: 14 Termine, 6 Freigaben, 2148 B ICS |
| Benutzerhandbücher | `handbooks.js` | baut das Buch aus dem laufenden System | live: 150 Module, 150 ladbar, 111 Bereiche, 40 Dokumente, 32 105 Zeichen Markdown |
| Tonstudio-Plug-ins | `daw_plugins.js` | 15 Effekte, Kette wird sortiert + geklemmt, Mastering ans Ende | live: Reihenfolge highpass→compressor→loudnorm, 9000 Hz → 800 Hz geklemmt |
| Töne/Quellen lizenzfrei | `royalty_free.js` | 39 Quellen mit nachlesbarer Lizenz | live: 39 kommerziell nutzbar, CC-BY verlangt Namensnennung |
| Sprachfunktion | `speech.js` | Sprechen/Hören: Motoren werden gesucht, nicht behauptet | live: Modus `NOT-CONNECTED`, Sonntagsauftrag wartet auf Motor |
| Video-Abteilung | `video_department.js` | 8 Arbeitsplätze, nur Video, Abnahme nur mit Messwerten | live: Fremdauftrag abgelehnt → Tonstudio; Abnahme ABGENOMMEN mit 5 Messpunkten |
| Augen („now u have eyes") | `eyes.js` | echte Pixelmessung: PNG selbst dekodiert (zlib + Filter) | live: 64×64 Testbild → Helligkeit 148, Kontrast 88, Sättigung 21 |
| Medien-Import | `media_import.js` | Plattform erkennen, Rechte benennen, Entwurf machen | live: YouTube → EMBED, unbekannte Seite → RECHTE_UNKLAR |
| Agenten rufen Agenten | `agent_calls.js` | Ruf-Tiefe 3, Zyklen gestoppt, Sperrliste, Protokoll | live: `handbooks.status` 24 ms ok; `vault.status` gesperrt |
| Gehirn-Konsole | `brain_console.js` | 16 Köpfe, Stichwort → zuständiger Kopf, keine erfundenen Antworten | live: „wann muss der release fertig sein" → campaign; 3/3 richtig geroutet |
| Letztes Wort des Menschen | `human_final.js` | 8 Pflicht-Arten, Entscheidung nur mit `human:true` **und** Namen | live: Tür `zu` → nach Auraos-Freigabe `offen` |
| Telegram + Selbst-Anruf | `self_call.js`, `telegram_poller.js` | 4-Sprossen-Leiter bis zum Anruf | live: NUR MELDUNG (kein Anbieter), Handanruf-Sprosse immer offen |
| Angriff: detecten vor Rauswurf | `security_response.js` | DETECT → ISOLATE → REVIEW → EJECT | live: 8 Belege → Fall, isoliert (umkehrbar), Ausschluss erst nach Review **und** Mensch |
| Plug-ins | `plugins.js` | Manifest, Rechte, Prüfsumme, Register | live: Prüfsumme `4b7038714ac34d63`, installieren ohne Mensch verweigert |
| Avatar wie Julian-Goldie-Art | `avatar_studio.js` | Kunstfigur mit Kennzeichnungspflicht, 8-teilige Podcast-Folge | live: „Nova" (10,4 min, 8 Kapitel); Nachbau echter Personen abgelehnt |
| Bezahlpläne | `billing_plans.js` | 4 Stufen, nachrechenbare Rechnung, Belege statt Abbuchung | live: Creator 2 Plätze/12 Mon. = 455,82 € brutto; Rechnung `2026-00001`, abgebucht `false` |
| Werbung | `advertising.js` | eigene Flächen + Prognose, Klickkauf gesperrt | live: Klickkauf abgelehnt; 300 € → 60 000 Einblendungen als PROGNOSE |
| Hermes-Skills | `hermes_bridge.js` | 5 Fähigkeiten, einzeln vergeben, befristet, entziehbar | live: vergeben bis 30.10., Nutzung `true` → nach Entzug `false` |

## Zwei echte Fehler, die dabei gefunden und behoben wurden

1. **`telegram_poller.js` beendete fremde Prozesse.** Beim Laden stand dort ein `process.exit(1)` und ein Dauer-Poller auf oberster Ebene — jeder Prozess, der das Modul nur einband (z. B. der Handbuch-Generator), starb still. Jetzt: Poller bleibt ohne Token **aus**, `start()`/`stop()`/`status()`, Direktaufruf startet ihn weiterhin.
2. **Agenten konnten sich ihre Freigabe selbst holen.** `human_final.decide` war für Agent-zu-Agent erreichbar. Jetzt gibt es eine Modul-Sperrliste (Freigabe-Tür, Steuerzentrale, Vault, Geld, Sicherheits-Ausschluss) und eine Handlungs-Sperrliste (`publish`, `release`, `decide`, `delete`, …).

## Ehrlich bleibt ehrlich (nicht gebaut, weil es das nicht gibt)

- **Suno/Udio**: kein offener offizieller API-Zugang → `NOT-API`. Nachgebaut ist die Arbeitsweise.
- **Sprachmotor / Whisper / piper**: nicht installiert → `NOT-CONNECTED`, Aufträge warten sichtbar auf `WAITING_FOR_ENGINE`.
- **Anruf**: ohne Twilio/sipgate/GSM-Gateway im Vault gibt es **keinen** Anruf, nur die Meldung.
- **Zahlungen**: ohne Anbieter-Schlüssel wird nichts abgebucht; Rechnungen sind Belege.
- **Werbung**: keine Klick-/Reichweiten-Erzeugung — gesperrte Wünsche werden abgelehnt, nicht kommentiert.
- **Bildinhalte**: AURA misst Bilder (Helligkeit, Kontrast, Farbstich, Flächen), benennt aber nicht, was zu sehen ist — dafür fehlt ein Bildmodell.

## Nächste Schritte

1. Sprachmotor auf dem Server installieren (piper/espeak-ng + whisper.cpp) → Podcast/Avatar wird hörbar.
2. Echte Testaufrufe je Connector (`UNVERIFIED` → geprüft), damit Distribution belastbar wird.
3. Bildmodell anbinden (Ollama llava oder Anbieter mit Schlüssel) → Augen können Inhalte benennen.
4. Push + PR in einer neuen Session.

---

# Vierte Runde 2026-10-16 — Seiten, Speicher, Analyse, Überwachung, Rollen, Geräte, Startvideo, Zahlungen

Alle dreizehn Punkte der vierten Wunschliste sind gebaut, alle Zahlen hier sind gemessen (Kurz- und TAP-Tests, Smoke, `validate`, zusätzlich lebende Aufrufe gegen `:8080`).

## Neu in dieser Runde (13 Bausteine + 3 Einhängungen)

| Bereich | Datei | Was wirklich drin ist |
|---|---|---|
| Externe Geräte an der DAW | `backend/src/lib/daw_devices.js` | 8 Geräteklassen, ehrliche Abfrage von `/proc/asound`, `aconnect`, `arecord/aplay`, `jack_lsp`; Anlernen eines Reglers an einen **echten** Effektparameter, 7 Bit/14 Bit/Pitch Bend, Kurven linear/log/exp, Noten- und Latenzrechnung |
| Gestaltete Bedienelemente | `backend/src/lib/ui_kit.js` | Eigene Gestaltung (kein Fremd-Rahmenwerk, keine externen Dateien): Regler, Fader, Pegel, Schalter, Kacheln, Kennzeichen, Tabelle, Reiter, Hinweis; Bedienung mit Maus, Finger, Rad, Tastatur; 11 Bausteine, helle und dunkle Anzeige |
| Nutzerbereich projektweit | `backend/src/lib/user_area.js` | Rollen `owner/admin/artist/editor/viewer`, Rechteprüfung `check()`, Einstellungen, Übersicht mit 8 Kacheln aus anderen Modulen; bei `decide`, `publish`, `spend` immer `human_required: true` |
| Anmeldung über Sozialkanäle | `backend/src/lib/social_login.js` | 9 Anbieter, echte Ablaufprüfung (`state`, `nonce`, PKCE S256), Trennen nur mit Mensch; ohne Schlüssel im Vault ehrlich `NOT-CONNECTED` mit fertiger Adress-Vorschau |
| Messenger mit Künstlern | `backend/src/lib/artist_messenger.js` | Kanäle direkt/crew/brainstorm, Runden ideen → bewerten → ergebnis, eine Stimme pro Person, Ergebnis-Zwang, Brücke Ergebnis → Entwurf (Song/Video/Kampagne/Inhalt) |
| Ausgiebige Analyse | `backend/src/lib/analytics_forecast.js` | 6 Quellen, Verkehrsauswertung inkl. Nebenprodukten, Marktcharts (Steiger/Faller/Neueinstiege), Vorhersage mit 3 Verfahren, immer Spanne, Vertrauensangabe und Vorbehalte; unter 7 Messpunkten wird abgelehnt |
| Auto-Überwachung | `backend/src/lib/auto_monitor.js` | 11 Regeln mit offenen Schwellen, Durchlauf mit Befund und Urteil, ernste Befunde gehen an die Alarmleiter; liest nur |
| Speicher für jede Erstellung | `backend/src/lib/content_store.js` | Ablage `JAHR/MONAT/ART`, Fassungen statt Überschreiben, Prüfsummen je Datei, Suche/Filter, Sammelausgabe mit Manifest, Aufräum-Vorschläge **ohne** Löschen, Veröffentlichen nur mit Mensch |
| Support / Kontakt | `backend/src/lib/support.js` | Nummern `A-0001…`, 7 Kategorien, 4 Dringlichkeiten, 5 Zustände, automatische Belege (4 Positionen) und Nie-Liste (5 Positionen), SICHERHEIT/dringend → Alarmleiter |
| Startvideo (10 s) | `backend/src/lib/boot_intro.js` | Bilder Pixel für Pixel gezeichnet (eigene 5×7-Schrift, Ringe, Pegelband, Fortschritt), Ton aus dem eigenen Musik-Renderer, ffmpeg kodiert zu MP4; ohne ffmpeg ehrlich `BLOCKED_NO_FFMPEG` |
| Seiten-Projekte + Server-Teil | `backend/src/lib/site_projects.js` | 5 Bauarten, 8 Pflichtpunkte, Prüflauf (Verzeichnis, Port, Domain, Startbefehl), Deploy-Paket mit nginx-Block, Dienst-Datei und Befehlen; Übernahme der Web-Empire-Seiten. AURA schreibt **nicht** in fremde Systeme |
| Hermes im ganzen Prozess | `backend/src/lib/hermes_process.js` | 12 Abläufe, 51 Stufen, 11 Menschenschwellen; jede Stufe nennt die Rolle (mitlesen, recherche, vorschlag, beurteilung, bedarf, schweigen) und die nötige Fähigkeit — ohne Verleihung wird Hermes übersprungen, nicht heimlich tätig |
| Zahlungsdienstleister | `backend/src/lib/payment_providers.js` | 19 Wege mit Richtwert-Gebühren und Verbindungszustand, 6 Zwecke, Empfehlung mit Punktzahl und Gründen, Zahlungsplan; diese Datei bucht **nie** ab |
| Einhängungen | `songbook.js`, `video_studio.js`, `avatar_studio.js` | Jede Erstellung landet automatisch im Speicher (Fassung 1 mit Prüfsumme) |

Routen dazu (in `backend/src/routes/api_areas.js`, Muster wie bisher: GET erklärt, POST ist ohne Admin-Token gesperrt, Body wird einmal gelesen):
`/api/support/*` · `/api/store/*` (umbenannt von `/api/content/*`, weil dieser Pfad schon belegt war) · `/api/analytics/*` · `/api/monitor/*` · `/api/messenger/*` · `/api/users/*` · `/api/social/*` · `/api/daw/*` · `/api/design/*` · `/api/intro/*` · `/api/projects/*` · `/api/hermes/flow/*` · `/api/payments/*`

## Gemessene Zahlen

- **Tests:** 28 Dateien · **1007 PASS / 0 FAIL** (845 aus Kurz-Zusammenfassungen + 162 in TAP-Form)
- **Routen-Smoke:** **636 PASS / 0 FAIL / 0 WARN** (636 Routen; vorher 540 → +96)
- **`validate.js`:** **335 pass / 0 fail**
- **`api_areas.js`:** 581 eindeutige `p === '/api…'`-Pfade, keine Doppelbelegung mehr

## Lebende Belege (`:8080`, 16.10.)

- **Startvideo:** `DONE` · 10 Sekunden · 240 Bilder · 707 KB · 4075 ms · Ton `cinematic` — Datei `backend/src/data/intro/out/intro-8ae4c9.mp4`; eine Vorführkopie liegt als `intro-demo.mp4` (743.606 B) und `intro-vorschau.png` (230.712 B) im Projektstamm, **nicht** im Git.
- **Speicher:** `cs-fdf74433` mit echter Datei (1.191.424 B) abgelegt, Fassung 2 mit zweiter Datei; Veröffentlichen ohne Mensch abgelehnt („Veröffentlichen braucht einen Menschen"), mit `human: true` erlaubt (`ENTWURF → VEROEFFENTLICHT`); Sammelausgabe mit Prüfsumme `60539857094847d1…`.
- **Messenger:** Kanal `ch-a824739c`, Idee „Schlager-Piano über 808-Bass", Runden `ideen → bewerten → ergebnis`, Sieger mit 5 Punkten, Doppelstimme abgelehnt („hat diese Idee schon bewertet — eine Stimme pro Person"), Entwurf → `song-f7a2e6de`.
- **Support:** `A-0004` mit 4 Belegen und 5 Positionen auf der Nie-Liste; `A-0001…A-0003` inkl. SICHERHEIT/dringend → Alarmleiter `GEMELDET`; Antwort setzt auf `IN_ARBEIT`; 5 Kontaktwege.
- **Analyse:** 20 Tage echte Messwerte (4110 Aufrufe, Nebenprodukt `vergleich-2026`), Trend `SEITWÄRTS`, Wachstum −0,469, Vorhersage 4 Wochen **0–229 Aufrufe/Tag** mit 3 Verfahren und 3 Vorbehalten.
- **Geräte:** `learn` bindet `CC 74` an `daw_plugins.reverb.decay`, `apply` ergibt `{reverb:{decay:0.72}}`, Note 60 = `C4`/261,63 Hz; Systemabfrage meldet auf diesem Rechner ehrlich, dass kein Studio-Gerät hängt.
- **Rollen:** `viewer` darf nicht entscheiden (`allowed: false`, `human_required: true`), Übersicht mit 8 Kacheln, Einstellungen (`language`, `theme`) gespeichert, ungültiger Wert abgelehnt.
- **Projekte:** Übernahme aus dem Web-Empire → Projekt `casino-toplist`, Bereitschaft **13 %** (nur die Einwilligung ist belegt, TLS/Sicherung/Monitoring bleiben offen).
- **Zahlungen:** Empfehlung für Abos: SEPA mit 77 Punkten; `stripe`-Zahlung `NICHT AUSGELÖST` — gesperrt durch fehlende Vault-Schlüssel **und** fehlende Freigabe, Gebühr 0,70 €, `charged: false`.
- **Selbstüberwachung:** 11 Regeln geprüft, 2 Befunde („Sprachmotor fehlt", „Keine Studio-Geräte").
- **Hermes-Ablauf:** `song` läuft 6 Stufen und hält bei „Veröffentlichung freigeben" an.
- **Gestaltung:** Bausteineseite designt und ausgeliefert — HTTP 200, 16.986 Bytes, ohne externe Adressen.

## Was dabei schiefging (und behoben wurde)

1. **Pfad-Kollision:** Der neue Block belegte `/api/content/*`, diesen Pfad gab es schon (Inhalts-Modul) — der Router nimmt den ersten Treffer, der neue Block wäre toter Code gewesen. Jetzt `/api/store/*`.
2. **Zwölf falsche Übergaben:** Viele Bausteine erwarten getrennte Argumente (`reply(id, eingabe)`, `setState(id, zustand, …)`, `history(kanal)`, `setRole(id, rolle)`), die Routen gaben ein Objekt. Alle zwölf korrigiert.
3. **`/api/messenger/result`** hatte nur einen Lese-Pfad — ohne Schreib-Pfad wurde das Ergebnis nie festgehalten. Jetzt POST + GET.
4. **Eigene Testfehler:** neun Erwartungen im neuen Test waren falsch geraten (Feldnamen, Pflichtangaben) — der Test wurde geprüft, nicht der Code „kaputt" erklärt.

## Ehrlich offen geblieben

- **Sozial-Login:** 9 Anbieter, **0 bereit** — ohne Schlüssel im Vault gibt es keine Anmeldung, nur die fertige Adress-Vorschau.
- **Zahlungen:** 19 Wege, **0 verbunden** → weiter „LOKAL GEFÜHRT"; die Datei bewegt kein Geld.
- **Startvideo:** braucht ffmpeg (`/tmp/ffbin/ffmpeg`, imageio-ffmpeg 7.0.2); ohne ffmpeg bleibt es bei Einzelbildern und der klaren Meldung.
- **Studio-Geräte:** auf dem Server hängt keines — der Prüflauf sagt das, statt Geräte zu behaupten.
- **Seiten:** Aufschalten auf einen fremden Server macht **ein Mensch** mit dem Deploy-Paket; AURA schreibt dort nichts.
- **Seiten-Oberflächen** (die 59 vorhandenen Seiten) sind noch nicht auf die neuen Bedienelemente umgestellt — als nächster Schritt vorgemerkt.

# Fünfte Runde 2026-10-16 — Sprachen, Aussehen, Marke, Werbung im OS, Empfehlungen, Förderung, Protokoll, Text/Reim, Abteilungen, Song-Orchester, Rundbrief, Recht, Weißbuch, Ideenkatalog, Startintro, Zahlungsprüfung

Wunschliste der fünften Runde, Punkt für Punkt abgearbeitet — und **direkt in Betrieb genommen**
(`deploy/master-install.sh`, siehe unten). Stand: **19 neue Bausteine** (18 aus der Wunschliste +
Ideenkatalog), **15 neue Routenbereiche**, **3 neue Testdateien** bzw. +34 und +12 Prüfungen.

## Neu in dieser Runde

Jeder Baustein liegt in `backend/src/lib/` und schreibt (wenn überhaupt) nach `backend/src/data/*.json`
— dieser Ordner ist vollständig gitignoriert, es wandern also keine Laufzeitdaten ins Repo.

| Punkt | Baustein | Was er wirklich tut |
|---|---|---|
| (c) Werbung im OS | `ad_engine` | Kurzmeldung **alle 6 Min**, 15 s, **nicht wegklickbar**, immer mit Restzeit; Anzeige **alle 11 Min**, 25 s, wegklickbar; `enabled:false` schaltet alles ab; zählt nur gemeldete echte Ereignisse |
| (d) Empfehlungen | `referral` | Code + Link `/start?ref=…`; Selbstwerbung und Doppelbuchung abgelehnt; 15 % Provision / 20 % Nachlass; Meilenstein bei 5 Anmeldungen; Einlösen nur mit Mensch |
| (f) Zahlungsprüfung | `payment_validation` | Luhn (Karte), IBAN Mod 97, BIC-Aufbau, USt-IdNr. (Produktverfahren mod 11), Betrag mit Dezimalregeln je Währung, SEPA-Mandat, Gläubiger-ID, Gutscheincode mit eigener Prüfziffer — Kartennummern werden verworfen |
| (g) Sprachen | `i18n` | 8 Sprachen (de/en/es/fr/it/tr/ru/ar), Arabisch RTL; Fallback auf Deutsch statt roher Schlüssel; Sätze zur Laufzeit überschreibbar |
| (h) Aussehen (für das OS) | `themes` | 7 Themes × 8 Hintergründe = **56** Kombinationen, jede als CSS gezeichnet, keine Fremddatei; Wahl je Nutzer |
| (i) Foundry/Sponsor | `sponsor` | 5 Stufen ab 5 €; `ZUGESAGT` ≠ `BEZAHLT` (Belegpflicht); Leiste am unteren Rand (26 s, bei „Bewegung reduzieren" stehend); eigene Förder-Seite |
| (j) Copyright + Wasserzeichen | `branding` | Creed-Street-Zeichen als SVG gezeichnet; „© Creed Street Studios 2026"; Kennzeichnungspläne für Bild/Video/Ton/Text/Seite inkl. ehrlichem Hinweis, dass dieses ffmpeg kein `drawtext` hat |
| (k) Protokoll + Bewertung | `logs_analytics` | 9 Protokollquellen in einer Suche; Klick-Bewertung A–E **erst ab 30 Aufrufen**; Einnahmen-Ampel mit Trend erst ab 3 Monaten; Aufräumen schlägt vor, löscht nie |
| (l) Texte und Reime | `lyric_writer` | 4 Aufbauten, 6 Stimmungen, Reimverzeichnis DE/EN, Silbenzählung (als Näherung ausgewiesen), Textgerüst mit Haken |
| (m) Musik-Abteilungen | `music_departments` | **20 Abteilungen** mit Aufgaben, Kennzahlen und **20 Mensch-Toren**; Vorgänge laufen bis zum Tor und warten dort |
| (l+r) Song-Orchester | `song_orchestrator` | 7 Schritte: Beschreibung lesen → Aufbau → Effektketten aus `daw_plugins` → Textgerüst → Rendern (Varianten + Stems) → Prüflauf → Ablage + Vorgang; 11 lesbare Stile |
| (n) Rundbrief | `newsletter` | doppelte Bestätigung, Abmeldung in einem Klick, Versand nur an Bestätigte — ohne Versandweg bleibt es beim Plan |
| (o) Weißbuch | `whitepaper` | Weißbuch + **Prüfbericht** + **Fahrplan unten dran**; Zahlen werden aus dem lebenden Projekt gezählt, nichts geschätzt |
| (p) Support + AGB | `legal` | 5 Dokumente (AGB, Datenschutz, Impressum, Widerruf, Lizenzen), Fassung `2026.1`, 27 gezählte Platzhalter, Zustimmung an die Fassung gebunden (sha256), Knopf „Kontaktieren Sie unseren Support" |
| (q) Intro mit Zeichen | `flash_intro` + `boot_intro` | Startintro 10 s mit Creed-Street-Zeichen, überspringbar nach 3 s, ruhige Fassung bei „Bewegung reduzieren"; das gerenderte Video trägt jetzt Zeichen, „CREED STREET", „STUDIOS" und das Copyright im Bild |
| (b) Ideen aus GitHub | `idea_catalog` | **5 Nischen × 50 Einträge = 250**, jeder mit dem Vermerk, was daraus wurde — oder dass es bewusst nicht übernommen wurde (221 übernommen) |

## Gemessene Zahlen

- **Module:** 179 Dateien in `backend/src/lib/` (144 mit Zustand „live"), **Routen: 751** eindeutige Pfade (Rauchtest 751/751, 0 Fehler).
- **Tests:** 29 Testdateien, **356 Einzelprüfungen, 0 Fehler** (194 Kurz + 162 TAP) · `round5_suite` **34/0** · `payment_validation` **12/0** · `validate.js` **335/0** (direkt nach der Installation).
- **Weißbuch** (selbst gezählt): 179 Module · 751 Routen · 59 Seiten · 29 Testdateien · 6 offene Fahrplanpunkte, 1 wartet auf Schlüssel, 1 läuft.
- **Nischen:** 5 × 50 = 250 Einträge, davon 221 als Idee übernommen, 1 bewusst abgelehnt (Sitzungsaufzeichnung), Rest als Arbeitsweise vermerkt.
- **Recht:** 5 Dokumente, Fassung 2026.1, **27 offene Platzhalter** in allen fünf Dokumenten (ehrlich gezählt, nicht versteckt).

## Lebende Belege (`:8080`, 16.10.)

- **Werbung:** Kurzmeldung `ads-a6069e` — alle **6** Min, nicht wegklickbar, 15 s; Anzeige alle **11** Min, wegklickbar; Plan für 60 Minuten = **15 Einblendungen** (10 Kurzmeldungen ab Minute 6, 5 Anzeigen ab Minute 11), `clicks_created: 0`, `views_created: 0`; Zählen ohne Kennung abgelehnt; Ausschalter greift.
- **Empfehlungen:** Code `SABR47-FY83`; Selbstwerbung → „Das ist dieselbe Person wie der Werber"; erste Anmeldung → 2 Gutschriften; zweite Buchung → „ein Ereignis, eine Prämie"; Provision 15 % von 29,99 € = **4,50 €**; Einlösen ohne Mensch abgelehnt (4 offene Prämien), mit Mensch eingelöst.
- **Förderung:** „Beispiel GmbH" aufgenommen (`ZUGESAGT`), `BEZAHLT` ohne Beleg abgelehnt („Für BEZAHLT fehlt der Beleg"), mit Beleg gesetzt → **100 € monatlich** „aus belegten Beiträgen"; Leiste zeigt den Förderer samt Copyright; Förder-Seite 3.958 B.
- **Protokoll/Auswertung:** Seite mit 240 Aufrufen/31 Klicks → Note **A** („Klickrate 12,9 %, Verweildauer Ø 84 s, Absprünge 38 %"); Seite mit 9 Aufrufen → **„zu wenig Daten (9 Aufrufe, für eine Note nötig: 30)"**; Einnahme 129 € mit Beleg → `BELEGT`, 50 € ohne Beleg → `OHNE BELEG`; Deckung 87,7 % → **GRÜN**, Trend „zu wenig Monate"; 9 Quellen; Aufräumen 0 Kandidaten, „Vorschlagen ja, löschen nein".
- **Text/Reim:** Entwurf `lyr-3irgzt` (Popsong, 26 Zeilen, Haken „Aufbruch — wir fahren durch die Stadt"); Reime auf „Nacht" (1 Silbe): Macht, Pracht, Schlacht, Wacht, sacht, gemacht, gebracht; „Tracht" zur Laufzeit ergänzt.
- **Musik-Abteilungen:** 20 Abteilungen, **20 Mensch-Tore**; Vorgang `md-w6zx9x` (mastering) läuft drei Schritte bis „WARTET AUF MENSCH"; Tor ohne Mensch abgelehnt, mit Mensch `ERLEDIGT`.
- **Song-Orchester:** Plan `orc-k999bf` — „dunkler Trap mit Schlager-Piano, 140 bpm" → Stil `trap`, 140 bpm, 9 Abschnitte, 78,86 s, 5 Effektketten, Textgerüst; **Rendern in 2.029 ms**: 2 Varianten (`mx-64ed46bf.wav`, `mx-3eab90f5.wav`, je 7.161.884 B, 81,2 s, Stems drums/bass/chords/melody), Prüflauf **PRÜFEN** („Varianten klingen gleich: nein"), Ablage im Speicher unter `content/2026/10/song`, Vorgang in der Produktion.
- **Rundbrief:** Anmeldung → `WARTET_AUF_BESTAETIGUNG` mit Bestätigungs-Link („ohne Klick wird nichts gesendet"), falscher Schlüssel abgelehnt, richtiger → `BESTAETIGT`; Rundbrief `nc-94katb` `ENTWURF` → Versandplan `WARTET AUF VERSANDWEG` (Empfänger 1, Thema MUSIK); Abmeldung in einem Klick → `ABGEMELDET`.
- **Recht:** 5 Dokumente (AGB 12 Abschnitte/9 Platzhalter, Datenschutz 9/5, Impressum 6/11, Widerruf 4/1, Lizenzen 4/1); Zustimmung `lc-g1m0m0` an Fassung 2026.1 mit Prüfsumme gebunden; Support-Knopf ausgeliefert.
- **Zahlungsprüfung:** Karte `4111 1111 1111 1111` → `BESTANDEN`, Marke Visa, letzte 4 `1111`, **die vollständige Nummer kommt nicht zurück**; vertippte + abgelaufene Karte → `ABGELEHNT` (Gründe: Kartennummer, Ablaufdatum); IBAN `DE89…1300` → `check_ok: true`, Rest 1 — dieselbe IBAN mit falscher letzter Ziffer → Rest 28; USt-IdNr. `DE136695976` → Prüfziffer stimmt; Betrag „1.250,00" → 125.000 Cent verlustfrei, „29,999" → abgelehnt (2 Nachkommastellen), JPY mit Komma → abgelehnt; Gutschein `CREED-CREE-D201` gültig, Vertipper fallen durch; SEPA-Gesamtlauf mit IBAN/BIC/Mandat/Gläubiger-ID → `BESTANDEN` (7 geprüfte Punkte); Rechnung mit Zahlungsziel 30 Tage + USt-IdNr. → `BESTANDEN`.
- **Weißbuch:** `/api/whitepaper/markdown` 5.219 B, 93 Zeilen; Prüfbericht und Fahrplan hängen unten dran; HTML-Seite 8.254 B.
- **Startintro:** neue Fassung `intro-c0e838.mp4` — 10 s, 240 Bilder, 780.719 B, Ton `cinematic`, im **2.601 ms**; Bildaufbau berichtigt (Copyright oben links, Zeichen und Schrift getrennt, Pegelband flacher). Vorführkopie `intro-demo.mp4` (780.719 B) + `intro-vorschau.png` (236.089 B) im Projektstamm, **nicht** im Git.
- **Ideenkatalog:** 5 Nischen zu je 50, 250 Einträge, 221 übernommen, 184 Übernahmegruppen.

## Installation (Punkt a: „fertig machen und direkt installieren")

`deploy/master-install.sh` wurde auf diesem Rechner **ausgeführt** (`AURA_DIR=/home/user/aura PORT=8080
RUN_VALIDATE=1`), Ablauf im Wortlaut:

- Repo vorhanden → `git fetch` scheitert (dieser Sandkasten hat kein GitHub) → das Skript geht **mit dem
  vorhandenen Stand weiter**, statt abzubrechen (genau dafür ist der Zweig da).
- Start: „AURA LIVE auf :8080" · PID 5871 · Log `aura-backend.log` — Health-Check `{"status":"ok",…}`.
- Repro-Sweep am Ende: **335 pass / 0 fail** → „Reproduktion bestätigt ✔", „fertig."
- Danach läuft der Dienst weiter (überwachter Prozess auf :8080, PID 5925).
- `aura-backend.log` ist ab jetzt in `.gitignore` — das Installationsprotokoll gehört nicht ins Repo.

Was die Installation **nicht** kann: den Server des Inhabers aufsetzen. Es gibt aus diesem Sandkasten
keine Verbindung dorthin (Azure ausdrücklich nicht, Server nur über den Nutzer). Dafür genügt ein
Befehl auf dem Zielrechner: `AURA_DIR=/pfad/aura bash deploy/master-install.sh`.

## Was dabei schiefging (und behoben wurde)

1. **Statuscode aus einem Datensatz:** Die neue Sammelantwort `r5Send` nahm `out.code` als HTTP-Status —
   beim Werbecode heißt `code` aber „SABR47-FY83" → `ERR_HTTP_INVALID_STATUS_CODE`. Jetzt zählt nur eine
   Zahl als Status.
2. **Zwei Funktionen nicht exportiert:** `adEngine.status` und `sponsor.tiers` wurden von den Routen
   aufgerufen, waren aber nicht aus dem Modul herausgeführt → 500er. Beide nachgezogen.
3. **`referral` hatte ein No-op-`save()`** (falscher Pfad) *und* lud den Datenbestand bei jeder Abfrage
   neu → gebuchte Ereignisse wären beim Speichern verloren gegangen (Anmeldung zeigte 0 statt 1, Prämien
   ließen sich nicht einlösen). Jetzt ein einziger Datenbestand im Speicher, gespeichert über `persist()`.
4. **`k is not defined`** in `song_orchestrator`: Die Akkordzeile griff auf eine Variable außerhalb ihres
   Bereichs zu — Plan ließ sich gar nicht erst bauen. Neu geschrieben.
5. **`logs_analytics.collect()`** lief über `store.auditLog()` — das liefert je nach Datei eine Liste
   *oder* ein Objekt → „object is not iterable". Jetzt werden alle Quellen defensiv ausgelesen.
6. **Ein `\${…}` in einfachen Anführungszeichen** in `legal.js` → Syntaxfehler. Korrigiert (Backticks).
7. **Bildaufbau im Startvideo:** Copyright lag hinter dem Pegelband, „STUDIOS" im Balken, Untertitel im
   Zeichen. Größen und Positionen neu gesetzt — jetzt überlappt nichts mehr.
8. **Testfehler statt Codefehler:** vier Erwartungen im neuen Test waren falsch geraten (`tiers()` liefert
   `count`, die Leiste `css_hint` statt `seconds`, die Planlänge ist 78,86 s statt > 100 s). Test
   angepasst, nicht der Code „kaputt" erklärt.

## Ehrlich offen geblieben

- **Rundbrief:** 0 Versandwege im Vault (`SMTP_*`, `RESEND_API_KEY`, `MAILGUN_API_KEY`, `POSTMARK_TOKEN`)
  → es bleibt beim Plan; verschickt wird nichts.
- **Marke:** Dieses ffmpeg hat kein `drawtext` — die Kennzeichnung ist als gültige Filterkette plus
  PNG-Überlagerung beschrieben, aber hier nicht ausgeführt.
- **Recht:** 27 Platzhalter «AUSFÜLLEN» in fünf Dokumenten — Entwurf, keine Rechtsberatung.
- **Förderung:** Nur ein erfundener Beispiel-Förderer im Test; echte Namen kommen erst mit echten
  Beiträgen in die Leiste.
- **Ideenkatalog:** Lizenzen stammen aus den Projekten und sind vor echter Code-Übernahme zu prüfen —
  übernommen wurde hier die Idee, kein fremder Quelltext.
- **Seiten:** Die 59 vorhandenen Oberflächen sind weiterhin **nicht** auf die neuen Bedienelemente
  umgestellt (Fahrplanpunkt 1).
- **Sprachmotor und Bildmodell** fehlen weiterhin auf dem Server — Podcast und Avatar bleiben stumm,
  Bilder werden gemessen, nicht verstanden.

---

# Runde 6 — 16. Oktober 2026

**Auftrag:** Podcast, Hörbücher und Audiobibeln als eigener Bereich · Verteilerliste **mit den originalen
Adressen** („dass man merkt, dass hier viel Gradlinigkeit dahinter steht") · Duett-Funktion (mit der
Freundin singen, die Maschine formt um) · jeder bekannte Stil — auch fürs Studio und für unseren Ablauf ·
Kamera maximal · Effekte und Specials · **alle** Rohrleitungen · Sicherheit („und stelle sicher, dass …").

## Was neu gebaut ist (acht Bereiche, 78 neue Wege)

| Bereich | Baustein | Was er wirklich rechnet |
|---|---|---|
| `STYLES` | `styles_catalog.js` | **15 Familien, 177 Stile**; je Stil Tempo (typisch/von/bis), Takt, Schlagzeug, Instrumente, Stimmung, Herkunft, Renderer-Gerüst |
| `DIST` | `distributors.js` | **107 Häuser** in 7 Arten, jeweils originale Adresse, Modell, Automatikgrad; gerade Wege; EAN-13 + ISRC |
| `SPOKEN` | `spoken_word.js` | Podcast/Hörbuch/Audiobibel: Gliederung, Lesezeit, Kapitelmarken, **RSS-Feed**, echte Tonmessung |
| `DUET` | `duet.js` | Ausrichten (normierte Kreuzkorrelation), Tonhöhe (normierte Autokorrelation), Stimmen ziehen, Harmonie, Dopplung, Mischen |
| `CAM` | `camera_director.js` | Bildwinkel, Schärfentiefe (hyperfokal), Kadrierung, Schnittrhythmus, Achsensprung, Datenmengen, Drehplan |
| `FX` | `visual_effects.js` | **65 Effekte** in 9 Familien mit echten ffmpeg-Ketten, geprüft; 10 Vorlagen; Blitzwarnung |
| `PIPE` | `workflow_pipes.js` | **14 Rohrleitungen, 95 Stufen, 31 Bausteine verdrahtet, 24 Mensch-Tore** |
| `SEC` | `security_center.js` | Geheimnisse, Eingaben, Ladung, Dateityp, Kopfzeilen, Ratenbegrenzung, Rollen, Vorfallkette |

Dazu zwei Seiten: **`/stile`** (Katalog mit einem Knopf je Stil → fertiger Render-Plan) und **`/werkstatt`**
(Übersicht aller neuen Bereiche mit Rohdaten-Links).

## Gemessen, nicht behauptet

- **Wege:** `route_smoke` **829 PASS / 0 FAIL / 0 WARN** (vorher 751 → +78).
- **Runde-6-Prüfung:** `test/round6_suite.test.js` **65 PASS / 0 FAIL** (jeder Test rechnet nach).
- **Alle Testdateien:** 30 Dateien, **0 mit Rückgabefehler**; `validate.js` **335 pass / 0 fail**.
- **Stile:** `/api/styles/status` → 15 Familien, 177 Stile; Verteilung auf die sechs Grundgerüste:
  pop 38, cinematic 38, lofi 38, house 27, trap 27, schlager 9.
- **Verteiler:** 107 Häuser — podcast 22, musik 25, hörbuch 18, verwertung 13, video 11, buch 12, web 6.
  Gerader Weg Podcast: **ein** Feed genügt für **20** Verzeichnisse.
- **Bibel:** 66 Bücher, **1189 Kapitel** (929 AT + 260 NT), nachgezählt. Leseplan 365 Tage deckt
  **1189/1189** Kapitel ab: Genesis 1 → Offenbarung 22. Ton geschätzt: 4994 min ≈ 83,2 h.
- **Podcast:** Folge „Lehrgang" 30 min → 5 Abschnitte, Summe **1800 s = 1800 s geplant** (vorher 27,6 min –
  Gewichte werden jetzt normiert). Feed: 16 KB, 19 Einträge, 90 Kapitelmarken, 1 Kanalbild, alle
  Feed-Prüfungen bestanden.
- **Duett (echter Lauf über HTTP):** Versatz **150 ms gefunden → 150 ms echt** (Korrelation 0,9889);
  Tonhöhen 220 Hz (A3) und 246,92 Hz (B3) auf **0,1 Hz** genau; Pegel von −8,29 dB RMS / Spitze +3,02 dB
  auf **−13,23 dB RMS / −1,00 dB Spitze** normalisiert; Ausgabe 379.304 B mit SHA-256.
  Tonhöhen-Genauigkeit nach dem Umbau: **≤ 0,5 Cent über ±12 Halbtöne** (vorher 13–21 Cent daneben).
- **Kamera:** 50 mm an Kleinbild aus 3 m → 39,6° Bildwinkel, Person füllt 1,18 Bildhöhen; f/1.8 aus 3 m →
  Schärfe 2,82–3,20 m (Tiefe 0,38 m); Handy 4,25 mm = 20 mm Kleinbild; 5 min bei 6 s = 50 Einstellungen.
- **Effekte:** 65/65 Ketten bestehen die Prüfung; genau ein Effekt ist als blitzgefährlich markiert
  (Weißblende) — mit Warnung im Ergebnis und im Zweifel weglassen.
- **Rohrleitungen:** Lauf mit leerer Eingabe → **66 von 95 Automatikstufen erledigt**; die übrigen fünf
  brauchen echte Aufnahmen oder einen echten Marker und sagen das. Kein Lauf stürzt ab.
- **Sicherheit:** 8/8 Angriffsformen abgewiesen, 3/3 normale Eingaben erlaubt; kodiertes Wegschleusen
  (`%2e%2e%2f`) wird jetzt entschlüsselt und erkannt; 362 Dateien ohne echtes Geheimnis; Laufzeitdaten
  ohne Klartext-Kennwörter; Vorfallkette erkennt → isoliert → Mensch entscheidet.
- **Kopfzeilen live:** `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`,
  `Permissions-Policy`, `Cross-Origin-Resource-Policy` — gesetzt in `send()` **und** in der
  Dateiauslieferung. `frame-ancestors 'self' https:` hält die Vorschau im Rahmen, `AURA_FRAME_ANCESTORS`
  kann es enger stellen.

## Fehler, die diese Runde gefunden und behoben hat

1. **Versatzmessung war unbrauchbar:** rohe Kreuzkorrelation der Hüllkurven lieferte 200 ms bei echten
   120 ms. Ursache: unnormierte Summe bevorzugt lange Überlappungen. Jetzt normierte Kreuzkorrelation
   (Pearson) → Treffer auf 10 ms genau.
2. **Tonhöhe eine Oktave zu tief:** die Autokorrelation nahm den größten Lag; bei Obertönen ist der
   ebenfalls hoch. Jetzt: kleinste lokale Spitze ≥ 98 % des Maximums (der erste Versuch mit 92 % ließ
   einen Nebenbuckel durch → 229 Hz statt 220 Hz) plus Feinmessung zwischen den Lags → **0,4 Cent**.
3. **Tonhöhen-Verschieben verschob nicht:** Körner wurden kopiert und nur enger gesetzt („+7 Halbtöne"
   ergab 229 Hz). Neu: umrechnen und mit Korrelationsausgleich zurückdehnen (SOLA/WSOLA) → ≤ 0,5 Cent.
4. **Kapitelzeiten summierten sich falsch:** 30 geplante Minuten ergaben 27,6. Gewichte werden jetzt
   normiert, die letzte Marke bekommt den Rest → 1800 s = 1800 s.
5. **`styles.list` / `styles.get` nicht herausgeführt** → zwei 500er im Wegetest. Beide ergänzt.
6. **Sechs Schreibwege ohne Admin-Tor** (u. a. `spoken/reading-time`, `fx/chain`, `sec/upload`). Der
   Wegetest hat sie gefunden; alle nachgezogen.
7. **Unbekannter Filter rutschte durch:** die Prüfung meldete nur Warnungen, ohne den Namen zu nennen.
   Jetzt steht der Name im Hinweis.
8. **Newsletter-Marker zu kurz:** 12 Zeichen — erratbar. Jetzt 36 Zeichen, alte Marker werden beim Laden
   erneuert (mit Eintrag im Prüfprotokoll), Anmeldungen bleiben bestehen.
9. **Sechs Rohrstufen riefen Bausteine mit falschen Werten** (z. B. `offsetMs` mit einem Objekt). Die
   Stufen haben jetzt Zuordnungen; Ergebnisse werden an die nächste Stufe weitergegeben.
10. **Eigene Testfehler, nicht Codefehler:** „30 Minuten" als Bereich geprüft statt punktgenau, `store.item`
    statt `store.addTask`, `legal.digest('impressum')` mit falscher Kennung. Test bzw. Rohr angepasst.

## Ehrlich offen geblieben

- **AURA spricht nicht selbst.** Ohne Sprachmotor bleibt der Podcast ein Plan plus Zeitrechnung; die
  Tonmessung braucht eine echte Datei. Das steht in jedem Ergebnis.
- **Kein Verteiler ist verbunden.** Ohne Konto und Schlüssel wird nichts eingereicht — die originalen
  Adressen sind zum Nachsehen da.
- **Das Duett braucht eure Aufnahmen** als WAV auf dem Rechner, und die zweite Person muss zustimmen
  (`consent`). Ohne Einverständnis rechnet AURA nichts.
- **AURA rendert kein Video.** Effektketten werden geprüft und übergeben; Text im Bild braucht ein
  Schnittprogramm mit Satzfilter (unser ffmpeg hat kein `drawtext`).
- **Vier Rohrstufen und ein Marker** brauchen echte Werte (Aufnahmen, Bestätigungslink) — sie brechen
  ehrlich ab statt zu raten.
- **Die Stilangaben sind Erfahrungswerte** (übliche Tempi, typische Besetzung), keine Messungen an einem
  bestimmten Stück. Das steht so in jedem Eintrag — 177 Stile sind Breite, nicht Beweis.
- **Kapitelzeiten sind gerechnet**, nicht gestoppt. Die Stoppuhr der echten Aufnahme gewinnt immer.

---

## Runde 7 — Intro nach Vorlage „feature desigm (3).png" (Hirn-Hub, fünf Workflow-Felder, Fundament)

**Auftrag (16.10., wörtlich): „nimm das für intro baller in die kleinen felder jeweils einen workflow animiert wie die gehirn matric"**

Das hochgeladene Bild ist die Vorlage: Hirn-Hub „AGENTIC AI" in der Mitte, Strahlen zu fünf kleinen Feldern
(Logistics Optimization, oberes Feld, Industrial Planning, Logistica Outbound, Predictive Analytics), unten das
Fundament „DATA ENGINEERING: THE FOUNDATION" mit Leitungen und Datenbank-Symbolen.
Umgesetzt als neuer Baustein **`backend/src/lib/agentic_intro.js`** (769 Zeilen) — alles selbst gezeichnet,
Pixel für Pixel, eigene 5×7-Schrift, kein Fremdmaterial, kein Stock-Video.

### Was in den fünf Feldern läuft (der Kern der Anforderung)

In **jedem** kleinen Feld läuft ein **eigener** Arbeitsablauf als Knoten-Kanten-Lauf — nicht angedeutet, sondern
gerechnet: Knoten leuchten nacheinander auf, Kanten wachsen, ein heller Wanderpunkt läuft den Pfad entlang,
ein Fortschrittsbalken füllt sich im gleichen Takt.

| Feld | Ablauf im Feld | Knoten | Kanten |
|---|---|---|---|
| ORCHESTRATOR (oben) | Eingabe → Planer → drei Äste → Zusammenführung | 6 | 7 |
| MUSIK & STIL (links oben) | Stil → Text → Abteilungen → Renderer → Master | 5 | 4 |
| KAMERA & DREH (rechts oben) | Storyboard → Einstellungen → Drehtag → Nachdreh (mit Rücklauf) | 4 | 4 |
| PODCAST & BIBEL (links unten) | Kapitel → Sprechplan → Feed → Verzeichnisse | 5 | 5 |
| VERTEILER (rechts unten) | Master + Kennung → fünf Wege (Läden, Bibliotheken, Direkt) | 6 | 5 |

Dazu der Hub: **Gehirn-Matrix** aus 7×5 Knoten, die im Takt aufleuchten und sich untereinander verbinden
(das „Matrix"-Geflecht wächst mit), Ringe, laufende Lichtbögen, 36 Tickmarken. Fundament als Leiterplatte:
4 Rohre vom Hub nach unten mit aufsteigenden Datenpunkten, Sammelleitung mit Kettengliedern, Symbole
(Balken, Zahnrad, Netz, Lupe) und 5 Datenbanken. Abspann mit Hauszeichen und Rechten.

### Messwerte (nachgerechnet, nicht behauptet)

- **Bewegungsbeweis je Feld** (Pixelvergleich 9,00 s → 9,45 s): orchestrator 592 · musik 593 · kamera 510 · spoken 561 · dist 658 geänderte Bildpunkte — **kein Feld steht still**.
- **Kein Zufall im Bild:** derselbe Zeitpunkt zweimal gerechnet = **0** Unterschiede. Die Bewegung kommt also aus der Animation, nicht aus Rauschen.
- **Gehirn-Matrix** pulsiert: 0,4 s Abstand → 120+ geänderte Punkte im Kern. **Fundament** bewegt sich: 150+ Punkte im Fundamentband.
- **Strahlenaufbau** messbar: Korridor Hub ↔ oberes Feld, 2,35 s → 3,20 s deutlich verschiedene Bilder.
- **Auflösungen:** 640×360, 1280×720 und 1920×1080 — Layout rechnet die 1280×720-Vorlage um; gezeichnete Fläche 9,13 % / 5,32 % / 4,92 %, **am Bildrand abgeschnitten: 0 Punkte** in beiden großen Größen.
- **Video:** `intro-agentic.mp4` — 1.436.645 B, 12,00 s, 1920×1080, 25 Bilder/s, H.264 + AAC (Ton aus dem eigenen Musik-Renderer, Stil `cinematic`), 300 Einzelbilder, Renderzeit 17,8 s.
- **Routen (839 gesamt, `route_smoke` 839 / 0 / 0):** `/api/intro/agentic/status` 200 (2.732 B) · `/workflows` 200 (1.409 B) · `/start` 200 (2.227 B) · `/frame.png?seconds=8.5` 200 (44.412 B PNG) · `/frame?seconds=3` 200 (JSON) · POST `/api/intro/agentic` 200 → `agentic-a65372` 319.278 B / 48 Bilder (640×360, 4 s, 12 Bilder/s).
- **Tests:** `test/intro_agentic.test.js` **16 / 0** · `round6_suite` 65 / 0 · `route_smoke` 839 / 0 / 0 · `round5_suite` 34 / 0 · `validate` 335 / 0 · **32 Testdateien ohne Rückgabefehler**.

### Gefundene und behobene Fehler in dieser Runde

1. **Strahl zielte auf die Unterkante** der Felder und lief durch die Beschriftung → `rayTarget()`: linke/rechte Felder werden an der **Innenseite** getroffen. Beschriftung sitzt jetzt **im** Feld (wie in der Vorlage).
2. **Matrix-Ziffern fielen mitten in die Felder** → nur noch Außenränder (x ≤ 90 bzw. ≥ Breite−90).
3. **`boot.mark` gibt es nicht** (nur eine innere Funktion) → eigenes Hauszeichen `houseMark()` im Baustein.
4. **Anordnung war auf 1280×720 festgenagelt** — im 1920×1080-Video klebte das ganze Bild in der linken oberen Ecke. Gefunden durch Einzelbild aus dem **fertigen Video** (nicht durch Ansehen des Quelltextes). Behoben mit `layoutFor(w,h)`: gleicher Maßstab für x und y, Rest mittig, Strichstärken und Schrift wachsen mit.
5. **Radien doppelt skaliert** (Radius × Maßstab, obwohl die Zeichenroutine selbst skaliert) → Kern und Hauszeichen waren bei 1920×1080 zu groß. Radien jetzt ohne Faktor.
6. **Texthinterlegung zu klein gerechnet** (Breite ohne Skalierung) → Fläche wird mit dem echten Schriftmaß gerechnet, sonst läuft Text über den Rand der Fläche.

### Ehrlich offen geblieben

- Die Vorschau `present_file` ist eine **Videodatei**; im Browser läuft sie über `/api/intro/agentic/start` als nachgeladene Einzelbilder (kein Videostream nötig, also auch ohne ffmpeg nutzbar).
- Ohne ffmpeg bleibt es bei Einzelbildern — der Baustein sagt das dann ausdrücklich (`BLOCKED_NO_FFMPEG`).
- Die Intro-Seite nutzt noch nicht `ui_kit.shell()` (eigene schlichte Seite).
- Musik ist der eigene Renderer (Stil `cinematic`); echte Aufnahmen gibt es weiterhin nicht.

### Runde 7b — „baller": mehr Bewegung in den Feldern, mehr Matrix überall

Auf Wunsch deutlich verstärkt. Alles weiter selbst gezeichnet, weiter deterministisch (kein Math.random).

**Neu je Feld:** Mini-Matrix aus 27 Punkten, die versetzt aufblitzen (dieselbe Idee wie der Hub, nur feiner);
**drei Läufer** statt einem, jeder mit neun Punkten Schweif; **Ankunftsblitz** an den Knoten, sobald ein
Läufer ankommt; Fortschrittsbalken nach innen oben verlegt (unten sitzt der Titel).

**Neu auf den Strahlen:** Verkehr in **beide** Richtungen — hinaus zum Feld und zurück in den Kern, jeder
Zug mit Schweif — plus ein Pegelbalken, der die Leitung langläuft. **Hub:** Schockwellen laufen nach außen,
ein Lichtfächer streicht über die Matrix. **Hintergrund:** Matrix-Regen aus 0/1 über das ganze Bild, dazu
Gitter und Sternpunkte. **Kamera:** leichte Atmung (Zoom ±1,2 %, Verschiebung) — über `still:true` abschaltbar.

| Messung (Bewegung je Feld, 0,3 s Abstand) | vorher | nachher |
|---|---|---|
| ORCHESTRATOR | 592 | **5.824** |
| MUSIK & STIL | 593 | **4.524** |
| KAMERA & DREH | 510 | **4.253** |
| PODCAST & BIBEL | 561 | **6.642** |
| VERTEILER | 658 | **6.263** |

Zahlen bei 1920×1080; bei 1280×720 liegen sie bei 2.292–3.633 Punkten. **Gleicher Zeitpunkt zweimal
gerechnet: 0 Unterschiede** (kein Zufall im Bild). Der Zufall für Matrix und Regen kommt aus einer
eigenen Streu-Funktion (`hash`), damit jedes Bild reproduzierbar bleibt.

**Dabei gefunden und behoben:** Name und Unterzeile der Fundament-Leiste lagen bei 1920×1080 nur
**2 Punkte** auseinander (wirkten wie durchgestrichen) → beide Zeilen werden jetzt aus der echten
Schriftgröße gerechnet, Abstand 4/5/2 Punkte bei 720p/1080p/360p. Feldtitel saß bei 1080p auf dem
Rahmen → Position ebenfalls aus der echten Schriftgröße. Ein Symbol war beim Umbau kaputtgegangen
(`sc1 is not defined`) → Funktion sauber neu geschrieben.

**Video:** `intro-agentic.mp4` — 4.257.618 B, 12,00 s, 1920×1080, 25 Bilder/s, H.264 + AAC.

**Tests:** `intro_agentic` **20 / 0** (neu: Bewegung über 1.000 Punkte je Feld, Fundamentzeilen ohne
Berührung in drei Bildgrößen, Anordnung bleibt vollständig im Bild, Kamera-Atmung) · `route_smoke`
839 / 0 / 0 · `round6_suite` 65 / 0 · `validate` 335 / 0 · 32 Testdateien ohne Rückgabefehler.

### Runde 7c — die Workflows werden **hervorgehoben** (Scheinwerfer-Umlauf)

Zusätzlich zur Bewegung bekommt jetzt immer **genau ein Feld** den Scheinwerfer, der Reihe nach
(ORCHESTRATOR → MUSIK & STIL → KAMERA & DREH → PODCAST & BIBEL → VERTEILER), Beginn 4,6 s,
1,4 s je Feld, ein voller Umlauf 7,0 s — passt genau einmal in das 12-Sekunden-Video und läuft
bei längeren Videos als Umlauf weiter.

Was beim hervorgehobenen Feld passiert: Rahmen wird **weiß und doppelt so dick**, ein Lichthof
liegt um das Feld, die Grundfläche hellt auf, **Pfeil von oben** zeigt darauf, der Ablauf steht
als eigene Textbox **unter** dem Feld (z. B. „STIL - TEXT - ABTEILUNGEN"), die Leitung zum Hub
wird weiß und trägt dickere Pakete, die Knoten und Läufer werden größer — und die **anderen vier
Felder treten zurück** (42 % dunkler). Unter dem Fundament zeigen fünf Punkte plus
„ABLAUF n VON 5", welches Feld an der Reihe ist.

Messwerte:
- Umlauf vollständig: Abtastung 4,6–11,5 s in 0,1-Schritten trifft alle fünf Felder in Reihenfolge (Test).
- Helligkeit: aktives Feld im Mittel **> 1,25-fach** heller als das hellste zurücktretende Feld (Test, 1280×720).
- Ablauf-Box: **627 Cyan-Punkte** unter dem aktiven Feld (frameAt, 1920×1080, ohne Handarbeit).
- Bewegung je Feld bleibt hoch: 4.253–6.642 geänderte Punkte je 0,3 s (1920×1080).

**Schwerer Fund nebenbei:** `setPixel`/`addPixel` haben Float-Koordinaten ungeprüft in den
Puffer geschrieben — Zugriffe auf einen Buffer mit krummem Index ignoriert Node **still-
schweigend**. Dadurch zeichnete jedes Primitiv mit Float-Koordinaten (Rahmen, Flächen, ganze
Textzeilen) einfach nichts. Sichtbar wurde das erst durch die Ablauf-Box: der Block lief
nachweislich, schrieb aber keine Pixel. Behoben zentral in `setPixel`/`addPixel` (runden vor
dem Schreibzugriff) — dadurch zeichnet das Intro jetzt auch Teile, die vorher fehlten
(z. B. Titel-Hinterlegungen, Hub-Beschriftung vollständig). Eigene Regression-Prüfung im Test.

**Video:** `intro-agentic.mp4` — 4.493.030 B, 12,00 s, 1920×1080, 25 Bilder/s, 300 Einzelbilder,
Renderzeit 20,1 s, Ton `cinematic`.

**Tests:** `intro_agentic` **24 / 0** · `route_smoke` 839 / 0 / 0 · `round6_suite` 65 / 0 ·
`validate` 335 / 0 · 32 Testdateien ohne Rückgabefehler.

### Runde 7d — jedes Feld trägt seinen Workflow dauerhaft sichtbar, eines bekommt den Scheinwerfer

„hervorgehoben" jetzt doppelt umgesetzt: **jedes** der fünf Felder zeigt seinen Ablauf immer als
eigene Box unter sich (Rahmen und Text in der Feldfarbe, mit Verbindungslinie ans Feld), und der
Scheinwerfer-Umlauf hebt dieselbe Box dann hell und cyan heraus (weiß glühender Rahmen, Lichthof,
Pfeil von oben, weiße Leitung zum Hub). Die Abdunklung der übrigen Felder wurde von 42 % auf
25 % gemildert, damit außerhalb des Scheinwerfers nichts „ausgeschaltet" wirkt.

Sichtbarkeit der Ablauf-Boxen (Punkte in der Boxzone, 1920×1080, t = 6,9 s):
ORCHESTRATOR 883 · MUSIK & STIL 1.198 (hervorgehoben) · KAMERA & DREH 1.298 ·
PODCAST & BIBEL 719 · VERTEILER 701 — alle fünf deutlich über der Nachweisschwelle.

**Video:** `intro-agentic.mp4` — 4.545.120 B, 12,00 s, 1920×1080, 25 Bilder/s, 300 Einzelbilder,
Renderzeit 21,7 s, Ton `cinematic`.

**Tests:** `intro_agentic` **25 / 0** (neu: dauerhafte Box unter jedem Feld) · `route_smoke`
839 / 0 / 0 · `round6_suite` 65 / 0 · `validate` 335 / 0 (braucht laufenden Server) ·
32 Testdateien ohne Rückgabefehler.

### Runde 7e — hervorgehoben heißt jetzt: Das Feld **wächst** und bekommt einen Lichtkegel

Zwei Wirkungen obendrauf, beide messbar:
- **Wachstum:** Das aktive Feld skaliert um bis zu 8 % um seine Mitte. Rahmen, Workflow, Titel
  und Ablauf-Box skalieren automatisch mit (alles leitet sich von denselben vier Kanten ab).
  Messung (1280×720): linkeste helle Rahmenkante des MUSIK-Feldes wandert von x=42 (ohne
  Hervorhebung) auf x=19 (aktiv) — sichtbar größer, und weiter klar vom Bildrand entfernt.
- **Lichtkegel:** Ein weicher Fächer aus sieben Linien läuft vom Hub-Rand zum aktiven Feld
  (Alpha 0,055 je Linie). Messung: mittlere Helligkeit der Zone zwischen Hub und aktivem Feld
  steigt von 52,0 auf 77,0 (> 1,2-fach, eigene Prüfung im Test).

Dauerhaft bleiben: Ablauf-Box unter **jedem** Feld, Scheinwerfer-Umlauf (4,6 s Start, 1,4 s je
Feld), Mini-Matrix und drei Läufer je Feld, Verkehr in beide Richtungen auf den Strahlen,
Schockwellen und Matrix-Regen.

**Video:** `intro-agentic.mp4` — 4.666.431 B, 12,00 s, 1920×1080, 25 Bilder/s, 300 Einzelbilder,
Renderzeit 21,2 s, Ton `cinematic`.

**Tests:** `intro_agentic` **27 / 0** (neu: Wachstum, Lichtkegel) · `route_smoke` 839 / 0 / 0 ·
`round6_suite` 65 / 0 · `validate` 335 / 0 · 32 Testdateien ohne Rückgabefehler.

## Meilensteine — wer Zeit mit dem Produkt verbringt, wird geehrt

**Auftrag (16.10., wörtlich): „baue meilensteine ein wenn die leute ne gewisse zeit mit unserem
produkt verbracht haben usw"**

Neuer Baustein **`backend/src/lib/milestones.js`**: eigener Katalog, eigener Speicher, eigene
Prüfung — keine Fremd-SDKs, keine Cloud. Der Speicher liegt als **lesbare JSON-Datei**
(`backend/src/data/milestones.json`); löschen genügt, um bei null zu starten. Der Mensch bleibt
Herr der Daten.

**Fünf Ketten, 14 Meilensteine (Bronze → Silber → Gold → Platin):**

| Kette | Stufen |
|---|---|
| Nutzungszeit (Minuten) | 10 ERSTE SCHRITTE · 60 EINE STUNDE DABEI · 300 FESTER BESTANDTEIL · 1000 TAUSEND MINUTEN |
| Sessions | 1 WILLKOMMEN · 5 WIEDERKEHRER · 25 STAMMGAST |
| aktive Tage | 3 DREI TAGE DABEI · 30 EIN MONAT DABEI |
| erstellte Inhalte | 1 ERSTES WERK · 10 SCHAFFENDER · 50 PRODUZENT |
| Aktionen/Klicks | 100 ENTDECKER · 1000 MACHER |

**Wie die Zeit ins System kommt:** Die Seite `/meilensteine` meldet sich selbst an — Heartbeat
jede Minute (`zeit` +1), bucht beim Laden Session (je Session-Kennung einmal) und Tag (je Datum
einmal), zählt Klicks gedrosselt (eine Meldung je 2 s). Jeder erfolgreiche Intro-Render bucht
automatisch ein `inhalt`. Andere Seiten/Produktteile melden über dieselbe Route.

**Routen (844 gesamt, `route_smoke` 844 / 0 / 0):**
`GET /api/milestones/katalog` · `GET /api/milestones/status?user=…` ·
`POST /api/milestones/track` (Ereignis: zeit/session/tag/inhalt/klick) ·
`POST /api/milestones/check` · `GET /meilensteine` (Seite mit Balken, Katalog, Einblendungen) ·
Werkstatt-Seite zeigt den Meilenstein-Block.

**Live gemessen (Server, echte Requests):** Session buchen → „WILLKOMMEN"; 10 Minuten melden →
„ERSTE SCHRITTE" (BRONZE) mit Verleih-Zeitstempel; dieselbe Session-Kennung noch einmal gemeldet
→ sessions bleibt 1; Status zeigt je Kette Wert, nächsten Meilenstein, Fehlmenge und Prozent
(z. B. „EINE STUNDE DABEI 17 %").

**Schutz vor Unsinn:** unbekannte Ereignisse werden abgelehnt und nennen die erlaubten;
Schwellen je Kette aufsteigend (Test); Doppelverleihung ausgeschlossen (Test); Nutzer bleiben
getrennt (Test); Speicher trägt über Prozessgrenzen (Test mit Zweitprozess).

**Tests:** `milestones` **12 / 0** · `intro_agentic` 27 / 0 · `route_smoke` 844 / 0 / 0 ·
`round6_suite` 65 / 0 · `validate` 335 / 0 · **33 Testdateien ohne Rückgabefehler**.

## Verbund — Concat-Repos, Cross-Chain über alle Abteilungen, Montage offen, n8n-Katalog, CLI

**Auftrag (16.10., wörtlich): „pusch in this githup repros combind them with ouer epic workflow …
cross chain it with all nessesery departments open montage than n8n-workflows and scapeGraphai …
ragflow and voicestudio noosmedia … cli-anything … add concat repro … opencreator repro"**

**Push/GitHub zuerst ehrlich:** diese Session ist abgeschlossen (PR gemergt/geclosed) — Push, PR
und `gh`-Aufriffe sind hier technisch zu und werden nicht versucht. Commits liegen im Branch
`arena/3f656e82-aura`; ein Push passiert erst in einer neuen Session. Ebenso ehrlich: aus dieser
Sandbox sind outbound nur die Paketregistries (npm/pypi) erreichbar — externe Dienste werden
deshalb als **Steckplätze mit ehrlichem Status** geführt, nichts wird live behauptet.

**Neu: `backend/src/lib/verbund.js`** — das Concat-Repo-Verzeichnis:
- **8 interne Glieder** (je genau ein Link): Musik · Montage · Spoken · Verteiler · Intro ·
  Rohre (epic workflow) · Meilensteine · Sicherheit — jedes mit Meilenstein-Ereignis und n8n-Workflow.
- **8 externe Steckplätze** (je genau ein Link-Feld, null bis der Mensch bestätigt): n8n (lokal
  katalogisiert, Webhook-Route läuft), ScrapeGraphAI, RAGFlow, VoiceStudio, NoosMedia,
  unlimited.org (nicht prüfbar), OpenCreator-Repo (nicht prüfbar), AURA-Repo (ein Link).
- **Cross-Chain:** `crosschain(pfad, methode)` ordnet jede Erzeuger-Route dem Ereignis `inhalt`
  zu, sonstige POSTs `klick`. Der Hook sitzt **zentral in `backend/server.js`** nach dem
  Dispatcher: jeder erfolgreiche POST (200) bucht automatisch — alle Abteilungen, eine Stelle.
- **Montage offen:** `/montage` (Seite) und `/api/montage/status` bündeln Video-Abteilung,
  Effekte, Kamera-Regie und Intro.
- **n8n-Katalog:** `/api/n8n/workflows` — 8 Workflows mit Trigger und Knotenfolge, draußen 1:1
  nachbaubar; lokal läuft die Webhook-Route, kein live n8n erreichbar (steht so drin).

**Neu: `bin/aura-cli.js`** — „cli-anything": ein Einstieg auf alles
(`status | verbund | kette | montage | n8n | meilensteine | track | intro`), JSON-Ausgabe,
Fehlerpfad mit Exit 1.

**Live gemessen:** POST `/api/intro/agentic` → 200, Render DONE (`agentic-450fa0`, 1.061.298 B) →
Meilenstein-Zähler `inhalte` 0 → 1 (Cross-Chain greift). POST `/api/styles/match` → `klicks` +1.
Routen: `/api/verbund` 200 · `/api/verbund/kette` 200 (4.879 B) · `/api/n8n/workflows` 200 ·
`/api/montage/status` 200 (6.037 B) · `/montage` 200 (5.004 B).

**Nebenbei gefunden und behoben:** `/tmp/ffbin/ffmpeg` war nach einem Sandbox-Neustart weg
(/tmp ist nicht persistent) — der Server meldete deshalb ehrlich 409 BLOCKED_NO_FFMPEG. ffmpeg
7.0.2 jetzt aus PyPI (`imageio-ffmpeg`, einzige erlaubte Quelle) an den bekannten Kandidatenpfad
gelegt; Render und Videoprüfen laufen wieder.

**Tests:** `verbund` **10 / 0** (u. a. CLI-Läufe, ehrliche Null-Links, Cross-Chain-Zuordnung) ·
`milestones` 12 / 0 · `intro_agentic` 27 / 0 · `route_smoke` **848 / 0 / 0** · `round6_suite`
65 / 0 · `validate` 335 / 0 · **34 Testdateien ohne Rückgabefehler**.

## Fehler-Check nach Sandbox-Resets — Befunde und Härten

**Befund 1 (drei Resets):** `.git`, Prozesse, `/tmp` und **alles außerhalb des Repo-Ordners**
gehen bei Sandbox-Neustarts verloren (Zweige, Tarball, Bundle). Nur `/home/user/aura` überlebt.
Folge: Install-Stand liegt jetzt **im Repo** unter `dist-stand/aura-stand.tar.gz` (unkomittiert,
persistent); die Download-Route `/api/stand/tar.gz` und das Ein-Zeilen-Skript
`/api/stand/install.sh` lesen bzw. liefern ihn von dort. Commits nach jedem Reset:
`1eafeed` (Konsolidierung #2), `0196581` (Konsolidierung #3).

**Befund 2:** Gateway-Selbstcheck fragte hart Port 8080 ab und meldete sich auf anderen Ports
selbst als DOWN → nutzt jetzt `process.env.PORT`.

**Befund 3:** `git rev-parse` in der Repro-Route schrieb ohne Git-Repo ein `fatal:` nach stderr
(ins Server-Log). Der try/catch fing nur den Exit-Code, nicht die Ausgabe →
`stdio: ['ignore','pipe','ignore']`. Log ist seitdem sauber.

**Befund 4:** ffmpeg fehlt nach jedem Reset ( /tmp flüchtig) → wird bei Bedarf aus PyPI
(`imageio-ffmpeg`, einzig erlaubte Quelle) in Sekunden wiederhergestellt; ohne ihn meldet das
Intro ehrlich 409 BLOCKED_NO_FFMPEG statt zu raten.

**Check-Ergebnis (nach allen Fixes):** 298 JS-Dateien 0 Syntaxfehler · Shell-Skripte 0 Fehler ·
34 Testsuiten ohne Rückgabefehler (u. a. intro 27/0, milestones 12/0, verbund 10/0) ·
`route_smoke` 850/0/0 · `validate` 335/0 · Live: :8080 und installierter Zweig :8090 health
live, `/api/stand/tar.gz` 200 (1.922.538 B), `/api/stand/install.sh` 200, `/api/verbund` 200,
`/meilensteine` 200, Intro-Frame 200 · Zweig-Log nach Fix ohne Fehlerzeile.

**Ein-Zeiler (Stand heute, neue Sandbox-ID):**
`curl -fsSL https://8080-iieqqpn5ru7yc2p31gky2.e2b.app/api/stand/install.sh | bash`

## Runde 8 — Produkt-Runde (18.10.2026)

**1 · Reset-Festigkeit:** `deploy/resume.sh` bringt das System nach einem Sandbox-Reset mit
einem Befehl zurück (ffmpeg aus PyPI → node_modules → Stand-Tarball → Server → validate →
Install-Einzeiler). Idempotent, `DRY_RUN=1`/`SKIP_VALIDATE=1`/`PORT` unterstützt.

**2 · Push-Vorbereitung:** `UEBERGABE-NEUE-SESSION.md` auf den aktuellen Stand gebracht
(Push-Rezept, Commit-Stand, Dauerregeln, offene Punkte).

**3 · Produkt:**
- Meilenstein-Badge im Kopf **jeder** ui_kit-Seite (`#ms-badge` + `initMilestones()` im
  Client-JS): echte Werte aus `/api/milestones/kurz` (Stufe, Verliehen, nächster Meilenstein
  mit %); Toast bei neuer Verleihung; ohne Antwort bleibt das Badge leer (nichts erfunden).
- `/meilensteine` und `/montage` auf `ui_kit.shell()` gehoben (Heartbeat der Meilenstein-Seite
  bleibt), NAV um beide erweitert.
- **Echten Fehler gefunden und gefixt:** QC des Song-Orchestrators verglich Varianten über
  `bytes:seconds` — bei gleicher Länge identisch trotz verschiedener Seeds. Jetzt MD5 der
  WAV-Inhalte (`qc.fingerprints`); Regressionstest in `test/round8_suite.test.js`.
- **Tote NAV-Links entfernt** (/konto /studio-live /messenger /analyse /projekte /support
  hatten keine Routen → 404). NAV = 8 Einträge, alle live 200. `/design` verdrahtet
  (componentsPage), `/start` neu (startPage aus echten Moduldaten).
- Regressionen festgehalten: `styles.find()` versteht Freitext („ich will einen gospel song"),
  Orchestrator-Varianten wirklich verschieden.

**Messwerte:** `round8_suite` 32/0 · `round4_suite` 25/0 (NAV-Fixtur aktualisiert) ·
alle 35 Suiten exit 0 · route_smoke 851/0/0 · validate 335/0 · alle 8 NAV-Links 200 ·
`/api/milestones/kurz` → `{"stufe":"BRONZE","verliehen":1,"naechster":{"prozent":29,…}}` ·
Stand-Tarball neu: 1.925.873 B.

## Push-Vorbereitung (18.10.2026, mit der Hygiene-Runde überholt)

`deploy/push.sh` läuft in jeder Session mit GitHub-Zugriff: Zustand prüfen,
Runtime-Daten auf main-Stand, Syntax-Check, `git push origin <HEAD-Branch>`,
PR anlegen (base main) mit Messwerten im Text. `CHECK_ONLY=1` prüft nur.
**Seit der Hygiene-Runde (unten) ist der Branch nicht mehr verdrahtet** — er wird
aus `git rev-parse --abbrev-ref HEAD` gelesen; es gibt keinen Branch-Namen
mehr, der veralten könnte. Save-Dateien für den Übergang (untracked):
`dist-stand/aura-stand.tar.gz` (kompletter Stand ohne .git/Runtime/Medien).

---

## Hygiene-Runde auf reinem main-Stand — 18.10.2026

Ausgangspunkt: `main` bei `6267206` (PR #5 gemergt), Arbeitsbaum sauber,
`deploy/resume.sh` und `test/round8_suite.test.js` vorhanden ✔.
Ziel: nichts Neues bauen, nur messen, belegen und die Push-Kette reparieren.

### Messwerte (alle lokal, gegen diesen Stand)

| Prüfung | Ergebnis |
|---|---|
| Test-Suiten (`test/*.test.js`, 35 Dateien) | **35/35 exit 0** — u. a. round8 32/0 · round6 65/0 · intro_agentic 27/0 · milestones 12/0 · verbund 10/0 |
| Routen-Smoke (in den Suiten) | **852 PASS / 0 FAIL / 0 WARN** (Runde 8 meldete 851 — eine Route mehr auf main, kein Rückschritt) |
| `deploy/resume.sh` (kompletter Lauf) | exit 0 — ffmpeg ✔ · Stand-Tarball 1.650.231 B gebaut · Server live :8080 · **validate 335 pass / 0 fail** |
| `GET /api/health` | 200 · 912 B |
| `GET /api/milestones/kurz` | 200 · 189 B · `{"stufe":"BRONZE","verliehen":1,"katalog":14,"naechster":{"name":"MACHER","prozent":29,…}}` — deckt sich mit dem Runde-8-Beleg |
| `GET /meilensteine` | 200 · 17.075 B · nutzt `ui_kit.shell()` (Badge + NAV im HTML) |
| `GET /montage` | 200 · 18.592 B · nutzt `ui_kit.shell()` |

### Zwei echte Fehler auf reinem main gefunden und behoben (beide in `deploy/resume.sh`)

1. **`npm install` ließ das ganze Skript sterben:** Es gibt kein `package.json`
   (reines Node-Stdlib-Projekt) → npm brach mit `ENOENT` ab, `set -e` beendete
   `resume.sh` mit Exit 254, bevor der Server startete. Jetzt: ohne
   `package.json` wird der Schritt ehrlich übersprungen („reines
   Node-Stdlib-Projekt"), mit `package.json` läuft `npm install` wie bisher.
2. **`validate` stürzte mit `ERR_INVALID_URL` ab:** `resume.sh` setzte
   `AURA_URL="127.0.0.1:$PORT"` ohne Schema, `test/validate.js` baut daraus
   `127.0.0.1:8080/hub` → `new URL` wirft. Jetzt `AURA_URL="http://127.0.0.1:$PORT"`
   — der Prüf-Sweep läuft im Resume-Lauf wieder ehrlich durch (335/0, siehe oben).

### `deploy/push.sh` repariert

- Fest verdrahtetes `BRANCH="arena/…"` ersetzt durch
  `BRANCH="$(git rev-parse --abbrev-ref HEAD)"` (nach `cd "$ROOT"`), plus
  Detached-HEAD-Schutz (Abbruch statt Push auf `HEAD`).
- Veraltete Branch-Namen in `push.sh` (Kommentar + Variable) und in dieser
  Datei (Kopfzeile, Push-Abschnitte) auf den aktuellen Stand korrigiert —
  in `STATUS.md` steht der Branch jetzt nur noch als Ist-Stand, nicht als Rezept.
- PR-Titel/-Text in `push.sh` auf diese Hygiene-Runde aktualisiert (die alten
  Messwerte der Runden 4–8 stimmten für diesen Push nicht mehr).

### Runde 9 — Ausgangslage (Inventur, noch nicht umgestellt)

- `backend/pages/` enthält **59 Dateien: 58 `.js`-Seiten + 1 HTML-Fragment**
  (`ext_modules.fragment.html`); dazu kommen Seiten aus `backend/src/lib/`
  (u. a. `/meilensteine`, `/montage`, `/design`, `/start` — die letzten beiden
  Runden haben diese vier bereits auf `ui_kit.shell()` gehoben).
- Von den 58 JS-Seiten nutzt **noch keine einzige** `ui_kit` — alle liefern
  eigenes `<!doctype html>` mit eigenem CSS/NAV aus. Einzelne Dateien sind
  keine eigenständigen Seiten, sondern Bausteine/Snippets (z. B. `brain3d.js`
  wird von `hub.js` eingebunden) — die brauchen keine Shell, sondern bleiben
  Fragmente; das wird je Datei entschieden, nicht pauschal.
- Vorgehen schrittweise (je Block: umstellen → Suiten + Smoke + Live-Check →
  Messwerte hier nachtragen → eigener Commit): zuerst einfache, statische
  Seiten als Pilot, dann formular-/datenlastige, zuletzt die animierten
  Sonder-Seiten (Hub/Brain/Intro-Umfeld) — dort muss geprüft werden, ob die
  Shell das eigene Vollbild-Layout überhaupt verträgt.
