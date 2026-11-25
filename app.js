'use strict';
const $ = id => document.getElementById(id);
const phone = window.Phone;
const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const localDate = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let rows=[], editing=null, pending=null, timer, healthy=true;
function notifyUser(msg){$('message').textContent=msg;$('message').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('message').hidden=true,5000)}
window.notifyUser=notifyUser;
async function save(list){try{if(!healthy)throw Error();const checked=validate(list);const data=JSON.stringify(checked);if(phone){if(!phone.save(data))throw Error()}else await BookStore.setItem('roadshop-ledger-v1',data);rows=checked;render();return true}catch(error){alert(error.message || 'Could not save. Check your connection, space and entry details.');return false}}
function line(container,label,detail,value,action){const el=document.createElement(action?'button':'div');el.className='row';const wrap=document.createElement('span'),sub=document.createElement('small'),amount=document.createElement('b');wrap.textContent=label;sub.textContent=detail;wrap.append(sub);amount.textContent=value;el.append(wrap,amount);if(action)el.onclick=action;container.append(el)}
function ledgerRows(){
  const payments=WorkPayments.rows(JSON.parse(BookStore.getItem('roadshop-quotes-v1')||'[]'));
  const indexed=new Map(rows.map(row=>[row.id,row]));
  for(const payment of payments)indexed.set(payment.id,payment);
  return Array.from(indexed.values());
}
window.addEventListener('storage',event=>{if(event.key==='roadshop-quotes-v1')render()});
window.addEventListener('pageshow',event=>{if(event.persisted)render()});
function render(){
  const list=ledgerRows().filter(r=>r.date.startsWith($('month').value+'-')&&($('scope').value==='All trades'||r.trade===$('scope').value)).sort((a,b)=>b.date.localeCompare(a.date));
  const t=totals(list);for(const k of ['income','expense','net'])$(k).textContent=money(t[k]);
  const ledger=$('rows'),cats=$('breakdown');ledger.replaceChildren();cats.replaceChildren();const sums=new Map();
  for(const r of list){line(ledger,r.category,[r.date,r.trade,r.ref,r.note].filter(Boolean).join(' · '),(r.type==='Expense'?'−':r.type==='Income'?'+':'↔ ')+money(r.cents),()=>edit(r));const key=r.type+' · '+r.category;sums.set(key,(sums.get(key)||0)+r.cents)}
  for(const [k,v] of [...sums].sort())line(cats,k,k.startsWith('Transfer')?'Excluded from profit':'',money(v));
  if(!list.length){ledger.textContent='No entries for this month.';cats.textContent='Category totals appear as you add entries.'}
}
function page(settings){$('book').hidden=settings;$('settings').hidden=!settings;$('home').setAttribute('aria-current',String(!settings));$('account').setAttribute('aria-current',String(settings));window.scrollTo(0,0);showPlan()}
function showPlan(){$('plan').textContent=phone?phone.plan():'All ledger features are unlocked during testing.';const p=phone?phone.monthlyPrice():'';$('price').textContent=p?p+' per month. Renews until canceled.':'No subscription or payment is collected in this test.';for(const k of ['buy','refresh','manage'])$(k).hidden=!phone||phone.plan()==='Development edition';if(phone&&phone.canWrite())$('buy').hidden=true}
window.showPlan=showPlan;
const businessProfile=JSON.parse(BookStore.getItem(Planning.key)||'null');
const workspaceTrade=Planning.registry[businessProfile?.job]?.trade;
if(workspaceTrade){
  for(const id of ['scope','trade']){
    const select=$(id);select.replaceChildren(new Option(workspaceTrade,workspaceTrade));
    select.disabled=true;
  }
}
function options(){const cat=$('category');cat.replaceChildren();for(const s of categories[$('trade').value][$('type').value])cat.add(new Option(s,s))}
function edit(r){
  if(r?.id.startsWith('payment-'))return notifyUser('Payment from work order '+r.ref+' · '+r.date);
  if(!healthy)return notifyUser('Local records could not be read. Export a backup first.');
  if(phone&&!phone.canWrite()){page(true);return}
  editing=r?.id??null;$('title').textContent=r?'Edit entry':'New entry';$('trade').value=r?.trade??workspaceTrade??($('scope').value==='Mechanic'?'Mechanic':'Trucking');$('type').value=r?.type??'Income';options();if(r)$('category').value=r.category;
  $('amount').value=r?(r.cents/100).toFixed(2):'';const today=localDate();$('date').value=r?.date??(today.startsWith($('month').value)?today:$('month').value+'-01');$('ref').value=r?.ref??'';$('note').value=r?.note??'';$('remove').hidden=!r;$('editor').showModal()
}
function ask(title,detail,fn){$('question').textContent=title;$('detail').textContent=detail;pending=fn;$('confirm').showModal()}
function receiveBackup(raw){try{const obj=JSON.parse(raw);if(obj.format!=='roadshop-v1')throw Error();const incoming=validate(obj.entries),known=new Set(rows.map(r=>r.id)),fresh=incoming.filter(r=>!known.has(r.id));if(!fresh.length)return notifyUser('No new entries in this backup.');ask('Import '+fresh.length+' entries?',(incoming.length-fresh.length)+' matching entries will keep their current version.',async()=>{if(await save([...rows,...fresh]))notifyUser('Backup imported.')})}catch{notifyUser('Invalid backup. Your current records are safe.')}}
window.receiveBackup=receiveBackup;
$('form').onsubmit=async e=>{e.preventDefault();const cents=parseAmount($('amount').value);if(!cents)return alert('Enter a positive amount with up to two decimal places.');const r={id:editing??crypto.randomUUID(),cents};for(const k of ['trade','type','category','date','ref','note'])r[k]=$(k).value.trim();if(await save(editing?rows.map(old=>old.id===editing?r:old):[...rows,r])){$('editor').close();$('month').value=r.date.slice(0,7);if($('scope').value!=='All trades')$('scope').value=r.trade;render()}};
$('remove').onclick=()=>ask('Delete this entry?','This removes it from the ledger and updates the report.',async()=>{if(await save(rows.filter(r=>r.id!==editing)))$('editor').close()});
$('cancel').onclick=()=>$('confirm').close();$('accept').onclick=()=>{$('confirm').close();pending?.();pending=null};
$('backup').onclick=()=>{if(phone)return phone.backup();const a=document.createElement('a');a.download='roadshop-backup.json';a.href=URL.createObjectURL(new Blob([JSON.stringify({format:'roadshop-v1',entries:ledgerRows()})],{type:'application/json'}));a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('restore').onclick=()=>{if(phone&&!phone.canWrite())return notifyUser('An active subscription is required to import entries.');if(phone)phone.restore();else $('file').click()};
$('file').onchange=async()=>{const f=$('file').files[0];if(f&&f.size<=12*1024*1024+128)receiveBackup(await f.text());else notifyUser('File is too large.');$('file').value=''};
$('add').onclick=()=>edit(null);$('close').onclick=()=>$('editor').close();$('trade').onchange=$('type').onchange=options;$('scope').onchange=$('month').onchange=render;$('account').onclick=()=>page(true);$('home').onclick=()=>page(false);$('buy').onclick=()=>phone.subscribe();$('manage').onclick=()=>phone.manage();$('refresh').onclick=()=>phone.refreshPlan();
$('month').value=localDate().slice(0,7);try{rows=validate(JSON.parse(phone?phone.read():BookStore.getItem('roadshop-ledger-v1')||'[]'))}catch{healthy=false;notifyUser('Could not read the ledger. Editing is disabled to protect existing records.')}page(false);render();
