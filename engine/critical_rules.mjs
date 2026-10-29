/** PF1e critical and precision helpers. Damage typing remains that of the attack. */
export const FORTIFICATION_LEVELS=Object.freeze({light:25,moderate:50,heavy:75});
const validInt=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
export function validateCriticalProfile(profile){
 if(profile.criticalThreat!==undefined&&!validInt(profile.criticalThreat,2,20))throw Error('Critical threat lower bound must be 2–20');
 if(profile.criticalMultiplier!==undefined&&!validInt(profile.criticalMultiplier,2,5))throw Error('Invalid critical multiplier');
 for(const prop of ['keen','improvedCritical'])if(profile[prop]!==undefined&&typeof profile[prop]!=='boolean')throw Error(`Invalid ${prop} flag`);
 if(profile.precision!==undefined){
  const p=profile.precision;
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['count','sides','bonus'].includes(k))||
    !validInt(p.count,0,100)||!validInt(p.sides,2,100)||!validInt(p.bonus??0,0,10000)||!(p.count||(p.bonus??0)))
   throw Error('Invalid precision damage specification');
 }
 if(profile.extraDamage!==undefined){
  if(!Array.isArray(profile.extraDamage)||profile.extraDamage.length>12)throw Error('Invalid additional damage components');
  for(const c of profile.extraDamage)if(!c||typeof c!=='object'||Array.isArray(c)||
   Object.keys(c).some(k=>!['damageType','count','sides','bonus'].includes(k))||
   !['acid','cold','electricity','fire','sonic','force','untyped','divine','holy','unholy','good','evil','lawful','chaotic'].includes(c.damageType)||
   !validInt(c.count,0,100)||!validInt(c.sides,2,100)||!validInt(c.bonus??0,0,10000)||!(c.count||(c.bonus??0)))
   throw Error('Invalid additional damage component');
 }
}
export function criticalProfile(profile={}){
 validateCriticalProfile(profile);
 const broken=profile.itemCondition==='broken'||profile.attackKind==='improvised';
 const baseThreat=broken?20:(profile.criticalThreat??20);
 // Keen and Improved Critical never stack; neither affects a broken or improvised weapon's fixed profile.
 const expanded=broken?20:Math.max(2,21-2*(21-baseThreat));
 return {threat:(profile.keen||profile.improvedCritical)?expanded:baseThreat,
  multiplier:broken?2:(profile.criticalMultiplier??2),
  baseThreat,keen:!!profile.keen,improvedCritical:!!profile.improvedCritical,
  effectiveExpansion:(profile.keen||profile.improvedCritical)&&!broken,implemented:true};
}
export function validateFortification(chance,label='Fortification'){
 if(!validInt(chance,0,100))throw Error(`${label} must be a percentage from 0 to 100`);
}
