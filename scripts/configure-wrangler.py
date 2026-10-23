"""Inject D1 identifier as an untracked config for deployment."""
import os,re
from pathlib import Path
value=os.environ.get('D1_DATABASE_ID','')
if not re.fullmatch(r'[0-9a-fA-F-]{36}',value):
    raise SystemExit('MISSING_D1_DATABASE_ID: Set this in GitHub Actions secrets')
path=Path(__file__).resolve().parents[1]/'api/cloudflare-worker/wrangler.jsonc'
source=path.read_text()
if source.count('SET_D1_DATABASE_ID_BEFORE_DEPLOYMENT')!=1:
    raise SystemExit('WRANGLER_TEMPLATE_CHANGED')
path.write_text(source.replace('SET_D1_DATABASE_ID_BEFORE_DEPLOYMENT',value))
print('WRANGLER_CONFIGURED')
