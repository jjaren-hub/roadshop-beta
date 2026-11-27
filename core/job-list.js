// Remove unused estimates permanently; retain documents with financial or approval history.
const QuoteRemoval={
 mode(q,quick,rows=[],profile=null){
  if(q.removedAt)return 'restore';
  const linked=rows.some(r=>r.job===q.id||r.ref===q.id||r.id.startsWith('payment-'+q.id+'-'))||(quick&&JSON.stringify(profile||{}).includes('payment-'+q.id+'-'));
  const history=quick?q.paid||q.approval||q.partCosts?.length||q.paymentCorrections?.length:q.status!=='draft'||q.invoice||q.costs?.length||q.payments?.length||q.notes?.length||q.actualHours;
  return linked||history?'archive':'delete';
 },
 change(records,id,quick,rows,profile,expected,at=new Date().toISOString()){
  const q=records.find(r=>r.id===id);if(!q)throw Error('Quote no longer exists.');
  const mode=this.mode(q,quick,rows,profile);if(mode!==expected)throw Error('Quote changed. Reopen and try again.');
  if(mode==='delete')return records.filter(r=>r.id!==id);
  return records.map(r=>{if(r.id!==id)return r;if(mode==='archive')return {...r,removedAt:at};const {removedAt,...rest}=r;return rest;});
 },
 message(mode){return mode==='delete'?'Permanently delete this unused quote?':mode==='archive'?'Remove this quote from the regular list? Payment, approval and purchase history will be preserved. You can restore it from Deleted / archived quotes.':'Restore this quote to the regular list?';}
};
// Read-through view. Each record keeps its original editor, ID and payment history.
function showJobList(parent, quotes, jobs, actions) {
  function append(node, tag, text) {
    const child = document.createElement(tag);
    if (text !== undefined) child.textContent = text;
    node.append(child);
    return child;
  }
  const entries = [
    ...quotes.map(q => ({
      record: q, quick: true, customer: q.customer, vehicle: q.vehicle,
      description: q.description, date: q.issued, reference: q.id,
      status: q.paid ? 'paid' : q.approval ? 'approved' : 'estimate',
      total: Q.total(q), due: q.paid ? 0 : null
    })),
    ...jobs.map(job => {
      const balance = Mechanic.balance(job);
      return {
        record: job, quick: false, customer: job.customerSnapshot.name, vehicle: job.vehicleSnapshot,
        description: job.description, date: job.issued, reference: job.invoice?.number || job.id,
        status: job.status, total: balance.total, due: job.invoice ? balance.outstanding : null
      };
    })
  ].sort((a,b) => b.date.localeCompare(a.date) || a.customer.localeCompare(b.customer));
  const query = append(append(parent,'label','Search jobs'),'input');
  query.type='search';query.parentElement.className='job-list-filter';
  const filter = append(append(parent,'label','Show'),'select');
  filter.setAttribute('aria-label','Show');filter.parentElement.className='job-list-filter';
  for (const [value,label] of [['active','Active / pending'],['history','Paid / rejected / canceled history'],['all','All jobs'],['removed','Deleted / archived quotes']]) {
    filter.add(new Option(label,value));
  }
  const list=append(parent,'div');
  function draw() {
    list.replaceChildren();
    const term=query.value.trim().toLowerCase();
    for (const entry of entries) {
      const archived=['paid','rejected','canceled'].includes(entry.status);
      if(filter.value==='removed'){if(!entry.record.removedAt)continue;}else{if(entry.record.removedAt)continue;if(filter.value!=='all' && (filter.value==='history')!==archived)continue;}
      if(![entry.customer,entry.vehicle,entry.description,entry.reference,entry.status].join(' ').toLowerCase().includes(term))continue;
      const card=append(list,'section');card.className='card';card.dataset.cardId=entry.record.id;
      append(card,'h2',[entry.customer,entry.description].filter(Boolean).join(' · '));
      append(card,'p',[entry.quick?'Quick quote':'Work order',entry.record.removedAt?'Archived · '+entry.status:entry.status,entry.vehicle,entry.date].filter(Boolean).join(' · '));
      append(card,'p','Total '+Q.dollars(entry.total)+(entry.due===null?'':' · Balance due '+Q.dollars(entry.due)));
      actions(card,entry.record,entry.quick);
      const open=card.querySelector(':scope > :is(a,button)');if(open)open.dataset.cardAction='';
    }
    if(!list.childElementCount)append(list,'p',term?'No matching jobs. Try another name or reference.':filter.value==='history'?'Paid, rejected and canceled jobs appear here.':'No jobs in this view yet.');
  }
  query.oninput=draw;filter.onchange=draw;draw();
}
