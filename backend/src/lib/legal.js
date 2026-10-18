'use strict';
// AURA · Recht im Betriebssystem: AGB, Datenschutz, Impressum, Widerruf, Lizenzhinweise.
//
// Kein Anwaltsersatz — das steht gleich am Anfang und wird nicht versteckt. Was hier entsteht, ist ein
// vollständiger, benutzbarer Satz Unterlagen mit offenen Platzhaltern für die Angaben, die nur der
// Inhaber kennen kann (Anschrift, Register, Steuernummer). Platzhalter stehen sichtbar als
// „«AUSFÜLLEN»" — nicht als Lücke, die später übersehen wird.
//
// Jede Fassung wird versioniert, mit Datum und Prüfsumme. Zustimmung wird festgehalten: wer zustimmt,
// welcher Fassung, wann. Ändert sich der Text, muss neu zugestimmt werden — das ist ehrlicher als
// eine stille Änderung.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.AURA_LEGAL_FILE || path.join(__dirname, '..', 'data', 'legal.json');
const VERSION = '2026.1';
const FILL = '«AUSFÜLLEN»';

function brand() { try { return require('./branding').BRAND; } catch { return { owner: 'Creed Street Studios', year: 2026, line: '© Creed Street Studios 2026 — alle Rechte vorbehalten' }; } }
function i18nText(key, lang) { try { return require('./i18n').textOf(key, lang || 'de'); } catch { return null; } }

