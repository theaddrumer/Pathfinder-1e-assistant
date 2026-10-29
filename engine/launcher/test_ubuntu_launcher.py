"""Disposable integration tests; never uses the user's tunnel or encounter."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

from ubuntu_core import (Controller, InstanceLock, atomic_json, child_environment,
                         load_settings, save_settings, Redactor, validate, open_player_map)
from install_ubuntu import install, windows_path, desktop_arg, verified_download

APP = Path(__file__).resolve().parent.parent
NODE = shutil.which('node')
SECRET = 'sk-proj-' + 'disposabletestsecret' * 4


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def wait_for(test, timeout=6):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        if test():
            return
        time.sleep(.03)
    raise AssertionError('Timed out')


def request(port, method, params=None, request_id=1):
    body = json.dumps({'jsonrpc': '2.0', 'id': request_id, 'method': method, 'params': params or {}}).encode()
    req = urllib.request.Request(f'http://127.0.0.1:{port}/mcp', data=body,
                                 headers={'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)


class Tests(unittest.TestCase):
    def test_artwork_browser_target_is_fixed_local_route(self):
        with patch('ubuntu_core.Path.is_file', return_value=True), patch('ubuntu_core.subprocess.run') as run:
            run.return_value.returncode = 0
            open_player_map(8787, 'artwork')
            self.assertIn("Start-Process 'http://127.0.0.1:8787/artwork'", run.call_args.args[0])
            open_player_map(8788)
            self.assertIn("Start-Process 'http://127.0.0.1:8788/player'", run.call_args.args[0])
            with self.assertRaises(ValueError):
                open_player_map(8787, "artwork'; other-command")

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='pf-launcher-test-')
        self.base = Path(self.tmp.name)
        self.controller = Controller(free_port(), free_port())
        # Fake tunnel executable for exact environment/lifecycle observations, without network.
        self.tunnel = self.base / 'tunnel'
        self.tunnel.write_text('''#!/usr/bin/env python3
import json,os,sys,time
from pathlib import Path
if '--version' in sys.argv:
 print('0.0.17 flavor=runtime');sys.exit(0)
p=Path(__file__).parent
(p/'observed.json').write_text(json.dumps({'argv':sys.argv,'environment':dict(os.environ),'pid':os.getpid()}))
print('INFO tunnel metadata fetched',flush=True)
if (p/'reject').exists():
 print('ERROR 401 Unauthorized '+os.environ['CONTROL_PLANE_API_KEY'],flush=True)
 sys.exit(1)
while True:time.sleep(.1)
''')
        self.tunnel.chmod(0o700)
        self.config = {'app_dir': str(APP), 'node': NODE, 'tunnel': str(self.tunnel),
                       'state_path': str(self.base / 'encounter.json'),
                       'tunnel_id': 'tunnel_' + 'a' * 32, 'organization_id': ''}
        self.real_validate = validate
        # Only the synthetic tunnel's ELF/version check is replaced. Real validation has its own test.
        def fake_validate(config, key, require_existing=True):
            if require_existing and not Path(config['state_path']).is_file():
                raise ValueError('Missing encounter')
        self.validation_patch = patch('ubuntu_core.validate', side_effect=fake_validate)
        self.validation_patch.start()

    def tearDown(self):
        self.controller.close()
        self.validation_patch.stop()
        self.tmp.cleanup()

    def start(self):
        self.controller.start(self.config, SECRET, require_existing=False)
        wait_for(lambda: (self.base / 'observed.json').exists())

    def test_real_engine_restart_reconnect_save_and_env(self):
        # Observe the real Node process environment without depending on /proc exposure.
        original_spawn = self.controller._spawn
        def observed_spawn(name, command, env, cwd, ready=None):
            if name == 'Calculator':
                script = "import fs from 'node:fs';fs.writeFileSync(" + json.dumps(str(self.base / 'engine-env.json')) + ",JSON.stringify(process.env));await import(" + json.dumps((APP / 'launcher/launcher_host.mjs').as_uri()) + ");"
                command = [command[0], '--input-type=module', '-e', script]
            return original_spawn(name, command, env, cwd, ready)
        self.controller._spawn = observed_spawn
        with patch.dict(os.environ, {'CONTROL_PLANE_API_KEY': 'stale', 'NODE_OPTIONS': '--bad',
                                    'TABLETOP_API_TOKEN': 'bad', 'OPENAI_API_KEY': 'stale'}):
            self.start()
        observed = json.loads((self.base / 'observed.json').read_text())
        self.assertEqual(observed['environment']['CONTROL_PLANE_API_KEY'], SECRET)
        self.assertNotIn(SECRET, ' '.join(observed['argv']))
        self.assertNotIn('OPENAI_API_KEY', observed['environment'])
        self.assertNotIn('NODE_OPTIONS', observed['environment'])
        proc_env = (self.base / 'engine-env.json').read_bytes()
        self.assertNotIn(SECRET.encode(), proc_env)
        self.assertNotIn(b'OPENAI_API_KEY', proc_env)
        init = request(self.controller.engine_port, 'initialize', {'protocolVersion': '2025-11-25',
                        'capabilities': {}, 'clientInfo': {'name': 'disposable-launcher-test', 'version': '1'}})
        self.assertEqual(init['result']['serverInfo']['name'], 'tabletop-kernel')
        status = request(self.controller.engine_port, 'tools/call', {'name': 'kernel_status', 'arguments': {}})
        self.assertNotIn('error', status)
        with urllib.request.urlopen(f'http://127.0.0.1:{self.controller.player_port}/player') as response:
            self.assertEqual(response.status, 200)
        save = Path(self.config['state_path'])
        original = save.read_bytes()
        engine_pid = self.controller.engine.pid
        first_tunnel_pid = self.controller.tunnel.pid
        self.controller.reconnect(self.config, SECRET)
        self.assertEqual(self.controller.engine.pid, engine_pid)
        self.assertNotEqual(self.controller.tunnel.pid, first_tunnel_pid)
        self.assertEqual(original, save.read_bytes())
        self.controller.stop()
        self.assertFalse(Path(str(save) + '.lock').exists())
        self.controller.start(self.config, SECRET)
        self.assertEqual(original, save.read_bytes())

    def test_401_keeps_map_redacts_and_recovers(self):
        (self.base / 'reject').touch()
        self.start()
        wait_for(lambda: self.controller.tunnel.poll() is not None)
        self.assertIsNone(self.controller.engine.poll())
        logs = []
        while not self.controller.events.empty():
            logs.append(self.controller.events.get_nowait())
        self.assertNotIn(SECRET, str(logs))
        self.assertIn('[REDACTED]', str(logs))
        self.assertIn('Authentication rejected', str(logs))
        (self.base / 'reject').unlink()
        self.controller.reconnect(self.config, SECRET)
        self.assertIsNone(self.controller.tunnel.poll())

    def test_busy_port_does_not_kill_unrelated_server(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', self.controller.engine_port))
            sock.listen()
            with self.assertRaisesRegex(RuntimeError, 'in use'):
                self.controller.start(self.config, SECRET, require_existing=False)
            self.assertIsNone(self.controller.engine)
            self.assertEqual(sock.getsockname()[1], self.controller.engine_port)

    def test_player_collision_prevents_start(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', self.controller.player_port))
            with self.assertRaisesRegex(RuntimeError, 'in use'):
                self.controller.start(self.config, SECRET, require_existing=False)
        self.assertFalse(Path(self.config['state_path']).exists())

    def test_malformed_save_is_preserved(self):
        state = Path(self.config['state_path'])
        state.write_text('broken-but-do-not-overwrite')
        with self.assertRaises(RuntimeError):
            self.controller.start(self.config, SECRET)
        self.assertEqual(state.read_text(), 'broken-but-do-not-overwrite')
        self.assertFalse(Path(str(state) + '.lock').exists())

    def test_duplicate_writer_does_not_stop_first(self):
        self.start()
        second = Controller(free_port(), free_port())
        try:
            with self.assertRaises(RuntimeError):
                second.start(self.config, SECRET)
            self.assertIsNone(self.controller.engine.poll())
        finally:
            second.close()

    def test_unexpected_calculator_exit_stops_tunnel(self):
        self.start()
        engine, tunnel = self.controller.engine, self.controller.tunnel
        os.kill(engine.pid, signal.SIGTERM)
        wait_for(lambda: tunnel.poll() is not None)

    def test_settings_exclude_secrets_atomic_mode(self):
        path = self.base / 'settings.json'
        config = dict(self.config, api_key=SECRET, ProtectedKey='old-ciphertext')
        save_settings(path, config)
        self.assertNotIn(SECRET, path.read_text())
        self.assertNotIn('ProtectedKey', path.read_text())
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(load_settings(path)['tunnel_id'], config['tunnel_id'])
        self.assertFalse(list(self.base.glob('.settings-*')))

    def test_log_flood_does_not_lose_completion_or_grow_unbounded(self):
        for _ in range(2000):
            self.controller.emit('log', SECRET)
        self.controller.emit('done', '')
        self.assertLessEqual(self.controller.events.qsize(), 301)
        events = []
        while not self.controller.events.empty():
            events.append(self.controller.events.get_nowait())
        self.assertEqual(events[-1], ('done', ''))
        self.assertNotIn(SECRET, str(events))

    def test_real_validation_rejects_wrong_inputs(self):
        for key in ('track_abc', 'sk-...', 'sk-bad key', ''):
            with self.assertRaises(ValueError):
                self.real_validate(self.config, key)
        windows = self.base / 'wrong.exe'
        windows.write_bytes(b'MZfake')
        windows.chmod(0o700)
        with self.assertRaisesRegex(ValueError, 'Linux executable'):
            self.real_validate(dict(self.config, tunnel=str(windows)), SECRET)
        with self.assertRaisesRegex(ValueError, 'tunnel ID'):
            self.real_validate(dict(self.config, tunnel_id=SECRET), SECRET)
        real_tunnel = Path('/tmp/pf-linux-tunnel-v0.0.17')
        if real_tunnel.exists():
            self.real_validate(dict(self.config, tunnel=str(real_tunnel)), SECRET, False)

    def test_instance_lock_releases_without_stale_pid_rules(self):
        filename = self.base / 'launcher.lock'
        lock = InstanceLock(filename)
        with self.assertRaises(RuntimeError):
            InstanceLock(filename)
        lock.close()
        again = InstanceLock(filename)
        again.close()

    def test_installer_preserves_save_and_migrates_only_nonsecret_settings(self):
        home = self.base / 'home with spaces'
        profile = self.base / 'Windows user'
        local = self.base / 'AppData/Local'
        source = self.base / 'minimal release'
        (source / 'node_modules/@modelcontextprotocol/sdk').mkdir(parents=True)
        (source / 'mcp_server.mjs').write_text('test')
        (source / 'node_modules/@modelcontextprotocol/sdk/package.json').write_text('{}')
        save = profile / '.tabletop-kernel/encounter.json'
        atomic_json(save, {'do': 'not modify'})
        old = local / 'TabletopKernel/Launcher/settings.json'
        atomic_json(old, {'TunnelId': self.config['tunnel_id'], 'ProtectedKey': SECRET})
        original = save.read_bytes()
        app, desktop = install(source, home, provision=False, windows=(profile, local))
        config = load_settings(home / '.config/pathfinder-assistant/settings.json')
        self.assertEqual(config['state_path'], str(save))
        self.assertEqual(config['tunnel_id'], self.config['tunnel_id'])
        self.assertNotIn(SECRET, (home / '.config/pathfinder-assistant/settings.json').read_text())
        self.assertEqual(save.read_bytes(), original)
        self.assertTrue((app / 'mcp_server.mjs').exists())
        self.assertIn('Terminal=false', desktop.read_text())
        self.assertIn(str(home / '.local/share/pathfinder-assistant/launch.py'), desktop.read_text())
        newer, _ = install(source, home, provision=False, windows=(None, None))
        self.assertNotEqual(app, newer)
        self.assertEqual(load_settings(home / '.config/pathfinder-assistant/settings.json')['state_path'], str(save))
        self.assertEqual(windows_path("C:\\Users\\O'Name\\a b.json"), Path("/mnt/c/Users/O'Name/a b.json"))

    def test_download_checksum_failure_discards_archive(self):
        source = self.base / 'download-source'
        source.write_bytes(b'not the expected bytes')
        target = self.base / 'download'
        with self.assertRaisesRegex(ValueError, 'checksum'):
            verified_download(source.as_uri(), target, '0' * 64)
        self.assertFalse(target.exists())

    def test_guard_terminates_child_when_parent_dies(self):
        # Adopt the orphan so the test can reap it and distinguish zombies from live processes.
        libc = ctypes.CDLL(None)
        self.assertEqual(libc.prctl(36, 1, 0, 0, 0), 0)  # PR_SET_CHILD_SUBREAPER
        filename = self.base / 'child.pid'
        parent_code = '''import subprocess,sys,time
child_code="import time;open("+repr(sys.argv[2]+'.ready')+",'w').write('ready');time.sleep(60)"
p=subprocess.Popen([sys.executable,sys.argv[1],str(__import__('os').getpid()),sys.executable,'-c',child_code])
open(sys.argv[2],'w').write(str(p.pid))
time.sleep(60)
'''
        parent = subprocess.Popen([sys.executable, '-c', parent_code, str(APP / 'launcher/process_guard.py'), str(filename)])
        child = None
        try:
            wait_for(filename.exists)
            child = int(filename.read_text())
            # Wait until exec completes to test death after, not before, guard setup.
            wait_for(lambda: Path(str(filename) + '.ready').exists())
            parent.kill()
            parent.wait(timeout=3)
            result = []
            def reaped():
                pid, status = os.waitpid(child, os.WNOHANG)
                if pid:
                    result.append(status)
                return bool(pid)
            wait_for(reaped)
            self.assertTrue(os.WIFSIGNALED(result[0]))
            self.assertEqual(os.WTERMSIG(result[0]), signal.SIGTERM)
        finally:
            if parent.poll() is None:
                parent.kill(); parent.wait()
            if child:
                try:
                    os.kill(child, signal.SIGKILL)
                    os.waitpid(child, 0)
                except (ProcessLookupError, ChildProcessError):
                    pass


if __name__ == '__main__':
    unittest.main(verbosity=2)
