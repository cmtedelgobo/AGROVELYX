/* Cache somente arquivos públicos. APIs nunca são armazenadas. */
const CACHE='agrovelyx-v23-ui-20261111';
const CORE=['./','./index.html','./styles.css','./app.js','./upgrade.js','./v23.js','./agrovelyx-brand-login.png','./stratechne-st.png','./login-pig-background.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;
 e.respondWith(fetch(e.request).then(r=>{
   if(r.ok&&/\.(js|css|png|html)$/.test(u.pathname)){
      const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
   }
   return r;
 }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
