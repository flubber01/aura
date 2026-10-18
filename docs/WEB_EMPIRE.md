# Web Empire / Eigene Seiten

Erweiterung des **bestehenden** AURA-Analyseboards — **kein** zweites Master-Panel, keine Ersatz-Verwaltung
für die Nischen-Seiten. Die einzelnen Websites bleiben technisch eigenständig und separat installierbar.

Quelle: Google-Docs-Spezifikation „AURA & Multi-Niche Web Empire — Standalone & Cluster Master Architecture",
Abschnitt **„VERBINDLICHE KLARSTELLUNG — AURA-ANBINDUNG"** (hat Vorrang).

Code: `backend/src/lib/web_empire.js` · Tests: `test/web_empire.test.js` · Speicher: `backend/src/data/web_empire.json` (git-ignoriert, selbstheilend)

---

## Was die Schicht tut

| Aufgabe | Umsetzung |
|---|---|
| Seiten-Registry | Seiten-ID, Domain, Nische, Affiliate-Status, Analytics-Quelle, Consent-Status, aktive Integration |
| Verbindung nur nach Freigabe | Registrierung erzeugt `PENDING` + Freigabe; **kein Auto-Connect** |
| Signierte Schnittstelle | Pro Seite ein API-Schlüssel (nur **Hash** gespeichert, Klartext **einmal** ausgegeben), optionale HMAC-Signatur |
| Ehrliche Labels | `LIVE` (frische echte Daten) · `SIM` (ausdrücklich als Simulation markiert) · `NOT-CONNECTED` |
| Link-/Banner-Slots | z. B. `CASINO_HERO_DE`, `ADULT_LISTING_01`, `FINANCE_CARD_MAIN` — zentral, nicht pro Unterseite |
| Ausfall-Rotation | nur innerhalb des **vorab freigegebenen** Pools; sonst neutraler Verfügbarkeitszustand |
| Health-Check | markiert Partner `DOWN`/`UP`; zählt **nie** als Klick, Besuch oder Conversion |
| Feature-Flags | 9 Module (`FORUM`, `COMMENTS`, `SEARCH`, `SIDEBAR`, `COMMUNITY`, `NEWSLETTER`, `ADSENSE`, `SOCIAL_WIDGETS`, `VISIT_OUR_FRIENDS`) |
| Stilvarianten | genau **5** je Website, genau eine aktiv; Wechsel ändert nur Präsentation |
| Blanko-Header/Footer | zentral je Seite/Gruppe pflegbar (Logo, Claim, Navigation, CTA, Rechtliches, Consent, Freunde) |
| Audit | jede Änderung mit Zeitstempel und Urheber |

## Was die Schicht **nicht** tut (in Code erzwungen)

- **Keine automatische Traffic-, Klick-, View-, Like- oder Kommentar-Erzeugung.** Es gibt keine solche Funktion
  und keinen Schalter dafür — auch nicht versteckt. Der Test `KEINE Funktion erzeugt Traffic, Klicks, Views oder Likes`
  prüft, dass kein Export so etwas anbietet.
- **Kein Scraping fremder Seiten**, keine fremden Zugangsdaten, keine versteckten Tracker.
- **Keine Verbindung fremder Domains.** Über die obere Linkliste der Spezifikation ist ausdrücklich gesagt:
  reine Rechercheliste, kein Link daraus gilt automatisch als eigene Seite, Partner oder Freigabe.
  Technisch: `affiliate_status: NONE` → **403**.
- **Keine erfundenen Messwerte.** Fehlende Daten werden nicht geschätzt, nicht hochgerechnet und nicht als `LIVE` gezeigt.
- **Keine Conversion ohne autorisierte Quelle.** `conversion_confirmed` ohne `authorized_source` wird verworfen (nicht gezählt).
- **Keine Sackgasse.** Fällt ein Partner aus und es gibt keinen freigegebenen Ersatz, wird der Slot `NEUTRAL`
  statt auf eine beliebige fremde URL umzuleiten.
- **Kein Auto-Deployment.** Registrierung, Aktivierung, Pool-/Linkänderung und Deployment sind Freigabe-pflichtig (REGEL 1).

## HTTP-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/web-empire` | Status: Seiten, Slots, offene Freigaben, Audit-Auszug |
| POST | `/api/web-empire/sites/register` | Seite registrieren → `202 pending_approval` |
| GET | `/api/web-empire/approvals` | offene Freigaben |
| POST | `/api/web-empire/approvals/<AP-xxxxxx>/(approve\|deny)` | Entscheidung — **nur ein Mensch** |
| POST | `/api/web-empire/sites/<id>/update` | Module-Flags, Stil, Header/Footer, sperren |
| GET | `/api/web-empire/sites/<id>/metrics` | Kennzahlen + ehrliches Label |
| POST | `/api/web-empire/sites/<id>/metrics` | Ereignisse einliefern (Auth = Seitenschlüssel, nicht Admin-Token) |
| POST | `/api/web-empire/slots/add` | Slot anlegen |
| POST | `/api/web-empire/slots/<SLOT>/pool` | Partner-Pool vorschlagen → Freigabe |
| GET | `/api/web-empire/slots/<SLOT>/resolve` | was ausgeliefert würde (Partner/URL oder NEUTRAL) |
| POST | `/api/web-empire/slots/<SLOT>/health` | Partner `UP`/`DOWN` markieren |

