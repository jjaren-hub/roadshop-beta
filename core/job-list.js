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
  query.type='search';
  const filter = append(append(parent,'label','Show'),'select');
  filter.setAttribute('aria-label','Show');
  for (const [value,label] of [['active','Active / pending'],['history','Paid / rejected / canceled history'],['all','All jobs']]) {
    filter.add(new Option(label,value));
  }
  const list=append(parent,'div');
  function draw() {
    list.replaceChildren();
    const term=query.value.trim().toLowerCase();
    for (const entry of entries) {
      const archived=['paid','rejected','canceled'].includes(entry.status);
      if(filter.value!=='all' && (filter.value==='history')!==archived)continue;
      if(![entry.customer,entry.vehicle,entry.description,entry.reference,entry.status].join(' ').toLowerCase().includes(term))continue;
      const card=append(list,'section');card.className='card';
      append(card,'h2',[entry.customer,entry.description].filter(Boolean).join(' · '));
      append(card,'p',[entry.quick?'Quick quote':'Work order',entry.status,entry.vehicle,entry.date].filter(Boolean).join(' · '));
      append(card,'p','Total '+Q.dollars(entry.total)+(entry.due===null?'':' · Balance due '+Q.dollars(entry.due)));
      actions(card,entry.record,entry.quick);
    }
    if(!list.childElementCount)append(list,'p',term?'No matching jobs. Try another name or reference.':filter.value==='history'?'Paid, rejected and canceled jobs appear here.':'No jobs in this view yet.');
  }
  query.oninput=draw;filter.onchange=draw;draw();
}
