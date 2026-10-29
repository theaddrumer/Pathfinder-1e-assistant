"""Shortcut generation tests without invoking Windows or touching real user folders."""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from windows_shortcuts import shortcut_arguments, shortcut_script, create_windows_shortcuts
from launch_installed import selected_launcher
from install_ubuntu import install
from ubuntu_core import save_settings


class ShortcutTests(unittest.TestCase):
    def test_windows_arguments_keep_spaces_and_special_characters_as_data(self):
        target = Path('/home/O\'Name/$() folder/launch.py')
        args = shortcut_arguments(target, 'Ubuntu Test', 'TestUser')
        self.assertIn('--distribution "Ubuntu Test" --user TestUser --exec /usr/bin/python3', args)
        self.assertIn('"' + str(target) + '"', args)
        script = shortcut_script(args)
        encoded = script.split("FromBase64String('", 1)[1].split("'", 1)[0]
        self.assertEqual(json.loads(base64.b64decode(encoded))['arguments'], args)
        self.assertNotIn(str(target), script)
        self.assertNotIn('ExecutionPolicy', script)
        for bad in ['', 'Ubuntu\nwrong']:
            with self.assertRaises(ValueError):
                shortcut_arguments(target, bad, 'TestUser')

    def test_windows_bridge_failure_does_not_break_linux_install(self):
        with patch.dict(os.environ, {'WSL_DISTRO_NAME': 'Ubuntu'}), patch('windows_shortcuts.Path.is_file', return_value=True), patch('windows_shortcuts.subprocess.run') as run:
            run.return_value = subprocess.CompletedProcess([], 0, 'C:\\Desktop\\Pathfinder Assistant.lnk\nC:\\Programs\\Pathfinder Assistant.lnk\n', '')
            result = create_windows_shortcuts('/home/TestUser/.local/share/pathfinder-assistant/launch.py')
            self.assertTrue(result['ok'])
            command = run.call_args.args[0]
            self.assertEqual(command[-2], '-EncodedCommand')
            decoded = base64.b64decode(command[-1]).decode('utf-16-le')
            self.assertIn("GetFolderPath('DesktopDirectory')", decoded)
            self.assertIn("GetFolderPath('Programs')", decoded)
            run.return_value = subprocess.CompletedProcess([], 1, '', 'policy denied')
            self.assertFalse(create_windows_shortcuts('/home/TestUser/launch.py')['ok'])
            run.side_effect = subprocess.TimeoutExpired('powershell', 20)
            self.assertFalse(create_windows_shortcuts('/home/TestUser/launch.py')['ok'])

    def test_upgrade_shortcut_target_is_stable_and_launches_latest_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / "home with spaces and 'quote"
            source = Path(tmp) / 'package'
            (source / 'node_modules/@modelcontextprotocol/sdk').mkdir(parents=True)
            (source / 'launcher').mkdir()
            (source / 'node_modules/@modelcontextprotocol/sdk/package.json').write_text('{}')
            (source / 'mcp_server.mjs').write_text('test')
            output = Path(tmp) / 'launched'
            script = 'from pathlib import Path\nPath('+repr(str(output))+').write_text(VERSION)\n'
            with patch('install_ubuntu.create_windows_shortcuts', return_value={'ok': True, 'message': 'test'}) as shortcuts:
                (source / 'launcher/ubuntu_launcher.py').write_text(script.replace('VERSION', "'first'"))
                first, desktop = install(source, home, provision=False, windows=(None, None))
                menu = desktop.read_bytes()
                (source / 'launcher/ubuntu_launcher.py').write_text(script.replace('VERSION', "'second'"))
                second, _ = install(source, home, provision=False, windows=(None, None))
            self.assertNotEqual(first, second)
            self.assertEqual(menu, desktop.read_bytes())
            self.assertEqual(shortcuts.call_args_list[0], shortcuts.call_args_list[1])
            self.assertEqual(selected_launcher(home), second / 'launcher/ubuntu_launcher.py')
            bootstrap = home / '.local/share/pathfinder-assistant/launch.py'
            subprocess.run([sys.executable, str(bootstrap)], env=dict(os.environ, HOME=str(home)), check=True)
            self.assertEqual(output.read_text(), 'second')
            save_settings(home / '.config/pathfinder-assistant/settings.json', {'app_dir': '/tmp/not-installed'})
            with self.assertRaises(ValueError):
                selected_launcher(home)


if __name__ == '__main__':
    unittest.main(verbosity=2)
