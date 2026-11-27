'use strict';
// The paid work order is the receipt. Projecting its lines into the ledger
// lets one local write both close the order and record the payment.
const WorkPayments = {
  merge(ledger,orders){return [...new Map([...ledger,...this.rows(orders)].map(r=>[r.id,r])).values()]},
  // A paid quick quote projects one receipt into multiple ledger categories.
  // Correct the receipt as a unit, retaining its history and actual purchases.
  correctionMessage:'This removes every income and sales-tax entry from this quote payment and returns the quote to unpaid. Recorded part purchases stay in the ledger. Only use this if payment was recorded by mistake; no money is refunded.',
  correct(orders,quoteId,ledger=[],profile=null,at=new Date().toISOString()){
    const q=orders.find(x=>x.id===quoteId);
    if(!q?.paid)throw Error('This quote payment is no longer recorded.');
    const projected=this.rows([q]);
    if(!projected.length)throw Error('No recorded quote payment to remove.');
    const references=JSON.stringify([ledger,profile]);
    if(projected.some(r=>references.includes(JSON.stringify(r.id))))throw Error('This receipt has linked or reconciled entries. Resolve those links before removing the payment.');
    const history=q.paymentCorrections||[];
    if(history.length>=1000)throw Error('Payment correction history is full.');
    const {paid,...rest}=q;
    return orders.map(x=>x.id===quoteId?{...rest,paymentCorrections:[...history,{date:paid.date,cents:projected.reduce((n,r)=>n+r.cents,0),at}]}:x);
  },
  rows(orders) {
    const result=[];
    for(const q of orders){
      if(!q.paid)continue;
      const trade=q.trade||'Mechanic';
      if(!['Mechanic','Trucking','General contractor','Other business'].includes(trade))throw Error('Invalid quote business type.');
      const amounts=new Map();
      for(const item of q.items){
        const category=trade==='Mechanic'?({part:'Parts billed',labor:'Labor',mileage:'Mileage charge',supplies:'Shop supplies'})[item.kind]||'Other income':trade==='Trucking'?'Other income':'Services';
        const value=Math.round(item.qty*item.rate/100);
        amounts.set(category,(amounts.get(category)||0)+value);
      }
      if(q.tax)amounts.set('Sales tax collected',q.tax);
      for(const [category,cents] of amounts){
        if(!cents)continue;
        const id='payment-'+q.id+'-'+category.replaceAll(' ','-');
        result.push({id,trade,type:category==='Sales tax collected'?'Transfer':'Income',category,cents,date:q.paid.date,ref:q.id,note:q.customer});
      }
    }
    return result;
  }
};
