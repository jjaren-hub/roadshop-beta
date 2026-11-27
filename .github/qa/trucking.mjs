import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const T=vm.runInNewContext(['core/finance.js','core/planning.js','core/trucking.js'].map(p=>readFileSync(p,'utf8')).join('\n')+';Trucking',{structuredClone});
function run(T){let n=0;const eq=(a,b)=>{if(a!==b)throw Error('Expected '+b+', received '+a);n++};const throws=f=>{let x=false;try{f()}catch{x=true}eq(x,true)};let i=0;const id=()=> 'test-'+(++i);
const s={id:'s1',carrier:'Carrier',number:'1',truck:'Truck A',date:'2026-11-25',net:'800',lines:[{description:'Linehaul',category:'Linehaul',classification:'revenue',amount:'1000'},{description:'FSC',category:'Fuel surcharge',classification:'revenue',amount:'100'},{description:'Fuel purchase',category:'Diesel',classification:'expense',amount:'200'},{description:'Fuel reimbursement',category:'Fuel reimbursement',classification:'revenue',amount:'10'},{description:'DEF',category:'DEF',classification:'expense',amount:'10'},{description:'Escrow',category:'Maintenance escrow contribution',classification:'escrow_out',amount:'100'}]};
const z=T.settlement(s);eq(z.net,80000);eq(z.gross,111000);eq(z.deductions,31000);eq(T.suggest('fuel reimbursement').category,'Fuel reimbursement');eq(T.suggest('Comdata miscellaneous purchases').category,'DEF');eq(T.suggest('fuel surcharge').category,'Fuel surcharge');eq(T.suggest('tractor fuel purchase',[{match:'tractor fuel purchase',category:'Fuel reimbursement',classification:'revenue'}]).classification,'revenue');eq(T.parseCSV('description,amount\nDEF,-12.50')[0].amount,'12.50');
const p=T.post(s,[],[],id);eq(p.rows.length,6);eq(T.reconciliation(p.record,p.rows).difference,0);throws(()=>T.post({...s,net:'1'},[],[],id));throws(()=>T.post(s,[p.record],p.rows,id));eq(T.duplicate({...s,id:'s2'},[p.record]).id,'s1');
const c=T.calculate({loaded:800,deadhead:200,mpg:10,fuel:4,discount:1,linehaul:2,fsc:.5,dispatch:10,reserve:.1,fixed:'200',extra:'0',otherRevenue:'0',goal:'100',days:5,alternativeDiscount:0,downtimeDays:1});eq(c.miles,1000);eq(c.gallons,100);eq(c.gross,200000);eq(c.fuelCost,30000);eq(c.dispatchCost,20000);eq(c.cost,70000);eq(c.net,130000);eq(c.held,10000);eq(c.available,120000);eq(c.rpm,2);eq(c.cpm,.7);eq(c.ppm,1.3);eq(c.fuelPerMile,.3);eq(c.deadheadCost,6000);eq(c.fscRevenue,40000);eq(c.monthly,563333);eq(c.annual,6760000);eq(c.requiredMiles,215);eq(c.downtimeCost,28000);eq(c.alternativeFuelCost,40000);eq(c.discountSavings,-10000);eq(Math.round(c.breakEvenLoaded*100),69);eq(Math.round(c.requiredLoaded*100),97);eq(T.financing({principal:'12000',down:'0',buyout:'0',months:12,apr:0}).payment,100000);eq(T.financing({principal:'12000',down:'0',buyout:'2000',months:10,apr:0}).total,1200000);eq(T.financing({principal:'12000',down:'0',buyout:'0',months:12,apr:12}).payment,106619);throws(()=>T.calculate({...c,mpg:0}));
let l={truck:'Truck A',name:'Contract',start:'2026-01-01',buyout:'1000',schedules:[{due:'2026-01-01',frequency:'Weekly',count:4,amount:'100'}],payments:[]};eq(T.lease(l).remaining.length,4);l=T.recordPayment(l,{id:'p1',date:'2026-01-01',due:'2026-01-01',cents:10000,principal:0,interest:0});l=T.changeSchedule(l,{due:'2026-01-15',frequency:'Every two weeks',count:3,amount:'50'});eq(T.lease(l).paid,10000);eq(T.lease(l).remaining.length,4);eq(T.lease(l).remainingCents,25000);eq(T.lease(l).completion,'2026-02-12');eq(T.lease(l).buyout,100000);throws(()=>T.recordPayment(l,l.payments[0]));
eq(T.escrow(p.rows,'Truck A').maintenance,10000);const rr=T.repairRows({id:'repair1',date:s.date,truck:s.truck,amount:'50',funding:'maintenance',kind:'Oil'},p.rows,id);eq(rr.length,2);eq(T.escrow([...p.rows,...rr],s.truck).maintenance,5000);throws(()=>T.repairRows({id:'repair1',date:s.date,truck:s.truck,amount:'50',funding:'maintenance'},[...p.rows,...rr],id));eq(T.travel({depart:'2026-11-01',return:'2026-11-03',home:0,partial:.75,rate:'80',deduct:80}).estimated,16000);
const d=T.dashboard({...T.blank(),mileage:[{truck:s.truck,date:s.date,loaded:800,deadhead:200,gallons:100}]},p.rows,s.truck,s.date,s.date);eq(d.net,90000);eq(d.mpg,10);eq(d.fuelPerMile,.2);eq(d.miles,1000);const prev=T.row({id:'previous',date:s.date,truck:s.truck,category:'Linehaul',classification:'revenue',cents:100000});throws(()=>T.post(s,[],[prev],id));const linked=T.post({...s,lines:s.lines.map((x,i)=>i?x:{...x,link:'previous'})},[],[prev],id);eq(linked.rows.length,6);eq(linked.rows[0].settlement,s.id);eq(T.reconciliation(linked.record,linked.rows).difference,0);eq(T.post({...s,lines:s.lines.map((x,i)=>i?x:{...x,link:'new'})},[],[prev],id).rows.length,7);
const defaults=T.defaultsFor({operating:{truck:{miles:1000,mpg:10,fuel:4,dispatch:10,escrow:.1}},goals:{},bills:[{name:'Insurance',due:'2026-01-01',frequency:'Weekly',amount:'100'},{name:'Variable tolls',due:'2026-01-01',frequency:'Weekly',variable:'mileage',rate:'.05',units:1000},{name:'Dispatch',due:'2026-01-01',frequency:'Weekly',variable:'revenue',rate:10,units:100000},{name:'Principal',classification:'principal',due:'2026-01-01',frequency:'Weekly',amount:'50'}]},'2026-11-25');eq(defaults.fixed,'100.00');eq(defaults.extra,'50.00');eq(defaults.fixedReserve,'50.00');eq(defaults.excluded[0],'Dispatch');eq(T.calculate({...defaults,loaded:1000,deadhead:0,linehaul:2,fsc:0,alternativeDiscount:0,downtimeDays:0}).held,15000);
eq(T.leasePurchase({amount:'1199',count:42,buyout:'4313.25',upfront:'0'}).total,5467125);throws(()=>T.leasePurchase({amount:'0',count:42}));return n;}
console.log('PASS trucking core: '+run(T)+' assertions');

