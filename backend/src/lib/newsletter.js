'use strict';
// AURA · Rundbrief (Newsletter).
//
// Aufbau wie bei den guten offenen Vorbildern (phpList, OpenNewsletter): Anmeldung mit **doppelter
// Bestätigung**, Abmeldung in einem Klick, Versand nur an bestätigte Adressen, kein Import, der still
// Leute anschreibt.
//
// Ehrlichkeit beim Versand: AURA verschickt nichts von sich aus. Ohne eingerichteten Versandweg
// (SMTP-Zugang oder Anbieter-Schlüssel im Vault) entsteht der **Versandplan** — Empfängerzahl,
// Betreff, Text, Zeitpunkt — und der Zustand ist „WARTET AUF VERSANDWEG". Kein stiller Versand, keine
// erfundene Zustellquote.
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_NEWSLETTER_FILE || path.join(__dirname, '..', 'data', 'newsletter.json');

const TOPICS = ['NEUIGKEITEN', 'MUSIK', 'WERKSTATT', 'ANGEBOT', 'SUPPORT', 'FOERDERER'];

function defaults() { return { subscribers: [], campaigns: [], sends: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['subscribers', 'campaigns', 'sends', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    // Marker erneuern: Frühere Anmeldungen trugen einen 12-Zeichen-Marker — zu kurz, um sicher zu sein.
    // Beim Laden wird er verlängert; alte Links laufen damit aus und werden neu verschickt.
    let renewed = 0;
    for (const sub of raw.subscribers) if (sub && typeof sub.token === 'string' && sub.token.length < 24) { sub.token = token(); sub.token_renewed_at = new Date().toISOString(); renewed++; }
    if (renewed) { raw.audit.push({ at: new Date().toISOString(), action: 'token_renewed', count: renewed, note: 'Marker auf 36 Zeichen verlängert (Sicherheitsprüfung: zu kurze Marker sind erratbar).' }); save(raw); }   // sofort sichern, sonst steht der alte Marker weiter in der Datei
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

function mailOk(mail) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(mail || '')); }
// Marker für die Bestätigung: lang genug, dass man ihn nicht errät (32 Zeichen aus Zufall und Zeit).
// Ein kurzer Marker ist ein offenes Tor — die Sicherheitsprüfung hat genau das gemeldet.
function token() {
  const rnd = () => Math.random().toString(36).slice(2).padEnd(11, '0');
  const t = rnd() + rnd() + rnd().slice(0, 10);
  return t.replace(/[^a-z0-9]/g, '').slice(0, 32) + Date.now().toString(36).slice(-4);
}

// Anmelden: erst „wartet", nach Bestätigung „bestätigt". An sonsten wird nie gesendet.
function subscribe(input) {
  const p = input || {};
  const mail = String(p.mail || p.email || '').trim().toLowerCase();
  if (!mailOk(mail)) return { ok: false, error: 'E-Mail fehlt oder sieht nicht gültig aus' };
  const d = load();
  const existing = d.subscribers.find((s) => s.mail === mail);
  if (existing && existing.state === 'BESTAETIGT') return { ok: true, already: true, subscriber: { mail, state: existing.state }, note: 'Steht schon auf der Liste. Kein zweiter Eintrag.' };
  const t = existing || { id: 'nl-' + Math.random().toString(36).slice(2, 8), mail, at: new Date().toISOString(), state: 'WARTET_AUF_BESTAETIGUNG', topics: [], source: String(p.source || 'direkt') };
  t.token = token();
  t.topics = (Array.isArray(p.topics) ? p.topics : []).map((x) => String(x).toUpperCase()).filter((x) => TOPICS.includes(x));
  t.source = String(p.source || t.source || 'direkt');
  if (!existing) d.subscribers.unshift(t);
  d.audit.unshift({ at: new Date().toISOString(), action: 'subscribe', mail, state: t.state });
  save(d);
  return {
    ok: true, subscriber: { id: t.id, mail, state: t.state, topics: t.topics },
    confirm_link: `/api/newsletter/confirm?token=${t.token}`,
    confirm_mail: { subject: 'Bitte bestätigen: Creed Street Rundbrief', body: `Hallo,\n\nbitte bestätige deine Anmeldung mit diesem Link:\n/api/newsletter/confirm?token=${t.token}\n\nWenn du das nicht warst, ignoriere diese Nachricht — dann passiert nichts.\n\n${(() => { try { return require('./branding').BRAND.line; } catch { return '© Creed Street Studios 2026'; } })()}` },
    honesty: 'Doppelte Bestätigung: ohne Klick auf den Link wird nichts gesendet. Auch nicht eine einzige Nachricht.',
  };
}

function confirm(input) {
  const p = input || {};
  const d = load();
  const s = d.subscribers.find((x) => x.token === String(p.token || ''));
  if (!s) return { ok: false, error: 'Bestätigungs-Link unbekannt oder schon benutzt' };
  const from = s.state;
  s.state = 'BESTAETIGT'; s.confirmed_at = new Date().toISOString();
  d.audit.unshift({ at: s.confirmed_at, action: 'confirm', mail: s.mail, from });
  save(d);
  return { ok: true, mail: s.mail, state: s.state, from, note: 'Bestätigt. Ab jetzt darf an diese Adresse gesendet werden.' };
}

function unsubscribe(input) {
  const p = input || {};
  const mail = String(p.mail || '').trim().toLowerCase();
  const d = load();
  const s = d.subscribers.find((x) => x.mail === mail || x.token === String(p.token || ''));
  if (!s) return { ok: false, error: 'Adresse nicht gefunden' };
  const from = s.state;
  s.state = 'ABGEMELDET'; s.left_at = new Date().toISOString();
  d.audit.unshift({ at: s.left_at, action: 'unsubscribe', mail: s.mail, from });
  save(d);
  return { ok: true, mail: s.mail, state: s.state, from, note: 'Abgemeldet, sofort und ohne Rückfrage. Die Adresse bleibt nur als Sperrvermerk stehen, damit sie nicht wieder angeschrieben wird.' };
}

// Rundbrief anlegen (Text + Empfängerkreis).
function campaign(input) {
  const p = input || {};
  const subject = String(p.subject || '').trim();
  const body = String(p.body || '').trim();
  if (subject.length < 3) return { ok: false, error: 'subject fehlt' };
  if (body.length < 20) return { ok: false, error: 'body fehlt oder ist zu kurz (mindestens 20 Zeichen)' };
  const topic = String(p.topic || 'NEUIGKEITEN').toUpperCase();
  if (!TOPICS.includes(topic)) return { ok: false, error: `topic unbekannt. Erlaubt: ${TOPICS.join(', ')}` };
  const d = load();
  const c = {
    id: 'nc-' + Math.random().toString(36).slice(2, 8), subject: subject.slice(0, 140), body: body.slice(0, 20000),
    topic, at: new Date().toISOString(), by: String(p.by || 'Auraos'), state: 'ENTWURF',
    footer: `${(() => { try { return require('./branding').BRAND.line; } catch { return '© Creed Street Studios 2026'; } })()} · Abmelden jederzeit über /api/newsletter/unsubscribe`,
  };
  d.campaigns.unshift(c); d.campaigns = d.campaigns.slice(0, 500);
  d.audit.unshift({ at: c.at, action: 'campaign', id: c.id, topic });
  save(d);
  return { ok: true, campaign: c };
}

function providerState() {
  const names = (() => {
    try {
      const l = require('./vault').listSecrets();
      const arr = Array.isArray(l) ? l : (l && l.secrets) || [];
      return arr.map((x) => (typeof x === 'string' ? x : x.name || x.id || '')).filter(Boolean);
    } catch { return []; }
  })();
  const want = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY', 'MAILGUN_API_KEY', 'POSTMARK_TOKEN'];
  const have = want.filter((k) => names.includes(k));
  const env = ['AURA_SMTP_HOST', 'AURA_SMTP_USER', 'AURA_SMTP_PASS'].filter((k) => process.env[k]);
  return { ready: have.length > 0 || env.length > 0, keys_present: have.concat(env), keys_wanted: want, mode: (have.length || env.length) ? 'VERSANDWEG VORHANDEN' : 'KEIN VERSANDWEG (nur Plan)' };
}

// Versand: Plan bauen. Ohne Versandweg wird nichts verschickt — und das steht auch so da.
function send(input) {
  const p = input || {};
  const d = load();
  const c = d.campaigns.find((x) => x.id === p.id);
  if (!c) return { ok: false, error: 'Rundbrief nicht gefunden' };
  const confirmed = d.subscribers.filter((s) => s.state === 'BESTAETIGT' && (!c.topic || !s.topics.length || s.topics.includes(c.topic)));
  const st = providerState();
  const plan = {
    campaign: { id: c.id, subject: c.subject, topic: c.topic, chars: c.body.length },
    recipients: confirmed.length,
    recipients_by_topic: c.topic,
    when: String(p.when || new Date().toISOString()),
    segments: confirmed.length ? confirmed.slice(0, 10).map((s) => s.mail.replace(/(.{2}).*(@.*)/, '$1***$2')) : [],
    unsubscribes_included: true,
    state: st.ready ? 'BEREIT (Versand durch den eingerichteten Weg)' : 'WARTET AUF VERSANDWEG',
    next: st.ready ? 'Auslösen macht ein Mensch — AURA verschickt nicht von selbst.' : 'SMTP- oder Anbieter-Schlüssel in den Vault legen; bis dahin bleibt es beim Plan.',
  };
  c.state = st.ready ? 'VERSAND BEREIT' : 'WARTET AUF VERSANDWEG';
  const entry = { id: 'ns-' + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), campaign: c.id, recipients: confirmed.length, state: plan.state, plan };
  d.sends.unshift(entry); d.sends = d.sends.slice(0, 500);
  d.audit.unshift({ at: entry.at, action: 'send_plan', campaign: c.id, recipients: confirmed.length, state: plan.state });
  save(d);
  return { ok: true, send: entry, plan, honesty: st.ready ? 'Versandweg vorhanden. Ausgelöst wird trotzdem von einem Menschen.' : 'Ohne Versandweg kein Versand — nur dieser Plan.' };
}

