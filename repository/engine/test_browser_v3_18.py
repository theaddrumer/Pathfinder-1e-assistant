from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1540,'height':1000});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click()
 page.locator('#foundation-load-attack-completion').click()
 assert 'attack_completion_example' in page.locator('#creature-json').input_value()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
 page.locator('#foundation-target').select_option('attack_completion_1')
 page.locator('#foundation-attack-index').fill('0');page.locator('#foundation-inspect-attack').click()
 data=json.loads(page.locator('#foundation-attack-detail').inner_text())
 assert data['attack']['rangeIncrementFeet']==30 if 'attack' in data else data['rangeIncrementFeet']==30,data
 page.locator('#foundation-attack-index').fill('1');page.locator('#foundation-inspect-attack').click()
 assert 'damageSizeSteps' in page.locator('#foundation-attack-detail').inner_text() or '2d6' in page.locator('#foundation-attack-detail').inner_text()
 page.locator('#completion-amount').fill('6');page.locator('#completion-nonlethal').click()
 info=json.loads(page.locator('#completion-status').inner_text())
 assert info['state']['damage']==6,info
 page.locator('#completion-heal').click()
 info=json.loads(page.locator('#completion-status').inner_text())
 assert info['state']['damage']==0,info
 assert not errors,errors
 print('Browser V3.18 PASS: import attack examples, inspect ranged and scaled dice, apply/heal nonlethal')
 b.close()
