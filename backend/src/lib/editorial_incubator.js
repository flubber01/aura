'use strict';
// AURA Area 11 — Editorial Incubation (LIVE).
// Dauerhafter Redaktions-Workflow: outline → draft → review → approved → published.
// Sign-off-Regel: Freigabe nur durch einen anderen als den Autor (4-Augen).
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'editorial.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { pieces: [], signoffs: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const STAGES = ['outline', 'draft', 'review', 'approved', 'published'];

function create(body) {
  const title = String((body || {}).title || '').trim().slice(0, 160);
  if (!title) { const e = new Error('title fehlt'); e.code = 400; throw e; }
  const db = load();
  const piece = {
    id: 'ed-' + Date.now().toString(36), title,
    type: ['article', 'post', 'script', 'newsletter'].includes(body.type) ? body.type : 'article',
    author: String(body.author || 'admin').slice(0, 60),
    deadline: String(body.deadline || '').slice(0, 20) || null,
    stage: 'outline', content: String(body.content || '').slice(0, 50000),
    created_at: new Date().toISOString(), log: [{ at: new Date().toISOString(), event: 'created' }],
  };
  db.pieces.push(piece); save(db);
  return { ok: true, piece };
}
function setStage(id, stage, who) {
  const db = load();
  const p = db.pieces.find((x) => x.id === id);
  if (!p) { const e = new Error('Beitrag nicht gefunden'); e.code = 404; throw e; }
  if (!STAGES.includes(stage)) { const e = new Error('unbekannte Stufe'); e.code = 400; throw e; }
  if (stage === 'approved' || stage === 'published') {
    if (!who || String(who).toLowerCase() === p.author.toLowerCase()) { const e = new Error('4-Augen-Regel: Freigabe/Publikation nur durch jemand anderen als den Autor ("approver" angeben)'); e.code = 400; throw e; }
    db.signoffs.push({ at: new Date().toISOString(), piece: id, stage, approver: String(who).slice(0, 60) });
  }
  p.stage = stage;
  if (stage === 'published') p.published_at = new Date().toISOString();
  p.log.push({ at: new Date().toISOString(), event: 'stage → ' + stage + (who ? ' (sign-off: ' + who + ')' : '') });
  save(db);
  return { ok: true, id, stage };
}
function edit(id, content) {
  const db = load();
  const p = db.pieces.find((x) => x.id === id);
  if (!p) { const e = new Error('Beitrag nicht gefunden'); e.code = 404; throw e; }
  if (p.stage === 'published') { const e = new Error('bereits publiziert — neue Revision anlegen'); e.code = 400; throw e; }
  p.content = String(content || '').slice(0, 50000);
  p.log.push({ at: new Date().toISOString(), event: 'content updated (' + p.content.length + ' Zeichen)' });
  save(db);
  return { ok: true, id, chars: p.content.length };
}
function calendar() {
  const db = load();
  return db.pieces.filter((p) => p.deadline && p.stage !== 'published')
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
    .map((p) => ({ id: p.id, title: p.title, deadline: p.deadline, stage: p.stage }));
}
function list(stage) { const db = load(); return db.pieces.slice().reverse().filter((p) => !stage || p.stage === stage); }
function status() {
  const db = load();
  return { area: '11', mode: 'LIVE', pieces: db.pieces.length, by_stage: STAGES.map((s) => ({ stage: s, n: db.pieces.filter((p) => p.stage === s).length })), signoffs: db.signoffs.length, rule: '4-Augen: approver ≠ autor' };
}

module.exports = {
  meta: { area: '11', id: 'editorial_incubator', name: 'Editorial incubation (pipeline + 4-Augen sign-off)', state: 'live' },
  actions: { status: () => status(), create: (p) => create(p || {}), list: (p) => list((p || {}).stage), stage: (p) => setStage(String((p || {}).id), String((p || {}).stage), (p || {}).approver), edit: (p) => edit(String((p || {}).id), (p || {}).content), calendar: () => calendar() },
  status, create, setStage, edit, calendar, list,
};
