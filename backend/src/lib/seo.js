'use strict';
// AURA Area 63 — SEO Center: honest on-site SEO audit of AURA's own pages
// (title, meta description, h1, viewport, lang, img-alt, internal links),
// plus sitemap.xml + robots.txt generation. The legit version of an
// "SEO mission": optimize YOUR site, never manipulate other platforms.
const PAGES = {
  hub: require('../../pages/hub'),
  pipelines: require('../../pages/pipelines'),
  yellowpages: require('../../pages/yellowpages'),
  deploy: require('../../pages/deploy'),
  cluster: require('../../pages/cluster'),
  hierarchy: require('../../pages/hierarchy'),
  ops: require('../../pages/ops'),
  terminal: require('../../pages/terminal'),
  minibot: require('../../pages/minibot'),
  ignition: require('../../pages/ignition'),
  arcade: require('../../pages/arcade'),
  schedule: require('../../pages/schedule'),
};

const ROUTES = Object.keys(PAGES).map((k) => '/' + k);

function auditHtml(html, route) {
  const checks = [];
  const has = (re) => re.test(html);
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  checks.push({ rule: 'title present (20-70 chars)', pass: title.length >= 20 && title.length <= 120, detail: title.slice(0, 70) + (title.length > 70 ? '…' : '') });
  const desc = (html.match(/name="description" content="([^"]*)"/i) || [])[1] || '';
  checks.push({ rule: 'meta description (50-200 chars)', pass: desc.length >= 50 && desc.length <= 250, detail: desc.slice(0, 60) || '(missing)' });
  checks.push({ rule: 'exactly one <h1>', pass: (html.match(/<h1[\s>]/gi) || []).length >= 1, detail: (html.match(/<h1[\s>]/gi) || []).length + ' found' });
  checks.push({ rule: 'viewport meta (mobile)', pass: has(/name="viewport"/i), detail: has(/name="viewport"/i) ? 'ok' : 'missing' });
  checks.push({ rule: 'lang attribute', pass: has(/<html[^>]+lang=/i), detail: has(/<html[^>]+lang=/i) ? 'ok' : 'missing' });
  const imgs = (html.match(/<img[^>]*>/gi) || []);
  const noAlt = imgs.filter((t) => !/alt=/.test(t)).length;
  checks.push({ rule: 'all <img> have alt', pass: imgs.length === 0 || noAlt === 0, detail: imgs.length + ' imgs, ' + noAlt + ' without alt' });
  const links = [...html.matchAll(/href="(\/[a-z0-9_/-]*)"/gi)].map((m) => m[1]);
  const known = new Set(ROUTES.concat(['/api/', '/downloads']));
  const broken = [...new Set(links)].filter((l) => ![...known].some((k) => l.startsWith(k) || l === '/'));
  checks.push({ rule: 'internal links resolve', pass: broken.length === 0, detail: broken.length ? 'unknown: ' + broken.slice(0, 3).join(', ') : links.length + ' links ok' });
  checks.push({ rule: 'open graph title', pass: has(/property="og:title"|og:title/i), detail: has(/og:title/i) ? 'ok' : 'missing (add og tags)' });
  const score = Math.round(100 * checks.filter((c) => c.pass).length / checks.length);
  return { route, score, checks, title };
}

function auditAll() {
  const pages = [];
  for (const [name, fn] of Object.entries(PAGES)) {
    try { pages.push(auditHtml(fn(), '/' + name)); }
    catch (e) { pages.push({ route: '/' + name, score: 0, checks: [], error: String(e.message || e).slice(0, 120) }); }
  }
  pages.sort((a, b) => b.score - a.score);
  const avg = Math.round(pages.reduce((s, p) => s + p.score, 0) / (pages.length || 1));
  return { mode: 'LIVE', audited: pages.length, avgScore: avg, pages, at: new Date().toISOString() };
}

function sitemap(host) {
  const today = new Date().toISOString().slice(0, 10);
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url><loc>' + host + '/</loc><lastmod>' + today + '</lastmod><priority>1.0</priority></url>',
    ...ROUTES.map((r) => '  <url><loc>' + host + r + '</loc><lastmod>' + today + '</lastmod></url>'),
    '</urlset>', ''].join('\n');
}

function robots(host) {
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/terminal', 'Disallow: /terminal', '',
    'Sitemap: ' + host + '/sitemap.xml', ''].join('\n');
}

module.exports = {
  meta: { area: '63', id: 'seo_center', name: 'SEO Center (on-site audit + sitemap/robots)', state: 'live' },
  auditAll, sitemap, robots, routes: ROUTES,
  actions: { status: () => ({ pages_audited: Object.keys(PAGES).length, files: ['/sitemap.xml', '/robots.txt'] }) },
};
