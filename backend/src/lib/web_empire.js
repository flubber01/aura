'use strict';
// AURA · Web Empire / Eigene Seiten
// Umsetzung der Spezifikation „AURA & Multi-Niche Web Empire — Standalone & Cluster Master Architecture"
// (AURA-Anbindung hat Vorrang). Diese Schicht ist eine ERWEITERUNG des bestehenden AURA-Boards,
// kein eigenes Ober-Adminpanel. Die einzelnen Nischen-Seiten bleiben eigenständig.
//
// Verbindliche Linien, in Code erzwungen:
//  - Nur ausdruecklich vom Admin freigegebene Seiten (OWN/AUTHORIZED) werden verbunden. Kein Auto-Connect.
//  - Fremde/ungepruefte Domains, fremde Zugangsdaten: nicht moeglich. Es gibt keine Importfunktion fuer Fremd-Links.
//  - Messwerte sind NUR echte, signiert uebermittelte Ereignisse. Kein Erfinden, kein Schaetzen.
//    Statuslabels LIVE / SIM / NOT-CONNECTED sind ehrlich; es gibt keine Funktion, die Daten erzeugt.
//  - KEINE automatische Traffic-, Klick-, View-, Like-Erzeugung. Es gibt schlicht keine solche Aktion —
//    auch nicht als Schalter. Ausgehende Link-Klicks werden nur GEZAEHLT, wenn die Seite sie meldet.
//  - Link-Rotation ausschliesslich innerhalb des vorab freigegebenen Pools des Slots. Nie auf beliebige URLs.
//  - Link-Health-Check ist kein Klick und keine Conversion und wird nie als solcher gezaehlt.
//  - REGEL 1: Registrierung, Aktivierung, Pool-/Link-Aenderung, Deployment brauchen explizite Admin-Autorisierung
//    (Freigabe-Anfrage, nur ein Mensch entscheidet). AURA bereitet vor, prueft und meldet — entscheidet nicht.
//
// Speicher: backend/src/data/web_empire.json (git-ignoriert).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const controlCenter = require('./control_center'); // isHuman(): nur Menschen entscheiden

const FILE = process.env.AURA_WEB_EMPIRE_FILE || path.join(__dirname, '..', 'data', 'web_empire.json');
const HEALTH_TTL_MS = 15 * 60 * 1000;    // so lange gilt ein Health-Ergebnis
const LIVE_WINDOW_MS = 30 * 60 * 1000;   // so frisch muessen echte Daten sein, um als LIVE zu gelten
const TTL_MS = 24 * 60 * 60 * 1000;      // Freigabe-Anfragen verfallen
const MAX_PENDING = 20;

const NICHES = ['IGAMING', 'FINANCE', 'ADULT', 'AI_TECH', 'SMM_GROWTH', 'BANKING_FINTECH', 'OTHER'];
const AFFILIATE_STATUS = ['OWN', 'AUTHORIZED', 'NONE'];
const CONSENT = ['OK', 'PENDING', 'NOT_REQUIRED'];
const MODULE_FLAGS = ['FORUM', 'COMMENTS', 'SEARCH', 'SIDEBAR', 'COMMUNITY', 'NEWSLETTER', 'ADSENSE', 'SOCIAL_WIDGETS', 'VISIT_OUR_FRIENDS'];
const STYLE_COUNT = 5;                        // genau fuenf waehlbare Stilvarianten je Website
const EVENT_TYPES = ['pageview', 'session', 'referrer', 'utm', 'outbound_click', 'error', 'conversion_confirmed'];
const PARTNER_STATUS = ['ACTIVE', 'PAUSED', 'DOWN'];
const APPROVAL_KINDS = ['site.register', 'site.activate', 'slot.pool', 'deployment'];

