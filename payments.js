'use strict';
// The paid work order is the receipt. Projecting its lines into the ledger
// lets one local write both close the order and record the payment.
const WorkPayments = {
  merge(ledger,orders){return [...new Map([...ledger,...this.rows(orders)].map(r=>[r.id,r])).values()]},
  rows(orders) {
    const result=[];
    for(const q of orders){
      if(!q.paid)continue;
      const trade=q.trade||'Mechanic';
      if(!['Mechanic','Trucking','General contractor','Other business'].includes(trade))throw Error('Invalid quote business type.');
      const amounts=new Map();
      for(const item of q.items){
        const category=trade==='Mechanic'?({part:'Parts billed',labor:'Labor',mileage:'Mileage charge'})[item.kind]||'Other income':trade==='Trucking'?'Other income':'Services';
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
