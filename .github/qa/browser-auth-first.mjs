import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {chromium} from 'playwright-core';
const root=process.env.EARNKEEP_TEST_URL||'http://127.0.0.1:18749/',server=process.env.EARNKEEP_TEST_URL?null:spawn('python3',['-m','http.server','18749','--bind','127.0.0.1'],{stdio:'ignore'});let browser;
try{
if(server)for(let i=0;i<40;i++){try{if((await fetch(root)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const uid='11111111-1111-4111-8111-111111111111',wid='22222222-2222-4222-8222-222222222222',user={id:uid,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url'),token=enc({alg:'HS256'})+'.'+enc({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})+'.fixture',session={access_token:token,refresh_token:'fixture-only',expires_in:3600,token_type:'bearer',user};
for(const [job,label,sub,trade] of [['truck','Truck driver','Lease-purchase operator','Trucking'],['mechanic','Mechanic','Mobile mechanic','Mechanic'],['mechanic','Mechanic','Repair shop','Mechanic'],['general','General independent contractor','','General contractor'],['other','Other self-employed business','','Other business']]){
 const ctx=await browser.newContext({viewport:sub==='Repair shop'||job==='other'?{width:1280,height:820}:{width:390,height:844},colorScheme:sub==='Repair shop'||job==='general'?'dark':'light',serviceWorkers:'block'});let signed=false;const errors=[];
 await ctx.route('https://*.supabase.co/**',r=>r.abort());
 await ctx.route('**/cloud/config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.roadshopCloud={url:'https://fixture.supabase.co',key:'sb_publishable_fixture'}"}));
 await ctx.route('https://fixture.supabase.co/**',async r=>{const req=r.request(),url=new URL(req.url()),method=req.method();let result={},status=200;const raw=req.postData();const data=raw?JSON.parse(raw):{};const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
 if(method==='OPTIONS')return r.fulfill({status:204,headers});
 if(url.pathname.endsWith('/signup'))result=user;
 else if(url.pathname.endsWith('/token')){signed=true;result=session}
 else if(url.pathname.endsWith('/user')){result=signed?user:{message:'Not signed in'};status=signed?200:401}
 else if(url.pathname.endsWith('/logout')){signed=false;result={}}
 else if(url.pathname.endsWith('/roadshop-commercial'))result=data.action==='status'?{enforcement:false,occupations:['truck','mechanic','general','other'],flags:{scanner:false,reports:true,offline:true},isAdmin:false,plans:[{code:'basic',name:'Basic',amount_cents:499},{code:'pro',name:'Pro',amount_cents:999}].map(p=>({...p,interval:'month',capabilities:{workspaces:1,ocr_pages:0,ai_questions:0}})),trialDays:7,trialEligible:true,checkoutEnabled:false,subscription:{status:'none'}}:data.action==='history'?{invoices:[],more:false}:{ok:true};
 else if(url.pathname.endsWith('/workspaces')||url.pathname.endsWith('/roadshop-document-scan')){errors.push('Forbidden financial network request '+url.pathname);status=403;result={message:'Financial data must stay on this device'}}
 await r.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(result)})});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));const localSpaces=()=>page.evaluate(owner=>LocalBooks.list(owner),uid);
 await page.goto(root);await page.getByRole('heading',{name:'Know your numbers. Own your success.'}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('script[src*="cloud/"]').count(),0);await page.getByRole('link',{name:'Get started'}).first().click();await page.getByRole('heading',{name:'Create your EarnKeep account'}).waitFor();await page.locator('#guest').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(16, 22, 23)');await page.evaluate(()=>RoadTheme.set('light'));assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(16, 22, 23)');assert.equal(await page.evaluate(()=>RoadTheme.get()),'light');await page.reload();await page.locator('#guest').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('button[value=signup]')).backgroundColor),'rgb(192, 233, 120)');
 await page.goto(root+'finance.html');await page.waitForURL('**/account.html');await page.locator('#guest').waitFor();
 await page.locator('#email').fill(user.email);await page.locator('#password').fill('fictional-password');if(job==='other'){
   await page.locator('button[value=signup]').click();await page.getByText('Check your email for the verification link.').waitFor();await page.getByText('Need help signing in?').click();
   for(const [id,path] of [['reset','recover'],['resend','resend']]){const response=page.waitForResponse(r=>r.url().includes('/auth/v1/'+path)&&r.request().method()==='POST');await page.locator('#'+id).click();assert.equal((await response).status(),200);await page.getByText('Check your email for the requested link.').waitFor();}
   await page.locator('#password').fill('fictional-password');
 }
 await page.locator('button[value=login]').click();await page.locator('#local-disclosure').waitFor();await page.locator('#local-disclosure-check').check();await page.locator('#local-disclosure-accept').click();await page.locator('#start-setup').click();
 await page.getByLabel('Occupation',{exact:true}).selectOption(label);if(sub)await page.getByLabel('Type of business',{exact:true}).selectOption(sub);await page.getByLabel('Business name',{exact:true}).fill('Fixture '+trade);
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('heading',{name:'Recurring bills',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Recurring bills',exact:true}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('heading',{name:'Operating costs',exact:true}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:job==='mechanic'?'Open ledger':'Open dashboard',exact:true}).click();
 if(job==='mechanic'){await page.getByRole('heading',{name:'Profit & loss',exact:true}).waitFor();await page.getByRole('link',{name:'Dashboard',exact:true}).click();}
 await page.getByRole('heading',{name:'Fixture '+trade,exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(244, 246, 242)');await page.evaluate(()=>RoadTheme.set('dark'));assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(16, 22, 23)');assert.equal((await localSpaces())[0].books['roadshop-profile-v2'].job,job);assert.equal((await localSpaces())[0].books['roadshop-profile-v2'].complete,true);
 const shortcut=await page.locator('#content .dashboard-nav a[data-tool=finance]').first().evaluate(a=>({height:a.getBoundingClientRect().height,bg:getComputedStyle(a).backgroundColor,fg:getComputedStyle(a).color}));assert(shortcut.height>=38&&shortcut.height<=48);assert.equal(shortcut.bg,'rgb(192, 233, 120)');assert.equal(shortcut.fg,'rgb(21, 32, 12)');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal((await page.getByRole('link',{name:'Trucking tools',exact:true}).count())>0,job==='truck');assert.equal((await page.getByRole('link',{name:'Mechanic tools',exact:true}).count())>0,job==='mechanic');
 // Opening settings must not hijack a later plain Dashboard link.
 await page.getByRole('button',{name:'Business settings',exact:true}).click();
 await page.getByRole('heading',{name:'Business profile',exact:true}).waitFor();
 assert.equal((await localSpaces())[0].books['roadshop-profile-v2'].step,1);
 await page.getByRole('link',{name:'Open ledger',exact:true}).click();
 await page.getByRole('link',{name:'Dashboard',exact:true}).click();
 await page.getByRole('heading',{name:'Fixture '+trade,exact:true}).waitFor();
 await page.getByRole('button',{name:'Business settings',exact:true}).click();
 await page.getByRole('heading',{name:'Business profile',exact:true}).waitFor();
 await page.getByRole('button',{name:'Return to dashboard',exact:true}).click();
 await page.getByRole('heading',{name:'Fixture '+trade,exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'Fixture '+trade,exact:true}).waitFor();
 // Root/app launch is occupation-aware; only completed mechanic workspaces get permanent tabs.
 await page.goto(root+'ledger.html');
 if(job==='mechanic'){
   await page.getByRole('heading',{name:'Profit & loss',exact:true}).waitFor();
   const tabs=page.getByRole('navigation',{name:'Business navigation'});
   assert.equal(await tabs.locator('button, a').count(),2);
   await page.getByRole('button',{name:'Settings & backup',exact:true}).click();await page.getByRole('heading',{name:'Settings & backup',exact:true}).waitFor();await tabs.getByRole('button',{name:'Ledger',exact:true}).click();
   await tabs.getByRole('link',{name:'Quotes',exact:true}).click();await page.getByRole('heading',{name:'Mechanic quotes',exact:true}).waitFor();assert.equal(await tabs.getByRole('link',{name:'Quotes',exact:true}).getAttribute('aria-current'),'page');
   for(const route of ['workspace.html','mechanic.html','finance.html','reports.html','insights.html','tax-planning.html']){
     await page.goto(root+route);await tabs.waitFor();assert.equal(await tabs.locator('a').count(),2);assert.equal(await tabs.getByRole('link',{name:'Ledger',exact:true}).getAttribute('href'),'ledger.html?ledger');assert.equal(await tabs.getByRole('link',{name:'Quotes',exact:true}).getAttribute('href'),'quotes.html');
   }
   await tabs.getByRole('link',{name:'Ledger',exact:true}).click();await page.getByRole('heading',{name:'Profit & loss',exact:true}).waitFor();
 }else{await page.getByRole('heading',{name:'Fixture '+trade,exact:true}).waitFor();const tabs=page.getByRole('navigation',{name:'Business navigation'});await tabs.waitFor();await tabs.getByRole('link',{name:'Quotes',exact:true}).click();await page.getByRole('heading',{name:'Quotes',exact:true}).waitFor();assert.equal(await page.locator('#detailedOrder').isVisible(),false);}
 await page.goto(root+'finance.html?tab=bills');await page.getByRole('button',{name:'Add recurring bill'}).waitFor();
 await page.getByRole('button',{name:'Transactions',exact:true}).click();
 for(const [category,amount] of [['Fixture supplies','40.50'],['Fixture rent','100']]){
   await page.getByRole('button',{name:'Add transaction'}).click();
   await page.getByLabel('Category (custom allowed)').fill(category);await page.getByLabel('Amount ($)',{exact:true}).fill(amount);
   await page.getByRole('button',{name:'Save confirmed transaction'}).click();await page.getByRole('heading',{name:new RegExp(category)}).waitFor();
 }
 const search=page.getByLabel('Search',{exact:true});await search.fill('supplies');await search.press('Tab');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export filtered CSV'}).click();
 const stream=await (await download).createReadStream();let csv='';for await(const part of stream)csv+=part;
 assert(csv.includes('Fixture supplies'));assert(!csv.includes('Fixture rent'));
 const edit=page.getByRole('button',{name:'Edit',exact:true});await edit.click();
 await page.getByLabel('Amount ($)',{exact:true}).fill('42.50');await page.getByRole('button',{name:'Save confirmed transaction'}).click();
 await page.getByRole('heading',{name:'Fixture supplies · $42.50'}).waitFor();await page.getByRole('button',{name:'Fixture supplies · $42.50',exact:true}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove mistaken entry'}).click();
 await page.getByRole('heading',{name:'Fixture supplies · -$42.50'}).waitFor();
 // Classic ledger editor: create, tap, change, save and delete a standalone entry.
 await page.goto(root+'?ledger');await page.locator('#add').click();const category=await page.locator('#category').inputValue();await page.locator('#amount').fill('1.23');await page.locator('#saveEntry').click();await page.locator('#editor').waitFor({state:'hidden'});const line=page.locator('#rows button').filter({hasText:'$1.23'});await line.click();assert.equal(await page.locator('#category').inputValue(),category);await page.locator('#amount').fill('2.34');await page.locator('#saveEntry').click();await page.locator('#editor').waitFor({state:'hidden'});await page.locator('#rows button').filter({hasText:'$2.34'}).click();await page.locator('#remove').click();await page.locator('#accept').click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(await page.locator('#rows button').filter({hasText:'$2.34'}).count(),0);
 await page.goto(root+'reports.html');await page.getByRole('cell',{name:'$100.00',exact:true}).first().waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const button=name=>page.getByRole('button',{name,exact:true});
 async function checkNav(selector){const result=await page.locator(selector).first().evaluate(n=>{const a=[...n.children].filter(x=>!x.hidden&&x.matches('a,button'));return {display:getComputedStyle(n).display,columns:getComputedStyle(n).gridTemplateColumns.split(' ').length,widths:a.map(x=>x.getBoundingClientRect().width),height:a.map(x=>x.getBoundingClientRect().height),active:a.filter(x=>x.matches('[aria-current=page],[aria-pressed=true]')).map(x=>getComputedStyle(x).backgroundColor),screen:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}});assert.equal(result.display,'grid');assert.equal(result.columns,result.screen<600?2:3);assert(result.widths.length>0);assert(Math.max(...result.widths)-Math.min(...result.widths)<1);assert(result.height.every(h=>h>=38));assert(result.active.every(c=>c==='rgb(192, 233, 120)'));assert(!result.overflow)}
 if(job==='truck'){
   await page.goto(root+'backup.html');await page.getByText('Last verified external backup: Never',{exact:true}).waitFor();
   const pw='fictional encrypted backup password';
   await page.getByLabel('Backup password (optional, 12+ characters)',{exact:true}).fill(pw);
   await page.getByLabel('Repeat backup password',{exact:true}).fill(pw);
   const downloading=page.waitForEvent('download');await button('Download complete backup').click();
   const stream=await (await downloading).createReadStream();let backup='';for await(const chunk of stream)backup+=chunk;
   const envelope=JSON.parse(backup);assert.equal(envelope.encrypted,true);assert(!backup.includes('Fixture supplies'));
   await page.getByText('Download requested.',{exact:false}).waitFor();
   await page.getByText('Last verified external backup: Never',{exact:true}).waitFor();
   const results=await page.evaluate(async ({uid,pw,backup})=>{
     const B=EarnKeepBackup,decoded=await B.decode(backup,uid,pw),original=await LocalBooks.list(uid);let wrong=false,other=false,tampered=false,duplicate=false;
     try{await B.decode(backup,uid,'wrong password 123')}catch{wrong=true}
     try{await B.decode(backup,'another-account',pw)}catch{other=true}
     const raw=JSON.parse(await B.encode(decoded.payload));raw.payload=raw.payload.replace('Fixture','Altered');
     try{await B.decode(JSON.stringify(raw),uid)}catch{tampered=true}
     try{await LocalBooks.restore(uid,[{...original[0],id:'different-business-id'}])}catch{duplicate=true}
     return {wrong,other,tampered,duplicate,same:JSON.stringify(original)===JSON.stringify(decoded.payload.workspaces),never:B.age(uid).last===null};
   },{uid,pw,backup});
   assert.deepEqual(results,{wrong:true,other:true,tampered:true,duplicate:true,same:true,never:true});
   await page.getByLabel('Saved backup file',{exact:true}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
   await page.getByLabel('Password if encrypted',{exact:true}).fill(pw);await button('Verify backup file').click();
   await page.getByText('External file integrity verified.',{exact:false}).waitFor();
   await page.getByText('Last verified external backup:',{exact:false}).waitFor();assert(!(await page.getByText('Last verified external backup:',{exact:false}).textContent()).includes('Never'));
   const warnings=await page.evaluate(owner=>{const B=EarnKeepBackup;const now=Date.now(),p=document.createElement('div');B.write(owner,'last',{date:new Date(now-3*86400000).toISOString()});B.reminder(owner,p);const three=p.textContent;B.write(owner,'last',{date:new Date(now-7*86400000).toISOString()});B.reminder(owner,p);return {three,seven:p.textContent,role:p.firstChild.getAttribute('role')}},uid);
   assert.match(warnings.three,/Backup reminder/);assert.match(warnings.seven,/WARNING/);assert.equal(warnings.role,'alert');
   const writeChecks=await page.evaluate(async owner=>{const B=EarnKeepBackup,p=await B.snapshot(owner),before=B.read(owner,'last'),dir={async getFileHandle(){return {async createWritable(){return {async write(){},async close(){}}},async getFile(){return {async text(){return 'damaged external file'}}}}}};let rejected=false;try{await B.writeExternal(owner,dir,p)}catch{rejected=true}return {rejected,unchanged:JSON.stringify(before)===JSON.stringify(B.read(owner,'last'))}},uid);assert.deepEqual(writeChecks,{rejected:true,unchanged:true});
   const alternate='https://earnkeep-migration-fixture.invalid/';
   await ctx.route(alternate+'**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/cloud/config.js')return route.fulfill({contentType:'application/javascript',body:"window.roadshopCloud={url:'https://fixture.supabase.co',key:'sb_publishable_fixture'}"});const response=await ctx.request.get(root+url.pathname.slice(1)+url.search);await route.fulfill({response})});
   await page.goto(alternate+'backup.html');await page.getByText('Sign in online before opening your backups.',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('roadshop-auth-v1')),null);
   await page.goto(alternate+'account.html');await page.locator('#guest').waitFor();await page.locator('#email').fill(user.email);await page.locator('#password').fill('fictional-password');await page.locator('button[value=login]').click();
   await page.locator('#local-disclosure').waitFor();await page.locator('#local-disclosure-check').check();await page.locator('#local-disclosure-accept').click();await page.locator('#start-setup').waitFor();
   await page.goto(alternate+'backup.html');await page.getByText('0 businesses (including archived).',{exact:false}).waitFor();
   await page.getByLabel('Backup to restore',{exact:true}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});await page.getByLabel('Backup password if encrypted',{exact:true}).fill(pw);
   page.once('dialog',d=>d.accept());await button('Inspect and restore backup').click();await page.getByText('Restored 1 new businesses.',{exact:false}).waitFor();
   assert.equal(await page.evaluate(async owner=>(await LocalBooks.list(owner))[0].books['roadshop-ledger-v1'].length,uid),(await page.evaluate(async ({owner,pw,backup})=>(await EarnKeepBackup.decode(backup,owner,pw)).payload.workspaces[0].books['roadshop-ledger-v1'].length,{owner:uid,pw,backup})));
   await page.getByLabel('Backup to restore',{exact:true}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});await page.getByLabel('Backup password if encrypted',{exact:true}).fill(pw);page.once('dialog',d=>d.accept());await button('Inspect and restore backup').click();await page.getByText('Restored 0 new businesses.',{exact:false}).waitFor();
   // Verify current snapshot before deletion; the restored revision differs from the original export.
   await page.getByLabel('Type DELETE LOCAL DATA to confirm',{exact:true}).fill('DELETE LOCAL DATA');await button('Delete local data').click();await page.getByText('Verify an external backup of the current data first.',{exact:true}).waitFor();
   const fresh=await page.evaluate(async owner=>EarnKeepBackup.encode(await EarnKeepBackup.snapshot(owner)),uid);
   await page.getByLabel('Saved backup file',{exact:true}).setInputFiles({name:'fresh.json',mimeType:'application/json',buffer:Buffer.from(fresh)});await button('Verify backup file').click();await page.getByText('External file integrity verified.',{exact:false}).waitFor();
   await page.getByLabel('Type DELETE LOCAL DATA to confirm',{exact:true}).fill('DELETE LOCAL DATA');page.once('dialog',d=>d.accept());await button('Delete local data').click();await page.getByText('Local account records deleted.',{exact:false}).waitFor();assert.equal(await page.evaluate(async owner=>(await LocalBooks.list(owner)).length,uid),0);
   await page.goto(root+'workspace.html?home=1');await page.getByRole('heading',{name:'Fixture '+trade,exact:true}).waitFor();
 }

 // Every occupation must acknowledge the current local tax disclaimer before tools appear.
 await page.goto(root+'tax-planning.html');
 const gate=page.locator('#tax-disclaimer-gate');await gate.waitFor();
 assert.equal(await page.locator('#tax-nav button').count(),0);
 assert(await button('Accept & Continue').isDisabled());
 const ack=gate.getByRole('checkbox');await ack.check();await button('Accept & Continue').click();
 await page.locator('#tax-disclaimer-notice').waitFor();
 await page.getByRole('heading',{name:'Estimated tax center'}).waitFor();
 const key='earnkeep-tax-disclaimer:'+uid;
 const acceptance=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 assert.equal(acceptance.version,'2026-11-26-v1');assert(Number.isFinite(Date.parse(acceptance.acceptedAt)));
 await page.reload();await page.getByRole('heading',{name:'Estimated tax center'}).waitFor();
 await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({version:'old-version',acceptedAt:new Date().toISOString()})),key);
 await page.reload();await gate.waitFor();assert(await button('Accept & Continue').isDisabled());
 await ack.check();await button('Accept & Continue').click();
 await button('Reports & checklist').click();
 if(job==='truck'){
   for(const name of ['Download accountant summary CSV','Download detailed ledger CSV']){
     const downloading=page.waitForEvent('download');await button(name).click();
     const stream=await (await downloading).createReadStream();let content='';for await(const chunk of stream)content+=chunk;
     for(const paragraph of ["EarnKeep is a financial recordkeeping and estimation tool, not a tax preparation or professional tax advisory service.","Tax estimates, deductions, classifications and calculations are provided for informational purposes only and are not guaranteed to be accurate, complete or applicable to your individual circumstances.","You are responsible for verifying your financial information, determining deduction eligibility and complying with applicable tax laws. Consult a qualified tax professional before filing or making tax-related decisions."])assert(content.includes(paragraph),name+' must include complete disclaimer');
   }
   const downloading=page.waitForEvent('download');await button('Download accountant summary PDF').click();assert.match((await downloading).suggestedFilename(),/^tax-summary-\d{4}\.pdf$/);
 }

 if(sub==='Repair shop'){
   await page.goto(root+'finance.html?tab=ledger');await button('Add transaction').click();
   await page.getByLabel('Category (custom allowed)').fill('Fixture loan');await page.getByLabel('Amount ($)',{exact:true}).fill('10');
   await page.getByText('Split transaction across categories').click();await button('Add split line').click();
   const lines=page.locator('#finance-editor fieldset');
   await lines.nth(0).getByLabel('Split classification').selectOption('principal');await lines.nth(0).getByLabel('Split amount ($)').fill('7.55');
   await lines.nth(1).getByLabel('Split category').fill('Interest');await lines.nth(1).getByLabel('Split classification').selectOption('interest');await lines.nth(1).getByLabel('Split amount ($)').fill('2.44');
   await button('Save confirmed transaction').click();await page.getByText('Allocate the full transaction amount before saving.').waitFor();
   await lines.nth(1).getByLabel('Split amount ($)').fill('2.45');await button('Save confirmed transaction').click();
   const card=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Fixture loan · $10.00',exact:true})});await card.getByRole('button',{name:'Edit',exact:true}).click();
   assert.equal(await lines.nth(1).getByLabel('Split amount ($)').inputValue(),'2.45');await button('Cancel').click();
   await page.goto(root+'reports.html');await page.getByRole('cell',{name:'$102.45',exact:true}).first().waitFor();
 }
 if(job==='truck'){
   await page.goto(root+'finance.html?tab=reconcile');
   const when=await page.evaluate(()=>Q.today());await page.getByLabel('Account or statement name').fill('Fixture checking');
   await page.getByLabel('Opening balance ($)').fill('300');await page.getByLabel('Ending balance ($)').fill('200');await button('Start reconciliation').click();
   await page.getByText('Import statement CSV',{exact:true}).click();await page.getByLabel('Statement CSV',{exact:true}).setInputFiles({name:'statement.csv',mimeType:'text/csv',buffer:Buffer.from('date,description,amount\n'+when+',Fixture rent,-100.00')});
   page.once('dialog',d=>d.accept());await button('Import lines').click();const summary=page.locator('summary').filter({hasText:'Fixture rent'});await summary.click();
   await button('Close statement').click();await page.getByText('Resolve all matches and the ending balance difference before closing.').waitFor();
   await button('Select suggested match').click();assert(await page.getByRole('checkbox',{name:/Fixture rent/}).isChecked());await button('Save match').click();await page.getByText(/Fixture rent · -\$100.00 · Matched/).waitFor();
   page.once('dialog',d=>d.accept());await button('Close statement').click();await button('Reopen statement').waitFor();await page.reload();await button('Fixture checking · '+when.slice(0,7)+' · Closed').click();
   page.once('dialog',d=>d.accept());await button('Reopen statement').click();await button('Close statement').waitFor();
   const current=(await localSpaces())[0].books['roadshop-profile-v2'].reconciliations[0];assert(!current.closed);assert.equal(current.lines[0].matches.length,1);assert.equal(current.history.length,5);
   assert.equal((await localSpaces())[0].books['roadshop-ledger-v1'].length,3);
 }
 if(job==='truck'){
   await page.goto(root+'trucking.html');await page.locator('#truck-controls .module-nav').waitFor();await button('Settlements').click();assert.equal(await page.getByRole('link',{name:/Scan settlement/i}).count(),0);await button('New manual settlement').waitFor();await checkNav('#truck-controls .module-nav');await checkNav('main .workspace-nav');await button('Trucks & mileage').click();await checkNav('#truck-controls .module-nav');await page.getByLabel('Truck unit name').fill('Fixture 101');await button('Save truck').click();
   await page.getByRole('heading',{name:'Fixture 101',exact:true}).waitFor();await page.getByLabel('Loaded miles',{exact:true}).fill('100');await page.getByLabel('Deadhead miles',{exact:true}).fill('10');await button('Save mileage').click();
   await page.getByText(/Deletion protected:/).waitFor();await button('Delete truck Fixture 101').click();await page.getByRole('heading',{name:'Fixture 101',exact:true}).waitFor();
   page.once('dialog',d=>d.accept());await button('Remove mileage record').click();await page.getByText(/Deletion protected:/).waitFor({state:'detached'});page.once('dialog',d=>d.accept());await button('Delete truck Fixture 101').click();await page.getByText('No trucks added yet.').waitFor();
   const quoteDate=await page.evaluate(()=>Q.today());
   const seedQuotes=[{id:'Q-123456789abc',trade:'Trucking',issued:quoteDate,expires:quoteDate,shop:'Fixture Trucking',contact:'fixture@example.invalid',customer:'Fixture customer',vehicle:'',description:'Paid service',tax:500,items:[{label:'Service',kind:'labor',qty:100,cost:0,rate:5000}],paid:{date:quoteDate}}];await page.evaluate(async ({owner,quotes})=>{const [w]=await LocalBooks.list(owner);await LocalBooks.write(owner,w.id,w.revision,{...w.books,'roadshop-quotes-v1':quotes})},{owner:uid,quotes:seedQuotes});
   await page.goto(root+'trucking.html');await page.getByText('Revenue: $50.00',{exact:true}).waitFor();await page.getByText('Net profit: -$50.00',{exact:true}).waitFor();assert.equal((await localSpaces())[0].books['roadshop-ledger-v1'].filter(r=>r.id.startsWith('payment-')).length,0);
 }
 if(job==='general'){
   await page.goto(root+'billing.html');
   // Exercise complete backup restore, owner separation and stale revision rejection on the actual device database.
   const localCheck=await page.evaluate(async owner=>{
     const original=(await LocalBooks.list(owner))[0], other='fixture-independent-owner';
     const empty=await LocalBooks.list(other);
     const copied=await LocalBooks.restore(other,[original]);
     const restored=await LocalBooks.read(other,original.id);
     const skipped=await LocalBooks.restore(other,[original]);
     await LocalBooks.write(other,original.id,restored.revision,restored.books);
     let stale=false;try{await LocalBooks.write(other,original.id,restored.revision,{})}catch{stale=true}
     const same=JSON.stringify((await LocalBooks.read(owner,original.id)).books)===JSON.stringify(original.books);
     return {empty:empty.length,copied,skipped,stale,same,restored:JSON.stringify(restored.books)===JSON.stringify(original.books)};
   },uid);
   assert.deepEqual(localCheck,{empty:0,copied:1,skipped:0,stale:true,same:true,restored:true});

   for(const name of ['Basic · $4.99 / month','Pro · $9.99 / month'])await page.getByRole('heading',{name,exact:true}).waitFor();
   const trials=button('Start 7-day trial (test mode)');assert.equal(await trials.count(),2);assert(await trials.first().isDisabled());assert(await trials.last().isDisabled());
   for(let i=0;i<2;i++){await button('Load test invoice history').click();await page.getByText('No invoices yet.',{exact:true}).waitFor();}
   await page.goto(root+'insights.html');await page.getByRole('heading',{name:'Business insights',exact:true}).waitFor();await button('Calculate answer').waitFor();assert.equal(await page.getByRole('button',{name:'Receipt scanner',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Settlement scanner',exact:true}).count(),0);
   await page.goto(root+'finance.html?tab=ledger');await button('Add transaction').click();
   const original={name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS7sAAAAASUVORK5CYII=','base64')};
   await page.getByLabel('Category (custom allowed)').fill('Materials');await page.getByLabel('Amount ($)',{exact:true}).fill('12.34');await page.getByLabel('Add receipts',{exact:false}).setInputFiles(original);await page.getByText('Receipts ready.',{exact:true}).waitFor();await button('Save confirmed transaction').click();await page.getByRole('heading',{name:/Materials/}).waitFor();
   const manualReceipt=(await localSpaces())[0].books['roadshop-ledger-v1'].filter(r=>r.cents===1234);assert.equal(manualReceipt.length,1);assert.equal(manualReceipt[0].receipts[0].name,'fixture.png');assert(manualReceipt[0].receipts[0].data.startsWith('data:image/png;base64,'));
   await page.goto(root+'offline.html');const pass='fictional test vault';
   await page.getByLabel('Private passphrase (12+ characters)').fill(pass);await page.getByLabel('Repeat passphrase').fill(pass);await button('Enable offline entry').click();await page.getByText('Offline vault ready').waitFor();await ctx.setOffline(true);
   await page.getByLabel('Category',{exact:true}).fill('Offline tools');await page.getByLabel('Amount ($)').fill('7.89');await button('Save encrypted pending entry').click();await page.getByRole('heading',{name:'Offline tools · $7.89'}).waitFor();await button('Lock vault').click();
   await page.getByLabel('Private passphrase (12+ characters)').fill(pass);await button('Unlock').click();await page.getByRole('heading',{name:'Offline tools · $7.89'}).waitFor();await ctx.setOffline(false);await page.getByText('1 synced; 0 need review').waitFor();
   assert.equal((await localSpaces())[0].books['roadshop-ledger-v1'].filter(r=>r.category==='Offline tools').length,1);
 }
 if(sub==='Mobile mechanic'){
   await page.goto(root+'mechanic.html');await page.locator('#mechanic-controls .module-nav').waitFor();await checkNav('#mechanic-controls .module-nav');await button('Quotes & work orders').click();await button('Add customer').click();await page.getByLabel('Customer name').fill('Fixture Motors');await button('Save customer').click();
   await button('Add vehicle for Fixture Motors').click();await page.getByLabel('Year',{exact:true}).fill('2020');await page.getByLabel('Make',{exact:true}).fill('Fixture');await page.getByLabel('Model / equipment').fill('Service truck');await button('Save vehicle').click();await page.getByRole('heading',{name:'2020 Fixture Service truck'}).waitFor();
   await button('Quotes & work orders').click();await button('New quote').click();await page.getByLabel('Customer',{exact:true}).selectOption({index:1});await page.getByLabel('Vehicle / equipment').selectOption({index:1});
   await page.getByLabel('Job description').fill('Replace filter');await page.getByLabel('Description',{exact:true}).fill('Oil filter');await page.getByLabel('Actual purchase price per part',{exact:false}).fill('20');await page.getByLabel('Default parts markup (%)').fill('25');await button('Save draft quote').click();await page.getByRole('heading',{name:'Quote / work order'}).waitFor();
   await page.getByText('Customer document preview',{exact:true}).click();const sheet=page.locator('.customer-document');await sheet.waitFor();assert.equal(await sheet.locator('thead th').count(),4);assert((await sheet.innerText()).includes('Fixture Motors'));assert(!(await sheet.innerText()).includes('profit'));const pdf=page.waitForEvent('download');await button('Download quote PDF').click();assert.match((await pdf).suggestedFilename(),/\.pdf$/);
   for(const status of ['sent','approved']){await page.getByLabel('New status').selectOption(status);await page.getByLabel('Approval / rejection evidence or status notes').fill('Customer confirmed in fixture');await button('Apply status').click();await page.getByText('Status: '+status,{exact:true}).waitFor();}
   await page.getByRole('heading',{name:'Actual work and costs'}).waitFor();
   await page.getByLabel('Actual amount paid ($)').fill('20');await page.getByLabel('Receipt / purchase description').fill('Fictional part receipt');await button('Record / link actual cost').click();
   await page.getByText('Actual parts cost: $20.00',{exact:true}).waitFor();await page.getByLabel('Actual parts expenses reviewed',{exact:false}).check();const previous=await button('Save parts-cost confirmation').elementHandle();await previous.click();await page.waitForFunction(el=>!el.isConnected,previous);
   await page.getByLabel('New status').selectOption('completed');await button('Apply status').click();await button('Issue invoice').click();await button('Mark as Paid').waitFor();
   const invoiceDownload=page.waitForEvent('download');await button('Download invoice PDF').click();assert.match((await invoiceDownload).suggestedFilename(),/^invoice-.+\.pdf$/);
   page.once('dialog',d=>d.accept());await button('Mark as Paid').click();await page.getByText('Status: paid',{exact:true}).waitFor();
   const jobRows=(await localSpaces())[0].books['roadshop-ledger-v1'].filter(r=>r.job);assert.equal(jobRows.filter(r=>r.cents===2000).length,1);assert.equal(jobRows.filter(r=>r.cents===2500).length,1);
   await button('Quotes & work orders').click();await page.getByText('No jobs in this view yet.').waitFor();await page.getByLabel('Show',{exact:true}).selectOption('history');await page.getByRole('heading',{name:'Fixture Motors · Replace filter'}).waitFor();
   await page.goto(root+'quotes.html');await button('New quick quote').click();
   for(const [key,value] of Object.entries({shop:'Fixture Shop',contact:'fixture@example.invalid',customer:'Fixture Motors',vehicle:'Truck',description:'Quick tire check',markup:'25'}))await page.locator('#'+key).fill(value);
   await page.locator('[data-field=label]').fill('Tire gauge');await page.locator('[data-field=cost]').fill('12');await button('Save and preview').click();await page.locator('.customer-document').waitFor();assert.equal(await page.locator('.customer-document thead th').count(),4);assert.match(await page.locator('.customer-document').innerText(),/Total estimate/);const pdfCheck=await page.evaluate(async()=>{const q={id:'Q-123456789abc',issued:'2026-11-26',expires:'2026-12-26',shop:'Sample Repair',contact:'555-0100',customer:'Sample customer',vehicle:'Truck',description:'Example repair',tax:0,items:[{label:'Labor',qty:100,rate:17500}]};const f=await Q.pdf(q),p=await PDFLib.PDFDocument.load(await f.arrayBuffer());return {pages:p.getPageCount(),width:p.getPage(0).getWidth(),height:p.getPage(0).getHeight()}});assert.deepEqual(pdfCheck,{pages:1,width:612,height:792});await button('All quotes').click();
   await page.getByLabel('Show',{exact:true}).selectOption('all');await page.getByRole('heading',{name:'Fixture Motors · Quick tire check'}).waitFor();await page.getByRole('heading',{name:'Fixture Motors · Replace filter'}).waitFor();
   await page.getByLabel('Search jobs').fill('replace');assert.equal(await button('Open estimate').count(),0);await page.getByRole('link',{name:'Open work order'}).click();await page.getByText('Status: paid',{exact:true}).waitFor();
   await button('Quotes & work orders').click();await page.getByRole('link',{name:'Open estimate'}).click();await page.getByRole('heading',{name:'Quote preview'}).waitFor();
   assert.equal((await localSpaces())[0].books['roadshop-ledger-v1'].filter(r=>r.job).length,jobRows.length);

 }
 if(job==='other'){
   await page.goto(root+'account.html?switch=1');await page.getByRole('heading',{name:'Your account'}).waitFor();await page.locator('#business').fill('Second fixture');await button('Create workspace').click();await page.getByRole('heading',{name:'Business profile'}).waitFor();
   assert.equal((await localSpaces()).length,2);assert.equal(((await localSpaces())[1].books['roadshop-ledger-v1']||[]).length,0);
   await page.goto(root+'account.html?switch=1');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove Second fixture',exact:true}).click();await page.getByText('Business removed. Its records are saved under Archived businesses.').waitFor();assert((await localSpaces())[1].books['roadshop-workspace-archive-v1']);await page.locator('#archive-section summary').click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Restore Second fixture',exact:true}).click();await page.getByText('Business restored.').waitFor();assert(!(await localSpaces())[1].books['roadshop-workspace-archive-v1']);
   await page.goto(root+'account.html?switch=1');await button('Fixture '+trade).click();await page.getByRole('heading',{name:'Fixture '+trade,exact:true}).waitFor();await page.goto(root+'reports.html');await page.getByRole('cell',{name:'$100.00',exact:true}).first().waitFor();
 }
 await page.goto(root+'admin.html');await page.getByText('Administrator access is required.').waitFor();
 await page.goto(root+'workspace.html?home=1');await page.getByRole('button',{name:'Log out',exact:true}).click();await page.waitForURL('**/account.html');await page.locator('#credentials').waitFor();assert.deepEqual(errors,[]);
 await ctx.close();console.log('PASS browser workflows: '+(sub||label));
}
}finally{if(browser)await browser.close();server?.kill()}
