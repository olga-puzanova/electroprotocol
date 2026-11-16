const CACHE = 'psgi-v20';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data.js', 'norms.js', 'potee.js', 'extras.js', 'kusty.js', 'manifest.json', 'icon.svg', 'improvements.js', 'repairs.js', 'pdf-export.js', 'ideas.js', 'chat.js', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js', 'vendor/NotoSans-Regular.ttf'];
const MANUAL_FILES = ['manuals/e6-24.pdf','manuals/ptf-1.pdf','manuals/iks-30a.pdf','manuals/kew-6016.pdf','manuals/mpi-530.pdf','manuals/aid-70c.pdf'];
const shellURLs = new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
async function network(request, timeout=12000) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
  try { const response=await fetch(request,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return response; }
  finally {clearTimeout(timer);}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(FILES.map(file=>new Request(new URL(file,self.registration.scope),{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  const cache=await caches.open(CACHE), keys=await caches.keys();
  await Promise.all(MANUAL_FILES.map(async file=>{
    const url=new URL(file,self.registration.scope).href;
    const old=await caches.match(url,{ignoreSearch:true});
    if(old)await cache.put(url,old);
    else try{await cache.put(url,await network(url));}catch{}
  }));
  await Promise.all(keys.filter(key=>key!==CACHE&&/^(electro-v|psgi-v)/.test(key)).map(key=>caches.delete(key)));
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  url.search='';
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(url.href);
    if(event.request.mode==='navigate')return cached||await cache.match(new URL('index.html',self.registration.scope))||network(event.request,3500);
    if(cached)return cached;
    try{const response=await network(event.request);if(shellURLs.has(url.href)||/\/manuals\/[^/]+\.pdf$/.test(url.pathname))await cache.put(url.href,response.clone());return response;}
    catch{return Response.error();}
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=new URL('./#'+(event.notification.data?.hash||''),self.registration.scope).href;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=clients.find(c=>c.url.startsWith(self.registration.scope));
    if(client){await client.navigate(url);return client.focus();}return self.clients.openWindow(url);
  })());
});
// Release 18: 2026-11-16, final shell and forms.
// Weather v19: saved location, bounded fetch and explicit refresh result.
// v20: executor registers protocol numbers after completed work; filters preserve reminders.