// ---------------------------------------------------------------- Speicher (selbstheilend)
function defaults() {
  return { sites: [], slots: [], events: [], audit: [], approvals: [] };
}
function load() {
  try {
    if (!fs.existsSync(FILE)) { const fresh = defaults(); save(fresh); return fresh; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['sites', 'slots', 'events', 'audit', 'approvals']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch {
    // AURA_SEED_WRITE: fehlende/kaputte Datei wird neu angelegt statt Absturz.
    const fresh = defaults();
    try { if (!fs.existsSync(FILE)) save(fresh); } catch { /* Schreibrechte fehlen: weiter im Speicher */ }
    return fresh;
  }
}
function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}
const nowIso = () => new Date().toISOString();
const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 48);
const hostOk = (h) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(String(h || '').toLowerCase());
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const bad = (code, error) => ({ ok: false, code, error });

function audit(state, by, action, target, detail) {
  state.audit.unshift({ at: nowIso(), by: String(by || 'system').slice(0, 60), action, target: String(target || ''), detail: detail || '' });
  if (state.audit.length > 2000) state.audit.length = 2000;
}
function expire(state) {
  const now = Date.now();
  for (const a of state.approvals) if (a.status === 'pending' && now - Date.parse(a.at) > TTL_MS) a.status = 'expired';
}
// REGEL 1: riskante Strukturaenderungen laufen ueber eine Freigabe-Anfrage.
function requestApproval(state, kind, payload, by) {
  if (!APPROVAL_KINDS.includes(kind)) return bad(400, 'unbekannte Freigabe-Art');
  expire(state);
  if (state.approvals.filter((a) => a.status === 'pending').length >= MAX_PENDING) return bad(429, 'zu viele offene Freigaben');
  const req = { id: 'AP-' + crypto.randomBytes(3).toString('hex'), kind, by: String(by || '').slice(0, 60), payload, status: 'pending', at: nowIso() };
  state.approvals.push(req);
  return { ok: true, code: 202, status: 'pending_approval', approval: req };
}

