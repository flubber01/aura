'use strict';
// Sandboxed web terminal — runs as the sandbox user (NOT root, by design),
// cwd locked to the repo, timeout-locked, kill-switch gated, fully audited.
module.exports = function terminalPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Terminal</title>
<style>
body{margin:0;background:#02040a;color:#d8ffd8;font-family:ui-monospace,Menlo,Consolas,monospace}
header{padding:16px 20px 4px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{margin:0;font-size:16px;color:#4ade80;letter-spacing:2px}
.badge{font-size:10px;border-radius:10px;padding:2px 10px}
.b1{background:#12351f;color:#4ade80}.b2{background:#3a1414;color:#f87171}
#out{margin:10px 16px;background:#04120a;border:1px solid #14532d;border-radius:10px;padding:12px;height:62vh;overflow:auto;font-size:12px;white-space:pre-wrap}
form{display:flex;gap:8px;margin:0 16px 30px}
input{flex:1;background:#04120a;color:#d8ffd8;border:1px solid #14532d;border-radius:8px;padding:10px;font-family:inherit;font-size:13px}
button{background:#14532d;color:#d8ffd8;border:1px solid #4ade80;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer}
nav{margin-left:auto;display:flex;gap:8px}nav a{color:#4ade80;text-decoration:none;font-size:11px}
</style></head><body>
<header><h1>❯_ SANDBOX TERMINAL</h1><span class="badge b1">sandboxed · non-root by design</span><span class="badge b2">audited · kill-gated · 5s timeout</span>
<nav><a href="/ops">OPS</a><a href="/hub">Hub</a></nav></header>
<div id="out">AURA inbound terminal — cwd locked to repo. Every command is audit-logged.
</div>
<form id="f"><input id="cmd" placeholder="e.g. git status  ·  node -v  ·  ls backend/src/lib" autocomplete="off"><button>run ⏎</button></form>
<script>
const out=document.getElementById('out');
document.getElementById('f').onsubmit=async(e)=>{e.preventDefault();
 const c=document.getElementById('cmd').value.trim();if(!c)return;
 out.textContent+='\\n$ '+c;document.getElementById('cmd').value='';
 const r=await fetch('/api/terminal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd:c})});
 const j=await r.json();
 out.textContent+='\\n'+(j.out||'')+(j.err?'\\n[err] '+j.err:'')+(j.error?'\\n⛔ '+j.error:'');
 out.scrollTop=out.scrollHeight;};
</script></body></html>`;
};
