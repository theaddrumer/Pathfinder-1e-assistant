/** V3.16 defensive equipment and contextual attack defenses.
 * GM provides geometry/visibility adjudication; engine does not infer tactics.
 */
import {FinalOffenseGame} from './final_offense.mjs';
import {clone,abilityMod} from './core.mjs';
import {skillAbility} from './stats.mjs';
import {mapRayObstacles} from './map_geometry.mjs';
const num=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const max=(a,b)=>Math.max(a,b);
export const COVER_BONUSES=Object.freeze({none:0,partial:2,cover:4,soft:4,improved:8,total:null});
export function armorProfile(item){
 if(!item||!['armor','shield'].includes(item.kind)||item.location!=='worn'||item.destroyed||item.hp===0)return null;
 const material=item.material||'steel';
 const category=item.armorCategory||'light';
 const mithral=material==='mithral';
 const adjustedCategory=mithral?(category==='heavy'?'medium':category==='medium'?'light':'light'):category;
 const armorBase=(item.armorBonus||0)+(item.enhancementBonus||0);
 const broken=!!item.broken||(item.maxHp>0&&item.hp!==undefined&&item.hp<=Math.floor(item.maxHp/2));
 const penaltyBase=(item.armorCheckPenalty??0)+(mithral?3:0);
 const checkPenalty=Math.min(0,penaltyBase)*(broken&&item.kind==='armor'?2:1);
 const dexMax=item.kind==='armor'&&item.maxDexBonus!==undefined?item.maxDexBonus+(mithral?2:0):null;
 return {id:item.id,kind:item.kind,material,category,adjustedCategory,
  bonus:broken?Math.floor(armorBase/2):armorBase,
  maxDex:dexMax,checkPenalty,spellFailure:Math.max(0,(item.arcaneSpellFailure||0)-(mithral?10:0)),
  hardness:item.hardness??(item.material?(material==='adamantine'?20:material==='mithral'?15:10):null),
  dr:item.kind==='armor'&&material==='adamantine'?(category==='heavy'?3:category==='medium'?2:1):0,
  nonproficient:!!item.nonproficient,broken};
}
export function equipmentDefense(c){
 const pieces=(c.equipment||[]).map(armorProfile).filter(Boolean);
 const armor=pieces.filter(p=>p.kind==='armor').sort((a,b)=>b.bonus-a.bonus)[0]||null;
 const shield=pieces.filter(p=>p.kind==='shield').sort((a,b)=>b.bonus-a.bonus)[0]||null;
 const used=[armor,shield].filter(Boolean);
 return {armorBonus:armor?.bonus||0,shieldBonus:shield?.bonus||0,maxDex:armor?.maxDex??null,
  checkPenalty:used.reduce((a,p)=>a+p.checkPenalty,0),nonproficiencyPenalty:used.reduce((a,p)=>a+(p.nonproficient?p.checkPenalty:0),0),
  dr:armor?.dr||0,items:used,spellFailure:Math.min(100,used.reduce((a,p)=>a+p.spellFailure,0))};
}
export function validateDefenseProfile(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Invalid defense context');
 if(Object.keys(p).some(k=>!['cover','concealment','concealmentSource','ignoreCover','ignoreConcealment','ignoreWalls'].includes(k)))throw Error('Unknown defensive context field');
 if(p.cover!==undefined&&!Object.hasOwn(COVER_BONUSES,p.cover))throw Error('Invalid cover');
 if(p.concealment!==undefined&&!num(p.concealment,0,100))throw Error('Invalid miss chance');
 if(p.concealmentSource!==undefined&&!['visual','blur','displacement','magical','other','total'].includes(p.concealmentSource))throw Error('Invalid concealment source');
 for(const k of ['ignoreCover','ignoreConcealment','ignoreWalls'])if(p[k]!==undefined&&typeof p[k]!=='boolean')throw Error('Invalid defense flag');
}
// Geometry only: neither path selection nor any NPC tactics live in this layer.
export class DefenseGame extends FinalOffenseGame {
 // An imported incorporeal subtype is a movement capability, not a tactic.
 // Force barriers remain impassable. Ordinary walls are phasable where their
 // thickness is within the creature's space; larger solids are GM-adjudicated.
 legalPosition(id,x,y){
  const c=this.find(id),incorporeal=this.traits(id).incorporeal;
  if(!incorporeal){
   if(this.footprint(c,x,y).some(p=>this.tileKind(p.x,p.y)==='force_wall'&&this.terrainBlocks(c,p.x,p.y)))return false;
   return super.legalPosition(id,x,y);
  }
  if(!Number.isInteger(x)||!Number.isInteger(y))return false;
  for(const p of this.footprint(c,x,y)){
   if(p.x<0||p.y<0||p.x>=this.s.width||p.y>=this.s.height)return false;
   if(this.tileKind(p.x,p.y)==='force_wall'&&this.terrainBlocks(c,p.x,p.y))return false;
   if(this.tileKind(p.x,p.y)==='wall'&&this.terrainBlocks(c,p.x,p.y)&&!this.phasableWall(p.x,p.y))return false;
  }
  // Passing through the occupied square of a corporeal creature is allowed.
  // Co-occupancy and special creature barriers remain subject to GM adjudication.
  return true;
 }
 phasableWall(x,y){
  if(this.tileKind(x,y)!=='wall')return true;
  const open=(a,b)=>!['wall','force_wall'].includes(this.tileKind(a,b));
  // Thin ordinary walls: at least one opposed pair borders open squares.
  return (open(x-1,y)&&open(x+1,y))||(open(x,y-1)&&open(x,y+1));
 }
 // A solid barrier automatically denies the ordinary direct attack. An
 // incorporeal attacker lurking in a thin wall can attack out of its own wall
 // square, with the printed total-concealment limitation. Reach does NOT grant
 // permission to shoot or strike through unrelated additional walls.
 wallAttackGeometry(actorId,targetId){
  const a=this.find(actorId),b=this.find(targetId);
  const inside=this.traits(actorId).incorporeal;
  const rays=[];
  for(const origin of this.footprint(a))for(const goal of this.footprint(b)){
   const start={x:origin.x+0.5,y:origin.y+0.5};
   const end={x:goal.x+0.5,y:goal.y+0.5};
   const obstacles=mapRayObstacles(this.s,start,end,{ignoreObject:targetId});
   const sourceInWall=this.tileKind(origin.x,origin.y)==='wall';
   const targetInWall=this.tileKind(goal.x,goal.y)==='wall';
   const allowed=obstacles.every(o=>inside&&sourceInWall&&!targetInWall&&o.kind==='wall'&&o.x===origin.x&&o.y===origin.y);
   rays.push({clear:allowed,fromWall:allowed&&sourceInWall,obstacles});
  }
  const open=rays.find(r=>r.clear);
  return {blocked:!open,fromWall:!!open?.fromWall,solidObstacles:open?[]:rays[0]?.obstacles||[]};
 }
 threatens(threatenerId,victimId,vx,vy){
  if(!super.threatens(threatenerId,victimId,vx,vy))return false;
  // Compute from the proposed victim square, not its stale current position.
  const victim=this.find(victimId),x=victim.x,y=victim.y;
  try{victim.x=vx??x;victim.y=vy??y;return !this.wallAttackGeometry(threatenerId,victimId).blocked;}
  finally{victim.x=x;victim.y=y;}
 }
 validateCreature(def){super.validateCreature(def);if(def.stats.defenseProfile)validateDefenseProfile(def.stats.defenseProfile);
  for(const item of def.stats.equipment||[])if(item.kind==='armor'&&item.material==='adamantine'&&!item.armorCategory)throw Error('Adamantine armor needs a weight category for DR');
 }
 snapshotEquipmentDefense(c){return equipmentDefense(c);}
 equipmentProfile(id){return equipmentDefense(this.find(id));}
 traits(id){
  const t=super.traits(id),gear=this.equipmentProfile(id);
  if(gear.dr)t.dr.push({amount:gear.dr,bypass:[],source:'adamantine armor'});
  return t;
 }
 stat(id,key){
  const v=super.stat(id,key);
  if(!['ac','touchAc','flatFootedAc','attack'].includes(key))return v;
  const c=this.find(id),now=this.equipmentProfile(id),baseline=c.defenseEquipmentBaseline||equipmentDefense({});
  if(key==='attack')return v+now.nonproficiencyPenalty-(c.equipmentACMode==='derived'?0:(baseline.nonproficiencyPenalty||0));
  const mode=c.equipmentACMode||'baseline';
  const delta=key==='touchAc'?0:(mode==='derived'
    ?now.armorBonus+now.shieldBonus-(c.armor||0)-(c.shield||0)
    :now.armorBonus+now.shieldBonus-baseline.armorBonus-baseline.shieldBonus);
  // Importer's printed AC remains authoritative; only item changes are calculated.
  // maxDex on imported creatures often describes the *currently worn* armor,
  // not an intrinsic unarmored restriction. Preserve other caps only when explicit.
  const baseCap=c.unarmoredMaxDex??(baseline.maxDex!==null?1000:(c.maxDex??1000));
  const beforeCap=mode==='derived'?baseCap:(baseline.maxDex??baseCap);
  const afterCap=now.maxDex??baseCap;
  const dex=abilityMod(super.stat(id,'dex'));
  const capDelta=Math.min(dex,afterCap)-Math.min(dex,beforeCap);
  const adjusted=key==='flatFootedAc'?Math.min(0,Math.min(dex,afterCap))-Math.min(0,Math.min(dex,beforeCap)):capDelta;
  return v+delta+adjusted;
 }
 skillBonus(id,skill){
  const base=super.skillBonus(id,skill),a=skillAbility(skill);
  if(!['str','dex'].includes(a))return base;
  const now=this.equipmentProfile(id),old=this.find(id).defenseEquipmentBaseline||equipmentDefense({});
  return base+now.checkPenalty-(this.find(id).equipmentACMode==='derived'?0:(old.checkPenalty||0));
 }
 attackDefenseContext(actorId,targetId,attack,defense){
  const attacker=this.find(actorId),target=this.find(targetId);
  const map=this.attackMapContext(actorId,targetId,attack);
  const context={cover:map.cover,...(target.defenseProfile||{}),...(this._defenseContext||{})};
  validateDefenseProfile(context);
  const geometry=this.wallAttackGeometry(actorId,targetId);
  if(geometry.blocked&&!context.ignoreWalls){
   return {cover:'total',acBonus:0,totalCover:true,missChance:0,reroll:false,
    geometry,advisory:'Solid wall blocks line of effect; only GM-authorized special attacks can bypass it'};
  }
  let cover=context.cover||'none';
  const ranged=['ranged','ranged_touch','ray'].includes(attack.attackMode);
  if(context.ignoreCover||(attacker.improvedPreciseShot&&ranged&&cover!=='total'))cover='none';
  let chance=context.concealment??0,source=context.concealmentSource||'visual';
  if(map.sightBlocked){chance=Math.max(chance,50);source='total';}
  if(geometry.fromWall&&!context.ignoreWalls){chance=Math.max(chance,50);source='total';}
  if(this.hasCondition?.(actorId,'blinded')){chance=Math.max(chance,50);source='total';}
  if(this.hasCondition?.(targetId,'invisible')){chance=Math.max(chance,50);source='total';}
  const sightRange=(attacker.vision?.blindsight||0);
  const blindsight=sightRange>0&&this.distance(attacker,target)*5<=sightRange;
  if((blindsight&&!geometry.fromWall&&['visual','blur','displacement','total'].includes(source))||context.ignoreConcealment||
    (attacker.improvedPreciseShot&&ranged&&chance<50))chance=0;
  const reroll=!!attacker.blindFight&&!ranged&&chance>0;
  return {cover,acBonus:COVER_BONUSES[cover]||0,totalCover:cover==='total',missChance:chance,concealmentSource:source,reroll,
   geometry,advisory:cover==='none'&&chance===0?null:'Wall occlusion is automatic; other cover and visibility depend on GM adjudication'};
 }
 modifyEquipment({target,item,location,broken,hp,destroyed}={}){
  const c=this.find(target),gear=(c.equipment||[]).find(i=>i.id===item);
  this.assert(!!gear,'Unknown equipment item');
  if(location!==undefined){this.assert(['worn','held','carried','dropped'].includes(location),'Invalid location');gear.location=location;}
  if(broken!==undefined){this.assert(typeof broken==='boolean','Invalid broken flag');gear.broken=broken;}
  if(destroyed!==undefined){this.assert(typeof destroyed==='boolean','Invalid destroyed flag');gear.destroyed=destroyed;}
  if(hp!==undefined){this.assert(num(hp,0,gear.maxHp??100000),'Invalid item HP');gear.hp=hp;}
  this.s.actions.activity++;
  const result=this.equipmentProfile(target);
  this.note(`GM equipment adjustment: ${gear.name} on ${c.name}; AC ${this.stat(target,'ac')}.`);
  return {target,item,location:gear.location,broken:!!gear.broken,destroyed:!!gear.destroyed,hp:gear.hp??null,equipment:result,ac:this.stat(target,'ac')};
 }
 inspect(){return {...super.inspect(),defense:Object.fromEntries(this.s.creatures.map(c=>[c.id,{equipment:this.equipmentProfile(c.id),ac:this.stat(c.id,'ac'),touchAc:this.stat(c.id,'touchAc'),flatFootedAc:this.stat(c.id,'flatFootedAc'),traits:this.traits(c.id)}]))};}
 dispatch(command,role='actor'){
  if(command?.op==='gm_set_tile'){
   this.assert(role==='gm','Terrain editing is GM-only');
   const {x,y,kind}=command;
   this.assert(Number.isInteger(x)&&x>=0&&x<this.s.width&&Number.isInteger(y)&&y>=0&&y<this.s.height,'Tile out of bounds');
   this.assert(['open','wall','force_wall','difficult','hazard'].includes(kind),'Unknown terrain type');
   if(kind==='open')delete this.s.tiles[`${x},${y}`];else this.s.tiles[`${x},${y}`]=kind;
   this.s.actions.activity++;
   this.note(`GM sets tile (${x},${y}) to ${kind}.`);
   return {x,y,kind};
  }
  if(['gm_set_equipment','gm_inspect_defense','gm_set_defense_profile'].includes(command?.op)){
   this.assert(role==='gm','Defensive equipment adjustments are GM-only');
   if(command.op==='gm_inspect_defense'){this.find(command.target);return {target:command.target,equipment:this.equipmentProfile(command.target),ac:this.stat(command.target,'ac'),touchAc:this.stat(command.target,'touchAc'),flatFootedAc:this.stat(command.target,'flatFootedAc'),traits:this.traits(command.target)};}
   return this.transaction(()=>{if(command.op==='gm_set_defense_profile'){validateDefenseProfile(command.profile);this.find(command.target).defenseProfile=clone(command.profile);this.note(`GM changes defenses of ${this.find(command.target).name}.`);return {target:command.target,profile:clone(command.profile)};}return this.modifyEquipment(command);});
  }
  const attackOps=['attack','full_attack','full_attack_next','charge','admin_attack'];
  if(attackOps.includes(command?.op)){
   if(command.defenseContext!==undefined){this.assert(role==='gm','GM must authorize context for attack geometry');validateDefenseProfile(command.defenseContext);}
   const prior=this._defenseContext;this._defenseContext=command.defenseContext||null;
   try{return super.dispatch(command,role);}finally{this._defenseContext=prior;}
  }
  return super.dispatch(command,role);
 }
}
