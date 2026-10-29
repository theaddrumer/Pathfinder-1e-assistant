/**
 * A deliberately small, data-only event interpreter. Independent from core.mjs:
 * illustrates how three real PF1 mechanics can reuse common operators.
 * It does NOT implement full combat, complete PF1 action timing, or source importing.
 */
export const deepCopy = x => JSON.parse(JSON.stringify(x));
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export class RuleProbe {
  constructor(entities=[],rules=[]) {
    this.entities=new Map(entities.map(e=>[e.id,deepCopy(e)]));
    this.rules=deepCopy(rules);
    this.effects=[];
    this.pending=[];
    this.history=[];
    this.idCount=0;
    this.maxOperations=100;
  }
  resolve(v, ctx){
    if(Array.isArray(v))return v.map(x=>this.resolve(x,ctx));
    if(!isObject(v))return v;
    if('ref' in v){
      if(typeof v.ref!=='string')throw new Error('Bad reference');
      const [root,...parts]=v.ref.split('.');
      if(!['event','rule','entity'].includes(root)) throw new Error(`Forbidden reference ${root}`);
      let val=ctx[root];
      for(const part of parts){
        if(!val || !Object.prototype.hasOwnProperty.call(val,part))throw new Error(`Unknown reference ${v.ref}`);
        val=val[part];
      }
      return val;
    }
    if(v.calc){
      const a=this.resolve(v.a,ctx), b=this.resolve(v.b,ctx);
      if(!Number.isFinite(a) || !Number.isFinite(b))throw new Error('Non-numeric arithmetic');
      if(v.calc==='floor_div') {if(b===0)throw new Error('Zero denominator');return Math.floor(a/b);}
      if(v.calc==='add')return a+b;
      if(v.calc==='multiply')return a*b;
      throw new Error(`Forbidden calculation ${v.calc}`);
    }
    return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,this.resolve(x,ctx)]));
  }
  matches(rule,event){
    if(rule.on!==event.name)return false;
    const owner=this.entities.get(rule.owner);
    if(!owner)return false;
    const ctx={event,rule,entity:owner};
    return (rule.where||[]).every(w=>{
      const left=this.resolve(w.left,ctx), right=this.resolve(w.right,ctx);
      switch(w.op){
        case 'eq':return left===right;
        case 'gt':return Number.isFinite(left)&&Number.isFinite(right)&&left>right;
        case 'one_of':return Array.isArray(right)&&right.includes(left);
        default:throw new Error(`Unknown condition ${w.op}`);
      }
    });
  }
  apply(action,ctx){
    switch(action.op){
      case 'cancel_event':ctx.event.cancelled=true;return;
      case 'set_hp':{
        const id=this.resolve(action.target,ctx), hp=this.resolve(action.hp,ctx),target=this.entities.get(id);
        if(!target||!Number.isInteger(hp)||hp<0)throw new Error('Bad hp update');
        target.hp=hp;return;
      }
      case 'duplicate_entity':{
        const id=this.resolve(action.target,ctx),e=this.entities.get(id);
        if(!e)throw new Error('Unknown creature');
        const created=deepCopy(e);created.id=`${id}#${++this.idCount}`;created.name=`${e.name} (copy)`;
        // An entity can exist logically without a square while awaiting placement.
        created.position=null;
        this.entities.set(created.id,created);
        this.history.push(`Created ${created.id}; battlefield placement still pending.`);
        return;
      }
      case 'apply_effect':{
        const target=this.resolve(action.target,ctx), source=this.resolve(action.source,ctx);
        if(!this.entities.has(target))throw new Error('Unknown effect target');
        const effect={id:`fx${++this.idCount}`,name:action.name,target,source,
          modifiers:deepCopy(action.modifiers||[]),until:action.until?this.resolve(action.until,ctx):null};
        this.effects.push(effect);return;
      }
      case 'offer_action':{
        const actor=this.resolve(action.actor,ctx);
        if(!this.entities.has(actor))throw new Error('Unknown action actor');
        this.pending.push({actor,action:action.action,mayDecline:!!action.mayDecline,
          fromRule:ctx.rule.id});
        return;
      }
      default:throw new Error(`Unknown operation ${action.op}`);
    }
  }
  emit(input){
    const event=deepCopy(input);
    if(!event.name)throw new Error('Unnamed event');
    event.cancelled=false;
    const backup={entities:deepCopy([...this.entities.entries()]),effects:deepCopy(this.effects),
      pending:deepCopy(this.pending),rules:deepCopy(this.rules),history:deepCopy(this.history),idCount:this.idCount};
    try {
      let used=0;
      for(const rule of [...this.rules]){
        if(!this.rules.find(r=>r.id===rule.id) || !this.matches(rule,event))continue;
        const ctx={event,rule,entity:this.entities.get(rule.owner)};
        for(const action of rule.actions){
          if(++used>this.maxOperations)throw new Error('Operation budget exhausted');
          this.apply(action,ctx);
        }
        if(rule.once)this.rules=this.rules.filter(r=>r.id!==rule.id);
      }
      // Remove subscriptions upon a matching terminating event. No special-case aura handling.
      this.effects=this.effects.filter(effect=>{
        if(!effect.until || effect.until.event!==event.name)return true;
        for(const [field,expected] of Object.entries(effect.until.match||{})){
          if(event[field]!==expected)return true;
        }
        return false;
      });
      this.history.push(event.name);
      return event;
    }catch(error){
      this.entities=new Map(backup.entities);this.effects=backup.effects;
      this.pending=backup.pending;this.rules=backup.rules;this.history=backup.history;
      this.idCount=backup.idCount;
      throw error;
    }
  }
}

const R = ref=>({ref});
export function sampleDefinitions(){
  return [
    {
      id:'menace_on_failed_save', owner:'archon',on:'save_failed',
      where:[{left:R('event.source'),op:'eq',right:R('rule.owner')},
             {left:R('event.save'),op:'eq',right:'will'}],
      actions:[{op:'apply_effect',name:'Menace penalty',target:R('event.target'),source:R('rule.owner'),
        modifiers:[{stat:'attack',amount:-2},{stat:'ac',amount:-2},{stat:'saves',amount:-2}],
        until:{event:'hit',match:{actor:R('event.target'),target:R('rule.owner')}}}]
    },
    {
      id:'pudding_split',owner:'pudding',on:'damage_intent',
      where:[{left:R('event.target'),op:'eq',right:R('rule.owner')},
        {left:R('event.damageType'),op:'one_of',right:['slashing','piercing']},
        {left:R('entity.hp'),op:'gt',right:10}],
      actions:[{op:'cancel_event'},
        {op:'set_hp',target:R('rule.owner'),hp:{calc:'floor_div',a:R('entity.hp'),b:2}},
        {op:'duplicate_entity',target:R('rule.owner')}]
    },
    {
      id:'contingent_action',owner:'cleric',on:'ally_unconscious',
      where:[{left:R('event.ally'),op:'eq',right:'hero'}],once:true,
      actions:[{op:'offer_action',actor:R('rule.owner'),action:'move toward fallen ally',mayDecline:true}]
    }
  ];
}
