# CreedStreetStudios47 — Website-Konzept

Eigenständige, responsive deutsche Website für Musikstudio, Independent-Label und digitale Release-Planung aus Duisburg. Bestehende AURA-Oberflächen bleiben unverändert.

## Starten und bearbeiten

```sh
node creedstreet/server.js          # Vorschau auf Port 3000, Bindung 0.0.0.0
python creedstreet/build.py         # statische Seiten neu generieren
node --test creedstreet/site.test.cjs
```

Keine Node-Abhängigkeiten und kein Frontend-Framework. `build.py` nutzt `templates/home.html` als Startseiten-Template und enthält die Unterseitentexte. Dauerhafte HTML-Änderungen dort vornehmen, anschließend neu generieren. Gemeinsame Dateien: `style.css`, `app.js`, `connect.js`, `public-settings.js`.

## Seiten

- `/` bzw. `/index.html`: Marke, Leistungen, Studiobilder und dezenter Suno-Link.
- `/studio.html`: Recording, Mixing, Mastering, Bildgalerie, FAQ und Suno-Link.
- `/vertrieb.html`: Label-Konzept, Release-Checkliste und sachliche Brancheneinordnung.
- `/ueber-uns.html`: Haltung und regionale Ausrichtung.
- `/kontakt.html`: lokales Projektbriefing, Social Fast Connect und FAQ-Guide.
- `/impressum.html`: ausdrücklich noch unvollständige rechtliche Anbieterangaben.
- `/datenschutz.html`: tatsächliches Verhalten von Formular, FAQ-Chat und Social-Speicher.
- `/werbung.html`: gekennzeichnete, inaktive AdSense-Fläche.

## Musik: Schwarzes Eisen + Suno-Profil

Vom Nutzer bereitgestelltes Profil: **https://suno.com/@creedstreetstudios47**. Die dezente Karte trägt „Unser Sound. Powered by Suno.“ und öffnet das Profil mit `noopener noreferrer`; keine Suno-Einbettung oder automatische Suno-Anfrage.

Auf ausdrücklichen Nutzerwunsch wurde **Schwarzes Eisen.mp3** aus dem verbundenen Cloud-Ordner **Tiktok** übernommen. `assets/audio/schwarzes-eisen.mp3` ist eine unveränderte Kopie (5.280.978 Byte, SHA-256 `163b10dbb67effcceac746205d3c10ca1bb26704518378d19335e83823dafa9a`). Es wurden keine Cloud-Dateien oder Freigaben verändert. Die Website lädt die Kopie vom eigenen Server, nicht aus Google Drive oder von Suno.

`sound.js` versucht hörbares Autoplay beim Öffnen mit 32 % Lautstärke. Der Track läuft im Hintergrund in Schleife. **Browser können hörbares Autoplay blockieren**; dann erscheint wahrheitsgemäß „Sound an“. Ein expliziter Klick startet die Musik. Der kleine Schalter unten links schaltet sie jederzeit aus. Kein großer Player, kein Timeline-/Download-UI und kein alter künstlicher NIGHTSHIFT-Beat.

Nach einer ausdrücklichen Sound-Auswahl werden Ein/Aus und Abspielposition unter `cs47-sound-v1` im Sitzungsspeicher für Seitenwechsel gespeichert; ohne Nutzerwahl legt der automatische Start keinen neuen Sitzungseintrag an. Eine ausgeschaltete Musik bleibt beim Seitenwechsel aus. Beim Öffnen eines Suno-Links wird die lokale Musik ausgeschaltet, damit nicht zwei Quellen gleichzeitig spielen. Sitzungs-Speicherung ist optional; die Grundfunktion funktioniert auch ohne verfügbaren Speicher.

Der frühere Beat, sein Player-Script und sein Renderer bleiben entfernt. Der Server erlaubt nur die bereitgestellte neue MP3, unterstützt Byte-Ranges und beschränkt Medien auf denselben Ursprung. Nutzungs-/Veröffentlichungsrechte der bereitgestellten Musik sind vor öffentlichem Deployment vom Betreiber zu bestätigen.

## Funktionen

