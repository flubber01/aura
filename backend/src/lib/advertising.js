'use strict';
// AURA · Werbung: eigene Werbeflächen verwalten und Kampagnen planen — ohne zu täuschen.
//
// Diese Datei hat drei eiserne Regeln, die nicht umgangen werden können:
//  1. KEINE Klick-Erzeugung. Es gibt keine Funktion „Klicks kaufen", „Traffic besorgen", „Views
//     erzeugen". Was es gibt: Werbeflächen definieren, ehrliche Messwerte eintragen, Budget rechnen.
//  2. ZAHLEN SIND PROGNOSEN. Die Reichweitenrechnung ist eine Formel über eingegebene Werte, klar
//     als Prognose benannt — nie als Ergebnis.
//  3. FREIGABE. Eine Kampagne nach außen braucht einen Menschen (Freigabe-Tür, kind SPEND).
//
// Werbeflächen sind die eigenen Seiten/Slots (aus dem Web-Empire) und eigene Kanäle. Fremde
// Werbenetzwerke laufen über Connectoren mit Schlüssel und Status — nie „irgendwie".
const fs = require('fs');
const path = require('path');

const FILE = process.env.AURA_ADS_FILE || path.join(__dirname, '..', 'data', 'advertising.json');

const SLOT_POSITIONS = ['HERO', 'SIDEBAR', 'IN_ARTICLE', 'FOOTER', 'PLAYER_SIDE', 'NEWSLETTER'];

// Was mit Werbung NICHT geht. Steht als Funktion da, damit es nicht nur eine Absichtserklärung bleibt.
const REFUSED_REQUESTS = [
  { pattern: /klicks?\s*(kaufen|erzeugen|besorgen|kaufen)|traffic\s*(kaufen|besorgen)|views\s*(kaufen|erzeugen)|follower\s*kaufen/i, why: 'Reichweite wird nicht gekauft oder erzeugt — das ist gesperrt.' },
  { pattern: /bot(s)?\s*(ein|los)|autoklick|clickbot|klickautomat/i, why: 'Automatische Klicks sind gesperrt (Betrug an Werbekunden und Plattformen).' },
  { pattern: /pop[\s-]*up[\s-]*(netzwerk|anzeige)|redirect[\s-]*netzwerk|zwangsweiterleitung|malvertising|push[\)-]*benachrichtigung[\s-]*netzwerk/i, why: 'Werbenetzwerke mit Zwangsweiterleitung, Pop-ups oder Schadcode kommen nicht in Frage.' },
  { pattern: /kinder|minderjährig|adult|glücksspiel|casino/i, why: 'Keine Werbung für Glücksspiel/Adult auf Seiten, die auch Minderjährige sehen können — und nie ohne Einwilligung.' },
  { pattern: /personenbezogen|targeting\s*per\s*e-?mail|datenverkauf/i, why: 'Kein personenbezogenes Targeting, kein Datenverkauf. Nur Kontextwerbung.' },
];

function checkRequest(text) {
  const t = String(text || '');
  const hit = REFUSED_REQUESTS.find((r) => r.pattern.test(t));
  return hit ? { ok: false, allowed: false, reason: hit.why } : { ok: true, allowed: true, note: 'Kein gesperrter Wunsch erkannt. Kontextwerbung auf eigenen Flächen bleibt erlaubt.' };
}

function defaults() { return { slots: [], campaigns: [], audit: [] }; }
function load() {
  try {
    if (!fs.existsSync(FILE)) { const f = defaults(); save(f); return f; }
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('kaputt');
    for (const k of ['slots', 'campaigns', 'audit']) if (!Array.isArray(raw[k])) raw[k] = [];
    return raw;
  } catch { const f = defaults(); save(f); return f; } // AURA_SEED_WRITE
}
function save(d) { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch { /* Laufzeit */ } return d; }

// Werbefläche anlegen = eigene Seite/Slot beschreiben.
function slot(input) {
  const data = load();
  const page = String((input && input.page) || '').trim();
  const position = String((input && input.position) || '').toUpperCase();
  if (!page) return { ok: false, error: 'page (eigene Seite) fehlt' };
  if (!SLOT_POSITIONS.includes(position)) return { ok: false, error: `position fehlt oder unbekannt. Erlaubt: ${SLOT_POSITIONS.join(', ')}` };
  const s = {
    id: 'sl-' + Math.random().toString(16).slice(2, 10),
    page, position,
    size: String((input && input.size) || '300x250'),
    context: String((input && input.context) || 'eigene Inhalte').slice(0, 200),
    consent_required: true,
    rel: 'sponsored nofollow',
    state: 'LEER',
    filled_by: null,
    created_at: new Date().toISOString(),
    rules: ['Nur gekennzeichnete Werbung (Kennzeichnung sichtbar).', 'Einwilligung nötig, wo vorgeschrieben.', 'Kein personenbezogenes Targeting.', 'Werbekunde zahlt an den Betreiber, nicht umgekehrt.'],
  };
  data.slots.unshift(s); data.slots = data.slots.slice(0, 300);
  data.audit.unshift({ at: s.created_at, action: 'slot', id: s.id, page, position });
  save(data);
  return { ok: true, slot: s };
}