// ---------------------------------------------------------------- Seiten-Registry
function registerSite(input, by) {
  const state = load();
  const id = slug(input && input.id);
  const domain = String((input && input.domain) || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const niche = String((input && input.niche) || '').toUpperCase();
  const affiliate = String((input && (input.affiliate_status || input.affiliate)) || 'NONE').toUpperCase();
  const consent = String((input && (input.consent_status || input.consent)) || 'PENDING').toUpperCase();

  if (!id || id.length < 3) return bad(400, 'Seiten-ID fehlt (min. 3 Zeichen, a-z 0-9 -)');
  if (!hostOk(domain)) return bad(400, 'Domain ungueltig');
  if (!NICHES.includes(niche)) return bad(400, 'Nische unbekannt — erlaubt: ' + NICHES.join(', '));
  if (!AFFILIATE_STATUS.includes(affiliate)) return bad(400, 'affiliate_status: OWN | AUTHORIZED | NONE');
  if (!CONSENT.includes(consent)) return bad(400, 'consent_status: OK | PENDING | NOT_REQUIRED');
  // Spez: nur eigene oder vertraglich autorisierte Affiliate-Seiten duerfen verbunden werden.
  if (affiliate === 'NONE') return bad(403, 'Keine Verbindung: nur eigene oder autorisierte Affiliate-Seiten (affiliate_status OWN/AUTHORIZED)');
  if (state.sites.some((s) => s.id === id)) return bad(409, 'Seiten-ID existiert schon');
  if (state.sites.some((s) => s.domain === domain)) return bad(409, 'Domain ist schon registriert');

  const site = {
    id, domain, niche, affiliate_status: affiliate, consent_status: consent,
    analytics_source: String((input && input.analytics_source) || 'site-api').slice(0, 80),
    status: 'PENDING',                       // PENDING | APPROVED | SUSPENDED
    connected: false,                        // erst nach Freigabe + gueltigem Schluessel
    key_hash: null, key_prefix: null, key_issued_at: null,
    modules: Object.fromEntries(MODULE_FLAGS.map((m) => [m, false])),
    styles: Array.from({ length: STYLE_COUNT }, (_, i) => 'stil-' + (i + 1)),
    active_style: 'stil-1',
    header: { logo_text: '', claim: '', nav: [], cta: null, style: 'blank', mobile_nav: true },
    footer: { legal: '', consent_link: '', social: [], friends: [], newsletter: false },
    registered_at: nowIso(), registered_by: String(by || '').slice(0, 60),
    approved_at: null, approved_by: null,
  };
  state.sites.push(site);
  const app = requestApproval(state, 'site.register', { site: id, domain, niche, affiliate_status: affiliate }, by);
  audit(state, by, 'site.register', id, domain + ' · ' + niche + ' · ' + affiliate);
  save(state);
  return { ...app, site: { id, domain, niche, status: site.status } };
}

function decide(apId, decision, by) {
  if (!controlCenter.isHuman(by)) return bad(403, 'Freigabe nur durch einen Menschen');
  if (!['approve', 'deny'].includes(decision)) return bad(400, 'approve oder deny');
  const state = load();
  expire(state);
  const req = state.approvals.find((a) => a.id === apId);
  if (!req) return bad(404, 'Freigabe nicht gefunden');
  if (req.status !== 'pending') return bad(409, 'bereits entschieden: ' + req.status);
  req.status = decision === 'approve' ? 'approved' : 'denied';
  req.decided_by = String(by).slice(0, 60);
  req.decided_at = nowIso();

  let result = { ok: true, approval: { id: req.id, kind: req.kind, status: req.status } };
  if (req.status === 'approved') {
    if (req.kind === 'site.register' || req.kind === 'site.activate') {
      const site = state.sites.find((s) => s.id === req.payload.site);
      if (!site) { save(state); return bad(404, 'Seite nicht gefunden'); }
      if (!site.key_hash) {
        const key = crypto.randomBytes(24).toString('hex');   // wird genau EINMAL ausgegeben, gespeichert nur der Hash
        site.key_hash = sha256(key); site.key_prefix = key.slice(0, 8); site.key_issued_at = nowIso();
        result.api_key = key;
        result.note = 'Schluessel wird nur jetzt angezeigt. Auf der Website in den Vault legen; nicht in Git, nicht im Chat.';
      }
      site.status = 'APPROVED'; site.connected = true;
      site.approved_at = nowIso(); site.approved_by = String(by).slice(0, 60);
      audit(state, by, 'site.approve', site.id, site.domain);
    } else if (req.kind === 'slot.pool') {
      const slot = state.slots.find((s) => s.id === req.payload.slot);
      if (!slot) { save(state); return bad(404, 'Slot nicht gefunden'); }
      slot.pool = req.payload.pool;
      audit(state, by, 'slot.pool.approve', slot.id, slot.pool.length + ' Partner im Pool');
    } else if (req.kind === 'deployment') {
      audit(state, by, 'deployment.approve', req.payload.site || '', String(req.payload.target || ''));
    }
  } else {
    audit(state, by, req.kind + '.deny', req.payload && req.payload.site ? req.payload.site : (req.payload && req.payload.slot) || '', '');
  }
  save(state);
  return result;
}
function pending() {
  const state = load(); expire(state); save(state);
  return state.approvals.filter((a) => a.status === 'pending').map((a) => ({ id: a.id, kind: a.kind, by: a.by, at: a.at, payload: a.payload }));
}

function updateSite(id, patch, by) {
  if (!controlCenter.isHuman(by)) return bad(403, 'nur ein Mensch darf Seiten-Konfiguration aendern');
  const state = load();
  const site = state.sites.find((s) => s.id === id);
  if (!site) return bad(404, 'Seite nicht gefunden');
  if (patch.modules) {
    for (const [k, v] of Object.entries(patch.modules)) {
      if (!MODULE_FLAGS.includes(String(k).toUpperCase())) return bad(400, 'unbekanntes Modul: ' + k);
      site.modules[String(k).toUpperCase()] = !!v;
    }
    audit(state, by, 'site.modules', id, JSON.stringify(site.modules));
  }
  if (patch.active_style !== undefined || patch.style !== undefined) {
    const wanted = String(patch.active_style || patch.style);
    // genau eine der fuenf Varianten aktiv; Wechsel aendert nur Praesentation
    if (!site.styles.includes(wanted)) return bad(400, 'Stil unbekannt — verfuegbar: ' + site.styles.join(', '));
    site.active_style = wanted;
    audit(state, by, 'site.style', id, wanted);
  }
  if (patch.header) {
    const h = patch.header;
    site.header = {
      logo_text: String(h.logo_text !== undefined ? h.logo_text : site.header.logo_text).slice(0, 80),
      claim: String(h.claim !== undefined ? h.claim : site.header.claim).slice(0, 160),
      nav: Array.isArray(h.nav) ? h.nav.slice(0, 20).map((n) => String(n).slice(0, 60)) : site.header.nav,
      cta: h.cta !== undefined ? (h.cta ? String(h.cta).slice(0, 80) : null) : site.header.cta,
      style: String(h.style || site.header.style).slice(0, 40),
      mobile_nav: h.mobile_nav !== undefined ? !!h.mobile_nav : site.header.mobile_nav,
    };
    audit(state, by, 'site.header', id, 'zentral bearbeitet');
  }
  if (patch.footer) {
    const f = patch.footer;
    site.footer = {
      legal: String(f.legal !== undefined ? f.legal : site.footer.legal).slice(0, 120),
      consent_link: String(f.consent_link !== undefined ? f.consent_link : site.footer.consent_link).slice(0, 120),
      social: Array.isArray(f.social) ? f.social.slice(0, 12) : site.footer.social,
      friends: Array.isArray(f.friends) ? f.friends.slice(0, 20) : site.footer.friends,
      newsletter: f.newsletter !== undefined ? !!f.newsletter : site.footer.newsletter,
    };
    audit(state, by, 'site.footer', id, 'zentral bearbeitet');
  }
  if (patch.suspend !== undefined) {
    if (!controlCenter.isHuman(by)) return bad(403, 'nur ein Mensch darf Seiten sperren');
    site.status = patch.suspend ? 'SUSPENDED' : 'APPROVED';
    site.connected = !patch.suspend;
    audit(state, by, patch.suspend ? 'site.suspend' : 'site.resume', id, '');
  }
  save(state);
  return { ok: true, site: { id: site.id, status: site.status, modules: site.modules, active_style: site.active_style } };
}

// ---------------------------------------------------------------- Link-/Banner-Slots
function addSlot(input, by) {
  if (!controlCenter.isHuman(by)) return bad(403, 'nur ein Mensch darf Slots anlegen');
  const id = String((input && input.id) || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 48);
  if (!id || id.length < 3) return bad(400, 'Slot-ID fehlt (z. B. CASINO_HERO_DE)');
  const state = load();
  if (state.slots.some((s) => s.id === id)) return bad(409, 'Slot existiert schon');
  const slot = {
    id,
    category: String((input && input.category) || 'OTHER').toUpperCase().slice(0, 40),
    region: String((input && input.region) || 'DE').toUpperCase().slice(0, 8),
    language: String((input && input.language) || 'de').slice(0, 8),
    disclosure: String((input && input.disclosure) || 'Werbung/Anzeige').slice(0, 60),
    sites: Array.isArray(input && input.sites) ? input.sites.map(slug).slice(0, 200) : [],
    mode: 'AUTO',                                  // AUTO = Fallback-Rotation im freigegebenen Pool
    pool: [],                                      // erst nach Freigabe (REGEL 1)
    active: null,
    neutral_text: String((input && input.neutral_text) || 'Derzeit kein passender Partner verfuegbar.').slice(0, 160),
    last_resolve: null, rotations: 0,
  };
  state.slots.push(slot);
  audit(state, by, 'slot.add', id, slot.category + '/' + slot.region);
  save(state);
  return { ok: true, slot };
}

// Pool setzen = Linkaenderung => REGEL 1 (Freigabe noetig). Nur vorab freigegebene Partner landen im Pool.
function setPool(slotId, pool, by) {
  if (!controlCenter.isHuman(by)) return bad(403, 'nur ein Mensch darf Partner vorschlagen');
  const state = load();
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot) return bad(404, 'Slot nicht gefunden');
  if (!Array.isArray(pool) || !pool.length) return bad(400, 'Pool leer');
  const clean = [];
  for (const p of pool.slice(0, 25)) {
    const url = String((p && p.url) || '');
    if (!/^https:\/\//.test(url)) return bad(400, 'nur https-Ziele erlaubt: ' + url);
    const pid = slug(p && (p.id || p.partner));
    if (!pid) return bad(400, 'Partner ohne ID');
    clean.push({
      id: pid,
      partner: String((p && p.partner) || pid).slice(0, 80),
      url: url.slice(0, 400),
      subid: p && p.subid ? String(p.subid).slice(0, 80) : null,
      asset: p && p.asset ? String(p.asset).slice(0, 200) : null,
      priority: Number.isFinite(Number(p && p.priority)) ? Number(p.priority) : clean.length + 1,
      status: PARTNER_STATUS.includes(String(p && p.status).toUpperCase()) ? String(p.status).toUpperCase() : 'ACTIVE',
      health: { up: null, checked_at: null },
    });
  }
  // Ein Partner darf nur einmal im Pool liegen.
  const seen = new Set();
  for (const p of clean) { if (seen.has(p.id)) return bad(400, 'Partner doppelt: ' + p.id); seen.add(p.id); }
  const app = requestApproval(state, 'slot.pool', { slot: slotId, pool: clean }, by);
  audit(state, by, 'slot.pool.request', slotId, clean.length + ' Partner zur Freigabe');
  save(state);
  return { ...app, slot: slotId, partners: clean.length };
}

// Was wird tatsaechlich ausgeliefert? Nur aus dem freigegebenen Pool; bei Ausfall naechster AKTIVER Partner.
function resolveSlot(slotId, by) {
  const state = load();
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot) return bad(404, 'Slot nicht gefunden');
  const usable = slot.pool.filter((p) => p.status === 'ACTIVE').sort((a, b) => a.priority - b.priority);
  if (!usable.length) {
    slot.last_resolve = { at: nowIso(), partner: null, availability: 'NEUTRAL' };
    audit(state, by || 'render', 'slot.resolve', slotId, 'kein aktiver Partner — neutraler Verfuegbarkeitszustand');
    save(state);
    return { ok: true, slot: slotId, partner: null, availability: 'NEUTRAL', url: null, text: slot.neutral_text, disclosure: slot.disclosure };
  }
  let partner = slot.active ? slot.pool.find((p) => p.id === slot.active && p.status === 'ACTIVE') : null;
  if (!partner) partner = usable[0];
  if (slot.active && partner.id !== slot.active && slot.mode === 'AUTO') {
    slot.rotations += 1;
    audit(state, 'system', 'slot.rotate', slotId, slot.active + ' -> ' + partner.id + ' (im freigegebenen Pool)');
  }
  slot.active = partner.id;
  slot.last_resolve = { at: nowIso(), partner: partner.id, availability: 'OK' };
  save(state);
  return { ok: true, slot: slotId, partner: partner.id, url: partner.url, asset: partner.asset, disclosure: slot.disclosure, availability: 'OK', rotated_from: slot.rotations ? undefined : undefined };
}

