const Reconciliation = (() => {
  function signed(value) {
    const text=String(value).trim();
    return text.startsWith('-') ? -Finance.cents(text.slice(1)) : Finance.cents(text.replace(/^\+/,''));
  }
  function statementLine(date, description, amount, month) {
    if(!Finance.day(date)||date.slice(0,7)!==month)throw Error('Choose a statement date in the selected month.');
    const name=description.trim(), cents=signed(amount);
    if(!name||name.length>180||!cents)throw Error('Enter a description (up to 180 characters) and a nonzero signed amount.');
    return {id:crypto.randomUUID(),date,description:name,cents,matches:[]};
  }
  function snapshot(row) {
    // A transfer with an unknown direction cannot be cleared against a statement.
    if(!row||Finance.lines(row).some(line=>!Finance.classes[line.classification][1]))return null;
    return {id:row.id,date:row.date,cash:Finance.total([row]).cash,category:row.category};
  }
  function usedIds(statements, exceptLine) {
    return new Set(statements.flatMap(s=>s.lines.filter(l=>l.id!==exceptLine).flatMap(l=>l.matches.map(m=>m.id))));
  }
  function review(statement, rows) {
    const current=new Map(rows.map(r=>[r.id,snapshot(r)]));
    const issues=[];
    const clearedIds=new Set();
    let movement=0;
    for(const line of statement.lines){
      movement+=line.cents;
      if(!line.matches.length){issues.push(line.description+' needs a match.');continue;}
      let cleared=0;
      for(const saved of line.matches){
        if(clearedIds.has(saved.id))issues.push(line.description+' shares a ledger entry with another match.');
        clearedIds.add(saved.id);
        const now=current.get(saved.id);
        if(!now||now.cash!==saved.cash||now.date!==saved.date||now.category!==saved.category){
          issues.push(line.description+' has a changed or missing ledger entry. Review the match.');
        }
        cleared+=saved.cash;
      }
      if(cleared!==line.cents)issues.push(line.description+' has a different ledger total.');
    }
    return {issues,difference:statement.closing-statement.opening-movement};
  }
  function close(statement,rows) {
    const result=review(statement,rows);
    if(result.issues.length||result.difference)throw Error('Resolve all matches and the ending balance difference before closing.');
    return {...statement,closed:true};
  }
  return {signed,statementLine,snapshot,usedIds,review,close};
})();
