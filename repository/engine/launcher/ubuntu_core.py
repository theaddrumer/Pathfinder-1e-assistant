"""Local process/settings owner for the WSL GUI; no game mechanics or remote controls."""
import fcntl
import json
import os
from pathlib import Path
import queue
import re
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time

FIELDS = ('app_dir', 'node', 'tunnel', 'state_path', 'tunnel_id', 'organization_id')
CONFIG_DIR = Path.home() / '.config/pathfinder-assistant'


def atomic_json(filename, data):
    filename = Path(filename)
    filename.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix='.settings-', dir=filename.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, filename)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load_settings(filename):
    if not Path(filename).exists():
        return {field: '' for field in FIELDS}
    raw = json.loads(Path(filename).read_text())
    if not isinstance(raw, dict):
        raise ValueError('Launcher settings are invalid. Restore settings.json or move it aside.')
    return {field: str(raw.get(field, '')) for field in FIELDS}


def save_settings(filename, config):
    # Explicit allowlist: a key passed alongside config can never be persisted.
    atomic_json(filename, {field: str(config.get(field, '')) for field in FIELDS})


class InstanceLock:
    def __init__(self, filename):
        Path(filename).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.stream = open(filename, 'a+')
        try:
            fcntl.flock(self.stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.stream.close()
            raise RuntimeError('Pathfinder Assistant is already open. Switch to its existing window.')

    def close(self):
        self.stream.close()


class Redactor:
    def __init__(self):
        self.secrets = set()

    def add(self, value):
        if value:
            self.secrets.add(value)

    def clean(self, value):
        text = str(value)
        for secret in sorted(self.secrets, key=len, reverse=True):
            text = text.replace(secret, '[REDACTED]')
        text = re.sub(r'sk-[A-Za-z0-9_\-]+', '[REDACTED]', text)
        text = re.sub(r'(?i)(Bearer\s+)\S+', r'\1[REDACTED]', text)
        # Avoid terminal escape sequences in copied diagnostics.
        text = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', text)
        return text[:2500]


def child_environment():
    prefixes = ('CONTROL_PLANE_', 'MCP_', 'HARPOON_', 'HEALTH_', 'LOG_',
                'TUNNEL_CLIENT_', 'TABLETOP_', 'NODE_', 'OPENAI_')
    return {k: v for k, v in os.environ.items()
            if not k.startswith(prefixes) and k not in ('CA_BUNDLE', 'LD_PRELOAD')}


def validate(config, key, require_existing=True):
    if not re.fullmatch(r'tunnel_[a-z0-9]{32}', config.get('tunnel_id', '')):
        raise ValueError('Enter the tunnel ID beginning tunnel_ followed by 32 lowercase letters/digits.')
    if not key.startswith('sk-') or not 30 <= len(key) <= 512 or re.search(r'\s', key) or '...' in key:
        raise ValueError('Enter the complete API secret key beginning sk-. The Tracking ID and masked sk-... value will not work.')
    if config.get('organization_id') and not re.fullmatch(r'[A-Za-z0-9_-]{1,160}', config['organization_id']):
        raise ValueError('The optional organization ID contains invalid characters.')
    for name in ('app_dir', 'node', 'tunnel', 'state_path'):
        value = config.get(name, '')
        if not value or not Path(value).is_absolute() or any(c in value for c in '\x00\r\n'):
            raise ValueError(f'{name}: choose an absolute Ubuntu path (Windows drives are under /mnt/c).')
    app = Path(config['app_dir'])
    if not (app / 'mcp_server.mjs').is_file() or not (app / 'launcher/launcher_host.mjs').is_file():
        raise ValueError('The calculator folder must contain mcp_server.mjs and launcher/launcher_host.mjs.')
    for field in ('node', 'tunnel'):
        p = Path(config[field])
        if not p.is_file() or not os.access(p, os.X_OK):
            raise ValueError(f'The {field} program is missing or not executable.')
        with p.open('rb') as stream:
            if stream.read(4) != b'\x7fELF':
                raise ValueError(f'The {field} program must be a Linux executable. Do not select a Windows .exe or this launcher.')
    state = Path(config['state_path'])
    if require_existing and not state.is_file():
        raise ValueError('The encounter save was not found. Choose your existing encounter.json, or explicitly select New empty encounter.')
    if state.exists():
        if not state.is_file() or state.stat().st_size > 64 * 1024 * 1024:
            raise ValueError('The selected encounter is not a supported save file.')
        # The engine validates its full schema; never rewrite a save here.
        json.loads(state.read_text())
    if Path(config['node']).resolve() == Path(config['tunnel']).resolve():
        raise ValueError('Node and the tunnel client must be different programs.')
    version = subprocess.run([config['node'], '--version'], capture_output=True, text=True,
                             env=child_environment(), timeout=8, check=True).stdout.strip()
    match = re.fullmatch(r'v(\d+)\.(\d+)\.(\d+)', version)
    if not match or tuple(map(int, match.groups())) < (22, 12, 0):
        raise ValueError('Use Linux Node 22.12 or newer.')
    result = subprocess.run([config['tunnel'], '--version'], capture_output=True, text=True,
                            env=child_environment(), timeout=8, check=True)
    if 'flavor=runtime' not in result.stdout or 'cloudflared' in result.stdout:
        raise ValueError('Choose the official plain tunnel-client-runtime Linux build used in our connection test.')


def check_port(port):
    with socket.socket() as sock:
        # Match Node's listener behavior: recently closed connections in TIME_WAIT
        # must not make Stop -> Start look like another running server.
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('127.0.0.1', port))
            sock.listen(1)
        except OSError:
            raise RuntimeError(f'Port {port} is in use. Stop the old calculator in its Ubuntu window with Ctrl+C, then retry. This launcher will not stop another process.')


