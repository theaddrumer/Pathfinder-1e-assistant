"""Create ordinary per-user Windows shortcuts through Windows' own COM API.
No elevation, execution-policy changes, key storage, or shell interpolation of paths.
"""
import base64
import json
import os
from pathlib import Path
import pwd
import subprocess

POWERSHELL = Path('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')


def shortcut_arguments(bootstrap, distro, username):
    values = [str(bootstrap), distro, username]
    if any(not v or any(c in v for c in '\r\n\x00') for v in values):
        raise ValueError('Invalid Windows shortcut path, distribution or username')
    return subprocess.list2cmdline(['--distribution', distro, '--user', username,
                                   '--exec', '/usr/bin/python3', str(bootstrap)])


def shortcut_script(arguments):
    # Data is decoded into a string; it is never parsed as PowerShell source.
    data = base64.b64encode(json.dumps({'arguments': arguments}).encode()).decode()
    return """$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$spec = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('""" + data + """')) | ConvertFrom-Json
$shell = New-Object -ComObject WScript.Shell
$destinations = @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('Programs'))
foreach ($directory in $destinations) {
    if ([string]::IsNullOrWhiteSpace($directory)) { throw 'Windows shortcut folder unavailable' }
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $file = Join-Path $directory 'Pathfinder Assistant.lnk'
    $shortcut = $shell.CreateShortcut($file)
    $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\\wsl.exe'
    $shortcut.Arguments = $spec.arguments
    $shortcut.WorkingDirectory = $env:WINDIR
    $shortcut.Description = 'Pathfinder Assistant (Ubuntu)'
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    if (!(Test-Path -LiteralPath $file)) { throw 'Shortcut was not created' }
    Write-Output $file
}
"""


def create_windows_shortcuts(bootstrap):
    distro = os.environ.get('WSL_DISTRO_NAME')
    if not distro or not POWERSHELL.is_file():
        return {'ok': False, 'message': 'Windows integration unavailable. Ubuntu application entry was created.'}
    args = shortcut_arguments(bootstrap, distro, pwd.getpwuid(os.getuid()).pw_name)
    script = shortcut_script(args)
    encoded = base64.b64encode(script.encode('utf-16-le')).decode()
    try:
        result = subprocess.run([str(POWERSHELL), '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
                                cwd='/mnt/c/Windows', capture_output=True, text=True, encoding='utf-8',
                                errors='replace', timeout=20)
        if result.returncode:
            return {'ok': False, 'message': 'Windows could not create both shortcuts. The application is installed; use the manual shortcut instructions in UBUNTU_LAUNCHER_V3_46.md.'}
        return {'ok': True, 'message': 'Windows Desktop and Start-menu shortcuts created.', 'paths': result.stdout.strip().splitlines()}
    except (OSError, subprocess.SubprocessError):
        return {'ok': False, 'message': 'Windows shortcut creation unavailable. Use the manual shortcut instructions in UBUNTU_LAUNCHER_V3_46.md.'}
