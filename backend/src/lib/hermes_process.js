'use strict';
// AURA · Hermes im ganzen Prozess.
//
// Hermes ist kein Sonderfall am Rand, sondern geht jeden Arbeitsschritt mit: Er liest mit, prüft
// Voraussetzungen, macht Vorschläge, holt Beurteilungen ein — und hat dabei nur die Rechte, die ihm
// ausdrücklich verliehen wurden. Jeder Prozess (Song, Video, Avatar, Kampagne, Seite, Support,
// Analyse, Sicherheit, Inhalt, Geld, Gerät) ist hier in Stufen zerlegt; jede Stufe sagt, was Hermes
// dort tut, welche Fähigkeit er dafür braucht und ob ein Mensch zustimmen muss.
//
// Was diese Datei absichtlich NICHT tut: sie erfindet keine Ergebnisse. Eine Stufe, deren Modul fehlt
// oder deren Fähigkeit nicht verliehen ist, meldet das ehrlich und läuft weiter, statt etwas
// vorzutäuschen. Und an jeder Menschenschwelle hält der ganze Ablauf an.
//
// Merksatz: Hermes darf begleiten, vorbereiten und vorschlagen. Das letzte Wort hat der Mensch.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_HERMES_FLOW_FILE || path.join(__dirname, '..', 'data', 'hermes_flow.json');

const HERMES_ROLES = [
  { id: 'mitlesen', what: 'Zustand lesen und mitprotokollieren', skill: 'read_status' },
  { id: 'recherche', what: 'öffentliche Unterlagen nachschlagen', skill: 'read_public_docs' },
  { id: 'vorschlag', what: 'einen Entwurf vorschlagen', skill: 'propose_draft' },
  { id: 'beurteilung', what: 'eine Beurteilung anfordern', skill: 'request_review' },
  { id: 'bedarf', what: 'eine zusätzliche Fähigkeit beantragen', skill: 'suggest_skill' },
  { id: 'schweigen', what: 'nur zuschauen, nichts ändern', skill: null },
];

