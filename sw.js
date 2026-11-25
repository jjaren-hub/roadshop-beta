const CACHE = 'roadshop-iphone-phase2-live-1';
const files = ['./?ledger','./workspace.html','./workspace.js','./core/planning.js','./account.html','./cloud/account.js','./cloud/config.js','./cloud/client.js','./cloud/storage.js','./cloud/bootstrap.js','./core/accounting.js','./core/occupations.js','./','./app.js','./app.js?v=paid5','./payments.js','./style.css','./quotes.html','./customer.html','./quotes.js','./quotes.js?v=paid5','./quote-update.js','./quote-core.js','./pdf-lib.min.js','./install.js','./app.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(files.map(path => new Request(path, {cache:"reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('roadshop-iphone-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    if(new URL(event.request.url).pathname.endsWith('/cloud/config.js')){
      try {
        const fresh=await fetch(event.request,{cache:'no-store'});
        if(fresh.ok){await cache.put(event.request,fresh.clone());return fresh;}
      } catch {}
    }
    const cached = await cache.match(event.request);
    return cached || fetch(event.request);
  }));
});
