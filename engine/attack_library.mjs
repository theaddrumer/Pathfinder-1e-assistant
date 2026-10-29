/** Standard PF1e attack vocabulary and universal attack rider definitions.
 * Definitions are descriptive until the named resolution mechanics exist.
 * No tactical decision-making or arbitrary JavaScript is imported from creature data.
 */
import {criticalProfile,validateCriticalProfile} from './critical_rules.mjs';
import {WEAPON_MATERIALS,ITEM_CONDITIONS,materialData} from './weapon_materials.mjs';
import {validateCompletedAttack,weaponSizeDice} from './attack_completion_rules.mjs';
export const ATTACK_KINDS=Object.freeze(['manufactured','improvised','natural','unarmed','touch','ranged_touch','ray','special']);
export const ATTACK_MODES=Object.freeze(['melee','ranged','melee_touch','ranged_touch']);
export const PHYSICAL_DAMAGE_MODES=Object.freeze(['all','choice']);
const B='bludgeoning',P='piercing',S='slashing';
// Bestiary defaults, not compulsory traits of every creature with that attack.
export const NATURAL_ATTACKS=Object.freeze({
 bite:{damageTypes:[B,P,S],primary:true},
 claw:{damageTypes:[B,S],primary:true},
 gore:{damageTypes:[P],primary:true},
 slam:{damageTypes:[B],primary:true},
 sting:{damageTypes:[P],primary:true},
 talon:{damageTypes:[S],primary:true},
 hoof:{damageTypes:[B],primary:false},
 tentacle:{damageTypes:[B],primary:false},
 wing:{damageTypes:[B],primary:false},
 pincers:{damageTypes:[B],primary:false},
 tail_slap:{damageTypes:[B],primary:false},
 other:{damageTypes:[],primary:false}
});
export const ATTACK_RIDERS=Object.freeze({
 grab:{
  name:'Grab',activation:'optional_after_qualifying_hit',status:'implemented_via_rider_game',
  prerequisites:'A hit with an attack expressly bearing grab; target no larger than attacker unless ability says otherwise.',
  action:'Free grapple attempt without provoking; +4 CMB to initiate and maintain.',
  modes:[
   'Normal grapple: attacker and target gain grappled when hold succeeds.',
   'Appendage hold: -20 on grapple CMB, attacker does not gain grappled.'
  ],
  damage:'Initial hit deals its normal damage. Initial grab does not add damage unless another ability (such as constrict) supplies it.',
  continuation:'Maintain grapple in subsequent rounds using the ordinary grapple rules.',
  advisory:'Grab resolves free optional checks, normal or limb-only holds; multi-grappler and nested effects remain limited.'
 },
 constrict:{name:'Constrict',activation:'on_successful_grapple_check',status:'implemented_via_rider_game',advisory:'Requires explicit constrictDie and constrictBonus on Grab attack; damage on successful grapple checks.'},
 trip:{name:'Trip',activation:'optional_after_qualifying_hit',status:'implemented_v3_14',advisory:'Free CMB vs CMD, no AoO, no counter-trip on failure; ordinary trip eligibility rules still apply.'},
 poison:{name:'Poison',activation:'on_injury_hit',status:'implemented_v3_14',advisory:'Injury delivery uses registered poisonId; requires positive weapon HP damage. Other delivery methods remain GM-driven.'},
 bleed:{name:'Bleed',activation:'on_qualifying_hit',status:'implemented_v3_14',advisory:'Fixed hit-point bleedAmount, highest same-kind amount only, tick at start of victim turn; GM cures with existing ailment action.'},
 pull:{name:'Pull',activation:'optional_after_qualifying_hit',status:'implemented_v3_15',advisory:'Free reposition check, fixed distance toward attacker; stops at obstacles; no AoO.'},
 push:{name:'Push',activation:'optional_after_qualifying_hit',status:'implemented_v3_15',advisory:'Free bull rush check, fixed distance away from attacker; stops at obstacles; no AoO.'},
 paralysis:{name:'Paralysis',activation:'on_qualifying_hit',status:'implemented_v3_14',advisory:'Explicit paralysisDC and paralysisRounds, Fortitude save and inherited immunities.'},
 energy_drain:{name:'Energy Drain',activation:'on_qualifying_hit',status:'implemented_v3_15',advisory:'Negative levels double on confirmed criticals, Fort save for each after 24h, 5 temporary HP per level by default.'}
});
const PHYSICAL=new Set([B,P,S]);
const validList=v=>Array.isArray(v)&&v.length>=1&&v.length<=3&&new Set(v).size===v.length&&v.every(x=>PHYSICAL.has(x));
export function validateAttackProfile(a){
 validateCriticalProfile(a);
 validateCompletedAttack(a);
 if(a.attackKind!==undefined&&!ATTACK_KINDS.includes(a.attackKind))throw Error('Invalid attack kind');
 if(a.attackMode!==undefined&&!ATTACK_MODES.includes(a.attackMode))throw Error('Invalid attack mode');
 if(a.ammoId!==undefined&&(typeof a.ammoId!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(a.ammoId)))throw Error('Invalid attack ammunition ID');
 if(a.limbId!==undefined&&(typeof a.limbId!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(a.limbId)))throw Error('Invalid attack limb ID');
 if(a.naturalRole!==undefined&&!['primary','secondary'].includes(a.naturalRole))throw Error('Invalid natural attack role');
 if(a.itemId!==undefined&&(typeof a.itemId!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(a.itemId)))throw Error('Invalid attack item ID');
 if(a.weaponMaterial!==undefined&&!Object.hasOwn(WEAPON_MATERIALS,a.weaponMaterial))throw Error('Unknown weapon material');
 if(a.itemCondition!==undefined&&a.itemCondition!==null&&!Object.hasOwn(ITEM_CONDITIONS,a.itemCondition))throw Error('Unknown item condition');
 if(a.improvisedProficient!==undefined&&typeof a.improvisedProficient!=='boolean')throw Error('Invalid improvised proficiency flag');
 if(a.improvisedProficient&&a.attackKind!=='improvised')throw Error('Improvised proficiency requires improvised attack kind');
 if(a.naturalAttack!==undefined&&!(a.naturalAttack in NATURAL_ATTACKS))throw Error('Unknown natural attack form');
 if(a.naturalAttack!==undefined&&a.attackKind!==undefined&&a.attackKind!=='natural')throw Error('Natural attack form conflicts with attack kind');
 if(a.damageTypes!==undefined&&!validList(a.damageTypes))throw Error('Invalid simultaneous physical damage types');
 if(a.damageMode!==undefined&&!PHYSICAL_DAMAGE_MODES.includes(a.damageMode))throw Error('Invalid physical damage selection mode');
 if(a.damageMode==='choice'&&a.damageTypes?.length<2)throw Error('Selectable damage needs two or more options');
 if(a.constrictDie!==undefined&&(!a.riders?.includes('constrict')||!Number.isInteger(a.constrictDie)||a.constrictDie<2||a.constrictDie>100))throw Error('Invalid Constrict die');
 if(a.constrictBonus!==undefined&&(!Number.isInteger(a.constrictBonus)||Math.abs(a.constrictBonus)>200))throw Error('Invalid Constrict bonus');
 if(a.grabSizeAllowance!==undefined&&(!a.riders?.includes('grab')||!Number.isInteger(a.grabSizeAllowance)||a.grabSizeAllowance<0||a.grabSizeAllowance>5))throw Error('Invalid Grab size exception');
 const rid=a.riders||[];
 if(a.poisonId!==undefined&&(!rid.includes('poison')||typeof a.poisonId!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(a.poisonId)))throw Error('Poison requires a valid registered poison ID');
 if(rid.includes('poison')&&!a.poisonId)throw Error('Poison rider requires poisonId');
 if(a.bleedAmount!==undefined&&(!rid.includes('bleed')||!Number.isInteger(a.bleedAmount)||a.bleedAmount<1||a.bleedAmount>1000))throw Error('Bleed requires a positive fixed amount');
 if(rid.includes('bleed')&&a.bleedAmount===undefined)throw Error('Bleed rider requires bleedAmount');
 if(a.paralysisDC!==undefined&&(!rid.includes('paralysis')||!Number.isInteger(a.paralysisDC)||a.paralysisDC<0||a.paralysisDC>1000))throw Error('Paralysis requires a valid Fortitude DC');
 if(a.paralysisRounds!==undefined&&(!rid.includes('paralysis')||!Number.isInteger(a.paralysisRounds)||a.paralysisRounds<1||a.paralysisRounds>100000))throw Error('Paralysis requires a positive duration');
 if(rid.includes('paralysis')&&(a.paralysisDC===undefined||a.paralysisRounds===undefined))throw Error('Paralysis rider requires DC and duration');
 for(const [kind,field] of [['pull','pullFeet'],['push','pushFeet']]){
  if(a[field]!==undefined&&(!rid.includes(kind)||!Number.isInteger(a[field])||a[field]<5||a[field]>500||a[field]%5!==0))throw Error(`${kind} requires a positive 5-foot multiple`);
  if(rid.includes(kind)&&a[field]===undefined)throw Error(`${kind} rider requires ${field}`);
 }
 if(a.energyDrainLevels!==undefined&&(!rid.includes('energy_drain')||!Number.isInteger(a.energyDrainLevels)||a.energyDrainLevels<1||a.energyDrainLevels>100))throw Error('Energy Drain needs positive negative levels');
 if(a.energyDrainDC!==undefined&&(!rid.includes('energy_drain')||!Number.isInteger(a.energyDrainDC)||a.energyDrainDC<0||a.energyDrainDC>1000))throw Error('Energy Drain requires a valid save DC');
 if(a.energyDrainTempHp!==undefined&&(!rid.includes('energy_drain')||typeof a.energyDrainTempHp!=='boolean'))throw Error('Invalid Energy Drain temp HP option');
 if(rid.includes('energy_drain')&&(a.energyDrainLevels===undefined||a.energyDrainDC===undefined))throw Error('Energy Drain rider requires levels and a Fortitude DC');
 if(a.riders!==undefined){
  if(!Array.isArray(a.riders)||a.riders.length>12||new Set(a.riders).size!==a.riders.length||
     a.riders.some(x=>typeof x!=='string'||!(x in ATTACK_RIDERS)))throw Error('Unknown/duplicate attack rider');
 }
 if(a.attackMode==='ranged'||a.attackMode==='ranged_touch'){
  // Range requires a declared increment or spell range; geometry and attack math are executable.
  if(a.naturalAttack!==undefined)throw Error('Natural attack cannot use a ranged mode by default');
 }
}
export function attackDescription(a={}){
 validateAttackProfile(a);
 const natural=a.naturalAttack?NATURAL_ATTACKS[a.naturalAttack]:null;
 const types=a.damageTypes||natural?.damageTypes||[a.damageType||B];
 const riders=(a.riders||[]).map(id=>({id,...ATTACK_RIDERS[id]}));
 const improvised=a.attackKind==='improvised',broken=a.itemCondition==='broken';
 const mat=a.weaponMaterial||'steel',material=materialData(mat);
 const critical=criticalProfile(a);
 const penalties={attack:(improvised&&!a.improvisedProficient?-4:0)+(broken?-2:0),damage:broken?-2:0};
 return {attackKind:a.attackKind||(natural?'natural':'manufactured'),attackMode:a.attackMode||'melee',
  naturalAttack:a.naturalAttack||null,primary:natural?.primary??null,damageMode:a.damageMode||'all',
  damageIntent:a.damageIntent||(a.attackKind==='unarmed'?'nonlethal':'lethal'),damageDiceCount:a.damageDiceCount||1,damageSizeSteps:a.damageSizeSteps||0,
  effectiveDamageDice:weaponSizeDice(a.damageDiceCount||1,a.damageDie||6,a.damageSizeSteps||0).notation,
  rangeIncrementFeet:a.rangeIncrementFeet??null,rangeFeet:a.rangeFeet??null,rangedKind:a.rangedKind||null,
  usableWhileProne:a.usableWhileProne===true||(a.attackMode==='ranged_touch'&&a.rangedKind==='ray'),
  damageTypes:types,riders,weaponMaterial:mat,materialBypass:[...material.bypass],itemCondition:a.itemCondition||null,
  improvised,improvisedProficient:Boolean(a.improvisedProficient),penalties,critical,
  materialAdvisories:material.notes,mechanicalCoverage:riders.length?'partial_riders_require_gm':'basic_damage_only'};
}
