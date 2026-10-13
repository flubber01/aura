'use strict';
// AURA · Steuerzentrale-Seite: Schalter pro Aktion, offene Freigaben entscheiden.
module.exports = function controlPageHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AURA · Steuerzentrale</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#020409;color:#cfe6ff;font:13px/1.5 'Segoe UI',system-ui,sans-serif;min-height:100vh}
main{max-width:1100px;margin:0 auto;padding:28px 16px 40px}
nav{margin:0 0 18px;padding:9px 14px;border:1px solid #1d3a66;border-radius:12px;background:rgba(8,14,30,.85);text-align:center;font-size:13px}
nav a{color:#ffcf7d;margin:0 12px;text-decoration:none;letter-spacing:1px}
h1{font-size:22px;color:#ffcf7d;margin-bottom:6px}
h2{font-size:15px;color:#7fa6d6;margin:22px 0 8px}
.note{color:#7fa6d6;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #14284a;vertical-align:middle}
th{color:#7fa6d6;font-weight:600}
button{background:#080e1e;color:#cfe6ff;border:1px solid #1d3a66;border-radius:8px;padding:5px 10px;font:inherit;cursor:pointer}
button:hover{border-color:#ffcf7d}
.high{color:#ff8a8a}.medium{color:#ffcf7d}.low{color:#7dffb0}
.empty{color:#7fa6d6;padding:10px 0}
</style></head><body><main>
<nav><a href="/hub">Hub</a><a href="/upload">Upload</a><a href="/skills">Skills</a><a href="/board">Board</a><a href="/jarvis">JARVIS</a></nav>
<h1>Steuerzentrale</h1>
<div class="note">Jede Aktion hat einen Schalter. Riskante Aktionen laufen nur, wenn ein Mensch sie freigibt. Schreibende Schritte brauchen den Admin-Token (wird beim ersten Mal abgefragt).</div>
<h2>Offene Freigaben</h2>
<div id="pending"></div>
<h2>Aktionen</h2>
<table><thead><tr><th>Aktion</th><th>Risiko</th><th>Freigabe</th><th>Schalter</th></tr></thead><tbody id="rows"></tbody></table>
<script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const who = () => { let w = sessionStorage.getItem('aura_who'); if(!w){ w = prompt('Dein Name (kein Bot, kein Agent):')||''; sessionStorage.setItem('aura_who', w); } return w; };
async function api(path, body){
  let tok = sessionStorage.getItem('aura_token') || '';
  let r = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','x-aura-token':tok},body:JSON.stringify(body)});
  if(r.status===401){ tok = prompt('Admin-Token:')||''; sessionStorage.setItem('aura_token', tok);
    r = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','x-aura-token':tok},body:JSON.stringify(body)}); }
  return r.json();
}
async function load(){
  const c = await (await fetch('/api/control')).json();
  pending.innerHTML = c.pending.length ? c.pending.map(p=>'<div style="margin:6px 0">'+esc(p.id)+' · <b>'+esc(p.action)+'</b> · angefragt von '+esc(p.by)+' · '+esc(p.at)+
    ' <button data-ap="'+esc(p.id)+'" data-d="approve">freigeben</button> <button data-ap="'+esc(p.id)+'" data-d="deny">ablehnen</button></div>').join('') : '<div class="empty">keine offenen Freigaben</div>';
  rows.innerHTML = c.actions.map(a=>'<tr><td>'+esc(a.name)+'<div style="color:#7fa6d6">'+esc(a.id)+'</div></td><td class="'+esc(a.risk)+'">'+esc(a.risk)+'</td><td>'+(a.approval?'ja':'nein')+'</td><td><button data-act="'+esc(a.id)+'" data-on="'+(a.enabled?'0':'1')+'">'+(a.enabled?'an · ausschalten':'aus · einschalten')+'</button></td></tr>').join('');
}
document.addEventListener('click', async e=>{
  const b=e.target.closest('button'); if(!b) return;
  const by = who(); if(!by) return;
  if(b.dataset.ap){ await api('/api/control/approvals/'+b.dataset.ap,{decision:b.dataset.d,by}); }
  if(b.dataset.act){ await api('/api/control/action/'+b.dataset.act+'/'+(b.dataset.on==='1'?'enable':'disable'),{by}); }
  load();
});
load();
</script>
</main></body></html>`;
};
