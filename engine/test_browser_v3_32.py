"""V3.32: spell editor, linked native conditions, immunity and dispelling."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--no-zygote'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
  page.evaluate("""() => {
   interact({op:'register_creature',definition:{id:'test_subject',name:'Test subject',creatureType:'humanoid',stats:{maxHp:100}}},'gm');
   interact({op:'spawn_creature',definition:'test_subject',id:'warden',x:4,y:4,team:'enemy'},'gm');render();
  }""")
 reset();assert 'Tabletop Kernel' in page.title()
 page.locator('#magic-sample-condition').click()
 spell=json.loads(page.locator('#magic-spell-json').input_value())
 assert spell['effect']['conditions']==['shaken']
 page.locator('#magic-condition').select_option('dazzled');page.locator('#magic-condition-rounds').fill('2')
 page.locator('#magic-condition-tags').fill('mind_affecting');page.locator('#magic-add-condition').click()
 spell=json.loads(page.locator('#magic-spell-json').input_value())
 assert spell['effect']['conditions']==['shaken','dazzled'];assert spell['effect']['rounds']==2
 assert spell['effect']['tags']==['mind_affecting']
 # Empty additional-tags input preserves descriptors already present in JSON.
 page.locator('#magic-condition-tags').fill('');page.locator('#magic-add-condition').click()
 assert json.loads(page.locator('#magic-spell-json').input_value())['effect']['tags']==['mind_affecting']
 page.evaluate('instance.s.testRolls=[1]');page.locator('#magic-gm-resolve').click()
 target=spell['targets'][0]
 assert page.evaluate('(id)=>instance.getConditions(id).length',target)==2,page.locator('#notice').inner_text()
 assert 'condition_' in page.locator('#magic-spell-result').inner_text()
 page.locator('#magic-dispel-target').select_option(target)
 page.locator('#magic-sample-dispel').click();page.locator('#magic-gm-resolve').click()
 assert page.evaluate('(id)=>instance.getConditions(id).length',target)==0
 print('PASS browser: condition editor, native effects, grouped dispelling')
 reset();page.locator('#magic-sample-condition').click();page.evaluate('instance.s.testRolls=[20]');page.locator('#magic-gm-resolve').click()
 assert page.evaluate('instance.s.conditionInstances.length')==0
 assert '"success": true' in page.locator('#magic-spell-result').inner_text()
 page.locator('#magic-clear-conditions').click();assert 'effect' not in json.loads(page.locator('#magic-spell-json').input_value())
 print('PASS browser: successful negating save and clearing the condition bundle')
 reset();page.locator('#magic-sample-condition').click()
 page.evaluate("instance.s.creatures.find(c=>c.id!=='hero').creatureType='undead'")
 page.locator('#magic-condition').select_option('unconscious');page.locator('#magic-condition-tags').fill('sleep, mind_affecting');page.locator('#magic-add-condition').click()
 page.evaluate('instance.s.testRolls=[1]');page.locator('#magic-gm-resolve').click()
 assert page.evaluate('instance.s.conditionInstances.length')==0
 assert '"blocked": true' in page.locator('#magic-spell-result').inner_text()
 page.locator('#magic-spell-json').scroll_into_view_if_needed()
 page.screenshot(path=str(root/'browser_v3_32_check.png'),full_page=False)
 print('PASS browser: descriptor immunity is visible in the spell result')
 assert not errors,errors
 print('V3.32 browser: 3 scenarios passed; no page errors')
 browser.close()
