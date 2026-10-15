# AURA OS — Product Brief

**Status:** produktfähiger AURA-Operating-Layer als lokales, selbst hostbares Prototype.
**Nicht behauptet:** fertiges Geräte-Betriebssystem, SaaS-Mandantenfähigkeit, Markttraktion, Ersparniszahlen oder Live-Integrationen.

## 1. Die These

AURA OS ist kein weiteres Agenten-Dashboard und kein Sammelplatz für hundert Dienste. Es ist ein **Creator Operating System**: ein klarer Arbeitskern für Artists, Labels, Creator, Newsrooms und Studios.

Der Kern verbindet fünf Dinge, die heute meist getrennt leben:

1. **Identity & ownership** — Brand, Rechte, Rollen und finale Entscheidungen.
2. **Creative source of truth** — ein Master, Asset-/Lizenzbelege, Produktionsbrief und Varianten.
3. **Audience operations** — Social-Routen, Owned Page, UTM-Handoffs und begrenzte Paid-Flight-Pläne.
4. **Operating graph** — Zuständigkeiten, Reviews, Kalender und verbindliche nächste Schritte.
5. **Evidence loop** — nur offizielle oder manuell verifizierte Kennzahlen erzeugen neue Learnings.

Die Oberfläche dafür heißt **AURA OS Workspace**. Er paketiert bestehende AURA-Bereiche, statt neue Parallel-Tools zu erfinden.

## 2. Für wen

| Produktzelle | Primärer Nutzer | Sofortiger Nutzen |
|---|---|---|
| Artist Cell | unabhängiger Artist | Track/Release, Visuals, Inhalte, eigene Audience und Learnings in einer Kette |
| Label / Collective Cell | Label, Kollektiv | Roster, Rechte, Releases, 66 Ziel-Lanes, Kampagnen und Kalender pro Artist |
| Creator Business Cell | Creator, Educator, Brand | eigene Content-Pakete, Media-Produktion, Owned Page und Growth-Loop |
| Newsroom Cell | unabhängiges Media-Team | Watchlist → Kontext → eigener Bulletin-Brief → Avatar-/Video-Plan → Review |
| Studio / Agency Cell | Operator-Team | wiederholbare Kunden-/Artist-Workspaces mit transparenten Handoffs |

## 3. Die verkaufbare Einheit: ein Flight

Nicht „100 Automationen“, sondern klare Ergebnisse:

- **Release Flywheel:** Rechte → Master → Visuals → Social/Page/UTM → Budget-Plan → verifizierte Learnings.
- **Always-On Content Engine:** dokumentierte Idee → eigener Blickwinkel → mehrere Formate → Owned Archive → Review → Learn Loop.
- **Audio → Visual Drop:** Asset Ledger → DAW-/Shot-Plan → optionales Voice-/Avatar-Skript → Visual-Varianten → Short-Form-Pack.
- **Signal → Original Bulletin:** erlaubte Watchlist → Kontext → eigene Einordnung → Ticker/Avatar-Brief → geprüfter Kanalplan.
- **Client Growth Sprint:** Kundenbrief → Creative Source of Truth → Deliverables → Page/Ads-Guardrails → verifizierter Report.

## 4. Warum die Architektur Ressourcen spart

Die Einsparung ist zunächst **strukturell** und muss mit echten Operatoren gemessen werden:

- Ein Master-/Asset-Record statt mehrfacher Dateikopien und Briefings.
- Eine Rechte- und Freigabespur statt verstreuter Chat-Zusagen.
- Ein Campaign Graph statt separater Social-, Landingpage-, Ads- und Kalenderlisten.
- Lokale Briefe, Checklisten und Reviews als Default; externe Dienste nur für echte Spezialaufgaben.
- Eine Capability-Schleuse (Area 94), damit neue Tools nicht unkontrolliert zu neuen Kosten, Credentials und Workflows führen.

AURA OS verspricht **nicht** automatisch „x Stunden“ oder „y Prozent Kosten“. Für die erste Produktvalidierung werden pro Pilot gemessen:

- Zeit vom Brief bis zu einem reviewbaren Launch-Plan,
- Anzahl doppelter Asset-/Briefing-Eingaben,
- Anzahl offener bzw. unklarer Freigaben,
- Zeit bis zu einer verifizierten Learn-Loop-Entscheidung,
- Wiederverwendbarkeit eines Flights für den nächsten Release.

## 5. Technischer Kern heute

Die aktuelle AURA-Basis ist bereits ein einzelner self-hostbarer Node-Service mit lokaler JSON-State-Haltung:

```bash
node backend/server.js
```

Bestehende Deploy-Optionen: systemd, Docker und k3s. AURA OS nutzt das als **Operating Layer**; es ist kein separates zweites Backend.

Vor einem echten kommerziellen Multi-Tenant-Angebot sind eigene Produktphasen nötig:

1. Mandantenisolation und Authentifizierung,
2. rollenbasierte Zugriffe und sichere Team-Einladungen,
3. Objekt-/Dateispeicher und dokumentierte Backups,
4. Billing, Limits und klare Support-/SLA-Grenzen,
5. Datenverarbeitung, Verträge, Datenschutz und Compliance,
6. Integrationen nur über offizielle OAuth-/Partnerwege,
7. Telemetrie über echten Nutzen statt Vanity-Metriken.

## 6. Nicht verhandelbare Produktregeln

- Kein Passwort, Token, Cookie oder OAuth-Secret in AURA-Formularen.
- Kein automatischer Post, CMS-Deploy, Ad Spend oder Distributor-Submission.
- Keine vorgetäuschten Connected-, Analytics- oder Revenue-States.
- Originalität, Rechte, Kontext, Review und Admin-Freigabe bleiben Teil des Produkts.
- Neue Quellen und Tools gehen über Source Review → Local Prototype → Integration Spec → explizite Freigabe.

## 7. 90-Tage-Pilot, bevor wir groß verkaufen

### Phase 1 — Proof of Work
Drei bis fünf echte Design-Partner: ein Artist, ein Label-/Collective-Setup, ein Creator oder kleines Studio. Für jeden wird **ein** Flight vollständig lokal und nachvollziehbar abgebildet.

### Phase 2 — Proof of Repeatability
Der zweite und dritte Flight sollen ohne neue Tabellen, neue Standard-Ordnerstruktur oder neues Agenten-Setup möglich sein. Fehlende Handoffs werden im Workspace ergänzt, nicht außerhalb neu gebaut.

### Phase 3 — Proof of Market
Nur bei nachweisbarer Wiederholung: klares Onboarding, Rollenmodell, geteilter Workspace, Preis-/Packaging-Test und gezielte offizielle Connectoren.

## 8. Positionierung

> **AURA OS ist der self-hostbare Operating Layer für Creator-Businesses.**
> Ein Artist oder Label führt Werk, Rechte, Media, Audience und Wachstum in einem ruhigen System — ohne Tool-Salat, ohne Agenten-Zirkus und ohne falsche Automationsversprechen.

Die Lücke liegt nicht darin, noch mehr KI-Tools zu listen. Die Lücke liegt darin, ihre Arbeit so zu strukturieren, dass ein Mensch mit wenigen sichtbaren Entscheidungen zuverlässig veröffentlichungs- und lernfähig wird.
