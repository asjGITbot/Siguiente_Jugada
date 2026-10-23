"""Explicit deployment allowlist. No private DB, responses, XLSX or secrets."""
import json, shutil, re, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'dist'
if TARGET.exists(): shutil.rmtree(TARGET)
TARGET.mkdir()
for name in ('index.html','manifest.webmanifest','service-worker.js','admin/index.html','account/index.html'):
    src=ROOT/name
    if not src.is_file(): raise SystemExit(f'MISSING_REQUIRED {name}')
    dst=TARGET/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
for name in ('js','css','config','vendor','public/assets'):
    if not (ROOT/name).is_dir(): raise SystemExit(f'MISSING_REQUIRED {name}')
    shutil.copytree(ROOT/name,TARGET/name)
config={'GOOGLE_SHEETS_URL':'','API_BASE_URL':'','locale':'es-PE','timeZone':'America/Lima','AUTH_MODE':'CLOUDFLARE_D1','DATA_MODE':'GOOGLE_SHEETS'}
dst=TARGET/'public/config/data-source.json';dst.parent.mkdir(parents=True,exist_ok=True)
dst.write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
subprocess.run([sys.executable,str(ROOT/'scripts/derive-deploy-assets.py')],check=True)
for path in TARGET.rglob('*'):
    if path.is_file() and (path.suffix.lower() in ('.xlsx','.xls','.csv','.db','.sqlite','.sqlite3','.pem','.key','.pdf','.log','.py','.env') or path.name.startswith('.env')):
        raise SystemExit(f'PROHIBITED_FILE {path.relative_to(TARGET)}')
if any((TARGET/p).exists() for p in ('private','server','tests','docs','.env')):raise SystemExit('PROHIBITED_DIRECTORY')
source=(TARGET/'service-worker.js').read_text(encoding='utf8').split('const FILES=',1)[1].split(';',1)[0]
for name in re.findall(r"'([^']+)'",source):
    if name!='./' and not (TARGET/name).is_file():raise SystemExit(f'MISSING_PWA_ASSET {name}')
manifest=json.loads((TARGET/'config/assets-manifest.json').read_text(encoding='utf8'))
for asset in manifest['assets']:
    if not (TARGET/asset['path']).is_file():raise SystemExit(f'MISSING_BRAND_ASSET {asset["id"]}')
print('BUILD_PASS files='+str(sum(f.is_file() for f in TARGET.rglob('*'))))
