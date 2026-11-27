// Rendered inside the authenticated Finance page. Each save uses its workspace revision.
function reconciliation(selectedId) {
  const R=Reconciliation, statements=profile.reconciliations||[], ledger=all();
  const statement=statements.find(s=>s.id===selectedId);
  const root=panel('Month-end reconciliation');
  const area=el(root,'div');area.id='finance-editor';
  async function persist(next, action) {
    const saved={...next,history:[...(next.history||[]),{at:new Date().toISOString(),action}]};
    const nextList=statements.some(s=>s.id===saved.id)?statements.map(s=>s.id===saved.id?saved:s):[...statements,saved];
    await saveProfile({...profile,reconciliations:nextList});
    feedback.textContent='Statement saved.';reconciliation(saved.id);
  }
  function balances(p,source) {
    const opening=input(p,'Opening balance ($)',source?dollars(source.opening):'');
    const closing=input(p,'Ending balance ($)',source?dollars(source.closing):'');
    return ()=>({opening:R.signed(opening.value),closing:R.signed(closing.value)});
  }
  if(!statement){
    el(area,'p','Compare a bank statement or settlement with recorded cash movements. Each match belongs to one statement in this business.');
    for(const s of [...statements].sort((a,b)=>b.month.localeCompare(a.month))){
      button(area,s.account+' · '+s.month+' · '+(s.closed?'Closed':'Draft'),()=>reconciliation(s.id));
    }
    const form=section(area,'Start a statement');
    const account=input(form,'Account or statement name'),month=input(form,'Statement month',today().slice(0,7),'month');
    el(form,'p','For a settlement, use zero as the opening balance and the net settlement as the ending balance.');
    const values=balances(form);
    button(form,'Start reconciliation',async()=>{
      const name=account.value.trim(),period=month.value;
      if(!name||name.length>100||!F.day(period+'-01'))throw Error('Enter an account name (up to 100 characters) and a valid month.');
      if(statements.some(s=>s.month===period&&s.account.toLowerCase()===name.toLowerCase()))throw Error('Open the existing statement for that account and month.');
      await persist({id:id(),account:name,month:period,...values(),lines:[],closed:false},'Started statement');
    });
    return;
  }
  button(area,'All statements',()=>reconciliation());
  const heading=section(area,statement.account+' · '+statement.month);heading.dataset.cardId=statement.id;
  const review=R.review(statement,ledger);
  el(heading,'p',(statement.closed?'Closed':'Draft')+' · Opening '+money(statement.opening)+' · Ending '+money(statement.closing));
  el(heading,'p','Ending balance difference: '+money(review.difference));
  for(const issue of review.issues)el(heading,'p',issue);
  if(statement.closed){
    if(review.issues.length)el(heading,'p','The saved statement has changed ledger matches. Reopen it to review.');
    button(heading,'Reopen statement',async()=>{if(confirm('Reopen this statement for correction? The prior close stays in its history.'))await persist({...statement,closed:false},'Reopened statement');});
  }else{
    const edit=el(heading,'details');el(edit,'summary','Correct statement balances');
    const values=balances(edit,statement);button(edit,'Save balances',()=>persist({...statement,...values()},'Updated balances'));
    const entry=section(area,'Add statement lines');
    el(entry,'p','Use a positive amount for money in and a minus sign for money out. Match each line to one or more ledger entries.');
    const date=input(entry,'Statement date',statement.month+'-01','date'),description=input(entry,'Statement description'),amount=input(entry,'Signed amount ($)');
    button(entry,'Add statement line',()=>addLines([R.statementLine(date.value,description.value,amount.value,statement.month)]));
    const imp=el(entry,'details');el(imp,'summary','Import statement CSV');
    el(imp,'p','Use columns date,description,amount with dates as YYYY-MM-DD and signed dollar amounts. Import one statement month at a time.');
    const upload=input(imp,'Statement CSV','','file');upload.accept='.csv,text/csv';
    button(imp,'Import lines',async()=>{
      const file=upload.files[0];if(!file||file.size>1000000)throw Error('Choose a CSV file up to 1 MB.');
      const [head,...records]=F.csvParse((await file.text()).replace(/^\uFEFF/,''));
      const columns=['date','description','amount'].map(key=>head?.findIndex(h=>h.trim().toLowerCase()===key)??-1);
      if(columns.includes(-1))throw Error('The CSV needs date, description and amount columns.');
      const imported=records.filter(r=>r.some(v=>v.trim())).map(r=>R.statementLine(...columns.map(i=>r[i]||''),statement.month));
      if(!imported.length)throw Error('The CSV has no statement lines.');
      if(imported.some(l=>statement.lines.some(x=>x.date===l.date&&x.description===l.description&&x.cents===l.cents)))throw Error('The file overlaps saved lines. Import only new rows or enter a distinct repeat manually.');
      if(confirm('Add '+imported.length+' statement lines?'))await addLines(imported);
    });
  }
  async function addLines(lines) {
    if(statement.lines.length+lines.length>1000)throw Error('Use up to 1,000 lines per statement.');
    await persist({...statement,lines:[...statement.lines,...lines]},'Added '+lines.length+' statement line(s)');
  }
  const list=section(area,'Statement lines');
  if(!statement.lines.length)el(list,'p','No lines yet. For a statement with no activity, verify that the opening and ending balances agree.');
  for(const line of statement.lines){
    const box=el(list,'details');box.dataset.cardId=line.id;el(box,'summary',line.date+' · '+line.description+' · '+money(line.cents)+' · '+(line.matches.length?'Matched':'Needs match'));
    for(const m of line.matches)el(box,'p','Saved match: '+m.date+' · '+m.category+' · '+money(m.cash));
    if(statement.closed)continue;
    // Create the picker only when opened, including on large imported statements.
    let built=false;box.addEventListener('toggle',()=>{if(box.open&&!built){built=true;picker(box,line);}});
  }
  function picker(box,line){
    const unavailable=R.usedIds(statements,line.id);
    const candidates=ledger.map(R.snapshot).filter(row=>row&&!unavailable.has(row.id)&&row.date.slice(0,7)<=statement.month);
    candidates.sort((a,b)=>Number(b.cash===line.cents)-Number(a.cash===line.cents)||Math.abs(Date.parse(a.date)-Date.parse(line.date))-Math.abs(Date.parse(b.date)-Date.parse(line.date)));
    const selected=new Set(line.matches.map(m=>m.id).filter(key=>candidates.some(c=>c.id===key)));
    const search=input(box,'Find ledger entries'),choices=el(box,'div'),total=el(box,'p');
    function subtotal(){return candidates.filter(c=>selected.has(c.id)).reduce((sum,item)=>sum+item.cash,0);}
    function refreshTotal(){total.textContent='Selected '+money(subtotal())+' · Remaining '+money(line.cents-subtotal());}
    function draw(){
      choices.replaceChildren();const term=search.value.trim().toLowerCase();
      const results=candidates.filter(c=>[c.category,c.date,dollars(c.cash),c.id].join(' ').toLowerCase().includes(term));
      for(const row of results.slice(0,50)){
        const label=el(choices,'label'),check=el(label,'input');check.type='checkbox';check.checked=selected.has(row.id);
        label.append(row.date+' · '+row.category+' · '+money(row.cash));
        check.onchange=()=>{if(check.checked)selected.add(row.id);else selected.delete(row.id);refreshTotal();};
      }
      if(!results.length)el(choices,'p','No available entries match. Check the ledger, then return here.');
      if(results.length>50)el(choices,'p','First 50 shown. Narrow the search by date, category or amount.');
      refreshTotal();
    }
    const suggestions=candidates.filter(row=>row.date===line.date&&row.cash===line.cents);
    if(!line.matches.length&&suggestions.length===1){
      const only=suggestions[0];
      button(box,'Select suggested match',()=>{selected.clear();selected.add(only.id);search.value=only.id;draw();});
      el(box,'small','Same date and amount: '+only.category+'. Verify the entry, then save the match.');
    }else if(suggestions.length>1)el(box,'small','Several entries have the same date and amount. Check the records before choosing.');
    search.oninput=draw;draw();
    function replaceMatches(matches,action){return persist({...statement,lines:statement.lines.map(l=>l.id===line.id?{...l,matches}:l)},action+' · '+line.description);}
    button(box,'Save match',()=>{
      if(!selected.size||subtotal()!==line.cents)throw Error('Select ledger entries whose signed amounts add up to this statement line.');
      return replaceMatches(candidates.filter(c=>selected.has(c.id)),'Matched');
    });
    if(line.matches.length)button(box,'Clear match',()=>replaceMatches([],'Cleared match'));
    button(box,'Remove statement line',async()=>{if(confirm('Remove this statement line and its matches? Your ledger entries will stay in place.'))await persist({...statement,lines:statement.lines.filter(l=>l.id!==line.id)},'Removed line · '+line.description);});
  }
  const uncleared=el(area,'details');el(uncleared,'summary','Unmatched ledger activity this month');
  el(uncleared,'p','This list covers the whole business. Entries for another account or a later statement can remain unmatched.');
  const used=R.usedIds(statements);
  const outstanding=ledger.filter(r=>r.date.slice(0,7)===statement.month&&!used.has(r.id));
  for(const row of outstanding){const snap=R.snapshot(row);el(uncleared,'p',row.date+' · '+row.category+' · '+(snap?money(snap.cash):'Unknown cash direction'));}
  if(!outstanding.length)el(uncleared,'p','No unmatched entries for this month.');
  if(!statement.closed){
    button(area,'Close statement',async()=>{
      const next=R.close(statement,ledger);
      if(confirm('Confirm that every statement line is included and the balances match?'))await persist(next,'Closed statement · '+statement.lines.length+' lines · opening '+money(statement.opening)+' · ending '+money(statement.closing));
    });
  }
  const history=el(area,'details');el(history,'summary','Statement history');
  for(const h of [...statement.history].reverse())el(history,'p',h.at+' · '+h.action);
}
