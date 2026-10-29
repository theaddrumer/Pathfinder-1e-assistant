from pathlib import Path
root=Path(__file__).parent
p=root/'automation-demo-template.html';s=p.read_text()
new='''<div class="card" id="foundation-panel" hidden>
<h2>V3.7 — Inherited traits and ability DCs</h2>
<p class="subtle">Use “Load example Devil” to replace the editable creature JSON, then register and spawn it normally. Creature types and subtypes supply defenses; published numeric totals are not re-added.</p>
<div class="controls"><button id="foundation-load-devil">Load fictional Devil definition</button><label>Target <select id="foundation-target"></select></label></div>
<div class="controls"><label>Damage <input id="foundation-amount" type="number" min="0" value="20" /></label>
<label>Type <select id="foundation-type"><option>fire</option><option>acid</option><option>cold</option><option>slashing</option><option>force</option></select></label>
<label>Cause <select id="foundation-cause"><option value="environment">Environmental / unspecified</option><option value="weapon">Weapon</option><option value="spell">Spell</option></select></label>
<label><input type="checkbox" id="foundation-magical" /> Magical</label><label><input type="checkbox" id="foundation-ghost" /> Ghost touch</label>
<button id="foundation-damage">GM: apply classified damage</button></div>
<div class="controls"><label>Effect tag <select id="foundation-tag"><option>poison</option><option>mind_affecting</option><option>fire</option><option>paralysis</option><option>death</option></select></label>
<button id="foundation-evaluate">Evaluate inherited immunity</button><label>DC ID <input id="foundation-dc" class="wide" value="infernal_presence" /></label>
<button id="foundation-calculate">Calculate ability DC</button></div>
<pre id="foundation-result">Choose a command to inspect the adjudication result.</pre>
<p class="subtle">Current trait coverage is deliberately selective. Unsupported subtype and complex exceptional rules are not silently executed.</p>
</div>
'''
s=s.replace('<div class="card" id="condition-ailment-panel"',new+'<div class="card" id="condition-ailment-panel"',1)
s=s.replace('V3.6 remains an experimental calculator', 'V3.7 remains an experimental calculator')
p.write_text(s)
p=root/'automation-demo-ui.js';s=p.read_text()
s=s.replace("  $('condition-ailment-panel').hidden=fixture!=='registry';", "  $('condition-ailment-panel').hidden=fixture!=='registry';\n  $('foundation-panel').hidden=fixture!=='registry';")
s=s.replace('const exampleCreature={\n  id:',"const exampleCreature={\n  creatureType:'humanoid',subtypes:[],\n  id:")
# inject render target population, right near GM selector manipulation
needle="    const effectSelect=$('gm-active-effect'),oldEffect=effectSelect.value;"
addition="""    const foundationTarget=$('foundation-target'),oldFoundationTarget=foundationTarget.value;
    foundationTarget.innerHTML='';
    for(const c of s.creatures){const option=E('option','',c.name);option.value=c.id;foundationTarget.append(option);}
    if(s.creatures.some(c=>c.id===oldFoundationTarget))foundationTarget.value=oldFoundationTarget;
    else if(s.creatures.some(c=>c.id===$('spawn-id').value))foundationTarget.value=$('spawn-id').value;
"""
s=s.replace(needle,addition+needle)
marker="$('register-creature').onclick=()=>runImport"
handlers="""const exampleDevil={
  id:'fictional-devil-v1',name:'Infernal Test Subject',creatureType:'outsider',subtypes:['devil'],
  source:'Fictional test for trait inheritance (not an official monster statblock)',
  stats:{maxHp:48,hp:48,hitDiceCount:8,size:1,reach:1,speed:30,str:16,dex:12,con:14,int:12,wis:12,cha:20,bab:8,
    statTotals:{ac:20,touchAc:11,flatFootedAc:19,initiative:1,attack:11,fort:8,ref:7,will:7},
    abilityLinks:{attack:['str'],fort:['con'],ref:['dex'],will:['wis'],ac:['dex'],touchAc:['dex'],initiative:['dex']},
    skills:{Perception:11}},
  dcDefinitions:{infernal_presence:{basis:'half_hd',ability:'cha',published:19}}
};
$('foundation-load-devil').onclick=()=>{
  $('creature-json').value=JSON.stringify(exampleDevil,null,2);
  $('spawn-id').value='devil_1';$('spawn-x').value='4';$('spawn-y').value='4';
  $('notice').textContent='Fictional Devil loaded. Click Register creature, then Spawn instance from definition.';
};
const foundationRun=fn=>runImport(()=>{
  const result=fn();$('foundation-result').textContent=JSON.stringify(result,null,2);return result;
});
$('foundation-damage').onclick=()=>foundationRun(()=>interact({op:'gm_resolve_damage',target:$('foundation-target').value,
 amount:Number($('foundation-amount').value),damageType:$('foundation-type').value,cause:$('foundation-cause').value,
 metadata:{magical:$('foundation-magical').checked,ghostTouch:$('foundation-ghost').checked,
  ...( $('foundation-cause').value==='spell'?{sourceKind:'spell'}:{} )}},'gm'));
$('foundation-evaluate').onclick=()=>foundationRun(()=>interact({op:'gm_evaluate_effect',target:$('foundation-target').value,
 tags:[$('foundation-tag').value]},'gm'));
$('foundation-calculate').onclick=()=>foundationRun(()=>interact({op:'gm_calculate_dc',actor:$('foundation-target').value,
 abilityId:$('foundation-dc').value},'gm'));
"""
s=s.replace(marker,handlers+marker,1)
p.write_text(s)
