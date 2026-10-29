#!/usr/bin/env python3
"""Install a private WSL copy and a WSLg Start-menu entry. No API secrets needed."""
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import uuid
import zipfile
from windows_shortcuts import create_windows_shortcuts

from ubuntu_core import CONFIG_DIR, InstanceLock, atomic_json, load_settings, save_settings

NODE_VERSION = '24.22.0'
NODE_SHA = 'cc2f601cee82d9a5a233302fe307abc600727035fd7d2c3a3571755989e95008'
TUNNEL_VERSION = '0.0.17'
TUNNEL_SHA = '08e6f9a36be2026847256c682f3593f8b7e4edbaae5931a941c058642b226186'


def verified_download(url, destination, digest):
    print('Downloading ' + url.rsplit('/', 1)[-1], flush=True)
    checksum = hashlib.sha256()
    size = 0
    try:
        with urllib.request.urlopen(url, timeout=90) as response, open(destination, 'wb') as output:
            while block := response.read(1024 * 1024):
                size += len(block)
                if size > 150 * 1024 * 1024:
                    raise ValueError('Download exceeds expected size.')
                checksum.update(block)
                output.write(block)
        if checksum.hexdigest() != digest:
            raise ValueError('Download checksum mismatch. Nothing from this archive will be executed.')
    except Exception:
        Path(destination).unlink(missing_ok=True)
        raise


def linux_program(path, expected):
    try:
        with Path(path).open('rb') as stream:
            if stream.read(4) != b'\x7fELF':
                return False
        result = subprocess.run([str(path), '--version'], capture_output=True, text=True, timeout=8)
        return result.returncode == 0 and expected in result.stdout
    except (OSError, subprocess.SubprocessError):
        return False


def ensure_runtimes(base, home):
    node = home / f'pathfinder-tunnel/node-v{NODE_VERSION}-linux-x64/bin/node'
    tunnel = home / 'pathfinder-tunnel/tunnel-client-runtime'
    runtimes = base / 'runtime'
    runtimes.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not linux_program(node, 'v' + NODE_VERSION):
        node = runtimes / f'node-v{NODE_VERSION}'
        if not linux_program(node, 'v' + NODE_VERSION):
            with tempfile.TemporaryDirectory(dir=runtimes) as tmp:
                archive = Path(tmp) / 'node.tar.xz'
                verified_download(f'https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-linux-x64.tar.xz', archive, NODE_SHA)
                with tarfile.open(archive) as tar:
                    member = tar.getmember(f'node-v{NODE_VERSION}-linux-x64/bin/node')
                    if not member.isfile():
                        raise ValueError('Expected Node binary missing from verified archive.')
                    output = Path(tmp) / 'node'
                    with tar.extractfile(member) as source, output.open('wb') as target:
                        shutil.copyfileobj(source, target)
                    output.chmod(0o700)
                    # Extract license/provenance too, not arbitrary archive paths.
                    (runtimes / 'NODE_LICENSE').write_bytes(tar.extractfile(f'node-v{NODE_VERSION}-linux-x64/LICENSE').read())
                    os.replace(output, node)
    if not linux_program(tunnel, 'flavor=runtime') or linux_program(tunnel, 'cloudflared'):
        tunnel = runtimes / f'tunnel-client-runtime-v{TUNNEL_VERSION}'
        if not linux_program(tunnel, 'flavor=runtime'):
            with tempfile.TemporaryDirectory(dir=runtimes) as tmp:
                archive = Path(tmp) / 'tunnel.zip'
                verified_download(f'https://github.com/openai/tunnel-client/releases/download/v{TUNNEL_VERSION}/tunnel-client-runtime-v{TUNNEL_VERSION}-linux-amd64.zip', archive, TUNNEL_SHA)
                with zipfile.ZipFile(archive) as zipped:
                    output = Path(tmp) / 'tunnel-client-runtime'
                    output.write_bytes(zipped.read('tunnel-client-runtime'))
                    output.chmod(0o700)
                    for name in ('LICENSE', 'NOTICE'):
                        (runtimes / ('TUNNEL_' + name)).write_bytes(zipped.read(name))
                    os.replace(output, tunnel)
    atomic_json(runtimes / 'PROVENANCE.json', {
        'node': {'version': NODE_VERSION, 'archive_sha256': NODE_SHA, 'path': str(node)},
        'tunnel': {'version': TUNNEL_VERSION, 'archive_sha256': TUNNEL_SHA, 'path': str(tunnel)},
        'note': 'Existing tested executables are reused when present; hashes above describe official pinned downloads.'})
    return node, tunnel


def windows_environment(name):
    if name not in ('USERPROFILE', 'LOCALAPPDATA'):
        raise ValueError('Unsupported Windows variable')
    cmd = Path('/mnt/c/Windows/System32/cmd.exe')
    if not cmd.is_file():
        return None
    try:
        result = subprocess.run([str(cmd), '/d', '/c', 'echo', '%' + name + '%'],
                                cwd='/mnt/c/Windows', capture_output=True, text=True, timeout=10)
        value = result.stdout.strip()
        if result.returncode or not re.match(r'^[A-Za-z]:\\', value):
            return None
        return windows_path(value)
    except (OSError, subprocess.SubprocessError):
        return None


def windows_path(value):
    # Only drive-rooted paths; keep whitespace/apostrophes as ordinary path characters.
    if not re.match(r'^[A-Za-z]:[\\/]', value):
        raise ValueError('Expected a drive-rooted Windows path')
    return Path('/mnt') / value[0].lower() / value[3:].replace('\\', '/')


