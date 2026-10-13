'use strict';
// AURA Area 40 — Variance Lifecycle / Swarm Evolution (LIVE, mit Governance).
// Varianten (Prompts/Konfiguration) durchlaufen candidate → trial → promoted/retired.
// Autonomie NUR mit Governance: Promotion verlangt Admin-Freigabe + echte Scores.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'variance.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { variants: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const STAGES = ['candidate', 'trial', 'promoted', 'retired'];
const PROMOTE_MIN_SCORE = 60;

function createVariant(body) {
  const target = String((body || {}).target || '').trim().slice(0, 120);
  const name = String(body.name || '').trim().slice(0, 100);
  if (!target || !name) { const e = new Error('target + name fehlen'); e.code = 400; throw e; }
  const db = load();
  const v = {
    id: 'var-' + Date.now().toString(36), target, name,
    payload: String(body.payload || '').slice(0, 20000),
    stage: 'candidate', scores: [], created_at: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: 'created' }],
  };
  db.variants.push(v); save(db);
  return { ok: true, variant: v };
}
function score(id, value) {
  const db = load();
  const v = db.variants.find((x) => x.id === id);
  if (!v) { const e = new Error('Variante nicht gefunden'); e.code = 404; throw e; }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) { const e = new Error('Score muss 0..100 sein'); e.code = 400; throw e; }
  if (v.stage === 'retired') { const e = new Error('Variante ist retired'); e.code = 400; throw e; }
  if (v.stage === 'candidate') v.stage = 'trial';
  v.scores.push({ at: new Date().toISOString(), score: n });
  v.avg = Math.round(v.scores.reduce((s, x) => s + x.score, 0) / v.scores.length);
  v.log.push({ at: new Date().toISOString(), event: 'score ' + n + ' → avg ' + v.avg });
  save(db);
  return { ok: true, id, avg: v.avg, stage: v.stage, note: v.avg >= PROMOTE_MIN_SCORE ? 'Promotion möglich (approver angeben)' : 'weiter testen (Ziel-Avg ≥ ' + PROMOTE_MIN_SCORE + ')' };
}
function promote(id, approver) {
  const db = load();
  const v = db.variants.find((x) => x.id === id);
  if (!v) { const e = new Error('Variante nicht gefunden'); e.code = 404; throw e; }
  if (!approver) { const e = new Error('Governance: Promotion nur mit approver (Admin-Freigabe)'); e.code = 400; throw e; }
  if (!v.scores.length || v.avg < PROMOTE_MIN_SCORE) { const e = new Error('Governance: Avg-Score < ' + PROMOTE_MIN_SCORE + ' (' + (v.avg || 0) + ') — erst mit score() testen'); e.code = 400; throw e; }
  v.stage = 'promoted'; v.promoted_by = String(approver).slice(0, 60); v.promoted_at = new Date().toISOString();
  v.log.push({ at: v.promoted_at, event: 'promoted by ' + v.promoted_by });
  save(db);
  return { ok: true, id, stage: 'promoted', avg: v.avg };
}
function retire(id) {
  const db = load();
  const v = db.variants.find((x) => x.id === id);
  if (!v) { const e = new Error('Variante nicht gefunden'); e.code = 404; throw e; }
  v.stage = 'retired'; v.log.push({ at: new Date().toISOString(), event: 'retired' }); save(db);
  return { ok: true, id, stage: 'retired' };
}
function list(stage) {
  const db = load();
  return db.variants.slice().reverse().filter((v) => !stage || v.stage === stage)
    .map((v) => ({ id: v.id, target: v.target, name: v.name, stage: v.stage, avg: v.avg || null, trials: v.scores.length }));
}
function status() {
  const db = load();
  return { area: '40', mode: 'LIVE', variants: db.variants.length, by_stage: STAGES.map((s) => ({ stage: s, n: db.variants.filter((v) => v.stage === s).length })), governance: 'Promotion nur mit Avg ≥ ' + PROMOTE_MIN_SCORE + ' + Admin-Freigabe (keine ungeregelte Autonomie)' };
}

module.exports = {
  meta: { area: '40', id: 'variance_lifecycle', name: 'Variance lifecycle / swarm evolution (governed)', state: 'live' },
  actions: { status: () => status(), create: (p) => createVariant(p || {}), score: (p) => score(String((p || {}).id), (p || {}).score), promote: (p) => promote(String((p || {}).id), (p || {}).approver), retire: (p) => retire(String((p || {}).id)), list: (p) => list((p || {}).stage) },
  status, createVariant, score, promote, retire, list,
};
