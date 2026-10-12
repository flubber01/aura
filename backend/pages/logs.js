'use strict';
// AURA — Log & Self-Repair Console (Area 66): live JSONL tail + repair ledger.
module.exports = function logsPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA Logs & Self-Repair — massive structured logs, live tail, auto-heal</title>
<meta name="description" content="AURA Log-Konsole: strukturierte JSONL-Logs mit Rotation, Live-Tail, Fehler-Sturm-Erkennung und Self-Repair-Daemon mit Repair-Ledger. Alles echt gemessen, LIVE gelabelt.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#020408;color:#c9e6ff;font:13px/1.5 ui-monospace,Consolas,monospace;min-height:100vh}
main{max-width:1300px;margin:0 auto;padding:20px 16px}
h1{font-size:22px;letter-spacing:3px;color:#39d7ff;font-family:system-ui}
.sub{color:#6f86ac;font-size:12px;margin:2px 0 14px}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#0d3b2a;color:#5fff9f}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center}
.bar button{background:#0c1830;color:#9cc4ff;border:1px solid #24466f;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit}
.bar button.on{background:#1b4fd8;color:#fff;border-color:#39d7ff}
.kpis{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.k{background:rgba(9,15,30,.9);border:1px solid #1d3a66;border-radius:10px;padding:8px 14px;text-align:center;min-width:90px}
.k b{display:block;font-size:18px;color:#7fffd0}.k span{font-size:10px;color:#6f86ac;letter-spacing:1px}
#out{background:#050a14;border:1px solid #16304f;border-radius:10px;padding:10px;height:520px;overflow-y:auto;font-size:12px}
.ln{padding:1px 4px;border-bottom:1px solid #0a1424;white-space:pre-wrap;word-break:break-word}
.INFO{color:#8fb7e8}.WARN{color:#ffd75f}.ERROR{color:#ff7d7d;font-weight:700}
.ts{color:#44587a}.ar{color:#c084fc}.ev{color:#7fffd0}
#rep{background:rgba(9,15,30,.9);border:1px solid #1d3a66;border-radius:10px;padding:12px;margin-top:12px}
#rep h2{font-size:12px;letter-spacing:2px;color:#f5c96b;margin-bottom:8px;font-family:system-ui}
table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:4px 8px;border-bottom:1px solid #14243d;text-align:left}th{color:#6f86ac}
.ok{color:#5fff9f}.no{color:#ff7d7d}
nav{margin-bottom:12px;font-size:12px}nav a{color:#39d7ff;margin-right:12px;text-decoration:none;font-family:system-ui}
</style></head><body><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/ops">OPS</a><a href="/console">Console</a><a href="/api/selfrepair">selfrepair.json</a></nav>
<h1>LOGS & SELF-REPAIR</h1>
<p class="sub">Area 66 · JSONL strukturiert · Rotation ab 2 MB (Keep 3) · Health-Checks alle 20s · Auto-Heal aus verifizierten Backups <span class="pill">LIVE</span></p>
<div class="kpis" id="kpis"></div>
<div class="bar">
 <button class="on" data-l="">ALLE</button><button data-l="INFO">INFO</button><button data-l="WARN">WARN</button><button data-l="ERROR">ERROR</button>
 <span style="flex:1"></span><button onclick="runNow()">▶ CHECK JETZT</button><button onclick="drill()">🧪 FEHLER-DRILL</button><span id="autonote" style="color:#6f86ac">auto-refresh 2s</span>
</div>
<div id="out"></div>
<div id="rep"></div>
<script>
let L='';
document.querySelectorAll('.bar button[data-l]').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.bar button[data-l]').forEach(x=>x.classList.remove('on'));b.classList.add('on');L=b.dataset.l;tick();});
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
async function tick(){
 try{
 const r=await(await fetch('/api/logs?n=250'+(L?'&level='+L:''))).json();
 document.getElementById('out').innerHTML=r.lines.map(e=>'<div class="ln '+e.level+'"><span class="ts">'+e.ts.slice(11,19)+'</span> <b>'+e.level+'</b> <span class="ar">['+esc(e.area)+']</span> <span class="ev">'+esc(e.event)+'</span>'+(e.detail?' '+esc(JSON.stringify(e.detail)):'')+'</div>').reverse().join('');
 const s=await(await fetch('/api/selfrepair')).json();const c=s.counters;
 document.getElementById('kpis').innerHTML=
  '<div class="k"><b>'+c.checks+'</b><span>CHECKS</span></div>'+
  '<div class="k"><b>'+c.problems+'</b><span>PROBLEME</span></div>'+
  '<div class="k"><b>'+c.repaired+'</b><span>REPARIERT</span></div>'+
  '<div class="k"><b>'+c.failed+'</b><span>FEHLGESCHLAGEN</span></div>'+
  '<div class="k"><b>'+c.rotations+'</b><span>LOG-ROTATIONEN</span></div>'+
  '<div class="k"><b>'+(s.meta.log_files||[]).length+'</b><span>LOG-DATEIEN</span></div>';
 document.getElementById('rep').innerHTML='<h2>REPAIR LEDGER (letzte Aktionen)</h2><table><tr><th>Zeit</th><th>Aktion</th><th>OK</th><th>Info</th></tr>'+
  (s.repairs.length?s.repairs.slice().reverse().map(r=>'<tr><td>'+r.at.slice(11,19)+'</td><td>'+r.action+'</td><td class="'+(r.ok?'ok':'no')+'">'+(r.ok?'✔':'✘')+'</td><td>'+esc(JSON.stringify(r.info))+'</td></tr>').join(''):'<tr><td colspan="4">noch keine Reparaturen nötig — System gesund</td></tr>')+'</table>'+
  (s.lastReport?'<p style="color:#6f86ac;margin-top:8px">Letzter Check: '+s.lastReport.at+' · '+s.lastReport.took_ms+'ms · Pages '+s.lastReport.pages_ok+' · Errors 5min: '+s.lastReport.logs.errors_last_5min+' · Disk frei: '+(s.lastReport.resources.disk_free_mb??'?')+' MB</p>':'');
 }catch(e){document.getElementById('autonote').textContent='fetch error: '+e.message}
}
async function runNow(){await fetch('/api/selfrepair/run',{method:'POST'});tick()}
async function drill(){await fetch('/api/selfrepair/drill',{method:'POST'});tick()}
tick();setInterval(tick,2000);
</script></main></body></html>`;
};
