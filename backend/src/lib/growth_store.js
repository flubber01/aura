'use strict';
// AURA Phase 2 — shared runtime store for the growth modules (WF-18, Traffic Mesh,
// WF-19, Unified Analytics). Runtime data only: backend/src/data/growth.json is
// git-ignored. Corrupt file → empty state (never crashes the server).
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'growth.json');
const EMPTY = { repurpose: [], releases: [], analytics_rows: [] };

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...EMPTY, ...d };
  } catch {
    return JSON.parse(JSON.stringify(EMPTY));
  }
}

function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE); // atomic replace
}

module.exports = { load, save, FILE };
