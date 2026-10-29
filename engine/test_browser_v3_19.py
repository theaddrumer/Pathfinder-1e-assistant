"""Headless Chromium V3.19 workbench controls and integration smoke test."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1550,'height':1050});page.set_default_timeout(14000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text());page.locator('#activate').click()
 # Melee attack plan import and preview in same Attack Completion panel.
 page.locator('#routines-load-melee').click();page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
 page.locator('#routines-actor').select_option('dualist_1')
 preview=page.locator('#routines-state').inner_text()
 assert 'natural_secondary' in preview and 'offhand' in preview,preview
 # Separate crossbow with loaded/spare rounds.
 page.locator('#routines-load-crossbow').click();page.locator('#spawn-x').fill('6');page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
 page.locator('#routines-actor').select_option('crossbow_1')
 assert '"reserve": 12' in page.locator('#routines-state').inner_text()
 # Turn order: hero -> dualist -> crossbow. Finish one action per active turn.
 page.evaluate("instance.dispatch({op:'end_turn'});instance.dispatch({op:'end_turn'});render()")
 assert page.evaluate('instance.active().id')=='crossbow_1'
 page.evaluate("instance.s.testRolls=[15,4];instance.dispatch({op:'attack',actor:'crossbow_1',target:'hero'});render()")
 assert page.evaluate("instance.find('crossbow_1').ammunition.bolts.loaded")==0
 page.locator('#routines-reload').click()
 assert 'error' not in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
 assert page.evaluate("instance.find('crossbow_1').ammunition.bolts.loaded")==1
 assert page.evaluate("instance.find('crossbow_1').ammunition.bolts.reserve")==11
 page.locator('#routines-set-reserve').fill('17');page.locator('#routines-set-ammo').click()
 assert page.evaluate("instance.find('crossbow_1').ammunition.bolts.reserve")==17
 assert not errors,errors
 print('Browser V3.19 PASS: TWF/natural and crossbow imports, attack plan preview, shot, reload, GM ammo correction')
 b.close()
