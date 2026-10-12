'use strict';
// AURA · real 3D brain renderer (canvas, zero dependencies)
// Procedural cortex: two wrinkled hemispheres + fissure + cerebellum + brainstem,
// rotating wireframe point cloud in blue neon, synapse pulses fed by LIVE area counts.
// Returns an html snippet: <canvas> + self-running <script>.

module.exports = function brain3dSnippet(canvasId, opts) {
  const o = opts || {};
  const w = o.w || 460, h = o.h || 460;
  // NOTE: embedded script avoids backticks on purpose (page templates are template literals).
  return '<canvas id="' + canvasId + '" class="b3d"></canvas>' +
'<style>#' + canvasId + '{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:' + w + 'px;height:' + h + 'px;max-width:92vw;max-height:78vh;z-index:2;cursor:grab}</style>' +
'<script>(function(){' +
'var cv=document.getElementById("' + canvasId + '");if(!cv)return;var ctx=cv.getContext("2d");' +
'var W=0,H=0,DPR=1;' +
'function rs(){DPR=Math.min(2,window.devicePixelRatio||1);var r=cv.getBoundingClientRect();W=r.width;H=r.height;cv.width=Math.max(60,W*DPR);cv.height=Math.max(60,H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}' +
'rs();addEventListener("resize",rs);' +
// ---------- geometry ----------
'var P=[];' +
'function wr(th,ph){return 0.07*Math.sin(6.5*th)*Math.cos(4.5*ph)+0.05*Math.sin(10*ph+1.7*th)+0.035*Math.sin(8*th+6*ph);}' +
'function cortex(){' +
' var LAT=26,LON=48;' +
' for(var i=1;i<LAT;i++){var th=Math.PI*i/LAT;' +
'  for(var j=0;j<LON;j++){var ph=2*Math.PI*j/LON+(i%2?Math.PI/LON:0);' +
'   var xu=Math.sin(th)*Math.cos(ph),y=Math.cos(th),z=Math.sin(th)*Math.sin(ph);' +
'   if(Math.abs(xu)<0.085)continue;' + // longitudinal fissure
'   var dent=0.16*Math.exp(-Math.pow(xu/0.24,2))*Math.max(y,0);' +
'   var r=1+wr(th,ph)-dent;' +
'   var X=xu*r*1.02,Y=y*r*0.92,Z=z*r*1.42;' +
'   if(Y<-0.30)Y=-0.30+(Y+0.30)*0.52;' + // flattened base
'   P.push([X,Y,Z]);}}}' +
'function ellipsoid(cx,cy,cz,rx,ry,rz,LAT,LON,wf){' +
' for(var i=1;i<LAT;i++){var th=Math.PI*i/LAT;' +
'  for(var j=0;j<LON;j++){var ph=2*Math.PI*j/LON;' +
'   var x=Math.sin(th)*Math.cos(ph),y=Math.cos(th),z=Math.sin(th)*Math.sin(ph);' +
'   var r=1+wf(th,ph);' +
'   P.push([cx+x*r*rx,cy+y*r*ry,cz+z*r*rz]);}}}' +
'cortex();' +
'ellipsoid(0,-0.46,-1.02,0.52,0.34,0.42,16,28,function(th,ph){return 0.05*Math.sin(16*th)+0.03*Math.sin(9*ph);});' + // cerebellum
'ellipsoid(0,-0.66,-0.74,0.15,0.30,0.17,10,14,function(th,ph){return 0.03*Math.sin(7*th);});' + // brainstem
// ---------- edges (k-nearest via spatial hash) ----------
'var E=[],cell={},CS=0.24,THR=0.235,THR2=THR*THR,DEG=[];' +
'for(var i=0;i<P.length;i++){var k=Math.floor(P[i][0]/CS)+":"+Math.floor(P[i][1]/CS)+":"+Math.floor(P[i][2]/CS);(cell[k]=cell[k]||[]).push(i);DEG.push(0);}' +
'for(var i=0;i<P.length;i++){var a=P[i],gx=Math.floor(a[0]/CS),gy=Math.floor(a[1]/CS),gz=Math.floor(a[2]/CS);' +
' for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++)for(var dz=-1;dz<=1;dz++){' +
'  var b=cell[(gx+dx)+":"+(gy+dy)+":"+(gz+dz)];if(!b)continue;' +
'  for(var t=0;t<b.length;t++){var j=b[t];if(j<=i||DEG[i]>3||DEG[j]>3)continue;' +
'   var vx=a[0]-P[j][0],vy=a[1]-P[j][1],vz=a[2]-P[j][2];' +
'   if(vx*vx+vy*vy+vz*vz<THR2){E.push([i,j]);DEG[i]++;DEG[j]++;}}}}' +
// ---------- live feed (pulse rate follows real live-area count) ----------
'var liveN=24;function feed(){fetch("/api/brain").then(function(r){return r.json();}).then(function(b){if(b&&b.counts&&typeof b.counts.live==="number")liveN=b.counts.live;}).catch(function(){});}' +
'feed();setInterval(feed,8000);' +
// ---------- interaction + motion ----------
'var yaw=0.7,pitch=-0.30,vy=0.0045,vx=0,drag=null,auto=true,idle=0;' +
'cv.addEventListener("pointerdown",function(e){drag={x:e.clientX,y:e.clientY};auto=false;cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);cv.style.cursor="grabbing";});' +
'addEventListener("pointermove",function(e){if(!drag)return;yaw+=(e.clientX-drag.x)*0.008;pitch+=(e.clientY-drag.y)*0.005;pitch=Math.max(-1.3,Math.min(1.3,pitch));drag={x:e.clientX,y:e.clientY};idle=0;});' +
'addEventListener("pointerup",function(){drag=null;cv.style.cursor="grab";});' +
// ---------- render ----------
'var FOV=3.1,pulses=[],lastSpawn=0;' +
'function frame(t){' +
' if(!drag){idle++;if(idle>170){auto=true;} if(auto){yaw+=0.0045;pitch=-0.30+0.11*Math.sin(t*0.00023);}}' +
' var cyw=Math.cos(yaw),syw=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);' +
' var S=Math.min(W,H)*0.345,cx=W/2,cyc=H/2;' +
' ctx.clearRect(0,0,W,H);' +
// halo
' var g=ctx.createRadialGradient(cx,cyc,10,cx,cyc,S*1.9);g.addColorStop(0,"rgba(35,120,220,0.20)");g.addColorStop(0.55,"rgba(20,80,160,0.08)");g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);' +
// project all points
' var N=P.length,PX=new Float32Array(N),PY=new Float32Array(N),PZ=new Float32Array(N);' +
' for(var i=0;i<N;i++){var p=P[i];' +
'  var x1=p[0]*cyw+p[2]*syw,z1=-p[0]*syw+p[2]*cyw;' +
'  var y1=p[1]*cp-z1*sp,z2=p[1]*sp+z1*cp;' +
'  var f=FOV/(FOV-z2);PX[i]=cx+x1*f*S;PY[i]=cyc-y1*f*S;PZ[i]=z2;}' +
// sort edges back-to-front
' var ord=E.map(function(e,idx){return [(PZ[e[0]]+PZ[e[1]])*0.5,idx];}).sort(function(a,b){return a[0]-b[0];});' +
' ctx.lineWidth=1;' +
' for(var q=0;q<ord.length;q++){var e=E[ord[q][1]],dep=(ord[q][0]+1.9)/3.8;dep=dep<0?0:dep>1?1:dep;' +
'  var al=0.08+0.60*dep,rC=18+109*dep|0,gC=58+150*dep|0,bC=102+153*dep|0;' + // deep blue -> neon cyan
'  ctx.strokeStyle="rgba("+rC+","+gC+","+bC+","+al+")";' +
'  ctx.beginPath();ctx.moveTo(PX[e[0]],PY[e[0]]);ctx.lineTo(PX[e[1]],PY[e[1]]);ctx.stroke();}' +
// vertices (front-lit)
' for(var i=0;i<N;i++){var dep=(PZ[i]+1.9)/3.8;dep=dep<0?0:dep>1?1:dep;var al=0.18+0.75*dep;' +
'  ctx.fillStyle="rgba("+(120+90*dep|0)+","+(200+40*dep|0)+",255,"+al+")";' +
'  var s=0.7+1.7*dep;ctx.fillRect(PX[i]-s/2,PY[i]-s/2,s,s);}' +
// synapse pulses — spawn rate follows LIVE area count (real data)
' var rate=0.004+liveN*0.0009;' +
' if(t-lastSpawn>1000*rate&&pulses.length<26){lastSpawn=t;pulses.push({i:(Math.random()*N)|0,t0:t});}' +
' for(var u=pulses.length-1;u>=0;u--){var pl=pulses[u],age=(t-pl.t0)/900;' +
'  if(age>1){pulses.splice(u,1);continue;}' +
'  var x=PX[pl.i],y=PY[pl.i],rr=3+age*26,aa=(1-age)*0.9;' +
'  var gg=ctx.createRadialGradient(x,y,0,x,y,rr);gg.addColorStop(0,"rgba(255,255,255,"+aa+")");gg.addColorStop(0.35,"rgba(127,208,255,"+(aa*0.7)+")");gg.addColorStop(1,"rgba(57,150,255,0)");' +
'  ctx.fillStyle=gg;ctx.beginPath();ctx.arc(x,y,rr,0,6.2832);ctx.fill();}' +
' requestAnimationFrame(frame);}' +
'requestAnimationFrame(frame);' +
'})();</script>';
};
