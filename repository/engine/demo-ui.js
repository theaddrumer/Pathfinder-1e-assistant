let game = new Game();
let mode = 'move';
let effectSequence = 1;
let latestCommand = {op:'(choose an action)'};
let notice = 'Select Move, Five-foot step, or Attack, then click a square.';
const $ = id => document.getElementById(id);
const showSigned = n=>n>=0?`+${n}`:`${n}`;
const tileKey=(x,y)=>`${x},${y}`;

function command(cmd,role='actor') {
  latestCommand=cmd;
  return game.dispatch(cmd,role);
}
function take(action) {
  try { const result=action();notice='Action completed.';render();return result; }
  catch(err) {notice=`Cannot do that: ${err.message}`;render();return null;}
}
function pathTo(id,tx,ty,step=false) {
  const c=game.find(id);
  if(tx===c.x && ty===c.y) return [];
  const moves=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  // Tiny Dijkstra pathfinder; include diagonal parity in search state.
  const queue=[{x:c.x,y:c.y,cost:0,diags:0,path:[]}];
  const best=new Map([[`${c.x},${c.y},0`,0]]);
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);
    const state=queue.shift();
    if(state.x===tx && state.y===ty) return state.path;
    if(state.path.length>=18)continue;
    for(const [dx,dy] of moves){
      const x=state.x+dx,y=state.y+dy;
      if(!game.legalPosition(id,x,y))continue;
      const diagonals=state.diags+(dx&&dy?1:0);
      const cost=state.cost+game.moveCost(id,x,y,diagonals,!!(dx&&dy));
      const k=`${x},${y},${diagonals%2}`;
      if(cost>c.speed/5 && !step)continue;
      if(step && state.path.length>=1)continue;
      if(best.has(k)&&best.get(k)<=cost)continue;
      best.set(k,cost);
      queue.push({x,y,cost,diags:diagonals,path:[...state.path,{x,y}]});
    }
  }
  return null;
}
function tokenAt(x,y){
  return game.s.creatures.find(c=>c.hp>0&&game.footprint(c).some(p=>p.x===x&&p.y===y));
}
function clickSquare(x,y){
  const active=game.active();
  take(()=>{
    if(game.s.interrupt)throw new Error('Resolve the AoO first.');
    if(mode==='attack'){
      const victim=tokenAt(x,y);
      if(!victim||victim.id===active.id)throw new Error('Select an enemy token to attack.');
      return command({op:'attack',actor:active.id,target:victim.id});
    }
    const step=mode==='step';
    const path=pathTo(active.id,x,y,step);
    if(!path?.length)throw new Error('No legal route to that square within the available movement.');
    return command({op:'move',actor:active.id,path,step});
  });
}
function applyBuff(){
  take(()=>{
    const c=game.active();
    return command({op:'apply_effect',effect:{id:`buff-${effectSequence++}`,name:'Sample Strength Enhancement',source:c.id,target:c.id,rounds:2,
       mods:[{stat:'str',type:'enhancement',value:4}]}},'gm');
  });
}
function applyMenace(){
  take(()=>{
    return command({op:'apply_effect',effect:{id:`menace-${effectSequence++}`,name:'Sample Menace Aura',source:'warden',target:'hero',rounds:3,
       untilHitSource:true,mods:[{stat:'attack',type:'untyped',value:-2},{stat:'ac',type:'untyped',value:-2},{stat:'saves',type:'untyped',value:-2}]}},'gm');
  });
}
function applyDisplacement(){
  take(()=>{
    const target=game.active().id;
    const save=command({op:'save',target,save:'fort',dc:18},'gm');
    if(!save.success)return command({op:'random_teleport',target,range:2},'gm');
    return save;
  });
}
function render(){
  const s=game.s, active=game.active();
  $('round').textContent=s.round;
  $('active').textContent=active.name;
  $('notice').textContent=notice;
  $('status').textContent=s.interrupt?'INTERRUPT AWAITING DECISION':`Current tool: ${mode==='step'?'Five-foot step':mode==='attack'?'Attack':'Move'}`;
  $('status').className=s.interrupt?'status stop':'status';
  for(const button of document.querySelectorAll('[data-mode]'))button.classList.toggle('on',button.dataset.mode===mode);
  const board=$('board');board.innerHTML='';
  for(let y=0;y<s.height;y++) for(let x=0;x<s.width;x++){
    const tile=document.createElement('button');tile.type='button';tile.className='tile';tile.title=`(${x},${y})`;
    tile.dataset.tile=`${x},${y}`;
    const terrain=game.tileKind(x,y);
    if(terrain!=='open')tile.classList.add(terrain);
    if(game.threatens('warden','hero',x,y))tile.classList.add('threatened');
    const c=tokenAt(x,y);
    if(c){
      const isAnchor=c.x===x&&c.y===y;
      if(isAnchor){
        const token=document.createElement('div');token.className=`token ${c.team==='party'?'party':'enemy'}`;
        token.textContent=c.id==='hero'?'E':'W';token.title=c.name;
        tile.append(token);
      } else {
        const footprint=document.createElement('span');footprint.className='bodypart';tile.append(footprint);
      }
      if(c.id===active.id)tile.classList.add('active-token');
    }
    tile.addEventListener('click',()=>clickSquare(x,y));board.append(tile);
  }
  const stats=$('creatures');stats.innerHTML='';
  for(const c of s.creatures){
    const card=document.createElement('section');card.className=`creature ${c.id===active.id?'selected':''}`;
    const hp=Math.max(0,Math.min(100,100*c.hp/c.maxHp));
    const lines=[
      `<div class="creature-top"><strong>${c.name}</strong><span>${c.size===2?'Large':'Medium'} • Reach ${c.reach*5} ft</span></div>`,
      `<div class="hp"><div style="width:${hp}%"></div></div>`,
      `<div class="numbers"><b>${c.hp}/${c.maxHp} HP</b><span>AC ${game.stat(c.id,'ac')}</span><span>Attack ${showSigned(game.stat(c.id,'attack'))}</span></div>`,
      `<div class="numbers subtle"><span>Fort ${showSigned(game.stat(c.id,'fort'))}</span><span>Ref ${showSigned(game.stat(c.id,'ref'))}</span><span>Will ${showSigned(game.stat(c.id,'will'))}</span></div>`
    ];
    card.innerHTML=lines.join('');
    const effects=s.effects.filter(e=>e.target===c.id);
    if(effects.length){
      const badges=document.createElement('div');badges.className='effects';
      for(const e of effects){const span=document.createElement('span');span.className='effect';span.textContent=e.name+(e.remaining?` (${e.remaining} turns)`:'');badges.append(span);}
      card.append(badges);
    }
    stats.append(card);
  }
  $('command').textContent=JSON.stringify(latestCommand,null,2);
  const log=$('log');log.innerHTML='';
  for(const line of s.log.slice(-13).reverse()){
    const entry=document.createElement('div');entry.className='log-entry';entry.textContent=line;log.append(entry);
  }
  const interrupt=$('interrupt');interrupt.hidden=!s.interrupt;
  if(s.interrupt){
    $('interrupt-text').textContent=`${game.find(s.interrupt.reactor).name} can attack ${game.find(s.interrupt.target).name} before movement continues.`;
  }
  $('action-state').textContent=`Standard: ${s.actions.resources.standard} · Move: ${s.actions.resources.move} · Swift: ${s.actions.resources.swift} · Step: ${s.actions.step?'used':s.actions.moved?'blocked':'available'}`;
}
for(const el of document.querySelectorAll('[data-mode]')) el.addEventListener('click',()=>{mode=el.dataset.mode;notice='Click a destination square (or an enemy when attacking).';render();});
$('take-aoo').addEventListener('click',()=>take(()=>command({op:'resolve_interrupt',take:true})));
$('decline-aoo').addEventListener('click',()=>take(()=>command({op:'resolve_interrupt',take:false})));
$('buff').addEventListener('click',applyBuff);
$('menace').addEventListener('click',applyMenace);
$('displace').addEventListener('click',applyDisplacement);
$('end-turn').addEventListener('click',()=>take(()=>command({op:'end_turn'})));
$('undo-turn').addEventListener('click',()=>take(()=>command({op:'undo_turn'},'gm')));
$('undo-round').addEventListener('click',()=>take(()=>command({op:'undo_round'},'gm')));
$('reset').addEventListener('click',()=>{game=new Game();effectSequence=1;latestCommand={op:'reset'};notice='Battlefield reset.';mode='move';render();});
render();
