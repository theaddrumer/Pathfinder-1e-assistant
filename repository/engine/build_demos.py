"""Rebuild standalone offline browser demos from the tested ES modules."""
from pathlib import Path
import re
BASE=Path(__file__).resolve().parent

def flatten(name):
    code=(BASE/name).read_text()
    code=re.sub(r'^import .*?;\s*$', '', code, flags=re.M)
    code=re.sub(r'^export \{[^}]+\};\s*$', '', code, flags=re.M)
    code=re.sub(r'^export ', '', code, flags=re.M)
    return code

def build(template,out,parts):
    html=(BASE/template).read_text()
    for tag,name in parts:
        marker=f'/*__{tag}__*/'
        assert marker in html
        html=html.replace(marker,flatten(name))
    (BASE/out).write_text(html)

build('automation-demo-template.html','automation-demo.html',
      [('STATS','stats.mjs'),('LIFECYCLE','lifecycle.mjs'),('CORE','core.mjs'),('AUTOMATION','automation.mjs'),('CRITICAL_RULES','critical_rules.mjs'),('TRAITS','trait_library.mjs'),('WEAPON_MATERIALS','weapon_materials.mjs'),('ATTACK_COMPLETION_RULES','attack_completion_rules.mjs'),('ATTACK_ROUTINE_RULES','attack_routine_rules.mjs'),('ATTACK_LIBRARY','attack_library.mjs'),('REGISTRY','registry.mjs'),
       ('CONDITIONS','conditions.mjs'),('AILMENTS','ailments.mjs'),('CONDITION_ENGINE','condition_ailment_game.mjs'),('FOUNDATIONS','foundations.mjs'),
       ('MANEUVERS','maneuvers.mjs'),('RIDERS','riders.mjs'),('CRITICAL','critical.mjs'),('FINAL_OFFENSE','final_offense.mjs'),('MAP_GEOMETRY','map_geometry.mjs'),('DEFENSE','defense.mjs'),('TIME_ENGINE','time_engine.mjs'),('ATTACK_COMPLETION','attack_completion.mjs'),('ATTACK_ROUTINES','attack_routines.mjs'),('INITIATIVE','initiative.mjs'),('PENDING_EVENTS','pending_events.mjs'),('SPELL_RESOURCES','spell_resources.mjs'),('SUMMONS','summons.mjs'),('SPELL_GEOMETRY','spell_geometry.mjs'),('PERSISTENT_AREAS','persistent_areas.mjs'),('OBJECT_RULES','object_rules.mjs'),('ENCOUNTER_BASICS','encounter_basics.mjs'),('FALLING_RULES','falling_rules.mjs'),('MAP_ARTWORK','map_artwork.mjs'),('PLAYER_VIEW','player_view.mjs'),('MAP_SNAPSHOTS','map_snapshots.mjs'),('SCENE','scene.mjs'),('COMBAT_MECHANICS','combat_mechanics.mjs'),('COLLECTIVES','collectives.mjs'),('MAGIC','magic.mjs'),('SCENARIOS','scenarios.mjs'),('UI','automation-demo-ui.js')])
build('demo-template.html','demo.html',[('STATS','stats.mjs'),('LIFECYCLE','lifecycle.mjs'),('CORE','core.mjs'),('UI','demo-ui.js')])
# Preserve the historical fixtures as a regression/debugging gallery.
(BASE/'tests.html').write_text((BASE/'automation-demo.html').read_text())
# Give the default workbench a single clean setup instead of a growing fixture menu.
workbench=(BASE/'automation-demo.html').read_text()
workbench=re.sub(r'<label for="scenario">Test fixture</label><select id="scenario">.*?</select>',
                 '<input type="hidden" id="scenario" value="registry">',workbench,count=1,flags=re.S)
workbench=workbench.replace('<h2>Encounter setup</h2>','<h2>GM workbench</h2>',1)
workbench=workbench.replace('<h2>Test actions — gameplay versus GM overrides</h2>','<h2>Combat controls</h2>',1)
workbench=workbench.replace('Grid controls work for both Explorer and monsters. Full attack resolves one strike per click; a five-foot step is available between strikes. The Choker convenience movement spends real actions. Pudding direct-damage buttons are GM event injections.',
  'Grid controls work for both Explorer and monsters. Full attacks resolve one strike per click. A five-foot step is available between strikes. Generic adjudications above are GM-only.',1)
workbench=workbench.replace('Reset fixture','Reset workbench',1)
workbench=workbench.replace('<div class="controls" id="test-buttons"></div>',
                             '<div class="controls" id="test-buttons" hidden></div>',1)
workbench=workbench.replace('</main><footer>', '</main><footer><p><a href="tests.html" style="color:#e1bd83">Open historical test fixtures</a> · <a href="demo.html" style="color:#e1bd83">Legacy V1 demo</a></p>',1)
(BASE/'index.html').write_text(workbench)
print('Built standalone HTML demos and V3.51 index.html.')
