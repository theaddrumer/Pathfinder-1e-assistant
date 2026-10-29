"""V3.35 map controls, bounded viewport, shared selection, and scene closure."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--no-zygote'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def setup():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
 def command(c):
  page.locator('#map-command').fill(json.dumps(c));page.locator('#map-command-run').click()
 setup();assert page.title().startswith('Tabletop Kernel V')
 page.locator('#map-width').fill('100');page.locator('#map-height').fill('80');page.locator('#map-resize').click()
 assert page.evaluate('instance.s.width')==100;assert page.locator('#board .tile').count()==320
 page.locator('#map-establish').click();page.locator('#map-width').fill('120');page.locator('#map-resize').click()
 assert 'Established scene' in page.locator('#notice').inner_text()
 page.locator('#map-view-x').fill('110');page.locator('#map-view-y').fill('70');page.locator('#map-view').click()
 assert page.locator('#board .tile').count()==100;assert page.locator('#board .tile').first.get_attribute('data-x')=='110'
 page.locator('#map-panel').scroll_into_view_if_needed();page.screenshot(path=str(root/'browser_v3_34_map.png'))
 print('PASS browser: large map dimensions, advisory soft lock and bounded panning')
 setup();page.locator('#map-command').evaluate('(e)=>e.closest("details").open=true')
 command({'op':'gm_set_elevation','target':'hero','elevation':{'feet':20,'grounded':False,'layer':'air'},'reason':'Flying above floor'})
 assert page.evaluate('instance.find("hero").elevation.feet')==20;assert 'Elevation is GM-adjudicated' in page.locator('#notice').inner_text()
 page.evaluate("""() => {interact({op:'register_creature',definition:{id:'tiny_def',name:'Tiny foe',creatureType:'humanoid',stats:{maxHp:20,sizeCategory:'tiny'}}},'gm');interact({op:'spawn_creature',definition:'tiny_def',id:'tiny_foe',x:0,y:4,team:'enemy'},'gm');render();}""")
 assert '2' in page.locator('#board .tile[data-x="0"][data-y="4"] .stack-count').all_text_contents()
 page.locator('#map-stack-target').select_option('tiny_foe');assert page.evaluate('tokenAt(0,4).id')=='tiny_foe'
 page.locator('#board').scroll_into_view_if_needed();page.screenshot(path=str(root/'browser_v3_34_stack.png'))
 print('PASS browser: elevation warnings and selectable shared-square occupants')
 page.locator('#map-command').evaluate('(e)=>e.closest("details").open=true')
 closure={'op':'gm_close_scene','keep':['hero'],'placements':[{'id':'hero','x':2,'y':2}],'width':30,'height':20,'reason':'Depart encounter'}
 page.locator('#map-command').fill(json.dumps(closure));page.locator('#map-close-preview').click();assert 'tiny_foe' in page.locator('#map-state').inner_text();assert page.evaluate('instance.s.creatures.length')==2
 page.locator('#map-command-run').click();assert page.evaluate('instance.s.creatures.length')==1;assert page.evaluate('instance.s.width')==30
 closure.update(keep=[],placements=[]);command(closure);assert page.evaluate('instance.s.creatures.length')==0
 page.locator('#map-command').fill('{bad json');page.locator('#map-close-preview').click();assert 'error' in page.locator('#notice').get_attribute('class')
 page.evaluate("""() => {interact({op:'register_creature',definition:{id:'new_actor',name:'New actor',stats:{maxHp:10}}},'gm');interact({op:'spawn_creature',definition:'new_actor',id:'new_actor',x:1,y:1,team:'party'},'gm');render();}""")
 assert page.locator('#board .tile').count()==320
 print('PASS browser: closure preview, empty-scene recovery and malformed JSON handling')
 setup();page.evaluate("""() => {
 interact({op:'register_creature',definition:{id:'caster',name:'Caster',stats:{maxHp:20}}},'gm');interact({op:'spawn_creature',definition:'caster',id:'caster',x:4,y:4,team:'enemy'},'gm');
 interact({op:'gm_resolve_spell',actor:'caster',spell:{name:'Lingering fear',level:1,casterLevel:3,targets:['hero'],effect:{conditions:['shaken']},concentration:{afterRounds:2}}},'gm');
 interact({op:'gm_close_scene',keep:['hero'],placements:[{id:'hero',x:1,y:1}],reason:'Caster leaves'},'gm');render();
 }""")
 assert 'Departed caster' in page.locator('#concentration-active').inner_text();assert page.locator('#concentration-check').is_disabled()
 assert not errors,errors
 print('PASS browser: lingering concentration from a departed caster remains inspectable')
 print('V3.35 browser: 4 scenarios passed; no page errors')
 browser.close()
