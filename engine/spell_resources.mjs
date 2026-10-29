/** V3.27 — one authoritative daily resource owner; no live-stat slot formula. */
import {PendingEventsGame} from './pending_events.mjs';
import {clone,abilityMod} from './core.mjs';
const slotObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const slotInt=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const slotId=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/i.test(x);
const slotText=x=>typeof x==='string'&&x.trim().length>0&&x.length<=120;
const slotIdentity=x=>x.trim().toLowerCase().replace(/\s+/g,' ');
const slotAssert=(ok,message)=>{if(!ok)throw Error(message);};
function validateSlotCounts(counts){
 slotAssert(slotObj(counts)&&Object.keys(counts).length<=10,'Slots must map levels 0–9 to counts or null');
 for(const [level,count] of Object.entries(counts))slotAssert(/^[0-9]$/.test(level)&&(count===null||slotInt(count,0,1000)),'Invalid spell-slot level/count');
}
export function calculateSpellAllotment(definition){
 slotAssert(slotObj(definition)&&['imported','derived'].includes(definition.type),'Allotment needs imported or derived type');
 if(definition.type==='imported'){
  slotAssert(Object.keys(definition).every(k=>['type','totals'].includes(k)),'Imported totals cannot also add ability bonuses');
  validateSlotCounts(definition.totals);
  return {type:'imported',totals:clone(definition.totals)};
 }
 slotAssert(Object.keys(definition).every(k=>['type','base','abilityScore'].includes(k))&&slotInt(definition.abilityScore,1,1000),'Derived allotment needs an explicit fixed abilityScore');
 validateSlotCounts(definition.base);
 const base=clone(definition.base),bonus={},totals={},modifier=abilityMod(definition.abilityScore);
 for(const [level,count] of Object.entries(base)){
  // A missing/null level is inaccessible; zero base slots can gain bonuses.
  bonus[level]=count===null?0:(Number(level)>0&&modifier>=Number(level)?1+Math.floor((modifier-Number(level))/4):0);
  totals[level]=count===null?null:count+bonus[level];
 }
 return {type:'derived',abilityScore:definition.abilityScore,modifier,base,bonus,totals};
}
export class SpellResourcesGame extends PendingEventsGame {
 constructor(state){super(state);this.s.spellResources ||= [];this.turnStart=clone(this.s);this.roundStart=clone(this.s);}
 spellBooks(actor){return this.s.spellResources.filter(b=>b.actor===actor);}
 spellBook(actor,id){const b=this.spellBooks(actor).find(b=>b.id===id);this.assert(b,'Unknown spellcasting book');return b;}
 spellResourceReason(reason){this.assert(typeof reason==='string'&&reason.trim().length>0&&reason.length<=500,'GM resource update needs a reason');}
 assertSpellResourceEdit(actor){this.find(actor);this.assert(!this.castingFor?.(actor),'Finish or cancel this caster’s casting before changing spell resources');}
 recordSpellResource(book,kind,detail={}){
  const entry={kind,round:this.s.round,worldRounds:this.s.worldRounds,...clone(detail)};
  book.history.push(entry);if(book.history.length>100)book.history.shift();return entry;
 }
 validateResourceSelector(resource){
  this.assert(slotObj(resource)&&slotId(resource.book)&&Object.keys(resource).every(k=>['book','spell','preparation','pool','slotLevel'].includes(k)),'Invalid spell resource selector');
  for(const key of ['spell','preparation','pool'])if(resource[key]!==undefined)this.assert(slotId(resource[key]),'Invalid resource '+key);
  if(resource.slotLevel!==undefined)this.assert(slotInt(resource.slotLevel,0,9),'Invalid resource slot level');
 }
 makeSpellBook(actor,definition){
  this.assert(slotObj(definition)&&Object.keys(definition).every(k=>['id','name','mode','ability','casterLevel','pools','spells','preparations','conversions','cantripsAtWill'].includes(k)),'Invalid spellcasting book definition');
  const d=clone(definition);
  this.assert(slotId(d.id)&&slotText(d.name)&&['prepared','spontaneous'].includes(d.mode)&&['int','wis','cha'].includes(d.ability)&&slotInt(d.casterLevel,1,100),'Book needs id, name, mode, ability and casterLevel');
  this.assert(d.cantripsAtWill===undefined||typeof d.cantripsAtWill==='boolean','Invalid cantrip policy');
  this.assert(Array.isArray(d.spells)&&d.spells.length<=1000&&Array.isArray(d.pools)&&d.pools.length>=1&&d.pools.length<=20,'Book needs spell catalogue and slot pools');
  const spells=d.spells.map(e=>{
   this.assert(slotObj(e)&&Object.keys(e).every(k=>['id','name','spellId','level','slotLevel','atWill','sourceKind'].includes(k))&&slotId(e.id)&&slotText(e.name)&&slotInt(e.level,0,9),'Invalid spell catalogue entry');
   if(e.spellId!==undefined)this.assert(slotText(e.spellId),'Invalid catalogue spell identity');
   if(e.slotLevel!==undefined)this.assert(slotInt(e.slotLevel,e.level,9),'Invalid minimum slot level');
   if(e.atWill!==undefined)this.assert(typeof e.atWill==='boolean','Invalid at-will flag');
   if(e.sourceKind!==undefined)this.assert(['spell','spell_like'].includes(e.sourceKind),'Invalid catalogue source kind');
   this.assert(e.sourceKind!=='spell_like'||e.atWill===true,'Register only at-will SLAs here; finite SLA uses need explicit adjudication');
   return e;
  });
  this.assert(new Set(spells.map(e=>e.id)).size===spells.length,'Duplicate catalogue spell ID');
  const pools=d.pools.map(p=>{
   this.assert(slotObj(p)&&Object.keys(p).every(k=>['id','name','allotment','allowedSpells','allowConversion'].includes(k))&&slotId(p.id)&&(p.name===undefined||slotText(p.name)),'Invalid spell pool');
   if(p.allowConversion!==undefined)this.assert(typeof p.allowConversion==='boolean','Invalid conversion pool policy');
   if(p.allowedSpells!==undefined)this.assert(Array.isArray(p.allowedSpells)&&p.allowedSpells.length<=1000&&p.allowedSpells.every(id=>spells.some(e=>e.id===id)),'Invalid restricted-pool spell list');
   return {id:p.id,name:p.name||p.id,allotment:calculateSpellAllotment(p.allotment),allowedSpells:p.allowedSpells??null,
    allowConversion:p.allowConversion??(p.allowedSpells===undefined),...(d.mode==='spontaneous'?{spent:{}}:{})};
  });
  this.assert(new Set(pools.map(p=>p.id)).size===pools.length,'Duplicate spell pool ID');
  this.assert(pools.filter(p=>p.allotment.type==='derived').length<=1,'Only one pool per book may derive ability bonus slots; import fixed extra-pool totals');
  this.assert(pools.reduce((n,p)=>n+Object.values(p.allotment.totals).reduce((a,v)=>a+(v||0),0),0)<=1000,'Daily slot limit exceeded');
  const conversions=d.conversions===undefined?[]:d.conversions;
  this.assert(Array.isArray(conversions)&&conversions.every(id=>spells.some(e=>e.id===id&&!e.atWill&&e.sourceKind!=='spell_like')),'Invalid spontaneous conversion list');
  this.assert(d.mode==='prepared'||d.preparations===undefined&&conversions.length===0,'Spontaneous books cannot store preparations or prepared conversions');
  const b={actor,id:d.id,name:d.name,mode:d.mode,ability:d.ability,casterLevel:d.casterLevel,cantripsAtWill:d.cantripsAtWill!==false,
   pools,spells,conversions,preparations:[],history:[]};
  if(d.mode==='prepared'){
   this.assert(d.preparations===undefined||Array.isArray(d.preparations)&&d.preparations.length<=1000,'Invalid prepared spell list');
   for(const prep of d.preparations||[])this.addSpellPreparation(b,prep);
  }
  return b;
 }
 addSpellPreparation(book,definition){
  this.assert(book.mode==='prepared'&&slotObj(definition)&&Object.keys(definition).every(k=>['id','pool','spell','slotLevel'].includes(k))&&slotId(definition.id)&&slotId(definition.spell),'Invalid preparation');
  this.assert(!book.preparations.some(p=>p.id===definition.id),'Duplicate preparation ID');
  const entry=book.spells.find(e=>e.id===definition.spell),pool=book.pools.find(p=>p.id===(definition.pool||'general'));
  this.assert(entry&&pool,'Preparation needs a known spell and pool');
  const level=definition.slotLevel??entry.slotLevel??entry.level;
  this.assert(slotInt(level,entry.slotLevel??entry.level,9),'Prepared slot is below the spell’s required slot level');
  this.assert(pool.allowedSpells===null||pool.allowedSpells.includes(entry.id),'Spell is not permitted in that restricted pool');
  const capacity=pool.allotment.totals[level];
  this.assert(Number.isInteger(capacity)&&book.preparations.filter(p=>p.pool===pool.id&&p.slotLevel===level).length<capacity,'No unprepared slot at that level in this pool');
  const p={id:definition.id,pool:pool.id,spell:entry.id,slotLevel:level,spent:false};book.preparations.push(p);return p;
 }
 setSpellcasting({actor,book,replace=false,reason}={}){
  this.assertSpellResourceEdit(actor);this.spellResourceReason(reason);this.assert(typeof replace==='boolean','Invalid replacement flag');
  const next=this.makeSpellBook(actor,book),previous=this.spellBooks(actor).find(b=>b.id===next.id);
  this.assert(!previous||replace,'Book exists; explicit replace:true is required to change its daily allotment');
  if(previous)next.history=clone(previous.history);
  this.recordSpellResource(next,previous?'replace':'configure',{reason});
  if(previous)this.s.spellResources=this.s.spellResources.filter(b=>b!==previous);
  this.s.spellResources.push(next);this.note(`GM spell resources: ${this.find(actor).name}, ${next.name}: fixed daily allotment ${previous?'replaced':'established'} (${reason}).`);
  return this.describeSpellBook(next);
 }
 describeSpellBook(book){
  return {...clone(book),pools:book.pools.map(pool=>{
   const levels=Object.entries(pool.allotment.totals).map(([key,total])=>{
    const level=Number(key),prepared=book.preparations.filter(p=>p.pool===pool.id&&p.slotLevel===level),spent=book.mode==='prepared'?prepared.filter(p=>p.spent).length:(pool.spent[key]||0);
    return {level,total,spent,available:total===null?0:book.mode==='prepared'?prepared.length-spent:total-spent,
     ...(book.mode==='prepared'?{prepared:prepared.length,unprepared:total===null?0:total-prepared.length}:{})};
   });
   return {...clone(pool),levels};
  })};
 }
 spellResourceOverview(actor=null){
  if(actor!==null)this.find(actor);
  return {books:this.s.spellResources.filter(b=>actor===null||b.actor===actor).map(b=>this.describeSpellBook(b)),
   policy:'Daily allotments are fixed snapshots. Live ability scores and elapsed time never recalculate or replenish slots.'};
 }
 resourceSelection(actor,spell){
  this.find(actor);const books=this.spellBooks(actor),r=spell.resource;
  if(!books.length){this.assert(r===undefined,'Unknown spellcasting book');return null;}
  this.assert(r!==undefined,'Configured caster must select a registered spell resource');this.validateResourceSelector(r);
  const book=this.spellBook(actor,r.book);
  let prep=null,entry,pool,level;
  if(book.mode==='prepared'){
   this.assert(r.preparation!==undefined,'Prepared casting needs an exact preparation ID');
   prep=book.preparations.find(p=>p.id===r.preparation);this.assert(prep&&!prep.spent,'Prepared spell is missing or already expended');
   entry=book.spells.find(e=>e.id===(r.spell||prep.spell));pool=book.pools.find(p=>p.id===prep.pool);level=prep.slotLevel;
   this.assert(entry&&(entry.id===prep.spell||book.conversions.includes(entry.id)&&pool.allowConversion),'Spell is not this preparation or a permitted spontaneous conversion');
   this.assert((r.pool===undefined||r.pool===pool.id)&&(r.slotLevel===undefined||r.slotLevel===level),'Prepared pool/level cannot be changed while casting');
  }else{
   this.assert(r.preparation===undefined&&r.spell!==undefined,'Spontaneous casting needs a known spell ID');
   entry=book.spells.find(e=>e.id===r.spell);pool=book.pools.find(p=>p.id===(r.pool||'general'));
   this.assert(entry&&pool,'Unknown spell or spell pool');level=r.slotLevel??entry.slotLevel??entry.level;
  }
  this.assert(slotInt(level,entry.slotLevel??entry.level,9),'Chosen slot level is too low');
  this.assert(pool.allowedSpells===null||pool.allowedSpells.includes(entry.id),'Spell is not permitted in that restricted pool');
  this.assert(spell.level===entry.level&&slotIdentity(spell.spellId||spell.name)===slotIdentity(entry.spellId||entry.name),'Spell identity/level does not match its registered resource');
  this.assert((spell.sourceKind||'spell')===(entry.sourceKind||'spell'),'Spell source kind does not match its registered resource');
  this.assert(spell.casterLevel<=book.casterLevel&&(spell.ability===undefined||spell.ability===book.ability),'Caster level or ability exceeds/conflicts with its registered book');
  if(entry.sourceKind!=='spell_like')this.assert(this.stat(actor,book.ability)>=10+entry.level,'Casting ability is too low for this spell; stored daily slots are unchanged');
  const atWill=entry.atWill===true||book.cantripsAtWill&&entry.level===0&&level===0;
  if(book.mode==='spontaneous'&&!entry.atWill){
   const total=pool.allotment.totals[level];this.assert(Number.isInteger(total)&&(atWill||(pool.spent[level]||0)<total),'No spell slots remain at that level in this pool');
  }
  return {book,entry,pool,level,prep,atWill};
 }
 bindSpellResource(actor,spell){
  const choice=this.resourceSelection(actor,spell);return choice?{...clone(spell),ability:choice.book.ability}:spell;
 }
 commitSpellResource(actor,spell){
  const choice=this.resourceSelection(actor,spell);if(!choice)return null;
  const {book,entry,pool,level,prep,atWill}=choice;
  if(!atWill){if(prep)prep.spent=true;else pool.spent[level]=(pool.spent[level]||0)+1;}
  const receipt={book:book.id,spell:entry.id,pool:pool.id,slotLevel:level,preparation:prep?.id||null,atWill};
  this.recordSpellResource(book,atWill?'cast_at_will':'expend',receipt);
  this.note(`${this.find(actor).name}: ${book.name} ${atWill?'at-will spell':`level ${level} slot expended`} (${entry.name}).`);
  return receipt;
 }
 refreshSpellcasting({actor,book:bookId,reason,preparations}={}){
  this.assertSpellResourceEdit(actor);this.spellResourceReason(reason);const book=this.spellBook(actor,bookId);
  this.assert(preparations===undefined||book.mode==='prepared'&&Array.isArray(preparations)&&preparations.length<=1000,'Invalid daily preparation replacement');
  if(book.mode==='prepared'){
   if(preparations!==undefined){book.preparations=[];for(const p of preparations)this.addSpellPreparation(book,p);}
   else for(const p of book.preparations)p.spent=false;
  }else for(const pool of book.pools)pool.spent={};
  this.recordSpellResource(book,'refresh',{reason});this.note(`GM refreshes ${book.name} for ${actor}: ${reason}. Daily allotment unchanged.`);return this.describeSpellBook(book);
 }
 prepareSpell({actor,book:bookId,preparation,reason}={}){
  this.assertSpellResourceEdit(actor);this.spellResourceReason(reason);const book=this.spellBook(actor,bookId);
  const p=this.addSpellPreparation(book,preparation),entry=book.spells.find(e=>e.id===p.spell);
  if(entry.sourceKind!=='spell_like')this.assert(this.stat(actor,book.ability)>=10+entry.level,'Preparing ability is too low; daily allotment is unchanged');
  this.recordSpellResource(book,'prepare',{preparation:p.id,reason});this.note(`GM fills unprepared slot ${p.id}: ${reason}.`);return clone(p);
 }
 restoreSpellResource({actor,book:bookId,preparation,pool='general',slotLevel,amount=1,reason}={}){
  this.assertSpellResourceEdit(actor);this.spellResourceReason(reason);const book=this.spellBook(actor,bookId);
  if(book.mode==='prepared'){
   this.assert(preparation!==undefined&&slotLevel===undefined&&amount===1,'Restore one exact prepared spell');
   const p=book.preparations.find(p=>p.id===preparation);this.assert(p?.spent,'Preparation is not expended');p.spent=false;
  }else{
   this.assert(preparation===undefined&&slotInt(slotLevel,0,9)&&slotInt(amount,1,1000),'Invalid spontaneous slot restoration');
   const p=book.pools.find(p=>p.id===pool);this.assert(p&&(p.spent[slotLevel]||0)>=amount,'Cannot restore more slots than were expended');p.spent[slotLevel]-=amount;
  }
  this.recordSpellResource(book,'restore',{preparation:preparation||null,pool,slotLevel:slotLevel??null,amount,reason});this.note(`GM restores spell resource for ${actor}: ${reason}.`);return this.describeSpellBook(book);
 }
 lifecycleStatus(){return {...super.lifecycleStatus(),spellResources:this.spellResourceOverview()};}
 inspect(){return {...super.inspect(),spellResources:this.spellResourceOverview()};}
 dispatch(command,role='actor'){
  const op=command?.op,ops=['gm_get_spell_resources','gm_preview_spell_allotment','gm_set_spellcasting','gm_refresh_spellcasting','gm_prepare_spell','gm_restore_spell_resource'];
  if(!ops.includes(op))return super.dispatch(command,role);
  this.assert(role==='gm','Only GM may administer spell resources');
  if(op==='gm_get_spell_resources')return this.spellResourceOverview(command.actor??null);
  if(op==='gm_preview_spell_allotment')return calculateSpellAllotment(command.allotment);
  return this.transaction(()=>{
   if(op==='gm_set_spellcasting')return this.setSpellcasting(command);
   if(op==='gm_refresh_spellcasting')return this.refreshSpellcasting(command);
   if(op==='gm_prepare_spell')return this.prepareSpell(command);
   if(op==='gm_restore_spell_resource')return this.restoreSpellResource(command);
  });
 }
}
