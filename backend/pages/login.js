'use strict';
// Owner auth setup/login page. It never embeds a bootstrap token or password.
// Runde 11: Die Anmeldung funktioniert VOLLSTÄNDIG OHNE JAVASCRIPT — ein
// normales HTML-Formular (POST /api/auth/login-form) mit E-Mail + Passwort.
// Die JS-Karten (Owner-Login, Token-Ablage) bleiben als Komfort darunter und
// bekommen ein <noscript>-Gegenstück.
const adminAuth = require('../src/lib/admin_auth');

function safeNext(value) {
  const next = String(value || '').trim();
  return next.startsWith('/') && !next.startsWith('//') ? next : '/hub';
}

function loginPageHtml(options = {}) {
  const next = safeNext(options.next);
  const ownerSet = adminAuth.ownerConfigured();
  const authArea = ownerSet
    ? `<section id="formLogin">
<label for="email">E-Mail</label>
<input id="email" name="email" type="email" autocomplete="username" required>
<label for="password">Passwort</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<input type="hidden" name="next" value="${next}">
<button type="submit">ANMELDEN</button>
</section>
<p class="foot">Die Sitzung hält 12 Stunden und ist prozess-lokal — nach einem Server-Neustart bitte neu anmelden.</p>`
    : `<div class="notice bad">Erst auf dem Server einrichten: node backend/src/scripts/create-owner.js
Danach diese Seite neu laden und mit E-Mail + Passwort anmelden.</div>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Owner Login</title><style>:root{--bg:#07100c;--panel:#102019;--line:#355c45;--gold:#ecc26f;--text:#eef2e9;--muted:#a8b8aa;--bad:#ffaaa0}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 15% 0,#244c36 0,transparent 45%),var(--bg);color:var(--text);font:14px/1.45 system-ui,sans-serif}.card{width:min(540px,calc(100% - 28px));padding:25px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,#152c20,#0a140f);box-shadow:0 30px 90px #0008}.eyebrow{font-size:10px;letter-spacing:.2em;color:var(--gold);font-weight:800}.brand{font-size:36px;letter-spacing:-.06em;margin:8px 0;color:#f9ecd1}.lead{color:var(--muted)}label{display:block;font-size:11px;color:var(--muted);margin:11px 0 4px}input{width:100%;border:1px solid #41664d;background:#07110c;color:var(--text);border-radius:8px;padding:10px;font:inherit}button{margin-top:13px;border:1px solid #c99e52;background:#3a2c15;color:#ffe7b1;border-radius:8px;padding:10px 12px;font-weight:800;cursor:pointer}.notice{margin-top:15px;border:1px solid #67552f;background:#282113;color:#eed59b;border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap}.notice.bad{border-color:#874b45;background:#351c1b;color:#ffb8ae}.hidden{display:none}.foot{color:var(--muted);font-size:11px;margin-top:15px}.foot a{color:var(--gold)}</style></head><body><main class="card"><div class="eyebrow">AURA / OWNER ACCESS</div><h1 class="brand">SECURE<br>ENTRY</h1><p class="lead">Anmeldung mit E-Mail + Passwort. Kein Token im Browser, kein JavaScript nötig — das Formular hier reicht.</p>
<form method="POST" action="/api/auth/login-form">
${authArea}
</form>
<noscript><div class="notice">JavaScript ist aus — das macht nichts: Das Formular oben (E-Mail + Passwort, Knopf ANMELDEN) funktioniert ohne JavaScript. Nur die Komfort-Karten unten (Token-Ablage im Browser) fallen weg; der Admin-Token bleibt dann ein reiner CLI-/Notfallweg (Header x-aura-token).</div></noscript>
<section id="login" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px"><div class="eyebrow">KOMFORT-KARTE (MIT JAVASCRIPT)</div><label for="jsEmail">E-Mail</label><input id="jsEmail" type="email" autocomplete="username"><label for="password">Passwort</label><input id="password" type="password" autocomplete="current-password"><button id="loginBtn">ANMELDEN (JS-KOMFORT)</button></section><section id="setup" class="hidden"><label>Bootstrap token</label><input id="token" type="password" autocomplete="off"><label>Owner name</label><input id="name" autocomplete="username"><label>New password</label><input id="newPassword" type="password" autocomplete="new-password"><button id="setupBtn">OWNER EINRICHTEN</button></section>
<section id="deposit" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px"><div class="eyebrow">ADMIN-TOKEN-ABLAGE</div><h2 style="font-size:15px;margin:6px 0;color:#f9ecd1">Admin-Token für diese Browsersitzung hinterlegen (Deposit admin token for this browser session)</h2><p class="lead" style="font-size:12px">Der Wert wird nur im sessionStorage dieses Browsers gespeichert — kein Serverruf beim Hinterlegen, gültig bis zum Schließen des Browsers. Ein Testruf an eine Gate-Route prüft ihn ehrlich. Normale Anmeldung: Formular oben mit E-Mail + Passwort.</p><label>Admin-Token (wird als x-aura-token gesendet)</label><input id="auraToken" type="password" autocomplete="off" placeholder="AURA_ADMIN_TOKEN"><button id="depositBtn" type="button">TOKEN HINTERLEGEN</button><div id="depositResult" class="notice hidden"></div></section><div id="notice" class="notice">Loading authentication status …</div><p class="foot">Owner-Setup (einmalig): <code>node backend/src/scripts/create-owner.js</code> · Sitzungen sind prozess-lokal (12 h) — nach einem Server-Neustart bitte neu anmelden. Nach dem HTTPS-Dach kann zusätzlich <code>AURA_AUTH_REQUIRED=true</code> alle Seiten sperren (Standard: aus).</p></main><script>const $=id=>document.getElementById(id);const next=new URLSearchParams(location.search).get('next')||'/hub';async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({error:'Invalid response'}));if(!r.ok)throw Error(j.error||('HTTP '+r.status));return j}async function load(){try{const s=await fetch('/api/auth/status').then(r=>r.json());$('notice').textContent='Mode: '+s.mode+'\\nOwner configured: '+s.owner_configured+'\\nSession secret: '+s.session_secret_mode;$('setup').classList.toggle('hidden',!s.bootstrap_available)}catch(e){$('notice').className='notice bad';$('notice').textContent=e.message}}$('loginBtn').onclick=async()=>{try{await api('/api/auth/login',{email:$('jsEmail').value,password:$('password').value});location.assign(next)}catch(e){$('notice').className='notice bad';$('notice').textContent=e.message}};$('setupBtn').onclick=async()=>{try{await api('/api/auth/bootstrap',{bootstrap_token:$('token').value,name:$('name').value,password:$('newPassword').value});location.assign(next)}catch(e){$('notice').className='notice bad';$('notice').textContent=e.message}};
$('depositBtn').onclick=async()=>{const t=$('auraToken').value.trim();const res=$('depositResult');res.classList.remove('hidden');
 if(!t){res.className='notice bad';res.textContent='Bitte zuerst den Admin-Token eingeben.';return}
 sessionStorage.setItem('aura_token',t); // reiner Browser-Speicher, kein Serverruf
 try{const r=await fetch('/api/modulehub/scan',{method:'POST',headers:{'content-type':'application/json','x-aura-token':t}});
  if(r.ok){res.className='notice';res.textContent='hinterlegt & wirksam (deposited & effective) — Admin-POSTs mit x-aura-token werden akzeptiert. Gültig bis zum Schließen dieses Browsers (sessionStorage).'}
  else{res.className='notice bad';res.textContent=r.status+' — Wort stimmt nicht (word is incorrect) — der Wert ist hinterlegt, aber der Server lehnt ihn ab.'}
 }catch(e){res.className='notice bad';res.textContent='Testruf an die Gate-Route fehlgeschlagen: '+e.message}};
if(sessionStorage.getItem('aura_token')){const dr=$('depositResult');dr.className='notice';dr.textContent='Token bereits in dieser Browsersitzung hinterlegt (sessionStorage) — gültig bis zum Schließen des Browsers.'}
load();</script></body></html>`;
}

