// Meilensteine: wer Zeit mit dem Produkt verbringt (und Sessions, Tage, Werke, Klicks sammelt),
// bekommt Meilensteine verliehen. Alles selbst getragen: eigener Katalog, eigener Speicher,
// eigene Prüfung — keine Fremd-SDKs, keine Cloud. Der Mensch bleibt Herr der Daten: der Speicher
// liegt als lesbare JSON-Datei im Datenverzeichnis und kann jederzeit gelöscht werden.
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.AURA_MILESTONES_DIR || path.join(__dirname, '..', 'data');
const FILE = process.env.AURA_MILESTONES_FILE || path.join(DATA_DIR, 'milestones.json');

// ---------------------------------------------------------------- Katalog
// Fünf Messgrößen, je eine aufsteigende Kette mit Stufen (Bronze → Platin).
const CATALOG = [
  { id: 'zeit-10', metric: 'zeit', schwelle: 10, einheit: 'Minuten', stufe: 'BRONZE', name: 'ERSTE SCHRITTE', text: '10 Minuten mit dem Produkt verbracht.' },
  { id: 'zeit-60', metric: 'zeit', schwelle: 60, einheit: 'Minuten', stufe: 'SILBER', name: 'EINE STUNDE DABEI', text: '60 Minuten Gesamtnutzungszeit.' },
  { id: 'zeit-300', metric: 'zeit', schwelle: 300, einheit: 'Minuten', stufe: 'GOLD', name: 'FESTER BESTANDTEIL', text: '5 Stunden Gesamtnutzungszeit.' },
  { id: 'zeit-1000', metric: 'zeit', schwelle: 1000, einheit: 'Minuten', stufe: 'PLATIN', name: 'TAUSEND MINUTEN', text: '1000 Minuten — das Produkt ist dein Werkzeug.' },
  { id: 'session-1', metric: 'sessions', schwelle: 1, einheit: 'Sessions', stufe: 'BRONZE', name: 'WILLKOMMEN', text: 'Erste Session gestartet.' },
  { id: 'session-5', metric: 'sessions', schwelle: 5, einheit: 'Sessions', stufe: 'SILBER', name: 'WIEDERKEHRER', text: '5 Sessions — du kommst zurück.' },
  { id: 'session-25', metric: 'sessions', schwelle: 25, einheit: 'Sessions', stufe: 'GOLD', name: 'STAMMGAST', text: '25 Sessions.' },
  { id: 'tage-3', metric: 'tage', schwelle: 3, einheit: 'Tage', stufe: 'SILBER', name: 'DREI TAGE DABEI', text: 'An 3 verschiedenen Tagen genutzt.' },
  { id: 'tage-30', metric: 'tage', schwelle: 30, einheit: 'Tage', stufe: 'GOLD', name: 'EIN MONAT DABEI', text: 'An 30 verschiedenen Tagen genutzt.' },
  { id: 'inhalt-1', metric: 'inhalte', schwelle: 1, einheit: 'Werke', stufe: 'BRONZE', name: 'ERSTES WERK', text: 'Ersten Inhalt erstellt (Render, Feed, Plan …).' },
  { id: 'inhalt-10', metric: 'inhalte', schwelle: 10, einheit: 'Werke', stufe: 'SILBER', name: 'SCHAFFENDER', text: '10 Inhalte erstellt.' },
  { id: 'inhalt-50', metric: 'inhalte', schwelle: 50, einheit: 'Werke', stufe: 'GOLD', name: 'PRODUZENT', text: '50 Inhalte erstellt.' },
  { id: 'klick-100', metric: 'klicks', schwelle: 100, einheit: 'Aktionen', stufe: 'BRONZE', name: 'ENTDECKER', text: '100 Aktionen im Produkt ausgeführt.' },
  { id: 'klick-1000', metric: 'klicks', schwelle: 1000, einheit: 'Aktionen', stufe: 'SILBER', name: 'MACHER', text: '1000 Aktionen ausgeführt.' },
];
const METRICS = ['zeit', 'sessions', 'tage', 'inhalte', 'klicks'];
const EVENTS = {
  zeit: 'Nutzungszeit in Minuten (Heartbeat der Seiten: 1 Minute je Ping)',
  session: 'neue Session (wird je Session-Kennung nur einmal gezählt)',
  tag: 'aktiver Tag (wird je Datum nur einmal gezählt)',
  inhalt: 'ersteller Inhalt (Render, Feed, Plan, Beitrag …)',
  klick: 'ausgeführte Aktion / Klick',
};

// ---------------------------------------------------------------- Speicher
function leer() {
  return { werte: { zeit: 0, sessions: 0, tage: 0, inhalte: 0, klicks: 0 }, tage_bucho: [], sessions_bucho: [], verliehen: {}, erster_kontakt: null, letzte_aenderung: null };
}
let DB = { nutzer: {} };
function laden(datei) {
  const f = datei || FILE;
  try {
    if (fs.existsSync(f)) {
      const roh = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (roh && typeof roh === 'object' && roh.nutzer) DB = roh;
    }
  } catch (e) { DB = { nutzer: {} }; }
  return DB;
}
function speichern(datei) {
  const f = datei || FILE;
  try {
    if (!fs.existsSync(path.dirname(f))) fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(DB, null, 2));
    return true;
  } catch (e) { return false; }
}
function nutzer(id) {
  const key = String(id || 'gast');
  if (!DB.nutzer[key]) DB.nutzer[key] = leer();
  const n = DB.nutzer[key];
  if (!n.erster_kontakt) n.erster_kontakt = new Date().toISOString();
  return n;
}

