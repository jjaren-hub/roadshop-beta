const CACHE = 'roadshop-earnkeep-perdiem-taps-20261127-2';
const files = ['./earnkeep-banner.webp','./landing.css','./landing.js','./account-entry.js','./ledger.html','./index.html','./backup.html','./backup.js','./core/backup.js','./billing.html','./admin.html','./support.html','./privacy.html','./terms.html','./commercial.js','./cloud/commercial.js','./offline.html','./offline.js','./core/offline-vault.js','./reports.html','./reports.js','./core/retention.js','./theme.js','./insights.html','./insights.js','./core/insights.js','./tax-planning.html','./tax-planning.js','./core/tax-planning.js','./mechanic.html','./mechanic.js','./core/mechanic.js','./core/job-list.js','./trucking.html','./trucking.js','./core/trucking.js','./finance.html','./finance.js','./reconcile.js','./core/reconciliation.js','./core/finance.js','./?ledger','./workspace.html','./workspace.js','./core/planning.js','./account.html','./cloud/account.js','./cloud/config.js','./cloud/client.js','./cloud/storage.js','./cloud/bootstrap.js','./core/accounting.js','./core/occupations.js','./','./app.js','./app.js?v=paid5','./payments.js','./style.css','./quotes.html','./customer.html','./quotes.js','./quotes.js?v=paid5','./quote-update.js','./quote-core.js','./pdf-lib.min.js','./install.js','./app.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(files.map(path => new Request(path, {cache:"reload"})))));
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('roadshop-iphone-')||key.startsWith('roadshop-earnkeep-')||key==='roadshop-business-archive-1'||key==='roadshop-universal-tabs-1') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
// A redirected cached Response cannot be returned directly to a manual-redirect
// navigation request. Rewrap only navigation bodies, retaining security headers.
function navigationResponse(response){
 if(!response.redirected)return response;
 const headers=new Headers(response.headers);
 headers.delete('content-length');headers.delete('content-encoding');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
self.addEventListener('fetch',event=>{
const url=new URL(event.request.url),scope=new URL(self.registration.scope);
if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
const navigate=event.request.mode==='navigate';
const allowed=new Set(files.map(x=>new URL(x,scope).pathname));
const accountPath=scope.pathname+'account';
const account=url.pathname===accountPath||url.pathname===accountPath+'.html';
// Let the browser follow authentication callback redirects directly, never cache callback URLs.
if(navigate&&account&&['code','auth_code','flow','error','error_code','error_description','token_hash','access_token','refresh_token','type'].some(k=>url.searchParams.has(k)))return;
const alias=navigate&&!allowed.has(url.pathname)&&allowed.has(url.pathname+'.html');
if(!alias&&!allowed.has(url.pathname)&&url.pathname!==scope.pathname+'index.html')return;
// Serve a consistent installed release. Never mix a newly fetched script with older cached HTML.
// Service worker updates precache the next full release; cloud API responses never enter this cache.
event.respondWith(caches.open(CACHE).then(async cache=>{
 if(alias){
   const key=new URL(url.href);key.pathname+='.html';key.search='';
   const cached=await cache.match(key.href,{ignoreSearch:true});
   // Only recognize an extensionless alias when the original cached file really redirected there.
   if(cached?.redirected&&new URL(cached.url).pathname===url.pathname)return navigationResponse(cached);
   return fetch(event.request);
 }
 const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return navigate?navigationResponse(cached):cached;
 // Cache eviction: fetch only this allowlisted static asset, without replacing the release snapshot.
 try{const r=await fetch(event.request,{cache:'no-store'});if(navigate&&r.type==='opaqueredirect')return r;if(r.ok)return navigate?navigationResponse(r):r}catch{}
 if(navigate){const fallback=await cache.match(new URL('offline.html',scope).href);if(fallback)return navigationResponse(fallback);}
 return new Response('Connect to the internet and reopen EarnKeep.',{status:503,headers:{'Content-Type':'text/plain'}});
}));
});
