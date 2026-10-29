/* Read-only client: consumes only /state; no engine or command implementation. */
'use strict';
const $=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d'),viewport=$('viewport');
let background=null,backgroundUrl=null;
let map=null,etag=null,scale=48,offsetX=0,offsetY=0,width=1,height=1,drag=null,failures=0;
const rulerWidth=44,rulerHeight=26;
let pointer=null,selected=null;
function columnName(x){let name='';for(let n=x+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
function squareName(c){return columnName(c.x)+(c.y+1);}
function showSelectedVitals(){
 const entries=selected?(map?.tokens||[]).filter(t=>t.vitals&&selected.x>=t.x&&selected.y>=t.y&&selected.x<t.x+t.size&&selected.y<t.y+t.size):[];
 const text=entries.length?entries.map(t=>{
  const v=t.vitals,extra=[v.temporaryHp>0?`${v.temporaryHp} temporary HP`:null,v.nonlethal>0?`${v.nonlethal} nonlethal`:null].filter(Boolean);
  const conditions=v.conditions.length?v.conditions.map(c=>c.replaceAll('_',' ')).join(', '):'none';
  return `${t.label} · HP ${v.hp} / ${v.maxHp}${extra.length?' · '+extra.join(' · '):''} · Conditions: ${conditions}`;
 }).join('\n'):selected?`No shared vitals at ${squareName(selected)}`:'Click a player token’s square to inspect HP and conditions';
 const panel=$('token-vitals');if(panel.textContent!==text)panel.textContent=text;
}
function squareAt(p){
 if(!map||!p||p.x<rulerWidth||p.y<rulerHeight||p.x>=width||p.y>=height)return null;
 const x=Math.floor((p.x-offsetX)/scale),y=Math.floor((p.y-offsetY)/scale);
 return x>=0&&y>=0&&x<map.map.width&&y<map.map.height?{x,y}:null;
}
function coordinates(){
 const hover=drag?null:squareAt(pointer),active=hover||selected;
 $('coordinate').textContent=active?`${hover?'Square':'Pinned'} ${squareName(active)}${hover&&selected?' · pinned '+squareName(selected):''}`:'Hover a square · click to pin';
 // Coordinates describe public map dimensions only, including unrevealed squares.
 for(const [c,color] of [[selected,'#ffd480'],[hover,'#8be0d8']])if(c){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(offsetX+c.x*scale+1,offsetY+c.y*scale+1,Math.max(0,scale-2),Math.max(0,scale-2));}
 ctx.fillStyle='#111a24';ctx.fillRect(0,0,width,rulerHeight);ctx.fillRect(0,0,rulerWidth,height);
 ctx.strokeStyle='#354452';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(rulerWidth,0);ctx.lineTo(rulerWidth,height);ctx.moveTo(0,rulerHeight);ctx.lineTo(width,rulerHeight);ctx.stroke();
 ctx.font='12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#bdc9d2';
 // Thin labels at distant zoom levels; pointer readout always gives the exact square.
 const columnStep=Math.max(1,Math.ceil(32/scale)),rowStep=Math.max(1,Math.ceil(20/scale));
 ctx.save();ctx.beginPath();ctx.rect(rulerWidth,0,Math.max(0,width-rulerWidth),rulerHeight);ctx.clip();
 for(let x=Math.max(0,Math.floor((rulerWidth-offsetX)/scale));x<map.map.width&&offsetX+x*scale<width;x++){
  if(x%columnStep===0)ctx.fillText(columnName(x),offsetX+(x+.5)*scale,rulerHeight/2);
 }
 ctx.restore();ctx.save();ctx.beginPath();ctx.rect(0,rulerHeight,rulerWidth,Math.max(0,height-rulerHeight));ctx.clip();
 for(let y=Math.max(0,Math.floor((rulerHeight-offsetY)/scale));y<map.map.height&&offsetY+y*scale<height;y++){
  if(y%rowStep===0)ctx.fillText(String(y+1),rulerWidth/2,offsetY+(y+.5)*scale);
 }
 ctx.restore();
}
const floorColors={floor:'#283640',wall:'#60717d',force_wall:'#65547f',difficult:'#4f493d'};
function resize(){const r=viewport.getBoundingClientRect();width=r.width;height=r.height;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
function fit(){if(!map)return;scale=Math.max(1,Math.min(100,(width-rulerWidth-24)/map.map.width,(height-rulerHeight-24)/map.map.height));offsetX=rulerWidth+(width-rulerWidth-map.map.width*scale)/2;offsetY=rulerHeight+(height-rulerHeight-map.map.height*scale)/2;draw();}
function zoom(factor,x=width/2,y=height/2){const next=Math.max(1,Math.min(160,scale*factor));offsetX=x-(x-offsetX)*next/scale;offsetY=y-(y-offsetY)*next/scale;scale=next;draw();}
function label(text,x,y){if(!$('labels').checked||!text||scale<10)return;ctx.font=`500 ${Math.max(10,Math.min(13,scale*.28))}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';const w=ctx.measureText(text).width;ctx.fillStyle='#101923ee';ctx.fillRect(x-w/2-5,y-9,w+10,18);ctx.fillStyle='#eef3f5';ctx.fillText(text,x,y);}
function draw(){
 showSelectedVitals();
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#0b1118';ctx.fillRect(0,0,width,height);$('zoom').textContent=Math.round(scale/48*100)+'%';if(!map)return;
 const px=x=>offsetX+x*scale,py=y=>offsetY+y*scale;
 ctx.fillStyle='#060b10';ctx.fillRect(offsetX,offsetY,map.map.width*scale,map.map.height*scale);
 ctx.strokeStyle='#344653';ctx.lineWidth=1;ctx.strokeRect(offsetX,offsetY,map.map.width*scale,map.map.height*scale);
 for(const c of map.cells){ctx.fillStyle=floorColors[c.terrain]||floorColors.floor;ctx.fillRect(px(c.x),py(c.y),scale+.3,scale+.3);}
 if(background){
  ctx.save();ctx.beginPath();for(const c of map.cells)ctx.rect(px(c.x),py(c.y),scale,scale);ctx.clip();
  const p=map.artwork?.placement;ctx.imageSmoothingEnabled=false;
  if(p){ctx.translate(px(p.x),py(p.y));ctx.rotate(p.rotation*Math.PI/180);ctx.drawImage(background,0,0,p.width*scale,p.height*scale);}
  else ctx.drawImage(background,offsetX,offsetY,map.map.width*scale,map.map.height*scale);
  ctx.restore();
 }
 for(const f of map.features){
  ctx.strokeStyle=f.color;ctx.lineWidth=f.style==='wall'?Math.max(3,scale*.12):Math.max(2,scale*.06);ctx.setLineDash(f.open?[5,5]:[]);
  if(f.cells){for(const c of f.cells){ctx.globalAlpha=f.style==='floor'?1:.4;ctx.fillStyle=f.color;ctx.fillRect(px(c.x),py(c.y),scale,scale);ctx.globalAlpha=1;if(f.style!=='floor')ctx.strokeRect(px(c.x)+2,py(c.y)+2,scale-4,scale-4);}}
  if(f.segments){ctx.beginPath();for(const [a,b] of f.segments){ctx.moveTo(px(a.x),py(a.y));ctx.lineTo(px(b.x),py(b.y));}ctx.stroke();}
  ctx.setLineDash([]);
 }
 if($('grid').checked&&scale>=8){ctx.strokeStyle='#a3bdc21f';ctx.lineWidth=1;ctx.beginPath();for(const c of map.cells)ctx.rect(px(c.x),py(c.y),scale,scale);ctx.stroke();}
 for(const f of map.features){const p=f.cells?.[0]||f.segments?.[0]?.[0];if(p)label(f.label,px(p.x+.5),py(p.y+.5));}
 const groups=new Map();for(const t of map.tokens){const key=t.x+','+t.y;const list=groups.get(key)||[];list.push(t);groups.set(key,list);}
 for(const list of groups.values())for(const [i,t] of list.entries()){
  const stacked=list.length>1,angle=i*Math.PI*2/list.length,cx=px(t.x+t.size/2)+(stacked?Math.cos(angle)*scale*.19:0),cy=py(t.y+t.size/2)+(stacked?Math.sin(angle)*scale*.19:0),radius=Math.max(2,scale*t.size*(stacked?.25:.35));
  ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fillStyle=t.color;ctx.fill();ctx.strokeStyle='#e7f2f3';ctx.lineWidth=Math.max(1,Math.min(2,scale*.04));ctx.stroke();
  if(scale>=14){ctx.font=`700 ${Math.min(28,radius)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#10212b';ctx.fillText((t.label||'?').slice(0,1).toUpperCase(),cx,cy);}
  label(t.label,cx,cy+radius+13);
 }
 coordinates();
}
function accept(data){
 const changedSize=!map||data.map.width!==map.map.width||data.map.height!==map.map.height;
 if(changedSize||data.map.title!==map?.map.title){selected=null;pointer=null;}map=data;
 $('title').textContent=map.map.title||'Encounter map';document.title=map.map.title||'Encounter map';
 $('dimensions').textContent=`${map.map.width} × ${map.map.height} · ${map.map.squareFeet} ft squares`;
 $('empty').hidden=map.cells.length>0;$('empty').textContent='Connected — the GM hasn’t revealed the map yet.';
 if(changedSize)fit();else draw();
}
async function poll(){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('/state',{cache:'no-store',headers:etag?{'If-None-Match':etag}:{},signal:controller.signal});
  if(response.status!==304){if(!response.ok)throw Error('Map unavailable');const data=await response.json();if(data.schema!==1)throw Error('Unknown map format');
   const url=data.artwork?.url??null;
   if(url!==backgroundUrl){
    let next=null;
    if(url){if(!/^\/artwork\/[a-f0-9]{64}\.png$/.test(url))throw Error('Invalid artwork path');const image=await fetch(url,{cache:'no-store',signal:controller.signal});if(!image.ok)throw Error('Artwork unavailable');next=await createImageBitmap(await image.blob());}
    background?.close();background=next;backgroundUrl=url;
   }
   accept(data);etag=response.headers.get('ETag');}
  failures=0;$('connection').textContent='Live';$('lamp').className='live';$('unavailable').hidden=true;
 }catch{failures++;$('connection').textContent='Reconnecting…';$('lamp').className='';$('unavailable').hidden=!map;if(!map)$('empty').textContent='Waiting for the map server…';}
 finally{clearTimeout(timeout);setTimeout(poll,failures?Math.min(5000,750*failures):750);}
}
$('fit').onclick=fit;$('zoom-in').onclick=()=>zoom(1.25);$('zoom-out').onclick=()=>zoom(.8);$('grid').onchange=draw;$('labels').onchange=draw;
viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
function localPointer(e){const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
viewport.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;pointer=localPointer(e);drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};viewport.setPointerCapture(e.pointerId);viewport.focus();});
viewport.addEventListener('pointermove',e=>{
 if(drag&&drag.id!==e.pointerId)return;pointer=localPointer(e);
 if(drag){
  const moved=drag.moved||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;
  if(moved){offsetX+=e.clientX-drag.x;offsetY+=e.clientY-drag.y;drag.moved=true;drag.x=e.clientX;drag.y=e.clientY;}
 }
 draw();
});
viewport.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;pointer=localPointer(e);if(!drag.moved)selected=squareAt(pointer);drag=null;draw();});
for(const type of ['pointercancel','lostpointercapture'])viewport.addEventListener(type,e=>{if(drag?.id===e.pointerId){drag=null;pointer=null;draw();}});
viewport.addEventListener('pointerleave',()=>{if(!drag){pointer=null;draw();}});
viewport.addEventListener('keydown',e=>{if(['+','=','-','0','g','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(['+','='].includes(e.key))zoom(1.25);else if(e.key==='-')zoom(.8);else if(e.key==='0')fit();else if(e.key==='Escape'){selected=null;pointer=null;draw();}else if(e.key==='g'){$('grid').checked=!$('grid').checked;draw();}else{offsetX+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;offsetY+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;draw();}}});
new ResizeObserver(resize).observe(viewport);resize();poll();
