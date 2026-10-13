'use strict';
// AURA Area 71 — Image Generation Gateway UI (ComfyUI + WebUI).
// Honest telemetry: every engine shows LIVE / NOT-CONFIGURED / NOT-CONNECTED,
// every image carries its real mode badge (LIVE or SIMULATION). Nothing faked.

function imagegenPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA — Image Generation Gateway</title>
<style>
 :root{--bg:#06070d;--panel:#0c1120;--line:#1c2b4a;--ink:#e8ecf5;--dim:#8fa0bd;--cy:#39d7ff;--vi:#a78bfa;--gr:#4ade80;--am:#f5c96b;--rd:#f87171}
 *{box-sizing:border-box}
 body{margin:0;font-family:system-ui,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink);overflow-x:hidden}
 .orbs{position:fixed;inset:0;z-index:-2;overflow:hidden}
 .orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.35;animation:float 14s ease-in-out infinite}
 .o1{width:420px;height:420px;background:radial-gradient(circle,#2563eb,transparent 70%);top:-8%;left:-6%}
 .o2{width:360px;height:360px;background:radial-gradient(circle,#7c3aed,transparent 70%);bottom:-10%;right:-4%;animation-delay:-5s}
 .o3{width:280px;height:280px;background:radial-gradient(circle,#06b6d4,transparent 70%);top:38%;left:44%;animation-delay:-9s}
 @keyframes float{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.12)}}
 .grid{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(rgba(57,215,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(57,215,255,.05) 1px,transparent 1px);background-size:44px 44px;animation:pan 24s linear infinite}
 @keyframes pan{to{background-position:44px 44px}}
 .wrap{max-width:1200px;margin:0 auto;padding:30px 20px 80px}
 h1{font-size:26px;margin:0;background:linear-gradient(90deg,#39d7ff,#a78bfa,#f5c96b);-webkit-background-clip:text;background-clip:text;color:transparent}
 .sub{color:var(--dim);margin:6px 0 22px;font-size:13px}
 a{color:var(--cy);text-decoration:none}
 .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px}
 .card{background:linear-gradient(160deg,#0d1426,#0a0f1d);border:1px solid var(--line);border-radius:14px;padding:18px;position:relative;overflow:hidden}
 .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--cy),var(--vi),transparent);background-size:200% 100%;animation:scan 3s linear infinite}
 @keyframes scan{to{background-position:200% 0}}
 .card h2{font-size:14px;margin:0 0 12px;color:var(--cy);letter-spacing:.6px;text-transform:uppercase}
 .chip{display:inline-flex;align-items:center;gap:7px;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;margin:2px 6px 2px 0;border:1px solid}
 .chip .dot{width:8px;height:8px;border-radius:50%;animation:pulse 1.6s infinite}
 @keyframes pulse{50%{opacity:.35}}
 .live{color:var(--gr);border-color:#1f5132;background:#0d2417}.live .dot{background:var(--gr)}
 .nc{color:var(--rd);border-color:#5c2323;background:#251010}.nc .dot{background:var(--rd)}
 .ncfg{color:var(--am);border-color:#5c4a1c;background:#241d0b}.ncfg .dot{background:var(--am)}
 .simc{color:var(--vi);border-color:#3b2d63;background:#1b1430}.simc .dot{background:var(--vi)}
 .engdetail{font-size:11.5px;color:var(--dim);margin:6px 0 0;line-height:1.5}
 label{display:block;font-size:11px;color:var(--dim);margin:10px 0 3px;text-transform:uppercase;letter-spacing:.5px}
 input,select,textarea{width:100%;background:#0a0f1c;border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:9px 11px;font-size:13px;font-family:inherit}
 input:focus,textarea:focus,select:focus{outline:none;border-color:var(--cy);box-shadow:0 0 0 3px rgba(57,215,255,.12)}
 textarea{resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px}
 .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
 .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
 button{margin-top:14px;width:100%;background:linear-gradient(90deg,#0891b2,#7c3aed);border:0;color:#fff;font-weight:700;font-size:14px;padding:12px;border-radius:10px;cursor:pointer;letter-spacing:.4px;transition:.15s}
 button:hover{transform:translateY(-1px);filter:brightness(1.15)}
 button.ghost{background:#101a30;border:1px solid var(--line);font-size:12px;padding:9px}
 button:disabled{opacity:.5;cursor:wait;transform:none}
 #msg{font-size:12.5px;margin-top:10px;min-height:18px;line-height:1.5}
 .ok{color:var(--gr)}.err{color:var(--rd)}.warn{color:var(--am)}
 #gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
 .gcard{background:#0a0f1c;border:1px solid var(--line);border-radius:12px;overflow:hidden;transition:.15s}
 .gcard:hover{transform:translateY(-3px);border-color:var(--cy)}
 .gcard img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
 .gmeta{padding:9px 11px;font-size:11px;color:var(--dim);line-height:1.45}
 .gmeta b{color:var(--ink);font-weight:600}
 .badge{font-size:9.5px;font-weight:800;border-radius:10px;padding:1px 8px;margin-left:6px}
 .b-live{background:#12351f;color:#4ade80}.b-sim{background:#2a1a3a;color:#c084fc}
 .empty{color:var(--dim);font-size:13px;padding:24px;text-align:center;border:1px dashed var(--line);border-radius:12px}
 .crumb{font-size:12px;color:var(--dim);margin-bottom:14px}
 code{background:#182136;border-radius:4px;padding:1px 6px;font-size:11px;color:var(--cy)}
</style></head><body>
<div class="orbs"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div></div>
<div class="grid"></div>
<div class="wrap">
 <div class="crumb"><a href="/hub">← Hub</a> · <a href="/console">Console</a> · <a href="/api/imagegen/status">Status-API</a> · Area 71</div>
 <h1>🎨 Image Generation Gateway</h1>
 <p class="sub">ComfyUI (Node-Graph-API) + AUTOMATIC1111 WebUI (/sdapi/v1) — ehrliche Zustände, keine erfundenen Bilder. Ohne verbundenes Backend liefert der Simulator <b>klar gelabelte SIMULATION-Bilder</b>.</p>

 <div class="row">
  <div class="card">
   <h2>Engine-Status <span id="stmode" class="chip ncfg"><span class="dot"></span>…</span></h2>
   <div id="chips"><span class="chip ncfg"><span class="dot"></span>lade Status …</span></div>
   <p class="engdetail" id="engdetail"></p>
   <p class="engdetail" id="histstat"></p>
  </div>
  <div class="card">
   <h2>Verbindung</h2>
   <div class="two">
    <div><label>ComfyUI URL (z. B. http://gpu-box:8188)</label><input id="c_comfy" placeholder="leer = nicht konfiguriert"></div>
    <div><label>WebUI URL (A1111 mit --api)</label><input id="c_webui" placeholder="leer = nicht konfiguriert"></div>
   </div>
   <div class="three">
    <div><label>ComfyUI Token (opt.)</label><input id="c_ctok" placeholder="Bearer-Token"></div>
    <div><label>WebUI Auth (opt.)</label><input id="c_auth" placeholder="user:pass"></div>
    <div><label>Timeout (ms)</label><input id="c_to" type="number" min="5000" max="600000" step="1000"></div>
   </div>
   <div class="three">
    <div><label>Standard-Engine</label><select id="c_eng"><option>auto</option><option>comfyui</option><option>webui</option><option>sim</option></select></div>
    <div><label>Checkpoint</label><input id="c_ckpt"></div>
    <div><label>Sampler</label><input id="c_smp"></div>
   </div>
   <button class="ghost" onclick="saveCfg()">💾 Verbindung speichern</button>
   <div id="cfgmsg"></div>
  </div>
 </div>

 <div class="row">
  <div class="card">
   <h2>Generierung (txt2img)</h2>
   <label>Prompt</label>
   <textarea id="g_prompt" rows="3" placeholder="neon cyberpunk city at night, ultra detailed, cinematic lighting"></textarea>
   <div class="two">
    <div><label>Negative Prompt</label><input id="g_neg" placeholder="blurry, low quality"></div>
    <div><label>Engine</label><select id="g_eng"><option value="auto">auto (LIVE wenn verbunden, sonst SIM)</option><option>comfyui</option><option>webui</option><option value="sim">sim (Demo)</option></select></div>
   </div>
   <div class="three">
    <div><label>Breite</label><input id="g_w" type="number" value="512" min="64" max="1024" step="64"></div>
    <div><label>Höhe</label><input id="g_h" type="number" value="512" min="64" max="1024" step="64"></div>
    <div><label>Steps</label><input id="g_st" type="number" value="20" min="1" max="150"></div>
   </div>
   <label>ComfyUI Workflow-JSON (optional — überschreibt txt2img-Graph)</label>
   <textarea id="g_wf" rows="4" placeholder='{"3":{"class_type":"KSampler",...}}'></textarea>
   <button id="g_btn" onclick="gen()">⚡ Generieren</button>
   <div id="msg"></div>
  </div>
  <div class="card">
   <h2>So funktioniert's</h2>
   <p class="engdetail">
    <b style="color:var(--cy)">ComfyUI:</b> POST <code>/prompt</code> mit Node-Graph → Polling <code>/history/{id}</code> → Bild via <code>/view</code>. Eigenen Graph einfach als JSON einfügen.<br><br>
    <b style="color:var(--vi)">WebUI (A1111):</b> POST <code>/sdapi/v1/txt2img</code> (bzw. <code>img2img</code>), startbar mit <code>--api</code>.<br><br>
    <b style="color:var(--am)">Ehrlichkeit:</b> <code>auto</code> prüft beide Backends. Ist keines erreichbar, wird das klar gemeldet — und nur auf Wunsch ein lokal gerendertes, als <b>SIMULATION</b> markiertes Demo-Bild erzeugt. Keine Fake-Generierung, keine erfundenen Statuswerte.
   </p>
   <p class="engdetail">API: <code>POST /api/imagegen/generate</code> · <code>GET /api/imagegen/history</code> · <code>GET /api/imagegen/artifact/:name</code></p>
  </div>
 </div>

 <div class="card">
  <h2>Galerie (History, max. 50)</h2>
  <div id="gal"><div class="empty">Noch keine Bilder generiert.</div></div>
 </div>
</div>
<script>
const $=(id)=>document.getElementById(id);
const chip=(state,label,detail)=>{const cls=state==='LIVE'?'live':state==='NOT-CONNECTED'?'nc':'ncfg';return '<span class="chip '+cls+'"><span class="dot"></span>'+label+'</span>'};
async function loadStatus(){
 try{
  const s=await(await fetch('/api/imagegen/status')).json();
  $('stmode').outerHTML='<span id="stmode" class="chip '+(s.mode==='LIVE'?'live':'nc')+'"><span class="dot"></span>'+(s.mode==='LIVE'?'LIVE — Backend verbunden':'KEIN BACKEND — SIM bereit')+'</span>';
  const c=s.engines.comfyui,w=s.engines.webui;
  $('chips').innerHTML=chip(c.state,'ComfyUI: '+(c.state==='LIVE'?'LIVE':c.state),c.detail)+' '+chip(w.state,'WebUI: '+(w.state==='LIVE'?'LIVE':w.state),w.detail);
  $('engdetail').innerHTML='<b style="color:var(--cy)">ComfyUI:</b> '+c.detail+'<br><b style="color:var(--vi)">WebUI:</b> '+w.detail;
  $('histstat').textContent='History: '+s.history.entries+' Bilder · '+s.history.live_count+' LIVE · '+s.history.sim_count+' SIMULATION';
  $('c_comfy').value=s.config.comfyui_url||'';$('c_webui').value=s.config.webui_url||'';
  $('c_to').value=s.config.timeout_ms;$('c_eng').value=s.config.default_engine;
  $('c_ckpt').value=s.config.checkpoint||'';$('c_smp').value=s.config.sampler||'';
 }catch(e){$('chips').innerHTML='<span class="chip nc"><span class="dot"></span>Status-Fehler: '+e.message+'</span>'}
}
async function saveCfg(){
 const body={comfyui_url:$('c_comfy').value.trim(),webui_url:$('c_webui').value.trim(),timeout_ms:+$('c_to').value,default_engine:$('c_eng').value,checkpoint:$('c_ckpt').value,sampler:$('c_smp').value};
 if($('c_ctok').value)body.comfyui_token=$('c_ctok').value; if($('c_auth').value)body.webui_auth=$('c_auth').value;
 const r=await fetch('/api/imagegen/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json();
 $('cfgmsg').innerHTML=r.ok?'<span class="ok">✔ gespeichert — Status wird neu geprüft …</span>':'<span class="err">✖ '+(j.error||'Fehler')+'</span>';
 loadStatus();
}
async function gen(){
 const b=$('g_btn');b.disabled=true;$('msg').innerHTML='<span class="warn">⏳ generiere …</span>';
 const body={prompt:$('g_prompt').value,negative:$('g_neg').value,engine:$('g_eng').value,width:+$('g_w').value,height:+$('g_h').value,steps:+$('g_st').value};
 if($('g_wf').value.trim()){try{body.workflow=JSON.parse($('g_wf').value)}catch(e){$('msg').innerHTML='<span class="err">✖ Workflow-JSON ungültig: '+e.message+'</span>';b.disabled=false;return}}
 try{
  const r=await fetch('/api/imagegen/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();
  if(j.ok){$('msg').innerHTML='<span class="ok">✔ '+j.mode+' · '+j.engine+' · '+j.ms+' ms</span> <a href="'+j.href+'" target="_blank">Bild öffnen ↗</a>';loadGal()}
  else{$('msg').innerHTML='<span class="err">✖ '+(j.state||'')+' — '+(j.error||j.note||'Fehler')+'</span>'}
 }catch(e){$('msg').innerHTML='<span class="err">✖ '+e.message+'</span>'}
 b.disabled=false;
}
async function loadGal(){
 const h=await(await fetch('/api/imagegen/history')).json();
 const g=$('gal');
 if(!h.entries.length){g.innerHTML='<div class="empty">Noch keine Bilder generiert.</div>';return}
 g.innerHTML=h.entries.map(e=>'<div class="gcard"><a href="'+e.href+'" target="_blank"><img loading="lazy" src="'+e.href+'" alt=""></a><div class="gmeta"><b>'+e.engine.toUpperCase()+'</b><span class="badge '+(e.mode==='LIVE'?'b-live':'b-sim')+'">'+e.mode+'</span><br>'+new Date(e.at).toLocaleString()+'<br>'+(e.prompt||'').slice(0,70)+'</div></div>').join('');
}
loadStatus();loadGal();setInterval(()=>{loadStatus();loadGal()},7000);
</script>
</body></html>`;
}
module.exports = imagegenPageHtml;
