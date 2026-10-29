from pathlib import Path
from playwright.sync_api import sync_playwright
url=Path(__file__).with_name('tests.html').resolve().as_uri()
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1200,'height':900})
  errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(Path(__file__).with_name('tests.html').read_text())
  page.locator('#scenario').select_option('choker')
  page.locator('#activate').click()
  def tile(x,y):return page.locator('#board button.tile').nth(y*10+x)
  tile(6,4).click()
  assert not page.locator('#interrupt-box').is_hidden(),f"Approach should pause Choker AoO: {page.locator('#notice').inner_text()}"
  assert 'Choker' in page.locator('#interrupt-label').inner_text()
  page.locator('#decline').click()
  assert page.locator('#interrupt-box').is_hidden()
  page.locator('[data-mode="attack"]').click()
  tile(7,3).click()
  assert 'standard' in page.locator('#log').inner_text().lower()
  page.locator('#end-turn').click()
  assert 'Choker' in page.locator('#clock').inner_text()
  page.locator('[data-mode="move"]').click()
  tile(8,3).click()
  assert not page.locator('#interrupt-box').is_hidden(),'Choker move must pause for Explorer AoO'
  assert 'Explorer' in page.locator('#interrupt-label').inner_text()
  assert 'still in its departure square' in page.locator('#notice').inner_text()
  assert 'ATTACK OF OPPORTUNITY' in page.locator('#interrupt-box').inner_text()
  assert '7,3' not in page.locator('#notice').inner_text() # generic notice
  page.locator('#decline').click()
  assert page.locator('#interrupt-box').is_hidden()
  assert '(8,3)' in page.locator('#stats').inner_text(),'Choker should finish move after AoO decision'
  tile(9,3).click()
  assert '(9,3)' in page.locator('#stats').inner_text(),'Choker should have second move available'
  print('BROWSER PASS Explorer approaches, Choker AoO, attacks, Choker move pauses for Explorer AoO, movement resumes, second move works')

  page.locator('#reset').click()
  page.locator('#activate').click()
  tile(6,4).click()
  page.locator('#decline').click()
  page.locator('[data-mode="attack"]').click()
  tile(7,3).click()
  page.locator('#end-turn').click()
  page.locator('[data-mode="step"]').click()
  tile(8,3).click()
  assert 'No other movement is allowed' in page.locator('#notice').inner_text()
  page.locator('[data-mode="move"]').click()
  tile(9,3).click()
  assert 'five-foot step was already taken' in page.locator('#notice').inner_text()
  assert '(8,3)' in page.locator('#stats').inner_text()
  print('BROWSER PASS Five-foot step prevents later movement and gives an explanatory error')
  assert not errors, f'Browser JavaScript errors: {errors}'
  print('BROWSER PASS no JavaScript runtime errors')
  browser.close()
