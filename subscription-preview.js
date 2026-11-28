'use strict';
(()=>{
 const root=document.getElementById('preview-screen'),picker=document.getElementById('preview-state'),open=document.getElementById('preview-open'),reset=document.getElementById('preview-reset');
 const beta=location.hostname==='jjaren-hub.github.io'&&location.pathname.startsWith('/roadshop-beta/');
 if(!beta){root.textContent='This simulation is available only on the EarnKeep beta website.';picker.disabled=open.disabled=reset.disabled=true;return}
 const states=['guest','none','trialing','active','canceled','expired'];
 let state='none',screen='subscription',choice='paid',returnScreen='subscription',notice='';
 const el=(parent,tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n};
 const card=(parent,heading)=>{const n=el(parent,'section');n.className='card';el(n,'h2',heading);return n};
 const action=(parent,label,fn,primary=false)=>{const b=el(parent,'button',label);b.type='button';if(primary)b.className='primary';b.onclick=fn;return b};
 const actions=p=>{const n=el(p,'div');n.className='preview-actions';return n};
 const hasAccess=()=>['trialing','active','canceled'].includes(state);
 const days=n=>new Date(Date.now()+n*86400000).toLocaleDateString();
 function setScreen(next,msg=''){screen=next;notice=msg;render()}
 function setState(next){if(!states.includes(next))return;state=next;picker.value=next;choice='paid';setScreen(next==='guest'?'welcome':hasAccess()?'dashboard':'subscription')}
 function openApp(){if(state==='guest')setScreen('welcome');else if(hasAccess())setScreen('dashboard');else setScreen('restricted')}
 function plan(parent,renew=false){
  const p=el(parent,'section');p.className='preview-plan';el(p,'h3','Basic');const price=el(p,'p','$4.99 / month');price.className='subscribe-price';el(p,'p','1 business workspace · billed monthly · cancel anytime.');
  const features=el(p,'ul');for(const item of ['Income and expense tracking','Trucking, fuel, maintenance and escrow','Mechanic tools, quotes and invoices','Tax planning, forecasting and reports','PDF and CSV exports'])el(features,'li',item);
  const a=actions(p);
  if(state==='none')action(a,'Start 7-day free trial',()=>checkout('trial'),true);
  action(a,renew?'Renew subscription':'Subscribe for $4.99/month',()=>checkout('paid'),state!=='none');
  if(state==='none')el(p,'p','Trial eligibility is simulated for a new customer. After the trial, $4.99/month unless canceled.');
 }
 function checkout(kind){choice=kind;returnScreen=screen;setScreen('checkout')}
 function render(){
  root.replaceChildren();
  if(notice){const n=el(root,'p',notice);n.setAttribute('role','status')}
  if(screen==='welcome'){
   const p=card(root,'Know your numbers. Own your success.');el(p,'p','Bookkeeping and business tools for people who work for themselves.');el(p,'p','Basic · $4.99/month');const a=actions(p);action(a,'Get started',()=>setScreen('registration'),true);action(a,'Sign in',()=>setScreen('registration'));
  }else if(screen==='registration'){
   const p=card(root,'Create your EarnKeep account');el(p,'p','In the real app, register with email or Google. This preview does not ask for credentials.');const a=actions(p);action(a,'Simulate successful account creation',()=>setState('none'),true);action(a,'Back',()=>setScreen('welcome'));
  }else if(screen==='subscription'){
   const p=card(root,state==='expired'?'Renew your subscription':'Subscribe to EarnKeep');el(p,'p',state==='expired'?'Your paid access has ended. Renew to continue adding and editing business records.':'Your account is ready. Choose a subscription or an eligible trial to start using EarnKeep.');
   if(state==='expired')el(p,'p','Your existing records remain available for viewing and export.');
   plan(p,state==='expired');action(p,'Continue to app',openApp);
  }else if(screen==='restricted'){
   const p=card(root,'Subscription required');p.classList.add('preview-lock');el(p,'p',state==='expired'?'Your subscription has expired. Your records are still yours.':'You do not have an active subscription. Subscribe to unlock your business tools.');
   el(p,'p',state==='expired'?'You can view and export your existing records, but adding or editing records requires an active subscription.':'Choose a plan to set up your business and start recording income and expenses.');
   const a=actions(p);action(a,state==='expired'?'Renew subscription':'View subscription plans',()=>setScreen('subscription'),true);
   if(state==='expired'){action(a,'View existing records',()=>setScreen('readonly'));action(a,'Export records',()=>setScreen('export'))}
  }else if(screen==='checkout'){
   const p=card(root,'Secure checkout preview');el(p,'p','Simulation of a Stripe checkout. No card details are collected and no Stripe request is made.');el(p,'h3',choice==='trial'?'7 days free, then $4.99/month':'Basic subscription · $4.99/month');el(p,'p','Billed monthly. Cancel before renewal to avoid future charges.');const a=actions(p);action(a,choice==='trial'?'Simulate starting trial':'Simulate successful payment',()=>{state=choice==='trial'?'trialing':'active';picker.value=state;setScreen('dashboard',choice==='trial'?'Trial activated in simulation.':'Subscription activated in simulation.')},true);action(a,'Simulate canceled checkout',()=>setScreen(returnScreen,'Checkout canceled. No subscription or payment was created.'));
  }else if(screen==='dashboard'||screen==='readonly'){
   if(screen==='dashboard'&&!hasAccess()){setScreen('restricted');return}
   const readOnly=screen==='readonly';const p=card(root,'Business overview');el(p,'p','Sample business · fictional records');el(p,'p',readOnly?'Read-only access · subscription expired':state==='trialing'?'Free trial active until '+days(7):state==='canceled'?'Cancellation scheduled · access until '+days(15):'Basic subscription active');
   const amount=el(p,'p','$2,240.00');amount.className='preview-figure';el(p,'p','Net profit · example income $6,420 · expenses $4,180');
   const grid=el(p,'div');grid.className='preview-tools';for(const name of ['Finances','Trucking','Mechanic','Reports'])action(grid,name,()=>setScreen('tool',name+' · sample records'),false);
   const a=actions(p);action(a,'Add transaction',()=>readOnly?setScreen('restricted'):setScreen('entry'),!readOnly);action(a,'Export records',()=>setScreen('export'));action(a,'Manage subscription',()=>setScreen('billing'));
  }else if(screen==='tool'){
   if(!hasAccess()&&state!=='expired'){setScreen('restricted');return}
   const p=card(root,'Business tools');el(p,'p','Fictional example records: Income $6,420; expenses $4,180.');action(p,'Add record',()=>hasAccess()?setScreen('entry'):setScreen('restricted'),hasAccess());action(p,'Back to overview',()=>setScreen(hasAccess()?'dashboard':'readonly'));
  }else if(screen==='entry'){
   if(!hasAccess()){setScreen('restricted');return}
   const p=card(root,'Add transaction');el(p,'p','Sample entry: $50 business expense. Nothing will be written to your actual books.');action(p,'Simulate saving entry',()=>setScreen('dashboard','Example transaction saved in this simulation only.'),true);action(p,'Cancel',()=>setScreen('dashboard'));
  }else if(screen==='export'){
   const p=card(root,'Export records');el(p,'p','In the real app, export remains available after cancellation or expiration. This preview has no real records to export.');action(p,'Simulate export',()=>setScreen(hasAccess()?'dashboard':'readonly','Example export completed. No file was generated.'),true);
  }else if(screen==='billing'){
   const p=card(root,'Billing & subscription');el(p,'p','Current status: '+state);el(p,'p',state==='trialing'?'Trial ends '+days(7):state==='canceled'?'Paid access ends '+days(15):state==='active'?'Next renewal '+days(30):'No current paid access');const a=actions(p);
   if(state==='active'||state==='trialing')action(a,'Cancel subscription',()=>{state='canceled';picker.value=state;setScreen('billing','Cancellation scheduled. Access remains until the current period ends.')});
   if(state==='canceled'){action(a,'Simulate end of paid period',()=>setState('expired'));action(a,'Resume subscription',()=>{state='active';picker.value=state;setScreen('billing','Subscription resumed in simulation.')})}
   if(!hasAccess())action(a,'Renew subscription',()=>setScreen('subscription'),true);action(a,'Return to app',openApp);
  }
 }
 picker.onchange=()=>setState(picker.value);open.onclick=openApp;reset.onclick=()=>setState('none');setState('none');
})();
