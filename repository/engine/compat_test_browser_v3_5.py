"""Headless Chromium acceptance tests for V3.7 GM workbench and test gallery."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1400,'height':950})
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content((ROOT/'index.html').read_text())
 assert 'Tabletop Kernel' in page.locator('h1').inner_text()
 assert page.locator('#scenario').input_value()=='registry'
 assert page.locator('#gm-panel').is_visible()
 assert page.locator('h2').all_inner_texts()[0].lower()=='gm workbench'
 page.locator('#activate').click()
 for button in ('#register-creature','#spawn-creature','#register-effect','#apply-effect'):
  page.locator(button).click()
  assert page.locator('#notice').get_attribute('class')=='status', (button,page.locator('#notice').inner_text())
 assert 'AC 18/11/17' in page.locator('#stats').inner_text()
 assert 'Attack +5' in page.locator('#stats').inner_text()
 assert page.locator('#gm-target').input_value()=='raider_1'
 page.locator('#gm-kind').select_option('damage')
 page.locator('#gm-roll').click()
 assert 'DAMAGE' in page.locator('#notice').inner_text()
 assert 'damage applied' in page.locator('#notice').inner_text()
 page.locator('#gm-kind').select_option('healing')
 page.locator('#gm-roll').click()
 assert 'HEALING' in page.locator('#notice').inner_text()
 page.locator('#gm-stat').select_option('ac_all')
 page.locator('#gm-modifier').click()
 assert 'AC 16/9/15' in page.locator('#stats').inner_text(),page.locator('#stats').inner_text()
 page.locator('#gm-remove').click()
 assert 'AC 18/11/17' in page.locator('#stats').inner_text()
 page.locator('#roll-skill').click()
 assert 'Check: d20' in page.locator('#notice').inner_text()
 # Move Explorer next to the Raider; attacks do not silently ignore reach.
 page.locator('#board > button').nth(4*10+2).click()
 assert 'enters (2,4)' in page.locator('#log').inner_text()
 page.locator('#gm-defense').select_option('touchAc')
 page.locator('#gm-defense-attack').click()
 assert page.locator('#notice').get_attribute('class')=='status'
 assert 'GM override' in page.locator('#log').inner_text()
 assert errors==[], errors
 # Historical fixtures have their own gallery and remain executable.
 page.close()
 page=browser.new_page(viewport={'width':1400,'height':950})
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content((ROOT/'tests.html').read_text())
 page.locator('#scenario').select_option('choker')
 page.locator('#activate').click()
 page.locator('#end-turn').click()
 assert 'Move 2' in page.locator('#clock').inner_text()
 assert not errors,errors
 print('Browser V3.7 PASS: workbench, AC variants, damage/healing, modifiers, touch attack, Choker gallery.')
 browser.close()
