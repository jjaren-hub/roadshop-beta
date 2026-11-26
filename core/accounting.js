function parseAmount(v){if(!/^\d{1,8}(\.\d{1,2})?$/.test(v.trim()))return 0;const [a,b='']=v.trim().split('.');return Number(a)*100+Number(b.padEnd(2,'0'))}
function validate(list){
  if(!Array.isArray(list)||list.length>100000)throw Error();
  const seen=new Set();
  return list.map(r=>{
    if(!r || typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(r.id)||seen.has(r.id)||
      !Object.hasOwn(categories,r.trade)||!Object.hasOwn(categories[r.trade],r.type)||(typeof r.category!=='string'||!r.category.trim()||r.category.length>100)||
      !Number.isSafeInteger(r.cents)||r.cents<1||r.cents>9999999999||
      typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||
      typeof r.ref!=='string'||r.ref.length>100||typeof r.note!=='string'||r.note.length>250)throw Error();
    seen.add(r.id);if(typeof Finance!=='undefined')Finance.check(r);return {...r};
  });
}
function totals(list){if(typeof Finance!=='undefined')return Finance.total(list);let income=0,expense=0;for(const r of list){if(r.type==='Income')income+=r.cents;if(r.type==='Expense')expense+=r.cents}return {income,expense,net:income-expense}}
