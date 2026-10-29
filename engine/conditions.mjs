/** PF1e Core Rulebook condition catalog. Declarative descriptions are not a claim of full automation.
 * coverage = automatic / partial / advisory / external (items, narrative or non-creature states).
 * `policies` are narrow enforceable restrictions. Anything ambiguous stays an advisory.
 */
const m=(stat,value)=>({stat,value,type:'untyped'});
const fear=[m('attack',-2),m('saves',-2),m('skill_checks',-2),m('ability_checks',-2)];
const entry=(name,coverage,mods=[],policies=[],advisories=[],description='')=>({name,coverage,mods,policies,advisories,description});
export const STANDARD_CONDITIONS=Object.freeze({
  bleed:entry('Bleed','partial',[],[],['Bleed ticks at turn start; use an ailment for its amount and type. Bleed of the same damage kind ordinarily does not stack. Healing may end bleed.']),
  blinded:entry('Blinded','partial',[m('ac_all',-2)],[],['Lose positive Dexterity and dodge AC bonuses; visual checks fail, enemies gain total concealment (50% miss chance), visual targeting and movement require adjudication.']),
  broken:entry('Broken','external',[],[],['Applies to equipment, not an ordinary creature; weapon/armor/item effects depend on the item.']),
  confused:entry('Confused','advisory',[],[],['Roll the PF1e d% confusion behavior at each turn start; resolve allegiance, retaliation, self-attack and nearest-target behavior with the GM.']),
  cowering:entry('Cowering','partial',[m('ac_all',-2)],['no_actions'],['Loses positive Dexterity and dodge bonuses to AC; also consider helplessness-related exceptions.']),
  dazed:entry('Dazed','automatic',[],['no_actions'],['A dazed creature takes no actions but has no AC penalty from dazed itself.']),
  dazzled:entry('Dazzled','partial',[m('attack',-1)],[],['-1 to sight-based Perception checks; check modality is not yet represented, so this penalty is an advisory rather than applying to every Perception roll.']),
  dead:entry('Dead','partial',[],['no_actions','no_movement'],['The complete Kernel tracks HP death and blocks ordinary healing. Restoring life requires explicit GM adjudication; corpse and equipment consequences remain with the GM.']),
  deafened:entry('Deafened','partial',[m('initiative',-4)],[],['Sound-based checks fail; opposed Perception -4; 20% verbal-component spell failure; communication is contextual.']),
  disabled:entry('Disabled','partial',[],[],['The complete Kernel derives disabled actions from HP and recovery state. Standard-action strain is automatic; other strenuous activity is GM-adjudicated.']),
  dying:entry('Dying','partial',[],['no_actions'],['The complete Kernel owns negative HP, stabilization and death thresholds. Apply HP changes through its damage/healing commands.']),
  energy_drained:entry('Energy Drained','advisory',[],[],['Negative levels modify numerous statistics, hit points and spell slots; use explicit negative-level data when supported.']),
  entangled:entry('Entangled','partial',[m('attack',-2),m('dex',-4)],['half_speed'],['Cannot run or charge; anchored versions prohibit movement; spellcasting concentration checks need a separate action resolver.']),
  exhausted:entry('Exhausted','partial',[m('str',-6),m('dex',-6)],['half_speed','no_charge'],['Cannot run; resting/exhaustion recovery is not automatic. Exhaustion supersedes fatigue.']),
  fascinated:entry('Fascinated','advisory',[],[],['Must pay attention; threats may grant new saves or break the effect. Reactive skill checks receive -4.']),
  fatigued:entry('Fatigued','partial',[m('str',-2),m('dex',-2)],['no_charge'],['Cannot run; new fatigue while fatigued generally causes exhausted.']),
  flat_footed:entry('Flat-footed','partial',[],['no_aoo'],['Use imported flat-footed AC on applicable attacks; Uncanny Dodge and other exceptions may override.']),
  frightened:entry('Frightened','partial',fear,[],['Must flee the fear source if able; decreasing distance is advisory, not automatically illegal.']),
  grappled:entry('Grappled','partial',[m('dex',-4),m('attack',-2),m('cmb',-2)],['no_movement','no_aoo'],['The -2 attack/CMB penalties exclude grapple/escape checks. Two-handed actions and spellcasting concentration require adjudication.']),
  helpless:entry('Helpless','partial',[],['no_actions'],['Complete Kernel: effective Dexterity 0, adjusted AC and melee helpless defense, with configured precision eligibility. Coup de grace and special exceptions remain GM-adjudicated.']),
  incorporeal:entry('Incorporeal','advisory',[],[],['Incorporeality is a creature quality with substantial physical/magical interaction rules, not a mere stat penalty.']),
  invisible:entry('Invisible','partial',[],[],['Attacker often receives +2 to hit and ignores defender Dexterity AC; foes have total concealment, perception is contextual; attacking can end some sources of invisibility.']),
  nauseated:entry('Nauseated','partial',[],['one_move_only'],['Only a single move action each turn; action exemptions require GM override.']),
  panicked:entry('Panicked','partial',fear,[],['Must drop held items and flee at top speed; if cornered, cowers. GM determines escape.']),
  paralyzed:entry('Paralyzed','partial',[],['no_actions','no_movement'],['Complete Kernel: effective Strength/Dexterity 0 and helpless attack defenses. Purely mental actions, passage through occupied space, flight/falling and swimming consequences require GM adjudication.']),
  petrified:entry('Petrified','advisory',[],['no_actions','no_movement'],['Creature becomes an inanimate object; hardness, damage, and restoration require object subsystem.']),
  pinned:entry('Pinned','partial',[m('dex',-4)],['no_movement','no_aoo'],['Grapple maintenance, spellcasting, escape, no Dex AC and additional restrictions remain incomplete.']),
  prone:entry('Prone','partial',[],[],['Automatic: melee/melee-touch attacks -4; defender AC -4 against melee and +4 against ranged attacks. Most ranged weapons are blocked; declare usableWhileProne:true on a rules-supported attack entry (crossbow, firearm, shuriken, or specific exception). Rays remain usable without the melee penalty.','Complete Kernel: stand_up and crawl spend move actions and offer AoOs; ordinary movement while prone rejects. Special stand/crawl abilities and Acrobatics avoidance remain GM-adjudicated.']),
  shaken:entry('Shaken','automatic',fear,[],[]),
  sickened:entry('Sickened','partial',[...fear,m('damage',-2)],[],['The damage penalty applies to weapon damage rolls; the current generic damage field is not yet separated by damage source.']),
  stable:entry('Stable','advisory',[],['no_actions'],['Stable removes ongoing dying checks, but does not necessarily restore consciousness.']),
  staggered:entry('Staggered','partial',[],['one_standard_or_move'],['Can take either a single standard or move action; not both and no full-round action. Specific exceptions and swift actions need review.']),
  stunned:entry('Stunned','partial',[m('ac_all',-2)],['no_actions','no_aoo'],['Drop held items and lose positive Dexterity/dodge to AC; item drops are not yet automatic.']),
  unconscious:entry('Unconscious','partial',[],['no_actions','no_movement'],['Complete Kernel: helpless attack defenses and effective Dexterity 0. Waking triggers and special recovery conditions require GM adjudication.'])
});
export const STANDARD_CONDITION_IDS=Object.freeze(Object.keys(STANDARD_CONDITIONS));