Schreibende Verwaltungsrouten laufen zusätzlich durch das Admin-Token-Gate (`x-aura-token` oder Login-Session).

## Ereignistypen (nur Zählung eingehender, autorisierter Meldungen)

`pageview` · `session` · `referrer` · `utm` · `outbound_click` · `error` · `conversion_confirmed`

## Beispiel: Seite anmelden

```bash
# 1) registrieren (erzeugt PENDING + Freigabe)
curl -sX POST localhost:8080/api/web-empire/sites/register -H 'content-type: application/json' \
  -d '{"id":"casino-toplist","domain":"casino-toplist.de","niche":"IGAMING",
       "affiliate_status":"OWN","consent_status":"OK","by":"<Name>"}'

# 2) Freigabe durch einen Menschen (nicht durch Bots/Agenten)
curl -sX POST localhost:8080/api/web-empire/approvals/AP-xxxxxx/approve \
  -H 'content-type: application/json' -d '{"by":"<Name>"}'
# -> api_key wird GENAU EINMAL angezeigt. In den Vault der Website legen, nicht in Git, nicht in den Chat.

# 3) Website meldet echte Ereignisse
curl -sX POST localhost:8080/api/web-empire/sites/casino-toplist/metrics \
  -H 'content-type: application/json' \
  -d '{"key":"<api_key>","events":[{"type":"pageview","path":"/"},{"type":"outbound_click","partner":"partner-a"}]}'
```

## Abnahmekriterien aus der Spezifikation

| Kriterium | Stand |
|---|---|
| Kein neues übergeordnetes Web-Empire-Adminpanel | ✅ Erweiterung des vorhandenen Boards |
| Jede Website bleibt separat installier- und betreibbar | ✅ keine Verbindungspflicht; Standalone-Modus bleibt |
| Freigegebene Seiten + Link-Objekte lesbar verwalten | ✅ Registry + Slots |
| Echte Messdaten laufen einheitlich ein | ✅ signierter Ingest, Aggregation je Seite/Slot/Partner |
| Ohne Freigabe/Signatur/Consent keine Verbindung | ✅ 403/401-Pfade getestet |
| Alle Statusanzeigen ehrlich und prüfbar | ✅ LIVE/SIM/NOT-CONNECTED, Audit-Log |
| Zentral geänderter Slot konsistent an allen Plätzen | ✅ ein Slot-Objekt, Templates referenzieren nur die Slot-ID |
| Ausgefallenes Ziel erzeugt keine Sackgasse | ✅ Rotation im Pool oder NEUTRAL |
| Deaktivierte Module hinterlassen keine Reste | ✅ Flags wirken auf Navigation, Routen, Sitemap, Jobs gemeinsam |

## Offen (bewusst nicht Teil dieser Schicht)

- Die Nischen-Sites selbst (`/master-web-empire/01_igaming_toplists` … `06_banking_fintech_aff`) sind
  eigenständige Projekte auf einem vom Administrator autorisierten Server. AURA liefert nur die Anbindung.
- Echte Conversion-Daten brauchen eine autorisierte Partner-API oder einen rechtmäßigen Postback.
- Werte ohne Datenquelle bleiben `NOT-CONNECTED` — bis eine echte Quelle angeschlossen ist.

---

## Abgrenzung

Eine zweite Google-Docs-Spezifikation („Autonomous Agent Cosmos") beschreibt u. a. Anti-Fingerprint-Tarnung,
Residential-Proxy-Verkettung, gefälschte Nutzeridentitäten und die **Erzeugung** von Klicks, Views, Likes und
Watchtime. Das steht im direkten Widerspruch zu den hier geltenden und im Projekt festgeschriebenen Regeln
(siehe `README.md` → Safety: kein SOCKS-Ban-Evasion, keine Stealth-Multi-Account-Aktionen, kein
CAPTCHA-/Plattform-Bypass, keine menschliche Imitation/synthetische Biometrie; Areas 32/33/36 → 403).
Diese Teile sind **nicht** implementiert und werden nicht implementiert. Was daraus übernommen wurde, sind
ausschließlich die legitimen Betriebsmuster: Vier-Ebenen-Struktur als Org-Modell, Selbstheilung,
Zustandsarchiv, Freigabe- und Auditpflicht.
