from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(15000)
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click();page.locator('#foundation-load-bite').click()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in page.locator('#notice').get_attribute('class'),page.locator('#notice').inner_text()
 page.evaluate("""() => {instance.s.tiles={};Object.assign(instance.find('hero'),{x:3,y:4,size:1,reach:1,hp:80,maxHp:80});Object.assign(instance.find('test_biter_1'),{x:4,y:4,size:1,reach:1,hp:80,maxHp:80});instance.s.testRolls=[20,1,3,20,4];render();}""")
 page.locator('#end-turn').click()
 page.locator('[data-mode="attack"]').click()
 page.locator('#board .tile').nth(4*10+3).click()
 assert page.evaluate('instance.s.interrupt?.type')=='rider_choice',page.locator('#notice').inner_text()
 assert page.locator('#appendage').is_visible()
 assert page.locator('#accept').inner_text()=='Grab (normal)'
 page.locator('#accept').click()
 assert page.evaluate("instance.s.grapples?.length")==1,page.locator('#notice').inner_text()
 assert page.evaluate("instance.hasCondition('hero','grappled')")
 assert page.evaluate("instance.hasCondition('test_biter_1','grappled')")
 assert not errors,errors
 # Fresh encounter for appendage decision, must leave initiator ungrappled.
 page.locator('#reset').click();page.locator('#activate').click();page.locator('#foundation-load-bite').click()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 page.evaluate("""() => {instance.s.tiles={};Object.assign(instance.find('hero'),{x:3,y:4,size:1,reach:1});Object.assign(instance.find('test_biter_1'),{x:4,y:4,size:1,reach:1,statTotals:{cmb:50}});instance.s.testRolls=[20,1,3,20,4];render();}""")
 page.locator('#end-turn').click();page.locator('[data-mode="attack"]').click()
 page.locator('#board .tile').nth(4*10+3).click();page.locator('#appendage').click()
 assert page.evaluate("instance.s.grapples[0].appendageOnly")
 assert page.evaluate("instance.hasCondition('hero','grappled')")
 assert not page.evaluate("instance.hasCondition('test_biter_1','grappled')")
 assert not errors,errors
 # Full-attack melee replacement with a separate AoO choice.
 page.locator('#reset').click();page.locator('#activate').click();page.locator('#foundation-load-bite').click()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 page.evaluate("""() => {instance.s.tiles={};Object.assign(instance.find('hero'),{x:3,y:4,size:1,reach:1,hp:80,maxHp:80});const b=instance.find('test_biter_1');Object.assign(b,{x:4,y:4,size:1,reach:1,hp:80,maxHp:80});b.attacks.push({label:'Claw',naturalAttack:'claw',attackKind:'natural',damageDie:4});instance.s.testRolls=[20,1,3,20];render();}""")
 page.locator('#end-turn').click();page.locator('[data-mode="full_attack"]').click()
 page.locator('#board .tile').nth(4*10+3).click()
 assert page.evaluate("instance.s.interrupt?.type")=='rider_choice'
 page.locator('#decline').click()
 assert page.evaluate("instance.s.pendingFullAttack.index")==1
 page.locator('#replacement-kind').select_option('trip')
 page.locator('#replacement-execute').click()
 assert page.evaluate("instance.s.interrupt?.type")=='maneuver_aoo'
 page.locator('#decline').click()
 assert page.evaluate("instance.hasCondition('hero','prone')")
 assert page.evaluate("instance.s.pendingFullAttack")==None
 assert not errors,errors
 print('Browser V3.12 PASS: Grab/Constrict choices, appendage hold, and full-attack Trip replacement')
 browser.close()
