"""V3.26 workbench: native Ready counterspells and casting-linked dispels."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
  page.evaluate('''()=>{const c=clone(instance.find('hero'));Object.assign(c,{id:'foe',name:'Opposing caster',team:'enemy',x:5,y:4,size:1,reach:1});instance.s.creatures.push(c);instance.find('hero').skills={Spellcraft:20};instance.dispatch({op:'gm_begin_initiative',scores:{hero:20,foe:10}},'gm');render();}''')
 def spell(value):page.locator('#magic-spell-json').fill(json.dumps(value))
 def incoming():
  spell({'name':'Synthetic blast','level':3,'casterLevel':6,'targets':['hero'],'components':[{'damageType':'force','amount':10}]})
  page.locator('#magic-cast').click()
 def ready(method='same'):
  spell({'name':'Synthetic blast','level':3,'casterLevel':5,'targets':['foe'],'components':[{'damageType':'force','amount':10}]})
  page.locator('#counter-method').select_option(method);page.locator('#counter-ready').click()
  assert page.evaluate('instance.s.pendingEvents.length')==1,page.locator('#notice').inner_text()
  assert page.evaluate('instance.s.pendingEvents[0].kind')=='ready'
  page.locator('#end-turn').click();incoming()
 reset();ready()
 assert page.locator('#counter-take').is_enabled()
 assert not page.locator('#magic-continue').is_enabled()
 assert 'Time & Events' in page.locator('#notice').inner_text()
 page.evaluate('instance.s.testRolls=[10]');page.locator('#counter-take').click()
 result=json.loads(page.locator('#magic-spell-result').inner_text());assert result['counterspell']=='countered'
 assert page.evaluate('instance.s.pendingEvents.length')==0
 assert page.evaluate('instance.sortedInitiative()[0].id')=='hero'
 page.locator('#magic-continue').click()
 assert page.evaluate('instance.find("hero").hp')==40
 assert page.evaluate('instance.s.pendingSpellCast') is None
 assert page.evaluate('instance.s.actions.resources.standard')==0
 print('PASS browser: matching counter uses Ready, initiative and casting continuation')
 reset();ready('dispel');page.evaluate('delete instance.find("hero").skills;instance.s.testRolls=[1]');page.locator('#counter-take').click();page.locator('#magic-continue').click()
 assert page.evaluate('instance.find("hero").hp')==30
 assert page.evaluate('instance.s.pendingEvents.length')==0
 print('PASS browser: failed dispel counter allows original effect with no Spellcraft roll')
 reset();ready();page.locator('#counter-decline').click()
 assert page.evaluate('instance.s.pendingEvents[0].status')=='active'
 assert page.locator('#magic-continue').is_enabled()
 page.locator('#magic-continue').click();page.locator('#end-turn').click()
 assert page.evaluate('instance.s.pendingEvents.length')==0
 assert page.evaluate('instance.s.pendingEventHistory.at(-1).outcome')=='expired'
 print('PASS browser: declined Ready expires on the normal next-turn deadline')
 reset()
 page.evaluate('''()=>{for(const [casterLevel,name,value] of [[12,'Major ward',3],[6,'Minor ward',1]])instance.dispatch({op:'gm_resolve_spell',actor:'foe',spell:{name,level:2,casterLevel,targets:['hero'],effect:{rounds:5,mods:[{stat:'attack',value,type:'luck'}]}}},'gm');render();}''')
 page.locator('#magic-sample-dispel').click();page.evaluate('instance.s.testRolls=[14]');page.locator('#magic-cast').click()
 result=json.loads(page.locator('#magic-spell-result').inner_text())['resolution']
 assert len(result['checks'])==2 and result['dispelled'][0]['spell']=='Minor ward'
 assert page.evaluate('instance.s.effects.length')==1
 assert page.evaluate('instance.s.initiativeEvents.length')==1
 assert 'Major ward' in page.locator('#magic-effect-state').inner_text()
 print('PASS browser: targeted dispel removes one spell and its timer, preserving overlap')
 reset()
 page.evaluate('''()=>{instance.dispatch({op:'gm_resolve_spell',actor:'foe',spell:{name:'Shared ward',level:2,casterLevel:5,targets:['hero','foe'],effect:{rounds:5,mods:[{stat:'attack',value:2,type:'morale'}]}}},'gm');render();}''')
 options=page.locator('#magic-dispel-effect option');assert options.count()==2
 specific=options.nth(1).get_attribute('value');page.locator('#magic-dispel-effect').select_option(specific)
 page.locator('#magic-sample-dispel').click();assert json.loads(page.locator('#magic-spell-json').input_value())['dispel']['effectId']==specific
 page.evaluate('instance.s.testRolls=[20]');page.locator('#magic-cast').click()
 assert page.evaluate('instance.s.effects.map(e=>e.target)')==['foe']
 assert page.evaluate('instance.s.initiativeEvents.length')==1
 print('PASS browser: specific effect chooser preserves another recipient of the same spell')
 # Keep screenshots internal; they are excluded from the release archive.
 page.locator('#magic-panel').screenshot(path=str(root/'spell_interactions_workbench_v3_26.png'))
 assert not errors,errors
 print('V3.26 browser: 5 scenarios passed; no page errors')
 browser.close()