const DOCS = {
  agb: {
    title: 'Allgemeine Geschäftsbedingungen (AGB)',
    kind: 'AGB',
    sections: [
      { h: '1. Wer hier Vertragspartner ist', p: `Anbieter ist ${'«ANBIETER»'} (nachfolgend „wir"), ${FILL} (Anschrift), E-Mail ${FILL}, Registereintrag ${FILL}, Umsatzsteuer-Kennung ${FILL}. Vertragspartner ist, wer unser Angebot nutzt (nachfolgend „du").` },
      { h: '2. Was wir anbieten', p: 'Wir bieten Software, Werkzeuge und Dienstleistungen für Musik, Medien und Betrieb (nachfolgend „das System"). Das System läuft auf deiner oder unserer Infrastruktur; der jeweilige Umfang steht in der Leistungsbeschreibung deines Plans.' },
      { h: '3. Vertragsschluss und Laufzeit', p: `Der Vertrag kommt mit deiner Buchung und unserer Bestätigung zustande. Monatspläne laufen monatlich, Jahrespläne zwölf Monate. Kündigung ist jederzeit zum Ende der Laufzeit möglich, formfrei über ${FILL} oder im Konto.` },
      { h: '4. Preise und Zahlung', p: `Es gelten die Preise zum Zeitpunkt der Buchung. Alle Preise verstehen sich ${'«BRUTTO ODER NETTO AUSFÜLLEN»'}. Zahlung über die angebotenen Zahlungswege; ohne hinterlegten Zahlungsweg entsteht keine Zahlungspflicht und kein Zugang zu bezahlten Teilen.` },
      { h: '5. Was das System nicht tut', p: 'Das System erzeugt keine Klicks, Aufrufe, Follower oder Reichweite und kauft keine Werbeplätze bei Dritten. Es trifft keine Entscheidungen, die einem Menschen vorbehalten sind: Veröffentlichungen, Freigaben, Auszahlungen und Löschungen brauchen immer die Zustimmung eines Menschen.' },
      { h: '6. Deine Inhalte und Rechte', p: 'Deine Inhalte bleiben deine. Du räumst uns nur die Rechte ein, die zur Erbringung der Leistung nötig sind (speichern, abrufen, anzeigen). Für Inhalte, die du hochlädst, sicherst du zu, dass du die Rechte hast — insbesondere bei Samples, Bildern und Stimmen.' },
      { h: '7. Kennzeichnung', p: `Erzeugte Inhalte können mit der Kennzeichnung „${brand().owner} ${brand().year}" versehen werden. Die Kennzeichnung ist sichtbar und wird vorher angekündigt; sie wird nicht in fremde Dateien eingerechnet, ohne dass du es weißt.` },
      { h: '8. Verfügbarkeit', p: `Wir bemühen uns um ständige Verfügbarkeit, schulden sie aber nicht. Wartungsarbeiten kündigen wir an, wo es möglich ist. Ausfälle durch höhere Gewalt, Netz- oder Anbieterstörungen liegen außerhalb unseres Einflusses.` },
      { h: '9. Haftung', p: `Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper, Gesundheit. Bei einfacher Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden. ${'«HAFTUNGSGRENZE PRÜFEN LASSEN»'}` },
      { h: '10. Änderungen dieser Bedingungen', p: 'Änderungen kündigen wir mindestens 30 Tage vorher an. Widersprichst du nicht, gelten sie als angenommen. Widersprichst du, kannst du zum Änderungszeitpunkt beenden. Jede Fassung wird versioniert und ist abrufbar.' },
      { h: '11. Streit und Recht', p: `Es gilt deutsches Recht. Gerichtsstand ist ${FILL}, soweit gesetzlich zulässig. Verbraucher können auch an ihrem Wohnsitz klagen.` },
      { h: '12. Hinweis', p: 'Diese Bedingungen sind ein sorgfältig erstellter Entwurf, aber keine Rechtsberatung. Vor dem Einsatz mit zahlenden Kunden: von einer Rechtsanwältin oder einem Rechtsanwalt prüfen lassen.' },
    ],
  },
  datenschutz: {
    title: 'Datenschutz',
    kind: 'DATENSCHUTZ',
    sections: [
      { h: '1. Verantwortlicher', p: `${'«ANBIETER»'}, ${FILL}, E-Mail ${FILL}.` },
      { h: '2. Was wir verarbeiten', p: 'Kontodaten (Name, E-Mail, Rolle), Inhalte, die du anlegst, technische Protokolle (Zeitpunkt, Aufruf, Fehler), Messwerte deiner Seiten (nur wenn du sie einschaltest).' },
      { h: '3. Wozu', p: 'Zur Erbringung der Leistung, zur Sicherheit (Angriffe erkennen), zur Abrechnung und — nur mit Einwilligung — für Rundbriefe und Auswertung.' },
      { h: '4. Wie lange', p: `Protokolle: ${'«AUFBEWAHRUNG AUSFÜLLEN, z. B. 90 Tage»'}. Vertragsdaten: gesetzliche Fristen. Rundbrief-Adressen: bis zur Abmeldung.` },
      { h: '5. Keine Weitergabe ohne Grund', p: 'Wir geben nichts an Dritte weiter, außer es ist zur Leistung nötig (Zahlungsanbieter, Versandweg), gesetzlich verlangt oder du willst es. Es findet kein Verkauf von Daten statt.' },
      { h: '6. Keine stillen Skripte', p: 'Die Oberflächen laden keine Fremdskripte, keine Fremdschriften und keine Werbenetzwerke. Schriften und Zeichen werden gezeichnet, nicht geladen.' },
      { h: '7. Deine Rechte', p: `Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit, Widerspruch. Anfragen an ${FILL}. Beschwerde bei der zuständigen Aufsichtsbehörde.` },
      { h: '8. Werbung im System', p: 'Eigene Meldungen erscheinen in festen Abständen (Kurzmeldung alle 6 Minuten, Anzeige alle 11 Minuten). Das System erzeugt dabei keine Klicks und misst nur, was wirklich passiert. Es lässt sich abschalten.' },
      { h: '9. Hinweis', p: 'Auch dieser Text ist ein Entwurf und keine Rechtsberatung.' },
    ],
  },
  impressum: {
    title: 'Impressum',
    kind: 'IMPRESSUM',
    sections: [
      { h: 'Angaben nach § 5 DDG (vormals § 5 TMG)', p: `${'«ANBIETER»'}\n${FILL} (Straße, Hausnummer)\n${FILL} (PLZ, Ort)\n${FILL} (Land)` },
      { h: 'Vertreten durch', p: FILL },
      { h: 'Kontakt', p: `Telefon: ${FILL}\nE-Mail: ${FILL}` },
      { h: 'Register und Steuern', p: `Registergericht: ${FILL}\nRegisternummer: ${FILL}\nUmsatzsteuer-Identifikationsnummer: ${FILL}` },
      { h: 'Verantwortlich für den Inhalt', p: FILL },
      { h: 'Streitschlichtung', p: 'Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen — es sei denn, wir erklären es ausdrücklich.' },
    ],
  },
  widerruf: {
    title: 'Widerrufsrecht für Verbraucher',
    kind: 'WIDERRUF',
    sections: [
      { h: 'Widerrufsrecht', p: `Du kannst deine Vertragserklärung innerhalb von vierzehn Tagen ohne Angabe von Gründen widerrufen. Dazu genügt eine eindeutige Erklärung an ${FILL} (z. B. per Brief oder E-Mail). Zur Frist genügt das Absenden vor Ablauf.` },
      { h: 'Folgen', p: 'Wir erstatten alle Zahlungen, die wir von dir erhalten haben, unverzüglich, spätestens binnen vierzehn Tagen ab Eingang des Widerrufs. Für die Rückzahlung nutzen wir dasselbe Zahlungsmittel.' },
      { h: 'Vorzeitiges Erlöschen', p: 'Bei digitalen Inhalten, die nicht auf einem körperlichen Datenträger geliefert werden, erlischt das Widerrufsrecht, wenn wir mit der Ausführung begonnen haben, nachdem du ausdrücklich zugestimmt und deine Kenntnis vom Verlust des Widerrufsrechts bestätigt hast.' },
      { h: 'Muster-Widerruf', p: '„Hiermit widerrufe ich den von mir geschlossenen Vertrag über die Erbringung der folgenden Dienstleistung: … Bestellt am: … Name: … Anschrift: … Datum: …"' },
    ],
  },
  lizenzen: {
    title: 'Lizenzen und fremde Bestandteile',
    kind: 'LIZENZEN',
    sections: [
      { h: 'Was im System von uns ist', p: `${brand().line} — eigener Quelltext, eigene Zeichnungen, eigener Ton-Renderer.` },
      { h: 'Was fremd ist', p: `Der Betrieb nutzt Werkzeuge mit offenen Lizenzen (u. a. Node.js, ffmpeg je nach Installation, optionale Anbieter-Bibliotheken). Lizenzen sind ${'«VOR AUSLIEFERUNG ZUSAMMENSTELLEN»'}. Ein Verzeichnis ist unter /api/legal/licenses abrufbar.` },
      { h: 'Keine fremden Inhalte', p: 'Es werden keine fremden Noten, Texte, Bilder, Stimmen oder Logos eingebunden. Namen von Förderern erscheinen als Text, nicht als fremdes Logo — damit nichts nachlädt und nichts vorgetäuscht wird.' },
      { h: 'Freie Tonquellen', p: 'Für Töne gilt: nur Quellen mit klarer kommerzieller Nutzbarkeit. Die geprüfte Liste steht unter /api/audio/sources?commercial=yes.' },
    ],
  },
};

