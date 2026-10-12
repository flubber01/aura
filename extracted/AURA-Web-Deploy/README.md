# AURA Agent Command Center — Web-Deployment-Paket

Dieses Paket enthält die vorhandene AURA-HTML-App sowie eine minimale, sichere Grundstruktur für statisches Hosting.
Die Oberfläche ist ein Frontend. Eine echte Datenbank, API-Integration, Authentifizierung oder Telemetrie-Quelle wird durch das Paket nicht automatisch eingerichtet.

## Inhalt

- `public/index.html` — vorhandene AURA-Oberfläche
- `public/data/integrations.json` — Integrationsinventar mit expliziten Statusangaben
- `firebase.json` — Firebase Hosting-Konfiguration
- `Dockerfile` + `deploy/nginx.conf` — optionales Container-Hosting
- `docs/INTEGRATION-INVENTORY.md` — Status, Setup und Sicherheitsgrenzen
- `.env.example` — Platzhalter-Hinweise; keine echten Secrets

## Option A: Google Firebase Hosting

Voraussetzungen: Node.js/npm, Firebase CLI und ein Google-Konto mit Berechtigung für ein Firebase-Projekt.

1. Firebase CLI installieren: `npm install -g firebase-tools`
2. Anmelden: `firebase login`
3. Im Firebase Console ein Projekt erstellen oder auswählen.
4. Im Projektordner ausführen: `firebase use --add`
5. Projekt-ID auswählen; dadurch wird `.firebaserc` erstellt.
6. Deployen: `firebase deploy --only hosting`

Google Drive/Docs ist ein separater Dienst und wird nicht automatisch mit Hosting verbunden. Die Drive-Verbindung ist im aktuellen Arbeitsbereich nicht verfügbar, daher wurde nichts in ein Google-Konto hochgeladen.

## Option B: Docker

Im Projektordner:
```bash
docker build -t aura-web .
docker run --rm -p 8080:8080 aura-web
```
Dann lokal `http://localhost:8080` öffnen.

## Vor Produktivbetrieb

- Prüfen, ob die HTML-App alle erwarteten Bereiche und Funktionen enthält.
- Backend/API-Routen, Login, Rollen und Berechtigungen separat implementieren und testen.
- Secrets in Google Secret Manager oder einem geeigneten Secret Store halten.
- Telemetrie-Demos nicht als echte Messwerte behandeln.
- `public/data/integrations.json` bei Änderungen am Integrationsstatus aktualisieren.
