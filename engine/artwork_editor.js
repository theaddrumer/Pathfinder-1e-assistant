'use strict';
const artworkModel=import('/artwork-model.js');
let pickAnchor=null;
const $=id=>document.getElementById(id),fields=['x','y','width','height','rotation'];
let current=null,image=null,png=null,redactions=[],dirty=false,selection=null,pending=null,busy=false,loading=0;
const say=text=>$('status').textContent=text;
const placement=()=>Object.fromEntries(fields.map(k=>[k,Number($(k).value)]));
function setPlacement(p){for(const k of fields)$(k).value=Number(p[k].toFixed(10));}
function mark(){dirty=true;pending=null;$('reviewed').checked=false;draw();}
async function bitmap(value){const response=await fetch('data:image/png;base64,'+value);return createImageBitmap(await response.blob());}
function fit(){if(!current)return;const factor=image?Math.min(current.width/image.width,current.height/image.height):1;setPlacement({x:0,y:0,width:image?image.width*factor:current.width,height:image?image.height*factor:current.height,rotation:0});mark();}
function draw(){
 if(!current)return;
 const canvas=$('preview'),unit=Math.min(48,1200/Math.max(current.width,current.height));
 canvas.width=Math.ceil(current.width*unit);canvas.height=Math.ceil(current.height*unit);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#18242e';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(image){
  const p=placement();ctx.save();ctx.translate(p.x*unit,p.y*unit);ctx.rotate(p.rotation*Math.PI/180);ctx.scale(p.width*unit/image.width,p.height*unit/image.height);
  ctx.drawImage(image,0,0);for(const r of redactions){ctx.fillStyle=r.color;ctx.fillRect(r.x,r.y,r.width,r.height);}ctx.restore();
 }
 ctx.strokeStyle='#d4eaf080';ctx.lineWidth=.7;ctx.beginPath();for(let x=0;x<=current.width;x++){ctx.moveTo(x*unit,0);ctx.lineTo(x*unit,canvas.height);}for(let y=0;y<=current.height;y++){ctx.moveTo(0,y*unit);ctx.lineTo(canvas.width,y*unit);}ctx.stroke();
 const source=$('source');source.width=image?.width||600;source.height=image?.height||100;
 const sc=source.getContext('2d');if(image){sc.drawImage(image,0,0);for(const r of redactions){sc.fillStyle=r.color;sc.fillRect(r.x,r.y,r.width,r.height);}}
 if(selection){sc.strokeStyle='#ffca68';sc.lineWidth=3;sc.strokeRect(selection.x,selection.y,selection.endX-selection.x,selection.endY-selection.y);}
 $('redactions').textContent=`${redactions.length} cover${redactions.length===1?'':'s'}`;
}
async function reload(){
 if(dirty&&!confirm('Discard the unapplied artwork changes and reload?'))return;
 const response=await fetch('/artwork/state',{cache:'no-store'});if(!response.ok)throw Error('Could not load the local GM editor');
 const data=await response.json(),next=data.artwork?.png?await bitmap(data.artwork.png):null;
 image?.close();image=next;current=data;png=data.artwork?.png??null;redactions=data.artwork?.redactions??[];
 setPlacement(data.artwork?.placement??{x:0,y:0,width:data.width,height:data.height,rotation:0});
 $('scene').textContent=`${data.name} · ${data.width} × ${data.height} squares`;
 dirty=false;pending=null;$('reviewed').checked=false;draw();say('Ready. The player view changes only when you apply.');
}
async function importImage(file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>25*1024*1024)throw Error('Choose a PNG, JPEG or WebP file no larger than 25 MiB.');
 const ticket=++loading;let original;
 try{
  original=await createImageBitmap(file);
  if(original.width*original.height>64000000)throw Error('Source exceeds 64 megapixels; resize it first.');
  const {ARTWORK_MAX_BYTES,ARTWORK_MAX_PIXELS,ARTWORK_MAX_SIDE}=await artworkModel;
  const resize=$('resize-import').checked;
  let factor=Math.min(1,ARTWORK_MAX_SIDE/original.width,ARTWORK_MAX_SIDE/original.height,Math.sqrt(ARTWORK_MAX_PIXELS/(original.width*original.height))),value;
  if(factor<1&&!resize)throw Error(`Source is ${original.width} × ${original.height}. Limit: 8192 per side and 16 megapixels. Select “Allow resizing” to import a reduced copy.`);
  const canvas=document.createElement('canvas');
  for(;;){
   canvas.width=Math.max(1,Math.floor(original.width*factor));canvas.height=Math.max(1,Math.floor(original.height*factor));
   canvas.getContext('2d').drawImage(original,0,0,canvas.width,canvas.height);
   value=canvas.toDataURL('image/png').split(',')[1];
   if(value&&value.length<=Math.ceil(ARTWORK_MAX_BYTES/3)*4)break;
   if(!resize)throw Error('Normalized PNG exceeds the import budget. Select “Allow resizing” or choose a smaller source. The current artwork has not changed.');
   factor*=.85;if(canvas.width<128||canvas.height<128)throw Error('Image remains too large; use a smaller source.');
  }
  const next=await bitmap(value);if(ticket!==loading){next.close();return;}
  image?.close();image=next;png=value;redactions=[];pickAnchor=null;fit();
  say(`Imported ${original.width} × ${original.height} → ${image.width} × ${image.height} pixels${factor<1?' (resized with permission)':' (original resolution)'}. Align the grid and cover any printed secrets, then apply.`);
 }finally{original?.close();}
}
async function submit(remove=false){
 if(!current)throw Error('Load the map first.');
 if(!remove&&(!png||!$('reviewed').checked))throw Error('Choose an image and confirm that you checked it for printed secrets.');
 if(remove&&!confirm('Remove the current background? Terrain, tokens and fog will stay unchanged.'))return;
 if(!pending){
  const command=remove?{op:'gm_set_map_artwork',image:null}:{op:'gm_set_map_artwork',image:png,placement:placement(),redactions};
  pending={command,expectedRevision:current.revision,requestId:'artwork_'+crypto.randomUUID(),reason:remove?'GM removes map background using the local artwork editor':'GM imports, aligns and reviews map artwork in the local editor'};
 }else if((pending.command.image===null)!==remove)throw Error('Retry the previous Apply/Remove first, or reload to discard its pending request.');
 const response=await fetch('/artwork/apply',{method:'POST',headers:{'Content-Type':'application/json','X-Tabletop-Editor':'1'},body:JSON.stringify(pending)});
 const data=await response.json();
 if(!response.ok){if(response.status===409){pending=null;throw Error('The encounter changed while you edited. Reload current map before applying again; this prevents overwriting a newer map.');}pending=null;throw Error(data.error||'Artwork was rejected.');}
 current.revision=data.revision;pending=null;dirty=false;
 if(remove){image?.close();image=null;png=null;redactions=[];draw();}
 say(remove?'Background removed.':'Artwork applied and saved. The live player map will update within a moment.');
}
function work(fn){return async()=>{if(busy)return;busy=true;for(const el of document.querySelectorAll('button,input'))el.disabled=true;try{await fn();}catch(e){say(e.message);}finally{busy=false;for(const el of document.querySelectorAll('button,input'))el.disabled=false;}};}
for(const k of fields)$(k).oninput=mark;
$('file').onchange=work(()=>importImage($('file').files[0]));$('fit').onclick=fit;
$('reload').onclick=work(reload);$('apply').onclick=work(()=>submit());$('remove').onclick=work(()=>submit(true));
$('undo-cover').onclick=()=>{if(redactions.length){redactions.pop();mark();}};
function point(e){const r=$('source').getBoundingClientRect();return {x:Math.max(0,Math.min(image.width,Math.round((e.clientX-r.left)/r.width*image.width))),y:Math.max(0,Math.min(image.height,Math.round((e.clientY-r.top)/r.height*image.height)))};}
$('source').onpointerdown=e=>{if(busy||!image||e.button!==0)return;const p=point(e);
 if(pickAnchor){$(pickAnchor+'-sx').value=p.x;$(pickAnchor+'-sy').value=p.y;pickAnchor=null;say('Point recorded. Check its matching grid intersection, then calibrate.');return;}
 if(!$('redact').checked)return;selection={...p,endX:p.x,endY:p.y};$('source').setPointerCapture(e.pointerId);};
