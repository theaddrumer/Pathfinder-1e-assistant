/**
 * Tabletop Kernel V3.5: shared statistical vocabulary.
 * Definitions are intentionally data (not a Pathfinder character builder).
 */
export const ABILITIES=Object.freeze(['str','dex','con','int','wis','cha']);
export const DEFENSES=Object.freeze(['ac','touchAc','flatFootedAc']);
export const TOTALS=Object.freeze([...DEFENSES,'initiative','fort','ref','will','attack','damage','cmb','cmd']);
export const GROUPS=Object.freeze(['saves','skill_checks','ability_checks','ac_all']);
export const MODIFIER_TYPES=Object.freeze(['untyped','morale','enhancement','dodge','circumstance','competence','luck','sacred','profane','insight','resistance','deflection','natural','armor','shield','size','racial','trait','alchemical','inherent','temporary']);
export const ABILITY_BY_SKILL=Object.freeze({
  Acrobatics:'dex',Appraise:'int',Bluff:'cha',Climb:'str',Diplomacy:'cha',Disable_Device:'dex',
  Disguise:'cha',Escape_Artist:'dex',Fly:'dex',Handle_Animal:'cha',Heal:'wis',Intimidate:'cha',
  Knowledge:'int',Linguistics:'int',Perception:'wis',Perform:'cha',Profession:'wis',
  Ride:'dex',Sense_Motive:'wis',Sleight_of_Hand:'dex',Spellcraft:'int',Stealth:'dex',
  Survival:'wis',Swim:'str',Use_Magic_Device:'cha'
});
export const SKILL_NAME=/^[a-z][a-z0-9_ ()-]{0,59}$/i;
export const modifierTarget = stat =>
  typeof stat==='string' && (
    ABILITIES.includes(stat)||TOTALS.includes(stat)||GROUPS.includes(stat)||
    (stat.startsWith('skill:') && SKILL_NAME.test(stat.slice(6)))
  );
export const skillAbility = name => ABILITY_BY_SKILL[name.replaceAll(' ','_')] ||
  (name.startsWith('Knowledge (')?'int':null);
export const printStats = c => Object.keys(c.statTotals||{});
