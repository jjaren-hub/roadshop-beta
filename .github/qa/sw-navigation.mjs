import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {chromium} from 'playwright-core';
let source=readFileSync('sw.js','utf8');
const requests=[];
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');requests.push(u.pathname+u.search);
 if(u.pathname.endsWith('.html')){res.writeHead(308,{location:u.pathname.slice(0,-5)+u.search});return res.end()}
 if(u.pathname==='/sw.js'){res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});return res.end(source)}
 res.writeHead(200,{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; worker-src 'self'"});
 res.end('<!doctype html><title>Fixture</title><h1>Fixture '+u.pathname+'</h1>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const root='http://127.0.0.1:'+server.address().port+'/';let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const ctx=await browser.newContext({serviceWorkers:'allow'}),page=await ctx.newPage();page.setDefaultTimeout(15000);
 await page.goto(root);
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert(await page.evaluate(async()=>{const r=await caches.match('/ledger.html');return r?.redirected&&new URL(r.url).pathname==='/ledger'}));
 await page.goto(root+'ledger.html?fixture=1');await page.getByRole('heading',{name:'Fixture /ledger',exact:true}).waitFor();assert.equal(new URL(page.url()).search,'?fixture=1');
 await ctx.setOffline(true);
 await page.goto(root+'ledger?offline=1');await page.getByRole('heading',{name:'Fixture /ledger',exact:true}).waitFor();
 await page.goto(root+'account.html?switch=1');await page.getByRole('heading',{name:'Fixture /account',exact:true}).waitFor();
 await ctx.setOffline(false);
 for(const query of ['?code=fictional-callback','?flow=recovery&code=fictional-recovery','?error=fixture-error']){
  const before=requests.length;await page.goto(root+'account.html'+query);await page.getByRole('heading',{name:'Fixture /account',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/account');assert.equal(new URL(page.url()).search,query);assert(requests.slice(before).includes('/account'+query),'Callback did not reach network');
 }
 const before=requests.length;await page.goto(root+'account?code=fictional-canonical');await page.getByRole('heading',{name:'Fixture /account',exact:true}).waitFor();assert(requests.slice(before).includes('/account?code=fictional-canonical'));
 await page.evaluate(async()=>{for(const name of await caches.keys()){const c=await caches.open(name);await c.delete('/finance.html')}});
 await page.goto(root+'finance.html?cachemiss=1');await page.getByRole('heading',{name:'Fixture /finance',exact:true}).waitFor();assert.equal(new URL(page.url()).search,'?cachemiss=1');
 assert(await page.evaluate(async()=>{for(const name of await caches.keys()){for(const req of await (await caches.open(name)).keys())if(/fictional-callback|fictional-recovery|fixture-error|fictional-canonical/.test(req.url))return false}return true}));
 const previousCache=source.match(/const CACHE = '([^']+)'/)[1],nextCache=previousCache+'-fixture-update';
 source=source.replace(previousCache,nextCache);
 await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;await registration.update()});
 await page.waitForFunction(async ({previousCache,nextCache})=>{const keys=await caches.keys();return keys.includes(nextCache)&&!keys.includes(previousCache)},{previousCache,nextCache});
 await ctx.setOffline(true);
 await page.goto(root+'ledger?update=offline');
 await page.getByRole('heading',{name:'Fixture /ledger',exact:true}).waitFor();
 assert.equal(new URL(page.url()).search,'?update=offline');
 await ctx.close();console.log('PASS service-worker cached redirects, offline navigation, authentication callbacks, query preservation, cache isolation and installed cache update');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
