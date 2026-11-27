const Finance=(()=>{
const classes={revenue:[1,1],expense:[-1,-1],interest:[-1,-1],principal:[0,-1],capital:[0,-1],escrow_out:[0,-1],escrow_in:[0,1],owner_draw:[0,-1],owner_contribution:[0,1],sales_tax:[0,1],sales_tax_paid:[0,-1],savings_out:[0,-1],savings_in:[0,1],other_transfer:[0,0]};
const schedules={Daily:365,Weekly:52,'Every two weeks':26,'Twice monthly':24,Monthly:12,Quarterly:4,Semiannual:2,Annual:1,'Custom days':0};
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const str=(v,n)=>typeof v==='string'&&v.length<=n;
const cents=v=>{const s=String(v).trim();if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(s))throw Error('Enter dollars with at most two decimals.');const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));};
const safe=n=>Number.isSafeInteger(n)&&n>0&&n<=9999999999;
const kind=r=>r.classification|| (r.type==='Income'?'revenue':r.type==='Expense'?'expense':({'Escrow contribution':'escrow_out','Escrow release':'escrow_in','Maintenance escrow contribution':'escrow_out','Maintenance escrow release':'escrow_in','Tire escrow contribution':'escrow_out','Tire escrow release':'escrow_in','Truck principal':'principal','Advance repayment':'principal','Advance received':'owner_contribution','Buyout reserve':'savings_out','Equipment reserve':'savings_out','Sales tax collected':'sales_tax'})[r.category]||'other_transfer');
const lines=r=>r.splits?.length?r.splits:[{cents:r.cents,category:r.category,classification:kind(r)}];
function check(r){if(!r||!str(r.id,80)||!day(r.date)||!safe(r.cents)||!str(r.category,100)||!r.category.trim()||!Object.hasOwn(classes,kind(r)))throw Error('Invalid transaction.');
for(const k of ['party','method','vehicle','equipment','settlement','job','source','externalId','billKey','reversalOf','ref','note'])if(r[k]!==undefined&&!str(r[k],k==='note'?250:180))throw Error('Invalid '+k);
if(r.sign!==undefined&&r.sign!==1&&r.sign!==-1||r.sign===-1&&!r.reversalOf)throw Error('Invalid reversal.');
if(r.splits!==undefined&&(!Array.isArray(r.splits)||r.splits.length<2||r.splits.length>50||r.splits.some(x=>!safe(x.cents)||!str(x.category,100)||!x.category.trim()||!Object.hasOwn(classes,x.classification))||r.splits.reduce((s,x)=>s+x.cents,0)!==r.cents))throw Error('Split amounts must match total.');
if(r.receipts!==undefined&&(!Array.isArray(r.receipts)||r.receipts.length>3||r.receipts.some(x=>!str(x.name,180)||!str(x.data,280000)||!/^data:(image\/(?:png|jpeg)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(x.data))))throw Error('Invalid receipt.');
if(r.audit!==undefined&&(!Array.isArray(r.audit)||r.audit.length>500||r.audit.some(x=>!str(x.at,40)||!str(x.action,40)||!str(x.detail,4000))))throw Error('Invalid audit.');
return r;}
function total(rows){let income=0,expense=0,cash=0;const categories=Object.create(null);for(const r of rows)for(const l of lines(r)){const [p,c]=classes[l.classification],n=l.cents*(r.sign||1);if(p===1)income+=n;if(p===-1){expense+=n;categories[l.category]=(categories[l.category]||0)+n;}cash+=c*n;}return {income,expense,net:income-expense,cash,margin:income?100*(income-expense)/income:0,categories};}
const fingerprint=r=>[r.date,r.cents,kind(r),r.category,r.party||'',r.ref||''].map(v=>String(v).trim().toLowerCase()).join('|');
const duplicate=(r,rows)=>rows.find(x=>x.id===r.id||r.externalId&&x.externalId===r.externalId&&(x.source||'')===(r.source||'')||r.billKey&&x.billKey===r.billKey||!r.reversalOf&&!x.reversalOf&&fingerprint(x)===fingerprint(r));
const audit=(r,action,detail='')=>[...(r.audit||[]),{at:new Date().toISOString(),action,detail:String(detail).slice(0,4000)}].slice(-500);
function reverse(r,date,id){if(!day(date)||r.sign===-1)throw Error('Invalid reversal.');const copy={...r,id,date,sign:-1,reversalOf:r.id,note:'Reversal of '+r.id,audit:audit({},'reversed',r.id)};delete copy.billKey;delete copy.externalId;delete copy.source;delete copy.receipts;return copy;}
const iso=d=>d.toISOString().slice(0,10);
function occurrence(b,n){const start=new Date(b.due+'T00:00:00Z');const days={Daily:1,Weekly:7,'Every two weeks':14,'Custom days':Number(b.interval)}[b.frequency];if(days){start.setUTCDate(start.getUTCDate()+days*n);return iso(start);}
if(b.frequency==='Twice monthly'){if(n===0)return b.due;const slot=n+(start.getUTCDate()>15?1:0);return iso(new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+Math.floor(slot/2),slot%2?16:1)));}
const step={Monthly:1,Quarterly:3,Semiannual:6,Annual:12}[b.frequency];if(!step)throw Error('Unknown schedule.');const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+step*n+1,0));d.setUTCDate(Math.min(start.getUTCDate(),d.getUTCDate()));return iso(d);}
function validSchedule(b){return day(b.due)&&Object.hasOwn(schedules,b.frequency)&&!(b.frequency==='Custom days'&&(!Number.isInteger(+b.interval)||+b.interval<1||+b.interval>3650))&&!['cancelled','paused'].includes(b.status);}
function firstIndex(b,from){if(from<=b.due)return 0;const a=new Date(b.due+'T00:00:00Z'),z=new Date(from+'T00:00:00Z'),days={Daily:1,Weekly:7,'Every two weeks':14,'Custom days':Number(b.interval)}[b.frequency];if(days)return Math.ceil((z-a)/86400000/days);const months=(z.getUTCFullYear()-a.getUTCFullYear())*12+z.getUTCMonth()-a.getUTCMonth();let n=b.frequency==='Twice monthly'?Math.max(0,months*2-1):Math.max(0,Math.floor(months/({Monthly:1,Quarterly:3,Semiannual:6,Annual:12}[b.frequency])));while(day(occurrence(b,n))&&occurrence(b,n)<from)n++;return n;}
function nextOccurrence(b,from){if(!validSchedule(b)||!day(from)||b.end&&b.end<from)return null;const d=occurrence(b,firstIndex(b,from));return day(d)&&(!b.end||d<=b.end)?d:null;}
function occurrences(b,from,to){if(!validSchedule(b)||!day(from)||!day(to)||to<from||b.end&&b.end<from)return [];const out=[],start=firstIndex(b,from);for(let i=start;i<start+50000;i++){const d=occurrence(b,i);if(!day(d)||d>to||b.end&&d>b.end)break;out.push(d);}return out;}
function estimate(b,units=0){if(b.variable&&b.variable!=='fixed'){const rate=Number(b.rate);if(!Number.isFinite(rate)||rate<0||!Number.isFinite(units)||units<0)throw Error('Invalid rate or activity.');const n=Math.round(b.variable==='revenue'?units*rate/100:units*rate*100);if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid variable amount.');return n;}return cents(b.amount||0);}
function annual(b,units=0){if(['paused','cancelled'].includes(b.status))return 0;if(b.frequency==='Custom days'&&(!Number.isInteger(+b.interval)||+b.interval<1))return 0;return estimate(b,units)*(b.frequency==='Custom days'?365/Number(b.interval):schedules[b.frequency]||0);}
const billId=(b,i)=>b.id||'legacy-'+i+'-'+String(b.due||'');
const billKey=(b,i,d)=>billId(b,i)+'@'+d;
const paid=(key,rows)=>rows.find(r=>r.billKey===key&&r.sign!==-1&&!rows.some(x=>x.reversalOf===r.id&&x.sign===-1));
function csvParse(s){const out=[];let row=[],field='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}else if(c==='"'&&!field)quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(field);out.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('Unclosed CSV quote.');if(field||row.length){row.push(field);out.push(row);}return out;}
// Quote every text cell and neutralize spreadsheet formulas, including hidden leading whitespace.
const csvCell=v=>{const s=String(v??'');return '"'+(/^[\s\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(s)?"'"+s:s).replaceAll('"','""')+'"';};
// Never remove a row referenced by another record or reversal.
function linkedForDeletion(r,p={},rows=[]){
 const id=r.id;
 return !!(id.startsWith('payment-')||r.billKey||r.job||r.settlement||r.reversalOf||r.sign===-1||rows.some(x=>x.reversalOf===id)||
 (p?.mechanic?.jobs||[]).some(j=>[...(j.costs||[]),...(j.payments||[])].some(x=>x.ledgerId===id))||
 (p?.scanner?.receipts||[]).some(x=>x.ledgerId===id)||
 (p?.trucking?.settlements||[]).some(x=>x.ledgerIds?.includes(id))||
 (p?.trucking?.loads||[]).some(x=>x.ledgerIds?.includes(id))||
 (p?.trucking?.leases||[]).some(x=>(x.payments||[]).some(y=>y.ledgerIds?.includes(id)))||
 (p?.trucking?.maintenance||[]).some(x=>x.ledgerIds?.includes(id))||
 (p?.taxPlanning?.assets||[]).some(x=>x.ledgerRef===id)||
 (p?.taxPlanning?.documents||[]).some(x=>x.ref===id));
}
function entryMode(r,p,rows){if(linkedForDeletion(r,p,rows))return 'linked';return r.fuel?'advanced':r.splits?.length||!['revenue','expense','other_transfer'].includes(kind(r))?'advanced':'simple';}
function editSimple(r,fields,p,rows){if(entryMode(r,p,rows)!=='simple')throw Error('Use the original transaction module or full editor.');const next={...r,...Object.fromEntries(Object.entries(fields).filter(([k])=>['trade','type','category','cents','date','ref','note'].includes(k))),id:r.id};if(r.classification!==undefined&&(next.type!==r.type||next.category!==r.category)){delete next.classification;next.classification=kind(next);}if(r.audit||r.classification||r.source||r.receipts?.length)next.audit=audit(r,'edited',JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k])=>!['audit','receipts'].includes(k)))));return check(next);}
function correctMistake(r,p,rows,id){
 if(linkedForDeletion(r,p,rows))throw Error('This transaction is linked or already reversed. Correct it in its original module.');
 return {...reverse(r,r.date,id),note:'Correction of mistaken entry '+r.id,audit:audit({},'entry correction',r.id+' — recorded in error; no actual refund')};
}
// Permanent deletion is for mistaken, unlinked records only. A legacy
// mistake correction may be deleted only together with its original.
function deletionIds(r,p,rows){
 const current=rows.find(x=>x.id===r.id);if(!current)throw Error('Entry no longer exists.');
 const original=current.sign===-1?rows.find(x=>x.id===current.reversalOf):current;
 if(!original||original.sign===-1||original.reversalOf)throw Error('Original entry unavailable.');
 const offsets=rows.filter(x=>x.reversalOf===original.id);
 if(offsets.length){
  const x=offsets[0];
  if(offsets.length!==1||x.sign!==-1||x.date!==original.date||x.cents!==original.cents||x.category!==original.category||kind(x)!==kind(original)||x.note!=='Correction of mistaken entry '+original.id||!x.audit?.some(a=>a.action==='entry correction')||JSON.stringify(lines(x))!==JSON.stringify(lines(original)))throw Error('Actual reversals must remain in the ledger.');
  const remaining=rows.filter(y=>y.id!==x.id);
  if(linkedForDeletion(original,p,remaining)||linkedForDeletion({...x,sign:1,reversalOf:undefined},p,remaining))throw Error('Linked entries cannot be deleted here.');
  return [original.id,x.id];
 }
 if(current.id!==original.id||linkedForDeletion(original,p,rows))throw Error('Linked or reversed entries cannot be deleted here.');
 return [original.id];
}
function canDeleteMistake(r,p,rows){try{deletionIds(r,p,rows);return true}catch{return false}}
function deleteMistake(r,p,rows){const ids=new Set(deletionIds(r,p,rows));return rows.filter(x=>!ids.has(x.id))}
return {classes,schedules,day,cents,safe,kind,lines,check,total,fingerprint,duplicate,audit,reverse,occurrence,occurrences,nextOccurrence,estimate,annual,billId,billKey,paid,csvParse,csvCell,linkedForDeletion,entryMode,editSimple,correctMistake,deletionIds,canDeleteMistake,deleteMistake};
})();