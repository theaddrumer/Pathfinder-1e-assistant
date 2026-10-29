/** PF1e defensive trait vocabulary. Deliberately partial: 'notes' are not active rules. */
export const CREATURE_TYPES=Object.freeze([
  'aberration','animal','construct','dragon','fey','humanoid','magical_beast',
  'monstrous_humanoid','ooze','outsider','plant','undead','vermin'
]);
const t=(immunities=[],resistances={},notes=[],extra={})=>({immunities,resistances,notes,...extra});
export const TYPE_TRAITS=Object.freeze({
 aberration:t([],{},['Darkvision 60 ft. not yet a functioning sense.']),
 animal:t([],{},['Low-light vision and animal skill rules not automated.']),
 construct:t(['mind_affecting','bleed','disease','death','necromancy','paralysis','poison','sleep','stunned','ability_damage','ability_drain','fatigued','exhausted','energy_drain','nonlethal'],{},['No Constitution; default Con-based DC modifier is +0. Fortitude-save exceptions, size-based bonus HP and healing rules require adjudication.'],{noCon:true,fortObjectExemption:true}),
 dragon:t(['sleep','paralysis'],{},['Darkvision, low-light vision, breath weapon variations not yet implemented.']),
 fey:t([],{},['Low-light vision and proficiencies not automated.']),
 humanoid:t(),
 magical_beast:t([],{},['Darkvision/low-light vision are advisory.']),
 monstrous_humanoid:t([],{},['Darkvision not yet automated.']),
 ooze:t(['poison','sleep','paralysis','polymorph','stunned','critical','precision'],{},['Mind-affecting immunity applies only if mindless. Blind/blindsight, gaze and sight-dependent effects are advisory.'],{mindlessIfNoInt:true}),
 outsider:t([],{},['Extraplanar, proficiencies and resurrection restrictions not modeled.']),
 plant:t(['mind_affecting','poison','sleep','paralysis','polymorph','stunned'],{},['Low-light vision and Fortitude/critical interactions remain advisory.']),
 undead:t(['mind_affecting','bleed','death','disease','paralysis','poison','sleep','stunned','nonlethal','ability_drain','energy_drain','fatigued','exhausted'],{},['No Constitution; Charisma substitutes for Con in HP/Fort and Con-based DCs. No automatic reconstitution of printed HP/Fort. Fort save exceptions, energy healing, destruction and ability damage handling need contextual review.'],{noCon:true,conSubstitute:'cha',physicalAbilityDamageImmune:true,fortObjectExemption:true}),
 vermin:t([],{},['Mindless vermin are immune to mind-affecting effects; use mindless flag for intelligent exceptions.'],{mindlessIfNoInt:true})
});
export const SUBTYPE_TRAITS=Object.freeze({
 swarm:t(['critical','precision','flanking'],{},['Collective rules handle shared occupancy, defenses and configured automatic damage. Component size is distinct from footprint. Wind, narrow gaps, irregular shapes and unusual riders require GM adjudication.']),
 troop:t(['flanking'],{},['Collective rules handle shared occupancy, defenses and configured automatic damage. Critical/precision defenses still depend on component creature traits. Irregular formations and narrow passages require GM adjudication.']),
 summon:t([],{},['Calculator instance marker: requires a Summon duration at spawn or gm_mark_summon. Uses Pending Events; grants no defensive traits.']),
 devil:t(['fire','poison'],{acid:10,cold:10},['Telepathy, see in darkness and summon remain advisory.'],{weaponAlignments:['lawful','evil']}),
 demon:t(['electricity','poison'],{acid:10,cold:10,fire:10},['Telepathy and summon remain advisory.'],{weaponAlignments:['chaotic','evil']}),
 incorporeal:t(['critical','precision'],{},['Thin-wall phasing is supported; thick-object, force-barrier, visibility, and incorporeal AC interactions remain limited.'],{incorporeal:true}),
 elemental:t(['bleed','critical','precision','flanking','paralysis','poison','sleep','stunned'],{},['Elemental movement and senses are advisory.']),
 fire:t(['fire'],{},['Cold vulnerability depends on subtype-specific exceptions and is not yet automatically applied.']),
 cold:t(['cold'],{},['Fire vulnerability depends on subtype-specific exceptions and is not yet automatically applied.']),
 good:t([],{},[],{weaponAlignments:['good']}),
 evil:t([],{},[],{weaponAlignments:['evil']}),
 lawful:t([],{},[],{weaponAlignments:['lawful']}),
 chaotic:t([],{},[],{weaponAlignments:['chaotic']}),
 mindless:t(['mind_affecting'])
});
// Recognition is broader than automatic rules. Keep passive classifications out
// of SUBTYPE_TRAITS so accepting a label never silently grants guessed abilities.
// Source: https://aonprd.com/MonsterSubtypes.aspx?ItemName=All
const classificationSubtypes=[
 'adlet','aeon','aether','agathion','air','android','angel','aquatic','archon',
 'astomoi','asura','augmented','azata','behemoth','blight','catfolk','changeling',
 'clockwork','colossus','daemon','dark_folk','deep_one','demodand','derro','div',
 'dwarf','earth','elf','extraplanar','giant','gnome','goblinoid','gray',
 'great_old_one','grippli','halfling','herald','hive','human','inevitable','kaiju',
 'kami','kasatha','kitsune','kyton','leshy','manasaputra','mortic','munavri',
 'mythic','native','nightshade','oni','orc','phantom','protean','psychopomp',
 'qlippoth','rakshasa','ratfolk','reptilian','robot','sahkil','samsaran',
 'sasquatch','shapechanger','skinwalker','spawn_of_rovagug','swarm','troop',
 'vanara','vishkanya','water','wayang','wild_hunt',
 // Published statblock classifications absent from the general subtype index.
 'boggard','gnoll','tengu',
 ...CREATURE_TYPES.map(type=>`augmented_${type}`)
];
export const SUBTYPE_CATALOG=Object.freeze(Object.fromEntries([
 ...classificationSubtypes.map(id=>[id,Object.freeze({automation:'classification_only',
  notes:['Identity is retained; subtype abilities are not automatically granted. Import applicable mechanics separately and preserve remaining GM adjudications.']})]),
 ...Object.entries(SUBTYPE_TRAITS).map(([id,traits])=>[id,Object.freeze({
  automation:id==='summon'?'tracked_marker':'partial',
  notes:id==='summon'?traits.notes:['Existing trait automation only; inspect creature traits and remaining notes.']
 })])
]));
export const ENERGY_TYPES=Object.freeze(['acid','cold','electricity','fire','sonic']);
export const PHYSICAL_TYPES=Object.freeze(['bludgeoning','piercing','slashing']);
// Divine/holy/unholy/aligned labels describe authored damage; none implies universal target alignment multipliers.
export const SPECIAL_DAMAGE_TYPES=Object.freeze(['force','untyped','divine','holy','unholy','good','evil','lawful','chaotic']);
export const DAMAGE_TYPES=Object.freeze([...PHYSICAL_TYPES,...ENERGY_TYPES,...SPECIAL_DAMAGE_TYPES]);
export const ALIGNMENT_TAGS=Object.freeze(['good','evil','lawful','chaotic']);
export const DR_BYPASS_TAGS=Object.freeze(['magic','silver','cold_iron','adamantine',...ALIGNMENT_TAGS,...PHYSICAL_TYPES,'epic']);
export const EFFECT_TAGS=Object.freeze([
 ...ENERGY_TYPES,...ALIGNMENT_TAGS,'holy','unholy','divine','poison','disease','mind_affecting','fear','death','necromancy','paralysis','sleep',
 'stunned','bleed','fatigued','exhausted','polymorph','critical','precision','flanking',
 'energy_drain','ability_damage','ability_drain','nonlethal','force','gaze','visual','fort_save',
 'charm','compulsion','illusion','healing','harmless'
]);
export const CONDITION_TAGS=Object.freeze({
 shaken:['mind_affecting','fear'],frightened:['mind_affecting','fear'],panicked:['mind_affecting','fear'],
 cowering:['fear'],paralyzed:['paralysis'],stunned:['stunned'],fatigued:['fatigued'],exhausted:['exhausted'],
 bleed:['bleed'],asleep:['sleep'],sleeping:['sleep']
});
