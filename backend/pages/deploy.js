'use strict';
// Deploy & Schnittstellen: HF model search (browser-side), 1-click Ollama,
// MCP config generator, notebook export, n8n/Vercel/Kaggle quick setups.
module.exports = function deployPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Deploy & Schnittstellen</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:22px;text-align:center}h1{margin:0;font-size:22px;letter-spacing:2px;color:#7ef0d0}
.sub{color:#7d94ad;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:#7ef0d0;text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px 50px}
h2{font-size:13px;letter-spacing:2px;color:#f5c96b;margin:26px 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.card{background:#0b1526;border:1px solid #1e3a8a;border-radius:12px;padding:14px}
.card h3{margin:0 0 4px;font-size:13.5px;color:#7fd0ff;word-break:break-all}
.meta{font-size:11px;color:#7d94ad;margin-bottom:8px}
input,select{background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:9px;font-size:13px}
button{background:#12355e;color:#fff;border:1px solid #1e5a8a;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer}
button:hover{filter:brightness(1.2)}
button.gold{background:#f5c96b;color:#0a0c12;border:0;font-weight:800}
pre{background:#071120;border:1px dashed #23405e;border-radius:8px;padding:10px;font-size:11px;overflow:auto;color:#cfe3f7;margin:8px 0 0}
.row{display:flex;gap:8px;flex-wrap:wrap}
.chk{display:flex;gap:6px;align-items:center;font-size:12px;margin:4px 0}
.spin{display:inline-block;animation:sp 1s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/pipelines">Pipelines</a><a href="/yellowpages">Yellow Pages</a><a href="/cluster">Cluster</a></nav>
<header><h1>📦 DEPLOY · SCHNITTSTELLEN</h1><p class="sub">HuggingFace search (runs in your browser) · 1-click Ollama deploys · MCP & notebook interfaces</p></header>
<div class="wrap">
<h2>🤗 HUGGING FACE MODEL SEARCH</h2>
<div class="row"><input id="hq" placeholder="search models… e.g. qwen, llama, mistral" style="flex:1;min-width:240px"><button id="hsearch">Search HF</button></div>
<div class="grid" id="hfres" style="margin-top:12px"></div>

<h2>🐙 GITHUB REPO 1-CLICK DEPLOY + MASTER INSTALL</h2>
<div class="grid">
 <div class="card"><h3>Repo → deploy kit</h3>
  <input id="repo" placeholder="github.com/user/repo (or any git URL)" style="width:100%">
  <select id="target" style="width:100%;margin-top:6px"><option value="vercel">Vercel</option><option value="netlify">Netlify</option><option value="cf">Cloudflare Pages</option><option value="k3s">your k3s collective</option><option value="ghp">GitHub Pages (Actions)</option></select>
  <button id="repogen" style="margin-top:8px">⚙ generate 1-click kit</button>
  <pre id="repoout" hidden></pre><button id="repocopy" hidden>⧉ copy</button>
 </div>
 <div class="card"><h3>Master 1-click install (everything)</h3>
<pre id="masterkit"># AURA master install — one command, kein Schnickschnack
curl -fsSL https://raw.githubusercontent.com/flubber01/aura/arena/0ee9c54c-aura/deploy/master-install.sh | bash
# Node 22 + Repo + Boot + Health-Check auf :8080
# danach: /hub · /ignition · /cluster (Infrastructure Control Room / lokale Planung)</pre>
  <button data-c="curl -fsSL https://raw.githubusercontent.com/flubber01/aura/arena/0ee9c54c-aura/deploy/master-install.sh | bash">⧉ copy</button>
 </div>
</div>
<div class="card" style="margin-top:12px"><h3>📚 DEPLOYMENT DOCS — jeder Aspekt</h3>
 <p style="font-size:12px;color:#9fb2c8;line-height:1.7">Bare Metal · systemd · Docker · bewusste k3s-Topologie · Firebase · Reverse-Proxy/TLS ·
 Env-Variablen · Backup/Restore-Runbook · Monitoring &amp; Alerting · Security-Hardening · Troubleshooting · Validierungs-Sweep.</p>
 <p style="font-size:12px;margin-top:6px">Im Repo: <code>docs/DEPLOYMENT.md</code> + <code>deploy/README.md</code> ·
 Downloads: <a href="/api/download/AURA-DEPLOYMENT.md" style="color:#39d7ff">AURA-DEPLOYMENT.md ⬇</a> ·
 <a href="/api/download/AURA-DEPLOY-KIT.sh" style="color:#39d7ff">AURA-DEPLOY-KIT.sh ⬇</a> ·
 Validierung: <code>node test/validate.js</code></p>
</div>

<h2>⚡ OLLAMA 1-CLICK DEPLOYS</h2>
<div class="grid" id="ollama"></div>

<h2> SCHNITTSTELLEN · MCP / NOTEBOOKS / n8n / VERCEL / KAGGLE</h2>
<div class="grid">
 <div class="card"><h3>MCP config generator</h3>
  <div id="mcptools"></div>
  <label class="chk">Target: <select id="mcptarget" style="width:auto"><option value="claude">Claude Desktop</option><option value="generic">Generic stdio JSON</option></select></label>
  <button id="mcpgen">Generate config</button><pre id="mcpout" hidden></pre><button id="mcpcopy" hidden>⧉ Copy</button>
 </div>
 <div class="card"><h3>Notebook Schnittstelle</h3>
  <p class="meta">Export live backend state (tasks, report, modules) as a markdown notebook.</p>
  <button class="gold" onclick="location.href='/api/notebook-export'">⇩ Download .md notebook</button>
  <p class="meta" style="margin-top:10px">Feed into: NotebookLM (manual), Jupyter via md2ipynb, Observable.</p>
 </div>
 <div class="card"><h3>n8n quick deploy</h3><pre>docker run -it --rm --name n8n -p 5678:5678 \\
 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
# then: HMAC-signed webhooks per area 15 notes</pre></div>
 <div class="card"><h3>Vercel 1-click</h3><pre>npm i -g vercel
vercel login && vercel --prod
# static AURA frontend: vercel deploy extracted/AURA-Web-Deploy/public</pre></div>
 <div class="card"><h3>Kaggle interface</h3><pre>pip install kaggle   # key via secret store / ~/.kaggle
kaggle datasets list -s aura
# opt-in remote compute policy required (area 15)</pre></div>
 <div class="card"><h3>Firebase (zip original)</h3><pre>npm i -g firebase-tools && firebase login
firebase use --add && firebase deploy --only hosting</pre></div>
</div>
</div>
<script>
const OLL=[['llama3.1','8.1B workhorse'],['qwen2.5','strong multilingual (DE)'],['mistral','fast 7B'],['gemma2','Google open weights'],['phi3.5','small & capable'],['deepseek-r1','reasoning']];
document.getElementById('ollama').innerHTML=OLL.map(([m,d])=>'<div class="card"><h3>'+m+'</h3><div class="meta">'+d+'</div><pre>ollama run '+m+'</pre><button data-c="ollama run '+m+'">⧉ copy</button> <button data-c="docker run -d -v ollama:/root/.ollama -p 11434:11434 ollama/ollama">docker ⧉</button></div>').join('');
document.addEventListener('click',e=>{if(e.target.dataset.c){navigator.clipboard.writeText(e.target.dataset.c);e.target.textContent='✓';setTimeout(()=>e.target.textContent=e.target.textContent,900);}});
async function hf(){
 const q=document.getElementById('hq').value||'qwen';
 document.getElementById('hfres').innerHTML='<div class="meta"><span class="spin">◌</span> querying huggingface.co from your browser…</div>';
 try{
  const r=await fetch('https://huggingface.co/api/models?search='+encodeURIComponent(q)+'&limit=9&sort=downloads&direction=-1');
  const j=await r.json();
  document.getElementById('hfres').innerHTML=j.map(m=>'<div class="card"><h3>'+m.id+'</h3><div class="meta">⬇ '+((m.downloads||0)/1000).toFixed(0)+'k/mo · ♥ '+(m.likes||0)+'</div>'+
   '<pre># Ollama Modelfile\nFROM hf.co/'+m.id+'\\nollama create mymodel -f Modelfile\\nollama run mymodel\\n\\n# or vLLM\\ndocker run --gpus all -p 8000:8000 vllm/vllm-openai \\\n  --model '+m.id+'</pre>'+
   '<button data-c="ollama run hf.co/'+m.id+'">⧉ copy ollama</button></div>').join('');
 }catch(e){document.getElementById('hfres').innerHTML='<div class="meta">browser fetch blocked? open <a style="color:#7fd0ff" href="https://huggingface.co/models?search='+encodeURIComponent(q)+'">HF search directly</a>.</div>';}
}
document.getElementById('hsearch').onclick=hf;
document.getElementById('hq').onkeydown=e=>{if(e.key==='Enter')hf();};
// MCP generator from live registry
async function mcplist(){
 const live=await (await fetch('/api/modules/live')).json();
 const t=live.modules.filter(m=>m.mode==='live'&&m.actions.length);
 document.getElementById('mcptools').innerHTML=t.slice(0,10).map(m=>'<label class="chk"><input type="checkbox" class="mcpchk" value="'+m.area+'" checked> area '+m.area+' · '+m.name+'</label>').join('');
}
document.getElementById('mcpgen').onclick=async()=>{
 const areas=[...document.querySelectorAll('.mcpchk:checked')].map(c=>c.value);
 const live=await (await fetch('/api/modules/live')).json();
 const tools={};
 for(const m of live.modules.filter(m=>areas.includes(m.area)))
   tools['aura-'+m.id]={command:'node',args:['backend/src/lib/mcp_bridge.js',m.area],env:{AURA_URL:'http://localhost:8080'}};
 const cfg=document.getElementById('mcptarget').value==='claude'?{mcpServers:tools}:{tools};
 const o=document.getElementById('mcpout');o.hidden=false;o.textContent=JSON.stringify(cfg,null,2);
 document.getElementById('mcpcopy').hidden=false;
};
document.getElementById('mcpcopy').onclick=()=>navigator.clipboard.writeText(document.getElementById('mcpout').textContent);
document.getElementById('repogen').onclick=()=>{
 const repo=document.getElementById('repo').value.trim()||'flubber01/aura';
 const clean=repo.replace(/^https?:\/\/(www\.)?github\.com\//,'').replace(/\.git$/,'');
 const t=document.getElementById('target').value;
 const K={
  vercel:'git clone https://github.com/'+clean+' && cd '+clean.split('/')[1]+'\\nnpm i -g vercel && vercel --prod',
  netlify:'git clone https://github.com/'+clean+'\\nnpm i -g netlify-cli && netlify deploy --prod --dir=public',
  cf:'npm i -g wrangler && wrangler pages deploy public --project-name='+clean.split('/')[1],
  k3s:'git clone https://github.com/'+clean+' /opt/'+clean.split('/')[1]+'\\nkubectl apply -f /opt/'+clean.split('/')[1]+'/deploy/k8s.yml',
  ghp:'# .github/workflows/pages.yml\\non: push\\njobs:\\n  deploy:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - uses: actions/checkout@v4\\n      - uses: actions/upload-pages-artifact@v3\\n        with: {path: public}\\n      - uses: actions/deploy-pages@v4'
 }[t];
 const o=document.getElementById('repoout');o.hidden=false;o.textContent=K;document.getElementById('repocopy').hidden=false;
};
document.getElementById('repocopy').onclick=()=>navigator.clipboard.writeText(document.getElementById('repoout').textContent);
mcplist();
</script></body></html>`;
};