// Serverseitig gerenderte ehrliche Fehlerseite nach fehlgeschlagener Anmeldung.
function loginErrorPageHtml(message, next) {
  const target = safeNext(next);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Anmeldung fehlgeschlagen</title><style>:root{--bg:#07100c;--gold:#ecc26f;--text:#eef2e9;--muted:#a8b8aa}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 15% 0,#244c36 0,transparent 45%),var(--bg);color:var(--text);font:14px/1.45 system-ui,sans-serif}.card{width:min(540px,calc(100% - 28px));padding:25px;border:1px solid #874b45;border-radius:18px;background:linear-gradient(145deg,#2a1512,#0a140f)}h1{font-size:24px;margin:6px 0;color:#ffb8ae}.notice{margin-top:15px;border:1px solid #874b45;background:#351c1b;color:#ffb8ae;border-radius:8px;padding:12px;font-size:13px}a{color:var(--gold)}p{color:var(--muted)}</style></head><body><main class="card"><h1>Anmeldung fehlgeschlagen</h1><div class="notice">${String(message || 'Falsche E-Mail oder falsches Passwort.')}</div><p><a href="/login?next=${encodeURIComponent(target)}">← Zurück zur Anmeldung</a></p><p>Kein Sitzungs-Cookie wurde gesetzt.</p></main></body></html>`;
}

module.exports = loginPageHtml;
module.exports.loginPageHtml = loginPageHtml;
module.exports.loginErrorPageHtml = loginErrorPageHtml;
module.exports.safeNext = safeNext;
