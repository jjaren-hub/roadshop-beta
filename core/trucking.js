const Trucking=(()=>{
const F=Finance;
const defaults=[
['Linehaul','revenue'],['Empty mile pay','revenue'],['Fuel surcharge','revenue'],['Detention','revenue'],['Layover','revenue'],['Bonus','revenue'],['Fuel reimbursement','revenue'],['Diesel','expense'],['DEF','expense'],['Insurance','expense'],['Lease payment','expense'],['Dispatch fees','expense'],['Maintenance escrow contribution','escrow_out'],['Tire escrow contribution','escrow_out'],['Maintenance escrow release','escrow_in'],['Tire escrow release','escrow_in'],['Advance repayment','principal'],['Advance received','owner_contribution'],['Truck principal','principal'],['Truck interest','interest'],['Repairs & maintenance','expense'],['Other income','revenue'],['Other expense','expense']];
const presets=Object.fromEntries(defaults);
const normalize=x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
const standard=[
[/reimburse|fuel rebate|fuel credit|fuel discount/,'Fuel reimbursement'],[/fuel surcharge|\bfsc\b/,'Fuel surcharge'],[/\bdef\b|diesel exhaust fluid/,'DEF'],[/comdata miscellaneous/,'DEF'],[/empty mile|deadhead pay|deadhead mile/,'Empty mile pay'],[/linehaul|line haul/,'Linehaul'],[/detention/,'Detention'],[/layover/,'Layover'],[/bonus/,'Bonus'],[/tire.*escrow.*(release|withdraw)/,'Tire escrow release'],[/maintenance.*escrow.*(release|withdraw)/,'Maintenance escrow release'],[/tire.*escrow/,'Tire escrow contribution'],[/maintenance.*escrow/,'Maintenance escrow contribution'],[/dispatch/,'Dispatch fees'],[/insurance/,'Insurance'],[/lease|truck payment/,'Lease payment'],[/diesel|fuel purchase/,'Diesel'],[/advance repayment/,'Advance repayment']];
const blank=()=>({version:1,trucks:[],settlements:[],rules:[],leases:[],loads:[],mileage:[],maintenance:[],perdiem:[],ifta:[]});
function state(p){const v=p.trucking||blank();if(v.version!==1||Object.keys(blank()).some(k=>k!=='version'&&!Array.isArray(v[k])))throw Error('Invalid trucking records.');return structuredClone(v);}
const money=n=>F.cents(n||'0');
const num=(n,label='Value')=>{const v=Number(n||0);if(!Number.isFinite(v)||v<0||v>1e9)throw Error('Invalid '+label);return v;};
const round=n=>{if(!Number.isFinite(n)||!Number.isSafeInteger(Math.round(n)))throw Error('Amount out of range.');return Math.round(n);};
const requireDate=d=>{if(!F.day(d))throw Error('Enter a valid date.');return d;};
const clean=(v,max=100)=>String(v||'').trim().slice(0,max);
function suggest(label,rules=[]){const l=normalize(label);for(const r of rules){if(r.match&&l.includes(normalize(r.match)))return {category:r.category,classification:r.classification};}const cat=standard.find(([re])=>re.test(l))?.[1];return cat?{category:cat,classification:presets[cat]}:{category:'',classification:''};}
function parseCSV(raw,rules=[]){const [h,...lines]=F.csvParse(raw.replace(/^\uFEFF/,''));if(!h)throw Error('Empty CSV.');const cols=h.map(normalize);if(!cols.includes('description')||!cols.includes('amount'))throw Error('CSV needs description,amount; optional category,classification. Amounts may be signed; review direction.');return lines.filter(l=>l.some(Boolean)).map(l=>{const x=Object.fromEntries(cols.map((k,i)=>[k,l[i]||'']));const match=suggest(x.description,rules),cat=x.category||match.category,cls=x.classification||presets[cat]||match.classification;return {description:clean(x.description,180),category:cat,classification:cls,amount:x.amount.trim().replace(/^[+-]/,'')};});}
function settlement(s){
requireDate(s.date);if(!s.number?.trim()||!s.carrier?.trim()||!s.truck)throw Error('Settlement number, carrier and truck required.');
if(!Array.isArray(s.lines)||!s.lines.length||s.lines.length>300)throw Error('Review 1–300 settlement lines.');
let gross=0,deductions=0,credits=0;
const lines=s.lines.map(l=>{const cents=money(l.amount);if(!F.safe(cents)||!l.category?.trim()||!Object.hasOwn(F.classes,l.classification)||F.classes[l.classification][1]===0)throw Error('Every line requires a positive amount, category and cash direction.');if(l.classification==='revenue')gross+=cents;else if(F.classes[l.classification][1]<0)deductions+=cents;else credits+=cents;return {...l,cents};});
const net=gross+credits-deductions;const expected=String(s.net||'').trim();if(!/^-?\d{1,8}(\.\d{1,2})?$/.test(expected))throw Error('Enter statement net payment, including negative balances.');
const stated=money(expected.replace(/^-/,'') )*(expected.startsWith('-')?-1:1);
return {gross,deductions,credits,net,stated,difference:net-stated,lines};}
function duplicate(s,existing){return existing.find(x=>x.id!==s.id&&((normalize(x.carrier)===normalize(s.carrier)&&normalize(x.number)===normalize(s.number))||(s.document?.hash&&x.document?.hash===s.document.hash)));}
function row({id,date,truck,category,classification,cents,ref='',note='',source='',externalId='',settlement='',equipment=''}){const type=classification==='revenue'?'Income':['expense','interest'].includes(classification)?'Expense':'Transfer';return F.check({id,date,trade:'Trucking',type,category:clean(category),classification,cents,ref:clean(ref),note:clean(note,250),vehicle:clean(truck,180),equipment:clean(equipment,180),settlement:clean(settlement,180),source,externalId,audit:F.audit({},'created',source||'Trucking module')});}
// Fuel stops are represented by separate ledger rows, sharing a stable purchase ID.
function activeFuelRows(rows,t){
 const reversed=new Set(rows.filter(r=>r.sign===-1).map(r=>r.reversalOf));
 return rows.filter(r=>r.trade==='Trucking'&&r.source==='trucking-fuel'&&r.fuel&&r.sign!==-1&&!reversed.has(r.id)&&(!t||r.vehicle===t.name||r.vehicle===t.id));
}
// Weighted purchase-based economy. Each product has its own matched miles
// and gallons. Include zero-distance top-ups, exclude unknown baselines and
// reversed purchases. No averaging of rounded MPG values.
function fuelEconomy(rows,truck=null,from='',to='9999-12-31'){
 const result={diesel:{miles:0,gallons:0,mpg:null,stops:0},def:{miles:0,gallons:0,mpg:null,stops:0}};
 for(const r of activeFuelRows(rows)){
  if(r.date<from||r.date>to||truck&&(typeof truck==='object'?r.fuel.truckId!==truck.id&&r.vehicle!==truck.name&&r.vehicle!==truck.id:r.vehicle!==truck))continue;
  const k=r.category==='Diesel'?'diesel':r.category==='DEF'?'def':null;if(!k)continue;
  const f=r.fuel;if(!Number.isFinite(f.miles)||f.miles<0||!Number.isFinite(f.gallons)||f.gallons<=0)continue;
  const a=result[k];a.miles+=f.miles;a.gallons+=f.gallons;a.stops++;
 }
 for(const a of Object.values(result))if(a.gallons>0&&a.miles>0)a.mpg=a.miles/a.gallons;
 return result;
}
// Rolling 30 calendar days, including today. Planning only; never posts expenses.
function loadFuelEstimate(v,data,rows,profile,today){
 requireDate(today);
 const t=data.trucks.find(x=>x.name===v.truck||x.id===v.truck);if(!t)throw Error('Choose a truck to estimate fuel.');
 const from=new Date(Date.parse(today)-29*86400000).toISOString().slice(0,10);
 const miles=num(v.loaded,'loaded miles')+num(v.empty,'empty miles');
 const own=fuelEconomy(rows,t,from,today),fleet=fuelEconomy(rows,null,from,today);
 const result={from,to:today,miles};
 for(const k of ['diesel','def']){
  const configured=k==='diesel'?Number(profile?.operating?.truck?.mpg):0;
  const fallback=Number.isFinite(configured)&&configured>0?configured:null;
  const mpg=own[k].mpg??fleet[k].mpg??fallback;
  const source=own[k].mpg!==null?'Truck 30-day average':fleet[k].mpg!==null?'Company 30-day average':fallback!==null?'Configured diesel MPG':'No recorded average';
  result[k]={mpg,source,gallons:mpg===null?null:miles/mpg};
 }
 return result;
}
function currentMileage(t,data,rows){
 const readings=[t.startingMiles,...data.mileage.filter(x=>x.truck===t.name||x.truck===t.id).map(x=>Number(x.odometer)).filter(n=>n>0),...activeFuelRows(rows,t).map(x=>x.fuel.odometer)].filter(n=>Number.isSafeInteger(n)&&n>=0);
 return readings.length?Math.max(...readings):null;
}
function fuelPurchase(v,data,rows,today,id){
 const t=data.trucks.find(x=>x.id===v.truckId);if(!t)throw Error('Choose a truck first.');
 requireDate(v.date);if(v.date>today)throw Error('Fuel date cannot be in the future.');
 const location=clean(v.location,180);if(!location)throw Error('Enter fuel location.');
 const load=v.loadId?data.loads.find(x=>x.kind==='record'&&x.id===v.loadId&&x.truck===t.name):null;if(v.loadId&&!load)throw Error('Choose a load assigned to this truck.');
 const raw=String(v.odometer??'').trim();if(!/^\d+$/.test(raw))throw Error('Enter a whole truck odometer reading.');const odometer=num(raw,'truck odometer');if(!Number.isSafeInteger(odometer))throw Error('Invalid odometer.');
 const previous=currentMileage(t,data,rows);if(previous!==null&&odometer<previous)throw Error('Odometer cannot be below current mileage. Record purchases in odometer order.');
 if(activeFuelRows(rows,t).some(x=>x.date>v.date)||data.mileage.some(x=>(x.truck===t.name||x.truck===t.id)&&Number(x.odometer)>0&&x.date>v.date))throw Error('Record fuel purchases in date order to keep mileage accurate.');
 const miles=previous===null?null:odometer-previous;
 const parts=[['Diesel',v.dieselGallons,v.dieselPrice],['DEF',v.defGallons,v.defPrice]].map(([category,g,p])=>{const gallons=num(g,category+' gallons'),price=num(p,category+' price');if(gallons>0&&price<=0||price>0&&gallons<=0)throw Error('Enter both gallons and price for '+category+'.');const cents=round(gallons*price*100);if(gallons&&!F.safe(cents))throw Error('Invalid '+category+' total.');return {category,gallons,price,cents,mpg:gallons&&miles!==null&&miles>0?miles/gallons:null};}).filter(x=>x.gallons>0);
 if(!parts.length)throw Error('Enter diesel or DEF purchased.');
 const purchaseId=id();const added=parts.map(x=>F.check({...row({id:id(),date:v.date,truck:t.name,category:x.category,classification:'expense',cents:x.cents,ref:load?.number||'',note:'Fuel purchase at '+location,source:'trucking-fuel',externalId:purchaseId+'-'+x.category.toLowerCase()}),party:location,fuel:{purchaseId,truckId:t.id,loadId:load?.id||'',odometer,previous,miles,gallons:x.gallons,price:x.price,mpg:x.mpg}}));
 return {added,previous,odometer,miles,total:parts.reduce((n,x)=>n+x.cents,0),parts};
}
const loadStages=['Planned','Picked up','Delivered','Paid'];
function loadRevenue(v){
 const loaded=num(v.loaded,'loaded miles'),empty=num(v.empty,'empty miles'),linehaul=num(v.linehaul,'linehaul rate'),fsc=num(v.fsc,'fuel surcharge rate'),emptyRate=num(v.emptyRate,'empty mile rate');
 if(!loaded)throw Error('Enter loaded miles greater than zero.');
 const linehaulCents=round(loaded*linehaul*100),fscCents=round(loaded*fsc*100),emptyCents=round(empty*emptyRate*100),total=round(linehaulCents+fscCents+emptyCents);
 if(total&&!F.safe(total))throw Error('Load revenue is outside the supported range.');
 return {loaded,empty,linehaul,fsc,linehaulCents,fscCents,total,...(emptyRate?{emptyRate,emptyCents}:{})};
}
function loadRecord(v,existing,today,id){
 requireDate(today);const old=existing.find(x=>x.kind==='record'&&x.id===id);
 if(old?.stage==='Paid')throw Error('Paid loads are locked to preserve ledger history.');
 const number=clean(v.number,100),truck=clean(v.truck,100),pickupCity=clean(v.pickupCity,150),deliveryCity=clean(v.deliveryCity,150);
 if(!number||!truck||!pickupCity||!deliveryCity)throw Error('Enter load number, truck, pickup city and delivery city.');
 if(existing.some(x=>x.kind==='record'&&x.id!==id&&normalize(x.number)===normalize(number)))throw Error('This load number is already recorded.');
 requireDate(v.pickupDate);requireDate(v.deliveryDate);if(v.deliveryDate<v.pickupDate)throw Error('Delivery cannot precede pickup.');
 if(!loadStages.slice(0,3).includes(v.stage))throw Error('Choose Planned, Picked up or Delivered.');
 if(v.stage!=='Planned'&&v.pickupDate>today||v.stage==='Delivered'&&v.deliveryDate>today)throw Error('Actual pickup or delivery cannot be in the future.');
 if(v.linehaul===''||v.linehaul==null||v.fsc===''||v.fsc==null)throw Error('Enter both rates; use zero if not applicable.');
 const revenue=loadRevenue(v),comments=String(v.comments??old?.comments??'').trim();if(comments.length>2000)throw Error('Load comments must be 2,000 characters or fewer.');
 return {kind:'record',id,number,truck,pickupDate:v.pickupDate,pickupCity,pickupAddress:clean(v.pickupAddress,250),deliveryDate:v.deliveryDate,deliveryCity,deliveryAddress:clean(v.deliveryAddress,250),stage:v.stage,...revenue,...(comments?{comments}:{})};
}
function loadPaymentParts(load){const q=loadRevenue(load);return [['Linehaul',q.linehaulCents],['Empty mile pay',q.emptyCents||0],['Fuel surcharge',q.fscCents]].filter(([,cents])=>cents>0);}
function loadPaymentMatches(load,ledger,date,category,cents){
 return ledger.filter(r=>r.trade==='Trucking'&&(!r.vehicle||r.vehicle===load.truck)&&r.sign!==-1&&!r.reversalOf&&!r.splits?.length&&!ledger.some(x=>x.reversalOf===r.id&&x.sign===-1)&&F.kind(r)==='revenue'&&normalize(r.category)===normalize(category)&&r.cents===cents&&(r.date===date||normalize(r.ref)===normalize(load.number)));
}
function payLoad(load,loads,ledger,date,today,links={},newId){
 if(load.kind!=='record'||load.stage!=='Delivered'||!loads.some(x=>x.id===load.id&&x.stage==='Delivered'))throw Error('Only an unpaid delivered load can be marked paid.');
 requireDate(date);requireDate(today);if(date<load.deliveryDate||date>today)throw Error('Payment date must be on or after delivery and not in the future.');
 if(!loadRevenue(load).total)throw Error('Enter positive revenue before recording payment.');
 if(ledger.some(r=>r.source==='trucking-load'&&r.externalId?.startsWith(load.id+'-')))throw Error('Load payment already exists.');
 const used=new Set(loads.flatMap(x=>x.ledgerIds||[])),added=[],ids=[];
 for(const [category,cents] of loadPaymentParts(load)){
  const matches=loadPaymentMatches(load,ledger,date,category,cents);
  if(links[category]&&links[category]!=='new'){
   const r=matches.find(x=>x.id===links[category]);if(!r||r.date!==date||used.has(r.id))throw Error('Existing entry must match payment date, truck, category and amount and cannot belong to another load.');
   ids.push(r.id);used.add(r.id);continue;
  }
  if(matches.length&&links[category]!=='new')throw Error('Possible duplicate '+category+'. Link the existing ledger entry or explicitly confirm a separate payment.');
  const r=row({id:newId(),date,truck:load.truck,category,classification:'revenue',cents,ref:load.number,note:'Load '+load.number,source:'trucking-load',externalId:load.id+'-'+(category==='Linehaul'?'linehaul':category==='Empty mile pay'?'empty':'fsc')});added.push(r);ids.push(r.id);
 }
 return {record:{...load,stage:'Paid',paidDate:date,ledgerIds:ids},rows:[...ledger,...added]};
}
function candidates(s,l,ledger){return ledger.filter(r=>r.trade==='Trucking'&&r.date===s.date&&(!r.vehicle||r.vehicle===s.truck)&&!r.settlement&&r.sign!==-1&&!r.splits?.length&&!ledger.some(x=>x.reversalOf===r.id&&x.sign===-1)&&r.cents===l.cents&&F.kind(r)===l.classification&&normalize(r.category)===normalize(l.category));}
function post(s,existing,ledger,id){
const result=settlement(s);if(result.difference!==0)throw Error('Settlement must reconcile to the cent before posting.');if(duplicate(s,existing)||existing.some(x=>x.id===s.id&&x.posted)||ledger.some(x=>x.settlement===s.id))throw Error('Duplicate or already posted settlement.');
const linked=new Map(),added=[],ids=[];
for(const [i,l] of result.lines.entries()){
const possible=candidates(s,l,ledger);
if(l.link&&l.link!=='new'){
const r=possible.find(x=>x.id===l.link);if(!r||linked.has(r.id))throw Error('Existing entry for line '+(i+1)+' no longer matches, or is already linked.');
linked.set(r.id,{...r,vehicle:s.truck,settlement:s.id,audit:F.audit(r,'linked settlement',s.number)});ids.push(r.id);continue;
}
if(possible.length&&l.link!=='new')throw Error('Possible duplicate on line '+(i+1)+'. Link an existing entry or explicitly confirm this is a separate charge.');
const r=row({id:id(),date:s.date,truck:s.truck,category:l.category,classification:l.classification,cents:l.cents,ref:s.number,note:l.description,source:'trucking-settlement',externalId:s.id+'-'+i,settlement:s.id});added.push(r);ids.push(r.id);
}
return {record:{...s,posted:true,postedAt:new Date().toISOString(),ledgerIds:ids,gross:result.gross,deductions:result.deductions,credits:result.credits,netCents:result.net,scanStatus:'manual-review'},rows:[...ledger.map(r=>linked.get(r.id)||r),...added]};
}
function reconciliation(s,ledger){const found=ledger.filter(r=>r.settlement===s.id);const cash=F.total(found).cash;return {cash,expected:s.netCents,difference:cash-s.netCents,missing:(s.ledgerIds||[]).filter(id=>!found.some(r=>r.id===id)).length};}
function defaultsFor(p,date){const o=p.operating?.truck||{},g=p.goals||{};const loaded=num(o.loaded||Math.max(0,num(o.miles)-num(o.deadhead))),deadhead=num(o.deadhead||Math.max(0,num(o.miles)-loaded));let fixed=0,extra=0,fixedReserve=0;const excluded=[];
for(const raw of p.bills||[]){
if(!Planning.nextDate(raw,date))continue;
const b={...raw,...(raw.changes||[]).filter(c=>c.date<=date).sort((a,z)=>z.date.localeCompare(a.date))[0]},cat=normalize(b.category+' '+b.name),cls=b.classification||'expense',variable=b.variable&&b.variable!=='fixed';
if((/dispatch/.test(cat)&&num(o.dispatch)>0)||(/diesel|fuel purchase/.test(cat)&&num(o.fuel)>0)||(/escrow|maintenance reserve/.test(cat)&&num(o.escrow)>0)){excluded.push(b.name);continue;}
const amount=F.annual(b,Number(b.units)||0)/5200;
if(F.classes[cls]?.[0]===-1){if(variable)extra+=amount;else fixed+=amount;}
else if(F.classes[cls]?.[1]===-1)fixedReserve+=amount;
}

return {loaded,deadhead,mpg:o.mpg||'',fuel:o.fuel||0,discount:o.discount||0,linehaul:o.linehaul||0,emptyRate:o.emptyRate||0,fsc:o.fsc||0,dispatch:o.dispatch||0,reserve:o.escrow||0,fixed:fixed.toFixed(2),extra:extra.toFixed(2),fixedReserve:fixedReserve.toFixed(2),excluded,otherRevenue:0,goal:Math.max(num(g.weekly),num(g.monthly)*12/52).toFixed(2),days:o.days||5,baselineMiles:num(o.miles)||loaded+deadhead,alternativeDiscount:0,downtimeDays:0};}
function calculate(v){const loaded=num(v.loaded),dead=num(v.deadhead),miles=loaded+dead,mpg=num(v.mpg),fuel=num(v.fuel),discount=num(v.discount),linehaul=num(v.linehaul),emptyRate=num(v.emptyRate),fsc=num(v.fsc),dispatch=num(v.dispatch)/100,reserve=num(v.reserve),fixed=money(v.fixed),extra=money(v.extra),fixedReserve=money(v.fixedReserve),other=money(v.otherRevenue),goal=money(v.goal),days=num(v.days),alt=num(v.alternativeDiscount),down=num(v.downtimeDays);
if(!mpg||dispatch>=1||discount>fuel||alt>fuel||!days||days>7)throw Error('MPG and working days must be positive, dispatch below 100%, discount no more than diesel price.');
const gallons=miles/mpg, fuelCost=round(gallons*(fuel-discount)*100),emptyRevenue=round(dead*emptyRate*100),gross=round(loaded*(linehaul+fsc)*100)+emptyRevenue+other,dispatchCost=round(gross*dispatch),cost=fixed+extra+fuelCost+dispatchCost,net=gross-cost,held=round(miles*reserve*100)+fixedReserve,available=net-held;
const per=(n,d)=>d?n/d/100:null,ratio=miles?loaded/miles:0,unit=((linehaul+fsc)*ratio+emptyRate*(1-ratio))*(1-dispatch)-(fuel-discount)/mpg-reserve;
const requiredGross=Math.max(0,(fixed+extra+fuelCost+held+goal)/(1-dispatch)-other);
return {miles,gallons,gross,emptyRevenue,cost,net,held,available,fuelCost,dispatchCost,loadedRate:per(gross,loaded),rpm:per(gross,miles),cpm:per(cost,miles),ppm:per(net,miles),fuelPerMile:per(fuelCost,miles),deadheadCost:round(dead*(fuel-discount)/mpg*100),fscRevenue:round(loaded*fsc*100),breakEvenLoaded:loaded?Math.max(0,((fixed+extra+fuelCost)/(1-dispatch)-other-emptyRevenue)/100/loaded):null,requiredLoaded:loaded?Math.max(0,requiredGross-emptyRevenue)/100/loaded:null,requiredMiles:unit>0?Math.ceil(Math.max(0,(fixed+extra+fixedReserve+goal-other*(1-dispatch))/100)/unit):null,monthly:round(net*52/12),annual:round(net*52),downtimeCost:round(Math.max(0,gross-dispatchCost-fuelCost-held+fixedReserve)/days*down),alternativeFuelCost:round(gallons*(fuel-alt)*100),discountSavings:round(gallons*(alt-discount)*100)};}
function financing(v){const principal=money(v.principal),down=money(v.down),buyout=money(v.buyout),months=num(v.months),apr=num(v.apr)/1200;if(!Number.isInteger(months)||months<1||months>600||down>principal||apr>1||buyout>principal-down)throw Error('Check loan amount, down payment, term and balloon.');const balance=principal-down;const p=apr?(balance-buyout/Math.pow(1+apr,months))*apr/(1-Math.pow(1+apr,-months)):(balance-buyout)/months;return {payment:round(p),total:round(p*months)+buyout+down,interest:round(p*months)+buyout-balance};}
function leasePurchase(v){const amount=money(v.amount),count=num(v.count),buyout=money(v.buyout),upfront=money(v.upfront);if(!F.safe(amount)||!Number.isInteger(count)||count<1||count>1500)throw Error('Enter a positive payment and valid payment count.');return {payments:round(amount*count),buyout,upfront,total:round(amount*count+buyout+upfront)};}
function schedule(v){requireDate(v.due);const count=num(v.count),amount=money(v.amount);if(!Number.isInteger(count)||count<1||count>1500||!F.safe(amount)||!Object.hasOwn(F.schedules,v.frequency)||v.frequency==='Custom days'&&(!Number.isInteger(+v.interval)||+v.interval<1||+v.interval>3650))throw Error('Invalid payment schedule.');return {...v,count,cents:amount};}
function lease(l){requireDate(l.start);if(!l.truck||!l.name?.trim()||!Array.isArray(l.schedules)||!l.schedules.length||l.schedules[0].due<l.start)throw Error('Contract, truck, dates and schedule required.');const schedules=l.schedules.map(schedule).sort((a,b)=>a.due.localeCompare(b.due));if(schedules.some((s,i)=>i&&s.due===schedules[i-1].due))throw Error('Schedule changes need a distinct effective date.');const due=[];for(let i=0;i<schedules.length;i++){const s=schedules[i],next=schedules[i+1]?.due;for(let n=0;n<s.count;n++){const d=F.occurrence(s,n);if(next&&d>=next)break;due.push({date:d,cents:s.cents});}}const payments=l.payments||[],used=new Set();for(const p of payments){requireDate(p.date);if(!F.safe(p.cents)||!p.id||used.has(p.id)||p.principal<0||p.interest<0||(p.principal||0)+(p.interest||0)>p.cents)throw Error('Invalid contract payment.');used.add(p.id);}const paidDates=new Set(payments.map(p=>p.due).filter(Boolean));const remaining=due.filter(d=>!paidDates.has(d.date));return {due,remaining,paid:payments.reduce((s,p)=>s+p.cents,0),principal:payments.reduce((s,p)=>s+(p.principal||0),0),interest:payments.reduce((s,p)=>s+(p.interest||0),0),remainingCents:remaining.reduce((s,p)=>s+p.cents,0),buyout:money(l.buyout),completion:remaining.at(-1)?.date||due.at(-1)?.date||null};}
function changeSchedule(l,v){const s=schedule(v);if(s.due<=l.schedules.at(-1).due||l.payments.some(p=>p.due&&p.due>=s.due))throw Error('Change must start after the existing schedule and all recorded scheduled payments.');const next={...l,schedules:[...l.schedules,s]};lease(next);return next;}
function recordPayment(l,p){const q=lease(l);requireDate(p.date);const scheduled=q.remaining.find(d=>d.date===p.due);if(!scheduled||l.payments.some(x=>x.id===p.id||x.ledgerIds?.some(i=>p.ledgerIds?.includes(i))))throw Error('Payment already recorded or invalid due date.');if(p.cents!==scheduled.cents)throw Error('This tracker supports full scheduled payments only. Review the schedule before recording a different amount.');const next={...l,payments:[...l.payments,p]};lease(next);return next;}
function escrow(rows,truck){const result={maintenance:0,tire:0};for(const r of rows.filter(r=>r.trade==='Trucking'&&(!truck||r.vehicle===truck)))for(const l of F.lines(r)){const cat=normalize(l.category);const k=cat.includes('tire')?'tire':cat.includes('maintenance')?'maintenance':null;if(k&&l.classification==='escrow_out')result[k]+=l.cents*(r.sign||1);if(k&&l.classification==='escrow_in')result[k]-=l.cents*(r.sign||1);}return result;}
function repairRows(m,ledger,id){const cents=money(m.amount);if(!F.safe(cents))throw Error('Enter a positive repair amount.');if(ledger.some(r=>r.source==='trucking-repair'&&r.externalId?.startsWith(m.id+'-')))throw Error('Repair already posted.');if(ledger.some(r=>r.trade==='Trucking'&&r.date===m.date&&(!r.vehicle||r.vehicle===m.truck)&&r.sign!==-1&&!ledger.some(x=>x.reversalOf===r.id&&x.sign===-1)&&F.lines(r).some(x=>x.cents===cents&&x.classification==='expense'&&/repair|maintenance|oil change|tire|inspection/i.test(x.category))))throw Error('Possible existing repair expense. Use history only and reconcile any escrow release separately.');const common={date:m.date,truck:m.truck,ref:m.id,source:'trucking-repair',note:m.note||m.kind};const out=[row({...common,id:id(),category:'Repairs & maintenance',classification:'expense',cents,externalId:m.id+'-expense'})];if(m.funding==='maintenance'||m.funding==='tire'){if(escrow(ledger,m.truck)[m.funding]<cents)throw Error('Insufficient recorded escrow balance. Record or reconcile contributions first.');out.push(row({...common,id:id(),category:(m.funding==='maintenance'?'Maintenance':'Tire')+' escrow release',classification:'escrow_in',cents,externalId:m.id+'-release'}));}return out;}
function travel(v){requireDate(v.depart);requireDate(v.return);if(v.return<v.depart)throw Error('Return must follow departure.');const days=(Date.parse(v.return)-Date.parse(v.depart))/86400000+1,partial=num(v.partial),home=num(v.home),rate=money(v.rate),deduct=num(v.deduct);if(partial>1||home>days||deduct>100||!Number.isInteger(home))throw Error('Invalid home days or percentage.');const eligible=Math.max(0,days-home-(days===1?1-partial:2*(1-partial)));return {days,eligible,estimated:round(eligible*rate*deduct/100)};}
function dashboard(data,rows,truck,from,to){const select=r=>(!truck||r.truck===truck)&&r.date>=from&&r.date<=to;const mile=data.mileage.filter(select);const l=rows.filter(r=>r.trade==='Trucking'&&(!truck||r.vehicle===truck)&&r.date>=from&&r.date<=to);const t=F.total(l),loaded=mile.reduce((s,x)=>s+x.loaded,0),deadhead=mile.reduce((s,x)=>s+x.deadhead,0),gallons=mile.reduce((s,x)=>s+x.gallons,0),miles=loaded+deadhead;let fuel=0;for(const r of l)for(const x of F.lines(r))if(normalize(x.category)==='diesel'&&x.classification==='expense')fuel+=x.cents*(r.sign||1);return {...t,loaded,deadhead,miles,gallons,mpg:gallons?miles/gallons:null,rpm:miles?t.income/miles/100:null,cpm:miles?t.expense/miles/100:null,ppm:miles?t.net/miles/100:null,fuelPerMile:miles?fuel/miles/100:null,escrow:escrow(rows,truck)};}
// Report dates refer to actual ledger dates, not settlement work-week dates.
function reportRange(preset,today){
 requireDate(today);const shift=(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
 const monday=shift(today,-((new Date(today+'T00:00:00Z').getUTCDay()+6)%7));
 if(preset==='week')return {from:monday,to:shift(monday,6)};
 if(preset==='last-week')return {from:shift(monday,-7),to:shift(monday,-1)};
 if(preset==='month')return {from:today.slice(0,7)+'-01',to:today};
 if(preset==='year')return {from:today.slice(0,4)+'-01-01',to:today};
 throw Error('Choose a reporting period.');
}
function periodReport(data,rows,truck,from,to){
 requireDate(from);requireDate(to);if(to<from)throw Error('End must follow start.');
 const scoped=rows.filter(r=>r.trade==='Trucking'&&(!truck||r.vehicle===truck)),selected=scoped.filter(r=>r.date>=from&&r.date<=to),d=dashboard(data,scoped,truck,from,to);
 const incomeCategories=Object.create(null),transfers=Object.create(null);let diesel=0,reimbursement=0,escrowIn=0,escrowOut=0;
 for(const r of selected)for(const l of F.lines(r)){
  const n=l.cents*(r.sign||1),[profit,cash]=F.classes[l.classification];
  if(profit===1)incomeCategories[l.category]=(incomeCategories[l.category]||0)+n;
  if(!profit&&cash)transfers[l.classification]=(transfers[l.classification]||0)+cash*n;
  if(l.classification==='expense'&&normalize(l.category)==='diesel')diesel+=n;
  if(l.classification==='revenue'&&normalize(l.category)==='fuel reimbursement')reimbursement+=n;
  if(l.classification==='escrow_in')escrowIn+=n;if(l.classification==='escrow_out')escrowOut+=n;
 }
 const settlements=data.settlements.filter(s=>(!truck||s.truck===truck)&&s.date>=from&&s.date<=to),posted=settlements.filter(s=>s.posted);
 const settlementTotals=posted.reduce((a,s)=>{const q=reconciliation(s,scoped);a.statement+=q.expected;a.linked+=q.cash;if(q.missing||q.difference)a.issues++;return a},{statement:0,linked:0,issues:0});
 const trips=data.perdiem.filter(x=>(!truck||x.truck===truck)&&x.depart<=to&&x.return>=from),complete=trips.filter(x=>x.depart>=from&&x.return<=to);
 const travelTotals=complete.reduce((a,x)=>{const q=travel(x);a.eligible+=q.eligible;a.estimated+=q.estimated;a.home+=num(x.home);return a},{eligible:0,estimated:0,home:0});
 const mileageRecords=data.mileage.filter(x=>(!truck||x.truck===truck)&&x.date>=from&&x.date<=to);
 const unassigned=rows.filter(r=>r.trade==='Trucking'&&!r.vehicle&&r.date>=from&&r.date<=to);
 return {...d,incomeCategories,transfers,diesel,reimbursement,netFuel:diesel-reimbursement,escrowIn,escrowOut,escrowAsOf:escrow(scoped.filter(r=>r.date<=to),truck),postedCount:posted.length,draftCount:settlements.length-posted.length,settlementTotals,travelTotals,partialTrips:trips.length-complete.length,mileageCount:mileageRecords.length,unassignedCount:unassigned.length};
}
// Trucks are associated by name in older records; also protect references by ID.
function truckDependencies(data,rows,profile,id){
 const t=data.trucks.find(x=>x.id===id);if(!t)throw Error('Truck not found. Refresh and try again.');
 const matches=v=>typeof v==='string'&&v.trim()!==''&&(v.trim().toLowerCase()===t.name.trim().toLowerCase()||v===t.id);
 const links=[];
 for(const [k,label] of [['mileage','Mileage records'],['settlements','Settlements'],['leases','Lease / financing contracts'],['loads','Saved loads'],['maintenance','Maintenance records'],['perdiem','Per diem records'],['ifta','IFTA records']]){
  const count=data[k].filter(x=>matches(x.truck)).length;if(count)links.push({label,count});
 }
 const ledger=rows.filter(r=>matches(r.vehicle)||matches(r.equipment)).length;if(ledger)links.push({label:'Ledger transactions (including escrow)',count:ledger});
 const tax=profile?.taxPlanning||{};
 const miles=(tax.mileage||[]).filter(x=>matches(x.vehicle)).length;if(miles)links.push({label:'Tax mileage records',count:miles});
 const assets=(tax.assets||[]).filter(x=>matches(x.name)||matches(x.ledgerRef)).length;if(assets)links.push({label:'Tax asset records',count:assets});
 return links;
}
function deleteTruck(data,rows,profile,id){
 const links=truckDependencies(data,rows,profile,id);
 if(links.length)throw Error('Truck has linked records: '+links.map(x=>x.label+' ('+x.count+')').join(', ')+'. Keep its history or correct those records first.');
 return {...data,trucks:data.trucks.filter(x=>x.id!==id)};
}
return {activeFuelRows,fuelEconomy,loadFuelEstimate,currentMileage,fuelPurchase,loadStages,loadRevenue,loadRecord,loadPaymentParts,loadPaymentMatches,payLoad,defaults,presets,blank,state,suggest,parseCSV,settlement,duplicate,row,candidates,post,reconciliation,defaultsFor,calculate,financing,leasePurchase,schedule,lease,changeSchedule,recordPayment,escrow,repairRows,travel,dashboard,reportRange,periodReport,num,money,requireDate,truckDependencies,deleteTruck};
})();