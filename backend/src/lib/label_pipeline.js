'use strict';
// AURA WF-19 — Label-Release-Pipeline (Phase 2, §31 B3).
// Track → Metadaten → Rechte → Cover → Release-Kalender → Admin-Freigabe →
// manuelle Verteilung (über offizielle Distributoren/Plattformen) → Teaser → Ankündigung.
//
// - Stufen müssen in Reihenfolge durchlaufen werden. Ein Gate blockiert das Weiterkommen.
// - Die Verteilung wird NICHT von AURA ausgeführt: der Admin lädt manuell hoch und
//   trägt den Nachweis (https) ein. Das ist die ehrliche Grenze der Sandbox.
// - Rechte: AURA prüft nur, dass ein Nachweis-Verweis und die Admin-Bestätigung vorliegen.
//   Die rechtliche Prüfung bleibt beim Admin.
const crypto = require('crypto');
const growthStore = require('./growth_store');
const store = require('./store');

const STAGES = ['track_ready', 'metadata_ok', 'rights_confirmed', 'cover_ready', 'calendar_slot', 'admin_approved', 'distributed_manual', 'teaser_ready', 'announced'];
const MIN_LEAD_DAYS = 7;
const COVER_SOURCES = ['own_generated', 'own_artwork'];

const isHttps = (u) => /^https:\/\/[^\s]+$/.test(String(u || ''));
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// Gate-Prüfung je Zielstufe. Gibt Fehlerliste zurück (leer = ok).
const GATES = {
  metadata_ok(r) {
    const e = [];
    if (!r.track.title || r.track.title.length < 2) e.push('track.title fehlt');
    if (!r.track.genre) e.push('track.genre fehlt');
    if (!(Number(r.track.duration_s) >= 30)) e.push('track.duration_s ≥ 30 erforderlich');
    return e;
  },
  rights_confirmed(r, p) {
    const e = [];
    if (!p.rights_ref || String(p.rights_ref).length < 4) e.push('rights_ref fehlt (Verweis auf Lizenz-/Kaufnachweis)');
    if (p.admin_confirmed !== true) e.push('admin_confirmed muss true sein (Rechte-Bestätigung durch Admin)');
    return e;
  },
  cover_ready(r, p) {
    const e = [];
    if (!COVER_SOURCES.includes(p.cover_source)) e.push('cover_source muss ' + COVER_SOURCES.join(' | ') + ' sein');
    if (p.cover_ref && !/^(\/|https:\/\/)/.test(String(p.cover_ref))) e.push('cover_ref muss Pfad oder https sein');
    return e;
  },
  calendar_slot(r, p) {
    const e = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.release_date || ''))) e.push('release_date im Format YYYY-MM-DD');
    else if (daysBetween(today(), p.release_date) < MIN_LEAD_DAYS) e.push('Vorlaufzeit: mindestens ' + MIN_LEAD_DAYS + ' Tage');
    return e;
  },
  admin_approved(r, p) {
    if (!p.approved_by || String(p.approved_by).length < 2) return ['approved_by (Admin-Name) fehlt — REGEL 1'];
    return [];
  },
  distributed_manual(r, p) {
    const e = [];
    if (!isHttps(p.proof_url)) e.push('proof_url (https) fehlt: Nachweis der manuellen Verteilung');
    if (!p.platform) e.push('platform fehlt (z. B. spotify, youtube_music)');
    return e;
  },
  teaser_ready(r, p) {
    if (!p.teaser_rp_id || !/^RP-[0-9a-f]{8}$/.test(String(p.teaser_rp_id))) return ['teaser_rp_id fehlt (Ergebnis aus WF-18)'];
    const db = growthStore.load();
    if (!db.repurpose.some((x) => x.id === p.teaser_rp_id)) return ['teaser_rp_id unbekannt'];
    return [];
  },
  announced(r, p) {
    const e = [];
    if (!isHttps(p.announce_url)) e.push('announce_url (https) fehlt: eigene Page oder Telegram');
    return e;
  },
};

function create(body) {
  const t = body.track || {};
  const errs = [];
  if (!t.title || String(t.title).trim().length < 2) errs.push('track.title required');
  const rel = {
    id: 'REL-' + crypto.randomBytes(4).toString('hex'),
    wf: 'WF-19',
    track: { title: String(t.title || '').slice(0, 160), genre: String(t.genre || '').slice(0, 60), duration_s: Number(t.duration_s) || 0 },
    stage: 'track_ready',
    history: [{ stage: 'track_ready', at: new Date().toISOString(), note: 'angelegt' }],
    rights: null, cover: null, release_date: null, approved_by: null, distribution: null, teaser_rp_id: null, announce_url: null,
    created_at: new Date().toISOString(),
  };
  if (errs.length) return { ok: false, errors: errs };
  const db = growthStore.load();
  db.releases.unshift(rel);
  db.releases = db.releases.slice(0, 200);
  growthStore.save(db);
  store.audit({ area: 'WF-19', event: 'release_created', id: rel.id });
  return { ok: true, release: rel, next_stage: nextStage(rel.stage) };
}

function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

// Stufe weitergeben. target muss exakt die nächste Stufe sein (kein Überspringen).
function advance(id, target, payload = {}) {
  const db = growthStore.load();
  const rel = db.releases.find((r) => r.id === id);
  if (!rel) return { ok: false, code: 404, errors: ['unknown release'] };
  const expected = nextStage(rel.stage);
  if (!expected) return { ok: false, code: 409, errors: ['Release ist bereits abgeschlossen (announced)'] };
  if (target !== expected) return { ok: false, code: 409, errors: ['Stufe überspringen nicht erlaubt: nächste Stufe ist ' + expected] };

  // Daten aus Payload übernehmen, bevor das Gate geprüft wird.
  const p = { ...payload };
  const gate = GATES[target];
  const errs = gate ? gate(rel, p) : [];
  if (errs.length) return { ok: false, code: 422, stage: target, errors: errs };

  // Daten je Stufe ablegen.
  if (target === 'rights_confirmed') rel.rights = { rights_ref: String(p.rights_ref).slice(0, 300), admin_confirmed: true };
  if (target === 'cover_ready') rel.cover = { cover_source: p.cover_source, cover_ref: p.cover_ref || null };
  if (target === 'calendar_slot') rel.release_date = p.release_date;
  if (target === 'admin_approved') rel.approved_by = String(p.approved_by).slice(0, 80);
  if (target === 'distributed_manual') rel.distribution = { platform: String(p.platform).slice(0, 40), proof_url: p.proof_url, mode: 'manual_by_admin' };
  if (target === 'teaser_ready') rel.teaser_rp_id = p.teaser_rp_id;
  if (target === 'announced') rel.announce_url = p.announce_url;

  rel.stage = target;
  rel.history.push({ stage: target, at: new Date().toISOString(), note: String(p.note || '').slice(0, 200) });
  growthStore.save(db);
  store.audit({ area: 'WF-19', event: 'stage_advanced', id, stage: target });
  return { ok: true, release: rel, next_stage: nextStage(target) };
}

function list() {
  return { wf: 'WF-19', stages: STAGES, releases: growthStore.load().releases.slice(0, 50) };
}

module.exports = { create, advance, list, STAGES, GATES, nextStage, MIN_LEAD_DAYS };
