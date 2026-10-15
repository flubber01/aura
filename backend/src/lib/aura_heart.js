'use strict';
// AURA Area 88 — Herzstück.
// A read-only, honest view of the one purpose that connects the existing
// systems: human-led original production from a documented source/idea to an
// admin-approved plan, with real feedback instead of fabricated success.
const contentCommand = require('./content_command');
const forge = require('./content_forge');
const studio = require('./studio');
const editorial = require('./editorial_incubator');
const traffic = require('./traffic');
const creatorDesk = require('./creator_desk');
const labelDesk = require('./label_desk');
const mediaNewsroom = require('./media_newsroom');

const PRINCIPLES = [
  { id: 'admin', title: 'Du gibst die Richtung vor', text: 'AURA bündelt Arbeit und zeigt Optionen. Start, Freigabe, Veröffentlichung und Stopp bleiben beim Admin.' },
  { id: 'original', title: 'Eigene Arbeit statt Kopie', text: 'Quellen liefern Kontext. Faktencheck, eigener Blickwinkel und dokumentierter Eigenbeitrag sind Pflicht.' },
  { id: 'craft', title: 'Ein Paket, mehrere saubere Formate', text: 'Forge und Studios bauen überprüfbare Entwürfe für die passenden eigenen Kanäle — nicht beliebige Reposts.' },
  { id: 'quality', title: 'Qualität, Rechte und Review zuerst', text: 'Vor einem Release stehen Rechte, Kontext, Review und eine ausdrückliche Freigabe.' },
  { id: 'honesty', title: 'Wirkung wird gemessen, nicht erfunden', text: 'Nur verbundene offizielle Daten zählen als externe Wirkung. Keine Fake-Klicks, Fake-Analytics oder künstliches Engagement.' },
];

function nextStep(cc) {
  const packages = contentCommand.listPackages();
  const stage = (s) => packages.filter((p) => p.stage === s);
  if (!cc.sources.total) return { title: 'Einen dokumentierten Fund aufnehmen', text: 'Starte im Content Command mit einer eigenen/offiziellen/lizenzierten Quelle oder einem manuellen Fund.', href: '/content-command', cta: 'Quelle oder Fund öffnen' };
  if (!cc.inbox.total) return { title: 'Einen Fund in die Quellen-Inbox legen', text: 'Die Quelle ist registriert. Jetzt kommt ein konkreter, datierter Fund mit Relevanznotiz hinzu.', href: '/content-command', cta: 'Zur Inbox' };
  if (!packages.length) return { title: 'Aus ausgewählten Funden ein Original-Paket machen', text: 'Formuliere erst den eigenen Blickwinkel und die geplanten Formate.', href: '/content-command', cta: 'Paket erstellen' };
  if (stage('brief').length) return { title: 'Fakten und Kontext prüfen', text: 'Mindestens ein Paket wartet auf eine dokumentierte Faktennotiz.', href: '/content-command', cta: 'Faktencheck fortsetzen' };
  if (stage('facts_checked').length) return { title: 'Eigene Leistung festhalten', text: 'Beschreibe, was der eigenständige Beitrag ist — nicht nur eine Umschreibung.', href: '/content-command', cta: 'Eigenbeitrag dokumentieren' };
  if (stage('original_draft').length) return { title: 'Studio-/Forge-Ausgaben bauen', text: 'Das geprüfte Original-Paket kann jetzt in saubere Formate überführt werden.', href: '/content-command', cta: 'Ausgaben bauen' };
  if (stage('review').length) return { title: 'Review abschließen', text: 'Rechte, Fakten und Originalität vor der Admin-Freigabe kontrollieren.', href: '/content-command', cta: 'Review öffnen' };
  if (stage('approved').length) return { title: 'Release bewusst planen', text: 'Ein freigegebenes Paket kann als Plan in deine Warteschlange — externe Adapter nur, wenn offiziell verbunden.', href: '/content-command', cta: 'Release-Plan öffnen' };
  return { title: 'Den Kreislauf mit echten Ergebnissen schließen', text: 'Release-Pläne und spätere offizielle Analytics ergeben den nächsten, vom Admin entschiedenen Schritt.', href: '/content-command', cta: 'Content Command öffnen' };
}

