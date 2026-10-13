'use strict';
// AURA — Gelbe-Seiten-Hilfe für Agenten.
// Wenn ein Agent nicht weiterkommt, sucht er in den kuratierten Gelben Seiten
// nach passenden Links (Name, Kategorie, Beschreibung). Rein lesend:
// AURA ruft keine Links auf, lädt nichts herunter und führt nichts aus.
// Der Mensch entscheidet, ob ein Vorschlag genutzt wird.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'data', 'yellowpages.json');
const STOP = new Set(['der', 'die', 'das', 'und', 'oder', 'mit', 'für', 'fuer', 'ein', 'eine', 'the', 'and', 'or', 'for', 'to', 'of', 'a', 'in', 'is', 'ich', 'mir', 'bitte', 'kann', 'nicht', 'nur']);

function tokens(s) {
  return String(s || '').toLowerCase()
    .split(/[^a-z0-9äöüß.+-]+/i)
    .map((t) => t.replace(/^[.+-]+|[.+-]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(d.links) ? d.links : [];
  } catch { return []; }
}

// Liefert bis zu `limit` Treffer, absteigend nach Trefferzahl. Leere Suche → [].
function find(query, limit = 5) {
  const q = tokens(query);
  if (!q.length) return [];
  const n = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const scored = [];
  for (const l of load()) {
    const name = String(l.name || '').toLowerCase();
    const cat = String(l.category || '').toLowerCase();
    const desc = String(l.desc || '').toLowerCase();
    let score = 0;
    for (const t of q) {
      if (name.includes(t)) score += 3;
      if (cat.includes(t)) score += 2;
      if (desc.includes(t)) score += 1;
    }
    if (score > 0) scored.push({ score, name: l.name, url: l.url, category: l.category, desc: l.desc });
  }
  scored.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
  return scored.slice(0, n).map(({ score, ...rest }) => ({ ...rest, score }));
}

module.exports = {
  find,
  tokens,
  meta: { area: 'YP', id: 'yp_help', name: 'Gelbe-Seiten-Hilfe für Agenten (lesend)', state: 'live' },
};
