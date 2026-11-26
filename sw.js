const CACHE = 'roadshop-earnkeep-prelaunch-1';
const files = ['./earnkeep-banner.webp','./billing.html','./admin.html','./support.html','./privacy.html','./terms.html','./commercial.js','./cloud/commercial.js','./offline.html','./offline.js','./core/offline-vault.js','./reports.html','./reports.js','./core/retention.js','./theme.js','./scanner.html','./scanner.js','./core/scanner.js','./tax-planning.html','./tax-planning.js','./core/tax-planning.js','./mechanic.html','./mechanic.js','./core/mechanic.js','./core/job-list.js','./trucking.html','./trucking.js','./core/trucking.js','./finance.html','./finance.js','./reconcile.js','./core/reconciliation.js','./core/finance.js','./?ledger','./workspace.html','./workspace.js','./core/planning.js','./account.html','./cloud/account.js','./cloud/config.js','./cloud/client.js','./cloud/storage.js','./cloud/bootstrap.js','./core/accounting.js','./core/occupations.js','./','./app.js','./app.js?v=paid5','./payments.js','./style.css','./quotes.html','./customer.html','./quotes.js','./quotes.js?v=paid5','./quote-update.js','./quote-core.js','./pdf-lib.min.js','./install.js','./app.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(files.map(path => new Request(path, {cache:"reload"})))));
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('roadshop-iphone-')||key.startsWith('roadshop-earnkeep-')||key==='roadshop-business-archive-1'||key==='roadshop-universal-tabs-1') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',event=>{
const url=new URL(event.request.url),scope=new URL(self.registration.scope);
if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
const allowed=new Set(files.map(x=>new URL(x,scope).pathname));if(!allowed.has(url.pathname)&&url.pathname!==scope.pathname+'index.html')return;
// Serve a consistent installed release. Never mix a newly fetched script with older cached HTML.
// Service worker updates precache the next full release; cloud API responses never enter this cache.
event.respondWith(caches.open(CACHE).then(async cache=>{
 const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;
 // Cache eviction: fetch only this allowlisted static asset, without replacing the release snapshot.
 try{const r=await fetch(event.request,{cache:'no-store'});if(r.ok)return r}catch{}
 if(event.request.mode==='navigate'){const fallback=await cache.match(new URL('offline.html',scope).href);if(fallback)return fallback;}
 return new Response('Connect to the internet and reopen EarnKeep.',{status:503,headers:{'Content-Type':'text/plain'}});
}));
});