$('source').onpointermove=e=>{if(!selection)return;const p=point(e);selection.endX=p.x;selection.endY=p.y;draw();};
$('source').onpointerup=e=>{if(!selection)return;const p=point(e),s=selection;selection=null;const x=Math.min(s.x,p.x),y=Math.min(s.y,p.y),width=Math.abs(p.x-s.x),height=Math.abs(p.y-s.y);if(width&&height&&redactions.length<100){redactions.push({x,y,width,height,color:$('color').value});mark();}else draw();};
$('source').onpointercancel=()=>{selection=null;draw();};
for(const id of ['a','b'])$('pick-'+id).onclick=()=>{pickAnchor=id;say(`Click printed grid intersection ${id.toUpperCase()} on the source image below.`);};
$('calibrate').onclick=work(async()=>{
 if(!image)throw Error('Import an image first.');
 const points=['a','b'].map(id=>({source:{x:Number($(id+'-sx').value),y:Number($(id+'-sy').value)},grid:{x:Number($(id+'-gx').value),y:Number($(id+'-gy').value)}}));
 const {calibrateArtwork}=await artworkModel;setPlacement(calibrateArtwork(image,{points}));mark();
 say('Calibration applied to preview. Check a third intersection, review printed secrets, then apply artwork.');
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
work(reload)();
