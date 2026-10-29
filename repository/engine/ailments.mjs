/** Restricted, data-only PF1e style affliction definitions. No eval/custom code. */
import {ABILITIES} from './stats.mjs';
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(x);
const integer=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi;
export const TIME_UNITS={round:1,minute:10,hour:600,day:14400};
export const toRounds=(time,allowZero=false)=>{
 if(!obj(time)||!Object.hasOwn(TIME_UNITS,time.unit)||!integer(time.count,allowZero?0:1,100000))throw new Error('Invalid time interval');
 const rounds=time.count*TIME_UNITS[time.unit];
 if(!Number.isSafeInteger(rounds)||rounds>100000000)throw new Error('Interval too long');
 return rounds;
};
const dice=d=>obj(d)&&integer(d.count,0,100)&&integer(d.sides,2,1000)&&integer(d.bonus??0,-10000,10000);
export function validateAilment(def){
 if(!obj(def)||!id(def.id)||typeof def.name!=='string'||def.name.length<1||def.name.length>120||!['poison','disease','dot'].includes(def.kind))throw Error('Invalid ailment identity/kind');
 const allowed=['id','name','kind','source','save','onset','frequency','cure','effects','initialEffect','delivery'];
 if(Object.keys(def).some(k=>!allowed.includes(k)))throw Error('Unsupported ailment property');
 if(def.source!==undefined&&(typeof def.source!=='string'||def.source.length>300))throw Error('Invalid source');
 if(def.delivery!==undefined&&(!['injury','ingested','contact','inhaled','spell','other'].includes(def.delivery)))throw Error('Unknown delivery type');
 if(def.save!==undefined){
   if(!obj(def.save)||!['fort','ref','will'].includes(def.save.type)||!integer(def.save.dc,0,1000)||
    Object.keys(def.save).some(k=>!['type','dc','initial','periodic'].includes(k))||
    (def.save.initial!==undefined&&typeof def.save.initial!=='boolean')||
    (def.save.periodic!==undefined&&typeof def.save.periodic!=='boolean'))throw Error('Invalid save specification');
 }
 if(def.onset!==undefined)toRounds(def.onset,true);
 if(def.frequency!==undefined){
   if(!obj(def.frequency)||Object.keys(def.frequency).some(k=>!['every','maxTicks'].includes(k)))throw Error('Invalid frequency');
   toRounds(def.frequency.every);
   if(def.frequency.maxTicks!==undefined&&!integer(def.frequency.maxTicks,1,100000))throw Error('Invalid maxTicks');
 }
 if(def.cure!==undefined){
   if(!obj(def.cure)||!integer(def.cure.successes,1,100000)||typeof def.cure.consecutive!=='boolean'||
      Object.keys(def.cure).some(k=>!['successes','consecutive'].includes(k)))throw Error('Invalid cure');
   if(!def.save||def.save.periodic===false)throw Error('A save-based cure requires periodic saves');
 }
 if(!Array.isArray(def.effects)||def.effects.length<1||def.effects.length>12)throw Error('Ailment requires 1-12 effects');
 for(const e of def.effects){
   if(!obj(e)||!['hp','ability_damage','ability_drain','condition'].includes(e.kind))throw Error('Unknown recurring effect kind');
   if(e.kind==='hp'&&(!dice(e.dice)||!['untyped','bludgeoning','piercing','slashing','fire','cold','acid','electricity','sonic','force'].includes(e.damageType||'untyped')||Object.keys(e).some(k=>!['kind','dice','damageType'].includes(k))))throw Error('Invalid HP damage');
   if(['ability_damage','ability_drain'].includes(e.kind)&&(!ABILITIES.includes(e.ability)||!dice(e.dice)||Object.keys(e).some(k=>!['kind','ability','dice'].includes(k))))throw Error('Invalid ability damage');
   if(e.kind==='condition'&&(!id(e.condition)|| (e.rounds!==undefined&&!integer(e.rounds,1,100000))||Object.keys(e).some(k=>!['kind','condition','rounds'].includes(k))))throw Error('Invalid condition rider');
 }
 if(def.initialEffect!==undefined && typeof def.initialEffect!=='boolean')throw Error('Invalid initialEffect');
 return true;
}
