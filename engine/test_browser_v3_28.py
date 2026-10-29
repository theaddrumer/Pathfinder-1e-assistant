"""V3.28: Summon setup, native timers and token removal in the offline UI."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
 def spawn():
  page.locator('#register-creature').click();page.locator('#spawn-summon').check();page.locator('#summon-count').fill('2');page.locator('#spawn-creature').click()
 reset();spawn()
 assert page.evaluate('instance.summonsOverview().length')==1,page.locator('#notice').inner_text()
 assert page.locator('#stats').inner_text().count('Summon')==1
 assert page.evaluate('instance.s.pendingEvents[0].kind')=='summon'
 assert page.locator('#pending-trigger-button').is_disabled()
 page.evaluate("instance.dispatch({op:'gm_advance_time',count:1,unit:'round'},'gm');render()")
 assert page.evaluate('instance.s.creatures.length')==2
 page.evaluate("instance.dispatch({op:'gm_advance_time',count:1,unit:'round'},'gm');render()")
 assert page.evaluate('instance.s.creatures.length')==1
 assert 'raider_1' not in page.locator('#summon-state').inner_text()
 assert page.locator('.token').count()==1
 print('PASS browser: spawn marker, native timer, expiry and token removal')
 reset();page.locator('#summon-target').select_option('hero');page.locator('#summon-mark').click()
 assert page.evaluate('instance.summonEvent("hero")!==undefined')
 page.locator('#summon-dismiss').click()
 assert page.evaluate('instance.s.creatures.length')==0
 assert 'No creatures remain' in page.locator('#notice').inner_text()
 assert page.locator('#end-turn').is_disabled()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert page.evaluate('instance.active().id')=='raider_1'
 assert not page.locator('#end-turn').is_disabled()
 print('PASS browser: mark existing creature, dismiss last token, recover by spawning')
 reset();spawn()
 page.evaluate("instance.dispatch({op:'deal_damage',target:'raider_1',amount:999,damageType:'force'},'gm');render()")
 assert page.evaluate('instance.s.creatures.length')==1
 assert page.locator('.token').count()==1
 assert 'raider_1' not in page.locator('#effect-target').inner_text()
 print('PASS browser: defeat removes token, timer and selection entries')
 reset();spawn();page.evaluate("instance.dispatch({op:'gm_begin_initiative',scores:{hero:20,raider_1:10}},'gm');render()")
 # The existing world timer is preserved when combat starts.
 for _ in range(4):page.locator('#end-turn').click()
 assert page.evaluate('instance.s.creatures.length')==1
 assert page.evaluate('instance.active().id')=='hero'
 assert page.evaluate('instance.s.initiative.entries.length')==1
 print('PASS browser: combat rounds advance the same timer and clean initiative')
 reset();spawn();page.locator('#summon-target').select_option('raider_1')
 page.locator('#registry-panel').screenshot(path=str(root/'summons_workbench_v3_28.png'))
 assert not errors,errors
 print('V3.28 browser: 4 scenarios passed; no page errors')
 browser.close()
