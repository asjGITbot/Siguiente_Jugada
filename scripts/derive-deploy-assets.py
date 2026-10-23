"""Derive replaceable PWA image assets from three authorized SSR11 sources."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]/'dist'
assets=json.loads((root/'config/assets-manifest.json').read_text(encoding='utf8'))['assets']
sources={'logo':root/'public/assets/sources/ssr11-logo.webp','character':root/'public/assets/sources/character.webp','ball':root/'public/assets/sources/ball.webp'}
for name,path in sources.items():
    if not path.is_file():raise SystemExit(f'MISSING_SOURCE_IMAGE: {name}')
for item in assets:
    output=root/item['path']
    if output.is_file():continue
    output.parent.mkdir(parents=True,exist_ok=True)
    name=item['id']
    if name.startswith('logo'):kind='logo'
    elif name.startswith('character'):kind='character'
    elif name.startswith('ball'):kind='ball'
    else:kind='logo'
    src=Image.open(sources[kind]).convert('RGBA')
    w,h=item['intrinsicWidth'],item['intrinsicHeight']
    if (output.suffix.lower()=='.png' and 'icon' in output.name) or 'apple-touch' in output.name:
        canvas=Image.new('RGBA',(w,h),'#08121f')
        margin=round(min(w,h)*(.20 if 'maskable' in output.name else .12))
    else:
        canvas=Image.new('RGBA',(w,h),(0,0,0,0))
        margin=0
    src.thumbnail((max(1,w-2*margin),max(1,h-2*margin)),Image.Resampling.LANCZOS)
    canvas.alpha_composite(src,((w-src.width)//2,(h-src.height)//2))
    if output.suffix.lower()=='.png':canvas.save(output,'PNG',optimize=True)
    elif output.suffix.lower()=='.webp':canvas.save(output,'WEBP',quality=80,method=6)
    else:raise SystemExit(f'BAD_ASSET_EXTENSION: {output}')
    print(f'ASSET_DERIVED {output.relative_to(root)}')
