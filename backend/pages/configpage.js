'use strict';
// AURA — Config Console (Area 68): schema-driven, hot-reloaded global config.
module.exports = function configPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA Config — globale Konfiguration, schema-validiert, hot-reloaded</title>
<meta name="description" content="AURA Config-Konsole: globale Konfiguration (Budget-Caps, Kill-Switch-Schwellen, Watcher-, Self-Repair- und Container-Parameter), schema-validiert und hot-reloaded.">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#04070f;color:#cfe3ff;font:14px/1.5 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:900px;margin:0 auto;padding:26px 18px}
h1{font-size:24px;letter-spacing:2px;color:#f5c96b}.sub{color:#7d94ad;font-size:12px;margin:4px 0 18px}
.pill{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#0d3b2a;color:#5fff9f}
.sec{background:rgba(10,18,38,.85);border:1px solid #1d3a66;border-radius:12px;padding:16px;margin-bottom:14px}
.sec h2{font-size:13px;letter-spacing:2px;color:#39d7ff;margin-bottom:10px}
.row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.row label{flex:1;font-size:13px;color:#9fb2c8}
.row input{width:170px;background:#081226;color:#cfe3ff;border:1px solid #24466f;border-radius:8px;padding:7px;font:inherit;text-align:right}
.row .rng{font-size:10px;color:#5f7186;width:110px}
button{background:linear-gradient(90deg,#1b4fd8,#7a3ff0);border:0;color:#fff;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:700;margin-right:8px}
button.ghost{background:#12233f;border:1px solid #2c5a94}
#msg{margin-top:12px;font-size:13px;padding:10px;border-radius:8px;display:none}
.ok2{background:#0d3b2a;color:#5fff9f}.err2{background:#3a1414;color:#f87171}
nav{margin-bottom:14px;font-size:13px}nav a{color:#39d7ff;margin-right:12px;text-decoration:none}
code{background:#0a1424;padding:1px 6px;border-radius:4px;font-size:12px}
</style></head><body><main>
<nav><a href="/ignition">⌂ IGNITION</a><a href="/ops">OPS</a><a href="/containers">Container</a><a href="/logs">Logs</a><a href="/api/config/schema">schema.json</a></nav>
<h1>⚙ CONFIG</h1>
<p class="sub">Area 68 · schema-validiert · Änderungen wirken sofort (Hot-Reload per mtime-Cache) · Datei: <code>backend/src/data/config.json</code> (vault-gesichert) <span class="pill">LIVE</span></p>
<div id="form"></div>
<div style="margin-top:6px"><button onclick="save()">💾 Speichern</button><button class="ghost" onclick="reset()">↺ Auf Defaults zurücksetzen</button></div>
<div id="msg"></div>
<script>
let SCHEMA={},CUR={};
function msg(t,ok){const m=document.getElementById('msg');m.style.display='block';m.className=ok?'ok2':'err2';m.textContent=t;}
async function boot(){
 const s=await (await fetch('/api/config/schema')).json();
 SCHEMA=s.schema;CUR=s.current;
 document.getElementById('form').innerHTML=Object.entries(SCHEMA).map(([sec,fields])=>
  '<div class="sec"><h2>'+sec.toUpperCase()+'</h2>'+Object.entries(fields).map(([k,f])=>
   '<div class="row"><label>'+f.label+'</label>'+
   '<span class="rng">'+(typeof f.min==='number'?f.min+' – '+f.max:'text')+' · def '+f.def+'</span>'+
   '<input id="c_'+sec+'_'+k+'" type="'+(f.type==='number'?'number':'text')+'" value="'+(CUR[sec][k]??f.def)+'"'+
   (f.type==='number'?(' min="'+(f.min??0)+'" max="'+(f.max??999999)+'" step="any"'):'')+'></div>').join('')+'</div>').join('');
}
function collect(){const out={};for(const[sec,fields]of Object.entries(SCHEMA)){out[sec]={};
 for(const[k,f]of Object.entries(fields)){const el=document.getElementById('c_'+sec+'_'+k);
  out[sec][k]=f.type==='number'?Number(el.value):el.value;}}return out;}
async function save(){
 const r=await fetch('/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(collect())}).then(x=>x.json());
 r.ok?msg('✔ Gespeichert + aktiv (Hot-Reload).',true):msg('✘ Abgelehnt: '+r.errors.join(' · '),false);
}
async function reset(){
 const r=await fetch('/api/config/reset',{method:'POST'}).then(x=>x.json());
 msg('↺ Defaults wiederhergestellt.',r.ok);boot();
}
boot();
</script></main></body></html>`;
};