function defaults() { return { accepted: [], versions: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['accepted', 'versions', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function doc(id) { return DOCS[String(id || '').toLowerCase()] || null; }

function digest(id) {
  const d = doc(id);
  if (!d) return null;
  const text = d.sections.map((s) => `## ${s.h}\n${s.p}`).join('\n\n');
  return { id, version: VERSION, title: d.title, kind: d.kind, sha256: crypto.createHash('sha256').update(text).digest('hex').slice(0, 24), sections: d.sections.length, chars: text.length, fill_fields: (text.match(/«[^»]+»/g) || []).length };
}

function list() {
  return { ok: true, version: VERSION, docs: Object.keys(DOCS).map((id) => digest(id)), note: 'Platzhalter sind mit «…» gekennzeichnet und zählbar. Erst wenn alle gefüllt sind, ist die Fassung fertig.' };
}

// Markdown für ein Dokument (oder alle).
function markdown(id, payload) {
  const p = payload || {};
  const ids = id ? [String(id)] : Object.keys(DOCS);
  const parts = [];
  for (const i of ids) {
    const d = doc(i);
    if (!d) continue;
    parts.push(`# ${d.title}\n\nFassung ${VERSION} · Stand ${new Date().toISOString().slice(0, 10)} · ${brand().owner}\n\n${d.sections.map((s) => `## ${s.h}\n\n${s.p}`).join('\n\n')}\n`);
  }
  if (p.with_support !== false) {
    const support = i18nText('support.contact', p.lang || 'de') || 'Kontaktieren Sie unseren Support';
    parts.push(`## Support\n\n${support}: /api/support/submit — Anliegen bekommt eine Nummer, einen Zustand und automatische Belege.\n`);
  }
  return {
    ok: true, version: VERSION, documents: ids.length, markdown: parts.join('\n---\n\n'),
    honesty: 'Entwurf, keine Rechtsberatung. Vor dem Einsatz mit zahlenden Kunden juristisch prüfen lassen.',
  };
}

// Zustimmung festhalten: wer, welcher Fassung, wann. Neue Fassung ⇒ neue Zustimmung nötig.
function accept(input) {
  const p = input || {};
  const who = String(p.who || p.user || '').trim();
  if (!who) return { ok: false, error: 'who fehlt — wer stimmt zu?' };
  const docs = Array.isArray(p.docs) && p.docs.length ? p.docs.map((x) => String(x).toLowerCase()) : ['agb', 'datenschutz'];
  const bad = docs.filter((x) => !doc(x));
  if (bad.length) return { ok: false, error: `Unbekannte Dokumente: ${bad.join(', ')}` };
  const d = load();
  const openFill = docs.map((x) => digest(x)).filter((x) => x && x.fill_fields > 0);
  const row = {
    id: 'lc-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(),
    who, docs: docs.map((x) => ({ id: x, version: VERSION, sha256: digest(x).sha256 })),
    ip_note: 'Es wird kein Standort und kein Fingerabdruck gespeichert — nur Zeitpunkt, Name und Fassung.',
  };
  d.accepted.unshift(row); d.accepted = d.accepted.slice(0, 5000);
  d.audit.unshift({ at: row.at, action: 'accept', who, docs: docs.join(',') });
  save(d);
  return {
    ok: true, acceptance: row,
    warning: openFill.length ? `${openFill.map((x) => x.title).join(', ')} enthalten noch Platzhalter («…») und sind noch nicht vollständig. Vor dem Einsatz füllen.` : null,
    note: 'Zustimmung ist an die Fassung gebunden. Ändert sich der Text, gilt die alte Zustimmung nicht mehr.',
  };
}

function accepted(who) {
  const d = load();
  const rows = d.accepted.filter((x) => !who || x.who.toLowerCase() === String(who).toLowerCase());
  const latest = rows[0] || null;
  const current = latest ? latest.docs.every((x) => x.version === VERSION) : false;
  return { ok: true, who: who || null, count: rows.length, latest, up_to_date: current, version: VERSION, note: current ? 'Zustimmung gilt für die aktuelle Fassung.' : 'Keine gültige Zustimmung für die aktuelle Fassung.' };
}

// Der Support-Knopf, fertig zum Einbauen.
function supportButton(input) {
  const p = input || {};
  const label = i18nText('support.contact', p.lang || 'de') || 'Kontaktieren Sie unseren Support';
  return {
    ok: true,
    html: `<a class="cs-support" href="/support" role="button">${label}</a>`,
    css: `.cs-support{display:inline-block;padding:10px 16px;border:1px solid var(--accent);border-radius:10px;color:var(--accent);text-decoration:none;font-size:14px}
.cs-support:hover{background:color-mix(in srgb,var(--accent) 16%,transparent)}
.cs-support:focus{outline:2px solid var(--accent2);outline-offset:2px}`,
    on_error_page: 'Auf jeder Fehlerseite steht derselbe Knopf — wer etwas nicht versteht, findet den Weg sofort.',
    where: ['Fußzeile jeder Seite', 'Fehlerseiten', 'Freigabe-Türen (wenn etwas gesperrt ist)'],
  };
}

function status() {
  const d = load();
  const withFill = Object.keys(DOCS).map((id) => digest(id)).filter((x) => x.fill_fields > 0);
  return {
    area: 'LEGAL', module: 'legal', state: 'live', file: FILE, version: VERSION,
    documents: Object.keys(DOCS).length, accepted: d.accepted.length,
    open_placeholders: withFill.reduce((n, x) => n + x.fill_fields, 0),
    documents_with_placeholders: withFill.map((x) => x.id),
    rules: ['Entwurf, keine Rechtsberatung — das steht in jedem Dokument.', `Platzhalter sind sichtbar als «…» und zählbar (${withFill.reduce((n, x) => n + x.fill_fields, 0)} offen).`, 'Zustimmung ist an die Fassung gebunden, nicht an „AGB allgemein".', 'Der Support-Knopf steht auf jeder Seite und jeder Fehlerseite.'],
  };
}

module.exports = {
  meta: { area: 'LEGAL', id: 'legal', name: 'Recht (AGB, Datenschutz, Impressum, Widerruf, Lizenzen, Support-Knopf)', state: 'live' },
  actions: {
    status: () => status(), list: () => list(), digest: (p) => { const x = digest((p || {}).id); return x ? { ok: true, doc: x } : { ok: false, error: 'Dokument unbekannt', known: Object.keys(DOCS) }; },
    markdown: (p) => markdown((p || {}).id, p || {}), accept: (p) => accept(p || {}), accepted: (p) => accepted((p || {}).who), button: (p) => supportButton(p || {}),
  },
  DOCS, VERSION, digest, list, markdown, accept, accepted, supportButton, status,
};
