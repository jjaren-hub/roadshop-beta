BookStore.start().then(async()=>{
  const entry=document.getElementById('entry-script').dataset.src;
  const profile=JSON.parse(BookStore.getItem(Planning.key)||'null');
  const module=Planning.registry[profile?.job];
  const quotesAllowed=!module || (profile.job==='mechanic' && !profile.hidden.includes('quotes'));
  if((entry==='app.js' && !new URLSearchParams(location.search).has('ledger')) || (entry==='quotes.js' && !quotesAllowed)){
    location.replace('workspace.html');return;
  }
  if (!quotesAllowed) document.querySelectorAll('a[href="quotes.html"]').forEach(a=>a.remove());
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
  document.body.append(script);
}).catch(error=>{
  document.getElementById('workspace-status').textContent='Could not open workspace. '+error.message;
  document.querySelector('main').hidden=true;
});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
