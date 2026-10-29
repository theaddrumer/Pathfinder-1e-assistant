/** Discovery metadata only. Native command owners remain the validators. */
import {isReadOnlyCommand} from './lifecycle.mjs';
import commandIndex from './command_index.json' with {type:'json'};
export const ACTIONS=new Set('collective_attack stand_up crawl total_defense move double_move charge attack full_attack full_attack_next finish_full_attack use_action resolve_interrupt maneuver grapple_action remove_dirty_trick replace_attack resolve_rider reload_weapon draw_ammunition end_turn delay_turn cast_spell continue_spell complete_spell cancel_spell deliver_touch_spell ready_counterspell maintain_concentration stop_concentration use_immediate'.split(' '));
const fields={
 collective_attack:['actor'],gm_set_collective:['target','profile'],
 move:['actor','path'],double_move:['actor','path'],charge:['actor','target'],attack:['actor','target'],full_attack:['actor','target'],full_attack_next:['actor','target'],finish_full_attack:['actor'],use_action:['actor','type'],resolve_interrupt:['take'],
 maneuver:['actor','target','kind'],grapple_action:['actor','kind'],remove_dirty_trick:['actor','effectId'],replace_attack:['actor','target','kind'],resolve_rider:['actor','mode'],reload_weapon:['actor','ammoId'],draw_ammunition:['actor','ammoId'],cast_spell:['actor','spell'],continue_spell:['actor'],complete_spell:['actor'],cancel_spell:['actor'],deliver_touch_spell:['actor','target'],ready_counterspell:['actor','id','spell'],maintain_concentration:['actor'],stop_concentration:['actor'],use_immediate:['actor'],
 register_creature:['definition'],spawn_creature:['definition','id','x','y'],register_effect:['definition'],apply_registered_effect:['definition','target'],apply_effect:['effect'],remove_effect:['id'],apply_condition:['target','condition'],remove_condition:['target','condition'],register_ailment:['definition'],expose_ailment:['target','definition'],cure_ailment:['id'],
 gm_resolve_damage:['target','amount','damageType'],gm_resolve_packet:['target','components'],gm_roll:[],gm_configure_map:['width','height','reason'],gm_set_map_features:['features','reason'],gm_set_door:['id','state','reason'],gm_set_elevation:['target','elevation','reason'],gm_set_geometry:['actor','target','ruling','reason'],gm_set_tiles:['cells','reason'],gm_close_scene:['keep','placements','reason'],gm_preview_scene_close:['keep'],gm_begin_initiative:[],gm_set_initiative:['id','score'],gm_advance_time:['count','unit'],gm_acknowledge_time_event:['reason'],gm_acknowledge_initiative_event:['reason'],gm_resolve_pending_event:['id','reason'],gm_resolve_casting_aoo:['actor','take'],gm_resolve_counterspell:['id','take'],gm_set_spellcasting:['actor','book','reason'],gm_resolve_spell:['actor','spell'],gm_preview_fall:['target','fall'],gm_resolve_fall:['target','fall','reason']
};
const examples={
 gm_roll:{op:'gm_roll',kind:'plain',count:1,sides:4,label:'Duration in rounds'},
 move:{op:'move',actor:'hero',path:[{x:2,y:3}]},attack:{op:'attack',actor:'hero',target:'foe'},resolve_interrupt:{op:'resolve_interrupt',take:false},
 register_creature:{op:'register_creature',definition:{id:'guard_v1',name:'Guard',creatureType:'humanoid',stats:{skills:{Perception:3},maxHp:20,str:14,dex:12,bab:3,damageDie:6,statTotals:{ac:16,touchAc:11,flatFootedAc:15,attack:5,damage:2,fort:4,ref:2,will:1},abilityLinks:{attack:['str'],damage:['str']}}}},
 spawn_creature:{op:'spawn_creature',definition:'guard_v1',id:'guard_1',x:3,y:4,team:'enemy'},
 cast_spell:{op:'cast_spell',actor:'caster',spell:{name:'Declared example',level:1,casterLevel:3,targets:['foe'],components:[{dice:{count:1,sides:6},damageType:'fire'}],save:{type:'ref',dc:14,onSuccess:'half'}}},
 gm_resolve_fall:{op:'gm_resolve_fall',target:'hero',fall:{distanceFeet:30,deliberate:true,acrobaticsTotal:18},landing:{feet:0,grounded:true,layer:'ground'},reason:'Completed descent'},
 gm_close_scene:{op:'gm_close_scene',keep:['hero'],placements:[{id:'hero',x:1,y:1}],reason:'Encounter ended; narrative archived externally'}
};
// Curated operating guidance, not a second payload validator. Examples use fictional IDs.
Object.assign(fields,{
 inspect:[],list_conditions:[],list_trait_library:[],list_maneuvers:[],end_turn:[],delay_turn:[],undo_turn:[],undo_round:[],
 save:['target','save','dc'],check:['target','kind','subject','dc'],gm_modifier:['target','stat','value'],
 gm_get_map:[],gm_get_geometry:['actor','target'],gm_establish_scene:[],gm_end_initiative:[],gm_get_lifecycle:[],gm_get_game_clock:[],gm_get_initiative:[],
 gm_get_pending_events:[],gm_get_cooldowns:[],gm_get_health:[],gm_get_spellcasting:[],gm_get_spell_resources:[],gm_get_summons:[],gm_get_persistent_areas:[],
 gm_continue_spell:[],gm_describe_attack:['actor','index'],gm_inspect_defense:['target'],gm_evaluate_effect:['target','tags'],
 gm_register_pending_event:['id','label','trigger'],gm_trigger_pending_event:['id'],gm_resolve_pending_event:['id','reason'],gm_cancel_pending_event:['id'],
 gm_schedule_time_event:['id','label','after'],gm_cancel_time_event:['id'],gm_set_game_clock:['day','hour','minute'],
 gm_set_cooldown:['target','ability','rounds'],gm_heal_hp:['target','amount'],gm_heal_nonlethal:['target','amount'],
 gm_mark_summon:['target','duration','reason'],gm_dismiss_summon:['target','reason'],gm_advance_to_event:[],
 gm_set_recovery:['target','recovery'],gm_set_continuous_damage:['target','active'],gm_stabilize:['target'],
 gm_refresh_spellcasting:['actor','book','reason']
});
Object.assign(examples,{
 inspect:{op:'inspect'},list_conditions:{op:'list_conditions'},list_trait_library:{op:'list_trait_library'},
 save:{op:'save',target:'guard_1',save:'will',dc:16},check:{op:'check',target:'guard_1',kind:'skill',subject:'Perception',dc:15},
 apply_condition:{op:'apply_condition',target:'guard_1',condition:'shaken',rounds:2},remove_condition:{op:'remove_condition',target:'guard_1',condition:'shaken'},
 register_effect:{op:'register_effect',definition:{id:'courage_v1',name:'Courage',mods:[{stat:'attack',type:'morale',value:1}],defaultRounds:3}},
 apply_registered_effect:{op:'apply_registered_effect',definition:'courage_v1',target:'guard_1'},
 gm_modifier:{op:'gm_modifier',target:'guard_1',stat:'attack',value:1,type:'morale',rounds:3,name:'Declared morale bonus'},
 gm_heal_hp:{op:'gm_heal_hp',target:'guard_1',amount:4},gm_describe_attack:{op:'gm_describe_attack',actor:'guard_1',index:0},
 gm_evaluate_effect:{op:'gm_evaluate_effect',target:'guard_1',tags:['fear','mind_affecting']},
 gm_configure_map:{op:'gm_configure_map',width:30,height:40,name:'Encounter map',reason:'Set scene dimensions'},
 gm_get_map:{op:'gm_get_map'},gm_establish_scene:{op:'gm_establish_scene'},
 gm_set_map_features:{op:'gm_set_map_features',features:[{id:'wall_1',preset:'wall',points:[{x:5,y:1},{x:5,y:6}]}],reason:'Trace a solid wall'},
 gm_get_geometry:{op:'gm_get_geometry',actor:'hero',target:'foe'},
 gm_set_elevation:{op:'gm_set_elevation',target:'guard_1',elevation:{feet:10,grounded:false,layer:'air'},reason:'GM establishes hovering height'},
 gm_begin_initiative:{op:'gm_begin_initiative',roll:true},gm_end_initiative:{op:'gm_end_initiative'},
 gm_preview_scene_close:{op:'gm_preview_scene_close',keep:['hero']},
 gm_advance_time:{op:'gm_advance_time',count:1,unit:'minute'},gm_get_game_clock:{op:'gm_get_game_clock'},gm_get_lifecycle:{op:'gm_get_lifecycle'},
 gm_get_pending_events:{op:'gm_get_pending_events'},gm_get_cooldowns:{op:'gm_get_cooldowns'},gm_get_spell_resources:{op:'gm_get_spell_resources',actor:'hero'},
 gm_register_pending_event:{op:'gm_register_pending_event',id:'foe_guard1_immunity',label:'guard_1: immunity to foe ability',actor:'guard_1',trigger:'GM checks this source-target reminder before repeat exposure',requiresInput:false,duration:{type:'time',count:24,unit:'hour'}},
 gm_set_cooldown:{op:'gm_set_cooldown',target:'guard_1',ability:'Breath weapon',rounds:3},
 gm_schedule_time_event:{op:'gm_schedule_time_event',id:'bell',label:'Bell rings',after:{count:1,unit:'minute'}},
 gm_cancel_pending_event:{op:'gm_cancel_pending_event',id:'foe_guard1_immunity',reason:'GM ends this reminder'},
 gm_continue_spell:{op:'gm_continue_spell'},gm_resolve_casting_aoo:{op:'gm_resolve_casting_aoo',actor:'foe',take:false},
 use_action:{op:'use_action',actor:'hero',type:'move',label:'GM-adjudicated action'},use_immediate:{op:'use_immediate',actor:'hero',label:'Declared immediate ability'},
 full_attack:{op:'full_attack',actor:'hero',target:'foe'},full_attack_next:{op:'full_attack_next',actor:'hero',target:'foe'},finish_full_attack:{op:'finish_full_attack',actor:'hero'},
 end_turn:{op:'end_turn'},gm_get_spellcasting:{op:'gm_get_spellcasting'},gm_get_health:{op:'gm_get_health'}
});
const help={
 register_creature:{summary:'Register a reusable, validated statblock definition.',changes:'Adds a definition, not a map token; registration survives turn undo.',limits:'Read registry for current nesting: metadata at definition root; numeric stats, attacks and ammunition inside stats; printed bonuses inside stats.statTotals. Supply all three AC totals together. Attack offsets are relative to the creature baseline. Ammo IDs reference local stores and require explicit ranged attackMode. Unknown fields reject with their path. Names/source notes do not grant mechanics.',next:'spawn_creature creates an instance; use a new definition ID for a revised template.',topic:'registry'},
 spawn_creature:{summary:'Place an independent creature instance from a registered definition.',options:{team:['party','enemy','neutral'],defaultTeam:'enemy'},changes:'Adds a token and runs configured entry effects; no summoning spell/slot is inferred.',limits:'definition is a template ID; id is a new live instance ID. Coordinates are zero-based cells. Summons additionally require duration.',next:'If initiative is active, explicitly rank the new creature with gm_set_initiative.',topic:'registry'},
 inspect:{summary:'Inspect configured creatures and subsystem state without changing it.',limits:'Large results are paged. Use path/offset/limit; exported data is not permission to mutate engine state.',next:'For a focused actor summary use kernel_status(target); for pending work use kernel_status(view:"continuations").',topic:'start'},
 list_conditions:{summary:'List condition IDs, automated modifiers/policies and remaining advisories.',limits:'partial means only the listed consequences are enforced; descriptive advice is not executable behavior.',next:'Inspect coverage before applying an unfamiliar condition.',topic:'start'},
 list_trait_library:{summary:'List recognized types/subtypes, subtype automation coverage, and effect vocabulary.',limits:'subtypeCoverage distinguishes classification_only, partial automation and tracked_marker. Recognition never implies full rules support. Use path /subtypes or /subtypeCoverage with paging.',topic:'subtypes'},
 gm_describe_attack:{summary:'Inspect one configured attack entry by zero-based index.',limits:'Weapon names are descriptive. Verify damage types, range, riders and Prone exceptions as explicit fields.',topic:'attacks'},
 save:{summary:'Roll one saving throw using the target’s configured save bonus.',options:{save:['fort','ref','will']},changes:'Rolls RNG and reports success; does not apply a condition, damage or source-specific immunity.',next:'Read the result before applying the adjudicated consequence. Native spells/ailments already own their saves; do not roll twice.',topic:'workflows'},
 check:{summary:'Roll a skill or ability check against a declared DC.',options:{kind:['skill','ability'],subject:'Configured skill name or str/dex/con/int/wis/cha'},changes:'Reports a check; does not perform the fictional action or spend its cost.',limits:'Ordinary checks do not use saving-throw natural 1/20 rules.',topic:'workflows'},
 apply_condition:{summary:'Apply a standard condition and optional duration to a live target.',changes:'Uses native condition immunity, modifiers, policies and expiry; no ability save or action cost is inferred.',limits:'Condition coverage may be partial. rounds uses target-turn timing in combat; source does not create temporary immunity to that source.',next:'Use list_conditions for coverage; use a spell/ailment payload when that subsystem should own the save and duration.',topic:'conditions'},
 remove_condition:{summary:'Remove all sources of a named condition from one target.',limits:'This is explicit GM removal; for removal of one spell’s linked effects, use the native dispel path.',topic:'conditions'},
 register_effect:{summary:'Register a reusable numeric modifier bundle.',changes:'Stores a definition only; does not apply it or infer descriptors from its name.',topic:'registry'},
 apply_registered_effect:{summary:'Apply or refresh a registered modifier on one target.',limits:'Same definition and target refresh rather than stack as duplicate instances.',topic:'registry'},
 gm_modifier:{summary:'Apply an explicit typed numeric modifier.',changes:'Creates a native effect using the common stacking rules.',limits:'Use rounds for duration. Do not add bonuses already included in imported totals; does not infer an ability’s action cost.',topic:'registry'},
 move:{summary:'Move along an explicit adjacent-cell path using the normal action budget.',options:{step:'true for a legal five-foot step',asStandard:'true to spend the standard action on movement'},changes:'Spends movement resources once and may pause before an AoO; entry effects resolve through native hooks.',limits:'A path is a list of traversed cells, not just a distant destination. Prone crawling and full 3D geometry remain adjudicated.',next:'Resolve offered continuations; do not resubmit the paid path.',topic:'workflows'},
 double_move:{summary:'Follow a path using two move-equivalent actions.',changes:'Pays both movement costs; uses the same movement/AoO continuation.',topic:'workflows'},
 attack:{summary:'Resolve one selected configured attack with normal action and targeting checks.',options:{index:'Zero-based routine index; default 0'},changes:'Spends the action and configured ammunition; resolves attacks, damage and supported riders.',limits:'Does not infer a weapon from its label. Same-team targeting currently differs from full attacks; a legal roll is not tactical approval.',next:'Resolve any returned reaction/rider choices before another action.',topic:'attacks'},
 full_attack:{summary:'Begin a full attack and resolve its first strike.',changes:'Pays full-round cost once and records remaining strikes.',limits:'Requires an opposing target. Not every strike resolves in one call.',next:'Use full_attack_next or finish_full_attack from current continuations.',topic:'workflows'},
 full_attack_next:{summary:'Resolve the next strike of an existing paid full attack.',changes:'Consumes one remaining strike; does not charge a second full-round action.',next:'Re-read continuations after every strike or interruption.',topic:'workflows'},
 finish_full_attack:{summary:'Forfeit the remaining strikes of an existing full attack.',changes:'Closes its continuation without refunding the action.',topic:'workflows'},
 resolve_interrupt:{summary:'Accept or decline the currently offered opportunity/reaction.',changes:'Resolves the current interrupt owner; may resume, stop, or offer another decision.',limits:'take is boolean. Do not guess which reactor or action is pending.',next:'Use the returned continuation choices and their owner; do not inject substitute damage.',topic:'workflows'},
 use_action:{summary:'Pay an action cost for an explicitly adjudicated effect.',options:{type:['standard','move','swift','full_round']},changes:'Spends the budget only; does not execute described prose or create its AoOs.',limits:'Do not prepay an attack or spell that already spends its own action.',topic:'start'},
 use_immediate:{summary:'Record immediate-action use against current/next swift availability.',changes:'Enforces native swift/immediate bookkeeping.',limits:'The ability’s effect and eligibility remain GM-adjudicated; no arbitrary interrupt stack is created.',topic:'health'},
 end_turn:{summary:'End the active turn and process native timing.',changes:'Advances turn order and associated conditions, recovery and events; may stop at a decision.',next:'Inspect the new active actor and any continuations.',topic:'initiative'},
 cast_spell:{summary:'Cast a GM-declared spell through normal actions, slots, saves, SR and delivery.',changes:'Configured resource and action costs are paid once at initiation; interruption can lose the spell.',limits:'The name does not supply mechanics. Unconfigured casters have untracked slots; configured casters need resource selectors.',next:'Read continuations. gm_continue_spell resumes reaction-paused casting; continue_spell is later-turn long casting.',topic:'casting'},
 gm_continue_spell:{summary:'Resume a spell paused for AoOs/counterspells after decisions finish.',changes:'Uses the already paid spell; may resolve or report lost.',limits:'Not interchangeable with continue_spell. ignoreUnhandled is an explicit override, not the normal route.',topic:'workflows'},
 continue_spell:{summary:'Pay the next required turn of an ongoing long casting.',limits:'Use only for an existing long cast when its lifecycle offers continuation; not the AoO resume command.',topic:'casting'},
 complete_spell:{summary:'Complete a ready long casting with declared final targets/area.',limits:'The cast must have reached its native ready state.',topic:'casting'},
 gm_resolve_casting_aoo:{summary:'Accept or decline one offered casting AoO.',limits:'actor is the reacting attacker, not the caster; use the offered command.',next:'Finish other offered decisions, then gm_continue_spell.',topic:'workflows'},
 gm_resolve_spell:{summary:'GM effect-only spell resolution without normal casting costs.',changes:'Resolves supported effects directly.',limits:'Explicit override only; do not substitute for cast_spell after ordinary rejection.',topic:'casting'},
 gm_get_spell_resources:{summary:'Read fixed spell capacities and current expenditure.',limits:'An empty/unconfigured book means usage is not enforced, not unlimited verified spell availability.',topic:'resources'},
 gm_set_spellcasting:{summary:'Configure a spell resource book and fixed daily allotment.',changes:'Stores capacity; replacing an existing book requires replace:true.',limits:'Do not recalculate capacity for live ability changes or re-add bonus slots included in printed totals.',topic:'resources'},
 gm_refresh_spellcasting:{summary:'Explicitly refresh expenditure against stored spell capacity.',limits:'GM must establish eligibility; elapsed time alone does not grant rest/refill.',topic:'resources'},
 gm_evaluate_effect:{summary:'Preview whether declared effect tags are blocked for a target.',changes:'Read-only classification; no saving throw or effect application.',limits:'Supply all relevant tags; the engine does not infer them from a spell/ability name.',topic:'traits'},
 gm_register_pending_event:{summary:'Record a conditional reminder, Ready, or timed event.',changes:'Tracks the declared lifetime; timed expiry is automatic.',limits:'Generic trigger/action text is advisory, not a script. An immunity reminder does not automatically reject future saves. Native timers use dedicated commands.',next:'GM checks trigger text and uses trigger/resolve where required; inspect gm_get_pending_events.',topic:'workflows'},
 gm_trigger_pending_event:{summary:'Mark a generic event triggered after GM checks its condition.',limits:'Does not execute described damage, spell or other prose. Native events restrict generic triggering.',topic:'events'},
 gm_resolve_pending_event:{summary:'Conclude an offered event decision with a reason.',limits:'Resolve its fictional/mechanical consequence separately through the appropriate owner; this command records completion.',topic:'events'},
 gm_cancel_pending_event:{summary:'Cancel an existing event by its returned ID.',changes:'Native events may also remove linked areas, dismiss summons or end concentration.',limits:'Inspect the kind before cancelling; not all timers are mere reminders.',topic:'events'},
 gm_set_cooldown:{summary:'Create an expiring named ability-unavailable reminder.',changes:'Adds one native timer with automatic expiry.',limits:'Does not hard-block arbitrary actions for that ability; the GM must respect the reminder.',topic:'health'},
 gm_advance_time:{summary:'Advance elapsed world time through native deadlines.',options:{unit:['round','minute','hour','day'],confirmPendingEvents:'true only after reviewing the returned warning',maintainConcentration:'Explicit ongoing maintenance declaration when required'},changes:'Processes configured expiry, recovery and recurring effects; can stop early at a decision.',limits:'End initiative first. A warning may advance no time; a checkpoint may advance only part. No automatic rest or spell refill.',next:'Inspect clock and remaining interval; resolve the checkpoint before advancing the remainder.',topic:'workflows'},
 gm_advance_to_event:{summary:'Advance to the next indexed native deadline.',limits:'Uses the same time guards and decision checkpoints as gm_advance_time.',topic:'events'},
 gm_set_game_clock:{summary:'Set the displayed calendar date/time.',changes:'Changes the display offset only.',limits:'Does not reverse elapsed time, restore resources, or undo expiry. Use undo only within its checkpoint scope.',topic:'workflows'},
 gm_schedule_time_event:{summary:'Schedule a world-clock event after a declared interval.',changes:'At its deadline, may pause for GM input; does not execute the label’s fictional effect.',topic:'events'},
 gm_begin_initiative:{summary:'Start initiative with explicit scores or requested rolls.',limits:'Supply all participating scores or roll:true as appropriate. Spawn alone does not rank a late arrival.',topic:'initiative'},
 gm_end_initiative:{summary:'End combat initiative while retaining the current scene.',changes:'Migrates supported timers and processes encounter-duration endings.',limits:'Does not clear the map/roster, heal, refill daily slots or serve as full scene cleanup.',topic:'workflows'},
 gm_preview_scene_close:{summary:'Preview what explicit scene closure will discard.',changes:'Read-only preview including terrain/areas/actors to remove.',limits:'Supply keep even when empty. Closing a scene discards its map.',topic:'workflows'},
 gm_close_scene:{summary:'Discard the old encounter scene and place explicit survivors.',changes:'Clears old terrain/features, non-retained actors, areas, unused definitions and old undo/history; retains supported survivor state and clock.',limits:'Requires ended initiative and resolved work. This is not a map-preserving combat reset; preview first.',topic:'workflows'},
 gm_configure_map:{summary:'Set grid dimensions and optional scene name.',changes:'Resizes the existing scene with bounds checks; invalidates spatial rulings.',limits:'width/height are cells (1–256 each). No map image is interpreted. Established scenes warn on resizing; they are not hard-locked.',topic:'map'},
 gm_establish_scene:{summary:'Mark the authored scene as established.',changes:'Future resizing includes a stability warning.',limits:'A soft warning, not a permission lock or map-library save.',topic:'map'},
 gm_set_map_features:{summary:'Add/update named cell regions or eight-direction boundary paths.',changes:'Applies configured movement, sight, effect, cover and cost properties.',limits:'These properties are independent. A stairs preset alone does not specify elevation rise; configure elevationTransition explicitly.',topic:'map'},
 gm_get_geometry:{summary:'Inspect geometry between two live creature instances.',limits:'Both actor and target are required. Visibility, line of effect, range and movement are separate questions.',topic:'map'},
 gm_set_elevation:{summary:'Set height, ground contact and occupancy layer for a creature.',changes:'Updates spatial annotations/contact handling and legal shared occupancy.',limits:'Not a full 3D distance solver. Use explicit spatial rulings for reach, threats, range or exposure when needed.',topic:'elevation'},
 gm_get_map:{summary:'Read the authoritative current grid, terrain and features.',limits:'GM-only full map state. The offline HTML workbench is a separate sandbox; the new local player listener shows a filtered live view (topic player_view). No Roll20 connection.',topic:'map'},
 gm_heal_hp:{summary:'Apply explicitly adjudicated healing through native HP/nonlethal rules.',limits:'Does not pay for a healing spell/item or establish resurrection eligibility.',topic:'health'},
 gm_get_health:{summary:'Read derived HP status, recovery and nonlethal state.',limits:'Health state does not replace other condition coverage/advisories.',topic:'health'},
 gm_get_lifecycle:{summary:'Read clocks, deadlines and unresolved work across subsystems.',next:'Use kernel_status(view:"continuations") for offered command choices.',topic:'start'},
 undo_turn:{summary:'Restore the native current/previous turn checkpoint, including RNG.',changes:'Rewinds mechanical state but not the transport revision sequence.',limits:'Not arbitrary history or a way to obtain different dice by rerolling.',topic:'start'},
 undo_round:{summary:'Restore the native round-start checkpoint, including RNG.',limits:'Bounded undo, not a campaign archive. Transport revisions keep increasing.',topic:'start'}
};
Object.assign(fields,{
 stand_up:['actor'],crawl:['actor','path'],total_defense:['actor'],gm_get_combat:[],gm_get_flanking:['actor','target'],gm_set_combat_profile:['target','profile'],gm_grant_source_immunity:['target','source','ability']
});
Object.assign(examples,{
 stand_up:{op:'stand_up',actor:'hero'},crawl:{op:'crawl',actor:'hero',path:[{x:1,y:4}]},total_defense:{op:'total_defense',actor:'hero'},
 gm_get_combat:{op:'gm_get_combat',target:'hero'},gm_get_flanking:{op:'gm_get_flanking',actor:'hero',target:'foe'},
 gm_set_combat_profile:{op:'gm_set_combat_profile',target:'hero',profile:{feats:['power_attack'],totalsExcludeCombatOptions:true}},
 gm_grant_source_immunity:{op:'gm_grant_source_immunity',target:'hero',source:'foe',ability:'despair',count:24,unit:'hour'}
});
Object.assign(help,{
 stand_up:{summary:'Stand from prone using one move action and normal AoO continuations.',changes:'Remains prone during reactions; stands only if able to finish.',next:'Resolve returned interrupts; do not repeat stand_up.',topic:'combat'},
 crawl:{summary:'Crawl one adjacent square while prone using one move action.',changes:'Checks leaving and entering threats; entry AoOs resolve from the entered square.',limits:'Retains prone. Special crawling/Acrobatics exceptions remain adjudicated.',topic:'combat'},
 total_defense:{summary:'Spend a standard action for timed dodge AC and no AoOs.',limits:'Cannot combine with fighting defensively or Combat Expertise. Supplied Acrobatics ranks can improve AC.',topic:'combat'},
 gm_get_combat:{summary:'Inspect configured feats, active modes and source-specific immunity timers.',options:{target:'Optional live creature ID; omit for all'},topic:'combat'},
 gm_get_flanking:{summary:'Preview planar flanking for an actor, target and optional attack index.',limits:'Recomputes threat and opposite-border geometry. Relevant elevation returns requiresAdjudication.',topic:'combat'},
 gm_set_combat_profile:{summary:'Configure verified combat capabilities on a live creature.',changes:'Replaces the profile; does not infer feats or recalculate imported totals.',limits:'Requires totalsExcludeCombatOptions:true. Cannot replace while combat modes are active. Verify prerequisites and excluded conditional bonuses.',topic:'combat'},
 gm_grant_source_immunity:{summary:'Grant timed immunity to one identified ability from one particular creature.',options:{count:'Default 24',unit:'Default hour'},changes:'Uses a native Pending Event; refresh never shortens a longer duration.',limits:'Enforced only for source/ability-aware save, apply_condition and gm_evaluate_effect requests. Other paths require explicit preflight. Grant after initial consequences.',topic:'combat'}
});
Object.assign(help.attack,{limits:'Same-team targets allowed. Optional combatOptions select verified modes; flanking is automatic where planar geometry permits. GM flanking rulings and precisionEligible apply to this strike.',topic:'combat'});
Object.assign(help.full_attack,{limits:'Same-team targets allowed. Optional combatOptions apply on initiation; continue the paid sequence one strike at a time.',topic:'combat'});
Object.assign(help.full_attack_next,{limits:'Do not select combatOptions again. Per-strike flanking/precision adjudication is available; geometry is recomputed.',topic:'combat'});
Object.assign(help.move,{limits:'Path contains every traversed cell. While prone use crawl or stand_up. Full 3-D geometry remains adjudicated.'});
Object.assign(help.save,{changes:'Rolls a configured save. With source and ability supplied, matching immunity skips without dice; inspect skipped before applying consequences.',topic:'combat'});
Object.assign(help.apply_condition,{limits:'Coverage may be partial. source alone does not grant immunity; source plus ability checks existing immunity. Apply initial consequences before granting a new immunity.',topic:'combat'});
Object.assign(help,{collective_attack:{summary:'Resolve the active swarm or troop automatic damage without moving.',changes:'Spends a move action; once per turn; targets all creatures in its footprint/reach, including allies.',limits:'Movement already resolves this damage. Requires a configured collective profile. No attack roll or cover/concealment miss chance.',topic:'collectives'},gm_set_collective:{summary:'Configure component size, automatic damage and optional swarm distraction.',changes:'Replaces collective profile and synchronizes component size; keeps map footprint unchanged.',limits:'Requires an existing swarm or troop subtype. Uses printed damage; no individual-member simulation.',topic:'collectives'}});
Object.assign(help.gm_evaluate_effect,{limits:'Tags check configured traits; optional source plus ability also checks native source-specific temporary immunity.',topic:'combat'});
Object.assign(fields,{
 gm_set_player_view:[],gm_set_player_display:['kind','ids','display'],gm_preview_player_view:[]
});
Object.assign(examples,{
 gm_set_player_view:{op:'gm_set_player_view',rect:{x:0,y:0,width:4,height:4},revealed:true,title:'Encounter map'},
 gm_set_player_display:{op:'gm_set_player_display',kind:'creature',ids:['hero'],display:{layer:'map',label:'Explorer',color:'#75c6bf'}},
 gm_preview_player_view:{op:'gm_preview_player_view'}
});
Object.assign(help,{
 gm_set_player_view:{summary:'Reveal/hide player map squares or set its public title.',options:{rect:'x,y,width,height in grid cells',cells:'Explicit x/y cells; use rect OR cells OR all:true',revealed:'Required boolean with a selection',title:'Optional public text, max 120 characters'},changes:'Visual mask only; no perception, targeting or action changes.',limits:'Starts fully hidden. Revealing terrain does not reveal GM-layer entries. All clients share this view. Use reason. Background images use gm_set_map_artwork; read artwork.',topic:'player_view'},
 gm_set_player_display:{summary:'Place existing creatures or map features on the GM or player map layer.',options:{kind:['creature','feature'],ids:'Existing live creature or feature IDs',display:'layer:gm/map; optional public label, hex color, feature style; showVitals:boolean explicitly shares creature HP/conditions'},changes:'Merges display settings; leaves mechanical state and invisibility conditions unchanged.',limits:'Default is GM layer. Public labels are explicit; engine names and IDs are never exposed. Token footprint must be fully revealed. showVitals defaults off; enable for player tokens only when their vitals should be shared with every viewer. Use reason.',topic:'player_view'},
 gm_preview_player_view:{summary:'Inspect exactly the filtered content sent to the player page.',changes:'Read-only; excludes GM-layer entries and hidden terrain/geometry, unshared stats, notes, logs and internal IDs. Includes HP/condition names only for visible tokens with showVitals:true.',limits:'All players see the same GM-authored view. Read the player_view reference for the separate local viewer address.',topic:'player_view'}
});
Object.assign(fields,{gm_save_map:['id','reason'],gm_load_map:['id','confirm','reason'],gm_list_maps:[],gm_delete_map:['id','reason'],gm_clear_encounter:['reason'],gm_preview_encounter_clear:[],gm_get_player_visibility:[]});
Object.assign(examples,{
 gm_save_map:{op:'gm_save_map',id:'storehouse',name:'Storehouse'},
 gm_load_map:{op:'gm_load_map',id:'storehouse',confirm:true},gm_list_maps:{op:'gm_list_maps'},
 gm_delete_map:{op:'gm_delete_map',id:'storehouse'},gm_clear_encounter:{op:'gm_clear_encounter',keep:[]},
 gm_preview_encounter_clear:{op:'gm_preview_encounter_clear',keep:[]},gm_get_player_visibility:{op:'gm_get_player_visibility'}
});
Object.assign(help,{
 gm_save_map:{summary:'Save a named map-only bookmark in the local encounter file.',options:{overwrite:'true only to deliberately replace an existing saved map'},changes:'Preserves map geometry, object base stats/current HP, doors, elevation and player reveal/layers. No actors, spells, automation rules or timers.',limits:'100 maps / 64 MiB total, 32 MiB / 100 objects per map. Saves persist across restart and combat undo. Save an original copy before destructive map edits when useful.',topic:'map_library'},
 gm_load_map:{summary:'Replace the current empty encounter map with a saved map.',changes:'Restores geometry and objects and their saved player presentation. Resets old undo/history; leaves world clock and scheduled world events unchanged.',limits:'Requires confirm:true, no non-object characters, no active initiative, casting or pending decisions. Clear encounter first. Unsaved map edits are replaced. Saved map is not consumed.',topic:'map_library'},
 gm_list_maps:{summary:'List saved map IDs, dimensions, feature/object counts and sizes.',changes:'Read-only metadata, not full map data.',topic:'map_library'},
 gm_delete_map:{summary:'Delete one saved map bookmark without changing the current map.',limits:'Does not delete encounter state or files. Not reversed by combat undo.',topic:'map_library'},
 gm_clear_encounter:{summary:'End and clear a fight while keeping the current map and objects.',options:{keep:'Optional unique creature IDs to retain; defaults to none. Map objects are retained automatically.'},changes:'Reuses scene cleanup: ends initiative, discards departed creatures, active areas, old history/undo and unused definitions; preserves geometry, doors, object HP, reveal mask and layers.',limits:'Preview first. Rejects unresolved actions/decisions/casting. No healing, rest or time advance; retained actors keep resources and ongoing effects. World-clock schedules persist. This is not gm_close_scene, which discards terrain.',topic:'map_library'},
 gm_preview_encounter_clear:{summary:'Preview map-preserving encounter cleanup, including retained objects and blockers.',changes:'Read-only keep/remove lists and preserved scheduled events.',topic:'map_library'},
 gm_get_player_visibility:{summary:'Diagnose a blank player map without revealing anything.',changes:'GM-only counts of revealed squares, visible entries and GM-layer entries.',limits:'Reveal cells and publish intended features/tokens separately; never expose all hidden entries automatically.',topic:'player_view'}
});
Object.assign(fields,{gm_set_map_artwork:[],gm_get_map_artwork:[]});
Object.assign(examples,{gm_set_map_artwork:{op:'gm_set_map_artwork',image:null},gm_get_map_artwork:{op:'gm_get_map_artwork'}});
Object.assign(help,{
 gm_set_map_artwork:{summary:'Set, align, redact or clear the private map background image.',options:{image:'Base64 PNG (16 MiB maximum; 8192 per side, 16 megapixels), null to clear; omit to retain',placement:'x,y,width,height in grid squares; rotation in degrees around image top-left',calibration:'Instead of placement: {points:[{source:{x,y},grid:{x,y}},{source:{x,y},grid:{x,y}}]}. Two image-pixel/grid-intersection pairs derive uniform scale, rotation and offset. A printed 10-ft square spans 2 calculator cells.',redactions:'Source-pixel rectangles x,y,width,height,color; replaces the list'},changes:'Presentation only; mask, features and mechanics unchanged. Artwork is included in map saves.',limits:'Prefer the local Map artwork file picker for PNG/JPEG/WebP import; never invent image bytes or paths. Revealed artwork may contain printed secrets: use a player-safe image or permanent redaction rectangles. Replacing image resets redactions unless provided.',topic:'artwork'},
 gm_get_map_artwork:{summary:'Read background dimensions, alignment and redactions without image bytes.',changes:'Read-only GM metadata; no reveal.',topic:'artwork'}
});
function referenceTopic(op){
 if(/fall/.test(op))return 'falling';
 if(/spell_resource|spellcasting|prepare_spell|spell_allotment/.test(op))return 'resources';
 if(/counterspell/.test(op))return 'counterspells';
 if(/touch/.test(op))return 'delivery';
 if(/concentration/.test(op))return 'concentration';
 if(/summon/.test(op))return 'summons';
 if(/ailment/.test(op))return 'ailments';
 if(/object|health|heal|recover|regenerat|cooldown|immediate|stabil/.test(op))return 'health';
 return 'commands';
}

