'use strict';
// AURA Area 10 — Content Incubation Engine (LIVE).
// Ideen-Lebenszyklus mit echtem Scoring: intake → scoring → draft → ready.
// Scoring-Heuristik: Klarheit, Spezifik, Neuigkeit (Abgleich mit Bestand).
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'content_incubator.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { ideas: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(db, null, 2)); fs.renameSync(t, FILE); }

const STAGES = ['intake', 'draft', 'ready', 'archived'];

function scoreIdea(idea, existing) {
  const text = (idea.title + ' ' + idea.desc).toLowerCase();
  let clarity = Math.min(30, Math.round((idea.desc.length / 10)));
  let spec = 0;
  if (/\d/.test(idea.desc)) spec += 8;
  if ((idea.tags || []).length >= 2) spec += 7;
  if (idea.desc.split(' ').length >= 12) spec += 5;
  spec = Math.min(25, spec);
  let novelty = 45;
  for (const ex of existing) {
    const words = new Set((ex.title + ' ' + ex.desc).toLowerCase().split(/\W+/).filter((w) => w.length > 4));
    const overlap = text.split(/\W+/).filter((w) => w.length > 4 && words.has(w)).length;
    novelty -= Math.min(15, overlap * 3);
  }
  novelty = Math.max(5, novelty);
  return { clarity, spec, novelty, total: clarity + spec + novelty };
}

function submit(body) {
  const title = String((body || {}).title || '').trim().slice(0, 140);
  const desc = String(body.desc || '').trim().slice(0, 2000);
  if (!title || !desc) { const e = new Error('title + desc fehlen'); e.code = 400; throw e; }
  const db = load();
  const idea = { id: 'idea-' + Date.now().toString(36), title, desc, tags: Array.isArray(body.tags) ? body.tags.slice(0, 8).map((t) => String(t).slice(0, 30)) : [], stage: 'intake', created_at: new Date().toISOString(), history: [{ at: new Date().toISOString(), event: 'submitted' }] };
  idea.score = scoreIdea(idea, db.ideas);
  db.ideas.push(idea); save(db);
  return { ok: true, idea };
}
function advance(id) {
  const db = load();
  const i = db.ideas.find((x) => x.id === id);
  if (!i) { const e = new Error('Idee nicht gefunden'); e.code = 404; throw e; }
  if (i.stage === 'archived') { const e = new Error('archiviert — erst revive'); e.code = 400; throw e; }
  const next = STAGES[STAGES.indexOf(i.stage) + 1];
  i.stage = next === 'archived' ? 'ready' : next;
  i.history.push({ at: new Date().toISOString(), event: 'advanced → ' + i.stage });
  save(db);
  return { ok: true, id, stage: i.stage };
}
function archive(id) {
  const db = load();
  const i = db.ideas.find((x) => x.id === id);
  if (!i) { const e = new Error('Idee nicht gefunden'); e.code = 404; throw e; }
  i.stage = 'archived'; i.history.push({ at: new Date().toISOString(), event: 'archived' }); save(db);
  return { ok: true, id, stage: 'archived' };
}
function list(filter) {
  const db = load();
  let out = db.ideas.slice().reverse();
  if (filter && filter.stage) out = out.filter((i) => i.stage === filter.stage);
  return out;
}
function brief(id) {
  const db = load();
  const i = db.ideas.find((x) => x.id === id);
  if (!i) { const e = new Error('Idee nicht gefunden'); e.code = 404; throw e; }
  return { ok: true, brief: { title: i.title, summary: i.desc, tags: i.tags, score: i.score, stage: i.stage, next: i.stage === 'ready' ? 'bereit für Content Forge (Area 73) oder Studio (Area 76)' : 'weiter inkubieren (advance)' } };
}
function status() {
  const db = load();
  return { area: '10', mode: 'LIVE', ideas: db.ideas.length, by_stage: STAGES.map((s) => ({ stage: s, n: db.ideas.filter((i) => i.stage === s).length })), scoring: 'clarity+spec+novelty (echt berechnet, keine Zufallswerte)' };
}

module.exports = {
  meta: { area: '10', id: 'content_incubator', name: 'Content incubation engine (idea lifecycle + scoring)', state: 'live' },
  actions: { status: () => status(), submit: (p) => submit(p || {}), list: (p) => list(p), advance: (p) => advance(String((p || {}).id)), archive: (p) => archive(String((p || {}).id)), brief: (p) => brief(String((p || {}).id)) },
  status, submit, advance, archive, list, brief,
};
