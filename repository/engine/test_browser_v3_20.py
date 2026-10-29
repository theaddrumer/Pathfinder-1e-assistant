"""V3.20 headless workbench smoke test for game clock and initiative controls."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(10000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 page.locator('#initiative-results').fill('{"hero":15,"raider_1":9}')
 page.locator('#initiative-begin').click()
 assert page.evaluate('instance.s.initiative.enabled') is True,page.locator('#notice').inner_text()
 assert page.evaluate('instance.active().id')=='hero'
 page.locator('#initiative-score').fill('-17')
 page.locator('#initiative-actor').select_option('raider_1')
 page.locator('#initiative-set').click()
 assert page.evaluate("instance.initiativeRoster().entries[0].id")=='hero'
 page.locator('#initiative-event-id').fill('event_deadline')
 page.locator('#initiative-event-label').fill('Warning after round')
 page.locator('#initiative-event-score').fill('12')
 page.locator('#initiative-schedule').click()
 assert 'event_deadline' in page.locator('#initiative-details').inner_text()
 page.locator('#end-turn').click()
 assert page.evaluate('instance.s.round')==1
 page.locator('#end-turn').click()
 assert page.evaluate('instance.s.round')==2
 page.locator('#end-turn').click()
 assert page.evaluate('instance.s.worldRounds')==1
 assert page.evaluate("instance.s.initiative.alerts.some(x=>x.id==='event_deadline')")
 # A historical time Fast Forward can no longer silently desynchronize an active encounter.
 page.locator('#advance-time').click()
 assert 'error' in (page.locator('#notice').get_attribute('class') or '')
 page.locator('#initiative-end').click()
 assert page.evaluate('instance.s.initiative.enabled') is False
 page.locator('#advance-time').click()
 assert page.evaluate('instance.s.worldRounds')==2
 assert not errors,errors
 print('Browser V3.20 PASS: initiative manual roll, GM edit, initiative deadline, round clock and safe Fast Forward')
 b.close()