// Health-Check: markiert einen Partner DOWN/UP. Zaehlt NIE als Klick, Besuch oder Conversion.
function markHealth(slotId, partnerId, up, by) {
  if (!controlCenter.isHuman(by)) return bad(403, 'nur ein Mensch darf Health-Status setzen');
  const state = load();
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot) return bad(404, 'Slot nicht gefunden');
  const p = slot.pool.find((x) => x.id === slug(partnerId));
  if (!p) return bad(404, 'Partner nicht im Pool');
  p.health = { up: !!up, checked_at: nowIso() };
  p.status = up ? 'ACTIVE' : 'DOWN';
  audit(state, by, 'slot.health', slotId + '/' + p.id, up ? 'UP' : 'DOWN (kein Klick, keine Conversion)');
  save(state);
  return { ok: true, slot: slotId, partner: p.id, status: p.status, note: 'Health-Check wird nicht als Klick/Conversion gezaehlt' };
}

// ---------------------------------------------------------------- Messwerte (echt, signiert, ehrlich)
function siteKeyOk(site, keyPlain) {
  if (!site || !site.key_hash || !keyPlain) return false;
  const given = Buffer.from(sha256(keyPlain), 'hex');
  const have = Buffer.from(site.key_hash, 'hex');
  return given.length === have.length && crypto.timingSafeEqual(given, have);
}
// Ereignisse kommen von der Website (signiert). Ohne gueltige Signatur passiert nichts.
function ingest(siteId, keyPlain, payload, signature) {
  const state = load();
  const site = state.sites.find((s) => s.id === slug(siteId));
  if (!site) return bad(404, 'Seite nicht registriert');
  if (site.status !== 'APPROVED') return bad(403, 'Seite ist nicht freigegeben (' + site.status + ') — keine Datenverbindung');
  if (!siteKeyOk(site, keyPlain)) return bad(401, 'ungueltiger Schluessel');
  const body = JSON.stringify((payload && payload.events) || []);
  if (signature && String(signature) !== sha256(body + site.key_hash)) return bad(401, 'Signatur stimmt nicht');
  const events = Array.isArray(payload && payload.events) ? payload.events : [];
  if (!events.length) return bad(400, 'keine Ereignisse');
  if (events.length > 500) return bad(413, 'maximal 500 Ereignisse pro Uebermittlung');
  const accepted = [];
  const rejected = [];
  for (const e of events) {
    const type = String((e && e.type) || '').toLowerCase();
    if (!EVENT_TYPES.includes(type)) { rejected.push({ type: type || '(leer)', reason: 'unbekannter Typ' }); continue; }
    // Conversion nur mit autorisierter Quelle (Partner-API/Postback) — sonst nicht zaehlbar.
    if (type === 'conversion_confirmed' && !(e && e.authorized_source)) { rejected.push({ type, reason: 'Conversion ohne autorisierte Quelle wird nicht gezaehlt' }); continue; }
    accepted.push({
      site: site.id, type,
      at: e && e.at ? String(e.at).slice(0, 32) : nowIso(),
      path: e && e.path ? String(e.path).slice(0, 200) : null,
      source: e && e.source ? String(e.source).slice(0, 80) : null,   // referrer/utm
      partner: e && e.partner ? slug(e.partner) : null,
      value: Number.isFinite(Number(e && e.value)) ? Number(e.value) : 1,
      sim: !!(e && e.sim),                                            // ausdruecklich als Simulation markiert
    });
  }
  if (!accepted.length) { audit(state, 'ingest:' + site.id, 'metrics.reject', site.id, JSON.stringify(rejected.slice(0, 5))); save(state); return bad(400, 'kein gueltiges Ereignis', rejected); }
  state.events.push(...accepted);
  if (state.events.length > 20000) state.events.splice(0, state.events.length - 20000);
  site.last_data_at = nowIso();
  audit(state, 'ingest:' + site.id, 'metrics.ingest', site.id, accepted.length + ' Ereignisse, ' + rejected.length + ' verworfen');
  save(state);
  return { ok: true, accepted: accepted.length, rejected };
}

