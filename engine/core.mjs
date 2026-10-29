/**
 * Tabletop Kernel — narrow executable proof of concept.
 * A deterministic state manager, NOT a complete Pathfinder 1e rules engine.
 * No networking, external rules retrieval, or LLM access.
 */
import {ABILITIES, DEFENSES, TOTALS, MODIFIER_TYPES, modifierTarget, SKILL_NAME, skillAbility} from './stats.mjs';
import {unlinkEffectDeadlines} from './lifecycle.mjs';
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const key = (x,y) => `${x},${y}`;
export const abilityMod = score => Math.floor((score - 10) / 2);

export function stackModifiers(modifiers) {
  // Positive typed bonuses normally do not stack; dodge/circumstance do.
  // Untyped bonuses stack except repeated bonuses from the same source.
  // Typed penalties usually do not stack; untyped penalties usually do.
  const bonuses = new Map(), penalties = new Map(); let total = 0;
  for (const m of modifiers) {
    if (!Number.isFinite(m.value)) throw new Error('Non-numeric modifier');
    const t = m.type || 'untyped';
    if (m.value < 0) {
      // Most penalties are untyped and stack; typed penalties generally use the worst.
      if (t === 'untyped') total += m.value;
      else penalties.set(t,Math.min(penalties.get(t) ?? Infinity,m.value));
      continue;
    }
    if (t === 'dodge' || t === 'circumstance') { total += m.value; continue; }
    const g = t === 'untyped' ? `untyped:${m.source || m.effectId || 'unknown'}` : t;
    bonuses.set(g, Math.max(bonuses.get(g) ?? -Infinity, m.value));
  }
  return total + [...bonuses.values()].reduce((a,b)=>a+b, 0)
    + [...penalties.values()].reduce((a,b)=>a+b, 0);
}

// Action budgets are mutable resources, not hardcoded once-per-turn flags.
// Any registered rule may grant further resources through the bounded grant API.
export const newTurnActions = () => ({
  resources:{standard:1,move:1,swift:1}, step:false, moved:false,
  fullRound:false, activity:0, grants:[]
});

const DEFAULT_COMBATANTS = [
  {id:'hero',name:'Explorer',team:'party',x:1,y:4,size:1,reach:1,speed:30,
   hp:40,maxHp:40,str:16,dex:14,con:14,wis:12,bab:5,armor:5,natural:0,sizeAttack:0,sizeCMD:0,
   fortBase:4,refBase:2,willBase:1,damageDie:8,damageOther:0,flags:{}},
  {id:'warden',name:'Bridge Warden',team:'enemy',x:5,y:3,size:2,reach:2,speed:30,
   hp:65,maxHp:65,str:22,dex:12,con:18,wis:10,bab:7,armor:2,natural:5,sizeAttack:-1,sizeCMD:1,
   fortBase:5,refBase:2,willBase:2,damageDie:8,damageOther:2,flags:{}}
];

export function initialState() {
  return {
    version:1, width:10,height:8,
    tiles:{'4,1':'wall','4,2':'wall','3,5':'difficult','7,5':'hazard','8,5':'hazard'},
    creatures:clone(DEFAULT_COMBATANTS),effects:[],
    seed:319199, testRolls:[],
    round:1,turn:0,aooUsed:{},
    actions:newTurnActions(),
    pendingMove:null,pendingCharge:null,chargeSequence:0,pendingFullAttack:null,interrupt:null,log:['Round 1 begins. Explorer acts first.']
  };
}

