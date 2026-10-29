"""Acceptance tests for named Charge / double-movement modes in offline UI."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((ROOT/'index.html').read_text())
 assert page.locator('[data-mode="charge"]').is_visible()
 assert page.locator('[data-mode="move_standard"]').is_visible()
 assert page.locator('[data-mode="double_move"]').is_visible()
 page.locator('#activate').click()
 page.locator('#register-creature').click()
 page.locator('#spawn-creature').click()
 page.locator('[data-mode="charge"]').click()
 page.locator('#board button').nth(4*10+3).click()
 n=page.locator('#notice').inner_text()
 assert 'Charge completed' in n,n
 assert 'Charging (AC penalty)' in page.locator('#stats').inner_text()
 assert 'Standard 0 · Move 0' in page.locator('#clock').inner_text()
 assert 'enters (2,4)' in page.locator('#log').inner_text()
 page.locator('#end-turn').click()
 assert 'Charging (AC penalty)' in page.locator('#stats').inner_text()
 page.locator('#end-turn').click()
 assert 'Charging (AC penalty)' not in page.locator('#stats').inner_text()
 # Separate movement-mode exercise without an NPC on route.
 page.locator('#reset').click();page.locator('#activate').click()
 page.locator('[data-mode="move_standard"]').click()
 page.locator('#board button').nth(4*10+2).click()
 assert page.locator('#notice').get_attribute('class')=='status'
 assert 'Standard 0 · Move 1' in page.locator('#clock').inner_text()
 page.locator('[data-mode="move"]').click()
 page.locator('#board button').nth(4*10+3).click()
 assert 'enters (3,4)' in page.locator('#log').inner_text()
 page.locator('#reset').click();page.locator('#activate').click()
 page.locator('[data-mode="double_move"]').click()
 page.locator('#board button').nth(4*10+7).click()
 assert page.locator('#notice').get_attribute('class')=='status',page.locator('#notice').inner_text()
 assert 'enters (7,4)' in page.locator('#log').inner_text()
 assert 'Standard 0 · Move 0' in page.locator('#clock').inner_text()
 assert errors==[],errors
 print('Browser V3.7 PASS: charge attack, AC duration, standard-action move, double move.')
 browser.close()
