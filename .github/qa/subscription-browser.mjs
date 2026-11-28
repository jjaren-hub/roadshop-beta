import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium,devices} from 'playwright-core';

const root = 'https://jjaren-hub.github.io/roadshop-beta/';
const published = Boolean(process.env.EARNKEEP_TEST_URL);
if (published) assert.equal(process.env.EARNKEEP_TEST_URL, root);
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const expectText = async (locator, label = 'Expected UI') => {
  await locator.waitFor({state:'visible'});
  check(await locator.isVisible(), true, label);
};
const day = 86400000;
const date = offset => new Date(Date.now() + offset * day).toISOString();
const id = '8fbbbd26-1f1b-4cf5-9db6-3d82c5976126';
const user = {id,email:'subscription-fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{earnkeep_subscription_beta:true},user_metadata:{},identities:[],created_at:date(-10)};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = encode({alg:'HS256'})+'.'+encode({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})+'.fixture';
const makeSession = () => ({access_token:token,refresh_token:'fixture-only',expires_in:3600,token_type:'bearer',user});
const readOnly = /Read-only access\. Subscribe/;
const button = (page,name) => page.getByRole('button',{name,exact:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});

async function publicAssets(context){
  if(!published)await context.route(root+'**', route => {
    const relative = new URL(route.request().url()).pathname.slice(new URL(root).pathname.length)||'index.html';
    assert(/^[\w./-]+$/.test(relative)&&!relative.split('/').includes('..'));
    return route.fulfill({path:relative});
  });
}
async function assertLayout(page, label){
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label);
}
async function downloaded(page, action){
  const [file] = await Promise.all([page.waitForEvent('download'),action()]);
  const stream = await file.createReadStream();
  const chunks = [];
  for await(const chunk of stream)chunks.push(chunk);
  return Buffer.concat(chunks);
}

