'use strict';
// AURA Area 72 — MCP Manager UI: user-defined MCP servers
// add / delete / install / uninstall / enable / use + usage tracking.

function mcpPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — MCP Manager</title>
<style>
 :root{--bg:#06070d;--panel:#0c1120;--line:#1c2b4a;--ink:#e8ecf5;--dim:#8fa0bd;--cy:#39d7ff;--vi:#a78bfa;--gr:#4ade80;--am:#f5c96b;--rd:#f87171}
 *{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink)}
 .orbs{position:fixed;inset:0;z-index:-2;overflow:hidden}
 .orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.3;animation:fl 16s ease-in-out infinite}
 .o1{width:400px;height:400px;background:radial-gradient(circle,#7c3aed,transparent 70%);top:-8%;left:-6%}
 .o2{width:340px;height:340px;background:radial-gradient(circle,#0891b2,transparent 70%);bottom:-10%;right:-4%;animation-delay:-6s}
 @keyframes fl{50%{transform:translate(36px,-28px) scale(1.1)}}
 .grid{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(rgba(167,139,250,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,.05) 1px,transparent 1px);background-size:44px 44px;animation:pan 26s linear infinite}
 @keyframes pan{to{background-position:44px 44px}}
 .wrap{max-width:1200px;margin:0 auto;padding:30px 20px 80px}
 h1{font-size:26px;margin:0;background:linear-gradient(90deg,#a78bfa,#39d7ff,#4ade80);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:var(--dim);font-size:13px;margin:6px 0 22px}
 a{color:var(--cy);text-decoration:none}
 .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px}
 .card{background:linear-gradient(160deg,#0d1426,#0a0f1d);border:1px solid var(--line);border-radius:14px;padding:18px;position:relative;overflow:hidden}
 .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--vi),var(--cy),transparent);background-size:200% 100%;animation:scan 3s linear infinite}
 @keyframes scan{to{background-position:200% 0}}
 .card h2{font-size:14px;margin:0 0 12px;color:var(--vi);letter-spacing:.6px;text-transform:uppercase}
 label{display:block;font-size:11px;color:var(--dim);margin:10px 0 3px;text-transform:uppercase;letter-spacing:.5px}
 input,select,textarea{width:100%;background:#0a0f1c;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:9px 11px;font-size:13px}
 input:focus,select:focus{outline:none;border-color:var(--vi)}
 button{background:linear-gradient(90deg,#7c3aed,#0891b2);border:0;color:#fff;font-weight:700;font-size:13px;padding:10px 14px;border-radius:9px;cursor:pointer;margin-top:12px;transition:.15s}
 button:hover{filter:brightness(1.15);transform:translateY(-1px)}
 button.mini{padding:4px 10px;font-size:11px;margin:2px 4px 2px 0;background:#101a30;border:1px solid var(--line)}
 button.danger{background:#3a1414;border:1px solid #5c2323}
 .srv{background:#0a0f1c;border:1px solid var(--line);border-radius:11px;padding:12px 14px;margin-bottom:10px}
 .srv b{color:var(--cy)}
 .pill{border-radius:16px;padding:2px 10px;font-size:10.5px;font-weight:800;margin-left:6px}
 .p-live{background:#12351f;color:#4ade80}.p-off{background:#3a2f10;color:#f5c96b}.p-down{background:#3a1414;color:#f87171}
 .dim2{color:var(--dim);font-size:11.5px;line-height:1.5;margin:6px 0 0}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11px;color:var(--cy)}
 #msg,#amsg{font-size:12px;margin-top:10px;min-height:16px}.ok{color:var(--gr)}.err{color:var(--rd)}
 pre{background:#0a0f1c;border:1px solid var(--line);border-radius:10px;padding:12px;font-size:11px;overflow:auto;color:#a5f3fc}
</style></head><body>
<div class="orbs"><div class="orb o1"></div><div class="orb o2"></div></div><div class="grid"></div>
<div class="wrap">
 <div style="font-size:12px;color:var(--dim);margin-bottom:14px"><a href="/hub">← Hub</a> · <a href="/api/mcp/status">Status-API</a> · Area 72</div>
 <h1>🔌 MCP Manager</h1>
 <p class="sub">Model Context Protocol — AURA <b>als</b> MCP-Server (stdio + HTTP-JSON-RPC) und AURA <b>als Client-Manager</b> für deine eigenen MCP-Server: hinzufügen, installieren, deinstallieren, löschen, Usage-Tracking. Ehrlich: Sandbox öffnet keine externen Verbindungen — Handshake-Tests laufen auf deinem Host.</p>

 <div class="row">
  <div class="card">
   <h2>AURA als MCP-Server</h2>
   <p class="dim2">In Claude Desktop / Cursor eintragen:</p>
   <pre>{
  "mcpServers": {
    "aura": {
      "command": "node",
      "args": ["backend/mcp_server.js"]
    }
  }
}</pre>
   <p class="dim2">oder HTTP-JSON-RPC: <code>POST /api/mcp</code> (initialize · tools/list · tools/call).<br>Tools: aura_status · aura_report · aura_modulehub · aura_image_sim · aura_content_draft.<br>Usage: <span id="buse">…</span></p>
  </div>
  <div class="card">
   <h2>Server hinzufügen</h2>
   <label>Name</label><input id="a_name" placeholder="z. B. filesystem-tools">
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div><label>Transport</label><select id="a_tr" onchange="$('a_cmd').style.display=this.value==='stdio'?'block':'none';$('a_url').style.display=this.value==='stdio'?'none':'block'"><option>stdio</option><option>sse</option><option>http</option></select></div>
    <div><label>Permissions (kommagetrennt)</label><input id="a_perm" placeholder="fs:read, net:fetch"></div>
   </div>
   <label id="a_cmd_l">Command (erlaubte Binaries: npx uvx node python python3 deno bun)</label>
   <input id="a_cmd" placeholder="npx -y @modelcontextprotocol/server-filesystem /pfad">
   <div id="a_url" style="display:none"><label>URL</label><input id="a_url_i" placeholder="https://mcp.example.local/sse"></div>
   <label>Env-Key-Namen (Werte bleiben im Secret-Store deines Hosts)</label><input id="a_env" placeholder="API_KEY, TOKEN">
   <button onclick="addSrv()">➕ Hinzufügen</button>
   <div id="amsg"></div>
  </div>
 </div>

 <div class="card">
  <h2>Registrierte MCP-Server <span id="cnt" style="color:var(--dim)"></span></h2>
  <div id="list"><p class="dim2">lade …</p></div>
  <div id="msg"></div>
 </div>
</div>
<script>
const $=(i)=>document.getElementById(i);
async function load(){
 const s=await(await fetch('/api/mcp/status')).json();
 $('buse').textContent=(s.builtin.calls||0)+' Aufrufe · letzte: '+(s.builtin.last||'—');
 $('cnt').textContent='('+s.servers+' registriert · '+s.installed+' installiert)';
 const l=$('list');
 if(!s.list.length){l.innerHTML='<p class="dim2">Noch keine Server registriert — oben hinzufügen.</p>';return}
 l.innerHTML=s.list.map(x=>'<div class="srv"><b>'+x.name+'</b> <code>'+x.id+'</code>'+
  '<span class="pill '+(x.installed?'p-live':'p-off')+'">'+(x.installed?(x.enabled?'INSTALLED+ACTIVE':'INSTALLED'):'NOT-INSTALLED')+'</span>'+
  '<span class="pill '+(x.connection==='configured-not-connected'?'p-down':'p-off')+'">'+x.connection+'</span>'+
  '<p class="dim2">'+x.transport+' · '+(x.command||x.url||'')+' · Usage: '+x.usage.calls+' Aufrufe'+(x.usage.last?' · zuletzt '+new Date(x.usage.last).toLocaleString():'')+'</p>'+
  '<button class="mini" onclick="op(\\''+x.id+'\\',\\'install\\')">⬇ Install</button>'+
  '<button class="mini" onclick="op(\\''+x.id+'\\',\\'uninstall\\')">⏏ Uninstall</button>'+
  '<button class="mini" onclick="op(\\''+x.id+'\\',\\'enable\\')">✔ Enable</button>'+
  '<button class="mini" onclick="op(\\''+x.id+'\\',\\'disable\\')">✖ Disable</button>'+
  '<button class="mini" onclick="opt(\\''+x.id+'\\')">▶ Use (test)</button>'+
  '<button class="mini" onclick="otest(\\''+x.id+'\\')">🤝 Handshake</button>'+
  '<button class="mini danger" onclick="odel(\\''+x.id+'\\')">🗑 Delete</button></div>').join('');
}
async function addSrv(){
 const body={name:$('a_name').value,transport:$('a_tr').value,permissions:$('a_perm').value.split(',').map(s=>s.trim()).filter(Boolean),env_keys:$('a_env').value.split(',').map(s=>s.trim()).filter(Boolean)};
 if(body.transport==='stdio')body.command=$('a_cmd').value;else body.url=$('a_url_i').value;
 const r=await fetch('/api/mcp/servers/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json();
 $('amsg').innerHTML=r.ok?'<span class="ok">✔ hinzugefügt: '+j.server.id+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';
 load();
}
async function op(id,o){const r=await fetch('/api/mcp/servers/'+id+'/'+o,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();$('msg').innerHTML=(r.ok||j.ok)?'<span class="ok">✔ '+o+' ok</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function opt(id){const t=prompt('Tool-Name für Testaufruf:','demo');if(!t)return;const r=await fetch('/api/mcp/servers/'+id+'/use',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tool:t})});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ Usage erfasst — '+j.note+'</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
async function otest(id){const r=await fetch('/api/mcp/servers/'+id+'/test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();$('msg').innerHTML='<span class="'+(j.ok?'ok':'err')+'">'+(j.ok?'✔':'✖')+' '+(j.state||'')+' '+(j.detail||j.note||'').slice(0,140)+'</span>';load()}
async function odel(id){if(!confirm('Server "'+id+'" endgültig löschen?'))return;const r=await fetch('/api/mcp/servers/'+id+'/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const j=await r.json();$('msg').innerHTML=j.ok?'<span class="ok">✔ gelöscht (Usage final: '+j.finalUsage+')</span>':'<span class="err">✖ '+(j.error||r.status)+'</span>';load()}
load();setInterval(load,8000);
</script>
</body></html>`;
}
module.exports = mcpPageHtml;