const fleet={...T.blank(),trucks:[{id:'a',name:'Truck A'},{id:'b',name:'Truck B'}]};
const ok=(v,m)=>{if(!v)throw Error(m)};
ok(T.deleteTruck(fleet,[],{},'a').trucks.map(t=>t.id).join(',')==='b','delete only selected truck');
ok(fleet.trucks.length===2,'original untouched');
for(const k of ['mileage','settlements','leases','loads','maintenance','perdiem','ifta']){const d={...fleet,[k]:[{truck:'Truck A'}]};let blocked=false;try{T.deleteTruck(d,[],{},'a')}catch{blocked=true}ok(blocked,'protect '+k);}
for(const [rows,profile] of [[[{vehicle:'Truck A'}],{}],[[{equipment:'a'}],{}],[[],{taxPlanning:{mileage:[{vehicle:'truck a'}]}}],[[],{taxPlanning:{assets:[{name:'Truck A'}]}}]]){let blocked=false;try{T.deleteTruck(fleet,rows,profile,'a')}catch{blocked=true}ok(blocked,'protect linked record');}
ok(T.deleteTruck(fleet,[{vehicle:'Truck B'}],{},'a').trucks.length===1,'unrelated records do not block');
console.log('PASS truck deletion and dependency guards');

new Function(['core/finance.js','core/planning.js','core/trucking.js'].map(p=>readFileSync(p,'utf8')).join('\n')+`\nconst l={truck:'A',name:'Lease',start:'2026-01-01',buyout:'0',schedules:[{due:'2026-01-01',count:2,frequency:'Weekly',amount:'100'}],payments:[]};const p={id:'p',date:'2026-01-01',due:'2026-01-01',cents:5000,principal:0,interest:0};let rejected=false;try{Trucking.recordPayment(l,p)}catch{rejected=true}if(!rejected||Trucking.lease(l).remaining.length!==2)throw Error('Partial payment incorrectly closes installment');`)();

