import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.env.EARNKEEP_TEST_URL;
assert(root==='https://jjaren-hub.github.io/roadshop-beta/','Wrong beta origin');
const list=JSON.parse(readFileSync('sw.js','utf8').match(/const files = (\[[^\n]+\]);/)[1].replaceAll("'",'"'));
const files=[...new Set(['sw.js','data/eia-diesel.json',...list.map(x=>x.replace(/^\.\//,'').split('?')[0]||'index.html')])];
const hash=b=>createHash('sha256').update(b).digest('hex');
async function match(p){const url=new URL(p,root);url.searchParams.set('qa',process.env.GITHUB_SHA||'check');const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});return r.ok&&hash(Buffer.from(await r.arrayBuffer()))===hash(readFileSync(p))}
for(let attempt=0;attempt<24;attempt++){
 try{if(await match('sw.js'))break}catch{}
 if(attempt===23)throw Error('Published beta did not reach expected cache release');
 await new Promise(r=>setTimeout(r,10000));
}
for(const p of files)assert(await match(p),'Published asset differs: '+p);
console.log('Verified '+files.length+' published beta assets against checkout');
