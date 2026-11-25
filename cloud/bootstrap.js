BookStore.start().then(async ready=>{
  if(!ready)return;
  const entry=document.getElementById('entry-script').dataset.src;
  const profile=JSON.parse(BookStore.getItem(Planning.key)||'null');
  const module=Planning.registry[profile?.job];
  const quotesAllowed=!module || (profile.job==='mechanic' && !profile.hidden.includes('quotes'));
  if((entry!=='workspace.js' && !profile?.complete) || (entry==='app.js' && !new URLSearchParams(location.search).has('ledger')) || (entry==='quotes.js' && !quotesAllowed) || (entry==='trucking.js' && profile?.job!=='truck') || (entry==='mechanic.js' && profile?.job!=='mechanic')){
    location.replace(profile?.complete?'workspace.html?home=1':'workspace.html');return;
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
  script.onload=()=>{document.body.removeAttribute('data-auth-pending');document.getElementById('auth-status')?.remove();};
  script.onerror=()=>showAuthError(Error('Could not load the workspace. Reload and try again.'));
  document.body.append(script);
}).catch(showAuthError);
function showAuthError(error){
  const notice=document.getElementById('auth-status');
  if(!notice){document.querySelector('main').hidden=true;return;}
  notice.textContent='Could not open workspace. '+error.message+' ';
  const a=document.createElement('a');a.href='account.html';a.textContent='Return to sign in';notice.append(a);const b=document.createElement('a');b.href='offline.html';b.textContent='Open encrypted offline entry';notice.append(document.createElement('br'),b);
}
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
