'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
let server, origin;
before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  origin = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Preview startup timeout')), 5000);
    server.on('error', reject);
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
});
after(() => { server?.kill(); });
test('German homepage serves with security headers', async () => {
  const res = await fetch(origin);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'self' https:/);
  const html = await res.text();
  assert.match(html, /lang="de"/);
  assert.match(html, /CreedStreetStudios47/);
});
test('all local images, scripts, styles and favicon resolve', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const assets = [...new Set([...html.matchAll(/(?:src|href)="((?:assets\/|style\.css|app\.js)[^"]*)"/g)].map(m => m[1]))];
  assert.ok(assets.length >= 9);
  for (const asset of assets) assert.equal((await fetch(`${origin}/${asset}`)).status, 200, asset);
});
test('all internal navigation targets exist', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), `Missing target: ${id}`);
});
test('five supplied gallery images are preserved byte-for-byte', async () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert.equal([...html.matchAll(/class="gallery-card reveal"/g)].length, 5);
  for (const name of ['studio-rooms.jpg', 'studio-exterior.jpg', 'studio-control.jpg', 'studio-lounge.webp', 'studio-kitchen.jpg']) {
    const res = await fetch(`${origin}/assets/${name}`);
    assert.equal(res.status, 200);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), fs.readFileSync(path.join(__dirname, 'assets', name)));
  }
});
test('fonts are local and include their license', async () => {
  for (const weight of [400, 500, 600, 700]) assert.equal((await fetch(`${origin}/assets/fonts/space-grotesk-${weight}.woff2`)).status, 200);
  assert.ok(fs.readFileSync(path.join(__dirname, 'assets/fonts/LICENSE.txt'), 'utf8').length > 500);
});
test('server does not expose its source or accept form submissions', async () => {
  assert.equal((await fetch(`${origin}/server.js`)).status, 404);
  assert.equal((await fetch(`${origin}/site.test.cjs`)).status, 404);
  assert.equal((await fetch(`${origin}/.git/config`)).status, 404);
  assert.equal((await fetch(origin, { method: 'POST', body: 'test' })).status, 405);
});
test('HEAD returns asset headers with no response body', async () => {
  const res = await fetch(`${origin}/style.css`, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/css/);
  assert.equal(await res.text(), '');
});
test('reduced-motion and local-only project briefing are explicit', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(js, /keine Anfrage versendet/);
  assert.doesNotMatch(js, /\bfetch\(/);
});
test('all eight pages have unique metadata, one H1, and working local links', async () => {
  const pages = ['index.html', 'studio.html', 'vertrieb.html', 'ueber-uns.html', 'kontakt.html', 'impressum.html', 'datenschutz.html', 'werbung.html'];
  const titles = new Set(), descriptions = new Set();
  for (const page of pages) {
    const res = await fetch(`${origin}/${page}`); assert.equal(res.status, 200, page);
    const html = await res.text();
    assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1, page);
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(title), page); titles.add(title);
    assert.ok(!descriptions.has(description), page); descriptions.add(description);
    assert.match(html, /noindex,follow/);
    assert.equal(JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@type'], 'WebPage');
    for (const [, link] of html.matchAll(/href="([^"#]+\.html)(?:#[^"]*)?"/g)) assert.equal((await fetch(`${origin}/${link}`)).status, 200, `${page} -> ${link}`);
  }
});
test('preview has no active AdSense or remote scripts', async () => {
  const html = await (await fetch(`${origin}/werbung.html`)).text();
  assert.match(html, /aktuell keine Anzeigen geladen/);
  assert.doesNotMatch(html, /<script[^>]*src="https?:/);
  assert.doesNotMatch(html, /ca-pub-\d+/);
  assert.match(await (await fetch(`${origin}/robots.txt`)).text(), /Disallow: \//);
  assert.equal((await fetch(`${origin}/templates/home.html`)).status, 404);
});
test('old beat player, script, audio file and download are completely removed', async () => {
  for (const name of ['index.html', 'studio.html', 'vertrieb.html', 'ueber-uns.html', 'kontakt.html', 'impressum.html', 'datenschutz.html', 'werbung.html']) {
    const html = await (await fetch(`${origin}/${name}`)).text();
    assert.doesNotMatch(html, /<video|beat\.js|NIGHTSHIFT|nightshift|studio-audio|play-button|beat-progress|beat-volume|Beat herunterladen|sound-deck/, name);
  }
  for (const url of ['beat.js', 'assets/audio/nightshift-47.mp3', 'assets/audio/credits.txt', 'render-beat.py']) {
    assert.equal((await fetch(`${origin}/${url}`)).status, 404, url);
    assert.ok(!fs.existsSync(path.join(__dirname, url)), url);
  }
  const res = await fetch(origin);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  assert.match(res.headers.get('content-security-policy'), /media-src 'self'/);
});
test('production SEO build creates canonical URLs and sitemap only for a configured origin', () => {
  const os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs47-seo-'));
  try {
    fs.mkdirSync(path.join(dir, 'templates'));
    fs.copyFileSync(path.join(__dirname, 'build.py'), path.join(dir, 'build.py'));
    fs.copyFileSync(path.join(__dirname, 'templates/home.html'), path.join(dir, 'templates/home.html'));
    const build = spawnSync('python', [path.join(dir, 'build.py')], { env: { ...process.env, PUBLIC_SITE_URL: 'https://label.example' }, encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    const studio = fs.readFileSync(path.join(dir, 'studio.html'), 'utf8');
    assert.match(studio, /rel="canonical" href="https:\/\/label\.example\/studio.html"/);
    assert.match(studio, /index,follow,max-image-preview:large/);
    assert.match(fs.readFileSync(path.join(dir, 'impressum.html'), 'utf8'), /noindex,follow/);
    const sitemap = fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8');
    assert.equal([...sitemap.matchAll(/<loc>/g)].length, 5);
    assert.doesNotMatch(sitemap, /impressum|werbung|datenschutz/);
    assert.match(fs.readFileSync(path.join(dir, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/label\.example\/sitemap.xml/);
    const invalid = spawnSync('python', [path.join(dir, 'build.py')], { env: { ...process.env, PUBLIC_SITE_URL: 'http://invalid.example/path' }, encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('provided Suno profile is a visible safe link, never a hidden embed', async () => {
  const profile = 'https://suno.com/@creedstreetstudios47';
  for (const name of ['index.html', 'studio.html']) {
    const html = await (await fetch(`${origin}/${name}`)).text();
    assert.match(html, /class="suno-artist-link"/);
    assert.ok(html.includes(`href="${profile}" target="_blank" rel="noopener noreferrer"`));
    assert.doesNotMatch(html, /<iframe[^>]*suno|<audio[^>]*src="https:\/\/suno|<link[^>]*preconnect/);
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.ok(schema.about.sameAs.includes(profile));
  }
  assert.match(await (await fetch(`${origin}/public-settings.js`)).text(), /suno: 'https:\/\/suno.com\/@creedstreetstudios47'/);
  assert.match(await (await fetch(`${origin}/datenschutz.html`)).text(), /kein eingebetteter Suno-Stream/);
});

test('only the owner-provided background song is wired in, with a visible sound toggle', async () => {
  for (const page of ['index.html', 'studio.html', 'vertrieb.html', 'ueber-uns.html', 'kontakt.html', 'impressum.html', 'datenschutz.html', 'werbung.html']) {
    const html = await (await fetch(`${origin}/${page}`)).text();
    assert.equal([...html.matchAll(/<audio /g)].length, 1);
    assert.match(html, /id="background-sound" src="assets\/audio\/schwarzes-eisen.mp3"/);
    assert.match(html, /id="sound-toggle"/);
    assert.match(html, /src="sound.js\?v=schwarzes-eisen-1"/);
  }
  const head = await fetch(`${origin}/assets/audio/schwarzes-eisen.mp3`, { method: 'HEAD' });
  assert.equal(head.headers.get('content-type'), 'audio/mpeg');
  assert.equal(Number(head.headers.get('content-length')), 5280978);
  const range = await fetch(`${origin}/assets/audio/schwarzes-eisen.mp3`, { headers: { Range: 'bytes=0-999' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 1000);
  assert.equal((await fetch(`${origin}/assets/audio/schwarzes-eisen.mp3`, { headers: { Range: 'bytes=999999999-' } })).status, 416);
});
