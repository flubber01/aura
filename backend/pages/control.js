'use strict';
// AURA — Control Center UI: routine toggles (Area 75), parallel links,
// Telegram agent (78), Test Lab force-run (77).

function controlPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — Control Center</title>
<style>
 :root{--bg:#06070d;--line:#1c2b4a;--ink:#e8ecf5;--dim:#8fa0bd;--cy:#39d7ff;--vi:#a78bfa;--gr:#4ade80;--am:#f5c96b;--rd:#f87171}
 *{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink)}
 .orbs{position:fixed;inset:0;z-index:-2;overflow:hidden}
 .orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.28;animation:fl 17s ease-in-out infinite}
 .o1{width:420px;height:420px;background:radial-gradient(circle,#059669,transparent 70%);top:-8%;left:-6%}
 .o2{width:360px;height:360px;background:radial-gradient(circle,#7c3aed,transparent 70%);bottom:-8%;right:-4%;animation-delay:-6s}
 @keyframes fl{50%{transform:translate(34px,-26px) scale(1.1)}}
 .grid{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(rgba(52,211,153,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(52,211,153,.05) 1px,transparent 1px);background-size:44px 44px;animation:pan 25s linear infinite}
 @keyframes pan{to{background-position:44px 44px}}
 .wrap{max-width:1280px;margin:0 auto;padding:30px 20px 80px}
 h1{font-size:26px;margin:0;background:linear-gradient(90deg,#34d399,#39d7ff,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:var(--dim);font-size:13px;margin:6px 0 22px;max-width:940px}
 a{color:var(--cy);text-decoration:none}
 .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px}
 .card{background:linear-gradient(160deg,#0d1426,#0a0f1d);border:1px solid var(--line);border-radius:14px;padding:18px;position:relative;overflow:hidden}
 .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#34d399,#39d7ff,transparent);background-size:200% 100%;animation:scan 3s linear infinite}
 @keyframes scan{to{background-position:200% 0}}
 .card h2{font-size:14px;margin:0 0 12px;color:#34d399;letter-spacing:.6px;text-transform:uppercase}
 label{display:block;font-size:11px;color:var(--dim);margin:10px 0 3px;text-transform:uppercase;letter-spacing:.5px}
 input,select,textarea{width:100%;background:#0a0f1c;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:9px 11px;font-size:13px}
 input:focus,select:focus,textarea:focus{outline:none;border-color:var(--cy)}
 button{background:linear-gradient(90deg,#059669,#0891b2);border:0;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border-radius:9px;cursor:pointer;margin-top:12px;transition:.15s}
 button:hover{filter:brightness(1.15);transform:translateY(-1px)}
 button.mini{padding:3px 9px;font-size:10.5px;margin:2px 3px 2px 0;background:#101a30;border:1px solid var(--line);border-radius:7px}
 .rt{display:flex;align-items:center;gap:10px;background:#0a0f1c;border:1px solid var(--line);border-radius:10px;padding:9px 13px;margin-bottom:7px}
 .rt input{width:auto}
 .rt .nm{flex:1;font-size:12.5px}.rt .ar{color:var(--dim);font-size:10.5px}
 .sw{position:relative;width:40px;height:22px;flex:none}
 .sw input{opacity:0;width:0;height:0}
 .sl{position:absolute;inset:0;background:#1a2438;border-radius:20px;transition:.2s;cursor:pointer}
 .sl::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#5c6b84;border-radius:50%;transition:.2s}
 .sw input:checked+.sl{background:#0d3a2a}.sw input:checked+.sl::before{transform:translateX(18px);background:var(--gr)}
 .lnk{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#0a0f1c;border:1px solid var(--line);border-radius:10px;padding:9px 13px;margin-bottom:7px;font-size:12px}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11px;color:var(--cy)}
 .dim2{color:var(--dim);font-size:11.5px;line-height:1.5;margin:5px 0 0}
 .ok{color:var(--gr)}.err{color:var(--rd)}.warn{color:var(--am)}
 #msg,#tmsg{font-size:12px;margin-top:10px;min-height:16px;white-space:pre-wrap}
 table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px}
 th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #16203a;vertical-align:top}
 th{color:var(--dim);font-weight:600}
 .v-match{color:var(--gr);font-weight:700}.v-mis{color:var(--rd);font-weight:700}
 .pill{border-radius:14px;padding:2px 9px;font-size:10px;font-weight:800;margin-left:5px}
 .p-live{background:#12351f;color:#4ade80}.p-down{background:#3a1414;color:#f87171}.p-cfg{background:#3a2f10;color:#f5c96b}
</style></head><body>
<div class="orbs"><div class="orb o1"></div><div class="orb o2"></div></div><div class="grid"></div>
<div class="wrap">
 <div style="font-size:12px;color:var(--dim);margin-bottom:14px"><a href="/hub">← Hub</a> · <a href="/api/control">Control-API</a> · <a href="/api/testlab/status">Testlab-API</a> · <a href="/api/howto">How-To (JSON)</a> · Areas 75+77+78</div>
 <h1>⏻ Control Center & Test Lab</h1>
 <p class="sub">Toggle on/off für <b>jede Kern- und Gehirn-Routine</b> (persistiert), parallele Verknüpfungen add/delete, Telegram-Agent und das <b>Force-Run-Testlab</b>: jedes Modul modular testen — erwartete Fehler werden angezeigt, nie versteckt.</p>

 <div class="row">
  <div class="card"><h2>Kern- & Gehirn-Routinen</h2><div id="rts"><p class="dim2">lade …</p></div></div>
  <div class="card">
   <h2>Parallele Verknüpfungen</h2>
   <div id="lnks"></div>
   <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
    <div><label>Von (Quelle)</label><input id="l_from" placeholder="rt-id / WF-10 / 73"></div>
    <div><label>Nach (Ziel)</label><input id="l_to" placeholder="rt-id / WF-9 / 71"></div>
    <div><label>Name</label><input id="l_name" placeholder="optional"></div>
   </div>
   <button class="mini" onclick="addL()">➕ Verknüpfung</button>
   <p class="dim2">Producer (z. B. Forge-Routine) kann bei Feuer alle aktiven Ziele parallel auslösen — reine Lese-Querverbindung, kein Auto-Post.</p>
  </div>
 </div>

 <div class="row">
  <div class="card">
   <h2>Telegram Agent (Area 78) <span id="tgstate"></span></h2>
   <p class="dim2" id="tginfo">lade …</p>
   <button class="mini" onclick="tg('probe')">📡 Probe</button>
   <button class="mini" onclick="tg('start')">▶ Poller starten</button>
   <button class="mini" onclick="tg('stop')">⏹ stoppen</button>
   <p class="dim2">Befehle: /status /report /forge /control /snapshot /kill /revive CONFIRM · Allowlist: <code>TELEGRAM_ALLOWED_CHATS</code> in deploy/.env setzen!</p>
   <div id="msg"></div>
  </div>
  <div class="card">
   <h2>Force-Run (Area 77)</h2>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label>Area</label><input id="t_area" placeholder="z. B. 71"></div>
    <div><label>Action</label><input id="t_action" placeholder="z. B. status"></div>
   </div>
   <label>Payload (JSON, optional)</label><input id="t_payload" placeholder='{"prompt":"test"}'>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label>Erwartung</label><select id="t_expect"><option value="ok">erwarte ERFOLG</option><option value="fail">erwarte FEHLER (Drill)</option></select></div>
    <div><label>Force</label><select id="t_force"><option value="1">ja — Container-Fails zurücksetzen</option><option value="0">nein</option></select></div>
   </div>
   <button class="mini" onclick="trun()">⚡ Force-Run</button>
   <button class="mini" onclick="tsuite()">🧪 Suite über ALLE Live-Module</button>
   <div id="tmsg"></div>
  </div>
 </div>
 <div class="card"><h2>Letzte Test-Runs</h2><div id="runs"><p class="dim2">noch keine</p></div></div>
</div>
<script>
const $=(i)=>document.getElementById(i);
async function load(){
 const c=await(await fetch('/api/control')).json();
 $('rts').innerHTML=c.routines.map(r=>'<label class="rt"><span class="sw"><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="tog(\\''+r.id+'\\',this.checked)"><span class="sl"></span></span><span class="nm">'+r.name+' <span class="ar">· '+r.kind+' · Area '+r.area+'</span></span></label>').join('');
 $('lnks').innerHTML=c.links.length?c.links.map(l=>'<div class="lnk"><code>'+l.from+'</code> → <code>'+l.to+'</code><span class="dim2">'+l.name+'</span><span style="flex:1"></span><button class="mini" onclick="lo(\\''+l.id+'\\','+(!l.on)+')">'+(l.on?'⏸':'▶')+'</button><button class="mini" onclick="ldel(\\''+l.id+'\\')">🗑</button></div>').join(''):'<p class="dim2">Keine Verknüpfungen — unten anlegen.</p>';
 const t=await(await fetch('/api/telegram/status')).json();
 const cls=t.mode==='LIVE'?'p-live':t.mode==='NOT-CONFIGURED'?'p-cfg':'p-down';
 $('tgstate').innerHTML='<span class="pill '+cls+'">'+t.mode+'</span>';
 $('tginfo').innerHTML='Quelle: '+(t.token_source||'none')+' · Probe: '+(t.last_probe?t.last_probe.detail:'—')+'<br>Poller: '+(t.poller.running?'LÄUFT':'gestoppt')+' · Allowlist: '+t.allowlist;
 const tl=await(await fetch('/api/testlab/status')).json();
 $('runs').innerHTML=tl.recent_runs.length?'<table><tr><th>Zeit</th><th>Area/Action</th><th>Erwartet</th><th>Tatsächlich</th><th>Verdikt</th><th>ms</th></tr>'+tl.recent_runs.slice(0,12).map(r=>'<tr><td>'+new Date(r.at).toLocaleTimeString()+'</td><td>'+r.area+'/'+r.action+(r.force?' ⚡':'')+'</td><td>'+r.expect+'</td><td>'+r.actual+(r.error?' <span class="dim2">'+String(r.error).slice(0,60)+'</span>':'')+'</td><td class="'+(r.verdict.startsWith('MATCH')?'v-match':'v-mis')+'">'+r.verdict+'</td><td>'+r.ms+'</td></tr>').join('')+'</table>':'<p class="dim2">noch keine</p>';
}
async function tog(id,on){await fetch('/api/control/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,on})});load()}
async function addL(){const r=await fetch('/api/control/links/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:$('l_from').value,to:$('l_to').value,name:$('l_name').value})});const j=await r.json();if(j.error)alert(j.error);load()}
async function ldel(id){await fetch('/api/control/links/'+id+'/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});load()}
async function lo(id,off){await fetch('/api/control/links/'+id+'/'+(off?'disable':'enable'),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});load()}
async function tg(op){const r=await fetch('/api/telegram/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();$('msg').innerHTML=(j.state==='LIVE'||j.ok||j.running)?'<span class="ok">✔ '+JSON.stringify(j).slice(0,220)+'</span>':'<span class="warn">✖ '+(j.error||j.detail||JSON.stringify(j)).slice(0,220)+'</span>';load()}
async function trun(){let pl={};try{pl=$('t_payload').value?JSON.parse($('t_payload').value):{}}catch(e){$('tmsg').innerHTML='<span class="err">Payload kein JSON</span>';return}
 const r=await fetch('/api/testlab/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({area:$('t_area').value,action:$('t_action').value,payload:pl,expect:$('t_expect').value,force:$('t_force').value==='1'})});
 const j=await r.json();$('tmsg').innerHTML=j.verdict?'<span class="'+(j.verdict.startsWith('MATCH')?'ok':'err')+'">'+j.verdict+' · erwartet '+j.expect+' · tatsächlich '+j.actual+(j.error?' · Fehler: '+String(j.error).slice(0,120):'')+' · '+j.ms+' ms</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function tsuite(){$('tmsg').innerHTML='<span class="warn">⏳ Suite läuft über alle Live-Module …</span>';const r=await fetch('/api/testlab/suite',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();$('tmsg').innerHTML=j.results?'<span class="'+(j.mismatches?'err':'ok')+'">Suite: '+j.total+' Module · '+j.mismatches+' mismatches</span><br><span class="dim2">'+j.results.map(x=>x.area+':'+x.verdict).join(' · ')+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
load();setInterval(load,9000);
</script>
</body></html>`;
}
module.exports = controlPageHtml;
