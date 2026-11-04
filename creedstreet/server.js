'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.mp3': 'audio/mpeg' };
const publicFiles = new Set(['index.html', 'studio.html', 'vertrieb.html', 'ueber-uns.html', 'kontakt.html', 'impressum.html', 'datenschutz.html', 'werbung.html', 'style.css', 'app.js', 'sound.js', 'connect.js', 'public-settings.js', 'robots.txt', 'sitemap.xml']);
const security = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-cache',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self' https:",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end('Method not allowed'); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://preview').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file);
  const ext = path.extname(file);
  const asset = (relative.startsWith('assets' + path.sep) && ['.svg', '.png', '.jpg', '.webp', '.woff2', '.txt'].includes(ext)) || relative === path.join('assets', 'audio', 'schwarzes-eisen.mp3');
  if (!file.startsWith(root + path.sep) || !types[ext] || (!asset && !publicFiles.has(relative))) { res.writeHead(404); return res.end('Not found'); }
  const headers = { ...security, 'Content-Type': types[ext] };
  // Range responses support efficient loading and restoring the background track.
  if (ext === '.mp3') {
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
      let start = 0, end = stat.size - 1, partial = false;
      if (req.headers.range && req.method !== 'HEAD') {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
        if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
        else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), stat.size - 1); }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
        partial = true;
      }
      headers['Accept-Ranges'] = 'bytes'; headers['Content-Length'] = end - start + 1;
      if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      res.writeHead(partial ? 206 : 200, headers);
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(file, { start, end });
      stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
    });
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { ...headers, 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`CreedStreetStudios47 website on port ${server.address().port}`));
