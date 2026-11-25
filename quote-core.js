'use strict';
const Q = (() => {
  const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
  const today = (offset=0) => {const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const amount = (qty,cents) => Math.round(qty*cents/100);
  function publicCopy(q) {
    const {id,issued,expires,shop,contact,customer,vehicle,description,tax}=q;
    return {id,issued,expires,shop,contact,customer,vehicle,description,tax,items:q.items.map(({label,qty,rate})=>({label,qty,rate}))};
  }
  function validate(q,privateFields=false) {
    const str=(v,max,empty=false)=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0);
    const integer=(v,max,min=0)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
    const date=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    if(!q||!/^Q-[a-f0-9]{12}$/.test(q.id)||!date(q.issued)||!date(q.expires)||!str(q.shop,80)||!str(q.contact,100)||!str(q.customer,80)||!str(q.vehicle,100,true)||!str(q.description,420)||!integer(q.tax,99999900)||!Array.isArray(q.items)||!q.items.length||q.items.length>12)throw Error('Invalid estimate.');
    for(const i of q.items)if(!str(i.label,70)||!integer(i.qty,999900,1)||!integer(i.rate,99999900)||(privateFields&&!integer(i.cost,99999900)))throw Error('Check each line description, quantity and amount.');
    if(q.expires<q.issued)throw Error('Estimate expiry precedes issue date.');
    if(privateFields&&q.paid&&(!date(q.paid.date)||q.paid.date>today()||total(q)<=0))throw Error('Invalid paid estimate date or total.');
    return q;
  }
  const total=q=>q.items.reduce((a,i)=>a+amount(i.qty,i.rate),q.tax);
  const encode=v=>btoa(Array.from(new TextEncoder().encode(JSON.stringify(v)),b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const decode=s=>{if(!s||s.length>24000)throw Error('Invalid link.');return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))};
  async function digest(q){const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(publicCopy(q))));return Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,'0')).join('')}
  function lines(q){return [q.shop,q.contact,'REPAIR ESTIMATE  '+q.id,'Issued '+q.issued+'   •   Valid through '+q.expires,'Customer: '+q.customer,...(q.vehicle?['Vehicle: '+q.vehicle]:[]),'',q.description,'',...q.items.flatMap(i=>[i.label,'    '+i.qty/100+' × '+dollars(i.rate)+'     '+dollars(amount(i.qty,i.rate))]),'','Subtotal   '+dollars(total(q)-q.tax),'Estimated tax   '+dollars(q.tax),'Total estimate   '+dollars(total(q))]}
  async function pdf(q){
    const doc=await PDFLib.PDFDocument.create();doc.setTitle('Repair estimate '+q.id);
    let canvas,ctx,y;function start(){canvas=document.createElement('canvas');canvas.width=1224;canvas.height=1584;ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1224,1584);ctx.fillStyle='#143f43';ctx.font='32px sans-serif';y=90}
    async function flush(){const img=await doc.embedJpg(canvas.toDataURL('image/jpeg',0.9));doc.addPage([612,792]).drawImage(img,{x:0,y:0,width:612,height:792})}
    async function row(text){if(y>1480){await flush();start()}ctx.fillText(text,75,y);y+=48}
    start();for(const line of lines(q)){let part='';for(const c of line){if(c==='\n'||ctx.measureText(part+c).width>1060){await row(part);part=''}if(c!=='\n')part+=c}await row(part)}await flush();return new File([await doc.save()],q.id+'.pdf',{type:'application/pdf'});
  }
  return {dollars,today,amount,publicCopy,validate,total,encode,decode,digest,lines,pdf};
})();
