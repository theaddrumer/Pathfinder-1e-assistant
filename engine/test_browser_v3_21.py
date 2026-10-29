"""V3.21 browser coverage: Pending Events registration, readiness, timer, warning and GM resolution."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1550,'height':1000});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click()
 page.locator('#initiative-results').fill('{"hero":15}')
 page.locator('#initiative-begin').click()
 assert page.evaluate('instance.s.initiative.enabled') is True,page.locator('#notice').inner_text()
 page.locator('#pending-kind').select_option('ready')
 page.locator('#pending-id').fill('ready_door')
 page.locator('#pending-register').click()
 assert page.evaluate('instance.s.pendingEvents[0].kind')=='ready',page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.actions.resources.standard')==0
 assert 'ready_door' in page.locator('#pending-details').inner_text()
 page.locator('#end-turn').click()
 assert page.evaluate('instance.s.pendingEvents.length')==0,'Ready did not expire at next creature turn'
 page.locator('#initiative-end').click()
 page.locator('#pending-kind').select_option('conditional')
 page.locator('#pending-duration').select_option('time')
 page.locator('#pending-count').fill('2')
 page.locator('#pending-expiry').select_option('trigger')
 page.locator('#pending-id').fill('alarm')
 page.locator('#pending-label').fill('Crystal alarm')
 page.locator('#pending-register').click()
 assert page.evaluate('instance.s.pendingEvents.length')==1,page.locator('#notice').inner_text()
 page.locator('#time-count').fill('6')
 page.locator('#advance-time').click()
 assert page.evaluate('lastTimeOutcome.status')=='pending_events_warning'
 assert page.evaluate('instance.s.worldRounds')==1
 page.locator('#advance-time').click()
 assert page.evaluate('instance.s.worldRounds')==3, page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.pendingEventDecisions[0].id')=='alarm'
 assert page.evaluate('lastTimeOutcome.warning.count')==1
 page.locator('#pending-resolution').fill('GM describes the alarm')
 page.locator('#pending-resolve').click()
 assert page.evaluate('instance.s.pendingEventDecisions.length')==0
 assert page.evaluate('instance.s.pendingEvents.length')==0
 page.locator('#time-count').fill('4')
 page.locator('#advance-time').click()
 assert page.evaluate('instance.s.worldRounds')==7
 assert not errors,errors
 print('Browser V3.21 PASS: Ready action, expiration, timer checkpoint, warning, GM resolution and resume')
 b.close()
