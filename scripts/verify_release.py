"""Verify built assets in disposable directories, without live keys or saves."""
from pathlib import Path
import hashlib, json, os, subprocess, tempfile, zipfile

ROOT=Path(__file__).resolve().parents[1]
env={k:v for k,v in os.environ.items() if not k.startswith(('TABLETOP_','CONTROL_PLANE_','OPENAI_','MCP_')) and k not in ['NODE_OPTIONS','NODE_PATH']}

def run(args,cwd):
    p=subprocess.run(args,cwd=cwd,env=env,text=True,capture_output=True,timeout=90)
    if p.returncode:raise RuntimeError('FAILED '+' '.join(args)+'\n'+p.stdout+p.stderr)
    print('PASS '+' '.join(str(x) for x in args),flush=True)
    print((p.stdout+p.stderr).strip(),flush=True)

def main():
    dependencies=json.loads((ROOT/'scripts/dependency-files.json').read_text())
    for name,prefix in [('pathfinder-ubuntu-v3.51.0-github.1.zip',''),('pathfinder-desktop-v1.5.0-beta.1-EXPERIMENTAL.zip','runtime/')]:
        with tempfile.TemporaryDirectory(prefix='pf-package-') as temp:
            with zipfile.ZipFile(ROOT/'dist'/name) as z:
                assert z.testzip() is None
                for rel,sha in dependencies.items():assert hashlib.sha256(z.read(prefix+rel)).hexdigest()==sha,rel
                assert not any(Path(n).name in ['.app.json','.env','encounter.json','settings.json'] for n in z.namelist())
                z.extractall(temp)
            root=Path(temp)/prefix
            assert json.loads((root/'package.json').read_text())['version']=='3.51.0'
            if not prefix:
                for test in ['integration_tests.mjs','transport_tests.mjs','session_compatibility_tests.mjs','artwork_resolution_tests.mjs','player_transport_tests.mjs']:
                    run(['node',test],root)
                run(['python3','launcher/test_ubuntu_launcher.py'],root)
            else:run(['node',str(ROOT/'scripts/desktop_smoke.mjs'),str(root)],ROOT)
            print('PASS extracted archive '+name,flush=True)

if __name__=='__main__':main()
