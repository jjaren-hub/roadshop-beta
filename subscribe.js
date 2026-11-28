'use strict';
(()=>{
 const root=document.getElementById('subscribe-actions'),status=document.getElementById('subscribe-status');
 const key='earnkeep-subscribe-intent';let generation=0,busy=false;
 const say=t=>{status.textContent=t};
 const node=(p,tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;p.append(n);return n};
 const link=(p,label,url)=>{const a=node(p,'a',label);a.href=url;return a};
 const button=(p,label,fn)=>{const b=node(p,'button',label);b.type='button';b.className='primary';b.onclick=fn;return b};
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
 const clearIntent=()=>{try{sessionStorage.removeItem(key)}catch{}};
 function guest(){say('Create an account or sign in to see available plans and trial eligibility.');link(root,'Create account','account.html?signup=1&subscribe=1');link(root,'Already registered? Sign in','account.html?subscribe=1')}
 function retry(message){say(message);button(root,'Retry subscription status',()=>load());link(root,'Continue to my account','account.html?continue=1')}
 async function load(){const seq=++generation;root.replaceChildren();say('Checking your account…');
  if(!window.cloudClient||!navigator.onLine){retry('Connect to the internet to view subscription options.');return}
  try{
   const {data,error}=await cloudClient.auth.getUser();if(seq!==generation)return;
   if(error||!data?.user||data.user.is_anonymous){guest();return}
   clearIntent();const user=data.user;
   const info=await RoadCommercial.load();if(seq!==generation)return;
   const sub=info.subscription;if(!sub||typeof sub.status!=='string'||!Array.isArray(info.plans))throw Error('Subscription information is unavailable.');
   const returned=new URLSearchParams(location.search).get('checkout');
   if(returned)node(root,'p',returned==='canceled'?'Checkout was canceled. Your access is based on verified billing status.':'Checkout return received. Only verified server status determines subscription access.');
   if(RoadCommercial.paidAccess(sub)){
    if(sub.status==='trialing')say(sub.cancelAtPeriodEnd?'Your free trial is active. It will end without renewal.':'Your free trial is active.');
    else say(sub.cancelAtPeriodEnd||sub.status==='canceled'?'Your subscription is canceled. Your paid access continues through the end of the period.':'Your paid access is active.');
    link(root,'Continue to EarnKeep','account.html?continue=1');link(root,'Manage subscription','billing.html');return;
   }
   if(info.promo&&Date.parse(info.promo.until_at)>Date.now())node(root,'p','Promotional access is active until '+new Date(info.promo.until_at).toLocaleDateString()+'.');
   const testEnabled=RoadCommercial.testEnabled(user,info),eligible=RoadCommercial.canCheckout(sub);
   say(testEnabled?'Choose an available monthly plan. Checkout is in test mode.':'Test checkout is unavailable for this beta account. You can still continue to your account.');
   for(const plan of info.plans.filter(p=>p.interval==='month'&&typeof p.code==='string'&&Number.isFinite(p.amount_cents)&&p.amount_cents>=0)){
    const card=node(root,'section');card.className='subscribe-plan';node(card,'h3',plan.name+' · '+money(plan.amount_cents)+' / month');
    if(plan.capabilities?.workspaces!==undefined)node(card,'p','Business workspaces at launch: '+plan.capabilities.workspaces);
    const trial=RoadCommercial.trialDays(info),enabled=testEnabled&&eligible&&RoadCommercial.basic(plan);
    node(card,'p',trial?'Eligible for a '+trial+'-day trial; review renewal terms at checkout.':'Review monthly renewal and cancellation terms at checkout.');
    const b=button(card,trial?'Start '+trial+'-day test trial':'Subscribe (test mode)',async()=>{
     if(busy||!enabled)return;if(!confirm('Open Stripe TEST checkout? Do not enter real payment details.'))return;
     busy=true;b.disabled=true;
     try{const url=await RoadCommercial.testSession('checkout',user.id,plan.code);if(seq===generation)location.assign(url)}
     catch(e){if(seq===generation)say(e.message||'Checkout unavailable.')}finally{busy=false;b.disabled=!enabled}
    });b.disabled=!enabled;
   }
   if(!eligible)node(root,'p','Your subscription status is '+sub.status+'. Manage it from Billing.');
   link(root,'Manage billing or refresh a returned checkout','billing.html');
   const recovery=node(root,'section');recovery.className='subscribe-plan';node(recovery,'h3','Your records are still yours');node(recovery,'p','You can access and export records already saved on this device without buying another subscription. Select your existing business to view records, export CSV from Finances or print PDF reports.');
   link(recovery,'Open my existing businesses','account.html?switch=1');link(recovery,'Download complete backup','backup.html');
   link(root,'Continue to my account','account.html?continue=1');
  }catch(e){if(seq===generation)retry(e.message||'Subscription status could not be loaded.')}
 }
 if(window.cloudClient)cloudClient.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN')setTimeout(()=>load(),0)});
 load();
})();
