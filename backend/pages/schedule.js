'use strict';
// Schedule planner UI: who works where when, conflicts, recommend, CSV.
module.exports = function schedulePageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Schedule</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:20px;text-align:center}h1{margin:0;color:#7ef0d0;letter-spacing:2px;font-size:22px}
.sub{color:#7d94ad;font-size:12px}
.wrap{max-width:1050px;margin:0 auto;padding:0 16px 50px}
.panel{background:#0b1526;border:1px solid #1e3a8a;border-radius:14px;padding:14px;margin-bottom:14px}
.row{display:flex;gap:8px;flex-wrap:wrap}
input,select{background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:8px;font-size:12.5px}
button{background:#12355e;color:#fff;border:1px solid #1e5a8a;border-radius:8px;padding:9px 14px;font-weight:800;cursor:pointer}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
th,td{padding:7px 9px;text-align:left;border-bottom:1px solid #1a2438}th{color:#7d94ad}
.conf{background:#3a1414;color:#f87171;border-radius:10px;padding:6px 12px;font-size:12px;display:inline-block;margin:4px}
nav{position:fixed;top:10px;right:14px}nav a{color:#7ef0d0;text-decoration:none;font-size:11px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
</style></head><body>
<nav><a href="/ignition">Ignition</a><a href="/hierarchy">Brains</a><a href="/ops">OPS</a></nav>
<header><h1>🗓 SCHEDULE · WHO WHERE WHEN</h1><p class="sub">roles from the 63-role library · overlap conflicts detected · recommended day · CSV export · editable via /api/schedule + TXT hot-reload</p></header>
<div class="wrap">
<div class="panel"><div class="row">
 <select id="day"><option>mon</option><option>tue</option><option>wed</option><option>thu</option><option>fri</option><option>sat</option><option>sun</option></select>
 <select id="role"></select>
 <input id="service" placeholder="service / area (e.g. WF-2 research)" style="flex:1;min-width:160px">
 <input id="start" type="time" value="09:00">
 <input id="dur" type="number" value="60" min="15" step="15" style="width:70px">
 <input id="task" placeholder="task" style="flex:1;min-width:140px">
 <button id="add">+ add</button><button id="rec">✨ recommended day</button><button id="csv">⇩ CSV</button>
</div><div id="confs"></div></div>
<div class="panel"><table id="tbl"><thead><tr><th>day</th><th>role</th><th>service</th><th>start</th><th>min</th><th>task</th><th></th></tr></thead><tbody></tbody></table></div>
</div>
<script>
async function roles(){const r=await (await fetch('/api/roles')).json();
 document.getElementById('role').innerHTML=r.map(x=>'<option value="'+x.id+'">'+x.title+' ('+x.department_name+')</option>').join('');}
async function tick(){const d=await (await fetch('/api/schedule')).json();
 document.querySelector('#tbl tbody').innerHTML=d.entries.map(e=>'<tr><td>'+e.day+'</td><td>'+e.role+'</td><td>'+e.service+'</td><td>'+e.start+'</td><td>'+e.duration_min+'</td><td>'+e.task+'</td><td><button data-del="'+e.id+'">✕</button></td></tr>').join('')||'<tr><td colspan=7>empty — add or generate a recommended day</td></tr>';
 document.getElementById('confs').innerHTML=d.conflicts.map(c=>'<span class="conf">⚠ '+c.role+' double-booked '+c.day+'</span>').join('');
 document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{await fetch('/api/schedule/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.del})});tick();});}
document.getElementById('add').onclick=async()=>{await fetch('/api/schedule/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:document.getElementById('day').value,role:document.getElementById('role').value,service:document.getElementById('service').value,start:document.getElementById('start').value,duration_min:+document.getElementById('dur').value,task:document.getElementById('task').value})});tick();};
document.getElementById('rec').onclick=async()=>{const r=await (await fetch('/api/schedule/recommend')).json();for(const e of r)await fetch('/api/schedule/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});tick();};
document.getElementById('csv').onclick=()=>location.href='/api/schedule/csv';
roles();tick();
</script></body></html>`;
};
