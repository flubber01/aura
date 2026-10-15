'use strict';
// AURA — Skill DB & Departments page (previously inline in server.js).

function skillsPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Skill DB & Departments</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:22px 20px 8px;text-align:center}h1{margin:0;font-size:22px;letter-spacing:2px;color:#39d7ff}
.sub{color:#7d94ad;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px}
nav a{color:#39d7ff;text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
.wrap{max-width:1150px;margin:0 auto;padding:0 18px 40px}
.kpis{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:14px 0}
.kpi{background:#101624;border:1px solid #23304a;border-radius:10px;padding:10px 18px;min-width:100px;text-align:center}
.kpi b{display:block;font-size:20px;color:#39d7ff}.kpi span{color:#7d94ad;font-size:11px}
input,select{background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:8px 12px;font-size:13px}
.controls{display:flex;gap:10px;justify-content:center;margin:14px 0;flex-wrap:wrap}
h2{font-size:13px;letter-spacing:2px;color:#f5c96b;margin:26px 0 10px;text-align:center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.card{background:#0b1526;border:1px solid #1e3a8a;border-radius:12px;padding:14px}
.card h3{margin:0 0 2px;font-size:14px;color:#39d7ff}.card .repo{font-size:11px;color:#60a5fa;word-break:break-all}
.stars{float:right;background:rgba(245,201,107,.12);color:#f5c96b;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700}
.card p{font-size:12px;color:#a9bcd4;margin:8px 0 4px;line-height:1.5}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.tag{font-size:10px;border-radius:10px;padding:1px 8px;background:#132c44;color:#8ab4ff}
.tag.area{background:#0e2c3a;color:#39d7ff}.tag.safe{background:#12351f;color:#4ade80}
.dept{border-left:3px solid var(--c,#39d7ff);background:#0b1526;border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:10px}
.dept h3{margin:0;font-size:13.5px}.dept .roles{margin:6px 0}
.role{display:inline-block;background:#132c44;color:#cfe3f7;border-radius:8px;padding:3px 10px;font-size:11.5px;margin:2px 4px 2px 0;cursor:pointer;border:1px solid transparent}
.role:hover,.role.on{border-color:#39d7ff;color:#39d7ff}
.prompt{background:#071120;border:1px dashed #23405e;border-radius:8px;padding:10px;font-size:12px;color:#cfe3f7;white-space:pre-wrap;margin-top:8px;font-family:ui-monospace,Menlo,monospace}
.copy{background:#f5c96b;border:0;color:#0a0c12;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;margin-top:8px}
</style></head><body>
<nav><a href="/index.html">UI</a><a href="/brain">Brain 2.0</a><a href="/master">Master HUD</a><a href="/console">Console</a></nav>
<header><h1>🧰 AURA SKILL DB · ROLES · PROMPTS</h1>
<p class="sub" id="meta"></p></header>
<div class="wrap">
<div class="kpis" id="kpis"></div>
<div class="controls"><input id="q" placeholder="Search skills (name, category, use case)…" style="width:340px">
<select id="cat"><option value="all">all categories</option></select></div>
<h2>WIRED SKILLS (safety-reviewed)</h2><div class="grid" id="cards"></div>
<h2>DEPARTMENTS · ROLES · PROMPTS</h2><div id="depts"></div>
</div>
<script>
let DB=null;
async function load(){
 const [s,d]=await Promise.all([fetch('/api/skills').then(r=>r.json()),fetch('/api/departments').then(r=>r.json())]);
 DB={s,d};render();
}
function render(){
 const st=DB.s.status;
 document.getElementById('meta').textContent=st.skills+' skills · ~'+Math.round(st.total_stars/1000)+'k combined stars · '+st.workflows+' workflows · '+st.departments+' departments · '+st.roles+' roles';
 document.getElementById('kpis').innerHTML=
  [['skills',st.skills],['combined ★',Math.round(st.total_stars/1000)+'k'],['workflows',st.workflows],['departments',st.departments],['roles',st.roles],['cross-linked areas',st.crosslinked_areas]]
  .map(([a,b])=>'<div class="kpi"><b>'+b+'</b><span>'+a+'</span></div>').join('');
 const cats=[...new Set(DB.s.skills.map(x=>x.category))];
 const sel=document.getElementById('cat');
 if(sel.options.length===1)cats.forEach(c=>sel.add(new Option(c,c)));
 const q=document.getElementById('q').value.toLowerCase(),cat=sel.value;
 document.getElementById('cards').innerHTML=DB.s.skills.filter(x=>(cat==='all'||x.category===cat)&&
   (x.name+x.category+x.use_case+x.tagline).toLowerCase().includes(q))
  .map(x=>'<div class="card"><span class="stars">★'+(x.stars?Math.round(x.stars/1000)+'k':'new')+'</span><h3>'+x.name+'</h3>'+
   '<div class="repo">'+x.repo+'</div><p>'+x.tagline+'<br>'+x.use_case+'</p><div class="tags">'+
   '<span class="tag area">area '+x.area+'</span><span class="tag">'+x.category+'</span><span class="tag">'+x.mode+'</span>'+
   x.crosslinks.map(c=>'<span class="tag">↔ '+c+'</span>').join('')+'</div><p class="safe" style="color:#4ade80;font-size:11px">🛡 '+x.safety+'</p></div>').join('');
 document.getElementById('depts').innerHTML=DB.d.departments.map(dep=>'<div class="dept" style="--c:'+dep.color+'">'+
  '<h3>'+dep.name+' <small style="color:#7d94ad">areas '+dep.areas.join(', ')+'</small></h3><div class="roles">'+
  dep.roles.map(r=>'<span class="role" data-d="'+dep.id+'" data-r="'+r.id+'">'+r.title+' · '+r.level+'</span>').join('')+
  '</div><div class="promptbox" id="pb-'+dep.id+'"><div class="prompt">Pick a role to see its system prompt…</div></div></div>').join('');
 document.querySelectorAll('.role').forEach(el=>el.onclick=async()=>{
  document.querySelectorAll('.role').forEach(x=>x.classList.remove('on'));el.classList.add('on');
  const p=await (await fetch('/api/prompts?dept='+el.dataset.d+'&role='+el.dataset.r)).json();
  document.getElementById('pb-'+el.dataset.d).innerHTML='<div class="prompt">'+p.prompt+'</div><button class="copy" data-t="'+encodeURIComponent(p.prompt)+'">⧉ Copy prompt</button>';
 });
}
document.addEventListener('click',e=>{
 if(e.target.classList.contains('copy')){navigator.clipboard.writeText(decodeURIComponent(e.target.dataset.t));e.target.textContent='✓ copied';}
});
document.getElementById('q').oninput=render;document.getElementById('cat').onchange=render;
load();
</script></body></html>`;
}
module.exports = skillsPageHtml;
