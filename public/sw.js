/* Cache somente do aplicativo estático; nenhum dado sensível é transmitido. */
const CACHE='agrovelyx-v2-ui-211';
const CORE=['./','./index.html','./styles.css','./app.js','./agrovelyx-brand-login.png','./stratechne-st.png','./login-pig-background.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok&&new URL(e.request.url).pathname.match(/\.(?:js|css|png|html)$/))caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
