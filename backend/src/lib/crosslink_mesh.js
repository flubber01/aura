'use strict';
// AURA Traffic Mesh (Phase 2, §31 B2) — Crosslink-Matrix über EIGENE Assets.
//
// - Nur eigene, registrierte Assets (owned=true, https, Host passend zum Typ).
// - Vorgeschlagene Links sind Vorschläge (status=proposed). Übernommen werden sie
//   nur vom Admin (REGEL 1). Kein Auto-Schreiben in Pages/Kanäle.
// - Keine Fremdplattformen-Manipulation, kein Link-Kauf, keine Link-Farmen:
//   jede Quelle bekommt höchstens MAX_OUT Vorschläge, Zielauswahl bevorzugt gemeinsame Tags.
const fs = require('fs');
const path = require('path');

const CONFIG = path.join(__dirname, '..', '..', 'data', 'growth_assets.json');
const MAX_OUT = 5;

// Erlaubte Linkrichtungen (Quelle → Ziele). Alles andere wird nicht vorgeschlagen.
const POLICY = {
  youtube_video: ['page', 'youtube_channel', 'telegram'],
  youtube_channel: ['page', 'spotify', 'telegram'],
  page: ['page', 'youtube_channel', 'spotify', 'telegram'],
  telegram: ['page', 'youtube_channel', 'spotify'],
  spotify: ['page', 'youtube_channel'],
  tiktok: ['page', 'youtube_channel', 'telegram'],
  facebook_page: ['page', 'telegram'],
};

// Host-Regeln je Typ. 'page' braucht zusätzlich eine Domain aus own_domains.
const HOSTS = {
  youtube_video: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/,
  youtube_channel: /(^|\.)youtube\.com$/,
  telegram: /(^|\.)t\.me$/,
  spotify: /(^|\.)open\.spotify\.com$/,
  tiktok: /(^|\.)tiktok\.com$/,
  facebook_page: /(^|\.)facebook\.com$/,
};

function readConfig() {
  try {
    const d = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    return { own_domains: Array.isArray(d.own_domains) ? d.own_domains : [], assets: Array.isArray(d.assets) ? d.assets : [] };
  } catch {
    return { own_domains: [], assets: [] };
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  const tmp = CONFIG + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, CONFIG);
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

function validateAsset(a, cfg) {
  const errs = [];
  if (!a || typeof a !== 'object') return ['asset object required'];
  if (!a.id || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(String(a.id))) errs.push('id required (a-z, 0-9, -; 2–41 Zeichen)');
  if (!Object.keys(POLICY).includes(a.type) && a.type !== 'page') errs.push('type unbekannt: ' + a.type);
  if (a.owned !== true) errs.push('owned must be true — nur eigene Assets im Mesh');
  if (!/^https:\/\/[^\s]+$/.test(String(a.url || ''))) errs.push('url must be https');
  const host = hostOf(a.url);
  if (host) {
    if (a.type === 'page') {
      if (!cfg.own_domains.includes(host)) errs.push('Host ' + host + ' ist nicht in own_domains eingetragen');
    } else if (HOSTS[a.type] && !HOSTS[a.type].test(host)) {
      errs.push('Host ' + host + ' passt nicht zum Typ ' + a.type);
    }
  }
  if (a.tags !== undefined && (!Array.isArray(a.tags) || a.tags.length > 10)) errs.push('tags: Liste mit max. 10 Einträgen');
  if (cfg.assets.some((x) => x.id === a.id)) errs.push('id bereits vergeben: ' + a.id);
  return errs;
}

function addAsset(body) {
  const cfg = readConfig();
  const errs = validateAsset(body, cfg);
  if (errs.length) return { ok: false, errors: errs };
  const asset = {
    id: body.id, type: body.type, url: body.url, owned: true,
    label: String(body.label || body.id).slice(0, 120),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).slice(0, 30)).slice(0, 10) : [],
  };
  cfg.assets.push(asset);
  writeConfig(cfg);
  return { ok: true, asset };
}

function matrix() {
  const cfg = readConfig();
  const assets = cfg.assets;
  const proposals = [];
  const inbound = new Map(assets.map((a) => [a.id, 0]));

  for (const src of assets) {
    const allowed = POLICY[src.type] || [];
    const candidates = assets
      .filter((t) => t.id !== src.id && allowed.includes(t.type))
      .map((t) => ({ t, shared: (src.tags || []).filter((g) => (t.tags || []).includes(g)).length }))
      .sort((x, y) => y.shared - x.shared || x.t.id.localeCompare(y.t.id))
      .slice(0, MAX_OUT);
    for (const { t, shared } of candidates) {
      proposals.push({ from: src.id, to: t.id, from_type: src.type, to_type: t.type, shared_tags: shared, status: 'proposed', requires_approval: true });
      inbound.set(t.id, inbound.get(t.id) + 1);
    }
  }

  const orphans = assets.filter((a) => inbound.get(a.id) === 0).map((a) => a.id);
  const byType = {};
  assets.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + 1; });

  return {
    wf: 'Traffic Mesh (Area 82 Crosslink-Policy)',
    policy: POLICY,
    own_domains: cfg.own_domains,
    assets: { total: assets.length, by_type: byType },
    proposals,
    orphans,
    notes: assets.length === 0
      ? 'Noch keine Assets registriert. Eigene Pages/Kanäle per POST /api/growth/mesh/asset eintragen.'
      : 'Vorschläge sind nicht veröffentlicht. Übernahme nur durch den Admin.',
  };
}

module.exports = { addAsset, matrix, readConfig, validateAsset, POLICY, MAX_OUT };