export class Game {
  constructor(state = initialState()) {
    this.s = clone(state);
    this.turnStart = clone(this.s);
    this.previousTurnStart = null;
    this.roundStart = clone(this.s);
  }
  // One rollback boundary per synchronous command/event. Nested resolvers join
  // it; an error aborts the whole operation, including RNG and undo checkpoints.
  // Even a caller that catches a nested failure cannot commit partial effects.
  transaction(operation) {
    if(this._transaction){
      try{return operation();}catch(error){this._transaction.error ||= error;throw error;}
    }
    const saved={s:clone(this.s),turnStart:clone(this.turnStart),roundStart:clone(this.roundStart),
      previousTurnStart:clone(this.previousTurnStart)};
    const transaction={error:null};this._transaction=transaction;
    try{
      const result=operation();
      if(transaction.error)throw transaction.error;
      return result;
    }catch(error){Object.assign(this,saved);throw error;}
    finally{this._transaction=null;}
  }
  find(id) { const c=this.s.creatures.find(c=>c.id===id); if (!c) throw new Error(`Unknown creature ${id}`); return c; }
  canAct(id) { return this.find(id).hp>0; }
  canBeAttacked(id) { return this.find(id).hp>0; }
  takesTurns(c) { return !c.objectProfile; }
  applyHpLoss(id,amount,context={}) { const c=this.find(id);c.hp=Math.max(0,c.hp-amount); }
  adjustedHp(c,value) { return Math.max(0,Math.min(c.maxHp,value)); }
  active() { return this.s.creatures[this.s.turn]; }
  note(message) { this.s.log.push(message); if(this.s.log.length>120) this.s.log.shift(); }
  assert(cond,message) { if(!cond) throw new Error(message); }
  rollDie(sides) {
    if(this.s.testRolls?.length) {
      const next=this.s.testRolls.shift();
      this.assert(Number.isInteger(next)&&next>=1&&next<=sides, 'Invalid test die result');
      return next;
    }
    // Seeded xorshift32: deterministic and reversible via saved seed; not cryptographic.
    let x=this.s.seed|0; x ^= x<<13; x ^= x>>>17; x ^= x<<5;
    this.s.seed=x>>>0;
    return (this.s.seed % sides)+1;
  }
  effectsFor(id, stat) {
    return this.s.effects.filter(e=>e.target===id).flatMap(e=>(e.mods||[])
      .filter(m=>m.stat===stat || (DEFENSES.includes(stat)&&m.stat==='ac_all') ||
        ((stat==='fort'||stat==='ref'||stat==='will') && m.stat==='saves'))
      .map(m=>({...m,source:e.id,effectId:e.id})));
  }
  stat(id, stat) {
    const c=this.find(id), mods=(s)=>stackModifiers(this.effectsFor(id,s));
    if(ABILITIES.includes(stat)) return (c[stat]??10)+mods(stat);
    const str=abilityMod(this.stat(id,'str'));
    const dex=abilityMod(this.stat(id,'dex'));
    const con=abilityMod(this.stat(id,'con'));
    const wis=abilityMod(this.stat(id,'wis'));
    const cappedDex=score=>Math.min(abilityMod(score),c.maxDex??1000);
    const dexAC=cappedDex(this.stat(id,'dex'));
    const dexACLack=Math.min(0,dexAC);
    // Imported statblocks may supply published totals as authoritative snapshots.
    // Explicit abilityLinks specify which ability-modifier deltas should update
    // those totals; we never infer an armor Dex cap or weapon's governing stat.
    if (c.statTotals && Object.hasOwn(c.statTotals,stat)) {
      const linked=c.abilityLinks?.[stat]||[];
      const adjustment=linked.reduce((total,ability)=>total+
        (ability==='dex' && DEFENSES.includes(stat)
          ? cappedDex(this.stat(id,ability))-cappedDex(c[ability]??10)
          : abilityMod(this.stat(id,ability))-abilityMod(c[ability]??10)),0);
      return c.statTotals[stat]+adjustment+mods(stat);
    }
    switch(stat) {
      case 'ac': return 10+(c.armor||0)+(c.shield||0)+(c.natural||0)+(c.deflection||0)+(c.dodge||0)+(c.sizeAttack||0)+dexAC+mods('ac');
      case 'touchAc': return 10+(c.deflection||0)+(c.dodge||0)+(c.sizeAttack||0)+dexAC+mods('touchAc');
      case 'flatFootedAc': return 10+(c.armor||0)+(c.shield||0)+(c.natural||0)+(c.deflection||0)+(c.sizeAttack||0)+dexACLack+mods('flatFootedAc');
      case 'initiative': return dex+mods('initiative');
      case 'fort': return c.fortBase+con+mods('fort');
      case 'ref': return c.refBase+dex+mods('ref');
      case 'will': return c.willBase+wis+mods('will');
      case 'attack': return c.bab+str+c.sizeAttack+mods('attack');
      case 'damage': return str+c.damageOther+mods('damage');
      case 'cmb': return c.bab+str+c.sizeAttack+mods('cmb');
      case 'cmd': return 10+c.bab+str+dex+c.sizeCMD+mods('cmd');
      default: throw new Error(`Unsupported statistic ${stat}`);
    }
  }
  // All normal action-taking goes through these resource operations.
  // The move pool can be supplemented by a standard action, never vice versa.
  spendAction(actorId,type,label=type) {
    this.assert(this.active()?.id===actorId,'Not this creature\'s turn');
    this.assert(!this.s.pendingFullAttack,'Finish the pending full attack before taking another action');
    this.assert(this.canAct(actorId),'Creature is down');
    const pool=this.s.actions.resources;
    this.assert(['standard','move','swift','full_round'].includes(type),'Unsupported action type');
    if(type==='full_round') {
      this.assert(pool.standard>=1&&pool.move>=1,'Full-round action unavailable');
      pool.standard--;pool.move--;this.s.actions.fullRound=true;
    } else if(type==='move') {
      if(pool.move>0)pool.move--;
      else if(pool.standard>0)pool.standard--;
      else throw new Error('No move or standard action remaining');
    } else {
      this.assert(pool[type]>0,`${type} action unavailable`);
      pool[type]--;
    }
    this.s.actions.activity++;
    this.note(`${this.find(actorId).name} expends ${type.replace('_','-')} action (${String(label).slice(0,100)}).`);
    return clone(pool);
  }
  grantAction(actorId,type,count=1,source='GM adjudication') {
    this.assert(this.active()?.id===actorId,'Action grants currently apply only to the active creature');
    this.find(actorId);
    this.assert(['standard','move','swift'].includes(type),'Unsupported action grant type');
    this.assert(Number.isInteger(count)&&count>=1&&count<=4,'Invalid grant count');
    const pool=this.s.actions.resources;
    this.assert(pool[type]+count<=12,'Action resource grant limit exceeded');
    this.assert(typeof source==='string'&&source.length<=100,'Invalid grant source');
    pool[type]+=count;
    this.s.actions.grants.push({actor:actorId,type,count,source});
    this.s.actions.activity++;
    this.note(`${this.find(actorId).name} gains ${count} additional ${type} action(s) from ${source}.`);
    return clone(pool);
  }
  useAction(actorId,type,label='Unresolved adjudicated action') {
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,'Resolve pending action first');
    this.assert(typeof label==='string'&&label.length>0&&label.length<=100,'Invalid action description');
    return this.spendAction(actorId,type,label);
  }
  validateEffectModifiers(mods) {
    this.assert(Array.isArray(mods)&&mods.length<=100,'Invalid effect modifiers');
    for (const m of mods) {
      this.assert(modifierTarget(m.stat),'Unsupported modifier target');
      this.assert(typeof m.value==='number' && Number.isFinite(m.value) && Math.abs(m.value)<=100,'Invalid modifier');
      this.assert(MODIFIER_TYPES.includes(m.type||'untyped'),'Unknown modifier type');
    }
  }
  addEffect({id,name,source,target,mods=[],rounds=null,untilHitSource=false}) {
    this.find(target); if(source) this.find(source);
    this.assert(typeof id==='string' && /^[a-z0-9_-]{1,64}$/i.test(id),'Invalid effect ID');
    this.assert(!this.s.effects.some(e=>e.id===id), 'Effect ID already exists');
    this.assert(rounds===null || (Number.isInteger(rounds) && rounds>=1 && rounds<=100000),'Invalid duration');
    this.validateEffectModifiers(mods);
    this.s.effects.push({id,name:String(name).slice(0,100),source,target,mods:clone(mods),remaining:rounds,untilHitSource});
    this.s.actions.activity++;
    this.note(`${name} applies to ${this.find(target).name}.`);
  }
  removeEffect(id,{countAsAction=true}={}) {
    const effect=this.s.effects.find(e=>e.id===id);
    if (!effect) return false;
    this.s.effects=this.s.effects.filter(e=>e.id!==id);
    // A manually ended modifier must not leave an orphaned initiative timer.
    // The owner can still replace it with a new, independently timed effect.
    unlinkEffectDeadlines(this.s,id);
    if(countAsAction)this.s.actions.activity++;
    this.note(`${effect.name} ends on ${this.find(effect.target).name}.`);
    return true;
  }
  emit(event,payload) {
    // A narrow but real subscription hook: declarative effect termination.
    if(event==='hit') {
      for(const e of [...this.s.effects]) {
        if(e.untilHitSource && e.target===payload.actor && e.source===payload.target) this.removeEffect(e.id);
      }
    }
  }
  footprint(c,x=c.x,y=c.y) {
    const cells=[];for(let dx=0;dx<c.size;dx++)for(let dy=0;dy<c.size;dy++)cells.push({x:x+dx,y:y+dy});return cells;
  }
  distance(a,b,ax=a.x,ay=a.y,bx=b.x,by=b.y) {
    let best=Infinity;
    for(const p of this.footprint(a,ax,ay))for(const q of this.footprint(b,bx,by))best=Math.min(best,Math.max(Math.abs(p.x-q.x),Math.abs(p.y-q.y)));
    return best;
  }
  meleeReach(actorId,targetId) {
    const a=this.find(actorId),b=this.find(targetId);
    return actorId!==targetId && this.distance(a,b)<=a.reach;
  }
  occupiesSpace(c){return c.hp>0;}
  blocksOccupancy(c,o,x,y){return this.footprint(o).some(q=>this.footprint(c,x,y).some(p=>q.x===p.x&&q.y===p.y));}
  terrainBlocks(c,x,y){return ['wall','force_wall'].includes(this.tileKind(x,y));}
  canTraverse(id,from,to){return true;}
  canChargeThrough(id,from,to){return this.canTraverse(id,from,to);}
  onSpatialMovement(c,from){}
  attackMapContext(actor,target,attack){return {cover:'none',sightBlocked:false};}
  groundContact(c){return true;}
  exposureAllowed(c,spec){return true;}
  movementThreatens(reactor,mover,from,to){return this.threatens(reactor,mover,from.x,from.y);}
  threatGeometry(a,b,vx=b.x,vy=b.y){return this.distance(a,b,a.x,a.y,vx,vy)<=a.reach;}
  threatens(threatenerId,victimId,vx,vy) {
    const a=this.find(threatenerId), b=this.find(victimId);
    return this.canAct(a.id) && this.canBeAttacked(b.id) && a.team!==b.team && this.threatGeometry(a,b,vx,vy);
  }
  legalPosition(id,x,y) {
    const c=this.find(id);
    if(!Number.isInteger(x)||!Number.isInteger(y)) return false;
    for(const p of this.footprint(c,x,y)) {
      if(p.x<0||p.y<0||p.x>=this.s.width||p.y>=this.s.height||this.terrainBlocks(c,p.x,p.y)) return false;
      for(const o of this.s.creatures.filter(o=>o.id!==id && this.occupiesSpace(o)))
        if(this.blocksOccupancy(c,o,x,y)) return false;
    }
    return true;
  }
  tileKind(x,y) {return this.s.tiles[key(x,y)]||'open';}
  moveCost(id,x,y,diagonalCount,isDiagonal=true) {
    const c=this.find(id);
    const difficult=this.footprint(c,x,y).some(p=>this.tileKind(p.x,p.y)==='difficult');
    // 5/10 alternating diagonal grid rule; multiplier for difficult terrain.
    return (isDiagonal && diagonalCount%2===0?2:1)*(difficult?2:1);
  }
  // Charge is one player/AI decision. The engine owns the path, attack, and
  // beginning-of-next-turn AC expiration. This deliberately remains a limited
  // square-grid geometry model; use GM override for unusual terrain/visibility.
  linePath(x0,y0,x1,y1) {
    let x=x0,y=y0,dx=Math.abs(x1-x0),dy=Math.abs(y1-y0);
    const sx=x0<x1?1:-1,sy=y0<y1?1:-1,steps=[];
    let error=dx-dy;
    while(x!==x1||y!==y1) {
      const doubled=2*error;
      if(doubled>-dy){error-=dy;x+=sx;}
      if(doubled<dx){error+=dx;y+=sy;}
      steps.push({x,y});
      this.assert(steps.length<=1000,'Invalid charge line');
    }
    return steps;
  }
  chargePath(actorId,targetId) {
    const actor=this.find(actorId), target=this.find(targetId);
    const candidates=[];
    const currentDistance=this.distance(actor,target);
    this.assert(currentDistance>actor.reach,'Charge requires approaching a target not already in reach');
    for(let y=0;y<=this.s.height-actor.size;y++) for(let x=0;x<=this.s.width-actor.size;x++) {
      const distance=this.distance(actor,target,x,y);
      if(distance>actor.reach)continue;
      const path=this.linePath(actor.x,actor.y,x,y);
      if(path.length===0)continue;
      let diagonals=0,cost=0;
      for(const [i,p] of path.entries()) {
        const before=i?path[i-1]:{x:actor.x,y:actor.y};
        if(p.x!==before.x&&p.y!==before.y)diagonals++;
        cost+=diagonals%2===0&&p.x!==before.x&&p.y!==before.y?2:1;
      }
      candidates.push({path,x,y,cost,geometric:Math.hypot(x-actor.x,y-actor.y)});
    }
    this.assert(candidates.length,'No square within melee reach of target');
    // First determine the closest square where an attack could be made.
    // Blocking terrain is tested AFTER distance, not used to justify charging
    // farther than the closest attacking space.
    candidates.sort((a,b)=>a.geometric-b.geometric||a.y-b.y||a.x-b.x);
    const shortest=candidates[0].geometric;
    const nearest=candidates.filter(c=>Math.abs(c.geometric-shortest)<1e-8);
    const reachable=nearest.filter(candidate=>{
      if(candidate.cost*5<10||candidate.cost*5>actor.speed*2)return false;
      // Chokes, walls, other combatants, and slowed/difficult squares prevent a charge.
      for(const cell of candidate.path) {
        if(!this.legalPosition(actorId,cell.x,cell.y))return false;
        if(this.footprint(actor,cell.x,cell.y).some(p=>['wall','difficult'].includes(this.tileKind(p.x,p.y))))return false;
      }
      // Strict supercover check: a straight segment may not slip diagonally
      // through the touching corners of blocked/occupied spaces.
      let previous={x:actor.x,y:actor.y};
      for(const cell of candidate.path){
        if(!this.canChargeThrough(actorId,previous,cell))return false;
        if(cell.x!==previous.x&&cell.y!==previous.y){
          for(const p of [{x:previous.x,y:cell.y},{x:cell.x,y:previous.y}]){
            if(!this.legalPosition(actorId,p.x,p.y))return false;
            if(this.footprint(actor,p.x,p.y).some(q=>['wall','difficult'].includes(this.tileKind(q.x,q.y))))return false;
          }
        }
        previous=cell;
      }
      // Basic board visibility between start and target; no cover/lighting model.
      const toward={x:target.x,y:target.y};
      for(const cell of this.linePath(actor.x,actor.y,toward.x,toward.y).slice(0,-1)) {
        if(this.tileKind(cell.x,cell.y)==='wall')return false;
      }
      return true;
    });
    this.assert(reachable.length>0,'No legal charge: closest attacking square is obstructed, too close, or out of range');
    return reachable[0].path;
  }
  charge(actorId,targetId,defense='ac') {
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack&&!this.s.pendingCharge,
      'Resolve pending action first');
    this.assert(this.active().id===actorId,'Not this creature\'s turn');
    const actor=this.find(actorId),target=this.find(targetId);
    this.assert(this.canAct(actor.id)&&this.canBeAttacked(target.id)&&actor.id!==target.id,'Charge requires a valid target');
    this.assert(!this.s.actions.step && !this.s.actions.moved,'Charge unavailable after other movement or five-foot step');
    this.assert(DEFENSES.includes(defense),'Unknown defense');
    const path=this.chargePath(actorId,targetId);
    const id=`charge_${actorId}_${++this.s.chargeSequence}`;
    this.s.pendingCharge={actor:actorId,target:targetId,defense};
    this.s.effects.push({id,name:'Charging (AC penalty)',source:actorId,target:actorId,
      mods:[{stat:'ac_all',value:-2,type:'untyped'}],remaining:null,expiresOnNextTurnStart:actorId});
    this.note(`${actor.name} charges ${target.name}; +2 on the charge attack and -2 to AC until next turn.`);
    return this.startMove(actorId,path,{action:'charge'});
  }
  finishMovement(result) {
    if(result?.status!=='done'||!this.s.pendingCharge)return result;
    const ch=this.s.pendingCharge;
    if(this.s.pendingMove||this.s.interrupt)return result;
    this.s.pendingCharge=null;
    if(!this.canAct(ch.actor) || !this.canBeAttacked(ch.target)){
      this.note('Charge attack cancelled because attacker or target is down.');
      return {status:'stopped',reason:'incapacitated before charge attack'};
    }
    if(this.distance(this.find(ch.actor),this.find(ch.target))>this.find(ch.actor).reach){
      this.note('Charge attack cancelled: target no longer within reach.');
      return {status:'stopped',reason:'target moved out of reach'};
    }
    const first=this.attackRoutine(ch.actor)[0];
    const attack=this.resolveAttack(ch.actor,ch.target,'Charge attack',{...first,attackOffset:(first.attackOffset||0)+2},ch.defense);
    return {status:'done',charge:{actor:ch.actor,target:ch.target},attack};
  }
  stopChargeMovement(){
    if(this.s.pendingCharge){this.s.pendingCharge=null;this.note('Charge movement ends without an attack.');}
  }
  startMove(id,path,{step=false,action='move',allowanceFeet=0}={}) {
    this.assert(!this.s.interrupt && !this.s.pendingMove,'Resolve pending action first');
    this.assert(!this.s.pendingFullAttack || step,'Finish the full attack before taking a move action');
    this.assert(['move','standard','double','charge','gm_free','crawl'].includes(action),'Unknown movement action mode');
    if(action==='gm_free')this.assert(Number.isInteger(allowanceFeet)&&allowanceFeet>=5&&allowanceFeet<=500,'Invalid GM movement allowance');
    this.assert(!step||action==='move','Five-foot steps do not expend movement actions');
    this.assert(action==='gm_free'||this.active().id===id,'Not this creature\'s turn');
    this.assert(this.canAct(id),'Creature is down');
    this.assert(Array.isArray(path)&&path.length>0&&path.length<=1000,'Invalid path');
    this.assert(action==='gm_free'||!this.s.actions.step,'Already made a five-foot step');
    const c=this.find(id); let x=c.x,y=c.y,cost=0,diagonals=0;
    for(const p of path) {
      const dx=Math.abs(p.x-x),dy=Math.abs(p.y-y);
      this.assert(Math.max(dx,dy)===1 && (dx+dy>0),'Path must use adjacent squares');
      this.assert(this.legalPosition(id,p.x,p.y)&&this.canTraverse(id,{x,y},p),`Blocked square or boundary ${p.x},${p.y}`);
      if(dx&&dy) diagonals++;
      cost+=this.moveCost(id,p.x,p.y,diagonals,!!(dx&&dy),{x,y});x=p.x;y=p.y;
    }
    if(step) {
      this.assert(path.length===1&&!this.s.actions.moved,'Five-foot step unavailable');
      this.assert(this.moveCost(id,x,y,1,false)===1,'Cannot step into difficult terrain or a costly elevation transition');
      this.s.actions.step=true;
    } else {
      this.assert(cost*5<=(action==='gm_free'?allowanceFeet:action==='crawl'?5:c.speed*(action==='double'||action==='charge'?2:1)),'Path exceeds movement speed budget');
      if(action==='gm_free')this.note(`${c.name} moves ${cost*5} feet via GM adjudication without spending an action.`);
      else if(action==='standard')this.spendAction(id,'standard','movement (standard action)');
      else if(action==='double'){this.spendAction(id,'move','double movement, first move');this.spendAction(id,'move','double movement, second move');}
      else if(action==='charge')this.spendAction(id,'full_round','charge');
      else this.spendAction(id,'move','movement');
      if(action!=='gm_free'||this.active().id===id)this.s.actions.moved=true;
    }
    this.s.actions.activity++;
    this.s.pendingMove={actor:id,path:clone(path),index:0,step,action,seen:[],threats:null};
    this.note(`${c.name} begins ${step?'a five-foot step':'moving'} (${path.length} square${path.length===1?'':'s'}).`);
    return this.continueMove();
  }
  continueMove() {
    const m=this.s.pendingMove;
    if(!m)return {status:'done'};
    const c=this.find(m.actor);
    if(!this.canContinueMovement(m.actor)) {this.s.pendingMove=null;this.s.interrupt=null;this.stopChargeMovement();this.note(`${c.name}'s movement ends (incapacitated or immobilized).`);return {status:'stopped'};}
    while(m.index<m.path.length) {
      const p=m.path[m.index];
      if(!this.legalPosition(m.actor,p.x,p.y)||!this.canTraverse(m.actor,c,p)){this.s.pendingMove=null;this.stopChargeMovement();this.note('Movement blocked by a changed battlefield.');return {status:'stopped'};}
      if(m.threats===null) {
        m.threats=m.step?[]:this.s.creatures.filter(o=>o.id!==m.actor && !m.seen.includes(o.id) &&
          (this.s.aooUsed[o.id]||0)<this.aooLimit(o.id) && this.movementThreatens(o.id,m.actor,c,p)).map(o=>o.id);
        // A given foe is offered at most one AoO opportunity for this movement action.
        for(const id of m.threats) m.seen.push(id);
      }
      m.threats=m.threats.filter(id=>this.canTakeAoO(id,m.actor));
      if(m.threats.length) {
        const reactor=m.threats.shift();
        this.s.interrupt={type:'aoo',reactor,target:m.actor,from:{x:c.x,y:c.y},to:clone(p)};
        this.note(`${this.find(reactor).name} may take an AoO: ${c.name} leaves threatened (${c.x},${c.y}) for (${p.x},${p.y}).`);
        return {status:'interrupt',interrupt:clone(this.s.interrupt)};
      }
      const previous={x:c.x,y:c.y};c.x=p.x;c.y=p.y;this.onSpatialMovement(c,previous);m.index++;m.threats=null;
      this.note(`${c.name} enters (${c.x},${c.y}).`);
      this.onMovementSquare(c);
      if(this.s.interrupt)return {status:'interrupt',interrupt:clone(this.s.interrupt)};
      if(!this.canContinueMovement(m.actor)){this.s.pendingMove=null;this.stopChargeMovement();return {status:'stopped'};}
    }
    this.s.pendingMove=null;
    this.note(`${c.name} finishes moving.`);
    return this.finishMovement({status:'done'});
  }
  canContinueMovement(id){return this.canAct(id);}
  onMovementSquare(c){
    if(this.groundContact(c)&&this.footprint(c).some(p=>this.tileKind(p.x,p.y)==='hazard')){
      const damage=this.rollDie(4);this.applyHpLoss(c.id,damage);
      this.note(`${c.name} takes ${damage} demonstration hazard damage.`);
    }
  }
  canTakeAoO(reactor,target){
    return this.s.creatures.some(c=>c.id===reactor)&&this.s.creatures.some(c=>c.id===target)&&
      (this.s.aooUsed[reactor]||0)<this.aooLimit(reactor)&&
      (this.s.pendingMove?.actor===target&&this.s.pendingMove.path[this.s.pendingMove.index]
       ?this.movementThreatens(reactor,target,this.find(target),this.s.pendingMove.path[this.s.pendingMove.index]):this.threatens(reactor,target));
  }
  aooLimit(id){const c=this.find(id);return c.flags.combatReflexes?1+Math.max(0,abilityMod(this.stat(id,'dex'))):1;}
  resolveMovementOpportunity(reactor,target,interrupt){return this.resolveAttack(reactor,target,'AoO');}
  resolveInterrupt(take) {
    const interrupt=this.s.interrupt;
    this.assert(interrupt?.type==='aoo','No AoO waiting');
    this.s.interrupt=null;
    if(take) {
      this.assert(this.canTakeAoO(interrupt.reactor,interrupt.target),'AoO is no longer legal');
      this.s.aooUsed[interrupt.reactor]=(this.s.aooUsed[interrupt.reactor]||0)+1;
      this.resolveMovementOpportunity(interrupt.reactor,interrupt.target,interrupt);
    } else this.note(`${this.find(interrupt.reactor).name} declines the AoO.`);
    return this.s.interrupt?{status:'interrupt',interrupt:clone(this.s.interrupt)}:this.continueMove();
  }
  resolveAttack(actorId,targetId,label='Attack',profile=null,defense='ac') {
    const actor=this.find(actorId),target=this.find(targetId);
    this.assert(this.canAct(actor.id) && this.canBeAttacked(target.id),'Target or attacker is down');
    this.assert(this.meleeReach(actorId,targetId),'Target out of reach');
    this.assert(DEFENSES.includes(defense),'Unknown defense');
    const targetDefense=this.stat(targetId,defense);
    const d20=this.rollDie(20), total=d20+this.stat(actorId,'attack')+(profile?.attackOffset||0);
    const hit=d20===20 || (d20!==1 && total>=targetDefense);
    if(hit) {
      const damage=Math.max(0,this.rollDie(profile?.damageDie||actor.damageDie)+this.stat(actorId,'damage')+(profile?.damageOffset||0));
      this.applyHpLoss(target.id,damage);
      this.note(`${label}: ${actor.name} rolls ${d20} (${total}) vs AC ${targetDefense}: HIT, ${damage} damage. ${target.name}: ${target.hp} HP.`);
      this.emit('hit',{actor:actorId,target:targetId});
    } else this.note(`${label}: ${actor.name} rolls ${d20} (${total}) vs AC ${targetDefense}: miss.`);
    return {d20,total,hit};
  }
  attack(actorId,targetId,defense='ac',index=0){
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,'Resolve pending action first');
    this.assert(Number.isInteger(index),'Invalid attack selection');
    const routine=this.attackRoutine(actorId);
    this.assert(index>=0&&index<routine.length,'Attack selection outside routine');
    this.spendAction(actorId,'standard','attack');
    return this.resolveAttack(actorId,targetId,'Attack',routine[index],defense);
  }
  // The attack sequence belongs to the creature's data, not to a special-case
  // Choker routine. Explicit routines represent natural weapons/TWF; otherwise
  // the provisional manufactured-weapon routine derives BAB iteratives.
  attackRoutine(id) {
    const c=this.find(id);
    // Natural attacks never acquire manufactured-weapon iteratives from BAB.
    // Explicit routine data represents the actual appendages and printed bonuses.
    const slots=Array.isArray(c.attacks)?c.attacks:
      (c.attackKind==='natural'||c.naturalAttack)
        ?[{label:c.naturalAttack||'Natural attack',attackOffset:0}]
        :Array.from({length:Math.max(1,Math.floor((c.bab-1)/5)+1)},(_,i)=>({
          label:`Attack ${i+1}`,attackOffset:i===0?0:-5*i}));
    this.assert(slots.length>=1 && slots.length<=20,'Invalid attack routine size');
    return slots.map((slot,i)=>{
      const attackOffset=slot.attackOffset??0,damageOffset=slot.damageOffset??0;
      const damageDie=slot.damageDie??c.damageDie;
      this.assert(Number.isInteger(attackOffset)&&Math.abs(attackOffset)<=100,'Invalid attack offset');
      this.assert(Number.isInteger(damageOffset)&&Math.abs(damageOffset)<=100,'Invalid damage offset');
      this.assert(Number.isInteger(damageDie)&&damageDie>=2&&damageDie<=100,'Invalid damage die');
      return {...clone(slot),label:String(slot.label||`Attack ${i+1}`).slice(0,60),attackOffset,damageOffset,damageDie};
    });
  }
  fullAttack(actorId,targetId,defense='ac') {
    this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,'Resolve pending action first');
    // Validate target and range before consuming a full-round action.
    const actor=this.find(actorId),target=this.find(targetId);
    this.assert(this.canAct(actor.id)&&this.canBeAttacked(target.id),'Target or attacker is down');
    const slots=this.attackRoutine(actorId);
    if(typeof this.validateAttackReach==='function')this.validateAttackReach(actorId,targetId,slots[0]);
    else this.assert(this.meleeReach(actorId,targetId),'Target out of reach');
    this.spendAction(actorId,'full_round','full attack');
    this.s.pendingFullAttack={actor:actorId,index:0,slots};
    this.note(`${actor.name} begins a full attack (${slots.length} strike${slots.length===1?'':'s'}).`);
    return this.nextFullAttack(actorId,targetId,defense);
  }
  nextFullAttack(actorId,targetId,defense='ac') {
    this.assert(!this.s.interrupt&&!this.s.pendingMove,'Resolve pending action first');
    const f=this.s.pendingFullAttack;
    this.assert(f&&f.actor===actorId,'No pending full attack for this creature');
    this.assert(this.active().id===actorId,`Not this creature's turn`);
    const actor=this.find(actorId),target=this.find(targetId);
    this.assert(this.canAct(actor.id)&&this.canBeAttacked(target.id),'Target or attacker is down');
    const slot=f.slots[f.index];
    if(typeof this.validateAttackReach==='function')this.validateAttackReach(actorId,targetId,slot);
    else this.assert(this.meleeReach(actorId,targetId),'Target out of reach');
    const attack=this.resolveAttack(actorId,targetId,`Full attack ${f.index+1}/${f.slots.length} (${slot.label})`,slot,defense);
    f.index++;
    if(f.index===f.slots.length){
      this.s.pendingFullAttack=null;
      this.note(`${actor.name} finishes the full attack.`);
      return {status:'done',attack,remaining:0};
    }
    this.note(`${actor.name} may select another target or five-foot step before strike ${f.index+1}/${f.slots.length}.`);
    return {status:'awaiting_attack',attack,remaining:f.slots.length-f.index,next:f.slots[f.index].label};
  }
  finishFullAttack(actorId) {
    this.assert(!this.s.interrupt&&!this.s.pendingMove,'Resolve pending action first');
    const f=this.s.pendingFullAttack;
    this.assert(f&&f.actor===actorId,'No pending full attack for this creature');
    const skipped=f.slots.length-f.index;
    this.s.pendingFullAttack=null;
    this.note(`${this.find(actorId).name} finishes the full attack, forgoing ${skipped} remaining strike(s).`);
    return {status:'done',skipped};
  }
  // Imported skill totals are snapshots. Changes to governing ability scores
  // contribute only their modifier delta; ranks and racial bonuses are never guessed.
  skillBonus(id,skill) {
    const c=this.find(id);
    this.assert(typeof skill==='string'&&SKILL_NAME.test(skill),'Invalid skill name');
    this.assert(c.skills&&Object.hasOwn(c.skills,skill),'Unknown or unregistered skill');
    const ability=c.skillAbilityLinks?.[skill]??skillAbility(skill);
    const adjustment=ability
      ? abilityMod(this.stat(id,ability))-abilityMod(c[ability]??10) : 0;
    return c.skills[skill]+adjustment
      +stackModifiers([...this.effectsFor(id,'skill_checks'),...this.effectsFor(id,`skill:${skill}`)]);
  }
  abilityCheckBonus(id,ability){
    return abilityMod(this.stat(id,ability))+stackModifiers(this.effectsFor(id,'ability_checks'));
  }
  // Skill and ability checks are not attacks or saves: natural 1/20 does not
  // auto-fail/succeed. Skills are imported as printed modifiers (snapshots).
  check(id,kind,subject,dc){
    this.find(id);
    this.assert(Number.isFinite(dc)&&Math.abs(dc)<=100000,'Invalid check DC');
    let bonus;
    if(kind==='skill') {
      this.assert(typeof subject==='string'&&SKILL_NAME.test(subject),'Invalid skill name');
      bonus=this.skillBonus(id,subject);
    } else if(kind==='ability') {
      this.assert(['str','dex','con','int','wis','cha'].includes(subject),'Unknown ability');
      bonus=this.abilityCheckBonus(id,subject);
    } else throw new Error('Unsupported check type');
    const d20=this.rollDie(20),total=d20+bonus,success=total>=dc;
    this.note(`${this.find(id).name}: ${subject} ${kind} check ${d20} + ${bonus} = ${total} vs DC ${dc}: ${success?'success':'failure'}.`);
    return {d20,bonus,total,success};
  }
  savingThrow(id,type,dc,{bonus=0}={}){
    this.assert(['fort','ref','will'].includes(type) && Number.isFinite(dc),'Invalid save');
    const d20=this.rollDie(20),total=d20+this.stat(id,type)+bonus;
    const success=d20===20 || (d20!==1 && total>=dc);
    this.note(`${this.find(id).name}: ${type.toUpperCase()} save ${d20} + ${this.stat(id,type)+bonus} = ${total} vs DC ${dc}: ${success?'success':'failure'}.`);
    return {d20,total,success};
  }
  teleport(id,x,y,reason='teleportation'){
    this.assert(this.legalPosition(id,x,y),'Invalid teleport destination');
    const c=this.find(id),old=`(${c.x},${c.y})`;c.x=x;c.y=y;
    this.s.actions.activity++;
    this.note(`${c.name} relocates ${old} → (${x},${y}) via ${reason}.`);
  }
  // Demonstration of generic random relocation, NOT a faithful rendering of Vienna's homebrew aura.
  randomTeleport(id,range=2){
    const c=this.find(id),dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    const valid=[];
    for(const [dx,dy] of dirs) for(let n=1;n<=range;n++)
      if(this.legalPosition(id,c.x+dx*n,c.y+dy*n)) valid.push({x:c.x+dx*n,y:c.y+dy*n});
    this.assert(valid.length>0,'No valid random destination');
    const selected=valid[this.rollDie(valid.length)-1];
    this.teleport(id,selected.x,selected.y,'a sample random-displacement effect');
    return selected;
  }
  endTurn(){
    this.assert(!this.s.interrupt && !this.s.pendingMove && !this.s.pendingFullAttack && !this.s.pendingCharge,'Resolve pending movement or full attack first');
    this.assert(this.s.creatures.some(c=>this.takesTurns(c)),'No creatures remain to take turns');
    const old=this.active();
    const oldRound=this.s.round;
    for(const e of [...this.s.effects]) if(e.target===old.id && e.remaining!==null && !e.initiativeTimed) {
      e.remaining--;if(e.remaining<=0)this.removeEffect(e.id,{countAsAction:false});
    }
    this.onPendingTurnEnd?.(old.id);
    this.previousTurnStart=clone(this.turnStart);
    if(this.s.initiative?.enabled)this.advanceInitiativeCursor();
    else {
      do {
        this.s.turn=(this.s.turn+1)%this.s.creatures.length;
        if(this.s.turn===0)this.s.round++;
      } while(!this.takesTurns(this.active()));
    }
    if(this.s.round>oldRound){this.s.aooUsed={};this.note(`Round ${this.s.round} begins.`);}
    this.advanceTurnClock(this.s.round-oldRound);
    this.onBeforeTurnStart?.(this.active().id);
    this.processDueTimeEvents?.();
    const deferred=this.turnStartBlocked();
    this.s.deferredTurnStart=deferred?{actor:this.active().id,roundChanged:this.s.round>oldRound}:null;
    this.s.actions=newTurnActions();
    if(!deferred)return this.finishTurnStart({actor:this.active().id,roundChanged:this.s.round>oldRound});
    this.note(`Turn start for ${this.active().name} awaits prior GM event adjudication.`);
    this.turnStart=clone(this.s);
    if(this.s.round>oldRound)this.roundStart=clone(this.s);
    return {ailmentTicks:[],negativeLevelSaves:[]};
  }
  advanceTurnClock(rounds){}
  turnStartBlocked(){
    return !!this.s.pendingInitiativeEvent||!!this.s.pendingTimeEvent||!!this.s.pendingEventDecisions?.length||!!this.hasCastingDecision?.();
  }
  beginTurnEffects({actor}){
    this.onPendingTurnStart?.(actor);
    for(const e of [...this.s.effects])if(e.expiresOnNextTurnStart===actor){
      this.removeEffect(e.id,{countAsAction:false});this.note(`${e.name} expires at turn start.`);
    }
    this.note(`${this.find(actor).name}'s turn begins.`);
    return {};
  }
  finishTurnStart(context){
    const result=this.beginTurnEffects(context);
    // Mandatory effects belong to the checkpoint, not to a voluntary action
    // taken after it. Normal and deferred starts use this identical path.
    this.s.actions.activity=0;
    this.turnStart=clone(this.s);
    if(context.roundChanged)this.roundStart=clone(this.s);
    return result;
  }
  undoTurn(){
    const hasCurrentAction=this.s.actions.activity>0 || this.s.pendingMove || this.s.pendingCharge || this.s.pendingFullAttack || this.s.interrupt;
    const snap=hasCurrentAction?this.turnStart:(this.previousTurnStart||this.turnStart);
    this.s=clone(snap);this.turnStart=clone(snap);
    if(!hasCurrentAction)this.previousTurnStart=null;
    this.note('Restored to beginning of selected turn.');
  }
  undoRound(){
    this.s=clone(this.roundStart);this.turnStart=clone(this.s);this.previousTurnStart=null;
    this.note(`Restored to start of round ${this.s.round}.`);
  }
  dispatch(command,role='actor') {
    this.assert(command && typeof command==='object' && !Array.isArray(command),'Command must be an object');
    this.assert(['gm','actor','player'].includes(role),'Unknown role');
    if(['attack','charge','full_attack','full_attack_next','admin_attack'].includes(command.op) &&
        command.defense!==undefined && command.defense!=='ac')
      this.assert(role==='gm','Nonstandard attack defense requires GM adjudication');
    const allowed=new Set(role==='gm'
      ? ['move','double_move','charge','attack','full_attack','full_attack_next','finish_full_attack','use_action','apply_effect','remove_effect','save','check','teleport','random_teleport',
         'admin_grant_action','admin_attack','end_turn','resolve_interrupt','undo_turn','undo_round']
      : ['move','double_move','charge','attack','full_attack','full_attack_next','finish_full_attack','use_action','end_turn','resolve_interrupt']);
    this.assert(allowed.has(command.op),`Action ${String(command.op)} is not authorized for ${role}`);
    if(role==='player') {
      if(command.op==='resolve_interrupt')
        this.assert(this.s.interrupt?.reactor==='hero','Player may only decide Explorer interrupts');
      else this.assert((command.actor||this.active().id)==='hero' && this.active().id==='hero',
        'Player may only control Explorer');
    }
    return this.transaction(()=>{
      switch(command.op) {
        case 'move': return this.startMove(command.actor,command.path,{step:!!command.step,action:command.asStandard?'standard':'move'});
        case 'double_move': return this.startMove(command.actor,command.path,{action:'double'});
        case 'charge': return this.charge(command.actor,command.target,command.defense||'ac');
        case 'attack': return this.attack(command.actor,command.target,command.defense||'ac',command.index??0);
        case 'full_attack': return this.fullAttack(command.actor,command.target,command.defense||'ac');
        case 'full_attack_next': return this.nextFullAttack(command.actor,command.target,command.defense||'ac');
        case 'finish_full_attack': return this.finishFullAttack(command.actor);
        case 'use_action': return this.useAction(command.actor,command.type,command.label);
        case 'admin_attack': {
          this.assert(!this.s.interrupt&&!this.s.pendingMove&&!this.s.pendingFullAttack,'Resolve pending action first');
          this.note('GM override: attack without gameplay action cost.');
          this.s.actions.activity++;
          return this.resolveAttack(command.actor,command.target,'GM override attack',null,command.defense||'ac');
        }
        case 'admin_grant_action': return this.grantAction(command.actor,command.type,command.count??1,command.source||'GM override');
        case 'apply_effect': return this.addEffect(command.effect);
        case 'remove_effect': return this.removeEffect(command.id);
        case 'save': return this.savingThrow(command.target,command.save,command.dc);
        case 'check': return this.check(command.target,command.kind,command.subject,command.dc);
        case 'teleport': return this.teleport(command.target,command.x,command.y,command.reason);
        case 'random_teleport': return this.randomTeleport(command.target,command.range);
        case 'end_turn': return this.endTurn();
        case 'resolve_interrupt': return this.resolveInterrupt(!!command.take);
        case 'undo_turn': return this.undoTurn();
        case 'undo_round': return this.undoRound();
      }
    });
  }
  exportState(){return clone(this.s);}
}
