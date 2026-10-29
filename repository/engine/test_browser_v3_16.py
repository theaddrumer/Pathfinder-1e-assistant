from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(15000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click();page.locator('#defense-load-example').click()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
 page.locator('#foundation-target').select_option('sentinel_1')
 page.locator('#defense-inspect').click()
 data=json.loads(page.locator('#defense-result').inner_text());assert data['ac']==29,data
 assert data['traits']['dr'][-1]['amount']==3,data
 page.locator('#defense-item').fill('shield');page.locator('#defense-location').select_option('carried')
 page.locator('#defense-equip').click()
 data=json.loads(page.locator('#defense-result').inner_text());assert data['ac']==26,data
 page.locator('#defense-item').fill('plate');page.locator('#defense-location').select_option('worn')
 page.locator('#defense-broken').check();page.locator('#defense-equip').click()
 data=json.loads(page.locator('#defense-result').inner_text());assert data['ac']==21,data
 page.locator('#defense-cover').select_option('cover');page.locator('#defense-concealment').select_option('20')
 # Geometry for the GM's active attacker is checked against the actual board state.
 page.evaluate('''()=>{instance.find('hero').x=3;instance.find('hero').y=4;instance.find('hero').reach=2;instance.s.testRolls=[20,2];render()}''')
 page.locator('#defense-test').click()
 data=json.loads(page.locator('#defense-result').inner_text());assert data['missedByConcealment'] is True,data
 assert not errors,errors
 print('Browser V3.16 PASS: armor/DR inspector, shield removal, broken plate, cover and miss chance')
 b.close()
