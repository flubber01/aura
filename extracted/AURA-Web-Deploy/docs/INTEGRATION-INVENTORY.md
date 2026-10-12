# AURA – Integrationsinventar

Dieses Inventar dokumentiert mögliche Integrationen aus den vorliegenden Projektunterlagen.
Es ist keine Bestätigung, dass externe Konten, APIs oder Dienste bereits verbunden sind.

| Integration | Status | Nächster Schritt |
|---|---|---|
| Google Cloud / Firebase Hosting | Setup erforderlich | Firebase-Projekt wählen, CLI anmelden und Hosting deployen |
| Google Drive / Docs | Nicht verbunden | Google-Drive-Verbindung/Autorisierung im verwendeten Workspace freischalten |
| OpenRouter | Setup erforderlich | API-Key serverseitig als Secret speichern |
| Ollama | Nicht verbunden | Lokalen Ollama-Endpunkt konfigurieren |
| Hugging Face / vLLM | Setup erforderlich | Modellzugriff, Hardware und Serving separat konfigurieren |
| PostgreSQL | Backend erforderlich | Datenbank und Migrationen separat bereitstellen |
| Docker | Optional | `docker build -t aura-web .` |
| n8n | Nicht verbunden | Eigene Instanz, Credentials und Workflow-Freigaben konfigurieren |
| MCP | Backend erforderlich | Autorisierte MCP-Server und Tool-Berechtigungen konfigurieren |
| GitHub | Setup erforderlich | Repository und CI/CD nach Bedarf einrichten |
| NotebookLM | Manueller Workflow | Notebooks und Quellen manuell verwalten |
| Telemetrie | Nur Simulation, falls Demo-Daten angezeigt werden | Vor produktiver Nutzung echte, autorisierte Datenquelle anschließen |

## Sicherheitsgrenzen

- Keine Zugangsdaten oder privaten Schlüssel in `public/` oder im Browser-Code speichern.
- Keine fremden Cloud-Compute-Ressourcen ohne ausdrückliche Berechtigung starten.
- Keine automatisierte Umgehung von Captchas, OTPs, Plattformschutz oder Kontobeschränkungen.
- Personen- oder biometrische Daten nur mit geeigneter Rechtsgrundlage, Einwilligung und Zugriffsschutz verarbeiten.
- Vor produktivem Einsatz App-Funktionalität, Lizenzlage, Datenschutz, Authentifizierung und Autorisierung prüfen.
