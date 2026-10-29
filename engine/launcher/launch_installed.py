#!/usr/bin/env python3
"""Stable shortcut target. Select the installed release from non-secret settings."""
import json
import os
from pathlib import Path


def selected_launcher(home):
    config = json.loads((home / '.config/pathfinder-assistant/settings.json').read_text())
    app = Path(config['app_dir']).resolve()
    releases = (home / '.local/share/pathfinder-assistant/releases').resolve()
    if app.parent != releases:
        raise ValueError('Configured application is outside the installed releases directory')
    target = app / 'launcher/ubuntu_launcher.py'
    if not target.is_file():
        raise FileNotFoundError('Installed launcher missing; reinstall the complete package')
    return target


if __name__ == '__main__':
    os.execv('/usr/bin/python3', ['/usr/bin/python3', str(selected_launcher(Path.home()))])
