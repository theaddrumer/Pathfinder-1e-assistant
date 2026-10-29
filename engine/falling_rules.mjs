/** Pure landing arithmetic. No gravity, movement, timers, RNG or creature state. */
export function fallingPlan(spec={}){
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 check(obj(spec)&&Object.keys(spec).every(k=>['distanceFeet','deliberate','surface','waterDepthFeet','acrobaticsTotal','diveTotal','reduceFeet','override'].includes(k)),'Unknown falling input');
 const {distanceFeet,deliberate=false,surface='hard',reduceFeet=0,override}=spec;
 check(finite(distanceFeet,0,100000)&&finite(reduceFeet,0,100000),'Fall distance/reduction must be 0–100000 feet');
 check(typeof deliberate==='boolean'&&['hard','yielding','water'].includes(surface),'Invalid fall intent or surface');
 for(const key of ['acrobaticsTotal','diveTotal'])if(spec[key]!==undefined)check(Number.isInteger(spec[key])&&finite(spec[key],-100000,100000),'Supply a completed skill-check total');
 check(spec.acrobaticsTotal===undefined||(deliberate&&surface!=='water'),'Acrobatics softening requires a deliberate land fall; use diveTotal for water');
 check(spec.diveTotal===undefined||(deliberate&&surface==='water'),'A dive check requires deliberate entry into water');
 check(spec.waterDepthFeet===undefined||surface==='water','Water depth applies only to water');
 if(surface==='water')check(finite(spec.waterDepthFeet,0,100000),'Water landing needs a depth');
 if(override!==undefined){
  check(obj(override)&&Object.keys(override).every(k=>['lethal','nonlethal','prone','reason'].includes(k)),'Invalid fall override');
  check([override.lethal,override.nonlethal].every(v=>Number.isInteger(v)&&finite(v,0,100000)),'Override needs lethal and nonlethal amounts');
  check(override.prone===undefined||typeof override.prone==='boolean','Invalid prone override');
  check(typeof override.reason==='string'&&override.reason.trim().length>0&&override.reason.length<=500,'Fall override needs a reason');
 }
 const effectiveFeet=Math.max(0,distanceFeet-reduceFeet),increments=Math.floor(effectiveFeet/10);
 const result={distanceFeet,effectiveFeet,deliberate,surface,lethal:{count:0,sides:6},nonlethal:{count:0,sides:6},check:null,
  proneOn:spec.acrobaticsTotal!==undefined?'any_damage':'lethal_damage',override:override?{...override}:null,advisories:[]};
 if(surface==='water'){
  const dc=15+5*Math.floor(distanceFeet/50),requiredDepthFeet=Math.max(10,distanceFeet/3);
  if(spec.diveTotal!==undefined)result.check={skill:'swim_or_acrobatics',total:spec.diveTotal,dc,requiredDepthFeet,success:spec.diveTotal>=dc&&spec.waterDepthFeet>=requiredDepthFeet};
  if(spec.waterDepthFeet<10){
   check(!!override,'Shallow-water impact needs an explicit damage override; depth alone does not define the bottom/surface');
   result.advisories.push('Shallow-water landing adjudicated by GM.');
  }else if(!result.check?.success){
   result.nonlethal={count:Math.min(2,Math.max(0,increments-2)),sides:3};
   result.lethal.count=Math.min(20,Math.max(0,increments-4));
  }
 }else{
  const success=spec.acrobaticsTotal!==undefined&&spec.acrobaticsTotal>=15;
  if(spec.acrobaticsTotal!==undefined)result.check={skill:'acrobatics',total:spec.acrobaticsTotal,dc:15,success};
  const remaining=Math.min(20,Math.max(0,increments-(success?1:0)));
  // Acrobatics replaces the deliberate jump's first nonlethal die; it does not add another.
  result.nonlethal.count=Math.min(remaining,(deliberate?1:0)+(surface==='yielding'?1:0));
  result.lethal.count=remaining-result.nonlethal.count;
 }
 if(override){result.lethal={amount:override.lethal};result.nonlethal={amount:override.nonlethal};}
 if(reduceFeet)result.advisories.push('Distance reduction is a GM-declared special ability/effect; eligibility is not inferred.');
 return result;
}
