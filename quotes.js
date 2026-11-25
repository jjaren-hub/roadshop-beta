'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 function button(parent,text,action){const b=el('button',text);b.type='button';b.onclick=async()=>{try{await action()}catch(e){if(e.name!=='AbortError')alert(e.message||'Action could not be completed.')}};parent.append(b);return b}
 function download(file){const a=el('a');const url=URL.createObjectURL(file);a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 async function shareLink(url,title){if(navigator.share)return navigator.share({title,url});try{await navigator.clipboard.writeText(url);alert('Link copied. Paste it in a text or email.')}catch{prompt('Copy this link to send:',url)}}
 const link=(page,data)=>new URL(page,location.href).href.split('#')[0]+'#'+Q.encode(data);
 function preview(parent,q){const card=el('div',undefined,'card');card.append(el('h2',q.shop),el('p',q.contact));const body=el('div',undefined,'qinfo');body.textContent=Q.lines(q).slice(2).join('\n');card.append(body);parent.append(card)}
 function pdfButton(parent,q){let file;const b=button(parent,'Preparing PDF…',async()=>{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Repair estimate '+q.id});else download(file)});b.disabled=true;Q.pdf(q).then(f=>{file=f;b.textContent='Share / save PDF';b.disabled=false}).catch(()=>{b.textContent='Print / save PDF';b.disabled=false;b.onclick=()=>{const w=window.open(link('customer.html',Q.publicCopy(q)),'_blank');if(!w)alert('Open the customer preview and choose Print.')}})}
 if($('customerView')){
  const root=$('customerView');root.replaceChildren();
  try{const q=Q.validate(Q.decode(location.hash.slice(1)));preview(root,q);const actions=el('div',undefined,'qactions');root.append(actions);pdfButton(actions,q);button(actions,'Print',()=>window.print());
   if(q.expires<Q.today()){root.append(el('p','This estimate has expired. Contact the shop for a new quote.'));return}
   const label=el('label','Your name ');const name=el('input');name.maxLength=80;label.append(name);root.append(label,el('p','To approve, send the approval link back to the shop by text or email. Anyone with the quote link can view it.'));
   const hash=Q.digest(q);button(root,'Approve & send to shop',async()=>{if(!name.value.trim()){name.focus();name.reportValidity();return}const url=link('quotes.html',{id:q.id,approvedBy:name.value.trim(),date:Q.today(),hash:await hash});await shareLink(url,'Approval for '+q.id+' from '+name.value.trim())});name.required=true;
  }catch{root.textContent='This estimate link is incomplete or invalid. Ask the shop to resend it.'}return;
 }
 const key='roadshop-quotes-v1';const read=()=>JSON.parse(localStorage.getItem(key)||'[]');
 function save(q){const all=read();const i=all.findIndex(x=>x.id===q.id);if(i===-1)all.unshift(q);else all[i]=q;localStorage.setItem(key,JSON.stringify(all))}
 function screen(id){for(const x of ['list','compose','view'])$(x).hidden=x!==id;$('status').textContent='';window.scrollTo(0,0)}
 function list(){screen('list');const cards=$('cards');cards.replaceChildren();const all=read();if(!all.length)cards.append(el('p','Create a repair estimate to share with your customer.'));for(const q of all){const c=el('div',undefined,'card');c.append(el('h2',q.customer+' · '+Q.dollars(Q.total(q))),el('p',[q.vehicle,q.id,q.approval?'Approved':'Estimate',q.issued].filter(Boolean).join(' · ')));button(c,'Open estimate',()=>view(q));cards.append(c)}}
 function input(label,key,type,value,max){const l=el('label',label);const i=el('input');i.dataset.field=key;i.type=type;i.value=value??'';i.required=true;if(type==='number'){i.min=key==='qty'?'.01':'0';i.step='.01';i.max=max}else i.maxLength=max;l.append(i);return l}
 const ratesKey='roadshop-shop-rates-v1';
 function shopRates(){return JSON.parse(localStorage.getItem(ratesKey)||'{"markup":0,"hourly":null}')}
 function assignRates(markup,hourly,rates){$(markup).value=rates.markup??'';$(hourly).value=rates.hourly??''}
 function saveRates(markup,hourly){
   for(const id of [markup,hourly]){
     const field=$(id);
     if(field.value===''){field.focus();alert('Enter both shop rates. Use zero for a free rate.');return}
     if(!field.reportValidity())return;
   }
   const rates={markup:Number($(markup).value),hourly:Number($(hourly).value)};
   try{localStorage.setItem(ratesKey,JSON.stringify(rates));assignRates('defaultMarkup','defaultHourly',rates);alert('Shop rates saved on this device.')}
   catch{alert('Could not save rates on this device.')}
 }
 assignRates('defaultMarkup','defaultHourly',shopRates());
 $('rateForm').onsubmit=e=>{e.preventDefault();saveRates('defaultMarkup','defaultHourly')};
 $('remember').onclick=()=>saveRates('markup','hourly');
 const scaled=value=>Math.round(Number(value)*100);
 const field=(div,key)=>div.querySelector('[data-field="'+key+'"]');
 function item(line,kind='part'){
   if($('items').children.length>=12)return alert('A quote can contain up to 12 lines.');
   if(line)kind=['part','labor'].includes(line.kind)?line.kind:'manual';
   const div=el('div',undefined,'qitem'),grid=el('div',undefined,'qgrid');
   div.dataset.kind=kind;
   div.append(el('h3',{part:'Part',labor:'Labor',manual:'Fee / manual line'}[kind]),
     input('Item or service','label','text',line?.label??(kind==='labor'?'Labor':''),70),grid);
   grid.append(input(kind==='labor'?'Hours':'Quantity','qty','number',(line?.qty??100)/100,9999));
   if(kind!=='labor')grid.append(input(kind==='part'?'Price paid per part ($)':'Your unit cost ($) · private','cost','number',line?line.cost/100:(kind==='manual'?0:''),999999));
   if(kind==='manual')grid.append(input('Customer unit price ($)','rate','number',line?line.rate/100:'',999999));
   if(kind==='labor'&&line?.cost)div.dataset.laborCost=line.cost;
   div.append(el('p','','line-result'));button(div,'Remove line',()=>{div.remove();calc()});$('items').append(div);calc();
 }
 function readLine(div){
   const kind=div.dataset.kind,qty=scaled(field(div,'qty').value),cost=kind==='labor'?Number(div.dataset.laborCost||0):scaled(field(div,'cost').value);
   let rate;
   if(kind==='part')rate=Math.round(cost*(10000+scaled($('markup').value))/10000);
   else if(kind==='labor')rate=scaled($('hourly').value);
   else rate=scaled(field(div,'rate').value);
   return {kind,label:field(div,'label').value.trim(),qty,cost,rate};
 }
 function inputs(){return Array.from($('items').children,readLine)}
 function calc(){
   const items=inputs();
   $('hourly').required=items.some(i=>i.kind==='labor');$('markup').required=items.some(i=>i.kind==='part');
   items.forEach((i,index)=>{
     const div=$('items').children[index],missing=i.kind==='labor'&&$('hourly').value===''||i.kind==='part'&&($('markup').value===''||field(div,'cost').value==='');
     div.querySelector('.line-result').textContent=missing?'Enter pricing to calculate this line.':'Customer price '+Q.dollars(i.rate)+(i.kind==='labor'?' / hour':' each')+' · Line total '+Q.dollars(Q.amount(i.qty,i.rate));
   });
   $('calc').textContent='Estimated total '+Q.dollars(Q.total({items,tax:scaled($('tax').value)}));
 }
 function compose(source){screen('compose');$('form').reset();assignRates('markup','hourly',source?.pricing??shopRates());$('editTitle').textContent=source?'Duplicate quote':'New quote';const last=read()[0];for(const k of ['shop','contact','customer','vehicle','description'])$(k).value=source?.[k]??(['shop','contact'].includes(k)?last?.[k]??'':'');$('expires').min=Q.today();$('expires').value=Q.today(30);$('tax').value=(source?.tax??0)/100;$('items').replaceChildren();for(const i of source?.items??[undefined])item(i);calc()}
 function view(q){screen('view');const v=$('view');v.replaceChildren();button(v,'All quotes',list);v.append(el('h1','Quote preview'));preview(v,q);const a=el('div',undefined,'qactions');v.append(a);pdfButton(a,q);button(a,'Share approval link',()=>shareLink(link('customer.html',Q.publicCopy(q)),'Estimate '+q.id));button(a,'Duplicate quote',()=>compose(q));const privateBox=el('div',undefined,'card');privateBox.append(el('h2','Shop only'),el('p','Margin before overhead and tax: '+Q.dollars(Q.total(q)-q.tax-q.items.reduce((n,i)=>n+Q.amount(i.qty,i.cost),0))),el('p',q.approval?'Approval recorded from '+q.approval.approvedBy+' on '+q.approval.date:'Awaiting customer approval. Open their returned link on this device to record it.'));v.append(privateBox)}
 $('new').onclick=()=>compose();$('cancel').onclick=list;$('additem').onclick=()=>item();$('addLabor').onclick=()=>item(undefined,'labor');$('addFee').onclick=()=>item(undefined,'manual');$('form').oninput=calc;
 $('form').onsubmit=e=>{e.preventDefault();try{const q={id:'Q-'+crypto.randomUUID().replaceAll('-','').slice(0,12),issued:Q.today(),pricing:{markup:$('markup').value===''?null:Number($('markup').value),hourly:$('hourly').value===''?null:Number($('hourly').value)},tax:Math.round(Number($('tax').value)*100),items:inputs()};for(const k of ['shop','contact','customer','vehicle','description','expires'])q[k]=$(k).value.trim();Q.validate(q,true);save(q);view(q)}catch(e){alert(e.message||'Could not save quote.')}};
 $('export').onclick=()=>download(new File([JSON.stringify({format:key,quotes:read()})],'roadshop-quotes.json',{type:'application/json'}));
 $('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>6000000)throw Error();const o=JSON.parse(await f.text());if(o.format!==key||!Array.isArray(o.quotes))throw Error();const all=read(),ids=new Set(all.map(q=>q.id));let added=0;for(const q of o.quotes){Q.validate(q,true);if(!ids.has(q.id)){all.push(q);ids.add(q.id);added++}}if(confirm('Import '+added+' new quotes?')){localStorage.setItem(key,JSON.stringify(all));list()}}catch{alert('Could not import quote backup.')}finally{e.target.value=''}};
 async function approval(){if(!location.hash)return list();try{const r=Q.decode(location.hash.slice(1));const q=read().find(x=>x.id===r.id);if(!q)throw Error('Open this approval on the device and browser where the original quote is saved.');if(r.hash!==await Q.digest(q)||typeof r.approvedBy!=='string'||!r.approvedBy.trim()||r.approvedBy.length>80||typeof r.date!=='string'||!/^\d{4}-\d\d-\d\d$/.test(r.date)||r.date<q.issued||r.date>q.expires||r.date>Q.today())throw Error('This approval does not match the saved quote or validity dates.');view(q);if(q.approval)return;const box=el('div',undefined,'card');box.append(el('h2','Customer approval'),el('p',r.approvedBy+' approved '+q.id+' for '+Q.dollars(Q.total(q))+'. Confirm the reply came from your customer.'));button(box,'Record approval',()=>{q.approval={approvedBy:r.approvedBy,date:r.date};save(q);history.replaceState(null,'',location.pathname);view(q)});$('view').prepend(box)}catch(e){list();$('status').textContent=e.message}}
 window.addEventListener('hashchange',approval);approval();
})();
