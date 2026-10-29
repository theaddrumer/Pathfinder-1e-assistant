/** Validated attack-plan and ammunition definitions, shared by registry and resolver. */
const planInteger=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const planObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const planKey=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(v);
const planActions=['free','move','standard','full_round'];

/** Used by both the imported-creature validator and dynamic GM changes. */
export function validateAttackPlan(c){
 const p=c.attackPlan;if(p===undefined)return;
 if(!planObject(p)||!Array.isArray(c.attacks)||!c.attacks.length)throw Error('Attack plan requires an attack-entry library');
 const allowed=['mainIndex','offhandIndex','naturalIndices','twoWeaponFighting','improvedTwoWeaponFighting','greaterTwoWeaponFighting','offhandLight','multiattack','mainAttackCount'];
 if(Object.keys(p).some(k=>!allowed.includes(k)))throw Error('Unsupported attack-plan field');
 const ix=n=>planInteger(n,0,c.attacks.length-1);
 if(p.mainIndex!==undefined&&p.mainIndex!==null&&!ix(p.mainIndex))throw Error('Invalid main-hand attack index');
 if(p.offhandIndex!==undefined&&!ix(p.offhandIndex))throw Error('Invalid offhand attack index');
 if(p.naturalIndices!==undefined&&(!Array.isArray(p.naturalIndices)||p.naturalIndices.length>12||p.naturalIndices.some(n=>!ix(n))||new Set(p.naturalIndices).size!==p.naturalIndices.length))throw Error('Invalid natural attack indices');
 if(['twoWeaponFighting','improvedTwoWeaponFighting','greaterTwoWeaponFighting','offhandLight','multiattack'].some(k=>p[k]!==undefined&&typeof p[k]!=='boolean'))throw Error('Invalid attack-plan feat/equipment flag');
 if(p.mainAttackCount!==undefined&&!planInteger(p.mainAttackCount,1,4))throw Error('Invalid explicit main-hand attack count');
 if(p.greaterTwoWeaponFighting&&!p.improvedTwoWeaponFighting||p.improvedTwoWeaponFighting&&!p.twoWeaponFighting)throw Error('TWF feat progression inconsistent');
 if(p.offhandIndex!==undefined&&(p.mainIndex===undefined||p.mainIndex===null||p.offhandIndex===p.mainIndex))throw Error('Offhand requires a separate manufactured main-hand entry');
 const unique=[p.mainIndex,p.offhandIndex,...(p.naturalIndices||[])].filter(x=>x!==undefined&&x!==null);
 if(new Set(unique).size!==unique.length)throw Error('An attack entry cannot occupy multiple plan roles');
 if(p.mainIndex==null&&p.offhandIndex===undefined&&!(p.naturalIndices||[]).length)throw Error('Empty attack plan');
 for(const n of [p.mainIndex,p.offhandIndex].filter(n=>n!==undefined&&n!==null))
  if(c.attacks[n].attackKind==='natural'||c.attacks[n].naturalAttack)throw Error('Main/offhand entries must be manufactured weapons');
 for(const n of p.naturalIndices||[])if(c.attacks[n].attackKind!=='natural'&&!c.attacks[n].naturalAttack)throw Error('Natural plan entries must be natural attacks');
 if((p.mainIndex!==undefined&&p.mainIndex!==null)&&p.naturalIndices?.length){
  const used=[c.attacks[p.mainIndex].limbId,c.attacks[p.offhandIndex]?.limbId].filter(Boolean);
  for(const n of p.naturalIndices)if(used.includes(c.attacks[n].limbId))throw Error('A limb cannot use a weapon and a natural attack in one full attack');
 }
}
export function validateAmmo(c,path='ammunition'){
 if(c.ammunition===undefined)return;
 const require=(ok,message)=>{if(!ok)throw Error(message)};
 require(planObject(c.ammunition)&&Object.keys(c.ammunition).length<=30,`${path} must be an object with at most 30 stores`);
 for(const [id,a] of Object.entries(c.ammunition)){
  const entry=`${path}[${JSON.stringify(id)}]`;
  require(planKey(id),`${entry}: invalid ammunition store ID`);
  require(planObject(a),`${entry} must be an object`);
  const unknown=Object.keys(a).filter(k=>!['type','reserve','loaded','capacity','reloadAction','reloadProvokes','drawAction','ready'].includes(k));
  require(!unknown.length,`${entry}: unsupported ammunition fields ${unknown.map(k=>`${entry}[${JSON.stringify(k)}]`).join(', ')}`);
  require(['reserve','loaded'].includes(a.type),`${entry}.type must be reserve or loaded`);
  require(planInteger(a.reserve,0,100000),`${entry}.reserve must be an integer from 0 to 100000`);
  require(a.reloadAction===undefined||planActions.includes(a.reloadAction),`${entry}.reloadAction must be free, move, standard or full_round`);
  require(a.reloadProvokes===undefined||typeof a.reloadProvokes==='boolean',`${entry}.reloadProvokes must be boolean`);
  if(a.type==='loaded'){
   require(planInteger(a.capacity,1,100),`${entry}.capacity must be an integer from 1 to 100`);
   require(planInteger(a.loaded,0,a.capacity),`${entry}.loaded must be an integer from 0 to capacity (${a.capacity})`);
   for(const k of ['ready','drawAction'])require(a[k]===undefined,`${entry}.${k} is only supported on reserve stores`);
  }else{
   for(const k of ['loaded','capacity'])require(a[k]===undefined,`${entry}.${k} is only supported on loaded stores`);
   require(a.ready===undefined||planInteger(a.ready,0,100),`${entry}.ready must be an integer from 0 to 100`);
   require(a.drawAction===undefined||['free','move'].includes(a.drawAction),`${entry}.drawAction must be free or move`);
  }
 }
}
