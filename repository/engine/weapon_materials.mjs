/** Core PF1e weapon-material mechanics. These properties are independent of attack kind.
 * Pricing, manufacture and weight are outside combat resolution. Equipped
 * armor and item HP/hardness are handled by defense.mjs and maneuvers.mjs.
 * Imported to-hit totals are authoritative: intrinsic masterwork bonuses are NOT added again.
 */
export const WEAPON_MATERIALS=Object.freeze({
 steel:{name:'Steel / ordinary',bypass:[],status:'standard',notes:[]},
 alchemical_silver:{name:'Alchemical silver',bypass:['silver'],damagePenaltyOn:['piercing','slashing'],damagePenalty:-1,status:'partial',notes:['-1 weapon damage, minimum 1, on silvered slashing/piercing attacks. Cannot be applied to nonmetal objects or rare metals.']},
 cold_iron:{name:'Cold iron',bypass:['cold_iron'],status:'supported',notes:['Special crafting and enchanting prices are outside combat resolution.']},
 adamantine:{name:'Adamantine',bypass:['adamantine'],ignoresHardnessBelow:20,status:'partial',notes:['Weapon DR bypass and worn-armor DR are supported. Sunder resolves registered item hardness, but adamantine hardness bypass requires GM adjudication. Masterwork attack bonus is already in printed totals.']},
 mithral:{name:'Mithral',bypass:['silver'],status:'partial',notes:['Counts as silver for DR. Registered armor adjusts category, maximum Dex, check penalty and arcane spell failure; weight remains external. Masterwork is already included in imported totals.']}
});
export const ITEM_CONDITIONS=Object.freeze({
 broken:{name:'Broken',weaponAttackPenalty:-2,weaponDamagePenalty:-2,criticalThreat:20,criticalMultiplier:2,notes:['Registered broken armor and shields reduce AC; broken armor also doubles its check penalty. Tool interactions require GM adjudication.']}
});
export function materialData(material='steel'){
 if(!Object.hasOwn(WEAPON_MATERIALS,material))throw new Error('Unknown weapon material');
 return WEAPON_MATERIALS[material];
}
export function materialWeaponTags(material='steel'){return materialData(material).bypass;}
export function silverDamagePenalty(material,damageTypes){
 const def=materialData(material);
 return (def.damagePenaltyOn||[]).some(t=>damageTypes.includes(t))?(def.damagePenalty||0):0;
}

export const MATERIAL_HARDNESS=Object.freeze({steel:10,alchemical_silver:10,cold_iron:10,mithral:15,adamantine:20});
export function materialHardness(material='steel'){return MATERIAL_HARDNESS[material]??0;}
