import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='https://earnkeep.app/';
const list=JSON.parse(readFileSync('sw.js','utf8').match(/const files = (\[[^\n]+\]);/)[1].replaceAll("'",'"'));
const files=[...new Set(['sw.js',...list.map(x=>x.replace(/^\.\//,'').split('?')[0]||'index.html')])];
const hash=b=>createHash('sha256').update(b).digest('hex');
async function get(p){const url=new URL(p,root);url.searchParams.set('qa',process.env.GITHUB_SHA||'check');return fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)})}
async function match(p){const r=await get(p);return r.ok&&hash(Buffer.from(await r.arrayBuffer()))===hash(readFileSync(p))}
for(let attempt=0;attempt<18;attempt++){try{if(await match('sw.js'))break}catch{}if(attempt===17)throw Error('Production has not served the approved service worker');await new Promise(r=>setTimeout(r,10000))}
for(const p of files)assert(await match(p),'Production asset differs: '+p);
console.log('Verified '+files.length+' production asset hashes');
const r=await get('index.html');
assert(r.ok);assert.equal(new URL(r.url).origin,new URL(root).origin);
const headers=r.headers;
assert.equal(headers.get('x-content-type-options'),'nosniff');assert.equal(headers.get('x-frame-options'),'DENY');assert.equal(headers.get('referrer-policy'),'no-referrer');
const csp=headers.get('content-security-policy')||'';
assert(csp.includes("default-src 'none'")&&csp.includes("frame-ancestors 'none'")&&csp.includes("script-src 'self'")&&!csp.includes("'unsafe-inline'")&&!csp.includes("'unsafe-eval'"),'Missing expected CSP');
console.log('Production HTTPS, CSP, anti-framing, no-sniff and referrer policy verified');
const http=await fetch('http://earnkeep.app/',{redirect:'follow',signal:AbortSignal.timeout(15000)});assert.equal(new URL(http.url).protocol,'https:');console.log('HTTP redirects to HTTPS');
