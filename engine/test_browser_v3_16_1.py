from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':980})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((root/'index.html').read_text())
    page.locator('#activate').click()
    page.locator('#gm-tile-x').fill('2');page.locator('#gm-tile-y').fill('4')
    page.locator('#gm-tile-run').click()
    assert page.evaluate("instance.tileKind(2,4)")=='wall'
    assert 'wall' in (page.locator('#board .tile').nth(4*10+2).get_attribute('class') or '')
    page.locator('#manual-move-path').fill('1,4;2,4;3,4')
    page.locator('#manual-move-run').click()
    assert 'error' in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
    assert page.evaluate("instance.find('hero').x")==0
    page.evaluate("instance.find('hero').subtypes=['incorporeal'];render()")
    page.locator('#manual-move-run').click()
    assert 'error' not in (page.locator('#notice').get_attribute('class') or ''),page.locator('#notice').inner_text()
    assert page.evaluate("instance.find('hero').x")==3
    assert not errors,errors
    print('Browser V3.16.1 PASS: GM wall editing, corporeal obstruction, AI-authored incorporeal path')
    browser.close()