def import_windows_settings(profile, local):
    result = {}
    if profile:
        result['state_path'] = str(profile / '.tabletop-kernel/encounter.json')
    if local:
        source = local / 'TabletopKernel/Launcher/settings.json'
        try:
            old = json.loads(source.read_text())
            for old_name, new_name in (('TunnelId', 'tunnel_id'), ('OrganizationId', 'organization_id')):
                if isinstance(old.get(old_name), str):
                    result[new_name] = old[old_name]
            if old.get('StatePath'):
                result['state_path'] = str(windows_path(old['StatePath']))
        except (OSError, ValueError, TypeError):
            pass
        # ProtectedKey is deliberately neither read into output nor decrypted.
    return result


def desktop_arg(value):
    value = str(value)
    if any(char in value for char in '\r\n\x00'):
        raise ValueError('Invalid shortcut path')
    # Desktop Entry spec: quoted arguments, %% for literal percent, then string escaping.
    value = value.replace('%', '%%')
    value = ''.join('\\' + c if c in '\\"`$' else c for c in value)
    return '"' + value.replace('\\', '\\\\') + '"'


def write_desktop(home, app):
    directory = home / '.local/share/applications'
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / 'pathfinder-assistant.desktop'
    content = '\n'.join([
        '[Desktop Entry]', 'Type=Application', 'Name=Pathfinder Assistant',
        'Comment=Local Pathfinder calculator and OpenAI tunnel',
        'Exec=/usr/bin/python3 ' + desktop_arg(home / '.local/share/pathfinder-assistant/launch.py'),
        'Icon=applications-games', 'Terminal=false', 'Categories=Game;',
        'StartupWMClass=PathfinderAssistant', ''])
    temporary = target.with_suffix('.tmp')
    temporary.write_text(content)
    temporary.chmod(0o644)
    os.replace(temporary, target)
    return target


def install(source, home=None, provision=True, windows=None):
    source = Path(source).resolve()
    home = Path(home) if home is not None else Path.home()
    if not (source / 'mcp_server.mjs').is_file() or not (source / 'node_modules/@modelcontextprotocol/sdk/package.json').is_file():
        raise ValueError('Extract the whole calculator ZIP before running the installer.')
    base = home / '.local/share/pathfinder-assistant'
    settings_path = home / '.config/pathfinder-assistant/settings.json'
    lock = InstanceLock(settings_path.parent / 'launcher.lock')
    try:
        releases = base / 'releases'
        releases.mkdir(parents=True, exist_ok=True, mode=0o700)
        app = releases / ('v3.51.0-' + uuid.uuid4().hex[:10])
        staging = Path(tempfile.mkdtemp(prefix='.install-', dir=releases))
        try:
            def ignored(directory, names):
                excluded = {name for name in names if name == '__pycache__' or name == '.git' or name.endswith('.pyc')}
                if Path(directory) == source:
                    excluded.update({'runtime', 'Tabletop Launcher.exe', 'Tabletop Launcher.exe.config'} & set(names))
                return excluded
            shutil.copytree(source, staging, dirs_exist_ok=True, ignore=ignored)
            os.rename(staging, app)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
        existing = load_settings(settings_path)
        profile, local = windows if windows is not None else (windows_environment('USERPROFILE'), windows_environment('LOCALAPPDATA'))
        imported = import_windows_settings(profile, local)
        config = {field: existing.get(field) or imported.get(field, '') for field in existing}
        config['app_dir'] = str(app)
        if not config['state_path']:
            print('Existing Windows save could not be located. Choose encounter.json in Files & settings before Start.')
        if provision:
            node, tunnel = ensure_runtimes(base, home)
            config['node'], config['tunnel'] = str(node), str(tunnel)
        save_settings(settings_path, config)
        bootstrap = base / 'launch.py'
        temporary = base / '.launch.py.tmp'
        shutil.copyfile(Path(__file__).parent / 'launch_installed.py', temporary)
        temporary.chmod(0o600)
        os.replace(temporary, bootstrap)
        desktop = write_desktop(home, app)
        shortcut_result = create_windows_shortcuts(bootstrap)
        print(shortcut_result['message'], flush=True)
        print('Installed Pathfinder Assistant. Your encounter save was not modified.', flush=True)
        print('Open Pathfinder Assistant from the Windows Start menu (it may appear under Ubuntu).', flush=True)
        return app, desktop
    finally:
        lock.close()


def main():
    if platform.machine() not in ('x86_64', 'amd64'):
        raise RuntimeError('This installer currently supports x64 Ubuntu only.')
    if os.geteuid() == 0:
        raise RuntimeError('Run as your normal Ubuntu user, without sudo.')
    import tkinter as tk
    # Fail before changing installation/settings if WSLg cannot display a window.
    try:
        probe = tk.Tk()
        probe.withdraw()
        probe.destroy()
    except tk.TclError as exc:
        raise RuntimeError('Ubuntu GUI support is unavailable. Check WSL 2 / WSLg before installing the launcher.') from exc
    app, _ = install(sys.argv[1])
    os.execv('/usr/bin/python3', ['/usr/bin/python3', str(app / 'launcher/ubuntu_launcher.py')])


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Installation stopped: ' + str(exc), file=sys.stderr)
        sys.exit(1)
