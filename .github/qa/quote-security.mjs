import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const Q=new Function(readFileSync('quote-core.js','utf8')+';return Q')();
const q={id:'Q-123456789abc',issued:'2026-01-01',expires:'2026-01-31',shop:'Fixture',contact:'555-0100',customer:'Customer',vehicle:'',description:'Service',tax:500,items:[{label:'Part',qty:100,cost:4000,rate:5000}]};
assert.equal(Q.total(Q.validate(q,true)),5500);assert.equal(JSON.stringify(Q.publicCopy(q)).includes('"cost"'),false);
for(const change of [{expires:'2025-12-31'},{issued:'2026-02-30'},{paid:{date:'2099-01-01'}},{paid:{date:'invalid'}}])assert.throws(()=>Q.validate({...q,...change},true));
const js=readFileSync('quotes.js','utf8');assert(!js.includes('Approve & send to shop'));assert(!js.includes('Share approval link'));assert(!js.includes("r.hash!==await Q.digest(q)"));assert(js.includes('manual-verified'));console.log('PASS quote validation and disabled approval route: 10 assertions');
assert.equal(Q.publicCopy({...q,trade:'General contractor'}).trade,'General contractor');assert.equal(Q.lines({...q,trade:'General contractor'})[2].startsWith('SERVICE ESTIMATE'),true);
