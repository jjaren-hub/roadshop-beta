'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 function button(parent,text,action){const b=el('button',text);b.type='button';b.onclick=async()=>{try{await action()}catch(e){if(e.name!=='AbortError')alert(e.message||'Action could not be completed.')}};parent.append(b);return b}
 function download(file){const a=el('a');const url=URL.createObjectURL(file);a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 async function shareLink(url,title){if(navigator.share)return navigator.share({title,url});try{await navigator.clipboard.writeText(url);alert('Link copied. Paste it in a text or email.')}catch{prompt('Copy this link to send:',url)}}
 const link=(page,data)=>new URL(page,location.href).href.split('#')[0]+'#'+Q.encode(data);
 function preview(parent,q){const card=el('div',undefined,'card');card.append(el('h2',q.shop),el('p',q.contact));const body=el('div',undefined,'qinfo');body.textContent=Q.lines(q).slice(2).join('\n');card.append(body);parent.append(card)}
 function pdfButton(parent,q){let file;const b=button(parent,'Preparing PDF…',async()=>{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Repair estimate '+q.id});else download(file)});b.disabled=true;Q.pdf(q).then(f=>{file=f;b.textContent='Share / save PDF';b.disabled=false}).catch(()=>{b.textContent='Print / save PDF';b.disabled=false;b.onclick=()=>{window.print()}})}
 if($('customerView')){
  const root=$('customerView');root.replaceChildren();
  try{const q=Q.validate(Q.decode(location.hash.slice(1)));preview(root,q);const actions=el('div',undefined,'qactions');root.append(actions);pdfButton(actions,q);button(actions,'Print',()=>window.print());
   root.append(el('p','Legacy estimate copy: the contents are not authenticated. Contact the shop using an independently verified number to confirm pricing and approval. Online approval is disabled.'));
  }catch{root.textContent='This estimate link is incomplete or invalid. Ask the shop to resend it.'}return;
 }
 const key='roadshop-quotes-v1';const read=()=>JSON.parse(BookStore.getItem(key)||'[]');
 async function save(q){const all=read();const i=all.findIndex(x=>x.id===q.id);if(i>=0&&all[i].paid)q.paid=all[i].paid;if(i===-1)all.unshift(q);else all[i]=q;await BookStore.setItem(key,JSON.stringify(all))}
 async function deleteQuote(q){const all=read(),latest=all.find(x=>x.id===q.id);if(!latest||latest.paid||latest.approval)throw Error('Only unpaid, unapproved estimates can be deleted.');if(!confirm('Permanently delete this mistaken estimate for '+latest.customer+'?'))return;await BookStore.setItem(key,JSON.stringify(all.filter(x=>x.id!==latest.id)));list();$('status').textContent='Estimate deleted.';}
 function deleteButton(p,q){if(!q.paid&&!q.approval){const b=button(p,'Delete quote',()=>deleteQuote(q));b.className='danger-action';}}
 function screen(id){for(const x of ['list','compose','view'])$(x).hidden=x!==id;$('status').textContent='';window.scrollTo(0,0)}
 function list(){
   screen('list');const cards=$('cards');cards.replaceChildren();
   const profile=JSON.parse(BookStore.getItem(Planning.key)||'{}')||{};
   showJobList(cards,read(),Mechanic.state(profile).jobs,(card,record,quick)=>{
     if(quick){button(card,'Open estimate',()=>view(record));deleteButton(card,record);}
     else {const a=el('a','Open work order');a.href='mechanic.html?job='+encodeURIComponent(record.id);card.append(a);}
   });
 }
 function input(label,key,type,value,max){const l=el('label',label);const i=el('input');i.dataset.field=key;i.type=type;i.value=value??'';i.required=true;if(type==='number'){i.min=key==='qty'?'.01':'0';i.step='.01';i.max=max}else i.maxLength=max;l.append(i);return l}
 const ratesKey='roadshop-shop-rates-v1';
 function shopRates(){const profile=JSON.parse(BookStore.getItem(Planning.key)||'null');
 if(profile?.job==='mechanic')return {...JSON.parse(BookStore.getItem(ratesKey)||'{}'),...profile.operating.mechanic};
 return JSON.parse(BookStore.getItem(ratesKey)||'{"markup":0,"hourly":null}')}
 function assignRates(markup,hourly,rates){$(markup).value=rates.markup??'';$(hourly).value=rates.hourly??'';$(markup==='markup'?'mileageRate':'defaultMileage').value=rates.mileage??''}
 async function saveRates(markup,hourly){
   for(const id of [markup,hourly]){
     const field=$(id);
     if(field.value===''){field.focus();alert('Enter both shop rates. Use zero for a free rate.');return}
     if(!field.reportValidity())return;
   }
   const mile=$(markup==='markup'?'mileageRate':'defaultMileage');if(!mile.reportValidity())return;const rates={mileage:mile.value===''?null:Number(mile.value),markup:Number($(markup).value),hourly:Number($(hourly).value)};
   try{const profile=JSON.parse(BookStore.getItem(Planning.key)||'null');
   if(profile?.job==='mechanic'){profile.operating.mechanic={...profile.operating.mechanic,...rates};await BookStore.setItem(Planning.key,JSON.stringify(profile));}
   else await BookStore.setItem(ratesKey,JSON.stringify(rates));assignRates('defaultMarkup','defaultHourly',rates);alert('Shop rates saved.')}
   catch{alert('Could not save rates on this device.')}
 }
 assignRates('defaultMarkup','defaultHourly',shopRates());
 $('rateForm').onsubmit=async e=>{e.preventDefault();saveRates('defaultMarkup','defaultHourly')};
 $('remember').onclick=()=>saveRates('markup','hourly');
 const scaled=value=>Math.round(Number(value)*100);
 const field=(div,key)=>div.querySelector('[data-field="'+key+'"]');
 function item(line,kind='part'){
   if($('items').children.length>=12)return alert('A quote can contain up to 12 lines.');
   if(line)kind=['part','labor','mileage'].includes(line.kind)?line.kind:'manual';
   const div=el('div',undefined,'qitem'),grid=el('div',undefined,'qgrid');
   div.dataset.kind=kind;
   div.append(el('h3',{part:'Part',labor:'Labor',mileage:'Mobile service mileage',manual:'Fee / manual line'}[kind]),
     input('Item or service','label','text',line?.label??(kind==='labor'?'Labor':kind==='mileage'?'Service travel (miles)':''),70),grid);
   grid.append(input(kind==='labor'?'Hours':kind==='mileage'?'Billable miles':'Quantity','qty','number',(line?.qty??100)/100,9999));
   if(kind!=='labor'&&kind!=='mileage')grid.append(input(kind==='part'?'Price paid per part ($)':'Your unit cost ($) · private','cost','number',line?line.cost/100:(kind==='manual'?0:''),999999));
   if(kind==='manual')grid.append(input('Customer unit price ($)','rate','number',line?line.rate/100:'',999999));
   if(kind==='labor'&&line?.cost)div.dataset.laborCost=line.cost;
   div.append(el('p','','line-result'));button(div,'Remove line',()=>{div.remove();calc()});$('items').append(div);calc();
 }
 function readLine(div){
   const kind=div.dataset.kind,qty=scaled(field(div,'qty').value),cost=kind==='mileage'?0:kind==='labor'?Number(div.dataset.laborCost||0):scaled(field(div,'cost').value);
   let rate;
   if(kind==='part')rate=Math.round(cost*(10000+scaled($('markup').value))/10000);
   else if(kind==='labor')rate=scaled($('hourly').value);
   else if(kind==='mileage')rate=scaled($('mileageRate').value);
   else rate=scaled(field(div,'rate').value);
   return {kind,label:field(div,'label').value.trim(),qty,cost,rate};
 }
 function inputs(){return Array.from($('items').children,readLine)}
 function calc(){
   const items=inputs();
   $('mileageRate').required=items.some(i=>i.kind==='mileage');$('hourly').required=items.some(i=>i.kind==='labor');$('markup').required=items.some(i=>i.kind==='part');
   items.forEach((i,index)=>{
     const div=$('items').children[index],missing=i.kind==='mileage'&&$('mileageRate').value===''||i.kind==='labor'&&$('hourly').value===''||i.kind==='part'&&($('markup').value===''||field(div,'cost').value==='');
     div.querySelector('.line-result').textContent=missing?'Enter pricing to calculate this line.':'Customer price '+Q.dollars(i.rate)+(i.kind==='labor'?' / hour':i.kind==='mileage'?' / mile':' each')+' · Line total '+Q.dollars(Q.amount(i.qty,i.rate));
   });
   $('calc').textContent='Estimated total '+Q.dollars(Q.total({items,tax:scaled($('tax').value)}));
 }
 function compose(source){screen('compose');$('form').reset();assignRates('markup','hourly',source?.pricing??shopRates());$('editTitle').textContent=source?'Duplicate quote':'New quote';const last=read()[0];for(const k of ['shop','contact','customer','vehicle','description'])$(k).value=source?.[k]??(['shop','contact'].includes(k)?last?.[k]??'':'');$('expires').min=Q.today();$('expires').value=Q.today(30);$('tax').value=(source?.tax??0)/100;$('items').replaceChildren();for(const i of source?.items??[undefined])item(i);calc()}
 function view(q){screen('view');const v=$('view');v.replaceChildren();button(v,'All quotes',list);v.append(el('h1','Quote preview'));preview(v,q);const a=el('div',undefined,'qactions');v.append(a);pdfButton(a,q);if(!q.paid)button(a,'Record verified customer approval',async()=>{if(q.expires<Q.today())throw Error('Estimate expired; issue a new quote.');const name=prompt('Customer name as verified independently');if(!name?.trim()||name.trim().length>80)return;if(!confirm('Confirm you independently received and verified customer approval for this exact estimate. An old approval link is not proof.'))return;const latest=read().find(x=>x.id===q.id);if(!latest||latest.paid||latest.approval)throw Error('Reload this estimate before changing approval.');latest.approval={approvedBy:name.trim(),date:Q.today(),method:'manual-verified'};await save(latest);view(latest)});button(a,'Duplicate quote',()=>compose(q));deleteButton(a,q);const privateBox=el('div',undefined,'card');privateBox.append(el('h2','Shop only'),el('p','Margin before overhead and tax: '+Q.dollars(Q.total(q)-q.tax-q.items.reduce((n,i)=>n+Q.amount(i.qty,i.cost),0))),el('p',q.paid?'Payment recorded in the mechanic ledger.':q.approval?'Recorded approval from '+q.approval.approvedBy+' on '+q.approval.date+(q.approval.method==='manual-verified'?' (owner verified)':' (legacy, not authenticated)'):'Awaiting independently verified customer approval. Share the PDF, not a public link.'));v.append(privateBox);paymentControls(v,q)}
 function paymentControls(parent,q){
   if(q.paid){parent.append(el('p','Paid in full on '+q.paid.date));return}
   const panel=el('div',undefined,'card');panel.append(el('h2','Payment'));
   const label=el('label','Date received '),date=el('input');date.type='date';date.required=true;date.value=date.max=Q.today();label.append(date);panel.append(label);
   button(panel,'Mark paid',async()=>{
     if(!date.reportValidity())return;
     if(Q.total(q)<=0)throw Error('A paid order must have a positive total.');
     if(!confirm('Record full payment of '+Q.dollars(Q.total(q))+' on '+date.value+' and move this order to paid history?'))return;
     const post=async()=>{
       const latest=read().find(order=>order.id===q.id);if(!latest)throw Error('Work order could not be found.');
       if(!latest.paid){if(!Finance.day(date.value)||date.value>Q.today())throw Error('Enter actual payment date.');latest.paid={date:date.value};await save(latest)}
       list();$('status').textContent='Payment recorded in the ledger for '+q.id+'.';
     };
     if(navigator.locks)await navigator.locks.request('roadshop-payment',post);else await post();
   });parent.append(panel);
 }
 $('new').onclick=()=>compose();$('cancel').onclick=list;$('additem').onclick=()=>item();$('addMileage').onclick=()=>item(undefined,'mileage');$('addLabor').onclick=()=>item(undefined,'labor');$('addFee').onclick=()=>item(undefined,'manual');$('form').oninput=calc;
 $('form').onsubmit=async e=>{e.preventDefault();try{const q={id:'Q-'+crypto.randomUUID().replaceAll('-','').slice(0,12),issued:Q.today(),pricing:{mileage:$('mileageRate').value===''?null:Number($('mileageRate').value),markup:$('markup').value===''?null:Number($('markup').value),hourly:$('hourly').value===''?null:Number($('hourly').value)},tax:Math.round(Number($('tax').value)*100),items:inputs()};for(const k of ['shop','contact','customer','vehicle','description','expires'])q[k]=$(k).value.trim();Q.validate(q,true);await save(q);view(q)}catch(e){alert(e.message||'Could not save quote.')}};
 $('export').onclick=()=>download(new File([JSON.stringify({format:key,quotes:read()})],'roadshop-quotes.json',{type:'application/json'}));
 $('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>6000000)throw Error();const o=JSON.parse(await f.text());if(o.format!==key||!Array.isArray(o.quotes))throw Error();const all=read(),ids=new Set(all.map(q=>q.id));let added=0;for(const q of o.quotes){Q.validate(q,true);if(!ids.has(q.id)){all.push(q);ids.add(q.id);added++}}if(confirm('Import '+added+' new quotes?')){await BookStore.setItem(key,JSON.stringify(all));list()}}catch{alert('Could not import quote backup.')}finally{e.target.value=''}};
 function approval(){if(location.hash){history.replaceState(null,'',location.pathname+location.search);list();$('status').textContent='Legacy approval links are disabled because they cannot authenticate the customer. Verify the customer independently and record approval manually.';}else {
   const requested=new URLSearchParams(location.search).get('quote');
   const record=requested&&read().find(q=>q.id===requested);
   if(record)view(record);else {list();if(requested)$('status').textContent='This quote is unavailable in this business.';}
 }}
 window.addEventListener('hashchange',approval);approval();
})();
