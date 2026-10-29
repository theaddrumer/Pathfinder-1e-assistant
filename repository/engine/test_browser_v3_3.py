from pathlib import Path
from playwright.sync_api import sync_playwright
url=Path(__file__).parent.joinpath('tests.html').as_uri()
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1450,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(Path(__file__).parent.joinpath('tests.html').read_text())
 assert 'Tabletop Kernel' in page.locator('h1').inner_text()
 page.locator('#scenario').select_option('choker');page.locator('#activate').click()
 # Explorer moves from x=3,y=4 into Choker's reach at (5,4) without leaving it.
 page.locator('[data-mode="move"]').click()
 page.locator('#board button').nth(4*10+5).click()
 assert page.locator('#notice').inner_text().startswith('Action resolved'),page.locator('#notice').inner_text()
 assert 'Explorer' in page.locator('#clock').inner_text()
 page.locator('#end-turn').click()
 assert 'Choker' in page.locator('#clock').inner_text()
 assert 'Move 2' in page.locator('#clock').inner_text()
 page.locator('[data-mode="full_attack"]').click()
 page.locator('#board button').nth(4*10+5).click()
 assert 'strike(s) remaining' in page.locator('#notice').inner_text(),page.locator('#notice').inner_text()
 assert 'Full attack' in page.locator('#clock').inner_text()
 assert page.locator('#finish-full').is_visible()
 # Between attacks: step from (7,3) to (6,3) while threatened by Explorer at (5,4).
 page.locator('[data-mode="step"]').click();page.locator('#board button').nth(3*10+6).click()
 assert 'step completed' in page.locator('#notice').inner_text(),page.locator('#notice').inner_text()
 page.locator('[data-mode="full_attack"]').click();page.locator('#board button').nth(4*10+5).click()
 assert not page.locator('#finish-full').is_visible()
 assert 'Move 1' in page.locator('#clock').inner_text(),page.locator('#clock').inner_text()
 # Step prevents spending this on actual movement even after full attack.
 page.locator('[data-mode="move"]').click();page.locator('#board button').nth(3*10+7).click()
 assert 'five-foot step' in page.locator('#notice').inner_text().lower()
 # Test second encounter: full attack then move (with no step) from Quickness.
 page.locator('#reset').click();page.locator('#activate').click()
 page.locator('#board button').nth(4*10+5).click();page.locator('#end-turn').click()
 page.locator('[data-mode="full_attack"]').click();page.locator('#board button').nth(4*10+5).click()
 page.locator('#board button').nth(4*10+5).click()
 assert 'Move 1' in page.locator('#clock').inner_text()
 page.locator('[data-mode="move"]').click();page.locator('#board button').nth(3*10+8).click()
 assert 'Move 0' in page.locator('#clock').inner_text(),page.locator('#clock').inner_text()
 assert 'Action resolved' in page.locator('#notice').inner_text()
 assert not errors,errors
 page.screenshot(path=str(Path(__file__).parent/'full_attack_interface.png'),full_page=True)
 print('Browser V3.3 pass: Choker 2 strikes, interleaved step, Quickness move after full attack, no JS errors.')
 browser.close()