// Kampagne planen. Zahlen = Prognose über eingegebene Werte.
function campaign(input) {
  const data = load();
  const check = checkRequest((input && input.goal) || '');
  if (!check.allowed) return { ok: false, refused: true, error: check.reason };
  const name = String((input && input.name) || '').trim();
  if (!name) return { ok: false, error: 'name fehlt' };
  const budget = Number((input && input.budget_eur) || 0);
  if (!(budget > 0)) return { ok: false, error: 'budget_eur muss größer als 0 sein' };
  const cpm = Math.max(0.5, Number((input && input.cpm_eur) || 4));      // Kosten je 1000 Einblendungen
  const impressions = Math.round((budget / cpm) * 1000);
  const ctr = Math.min(0.2, Math.max(0.0005, Number((input && input.ctr) || 0.008)));
  const clicks = Math.round(impressions * ctr);
  const cpc = clicks ? Math.round((budget / clicks) * 100) / 100 : null;
  const slots = Array.isArray(input && input.slots) ? input.slots.slice(0, 50) : [];
  const camp = {
    id: 'adc-' + Math.random().toString(16).slice(2, 10),
    name, goal: String((input && input.goal) || 'Bekanntheit').slice(0, 300),
    budget_eur: budget, cpm_eur: cpm, ctr_assumed: ctr,
    slots, channels: (Array.isArray(input && input.channels) ? input.channels : []).slice(0, 8),
    starts: (input && input.starts) || null, ends: (input && input.ends) || null,
    forecast: {
      impressions, clicks, cpc_eur: cpc,
      label: 'PROGNOSE — gerechnet aus Budget, CPM und angenommener Klickrate. Kein Versprechen, kein gemessener Wert.',
      formula: `${budget} € ÷ ${cpm} € CPM × 1000 = ${impressions} Einblendungen; × ${ctr} Klickrate = ${clicks} Klicks`,
    },
    state: 'ENTWURF',
    needs: ['Menschliche Freigabe vor Ausspielung (Freigabe-Tür, kind SPEND)', 'Einwilligung/Kennzeichnung je Fläche', 'Ehrliche Messwerte nach Ausspielung eintragen'],
    created_at: new Date().toISOString(),
  };
  data.campaigns.unshift(camp); data.campaigns = data.campaigns.slice(0, 200);
  data.audit.unshift({ at: camp.created_at, action: 'campaign', id: camp.id, budget });
  save(data);
  return { ok: true, campaign: camp, honesty: 'Prognose ≠ Ergebnis. AURA erzeugt keine Einblendungen und keine Klicks.' };
}

// Gemessene Werte eintragen — der einzige Weg, aus einer Prognose Wirklichkeit zu machen.
function measure(id, values) {
  const data = load();
  const c = data.campaigns.find((x) => x.id === id);
  if (!c) return { ok: false, error: 'Kampagne nicht gefunden' };
  const v = values || {};
  if (v.impressions === undefined && v.clicks === undefined) return { ok: false, error: 'mindestens impressions oder clicks angeben' };
  c.measured = {
    at: new Date().toISOString(),
    impressions: v.impressions === undefined ? null : Number(v.impressions),
    clicks: v.clicks === undefined ? null : Number(v.clicks),
    spend_eur: v.spend_eur === undefined ? null : Number(v.spend_eur),
    source: String(v.source || 'manuell eingetragen'),
  };
  c.measured.ctr_real = c.measured.impressions ? Math.round((c.measured.clicks / c.measured.impressions) * 10000) / 10000 : null;
  c.measured.vs_forecast = c.forecast.clicks ? Math.round(((c.measured.clicks - c.forecast.clicks) / c.forecast.clicks) * 100) / 100 : null;
  c.state = 'GEMESSEN';
  save(data);
  return { ok: true, campaign: { id: c.id, measured: c.measured, forecast: c.forecast }, note: 'Nur echte Werte eintragen. Erfundene Zahlen machen die Planung wertlos.' };
}

function inventory() {
  const data = load();
  const byPage = {};
  for (const s of data.slots) { (byPage[s.page] = byPage[s.page] || []).push({ id: s.id, position: s.position, size: s.size, state: s.state }); }
  return { ok: true, slots: data.slots.length, free: data.slots.filter((s) => s.state === 'LEER').length, by_page: byPage, positions: SLOT_POSITIONS };
}

function status() {
  const d = load();
  return {
    area: 'ADS', module: 'advertising', state: 'live', file: FILE,
    slots: d.slots.length, campaigns: d.campaigns.length,
    positions: SLOT_POSITIONS,
    refused_rules: REFUSED_REQUESTS.length,
    rules: ['Keine Klick-/View-/Follower-Erzeugung — gesperrte Wünsche werden abgelehnt.', 'Zahlen sind Prognosen, bis echte Messwerte eingetragen sind.', 'Werbung wird gekennzeichnet, mit Einwilligung und ohne personenbezogenes Targeting.', 'Ausspielung nur mit menschlicher Freigabe.'],
  };
}

module.exports = {
  meta: { area: 'ADS', id: 'advertising', name: 'Werbung (eigene Flächen, ehrliche Prognose, Freigabe)', state: 'live' },
  actions: { status: () => status(), positions: () => ({ ok: true, positions: SLOT_POSITIONS }), check: (p) => checkRequest((p || {}).text), slot: (p) => slot(p || {}), slots: () => ({ ok: true, slots: load().slots.slice(0, 100) }), campaign: (p) => campaign(p || {}), campaigns: () => ({ ok: true, campaigns: load().campaigns.slice(0, 50).map((c) => ({ id: c.id, name: c.name, budget_eur: c.budget_eur, state: c.state, forecast: c.forecast, measured: c.measured || null })) }), measure: (p) => measure((p || {}).id, p || {}), inventory: () => inventory() },
  SLOT_POSITIONS, REFUSED_REQUESTS, checkRequest, slot, campaign, measure, inventory, status,
};
