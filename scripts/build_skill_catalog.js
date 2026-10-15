#!/usr/bin/env node
'use strict';
// AURA · Skill-Katalog-Generator.
// Liest lokale Klone offizieller Skill-Quellen und schreibt NUR Metadaten
// (Name, Kurzbeschreibung, Lizenz, Link) nach backend/data/skill_catalog.json.
// Es wird kein SKILL.md-Inhalt kopiert, nichts installiert, nichts ausgeführt.
//
// Aufruf:  node scripts/build_skill_catalog.js <hermes-clone> <anthropic-skills-clone>
//   hermes-clone:  https://github.com/NousResearch/hermes-agent (MIT)
//   anthropic:     https://github.com/anthropics/skills (je Skill eigene Lizenz)
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'backend', 'data', 'skill_catalog.json');

// Harte Sperre: widerspricht den AURA-Regeln (Umgehung, Zahlung, Trading, OSINT, Mining).
// Kategorie „payments“ ist immer gesperrt (Agenten-Zahlungen ohne Freigabe).
const BLOCKED_CATEGORIES = ['payments'];
const BLOCKED = /bypass|captcha|stealth|mining|miner|checkout|trading|hyperliquid|osint|credential|botnet|ddos|follower|sockpuppet|ban[- ]?evasion|fake[- ]?(view|like)/i;
// Prüfen vor Nutzung: Krypto/Wallet, Glücksspiel, Erwachsenen-Inhalte, Veröffentlichung (Compliance / Admin-Freigabe nötig).
const REVIEW = /wallet|crypto|blockchain|solana|\bevm\b|gambl|casino|betting|adult|nsfw|publish|deploy|stocks?\b/i;

const sources = (hermesDir, anthDir) => [
  { id: 'nous_builtin', name: 'Hermes · eingebaut', license: 'MIT', dir: path.join(hermesDir, 'skills'), base: 'https://github.com/NousResearch/hermes-agent/tree/main/skills' },
  { id: 'nous_optional', name: 'Hermes · optional', license: 'MIT', dir: path.join(hermesDir, 'optional-skills'), base: 'https://github.com/NousResearch/hermes-agent/tree/main/optional-skills' },
  { id: 'anthropic', name: 'Anthropic · Skills', license: 'je Skill (siehe Link)', dir: path.join(anthDir, 'skills'), base: 'https://github.com/anthropics/skills/tree/main/skills' },
];

// Minimal-Parser für den YAML-Frontmatter-Block: nur name, description, license.
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const key of ['name', 'description', 'license']) {
    const r = m[1].match(new RegExp('^' + key + ':\\s*(.*)$', 'm'));
    if (r) out[key] = r[1].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name === 'SKILL.md') acc.push(p);
  }
  return acc;
}

function classify(name, desc, category = '') {
  const text = `${name} ${desc}`;
  if (BLOCKED_CATEGORIES.includes(category)) return { status: 'gesperrt', reason: 'Zahlungs-Kategorie: nicht ohne Freigabe' };
  if (BLOCKED.test(text)) return { status: 'gesperrt', reason: 'widerspricht den AURA-Regeln' };
  if (REVIEW.test(text)) return { status: 'pruefen', reason: 'Compliance-Prüfung nötig' };
  return { status: 'verfuegbar', reason: '' };
}

function build(hermesDir, anthDir) {
  const srcs = sources(hermesDir, anthDir);
  const skills = [];
  for (const src of srcs) {
    for (const file of walk(src.dir)) {
      const rel = path.relative(src.dir, path.dirname(file)).split(path.sep).join('/');
      const fm = frontmatter(fs.readFileSync(file, 'utf8'));
      const name = fm.name || path.basename(path.dirname(file));
      const desc = (fm.description || '').slice(0, 220);
      const category = rel.includes('/') ? rel.split('/')[0] : (rel || 'allgemein');
      const cls = classify(name, desc, category);
      const license = src.id === 'anthropic' ? (fm.license || 'unbekannt') : src.license;
      skills.push({
        id: `${src.id}/${rel}`,
        source: src.id,
        category,
        name,
        description: desc,
        license,
        link: `${src.base}/${rel}`,
        status: cls.status,
        reason: cls.reason,
        installed: false, // nie automatisch installiert
      });
    }
  }
  skills.sort((a, b) => a.id.localeCompare(b.id));
  const counts = skills.reduce((c, s) => ((c[s.status] = (c[s.status] || 0) + 1), c), {});
  return {
    generated_at: new Date().toISOString(),
    note: 'Nur Metadaten. Installiert wird nichts automatisch. Gesperrte Einträge bleiben sichtbar, werden aber nie ausgeführt.',
    sources: srcs.map(({ id, name, license, base }) => ({ id, name, license, base })),
    counts,
    skills,
  };
}

if (require.main === module) {
  const [hermesDir, anthDir] = process.argv.slice(2);
  if (!hermesDir || !anthDir) {
    console.error('Aufruf: node scripts/build_skill_catalog.js <hermes-clone> <anthropic-skills-clone>');
    process.exit(2);
  }
  const cat = build(hermesDir, anthDir);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(cat, null, 2) + '\n');
  console.log(`geschrieben: ${OUT} · ${cat.skills.length} Einträge · ${JSON.stringify(cat.counts)}`);
}

module.exports = { build, classify, frontmatter, BLOCKED, REVIEW };
