import {esc} from './components/ui.js';
export function imageAsset(manifest,id,css='') {
  const asset=manifest.assets.find(a=>a.id===id);if(!asset)return '';
  const bigger=manifest.assets.find(a=>a.id===id+'Large');
  return `<img src="${esc(asset.path)}" ${bigger?`srcset="${esc(asset.path)} ${asset.intrinsicWidth}w, ${esc(bigger.path)} ${bigger.intrinsicWidth}w" sizes="${asset.renderWidth}px"`:''} width="${asset.intrinsicWidth}" height="${asset.intrinsicHeight}" alt="${esc(asset.alt)}" class="${esc(css)}" loading="${id==='logo'?'eager':'lazy'}">`;
}
