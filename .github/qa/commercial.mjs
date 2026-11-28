import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';const C=new Function('window',readFileSync('cloud/commercial.js','utf8')+';return RoadCommercial;')({});const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString();for(const [status,end,expected] of [['active',future,true],['trialing',future,true],['active',past,false],['canceled',future,false],['past_due',future,false]])assert.equal(Boolean(C.access({enforcement:true,subscription:{status,periodEnd:end}})),expected);assert.equal(Boolean(C.access({enforcement:false})),true);assert.equal(Boolean(C.access({enforcement:true,subscription:{status:'none'},promo:{until_at:future}})),true);assert.equal(Boolean(C.access({enforcement:true,subscription:{status:'none'},promo:{until_at:past}})),false);console.log('PASS commercial access: 8 assertions');

const source=readFileSync('commercial.js','utf8');
{
const location={origin:'https://jjaren-hub.github.io',pathname:'/roadshop-beta/finance.html'};
const policy=new Function('window',readFileSync('cloud/commercial.js','utf8')+';return RoadCommercial;')({location});
const fixture={id:'fixture-user',app_metadata:{earnkeep_subscription_beta:true}};
const status={checkoutEnabled:true};
const cases=[
 [policy.enrolled(fixture),true],
 [policy.enrolled({...fixture,app_metadata:{},user_metadata:{earnkeep_subscription_beta:true}}),false],
 [policy.testEnabled(fixture,status),true],
 [policy.testEnabled(fixture,{...status,checkoutMode:'live'}),false],
 [policy.testEnabled(fixture,{checkoutEnabled:false,checkoutMode:'test'}),false],
 [policy.paidAccess({status:'trialing',trialEnd:past,periodEnd:future}),false],
 [policy.paidAccess({status:'canceled',cancelAtPeriodEnd:true,periodEnd:future}),true],
 [policy.paidAccess({status:'canceled',paidThrough:future}),true],
 [policy.paidAccess({status:'past_due',paidThrough:past,periodEnd:future}),false],
 [policy.paidAccess({status:'past_due',paidThrough:future}),true],
 [policy.paidAccess({status:'active',periodEnd:future},Date.parse(future)),false],
 [policy.trialDays({subscription:{status:'none'},trialEligible:true,trialDays:7}),7],
 [policy.trialDays({subscription:{status:'canceled'},trialEligible:true,trialDays:7}),0],
 [policy.basic({code:'basic',amount_cents:499,interval:'month'}),true],
 [policy.basic({code:'basic',amount_cents:500,interval:'month'}),false]
];
for(const [actual,expected] of cases)assert.equal(actual,expected);
location.pathname='/other-site/finance.html';assert.equal(policy.enrolled(fixture),false);
location.origin='https://earnkeep.app';location.pathname='/roadshop-beta/finance.html';assert.equal(policy.enrolled(fixture),false);
console.log('PASS subscription policy: '+(cases.length+2)+' assertions');
}
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
