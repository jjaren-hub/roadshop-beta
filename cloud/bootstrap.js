BookStore.start().then(async ready=>{
  if(!ready)return;
  const backupScript=document.createElement('script');backupScript.src='core/backup.js';backupScript.onload=()=>{const main=document.querySelector('main');if(main)EarnKeepBackup.attach(BookStore.ownerId,main)};document.head.append(backupScript);
  const entry=document.getElementById('entry-script').dataset.src;
  if(BookStore.readOnly){
    const notice=document.createElement('p');
    notice.className='tax-warning';notice.setAttribute('role','status');
    notice.textContent=RoadCommercial.readOnly+' ';
    const billing=document.createElement('a');billing.href='subscribe.html';billing.textContent='Subscription options';
    notice.append(billing);document.querySelector('main').prepend(notice);
  }else if(entry==='workspace.js'&&!RoadCommercial.enrolled(DeviceSession.current)){
    try{const s=await RoadCommercial.load();if(!RoadCommercial.access(s)){const a=document.createElement('a');a.href='billing.html';a.textContent=' Subscription inactive · manage billing or export';document.getElementById('workspace-status')?.append(a);}}catch{}
  }

  const profile=JSON.parse(BookStore.getItem(Planning.key)||'null');
  const businessReady=profile?.complete===true && !!Planning.registry[profile.job];
  const mechanicHome=businessReady && profile.job==='mechanic';
  if((entry!=='workspace.js' && !profile?.complete) || (entry==='app.js' && !mechanicHome && !new URLSearchParams(location.search).has('ledger')) || (entry==='trucking.js' && profile?.job!=='truck') || (entry==='mechanic.js' && profile?.job!=='mechanic')){
    location.replace(profile?.complete?'workspace.html?home=1':'workspace.html');return;
  }
  if(businessReady) installBusinessTabs(entry,profile.job);
  const logout=document.getElementById('signout');
  if(window.cloudClient && logout){
    logout.hidden=false;
    logout.onclick=async()=>{
      try{await window.flushWorkspaceDraft?.();}catch(e){document.getElementById('workspace-status').textContent=e.message;return;}
      try{await DeviceSession.signOut()}catch(error){document.getElementById('workspace-status').textContent=error.message;return;}
      sessionStorage.removeItem('roadshop-active-workspace');location.replace('account.html');
    };
  }

  const script=document.createElement('script');
  script.src=document.getElementById('entry-script').dataset.src;
  let failed=false;
  const initializationError=event=>{if(event.filename===script.src){failed=true;showAuthError(Error('Workspace initialization failed. Reload or return to sign in.'));}};
  window.addEventListener('error',initializationError);
  script.onload=()=>{window.removeEventListener('error',initializationError);if(!failed){document.body.removeAttribute('data-auth-pending');document.getElementById('auth-status')?.remove();}};
  script.onerror=()=>{window.removeEventListener('error',initializationError);showAuthError(Error('Could not load the workspace. Reload and try again.'));};
  document.body.append(script);
}).catch(showAuthError);
function businessShortcuts(job){
  if(job!=='truck')return [{label:'Quotes',href:'quotes.html'}];
  if(BookStore.readOnly)return [{label:'Trucking',href:'trucking.html'},{label:'Reports',href:'reports.html'}];
  return [{label:'Add load',href:'trucking.html?tab=loads&add=load'},{label:'Add Fuel',href:'finance.html?tab=ledger&add=fuel'},{label:'Add expense',href:'finance.html?tab=ledger&add=expense'}];
}
function installBusinessTabs(entry,job){
  // Use the existing Ledger button on the ledger page so its settings view still works.
  const nav=document.querySelector('body > nav')||document.createElement('nav');
  const ledger=entry==='app.js'?document.getElementById('home'):document.createElement('a');
  if(entry!=='app.js'){ledger.href='ledger.html?ledger';ledger.textContent='Ledger';}
  ledger.classList.add('navlink');
  const actions=businessShortcuts(job).map(shortcut=>{
    const action=document.createElement('a');action.href=shortcut.href;action.textContent=shortcut.label;action.className='navlink';
    if(job!=='truck'&&entry==='quotes.js')action.setAttribute('aria-current','page');
    return action;
  });
  nav.classList.toggle('trucking-tabs',job==='truck');
  const settings=document.getElementById('account');
  if(entry==='app.js' && settings){document.querySelector('.workspace-heading .workspace-nav').append(settings);}
  nav.classList.add('mechanic-tabs','business-tabs');nav.setAttribute('aria-label','Business navigation');
  nav.replaceChildren(ledger,...actions);if(!nav.isConnected)document.body.append(nav);
  document.body.classList.add('has-mechanic-tabs');
}
function showAuthError(error){if(typeof RoadCommercial!=='undefined')RoadCommercial.activity('error');
  const notice=document.getElementById('auth-status');
  if(!notice){document.querySelector('main').hidden=true;return;}
  notice.textContent='Could not open workspace. '+error.message+' ';
  const a=document.createElement('a');a.href='account.html';a.textContent='Return to sign in';notice.append(a);const b=document.createElement('a');b.href='offline.html';b.textContent='Open encrypted offline entry';notice.append(document.createElement('br'),b);
}
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
