"""V3.25 workbench: Pending Event touch charges, ray volleys and interruptions."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset(foe=None):
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
  if foe is not None:
   page.evaluate('''x=>{const c=JSON.parse(JSON.stringify(instance.find('hero')));Object.assign(c,{id:'foe',name:'Target',team:'enemy',x,y:4,size:1,reach:1,armor:0,natural:0});instance.s.creatures.push(c);render();}''',foe)
 def revise(values):
  spell=json.loads(page.locator('#magic-spell-json').input_value());spell.update(values);page.locator('#magic-spell-json').fill(json.dumps(spell))
 reset();page.locator('#magic-sample-touch').click();page.locator('#magic-cast').click()
 assert page.evaluate('instance.s.pendingEvents.length')==1,page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.pendingEvents[0].kind')=='held_spell'
 assert 'Pending Event' in page.locator('#magic-held-state').inner_text()
 assert page.locator('#magic-touch-deliver').is_enabled()
 page.evaluate('instance.s.testRolls=[4]');page.locator('#magic-touch-deliver').click()
 assert page.evaluate('instance.find("hero").hp')==36
 assert page.evaluate('instance.s.pendingEvents.length')==0
 assert page.evaluate('instance.s.actions.resources.standard')==0
 print('PASS browser: touch charge uses Pending Events and self-delivery is free')
 reset(1);page.locator('#magic-sample-touch').click();revise({'defensive':True,'concentrationBonus':100});page.evaluate('instance.s.testRolls=[20]');page.locator('#magic-cast').click()
 page.locator('#magic-touch-target').select_option('foe');page.evaluate('instance.s.testRolls=[1]');page.locator('#magic-touch-deliver').click()
 assert page.evaluate('!!instance.heldTouch("hero")')
 assert not page.locator('#magic-touch-deliver').is_enabled()
 page.locator('#end-turn').click();page.locator('#end-turn').click()
 assert page.locator('#magic-touch-deliver').is_enabled()
 page.evaluate('instance.s.testRolls=[10,4]');page.locator('#magic-touch-deliver').click()
 assert page.evaluate('instance.find("foe").hp')==36
 assert page.evaluate('instance.s.actions.resources.standard')==0
 assert page.evaluate('instance.s.pendingEventHistory.at(-1).outcome')=='discharged'
 print('PASS browser: missed charge persists and later touch costs one standard action')
 reset(4);page.locator('#magic-sample-ray').click();revise({'targets':['foe','foe']});page.evaluate('instance.s.testRolls=[10,3,10,4]');page.locator('#magic-cast').click()
 assert page.evaluate('instance.find("foe").hp')==33,page.locator('#notice').inner_text()
 result=json.loads(page.locator('#magic-spell-result').inner_text());assert len(result['resolution']['rays'])==2
 assert page.evaluate('instance.s.pendingEvents.length')==0
 assert page.evaluate('instance.s.actions.resources.standard')==0
 print('PASS browser: a ray volley rolls each ray and applies no weapon damage')
 reset(1);page.locator('#magic-sample-ray').click();revise({'defensive':True,'concentrationBonus':100});page.evaluate('instance.s.testRolls=[20]');page.locator('#magic-cast').click()
 assert page.evaluate('instance.s.pendingRangedAction.kind')=='spell'
 assert 'fires a ray spell' in page.locator('#interrupt-label').inner_text()
 page.evaluate('instance.s.testRolls=[10,4]');page.locator('#decline').click()
 assert page.evaluate('instance.s.interrupt') is None
 assert page.evaluate('instance.find("foe").hp')==36
 assert page.evaluate('instance.s.actions.resources.standard')==0
 print('PASS browser: defensive casting still exposes the ray-delivery opportunity')
 reset(4);page.locator('#magic-sample-ray').click();revise({'castingTime':'1_round'});page.locator('#magic-cast').click()
 page.locator('#end-turn').click();page.locator('#end-turn').click()
 page.evaluate('instance.find("foe").x=1;render()');page.locator('#magic-complete').click()
 assert page.evaluate('!!instance.s.deferredTurnStart')
 assert page.evaluate('instance.s.pendingRangedAction.kind')=='spell'
 page.evaluate('instance.s.testRolls=[10,4]');page.locator('#decline').click()
 assert page.evaluate('instance.s.deferredTurnStart') is None
 assert page.evaluate('instance.s.actions.resources.standard')==1
 assert page.evaluate('instance.find("foe").hp')==36
 print('PASS browser: long-cast ray completes before normal turn actions after its opportunity')
 reset();page.locator('#magic-sample-touch').click();page.locator('#magic-cast').click()
 page.locator('#magic-panel').screenshot(path=str(root/'spell_delivery_workbench_v3_25.png'))
 assert not errors,errors
 print('V3.25 browser: 5 scenarios passed; no page errors')
 browser.close()
