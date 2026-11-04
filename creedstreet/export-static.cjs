'use strict';
// Publish only the public website, never AURA backend, tools or cloud downloads.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const output = path.join(root, 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const files = [
  'index.html', 'studio.html', 'vertrieb.html', 'ueber-uns.html', 'kontakt.html',
  'impressum.html', 'datenschutz.html', 'werbung.html', 'style.css', 'app.js',
  'connect.js', 'sound.js', 'public-settings.js', 'robots.txt'
];
if (fs.existsSync(path.join(root, 'sitemap.xml'))) files.push('sitemap.xml');
for (const name of files) fs.copyFileSync(path.join(root, name), path.join(output, name));
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
console.log(`Exported ${files.length} website files + assets to dist/.`);
