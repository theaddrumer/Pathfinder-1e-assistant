from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1500,'height':980})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click()
 assert 'Day 1, 00:00:00' in page.locator('#clock').inner_text()
 page.locator('#clock-day').fill('8');page.locator('#clock-hour').fill('16');page.locator('#clock-minute').fill('30');page.locator('#clock-set').click()
 assert 'Day 8, 16:30:00' in page.locator('#clock').inner_text(),page.locator('#notice').inner_text()
 page.locator('#time-event-id').fill('council')
 page.locator('#time-event-label').fill('Council convenes')
 page.locator('#time-event-count').fill('2')
 page.locator('#time-schedule').click()
 assert 'council' in page.locator('#time-details').inner_text()
 page.locator('#time-count').fill('1');page.locator('#time-unit').select_option('day')
 page.locator('#advance-time').click()
 assert 'Day 8, 18:30:00' in page.locator('#clock').inner_text(),page.locator('#notice').inner_text()
 assert 'GM input required' in page.locator('#notice').inner_text(),page.locator('#notice').inner_text()
 assert page.locator('#time-acknowledge').is_enabled()
 page.locator('#time-gm-reason').fill('AI GM narrated the council meeting.')
 page.locator('#time-acknowledge').click()
 assert not page.locator('#time-acknowledge').is_enabled()
 page.locator('#time-count').fill('22');page.locator('#time-unit').select_option('hour');page.locator('#advance-time').click()
 assert 'Day 9, 16:30:00' in page.locator('#clock').inner_text(),page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.round')==1
 assert not errors,errors
 print('Browser V3.17 PASS: set campaign clock, schedule GM event, stop at event, acknowledge, resume 24-hour skip')
 browser.close()
