// Offline shell only. Cache same-origin static assets, NEVER cache API/auth requests.
const CACHE='home-thames-shell-v2-6';
const ASSETS=['./','./index.html','./src/app.js','./src/cloud.js','./src/demo.js','./src/icons.js','./src/energy.js','./src/history.css','./src/styles.css','./src/light.css','./src/premium.css','./src/icon-theme.css','./config.js','./manifest.webmanifest','./icon.svg'];
// Main UI icons are embedded in src/icons.js; no individual PNG fetches are required.

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(async keys=>{for(const k of keys)if(k!==CACHE)await caches.delete(k)}).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 // Network-first avoids stale JS and stale Cloud config after GitHub Pages deployments.
 e.respondWith(fetch(e.request).then(async response=>{
   if(response.ok){const c=await caches.open(CACHE);await c.put(e.request,response.clone())}
   return response;
 }).catch(async()=>await caches.match(e.request)|| (e.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));
});