// Jede Stufe: was passiert, wer handelt, was Hermes tut, welche Fähigkeit zählt, ob ein Mensch zustimmen muss.
const PROCESSES = [
  {
    id: 'song', name: 'Song: von der Idee bis zur Veröffentlichung', owner: 'songbook', steps: [
      { id: 'idee', name: 'Ideen sammeln', who: 'artist_messenger', action: 'channels', hermes: 'mitlesen', human: false },
      { id: 'entwurf', name: 'Entwurf anlegen', who: 'songbook', action: 'create', hermes: 'vorschlag', human: false },
      { id: 'pruefung', name: 'Rechteklärung und Prüfung', who: 'royalty_free', action: 'sources', hermes: 'recherche', human: false },
      { id: 'mischung', name: 'Mischen und Effekte', who: 'daw_plugins', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'ablage', name: 'Fassung ablegen', who: 'content_store', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'freigabe', name: 'Veröffentlichung freigeben', who: 'content_store', action: 'setState', hermes: 'beurteilung', human: true },
    ],
  },
  {
    id: 'video', name: 'Video: Auftrag bis Auslieferung', owner: 'video_department', steps: [
      { id: 'auftrag', name: 'Auftrag anlegen', who: 'video_department', action: 'board', hermes: 'mitlesen', human: false },
      { id: 'abnahme', name: 'Qualitätsprüfung', who: 'video_department', action: 'board', hermes: 'beurteilung', human: false },
      { id: 'ablage', name: 'Fassung ablegen', who: 'content_store', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'freigabe', name: 'Veröffentlichung freigeben', who: 'content_store', action: 'setState', hermes: 'beurteilung', human: true },
    ],
  },
  {
    id: 'avatar', name: 'Avatar und Podcast', owner: 'avatar_studio', steps: [
      { id: 'rolle', name: 'Rolle wählen', who: 'avatar_studio', action: 'archetypes', hermes: 'vorschlag', human: false },
      { id: 'aufnahme', name: 'Folge aufnehmen', who: 'avatar_studio', action: 'status', hermes: 'mitlesen', human: false },
      { id: 'pruefung', name: 'Folge prüfen', who: 'avatar_studio', action: 'status', hermes: 'beurteilung', human: false },
      { id: 'ablage', name: 'Fassung ablegen', who: 'content_store', action: 'list', hermes: 'mitlesen', human: false },
    ],
  },
  {
    id: 'kampagne', name: 'Kampagne: 13 Stufen mit Zwischenprüfungen', owner: 'campaign_planner', steps: [
      { id: 'plan', name: 'Kampagne planen', who: 'campaign_planner', action: 'stages', hermes: 'vorschlag', human: false },
      { id: 'kanaele', name: 'Kanäle festlegen', who: 'web_empire', action: 'slots', hermes: 'recherche', human: false },
      { id: 'kalender', name: 'Termine setzen', who: 'calendar', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'budget', name: 'Werbebudget freigeben', who: 'advertising', action: 'campaigns', hermes: 'beurteilung', human: true },
    ],
  },
  {
    id: 'seite', name: 'Eigene Seite: Entwurf bis Betrieb', owner: 'web_empire', steps: [
      { id: 'seite', name: 'Seite bestimmen', who: 'web_empire', action: 'pages', hermes: 'recherche', human: false },
      { id: 'projekt', name: 'Projekt anlegen', who: 'site_projects', action: 'create', hermes: 'vorschlag', human: false },
      { id: 'pruefung', name: 'Prüflauf (TLS, Sicherung, Monitoring)', who: 'site_projects', action: 'verify', hermes: 'beurteilung', human: false },
      { id: 'paket', name: 'Deploy-Paket bereitstellen', who: 'site_projects', action: 'pack', hermes: 'mitlesen', human: false },
      { id: 'live', name: 'Aufschalten auf dem Server', who: 'site_projects', action: 'pack', hermes: 'schweigen', human: true },
    ],
  },
  {
    id: 'support', name: 'Support: Meldung bis Lösung', owner: 'support', steps: [
      { id: 'meldung', name: 'Meldung aufnehmen', who: 'support', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'belege', name: 'Belege anhängen', who: 'support', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'alarm', name: 'Bei Sicherheit: Alarmleiter', who: 'security_response', action: 'status', hermes: 'beurteilung', human: false },
      { id: 'antwort', name: 'Antwort an den Melder', who: 'support', action: 'reply', hermes: 'vorschlag', human: true },
    ],
  },
  {
    id: 'analyse', name: 'Analyse: Messung bis Vorhersage', owner: 'analytics_forecast', steps: [
      { id: 'messung', name: 'Messwerte aufnehmen', who: 'analytics_forecast', action: 'traffic', hermes: 'mitlesen', human: false },
      { id: 'auswertung', name: 'Traffic auswerten', who: 'analytics_forecast', action: 'analyze', hermes: 'mitlesen', human: false },
      { id: 'charts', name: 'Marktcharts abgleichen', who: 'analytics_forecast', action: 'charts', hermes: 'recherche', human: false },
      { id: 'vorhersage', name: 'Vorhersage mit Spanne', who: 'analytics_forecast', action: 'forecast', hermes: 'vorschlag', human: false },
      { id: 'entscheidung', name: 'Aus der Vorhersage etwas machen', who: 'analytics_forecast', action: 'briefing', hermes: 'beurteilung', human: true },
    ],
  },
  {
    id: 'sicherheit', name: 'Sicherheit: erkennen, isolieren, entfernen', owner: 'security_response', steps: [
      { id: 'suche', name: 'Absuchen', who: 'security_response', action: 'sweep', hermes: 'mitlesen', human: false },
      { id: 'erkennen', name: 'Angriff erkennen', who: 'security_response', action: 'cases', hermes: 'beurteilung', human: false },
      { id: 'isolieren', name: 'Angriff isolieren', who: 'security_response', action: 'isolate', hermes: 'mitlesen', human: false },
      { id: 'pruefen', name: 'Von einem Menschen prüfen lassen', who: 'security_response', action: 'review', hermes: 'beurteilung', human: true },
      { id: 'entfernen', name: 'Erst dann entfernen', who: 'security_response', action: 'eject', hermes: 'schweigen', human: true },
    ],
  },
  {
    id: 'inhalt', name: 'Inhalt: anlegen, fassen, sichern, veröffentlichen', owner: 'content_store', steps: [
      { id: 'anlegen', name: 'Inhalt anlegen', who: 'content_store', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'fassung', name: 'Neue Fassung statt Überschreiben', who: 'content_store', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'buendel', name: 'Sammelausgabe schnüren', who: 'content_store', action: 'bundle', hermes: 'mitlesen', human: false },
      { id: 'veroeffentlichen', name: 'Veröffentlichen', who: 'content_store', action: 'setState', hermes: 'beurteilung', human: true },
    ],
  },
  {
    id: 'geld', name: 'Geld: Angebot bis Beleg', owner: 'billing_plans', steps: [
      { id: 'angebot', name: 'Angebot rechnen', who: 'billing_plans', action: 'quote', hermes: 'vorschlag', human: false },
      { id: 'anbieter', name: 'Zahlungsweg wählen', who: 'payment_providers', action: 'choose', hermes: 'recherche', human: false },
      { id: 'beleg', name: 'Beleg erzeugen', who: 'billing_plans', action: 'invoice', hermes: 'mitlesen', human: false },
      { id: 'abbuchung', name: 'Geld bewegen', who: 'payment_providers', action: 'checkout', hermes: 'beurteilung', human: true },
    ],
  },
  {
    id: 'geraet', name: 'Gerät: anschließen bis steuern', owner: 'daw_devices', steps: [
      { id: 'suchen', name: 'Geräte suchen', who: 'daw_devices', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'lernen', name: 'Regler anlernen', who: 'daw_devices', action: 'learn', hermes: 'mitlesen', human: false },
      { id: 'anwenden', name: 'Werte anwenden', who: 'daw_devices', action: 'apply', hermes: 'mitlesen', human: false },
    ],
  },
  {
    id: 'mensch', name: 'Mensch: Konto, Rolle, Übersicht', owner: 'user_area', steps: [
      { id: 'konto', name: 'Konto anlegen', who: 'user_area', action: 'list', hermes: 'mitlesen', human: false },
      { id: 'rolle', name: 'Rolle zuweisen', who: 'user_area', action: 'setRole', hermes: 'vorschlag', human: true },
      { id: 'uebersicht', name: 'Übersicht zeigen', who: 'user_area', action: 'list', hermes: 'mitlesen', human: false },
    ],
  },
];