new Function(['core/finance.js','core/planning.js','core/trucking.js','payments.js'].map(p=>readFileSync(p,'utf8')).join('\n')+"\nconst q={id:'Q-123456789abc',trade:'Trucking',customer:'Fixture',paid:{date:'2026-11-25'},items:[{qty:100,rate:5000,kind:'labor'}],tax:500};const rows=WorkPayments.merge(WorkPayments.rows([q]),[q]);const d=Trucking.dashboard(Trucking.blank(),rows,'','2026-11-01','2026-11-30');if(rows.length!==2||d.income!==5000||d.cash!==5500||d.net!==5000)throw Error('Paid quote missing or duplicated in trucking overview');if(Trucking.dashboard(Trucking.blank(),rows,'Truck 1','2026-11-01','2026-11-30').income!==0)throw Error('Unassigned quote incorrectly assigned to truck');")();

// Period reporting is read-only and separates profit, statement cash, escrow and tax estimates.
{
 const eq=(a,b)=>{if(a!==b)throw Error('Expected '+b+' got '+a)};
 const dates=T.reportRange('last-week','2026-11-27');eq(dates.from,'2026-11-16');eq(dates.to,'2026-11-22');eq(T.reportRange('week','2026-11-27').from,'2026-11-23');eq(T.reportRange('month','2026-11-27').from,'2026-11-01');eq(T.reportRange('year','2026-11-27').from,'2026-01-01');eq(T.reportRange('last-week','2026-01-01').from,'2025-12-22');
 const data=T.blank();data.mileage=[{truck:'A',date:'2026-11-24',loaded:800,deadhead:200,gallons:100}];data.settlements=[{id:'s1',truck:'A',date:'2026-11-24',posted:true,netCents:75000,ledgerIds:['r','fuel','reserve','rebate']},{id:'s2',truck:'A',date:'2026-11-25',posted:false}];data.perdiem=[{truck:'A',depart:'2026-11-24',return:'2026-11-26',home:0,partial:'.75',rate:'80',deduct:'80'},{truck:'A',depart:'2026-11-30',return:'2026-12-02',home:0,partial:'.75',rate:'80',deduct:'80'}];
 const make=(id,category,classification,cents,date='2026-11-24',truck='A',settlement='')=>T.row({id,category,classification,cents,date,truck,settlement});
 const ledger=[make('r','Linehaul','revenue',100000,undefined,'A','s1'),make('fuel','Diesel','expense',20000,undefined,'A','s1'),make('reserve','Maintenance escrow contribution','escrow_out',10000,undefined,'A','s1'),make('rebate','Fuel reimbursement','revenue',5000,undefined,'A','s1'),make('prior','Maintenance escrow contribution','escrow_out',7000,'2026-10-10'),make('later','Maintenance escrow contribution','escrow_out',9000,'2026-12-01'),make('unassigned','DEF','expense',1000,undefined,''),make('other','Linehaul','revenue',2000,undefined,'B')];
 const before=JSON.stringify({data,ledger}),r=T.periodReport(data,ledger,'A','2026-11-01','2026-11-30');eq(r.income,105000);eq(r.expense,20000);eq(r.net,85000);eq(r.cash,75000);eq(r.netFuel,15000);eq(r.escrowOut,10000);eq(r.escrowAsOf.maintenance,17000);eq(r.postedCount,1);eq(r.draftCount,1);eq(r.settlementTotals.statement,75000);eq(r.settlementTotals.linked,75000);eq(r.settlementTotals.issues,0);eq(r.travelTotals.eligible,2.5);eq(r.travelTotals.estimated,16000);eq(r.partialTrips,1);eq(r.miles,1000);eq(r.unassignedCount,1);eq(r.incomeCategories.Linehaul,100000);eq(r.categories.Diesel,20000);eq(T.periodReport(data,ledger,'','2026-11-01','2026-11-30').expense,21000);eq(JSON.stringify({data,ledger}),before);console.log('PASS period presets, scoped reporting, cash, escrow as-of, fuel rebates and per diem');
}


