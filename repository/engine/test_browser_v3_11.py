from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(10000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text());page.locator('#activate').click();page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 page.evaluate("""() => {instance.s.tiles={};Object.assign(instance.find('hero'),{x:3,y:3,reach:1});Object.assign(instance.find('raider_1'),{x:4,y:3,size:1,reach:1,hp:80,maxHp:80,str:12,dex:10,bab:2,sizeAttack:0,sizeCMD:0});render();}""")
 page.locator('#maneuver-target').select_option('raider_1')
 page.locator('#maneuver-kind').select_option('dirty_trick:blinded')
 page.locator('#maneuver-execute').click()
 assert page.evaluate('instance.s.interrupt?.type')=='maneuver_aoo',page.locator('#notice').inner_text()
 page.locator('#decline').click()
 assert page.evaluate("instance.hasCondition('raider_1','blinded')"),page.locator('#notice').inner_text()
 page.locator('#end-turn').click()
 assert page.locator('#dirty-trick-effect option').count()==1
 page.locator('#dirty-trick-remove').click()
 assert not page.evaluate("instance.hasCondition('raider_1','blinded')")
 assert 'error' not in page.locator('#notice').get_attribute('class')
 # Fresh encounter for overrun choice
 page.locator('#reset').click();page.locator('#activate').click();page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 page.evaluate("""() => {instance.s.tiles={};Object.assign(instance.find('hero'),{x:3,y:3,reach:1});Object.assign(instance.find('raider_1'),{x:4,y:3,size:1,reach:1,hp:80,maxHp:80,str:12,dex:10,bab:2,sizeAttack:0,sizeCMD:0});render();}""")
 page.locator('#maneuver-target').select_option('raider_1')
 page.locator('#maneuver-kind').select_option('overrun')
 page.locator('#maneuver-execute').click()
 assert page.evaluate('instance.s.interrupt?.type')=='maneuver_aoo'
 page.locator('#decline').click()
 assert page.locator('#accept').inner_text()=='Avoid Overrun',page.locator('#notice').inner_text()
 page.locator('#accept').click()
 assert page.evaluate("instance.find('hero').x")==5
 # Fresh encounter for GM Free Mode on tile click
 page.locator('#reset').click();page.locator('#activate').click();page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 page.evaluate("""() => {instance.s.tiles={};Object.assign(instance.find('hero'),{x:3,y:3,reach:1});Object.assign(instance.find('raider_1'),{x:4,y:3,size:1,reach:1,hp:80,maxHp:80,str:12,dex:10,bab:2,sizeAttack:0,sizeCMD:0});render();}""")
 page.locator('#gm-target').select_option('hero')
 page.locator('#gm-override-kind').select_option('move_free')
 page.locator('#gm-override-execute').click()
 page.locator('#board .tile').nth(3*10+2).click()
 assert page.evaluate('instance.s.interrupt?.type')=='aoo',page.locator('#notice').inner_text()
 page.locator('#decline').click()
 assert page.evaluate("instance.find('hero').x")==2
 assert page.evaluate('instance.s.actions.resources.standard')==1
 assert len(page.evaluate('instance.s.overrideLog'))==1
 assert not errors, errors
 print('Browser V3.11 PASS: Dirty Trick/removal, Overrun avoid, and audited free movement with AoO')
 browser.close()
