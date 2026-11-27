import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const Q=new Function(readFileSync('quote-core.js','utf8')+';return Q')();
const q={id:'Q-123456789abc',issued:'2026-01-01',expires:'2026-01-31',shop:'Fixture',contact:'555-0100',customer:'Customer',vehicle:'',description:'Service',tax:500,items:[{label:'Part',qty:100,cost:4000,rate:5000}]};
assert.equal(Q.total(Q.validate(q,true)),5500);assert.equal(JSON.stringify(Q.publicCopy(q)).includes('"cost"'),false);
for(const change of [{expires:'2025-12-31'},{issued:'2026-02-30'},{paid:{date:'2099-01-01'}},{paid:{date:'invalid'}}])assert.throws(()=>Q.validate({...q,...change},true));
const js=readFileSync('quotes.js','utf8');assert(!js.includes('Approve & send to shop'));assert(!js.includes('Share approval link'));assert(!js.includes("r.hash!==await Q.digest(q)"));assert(js.includes('manual-verified'));console.log('PASS quote validation and disabled approval route: 10 assertions');
assert.equal(Q.publicCopy({...q,trade:'General contractor'}).trade,'General contractor');assert.equal(Q.lines({...q,trade:'General contractor'})[2].startsWith('SERVICE ESTIMATE'),true);

const suppliesQuote={...q,trade:'Mechanic',items:[...q.items,{kind:'supplies',label:'Shop supply charge',qty:100,cost:0,rate:1250}],paid:{date:'2026-01-01'}};assert.equal(Q.total(Q.validate(suppliesQuote,true)),6750);assert.equal(Q.document(suppliesQuote).lines[1].total,1250);const WorkPayments=new Function(readFileSync('payments.js','utf8')+';return WorkPayments')();assert.equal(WorkPayments.rows([suppliesQuote]).find(r=>r.category==='Shop supplies').cents,1250);console.log('PASS quick quote shop supply charge and payment projection');
