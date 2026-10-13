'use strict';
// AURA — Live Backend Console page (previously inline in server.js).
const registry = require('../src/lib/registry');
const { esc } = require('../src/lib/types_catalog');


function consolePageHtml() {
  const rows = registry.status().map((m) => {
    const cls = m.mode === 'live' ? 'live' : m.mode === 'restricted' ? 'restricted' : m.mode === 'review' ? 'review' : 'pending';
    return `<tr><td>${m.area}</td><td>${esc(m.name)}</td><td><span class="pill ${cls}">${m.mode.toUpperCase()}</span></td>
      <td>${m.actions.length ? m.actions.map((a) => `<code>${a}</code>`).join(' ') : '—'}</td>
      <td>${esc(m.note || '')}</td></tr>`;
  }).join('\n');
  const c = registry.counts();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — Live Console</title>
<style>
 body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#07090f;color:#e8ecf5}
 .wrap{max-width:1100px;margin:0 auto;padding:36px 20px}
 h1{font-size:24px;margin:0 0 4px;background:linear-gradient(90deg,#f5c96b,#8ab4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:#93a0b8;margin:0 0 20px}
 .kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
 .kpi{background:#101624;border:1px solid #23304a;border-radius:10px;padding:12px 18px;min-width:110px}
 .kpi b{display:block;font-size:24px}.kpi span{color:#93a0b8;font-size:12px}
 table{width:100%;border-collapse:collapse;font-size:13px;background:#0c111d;border:1px solid #23304a;border-radius:12px;overflow:hidden}
 th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #1a2438;vertical-align:top}
 th{background:#101624;color:#93a0b8;font-weight:600}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11.5px;color:#8ab4ff}
 .pill{border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700}
 .live{background:#12351f;color:#4ade80}.pending{background:#3a2f10;color:#f5c96b}
 .review{background:#2a1a3a;color:#c084fc}.restricted{background:#3a1414;color:#f87171}
 .skill{background:#0e2c3a;color:#39d7ff}
 a{color:#8ab4ff}
</style></head><body><div class="wrap">
<h1>AURA — Live Backend Console</h1>
<p class="sub">Real module registry state · <a href="/api/modules/live">JSON API</a> · <a href="/downloads">Downloads</a> · <a href="/index.html">Command Center UI</a></p>
<div class="kpis">
 <div class="kpi"><b>${c.total}</b><span>areas total</span></div>
 <div class="kpi"><b>${c.live}</b><span>live modules</span></div>
 <div class="kpi"><b>${c.placeholder}</b><span>placeholders</span></div>
 <div class="kpi"><b>${c.review}</b><span>needs redesign</span></div>
 <div class="kpi"><b>${c.restricted}</b><span>restricted</span></div>
 <div class="kpi"><b>${c.skills}</b><span>skills wired</span></div>
</div>
<table><thead><tr><th>#</th><th>Module</th><th>Mode</th><th>Actions (POST /api/modules/&lt;area&gt;/action/&lt;name&gt;)</th><th>Note</th></tr></thead>
<tbody>
${rows}
</tbody></table>
<p class="sub">Restricted modules (32, 33, 36) refuse every call with 403 — policy block, not a missing implementation.</p>
</div></body></html>`;
}
module.exports = consolePageHtml;
