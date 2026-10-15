# AURA auf dem Android-Handy (Termux)

AURA läuft als Node-Server direkt auf dem Handy. Du öffnest die Oberfläche im Handy-Browser. Dafür brauchst du keinen Rechner.

## Was geht und was nicht

- **Geht:** AURA komplett auf dem Handy (Hub, Gelbe Seiten, Upload, Steuerzentrale, Board, Pipelines usw.). Vom PC oder anderen Geräten im selben WLAN erreichbar über `http://<Handy-IP>:8080`.
- **Geht eingeschränkt:** Musik-Apps öffnen. Termux:API kann eine App per Paketname starten (`am start`). Dafür brauchst du den Paketnamen der App, den findest du z. B. in den App-Infos.
- **Geht nicht:** AURA kann die Musik-Apps nicht steuern, Plugins nicht laden und keine Audio-Projekte in fremden Apps bearbeiten. Das würde Zugriff auf die Oberfläche der App brauchen (Accessibility), was wir nicht bauen.

## Installation

1. **Termux aus F-Droid installieren** (nicht aus dem Play Store, dort ist die Version veraltet).
2. Termux öffnen und dies eingeben:

```bash
pkg install -y git
git clone https://github.com/flubber01/aura.git ~/aura
cd ~/aura && git checkout arena/3b63f072-aura
bash deploy/termux/install.sh
```

Das Skript installiert `nodejs-lts`, prüft die Node-Version (22+) und startet den Server auf Port 8080.

3. Im Handy-Browser öffnen: `http://localhost:8080/hub`

## Dauerbetrieb

- **Wake-Lock:** `termux-wake-lock` verhindert, dass Android Termux schlafen legt. Termux:API muss dafür installiert sein. Das Skript versucht es automatisch.
- **Autostart nach Neustart:** Termux:Boot installieren, dann:

```bash
mkdir -p ~/.termux/boot && cp ~/aura/deploy/termux/boot.sh ~/.termux/boot/aura.sh
```

- **Logs:** `~/aura-server.log` (nur bei Autostart). Beim manuellen Start steht alles im Terminal.

## Sicherheit

- Der Server hört auf `0.0.0.0`. Wer im selben WLAN ist, kann die Seite erreichen. Setze vor dem Start `AURA_ADMIN_TOKEN`, sonst sind Schreibaktionen für jeden im Netz offen:

```bash
export AURA_ADMIN_TOKEN="ein-langes-geheimes-token"
```

- Der Kill-Switch und die Freigaben gelten auch auf dem Handy. Nichts wird ohne Freigabe veröffentlicht.
- Keine Schlüssel in Dateien schreiben. Nutze Umgebungsvariablen (z. B. `OLLAMA_URL`, `OPENROUTER_API_KEY`) und setze sie in deiner Termux-Shell oder in `~/.bashrc`.

## Musik-Apps öffnen (optional)

Mit Termux:API kannst du Apps per Paketname starten:

```bash
am start -n <paketname>/<aktivitaet>   # Beispiel: App-Paketname aus den App-Infos
```

Den Paketnamen trägst du selbst ein. Wir haben keine Paketnamen deiner Apps im Repo. Wenn du mir die Namen gibst, bau ich ein kleines Startmenü in AURA dafür.

## Prüfung

- Syntax der Skripte: `bash -n deploy/termux/install.sh && bash -n deploy/termux/boot.sh`
- Im Termux-Terminal nach dem Start: `curl -s localhost:8080/api/health`

Die Sandbox, in der dieses Repo entstanden ist, ist kein Android-Gerät. Der Ablauf auf Termux ist deshalb **noch nicht auf einem echten Handy getestet**.
