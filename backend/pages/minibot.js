'use strict';
// Mini-bot AI setup help: wizard that generates a ready mini-bot kit
// (Telegram via BotFather) wearing any hierarchy role (e.g. minion worker).
module.exports = function minibotPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Mini-Bot Setup</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:22px;text-align:center}h1{margin:0;font-size:22px;color:#7ef0d0;letter-spacing:2px}
.sub{color:#7d94ad;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px}nav a{color:#7ef0d0;text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
.wrap{max-width:980px;margin:0 auto;padding:0 16px 60px}
.grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:14px}
@media(max-width:860px){.grid{grid-template-columns:1fr}}
.panel{background:#0b1526;border:1px solid #1e3a8a;border-radius:14px;padding:16px}
label{font-size:11px;color:#7d94ad;display:block;margin:10px 0 4px}
input,select{width:100%;background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:9px;font-size:13px}
button{background:#12355e;color:#fff;border:1px solid #1e5a8a;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer;margin-top:12px}
pre{background:#071120;border:1px dashed #23405e;border-radius:10px;padding:12px;font-size:11px;overflow:auto;max-height:480px;color:#cfe3f7}
ol{font-size:12.5px;color:#a9bcd4;line-height:1.7}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/hierarchy">Brains</a><a href="/ops">OPS</a></nav>
<header><h1>🤖 MINI-BOT AI · SETUP HELP</h1><p class="sub">spawn a small Telegram bot wearing any hierarchy role — honest AI identity, your chat only</p></header>
<div class="wrap"><div class="grid">
 <div class="panel"><h3>1 · Wizard</h3>
  <label>Bot name</label><input id="name" value="aura-scout">
  <label>Role to wear (from hierarchy)</label><select id="role"></select>
  <label>Behavior</label><select id="beh"><option>answer from live AURA data (local oracle)</option><option>forward tasks to cognitive core (area 03)</option></select>
  <ol>
   <li>Open Telegram → <b>@BotFather</b> → <code>/newbot</code> → name + username.</li>
   <li>Token → <b>secret manager</b> as <code>TELEGRAM_BOT_TOKEN</code>.</li>
   <li>Your chat id → <code>TELEGRAM_ALLOWED_CHATS</code> (nobody else can talk to it).</li>
   <li>Run the generated kit on a machine with egress: <code>node mini_bot.js</code>.</li>
   <li>It connects back to your AURA backend via <code>AURA_URL</code>.</li>
  </ol>
  <button id="gen">⚙ generate kit</button> <button id="dl">⇩ mini_bot.js</button>
 </div>
 <div class="panel"><h3>2 · Your kit</h3><pre id="out">generate →</pre></div>
</div></div>
<script>
let KIT='';
async function roles(){
 const t=await (await fetch('/api/hierarchy')).json();
 document.getElementById('role').innerHTML=t.filter(n=>n.tier===3).map(n=>'<option value="'+n.id+'">'+n.name+'</option>').join('');
}
async function gen(){
 const rid=document.getElementById('role').value;
 const b=await (await fetch('/api/hierarchy/'+rid+'/bundle')).json();
 const name=document.getElementById('name').value.replace(/[^a-z0-9_-]/gi,'')||'aura-mini';
 KIT=[
 '// '+name+'.js — AURA mini-bot wearing role '+b.name,
 '// Env: TELEGRAM_BOT_TOKEN (secret mgr), TELEGRAM_ALLOWED_CHATS, AURA_URL',
 "const TOKEN=process.env.TELEGRAM_BOT_TOKEN||'';",
 "const ALLOW=(process.env.TELEGRAM_ALLOWED_CHATS||'').split(',').filter(Boolean);",
 "const AURA=(process.env.AURA_URL||'http://localhost:8080').replace(/\\/$/,'');",
 "const ROLE="+JSON.stringify(b.system_prompt)+";",
 "if(!TOKEN){console.error('token missing');process.exit(1);}",
 "const api=(m,b)=>fetch('https://api.telegram.org/bot'+TOKEN+'/'+m,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());",
 'let off=0;',
 'setInterval(async()=>{try{',
 ' const r=await api(\'getUpdates\',{offset:off,timeout:20});',
 ' for(const u of r.result||[]){off=u.update_id+1;const msg=u.message;if(!msg)continue;',
 '  if(ALLOW.length&&!ALLOW.includes(String(msg.chat.id)))continue;',
 "  let txt='';const t=(msg.text||'').trim();",
 "  if(t.startsWith('/task ')){const j=await (await fetch(AURA+'/api/modules/03/action/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:t.slice(6)})})).json();txt='task '+j.trace_id+' → '+j.role;} ",
 "  else {const j=await (await fetch(AURA+'/api/ultra/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({msg:t})})).json();txt='['+ROLE.split('\\n')[1].slice(0,24)+'] '+j.answer;}",
 "  await api('sendMessage',{chat_id:msg.chat.id,text:String(txt).slice(0,4000)});}",
 '}catch(e){console.error(e.message);}},25000);',
 "console.log('mini-bot "+name+" online as "+b.name+"');",
 ].join('\n');
 document.getElementById('out').textContent=KIT;
}
document.getElementById('gen').onclick=gen;
document.getElementById('dl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([KIT],{type:'text/javascript'}));a.download=(document.getElementById('name').value||'mini_bot')+'.js';a.click();};
roles();
</script></body></html>`;
};