// ---------------------------------------------------------------- Zählung und Verleihung
function track(userId, event, wert, meta) {
  const m = meta || {};
  const ev = String(event || '');
  if (!EVENTS[ev]) return { ok: false, error: 'Unbekanntes Ereignis', erlaubt: Object.keys(EVENTS) };
  const n = nutzer(userId);
  if (ev === 'zeit') n.werte.zeit += Math.max(0, Number(wert) || 0);
  else if (ev === 'session') {
    const sid = String(m.session || 'ohne');
    if (!n.sessions_bucho.includes(sid)) { n.sessions_bucho.push(sid); n.werte.sessions = n.sessions_bucho.length; }
  } else if (ev === 'tag') {
    const d = String(m.datum || new Date().toISOString().slice(0, 10));
    if (!n.tage_bucho.includes(d)) { n.tage_bucho.push(d); n.werte.tage = n.tage_bucho.length; }
  } else if (ev === 'inhalt') n.werte.inhalte += Math.max(1, Number(wert) || 1);
  else if (ev === 'klick') n.werte.klicks += Math.max(1, Number(wert) || 1);
  n.letzte_aenderung = new Date().toISOString();
  const neu = pruefen(userId);
  speichern();
  return { ok: true, werte: Object.assign({}, n.werte), neu, gesamt: Object.keys(n.verliehen).length };
}
// Erreichte, noch nicht verliehene Meilensteine verleihen (Reihenfolge des Katalogs).
function pruefen(userId) {
  const n = nutzer(userId);
  const neu = [];
  for (const m of CATALOG) {
    if (n.verliehen[m.id]) continue;
    if ((n.werte[m.metric] || 0) >= m.schwelle) {
      n.verliehen[m.id] = new Date().toISOString();
      neu.push({ id: m.id, name: m.name, stufe: m.stufe, metric: m.metric, schwelle: m.schwelle, einheit: m.einheit, verliehen_am: n.verliehen[m.id] });
    }
  }
  return neu;
}
function status(userId) {
  const n = nutzer(userId);
  pruefen(userId);
  const ketten = METRICS.map((metric) => {
    const liste = CATALOG.filter((m) => m.metric === metric).sort((a, b) => a.schwelle - b.schwelle);
    const wert = n.werte[metric] || 0;
    const offen = liste.filter((m) => !n.verliehen[m.id]);
    const naechster = offen[0] || null;
    const zuletzt = liste.filter((m) => n.verliehen[m.id]).pop() || null;
    return {
      metric,
      wert,
      einheit: liste[0].einheit,
      verliehen: liste.filter((m) => n.verliehen[m.id]).map((m) => ({ id: m.id, name: m.name, stufe: m.stufe, am: n.verliehen[m.id] })),
      naechster: naechster ? { id: naechster.id, name: naechster.name, stufe: naechster.stufe, schwelle: naechster.schwelle, fehlt: Math.max(0, naechster.schwelle - wert), prozent: Math.min(100, Math.round((wert / naechster.schwelle) * 100)) } : null,
      zuletzt_erreicht: zuletzt ? { id: zuletzt.id, name: zuletzt.name, stufe: zuletzt.stufe } : null,
    };
  });
  return {
    nutzer: String(userId || 'gast'),
    erster_kontakt: n.erster_kontakt,
    letzte_aenderung: n.letzte_aenderung,
    werte: Object.assign({}, n.werte),
    gesamt_verliehen: Object.keys(n.verliehen).length,
    gesamt_katalog: CATALOG.length,
    ketten,
    alle_verliehen: Object.keys(n.verliehen).map((id) => ({ id, am: n.verliehen[id], name: (CATALOG.find((m) => m.id === id) || {}).name })),
  };
}
function katalog() {
  return {
    ereignisse: EVENTS,
    stufen: ['BRONZE', 'SILBER', 'GOLD', 'PLATIN'],
    meilensteine: CATALOG.map((m) => Object.assign({}, m)),
  };
}

// ---------------------------------------------------------------- Kompaktauskunft
// Für das Meilenstein-Badge im Kopf jeder ui_kit-Seite: höchste erreichte Stufe,
// Anzahl Verleihungen und der nächste Meilenstein mit dem höchsten Fortschritt.
function kurz(userId) {
  const s = status(userId);
  const STUFEN = ['START', 'BRONZE', 'SILBER', 'GOLD', 'PLATIN'];
  let top = 'START';
  let naechster = null;
  for (const k of s.ketten) {
    for (const v of k.verliehen) if (STUFEN.indexOf(v.stufe) > STUFEN.indexOf(top)) top = v.stufe;
    if (k.naechster && (!naechster || k.naechster.prozent > naechster.prozent)) {
      naechster = { id: k.naechster.id, name: k.naechster.name, metrik: k.metric, schwelle: k.naechster.schwelle, einheit: k.einheit, fehlt: k.naechster.fehlt, prozent: k.naechster.prozent };
    }
  }
  return { nutzer: s.nutzer, stufe: top, verliehen: s.gesamt_verliehen, katalog: s.gesamt_katalog, naechster };
}