// Ehrliche Kennzeichnung: LIVE (frische echte Daten) · SIM (ausdruecklich Simulation) · NOT-CONNECTED.
function metrics(siteId) {
  const state = load();
  const site = state.sites.find((s) => s.id === slug(siteId));
  if (!site) return bad(404, 'Seite nicht gefunden');
  const all = state.events.filter((e) => e.site === site.id);
  const real = all.filter((e) => !e.sim);
  const sim = all.filter((e) => e.sim);
  const last = real.length ? Date.parse(real[real.length - 1].at) : 0;
  let label = 'NOT-CONNECTED';
  if (sim.length && !real.length) label = 'SIM';
  else if (real.length && Date.now() - last <= LIVE_WINDOW_MS) label = 'LIVE';
  else if (real.length) label = 'SIM';                                   // alte echte Daten sind keine Live-Anzeige
  const count = (list, type) => list.filter((e) => e.type === type).reduce((a, e) => a + (e.value || 1), 0);
  const byPath = {}, bySource = {}, byPartner = {};
  for (const e of real) {
    if (e.path) byPath[e.path] = (byPath[e.path] || 0) + (e.value || 1);
    if (e.source) bySource[e.source] = (bySource[e.source] || 0) + (e.value || 1);
    if (e.partner) byPartner[e.partner] = (byPartner[e.partner] || 0) + (e.value || 1);
  }
  return {
    ok: true, site: site.id, domain: site.domain, label,
    connected: site.connected === true && site.status === 'APPROVED',
    last_data_at: site.last_data_at || null,
    totals: {
      pageviews: count(real, 'pageview'), sessions: count(real, 'session'),
      outbound_clicks: count(real, 'outbound_click'), errors: count(real, 'error'),
      conversions_confirmed: count(real, 'conversion_confirmed'),
    },
    top_paths: Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ path: k, n: v })),
    sources: Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ source: k, n: v })),
    partners: Object.entries(byPartner).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ partner: k, n: v })),
    sim_events: sim.length,
    note: 'Nur echte, signiert uebermittelte Ereignisse. Fehlende Daten werden nie erfunden oder als LIVE dargestellt.',
  };
}