{
const eq=(a,b)=>{if(a!==b)throw Error('Expected '+b+' got '+a)},reject=fn=>{let b=false;try{fn()}catch{b=true}eq(b,true)};let i=0;const id=()=> 'test-load-row-'+(++i);
const today='2026-11-27',v={number:'L-100',truck:'A',pickupDate:'2026-11-24',pickupCity:'Salt Lake City',pickupAddress:'',deliveryDate:'2026-11-26',deliveryCity:'Denver',deliveryAddress:'',loaded:'1000',empty:'100',linehaul:'1.45',fsc:'.56',stage:'Planned'};
const planned=T.loadRecord({...v,comments:'Pickup #00412\nGate 3'},[],today,'load-a');eq(planned.comments,'Pickup #00412\nGate 3');reject(()=>T.loadRecord({...v,comments:'x'.repeat(2001)},[],today,'long-comments'));eq(planned.total,201000);eq(planned.linehaulCents,145000);eq(planned.fscCents,56000);eq(planned.empty,100);
const picked=T.loadRecord({...planned,stage:'Picked up'},[planned],today,planned.id),delivered=T.loadRecord({...picked,stage:'Delivered'},[picked],today,picked.id);
reject(()=>T.payLoad(planned,[planned],[],today,today,{},id));reject(()=>T.payLoad(delivered,[delivered],[],'2026-11-25',today,{},id));reject(()=>T.loadRecord({...v,number:' l-100 '},[planned],today,'other'));reject(()=>T.loadRecord({...v,loaded:'-1'},[],today,'bad'));
const paid=T.payLoad(delivered,[delivered],[],today,today,{},id);eq(paid.record.stage,'Paid');eq(paid.record.comments,planned.comments);eq(paid.record.paidDate,today);eq(paid.rows.length,2);eq(paid.rows.reduce((s,r)=>s+r.cents,0),201000);eq(paid.rows[0].ref,'L-100');reject(()=>T.payLoad(paid.record,[paid.record],paid.rows,today,today,{},id));reject(()=>T.loadRecord({...v},[paid.record],today,paid.record.id));
const previous=T.row({id:'existing',date:today,truck:'A',category:'Linehaul',classification:'revenue',cents:145000,ref:'L-100'});
reject(()=>T.payLoad(delivered,[delivered],[previous],today,today,{},id));const linked=T.payLoad(delivered,[delivered],[previous],today,today,{'Linehaul':'existing'},id);eq(linked.rows.length,2);eq(linked.record.ledgerIds.includes('existing'),true);
const F=new Function(readFileSync('core/finance.js','utf8')+';return Finance')();eq(F.linkedForDeletion(previous,{trucking:{loads:[linked.record]}},linked.rows),true);
console.log('PASS load records, stages, revenue, payment date, duplicate prevention and ledger protection');
}


{
 const d=T.blank();d.trucks=[{id:'truck-a',name:'Truck A',startingMiles:1000},{id:'truck-b',name:'Truck B',startingMiles:2000}];d.loads=[{kind:'record',id:'load-a',number:'L-1',truck:'Truck A'}];
 let sequence=0;const uid=()=>'fuel-test-'+(++sequence);
 const v={truckId:'truck-a',date:'2026-11-27',location:'Fuel stop',odometer:'1750',dieselGallons:'100',dieselPrice:'4.259',defGallons:'5',defPrice:'3.50',loadId:'load-a'};
 const q=T.fuelPurchase(v,d,[],'2026-11-27',uid);if(q.total!==44340||q.parts[0].mpg!==7.5||q.parts[1].mpg!==150||q.added.some(r=>r.ref!=='L-1')||T.currentMileage(d.trucks[0],d,q.added)!==1750||T.currentMileage(d.trucks[1],d,q.added)!==2000)throw Error('Fuel calculations or linking failed.');
 const next=T.fuelPurchase({...v,odometer:'1950',dieselGallons:'25',defGallons:'',defPrice:''},d,q.added,'2026-11-27',uid);if(next.parts[0].mpg!==8||next.added.length!==1)throw Error('Second fuel stop failed.');
 for(const change of [{odometer:'1749'},{truckId:'truck-b'},{date:'2026-11-26'},{dieselPrice:'0'}]){let rejected=false;try{T.fuelPurchase({...v,...change},d,q.added,'2026-11-27',uid)}catch{rejected=true}if(!rejected)throw Error('Invalid fuel purchase accepted.');}
 console.log('PASS fuel purchase calculations, chronological guard, load/truck isolation and current mileage');
}


