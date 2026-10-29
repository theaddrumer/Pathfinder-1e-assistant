"""V3.23 lifecycle control and workbench regression."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':950})
 page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click()
 page.locator('#lifecycle-inspect').click()
 data=page.locator('#lifecycle-details').inner_text()
 assert '"deadlines"' in data and '"unresolvedActions"' in data and '"unresolvedDecisions"' in data, data
 assert page.evaluate('instance.s.worldRounds')==0
 page.locator('#initiative-results').fill('{"hero":15}')
 page.locator('#initiative-begin').click()
 page.locator('#initiative-event-id').fill('watch')
 page.locator('#initiative-event-label').fill('Time to check effects')
 page.locator('#initiative-schedule').click()
 page.locator('#lifecycle-inspect').click()
 data=page.locator('#lifecycle-details').inner_text()
 assert '"watch"' in data and '"initiativeDeadlines"' in data,data
 assert not errors,errors
 print('Browser V3.23 PASS: combined lifecycle view and initiative deadline visibility')
 browser.close()
