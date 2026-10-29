"""V3.30: configure, cast, inspect, expire, remove and dispel persistent regions."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--no-zygote'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
 def prepare(modifier=False):
  c=page.evaluate('({x:instance.active().x,y:instance.active().y})')
  page.locator('#magic-x').fill(str(c['x']));page.locator('#magic-y').fill(str(c['y']));page.locator('#magic-size').fill('10');page.locator('#area-count').fill('2')
  spell={'name':'Synthetic lingering region','level':2,'casterLevel':5,'targets':['hero'],'components':[{'damageType':'fire','amount':2}]}
  if modifier:spell['effect']={'rounds':8,'mods':[{'stat':'attack','value':2,'type':'luck'}]}
  page.locator('#magic-spell-json').fill(json.dumps(spell));page.locator('#area-attach').click()
 reset();assert 'Tabletop Kernel' in page.title();prepare();hp=page.evaluate("instance.find('hero').hp")
 page.locator('#magic-cast').click()
 assert page.evaluate('instance.persistentAreaEvents().length')==1,page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.actions.resources.standard')==0
 assert page.evaluate("instance.find('hero').hp")==hp-2
 assert page.locator('.tile.persistent-area').count()>0
 assert '2 round(s)' in page.locator('#area-active').inner_text()
 page.locator('#pending-active').select_option(page.evaluate('instance.persistentAreaEvents()[0].id'));assert page.locator('#pending-trigger-button').is_disabled()
 page.locator('#magic-clear').click();assert page.locator('.tile.persistent-area').count()>0
 page.locator('#end-turn').click();assert page.evaluate("instance.find('hero').hp")==hp-4
 page.locator('#end-turn').click();assert page.evaluate('instance.persistentAreaEvents().length')==0
 assert page.evaluate("instance.find('hero').hp")==hp-4
 assert page.locator('.tile.persistent-area').count()==0;assert page.locator('#area-remove').is_disabled()
 print('PASS browser: normal cast, grid footprint, native countdown and expiry before repeat')
 reset();prepare(True);base=page.evaluate("instance.stat('hero','attack')");page.locator('#magic-gm-resolve').click()
 assert page.evaluate("instance.stat('hero','attack')")==base+2
 page.locator('#area-remove').click();assert page.evaluate("instance.stat('hero','attack')")==base
 assert page.evaluate('instance.s.effects.length')==0
 print('PASS browser: Time & Events removal clears inside-only modifiers')
 reset();prepare(True);page.locator('#magic-gm-resolve').click();area_id=page.evaluate('instance.persistentAreaEvents()[0].id')
 page.locator('#magic-dispel-target').select_option(area_id);page.locator('#magic-sample-dispel').click();page.locator('#magic-gm-resolve').click()
 assert page.evaluate('instance.persistentAreaEvents().length')==0,page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.effects.length')==0
 assert page.evaluate("instance.s.pendingEventHistory.at(-1).outcome")=='dispelled'
 print('PASS browser: area targeting uses the existing dispel controls')
 assert not errors,errors
 print('V3.30 browser: 3 integration scenarios passed; no page errors')
 browser.close()
