"""V3.22 offline UI: circle/cone/line preview, JSON area sync and magic outcome."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'index.html').read_text())
 page.locator('#activate').click()
 page.locator('#magic-preview').click()
 assert 'sphere' in page.locator('#magic-area-result').inner_text(),page.locator('#notice').inner_text()
 assert page.locator('.tile.magic-preview').count()>0
 page.locator('#magic-shape').select_option('cone')
 page.locator('#magic-direction').select_option('E')
 page.locator('#magic-preview').click()
 assert page.evaluate('magicPreview.area.shape')=='cone'
 page.locator('#magic-sync-area').click()
 assert page.evaluate('JSON.parse(document.getElementById("magic-spell-json").value).area.shape')=='cone'
 page.locator('#magic-cast').click()
 assert page.evaluate('instance.s.actions.resources.standard')==0, page.locator('#notice').inner_text()
 assert 'resolved' in page.locator('#magic-spell-result').inner_text()
 page.locator('#magic-clear').click()
 assert page.locator('.tile.magic-preview').count()==0
 assert not errors,errors
 print('Browser V3.22 PASS: area preview, cone overlay, JSON casting, action cost, clear overlay')
 browser.close()