- Responsive Navigation und Tastaturbedienung; moderne Animationen statt Flash, mit reduzierter Bewegung.
- Fünf unveränderte Nutzerbilder mit vergrößerbarer Ansicht. Quellenkennzeichnungen bleiben sichtbar.
- Lokal geladene Space-Grotesk-Schriftdateien; Lizenz in `assets/fonts/LICENSE.txt`.
- Projektbriefing mit Pflichtfeldprüfung und lokalem TXT-Download. **Kein Versand, keine Buchungsbestätigung.**
- Regelbasierter FAQ-Chat im Browser: keine generative KI, kein Serverkontakt, keine dauerhafte Chat-Speicherung; Texte werden nicht als HTML eingefügt.
- Social Fast Connect für Instagram, TikTok, YouTube, Spotify, WhatsApp und Suno. Bestätigte öffentliche URLs in `public-settings.js` gelten für alle Besucher. Keine Passwörter oder Tokens dort hinterlegen.
- Besucher können öffentliche Profil-URLs ausdrücklich lokal unter `cs47-social-v1` speichern. Erlaubte HTTPS-Hosts/Profilpfade werden geprüft; Löschfunktion im Social-Dialog und auf der Datenschutzseite. Kein OAuth oder automatisches Posting.
- Teilen über nativen Browserdialog oder Zwischenablage nach Nutzeraktion.

## Marke und Inhalte

**Dein Sound. Deine Regeln. Deine Zukunft.**

Die Vision: Musikproduktion, Artist-Entwicklung und digitale Release-Planung für Independent-Artists aus Duisburg und dem Ruhrgebiet. Keine erfundenen Erfolge, Partnerschaften, Referenzen, Preise oder Marktführerschaft.

Genannte große Labels/Distributoren sind rein redaktionelle Beispiele, kein vollständiges Verzeichnis und keine Partnerliste: unter anderem Universal, Sony, Warner, DistroKid, TuneCore, CD Baby, Believe, recordJet, iGroove, ONErpm, The Orchard, AWAL, ADA und Virgin Music Group. Ein operativer Self-Service-Vertrieb ist nicht angebunden.

## SEO und Veröffentlichung

Individuelle Seitentitel, Meta-Descriptions, ein H1 pro Seite, interne Verlinkung, Open-Graph- und WebPage-Strukturdaten mit Suno-`sameAs`, natürliche lokale Begriffe wie Tonstudio Duisburg, Musiklabel Duisburg und digitaler Musikvertrieb. Keine Rankinggarantie oder Keyword-Spam.

Standard ist eine nicht indexierbare Vorschau. Nach Bestätigung einer echten HTTPS-Domain und sämtlicher Launch-Voraussetzungen:

```sh
PUBLIC_SITE_URL=https://deine-bestaetigte-domain.de python creedstreet/build.py
```

Erzeugt Canonicals und Sitemap für die fünf inhaltlichen Hauptseiten. Rechtliche Seiten und reine Werbefläche bleiben noindex. Dies deployt nichts automatisch. Die vom Nutzer genannte Zieladresse ist `creedstreetstudios47.de`; eine tatsächliche dogado-Zuordnung oder Veröffentlichung wurde noch nicht ausgeführt.

Der Vorschau-Server liefert nur freigegebene Dateien aus, verwendet `Cache-Control: no-cache` und erlaubt ausschließlich die bereitgestellte Hintergrundmusik vom eigenen Ursprung. Styles/Connector-Script tragen zusätzlich eine Versionskennung, um veraltete Player-Ansichten zu vermeiden.

## Vor öffentlichem Launch erforderlich

1. Rechtlicher Anbieter, vollständige Anschrift, verifizierte Kontaktdaten und vollständige Rechtstexte.
2. Rechte aller Studiobilder bestätigen, insbesondere Dreamstime-/Peerspace-Material. Google-Sichtbarkeit ersetzt keine Lizenz. Tatsächliche Zuordnung der Räume zum Unternehmen prüfen.
3. Ausstattung, verfügbare Leistungen, Verträge und operative Distributionsanbindungen bestätigen.
4. Reale Kontakt-/Buchungsschnittstelle nur mit ausdrücklicher Konfiguration und passenden Datenschutzinformationen anbinden.
5. HTTPS-Hosting, Domain-Zuordnung und Upload ausführen; die laufende Vorschau ist kein Deployment auf die Domain.
6. AdSense erst nach Publisher-Freigabe, passenden IDs, geeigneter zertifizierter CMP, Datenschutzprüfung, CSP-Anpassung und gegebenenfalls `ads.txt` aktivieren. Der Platzhalter lädt keine Werbeskripte.

Das Vinyl-Hauptmotiv ist KI-generiert. Die Studio-Galerie enthält die fünf vom Auftraggeber bereitgestellten Dateien.
