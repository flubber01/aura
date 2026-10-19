'use strict';
// Anbieterunabhängiger, lokaler Diagnosekatalog. Die Befehle sind Vorschläge:
// AURA zeigt und kopiert sie, führt sie aber niemals selbst aus.
const RUNBOOKS = [
  {
    id: 'server-startet-nicht',
    title: 'Server startet nicht',
    summary: 'Backend-Prozess, Gesundheitsprobe, Syntax und Startprotokoll eingrenzen.',
    keywords: ['server startet nicht', 'backend startet nicht', 'server down', 'startfehler', 'prozess fehlt', 'backend down', 'crash beim start', 'startet nicht', 'setsid'],
    diagnostics: [
      { label: 'Prozess- und Gesundheitszustand', command: 'pgrep -af "node backend/server.js"; curl -fsS http://127.0.0.1:8080/api/health' },
      { label: 'Letzte Backend-Logs', command: 'tail -n 40 "${AURA_LOG:-./aura-backend.log}"' },
      { label: 'JavaScript-Syntax', command: 'node --check backend/server.js' },
    ],
    steps: [
      { text: 'Prüfe zuerst, ob der Backend-Prozess läuft und der Health-Endpunkt antwortet (Standard-Start ist setsid, kein Dienstmanager).', commands: ['pgrep -af "node backend/server.js"', 'curl -fsS http://127.0.0.1:8080/api/health'] },
      { text: 'Lies die letzten Backend-Zeilen und suche nach dem ersten Fehler vor dem Abbruch.', commands: ['tail -n 40 "${AURA_LOG:-./aura-backend.log}"'] },
      { text: 'Prüfe die Serverdatei auf einen Syntaxfehler, ohne sie zu starten.', commands: ['node --check backend/server.js'] },
      { text: 'Fehlt der Prozess, starte AURA mit dem Standard-Ritual neu: erst beenden, dann den Installer-Einzeiler (er holt den gemergten Stand und startet mit Env).', commands: ['pkill -f backend/server.js || true', 'curl -fsSL https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh | bash'] },
    ],
  },
  {
    id: 'port-belegt',
    title: 'Port belegt',
    summary: 'Prozess am AURA-Port erkennen; erst identifizieren, dann Port ändern oder Prozess stoppen.',
    keywords: ['port belegt', 'address already in use', 'eaddrinuse', 'port in use', 'port 8080', '8080 belegt', '8080 belegt'],
    diagnostics: [
      { label: 'Port 8080', command: 'sudo ss -ltnp "sport = :8080"' },
      { label: 'Alternativer Port 8090', command: 'sudo ss -ltnp "sport = :8090"' },
      { label: 'Prozess am Port 8080', command: 'sudo fuser -v -n tcp 8080' },
    ],
    steps: [
      { text: 'Zeige den Prozess am Standardport an und beende ihn nicht, bevor du ihn zugeordnet hast.', commands: ['sudo ss -ltnp "sport = :8080"'] },
      { text: 'Prüfe, ob ein zweiter AURA-Dienst oder ein anderer Dienst den Port 8080 hält.', commands: ['sudo fuser -v -n tcp 8080'] },
      { text: 'Teste AURA bei Bedarf vorübergehend auf Port 8090.', commands: ['PORT=8090 node backend/server.js'] },
      { text: 'Wenn der Test klappt, passe den Port in der Dienstkonfiguration an und kontrolliere danach /api/health.', commands: ['curl -fsS http://127.0.0.1:8090/api/health'] },
    ],
  },
  {
    id: 'modell-nicht-gefunden',
    title: 'Modell nicht gefunden',
    summary: 'OLLAMA_MODEL mit der tatsächlich installierten Ollama-Modellliste vergleichen.',
    keywords: ['modell nicht gefunden', 'model not found', 'unknown model', 'modell fehlt', 'modellname', 'phi3', 'ollama pull'],
    diagnostics: [
      { label: 'Installierte Ollama-Modelle', command: 'ollama list' },
      { label: 'Ollama-API-Modellliste', command: 'curl -fsS http://127.0.0.1:11434/api/tags | python3 -m json.tool' },
      { label: 'AURA-Modellprobe', command: 'curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool' },
    ],
    steps: [
      { text: 'Vergleiche den Namen in OLLAMA_MODEL exakt mit einem Eintrag aus ollama list.', commands: ['ollama list'] },
      { text: 'Prüfe über die lokale API, ob Ollama das Modell wirklich anbietet.', commands: ['curl -fsS http://127.0.0.1:11434/api/tags | python3 -m json.tool'] },
      { text: 'Setze OLLAMA_MODEL direkt in der Start-Environment (Kopiervorlage — vor dem Starten den gewünschten Namen einsetzen).', commands: ['pkill -f backend/server.js || true', 'setsid nohup env PORT=8080 OLLAMA_URL=http://127.0.0.1:11434 OLLAMA_MODEL=phi3:mini OLLAMA_TIMEOUT_MS=60000 node backend/server.js >>"${AURA_LOG:-./aura-backend.log}" 2>&1 < /dev/null &'] },
      { text: 'Falls das Modell fehlt, lade es bewusst lokal nach und prüfe die Liste erneut.', commands: ['ollama pull phi3:mini', 'ollama list'] },
    ],
  },
  {
    id: 'jarvis-ohne-llm',
    title: 'JARVIS ohne LLM',
    summary: 'Konfiguration, lokale Ollama-Erreichbarkeit und J.A.R.V.I.S.-Probe getrennt prüfen.',
    keywords: ['jarvis ohne llm', 'jarvis kein llm', 'jarvis antwortet nicht', 'llm offline', 'ollama nicht erreichbar', 'ollama unreachable', 'local-llm', 'lokales modell'],
    diagnostics: [
      { label: 'AURA-Ollama-Status', command: 'curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool' },
      { label: 'Ollama lokal', command: 'curl -fsS http://127.0.0.1:11434/api/tags | python3 -m json.tool' },
      { label: 'Ollama-Env-Status des laufenden Prozesses (Schlüssel nur, keine Werte)', command: 'tr "\\0" "\\n" < /proc/$(pgrep -f "node backend/server.js" | head -1)/environ | grep -E "^(OLLAMA_URL|OLLAMA_MODEL|OLLAMA_TIMEOUT_MS)=" | sed -E "s/=(.*)$/=<gesetzt>/"' },
    ],
    steps: [
      { text: 'Prüfe die AURA-Probe: Sie zeigt, ob URL, Verbindung und ausgewähltes Modell stimmen.', commands: ['curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool'] },
      { text: 'Frage Ollama direkt auf dem VPS nach seiner lokalen Modellliste.', commands: ['curl -fsS http://127.0.0.1:11434/api/tags | python3 -m json.tool'] },
      { text: 'Kontrolliere, dass OLLAMA_URL und OLLAMA_MODEL im laufenden Prozess gesetzt sind, ohne ihre Werte auszugeben.', commands: ['tr "\\0" "\\n" < /proc/$(pgrep -f "node backend/server.js" | head -1)/environ | grep -E "^(OLLAMA_URL|OLLAMA_MODEL|OLLAMA_TIMEOUT_MS)=" | sed -E "s/=(.*)$/=<gesetzt>/"'] },
      { text: 'Wenn die Variablen angepasst wurden, starte AURA mit der neuen Environment bewusst neu (Standard-Ritual) und wiederhole die Probe.', commands: ['pkill -f backend/server.js || true', 'setsid nohup env PORT=8080 OLLAMA_URL=http://127.0.0.1:11434 OLLAMA_MODEL=phi3:mini OLLAMA_TIMEOUT_MS=60000 node backend/server.js >>"${AURA_LOG:-./aura-backend.log}" 2>&1 < /dev/null &', 'curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool'] },
    ],
  },
  {
    id: 'validate-zeigt-fail',
    title: 'Validate zeigt FAIL',
    summary: 'Ersten konkreten Fehlereintrag sichern, Backend- und Teststatus getrennt prüfen.',
    keywords: ['validate zeigt fail', 'validate fail', 'validation fail', 'test fail', 'prüfung fehlgeschlagen', '335/0', 'route smoke'],
    diagnostics: [
      { label: 'Validate-Sweep', command: 'cd "$HOME/aura" && node test/validate.js' },
      { label: 'Test-Suiten', command: 'cd "$HOME/aura" && node --test test/*.test.js' },
      { label: 'Backend-Gesundheit', command: 'curl -fsS http://127.0.0.1:8080/api/health | python3 -m json.tool' },
    ],
    steps: [
      { text: 'Führe Validate erneut aus und notiere den ersten FAIL samt Route und Antworttext.', commands: ['cd "$HOME/aura" && node test/validate.js'] },
      { text: 'Prüfe zuerst, ob der Server überhaupt gesund antwortet.', commands: ['curl -fsS http://127.0.0.1:8080/api/health | python3 -m json.tool'] },
      { text: 'Lass die Node-Test-Suiten getrennt laufen, damit Codefehler und Live-API-Fehler unterscheidbar bleiben.', commands: ['cd "$HOME/aura" && node --test test/*.test.js'] },
      { text: 'Vergleiche den konkreten Fehlereintrag mit dem lokalen Log-Ende; ändere nicht blind Runtime-Daten.', commands: ['tail -n 40 "${AURA_LOG:-./aura-backend.log}"'] },
    ],
  },
  {
    id: 'update-ritual',
    title: 'Update-Ritual',
    summary: 'Lokale Änderungen prüfen, Backend-Prozess beenden und den Installer nach einem Merge bewusst ausführen.',
    keywords: ['update', 'updaten', 'installer', 'installieren', 'neue version', 'neustart nach merge', 'pkill'],
    diagnostics: [
      { label: 'Arbeitsstand vor dem Update', command: 'cd "$HOME/aura" && git status --short --branch' },
      { label: 'Gesundheit vor dem Update', command: 'curl -fsS http://127.0.0.1:8080/api/health | python3 -m json.tool' },
    ],
    steps: [
      { text: 'Prüfe und sichere zuerst lokale Änderungen; führe den Installer erst aus, wenn der gewünschte Stand auf main gemergt ist.', commands: ['cd "$HOME/aura" && git status --short --branch'] },
      { text: 'Beende den laufenden Backend-Prozess für das Update-Ritual.', commands: ['pkill -f backend/server.js || true'] },
      { text: 'Starte den offiziellen Installer-Einzeiler für den gemergten main-Stand.', commands: ['curl -fsSL https://raw.githubusercontent.com/flubber01/aura/main/deploy/master-install.sh | bash'] },
      { text: 'Prüfe nach dem Installer Health und Validate; beide bleiben eine bewusste Operator-Prüfung.', commands: ['curl -fsS http://127.0.0.1:8080/api/health', 'cd "$HOME/aura" && node test/validate.js'] },
    ],
  },
  {
    id: 'modell-wechseln',
    title: 'Modell wechseln',
    summary: 'OLLAMA_MODEL auf einen bereits installierten Chat-Modellnamen setzen und die Verbindung prüfen.',
    keywords: ['modell wechseln', 'anderes modell', 'ollama_model', 'modell umstellen', 'phi3 mini', 'wechsel zu'],
    diagnostics: [
      { label: 'Verfügbare Modelle', command: 'ollama list' },
      { label: 'Aktive Modellprobe', command: 'curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool' },
    ],
    steps: [
      { text: 'Wähle zuerst einen Chat-Modellnamen, der in ollama list bereits erscheint.', commands: ['ollama list'] },
      { text: 'Setze OLLAMA_MODEL direkt in der Start-Environment auf den exakten Namen (Kopiervorlage — Namen vor dem Starten einsetzen).', commands: ['pkill -f backend/server.js || true', 'setsid nohup env PORT=8080 OLLAMA_URL=http://127.0.0.1:11434 OLLAMA_MODEL=phi3:mini OLLAMA_TIMEOUT_MS=60000 node backend/server.js >>"${AURA_LOG:-./aura-backend.log}" 2>&1 < /dev/null &'] },
      { text: 'Der Neustart ist Teil der Kopiervorlage oben — AURA läuft danach mit dem neuen Modell.', commands: ['pgrep -af "node backend/server.js"'] },
      { text: 'Prüfe anschließend Erreichbarkeit und model_present über die AURA-Probe.', commands: ['curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool'] },
    ],
  },
  {
    id: 'cpu-zeit-timeout',
    title: 'CPU-Zeit / Timeout',
    summary: 'CPU-Last, Ollama-Lauf und Timeout-Einstellungen prüfen, ohne deterministische Fakten zu verändern.',
    keywords: ['cpu zeit', 'cpu timeout', 'timeout', 'zu langsam', '60 sekunden', 'langsam', 'num_predict', 'cpu-only'],
    diagnostics: [
      { label: 'CPU-Kerne und freier Speicher', command: 'nproc && free -h' },
      { label: 'Aktive Ollama-Aufträge', command: 'ollama ps' },
      { label: 'AURA-Modellstatus', command: 'curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool' },
    ],
    steps: [
      { text: 'Prüfe CPU-Kerne und freien RAM, bevor du einen langsameren Modelllauf bewertest.', commands: ['nproc && free -h'] },
      { text: 'Sieh nach, ob Ollama ein Modell geladen hat oder gerade rechnet.', commands: ['ollama ps'] },
      { text: 'Für CPU-Hardware setze OLLAMA_TIMEOUT_MS in der Start-Environment auf 60000 (Kopiervorlage); die Browser-Anfrage wartet höchstens etwa 65 Sekunden.', commands: ['pkill -f backend/server.js || true', 'setsid nohup env PORT=8080 OLLAMA_URL=http://127.0.0.1:11434 OLLAMA_MODEL=phi3:mini OLLAMA_TIMEOUT_MS=60000 node backend/server.js >>"${AURA_LOG:-./aura-backend.log}" 2>&1 < /dev/null &'] },
      { text: 'Starte AURA nach einer Timeout-Änderung neu (Schritt oben) und probiere eine kurze Anfrage erneut.', commands: ['curl -fsS http://127.0.0.1:8080/api/jarvis/llm | python3 -m json.tool'] },
    ],
  },
  {
    id: 'log-lesen',
    title: 'Log lesen',
    summary: 'Letzte Zeilen des Backend-Logs und den passenden systemd-Zeitraum ansehen.',
    keywords: ['log lesen', 'logs', 'logdatei', 'log ende', 'fehler im log', 'journalctl', 'protokoll'],
    diagnostics: [
      { label: 'AURA-Log-Ende', command: 'tail -n 40 "${AURA_LOG:-./aura-backend.log}"' },
      { label: 'Log-Ende des Installer-Standards', command: 'tail -n 40 /var/log/aura-backend.log' },
    ],
    steps: [
      { text: 'Prüfe zuerst den von AURA verwendeten Logpfad und lies nur die letzten vierzig Zeilen.', commands: ['printf "AURA_LOG=%s\\n" "${AURA_LOG:-./aura-backend.log}"', 'tail -n 40 "${AURA_LOG:-./aura-backend.log}"'] },
      { text: 'Der Installer-Standard schreibt nach /var/log/aura-backend.log — lies dort alternativ die letzten vierzig Zeilen.', commands: ['tail -n 40 /var/log/aura-backend.log'] },
      { text: 'Suche den frühesten ERROR-Eintrag im Zeitraum und notiere Zeitstempel sowie Route.', commands: ['grep -iE "error|failed|exception" "${AURA_LOG:-./aura-backend.log}" | tail -n 40'] },
      { text: 'Teile vor einem Support-Bericht keine Zugangsdaten oder vollständigen privaten Logdateien.', commands: [] },
    ],
  },
  {
    id: 'validate-admin-token',
    title: 'Validate bei Admin-Token',
    summary: 'Validate crashes when Admin-Token is set. (Validate crasht bei gesetzem Admin-Token.)',
    keywords: ['validate crashes', 'validate crasht', 'admin token', 'admin-token', 'aura_admin_token', 'aura_validate_token', 'x-aura-token', 'gate greift', 'gate engages', 'validate fail', 'validate 401', 'typerror'],
    diagnostics: [
      { label: 'Validate-Sweep ohne Token', command: 'cd "$HOME/aura" && node test/validate.js' },
      { label: 'Validate-Sweep mit Token', command: 'cd "$HOME/aura" && AURA_VALIDATE_TOKEN="$AURA_ADMIN_TOKEN" node test/validate.js' },
    ],
    steps: [
      { text: 'Prüfe, ob der Server mit AURA_ADMIN_TOKEN läuft: Ohne den Header x-aura-token verweigern schreibende Routen dann mit 401.', commands: ['curl -fsS http://127.0.0.1:8080/api/auth/status | python3 -m json.tool'] },
      { text: 'Führe Validate mit dem Token aus — AURA_VALIDATE_TOKEN wird als x-aura-token an alle Admin-POSTs geschickt.', commands: ['cd "$HOME/aura" && AURA_VALIDATE_TOKEN="$AURA_ADMIN_TOKEN" node test/validate.js'] },
      { text: 'Ohne AURA_VALIDATE_TOKEN bewertet Validate Admin-Schreibprüfungen defensiv als „401 — Gate greift (Gate engages)" und crasht nicht; der Installer übergibt AURA_ADMIN_TOKEN automatisch.', commands: ['cd "$HOME/aura" && node test/validate.js'] },
    ],
  },
];

