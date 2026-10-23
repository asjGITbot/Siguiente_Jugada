const CACHE='ssr11-shell-v2-accounts';
// Explicit allowlist only. No request to the data API, login, source URL, docs or fixtures is cached.
const FILES=['./','index.html','manifest.webmanifest','css/tokens.css','css/accounts.css','js/account-api.js','css/layout.css','css/components.css','css/responsive.css','vendor/chart.umd.min.js','js/main.js','js/auth.js','js/data-loader.js','js/data-normalizer.js','js/data-validator.js','js/metrics-engine.js','js/chart-engine.js','js/gamification-engine.js','js/missions-engine.js','js/messages-engine.js','js/assets-loader.js','js/router.js','js/components/ui.js','js/screens/views.js','config/form-v04.schema.json','config/charts.json','config/gamification.json','config/mission-rules.json','config/messages.json','config/ui.json','config/assets-manifest.json','public/assets/brand/logo-ssr11-240x160.webp','public/assets/brand/logo-ssr11-360x240.webp','public/assets/icons/balon-oficial-96x96.webp','public/assets/icons/balon-oficial-192x192.webp','public/assets/pwa/icon-192.png','public/assets/pwa/icon-512.png','public/assets/pwa/icon-maskable-512.png','public/assets/pwa/apple-touch-icon-180.png'];
const allowed=new Set(FILES.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ssr11-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||!allowed.has(req.url))return;
  event.respondWith(fetch(req).catch(()=>caches.match(req)));
});