// ---------------------------------------------------------------- Seite
// Gebaut aus dem Oberflächen-Baukasten (ui_kit.shell): Navigation, Toasts und das
// Meilenstein-Badge kommen von dort. Heartbeat bleibt: jede Minute ein Ping (zeit +1),
// beim Laden Session und Tag buchen, Klicks gedrosselt melden; neu Verliehenes → Toast.
function page(userId) {
  const ui = require('./ui_kit');
  const s = status(userId);
  const farbe = { PLATIN: 'live', GOLD: 'ok', SILVER: '', BRONZE: '' };
  const karten = s.ketten.map((k) => {
    const balken = k.naechster ? '█'.repeat(Math.round(k.naechster.prozent / 10)) + '░'.repeat(10 - Math.round(k.naechster.prozent / 10)) : '██████████';
    const offen = k.naechster ? `nächster: ${k.naechster.name} (${k.naechster.schwelle} ${k.einheit}, noch ${k.naechster.fehlt}) — ${k.naechster.prozent} %` : 'Kette vollständig';
    const liste = k.verliehen.length ? k.verliehen.map((v) => ui.badge(`${v.name} · ${v.stufe}`, farbe[v.stufe])).join(' ') : '<span class="hint">noch keiner</span>';
    return `<div class="card"><h3>${k.metric} = ${k.wert} ${k.einheit}</h3><div class="mono" style="color:var(--accent)">${balken}</div><p class="hint">${offen}</p><p>${liste}</p></div>`;
  }).join('\n');
  const body = `
  <div class="grid g2">
    ${ui.tile({ k: 'Verliehen', v: String(s.gesamt_verliehen), s: `von ${s.gesamt_katalog} im Katalog` })}
    ${ui.tile({ k: 'Ketten', v: String(s.ketten.length), s: s.ketten.map((k) => k.metric).join(' · ') })}
  </div>
  <h2>Fortschritt je Kette</h2>
  <div class="grid g2">
  ${karten}
  </div>
  <h2>Katalog</h2>
  <p class="hint">${CATALOG.map((m) => `${m.name} (${m.schwelle} ${m.einheit}, ${m.stufe})`).join(' · ')}</p>
  <p class="hint">Nutzer: <b>${s.nutzer}</b> · erster Kontakt: ${s.erster_kontakt || '—'} · Rohdaten:
    <a href="/api/milestones/status?user=${encodeURIComponent(s.nutzer)}">/api/milestones/status</a> ·
    <a href="/api/milestones/kurz">/api/milestones/kurz</a> ·
    <a href="/api/milestones/katalog">/api/milestones/katalog</a></p>`;
  const script = `
  var USER=${JSON.stringify(s.nutzer)}, SID=Math.random().toString(36).slice(2);
  function ping(ev,wert,meta){return auraApi('/api/milestones/track',{method:'POST',body:Object.assign({user:USER,event:ev,wert:wert||1},meta||{})});}
  function zeige(neu){(neu||[]).forEach(function(m){auraToast('🏅 MEILENSTEIN: '+m.name+' ['+m.stufe+']');});}
  ping('session',1,{session:SID}); ping('tag',1,{datum:new Date().toISOString().slice(0,10)});
  setInterval(function(){ping('zeit',1,{session:SID}).then(function(d){zeige(d.neu);});},60000);
  var letzter=0; document.addEventListener('click',function(){var j=Date.now();if(j-letzter<2000)return;letzter=j;ping('klick',1).then(function(d){zeige(d.neu);});});`;
  return ui.shell({
    title: 'Meilensteine', active: '/meilensteine', body, script,
    note: 'Die Seite meldet jede verbrauchte Minute selbst (Heartbeat), bucht Session und Tag beim Laden und zählt Klicks gedrosselt mit. Der Speicher liegt als lesbare JSON-Datei im Datenverzeichnis — löschen genügt, um bei null zu starten.',
  });
}

// ---------------------------------------------------------------- Auskunft
function statusRoute() { return { katalog_pfad: '/api/milestones/katalog', status_pfad: '/api/milestones/status', kurz_pfad: '/api/milestones/kurz', track_pfad: '/api/milestones/track', seite: '/meilensteine', datei: FILE, ereignisse: EVENTS, anzahl_meilensteine: CATALOG.length, stufen: ['BRONZE', 'SILBER', 'GOLD', 'PLATIN'] }; }

laden();
module.exports = { CATALOG, METRICS, EVENTS, laden, speichern, track, pruefen, status, kurz, katalog, page, statusRoute, FILE };
