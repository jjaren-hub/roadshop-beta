import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root='https://earnkeep.app/',hash=b=>createHash('sha256').update(b).digest('hex');
const files=[...new Set(['sw.js',...JSON.parse(readFileSync('sw.js','utf8').match(/const files = (\[[^\n]+\]);/)[1].replaceAll("'",'"')).map(p=>p.replace(/^\.\//,'').split('?')[0]||'index.html'),'pdf-lib-license.txt'])];
async function read(p){const u=new URL(p,root);u.searchParams.set('verify',process.env.GITHUB_SHA||'release');const r=await fetch(u,{redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(10000)});if(new URL(r.url).origin!==new URL(root).origin)throw Error('Unexpected origin for '+p);return {r,bytes:Buffer.from(await r.arrayBuffer())}}
async function match(p){const {r,bytes}=await read(p);return r.ok&&hash(bytes)===hash(readFileSync(p))}
let ready=false;for(let i=0;i<30;i++){try{if(await match('sw.js')){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,10000))}
assert(ready,'Production did not serve the approved release within the verification window');
for(const p of files)assert(await match(p),'Production asset mismatch: '+p);
const {r,bytes}=await read('account.html');assert(bytes.toString().includes('Sign in to EarnKeep'));assert(r.headers.get('content-security-policy'),'Missing HTTP CSP');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options')?.toLowerCase(),'deny');
console.log('PASS live HTTPS, '+files.length+' matching static assets, EarnKeep sign-in HTML and required security headers. No login or financial write attempted.');
