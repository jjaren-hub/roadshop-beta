import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';const C=new Function('window',readFileSync('cloud/commercial.js','utf8')+';return RoadCommercial;')({});const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString();for(const [status,end,expected] of [['active',future,true],['trialing',future,true],['active',past,false],['canceled',future,false],['past_due',future,false]])assert.equal(Boolean(C.access({enforcement:true,subscription:{status,periodEnd:end}})),expected);assert.equal(Boolean(C.access({enforcement:false})),true);assert.equal(Boolean(C.access({enforcement:true,subscription:{status:'none'},promo:{until_at:future}})),true);assert.equal(Boolean(C.access({enforcement:true,subscription:{status:'none'},promo:{until_at:past}})),false);console.log('PASS commercial access: 8 assertions');

const source=readFileSync('commercial.js','utf8');
function node(tag){return {tag,children:[],textContent:'',append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},add(x){this.children.push(x)}}}
const root=node('main'),feedback=node('p'),document={body:{dataset:{commercial:'support'}},getElementById:id=>id==='commercial-view'?root:feedback,createElement:node};
const calls=[],cloudClient={auth:{getUser:async()=>({data:{user:{id:'fictional-support-user'}}}),onAuthStateChange(){}}},commercial={load:async()=>({supportEmail:'support@example.invalid'}),call:async(action,args)=>{calls.push({action,args});return {items:[]}}};
new Function('RoadCommercial','document','window','cloudClient','Option',source)(commercial,document,{cloudClient},cloudClient,function Option(text,value){this.textContent=text;this.value=value});
await new Promise(resolve=>setTimeout(resolve,0));
const flatten=n=>typeof n==='string'?[]:[n,...(n.children||[]).flatMap(flatten)];
const all=()=>flatten(root),find=(tag,text)=>all().find(n=>n.tag===tag&&n.textContent===text);
assert(!find('h2','Release notes'));assert(!all().some(n=>n.textContent==='Phase 9'));
for(const heading of ['Help center','Send feedback or support request','Privacy and terms'])assert(find('h2',heading),heading+' missing');
assert.equal(find('a','Email support').href,'mailto:support@example.invalid');
assert.equal(find('a','Privacy Policy').href,'privacy.html');assert.equal(find('a','Terms of Service').href,'terms.html');
assert(all().some(n=>n.value==='deletion'));
const message=all().find(n=>n.tag==='textarea');message.value='Fictional support request';await find('button','Submit request').onclick();assert.deepEqual(calls[0],{action:'feedback',args:{kind:'bug',message:'Fictional support request',attachment:null}});await find('button','View my support requests').onclick();assert(find('p','No requests yet.'));assert.equal(calls[1].action,'myFeedback');
console.log('PASS support cleanup, contact and legal links, request submission and history');
