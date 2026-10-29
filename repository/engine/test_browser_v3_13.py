from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1550,'height':1000});page.set_default_timeout(10000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click();page.locator('#foundation-load-critical').click()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in page.locator('#notice').get_attribute('class'),page.locator('#notice').inner_text()
 page.locator('#foundation-target').select_option('duelist_1')
 page.locator('#foundation-inspect-attack').click()
 import json
 detail=json.loads(page.locator('#foundation-attack-detail').inner_text())
 assert detail['critical']['threat']==15,detail
 assert detail['critical']['multiplier']==2,detail
 page.evaluate('''() => {
 const d=instance.find('duelist_1'),h=instance.find('hero');
 Object.assign(d,{x:4,y:4,reach:1,hp:150,maxHp:150,
 equipment:[{id:'armor',name:'Fortified Armor',location:'worn',fortification:50}]});
 Object.assign(h,{x:3,y:4,reach:1,hp:100,maxHp:100,attacks:JSON.parse(JSON.stringify(d.attacks))});
 instance.s.tiles={};render();
 }''')
 page.locator('#combat-precision-eligible').check()
 page.locator('[data-mode="attack"]').click()
 # Nat 20, confirm 20, d% 50 fortification => crit/precision negated, weapon die 5, fire die 2
 page.evaluate('instance.s.testRolls=[20,20,50,5,2]')
 page.locator('#board .tile').nth(4*10+4).click()
 assert 'error' not in page.locator('#notice').get_attribute('class'),page.locator('#notice').inner_text()
 assert page.evaluate('instance.find("duelist_1").hp')==150-(5+page.evaluate("instance.stat('hero','damage')")+2),page.evaluate('instance.s.log.slice(-10)') # (5+4)+2
 assert any('negated by defense' in line for line in page.evaluate('instance.s.log'))
 assert any('precision negated' in line for line in page.evaluate('instance.s.log'))
 assert not errors,errors
 print('Browser V3.13 PASS: profile inspection, critical confirmation, worn fortification, precision toggle')
 browser.close()
