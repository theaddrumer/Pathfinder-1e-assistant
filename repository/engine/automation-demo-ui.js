// Browser controls for the current active creature, whether Explorer or NPC.
// This is a local GM-operated test harness, not an autonomous monster AI.
let instance=createScenario('registry');
const exampleCreature={
  creatureType:'humanoid',subtypes:[],
  id:'marsh-raider-v1',name:'Marsh Raider',source:'Fictional example; replace with a verified rulebook statblock',
  stats:{maxHp:26,hp:26,hitDiceCount:4,size:1,reach:1,speed:30,str:16,dex:12,con:14,int:9,wis:10,cha:8,
    bab:3,damageDie:6,damageOther:0,statTotals:{ac:18,touchAc:11,flatFootedAc:17,initiative:1,attack:7,damage:4,fort:5,ref:2,will:1},
    abilityLinks:{attack:['str'],damage:['str'],fort:['con'],ref:['dex'],will:['wis'],ac:['dex'],touchAc:['dex'],initiative:['dex']},
    skills:{Perception:6,Intimidate:4},equipment:[{id:'club',name:'Club',location:'held',hp:10,maxHp:10,hardness:5}],attacks:[{label:'Club',itemId:'club',attackOffset:0,damageDie:6}]}
};
const exampleEffect={
  id:'shaken',name:'Shaken',source:'PF1e shaken penalty (GM sets duration)',
  mods:[{stat:'attack',value:-2},{stat:'saves',value:-2},
        {stat:'skill_checks',value:-2},{stat:'ability_checks',value:-2}]
};

const sampleAilment={
  id:'marsh-venom-v1',name:'Marsh Venom (fictional)',kind:'poison',delivery:'injury',
  source:'Fictional sample; configure from the actual monster or adventure text',
  save:{type:'fort',dc:14},frequency:{every:{count:1,unit:'round'},maxTicks:6},
  cure:{successes:2,consecutive:true},
  effects:[{kind:'ability_damage',ability:'str',dice:{count:1,sides:4}}]
};