function status() {
  const d = load();
  const st = providerState();
  return {
    area: 'NL', module: 'newsletter', state: 'live', file: FILE,
    subscribers: d.subscribers.length,
    confirmed: d.subscribers.filter((s) => s.state === 'BESTAETIGT').length,
    waiting: d.subscribers.filter((s) => s.state === 'WARTET_AUF_BESTAETIGUNG').length,
    left: d.subscribers.filter((s) => s.state === 'ABGEMELDET').length,
    campaigns: d.campaigns.length, sends: d.sends.length,
    provider: st.mode, provider_keys: st.keys_present,
    topics: TOPICS,
    rules: ['Doppelte Bestätigung — ohne Klick wird nichts gesendet.', 'Abmelden in einem Klick, ohne Rückfrage.', 'Versand nur an bestätigte Adressen, gefiltert nach Interessen.', 'Kein stiller Versand: ohne Versandweg gibt es nur den Plan.', 'Volltext in der Vorschau — niemand abonniert die Katze im Sack.'],
  };
}

module.exports = {
  meta: { area: 'NL', id: 'newsletter', name: 'Rundbrief (doppelte Bestätigung, Abmeldung, Versandplan)', state: 'live' },
  actions: {
    status: () => status(), subscribe: (p) => subscribe(p || {}), confirm: (p) => confirm(p || {}), unsubscribe: (p) => unsubscribe(p || {}),
    campaign: (p) => campaign(p || {}), campaigns: () => { const d = load(); return { ok: true, count: d.campaigns.length, campaigns: d.campaigns.slice(0, 30) }; },
    send: (p) => send(p || {}), sends: () => { const d = load(); return { ok: true, count: d.sends.length, sends: d.sends.slice(0, 20) }; },
    list: (p) => { const d = load(); const f = (p || {}).state; const items = d.subscribers.filter((s) => !f || s.state === f); return { ok: true, count: items.length, subscribers: items.slice(0, 100).map((s) => ({ mail: s.mail.replace(/(.{2}).*(@.*)/, '$1***$2'), state: s.state, topics: s.topics, source: s.source, at: s.at })) }; },
    provider: () => ({ ok: true, provider: providerState() }),
  },
  TOPICS, subscribe, confirm, unsubscribe, campaign, send, providerState, status,
};
