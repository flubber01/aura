'use strict';
const nav = require('../src/lib/nav');
// OPS Control Palette: kill switch, backup schedule, telegram control, mail.
module.exports = function opsPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · OPS Control</title>
<style>
body{margin:0;background:#0a0508;color:#ffe8ec;font-family:ui-monospace,Menlo,Consolas,monospace}
header{padding:20px;text-align:center}h1{margin:0;font-size:20px;letter-spacing:3px;color:#f87171}
.sub{color:#a78b8b;font-size:12px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:#f87171;text-decoration:none;font-size:11px;background:#180a0d;border:1px solid #5e2330;border-radius:8px;padding:5px 10px}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px 60px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
.panel{background:rgba(24,10,13,.7);border:1px solid #5e2330;border-radius:12px;padding:14px}
.panel h3{margin:0 0 10px;font-size:11px;letter-spacing:2px;color:#fda4af}
button{background:#5e2330;color:#ffe8ec;border:1px solid #93374a;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
button.red{background:#7f1d1d;border-color:#f87171;color:#fff}
button.green{background:#14532d;border-color:#4ade80}
pre{background:#12060a;border:1px dashed #5e2330;border-radius:8px;padding:10px;font-size:11px;overflow:auto;color:#fecdd3;max-height:300px}
.ksw{display:flex;align-items:center;gap:14px;justify-content:center;padding:12px;border-radius:12px;border:2px solid #4ade80;background:rgba(20,83,45,.15);transition:.3s}
.ksw.dead{border-color:#f87171;background:rgba(127,29,29,.25);animation:alarm 1s infinite}
@keyframes alarm{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.4)}50%{box-shadow:0 0 30px 6px rgba(248,113,113,.4)}}
.ksw b{font-size:22px;letter-spacing:3px}
.sched{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}
.sb{background:#12060a;border:1px solid #5e2330;border-radius:10px;padding:8px 12px;font-size:11px}
.sb b{color:#fda4af;display:block}
input{background:#12060a;color:#ffe8ec;border:1px solid #5e2330;border-radius:8px;padding:7px;font-size:12px;width:100%;font-family:inherit}
</style></head><body>
${nav.html('/ops')}
<header><h1>🚨 OPS CONTROL PALETTE</h1><p class="sub">12h super-brain autosave · 4h others · 24h full sync · telegram command deck · emergency kill switch</p></header>
<div class="wrap"><div class="grid">
 <div class="panel"><h3>⭘ EMERGENCY KILL SWITCH</h3>
  <div class="ksw" id="ksw"><b id="kst">SYSTEM LIVE</b></div>
  <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
   <button class="red" id="kill">☠ KILL</button><button class="green" id="revive">♥ REVIVE</button>
  </div>
  <pre id="klog" style="margin-top:10px"></pre>
  <p style="font-size:10.5px;color:#a78b8b">Auto-engages on critical errors / uncaught exceptions and repeated syntax failures. While killed, ALL action endpoints + outbound configs return 423.</p>
 </div>
 <div class="panel"><h3>⏱ BACKUP SCHEDULE (autosave)</h3>
  <div class="sched" id="sched"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
   <button id="rsuper">run super-brain autosave</button><button id="rothers">run others autosave</button><button id="rsync">run 24h full sync</button>
  </div>
  <pre id="slog" style="margin-top:10px"></pre>
 </div>
 <div class="panel"><h3>✈️ TELEGRAM CONTROL (BotFather)</h3>
  <pre id="tg"></pre><button id="tgcopy">⧉ copy setcommands JSON</button>
 </div>
 <div class="panel"><h3>📮 AGENTIC MAIL SCHNITTSTELLE</h3>
  <input id="mto" placeholder="to: name@example.org">
  <input id="msub" placeholder="subject" style="margin-top:6px">
  <input id="mbody" placeholder="body" style="margin-top:6px">
  <div style="display:flex;gap:8px;margin-top:8px"><button id="mcompose">compose → outbox</button><button class="green" id="mapprove">approve selected</button></div>
  <pre id="mout" style="margin-top:10px"></pre>
 </div>
 <div class="panel"><h3>🗄 BACKUP VAULT (Area 64) <span style="font-size:10px;color:#5fff9f">LIVE</span></h3>
  <pre id="bv">lade…</pre>
  <div style="display:flex;gap:8px;margin-top:8px"><button id="bvrefresh">⟳ prüfen</button><button id="bvrestore">⏪ neuestes valides Restore</button></div>
 </div>
 <div class="panel"><h3>🛠 SELF-REPAIR (Area 66) <span style="font-size:10px;color:#5fff9f">LIVE</span></h3>
  <pre id="sr">lade…</pre>
  <div style="display:flex;gap:8px;margin-top:8px"><button id="srcheck">▶ Check jetzt</button><a href="/logs" style="font-size:11px;color:#fda4af">→ Log-Konsole</a></div>
 </div>
</div></div>
<script>
let TGJSON='';
async function tick(){
 const o=await (await fetch('/api/ops')).json();
 const k=document.getElementById('ksw');k.classList.toggle('dead',o.kill_switch.on);
 document.getElementById('kst').textContent=o.kill_switch.on?'☠ KILLED · '+o.kill_switch.reason:'SYSTEM LIVE';
 document.getElementById('klog').textContent=JSON.stringify(o.kill_switch,null,1);
 document.getElementById('sched').innerHTML=
  '<div class="sb"><b>12h</b>super-brain DB<br>'+(o.last_runs.super||'–')+'</div>'+
  '<div class="sb"><b>4h</b>other DBs<br>'+(o.last_runs.others||'–')+'</div>'+
  '<div class="sb"><b>24h</b>full sync<br>'+(o.last_runs.full||'–')+'</div>'+
  '<div class="sb"><b>'+(o.scheduler_running?'RUNNING':'PAUSED')+'</b>scheduler'+(o.demo_mode?' (demo)':'')+'</div>';
 document.getElementById('slog').textContent='last runs: '+JSON.stringify(o.last_runs);
 const t=await (await fetch('/api/telegram/kit')).json();
 TGJSON=JSON.stringify(t.setcommands_payload,null,2);
 document.getElementById('tg').textContent=t.botfather_steps.join('\\n')+'\\n\\nCOMMANDS:\\n'+t.commands.map(c=>'/'+c.command+' — '+c.description).join('\\n')+'\\n\\n'+t.security.map(s=>'🛡 '+s).join('\\n');
 const m=await (await fetch('/api/mail')).json();
 document.getElementById('mout').textContent=m.map(x=>x.id.slice(0,6)+' → '+x.to+' · '+x.subject+' · '+x.state).join('\\n')||'(outbox empty)';
 const bv=await (await fetch('/api/backups')).json();
 document.getElementById('bv').textContent=bv.count+' Snapshots · '+bv.verified+' verifiziert\\n'+bv.backups.slice(0,6).map(b=>(b.valid?'✔':'✘')+' '+b.file+' ('+b.bytes+'B)').join('\\n');
 window._bvnewest=(bv.backups.find(b=>b.valid)||{}).file;
 const sr=await (await fetch('/api/selfrepair')).json();const c=sr.counters;
 document.getElementById('sr').textContent='Checks: '+c.checks+' · Probleme: '+c.problems+' · repariert: '+c.repaired+' · fehlgeschlagen: '+c.failed+' · Rotationen: '+c.rotations+'\\nletzte Reparatur: '+(sr.repairs.length?sr.repairs[sr.repairs.length-1].action+' @ '+sr.repairs[sr.repairs.length-1].at:'keine nötig');
}
document.getElementById('kill').onclick=()=>fetch('/api/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({arm:true,reason:'manual via OPS'})}).then(tick);
document.getElementById('revive').onclick=()=>fetch('/api/kill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({arm:false,reason:'manual revive'})}).then(tick);
document.getElementById('rsuper').onclick=()=>fetch('/api/ops/super',{method:'POST'}).then(tick);
document.getElementById('rothers').onclick=()=>fetch('/api/ops/others',{method:'POST'}).then(tick);
document.getElementById('rsync').onclick=()=>fetch('/api/ops/sync',{method:'POST'}).then(tick);
document.getElementById('tgcopy').onclick=()=>navigator.clipboard.writeText(TGJSON);
document.getElementById('mcompose').onclick=()=>fetch('/api/mail/compose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:document.getElementById('mto').value,subject:document.getElementById('msub').value,body:document.getElementById('mbody').value})}).then(tick);
document.getElementById('mapprove').onclick=async()=>{const m=await (await fetch('/api/mail')).json();if(m[0])await fetch('/api/mail/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:m[0].id})});tick();};
document.getElementById('bvrefresh').onclick=()=>tick();
document.getElementById('bvrestore').onclick=async()=>{
 if(!window._bvnewest){alert('Kein valides Backup gefunden.');return;}
 const r=await fetch('/api/backups/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:window._bvnewest})}).then(x=>x.json());
 alert(r.ok?('Restore OK: '+r.file+' ← '+r.backup):('Fehler: '+(r.error||'unbekannt')));tick();};
document.getElementById('srcheck').onclick=async()=>{await fetch('/api/selfrepair/run',{method:'POST'});tick();};
tick();setInterval(tick,4000);
</script></body></html>`;
};
