// Fields share stable IDs across rendering, editing and forecasting.
const Planning = (() => {
  const common = ['Insurance','Phone and internet','Office rent','Software','Advertising'];
  const registry = {
    truck:{label:'Truck driver',trade:'Trucking',types:['Owner-operator','Lease-purchase operator','Independent contract driver','Small fleet owner'],
      suggestions:['Truck payments','Trailer rental','Insurance','ELD subscription','Parking','Permits','Dispatch fees','Phone and internet'],
      fields:[['miles','Weekly mileage'],['loaded','Loaded miles per week'],['deadhead','Deadhead miles per week'],['mpg','Miles per gallon'],['fuel','Diesel price ($/gal)'],['linehaul','Linehaul ($/loaded mile)'],['emptyRate','Empty mile pay ($/empty mile)'],['fsc','Fuel surcharge ($/loaded mile)'],['escrow','Escrow reserve ($/total mile)'],['dispatch','Dispatch fee (% of revenue)',100],['discount','Fuel discount ($/gal)'],['days','Working days per week',7]]},
    mechanic:{label:'Mechanic',trade:'Mechanic',types:['Mobile mechanic','Repair shop','Both'],
      suggestions:['Shop or office rent','Service truck payments','Liability insurance','Tool payments','Equipment payments','Utilities','Diagnostic software','Advertising'],
      fields:[['hourly','Hourly labor rate ($)'],['markup','Parts markup (%)'],['mileage','Mileage charge ($/mile)'],['minimum','Minimum service charge ($)'],['diagnostic','Diagnostic fee ($)'],['supplies','Shop supply charge ($/job)'],['hours','Expected billable hours per week'],['tax','Sales tax rate (%)',100],['taxBasis','Sales tax applies to',['None','Parts','Labor','Parts and labor']],['terms','Invoice payment terms',['Due on receipt','Net 7','Net 15','Net 30','Net 60']]]},
    general:{label:'General independent contractor',trade:'General contractor',types:[],suggestions:common,fields:[]},
    other:{label:'Other self-employed business',trade:'Other business',types:[],suggestions:common,fields:[]}
  };
  const goals=[['weekly','Weekly profit goal ($)'],['monthly','Monthly profit goal ($)'],['tax','Tax reserve (% of profit)',100],['emergency','Emergency savings goal ($/month)'],['maintenance','Maintenance reserve goal ($/month)'],['owner','Desired owner compensation ($/month)']];
  const periods={Daily:365,Weekly:52,'Every two weeks':26,'Twice monthly':24,Monthly:12,Quarterly:4,Semiannual:2,Annual:1,'Custom days':0};
  const key='roadshop-profile-v2';
  function nextDate(b,today){
    if(typeof Finance!=='undefined'){return Finance.nextOccurrence(b,today);}
    if(!b.due || !Object.hasOwn(periods,b.frequency) || b.end && b.end<today)return null;
    let due=b.due;
    if(due<today){
      const start=new Date(due+'T00:00:00Z'),now=new Date(today+'T00:00:00Z');
      const days=b.frequency==='Weekly'?7:b.frequency==='Every two weeks'?14:0;
      if(days)start.setUTCDate(start.getUTCDate()+days*Math.ceil((now-start)/86400000/days));
      else {
        const step={Monthly:1,Quarterly:3,Annual:12}[b.frequency];
        const gap=(now.getUTCFullYear()-start.getUTCFullYear())*12+now.getUTCMonth()-start.getUTCMonth();
        const original=start.getUTCDate();
        const move=n=>{const date=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+n+1,0));date.setUTCDate(Math.min(original,date.getUTCDate()));return date;};
        let n=Math.floor(gap/step)*step, date=move(n);
        if(date<now)date=move(n+step);
        due=date.toISOString().slice(0,10);
      }
      if(days)due=start.toISOString().slice(0,10);
    }
    return !b.end||due<=b.end?due:null;
  }
  function forecast(p,today){
    const bills=p.bills.filter(b=>nextDate(b,today));
    const o=p.operating?.[p.job]||{},g=p.goals||{},truck=p.job==='truck';
    const positive=v=>Number.isFinite(+v)&&+v>0?+v:0;
    const miles=positive(o.miles)||positive(o.loaded)+positive(o.deadhead),mpg=positive(o.mpg),diesel=positive(o.fuel);
    const fuel=truck&&mpg?miles/mpg*Math.max(0,diesel-positive(o.discount)):0;
    const escrow=truck?miles*positive(o.escrow):0;
    const keep=truck?1-positive(o.dispatch)/100:1;
    let annual=0,cashAnnual=0,excluded=[];
    for(const raw of bills){
      const b={...raw,...(raw.changes||[]).filter(x=>x.date<=today).sort((a,z)=>z.date.localeCompare(a.date))[0]};
      const cls=b.classification||'expense',label=(b.category||'')+' '+(b.name||'');
      const amounts=typeof Finance!=='undefined'?Finance.annual(b,positive(b.units))/100:positive(b.amount)*(periods[b.frequency]||0);
      const kind=typeof Finance!=='undefined'?Finance.classes[cls]:cls==='expense'||cls==='interest'?[-1,-1]:[0,-1];
      if(!kind)continue;
      if(truck&&((kind[0]===-1&&(/dispatch/i.test(label)&&positive(o.dispatch)>0||/diesel|fuel purchase/i.test(label)&&miles>0&&mpg>0&&diesel>0))||(kind[0]===0&&kind[1]===-1&&/escrow|maintenance reserve/i.test(label)&&positive(o.escrow)>0))){excluded.push(b.name||b.category);continue;}
      if(kind[0]===-1)annual+=amounts;
      else if(kind[1]===-1)cashAnnual+=amounts;
    }
    const weekly=annual/52,monthly=annual/12,cashWeekly=cashAnnual/52;
    const profit=Math.max(+g.weekly||0,(+g.monthly||0)*12/52);
    const allocations=['emergency','maintenance','owner'].reduce((s,k)=>s+(+g[k]||0),0)*12/52;
    const afterTax=1-(+g.tax||0)/100;
    const targetProfit=allocations===0?profit:Math.max(profit,afterTax>0?allocations/afterTax:Infinity);
    return {weekly,monthly,annual,cashWeekly,cashAnnual,excluded,breakEven:keep>0?(weekly+fuel)/keep:Infinity,target:keep>0?(weekly+fuel+cashWeekly+escrow+targetProfit)/keep:Infinity,
      projected:p.job==='truck'?(+o.loaded||0)*((+o.linehaul||0)+(+o.fsc||0))+(+o.deadhead||0)*(+o.emptyRate||0):p.job==='mechanic'?(+o.hours||0)*(+o.hourly||0):null,
      upcoming:bills.map(b=>({...b,date:nextDate(b,today)})).sort((a,b)=>a.date.localeCompare(b.date))};
  }
  return {registry,goals,periods,key,nextDate,forecast};
})();
