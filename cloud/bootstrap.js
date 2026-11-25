BookStore.start().then(async ready=>{
  if(!ready)return;
  const entry=document.getElementById('entry-script').dataset.src;
  if(typeof RoadCommercial!=='undefined'){const feature=({'workspace.js':'dashboard','finance.js':'finance','app.js':'finance','trucking.js':'trucking','mechanic.js':'mechanic','scanner.js':'scanner','tax-planning.js':'tax','reports.js':'reports','quotes.js':'mechanic'})[entry];if(entry==='workspace.js'){try{const s=await RoadCommercial.load();if(!RoadCommercial.access(s)){const a=document.createElement('a');a.href='billing.html';a.textContent=' Subscription inactive · manage billing or export';document.getElementById('workspace-status')?.append(a);}}catch{}}RoadCommercial.activity(feature);}

  const profile=JSON.parse(BookStore.getItem(Planning.key)||'null');
  const module=Planning.registry[profile?.job];
  const mechanicHome=profile?.complete===true && profile.job==='mechanic';
  // Permanent mechanic tabs are independent of optional dashboard shortcuts.
  const quotesAllowed=!module || profile.job==='mechanic';
  if((entry!=='workspace.js' && !profile?.complete) || (entry==='app.js' && !mechanicHome && !new URLSearchParams(location.search).has('ledger')) || (entry==='quotes.js' && !quotesAllowed) || (entry==='trucking.js' && profile?.job!=='truck') || (entry==='mechanic.js' && profile?.job!=='mechanic')){
    location.replace(profile?.complete?'workspace.html?home=1':'workspace.html');return;
  }
  if (!quotesAllowed) document.querySelectorAll('a[href="quotes.html"]').forEach(a=>a.remove());
  if(mechanicHome) installMechanicTabs(entry);
  const logout=document.getElementById('signout');
  if(window.cloudClient && logout){
    const {data}=await cloudClient.auth.getSession();
    logout.hidden=!data.session;
    logout.onclick=async()=>{
      try{await window.flushWorkspaceDraft?.();}catch(e){document.getElementById('workspace-status').textContent=e.message;return;}
      const {error}=await cloudClient.auth.signOut({scope:'local'});
      if(error){document.getElementById('workspace-status').textContent=error.message;return;}
      sessionStorage.removeItem('roadshop-active-workspace');location.replace('account.html');
    };
  }

  const script=document.createElement('script');
  script.src=document.getElementById('entry-script').dataset.src;
  script.onload=()=>{document.body.removeAttribute('data-auth-pending');document.getElementById('auth-status')?.remove();};
  script.onerror=()=>showAuthError(Error('Could not load the workspace. Reload and try again.'));
  document.body.append(script);
}).catch(showAuthError);
function installMechanicTabs(entry){
  // Use the existing Ledger button on the ledger page so its settings view still works.
  const nav=document.querySelector('body > nav')||document.createElement('nav');
  const ledger=entry==='app.js'?document.getElementById('home'):document.createElement('a');
  if(entry!=='app.js'){ledger.href='./?ledger';ledger.textContent='Ledger';}
  const quote=document.createElement('a');quote.href='quotes.html';quote.textContent='Quotes';
  ledger.classList.add('navlink');quote.className='navlink';
  if(entry==='quotes.js')quote.setAttribute('aria-current','page');
  const settings=document.getElementById('account');
  if(entry==='app.js' && settings){document.querySelector('.workspace-heading .workspace-nav').append(settings);}
  nav.classList.add('mechanic-tabs');nav.setAttribute('aria-label','Mechanic navigation');
  nav.replaceChildren(ledger,quote);if(!nav.isConnected)document.body.append(nav);
  document.body.classList.add('has-mechanic-tabs');
}
function showAuthError(error){if(typeof RoadCommercial!=='undefined')RoadCommercial.activity('error');
  const notice=document.getElementById('auth-status');
  if(!notice){document.querySelector('main').hidden=true;return;}
  notice.textContent='Could not open workspace. '+error.message+' ';
  const a=document.createElement('a');a.href='account.html';a.textContent='Return to sign in';notice.append(a);const b=document.createElement('a');b.href='offline.html';b.textContent='Open encrypted offline entry';notice.append(document.createElement('br'),b);
}
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