function fold(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9:./_-]+/g, ' ').trim();
}
function list() {
  return RUNBOOKS.map(({ id, title, summary, keywords, diagnostics }) => ({
    id, title, summary, keywords: keywords.slice(),
    diagnosis: diagnostics.map((item) => item.label),
    diagnostics: diagnostics.map((item) => ({ ...item })),
  }));
}
function get(id) { return RUNBOOKS.find((item) => item.id === String(id || '')) || null; }
function match(text, options = {}) {
  const source = fold(text);
  const wanted = Array.isArray(options.ids) ? new Set(options.ids.map(String)) : null;
  const ranked = RUNBOOKS.map((book) => {
    let score = 0;
    for (const keyword of book.keywords) {
      const phrase = fold(keyword);
      if (!phrase) continue;
      if (source.includes(phrase)) score += phrase.includes(' ') ? 6 : 3;
      else {
        const words = [...new Set(phrase.split(' ').filter((word) => word.length >= 3))];
        const hits = words.filter((word) => source.includes(word)).length;
        if (hits) score += hits * 2;
      }
    }
    if (wanted && wanted.has(book.id)) score += 100;
    return { ...book, score };
  });
  let selected = ranked.filter((book) => book.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 3);
  if (wanted && selected.length) selected = selected.filter((book) => wanted.has(book.id));
  if (!selected.length) {
    const fallback = get('log-lesen');
    selected = [{ ...fallback, score: 0 }];
  }
  return selected;
}

module.exports = { RUNBOOKS, list, get, match };
