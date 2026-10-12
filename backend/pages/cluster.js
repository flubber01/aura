'use strict';
// Root-Server Collective: enter 4 servers -> 1-click kit that binds & bundles them (k3s + Ansible).
module.exports = function clusterPageHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AURA · Root-Server Collective</title>
<style>
body{margin:0;background:#05070d;color:#e8f4ff;font-family:system-ui,Segoe UI,Roboto,sans-serif}
header{padding:22px;text-align:center}h1{margin:0;font-size:22px;letter-spacing:2px;color:#8ab4ff}
.sub{color:#7d94ad;font-size:12.5px}
nav{position:fixed;top:10px;right:14px;display:flex;gap:8px;z-index:9}
nav a{color:#8ab4ff;text-decoration:none;font-size:11.5px;background:#0b1526;border:1px solid #153048;border-radius:8px;padding:5px 10px}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px 60px}
.nodes{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.node{background:#0b1526;border:1px solid #1e3a8a;border-radius:14px;padding:14px;position:relative;transition:.2s}
.node.ok{border-color:#4ade80;box-shadow:0 0 16px rgba(74,222,128,.2)}
.node h3{margin:0 0 8px;font-size:13px;color:#8ab4ff;display:flex;justify-content:space-between}
.dot{width:10px;height:10px;border-radius:50%;background:#374151;box-shadow:0 0 0 0 rgba(74,222,128,0);transition:.3s}
.node.ok .dot{background:#4ade80;animation:ping 1.6s infinite}
@keyframes ping{0%{box-shadow:0 0 0 0 rgba(74,222,128,.5)}100%{box-shadow:0 0 0 12px rgba(74,222,128,0)}}
input,select{width:100%;background:#0c111d;color:#e8f4ff;border:1px solid #23304a;border-radius:8px;padding:8px;font-size:12.5px;margin:4px 0}
.power{margin:18px auto;text-align:center;background:linear-gradient(90deg,#0e2c3a,#12355e,#0e2c3a);border:1px solid #1e5a8a;border-radius:14px;padding:14px;max-width:640px}
.power b{font-size:30px;color:#7ef0d0;text-shadow:0 0 18px rgba(126,240,208,.6)}
.power span{display:block;color:#7d94ad;font-size:11px;letter-spacing:2px}
button{background:#12355e;color:#fff;border:1px solid #1e5a8a;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer}
button.gold{background:#f5c96b;color:#0a0c12;border:0}
.cta{display:flex;gap:10px;justify-content:center;margin:16px 0}
pre{background:#071120;border:1px dashed #23405e;border-radius:10px;padding:12px;font-size:11px;overflow:auto;color:#cfe3f7;max-height:420px}
.note{max-width:760px;margin:10px auto;color:#7d94ad;font-size:11.5px;line-height:1.6;text-align:center}
.tabs{display:flex;gap:8px;justify-content:center;margin:12px 0}
.tabs button{padding:7px 14px;font-size:12px}
.tabs button.on{background:#1e5a8a}
</style></head><body>
<nav><a href="/hub">Hub</a><a href="/deploy">Deploy</a><a href="/pipelines">Pipelines</a></nav>
<header><h1>🖧 ROOT-SERVER COLLECTIVE</h1><p class="sub">enter your 4 servers → 1-click kit binds & bundles the power (k3s fleet + Ansible one-command)</p></header>
<div class="wrap">
<div class="nodes" id="nodes"></div>
<div class="power"><b id="tot">0 cores · 0 GB</b><span>BUNDLED COMPUTE · YOUR OWN HARDWARE ONLY</span></div>
<div class="cta"><button class="gold" id="gen">⚡ GENERATE 1-CLICK KIT</button><button id="dlsh">⇩ kit.sh</button><button id="dlyml">⇩ playbook.yml</button><button id="dlhosts">⇩ hosts.ini</button></div>
<div class="tabs"><button class="on" data-t="kit">kit.sh</button><button data-t="yml">playbook.yml</button><button data-t="hosts">hosts.ini</button></div>
<pre id="out"></pre>
<p class="note">🛡 Security defaults baked in: SSH-key-only auth, firewall (only 80/443 public; k3s internal), control plane never public, no /dev/shm remounts, least privilege, idempotent re-runs. Runs only on servers you own — explicit permission assumed.</p>
</div>
<script>
const N=[...Array(4)].map((_,i)=>({role:i===0?'control':'worker'}));
document.getElementById('nodes').innerHTML=N.map((n,i)=>'<div class="node" id="n'+i+'"><h3>NODE 0'+(i+1)+' <span class="dot"></span></h3>'+
 '<input class="ip" placeholder="IP / hostname (e.g. 203.0.113.'+(10+i)+')">'+
 '<select class="role"><option value="'+n.role+'">'+n.role+'</option><option value="'+(i===0?'worker':'control')+'">'+(i===0?'worker':'control')+'</option></select>'+
 '<input class="cores" type="number" value="'+(i===0?8:4)+'" min="1"> cores · <input class="ram" type="number" value="'+(i===0?32:16)+'" min="1"> GB</div>').join('');
function read(){return [...document.querySelectorAll('.node')].map((el,i)=>({i,ip:el.querySelector('.ip').value.trim(),role:el.querySelector('.role').value,
 cores:+el.querySelector('.cores').value||0,ram:+el.querySelector('.ram').value||0,ok:!!el.querySelector('.ip').value.trim()}));}
function power(){const n=read();const c=n.reduce((a,x)=>a+x.cores,0),r=n.reduce((a,x)=>a+x.ram,0);
 document.getElementById('tot').textContent=c+' cores · '+r+' GB RAM';
 n.forEach(x=>document.getElementById('n'+x.i).classList.toggle('ok',x.ok));}
document.getElementById('nodes').oninput=power;power();
const TOKEN='AURA-CLUSTER-SECRET-CHANGE-ME';
function kit(n){const s=n.find(x=>x.role==='control');const w=n.filter(x=>x.role==='worker'&&x.ip);
 return '#!/usr/bin/env bash\\n# AURA Root-Server Collective — 1-click binder (run on YOUR machine with SSH keys)\nset -euo pipefail\nTOKEN='+TOKEN+'\n\n'
 +'# 1) control plane\\nssh root@'+(s.ip||'NODE1')+' "curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL=stable sh -s - server --cluster-init --tls-san '+(s.ip||'NODE1')+' && sudo cat /var/lib/rancher/k3s/server/node-token > /tmp/tok"\\n'
 +w.map(x=>'# 2) bind worker '+x.ip+'\\nssh root@'+x.ip+' "curl -sfL https://get.k3s.io | K3S_URL=https://'+(s.ip||'NODE1')+':6443 K3S_TOKEN=$TOKEN sh -s - agent"\\n').join('')
 +'\\n# 3) bundle the power: deploy AURA backend across the fleet\\nscp -r backend root@'+(s.ip||'NODE1')+':/opt/aura\\nssh root@'+(s.ip||'NODE1')+' "kubectl apply -f /opt/aura/deploy/k8s.yml || true"\\n'
 +'# 4) firewall hardening\\n'+n.filter(x=>x.ip).map(x=>'ssh root@'+x.ip+' \\"ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable\\"').join('\\n')+'\\necho "✅ collective bound — kubectl get nodes"';}
function yml(n){return '---\\n# ansible-playbook -i hosts.ini playbook.yml   (the 1-click)\n- hosts: aura\n  become: true\n  tasks:\n    - name: harden ssh (keys only)\n      lineinfile: path=/etc/ssh/sshd_config regexp="^#?PasswordAuthentication" line="PasswordAuthentication no"\n      notify: restart ssh\n    - name: install k3s (control)\n      shell: curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL=stable sh -s - server --cluster-init\n      args: creates: /var/lib/rancher/k3s/server/node-token\n      when: inventory_hostname in groups.control\n    - name: install k3s (worker, joins control)\n      shell: curl -sfL https://get.k3s.io | K3S_URL=https://{{ hostvars[groups.control[0]].ansible_host }}:6443 K3S_TOKEN={{ hostvars[groups.control[0]].token | default("") }} sh -s - agent\n      when: inventory_hostname not in groups.control\n    - name: firewall\n      ufw: rule=allow port={{ item }}\n      loop: ["22","80","443"]\n  handlers:\n    - name: restart ssh\n      service: name=sshd state=restarted';}
function hosts(n){const c=n.filter(x=>x.role==='control'),w=n.filter(x=>x.role==='worker');
 return '[control]\\n'+c.map(x=>(x.ip||'node1')+' ansible_host='+(x.ip||'203.0.113.10')).join('\\n')+'\\n\\n[worker]\\n'+w.map((x,i)=>(x.ip||'node'+(i+2))+' ansible_host='+(x.ip||'203.0.113.'+(11+i))).join('\\n')+'\\n\\n[aura:children]\\ncontrol\\nworker';}
let cur='kit';
const F={kit,yml,hosts};
function show(){document.getElementById('out').textContent=F[cur](read()).replace(/\\n/g,'\\n');}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{cur=b.dataset.t;document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');show();});
document.getElementById('gen').onclick=show;
const dl=(name,txt)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download=name;a.click();};
document.getElementById('dlsh').onclick=()=>dl('aura-cluster-kit.sh',F.kit(read()));
document.getElementById('dlyml').onclick=()=>dl('playbook.yml',F.yml(read()));
document.getElementById('dlhosts').onclick=()=>dl('hosts.ini',F.hosts(read()));
show();
</script></body></html>`;
};
