'use strict';
// WF-20 release-candidate evidence ledger. It records a local decision only;
// it never pushes Git, tags, uploads, publishes or deploys a release.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'release_candidates.json');
const STATES = Object.freeze(['DRAFT', 'READY_FOR_APPROVAL', 'APPROVED_FOR_HANDOFF', 'REJECTED', 'CLOSED']);
function now() { return new Date().toISOString(); }
function clean(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function error(message, code) { const e = new Error(message); e.code = code || 400; return e; }
function load() { try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { schema_version: 1, candidates: Array.isArray(db.candidates) ? db.candidates : [], ...db }; } catch { return { schema_version: 1, candidates: [] }; } }
function save(db) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n'); fs.renameSync(tmp, FILE); }
function eventBody(event) { return { id: event.id, at: event.at, kind: event.kind, actor: event.actor, note: event.note, from: event.from, to: event.to, detail: event.detail, previous_hash: event.previous_hash }; }
function addEvent(candidate, kind, actor, note, from, to, detail) {
  const history = candidate.history || (candidate.history = []); const previous = history.length ? history[history.length - 1].hash : 'GENESIS';
  const event = { id: 'rel_evt_' + crypto.randomBytes(6).toString('hex'), at: now(), kind, actor: clean(actor, 80), note: clean(note, 1200), from: from || null, to: to || null, detail: detail || {}, previous_hash: previous };
  event.hash = crypto.createHash('sha256').update(JSON.stringify(eventBody(event))).digest('hex'); history.push(event); return event;
}
function validSha(value) { return /^[a-f0-9]{64}$/i.test(String(value || '')); }
function create(input) {
  input = input || {}; const commit = clean(input.commit, 64); const owner = clean(input.owner, 80) || 'OWNER_PENDING'; const version = clean(input.version, 80) || ('rc-' + commit.slice(0, 12));
  const test = input.test_evidence || {}; const archive = input.archive || {}; const rollback = clean(input.rollback_plan, 1200);
  if (!/^[a-f0-9]{7,64}$/i.test(commit)) throw error('commit must be a 7–64 character Git SHA');
  if (!Number.isInteger(Number(test.pass)) || Number(test.pass) < 0 || !Number.isInteger(Number(test.fail)) || Number(test.fail) < 0) throw error('test_evidence.pass and test_evidence.fail are required integers');
  if (!validSha(archive.sha256)) throw error('archive.sha256 must be a SHA-256 checksum');
  if (!rollback) throw error('rollback_plan is required');
  const db = load(); if (db.candidates.some((candidate) => candidate.commit === commit && candidate.state !== 'CLOSED')) throw error('an open candidate for this commit already exists', 409);
  const candidate = {
    id: 'rc_' + crypto.randomBytes(6).toString('hex'), commit, version, owner, state: 'DRAFT',
    test_evidence: { pass: Number(test.pass), fail: Number(test.fail), command: clean(test.command, 240), summary: clean(test.summary, 1200) },
    archive: { sha256: String(archive.sha256).toLowerCase(), bytes: Math.max(0, Number(archive.bytes) || 0), url: clean(archive.url, 500), manifest_url: clean(archive.manifest_url, 500) },
    rollback_plan: rollback, known_limits: clean(input.known_limits, 1600), created_at: now(), updated_at: now(), history: [],
  };
  addEvent(candidate, 'CANDIDATE_CREATED', owner, clean(input.note, 1200) || 'Release candidate created as a local evidence record.', null, 'DRAFT', { boundary: 'This record does not tag, push, publish or deploy code.' });
  db.candidates.unshift(candidate); db.candidates = db.candidates.slice(0, 100); save(db); return candidate;
}
function amendEvidence(id, input) {
  input = input || {}; const { db, candidate } = find(id); const actor = clean(input.actor, 80); const note = clean(input.note, 1200);
  if (candidate.state !== 'DRAFT') throw error('evidence may only be amended while the candidate is DRAFT', 409);
  if (!actor || !note) throw error('actor and amendment note are required');
  const commit = clean(input.commit, 64); const test = input.test_evidence || {}; const archive = input.archive || {}; const rollback = clean(input.rollback_plan, 1200);
  if (!/^[a-f0-9]{7,64}$/i.test(commit)) throw error('commit must be a 7–64 character Git SHA');
  if (!Number.isInteger(Number(test.pass)) || Number(test.pass) < 0 || !Number.isInteger(Number(test.fail)) || Number(test.fail) < 0) throw error('test_evidence.pass and test_evidence.fail are required integers');
  if (!validSha(archive.sha256) || !rollback) throw error('archive.sha256 and rollback_plan are required');
  const prior = { commit: candidate.commit, archive_sha256: candidate.archive.sha256, validation: candidate.test_evidence };
  candidate.commit = commit; candidate.version = clean(input.version, 80) || candidate.version;
  candidate.test_evidence = { pass: Number(test.pass), fail: Number(test.fail), command: clean(test.command, 240), summary: clean(test.summary, 1200) };
  candidate.archive = { sha256: String(archive.sha256).toLowerCase(), bytes: Math.max(0, Number(archive.bytes) || 0), url: clean(archive.url, 500), manifest_url: clean(archive.manifest_url, 500) };
  candidate.rollback_plan = rollback; candidate.known_limits = clean(input.known_limits, 1600); candidate.updated_at = now();
  addEvent(candidate, 'EVIDENCE_AMENDED', actor, note, 'DRAFT', 'DRAFT', { prior, corrected: { commit: candidate.commit, archive_sha256: candidate.archive.sha256, validation: candidate.test_evidence }, boundary: 'Evidence correction only; no tag, push, publication or deployment occurred.' });
  save(db); return candidate;
}
function find(id) { const db = load(); const candidate = db.candidates.find((item) => item.id === clean(id, 100)); if (!candidate) throw error('release candidate not found', 404); return { db, candidate }; }
function transition(id, target, input) {
  input = input || {}; const { db, candidate } = find(id); const actor = clean(input.actor, 80); const note = clean(input.note, 1200);
  if (!actor || !note) throw error('actor and release note are required');
  const allowed = { DRAFT: ['READY_FOR_APPROVAL', 'CLOSED'], READY_FOR_APPROVAL: ['APPROVED_FOR_HANDOFF', 'REJECTED', 'DRAFT', 'CLOSED'], APPROVED_FOR_HANDOFF: ['CLOSED'], REJECTED: ['DRAFT', 'CLOSED'], CLOSED: [] };
  if (!(allowed[candidate.state] || []).includes(target)) throw error('transition ' + candidate.state + ' → ' + target + ' is not permitted', 409);
  if (target === 'READY_FOR_APPROVAL' && candidate.owner === 'OWNER_PENDING') throw error('assign a named release owner before review', 409);
  if (target === 'READY_FOR_APPROVAL' && candidate.test_evidence.fail !== 0) throw error('release candidate with failing validation cannot enter approval', 409);
  if (target === 'APPROVED_FOR_HANDOFF') {
    if (input.confirm !== 'APPROVE_RELEASE_CANDIDATE') throw error('approval requires confirm: APPROVE_RELEASE_CANDIDATE');
    if (actor === candidate.owner) throw error('four-eyes rule: release owner and approver must differ', 409);
    if (!clean(input.rollback_acknowledgement, 1000)) throw error('rollback_acknowledgement is required for approval');
  }
  const from = candidate.state; candidate.state = target; candidate.updated_at = now();
  addEvent(candidate, target === 'APPROVED_FOR_HANDOFF' ? 'FOUR_EYES_APPROVAL_RECORDED' : 'STATE_CHANGED', actor, note, from, target, { rollback_acknowledgement: clean(input.rollback_acknowledgement, 1000) || null, boundary: target === 'APPROVED_FOR_HANDOFF' ? 'Approval for operator handoff only. No tag, push, publish or deployment happened.' : 'Local release record transition only.' });
  save(db); return candidate;
}
function claimOwner(id, input) {
  input = input || {}; const { db, candidate } = find(id); const actor = clean(input.actor, 80); const note = clean(input.note, 1200);
  if (!actor || !note) throw error('actor and owner-assignment note are required');
  if (!['DRAFT', 'REJECTED'].includes(candidate.state)) throw error('owner can only be assigned before approval review', 409);
  const previousOwner = candidate.owner; candidate.owner = actor; candidate.updated_at = now();
  addEvent(candidate, 'OWNER_ASSIGNED', actor, note, candidate.state, candidate.state, { previous_owner: previousOwner, owner: actor }); save(db); return candidate;
}
function report(id) {
  const { candidate } = find(id); let previous = 'GENESIS'; let valid = true;
  for (const event of candidate.history || []) { const expected = crypto.createHash('sha256').update(JSON.stringify(eventBody(event))).digest('hex'); if (event.previous_hash !== previous || event.hash !== expected) { valid = false; break; } previous = event.hash; }
  return { candidate, audit: { valid, events: (candidate.history || []).length, head_hash: previous, note: 'Local release evidence chain only; not a legal signature or remote release confirmation.' }, release_boundary: 'AURA has not pushed, tagged, published or deployed this candidate.' };
}
function list() { const db = load(); return { mode: 'LOCAL_RELEASE_EVIDENCE_ONLY', states: STATES, candidates: db.candidates.map((candidate) => ({ id: candidate.id, commit: candidate.commit, version: candidate.version, owner: candidate.owner, state: candidate.state, validation: candidate.test_evidence, archive_sha256: candidate.archive.sha256, updated_at: candidate.updated_at })) }; }
module.exports = { create, amendEvidence, transition, claimOwner, report, list, STATES, file: FILE };
