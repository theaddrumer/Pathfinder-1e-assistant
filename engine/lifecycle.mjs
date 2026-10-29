/** V3.23 — shared, pure lifecycle/index helpers.
 * Existing PF1e-specific resolvers retain ownership of their actual effects.
 * These helpers only answer when and whether existing records need attention.
 * No GM judgment or arbitrary code execution lives in this module.
 */
const validTime=t=>Number.isSafeInteger(t);

// Exact command names, not a prefix rule: unknown commands still reach normal
// authorization/validation. These views remain available during checkpoints.
const READ_ONLY_COMMANDS=new Set(['gm_list_maps','gm_preview_encounter_clear','gm_get_map_artwork','gm_get_player_visibility','gm_preview_player_view','gm_get_combat','gm_get_flanking','inspect','list_conditions','list_trait_library','list_maneuvers',
 'gm_get_lifecycle','gm_get_game_clock','gm_get_initiative','gm_get_pending_events',
 'gm_preview_fall','gm_get_geometry','gm_get_map','gm_preview_scene_close','gm_get_health','gm_get_cooldowns','gm_preview_object','gm_get_spellcasting','gm_get_persistent_areas','gm_get_spell_resources','gm_get_summons','gm_preview_spell_allotment',
 'gm_preview_spell_area','gm_inspect_defense','gm_evaluate_effect','gm_calculate_dc','gm_describe_attack']);
export const isReadOnlyCommand=op=>READ_ONLY_COMMANDS.has(op);

/** Enumerate all clock-indexed deadlines without advancing state or choosing actions.
 * Every source retains its native representation; owners perform actual resolution.
 */
export function clockDeadlines(s){
 const now=s.worldRounds||0,out=[];
 const push=(kind,id,at)=>{if(validTime(at))out.push({kind,id,at});};
 for(const a of s.activeAilments||[])if(a.nextAt!==null&&a.nextAt!==undefined)push('ailment',a.id,a.nextAt);
 for(const n of s.negativeLevels||[])if(!n.permanent&&n.dueAt!==null&&n.dueAt!==undefined)push('negative_level',n.id,n.dueAt);
 for(const [target,pools] of Object.entries(s.energyTempHp||{}))for(const p of pools)if(p.amount>0)push('temporary_hp',target,p.expiresAt);
 for(const e of s.effects||[])if(e.remaining!==null&&e.remaining!==undefined)push('modifier',e.id,now+Math.max(0,e.remaining));
 for(const e of s.scheduledTimeEvents||[])push('gm_event',e.id,e.at);
 for(const e of s.pendingEvents||[])if(e.status==='active'&&e.duration?.type==='time')push('pending_event',e.id,e.duration.at);
 // Area expiration belongs to Pending Events; only recurring exposures add a deadline.
 if(!s.initiative?.enabled)for(const e of s.pendingEvents||[])if(e.kind==='persistent_area'&&e.status==='active'&&e.payload.triggers.includes('turn_start')&&e.payload.present.length)push('area_exposure',e.id,Math.max(now,e.payload.nextAt));
 if(!s.initiative?.enabled)for(const c of s.activeSpellCasts||[])if(c.status==='casting')push('spell_cast',c.id,c.deadlineAt);
 if(!s.initiative?.enabled)for(const c of s.creatures||[])if(c.vitality?.nextAt!=null)push('health',c.id,c.vitality.nextAt);
 if(!s.initiative?.enabled)for(const e of s.pendingEvents||[])if(e.kind==='immediate'&&e.duration.type==='turn_end')push('immediate',e.id,e.createdAt.worldRounds+1);
 return out.sort((a,b)=>a.at-b.at||a.kind.localeCompare(b.kind)||String(a.id).localeCompare(String(b.id)));
}

/** Descending initiative interval; upper is exclusive except on new-round entry. */
export function crossedInitiative(score,upper,lower,includeUpper=false){
 return (includeUpper?score<=upper:score<upper)&&score>=lower;
}

/** Which action continuations are currently suspended? Mirrors the live state
 * rather than creating an independent queue that might desynchronize. */
export function unresolvedActions(s){
 const keys=['interrupt','pendingMove','pendingCharge','pendingFullAttack','pendingRider',
  'pendingRiderQueue','pendingReplacement','pendingRangedAction','pendingManeuver',
  'pendingSpellCast','pendingReadyAction','pendingOverrun'];
 return keys.filter(key=>Array.isArray(s[key])?s[key].length>0:!!s[key])
  .concat((s.activeSpellCasts||[]).filter(c=>c.status==='ready').map(c=>'casting_completion:'+c.id));
}

/** Decision checkpoints are distinct from automatic deadlines. */
export function unresolvedDecisions(s){
 const decisions=[];
 if(s.pendingTimeEvent)decisions.push('scheduled_time_event');
 if(s.pendingInitiativeEvent)decisions.push('initiative_event');
 if(s.pendingEventDecisions?.length)decisions.push('pending_event');
 if(s.deferredTurnStart)decisions.push('deferred_turn_start');
 if((s.activeSpellCasts||[]).some(c=>c.status==='ready'))decisions.push('casting_completion');
 return decisions;
}

/** Expiring one source must not leave behind a later phantom expiry for it.
 * Called by the effect's owner when it is actually removed. */
export function unlinkEffectDeadlines(s,effectId){
 const before=(s.initiativeEvents||[]).length;
 if(before)s.initiativeEvents=s.initiativeEvents.filter(e=>e.expireEffectId!==effectId);
 return before-(s.initiativeEvents||[]).length;
}
