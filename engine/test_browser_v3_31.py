"""V3.31 UI integration: health, recovery, immediate actions, cooldowns, objects."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--no-zygote'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
 reset();assert 'Tabletop Kernel' in page.title()
 page.locator('#recovery-controls summary').click();page.locator('#health-fast').fill('2');page.locator('#health-configure').click()
 assert page.evaluate("instance.find('hero').recovery.fastHealing")==2,page.locator('#notice').inner_text()
 page.evaluate("instance.dispatch({op:'gm_resolve_damage',target:'hero',amount:43,damageType:'untyped'},'gm');render()")
 assert 'dying' in page.locator('#health-state').inner_text();assert '-3/40 HP' in page.locator('#stats').inner_text()
 assert page.locator('.token.downed').count()==1
 page.locator('#health-stabilize').click();assert page.evaluate("instance.healthState('hero').status")=='stable'
 page.locator('#end-turn').click();assert page.evaluate("instance.find('hero').hp")==-1
 print('PASS browser: negative HP, visible status, stabilization, configured recovery')
 reset();page.locator('#basic-label').fill('Feather fall');page.locator('#basic-immediate').click()
 assert page.evaluate('instance.s.actions.resources.swift')==0
 page.locator('#basic-label').fill('Breath weapon');page.locator('#basic-rounds').fill('2');page.locator('#basic-cooldown').click()
 assert 'Breath weapon unavailable!' in page.locator('#basic-state').inner_text()
 event=page.evaluate('instance.cooldownsOverview()[0].eventId');page.locator('#pending-active').select_option(event)
 assert page.locator('#pending-trigger-button').is_disabled()
 page.locator('#end-turn').click();assert page.evaluate('instance.cooldownsOverview().length')==1
 page.locator('#end-turn').click();assert page.evaluate('instance.cooldownsOverview().length')==0
 assert 'Breath weapon ready' in page.locator('#log').inner_text()
 print('PASS browser: immediate action, shared cooldown display and automatic readiness')
 reset();page.locator('#object-controls summary').click();page.locator('#object-thickness').fill('2');page.locator('#object-preview').click()
 assert '30' in page.locator('#object-preview-state').inner_text()
 page.locator('#object-spawn').click();assert page.evaluate("instance.find('stone_panel').maxHp")==30,page.locator('#notice').inner_text()
 assert page.locator('.token.object').count()==1
 page.evaluate("instance.dispatch({op:'gm_resolve_damage',target:'stone_panel',amount:23,damageType:'slashing'},'gm');render()")
 assert page.evaluate("instance.healthState('stone_panel').status")=='broken'
 page.locator('#object-repair').click();assert page.evaluate("instance.find('stone_panel').hp")==20
 page.screenshot(path=str(root/'browser_v3_31_check.png'),full_page=False)
 print('PASS browser: material estimate, object creation, map token and repair')
 reset();page.locator('#gm-override-kind').select_option('health');page.locator('#gm-health-hp').fill('-2');page.locator('#gm-override-execute').click()
 assert page.evaluate("instance.find('hero').hp")==-2,page.locator('#notice').inner_text()
 print('PASS browser: reasoned Free Mode health adjustment')
 assert not errors,errors
 print('V3.31 browser: 4 scenarios passed; no page errors')
 browser.close()
