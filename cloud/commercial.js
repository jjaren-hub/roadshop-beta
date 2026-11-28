const RoadCommercial=window.RoadCommercial=(()=>{
let cached=null;
const readOnly='Read-only access. Subscribe to add, edit or delete records. You can still view and export existing records.';
const isBeta=()=>window.location?.origin==='https://jjaren-hub.github.io'&&window.location.pathname.startsWith('/roadshop-beta/');
const enrolled=user=>isBeta()&&Boolean(user?.id&&!user.is_anonymous&&user.app_metadata?.earnkeep_subscription_beta===true);
async function call(action,extra={}){if(!window.cloudClient)throw Error('Sign in online first');const {data,error}=await cloudClient.functions.invoke('roadshop-commercial',{body:{action,...extra}});if(error){let message='Commercial service unavailable';try{const j=await error.context?.json();if(j?.error)message=j.error}catch{}throw Error(message)}if(!data||data.error)throw Error(data?.error||'Service unavailable');return data}
async function load(){let timer;try{const result=await Promise.race([call('status'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Billing status check timed out')),4500)})]);cached=result;return result}finally{clearTimeout(timer)}}
function paidAccess(subscription, now=Date.now()){
 if(!subscription)return false;
 const {status,periodEnd,trialEnd,paidThrough,cancelAtPeriodEnd}=subscription;
 if(status==='trialing')return Date.parse(trialEnd??periodEnd)>now;
 if(status==='active')return Date.parse(paidThrough??periodEnd)>now;
 if(status==='canceled'&&cancelAtPeriodEnd===true)return Date.parse(paidThrough??periodEnd)>now;
 return ['canceled','past_due','unpaid'].includes(status)&&Date.parse(paidThrough)>now;
}
function access(s){return !s?.enforcement||paidAccess(s.subscription)||Date.parse(s.promo?.until_at)>Date.now()}
async function canWrite(user){
 if(!enrolled(user))return true;
 if(navigator.onLine===false)return false;
 try{
  const current=async()=>{const {data,error}=await cloudClient.auth.getSession();return !error&&data?.session?.user?.id===user.id};
  if(!await current())return false;
  const status=await load();
  return await current()&&(paidAccess(status.subscription)||Date.parse(status.promo?.until_at)>Date.now());
 }catch{return false}
}
function trialDays(info){return info?.subscription?.status==='none'&&info.trialEligible===true&&info.trialDays===7?7:0}
const basic=plan=>plan?.code==='basic'&&plan.interval==='month'&&plan.amount_cents===499;
const canReactivate=s=>s?.hasCustomer===true&&s.cancelAtPeriodEnd===true&&['active','trialing'].includes(s.status)&&paidAccess(s);
const canCheckout=s=>!paidAccess(s)&&['none','canceled','expired','trial_expired','incomplete_expired'].includes(s?.status);
// The deployed commercial function only returns checkoutEnabled after verifying a test key.
const testEnabled=(user,info)=>enrolled(user)&&info?.checkoutEnabled===true&&(info.checkoutMode===undefined||info.checkoutMode==='test');
function stripeUrl(result,action){
 let url;
 try{url=new URL(result?.url)}catch{throw Error('Stripe did not return a verified test session.')}
 const checkout=action==='checkout'&&url.hostname==='checkout.stripe.com'&&/^\/(?:c\/pay\/|pay\/)?cs_test_[A-Za-z0-9]+\/?$/.test(url.pathname)&&result.livemode!==true;
 // Stripe supports both the legacy path token and the current query-string token.
 const legacyPortal=/^\/p\/session\/test_[A-Za-z0-9_-]+\/?$/.test(url.pathname)&&!url.search;
 const queryPortal=/^\/p\/session\/?$/.test(url.pathname)&&/^\?secret=test_[A-Za-z0-9_-]+$/.test(url.search);
 const portal=action==='portal'&&url.hostname==='billing.stripe.com'&&!url.hash&&(legacyPortal||queryPortal)&&result.livemode!==true;
 if(url.origin!=='https://'+url.hostname||url.username||url.password||!(checkout||portal))throw Error('Stripe did not return a verified test session.');
 return url.href;
}
async function testSession(action,owner,planCode){
 if(!['checkout','portal','reactivate'].includes(action))throw Error('Unknown billing action.');
 const {data,error}=await cloudClient.auth.getUser();
 if(error||data?.user?.id!==owner)throw Error('Account changed. Sign in again.');
 const info=await load();
 if(!testEnabled(data.user,info))throw Error('Stripe test mode is not configured for this beta account.');
 if(action==='checkout'&&(!canCheckout(info.subscription)||!info.plans?.some(p=>p.code===planCode&&basic(p))))throw Error('Subscription options changed. Refresh and try again.');
 if(action==='reactivate'&&!canReactivate(info.subscription))throw Error('Cancellation status changed. Refresh billing and try again.');
 if(action!=='checkout'&&!info.subscription?.hasCustomer)throw Error('No test billing customer is available.');
 const requestAction=action==='reactivate'?'portal':action;
 const result=await call(requestAction,{mode:'test',...(action==='checkout'?{plan:planCode}:{})});
 return stripeUrl(result,requestAction);
}
function activity(){/* No feature or error telemetry from financial screens. */}
return {call,load,get status(){return cached},access,activity,readOnly,isBeta,enrolled,paidAccess,canWrite,trialDays,basic,canCheckout,canReactivate,testEnabled,testSession};})();
