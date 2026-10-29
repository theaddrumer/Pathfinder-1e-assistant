"""Run the engine suites, optionally followed by all offline browser regressions.
Usage: python3 run_regressions.py [--browser]
Browser setup: pip install playwright; playwright install chromium
Optional BROWSER_EXECUTABLE selects an existing Chromium installation.
Optional BROWSER_ARGS is a JSON array of additional launch arguments.
"""
from pathlib import Path
import argparse
import os
import subprocess
import sys

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser', action='store_true')
args = parser.parse_args()
results = []
details = []


def run(name, command):
    try:
        result = subprocess.run(command, cwd=root, text=True, capture_output=True, timeout=120)
        passed = result.returncode == 0
        output = result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        passed = False
        output = 'Timed out after 120 seconds.'
    results.append((name, passed))
    details.append(f'{name}: {"PASS" if passed else "FAIL"}\n{output}')
    print(f'{"PASS" if passed else "FAIL"} {name}', flush=True)
    if not passed:
        print(output, flush=True)


for path in sorted(root.glob('*tests.mjs')):
    run(path.name, ['node', str(path)])

if args.browser:
    # Preserve historical fixtures while allowing their old /usr/bin/chromium
    # default to work on systems with Playwright-managed browsers instead.
    browser_runner = '''
import json, os, pathlib, runpy, sys
from playwright.sync_api import BrowserType
launch = BrowserType.launch
def configured_launch(self, *args, **kwargs):
    executable = os.environ.get('BROWSER_EXECUTABLE')
    if executable:
        kwargs['executable_path'] = executable
    elif kwargs.get('executable_path') and not pathlib.Path(kwargs['executable_path']).exists():
        kwargs.pop('executable_path')
    extra = json.loads(os.environ.get('BROWSER_ARGS', '[]'))
    kwargs['args'] = list(dict.fromkeys([*kwargs.get('args', []), *extra]))
    return launch(self, *args, **kwargs)
BrowserType.launch = configured_launch
runpy.run_path(sys.argv[1], run_name='__main__')
'''
    for path in sorted(root.glob('test_browser*.py')):
        run(path.name, [sys.executable, '-c', browser_runner, str(path)])

summary = f'{sum(passed for _, passed in results)}/{len(results)} suites passed'
print(summary)
(root / 'TEST_RESULTS_CURRENT.txt').write_text(summary + '\n\n' + '\n\n'.join(details))
raise SystemExit(any(not passed for _, passed in results))
