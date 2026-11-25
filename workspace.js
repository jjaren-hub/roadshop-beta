'use strict';
const {registry,goals,periods,key,forecast}=Planning;
const content=document.getElementById('content'), feedback=document.getElementById('feedback');
const original=BookStore.getItem(key);
const state=original?JSON.parse(original):{version:2,step:1,complete:false,job:'',profile:{business:BookStore.name},bills:[],operating:{},goals:{},hidden:[]};
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
  el(parent,'p','Weekly '+cash(q.weekly)+' · Monthly '+cash(q.monthly)+' · Annual '+cash(q.annual));
}
async function go(step){
  state.step=step;await save();render();window.scrollTo(0,0);
}
function profile(form){
  const pick=field(form,{},'occupation','Occupation',{choices:Object.values(registry).map(m=>m.label),required:true});
  pick.value=registry[state.job]?.label||'';
  pick.onchange=()=>{state.job=Object.keys(registry).find(k=>registry[k].label===pick.value)||'';state.profile.subtype='';changed();render();};
  const mod=registry[state.job];if(mod?.types.length)field(form,state.profile,'subtype','Type of business',{choices:mod.types});
  field(form,state.profile,'business','Business name',{required:true});
  for(const [id,label,type] of [['owner','Owner name'],['email','Business email','email'],['phone','Business phone','tel'],['address','Business address']])field(form,state.profile,id,label,{type});
  field(form,state.profile,'structure','Business structure',{choices:['Sole proprietorship','LLC','Partnership','Corporation','Other']});
  const upload=el(el(form,'label','Business logo (optional, PNG or JPEG up to 200 KB)'),'input');upload.type='file';upload.accept='image/png,image/jpeg';
  upload.onchange=async()=>{const file=upload.files[0];if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>200000){feedback.textContent='Choose a PNG or JPEG under 200 KB.';return;}
    const reader=new FileReader();reader.onload=async()=>{state.profile.logo=reader.result;try{await save();render();}catch{}};reader.readAsDataURL(file);};
  if(state.profile.logo){logo(form);btn(form,'Remove logo',async()=>{delete state.profile.logo;await save();render();});}
}
function logo(parent){if(/^data:image\/(png|jpeg);base64,/.test(state.profile.logo||'')){const img=el(parent,'img');img.src=state.profile.logo;img.alt='Business logo';img.width=72;}}
function bills(form){
  const suggestions=registry[state.job]?.suggestions||[];
  const select=el(el(form,'label','Suggested expense'),'select');
  for(const title of ['Custom expense',...suggestions])select.add(new Option(title));
  btn(form,'Add recurring expense',()=>{const label=select.value==='Custom expense'?'':select.value;
    state.bills.push({name:label,category:label,frequency:'Monthly',amount:'',due:localDay(),end:''});changed();render();});
  state.bills.forEach((b,i)=>{
    const box=el(form,'fieldset');el(box,'legend','Bill '+(i+1));
    field(box,b,'name','Expense name',{required:true});field(box,b,'category','Expense category',{required:true});
    const amount=field(box,b,'amount','Amount ($)',{type:'number',required:true});amount.min='.01';amount.step='.01';
    field(box,b,'frequency','Payment frequency',{choices:Object.keys(periods),required:true});
    const due=field(box,b,'due','Next due date',{type:'date',required:true}), end=field(box,b,'end','End date (optional)',{type:'date'});
    end.min=due.value;due.addEventListener('input',()=>end.min=due.value);
    btn(box,'Remove bill',()=>{state.bills.splice(i,1);changed();render();});
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
  const mod=registry[state.job],p=state.profile,q=forecast(state,localDay());
  logo(content);el(content,'h1',p.business);el(content,'p',[mod.label,p.subtype].filter(Boolean).join(' · '));
  const nav=el(content,'div');nav.className='actions';
  const link=(s,url)=>{const a=el(nav,'a',s);a.href=url;};
  link('Open ledger','./?ledger');if(state.job==='mechanic'&&!state.hidden.includes('quotes'))link(features.quotes,'quotes.html');
  btn(nav,'Edit business settings',()=>go(1));
  function card(id){if(state.hidden.includes(id))return;const n=el(content,'section');n.className='card';el(n,'h2',features[id]);return n;}
  const fixed=card('fixed');if(fixed)totals(fixed);
  const be=card('breakEven');if(be)el(be,'p',cash(q.breakEven)+' per week to cover configured operating costs.');
  const assumptions=state.operating[state.job]||{};
  if(be && state.job==='mechanic' && +assumptions.hourly>0)
    el(be,'small',(q.breakEven/assumptions.hourly).toFixed(1)+' billed labor hours per week at your hourly rate.');
  const target=card('target');if(target){
    el(target,'p',cash(q.target)+' per week · '+cash(q.target*52/12)+' per month');
    if(state.job==='truck' && +assumptions.days>0)el(target,'p',cash(q.target/assumptions.days)+' per working day.');
    if(q.projected!==null)el(target,'p',cash(q.projected)+' weekly '+(state.job==='truck'?'loaded-mile revenue':'labor revenue')+' at your configured rates.');
    el(target,'small','Estimates use entered costs and goals. Blank inputs count as zero. Reserves and owner pay use after-tax profit; the larger profit requirement sets the target.');
  }
  const upcoming=card('upcoming');if(upcoming){if(!q.upcoming.length)el(upcoming,'p','No upcoming bills.');for(const b of q.upcoming)el(upcoming,'p',b.date+' · '+b.name+' · '+cash(+b.amount));}
  const prefs=el(content,'details');el(prefs,'summary','Customize dashboard and navigation');
  for(const [id,name] of Object.entries(features)){if(id==='quotes'&&state.job!=='mechanic')continue;
    const label=el(prefs,'label'),check=el(label,'input');check.type='checkbox';check.checked=!state.hidden.includes(id);label.append(' Show '+name);
    check.onchange=async()=>{state.hidden=state.hidden.filter(x=>x!==id);if(!check.checked)state.hidden.push(id);try{await save();render();content.querySelector('details').open=true;}catch{}};
  }
}
function render(){
  content.replaceChildren();const step=state.step;
  if(step===5 && registry[state.job])return dashboard();
  el(content,'p','Step '+step+' of 5');el(content,'h1',pages[step-1]);
  const form=el(content,'form');form.id='wizard';form.className='qform card';
  if(step===1)profile(form);if(step===2)bills(form);if(step===3)operating(form);if(step===4)fields(form,state.goals,goals);
  const actions=el(form,'div');actions.className='actions';
  if(step>1)btn(actions,'Back',()=>go(step-1));btn(actions,'Save progress',save);
  const next=el(actions,'button',step===4?'Open dashboard':'Continue');next.type='submit';next.className='primary';
  form.onsubmit=async e=>{e.preventDefault();if(next.disabled)return;next.disabled=true;if(step===4)state.complete=true;try{await go(step+1);}catch{state.step=step;next.disabled=false;}};
  const legacy=el(content,'a','Open ledger');legacy.href='./?ledger';
}
render();
