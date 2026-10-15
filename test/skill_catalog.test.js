'use strict';
// Tests: Einstufung der Skills, Frontmatter-Parser, Form des Katalogs (nur Metadaten).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { classify, frontmatter } = require('../scripts/build_skill_catalog.js');
const catalog = require('../backend/src/lib/skill_catalog');

test('Zahlungs-Kategorie ist immer gesperrt', () => {
  assert.strictEqual(classify('stripe-projects', 'Provision SaaS', 'payments').status, 'gesperrt');
});

test('Cloudflare-Umgehung und Stealth sind gesperrt', () => {
  assert.strictEqual(classify('scrapling', 'Scrape sites with stealth browsing and Cloudflare bypass.', 'research').status, 'gesperrt');
});

test('Trading und OSINT sind gesperrt', () => {
  assert.strictEqual(classify('hyperliquid', 'Hyperliquid market data', 'blockchain').status, 'gesperrt');
  assert.strictEqual(classify('osint-investigation', 'Public-records OSINT', 'research').status, 'gesperrt');
});

test('Krypto und Veröffentlichung gehen nur über Prüfung', () => {
  assert.strictEqual(classify('solana', 'Query Solana wallets', 'blockchain').status, 'pruefen');
  assert.strictEqual(classify('publish-site', 'Versioned site deploys', 'web-development').status, 'pruefen');
});

test('Designsysteme, die „Stripe“ nur als Name nennen, sind nicht gesperrt', () => {
  assert.strictEqual(classify('popular-web-designs', '54 real design systems (Stripe, Linear, Vercel)', 'creative').status, 'verfuegbar');
});

test('Frontmatter: name, description, license', () => {
  const fm = frontmatter('---\nname: docx\ndescription: "Word docs."\nlicense: Proprietary. LICENSE.txt\n---\n# body');
  assert.strictEqual(fm.name, 'docx');
  assert.strictEqual(fm.description, 'Word docs.');
  assert.match(fm.license, /Proprietary/);
});

test('Katalog speichert nur Metadaten, keinen Skill-Text, und nichts ist installiert', () => {
  const cat = catalog.load();
  assert.ok(cat.skills.length > 0, 'Katalog ist leer, bitte scripts/build_skill_catalog.js laufen lassen');
  const allowed = new Set(['id', 'source', 'category', 'name', 'description', 'license', 'link', 'status', 'reason', 'installed']);
  for (const s of cat.skills) {
    for (const k of Object.keys(s)) assert.ok(allowed.has(k), `unerlaubtes Feld ${k} in ${s.id}`);
    assert.strictEqual(s.installed, false);
    assert.ok(s.description.length <= 220);
  }
});

test('Suche filtert nach Status und Quelle', () => {
  const r = catalog.search({ status: 'gesperrt', limit: 500 });
  assert.ok(r.skills.every((s) => s.status === 'gesperrt'));
  const a = catalog.search({ source: 'anthropic', limit: 500 });
  assert.ok(a.skills.every((s) => s.source === 'anthropic'));
  assert.ok(path.basename(catalog.FILE) === 'skill_catalog.json');
});
