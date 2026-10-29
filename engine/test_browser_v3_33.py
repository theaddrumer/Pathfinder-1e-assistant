"""V3.33 concentration controls share Time & Events and the spell editor."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--no-zygote'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def setup(maximum='',after='0'):
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
  page.evaluate("""() => {
   interact({op:'register_creature',definition:{id:'subject',name:'Test subject',creatureType:'humanoid',stats:{maxHp:100}}},'gm');
   interact({op:'spawn_creature',definition:'subject',id:'warden',x:4,y:4,team:'enemy'},'gm');render();
  }""")
  page.locator('#magic-sample-condition').click();page.locator('#concentration-max').fill(maximum);page.locator('#concentration-after').fill(after);page.locator('#concentration-attach').click()
  value=json.loads(page.locator('#magic-spell-json').input_value());assert 'concentration' in value;assert 'rounds' not in value['effect']
  page.evaluate('instance.s.testRolls=[1]');page.locator('#magic-cast').click()
  assert page.evaluate('instance.concentrationEvents().length')==1,page.locator('#notice').inner_text()
 setup('5','1');assert page.title().startswith('Tabletop Kernel V');assert page.locator('#concentration-maintain').is_disabled()
 event=page.evaluate('instance.concentrationEvents()[0].id');page.locator('#pending-active').select_option(event);assert page.locator('#pending-trigger-button').is_disabled()
 page.locator('#end-turn').click();page.locator('#end-turn').click();assert page.locator('#concentration-maintain').is_enabled()
 page.locator('#concentration-maintain').click();assert page.evaluate('instance.s.actions.resources.standard')==0
 page.locator('#concentration-stop').click();assert 'lingering' in page.locator('#concentration-state').inner_text()
 assert page.evaluate("instance.hasCondition('warden','shaken')")
 page.locator('#advance-time').click();assert page.evaluate('instance.concentrationEvents().length')==0
 assert not page.evaluate("instance.hasCondition('warden','shaken')")
 print('PASS browser: standard-action maintenance, native timer, voluntary stop and lingering expiry')
 setup('3');before=page.evaluate('instance.s.worldRounds');page.locator('#advance-time').click()
 assert page.evaluate('instance.s.worldRounds')==before;assert 'maintainConcentration' in page.locator('#notice').inner_text()
 page.locator('#time-maintain-concentration').check();page.locator('#advance-next-event').click()
 assert page.evaluate('instance.s.worldRounds')==before+3;assert page.evaluate('instance.concentrationEvents().length')==0
 print('PASS browser: explicit downtime maintenance and advance to maximum deadline')
 setup();page.locator('#concentration-dc').fill('999');page.evaluate('instance.s.testRolls=[1]');page.locator('#concentration-check').click()
 assert page.evaluate('instance.concentrationEvents().length')==0;assert not page.evaluate("instance.hasCondition('warden','shaken')")
 print('PASS browser: GM distraction uses shared concentration check and linked cleanup')
 setup('4','1');page.locator('#concentration-active').scroll_into_view_if_needed();page.screenshot(path=str(root/'browser_v3_33_check.png'),full_page=False)
 assert not errors,errors
 print('V3.33 browser: 3 scenarios passed; no page errors')
 browser.close()
