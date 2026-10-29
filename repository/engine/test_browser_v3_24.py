"""V3.24 offline workbench: casting duration, continuation, completion and AoOs."""
from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--single-process','--no-zygote'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
 def put_spell(time):
  page.locator('#magic-spell-json').fill(json.dumps({'name':'Workbench casting test','level':1,'casterLevel':5,'castingTime':time,'targets':['hero'],'components':[{'damageType':'force','amount':3}],'concentrationBonus':100}))
 reset();put_spell('standard')
 page.locator('#magic-casting-time').select_option('1_round');page.locator('#magic-set-time').click()
 assert page.evaluate('JSON.parse(document.getElementById("magic-spell-json").value).castingTime')=='1_round'
 page.locator('#magic-cast').click()
 assert page.evaluate('instance.s.activeSpellCasts.length')==1,page.locator('#notice').inner_text()
 assert not page.locator('#magic-complete').is_enabled()
 assert '1/1' in page.locator('#magic-casting-state').inner_text()
 page.locator('#end-turn').click()
 assert page.locator('#magic-complete').is_enabled(),page.locator('#notice').inner_text()
 assert 'FINISHED' in page.locator('#casting-time-summary').inner_text()
 page.locator('#magic-complete').click()
 assert page.evaluate('instance.s.activeSpellCasts.length')==0
 assert page.evaluate('instance.s.actions.resources.standard')==1
 assert page.evaluate('instance.find("hero").hp')==37
 print('PASS browser: 1-round casting completes before normal actions')
 reset();put_spell({'count':2,'unit':'round'});page.locator('#magic-cast').click();page.locator('#end-turn').click()
 assert page.locator('#magic-long-continue').is_enabled()
 page.locator('#magic-long-continue').click();assert '2/2' in page.locator('#magic-casting-state').inner_text()
 page.locator('#end-turn').click();page.locator('#magic-cancel').click()
 assert page.evaluate('instance.s.deferredTurnStart') is None
 assert page.evaluate('instance.find("hero").hp')==40
 print('PASS browser: continuation, cancellation and deferred turn resumption')
 reset();put_spell({'count':1,'unit':'minute'});page.locator('#magic-cast').click()
 page.locator('#time-count').fill('1');page.locator('#time-unit').select_option('hour');page.locator('#advance-time').click()
 assert page.evaluate('instance.s.worldRounds')==10,page.locator('#notice').inner_text()
 assert page.locator('#magic-complete').is_enabled()
 page.locator('#lifecycle-inspect').click();assert 'casting_completion' in page.locator('#lifecycle-details').inner_text()
 page.locator('#magic-complete').click()
 assert page.evaluate('instance.find("hero").hp')==37
 print('PASS browser: Fast Forward stops at casting completion and exposes lifecycle state')
 reset()
 page.evaluate('''() => {
 const c=JSON.parse(JSON.stringify(instance.find('hero')));Object.assign(c,{id:'foe',name:'Foe',team:'enemy',x:1,y:4,size:1,reach:1});instance.s.creatures.push(c);render();
 }''')
 put_spell('standard');page.locator('#magic-cast').click()
 assert page.evaluate('!!instance.s.pendingSpellCast'),page.locator('#notice').inner_text()
 assert 'Casting paused' in page.locator('#notice').inner_text()
 assert page.locator('#magic-aoo-decline').is_enabled()
 page.locator('#magic-aoo-decline').click();page.locator('#magic-continue').click()
 assert page.evaluate('instance.s.pendingSpellCast') is None
 assert page.evaluate('instance.find("hero").hp')==37
 assert not errors,errors
 print('PASS browser: provoking cast, per-creature AoO choice and confirmed resumption; no page errors')
 page.locator('#magic-panel').screenshot(path=str(root/'casting_workbench_v3_24.png'))
 browser.close()
