from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click();page.locator('#foundation-load-final-riders').click()
 page.locator('#register-creature').click();page.locator('#spawn-creature').click()
 assert 'error' not in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
 page.locator('#foundation-target').select_option('abductor_1')
 page.locator('#foundation-inspect-attack').click()
 info=json.loads(page.locator('#foundation-attack-detail').inner_text())
 assert info['riders'][0]['id']=='pull',info
 page.evaluate('''()=>{const g=instance;const a=g.find('hero'),b=g.find('abductor_1');
  Object.assign(a,{x:4,y:4,reach:3,hp:100,maxHp:100,hitDiceCount:8,attacks:JSON.parse(JSON.stringify(b.attacks))});
  Object.assign(b,{x:6,y:4,reach:1,creatureType:'humanoid',size:1,maxHp:100,hp:100,hitDiceCount:10});
  g.s.tiles={};render();}''')
 page.evaluate('instance.s.testRolls=[18,3]')
 page.locator('[data-mode="attack"]').click();page.locator('#board .tile').nth(4*10+6).click()
 assert page.evaluate('instance.s.interrupt?.rider')=='pull',page.locator('#notice').inner_text()
 assert page.locator('#accept').inner_text()=='Attempt PULL',page.locator('#accept').inner_text()
 page.evaluate('instance.s.testRolls=[20]');page.locator('#accept').click()
 assert page.evaluate("instance.find('abductor_1').x")==5,page.evaluate("instance.find('abductor_1').x")
 assert not page.evaluate('instance.s.interrupt')
 result=page.evaluate('''()=>{const g=instance,a=g.find('hero'),b=g.find('abductor_1');
  b.x=6;b.hp=100;b.maxHp=100;
  g.s.testRolls=[18,3];const push=g.resolveAttack('hero','abductor_1','Push',a.attacks[1]);
  g.s.testRolls=[20];const move=g.resolveRider('push');
  b.x=6;b.hp=100;b.maxHp=100;
  g.s.testRolls=[18,3];const drain=g.resolveAttack('hero','abductor_1','Drain',a.attacks[2]);
  return {push,move,drain,total:g.negativeCount('abductor_1'),hp:b.hp,maxHp:b.maxHp};}''')
 assert result['move']['movedFeet']==10,result
 assert result['total']==2,result
 assert result['maxHp']==90,result
 assert not errors,errors
 print('Browser V3.15 PASS: import, inspector, Pull choice, Push choice, Energy Drain negative levels')
 b.close()