class ProcessSpawner:
    """Keep the Linux creating thread alive for the lifetime of its children.

    PR_SET_PDEATHSIG follows the creating *thread*, so a short-lived GUI worker
    must never be the direct Popen owner.
    """
    def __init__(self):
        self.requests = queue.Queue()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        while True:
            request = self.requests.get()
            if request is None:
                return
            args, kwargs, answer = request
            try:
                answer.put((subprocess.Popen(*args, **kwargs), None))
            except Exception as exc:
                answer.put((None, exc))

    def spawn(self, *args, **kwargs):
        if not self.thread.is_alive():
            raise RuntimeError('The launcher process owner has closed.')
        answer = queue.Queue(maxsize=1)
        self.requests.put((args, kwargs, answer))
        proc, error = answer.get()
        if error:
            raise error
        return proc

    def close(self):
        self.requests.put(None)
        self.thread.join(timeout=2)


class Controller:
    def __init__(self, engine_port=8787, player_port=8788):
        self.engine_port = engine_port
        self.player_port = player_port
        self.events = queue.Queue()
        self.redactor = Redactor()
        self.lifecycle = threading.Lock()
        self.spawner = ProcessSpawner()
        self.guard = Path(__file__).with_name('process_guard.py')
        self.engine = None
        self.tunnel = None
        self.stopping = False
        self.state = 'Stopped'
        self.key = ''
        self.config = None

    def emit(self, kind, message):
        item = (kind, self.redactor.clean(message))
        # Bound diagnostic traffic without ever dropping operation-completion events.
        if kind == 'log' and self.events.qsize() >= 300:
            return
        self.events.put_nowait(item)

    def status(self, text):
        if text == self.state:
            return
        self.state = text
        self.emit('status', text)

    def _spawn(self, name, command, env, cwd, ready=None):
        proc = self.spawner.spawn([sys.executable, str(self.guard), str(os.getpid()), *command],
                                cwd=cwd, env=env, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                start_new_session=True)
        if name == 'Calculator':
            self.engine = proc
        else:
            self.tunnel = proc
        def consume():
            pending = b''
            discarding = False
            while True:
                data = proc.stdout.read1(4096)
                if not data:
                    break
                for piece in data.splitlines(keepends=True):
                    ended = piece.endswith(b'\n')
                    if not discarding:
                        pending += piece
                        if len(pending) > 16384:
                            pending = b''
                            discarding = True
                            self.emit('log', f'{name}: overlong diagnostic line omitted')
                    if ended:
                        if not discarding:
                            self._line(name, proc, pending.decode(errors='replace').rstrip(), ready)
                        pending = b''
                        discarding = False
            if pending and not discarding:
                self._line(name, proc, pending.decode(errors='replace'), ready)
            proc.stdout.close()
            code = proc.wait()
            self.emit('log', f'{name} exited (code {code}).')
            if not self.stopping:
                if name == 'Tunnel' and proc is self.tunnel:
                    self.status('Tunnel stopped — local map still available. Press Reconnect tunnel.')
                elif name == 'Calculator' and proc is self.engine:
                    self.status('Calculator stopped. Press Stop, then Start to recover.')
                    threading.Thread(target=self.stop, daemon=True).start()
        threading.Thread(target=consume, daemon=True).start()
        return proc

    def _line(self, name, proc, line, ready):
        self.emit('log', f'{name}: {line}')
        if ready and line == 'TABLETOP_LAUNCHER_READY':
            ready.set()
        if name == 'Tunnel' and proc is self.tunnel and not self.stopping:
            if re.search(r'\b401\b|Unauthorized', line, re.I):
                self.status('Authentication rejected. Enter the full API secret key, then Reconnect tunnel.')
            elif re.search(r'\b403\b|Forbidden', line, re.I):
                self.status('Tunnel permission rejected. Check organization and Tunnels Read + Use access.')
            elif 'tunnel metadata fetched' in line and 'rejected' not in self.state.lower():
                self.status('Tunnel registered — ready for a ChatGPT connection check')
            elif 'ERROR' in line and 'rejected' not in self.state.lower():
                self.status('Tunnel reported a problem — see Troubleshooting')

    def _launch_tunnel(self, config, key):
        env = child_environment()
        env.update(CONTROL_PLANE_API_KEY=key, CONTROL_PLANE_TUNNEL_ID=config['tunnel_id'])
        if config.get('organization_id'):
            env['CONTROL_PLANE_ORGANIZATION_ID'] = config['organization_id']
        self.status('Calculator running — connecting tunnel…')
        self.tunnel = self._spawn('Tunnel', [config['tunnel'], 'run', '--mcp.server-url',
                                  f'url=http://127.0.0.1:{self.engine_port}/mcp',
                                  '--health.listen-addr', '127.0.0.1:0', '--log.level', 'info'],
                                 env, config['app_dir'])
        time.sleep(0.3)
        if self.tunnel.poll() is not None:
            self.status('Tunnel could not stay running — local map is available. See Troubleshooting.')

    def start(self, config, key, require_existing=True):
        with self.lifecycle:
            if self.engine and self.engine.poll() is None:
                raise RuntimeError('The calculator is already running. Use Reconnect tunnel or Stop.')
            self.redactor.add(key)
            validate(config, key, require_existing)
            check_port(self.engine_port)
            check_port(self.player_port)
            self.config = dict(config)
            self.key = key
            self.stopping = False
            self.status('Starting calculator…')
            env = child_environment()
            env.update(TABLETOP_STATE_PATH=config['state_path'], TABLETOP_HOST='127.0.0.1',
                       TABLETOP_PORT=str(self.engine_port), TABLETOP_PLAYER_PORT=str(self.player_port))
            ready = threading.Event()
            self.engine = self._spawn('Calculator', [config['node'], 'launcher/launcher_host.mjs'],
                                      env, config['app_dir'], ready)
            try:
                deadline = time.monotonic() + 20
                while not ready.wait(0.05):
                    if self.engine.poll() is not None:
                        raise RuntimeError('Calculator startup failed. See Troubleshooting; the save has not been replaced by a new encounter.')
                    if time.monotonic() > deadline:
                        raise RuntimeError('Calculator startup timed out. See Troubleshooting.')
                self._launch_tunnel(config, key)
            except Exception:
                self._stop_locked()
                raise

    def reconnect(self, config, key):
        with self.lifecycle:
            self.redactor.add(key)
            if not self.engine or self.engine.poll() is not None:
                raise RuntimeError('Start the calculator first.')
            validate(config, key)
            for field in ('app_dir', 'node', 'state_path'):
                if config[field] != self.config[field]:
                    raise ValueError('Stop and Start to change calculator or encounter locations.')
            self.stopping = True
            self._terminate(self.tunnel)
            self.stopping = False
            self.key = key
            self.config = dict(config)
            self._launch_tunnel(config, key)

    @staticmethod
    def _terminate(proc, graceful=False):
        if not proc:
            return
        if proc.poll() is None:
            if graceful:
                try:
                    proc.stdin.write(b'shutdown\n')
                    proc.stdin.flush()
                except (BrokenPipeError, OSError):
                    pass
            else:
                try:
                    os.killpg(proc.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            try:
                proc.wait(timeout=9 if graceful else 4)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                proc.wait(timeout=3)
        if proc.stdin and not proc.stdin.closed:
            proc.stdin.close()

    def _stop_locked(self):
        self.stopping = True
        self.status('Stopping…')
        self._terminate(self.tunnel)
        self._terminate(self.engine, graceful=True)
        self.tunnel = self.engine = None
        self.key = ''
        self.status('Stopped — encounter saved')

    def stop(self):
        with self.lifecycle:
            self._stop_locked()

    def close(self):
        self.stop()
        self.spawner.close()


def open_player_map(port=8788, route='player'):
    if route not in ('player', 'artwork'):
        raise ValueError('Unknown local page')
    # Only a fixed local URL goes to Windows; credentials never cross argv.
    executable = Path('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
    if not executable.is_file():
        raise RuntimeError(f'Open http://127.0.0.1:{port}/{route} in Firefox.')
    result = subprocess.run([str(executable), '-NoProfile', '-NonInteractive', '-Command',
                             f"Start-Process 'http://127.0.0.1:{int(port)}/{route}'"],
                            cwd='/mnt/c/Windows', capture_output=True, timeout=12)
    if result.returncode:
        raise RuntimeError(f'Windows could not open the browser. Open http://127.0.0.1:{port}/{route} in Firefox.')