function status() {
  const cc = contentCommand.status();
  const packageTotal = Object.values(cc.packages || {}).reduce((sum, n) => sum + Number(n || 0), 0);
  const fg = forge.status();
  const st = studio.status();
  const ed = editorial.status();
  const tel = traffic.report();
  const cd = creatorDesk.status();
  const ld = labelDesk.status();
  const mn = mediaNewsroom.status();
  const connected = cc.channels.filter((c) => c.state === 'LIVE');
  const pending = cc.channels.filter((c) => c.state !== 'LIVE');
  return {
    area: '88',
    mode: 'LIVE',
    title: 'AURA Herzstück',
    statement: 'Aus einer dokumentierten Idee oder Quelle entsteht mit eigener redaktioneller Arbeit ein geprüftes Paket. AURA ordnet und beschleunigt; der Admin entscheidet und gibt frei.',
    principles: PRINCIPLES,
    cycle: [
      { id: 'find', number: '01', title: 'Idee & Fund', detail: cc.sources.total + ' Quellen · ' + cc.inbox.total + ' Inbox-Funde · ' + ((cc.collections && cc.collections.open) || 0) + ' Nischen-Fenster', state: cc.sources.total ? 'active' : 'ready', href: '/content-command' },
      { id: 'meaning', number: '02', title: 'Eigener Blickwinkel', detail: packageTotal + ' Content-Pakete · ' + cc.packages.facts_checked + ' geprüft', state: packageTotal ? 'active' : 'ready', href: '/content-command' },
      { id: 'make', number: '03', title: 'Machen & Formen', detail: st.studios.length + ' Studios · ' + fg.items.total + ' Forge-Artefakte · ' + cd.templates.total + ' eigene Vorlagen · ' + ld.releases.total + ' Label-Releases · ' + mn.media_department.roles.length + ' Media-Rollen', state: 'active', href: '/media-newsroom' },
      { id: 'check', number: '04', title: 'Rechte & Review', detail: cc.packages.review + ' im Review · ' + ed.signoffs + ' 4-Augen-Sign-offs', state: 'active', href: '/content-command' },
      { id: 'admin', number: '05', title: 'Deine Freigabe', detail: cc.packages.approved + ' freigegeben · keine Auto-Publikation', state: 'active', href: '/content-command' },
      { id: 'plan', number: '06', title: 'Offizieller Release-Plan', detail: cc.releases.planned + ' geplante Releases · ' + pending.length + ' Adapter offen', state: cc.releases.planned ? 'active' : 'ready', href: '/content-command' },
      { id: 'learn', number: '07', title: 'Echte Rückmeldung', detail: tel.totalRequests + ' lokale Requests seit Start · externe Daten nur bei Verbindung', state: 'honest', href: '/master' },
    ],
    current: {
      content_command: { sources: cc.sources, inbox: cc.inbox, packages: cc.packages, artifacts: cc.artifacts, releases: cc.releases },
      forge: fg.items,
      studios: st.studios.length,
      editorial: { pieces: ed.pieces, signoffs: ed.signoffs },
      creator_desk: { profiles: cd.profiles, templates: cd.templates, campaigns: cd.campaigns, music_releases: cd.music_releases },
      label_desk: { label: ld.label, artists: ld.artists, releases: ld.releases, routes: ld.routes },
      media_newsroom: { assets: mn.assets, projects: mn.projects, watchlists: mn.watchlists, media_department: mn.media_department },
      telemetry: { mode: tel.mode, total_requests_since_boot: tel.totalRequests, last_minute: tel.lastMinute, note: tel.note },
    },
    external: {
      connected: connected.map((c) => ({ id: c.id, name: c.name, state: c.state })),
      not_connected: pending.map((c) => ({ id: c.id, name: c.name, state: c.state, note: c.note || 'offizielle Verbindung erforderlich' })),
      truth: 'Externe Reichweite oder Analytics werden erst nach einer offiziellen, vom Admin eingerichteten Verbindung angezeigt. Bis dahin gibt AURA keinen Erfolg vor.',
    },
    next_step: nextStep(cc),
    known_next_builds: [
      { name: 'Ruhiges Ideen-Canvas', state: 'PLANNED', note: 'Rohidee → Heads-Review → Cluster/Parkplatz → Task Ready → Arbeit → Review → Admin-Freigabe → Archiv.' },
      { name: 'WF-18 Original-Repurposing', state: 'PLANNED', note: 'Versionierte Weiterverwendung eigener, freigegebener Inhalte.' },
      { name: 'Traffic-Mesh', state: 'PLANNED', note: 'Nur passende, echte Crosslinks zwischen eigenen bzw. erlaubten Seiten.' },
      { name: 'WF-19 Label Releases', state: 'LIVE · PLAN LANE', note: 'Creator Desk und CreedStreet47 Label Desk bilden Roster → Rechte/Splits → QC → Master/Artwork/Metadaten → Promo → Distribution-Plan → Kalender ab; echte Distribution und Analytics brauchen weiterhin die bestätigten offiziellen Zugänge.' },
      { name: 'Offizielle Plattformadapter & Unified Analytics', state: 'NOT-CONNECTED', note: 'OAuth/API-Zugänge, Rechte und Admin-Freigabe fehlen noch.' },
    ],
    guardrail: 'REGEL 1: Der Admin hat das letzte Wort. AURA startet, installiert, löscht oder veröffentlicht nichts eigenmächtig.',
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  meta: { area: '88', id: 'aura_heart', name: 'AURA Herzstück (human-led production cycle)', state: 'live' },
  actions: { status: () => status() },
  status,
};
