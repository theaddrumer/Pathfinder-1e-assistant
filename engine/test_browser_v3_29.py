"""V3.29: current inspection and deferred turn-start integration in the workbench."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':1050});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def reset():
  page.goto('about:blank');page.set_content((root/'index.html').read_text());page.locator('#activate').click()
 reset()
 assert 'Mechanics Workbench' in page.title()
 page.evaluate("""instance.installRule({id:'start_bonus',owner:'hero',on:'turn_start',when:[],actions:[{op:'grant_action',target:'hero',type:'swift',count:1}]});
 instance.dispatch({op:'gm_schedule_time_event',id:'bell',label:'Bell',after:{count:1,unit:'round'}},'gm');render();""")
 page.locator('#end-turn').click()
 assert page.evaluate('instance.s.deferredTurnStart.actor')=='hero'
 assert page.evaluate('instance.s.actions.resources.swift')==1
 before=page.evaluate('JSON.stringify(instance.s)')
 page.locator('#lifecycle-inspect').click()
 assert 'scheduled_time_event' in page.locator('#lifecycle-details').inner_text()
 assert page.evaluate('JSON.stringify(instance.s)')==before
 page.locator('#end-turn').click()
 assert 'checkpoint' in page.locator('#notice').inner_text()
 assert page.evaluate('instance.s.round')==2
 page.evaluate("instance.dispatch({op:'gm_acknowledge_time_event',reason:'Bell heard'},'gm');render()")
 assert page.evaluate('instance.s.deferredTurnStart') is None
 assert page.evaluate('instance.s.actions.resources.swift')==2
 assert page.evaluate('instance.s.actions.activity')==0
 print('PASS browser: world-time checkpoint, pure inspection, blocked action, single resumed start')
 reset()
 page.evaluate("""instance.dispatch({op:'gm_begin_initiative',scores:{hero:20}},'gm');
 instance.dispatch({op:'gm_schedule_initiative_event',id:'stop',label:'Review',afterRounds:1,requiresInput:true},'gm');render();""")
 page.locator('#end-turn').click();page.locator('#lifecycle-inspect').click()
 assert 'initiative_event' in page.locator('#lifecycle-details').inner_text()
 assert 'hero' in page.locator('#controller-view').inner_text()
 assert page.evaluate('instance.s.deferredTurnStart.actor')=='hero'
 page.evaluate("instance.dispatch({op:'gm_acknowledge_initiative_event',reason:'Reviewed'},'gm');render()")
 assert page.evaluate('instance.s.deferredTurnStart') is None
 print('PASS browser: initiative checkpoint leaves controller and lifecycle views usable')
 assert not errors,errors
 print('V3.29 browser: 2 integration scenarios passed; no page errors')
 browser.close()