try {
  const layouts=[
    ['Android Chrome emulation',devices['Pixel 7']],
    ['iPhone mobile layout in Chromium',devices['iPhone 13']],
    ['desktop Chrome',{viewport:{width:1280,height:850}}]
  ];
  for(const [layout,options] of layouts){
    const context=await browser.newContext({...options,serviceWorkers:'block'});
    await publicAssets(context);
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(root+'subscription-preview.html');
    for(const [state,copy] of [
      ['guest','Know your numbers. Own your success.'],['none','Subscribe to EarnKeep'],
      ['trialing',/Free trial active until/],['trial_expired','Your trial has ended'],
      ['active','Basic subscription active'],['canceled',/Cancellation scheduled/],
      ['expired','Your subscription has expired'],['renewal_failed','Your subscription payment failed']
    ]){
      await page.getByLabel('View EarnKeep as').selectOption(state);
      await expectText(page.getByText(copy,{exact:typeof copy==='string'}).first(),state);
      await assertLayout(page,state+' layout in '+layout);
    }
    await button(page,'Reset preview').click();
    await expectText(page.getByText('$4.99 / month',{exact:true}),'preview price');
    await button(page,'Start 7-day free trial').click();
    await button(page,'Simulate canceled checkout').click();
    await expectText(page.getByText(/Checkout canceled/),'preview checkout cancel');
    await button(page,'Start 7-day free trial').click();
    await button(page,'Simulate starting trial').click();
    await expectText(page.getByText('Trial activated in simulation.',{exact:true}),'preview checkout success');
    check(errors,[],'preview JavaScript errors');
    await context.close();
  }
  console.log('PASS simulation on mobile and desktop: '+checks+' assertions');
  const simulationChecks=checks;

  const context=await browser.newContext({viewport:{width:390,height:840},serviceWorkers:'block'});
  await publicAssets(context);
  let subscription={status:'none'}, signed=false, checkoutMode='test', checkoutEnabled=true, checkoutResult='test', trialEligible=true, statusUnavailable=false, pkceChallenge, googleExchanges=0, signupRequests=0, portalVisits=0;
  const calls=[];const errors=[];
  await context.route('https://*.supabase.co/**',route=>route.abort());
  await context.route('**/cloud/config.js',route=>route.fulfill({contentType:'application/javascript',body:"window.roadshopCloud={url:'https://fixture.supabase.co',key:'sb_publishable_fixture'}"}));
  await context.route('https://fixture.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url()),body=req.postDataJSON();
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    let result={},status=200;
    if(url.pathname.endsWith('/signup')){signupRequests++;result=user}
    else if(url.pathname.endsWith('/token')){
      if(url.searchParams.get('grant_type')==='pkce'){
        check(body.auth_code,'fictional-subscription-code','PKCE callback code');
        check(createHash('sha256').update(body.code_verifier).digest('base64url'),pkceChallenge,'PKCE challenge matches verifier');
        googleExchanges++;
      }
      signed=true;result=makeSession();
    }else if(url.pathname.endsWith('/user')){result=signed?user:{message:'Not signed in'};status=signed?200:401}
    else if(url.pathname.endsWith('/logout'))signed=false;
    else if(url.pathname.endsWith('/roadshop-commercial')){
      calls.push(body);
      if(body.action==='status'&&statusUnavailable){status=503;result={error:'Fixture subscription status unavailable'};}
      else if(body.action==='status')result={enforcement:false,checkoutEnabled,checkoutMode,subscription,trialEligible,trialDays:7,occupations:['truck','mechanic','general','other'],flags:{offline:true,reports:true},plans:[{code:'basic',name:'Basic',interval:'month',amount_cents:499,capabilities:{workspaces:1}}]};
      else if(body.action==='checkout'&&checkoutResult==='pending'){status=409;result={error:'Complete or allow the existing checkout to expire first'};}
      else if(body.action==='checkout')result=checkoutResult==='test'?{url:'https://checkout.stripe.com/c/pay/cs_test_fixture123',livemode:false}:{url:'https://checkout.stripe.com/c/pay/cs_live_fixture123',livemode:true};
      else if(body.action==='portal')result={url:'https://billing.stripe.com/p/session/test_fixture123',livemode:false};
      else if(body.action==='refresh')result={ok:true};
      else if(body.action==='history')result={invoices:[],more:false};
      else{errors.push('Unexpected fixture action '+body.action);status=403;}
    }else if(!url.pathname.endsWith('/authorize')){errors.push('Unexpected backend route '+url.pathname);status=403;}
    await route.fulfill({status,headers,json:result});
  });
  await context.route('https://checkout.stripe.com/**',route=>{
    check(new URL(route.request().url()).pathname,'/c/pay/cs_test_fixture123','only a test checkout URL opened');
    return route.fulfill({contentType:'text/html',body:'<h1>Intercepted checkout fixture</h1><a href="'+root+'billing.html?checkout=canceled">Cancel fixture checkout</a> <a href="'+root+'billing.html?checkout=returned">Complete fixture checkout</a>'});
  });
  await context.route('https://billing.stripe.com/**',route=>{
    portalVisits++;
    return route.fulfill({contentType:'text/html',body:'<h1>Intercepted billing portal</h1><a href="'+root+'billing.html">Return to billing</a>'});
  });
  const page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))errors.push(m.text())});
  page.on('response',r=>{if(r.url().startsWith(root)&&r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
  page.on('requestfailed',r=>{if(r.url().startsWith(root)&&r.failure()?.errorText!=='net::ERR_ABORTED')errors.push(r.failure()?.errorText+' '+new URL(r.url()).pathname)});
  const go=path=>page.goto(root+path);
  const text=(value,exact=typeof value==='string')=>page.getByText(value,{exact}).first();
  const label=value=>page.getByLabel(value,{exact:true});
  const press=name=>button(page,name).click();
  const confirm=()=>page.once('dialog',d=>d.accept());
  const snapshot=()=>page.evaluate(owner=>LocalBooks.list(owner),id);
  const awaitDenied=locator=>expectText(locator.getByText(readOnly).first(),'app rejects write');
  const checkoutCalls=()=>calls.filter(x=>x.action==='checkout');

  await go('support.html');
  const support=page.getByRole('link',{name:'EarnKeepsuport@gmail.com',exact:true});
  await expectText(support,'signed-out support email');
  check(await support.getAttribute('href'),'mailto:EarnKeepsuport@gmail.com','support mailto');
  await go('subscribe.html');
  await expectText(text(/before applicable taxes.*seven-day free trial.*renews automatically/),'public billing disclosures');
  await expectText(page.getByRole('link',{name:'Create account',exact:true}),'unregistered subscribe');
  await page.getByRole('link',{name:'Create account',exact:true}).click();
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill('fictional-fixture-password');
  await page.locator('button[value=signup]').click();
  await expectText(text('Check your email for the verification link.'),'registration in the actual UI');
  check(signupRequests,1,'fixture registration request count');
  const authorize=page.waitForRequest(r=>r.url().includes('/auth/v1/authorize'));
  await page.locator('#google').click();
  const url=new URL((await authorize).url());
  check(url.searchParams.get('redirect_to'),root+'account.html','Google callback URL');
  check(url.searchParams.get('provider'),'google','OAuth provider');
  pkceChallenge=url.searchParams.get('code_challenge');check(Boolean(pkceChallenge),true,'PKCE challenge present');
  await page.waitForURL('https://fixture.supabase.co/**');
  await go('account.html?code=fictional-subscription-code');
  await page.waitForURL(root+'subscribe.html');
  check(googleExchanges,1,'single callback exchange');
  await expectText(text('Basic · $4.99 / month'),'actual configurable plan price');
  await expectText(text(/Eligible for a 7-day trial/),'registered and trial eligible');
  await assertLayout(page,'actual checkout mobile layout');
  await page.setViewportSize({width:1280,height:850});
  await assertLayout(page,'actual checkout desktop layout');

  checkoutMode='live';
  await page.reload();
  await expectText(text(/Test checkout is unavailable/),'explicit live mode is disabled');
  check(await button(page,'Start 7-day test trial').isDisabled(),true,'unsafe checkout disabled');
  check(checkoutCalls().length,0,'no checkout call without test attestation');
  checkoutMode=undefined;checkoutEnabled=false;
  await page.reload();
  await expectText(text(/Test checkout is unavailable/),'deployed checkout flag is respected');
  check(await button(page,'Start 7-day test trial').isDisabled(),true,'disabled backend flag remains disabled');
  checkoutEnabled=true;
  await page.reload();
  await expectText(button(page,'Start 7-day test trial'));
  checkoutResult='live';
  confirm();await press('Start 7-day test trial');
  await expectText(text('Stripe did not return a verified test session.'),'live checkout URL rejected');
  check(page.url(),root+'subscribe.html','live URL did not navigate');
  checkoutResult='pending';
  confirm();await press('Start 7-day test trial');
  await expectText(text('Complete or allow the existing checkout to expire first'),'billing conflict recovery message');
  check(await button(page,'Start 7-day test trial').isEnabled(),true,'checkout can be retried after a billing error');
  checkoutResult='test';
  confirm();await press('Start 7-day test trial');
  await expectText(page.getByRole('heading',{name:'Intercepted checkout fixture'}));
  await page.getByRole('link',{name:'Cancel fixture checkout'}).click();
  await expectText(text(/Checkout was canceled/),'server-configured billing cancel return');
  await expectText(text('Status: No subscription'),'cancel return did not activate subscription');
  check(await page.getByRole('link',{name:'Continue to EarnKeep',exact:true}).count(),0,'checkout cancellation grants no access');
  await go('subscribe.html?checkout=success');
  await expectText(text(/Only verified server status determines subscription access/),'unverified success return');
  check(await page.getByRole('link',{name:'Continue to EarnKeep',exact:true}).count(),0,'success query cannot activate access');
  confirm();await press('Start 7-day test trial');
  await expectText(page.getByRole('heading',{name:'Intercepted checkout fixture'}));
  subscription={status:'trialing',trialEnd:date(7),periodEnd:date(7),hasCustomer:true};
  await page.getByRole('link',{name:'Complete fixture checkout'}).click();
  await expectText(text(/Returned from checkout/),'server-configured billing success return');
  await expectText(text('Status: trialing'),'billing shows verified trial');
  for(let i=0;i<2;i++){await press('Load test invoice history');await expectText(text('No invoices yet.'),'enrolled beta account can load invoice history');}
  check(calls.filter(x=>x.action==='history').length,2,'invoice history repeat requests');
  check(calls.filter(x=>x.action==='history').every(x=>x.mode==='test'),true,'invoice history requires test mode');
  await go('subscribe.html');
  await expectText(text('Your free trial is active.'),'verified trial activation');
  check(checkoutCalls().every(x=>x.mode==='test'&&x.plan==='basic'),true,'all checkout calls request test mode and exact plan');
  await page.getByRole('link',{name:'Continue to EarnKeep',exact:true}).click();
  await page.locator('#local-disclosure-check').check();
  await page.locator('#local-disclosure-accept').click();
  await page.locator('#start-setup').click();
  await label('Occupation').selectOption({label:'Truck driver'});
  await label('Type of business').selectOption({label:'Lease-purchase operator'});
  await label('Business name').fill('QA subscription fleet');
  for(let i=0;i<3;i++)await press('Continue');
  await press('Open dashboard');
  await expectText(page.getByRole('heading',{name:'QA subscription fleet',exact:true}));

  await go('finance.html?tab=ledger');await press('Add transaction');
  await label('Category (custom allowed)').fill('Fictional subscription expense');
  await label('Amount ($)').fill('42.17');
  await press('Save confirmed transaction');
  await expectText(button(page,'Fictional subscription expense · $42.17'),'trial can save');
  await go('reports.html');
  const setup=await page.evaluate(async owner=>{
    const [fleet]=await LocalBooks.list(owner),p=fleet.books[Planning.key],today=Q.today();
    const nextDay=new Date(Date.parse(today)+86400000).toISOString().slice(0,10);
    const trucking=Trucking.blank();
    trucking.trucks.push({id:'fixture-truck',name:'QA Unit',startingMiles:100});
    trucking.loads.push(Trucking.loadRecord({number:'QA-LOAD',truck:'QA Unit',pickupDate:today,pickupCity:'QA origin',deliveryDate:today,deliveryCity:'QA destination',loaded:100,empty:0,linehaul:2,fsc:0,stage:'Planned'},[],today,'qa-load'));
    await LocalBooks.write(owner,fleet.id,fleet.revision,{...fleet.books,[Planning.key]:{...p,trucking}});
    const mechanic=Mechanic.blank(),customer=Mechanic.customer({name:'Fictional customer'},'qa-customer');
    mechanic.customers.push(customer);
    mechanic.vehicles.push(Mechanic.vehicle({customer:customer.id,model:'QA vehicle'},'qa-vehicle',mechanic.customers));
    const newJob=(id,description)=>Mechanic.createJob({customer:customer.id,vehicle:'qa-vehicle',issued:today,expires:nextDay,description,lines:[{type:'labor',label:'Fictional labor',qty:1,rate:50}]},mechanic,id);
    const completed=(id,description)=>({...Mechanic.status(Mechanic.status(newJob(id,description),'approved','Fictional approval'),'completed'),actualPartsConfirmed:true});
    mechanic.jobs.push(Mechanic.invoice(completed('qa-invoice','Fictional issued invoice'),today,nextDay,'INV-QA-1'),completed('qa-pending-invoice','Fictional unissued invoice'),newJob('qa-draft','Fictional quote draft'));
    const profile={...p,job:'mechanic',profile:{...p.profile,business:'QA subscription shop',subtype:'Repair shop'},mechanic};
    const quote={id:'Q-123456789abc',issued:today,expires:nextDay,shop:'QA subscription shop',contact:'fixture@example.invalid',customer:'Fictional customer',vehicle:'QA vehicle',description:'Fictional quote',tax:0,trade:'Mechanic',items:[{label:'Fictional labor',kind:'labor',qty:100,rate:5000,cost:0}]};
    const restored=await LocalBooks.restore(owner,[{id:'qa-shop',name:'QA subscription shop',books:{[Planning.key]:profile,'roadshop-quotes-v1':[quote]}}]);
    return {restored,fleet:fleet.id};
  },id);
  check(setup.restored,1,'seeded a second fictional workspace while entitled');
  const original=await snapshot();
  trialEligible=false;
  for(const [state,value,writable] of [
    ['unsubscribed',{status:'none'},false],
    ['trial active',{status:'trialing',trialEnd:date(7)},true],
    ['trial expired',{status:'trialing',trialEnd:date(-1),periodEnd:date(7)},false],
    ['paid active',{status:'active',periodEnd:date(20),hasCustomer:true},true],
    ['scheduled cancellation',{status:'active',cancelAtPeriodEnd:true,periodEnd:date(5),hasCustomer:true},true],
    ['terminal canceled with future dates',{status:'canceled',cancelAtPeriodEnd:true,periodEnd:date(5),paidThrough:date(5),hasCustomer:true},false],
    ['subscription expired',{status:'canceled',paidThrough:date(-1),hasCustomer:true},false],
    ['failed renewal',{status:'past_due',periodEnd:date(30),paidThrough:date(-1),hasCustomer:true},false]
  ]){
    subscription=value;
    await go('finance.html?tab=ledger&add=expense');
    await expectText(button(page,'Fictional subscription expense · $42.17'),state+' existing ledger');
    check(await page.evaluate(()=>BookStore.readOnly),!writable,state+' actual application scope');
    check(await page.getByRole('dialog',{name:'Add expense',exact:true}).isVisible(),writable,state+' direct write shortcut');
    if(writable)await press('Cancel');
  }

  await go('subscribe.html');
  await expectText(text(/payment is outstanding.*Open Billing/),'failed renewal route');
  check(await button(page,'Start 7-day test trial').count(),0,'expired customer has no repeat trial');
  await go('billing.html');
  await expectText(text(/Status: past_due/),'billing shows failed renewal');
  await expectText(text(/Update your payment method in Stripe.*Existing records, exports and backups/),'failed renewal recovery guidance');
  await press('Manage payment method / cancellation / billing portal');
  await expectText(page.getByRole('heading',{name:'Intercepted billing portal'}));
  subscription={status:'active',cancelAtPeriodEnd:true,periodEnd:date(4),hasCustomer:true};
  await page.getByRole('link',{name:'Return to billing'}).click();
  await expectText(text(/Cancellation scheduled for end of current period/),'canceled but paid-through');
  await expectText(button(page,'Reactivate subscription'),'scheduled cancellation can be reactivated');
  await press('Reactivate subscription');
  await expectText(page.getByRole('heading',{name:'Intercepted billing portal'}),'reactivation uses the billing portal');
  await page.getByRole('link',{name:'Return to billing'}).click();
  await expectText(text(/Cancellation scheduled/),'return does not grant reactivation without verified status');
  subscription={status:'active',periodEnd:date(30),hasCustomer:true};
  await press('Refresh verified billing status');
  await expectText(text('Status: active'),'renewal refresh uses server status');
  await go('subscribe.html');
  await expectText(text('Your paid access is active.'),'renewed access returns');
  check(portalVisits,2,'only the fake test portal was visited');

  subscription={status:'past_due',paidThrough:date(-1),hasCustomer:true};
  await go('finance.html?tab=ledger');
  await press('Add transaction');
  await label('Category (custom allowed)').fill('Blocked fictional add');
  await label('Amount ($)').fill('10.01');
  await press('Save confirmed transaction');
  await awaitDenied(page.getByRole('dialog'));
  await press('Cancel');
  await press('Fictional subscription expense · $42.17');
  await label('Amount ($)').fill('99.99');
  await press('Save confirmed transaction');
  await awaitDenied(page.getByRole('dialog'));
  await press('Cancel');
  check(await snapshot(),original,'add and edit left original book byte-equivalent');
  confirm();await press('Delete entry');
  await awaitDenied(page.locator('#feedback'));
  check(await snapshot(),original,'delete attempt preserved all fictional records');
  const csv=await downloaded(page,()=>page.getByRole('button',{name:/Export.*CSV/}).click());
  check(csv.toString().includes('Fictional subscription expense')&&csv.toString().includes('42.17'),true,'actual CSV export contains the fixture');

  await go('reports.html');
  await expectText(page.getByRole('button',{name:'Print / save report as PDF',exact:true}));
  await page.evaluate(()=>{window.print=()=>{window.printed=true}});
  await press('Print / save report as PDF');
  check(await page.evaluate(()=>window.printed),true,'actual report print action');
  check((await page.pdf()).subarray(0,5).toString(),'%PDF-','generated browser report PDF');

  await go('backup.html');
  const backup=await downloaded(page,()=>press('Download complete backup'));
  await page.getByLabel('Saved backup file',{exact:true}).setInputFiles({name:'fixture-backup.json',mimeType:'application/json',buffer:backup});
  await press('Verify backup file');
  await expectText(text(/External file integrity verified/),'verified a real download');
  check((await snapshot()).length,2,'two intact businesses after backup verification');
  await press('Inspect and restore backup');
  await awaitDenied(page.locator('#backup-status'));

  await go('trucking.html?tab=loads&add=load');
  await expectText(text('Load QA-LOAD · Planned'));
  check(await page.getByRole('heading',{name:'Add load',exact:true}).count(),0,'direct load creation shortcut suppressed');
  await press('Open load');
  await label('Pickup city').fill('Blocked fictional edit');
  await press('Save load');
  await awaitDenied(page.locator('#truck-feedback'));
  await press('Back to loads');
  await press('New load');
  for(const [field,value] of [['Load number','BLOCKED-LOAD'],['Pickup city','QA city'],['Delivery city','QA destination'],['Contract loaded miles','50'],['Linehaul rate ($/loaded mile)','2'],['Fuel surcharge ($/loaded mile)','0']])await label(field).fill(value);
  await press('Save load');
  await awaitDenied(page.locator('#truck-feedback'));
  await press('Maintenance & escrow');
  await label('Cost ($)').fill('5');
  await press('Save maintenance record');
  await awaitDenied(page.locator('#truck-feedback'));
  await label('Amount ($)').fill('5');
  confirm();await press('Post escrow movement');
  await awaitDenied(page.locator('#truck-feedback'));
  check(await snapshot(),original,'trucking, maintenance, and escrow stayed intact');

  await go('account.html?switch=1');
  await expectText(button(page,'QA subscription shop'),'expired workspace stays accessible');
  check(await button(page,'Create workspace').isVisible(),false,'create business unavailable while read-only');
  await press('QA subscription shop');
  await go('quotes.html?quote=Q-123456789abc');
  await expectText(page.getByRole('heading',{name:'Quote preview',exact:true}));
  await expectText(text('Fictional quote'),'existing quote can be viewed');
  await go('mechanic.html?job=qa-invoice');
  await expectText(page.getByRole('heading',{name:'Invoice INV-QA-1',exact:true}),'existing invoice can be viewed');
  check((await downloaded(page,()=>press('Download invoice PDF'))).subarray(0,5).toString(),'%PDF-','existing invoice PDF download');
  await label('Amount received ($)').fill('1.00');
  confirm();await press('Record deposit / partial payment');
  await awaitDenied(page.locator('#mechanic-feedback'));
  await go('mechanic.html?new=1');
  check(await page.getByRole('heading',{name:'New quote',exact:true}).count(),0,'direct quote creation shortcut suppressed');
  await press('New quote');
  await label('Customer').selectOption('qa-customer');
  await label('Vehicle / equipment').selectOption('qa-vehicle');
  await label('Job description').fill('Blocked fictional quote');
  await label('Line type').selectOption('labor');
  await label('Description').fill('Fictional labor');
  await label('Unit customer charge override ($; blank uses default)').fill('25');
  await press('Save draft quote');
  await awaitDenied(page.locator('#mechanic-feedback'));
  await go('mechanic.html?job=qa-draft');
  await press('Edit draft');
  await label('Job description').fill('Blocked fictional quote edit');
  await press('Save draft quote');
  await awaitDenied(page.locator('#mechanic-feedback'));
  await go('mechanic.html?job=qa-pending-invoice');
  await press('Issue invoice');
  await awaitDenied(page.locator('#mechanic-feedback'));
  check(await snapshot(),original,'quote and invoice records unchanged');
  await go('finance.html?tab=ledger');
  const direct=()=>page.evaluate(async()=>{
    try{
      await BookStore.setItem('roadshop-ledger-v1',BookStore.getItem('roadshop-ledger-v1')||'[]');
      return 'writable';
    }catch(e){return e.name}
  });
  check(await direct(),'SubscriptionReadOnlyError','persistence guard on direct application route');
  statusUnavailable=true;
  check(await direct(),'SubscriptionReadOnlyError','status failure stays read-only');
  statusUnavailable=false;
  await context.setOffline(true);
  check(await direct(),'SubscriptionReadOnlyError','offline opted-in session stays read-only');
  await context.setOffline(false);
  check(await snapshot(),original,'no expired or offline action altered stored records');
  await go('offline.html');
  await label('Private passphrase (12+ characters)').fill('fictional-only-passphrase');
  await label('Repeat passphrase').fill('fictional-only-passphrase');
  await press('Enable offline entry');
  await awaitDenied(page.locator('#offline-feedback'));
  user.app_metadata={};
  await go('finance.html?tab=ledger');
  check(await direct(),'writable','ordinary beta account unaffected by pilot rules');
  await go('subscribe.html');
  await expectText(text(/Test checkout is unavailable/),'test calls unavailable for non-pilot account');
  check(errors,[],'real application console, navigation and network checks');
  console.log('PASS actual app in Chromium with intercepted auth and billing: '+(checks-simulationChecks)+' assertions');
  console.log('PASS subscription QA total: '+checks+' assertions');
  await context.close();
} finally {
  await browser.close();
}
