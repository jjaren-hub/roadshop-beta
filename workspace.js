'use strict';
const {registry,goals,periods,key,forecast}=Planning;
const content=document.getElementById('content'), feedback=document.getElementById('feedback');
const original=BookStore.getItem(key);
const state=original?JSON.parse(original):{version:2,step:1,complete:false,job:'',profile:{business:BookStore.name},bills:[],operating:{},goals:{},hidden:[]};
// A completed workspace opens its dashboard on every normal page entry.
// Editing business settings is an in-page action, not a persisted navigation route.
if(state.complete && registry[state.job]) state.step=5;
if(new URLSearchParams(location.search).has('home')) history.replaceState(null,'',location.pathname);
const pages=['Business profile','Recurring bills','Operating costs','Financial goals','Dashboard'];
const features={fixed:'Fixed expenses',breakEven:'Break-even revenue',upcoming:'Upcoming bills',target:'Revenue targets',quotes:'Quotes and work orders'};
let writes=Promise.resolve(),timer;
function save(){
  clearTimeout(timer);timer=null;
  const raw=JSON.stringify(state);
  writes=writes.catch(()=>{}).then(()=>BookStore.setItem(key,raw));
  writes.then(()=>feedback.textContent='Progress saved.',e=>feedback.textContent='Could not save. '+e.message);
  return writes;
}
window.flushWorkspaceDraft=()=>timer?save():writes;
document.addEventListener('click',async event=>{
  const a=event.target.closest('a[href]');
  if(!a || event.ctrlKey || event.metaKey || event.shiftKey || event.button!==0)return;
  event.preventDefault();
  try{await window.flushWorkspaceDraft();location.assign(a.href);}catch(error){feedback.textContent=error.message;}
});
function changed(){clearTimeout(timer);timer=setTimeout(save,300);}
function el(parent,tag,text){
  const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n;
}
function btn(parent,text,fn){
  const b=el(parent,'button',text);b.type='button';b.onclick=async()=>{try{await fn();}catch(e){feedback.textContent=e.message;}};return b;
}
function field(parent,obj,id,title,options={}){
  const wrap=el(parent,'label',title), input=el(wrap,options.choices?'select':'input');
  if(options.choices)for(const v of ['',...options.choices])input.add(new Option(v||'Choose…',v));
  else{input.type=options.type||'text';if(input.type==='number'){input.min='0';input.step='any';if(options.max!=null)input.max=options.max;}else input.maxLength=180;}
  input.setAttribute('aria-label',title);input.name=id;input.value=obj[id]??'';input.required=!!options.required;
  input.oninput=()=>{obj[id]=input.value;changed();};
  return input;
}
function fields(parent,obj,specs){for(const [id,title,limit] of specs)field(parent,obj,id,title,Array.isArray(limit)?{choices:limit}:{type:'number',max:limit});}
function localDay(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function cash(n){return Number.isFinite(n)?n.toLocaleString('en-US',{style:'currency',currency:'USD'}):'No finite target';}
function totals(parent){
  const q=forecast(state,localDay());
  el(parent,'p','Weekly '+cash(q.weekly)+' · Monthly '+cash(q.monthly)+' · Annual '+cash(q.annual));if(q.cashWeekly)el(parent,'small','Additional nonexpense cash commitments: '+cash(q.cashWeekly)+' / week.');if(q.excluded?.length)el(parent,'small','Already included in operating assumptions: '+q.excluded.join(', ')+'.');
}
async function go(step){
  state.step=step;await save();render();window.scrollTo(0,0);
}
function profile(form){
  const allowed=window.RoadCommercial?.status?.occupations;const pick=field(form,{},'occupation','Occupation',{choices:Object.entries(registry).filter(([k])=>!allowed||allowed.includes(k)||k===state.job).map(([,m])=>m.label),required:true});
  pick.value=registry[state.job]?.label||'';
  pick.onchange=()=>{state.job=Object.keys(registry).find(k=>registry[k].label===pick.value)||'';state.profile.subtype='';changed();render();};
  const mod=registry[state.job];if(mod?.types.length)field(form,state.profile,'subtype','Type of business',{choices:mod.types});
  field(form,state.profile,'business','Business name',{required:true});
  for(const [id,label,type] of [['owner','Owner name'],['email','Business email','email'],['phone','Business phone','tel'],['address','Business address']])field(form,state.profile,id,label,{type});
  field(form,state.profile,'structure','Business structure',{choices:['Sole proprietorship','LLC','Partnership','Corporation','Other']});
  const upload=el(el(form,'label','Business logo (optional, PNG or JPEG up to 200 KB)'),'input');upload.type='file';upload.accept='image/png,image/jpeg';
  upload.onchange=async()=>{const file=upload.files[0];if(!file)return;upload.disabled=true;try{const src=await Q.readLogo(file);if(!upload.isConnected)return;const previous=state.profile.logo;state.profile.logo=src;try{await save();render()}catch(e){if(previous===undefined)delete state.profile.logo;else state.profile.logo=previous;throw e}}catch(e){feedback.textContent=e.message;upload.value=''}finally{upload.disabled=false}};
  if(state.profile.logo){logo(form);btn(form,'Remove logo',async()=>{delete state.profile.logo;await save();render();});}
}
function logo(parent){const src=Q.logoData(state.profile.logo);if(src){const img=el(parent,'img');img.alt='Business logo';img.className='business-profile-logo';img.addEventListener('error',()=>img.remove(),{once:true});img.src=src;}}
function bills(form){
  if(state.complete){const manager=el(form,'a','Manage payment history, variable bills and schedules');manager.href='finance.html?tab=bills';}
  const suggestions=registry[state.job]?.suggestions||[];
  const select=el(el(form,'label','Suggested expense'),'select');
  for(const title of ['Custom expense',...suggestions])select.add(new Option(title));
  btn(form,'Add recurring expense',()=>{const label=select.value==='Custom expense'?'':select.value;
    state.bills.push({id:crypto.randomUUID(),name:label,category:label,frequency:'Monthly',amount:'',due:localDay(),end:''});changed();render();});
  state.bills.forEach((b,i)=>{
    const box=el(form,'fieldset');el(box,'legend','Bill '+(i+1));
    field(box,b,'name','Expense name',{required:true});field(box,b,'category','Expense category',{required:true});
    const amount=field(box,b,'amount','Amount ($)',{type:'number',required:true});amount.min='.01';amount.step='.01';
    field(box,b,'frequency','Payment frequency',{choices:Object.keys(periods).filter(x=>x!=='Custom days'||b.frequency==='Custom days'),required:true});
    const due=field(box,b,'due','Next due date',{type:'date',required:true}), end=field(box,b,'end','End date (optional)',{type:'date'});
    end.min=due.value;due.addEventListener('input',()=>end.min=due.value);
    btn(box,'Remove bill',()=>{if(JSON.parse(BookStore.getItem('roadshop-ledger-v1')||'[]').some(r=>r.billKey?.startsWith((b.id||Finance.billId(b,i))+'@'))){feedback.textContent='This bill has history. Cancel it in Finance instead.';return;}if(!confirm('Delete this unused recurring bill?'))return;state.bills=state.bills.map((x,n)=>({...x,id:Finance.billId(x,n)})).filter((_,n)=>n!==i);changed();render();});
  });
  const estimate=el(form,'div');el(estimate,'h2','Estimated fixed costs');const summary=el(estimate,'div');totals(summary);
  form.addEventListener('input',()=>{summary.replaceChildren();totals(summary);});
}
function operating(form){
  const module=registry[state.job];const data=state.operating[state.job]??=(state.job==='mechanic'?JSON.parse(BookStore.getItem('roadshop-shop-rates-v1')||'{}'):{});
  if(!module.fields.length)el(form,'p','Recurring bills cover your fixed costs. Continue to set your financial goals.');
  fields(form,data,module.fields);
}
function dashboard(){
  const mod=registry[state.job],p=state.profile,pref=Retention.prefs(state),today=localDay();
  const raw=validate(JSON.parse(BookStore.getItem('roadshop-ledger-v1')||'[]')),legacy=WorkPayments.rows(JSON.parse(BookStore.getItem('roadshop-quotes-v1')||'[]')),rows=[...new Map([...raw,...legacy].map(r=>[r.id,r])).values()];
  const money=n=>cash(n/100),report=Retention.report(state,rows,today,pref.period),notices=Retention.reminders(state,rows,today);
  const q=forecast(state,today),assumptions=state.operating[state.job]||{};
  const commercial=window.RoadCommercial?.status;logo(content);el(content,'h1',p.business);if(commercial?.announcement)el(content,'p',commercial.announcement);if(commercial&&!RoadCommercial.access(commercial))el(content,'p','Subscription inactive. Your records are available for viewing and export; new writes require an eligible plan.');el(content,'p',[mod.label,p.subtype].filter(Boolean).join(' · '));
  const nav=el(content,'div');nav.className='actions workspace-nav dashboard-nav';
  const links=[['finance','Finances','finance.html'],...(state.job==='truck'?[['truck','Trucking tools','trucking.html'],['quotes','Quotes (optional)','quotes.html']]:[]),...(state.job==='mechanic'?[['mechanic','Mechanic tools','mechanic.html'],['quotes','Legacy quotes','quotes.html']]:[]),['reports','Reports & reminders','reports.html'],['insights','Business insights','insights.html'],['tax','Taxes & planning','tax-planning.html'],['offline','Offline entry','offline.html'],['classic','Classic ledger','ledger.html?ledger'],['backup','Backup & Recovery','backup.html'],['billing','Billing','billing.html'],['support','Help & support','support.html'],...(commercial?.isAdmin?[['admin','Administration','admin.html']]:[])].filter(([k])=>!['reports','offline'].includes(k)||commercial?.flags?.[k]!==false);
  const link=(parent,s,url,tool)=>{const a=el(parent,'a',s);a.href=url;if(tool)a.dataset.tool=tool;};
  for(const [k,label,url] of links)if(!['billing','support','admin'].includes(k)&&!pref.quickHidden.includes(k)&&!(k==='quotes'&&state.hidden.includes('quotes'))&&!(state.job==='truck'&&k==='quotes'))link(nav,label,url,k);
  btn(nav,'Business settings',()=>go(1));
  const allTools=el(content,'details');el(allTools,'summary','All tools & shortcuts');const more=el(allTools,'div');more.className='workspace-nav dashboard-nav';for(const [k,label,url] of links)if(!(k==='quotes'&&state.job!=='truck'&&state.hidden.includes('quotes')))link(more,label,url,k);
  const name={actual:'Actual performance',health:'Business health',reminders:'Reminders',...features};
  const metric=(parent,k,v)=>{const a=el(parent,'p');el(a,'small',k);el(a,'strong',v)};
  function widget(k){const n=el(content,'section');n.className='card retention-widget';el(n,'h2',name[k]);switch(k){
  case 'actual':{el(n,'small',report.current.from+' – '+report.current.to+' · recorded transactions');const grid=el(n,'div');grid.className='retention-metrics';for(const [label,v] of [['Revenue',report.a.income],['Expenses',report.a.expense],['Profit',report.a.net],['Cash movement',report.a.cash]])metric(grid,label,money(v));if(report.goal?.target)el(n,'p','Profit goal: '+money(report.goal.actual)+' of '+money(report.goal.target));link(n,'Full business report','reports.html');break;}
  case 'health':{for(const x of Retention.health(state,rows,today)){const line=el(n,'p');el(line,'strong',x.name+' · ');const status=el(line,'span',x.status==='unknown'?'Not enough data':x.status==='good'?'Good':x.status==='watch'?'Watch':'Needs attention');status.className='health-'+x.status;}link(n,'How indicators are calculated','reports.html?tab=health');break;}
  case 'reminders':{el(n,'p',notices.length?notices.length+' reminder(s) need review':'No active reminders.');for(const x of notices.slice(0,3))link(el(n,'p'),x.date+' · '+x.label,x.route);link(n,'Manage reminders','reports.html?tab=reminders');break;}
  case 'fixed':totals(n);break;
  case 'breakEven':el(n,'p',cash(q.breakEven)+' per week to cover configured operating costs.');if(state.job==='mechanic'&&+assumptions.hourly>0)el(n,'small',(q.breakEven/assumptions.hourly).toFixed(1)+' billed labor hours per week at configured rate.');break;
  case 'target':el(n,'p',cash(q.target)+' per week · '+cash(q.target*52/12)+' per month');el(n,'small','Planning estimate from configured costs and goals.');break;
  case 'upcoming':if(!q.upcoming.length)el(n,'p','No upcoming bills.');for(const b of q.upcoming.slice(0,5))el(n,'p',b.date+' · '+b.name+' · '+cash(+b.amount));link(n,'Recurring bills','finance.html?tab=bills');break;
  }}
  if(state.job==='truck'){
    const n=el(content,'section');n.className='card retention-widget';n.dataset.cardId='eia-diesel';el(n,'h2','U.S. weekly diesel price');
    const grid=el(n,'div');grid.className='retention-metrics';const price=el(el(grid,'p'),'strong'),change=el(grid,'p'),date=el(n,'small');
    const cacheKey='earnkeep-public-eia-diesel-v1',seed={series:'EMD_EPD2D_PTE_NUS_DPG',week:'2026-11-23',price:5.695,previousWeek:'2026-11-16',previousPrice:5.937};
    let latest=seed;
    function valid(v){return v?.series===seed.series&&Finance.day(v.week)&&Finance.day(v.previousWeek)&&v.week<=today&&v.previousWeek<v.week&&[v.price,v.previousPrice].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<30)&&(Date.parse(v.week)-Date.parse(v.previousWeek))/86400000>=6&&(Date.parse(v.week)-Date.parse(v.previousWeek))/86400000<=8;}
    function show(v){price.textContent='USD '+v.price.toFixed(3)+' / gal';const delta=v.price-v.previousPrice;change.textContent=(delta>0?'Up ':delta<0?'Down ':'Unchanged · ')+Math.abs(delta*100).toFixed(1)+'¢ vs previous week';date.textContent='Week of '+v.week+((Date.parse(today)-Date.parse(v.week))/86400000>=7?' · Latest available; check for newer release':'')+' · National retail average, not your actual purchase price.';}
    try{const saved=JSON.parse(localStorage.getItem(cacheKey)||'null');if(valid(saved)&&saved.week>=latest.week)latest=saved;}catch{}
    show(latest);link(n,'Source: U.S. Energy Information Administration','https://www.eia.gov/petroleum/gasdiesel/');
    fetch('data/eia-diesel.json',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'}).then(r=>{if(!r.ok)throw Error('Feed unavailable');return r.json()}).then(v=>{if(!valid(v)||v.week<latest.week)throw Error('Invalid or older observation');latest=v;try{localStorage.setItem(cacheKey,JSON.stringify(v))}catch{}show(v);}).catch(()=>{date.textContent+=' · Refresh unavailable; showing saved price.';});
  }
  if(state.job==='truck'){
    const n=el(content,'section');n.className='card retention-widget';n.dataset.cardId='fleet-fuel-economy';el(n,'h2','Fleet fuel economy');
    const from=report.current.from,to=report.current.to,fmt=v=>v===null?'Not available':v.toFixed(2)+' MPG',company=Trucking.fuelEconomy(rows,null,from,to);
    el(n,'small',from+' – '+to+' · recorded fuel purchases');
    const grid=el(n,'div');grid.className='retention-metrics';metric(grid,'Company average diesel MPG',fmt(company.diesel.mpg));metric(grid,'Company average DEF MPG',fmt(company.def.mpg));
    const list=el(n,'details');el(list,'summary','MPG by truck');for(const t of state.trucking?.trucks||[]){const e=Trucking.fuelEconomy(rows,t,from,to),line=el(list,'p');el(line,'strong',t.name+' · ');line.append('Diesel '+fmt(e.diesel.mpg)+' · DEF '+fmt(e.def.mpg));}
    el(n,'small','Weighted purchase-based averages: matched miles divided by gallons for each fuel type. Missing odometer baselines are excluded. Partial fills and separate DEF stops can affect estimates.');
    link(n,'Trucking overview','trucking.html');
  }
  for(const k of pref.order)if(!pref.hidden.includes(k))widget(k);
  const prefs=el(content,'details');el(prefs,'summary','Customize dashboard and navigation');
  const persist=async(next)=>{state.retention={...pref,...next};await save();render();[...content.querySelectorAll('details')].at(-1).open=true;};
  const period=el(el(prefs,'label','Reporting period'),'select');for(const [k,l] of [['week','Week to date'],['month','Month to date']])period.add(new Option(l,k));period.value=pref.period;period.onchange=()=>persist({period:period.value}).catch(e=>feedback.textContent=e.message);
  el(prefs,'h3','Widgets');for(const [i,k] of pref.order.entries()){const line=el(prefs,'div');line.className='retention-preference';const label=el(line,'label'),check=el(label,'input');check.type='checkbox';check.checked=!pref.hidden.includes(k);label.append(' '+name[k]);check.onchange=()=>persist({hidden:check.checked?pref.hidden.filter(x=>x!==k):[...pref.hidden,k]}).catch(e=>feedback.textContent=e.message);for(const [delta,labelText] of [[-1,'↑'],[1,'↓']]){const b=btn(line,labelText,()=>{const order=pref.order.slice();[order[i],order[i+delta]]=[order[i+delta],order[i]];return persist({order})});b.disabled=i+delta<0||i+delta>=pref.order.length;b.setAttribute('aria-label','Move '+name[k]+(delta<0?' up':' down'));}}
  el(prefs,'h3','Quick actions');for(const [k,l] of links.filter(([k])=>!['billing','support','admin'].includes(k)&&!(state.job==='truck'&&k==='quotes'))){const label=el(prefs,'label'),check=el(label,'input');check.type='checkbox';check.checked=!pref.quickHidden.includes(k);label.append(' '+l);check.onchange=()=>persist({quickHidden:check.checked?pref.quickHidden.filter(x=>x!==k):[...pref.quickHidden,k]}).catch(e=>feedback.textContent=e.message);}
  el(prefs,'small','Hidden shortcuts remain in All tools. Business settings always stays available.');
  const theme=el(el(prefs,'label','Theme'),'select');for(const k of ['system','light','dark'])theme.add(new Option(k,k));theme.value=window.RoadTheme?.get?.()||'dark';theme.onchange=()=>{window.RoadTheme.set(theme.value);persist({theme:theme.value}).catch(e=>feedback.textContent=e.message);};
  btn(prefs,'Reset dashboard layout',()=>persist({order:Retention.widgets.slice(),hidden:[],quickHidden:[],period:'week'}));
}
function render(){
  content.replaceChildren();const step=state.step;
  if(step===5 && registry[state.job])return dashboard();
  el(content,'p','Step '+step+' of 5');el(content,'h1',pages[step-1]);
  const form=el(content,'form');form.id='wizard';form.className='qform card';
  if(state.complete){form.dataset.editSettings='';el(form,'h2',pages[step-1]+' settings');}
  if(step===1)profile(form);if(step===2)bills(form);if(step===3)operating(form);if(step===4)fields(form,state.goals,goals);
  const actions=el(form,'div');actions.className='actions';actions.dataset.cardAction='';
  if(step>1)btn(actions,'Back',()=>go(step-1));btn(actions,'Save progress',save);
  if(state.complete)btn(actions,'Return to dashboard',()=>{if(form.reportValidity() && registry[state.job])return go(5);});
  const next=el(actions,'button',step===4?(state.job==='mechanic'&&!state.complete?'Open ledger':'Open dashboard'):'Continue');next.type='submit';next.className='primary';
  form.onsubmit=async e=>{e.preventDefault();if(next.disabled)return;next.disabled=true;const wasComplete=state.complete;if(step===4)state.complete=true;try{await go(step+1);if(step===4&&!wasComplete&&state.job==='mechanic')location.replace('ledger.html?ledger');}catch{state.step=step;state.complete=wasComplete;next.disabled=false;}};
  if(state.complete){const legacy=el(content,'a','Open ledger');legacy.href='ledger.html?ledger';}
}
render();
