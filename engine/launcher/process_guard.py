"""Ensure our directly owned Linux child receives SIGTERM if the GUI dies."""
import ctypes
import os
import signal
import sys

parent = int(sys.argv[1])
libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(1, signal.SIGTERM, 0, 0, 0) != 0:  # PR_SET_PDEATHSIG
    raise OSError(ctypes.get_errno(), 'Cannot establish launcher process ownership')
if os.getppid() != parent:
    sys.exit(1)
os.execvpe(sys.argv[2], sys.argv[2:], os.environ)
