'use strict';
// Mission Grid — die 19 ausgebauten Live-Module (Areas 09–40) auf einem Screen.
module.exports = function gridHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Mission Grid</title>
<style>
:root{--bg:#050309;--ink:#e8dcff;--vio:#a78bfa;--cy:#39d7ff;--ok:#43e58c;--warn:#ffb454}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1000px 600px at 20% -10%,#1b0f33 0%,var(--bg) 60%);color:var(--ink);font-family:system-ui,Segoe UI,Roboto,sans-serif;min-height:100vh}
header{padding:22px;text-align:center}
h1{margin:0;font-size:24px;letter-spacing:4px;color:var(--vio);text-shadow:0 0 22px rgba(167,139,250,.5)}
.sub{color:#8d7bb5;font-size:12.5px;margin-top:6px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:var(--vio);text-decoration:none;font-size:11.5px;background:#0d0718;border:1px solid #3b2a63;border-radius:8px;padding:5px 10px}
.wrap{max-width:1400px;margin:0 auto;padding:0 16px 60px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.card{background:linear-gradient(160deg,#0d0718,#08040f);border:1px solid #3b2a63;border-radius:14px;padding:14px;animation:pulse 3s ease-in-out infinite alternate,pop .4s ease both}
@keyframes pulse{from{box-shadow:0 0 0 rgba(167,139,250,0)}to{box-shadow:0 0 18px rgba(167,139,250,.12)}}
@keyframes pop{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.card h3{margin:0 0 2px;font-size:13.5px;color:#d6c6ff}
.card .area{font-size:10px;color:#7f6fae;letter-spacing:2px}
.card p{margin:6px 0;font-size:11.5px;color:#9c8cc4;line-height:1.5}
.badge{display:inline-block;font-size:9.5px;border-radius:10px;padding:2px 8px;letter-spacing:1px;background:#0b2e1c;color:var(--ok);border:1px solid #14532d;float:right;margin-top:3px}
button{background:linear-gradient(90deg,#3b2a63,#2a1b4d);color:#e8dcff;border:1px solid #6d54a8;border-radius:9px;padding:6px 12px;font-size:11.5px;cursor:pointer;margin:3px 4px 0 0}
button:hover{filter:brightness(1.25)}
input{width:100%;background:#08040f;color:var(--ink);border:1px solid #4b3879;border-radius:8px;padding:6px 10px;font-size:11.5px;margin:3px 0}
pre{font-size:10.5px;background:#08040f;border:1px solid #2a1b4d;border-radius:8px;padding:8px;max-height:150px;overflow:auto;white-space:pre-wrap;color:#b9a8e0}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/tower">Tower</a><a href="/models">Model Bay</a><a href="/yellowpages">Yellow Pages</a></nav>
<header><h1>🗺 MISSION GRID</h1><p class="sub">alle ausgebauten Live-Module · echte Control-Planes · externe Adapter melden ehrlich NOT-CONNECTED</p></header>
<div class="wrap"><div class="grid" id="grid"></div></div>
<script>
const MODULES=[
 {a:'09',n:'Kids Media Pipeline',d:'Story → Shot-Plan → SRT → Render-Adapter',s:'/api/media/status',acts:[['Shot-Plan','/api/media/plan',{story:'Ein kleiner Drache fliegt über das Meer. Er sucht eine verlorene Perle in den Wellen und findet sie am Strand wieder.',title:'Drache & Perle'}]]]},
 {a:'10',n:'Content Incubator',d:'Ideen-Lebenszyklus mit echtem Scoring',s:'/api/incubator/status',acts:[['Idee einreichen','/api/incubator/submit',{title:'Test-Idee',desc:'Eine Beispielidee mit genug Text für das Klarheits-Scoring der Inkubation.'}]]]},
 {a:'11',n:'Editorial Incubation',d:'Redaktion mit 4-Augen-Sign-off',s:'/api/editorial/status',acts:[['Beitrag anlegen','/api/editorial/create',{title:'Erster Beitrag',author:'admin'}]]]},
 {a:'12',n:'Community Incubation',d:'Feedback/Events/Vorlagen — kein Fake-Engagement',s:'/api/community/status',acts:[['Feedback erfassen','/api/community/feedback',{text:'Beispiel-Feedback aus dem Mission Grid',from:'admin'}]]]},
 {a:'13',n:'Omnichannel Dispatcher',d:'Queue mit Consent-Pflicht + Idempotenz',s:'/api/dispatch/status',acts:[['Enqueue','/api/dispatch/enqueue',{channel:'telegram',text:'Test',consent:true,idempotency_key:'grid-test-1'}]]]},
 {a:'14',n:'WordPress Bridge',d:'REST-API, Draft/Publish, Duplikat-Schutz',s:'/api/wordpress/status',acts:[]},
 {a:'15',n:'n8n Secure Dispatch',d:'HMAC + TTL + HTTPS-Allowlist',s:'/api/n8n/status',acts:[]},
 {a:'18',n:'Knowledge Sync',d:'GitHub-Manifest + Cache + NotebookLM-Links',s:'/api/ksync/status',acts:[]},
 {a:'26',n:'Hardware Router',d:'Capability-Routing auf eigene Geräte',s:'/api/hardware/status',acts:[['Gerät anmelden','/api/hardware/device',{id:'grid-node',kind:'server',caps:['gpu','render'],addr:'127.0.0.1:8080'}]]]},
 {a:'27',n:'Compute Router',d:'Intranet-Knoten + Job-Scheduling',s:'/api/compute/status',acts:[['Knoten anmelden','/api/compute/node',{id:'grid-compute',cores:8,ram_gb:16}]]]},
 {a:'28',n:'Cloud Connector',d:'Opt-in-Provider + Deployment-Pläne',s:'/api/cloud/status',acts:[]},
 {a:'29',n:'Mesh Engine',d:'Mesh-Knoten, Heartbeats, Routing-Tabelle',s:'/api/mesh/status',acts:[['Knoten join','/api/mesh/join',{id:'grid-mesh-node'}]]]},
 {a:'30',n:'Telemetry Stream',d:'echte Metriken als SSE (2s-Takt)',s:'/api/telemetry/status',acts:[]},
 {a:'31',n:'Finance Engine',d:'Kosten-Ledger + Budgets (kein Trading)',s:'/api/finance/status',acts:[]},
 {a:'34',n:'Gateway Health',d:'Latenz/Uptime eigener Endpunkte',s:'/api/gateway/status',acts:[['Jetzt prüfen','/api/gateway/check',{}]]},
 {a:'35',n:'Delivery Monitor',d:'Zustellung eigener Inhalte (offizielle APIs)',s:'/api/delivery/status',acts:[['Aus Dispatcher übernehmen','/api/delivery/ingest',{}]]},
 {a:'37',n:'Vision Bridge',d:'Bildanalyse mit Consent + Ollama-llava',s:'/api/vision/status',acts:[]},
 {a:'38',n:'Identity Vault',d:'AES-256-GCM Secrets + Inbox-Orchestrierung',s:'/api/vault/status',acts:[]},
 {a:'40',n:'Variance Lifecycle',d:'Varianten mit Governance (Score + Freigabe)',s:'/api/variance/status',acts:[['Variante anlegen','/api/variance/create',{target:'prompt:hierarchy',name:'grid-test-variante',payload:'test'}]]]}
];
async function run(i,k){const m=MODULES[i];const b=m.acts[k];const out=document.getElementById('out-'+i+'-'+k);out.textContent='läuft …';
 try{const r=await fetch(b[1],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b[2])});out.textContent=JSON.stringify(await r.json(),null,2);}catch(e){out.textContent='FEHLER: '+e.message;}}
async function st(i){const m=MODULES[i];const out=document.getElementById('st-'+i);out.textContent='lädt …';
 try{const r=await fetch(m.s);out.textContent=JSON.stringify(await r.json(),null,2);}catch(e){out.textContent='FEHLER: '+e.message;}}
document.getElementById('grid').innerHTML=MODULES.map((m,i)=>'<div class="card"><span class="badge">LIVE</span><span class="area">AREA '+m.a+'</span><h3>'+m.n+'</h3><p>'+m.d+'</p><button onclick="st('+i+')">Status</button>'+m.acts.map((b,k)=>'<button onclick="run('+i+','+k+')">'+b[0]+'</button>').join('')+'<pre id="st-'+i+'" style="display:none"></pre>'+m.acts.map((b,k)=>'<pre id="out-'+i+'-'+k+'" style="display:none"></pre>').join('')+'</div>').join('');
const origSt=st;st=async(i)=>{document.getElementById('st-'+i).style.display='block';await origSt(i);};
const origRun=run;run=async(i,k)=>{document.getElementById('out-'+i+'-'+k).style.display='block';await origRun(i,k);};
</script></body></html>`;
};