function family(op){
 if(/encounter_clear|clear_encounter|player_visibility|player_view|player_display|fall|map|tile|geometry|traversal|exposure|elevation|scene|door/.test(op))return 'map';
 if(/spell|casting|concentration|counterspell|touch/.test(op))return 'magic';
 if(/time|clock|initiative|event|delay|cooldown|immediate|summon/.test(op))return 'time';
 if(/creature|register_effect|equipment|ammunition/.test(op))return 'setup';
 if(/health|heal|damage|regenerat|recover|stabil|object|negative_level|ability|condition|ailment|effect|save|check|roll|modifier/.test(op))return 'effects';
 return 'combat';
}
export const COMMANDS=Object.fromEntries(commandIndex.map(op=>[op,{
 op,family:family(op),channel:isReadOnlyCommand(op)?'query':ACTIONS.has(op)?'action':'gm',
 summary:help[op]?.summary??(op==='gm_roll'?'Roll dice only (plain), or explicitly apply damage/healing':op.replace(/^gm_|^admin_/,'').replaceAll('_',' ')),
 required:fields[op]??null,example:examples[op]??null,
 ...(op==='gm_roll'?{options:{kind:['plain','damage','healing'],count:'integer 1–100; default 1',sides:'integer 2–1000; default 6',bonus:'integer -10000–10000; default 0',label:'1–120 characters'},notes:'Default kind is plain. Plain rolls need no target and change RNG/log and normal undo bookkeeping plus mutation revision/receipt; no HP, action-resource or time expenditure. Damage/healing require target; never use them to obtain unrelated dice. Uses kernel_gm with reason, current expectedRevision and a unique requestId; identical retries do not reroll.'}:{}),
 ...(help[op]??{}),
 reference:'COMMAND_REFERENCE.md',referenceTopic:help[op]?.topic??(op==='gm_roll'?'prone_dice':referenceTopic(op)),
 guidanceCoverage:help[op]||op==='gm_roll'?'operating_notes':'reference_only',
 exampleContext:examples[op]?'Fictional IDs and setup; substitute live IDs and verify prerequisites before executing.':null,
 contract:'Native engine validates exact fields and nested payloads. required lists only top-level inputs; null means not catalogued, not zero required fields. Nested/conditional fields still need the reference guide. Examples are command objects, not complete MCP envelopes. Names and op values are case-sensitive. Use actual encounter IDs.'
}]));
export function discover({op,family:group,channel,offset=0,limit=25}={}){
 if(op){if(!Object.hasOwn(COMMANDS,op))throw Error('Unknown command; discover the current catalog');return COMMANDS[op];}
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>50)throw Error('Catalog page needs offset >= 0 and limit 1–50');
 if(group&&!['map','magic','time','setup','effects','combat'].includes(group))throw Error('Unknown command family');
 if(channel&&!['query','action','gm'].includes(channel))throw Error('Unknown command channel');
 const list=Object.values(COMMANDS).filter(x=>(!group||x.family===group)&&(!channel||x.channel===channel));
 return {total:list.length,offset,nextOffset:offset+limit<list.length?offset+limit:null,commands:list.slice(offset,offset+limit).map(({op,family,channel,summary,referenceTopic,guidanceCoverage})=>({op,family,channel,summary,referenceTopic,guidanceCoverage}))};
}
