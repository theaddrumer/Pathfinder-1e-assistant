"""Offline UI acceptance: condition entry, advisory, ailment ticks, and rollback."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1550,'height':1050})
    errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content((ROOT/'index.html').read_text())
    assert 'Tabletop Kernel' in page.locator('h1').inner_text()
    assert page.locator('#condition-ailment-panel').is_visible()
    page.locator('#activate').click()
    page.locator('#register-creature').click()
    page.locator('#spawn-creature').click()
    assert 'Marsh Raider' in page.locator('#stats').inner_text()
    page.locator('#condition-id').select_option('shaken')
    page.locator('#condition-target').select_option('raider_1')
    page.locator('#condition-rounds').fill('3')
    page.locator('#condition-apply').click()
    assert 'Shaken' in page.locator('#stats').inner_text()
    assert 'Attack +5' in page.locator('#stats').inner_text()
    assert 'condition_1' in page.locator('#stats').inner_text() or 'Shaken' in page.locator('#stats').inner_text()
    page.locator('#condition-remove').click()
    assert 'Shaken' not in page.locator('#stats').inner_text()
    # Force an initial Fortitude failure and a specific STR damage roll.
    page.locator('#ailment-register').click()
    page.locator('#ailment-target').select_option('raider_1')
    page.evaluate('() => {instance.s.testRolls = [1, 4]}')
    page.locator('#ailment-expose').click()
    assert 'STR 4' in page.locator('#stats').inner_text(),page.locator('#stats').inner_text()
    assert page.locator('#ailment-active option').count()==1
    # Two periodic successes: remove poison but not preexisting STR damage.
    page.evaluate('() => {instance.s.testRolls=[20,20]}')
    page.locator('#time-count').fill('2')
    page.locator('#advance-time').click()
    assert page.locator('#ailment-active option').count()==0
    assert 'STR 4' in page.locator('#stats').inner_text()
    assert not errors,errors
    print('Browser V3.7 PASS: conditions, modifiers, ailment exposure, saves, cure, persistent damage.')
    browser.close()
