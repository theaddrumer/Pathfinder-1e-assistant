from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1450,'height':1000});page.set_default_timeout(9000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((base/'index.html').read_text())
 page.locator('#activate').click();page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'raider_1' in page.locator('#maneuver-target').locator('option').all_text_contents() or page.locator('#maneuver-target').input_value()=='raider_1'
 page.locator('#maneuver-position').click();assert 'error' not in page.locator('#notice').get_attribute('class'),page.locator('#notice').inner_text()
 page.locator('#maneuver-kind').select_option('grapple');page.locator('#maneuver-execute').click()
 assert page.evaluate("instance.s.pendingManeuver?.kind")=='grapple', page.locator('#notice').inner_text()
 assert not page.locator('#interrupt-box').evaluate('(x)=>x.hidden')
 page.locator('#decline').click();assert 'error' not in page.locator('#notice').get_attribute('class'),page.locator('#notice').inner_text()
 state=page.evaluate("instance.s.grapples");assert len(state)==1,state
 assert page.evaluate("instance.hasCondition('raider_1','grappled')")
 page.locator('#grapple-kind').select_option('release');page.locator('#grapple-execute').click()
 assert len(page.evaluate('instance.s.grapples'))==0
 assert not errors,errors
 print('Browser V3.10 PASS: creature import, maneuver AoO pause, grapple, release and state cleanup')
 b.close()