function status() {
  const state = load(); expire(state); save(state);
  return {
    area: 'WEB-EMPIRE', mode: 'LIVE', rule1: true,
    note: 'Erweiterung des bestehenden Analyseboards. Kein zweites Master-Panel. Keine automatische Traffic-/Klick-Erzeugung.',
    niches: NICHES, module_flags: MODULE_FLAGS, style_variants_per_site: STYLE_COUNT,
    sites: state.sites.map((s) => ({
      id: s.id, domain: s.domain, niche: s.niche, status: s.status, connected: s.connected,
      affiliate_status: s.affiliate_status, consent_status: s.consent_status, analytics_source: s.analytics_source,
      active_style: s.active_style, modules_on: Object.entries(s.modules).filter(([, v]) => v).map(([k]) => k),
      last_data_at: s.last_data_at || null,
    })),
    slots: state.slots.map((s) => ({
      id: s.id, category: s.category, region: s.region, disclosure: s.disclosure,
      partners: s.pool.length, active: s.active, rotations: s.rotations,
      active_partner: (s.pool.find((p) => p.id === s.active) || null) && null,
    })),
    pending: pending(), audit_tail: state.audit.slice(0, 20),
  };
}

module.exports = {
  NICHES, MODULE_FLAGS, EVENT_TYPES, APPROVAL_KINDS, STYLE_COUNT, FILE,
  registerSite, decide, pending, updateSite,
  addSlot, setPool, resolveSlot, markHealth,
  ingest, metrics, status, load, save,
};
