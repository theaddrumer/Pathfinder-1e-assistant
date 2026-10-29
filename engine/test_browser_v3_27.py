"""V3.27 workbench: fixed daily allotments and prepared/spontaneous expenditure."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset(mode='prepared'):
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
  page.locator('#slots-sample-'+mode).click();page.locator('#slots-configure').click()
  assert page.evaluate('instance.s.spellResources.length')==1,page.locator('#notice').inner_text()
 def level():return page.evaluate('instance.spellResourceOverview("hero").books[0].pools[0].levels.find(l=>l.level===1)')
 reset();page.locator('#slots-preview').click()
 preview=json.loads(page.locator('#slots-result').inner_text())[0]
 assert preview['base']['1']==2 and preview['bonus']['1']==1 and preview['totals']['1']==3
 page.locator('#magic-cast').click();assert level()['spent']==1
 assert page.evaluate('instance.spellBook("hero","daily_caster").preparations[0].spent')
 assert page.evaluate('instance.s.actions.resources.standard')==0
 print('PASS browser: daily base-plus-bonus breakdown and exact prepared expenditure')
 stored=page.evaluate('JSON.stringify(instance.s.spellResources)')
 page.evaluate('''()=>{instance.dispatch({op:'gm_modifier',target:'hero',stat:'wis',value:12,name:'Temporary Wisdom'},'gm');render();}''')
 assert page.evaluate('JSON.stringify(instance.s.spellResources)')==stored
 page.evaluate('''()=>{instance.s.abilityDamage.hero={wis:4};instance.s.abilityDrain.hero={wis:4};render();}''')
 assert page.evaluate('JSON.stringify(instance.s.spellResources)')==stored
 page.evaluate('''()=>{for(const e of [...instance.s.effects])instance.removeEffect(e.id);instance.s.abilityDamage.hero={};instance.s.abilityDrain.hero={};render();}''')
 assert page.evaluate('JSON.stringify(instance.s.spellResources)')==stored
 print('PASS browser: ability buff, damage, drain and removal never change totals or refill a slot')
 reset('spontaneous');page.locator('#magic-cast').click();assert level()['total']==3 and level()['spent']==1
 page.locator('#slots-reason').fill('Restore one expended use for test');page.locator('#slots-restore').click();assert level()['spent']==0
 page.locator('#end-turn').click();page.locator('#magic-cast').click();assert level()['spent']==1
 page.evaluate('instance.find("hero").wis=30;render()');page.locator('#slots-reason').fill('GM confirms new daily preparation');page.locator('#slots-refresh').click()
 assert level()['total']==3 and level()['spent']==0
 print('PASS browser: spontaneous imported totals and explicit restore/refresh preserve fixed maximums')
 book=json.loads(page.locator('#slots-json').input_value());book['pools'][0]['allotment']={'type':'derived','base':{'0':3,'1':2},'abilityScore':26}
 page.locator('#slots-json').fill(json.dumps(book));page.locator('#slots-configure').click();assert level()['total']==3
 assert 'replace:true' in page.locator('#notice').inner_text()
 page.locator('#slots-replace').check();page.locator('#slots-configure').click();assert level()['total']==4
 print('PASS browser: recalculating daily totals requires explicit allotment replacement')
 reset('spontaneous')
 for i in range(3):
  if i:page.locator('#end-turn').click()
  page.locator('#magic-cast').click()
 assert level()['spent']==3
 page.locator('#end-turn').click();page.locator('#magic-cast').click()
 assert 'No spell slots' in page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.actions.resources.standard')==1
 assert level()['spent']==3
 page.evaluate('''()=>{instance.dispatch({op:'gm_advance_time',count:2,unit:'day'},'gm');render();}''')
 assert level()['spent']==3
 print('PASS browser: exhaustion blocks casting atomically and elapsed days do not refill slots')
 reset('spontaneous')
 page.evaluate('''()=>{const c=clone(instance.find('hero'));Object.assign(c,{id:'foe',name:'Enemy caster',team:'enemy',x:5,y:4});instance.s.creatures.push(c);instance.find('hero').wis=18;instance.find('hero').skills={Spellcraft:20};instance.dispatch({op:'gm_begin_initiative',scores:{hero:20,foe:10}},'gm');render();}''')
 # Use the current registered sample as a matching counter, with no damage payload.
 page.locator('#counter-method').select_option('same');page.locator('#counter-ready').click();assert level()['spent']==0
 assert page.evaluate('instance.s.pendingEvents.length')==1,page.locator('#notice').inner_text()
 page.locator('#end-turn').click();page.locator('#magic-spell-json').fill(json.dumps({'name':'Synthetic spell','level':1,'casterLevel':5,'targets':['hero'],'components':[{'damageType':'force','amount':5}]}))
 page.locator('#magic-cast').click();page.evaluate('instance.find("hero").skills={Spellcraft:20};instance.s.testRolls=[10]');page.locator('#counter-take').click()
 assert level()['spent']==1,page.locator('#notice').inner_text()
 page.locator('#magic-continue').click();assert page.evaluate('instance.find("hero").hp')==40
 print('PASS browser: Ready copies its resource selector and spends the countercaster’s slot at reaction time')
 page.locator('#magic-panel').screenshot(path=str(root/'spell_resources_workbench_v3_27.png'))
 assert not errors,errors
 print('V3.27 browser: 6 scenarios passed; no page errors')
 browser.close()
