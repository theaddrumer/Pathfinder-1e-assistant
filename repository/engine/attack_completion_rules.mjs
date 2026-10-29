/** PF1e attack-completion declarations. Imported totals and natural attack routines remain authoritative. */
export const RANGED_KINDS=Object.freeze(['projectile','thrown','ray']);
export const DAMAGE_INTENTS=Object.freeze(['lethal','nonlethal']);
// Offhand/two-handed scaling applies to a Strength bonus. A negative
// Strength modifier remains the full penalty rather than being scaled.
export function strengthDamageModifier(modifier,mode='str'){
 if(mode==='none')return 0;
 if(modifier<=0)return modifier;
 return mode==='half_str'?Math.floor(modifier/2):mode==='one_half_str'?Math.floor(modifier*1.5):modifier;
}
const valid=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const parse=s=>{const m=/^(\d+)d(\d+)$/.exec(s);return m?{count:+m[1],sides:+m[2]}:null;};
// Core Rulebook weapon damage-by-size transitions for standard dice. Ambiguous reverse
// entries take the canonical progression; an unusual weapon can import its printed dice.
const up=Object.freeze({
 '1d2':'1d3','1d3':'1d4','1d4':'1d6','1d6':'1d8','1d8':'2d6',
 '1d10':'2d8','1d12':'3d6','2d4':'2d6','2d6':'3d6','2d8':'3d8',
 '2d10':'4d8','3d6':'4d6','3d8':'4d8','4d6':'6d6','4d8':'6d8',
 '6d6':'8d6','6d8':'8d8','8d6':'12d6','8d8':'12d8',
 '12d6':'16d6','12d8':'16d8'});
const down=Object.freeze({
 '1d3':'1d2','1d4':'1d3','1d6':'1d4','1d8':'1d6','1d10':'1d8',
 '1d12':'1d10','2d4':'1d6','2d6':'1d8','2d8':'1d10',
 '2d10':'2d6','3d6':'2d6','3d8':'2d8','4d6':'3d6','4d8':'2d10',
 '6d6':'4d6','6d8':'4d8','8d6':'6d6','8d8':'6d8','12d6':'8d6',
 '12d8':'8d8','16d6':'12d6','16d8':'12d8'});
export function weaponSizeDice(count,sides,steps=0){
 if(!valid(count,1,30)||!valid(sides,2,100)||!valid(steps,-5,5))throw Error('Invalid weapon dice size change');
 let key=`${count}d${sides}`;
 for(let i=0;i<Math.abs(steps);i++){
  const next=(steps>0?up:down)[key];
  if(!next)throw Error(`No standard PF1e size progression for ${key}; import explicit damage dice`);
  key=next;
 }
 const spec=parse(key);if(!spec)throw Error('Invalid damage dice progression');
 return {...spec,notation:key,steps};
}
export function validateCompletedAttack(a){
 if(a.usableWhileProne!==undefined&&typeof a.usableWhileProne!=='boolean')throw Error('Invalid usableWhileProne flag; expected boolean');
 if(a.usableWhileProne!==undefined&&!['ranged','ranged_touch'].includes(a.attackMode))throw Error('usableWhileProne requires a ranged attack mode');
 if(a.damageIntent!==undefined&&!DAMAGE_INTENTS.includes(a.damageIntent))throw Error('Unknown lethal/nonlethal damage intent');
 if(a.nonlethalProficient!==undefined&&typeof a.nonlethalProficient!=='boolean')throw Error('Invalid nonlethal proficiency');
 if(a.damageDiceCount!==undefined&&!valid(a.damageDiceCount,1,30))throw Error('Invalid weapon damage dice count');
 if(a.damageSizeSteps!==undefined&&!valid(a.damageSizeSteps,-5,5))throw Error('Invalid size change in weapon damage dice');
 if(a.damageAbility!==undefined&&!['str','none','half_str','one_half_str'].includes(a.damageAbility))throw Error('Unsupported damage ability rule');
 if(a.rangedKind!==undefined&&!RANGED_KINDS.includes(a.rangedKind))throw Error('Unknown ranged weapon category');
 if(a.rangeIncrementFeet!==undefined&&!valid(a.rangeIncrementFeet,5,5000))throw Error('Invalid ranged increment');
 if(a.rangeFeet!==undefined&&!valid(a.rangeFeet,5,50000))throw Error('Invalid spell/ray maximum range');
 if(a.firingIntoMelee!==undefined&&typeof a.firingIntoMelee!=='boolean')throw Error('Invalid firing into melee declaration');
 if(a.attackAbility!==undefined&&!['str','dex','none'].includes(a.attackAbility))throw Error('Invalid attack ability');
 if(a.firingIntoMelee===true&&!['ranged','ranged_touch'].includes(a.attackMode))throw Error('Firing into melee requires ranged mode');
 if(['ranged','ranged_touch'].includes(a.attackMode)){
  if(a.rangedKind==='ray'&&a.attackMode!=='ranged_touch')throw Error('Ray requires ranged touch mode');
  if(a.rangedKind==='ray'&&!a.rangeFeet)throw Error('Ray requires explicit maximum range');
  if(a.rangedKind!=='ray'&&!a.rangeIncrementFeet)throw Error('Projectile and thrown attacks require a range increment');
  if(!a.rangeIncrementFeet&&!a.rangeFeet)throw Error('Ranged attacks require a range increment or explicit spell range');
 }
}
