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
 function testUrl(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com'||!/(?:^|\/)cs_test_[A-Za-z0-9]+(?:\/|$)/.test(u.pathname))throw Error('Checkout did not return a verified Stripe test session. No checkout was opened.');return u.href}
 async function load(){const seq=++generation;root.replaceChildren();say('Checking your account…');
  if(!window.cloudClient||!navigator.onLine){retry('Connect to the internet to view subscription options.');return}
  try{
   const {data,error}=await cloudClient.auth.getUser();if(seq!==generation)return;
   if(error||!data?.user||data.user.is_anonymous){guest();return}
   clearIntent();const owner=data.user.id;
   const info=await RoadCommercial.load();if(seq!==generation)return;
   const sub=info.subscription;if(!sub||typeof sub.status!=='string'||!Array.isArray(info.plans))throw Error('Subscription information is unavailable.');
   const returned=new URLSearchParams(location.search).get('checkout');if(returned)node(root,'p','Checkout return received. Only verified server status determines subscription access.');
   const active=['active','trialing'].includes(sub.status);
   if(active){say('Your subscription status is '+sub.status+'.');link(root,'Continue to EarnKeep','account.html?continue=1');link(root,'Manage subscription','billing.html');return}
   if(info.promo&&Date.parse(info.promo.until_at)>Date.now())node(root,'p','Promotional access is active until '+new Date(info.promo.until_at).toLocaleDateString()+'.');
   say(info.checkoutEnabled?'Choose an available monthly plan. Checkout is in test mode.':'Test checkout is not configured. You can still continue to your beta account.');
   const eligible=['none','canceled','incomplete_expired'].includes(sub.status);
   for(const plan of info.plans.filter(p=>p.interval==='month'&&typeof p.code==='string'&&Number.isFinite(p.amount_cents)&&p.amount_cents>=0)){
    const card=node(root,'section');card.className='subscribe-plan';node(card,'h3',plan.name+' · '+money(plan.amount_cents)+' / month');
    if(plan.capabilities?.workspaces!==undefined)node(card,'p','Business workspaces at launch: '+plan.capabilities.workspaces);
    const trial=info.trialEligible&&Number.isInteger(info.trialDays)&&info.trialDays>0;
    node(card,'p',trial?'Eligible for a '+info.trialDays+'-day trial; review renewal terms at checkout.':'Review monthly renewal and cancellation terms at checkout.');
    const b=button(card,trial?'Start '+info.trialDays+'-day test trial':'Subscribe (test mode)',async()=>{
     if(busy||!info.checkoutEnabled||!eligible)return;if(!confirm('Open Stripe TEST checkout? Do not enter real payment details.'))return;
     busy=true;b.disabled=true;
     try{const verified=await cloudClient.auth.getUser();if(seq!==generation||verified.error||verified.data?.user?.id!==owner)throw Error('Account changed. Sign in again.');const latest=await RoadCommercial.load();if(seq!==generation||!latest.checkoutEnabled||!['none','canceled','incomplete_expired'].includes(latest.subscription?.status)||!latest.plans?.some(p=>p.code===plan.code&&p.interval==='month'&&p.amount_cents===plan.amount_cents))throw Error('Subscription options changed. Refresh and try again.');const r=await RoadCommercial.call('checkout',{plan:plan.code});if(seq===generation)location.assign(testUrl(r.url))}
     catch(e){if(seq===generation)say(e.message||'Checkout unavailable.')}finally{busy=false;b.disabled=false}
    });b.disabled=!info.checkoutEnabled||!eligible;
   }
   if(!eligible)node(root,'p','Your subscription status is '+sub.status+'. Manage it from Billing.');
   link(root,'Manage billing or refresh a returned checkout','billing.html');link(root,'Continue to my account','account.html?continue=1');
  }catch(e){if(seq===generation)retry(e.message||'Subscription status could not be loaded.')}
 }
 if(window.cloudClient)cloudClient.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN')setTimeout(()=>load(),0)});
 load();
})();
