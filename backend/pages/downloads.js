'use strict';
// AURA — Downloads page (previously inline in server.js).
const { ARTIFACTS } = require('../src/lib/types_catalog');


function downloadPageHtml() {
  const rows = Object.keys(ARTIFACTS)
    .map(
      (n) => `<a class="dl" href="/api/download/${n}" download>
        <span class="name">${n}</span>
        <span class="hint">complete catalog · state types · categories · all 40 modules</span>
        <span class="btn">⇩ Download</span></a>`
    )
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA — Downloads</title>
<style>
 body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#07090f;color:#e8ecf5;min-height:100vh}
 .wrap{max-width:760px;margin:0 auto;padding:48px 20px}
 h1{font-size:26px;margin:0 0 6px;background:linear-gradient(90deg,#f5c96b,#8ab4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
 p.sub{color:#93a0b8;margin:0 0 28px}
 .dl{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;background:#101624;border:1px solid #23304a;border-radius:12px;padding:16px 18px;margin-bottom:12px;transition:.15s}
 .dl:hover{border-color:#f5c96b;transform:translateY(-1px)}
 .name{font-weight:600;min-width:220px}
 .hint{color:#93a0b8;font-size:13px;flex:1}
 .btn{background:#f5c96b;color:#0a0c12;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;white-space:nowrap}
 a.back{color:#8ab4ff;font-size:13px;text-decoration:none}
</style></head><body><div class="wrap">
<h1>AURA — Downloadable catalogs</h1>
<p class="sub">All types we covered: module state types, integration status types, all 12 integrations grouped by category, and all 40 functional areas. Direct links — safe to retry, no in-page download required.</p>
${rows}
<p><a class="back" href="/index.html">← Back to the AURA Command Center</a> · <a class="back" href="/api/types">Raw JSON API</a></p>
</div></body></html>`;
}
module.exports = downloadPageHtml;
