'use strict';
// AURA — Container Console (Area 67): per-module crash isolation dashboard.
module.exports = function containersPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA Module Containers — Crash-Isolation, Circuit Breaker, Quarantäne</title>
<meta name="description" content="AURA Container-Konsole: jedes Live-Modul läuft in einem eigenen Container mit Timeout-Guard, Circuit Breaker und Quarantäne. Ein abstürzendes Modul kann den Server nie mitreißen.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#02040a;color:#d6e4ff;font:13px/1.55 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
h1{font-size:24px;letter-spacing:2px;color:#39d7ff}.sub{color:#7d94ad;font-size:12px;margin:4px 0 16px}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
.live{background:#0d3b2a;color:#5fff9f}.q{background:#3a1414;color:#f87171}.d{background:#3a2f10;color:#ffd75f}
table{width:100%;border-collapse:collapse;font-size:12.5px;background:rgba(9,15,30,.85);border-radius:10px;overflow:hidden}
td,th{padding:7px 10px;border-bottom:1px solid #16304f;text-align:left}th{color:#7d93b8;background:#0c1830}
button{background:#12233f;border:1px solid #2c5a94;color:#9cc4ff;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px}
.policy{background:rgba(9,15,30,.85);border:1px solid #1d3a66;border-radius:10px;padding:12px;font-size:12px;margin-bottom:14px;line-height:1.8}
nav{margin-bottom:12px;font-size:13px}nav a{color:#39d7ff;margin-right:12px;text-decoration:none}
#ledger{font-size:11px;color:#8fa3c8;margin-top:14px;max-height:180px;overflow:auto;background:rgba(5,10,20,.8);border:1px solid #16304f;border-radius:8px;padding:8px}
</style></head><body><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/config">Config</a><a href="/logs">Logs</a><a href="/console">Console</a></nav>
<h1>📦 MODULE CONTAINERS</h1>
<p class="sub">Area 67 · jedes Live-Modul = eigener Container · Timeout-Guard · Circuit Breaker · Quarantäne statt System-Crash <span class="pill live">LIVE</span></p>
<div class="policy" id="policy">lade…</div>
<table><thead><tr><th>Area</th><th>Modul</th><th>Container</th><th>Calls</th><th>Fails</th><th>letzte Latenz</th><th>Quarantänen</th><th>Drill</th></tr></thead><tbody id="tb"></tbody></table>
<div id="ledger"></div>
<script>
const badge=s=>s==='healthy'?'<span class="pill live">HEALTHY</span>':s==='quarantined'?'<span class="pill q">QUARANTINED</span>':s==='probe-due'?'<span class="pill d">PROBE DUE</span>':s==='probe'?'<span class="pill d">PROBE</span>':'<span class="pill q">'+s+'</span>';
async function tick(){
 const d=await (await fetch('/api/containers')).json();
 const p=d.policy;
 document.getElementById('policy').innerHTML='🛡 <b>Isolations-Policy:</b> '+p.isolation+' · bei Crash: <b>'+p.on_crash+'</b> · Recovery: '+p.recovery+
  '<br>Limits: '+p.limits.max_fails+' Fails → Quarantäne · Cooldown '+Math.round(p.limits.cooldown_ms/1000)+'s · Action-Timeout '+Math.round(p.limits.timeout_ms/1000)+'s (änderbar unter <a href="/config" style="color:#f5c96b">/config</a>)';
 document.getElementById('tb').innerHTML=d.containers.map(c=>'<tr><td>#'+c.area+'</td><td>'+c.name+'</td><td>'+badge(c.container)+'</td>'+
  '<td>'+c.calls+'</td><td>'+(c.fails||'0')+'</td><td>'+(c.last_ms?c.last_ms+'ms':'—')+'</td><td>'+(c.quarantines||0)+'</td>'+
  '<td><button onclick="drill(\\''+c.area+'\\')">💥 Crash drillen</button></td></tr>').join('');
 document.getElementById('ledger').innerHTML='<b>Isolations-Ledger:</b><br>'+(d.ledger.length?d.ledger.slice().reverse().map(e=>e.at.slice(11,19)+' ['+e.event+'] '+JSON.stringify(e.detail||{})).join('<br>'):'keine Ereignisse — alle Container gesund');
}
async function drill(area){
 await fetch('/api/containers/drill',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({area})});
 tick();
}
tick();setInterval(tick,3000);
</script></main></body></html>`;
};
