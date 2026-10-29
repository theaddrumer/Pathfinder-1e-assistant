#!/usr/bin/env bash
set -euo pipefail
umask 077
pf_source_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "$(id -u)" == 0 ]]; then
  printf '%s\n' 'Run this installer as your normal Ubuntu user, without sudo. It requests sudo only for Ubuntu packages.'
  exit 1
fi
if ! /usr/bin/python3 -c 'import tkinter' >/dev/null 2>&1; then
  printf '%s\n' 'Installing Ubuntu window support. Enter your Ubuntu password if asked.'
  sudo apt-get update
  sudo apt-get install -y python3-tk
fi
/usr/bin/python3 "$pf_source_root/launcher/install_ubuntu.py" "$pf_source_root"
