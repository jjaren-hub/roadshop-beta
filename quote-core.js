'use strict';
const Q = (() => {
  const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
  const today = (offset=0) => {const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const amount = (qty,cents) => Math.round(qty*cents/100);
  function publicCopy(q) {
    const {id,issued,expires,shop,contact,customer,vehicle,description,tax}=q;
    return {id,issued,expires,shop,contact,customer,vehicle,description,tax,...(q.trade?{trade:q.trade}:{}),items:q.items.map(({label,qty,rate})=>({label,qty,rate}))};
  }
  function validate(q,privateFields=false) {
    const str=(v,max,empty=false)=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0);
    const integer=(v,max,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
    const date=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    if(!q||!/^Q-[a-f0-9]{12}$/.test(q.id)||!date(q.issued)||!date(q.expires)||!str(q.shop,80)||!str(q.contact,100)||!str(q.customer,80)||!str(q.vehicle,100,true)||!str(q.description,420)||!integer(q.tax,99999900)||!Array.isArray(q.items)||!q.items.length||q.items.length>12)throw Error('Invalid estimate.');
    for(const i of q.items)if(!str(i.label,70)||!integer(i.qty,999900,1)||!integer(i.rate,99999900)||(privateFields&&!integer(i.cost,99999900)))throw Error('Check each line description, quantity and amount.');
    if(q.trade!==undefined&&!['Mechanic','Trucking','General contractor','Other business'].includes(q.trade))throw Error('Invalid quote business type.');
    if(q.expires<q.issued)throw Error('Estimate expiry precedes issue date.');
    if(privateFields&&q.paid&&(!date(q.paid.date)||q.paid.date>today()||total(q)<=0))throw Error('Invalid paid estimate date or total.');
    return q;
  }
  const total=q=>q.items.reduce((a,i)=>a+amount(i.qty,i.rate),q.tax);
  const encode=v=>btoa(Array.from(new TextEncoder().encode(JSON.stringify(v)),b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const decode=s=>{if(!s||s.length>24000)throw Error('Invalid link.');return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))};
  async function digest(q){const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(publicCopy(q))));return Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,'0')).join('')}
  function lines(q){return [q.shop,q.contact,(q.trade&&q.trade!=='Mechanic'?'SERVICE ESTIMATE  ':'REPAIR ESTIMATE  ')+q.id,'Issued '+q.issued+'   •   Valid through '+q.expires,'Customer: '+q.customer,...(q.vehicle?[(q.trade&&q.trade!=='Mechanic'?'Project / vehicle: ':'Vehicle: ')+q.vehicle]:[]),'',q.description,'',...q.items.flatMap(i=>[i.label,'    '+i.qty/100+' × '+dollars(i.rate)+'     '+dollars(amount(i.qty,i.rate))]),'','Subtotal   '+dollars(total(q)-q.tax),'Estimated tax   '+dollars(q.tax),'Total estimate   '+dollars(total(q))]}
  // Customer-facing projection only. No acquisition cost, margin, private notes or approval evidence.
  function document(q){const x=publicCopy(validate(q));return {kind:'quote',number:x.id,issued:x.issued,due:x.expires,shop:x.shop,contact:x.contact,customer:x.customer,vehicle:x.vehicle,description:x.description,serviceLabel:x.trade&&x.trade!=='Mechanic'?'Project / reference':'Vehicle',lines:x.items.map(i=>({label:i.label,qty:i.qty,rate:i.rate,total:amount(i.qty,i.rate)})),gross:total(x)-x.tax,discount:0,subtotal:total(x)-x.tax,tax:x.tax,total:total(x)}}
  const title=d=>d.kind==='invoice'?'INVOICE':d.serviceLabel==='Project / reference'?'SERVICE ESTIMATE':'REPAIR ESTIMATE';
  const qty=n=>String(n/100);
  function summary(d){const r=[];if(d.discount){r.push(['Charges',d.gross],['Discount',-d.discount])}r.push(['Subtotal',d.subtotal],[d.kind==='invoice'?'Sales tax':'Estimated tax',d.tax],[d.kind==='invoice'?'Invoice total':'Total estimate',d.total]);if(d.kind==='invoice')r.push(['Payments received',d.paid],['Balance due',d.outstanding]);return r}
  function renderDocument(parent,d){const make=(p,tag,value,cls)=>{const n=window.document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;p.append(n);return n};const sheet=make(parent,'section',undefined,'customer-document');sheet.setAttribute('aria-label',title(d));const top=make(sheet,'div',undefined,'document-top'),shop=make(top,'div');make(shop,'h2',d.shop||'Repair service');for(const v of [d.contact,d.address])if(v)make(shop,'p',v);const meta=make(top,'div',undefined,'document-meta');make(meta,'h3',title(d));make(meta,'p',d.number);make(meta,'p','Issued: '+d.issued);make(meta,'p',(d.kind==='invoice'?'Due: ':'Valid through: ')+d.due);const info=make(sheet,'div',undefined,'document-info');const customer=make(info,'div');make(customer,'h3',d.kind==='invoice'?'BILL TO':'CUSTOMER');for(const v of [d.customer,d.customerContact,d.billing])if(v)make(customer,'p',v);const vehicle=make(info,'div');make(vehicle,'h3',(d.serviceLabel||'Vehicle / equipment').toUpperCase());for(const v of [d.vehicle,d.vin?'VIN / serial: '+d.vin:'',d.mileage!==undefined&&d.mileage!==null?'Odometer: '+d.mileage+' mi':'',d.serviceAddress?'Service address: '+d.serviceAddress:''])if(v)make(vehicle,'p',v);make(sheet,'h3','WORK REQUESTED');make(sheet,'p',d.description,'document-description');const table=make(sheet,'table',undefined,'document-table'),head=make(make(table,'thead'),'tr');for(const label of ['Description','Qty / hrs','Unit rate','Amount'])make(head,'th',label).scope='col';const body=make(table,'tbody');for(const l of d.lines){const r=make(body,'tr');make(r,'td',l.label);make(r,'td',qty(l.qty));make(r,'td',dollars(l.rate));make(r,'td',dollars(l.total))}const sums=make(sheet,'dl',undefined,'document-totals');const totals=summary(d);totals.forEach(([label,value],i)=>{const r=make(sums,'div',undefined,i===totals.length-1?'document-grand':'');make(r,'dt',label);make(r,'dd',dollars(value))});if(d.terms){make(sheet,'h3','TERMS / NOTES');make(sheet,'p',d.terms,'document-description')}if(d.kind!=='invoice'){const approval=make(sheet,'div',undefined,'document-approval');make(approval,'p','Customer approval / signature __________________');make(approval,'p','Date ______________')}make(sheet,'p','Customer copy · Prepared with EarnKeep','document-footer');return sheet}
  async function documentPdf(d,filename){
    const doc=await PDFLib.PDFDocument.create();doc.setTitle(title(d)+' '+d.number);
    const W=612,H=792,L=36,R=576,B=738,ink='#182420',muted='#46574f',line='#bcc8c0',pale='#f0f4ef',green='#315c36';
    const pages=[];let canvas,ctx,y=0;const font=(size=10,bold=false)=>ctx.font=(bold?'bold ':'')+size+'px Arial, sans-serif';
    const text=(s,x,yy,size=10,bold=false,color=ink,align='left')=>{font(size,bold);ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(String(s??''),x,yy);ctx.textAlign='left'};
    const rect=(x,yy,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,yy,w,h)};
    const rule=(yy,x=L,end=R)=>{ctx.strokeStyle=line;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(end,yy);ctx.stroke()};
    function wrap(v,width,size=10,bold=false){font(size,bold);const result=[];for(const para of String(v??'').split('\n')){let row='';for(const word of para.split(/\s+/)){const candidate=row?row+' '+word:word;if(ctx.measureText(candidate).width<=width){row=candidate;continue}if(row){result.push(row);row=''}for(const ch of word){if(ctx.measureText(row+ch).width>width&&row){result.push(row);row=''}row+=ch}}result.push(row)}return result}
    function start(){canvas=window.document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;ctx=canvas.getContext('2d');ctx.scale(2,2);rect(0,0,W,H,'white');pages.push(canvas);rect(L,30,540,4,green);y=44}
    function next(){start();text(title(d)+' · '+d.number,L,y,10,true);y+=22;rule(y);y+=14}
    function need(n){if(y+n>B)next()}
    function block(v,width=540,size=10,bold=false,color=ink){for(const s of wrap(v,width,size,bold)){need(size+5);text(s,L,y,size,bold,color);y+=size+4}}
    function section(label){need(33);y+=7;text(label,L,y,9,true,green);y+=16}
    function tableHead(){need(30);rect(L,y,540,23,pale);text('DESCRIPTION',L+7,y+6,8,true);text('QTY / HRS',375,y+6,8,true,ink,'right');text('UNIT RATE',468,y+6,8,true,ink,'right');text('AMOUNT',R-7,y+6,8,true,ink,'right');y+=23}
    start();
    // Place the document identity on its own line before wrapping variable-length shop details.
    text(title(d),R,y,17,true,green,'right');y+=27;
    for(const s of wrap(d.shop||'Repair service',540,19,true)){need(24);text(s,L,y,19,true);y+=23}
    for(const v of [d.contact,d.address])if(v)block(v,540,10,false,muted);
    y+=8;block('Document no. '+d.number,540,10,true);block('Issued: '+d.issued+'     '+(d.kind==='invoice'?'Due: ':'Valid through: ')+d.due);y+=10;rule(y);y+=10;
    // Two-column customer/vehicle block; long fields safely flow instead of clipping.
    const left=[d.customer,d.customerContact,d.billing].filter(Boolean).flatMap(v=>wrap(v,253));
    const right=[d.vehicle,d.vin?'VIN / serial: '+d.vin:'',d.mileage!==undefined&&d.mileage!==null?'Odometer: '+d.mileage+' mi':'',d.serviceAddress?'Service address: '+d.serviceAddress:''].filter(Boolean).flatMap(v=>wrap(v,253));
    need(30);text(d.kind==='invoice'?'BILL TO':'CUSTOMER',L,y,9,true,green);text((d.serviceLabel||'VEHICLE / EQUIPMENT').toUpperCase(),314,y,9,true,green);y+=16;
    for(let i=0;i<Math.max(left.length,right.length,1);i++){need(14);if(left[i])text(left[i],L,y);if(right[i])text(right[i],314,y);y+=14}
    y+=8;rule(y);section('WORK REQUESTED');block(d.description);y+=10;tableHead();
    for(const l of d.lines){const desc=wrap(l.label,286,10);let first=true;for(let i=0;i<desc.length;i++){if(y+20>B){next();tableHead()}text(desc[i],L+7,y+4);if(first){text(qty(l.qty),375,y+4,10,false,ink,'right');text(dollars(l.rate),468,y+4,10,false,ink,'right');text(dollars(l.total),R-7,y+4,10,true,ink,'right');first=false}y+=16}y+=4;rule(y);y+=2}
    const totals=summary(d);need(18+totals.length*22);y+=14;for(const [i,[label,value]] of totals.entries()){const last=i===totals.length-1;if(last)rect(306,y-3,270,23,pale);text(label,314,y,10,last);text(dollars(value),R-7,y,11,last,ink,'right');y+=22}
    if(d.terms){section('TERMS / NOTES');block(d.terms)}
    if(d.kind!=='invoice'){need(43);y+=23;rule(y,L,365);rule(y,404,R);y+=5;text('Customer approval / signature',L,y,8,false,muted);text('Date',404,y,8,false,muted);y+=12}
    for(let i=0;i<pages.length;i++){canvas=pages[i];ctx=canvas.getContext('2d');rule(752);text('Customer copy · Prepared with EarnKeep',L,760,8,false,muted);text('Page '+(i+1)+' of '+pages.length,R,760,8,false,muted,'right');const img=await doc.embedJpg(canvas.toDataURL('image/jpeg',.94));doc.addPage([W,H]).drawImage(img,{x:0,y:0,width:W,height:H})}
    return new File([await doc.save()],filename,{type:'application/pdf'});
  }
  function downloadFile(file) {
    const link = window.document.createElement('a');
    const url = URL.createObjectURL(file);
    link.href = url;
    link.download = file.name;
    window.document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function pdf(q){return documentPdf(document(q),q.id+'.pdf')}
  return {dollars,today,amount,publicCopy,validate,total,encode,decode,digest,lines,pdf,document,renderDocument,documentPdf,downloadFile,summary};
})();