function defaults() { return { traces: [], runs: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['traces', 'runs']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Module defensiv laden — ein fehlendes Modul ist ein ehrlicher Befund, kein Absturz.
function mod(name) {
  try { const m = require('./' + name); return m && (m.actions || m) ? m : null; } catch { return null; }
}
function hermesStep(roleId) {
  const role = HERMES_ROLES.find((r) => r.id === roleId) || HERMES_ROLES[0];
  if (!role.skill) return { role: role.id, what: role.what, ran: false, reason: 'Hermes schaut nur zu — diese Stufe ändert er nicht.' };
  const hb = mod('hermes_bridge');
  if (!hb || typeof hb.useSkill !== 'function') return { role: role.id, what: role.what, ran: false, reason: 'Hermes-Brücke nicht ladbar.' };
  const r = hb.useSkill({ skill: role.skill });
  const done = !!(r && (r.ok === true || r.allowed === true));
  return {
    role: role.id, what: role.what, skill: role.skill, ran: done,
    reason: done ? null : (r && (r.error || r.reason)) || 'Fähigkeit nicht verliehen — Hermes wird hier übersprungen.',
  };
}

function callStep(step, input) {
  const m = mod(step.who);
  if (!m) return { ok: false, measured: null, error: `Modul ${step.who} nicht vorhanden` };
  const fn = (m.actions && m.actions[step.action]) || (typeof m[step.action] === 'function' ? m[step.action] : null);
  if (!fn) return { ok: false, measured: null, error: `${step.who}.${step.action} gibt es nicht` };
  try {
    const out = fn(input || {});
    let measured = null;
    if (out && typeof out === 'object') {
      measured = out.count !== undefined ? { count: out.count }
        : out.ok !== undefined ? { ok: out.ok, error: out.error || null }
          : { keys: Object.keys(out).slice(0, 6) };
    } else measured = { value: out };
    return { ok: !(out && out.ok === false), measured, error: out && out.error ? out.error : null };
  } catch (e) { return { ok: false, measured: null, error: String(e.message).slice(0, 200) }; }
}

// Einen Ablauf durchlaufen lassen. An einer Menschenschwelle hält er an, wenn niemand zugestimmt hat.
function run(input) {
  const p = input || {};
  const proc = PROCESSES.find((x) => x.id === p.process || x.name === p.process);
  if (!proc) return { ok: false, error: `Prozess unbekannt. Erlaubt: ${PROCESSES.map((x) => x.id).join(', ')}` };
  const human = p.human === true;
  const trace = { id: 'hf-' + Math.random().toString(16).slice(2, 10), process: proc.id, name: proc.name, at: new Date().toISOString(), by: String(p.by || 'Auraos'), human_approved: human, steps: [], stopped_at: null };
  for (const step of proc.steps) {
    if (step.human && !human) {
      trace.stopped_at = { step: step.id, name: step.name, reason: 'Menschenschwelle: ohne Zustimmung läuft der Ablauf hier nicht weiter.', needs: 'human' };
      trace.steps.push({ step: step.id, name: step.name, result: 'HALT (Mensch)', hermes: { role: HERMES_ROLES.find((r) => r.id === step.hermes).id, ran: false, reason: 'wartet auf den Menschen' } });
      break;
    }
    const called = callStep(step, Object.assign({}, p.input || {}, p.step_input && p.step_input[step.id] ? p.step_input[step.id] : {}));
    const h = hermesStep(step.hermes);
    trace.steps.push({
      step: step.id, name: step.name, who: `${step.who}.${step.action}`,
      result: called.ok ? 'OK' : 'NICHT AUSFÜHRBAR', error: called.error, measured: called.measured,
      hermes: h, human_gate: !!step.human,
    });
  }
  trace.done = !trace.stopped_at;
  const data = load();
  data.traces.unshift(trace); data.traces = data.traces.slice(0, 200);
  data.runs.unshift({ at: trace.at, process: trace.process, steps: trace.steps.length, stopped_at: trace.stopped_at ? trace.stopped_at.step : null });
  data.runs = data.runs.slice(0, 200);
  save(data);
  return {
    ok: true, trace,
    verdict: trace.done ? `Alle ${trace.steps.length} Stufen durchlaufen.` : `Angehalten bei „${trace.stopped_at.name}" — das letzte Wort hat der Mensch.`,
    hermes_steps: trace.steps.filter((s) => s.hermes && s.hermes.ran).length,
  };
}

function processes() {
  return {
    ok: true, count: PROCESSES.length,
    processes: PROCESSES.map((p) => ({ id: p.id, name: p.name, owner: p.owner, steps: p.steps.length, human_gates: p.steps.filter((s) => s.human).length, hermes_roles: [...new Set(p.steps.map((s) => s.hermes))] })),
    roles: HERMES_ROLES,
    rule: 'Hermes begleitet jede Stufe mit genau der Fähigkeit, die ihm verliehen wurde. Menschenschwellen halten den Ablauf an.',
  };
}

function plan(input) {
  const p = input || {};
  const proc = PROCESSES.find((x) => x.id === p.process || x.name === p.process);
  if (!proc) return { ok: false, error: 'Prozess unbekannt' };
  return {
    ok: true, process: proc.id, name: proc.name,
    steps: proc.steps.map((s, i) => ({ nr: i + 1, id: s.id, name: s.name, who: `${s.who}.${s.action}`, hermes: s.hermes, hermes_what: (HERMES_ROLES.find((r) => r.id === s.hermes) || {}).what, human_gate: !!s.human })),
  };
}

function trace(input) {
  const data = load();
  if (!input || !input.id) return { ok: true, count: data.traces.length, traces: data.traces.slice(0, 20).map((t) => ({ id: t.id, process: t.process, at: t.at, steps: t.steps.length, done: t.done, stopped_at: t.stopped_at ? t.stopped_at.step : null })) };
  const t = data.traces.find((x) => x.id === input.id);
  return t ? { ok: true, trace: t } : { ok: false, error: 'Ablauf nicht gefunden' };
}

function status() {
  const data = load();
  let hermes = null;
  try { const hb = require('./hermes_bridge'); hermes = typeof hb.skillStatus === 'function' ? hb.skillStatus() : null; } catch { hermes = null; }
  const granted = hermes && Number.isFinite(hermes.granted) ? hermes.granted : (hermes && Array.isArray(hermes.active) ? hermes.active.length : 0);
  return {
    area: 'HFLOW', module: 'hermes_process', state: 'live', file: FILE,
    processes: PROCESSES.length,
    steps: PROCESSES.reduce((n, p) => n + p.steps.length, 0),
    human_gates: PROCESSES.reduce((n, p) => n + p.steps.filter((s) => s.human).length, 0),
    hermes_roles: HERMES_ROLES.length,
    hermes_skills_active: granted,
    runs: data.runs.length,
    hermes_state: granted ? `Aktiv mit ${granted} verliehenen Fähigkeiten` : 'OHNE VERLIEHENE FÄHIGKEIT — Hermes liest nur mit',
    rules: [
      'Jede Stufe nennt, was Hermes dort tut — und welche Fähigkeit nötig ist.',
      'Ohne verliehene Fähigkeit wird Hermes an dieser Stufe übersprungen, nicht heimlich tätig.',
      'Menschenschwellen stoppen den Ablauf; ein ganzer Prozess läuft nur mit Zustimmung durch.',
      'Jeder Durchlauf wird protokolliert und ist nachlesbar.',
    ],
  };
}

module.exports = {
  meta: { area: 'HFLOW', id: 'hermes_process', name: 'Hermes im ganzen Prozess (Stufen, Fähigkeiten, Menschenschwellen)', state: 'live' },
  actions: { status: () => status(), processes: () => processes(), plan: (p) => plan(p || {}), run: (p) => run(p || {}), trace: (p) => trace(p || {}) },
  PROCESSES, HERMES_ROLES, processes, plan, run, trace, status,
};
