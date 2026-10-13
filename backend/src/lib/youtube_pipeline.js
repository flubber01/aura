'use strict';
// AURA — YouTube-Pipeline (Gerüst mit Freigabe-Toren).
// Nichts wird ohne Mensch veröffentlicht. Uploads gehen nur als PRIVAT, bis ein Mensch freigibt.
// Anbindung: offizielle YouTube Data API (videos.insert). Ohne OAuth-Zugang nur Trockenlauf.
const creators = require('./creator_watch');

const STAGES = [
  { id: 'research', label: 'Recherche', gate: 'none', desc: 'Themen aus öffentlichen Quellen sammeln (Creator-Liste, RSS, offizielle Doku). Quelle je Behauptung notieren.' },
  { id: 'script', label: 'Skript', gate: 'review', desc: 'Skript schreiben. Wenn Stimme oder Bilder KI-generiert sind, im Skript markieren.' },
  { id: 'production', label: 'Produktion', gate: 'none', desc: 'Schnitt und Vertonung. Ergebnis ist eine Datei im Workspace, kein Upload.' },
  { id: 'metadata', label: 'Metadaten', gate: 'checks', desc: 'Titel, Beschreibung, Tags, Kapitel, KI-Kennzeichnung. Prüfregeln siehe RULES.' },
  { id: 'thumbnail', label: 'Thumbnail-Brief', gate: 'review', desc: 'Kurzer Brief: Motiv, max. 4 Wörter Text, keine irreführenden Bilder.' },
  { id: 'approval', label: 'Freigabe', gate: 'human', desc: 'Nur ein Mensch gibt frei. Agenten dürfen nicht freigeben.' },
  { id: 'upload_private', label: 'Upload als privat', gate: 'human', desc: 'Upload per YouTube Data API mit privacyStatus=private. Veröffentlichung später manuell oder terminiert.' },
  { id: 'publish', label: 'Veröffentlichung', gate: 'human', desc: 'Nur nach ausdrücklicher Freigabe. Mindest-Vorlauf laut Einstellung.' },
  { id: 'analytics', label: 'Auswertung', gate: 'none', desc: 'Nur eigene, öffentliche oder per OAuth freigegebene Kennzahlen. Kein künstliches Engagement.' },
];

const RULES = [
  { id: 'title-len', desc: 'Titel 1–100 Zeichen' },
  { id: 'desc-bytes', desc: 'Beschreibung höchstens 5000 Bytes' },
  { id: 'tags-len', desc: 'Tags zusammen höchstens 500 Zeichen' },
  { id: 'ai-disclosure', desc: 'Synthetische Inhalte müssen gekennzeichnet sein' },
  { id: 'no-fake-engagement', desc: 'Keine Angebote für gekaufte Views, Abos oder Likes' },
  { id: 'no-modded-apps', desc: 'Keine Werbung für modifizierte oder gecrackte Apps' },
  { id: 'human-approval', desc: 'Veröffentlichung nur mit menschlicher Freigabe' },
  { id: 'private-first', desc: 'Upload immer zuerst privat' },
];

const BAD = [
  [/views?\s+kaufen|buy\s+(views|subscribers|likes)|abonnenten\s+kaufen|likes\s+kaufen/i, 'no-fake-engagement'],
  [/\b(mod|modded|mod\s*apk|premium\s+mod|cracked|gecrackt)\b/i, 'no-modded-apps'],
];

// Prüft Metadaten. meta: {title, description, tags:[], synthetic:boolean, ai_disclosure:boolean}
function checkMeta(meta = {}) {
  const issues = [];
  const title = String(meta.title || '');
  const desc = String(meta.description || '');
  const tags = Array.isArray(meta.tags) ? meta.tags.map(String) : [];
  if (title.trim().length < 1 || title.length > 100) issues.push({ rule: 'title-len', msg: 'Titel muss 1–100 Zeichen haben' });
  if (Buffer.byteLength(desc, 'utf8') > 5000) issues.push({ rule: 'desc-bytes', msg: 'Beschreibung über 5000 Bytes' });
  if (tags.join(',').length > 500) issues.push({ rule: 'tags-len', msg: 'Tags über 500 Zeichen' });
  if (meta.synthetic && !meta.ai_disclosure) issues.push({ rule: 'ai-disclosure', msg: 'Synthetischer Inhalt ohne KI-Kennzeichnung' });
  const text = [title, desc, tags.join(' ')].join(' ');
  for (const [re, rule] of BAD) if (re.test(text)) issues.push({ rule, msg: 'Verbotene Formulierung gefunden' });
  return { ok: issues.length === 0, issues };
}

// Plan für ein Thema. Nur Auflistung, kein Abruf.
function plan({ topic = '', creator_ids = [] } = {}) {
  const sources = creators.list({ topic }).concat(
    creator_ids.map((id) => creators.list({}).find((c) => c.id === id)).filter(Boolean));
  const uniq = [...new Map(sources.map((s) => [s.id, s])).values()];
  return {
    topic: String(topic).slice(0, 120),
    sources: uniq.map((c) => ({ id: c.id, name: c.name, platform: c.platform, url: c.url, enabled: c.enabled })),
    stages: STAGES.map((s, i) => ({ ...s, step: i + 1, status: i === 0 ? 'bereit' : 'offen' })),
    rules: RULES,
    note: 'Trockenlauf. Upload nur mit YouTube-OAuth und menschlicher Freigabe.',
  };
}

// Baut den Upload-Körper für videos.insert, immer privat. Nur Trockenlauf, sendet nichts.
function uploadBody(meta, { approvedBy = '' } = {}) {
  const c = checkMeta(meta);
  if (!c.ok) return { ok: false, issues: c.issues };
  if (!approvedBy || /agent|system|bot|auto/i.test(approvedBy)) {
    return { ok: false, issues: [{ rule: 'human-approval', msg: 'Freigabe durch einen Menschen fehlt' }] };
  }
  return {
    ok: true,
    dryRun: true,
    request: {
      part: 'snippet,status',
      body: {
        snippet: { title: meta.title, description: meta.description || '', tags: meta.tags || [], categoryId: meta.categoryId || '22' },
        status: {
          privacyStatus: 'private', // immer privat zuerst
          selfDeclaredMadeForKids: false,
          // KI-Kennzeichnung: Feldname laut aktueller YouTube-API-Doku prüfen, bevor echt gesendet wird.
          containsSyntheticMedia: !!meta.synthetic,
        },
      },
    },
  };
}

module.exports = { STAGES, RULES, checkMeta, plan, uploadBody, meta: { area: 'CRW', id: 'youtube_pipeline', name: 'YouTube-Pipeline (Gerüst, Freigabe-Tore, Trockenlauf)', state: 'live' } };
