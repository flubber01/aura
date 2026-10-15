'use strict';
// AURA · Skill-Katalog (nur lesen). Daten: backend/data/skill_catalog.json,
// erzeugt von scripts/build_skill_catalog.js. Installiert und führt nichts aus.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'data', 'skill_catalog.json');

function load() {
  if (!fs.existsSync(FILE)) return { generated_at: null, counts: {}, sources: [], skills: [], note: 'Katalog nicht gebaut: node scripts/build_skill_catalog.js <hermes> <anthropic>' };
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

// Filter: q (Name/Beschreibung), source, status, category. Begrenzt auf limit Treffer.
function search({ q = '', source = '', status = '', category = '', limit = 100 } = {}) {
  const cat = load();
  const needle = String(q).toLowerCase().trim();
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const hits = cat.skills.filter((s) =>
    (!source || s.source === source) &&
    (!status || s.status === status) &&
    (!category || s.category === category) &&
    (!needle || `${s.name} ${s.description} ${s.category}`.toLowerCase().includes(needle)));
  return { total: hits.length, counts: cat.counts, generated_at: cat.generated_at, sources: cat.sources, note: cat.note, skills: hits.slice(0, lim) };
}

module.exports = { load, search, FILE };
