/** Generic material estimates. Published object statistics always override these. */
export const OBJECT_MATERIALS=Object.freeze({
 glass:{hardness:1,hpPerInch:1},paper:{hardness:0,hpPerInch:2},cloth:{hardness:0,hpPerInch:2},
 rope:{hardness:0,hpPerInch:2},ice:{hardness:0,hpPerInch:3},leather:{hardness:2,hpPerInch:5},
 wood:{hardness:5,hpPerInch:10},stone:{hardness:8,hpPerInch:15},steel:{hardness:10,hpPerInch:30},
 mithral:{hardness:15,hpPerInch:30},adamantine:{hardness:20,hpPerInch:40}
});
export const OBJECT_SIZE_AC=Object.freeze({fine:8,diminutive:4,tiny:2,small:1,medium:0,large:-1,huge:-2,gargantuan:-4,colossal:-8});
export function hardnessDamage(amount,hardness,{ignoreHardness=false,weaponMaterial=null}={}){
 const bypass=ignoreHardness||(weaponMaterial==='adamantine'&&hardness<20);
 const prevented=Math.min(amount,bypass?0:hardness);
 return {applied:amount-prevented,prevented,hardness,bypassed:bypass};
}
