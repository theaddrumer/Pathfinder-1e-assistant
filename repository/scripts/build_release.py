"""Build only reviewed source and pinned dependencies; never package a live workspace."""
from pathlib import Path
import hashlib, json, os, tempfile, zipfile

ROOT=Path(__file__).resolve().parents[1]
ASSETS=['pathfinder-ubuntu-v3.51.0-github.1.zip','pathfinder-desktop-v1.5.0-beta.1-EXPERIMENTAL.zip']

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def atomic_zip(target,files):
    fd,temp=tempfile.mkstemp(prefix='.'+target.name,dir=target.parent)
    try:
        with os.fdopen(fd,'wb') as out:
            with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
                for name,p in sorted(files.items()):
                    if p.is_symlink() or not p.is_file():raise ValueError('Missing/unsafe source: '+str(p))
                    z.write(p,name)
            out.flush();os.fsync(out.fileno())
        os.replace(temp,target)
    finally:
        Path(temp).unlink(missing_ok=True)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert set(z.namelist())==set(files)
        for name,p in files.items():assert hashlib.sha256(z.read(name)).hexdigest()==digest(p),name

def main():
    sources=json.loads((ROOT/'scripts/source-files.json').read_text())
    for name in sources:
        p=Path(name)
        if p.is_absolute() or '..' in p.parts:raise ValueError('Unsafe source path')
        if any(x in p.parts for x in ['node_modules','.git','private','saves','sessions']):raise ValueError('Forbidden source')
        if p.name in ['.env','settings.json','encounter.json','.app.json']:raise ValueError('Private file')
        if not (ROOT/p).is_file() or (ROOT/p).is_symlink():raise ValueError('Missing/unsafe '+name)
    dependencies=json.loads((ROOT/'scripts/dependency-files.json').read_text())
    for name,expected in dependencies.items():
        p=ROOT/'engine'/name
        if p.is_symlink() or not p.is_file() or digest(p)!=expected:
            raise ValueError('Dependency absent/changed: '+name+'; use the pinned npm ci install and review changes')
    assert 'node_modules/ajv/dist/runtime/validation_error.js' in dependencies
    common={n:ROOT/n for n in ['LICENSE_STATUS.md','THIRD_PARTY_NOTICES.md']}
    ubuntu={n[len('engine/'):]:ROOT/n for n in sources if n.startswith('engine/')}
    ubuntu.update({n:ROOT/'engine'/n for n in dependencies});ubuntu.update(common)
    # Share the calculator source, but leave Ubuntu installation machinery out of desktop.
    desktop={'runtime/'+n:p for n,p in ubuntu.items() if not n.startswith('launcher/') and n not in ['plugin.json','mcp.json','START_HERE_WINDOWS.txt','configure_plugin.mjs']}
    for n in sources:
        if n.startswith('desktop/'):desktop[n[len('desktop/'):]]=ROOT/n
    desktop.update(common)
    desktop['SHA256SUMS.json']=None
    with tempfile.TemporaryDirectory() as temp:
        hashes=Path(temp)/'SHA256SUMS.json'
        hashes.write_text(json.dumps({n:digest(p) for n,p in desktop.items() if p is not None},indent=2)+'\n')
        desktop['SHA256SUMS.json']=hashes
        out=ROOT/'dist';out.mkdir(exist_ok=True)
        atomic_zip(out/ASSETS[0],ubuntu);atomic_zip(out/ASSETS[1],desktop)
    (out/'SHA256SUMS.txt').write_text(''.join(digest(out/n)+'  '+n+'\n' for n in ASSETS))
    for n in ASSETS:print(n,(out/n).stat().st_size,'bytes')

if __name__=='__main__':main()