{
 const d=T.blank();d.trucks=[{id:'economy-a',name:'A',startingMiles:1000},{id:'economy-b',name:'B',startingMiles:2000}];
 let n=0;const id=()=>'economy-'+(++n),v={date:'2026-11-27',location:'Fixture',dieselPrice:'4.00',defPrice:'3.00',loadId:''};
 const a=T.fuelPurchase({...v,truckId:'economy-a',odometer:'1750',dieselGallons:'100',defGallons:'5'},d,[],v.date,id);
 const b=T.fuelPurchase({...v,truckId:'economy-b',odometer:'2250',dieselGallons:'50',defGallons:'2'},d,a.added,v.date,id);
 const rows=[...a.added,...b.added],fleet=T.fuelEconomy(rows),one=T.fuelEconomy(rows,d.trucks[0]);
 if(Math.abs(fleet.diesel.mpg-1000/150)>1e-9||Math.abs(fleet.def.mpg-1000/7)>1e-9||one.diesel.mpg!==7.5||one.def.mpg!==150)throw Error('Weighted fleet fuel economy failed.');
 if(T.fuelEconomy(rows,null,'2026-11-28').diesel.mpg!==null)throw Error('Date filter failed.');
 const undone={...a.added[0],id:id(),sign:-1,reversalOf:a.added[0].id};
 if(T.fuelEconomy([...rows,undone]).diesel.mpg!==5)throw Error('Reversed fuel purchase included.');
 console.log('PASS weighted fuel economy, independent trucks, date filters and reversals');
}


{
 const d=T.blank();d.trucks=[{id:'a',name:'A',startingMiles:0},{id:'b',name:'B',startingMiles:0},{id:'c',name:'C',startingMiles:0}];
 let n=0;const id=()=>'load-fuel-'+(++n);
 const v={date:'2026-10-29',location:'Fixture',dieselPrice:'4',defPrice:'3',loadId:''};
 const a=T.fuelPurchase({...v,truckId:'a',odometer:'750',dieselGallons:'100',defGallons:'5'},d,[],v.date,id);
 const b=T.fuelPurchase({...v,date:'2026-11-27',truckId:'b',odometer:'500',dieselGallons:'100',defGallons:'4'},d,a.added,'2026-11-27',id);
 const rows=[...a.added,...b.added],p={operating:{truck:{mpg:8}}},load={truck:'A',loaded:'1000',empty:'125'};
 const q=T.loadFuelEstimate(load,d,rows,p,'2026-11-27');
 if(q.from!=='2026-10-29'||q.miles!==1125||q.diesel.gallons!==150||q.def.gallons!==7.5||q.diesel.source!=='Truck 30-day average')throw Error('Truck fuel estimate failed.');
 const fleet=T.loadFuelEstimate({...load,truck:'C'},d,rows,p,'2026-11-27');
 if(fleet.diesel.mpg!==6.25||fleet.diesel.gallons!==180||fleet.diesel.source!=='Company 30-day average')throw Error('Fleet fallback failed.');
 const old=T.loadFuelEstimate(load,d,rows,p,'2026-11-28');if(old.diesel.mpg!==5||old.diesel.source!=='Company 30-day average')throw Error('Rolling cutoff failed.');
 const none=T.loadFuelEstimate(load,d,[],p,'2026-11-27');if(none.diesel.gallons!==140.625||none.def.gallons!==null)throw Error('Configured MPG fallback failed.');
 console.log('PASS load fuel estimate, 30-day cutoff, loaded + empty miles and labeled fallbacks');
}


{
 const date='2026-11-27',v={number:'EMPTY-TEST',truck:'A',pickupDate:date,pickupCity:'A',deliveryDate:date,deliveryCity:'B',loaded:1000,empty:100,linehaul:1.45,fsc:.56,emptyRate:1.25,stage:'Delivered'};
 const load=T.loadRecord(v,[],date,'empty-test'),eq=(a,b)=>{if(a!==b)throw Error('Expected '+b+' got '+a)};
 eq(load.total,213500);eq(load.emptyCents,12500);eq(T.loadRevenue({...v,emptyRate:0}).total,201000);eq(T.loadRevenue({...v,emptyRate:undefined}).total,201000);
 let i=0;const paid=T.payLoad(load,[load],[],date,date,{},()=> 'empty-test-row-'+(++i));eq(paid.rows.length,3);eq(paid.rows.find(x=>x.category==='Empty mile pay').cents,12500);eq(paid.rows.reduce((s,r)=>s+r.cents,0),load.total);
 const q=T.calculate({loaded:1000,deadhead:100,mpg:10,fuel:4,discount:0,linehaul:1.45,fsc:.56,emptyRate:1.25,dispatch:0,reserve:0,fixed:0,extra:0,otherRevenue:0,goal:0,days:5});eq(q.gross,213500);eq(q.emptyRevenue,12500);
 console.log('PASS empty mileage rate, payment posting, legacy zero rates and calculator');
}
