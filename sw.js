// Deliberately stores no authenticated pages, API responses or ballots.
const CACHE='flyworks-offline-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.add(new Request('./offline.html',{cache:'reload'})))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('flyworks-offline-')&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),base=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
  const path=url.pathname.slice(base.pathname.length);
  if(path.startsWith('api/')||path.startsWith('oauth/'))return;
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('./offline.html')));
});
