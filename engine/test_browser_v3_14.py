from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1550,'height':1000});page.set_default_timeout(15000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click();page.locator('#foundation-load-offensive-riders').click()
 page.locator('#ailment-register').click();page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in page.locator('#notice').get_attribute('class'),page.locator('#notice').inner_text()
 page.locator('#foundation-target').select_option('rider_beast_1');page.locator('#foundation-inspect-attack').click()
 import json
 detail=json.loads(page.locator('#foundation-attack-detail').inner_text())
 assert 'trip' in [x['id'] for x in detail['riders']],detail
 page.evaluate('''() => {const h=instance.find('hero'),b=instance.find('rider_beast_1');
  Object.assign(h,{x:3,y:4,reach:1,hp:100,maxHp:100,attacks:JSON.parse(JSON.stringify(b.attacks))});
  Object.assign(b,{x:4,y:4,reach:1,hp:150,maxHp:150});instance.s.tiles={};render();}''')
 page.evaluate('instance.s.testRolls=[18,3]')
 page.locator('[data-mode="attack"]').click();page.locator('#board .tile').nth(4*10+4).click()
 assert page.evaluate('instance.s.interrupt?.rider')=='trip',page.locator('#notice').inner_text()
 assert page.locator('#accept').inner_text()=='Attempt Trip'
 assert page.locator('#appendage').is_hidden()
 page.evaluate('instance.s.testRolls=[20]');page.locator('#accept').click()
 assert page.evaluate("instance.hasCondition('rider_beast_1','prone')"),page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.interrupt') is None
 # Directly inspect other attacks from the same imported data to verify browser bundle.
 report=page.evaluate('''() => {const g=instance,w=g.find('rider_beast_1'),h=g.find('hero');g.removeCondition({condition:'prone',target:'rider_beast_1'});
 g.s.testRolls=[18,3];const bleed=g.resolveAttack('hero','rider_beast_1','Bleed test',h.attacks[1]);
 g.s.testRolls=[18,3,1,2,1];const venom=g.resolveAttack('hero','rider_beast_1','Venom test',h.attacks[2]);
 return {bleed,venom,bleedCondition:g.hasCondition('rider_beast_1','bleed'),paralysis:g.hasCondition('rider_beast_1','paralyzed'),active:g.s.activeAilments.length};}''')
 assert report['bleedCondition'],report
 assert report['paralysis'],report
 assert report['active']>=2,report
 assert not errors,errors
 print('Browser V3.14 PASS: example import, optional Trip UI, automatic Bleed/Poison/Paralysis')
 browser.close()
