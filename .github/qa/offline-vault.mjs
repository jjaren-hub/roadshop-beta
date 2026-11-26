import {readFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';import assert from 'node:assert/strict';
const m=new Map(),localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
const Finance=new Function(readFileSync('core/finance.js','utf8')+';return Finance;')();
const V=new Function('localStorage','Finance','crypto',readFileSync('core/offline-vault.js','utf8')+';return OfflineVault;')(localStorage,Finance,webcrypto);
const pass='fictional-test-passphrase',scope={owner:'fictional-owner',workspace:'fictional-workspace',trade:'Trucking'},v=await V.create(pass,scope);
assert.equal(v.key.extractable,false);const old=await V.unlock(pass);assert.equal(old.data.owner,scope.owner);
const r={id:'sample',externalId:'sample',source:'offline-v1',trade:'Trucking',type:'Expense',classification:'expense',category:'Diesel',cents:1000,date:'2026-11-25',ref:'',note:'private sample expense',sign:1};
await V.save(v,{...v.data,queue:[r]});assert.equal(v.raw.includes(r.note),false);assert.equal(v.raw.includes(scope.owner),false);assert.equal((await V.unlock(pass)).data.queue[0].note,r.note);await assert.rejects(V.unlock('incorrect-passphrase'));await assert.rejects(V.save(old,old.data));assert.throws(()=>V.remove(v));await V.save(v,{...v.data,queue:[]});V.remove(v);assert.equal(V.stored(),null);console.log('PASS offline vault: 9 assertions');