let active=false,mode='move',lastCommand={op:'(none yet)'},lastTimeOutcome=null,magicPreview=null;
const $=id=>document.getElementById(id);
const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
function interact(cmd, role='actor'){
  lastCommand=cmd;
  return instance.dispatch(cmd,role);
}
function doSafe(fn){
  try{
    const result=fn();
    const resolution=result?.result??result;
    $('notice').className='status';
    if(resolution?.advisories?.length){$('notice').textContent='ADVISORY: '+resolution.advisories.join(' / ');
    } else if(instance.s.interrupt?.type==='rider_choice') {
      const pending=instance.s.pendingRider;
      $('notice').textContent=['pull','push'].includes(pending.kind)?`${instance.find(pending.actor).name} may ${pending.kind} ${instance.find(pending.target).name} ${pending.feet} ft. after the hit; choose Attempt or Decline.`:pending.kind==='trip'?`${instance.find(pending.actor).name} hit ${instance.find(pending.target).name}; choose free Trip or Decline in the decision box.`:`${instance.find(pending.actor).name} hit ${instance.find(pending.target).name}; choose Normal Grab, appendage-only Grab (−20 CMB), or Decline in the decision box.`;
    } else if(resolution?.status==='pending_events_warning') {
      $('notice').textContent=resolution.warning.message+' No time advanced. Press Fast Forward again to confirm, or inspect/cancel the event first.';
    } else if(resolution?.status==='needs_gm') {
      $('notice').textContent=resolution.clock?`Fast Forward paused at ${resolution.clock.label}: ${resolution.pending.label}. GM input required; ${resolution.remainingRounds} round(s) remain in the requested interval.`:
        `Casting paused: ${resolution.reason}. ${instance.remainingCounterspells().length?'Resolve readied counterspells in Time & Events.':resolution.threats?.length?'Potential AoOs: '+resolution.threats.join(', '):'Resolve the remaining choices in the spellcasting panel.'}`;
    } else if(resolution?.clock && lastCommand.op.startsWith('gm_')) {
      $('notice').textContent=`Game time: ${resolution.clock.label}. See the clock and event summary in Time & Events.`;
    } else if(resolution?.status==='interrupt'&&instance.s.interrupt) {
      const reaction=instance.s.interrupt;
      $('notice').textContent=reaction.type==='ranged_action_aoo'?`${instance.find(reaction.reactor).name} may take an AoO before ${instance.find(reaction.target).name} ${reaction.reason==='shot'?'fires':reaction.reason==='spell'?'fires a ray spell':reaction.reason==='stand'?'stands up':'reloads'}.`:reaction.type==='overrun_avoid'?`${instance.find(reaction.reactor).name} must choose whether to avoid the Overrun. Use the highlighted decision buttons above the grid.`:`${instance.find(reaction.target).name} is still in its departure square. ${instance.find(reaction.reactor).name} may take an AoO; resolve the highlighted choice before the action continues.`;
    } else if(result?.status==='holding_charge'){
      $('notice').textContent='Touch charge retained. Choose its target in Held touch spells, or continue moving before delivery.';
    } else if(result?.status==='ready'){
      $('notice').textContent='Free Mode selected: click a destination tile on the grid. The selected GM target is the creature that moves.';
    } else if(result?.charge) {
      const charged=instance.s.creatures.find(c=>c.id===result.charge.target);
      $('notice').textContent=`Charge completed against ${charged?.name||result.charge.target}; attack ${result.attack.hit?'HIT':'missed'}. Charging AC penalty persists until the start of the charger’s next turn.`;
    } else if(result?.status==='awaiting_attack') {
      $('notice').textContent=`Full attack in progress: ${result.remaining} strike(s) remaining. Choose the next enemy with FULL ATTACK or switch to 5-FOOT STEP before continuing. Use Finish full attack to forgo the rest.`;
    } else if(lastCommand.op==='move' && lastCommand.step) {
      $('notice').textContent='Five-foot step completed. No other movement is allowed this turn, even if move actions remain. Other legal actions may still be taken.';
    } else if(result?.registered){
      $('notice').textContent=`Definition ${result.registered} registered and available for reuse.`;
    } else if(result?.spawned){
      $('notice').textContent=`Created ${result.spawned} at (${result.at.x}, ${result.at.y}) using ${result.definition}.`;
    } else if(result?.effectId){
      $('notice').textContent=`Effect ${result.effectId} ${result.refreshed?'refreshed':'applied'}; ${result.remaining??'unlimited'} round(s) remaining.`;
    } else if(result&&result.rolls){
      $('notice').textContent=`${result.kind.toUpperCase()} ${result.rolls.join(' + ')} ${result.bonus>=0?'+':''}${result.bonus} = ${result.total}; ${result.applied} ${result.kind==='damage'?'damage':'healing'} applied.`;
    } else if(result&&result.d20!==undefined&&result.bonus!==undefined&&result.hit===undefined){
      $('notice').textContent=`Check: d20 ${result.d20} + ${result.bonus} = ${result.total}; ${result.success?'SUCCESS':'FAILURE'}.`;
    } else {
      $('notice').textContent='Action resolved; see the automatic event log.';
    }
  }catch(e){$('notice').className='status error';$('notice').textContent=e.message;}
  render();
}
function tokensAt(x,y){return instance.s.creatures.filter(c=>instance.occupiesSpace(c)&&instance.footprint(c).some(p=>p.x===x&&p.y===y));}
function tokenAt(x,y){const occupants=tokensAt(x,y);return occupants.find(c=>c.id===$('map-stack-target').value)||occupants[0];}
function route(actorId,tx,ty,step=false,maxSpeed=null){
  const c=instance.find(actorId),steps=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const queue=[{x:c.x,y:c.y,cost:0,diags:0,path:[]}],best=new Map([[`${c.x},${c.y},0`,0]]);
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);
    const v=queue.shift();if(v.x===tx&&v.y===ty)return v.path;
    if(step&&v.path.length===1)continue;
    for(const [dx,dy] of steps){
      const x=v.x+dx,y=v.y+dy;
      if(!instance.legalPosition(actorId,x,y))continue;
      const diags=v.diags+(dx&&dy?1:0),cost=v.cost+instance.moveCost(actorId,x,y,diags,!!(dx&&dy)),k=`${x},${y},${diags%2}`;
      if(cost>(maxSpeed??c.speed)/5||(best.has(k)&&best.get(k)<=cost))continue;
      best.set(k,cost);
      queue.push({x,y,cost,diags,path:[...v.path,{x,y}]});
    }
  }
  return null;
}
function clickCell(x,y){doSafe(()=>{
  if(!active)throw new Error('Activate the encounter first.');
  if(instance.s.interrupt)throw new Error('An interrupt decision is pending. Resolve it in the box above the grid before taking further actions.');
  if(instance.s.pendingFullAttack&&!['full_attack','step'].includes(mode))throw new Error('Finish the full attack: select an enemy in FULL ATTACK mode, take a 5-foot step, or click Finish full attack.');
  if(['move','move_standard','double_move'].includes(mode) && instance.s.actions.step)throw new Error('A five-foot step was already taken this turn. PF1e forbids other movement this turn, even with Quickness move actions remaining.');
  if(mode==='gm_free'){
    const subject=$('gm-target').value,feet=Number($('gm-override-feet').value),reason=$('gm-override-reason').value;
    if(!instance.legalPosition(subject,x,y))throw new Error('Free movement requires a legal destination square.');
    const path=route(subject,x,y,false,feet);
    if(!path?.length)throw new Error('No reachable path within the GM-authorized distance.');
    return interact({op:'gm_adjudicate',kind:'move_free',actor:subject,path,allowanceFeet:feet,reason},'gm');
  }
  const actor=instance.active(),target=tokenAt(x,y);
  if(mode==='full_attack'){
    if(!target||target.id===actor.id)throw new Error('Select another creature for the next full-attack strike.');
    const op=instance.s.pendingFullAttack?'full_attack_next':'full_attack';
    return interact({op,actor:actor.id,target:target.id,...($('combat-precision-eligible').checked?{precisionEligible:true}:{}),...(op==='full_attack'?{combatOptions:JSON.parse($('combat-options').value||'{}')}:{})});
  }
  if(mode==='charge'){
    if(!target||target.id===actor.id)throw new Error('Select another creature to charge. The engine calculates the closest legal attacking square.');
    return interact({op:'charge',actor:actor.id,target:target.id,combatOptions:JSON.parse($('combat-options').value||'{}')});
  }
  if(mode==='attack'){
    if(!target||target.id===actor.id)throw new Error('Select another creature to attack.');
    return interact({op:'attack',actor:actor.id,target:target.id,index:Number($('combat-attack-index').value),...($('combat-precision-eligible').checked?{precisionEligible:true}:{}),combatOptions:JSON.parse($('combat-options').value||'{}')});
  }
  if(target)throw new Error('Destination is occupied. Choose an empty square.');
  if(mode==='crawl')return interact({op:'crawl',actor:actor.id,path:[{x,y}]});
  const step=mode==='step',path=route(actor.id,x,y,step,mode==='double_move'?actor.speed*2:actor.speed);
  if(!path?.length)throw new Error(step?'Select an adjacent open square for a five-foot step.':'No legal path within the selected movement budget.');
  return interact(mode==='double_move'?{op:'double_move',actor:actor.id,path}:{op:'move',actor:actor.id,path,step,asStandard:mode==='move_standard'});
});}
function testAction(op){return doSafe(()=>{
  if(!active)throw new Error('Activate the encounter first.');
  if(instance.s.interrupt)throw new Error('Resolve the pending interrupt.');
  if(op==='enter')return interact({op:'move',actor:'hero',path:[{x:1,y:4}]});
  if(op==='slash')return interact({op:'admin_damage',target:'warden',source:'hero',amount:16,damageType:'slashing',cause:'weapon'},'gm');
  if(op==='fire')return interact({op:'admin_damage',target:'warden',source:'hero',amount:16,damageType:'fire',cause:'spell'},'gm');
  if(op.startsWith('choker-')){
    if(instance.active().id!=='warden')throw new Error('End Explorer’s turn first, then control Choker.');
    if(op==='choker-move'){
      const c=instance.find('warden');
      // One-square convenience button; manual grid movement may use full speed.
      const candidates=[{x:c.x+1,y:c.y},{x:c.x-1,y:c.y},{x:c.x,y:c.y+1},{x:c.x,y:c.y-1}];
      const dest=candidates.find(p=>instance.legalPosition(c.id,p.x,p.y));
      if(!dest)throw new Error('No free adjacent square: use the grid to select a destination.');
      return interact({op:'move',actor:c.id,path:[dest]});
    }
    if(op==='choker-standard')return interact({op:'use_action',actor:'warden',type:'standard',label:'test-only standard action (no mechanical effect)'});
    if(op==='choker-full')return interact({op:'use_action',actor:'warden',type:'full_round',label:'test-only full-round action (no mechanical effect)'});
  }
  if(op==='hit'){
    lastCommand={op:'emit',name:'hit',actor:'hero',target:'warden'};
    instance.emit('hit',{actor:'hero',target:'warden'});
    return {status:'done'};
  }
  throw new Error('Unrecognized test');
});}
function render(){
  const areas=instance.persistentAreasOverview(),areaSelect=$('area-active'),priorArea=areaSelect.value;
  areaSelect.replaceChildren(...areas.map(a=>{const o=E('option','',`${a.label} [${a.id}] — ${a.remainingRounds} round(s)`);o.value=a.id;return o;}));
  if(areas.some(a=>a.id===priorArea))areaSelect.value=priorArea;
  $('area-remove').disabled=!areas.length;
  $('area-state').textContent=areas.length?JSON.stringify(areas.map(({cells,...a})=>a),null,2):'No persistent areas.';
  const regionCells=new Map();
  for(const a of areas)for(const cell of a.cells){const key=`${cell.x},${cell.y}`;regionCells.set(key,[...(regionCells.get(key)||[]),a.label]);}
  const s=instance.s,fixture=$('scenario').value,actor=instance.active(),budget=s.actions.resources;
  $('map-state').textContent=JSON.stringify({width:s.width,height:s.height,name:s.scene.name,established:s.scene.established,features:(s.scene.features||[]).map(f=>({id:f.id,preset:f.preset,doorState:f.doorState,active:mapFeatureActive(s,f),elevationTransition:f.elevationTransition})),advisories:instance.spatialAdvisories()},null,2);
  const doorSelect=$('map-door'),oldDoor=doorSelect.value;doorSelect.replaceChildren(...instance.mapFeatures().filter(f=>f.doorState!==undefined).map(f=>{const o=E('option','',`${f.name||f.id}: ${f.doorState}`);o.value=f.id;return o;}));if([...doorSelect.options].some(o=>o.value===oldDoor))doorSelect.value=oldDoor;
  $('map-door-open').disabled=$('map-door-close').disabled=!doorSelect.value;
  const stackSelect=$('map-stack-target'),chosenStack=stackSelect.value;
  stackSelect.replaceChildren(E('option','','First occupant'),...s.creatures.map(c=>{const o=E('option','',`${c.name} [${c.id}]${c.elevation?` — ${c.elevation.feet} ft (${c.elevation.layer||'ground'})`:''}`);o.value=c.id;return o;}));
  stackSelect.options[0].value='';if(s.creatures.some(c=>c.id===chosenStack))stackSelect.value=chosenStack;
  const fillSummon=(id,empty=false)=>{
    const select=$(id),old=select.value;select.replaceChildren();
    if(empty){const o=E('option','','None / current initiative count');o.value='';select.append(o);}
    for(const c of s.creatures){const o=E('option','',c.name);o.value=c.id;select.append(o);}
    if([...select.options].some(o=>o.value===old))select.value=old;
  };
  fillSummon('summon-target');fillSummon('summon-source',true);
  for(const id of ['health-target','basic-actor','object-target','fall-target']){
    const select=$(id),old=select.value;
    const rows=s.creatures.filter(c=>id==='object-target'?!!c.objectProfile:!c.objectProfile);
    select.replaceChildren(...rows.map(c=>{const o=E('option','',c.name);o.value=c.id;return o;}));
    if(rows.some(c=>c.id===old))select.value=old;
  }
  const healthTarget=$('health-target').value,health=healthTarget?instance.healthState(healthTarget):null;
  $('health-state').textContent=health?JSON.stringify(health,null,2):'No creature selected.';
  $('health-stabilize').disabled=!health||!['dying','stable'].includes(health.status);
  $('health-suppress').disabled=!health?.regenerationAmount;
  $('object-repair').disabled=!$('object-target').value||instance.find($('object-target').value).hp<=0;
  const cooldowns=instance.cooldownsOverview();
  const immediates=s.pendingEvents.filter(e=>e.kind==='immediate').map(e=>`${instance.find(e.actor).name}: coming swift spent`);
  $('basic-state').textContent=[...immediates,...cooldowns.map(e=>`${instance.find(e.target).name}: ${e.label} (${e.duration.type==='time'?e.duration.at-s.worldRounds:e.duration.round-s.round} round(s))`)].join('\n')||'No immediate-action debt or ability cooldowns.';
  $('summon-state').textContent=JSON.stringify(instance.summonsOverview(),null,2);
  $('summon-mark').disabled=!s.creatures.length;
  $('summon-dismiss').disabled=!instance.summonEvent($('summon-target').value);
  $('end-turn').disabled=!actor;
  if(!actor){
    $('notice').textContent='No creatures remain. Spawn a creature or reset the workbench.';
    $('board').replaceChildren();$('stats').replaceChildren();
    $('controller-view').textContent=JSON.stringify(instance.inspect(),null,2);
    $('log').replaceChildren(...s.log.slice(-22).reverse().map(line=>E('p','',line)));
    $('activate').disabled=true;return;
  }
  $('activate').disabled=active;
  $('registry-panel').hidden=fixture!=='registry';
  $('gm-panel').hidden=fixture!=='registry';
  $('manual-path-panel').hidden=fixture!=='registry';
  $('condition-ailment-panel').hidden=fixture!=='registry';
  $('foundation-panel').hidden=fixture!=='registry';
  $('defense-panel').hidden=fixture!=='registry';
  $('maneuver-panel').hidden=fixture!=='registry';
  $('clock').textContent=`${instance.gameTime().label} · Round ${s.round} · Active creature: ${actor.name} · Standard ${budget.standard} · Move ${budget.move} · Swift ${budget.swift} · Full attack ${s.pendingFullAttack?`${s.pendingFullAttack.index}/${s.pendingFullAttack.slots.length} strikes resolved`:'none pending'} · Step ${s.actions.step?'used — FURTHER MOVEMENT PROHIBITED':s.actions.moved?'blocked':'available'}`;
  $('board-label').textContent=s.interrupt
    ? `${s.interrupt.type==='rider_choice'?'RIDER CHOICE':s.interrupt.type==='ranged_action_aoo'?'RANGED ACTION':s.pendingManeuver?'MANEUVER':s.pendingCharge?'CHARGE':'MOVEMENT'} PAUSED: ${instance.find(s.interrupt.reactor).name} must choose an available response. Resolve the highlighted decision above the grid before continuing.`
    : s.pendingFullAttack
    ? `FULL ATTACK IN PROGRESS: ${actor.name} has ${s.pendingFullAttack.slots.length-s.pendingFullAttack.index} strike(s) remaining. Choose an enemy in Full attack mode, or take a five-foot step between attacks, or click Finish full attack to forgo remaining strikes.`
    : s.actions.step
    ? `${actor.name} has taken a five-foot step; further movement is prohibited this turn. Remaining move actions may be spent on non-movement actions.`
    : `Active: ${actor.name}. Tool: ${mode==='step'?'Five-foot step':mode==='attack'?'Attack':mode==='full_attack'?'Full attack':mode==='charge'?'Charge':mode==='move_standard'?'Move using standard':mode==='double_move'?'Double move':'Move'}. ${mode==='full_attack'?'Click a target token to start or continue full attack; each strike resolves separately.':mode==='attack'?'Click a target token to spend a standard action.':mode==='charge'?'Click a target token to charge; the engine chooses the nearest attacking square.':'Click an empty square to move the active creature.'} ${fixture==='choker'?'Red outlined squares are threatened by Choker (10-foot natural reach); ENTERING them alone does not provoke.':''}`;
  $('scenario-explainer').textContent=fixture==='registry'?'Register the editable Marsh Raider statblock once, spawn it, then register and apply the Shaken effect. Attack, saves, and checks update automatically; end the raider’s turn to count down duration. Only the GM can insert definitions or effects.':fixture==='archon'?'Archon begins 25 feet from Explorer. Move one square toward it to enter the 20-foot aura; the Will save fires automatically.':fixture==='pudding'?'Direct damage buttons are GM-only test injections, not ordinary creature actions. Slashing weapon damage triggers Split.':fixture==='choker'?'Choker has two natural tentacle attacks (+6 each, 1d4+3 each), 10-foot reach, and 20-foot speed. End Explorer’s turn to control Choker. Select FULL ATTACK and click Explorer twice, choosing each strike individually. Quickness permits one extra move before or after its full attack. Grab and Constrict are modeled by the V3.12 rider engine; older fixture attacks are retained for regression.':'Vienna starts with Explorer inside her 360-foot aura. Starting the encounter rolls the DC 34 Fortitude save automatically and teleports on failure. (Scaled creature size; full aura distance.)';
  for(const b of document.querySelectorAll('[data-mode]')){
    b.classList.toggle('on',b.dataset.mode===mode);
    b.disabled=!active;
    b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  }
  const buttons=$('test-buttons');buttons.innerHTML='';
  $('finish-full').hidden=!s.pendingFullAttack;
  const actions=fixture==='archon'?[['Move Explorer into aura','enter'],['Simulate a successful hit on archon (GM injection)','hit']]:fixture==='pudding'?[['GM: inflict slashing weapon damage','slash'],['GM: inflict fire spell damage','fire']]:fixture==='choker'?[['Choker: move one square (spends move action)','choker-move']]:[];
  for(const [label,action] of actions){
    const b=E('button','',label);
    b.disabled=!active||!!s.interrupt||!!s.pendingFullAttack||(action==='enter'&&actor.id!=='hero')||(action.startsWith('choker-')&&actor.id!=='warden');
    if(action.startsWith('choker-')&&actor.id!=='warden')b.title='End Explorer’s turn to enable Choker actions';
    b.addEventListener('click',()=>testAction(action));buttons.append(b);
  }
  const grid=$('board');grid.innerHTML='';
  const viewX=Math.max(0,Math.min(s.width-1,Math.floor(Number($('map-view-x').value))||0)),viewY=Math.max(0,Math.min(s.height-1,Math.floor(Number($('map-view-y').value))||0));
  const viewWidth=Math.min(20,s.width-viewX),viewHeight=Math.min(16,s.height-viewY);
  grid.style.gridTemplateColumns=`repeat(${viewWidth},minmax(0,1fr))`;grid.style.gridTemplateRows=`repeat(${viewHeight},minmax(0,1fr))`;grid.style.aspectRatio=`${viewWidth}/${viewHeight}`;
  $('map-window-label').textContent=`Showing (${viewX},${viewY})–(${viewX+viewWidth-1},${viewY+viewHeight-1}) of ${s.width}×${s.height} squares.`;
  for(let y=viewY;y<viewY+viewHeight;y++)for(let x=viewX;x<viewX+viewWidth;x++){
    const tile=E('button','tile');tile.dataset.x=x;tile.dataset.y=y;tile.title=`Square (${x},${y})`;
    const fs=instance.mapFeatures().filter(f=>f.cells?.some(p=>p.x===x&&p.y===y));
    if(fs.length){tile.classList.add('map-feature');tile.title+=' · '+fs.map(f=>`${f.name||f.id}: ${JSON.stringify(f.properties)}`).join('; ');tile.append(E('span','feature-label',fs.map(f=>f.preset).join(', ')));}
    const te=s.scene.tiles[`${x},${y}`];if(te)tile.title+=` · surface ${te.surfaceFeet} ft${te.obstacleHeightFeet!==undefined?`, obstacle ${te.obstacleHeightFeet} ft`:''} ${te.note||''}`;
    if(magicPreview?.cells.some(p=>p.x===x&&p.y===y))tile.classList.add('magic-preview');
    if(regionCells.has(`${x},${y}`)){tile.classList.add('persistent-area');tile.title+=' · '+regionCells.get(`${x},${y}`).join(', ');}
    const rule=s.automationRules.find(r=>r.on==='zone_enter');
    if(rule){const source=instance.find(rule.owner),dummy={x,y,size:1};if(instance.distance(source,dummy)<=rule.zone.radius)tile.classList.add('zone');}
    if(instance.tileKind(x,y)==='hazard')tile.classList.add('hazard');
    if(instance.tileKind(x,y)==='wall')tile.classList.add('wall');
    if(instance.tileKind(x,y)==='force_wall')tile.classList.add('force-wall');
    if(fixture==='choker'&&instance.threatens('warden','hero',x,y))tile.classList.add('threatened');
    const occupants=tokensAt(x,y),creature=tokenAt(x,y);
    if(occupants.length){tile.title+=' · '+occupants.map(c=>c.name+(c.elevation?` (${c.elevation.feet} ft; ${c.elevation.layer||'ground'})`:'')).join(', ');}
    if(occupants.length>1)tile.append(E('span','stack-count',String(occupants.length)));
    if(creature){
      if(creature.x===x&&creature.y===y){
        const letter=creature.id==='hero'?'E':fixture==='choker'?'C':creature.name.startsWith('Black')?'P':creature.name.startsWith('Vienna')?'V':'A';
        const t=E('span',`token ${creature.team==='enemy'?'foe':''} ${creature.objectProfile?'object':''} ${creature.hp<=0?'downed':''}`,creature.objectProfile?'□':letter);t.title=creature.name+(creature.playerDisplay?.layer==='map'?' · Map layer':' · GM layer');tile.append(t);if(creature.playerDisplay?.layer!=='map')tile.append(E('span','stack-count','GM'));
      }else tile.append(E('span','bodypiece'));
      if(creature.id===actor.id)tile.classList.add('acting');
    }
    tile.onclick=()=>clickCell(x,y);grid.append(tile);
  }
  const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('map-feature-overlay');overlay.setAttribute('viewBox',`${viewX} ${viewY} ${viewWidth} ${viewHeight}`);overlay.setAttribute('preserveAspectRatio','none');
  for(const f of instance.mapFeatures().filter(f=>f.points)){
    const line=document.createElementNS(overlay.namespaceURI,'polyline'),active=mapFeatureActive(s,f);
    line.dataset.feature=f.id;line.setAttribute('points',f.points.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',!active?'#71cbb0':f.elevationTransition?'#8ed6e0':f.properties.material==='force'?'#c39df5':f.doorState?'#e9b26e':'#e6cfac');line.setAttribute('stroke-width','3');line.setAttribute('vector-effect','non-scaling-stroke');
    if(!active||f.properties.effect==='adjudicate'||f.properties.movement==='allow')line.setAttribute('stroke-dasharray','5 4');
    const title=document.createElementNS(overlay.namespaceURI,'title');title.textContent=f.name||f.id;line.append(title);overlay.append(line);
  }
  grid.append(overlay);
  $('magic-continue').disabled=!s.pendingSpellCast||instance.remainingCounterspells().length>0;
  const castSelect=$('magic-ongoing'),selectedCast=castSelect.value;
  castSelect.replaceChildren(...s.activeSpellCasts.map(c=>{const o=E('option','',`${instance.find(c.actor).name}: ${c.spell.name} (${c.status}, ${c.roundsPaid}/${c.totalRounds})`);o.value=c.actor;return o;}));
  if(s.activeSpellCasts.some(c=>c.actor===selectedCast))castSelect.value=selectedCast;
  const selected=s.activeSpellCasts.find(c=>c.actor===castSelect.value);
  $('magic-long-continue').disabled=!selected||selected.actor!==actor.id||selected.status!=='casting'||selected.paidRound===s.round||selected.roundsPaid>=selected.totalRounds;
  $('magic-complete').disabled=selected?.status!=='ready';
  $('magic-cancel').disabled=!selected;
  const aooSelect=$('magic-aoo-actor'),selectedAoO=aooSelect.value;
  const remainingAoOs=(s.pendingSpellCast?.threats||[]).filter(id=>!s.pendingSpellCast.handled?.includes(id));
  aooSelect.replaceChildren(...remainingAoOs.map(id=>{const o=E('option','',instance.find(id).name);o.value=id;return o;}));
  if(remainingAoOs.includes(selectedAoO))aooSelect.value=selectedAoO;
  $('magic-aoo-take').disabled=$('magic-aoo-decline').disabled=!remainingAoOs.length||!!s.interrupt;
  const castingSummary=s.activeSpellCasts.map(c=>`${instance.find(c.actor).name}: ${c.spell.name} — ${c.status==='ready'?'FINISHED: select targets / area before play continues':`${c.roundsPaid}/${c.totalRounds} full-round action(s); ${c.paidRound===s.round?'concentrating between turns':'continue this turn or lose the spell'}`}${!s.initiative.enabled&&c.status==='casting'?`; clock completion in ${Math.max(0,c.deadlineAt-s.worldRounds)} round(s)`:''}`).join('\n')||'No ongoing casting.';
  $('magic-casting-state').textContent=castingSummary;
  const maintenance=instance.concentrationOverview(),focusSelect=$('concentration-active'),oldFocus=focusSelect.value;
  focusSelect.replaceChildren(...maintenance.map(e=>{const o=E('option','',`${s.creatures.find(c=>c.id===e.actor)?.name||'Departed caster'}: ${e.spell} (${e.phase})`);o.value=e.id;return o;}));
  if(maintenance.some(e=>e.id===oldFocus))focusSelect.value=oldFocus;
  const focus=maintenance.find(e=>e.id===focusSelect.value),canMaintain=focus?.phase==='maintaining'&&focus.actor===actor.id;
  $('concentration-maintain').disabled=!canMaintain||!focus.needsMaintenance;
  $('concentration-stop').disabled=!canMaintain;
  $('concentration-check').disabled=focus?.phase!=='maintaining';
  $('concentration-state').textContent=maintenance.length?JSON.stringify(maintenance,null,2):'No maintained spells.';
  $('casting-time-summary').textContent=castingSummary+(s.pendingSpellCast?'\nCasting opportunities unresolved: '+s.pendingSpellCast.spell.name:'');
  const held=s.pendingEvents.filter(e=>e.kind==='held_spell'&&e.status==='active');
  const heldSelect=$('magic-held'),heldSelected=heldSelect.value;
  heldSelect.replaceChildren(...held.map(e=>{const o=E('option','',`${instance.find(e.actor).name}: ${e.payload.spell.name}`);o.value=e.actor;return o;}));
  if(held.some(e=>e.actor===heldSelected))heldSelect.value=heldSelected;
  const contactTarget=$('magic-touch-target'),targetSelected=contactTarget.value;
  contactTarget.replaceChildren(...s.creatures.map(c=>{const o=E('option','',c.name);o.value=c.id;return o;}));
  if(s.creatures.some(c=>c.id===targetSelected))contactTarget.value=targetSelected;
  const heldSummary=held.map(e=>`${instance.find(e.actor).name}: ${e.payload.spell.name} — ${e.payload.chargesRemaining} charge(s); ${instance.freeTouchAttempt(e)?'one free touch attempt available':'delivery uses a standard action'}; Pending Event ${e.id}`).join('\n');
  $('magic-held-state').textContent=heldSummary||'No held touch spell.';
  if(heldSummary)$('casting-time-summary').textContent+='\n'+heldSummary;
  const heldActive=instance.heldTouch(heldSelect.value);
  $('magic-touch-deliver').disabled=!heldActive||heldSelect.value!==actor.id||!!s.interrupt||!!s.pendingSpellCast||!!s.deferredTurnStart||(!instance.freeTouchAttempt(heldActive)&&budget.standard<1);
  $('magic-contact-creature').disabled=$('magic-contact-object').disabled=!held.length;
  const dispelTarget=$('magic-dispel-target'),oldDispelTarget=dispelTarget.value;
  const dispelTargets=[...s.creatures,...areas.map(a=>({id:a.id,name:`Area: ${a.label}`}))];
  dispelTarget.replaceChildren(...dispelTargets.map(c=>{const o=E('option','',c.name);o.value=c.id;return o;}));
  if(dispelTargets.some(c=>c.id===oldDispelTarget))dispelTarget.value=oldDispelTarget;
  const spellEffects=instance.ongoingSpellEffects(dispelTarget.value),dispelEffect=$('magic-dispel-effect'),oldDispelEffect=dispelEffect.value;
  const defaultEffect=E('option','','One spell, highest caster level first');defaultEffect.value='';
  dispelEffect.replaceChildren(defaultEffect,...spellEffects.filter(g=>g.dispellable).map(g=>{
   const o=E('option','',`${g.name} · CL ${g.casterLevel} · ${g.id}`);o.value=g.effectIds[0]||g.eventIds[0];return o;
  }));
  if([...dispelEffect.options].some(o=>o.value===oldDispelEffect))dispelEffect.value=oldDispelEffect;
  $('magic-effect-state').textContent=JSON.stringify(spellEffects,null,2);
  const slotFill=(id,entries)=>{
    const select=$(id),prior=select.value;
    select.replaceChildren(...entries.map(e=>{const o=E('option','',e.name||e.id);o.value=e.id;return o;}));
    if(entries.some(e=>e.id===prior))select.value=prior;
  };
  slotFill('slots-actor',s.creatures);
  const slotBooks=instance.spellBooks($('slots-actor').value);
  slotFill('slots-book',slotBooks);
  const slotBook=slotBooks.find(b=>b.id===$('slots-book').value);
  slotFill('slots-spell',slotBook?.spells||[]);
  slotFill('slots-preparation',(slotBook?.preparations||[]).map(p=>({id:p.id,name:`${p.id}: ${p.spell} · level ${p.slotLevel}${p.spent?' · EXPENDED':''}`})));
  slotFill('slots-pool',slotBook?.pools||[]);
  $('slots-preparation').disabled=slotBook?.mode!=='prepared';
  $('slots-level').disabled=!slotBook;
  $('slots-use').disabled=$('slots-refresh').disabled=$('slots-restore').disabled=!slotBook;
  $('slots-prepare').disabled=slotBook?.mode!=='prepared';
  $('slots-state').textContent=JSON.stringify(instance.spellResourceOverview($('slots-actor').value),null,2);
  const stats=$('stats');stats.innerHTML='';
  for(const c of s.creatures){
    const section=E('div',`unit ${c.id===actor.id?'acting-unit':''}`),title=E('div','unit-header');
    title.append(E('strong','',`${c.name}${instance.summonEvent(c.id)?' · Summon':''}${c.id===actor.id?' — ACTIVE':''}`),E('span','',`${c.hp}/${c.maxHp} HP · ${instance.healthState(c.id).status}`));section.append(title);
    section.append(E('div','unit-info',`(${c.x},${c.y}) · ${c.size}×${c.size} · Reach ${c.reach*5} ft · Speed ${c.speed} ft · AC ${instance.stat(c.id,'ac')}/${instance.stat(c.id,'touchAc')}/${instance.stat(c.id,'flatFootedAc')} (normal/touch/flat) · Attack ${instance.stat(c.id,'attack')>=0?'+':''}${instance.stat(c.id,'attack')} · Fort ${instance.stat(c.id,'fort')} · Will ${instance.stat(c.id,'will')}`));
    section.append(E('div','unit-info',`CMB ${instance.stat(c.id,'cmb')} · CMD ${instance.stat(c.id,'cmd')} · Size ${instance.sizeCategory(c.id)}`));
    section.append(E('div','unit-info',`Full attack: ${instance.attackRoutine(c.id).map(a=>`${a.label} ${instance.stat(c.id,'attack')+a.attackOffset>=0?'+':''}${instance.stat(c.id,'attack')+a.attackOffset}`).join(' / ')}`));
    if(c.skills?.Perception!==undefined) {
      const skill=instance.skillBonus(c.id,'Perception');
      section.append(E('div','unit-info',`Perception ${skill>=0?'+':''}${skill} · STR ${instance.stat(c.id,'str')}`));
    }
    for(const effect of s.effects.filter(e=>e.target===c.id))section.append(E('span','effect',effect.name));
    for(const mark of s.marks.filter(m=>m.target===c.id))section.append(E('span','effect',mark.tag));
    const injured=s.abilityDamage?.[c.id];if(injured&&Object.values(injured).some(v=>v>0))section.append(E('div','unit-info',`Ability damage: ${Object.entries(injured).filter(([,v])=>v>0).map(([k,v])=>`${k.toUpperCase()} ${v}`).join(', ')}`));
    const neg=instance.negativeCount?.(c.id)||0;if(neg)section.append(E('div','unit-info',`Negative levels: ${neg} · Energy Drain temp HP ${((s.energyTempHp||{})[c.id]||[]).reduce((n,x)=>n+x.amount,0)}`));
    const drained=s.abilityDrain?.[c.id];if(drained&&Object.values(drained).some(v=>v>0))section.append(E('div','unit-info',`Ability drain: ${Object.entries(drained).filter(([,v])=>v>0).map(([k,v])=>`${k.toUpperCase()} ${v}`).join(', ')}`));
    const changed=ABILITIES.map(a=>instance.abilityBreakdown(c.id,a))
      .filter(row=>row.damage||row.drain||row.temporaryAdjustments?.length);
    if(changed.length)section.append(E('div','unit-info',`Ability scores: ${changed.map(row=>`${row.ability.toUpperCase()} ${row.printed} → ${row.score} (damage ${row.damage}; drain ${row.drain}; temp ${row.temporaryAdjustments.map(x=>`${x.value>=0?'+':''}${x.value}`).join(', ')||'none'})`).join(' · ')}`));
    stats.append(section);
  }
  const log=$('log');log.innerHTML='';for(const line of s.log.slice(-22).reverse())log.append(E('p','',line));
  $('command').textContent=JSON.stringify(lastCommand,null,2);
  $('rules').textContent=JSON.stringify(s.automationRules,null,2);
  const routineSelect=$('routines-actor'),oldRoutine=routineSelect.value;
  routineSelect.innerHTML='';for(const c of s.creatures){const o=E('option','',c.name);o.value=c.id;routineSelect.append(o);}
  routineSelect.value=s.creatures.some(c=>c.id===oldRoutine)?oldRoutine:actor.id;
  const routineCreature=instance.find(routineSelect.value);
  const ammoSelect=$('routines-ammo-id'),oldAmmo=ammoSelect.value;
  ammoSelect.innerHTML='';for(const [id,a] of Object.entries(routineCreature.ammunition||{})){
    const o=E('option','',`${id}: ${a.type==='loaded'?a.loaded+'/'+a.capacity+' loaded; ':''}${a.reserve} spare`);
    o.value=id;ammoSelect.append(o);
  }
  if([...ammoSelect.options].some(o=>o.value===oldAmmo))ammoSelect.value=oldAmmo;
  $('routines-set-ammo').disabled=!active||!ammoSelect.value||!!s.interrupt||!!s.pendingRangedAction;
  $('routines-reload').disabled=!active||routineCreature.id!==actor.id||!ammoSelect.value||routineCreature.ammunition[ammoSelect.value].type!=='loaded'||!!s.interrupt||!!s.pendingFullAttack;
  $('routines-draw').disabled=!active||routineCreature.id!==actor.id||!ammoSelect.value||routineCreature.ammunition[ammoSelect.value].drawAction!=='move'||!!s.interrupt||!!s.pendingFullAttack;
  $('routines-state').textContent=JSON.stringify({activeCreature:actor.id,selectedCreature:routineCreature.id,
    attackPlan:routineCreature.attackPlan||null,
    routine:instance.attackRoutine(routineCreature.id).map(a=>({name:a.label,attackOffset:a.attackOffset,damageAbility:a.damageAbility||'default',role:a.role||'printed',ammoId:a.ammoId||null})),
    ammunition:routineCreature.ammunition||{},pending:s.pendingRangedAction||null},null,2);
  if(fixture==='registry'){
    const select=$('effect-target'),prior=select.value;
    select.innerHTML='';
    for(const c of s.creatures){const option=E('option','',c.name);option.value=c.id;select.append(option);}
    if(lastCommand.op==='spawn_creature'&&s.creatures.some(c=>c.id===lastCommand.id))select.value=lastCommand.id;
    else if(s.creatures.some(c=>c.id===prior))select.value=prior;
    else if(s.creatures.some(c=>c.id===$('spawn-id').value))select.value=$('spawn-id').value;
    $('controller-view').textContent=JSON.stringify(instance.dispatch({op:'inspect'},'actor'),null,2);
    const gmTarget=$('gm-target'),previous=gmTarget.value;
    gmTarget.innerHTML='';
    for(const c of s.creatures){const option=E('option','',c.name);option.value=c.id;gmTarget.append(option);}
    if(lastCommand.op==='spawn_creature'&&s.creatures.some(c=>c.id===lastCommand.id))gmTarget.value=lastCommand.id;
    else if(s.creatures.some(c=>c.id===previous))gmTarget.value=previous;
    else if(s.creatures.some(c=>c.id===$('spawn-id').value))gmTarget.value=$('spawn-id').value;
    const mv=$('maneuver-target'),oldMv=mv.value;
    mv.innerHTML='';for(const c of s.creatures.filter(c=>c.id!==actor.id)){
      const o=E('option','',c.name);o.value=c.id;mv.append(o);
    }
    if(s.creatures.some(c=>c.id===oldMv&&c.id!==actor.id))mv.value=oldMv;
    $('maneuver-state').textContent=JSON.stringify({active:actor.id,actorCMB:instance.stat(actor.id,'cmb'),
      opponents:s.creatures.filter(c=>c.id!==actor.id).map(c=>({id:c.id,cmd:instance.cmdFor(c.id,$('maneuver-kind').value.split(':')[0]),equipment:c.equipment||[]})),
      grapples:s.grapples||[],pending:s.pendingManeuver||null},null,2);
    const trickSelect=$('dirty-trick-effect'),previousTrick=trickSelect.value;
    trickSelect.innerHTML='';
    for(const d of (s.dirtyTricks||[]).filter(x=>x.target===actor.id&&s.effects.some(e=>e.id===x.effectId))){
      const option=E('option','',`${d.condition} (${d.removalAction})`);option.value=d.effectId;trickSelect.append(option);
    }
    if([...trickSelect.options].some(o=>o.value===previousTrick))trickSelect.value=previousTrick;
    $('dirty-trick-remove').disabled=!trickSelect.options.length;
    $('gm-override-history').textContent=JSON.stringify((s.overrideLog||[]).slice(-12),null,2);
    const foundationTarget=$('foundation-target'),oldFoundationTarget=foundationTarget.value;
    foundationTarget.innerHTML='';
    for(const c of s.creatures){const option=E('option','',c.name);option.value=c.id;foundationTarget.append(option);}
    if(s.creatures.some(c=>c.id===oldFoundationTarget))foundationTarget.value=oldFoundationTarget;
    else if(s.creatures.some(c=>c.id===$('spawn-id').value))foundationTarget.value=$('spawn-id').value;
    const effectSelect=$('gm-active-effect'),oldEffect=effectSelect.value;
    effectSelect.innerHTML='';
    for(const e of s.effects){const option=E('option','',`${e.name} → ${instance.find(e.target).name} [${e.id}]`);option.value=e.id;effectSelect.append(option);}
    if(lastCommand.op==='gm_modifier'&&s.effects.length)effectSelect.value=s.effects.at(-1).id;
    else if(s.effects.some(e=>e.id===oldEffect))effectSelect.value=oldEffect;
    $('gm-remove').disabled=!s.effects.length;
    const assigned=[['condition-target',s.creatures],['ailment-target',s.creatures]];
    for(const [id,creatures] of assigned){const select=$(id),prior=select.value;select.innerHTML='';
      for(const c of creatures){const option=E('option','',c.name);option.value=c.id;select.append(option);}
      if(creatures.some(c=>c.id===prior))select.value=prior;
      else if(creatures.some(c=>c.id===$('spawn-id').value))select.value=$('spawn-id').value;
    }
    const src=$('condition-source'),oldSrc=src.value;
    src.innerHTML='';const blank=E('option','','None');blank.value='';src.append(blank);
    for(const c of s.creatures){const option=E('option','',c.name);option.value=c.id;src.append(option);}
    src.value=s.creatures.some(c=>c.id===oldSrc)?oldSrc:'';
    const cond=STANDARD_CONDITIONS[$('condition-id').value];
    $('condition-help').textContent=cond?`${cond.name} — ${cond.coverage.toUpperCase()}. ${cond.advisories.join(' ')||'Numeric mechanics and restrictions are available.'}`:'';
    const ailments=$('ailment-active'),was=ailments.value;ailments.innerHTML='';
    for(const a of (s.activeAilments||[])){
      const option=E('option','',`${s.ailmentCatalog[a.definition]?.name}: ${instance.find(a.target).name}; periodic checks ${a.processed}, successes ${a.consecutive} consecutive`);
      option.value=a.id;ailments.append(option);
    }
    if((s.activeAilments||[]).some(a=>a.id===was))ailments.value=was;
    $('ailment-cure').disabled=!s.activeAilments?.length;
    const clockInfo=instance.dispatch({op:'gm_get_game_clock'},'gm');
    $('time-details').textContent=JSON.stringify({current:clockInfo,lastOperation:lastTimeOutcome},null,2);
    $('time-acknowledge').disabled=!clockInfo.pending;
    $('ailment-help').textContent=`Elapsed time: ${s.worldRounds??0} rounds. Active ailments: ${s.activeAilments?.length||0}. Ability damage and drain persist after curing an affliction.`;
    const initiative=instance.dispatch({op:'gm_get_initiative'},'gm');
    $('initiative-details').textContent=JSON.stringify(initiative,null,2);
    const fill=(id,creatures)=>{
      const sel=$(id),prior=sel.value;sel.innerHTML='';
      for(const c of creatures){const o=E('option','',c.name||c.id);o.value=c.id;sel.append(o);}
      if(creatures.some(c=>c.id===prior))sel.value=prior;
    };
    fill('initiative-actor',s.creatures.filter(c=>!c.objectProfile));
    fill('initiative-after',s.creatures.filter(c=>!c.objectProfile));
    fill('initiative-delayed',s.creatures.filter(c=>initiative.entries.some(e=>e.id===c.id&&e.delayed)));
    $('initiative-roll').disabled=initiative.enabled;
    $('initiative-begin').disabled=initiative.enabled;
    $('initiative-ack').disabled=!initiative.pending;
    const pending=instance.dispatch({op:'gm_get_pending_events'},'gm');
    $('pending-details').textContent=JSON.stringify(pending,null,2);
    fill('pending-actor',s.creatures);
    const eventFill=(id,events)=>{
      const sel=$(id),previous=sel.value;sel.innerHTML='';
      for(const e of events){const option=E('option','',`${e.label} [${e.id}]`);option.value=e.id;sel.append(option);}
      if(events.some(e=>e.id===previous))sel.value=previous;
    };
    eventFill('pending-active',pending.active);
    eventFill('pending-triggered',pending.triggered);
    const selectedPending=s.pendingEvents.find(e=>e.id===$('pending-active').value);
    $('pending-trigger-button').disabled=!selectedPending||['held_spell','summon','persistent_area','concentration','cooldown','immediate','regeneration_suppressed'].includes(selectedPending.kind)||!!selectedPending.payload?.counterspell;
    $('pending-cancel').disabled=!pending.active.length;
    $('pending-resolve').disabled=!pending.triggered.length;
    fill('counter-target',s.creatures.filter(c=>c.id!==actor.id));
    const opportunities=instance.remainingCounterspells().map(id=>s.pendingEvents.find(e=>e.id===id));
    eventFill('counter-opportunity',opportunities);
    $('counter-take').disabled=$('counter-decline').disabled=!opportunities.length||!!s.interrupt;
    $('counter-ready').disabled=!initiative.enabled||!!s.pendingSpellCast||budget.standard<1||!$('counter-target').value;
    const readyCounters=s.pendingEvents.filter(e=>e.kind==='ready'&&e.payload?.counterspell);
    $('counter-details').textContent=JSON.stringify({readied:readyCounters,opportunities:opportunities.map(e=>e.id),casting:s.pendingSpellCast?.spell.name||null},null,2);



  }
  $('accept').textContent=s.interrupt?.type==='rider_choice'?(s.interrupt.rider==='trip'?'Attempt Trip':['pull','push'].includes(s.interrupt.rider)?`Attempt ${s.interrupt.rider.toUpperCase()}`:'Grab (normal)'):s.interrupt?.type==='overrun_avoid'?'Avoid Overrun':'Take opportunity';
  $('decline').textContent=s.interrupt?.type==='rider_choice'?(s.interrupt.rider==='trip'?'Decline Trip':['pull','push'].includes(s.interrupt.rider)?`Decline ${s.interrupt.rider}`:'Decline Grab'):s.interrupt?.type==='overrun_avoid'?'Stand ground':'Decline';
  $('appendage').hidden=s.interrupt?.type!=='rider_choice'||s.interrupt.rider!=='grab';
  $('interrupt-box').hidden=!s.interrupt;
  if(s.interrupt){
    const i=s.interrupt;
    $('interrupt-label').textContent=i.type==='rider_choice'?(['pull','push'].includes(i.rider)?`${instance.find(i.reactor).name} can attempt free ${i.rider.toUpperCase()} against ${instance.find(i.target).name}. On a successful CMB check the target moves the ability's fixed distance (subject to obstacles), without provoking.`:i.rider==='trip'?`${instance.find(i.reactor).name} hit ${instance.find(i.target).name}. Choose whether to attempt the free monster Trip maneuver, without provoking an AoO or risking counter-trip on failure.`:`${instance.find(i.reactor).name} hit ${instance.find(i.target).name}. The damage already occurred. Choose whether to attempt Grab as a free grapple check (+4 CMB, no AoO), use appendage-only Grab at a net −16 CMB, or decline. Constrict damage applies only if the grapple check succeeds.`):i.type==='overrun_avoid'?`${instance.find(i.reactor).name} can avoid ${instance.find(i.target).name}'s Overrun (allowing passage without a check), or stand ground and contest CMB vs CMD.`:i.type==='maneuver_aoo'?`${instance.find(i.reactor).name} may make an AoO before ${instance.find(i.target).name}'s ${i.maneuver.replaceAll('_',' ')} check. If the AoO hits, its damage penalizes the maneuver roll. Choose TAKE or DECLINE; the original maneuver will then resume.`:i.type==='ranged_action_aoo'?`${instance.find(i.reactor).name} may take an AoO before ${instance.find(i.target).name} ${i.reason==='shot'?'fires a ranged attack':i.reason==='spell'?'fires a ray spell':'reloads a weapon'}. TAKE or DECLINE; the interrupted action resumes afterward.`:i.type==='aoo'?`${instance.find(i.reactor).name} may make an AoO against ${instance.find(i.target).name} BEFORE it leaves (${i.from.x},${i.from.y}) for (${i.to.x},${i.to.y}). ${instance.find(i.target).name} has NOT moved yet; select TAKE or DECLINE to continue its movement. Entering a threatened square alone does not provoke.`:i.text;
  }
}
function setFixture(){
  active=false;mode='move';instance=createScenario($('scenario').value);
  lastCommand={op:'select_fixture',fixture:$('scenario').value};
  $('notice').className='status';$('notice').textContent='Encounter prepared. Activate automatic effects to begin.';render();
}
$('combat-stand').onclick=()=>doSafe(()=>interact({op:'stand_up',actor:instance.active().id}));
$('combat-total-defense').onclick=()=>doSafe(()=>interact({op:'total_defense',actor:instance.active().id}));
$('combat-configure').onclick=()=>doSafe(()=>interact({op:'gm_set_combat_profile',target:instance.active().id,profile:JSON.parse($('combat-profile').value)},'gm'));
$('combat-inspect').onclick=()=>doSafe(()=>{const r=interact({op:'gm_get_combat'},'gm');$('combat-state').textContent=JSON.stringify(r,null,2);return r;});
for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>{mode=button.dataset.mode;render();};
$('maneuver-execute').onclick=()=>doSafe(()=>{
 if(!active)throw new Error('Activate encounter first');
 const item=$('maneuver-item').value.trim();
 const [kind,condition]=$('maneuver-kind').value.split(':');
 const cmd={op:'maneuver',actor:instance.active().id,target:$('maneuver-target').value,kind};
 if(condition)cmd.condition=condition;
 if(item&&['disarm','sunder','steal'].includes(cmd.kind))cmd.item=item;
 if(kind==='reposition'){
   const raw=$('maneuver-path').value.trim();
   cmd.path=raw.split(';').map(part=>{const nums=part.split(',').map(Number);if(nums.length!==2||nums.some(n=>!Number.isInteger(n)))throw Error('Reposition path requires x,y;x,y squares');return {x:nums[0],y:nums[1]};});
 }
 return interact(cmd,'actor');
});
$('replacement-execute').onclick=()=>doSafe(()=>{
 if(!active)throw new Error('Activate encounter first');
 const cmd={op:'replace_attack',actor:instance.active().id,target:$('maneuver-target').value,kind:$('replacement-kind').value};
 if(['disarm','sunder'].includes(cmd.kind))cmd.item=$('maneuver-item').value.trim();
 return interact(cmd,'actor');
});
$('dirty-trick-remove').onclick=()=>doSafe(()=>interact({op:'remove_dirty_trick',actor:instance.active().id,effectId:$('dirty-trick-effect').value},'actor'));
$('gm-override-execute').onclick=()=>doSafe(()=>{
 if(!active)throw Error('Activate the workbench first');
 const kind=$('gm-override-kind').value,reason=$('gm-override-reason').value,target=$('gm-target').value;
 if(kind==='move_free'){
   mode='gm_free';lastCommand={op:'select_gm_free_movement'};return {status:'ready',instruction:'Click a destination square for free movement'};
 }
 const cmd={op:'gm_adjudicate',kind,reason,target};
 if(kind==='modifier')Object.assign(cmd,{stat:$('gm-stat').value,value:Number($('gm-value').value),type:$('gm-type').value,rounds:$('gm-rounds').value===''?null:Number($('gm-rounds').value)});
 if(['condition','remove_condition'].includes(kind))Object.assign(cmd,{condition:$('condition-id').value,rounds:kind==='condition'&&$('condition-rounds').value!==''?Number($('condition-rounds').value):null});
 if(['damage','healing'].includes(kind))Object.assign(cmd,{count:Number($('gm-count').value),sides:Number($('gm-sides').value),bonus:Number($('gm-bonus').value),damageType:$('gm-damage-type').value});
 if(kind==='grant_action')Object.assign(cmd,{actor:instance.active().id,type:'move',count:1});
 if(kind==='health')Object.assign(cmd,{hp:Number($('gm-health-hp').value),revive:$('gm-health-revive').checked});
 if(kind==='relocate')Object.assign(cmd,{x:Number($('gm-override-x').value),y:Number($('gm-override-y').value)});
 return interact(cmd,'gm');
});
$('grapple-execute').onclick=()=>doSafe(()=>{
 if(!active)throw new Error('Activate encounter first');
 const cmd={op:'grapple_action',actor:instance.active().id,kind:$('grapple-kind').value};
 if(cmd.kind==='maintain')cmd.option=$('grapple-option').value;
 return interact(cmd,'actor');
});
$('maneuver-position').onclick=()=>doSafe(()=>{
 const actor=instance.active(),target=instance.find($('maneuver-target').value);
 const pos=[];
 for(let y=0;y<instance.s.height;y++)for(let x=0;x<instance.s.width;x++){
  if(instance.legalPosition(actor.id,x,y)&&instance.distance(actor,target,x,y)===1)pos.push({x,y,d:Math.hypot(x-actor.x,y-actor.y)});
 }
 pos.sort((a,b)=>a.d-b.d);
 if(!pos.length)throw Error('No adjacent open square');
 return interact({op:'teleport',target:actor.id,x:pos[0].x,y:pos[0].y,reason:'GM test setup'},'gm');
});
$('scenario').onchange=setFixture;$('reset').onclick=setFixture;
$('creature-json').value=JSON.stringify(exampleCreature,null,2);
$('effect-json').value=JSON.stringify(exampleEffect,null,2);
const runImport=fn=>doSafe(()=>{
  if(!active||$('scenario').value!=='registry')throw new Error('Activate the V3.4 Import scenario first.');
  return fn();
});
const exampleDevil={
  id:'fictional-devil-v1',name:'Infernal Test Subject',creatureType:'outsider',subtypes:['devil'],
  source:'Fictional test for trait inheritance (not an official monster statblock)',
  stats:{maxHp:48,hp:48,hitDiceCount:8,size:1,reach:1,speed:30,str:16,dex:12,con:14,int:12,wis:12,cha:20,bab:8,
    statTotals:{ac:20,touchAc:11,flatFootedAc:19,initiative:1,attack:11,fort:8,ref:7,will:7},
    abilityLinks:{attack:['str'],fort:['con'],ref:['dex'],will:['wis'],ac:['dex'],touchAc:['dex'],initiative:['dex']},
    skills:{Perception:11}},
  dcDefinitions:{infernal_presence:{basis:'half_hd',ability:'cha',published:19}}
};
$('foundation-load-bite').onclick=()=>{
 const creature={id:'test_biter',name:'Fictional Biter (Grab test)',creatureType:'magical_beast',
  stats:{maxHp:42,hitDiceCount:5,size:1,reach:1,speed:30,str:18,dex:12,con:16,wis:12,bab:5,damageDie:6,
   statTotals:{ac:17,touchAc:11,flatFootedAc:16,attack:9,fort:7,ref:5,will:2},
   attacks:[{label:'Bite',naturalAttack:'bite',attackKind:'natural',damageDie:6,riders:['grab','constrict'],constrictDie:6,constrictBonus:3}]}};
 $('creature-json').value=JSON.stringify(creature,null,2);
 $('spawn-id').value='test_biter_1';$('spawn-x').value='4';$('spawn-y').value='4';
 $('notice').textContent='Bite + Grab + Constrict example loaded. Register, spawn, and attack with Bite. After a hit, choose Grab or decline; Constrict applies only after a successful grapple check.';
};
$('foundation-load-critical').onclick=()=>{
 const creature={id:'critical_duelist',name:'Fictional Critical Duelist',creatureType:'humanoid',
  stats:{maxHp:50,hitDiceCount:7,size:1,reach:1,speed:30,str:16,dex:16,con:12,wis:10,bab:7,damageDie:6,
   statTotals:{ac:19,touchAc:13,flatFootedAc:16,attack:11,damage:4,fort:5,ref:7,will:3},
   attacks:[{label:'Keen rapier and precision',attackKind:'manufactured',damageTypes:['piercing'],damageDie:6,
    criticalThreat:18,criticalMultiplier:2,keen:true,precision:{count:2,sides:6},
    extraDamage:[{damageType:'fire',count:1,sides:4}]}]}};
 $('creature-json').value=JSON.stringify(creature,null,2);
 $('spawn-id').value='duelist_1';$('spawn-x').value='4';$('spawn-y').value='4';
 $('foundation-attack-index').value=0;
 $('notice').textContent='Critical + Precision example loaded. Register, spawn and inspect attack 0. Check Precision applies before attacking only when the GM has established the triggering conditions. Worn armor can grant a fortification percentage.';
};
$('foundation-load-offensive-riders').onclick=()=>{
 const creature={id:'rider_examples',name:'Fictional Rider Beast',creatureType:'magical_beast',
  stats:{maxHp:65,size:1,reach:1,speed:30,str:18,dex:12,con:16,bab:8,damageDie:6,
   statTotals:{ac:20,touchAc:11,flatFootedAc:19,attack:12,damage:4,fort:9,ref:7,will:4},
   attacks:[{label:'Tripping bite',naturalAttack:'bite',attackKind:'natural',damageDie:6,riders:['trip']},
    {label:'Bleeding claw',naturalAttack:'claw',attackKind:'natural',damageDie:6,riders:['bleed'],bleedAmount:3},
    {label:'Venomous paralyzing sting',naturalAttack:'sting',attackKind:'natural',damageDie:4,riders:['poison','paralysis'],
      poisonId:'rider_venom',paralysisDC:17,paralysisRounds:2}]}};
 const venom={id:'rider_venom',name:'Fictional Injury Venom',kind:'poison',delivery:'injury',
  save:{type:'fort',dc:16},frequency:{every:{count:1,unit:'round'},maxTicks:6},
  cure:{successes:2,consecutive:true},effects:[{kind:'ability_damage',ability:'str',dice:{count:1,sides:4}}]};
 $('creature-json').value=JSON.stringify(creature,null,2);$('ailment-json').value=JSON.stringify(venom,null,2);
 $('spawn-id').value='rider_beast_1';$('spawn-x').value='4';$('spawn-y').value='4';
 $('notice').textContent='Offensive rider example loaded. Register the poison in the Ailments panel FIRST; then register and spawn the creature. Its three attacks showcase optional Trip, recurring Bleed, and injury Poison plus Paralysis.';
};
$('foundation-load-final-riders').onclick=()=>{
 const creature={id:'final_rider_examples',name:'Fictional Harrowed Abductor',creatureType:'undead',
  stats:{maxHp:80,hp:80,hitDiceCount:10,size:1,reach:3,speed:30,str:20,dex:14,con:10,cha:16,wis:12,bab:8,damageDie:6,
   statTotals:{ac:21,touchAc:12,flatFootedAc:19,attack:13,damage:5,fort:4,ref:5,will:7},
   attacks:[{label:'Pulling tentacle',attackKind:'natural',naturalAttack:'tentacle',damageDie:6,riders:['pull'],pullFeet:10},
    {label:'Pushing slam',attackKind:'natural',naturalAttack:'slam',damageDie:6,riders:['push'],pushFeet:10},
    {label:'Draining touch',attackKind:'natural',naturalAttack:'other',damageTypes:['bludgeoning'],damageDie:6,riders:['energy_drain'],energyDrainLevels:2,energyDrainDC:18}]}};
 $('creature-json').value=JSON.stringify(creature,null,2);$('spawn-id').value='abductor_1';
 $('spawn-x').value='4';$('spawn-y').value='4';$('foundation-attack-index').value=0;
 $('notice').textContent='Final riders example loaded. Register/spawn, then inspect attacks 0–2: Pull, Push, and Energy Drain. The target must be no larger than the attacker for Pull and Push; the attacker must be in reach.';
};
$('foundation-load-weapon-quality').onclick=()=>{
 const creature={id:'weapon_examples',name:'Fictional Weapons Tester',creatureType:'humanoid',
  stats:{maxHp:35,hitDiceCount:6,size:1,reach:1,speed:30,str:16,dex:12,con:14,wis:10,bab:6,damageDie:6,
   statTotals:{ac:18,touchAc:11,flatFootedAc:17,attack:10,fort:6,ref:3,will:2},
   attacks:[
    {label:'Broken cold iron sword',attackKind:'manufactured',itemCondition:'broken',weaponMaterial:'cold_iron',damageTypes:['slashing'],damageDie:6},
    {label:'Improvised frying pan',attackKind:'improvised',weaponMaterial:'steel',damageTypes:['bludgeoning'],damageDie:6},
    {label:'Alchemical silver dagger',attackKind:'manufactured',weaponMaterial:'alchemical_silver',damageTypes:['piercing'],damageDie:6},
    {label:'Mithral sword',attackKind:'manufactured',weaponMaterial:'mithral',damageTypes:['slashing'],damageDie:6},
    {label:'Adamantine mace',attackKind:'manufactured',weaponMaterial:'adamantine',damageTypes:['bludgeoning'],damageDie:6}]}};
 $('creature-json').value=JSON.stringify(creature,null,2);
 $('spawn-id').value='weapon_tester_1';$('spawn-x').value='4';$('spawn-y').value='4';
 $('foundation-attack-index').value=0;
 $('notice').textContent='Weapon examples loaded. Register, spawn, select weapon_tester_1 in the Target menu, then inspect attack indices 0-4. Broken/improvised penalties and critical resolution are supported.';
};
$('foundation-inspect-attack').onclick=()=>foundationRun(()=>{
 const out=interact({op:'gm_describe_attack',actor:$('foundation-target').value,index:Number($('foundation-attack-index').value)},'gm');
 $('foundation-attack-detail').textContent=JSON.stringify(out,null,2);return out;
});
function loadRoutineExample(mode){
 const crossbow=mode==='crossbow';
 const creature=crossbow?{
  id:'v319_crossbow',name:'Fictional Crossbow Tester',creatureType:'humanoid',
  stats:{maxHp:35,size:1,reach:1,bab:6,str:12,dex:16,damageDie:8,
   statTotals:{ac:17,touchAc:13,flatFootedAc:14,attack:9,damage:0,fort:4,ref:5,will:2},
   ammunition:{bolts:{type:'loaded',capacity:1,loaded:1,reserve:12,reloadAction:'move'}},
   attacks:[{label:'Heavy crossbow',attackKind:'manufactured',attackMode:'ranged',rangedKind:'projectile',rangeIncrementFeet:120,damageTypes:['piercing'],damageDie:10,ammoId:'bolts'}],
   attackPlan:{mainIndex:0}}
 }:{
  id:'v319_dualist',name:'Fictional Duelist with Bite',creatureType:'humanoid',
  stats:{maxHp:50,size:1,reach:1,bab:11,str:16,dex:16,damageDie:6,
   statTotals:{ac:20,touchAc:13,flatFootedAc:17,attack:14,damage:5,fort:7,ref:8,will:4},
   attacks:[{label:'Longsword',attackKind:'manufactured',damageTypes:['slashing'],damageDie:8,limbId:'right_hand'},
    {label:'Offhand dagger',attackKind:'manufactured',damageTypes:['piercing'],damageDie:4,limbId:'left_hand'},
    {label:'Bite',attackKind:'natural',naturalAttack:'bite',damageDie:6,limbId:'mouth'}],
   attackPlan:{mainIndex:0,offhandIndex:1,naturalIndices:[2],twoWeaponFighting:true,improvedTwoWeaponFighting:true,offhandLight:true}}
 };
 $('creature-json').value=JSON.stringify(creature,null,2);
 $('spawn-id').value=crossbow?'crossbow_1':'dualist_1';$('spawn-x').value='5';$('spawn-y').value='4';
 $('notice').textContent=`${crossbow?'Crossbow':'TWF + Bite'} example loaded. Register and spawn it, end the current creature's turn, then select it in the new Attack Routines controls. All action costs and ammunition counts are enforced.`;
}
$('routines-load-melee').onclick=()=>loadRoutineExample('melee');
$('routines-load-crossbow').onclick=()=>loadRoutineExample('crossbow');
$('routines-reload').onclick=()=>doSafe(()=>interact({op:'reload_weapon',actor:$('routines-actor').value,ammoId:$('routines-ammo-id').value,amount:Number($('routines-rounds').value)}));
$('routines-set-ammo').onclick=()=>doSafe(()=>interact({op:'gm_set_ammunition',actor:$('routines-actor').value,ammoId:$('routines-ammo-id').value,reserve:Number($('routines-set-reserve').value)},'gm'));
$('routines-draw').onclick=()=>doSafe(()=>interact({op:'draw_ammunition',actor:$('routines-actor').value,ammoId:$('routines-ammo-id').value}));
$('routines-actor').onchange=()=>render();
$('routines-ammo-id').onchange=()=>render();
$('foundation-load-attack-completion').onclick=()=>{
 const creature={id:'attack_completion_example',name:'Fictional Attack Completion Tester',creatureType:'humanoid',
  stats:{maxHp:40,hitDiceCount:6,size:1,reach:1,speed:30,str:14,dex:18,con:12,wis:10,bab:6,damageDie:6,
   statTotals:{ac:19,touchAc:14,flatFootedAc:15,attack:8,fort:5,ref:6,will:2},
   attacks:[
    {label:'Hunting bow (30-foot increment)',attackKind:'manufactured',attackMode:'ranged',rangedKind:'projectile',rangeIncrementFeet:30,damageDie:8,damageTypes:['piercing']},
    {label:'Enlarged club (2d6)',attackKind:'manufactured',damageDie:8,damageSizeSteps:1,damageTypes:['bludgeoning']},
    {label:'Merciful club (nonlethal)',attackKind:'manufactured',damageDie:6,damageIntent:'nonlethal',damageTypes:['bludgeoning']} ]}};
 $('creature-json').value=JSON.stringify(creature,null,2);
 $('spawn-id').value='attack_completion_1';$('spawn-x').value='5';$('spawn-y').value='4';$('foundation-attack-index').value=0;
 $('notice').textContent='Attack Completion test imported. Register, spawn and inspect attacks 0–2. Ranged firing is range-limited, size dice adjust, and nonlethal is independent of hit points.';
};
for(const [button,op] of [['completion-nonlethal','gm_apply_nonlethal'],['completion-heal','gm_heal_hp'],['completion-heal-nonlethal','gm_heal_nonlethal']]){
 $(button).onclick=()=>foundationRun(()=>{
  const target=$('foundation-target').value,amount=Number($('completion-amount').value);
  const out=interact({op,target,amount},'gm');
  $('completion-status').textContent=JSON.stringify({out,state:instance.nonlethalState(target)},null,2);
  return out;
 });
}
$('foundation-load-devil').onclick=()=>{
  $('creature-json').value=JSON.stringify(exampleDevil,null,2);
  $('spawn-id').value='devil_1';$('spawn-x').value='4';$('spawn-y').value='4';
  $('notice').textContent='Fictional Devil loaded. Click Register creature, then Spawn instance from definition.';
};
const foundationRun=fn=>runImport(()=>{
  const result=fn();$('foundation-result').textContent=JSON.stringify(result,null,2);return result;
});
// Read the same damage vocabulary the engine validates, not a separate UI shortlist.
for(const id of ['gm-damage-type','foundation-type']){const select=$(id);const previous=id==='foundation-type'?'fire':'bludgeoning';select.innerHTML='';for(const name of DAMAGE_TYPES){const option=E('option','',name.replace(/_/g,' '));option.value=name;select.append(option);}select.value=previous;}
$('foundation-packet-apply').onclick=()=>foundationRun(()=>{
 const data=JSON.parse($('foundation-packet').value);
 return interact({op:'gm_resolve_packet',target:$('foundation-target').value,...data},'gm');
});
$('foundation-load-hellfire').onclick=()=>{
 $('foundation-packet').value=JSON.stringify({cause:'environment',metadata:{sourceKind:'environment'},components:[
  {damageType:'fire',amount:20},
  {damageType:'unholy',amount:20,alignmentMultipliers:[{alignment:'evil',factor:0},{alignment:'good',factor:2}]}
 ]},null,2);
 $('notice').textContent='Environmental Hellfire example loaded. Evil ignores the unholy part; Good takes double that part. These are effect-specific rules, not intrinsic Unholy damage behavior.';
};
$('foundation-damage').onclick=()=>foundationRun(()=>interact({op:'gm_resolve_damage',target:$('foundation-target').value,
 amount:Number($('foundation-amount').value),damageType:$('foundation-type').value,cause:$('foundation-cause').value,
 metadata:{magical:$('foundation-magical').checked,ghostTouch:$('foundation-ghost').checked,
  ...( $('foundation-cause').value==='spell'?{sourceKind:'spell'}:{} )}},'gm'));
$('foundation-evaluate').onclick=()=>foundationRun(()=>interact({op:'gm_evaluate_effect',target:$('foundation-target').value,
 tags:[$('foundation-tag').value]},'gm'));
$('foundation-calculate').onclick=()=>foundationRun(()=>interact({op:'gm_calculate_dc',actor:$('foundation-target').value,
 abilityId:$('foundation-dc').value},'gm'));
$('gm-tile-run').onclick=()=>doSafe(()=>interact({op:'gm_set_tile',
 x:Number($('gm-tile-x').value),y:Number($('gm-tile-y').value),kind:$('gm-tile-kind').value},'gm'));
$('manual-move-run').onclick=()=>doSafe(()=>{
 if(!active)throw Error('Activate the encounter first');
 const path=$('manual-move-path').value.trim().split(';').map(v=>{
  const numbers=v.split(',').map(s=>Number(s.trim()));
  if(numbers.length!==2||numbers.some(n=>!Number.isInteger(n)))throw Error('Path uses x,y;x,y coordinates');
  return {x:numbers[0],y:numbers[1]};
 });
 const action=$('manual-move-action').value;
 if(action==='gm_free')return interact({op:'gm_adjudicate',kind:'move_free',actor:instance.active().id,
  path,allowanceFeet:Number($('gm-override-feet').value),reason:$('gm-override-reason').value},'gm');
 if(action==='double_move')return interact({op:'double_move',actor:instance.active().id,path});
 return interact({op:'move',actor:instance.active().id,path,step:action==='step',asStandard:action==='standard'});
});
$('register-creature').onclick=()=>runImport(()=>interact({op:'register_creature',definition:JSON.parse($('creature-json').value)},'gm'));
$('spawn-creature').onclick=()=>runImport(()=>interact({op:'spawn_creature',
  definition:JSON.parse($('creature-json').value).id,id:$('spawn-id').value,
  x:Number($('spawn-x').value),y:Number($('spawn-y').value),team:'enemy',
  ...($('spawn-summon').checked?{summon:{duration:{count:Number($('summon-count').value),unit:$('summon-unit').value},source:$('summon-source').value||null}}:{})},'gm'));
$('summon-target').onchange=()=>render();
$('summon-mark').onclick=()=>runImport(()=>interact({op:'gm_mark_summon',target:$('summon-target').value,
 duration:{count:Number($('summon-count').value),unit:$('summon-unit').value},source:$('summon-source').value||null,reason:$('summon-reason').value},'gm'));
$('summon-dismiss').onclick=()=>runImport(()=>interact({op:'gm_dismiss_summon',target:$('summon-target').value,reason:$('summon-reason').value},'gm'));
$('register-effect').onclick=()=>runImport(()=>interact({op:'register_effect',definition:JSON.parse($('effect-json').value)},'gm'));
$('apply-effect').onclick=()=>runImport(()=>interact({op:'apply_registered_effect',
  definition:JSON.parse($('effect-json').value).id,target:$('effect-target').value,
  rounds:Number($('effect-rounds').value)},'gm'));
$('gm-roll').onclick=()=>runImport(()=>interact({op:'gm_roll',kind:$('gm-kind').value,
  count:Number($('gm-count').value),sides:Number($('gm-sides').value),bonus:Number($('gm-bonus').value),
  label:'GM tabletop adjudication',...($('gm-kind').value==='plain'?{}:
    {target:$('gm-target').value,damageType:$('gm-damage-type').value,cause:'environment'})},'gm'));
$('gm-modifier').onclick=()=>runImport(()=>interact({op:'gm_modifier',target:$('gm-target').value,
  stat:$('gm-stat').value,value:Number($('gm-value').value),type:$('gm-type').value,
  rounds:$('gm-rounds').value===''?null:Number($('gm-rounds').value),name:'Ad hoc GM adjustment'},'gm'));
$('gm-remove').onclick=()=>runImport(()=>interact({op:'remove_effect',id:$('gm-active-effect').value},'gm'));
$('gm-ability-apply').onclick=()=>runImport(()=>interact({op:$('gm-ability-op').value,target:$('gm-target').value,
  ability:$('gm-ability').value,amount:Number($('gm-ability-amount').value)},'gm'));
$('gm-defense-attack').onclick=()=>runImport(()=>interact({op:'admin_attack',actor:instance.active().id,target:$('gm-target').value,defense:$('gm-defense').value},'gm'));
$('roll-skill').onclick=()=>runImport(()=>interact({op:'check',kind:'skill',subject:'Perception',
  target:$('effect-target').value,dc:15},'gm'));

$('ailment-json').value=JSON.stringify(sampleAilment,null,2);
const conditionSelect=$('condition-id');
for(const id of STANDARD_CONDITION_IDS){const e=E('option','',`${STANDARD_CONDITIONS[id].name} — ${STANDARD_CONDITIONS[id].coverage}`);e.value=id;conditionSelect.append(e);}
conditionSelect.value='shaken';conditionSelect.onchange=render;
$('condition-apply').onclick=()=>runImport(()=>interact({op:'apply_condition',condition:conditionSelect.value,target:$('condition-target').value,
  source:$('condition-source').value||null,rounds:$('condition-rounds').value===''?null:Number($('condition-rounds').value)},'gm'));
$('condition-remove').onclick=()=>runImport(()=>interact({op:'remove_condition',condition:conditionSelect.value,target:$('condition-target').value},'gm'));
$('ailment-register').onclick=()=>runImport(()=>interact({op:'register_ailment',definition:JSON.parse($('ailment-json').value)},'gm'));
$('ailment-expose').onclick=()=>runImport(()=>interact({op:'expose_ailment',definition:JSON.parse($('ailment-json').value).id,target:$('ailment-target').value},'gm'));
$('ailment-cure').onclick=()=>runImport(()=>interact({op:'cure_ailment',id:$('ailment-active').value},'gm'));
const timeControl=cmd=>runImport(()=>{
  const result=interact(cmd,'gm');
  lastTimeOutcome=result;
  return result;
});
const pendingDuration=()=>{
  const kind=$('pending-kind').value,type=kind==='ready'?'turn_start':$('pending-duration').value;
  if(type==='turn_start')return {type,actor:kind==='ready'?instance.active().id:$('pending-actor').value};
  if(type==='time')return {type,count:Number($('pending-count').value),unit:$('pending-unit').value,onExpire:$('pending-expiry').value};
  if(type==='initiative')return {type,afterRounds:Number($('pending-count').value),atScore:$('pending-score').value===''?null:Number($('pending-score').value),onExpire:$('pending-expiry').value};
  return {type};
};
$('pending-register').onclick=()=>timeControl({op:'gm_register_pending_event',id:$('pending-id').value.trim(),label:$('pending-label').value.trim(),trigger:$('pending-trigger').value.trim(),action:$('pending-action').value.trim(),actor:$('pending-kind').value==='ready'?instance.active().id:$('pending-actor').value,kind:$('pending-kind').value,duration:pendingDuration(),requiresInput:$('pending-gm').checked});
$('pending-trigger-button').onclick=()=>timeControl({op:'gm_trigger_pending_event',id:$('pending-active').value});
$('pending-cancel').onclick=()=>timeControl({op:'gm_cancel_pending_event',id:$('pending-active').value});
$('pending-resolve').onclick=()=>timeControl({op:'gm_resolve_pending_event',id:$('pending-triggered').value,reason:$('pending-resolution').value.trim()});
$('pending-active').onchange=()=>render();
$('concentration-active').onchange=()=>render();
$('concentration-attach').onclick=()=>doSafe(()=>{
 const spell=JSON.parse($('magic-spell-json').value),maximum=$('concentration-max').value;
 if(!spell.effect&&!spell.persistent)throw new Error('Choose an ongoing effect or persistent area before enabling concentration');
 spell.concentration={afterRounds:Number($('concentration-after').value),...(maximum!==''?{maxRounds:Number(maximum)}:{})};
 if(spell.effect)delete spell.effect.rounds;if(spell.persistent)delete spell.persistent.duration;
 instance.validateSpell(spell);$('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
$('concentration-maintain').onclick=()=>timeControl({op:'maintain_concentration',actor:instance.active().id});
$('concentration-stop').onclick=()=>timeControl({op:'stop_concentration',actor:instance.active().id});
$('concentration-check').onclick=()=>{
 const e=instance.concentrationOverview().find(e=>e.id===$('concentration-active').value);
 if(e)timeControl({op:'gm_interrupt_spell',actor:e.actor,dc:Number($('concentration-dc').value),reason:$('concentration-reason').value});
};
$('counter-ready').onclick=()=>doSafe(()=>{
  const base=JSON.parse($('magic-spell-json').value),method=$('counter-method').value;
  const spell={name:method==='same'?base.name:method==='greater'?'Greater dispel magic':'Dispel magic',level:method==='same'?base.level:method==='greater'?6:3,casterLevel:base.casterLevel,targets:[$('counter-target').value],
    ...(method==='same'?{rangeFeet:Number($('counter-range').value)}:{}),counterspell:method==='same'?{mode:'same',...(base.counterspell?.matches?{matches:base.counterspell.matches}:{})}:{mode:'dispel',...(method==='greater'?{greater:true}:{})}};
  for(const key of ['defensive','concentrationBonus','ability'])if(base[key]!==undefined)spell[key]=base[key];
  if(base.resource!==undefined)spell.resource=base.resource;
  if(method==='same'&&base.spellId!==undefined)spell.spellId=base.spellId;
  const result=interact({op:'ready_counterspell',actor:instance.active().id,id:$('counter-id').value.trim(),spell},'actor');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
for(const [id,take] of [['counter-take',true],['counter-decline',false]])$(id).onclick=()=>doSafe(()=>{
  const result=interact({op:'gm_resolve_counterspell',id:$('counter-opportunity').value,take,perceived:$('counter-perceived').checked,identificationModifier:Number($('counter-identification').value)},'gm');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-dispel-target').onchange=()=>render();
function slotSelection(){
  const actor=$('slots-actor').value,book=instance.spellBook(actor,$('slots-book').value);
  return {actor,book};
}
for(const mode of ['prepared','spontaneous'])$('slots-sample-'+mode).onclick=()=>doSafe(()=>{
  const actor=$('slots-actor').value;
  const book={id:'daily_caster',name:mode==='prepared'?'Prepared caster example':'Spontaneous caster example',mode,ability:'wis',casterLevel:5,
    pools:[{id:'general',allotment:mode==='prepared'?{type:'derived',base:{0:3,1:2},abilityScore:12}:{type:'imported',totals:{0:3,1:3}}}],
    spells:[{id:'synthetic_spell',name:'Synthetic spell',level:1},{id:'synthetic_cantrip',name:'Synthetic cantrip',level:0}],
    ...(mode==='prepared'?{preparations:[{id:'prepared_spell',spell:'synthetic_spell',slotLevel:1},{id:'prepared_cantrip',spell:'synthetic_cantrip',slotLevel:0}]}:{})};
  $('slots-json').value=JSON.stringify(book,null,2);
  $('magic-spell-json').value=JSON.stringify({name:'Synthetic spell',level:1,casterLevel:5,targets:[actor],healing:{amount:1},resource:{book:book.id,...(mode==='prepared'?{preparation:'prepared_spell'}:{spell:'synthetic_spell'})}},null,2);
  return {updated:true};
});
$('slots-preview').onclick=()=>doSafe(()=>{
  const book=JSON.parse($('slots-json').value);
  const result=book.pools.map(p=>({id:p.id,...interact({op:'gm_preview_spell_allotment',allotment:p.allotment},'gm')}));
  $('slots-result').textContent=JSON.stringify(result,null,2);return {previewed:true};
});
$('slots-configure').onclick=()=>doSafe(()=>{
  const result=interact({op:'gm_set_spellcasting',actor:$('slots-actor').value,book:JSON.parse($('slots-json').value),replace:$('slots-replace').checked,reason:$('slots-reason').value.trim()},'gm');
  $('slots-result').textContent=JSON.stringify(result,null,2);return result;
});
for(const id of ['slots-actor','slots-book','slots-spell','slots-preparation','slots-pool'])$(id).onchange=()=>render();
$('slots-preparation').onchange=()=>{
  const {book}=slotSelection(),p=book.preparations.find(p=>p.id===$('slots-preparation').value);
  if(p){$('slots-spell').value=p.spell;$('slots-level').value=p.slotLevel;}render();
};
$('slots-use').onclick=()=>doSafe(()=>{
  const {book}=slotSelection(),spell=JSON.parse($('magic-spell-json').value);
  spell.resource={book:book.id,...(book.mode==='prepared'?{preparation:$('slots-preparation').value,...($('slots-spell').value?{spell:$('slots-spell').value}:{})}:{spell:$('slots-spell').value,pool:$('slots-pool').value,slotLevel:Number($('slots-level').value)})};
  $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
for(const [id,op] of [['slots-refresh','gm_refresh_spellcasting'],['slots-restore','gm_restore_spell_resource'],['slots-prepare','gm_prepare_spell']])$(id).onclick=()=>doSafe(()=>{
  const {actor,book}=slotSelection(),command={op,actor,book:book.id,reason:$('slots-reason').value.trim()};
  if(op==='gm_restore_spell_resource')Object.assign(command,book.mode==='prepared'?{preparation:$('slots-preparation').value}:{pool:$('slots-pool').value,slotLevel:Number($('slots-level').value)});
  if(op==='gm_prepare_spell')command.preparation={id:$('slots-prepare-id').value.trim(),spell:$('slots-spell').value,pool:$('slots-pool').value,slotLevel:Number($('slots-level').value)};
  const result=interact(command,'gm');$('slots-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-sample-dispel').onclick=()=>doSafe(()=>{
  const base=JSON.parse($('magic-spell-json').value),greater=$('magic-dispel-greater').checked,effectId=$('magic-dispel-effect').value;
  const spell={name:greater?'Greater dispel magic':'Dispel magic',level:greater?6:3,casterLevel:base.casterLevel||5,castingTime:'standard',targets:[$('magic-dispel-target').value],dispel:{...(greater?{greater:true}:{}),...(effectId?{effectId}:{})}};
  $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
$('initiative-roll').onclick=()=>doSafe(()=>interact({op:'gm_begin_initiative',roll:true},'gm')); 
$('initiative-end').onclick=()=>timeControl({op:'gm_end_initiative'});
$('initiative-begin').onclick=()=>doSafe(()=>interact({op:'gm_begin_initiative',scores:JSON.parse($('initiative-results').value)},'gm'));
$('initiative-set').onclick=()=>timeControl({op:'gm_set_initiative',id:$('initiative-actor').value,score:Number($('initiative-score').value)});
$('initiative-position').onclick=()=>timeControl({op:'gm_move_initiative_after',id:$('initiative-actor').value,afterId:$('initiative-after').value});
$('initiative-delay').onclick=()=>doSafe(()=>interact({op:'delay_turn'}));
$('initiative-resume').onclick=()=>timeControl({op:'gm_queue_delay_resume',id:$('initiative-delayed').value});
$('initiative-schedule').onclick=()=>timeControl({op:'gm_schedule_initiative_event',id:$('initiative-event-id').value.trim(),label:$('initiative-event-label').value.trim(),afterRounds:Number($('initiative-event-rounds').value),atScore:$('initiative-event-score').value===''?null:Number($('initiative-event-score').value),expireEffectId:$('initiative-effect-id').value.trim()||null,requiresInput:$('initiative-event-gm').checked});
$('initiative-cancel').onclick=()=>timeControl({op:'gm_cancel_initiative_event',id:$('initiative-cancel-id').value.trim()});
$('initiative-ack').onclick=()=>timeControl({op:'gm_acknowledge_initiative_event',reason:$('initiative-reason').value.trim()});
$('advance-time').onclick=()=>timeControl({op:'gm_advance_time',count:Number($('time-count').value),unit:$('time-unit').value,confirmPendingEvents:lastTimeOutcome?.status==='pending_events_warning',maintainConcentration:$('time-maintain-concentration').checked});
$('advance-next-event').onclick=()=>timeControl({op:'gm_advance_to_event',confirmPendingEvents:lastTimeOutcome?.status==='pending_events_warning',maintainConcentration:$('time-maintain-concentration').checked});
$('clock-set').onclick=()=>timeControl({op:'gm_set_game_clock',day:Number($('clock-day').value),hour:Number($('clock-hour').value),minute:Number($('clock-minute').value)});
$('time-schedule').onclick=()=>timeControl({op:'gm_schedule_time_event',id:$('time-event-id').value.trim(),label:$('time-event-label').value.trim(),after:{count:Number($('time-event-count').value),unit:$('time-event-unit').value},requiresInput:$('time-event-needs-gm').checked});
$('time-acknowledge').onclick=()=>timeControl({op:'gm_acknowledge_time_event',reason:$('time-gm-reason').value.trim()});
$('lifecycle-inspect').onclick=()=>doSafe(()=>{const status=interact({op:'gm_get_lifecycle'},'gm');$('lifecycle-details').textContent=JSON.stringify(status,null,2);return status;});

for(const material of Object.keys(OBJECT_MATERIALS)){const o=E('option','',material);o.value=material;$('object-material').append(o);}
$('object-material').value='stone';
for(const category of Object.keys(OBJECT_SIZE_AC)){const o=E('option','',category);o.value=category;$('object-category').append(o);}
$('object-category').value='medium';
function objectInput(){return {material:$('object-material').value,thicknessInches:Number($('object-thickness').value),sizeCategory:$('object-category').value,
 ...($('object-hp').value===''?{}:{maxHp:Number($('object-hp').value)}),...($('object-hardness').value===''?{}:{hardness:Number($('object-hardness').value)})};}
$('object-preview').onclick=()=>doSafe(()=>{const result=instance.dispatch({op:'gm_preview_object',...objectInput()},'gm');$('object-preview-state').textContent=JSON.stringify(result,null,2);return result;});
$('object-spawn').onclick=()=>doSafe(()=>interact({op:'gm_spawn_object',...objectInput(),id:$('object-id').value,name:$('object-name').value,x:Number($('object-x').value),y:Number($('object-y').value),size:Number($('object-size').value)},'gm'));
$('object-repair').onclick=()=>doSafe(()=>interact({op:'gm_repair_object',target:$('object-target').value,amount:Number($('object-repair-amount').value)},'gm'));
$('health-stabilize').onclick=()=>doSafe(()=>interact({op:'gm_stabilize',target:$('health-target').value,aided:true},'gm'));
$('health-continuous-set').onclick=()=>doSafe(()=>interact({op:'gm_set_continuous_damage',target:$('health-target').value,active:$('health-continuous').checked},'gm'));
$('health-configure').onclick=()=>doSafe(()=>interact({op:'gm_set_recovery',target:$('health-target').value,recovery:{fastHealing:Number($('health-fast').value),disabled:$('health-disabled').checked,excludedDamage:Number($('health-excluded').value),
 ...(Number($('health-regen').value)>0?{regeneration:{amount:Number($('health-regen').value),bypass:$('health-bypass').value.split(',').map(s=>s.trim()).filter(Boolean)}}:{})}},'gm'));
function loadRecovery(){const c=instance.find($('health-target').value),p=c.recovery||{};$('health-fast').value=p.fastHealing||0;$('health-regen').value=p.regeneration?.amount||0;$('health-bypass').value=p.regeneration?.bypass.join(',')||'';$('health-excluded').value=p.excludedDamage||0;$('health-disabled').checked=!!p.disabled;$('health-continuous').checked=!!c.vitality?.continuousDamage;}
$('health-load').onclick=()=>doSafe(()=>loadRecovery());
$('health-target').onchange=()=>{loadRecovery();render();};
$('health-suppress').onclick=()=>doSafe(()=>interact({op:'gm_suppress_regeneration',target:$('health-target').value,rounds:Number($('health-suppression-rounds').value),reason:'GM confirms regeneration shutdown'},'gm'));
$('basic-immediate').onclick=()=>doSafe(()=>interact({op:'use_immediate',actor:$('basic-actor').value,label:$('basic-label').value},'gm'));
$('basic-cooldown').onclick=()=>doSafe(()=>interact({op:'gm_set_cooldown',target:$('basic-actor').value,ability:$('basic-label').value,rounds:Number($('basic-rounds').value)},'gm'));
$('activate').onclick=()=>doSafe(()=>{active=true;startScenario(instance);lastCommand={op:'activate_encounter'};return {status:'done'};});
// V3.22: all spell and area controls in a single self-contained workbench section.
const magicAreaFromControls=()=>({shape:$('magic-shape').value,mode:$('magic-mode').value,
  origin:{x:Number($('magic-x').value),y:Number($('magic-y').value)},
  direction:$('magic-direction').value,sizeFeet:Number($('magic-size').value)});
for(const id of SPELL_CONDITION_IDS){const option=E('option','',`${STANDARD_CONDITIONS[id].name} — ${STANDARD_CONDITIONS[id].coverage}`);option.value=id;$('magic-condition').append(option);}
$('magic-condition').value='shaken';
$('magic-sample-condition').onclick=()=>doSafe(()=>{
 const targets=instance.s.creatures.filter(c=>c.id!==instance.active().id).slice(0,1).map(c=>c.id);
 $('magic-spell-json').value=JSON.stringify({name:'Synthetic condition example',level:1,casterLevel:5,castingTime:'standard',targets,
  save:{type:'will',dc:15,onSuccess:'negates'},spellResistance:true,effect:{rounds:3,conditions:['shaken']}},null,2);
 return {updated:true,...(!targets.length?{advisories:['Add a target creature and set its ID before casting.']}:{})};
});
$('magic-add-condition').onclick=()=>doSafe(()=>{
 const spell=JSON.parse($('magic-spell-json').value),effect=spell.effect||{};
 effect.conditions=[...new Set([...(effect.conditions||[]),$('magic-condition').value])];
 if(!spell.concentration)effect.rounds=Number($('magic-condition-rounds').value);
 effect.applyOnSaveSuccess=$('magic-condition-saved').checked;
 const tags=$('magic-condition-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
 if(tags.length)effect.tags=[...new Set([...(effect.tags||[]),...tags])];
 spell.effect=effect;instance.validateSpell(spell);
 $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
$('magic-clear-conditions').onclick=()=>doSafe(()=>{
 const spell=JSON.parse($('magic-spell-json').value);
 if(spell.effect){delete spell.effect.conditions;if(spell.effect.mods===undefined)delete spell.effect;}
 $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
for(const type of ['touch','ray'])$('magic-sample-'+type).onclick=()=>doSafe(()=>{
  const spell={name:type==='touch'?'Sample Touch Charge':'Sample Ray',level:1,casterLevel:5,castingTime:'standard',
    delivery:type==='touch'?{type:'touch'}:{type:'ray',rangeFeet:60},components:[{damageType:'force',dice:{count:1,sides:6}}]};
  if(type==='ray')spell.targets=instance.s.creatures.filter(c=>c.id!==instance.active().id).slice(0,1).map(c=>c.id);
  $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true,...(type==='ray'&&!spell.targets.length?{advisories:['Add a target creature and set its ID before casting the ray.']}:{})};
});
$('area-attach').onclick=()=>doSafe(()=>{
  const spell=JSON.parse($('magic-spell-json').value);spell.area=magicAreaFromControls();delete spell.targets;
  spell.persistent={duration:{count:Number($('area-count').value),unit:$('area-unit').value},
   triggers:[...($('area-create').checked?['create']:[]),...($('area-enter').checked?['enter']:[]),...($('area-turn').checked?['turn_start']:[])],
   affects:$('area-affects').value,frequency:$('area-frequency').value,effectScope:$('area-effect-scope').value};
  if(spell.concentration)delete spell.persistent.duration;
  $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
$('area-detach').onclick=()=>doSafe(()=>{const spell=JSON.parse($('magic-spell-json').value);delete spell.persistent;$('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};});
$('area-remove').onclick=()=>timeControl({op:'gm_cancel_pending_event',id:$('area-active').value,reason:'GM removes the persistent region'});
$('magic-set-time').onclick=()=>doSafe(()=>{
  const spell=JSON.parse($('magic-spell-json').value),time=$('magic-casting-time').value;
  spell.castingTime=['minute','hour'].includes(time)?{count:1,unit:time}:time;
  $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
$('magic-preview').onclick=()=>doSafe(()=>{
  const result=interact({op:'gm_preview_spell_area',area:magicAreaFromControls()},'gm');
  magicPreview=result;
  $('magic-area-result').textContent=JSON.stringify({area:result.area,affected:result.affected,cells:result.cells},null,2);
  return result;
});
$('magic-clear').onclick=()=>doSafe(()=>{magicPreview=null;$('magic-area-result').textContent='Area preview cleared.';return {cleared:true};});
$('magic-sync-area').onclick=()=>doSafe(()=>{
  const spell=JSON.parse($('magic-spell-json').value);spell.area=magicAreaFromControls();delete spell.targets;
  $('magic-spell-json').value=JSON.stringify(spell,null,2);return {updated:true};
});
$('magic-cast').onclick=()=>doSafe(()=>{
  const result=interact({op:'cast_spell',actor:instance.active().id,spell:JSON.parse($('magic-spell-json').value)},'actor');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-gm-resolve').onclick=()=>doSafe(()=>{
  const result=interact({op:'gm_resolve_spell',actor:instance.active().id,spell:JSON.parse($('magic-spell-json').value)},'gm');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-continue').onclick=()=>doSafe(()=>{
  const result=interact({op:'gm_continue_spell',aooResolved:true,damageTaken:Number($('magic-casting-damage').value)},'gm');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
for(const [id,take] of [['magic-aoo-take',true],['magic-aoo-decline',false]])$(id).onclick=()=>doSafe(()=>{
  const result=interact({op:'gm_resolve_casting_aoo',actor:$('magic-aoo-actor').value,take},'gm');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-long-continue').onclick=()=>doSafe(()=>{
  const result=interact({op:'continue_spell',actor:$('magic-ongoing').value},'actor');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-complete').onclick=()=>doSafe(()=>{
  const spell=JSON.parse($('magic-spell-json').value);
  const result=interact({op:'complete_spell',actor:$('magic-ongoing').value,...(spell.area?{area:spell.area}:{targets:spell.targets})},'gm');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-cancel').onclick=()=>doSafe(()=>{
  const result=interact({op:'cancel_spell',actor:$('magic-ongoing').value},'gm');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('magic-ongoing').onchange=()=>render();
$('magic-held').onchange=()=>render();
$('magic-touch-deliver').onclick=()=>doSafe(()=>{
  const willing=$('magic-touch-willing').checked;
  const result=interact({op:'deliver_touch_spell',actor:$('magic-held').value,target:$('magic-touch-target').value,willing},willing?'gm':'actor');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
for(const [id,creature] of [['magic-contact-creature',true],['magic-contact-object',false]])$(id).onclick=()=>doSafe(()=>{
  const result=interact({op:'gm_discharge_touch_spell',actor:$('magic-held').value,target:creature?$('magic-touch-target').value:null,reason:$('magic-contact-reason').value},'gm');
  $('magic-spell-result').textContent=JSON.stringify(result,null,2);return result;
});
$('finish-full').onclick=()=>doSafe(()=>interact({op:'finish_full_attack',actor:instance.active().id}));
$('end-turn').onclick=()=>doSafe(()=>{if(!active)throw new Error('Activate first.');return interact({op:'end_turn'});});
$('undo-turn').onclick=()=>doSafe(()=>{if(!active)throw new Error('Activate first.');return interact({op:'undo_turn'},'gm');});
$('undo-round').onclick=()=>doSafe(()=>{if(!active)throw new Error('Activate first.');return interact({op:'undo_round'},'gm');});
$('accept').onclick=()=>doSafe(()=>interact({op:'resolve_interrupt',take:true}));
$('decline').onclick=()=>doSafe(()=>interact({op:'resolve_interrupt',take:false}));
$('appendage').onclick=()=>doSafe(()=>interact({op:'resolve_rider',actor:instance.s.pendingRider.actor,mode:'appendage'}));

const defensiveSample={
 id:'defense_example',name:'Armored Sentinel (fictional)',source:'Example defensive equipment for V3.16',
 stats:{maxHp:70,hp:70,hitDiceCount:9,reach:1,size:1,speed:20,str:16,dex:14,con:14,int:10,wis:12,cha:10,bab:8,
  damageDie:8,damageOther:3,statTotals:{ac:29,touchAc:12,flatFootedAc:27,attack:11},
  equipment:[
   {id:'plate',name:'Adamantine full plate +1',kind:'armor',location:'worn',armorCategory:'heavy',armorBonus:9,enhancementBonus:1,maxDexBonus:1,armorCheckPenalty:-6,arcaneSpellFailure:35,material:'adamantine',hp:30,maxHp:30,hardness:20},
   {id:'shield',name:'Mithral heavy shield +1',kind:'shield',location:'worn',armorBonus:2,enhancementBonus:1,armorCheckPenalty:-2,arcaneSpellFailure:15,material:'mithral',hp:20,maxHp:20,hardness:15}
  ],attacks:[{label:'Longsword',damageDie:8,damageTypes:['slashing']}]
 }};
$('defense-load-example').onclick=()=>{
 $('creature-json').value=JSON.stringify(defensiveSample,null,2);
 $('spawn-id').value='sentinel_1';$('spawn-x').value='4';$('spawn-y').value='4';
 $('notice').textContent='Defensive example loaded. Register and spawn it, then select sentinel_1 in the Target dropdown of the effect-packet section. Inspect AC, remove the shield, break the armor, or test cover/concealment.';
};
function inspectDefense(op){return runImport(()=>{
 const r=interact(op,'gm');$('defense-result').textContent=JSON.stringify(r,null,2);return r;
});}
$('defense-inspect').onclick=()=>inspectDefense({op:'gm_inspect_defense',target:$('foundation-target').value});
$('defense-equip').onclick=()=>inspectDefense({op:'gm_set_equipment',target:$('foundation-target').value,
 item:$('defense-item').value,location:$('defense-location').value,broken:$('defense-broken').checked});
$('defense-apply-profile').onclick=()=>inspectDefense({op:'gm_set_defense_profile',target:$('foundation-target').value,profile:{cover:$('defense-cover').value,concealment:Number($('defense-concealment').value),concealmentSource:$('defense-source').value}});
$('defense-test').onclick=()=>inspectDefense({op:'admin_attack',actor:instance.active().id,target:$('foundation-target').value,
 defenseContext:{cover:$('defense-cover').value,concealment:Number($('defense-concealment').value),
 concealmentSource:$('defense-source').value}});

const sceneUIOps=new Set(['gm_save_map','gm_load_map','gm_list_maps','gm_delete_map','gm_clear_encounter','gm_preview_encounter_clear','gm_get_player_visibility','gm_set_player_view','gm_set_player_display','gm_preview_player_view','gm_preview_fall','gm_resolve_fall','gm_set_map_features','gm_set_door','gm_get_geometry','gm_configure_map','gm_set_tiles','gm_establish_scene','gm_close_scene','gm_set_elevation','gm_set_tile_elevation','gm_set_geometry','gm_set_traversal','gm_set_exposure','gm_get_map','gm_preview_scene_close']);
const mapLibraryResult=cmd=>{let result;doSafe(()=>{result=interact(cmd,'gm');return result;});if(result!==undefined)$('map-state').textContent=JSON.stringify(result,null,2);};
const mapKeep=()=>$('map-keep').value.split(',').map(x=>x.trim()).filter(Boolean);
$('map-list').onclick=()=>mapLibraryResult({op:'gm_list_maps'});
$('map-save').onclick=()=>{const id=$('map-save-id').value;const exists=(instance.s.savedMaps||{})[id];if(exists&&!confirm('Replace saved map '+id+'?'))return;mapLibraryResult({op:'gm_save_map',id,name:$('map-save-name').value,overwrite:!!exists,reason:'GM saves map bookmark'});};
$('map-load').onclick=()=>{if(confirm('Replace current map and objects? Save wanted changes first. Characters must be cleared.'))mapLibraryResult({op:'gm_load_map',id:$('map-save-id').value,confirm:true,reason:'GM loads map bookmark'});};
$('map-delete').onclick=()=>{if(confirm('Delete this saved map bookmark? The current map stays.'))mapLibraryResult({op:'gm_delete_map',id:$('map-save-id').value,reason:'GM removes unused map bookmark'});};
$('map-clear-preview').onclick=()=>mapLibraryResult({op:'gm_preview_encounter_clear',keep:mapKeep()});
$('map-clear').onclick=()=>{if(confirm('Clear this encounter, retaining listed creatures and all map objects? Old combat history/undo will be discarded.'))mapLibraryResult({op:'gm_clear_encounter',keep:mapKeep(),reason:'Encounter finished; preserve map'});};
$('map-resize').onclick=()=>doSafe(()=>interact({op:'gm_configure_map',width:Number($('map-width').value),height:Number($('map-height').value),reason:$('map-reason').value},'gm'));
$('map-establish').onclick=()=>doSafe(()=>interact({op:'gm_establish_scene'},'gm'));
$('map-inspect').onclick=()=>{render();$('map-state').textContent=JSON.stringify(interact({op:'gm_get_map'},'gm'),null,2);};
$('map-view').onclick=render;$('map-stack-target').onchange=render;
$('map-command-run').onclick=()=>doSafe(()=>{const cmd=JSON.parse($('map-command').value);if(!sceneUIOps.has(cmd.op))throw Error('Use a map/scene command in this editor');return interact(cmd,'gm');});
$('map-close-preview').onclick=()=>{let result;doSafe(()=>{const cmd=JSON.parse($('map-command').value);result=interact({op:'gm_preview_scene_close',keep:cmd.keep},'gm');return result;});if(result)$('map-state').textContent=JSON.stringify(result,null,2);};
for(const [id,revealed] of [['pv-reveal',true],['pv-hide',false]])$(id).onclick=()=>doSafe(()=>interact({op:'gm_set_player_view',rect:{x:Number($('pv-x').value),y:Number($('pv-y').value),width:Number($('pv-w').value),height:Number($('pv-h').value)},revealed,reason:'GM edits player reveal mask'},'gm'));
for(const [id,layer] of [['pv-show','map'],['pv-gm','gm']])$(id).onclick=()=>doSafe(()=>interact({op:'gm_set_player_display',kind:$('pv-kind').value,ids:[$('pv-id').value],display:{layer,label:$('pv-label').value,color:$('pv-color').value},reason:'GM sets public presentation'},'gm'));
$('pv-preview').onclick=()=>{$('map-state').textContent=JSON.stringify(interact({op:'gm_preview_player_view'},'gm'),null,2);};
setFixture();

for(const name of Object.keys(MAP_PRESETS)){const option=E('option','',name);option.value=name;$('map-feature-preset').append(option);}
for(const name of Object.keys(MAP_DIRECTIONS)){const option=E('option','',name);option.value=name;$('map-feature-direction').append(option);}
$('map-feature-preset').value='wall';
$('map-feature-example').onclick=()=>{
 const preset=$('map-feature-preset').value,direction=$('map-feature-direction').value;
 const region=['open','debris','difficult'].includes(preset);
 const feature={id:'feature_1',preset,...(region?{cells:[{x:1,y:1},{x:2,y:1}]}:{points:[{x:2,y:1},{x:2,y:3}]})};
 if(preset==='stairs'){
  const [dx,dy]=MAP_DIRECTIONS[direction];feature.points=[{x:3-dy,y:3+dx},{x:3+dy,y:3-dx}];
  feature.properties={directionalCosts:Object.fromEntries(Object.entries(MAP_DIRECTIONS).filter(([,v])=>v[0]*dx+v[1]*dy>0).map(([d])=>[d,2]))};feature.elevationTransition={up:direction,riseFeet:5};
 }
 if(preset==='door')feature.doorState='closed';
 $('map-command').value=JSON.stringify({op:'gm_set_map_features',features:[feature],reason:'GM declares terrain and barriers'},null,2);
};
for(const [id,state] of [['map-door-open','open'],['map-door-close','closed']])$(id).onclick=()=>doSafe(()=>interact({op:'gm_set_door',id:$('map-door').value,state,reason:$('map-reason').value},'gm'));

function fallCommand(op){
 const surface=$('fall-surface').value,fall={distanceFeet:Number($('fall-distance').value),deliberate:$('fall-deliberate').checked,surface,reduceFeet:Number($('fall-reduction').value)};
 if(surface==='water')fall.waterDepthFeet=Number($('fall-depth').value);
 if($('fall-check').value!=='')fall[surface==='water'?'diveTotal':'acrobaticsTotal']=Number($('fall-check').value);
 const cmd={op,target:$('fall-target').value,fall,reason:$('fall-reason').value};
 if($('fall-height').value!==''){cmd.landing={feet:Number($('fall-height').value),grounded:$('fall-grounded').checked};if($('fall-layer').value)cmd.landing.layer=$('fall-layer').value;}
 return cmd;
}
for(const [id,op] of [['fall-preview','gm_preview_fall'],['fall-resolve','gm_resolve_fall']])$(id).onclick=()=>{
 let result;doSafe(()=>{result=interact(fallCommand(op),'gm');return result;});
 $('fall-result').textContent=result?JSON.stringify(result,null,2):'Fall not resolved: '+$('notice').textContent;
};
