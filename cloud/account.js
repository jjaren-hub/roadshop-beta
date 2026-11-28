(async () => {
  const $ = id => document.getElementById(id);
  const say = msg => { $('notice').textContent = msg; };
  const api = window.cloudClient;
  const selection = 'roadshop-active-workspace';
  if (!api) return say('Cloud accounts are awaiting setup. Sign-in is required; existing browser records are unchanged.');
  // Cloudflare Pages serves the production account route without .html; beta keeps its GitHub Pages route.
  const redirect = new URL(location.origin==='https://earnkeep.app'?'account':'account.html',location.href).href;
  const query=new URLSearchParams(location.search);
  const recoveryCallback=query.get('flow')==='recovery';
  const subscriptionKey='earnkeep-subscribe-intent';
  try{if(query.has('continue')||recoveryCallback||query.has('switch'))sessionStorage.removeItem(subscriptionKey);else if(query.has('subscribe')||query.has('signup'))sessionStorage.setItem(subscriptionKey,'1')}catch{}
  function subscriptionIntent(){try{return sessionStorage.getItem(subscriptionKey)==='1'}catch{return query.has('subscribe')}}
  const switchMode=query.has('switch');
  let creatingFirst=null, openingSubscription=false;
  const auth = api.auth;
  const check = ({data,error}) => { if(error) throw error; return data; };
  const run = fn => async event => {
    event.preventDefault();
    const control = event.submitter || event.currentTarget;
    if (control.disabled) return;
    control.disabled = true;
    try { await fn(event); } catch (err) { say(err.message); }
    finally { control.disabled = false; }
  };
  let user, displayVersion=0, managing=false;
  const archiveKey='roadshop-workspace-archive-v1';
  function clearSelection(owner,id){
    for(const [storage,key] of [[sessionStorage,selection],[localStorage,'roadshop-last-'+owner]]){
      try{const current=JSON.parse(storage.getItem(key));if(current?.user===owner&&current.id===id)storage.removeItem(key);}catch{}
    }
  }
  async function changeArchive(space,archive){
    if(managing||!user)return;
    const owner=user.id,name=space.profile_name||space.name;
    if(!confirm(archive?'Remove "'+name+'" from your active businesses? Its records will be kept and you can restore it later. Sync any pending offline entries first.':'Restore "'+name+'" to your active businesses?'))return;
    managing=true;
    try{
      const verified=check(await auth.getUser());
      if(verified.user?.id!==owner||user?.id!==owner)throw Error('Account changed. Sign in again.');
      const current=await LocalBooks.read(owner,space.id);
      if(!current||!current.books||typeof current.books!=='object'||Array.isArray(current.books))throw Error('Business unavailable.');
      const books={...current.books};
      if(archive)books[archiveKey]=new Date().toISOString();else delete books[archiveKey];
      if(user?.id!==owner)throw Error('Account changed. Sign in again.');
      const saved=await LocalBooks.write(owner,space.id,current.revision,books);
      if(!saved)throw Error('Business changed on another device. Refresh and retry.');
      if(archive)clearSelection(owner,space.id);
      location.replace('account.html?switch=1&workspace='+ (archive?'removed':'restored'));
    }finally{managing=false;}
  }
  function businessRow(parent,space,archived,writable){
    const row=document.createElement('div');row.className='business-manage-row';
    const name=space.profile_name||space.name;
    const b=document.createElement(archived?'span':'button');b.textContent=name;
    if(!archived){b.type='button';b.className='business-open';b.onclick=()=>openBusiness(space.id);}
    row.append(b);parent.append(row);
    if(writable){const action=document.createElement('button');action.type='button';action.className=archived?'business-restore':'business-remove';action.textContent=archived?'Restore':'Remove';action.setAttribute('aria-label',(archived?'Restore ':'Remove ')+name);action.onclick=run(()=>changeArchive(space,!archived));row.append(action);}
  }
  function openBusiness(id) {
    if(managing||!user)return;
    const value = JSON.stringify({user:user.id,id});
    sessionStorage.setItem(selection,value);
    localStorage.setItem('roadshop-last-'+user.id,value);
    location.assign('ledger.html');
  }
  async function display(session) {
    if(openingSubscription)return;
    const version=++displayVersion;
    user=null;$('member').hidden=true;$('guest').hidden=true;$('identity').textContent='';$('businesses').replaceChildren();$('archived-businesses').replaceChildren();
    $('account-title').textContent=query.has('signup')?'Create your EarnKeep account':'Sign in to EarnKeep';
    if(session||navigator.onLine===false){try{user=await DeviceSession.user()}catch{if(version!==displayVersion)return;$('guest').hidden=false;say('Could not verify this session. Sign in again or reconnect.');return}if(version!==displayVersion)return;}
    $('guest').hidden = !!user; $('member').hidden = !user;
    $('businesses').replaceChildren();$('archived-businesses').replaceChildren();$('archive-section').hidden=true;
    $('start-setup').hidden=true;$('create').hidden=true;$('local-disclosure').hidden=true;
    if (!user){sessionStorage.removeItem(selection);if($('notice').textContent==='Checking your sign-in…')say('');return;}
    if(!recoveryCallback&&!switchMode&&navigator.onLine!==false&&subscriptionIntent()){openingSubscription=true;try{sessionStorage.removeItem(subscriptionKey)}catch{}location.replace('subscribe.html');return;}
    $('account-title').textContent=recoveryCallback?'Reset your password':'Your account';
    if($('notice').textContent==='Checking your sign-in…')say('');
    if(recoveryCallback)$('change').closest('details').open=true;
    $('identity').textContent = user.email;
    if(EarnKeepBackup.read(user.id,'disclosure')?.version!==1){const box=$('local-disclosure'),accept=$('local-disclosure-accept');box.hidden=false;const check=$('local-disclosure-check');check.checked=false;accept.disabled=true;check.onchange=()=>{accept.disabled=!check.checked};accept.onclick=run(async()=>{if(!$('local-disclosure-check').checked)return;EarnKeepBackup.write(user.id,'disclosure',{version:1,acceptedAt:new Date().toISOString()});await EarnKeepBackup.persistent().catch(()=>false);await display(session)});return;}
    EarnKeepBackup.attach(user.id,$('member'));
    const owner=user.id;const allSpaces=(await LocalBooks.list(owner)).map(w=>({...w,profile_name:w.books['roadshop-profile-v2']?.profile?.business,archived:w.books[archiveKey]}));
    const spaces=allSpaces.filter(s=>!s.archived),archived=allSpaces.filter(s=>!!s.archived);
    const writable=await LocalBooks.canWrite(owner);
    if(version!==displayVersion)return;
    if(!recoveryCallback && !switchMode){
      if(spaces.length){
        let last;try{last=JSON.parse(localStorage.getItem('roadshop-last-'+user.id));}catch{}
        const selected=spaces.find(space=>space.id===last?.id && last.user===user.id)||spaces[0];
        openBusiness(selected.id);return;
      }
      if(!archived.length&&writable){$('start-setup').hidden=false;
      $('start-setup').onclick=run(async()=>{
        if(creatingFirst)return;
        $('start-setup').disabled=true;
        const owner=user.id;
        try{
          creatingFirst=(async()=>{
            const existing=await LocalBooks.list(owner);
            const active=existing.find(x=>!x.books[archiveKey]);if(active)return active;
            return LocalBooks.create(owner,'My business');
          })();
          const space=await creatingFirst;
          if(user?.id===owner)openBusiness(space.id);
        }finally{creatingFirst=null;$('start-setup').disabled=false;}
      });
      say('Set up your first business to continue.');
      return;}
    }
    $('start-setup').hidden=true;
    $('create').hidden=!writable;
    if(!spaces.length){const p=document.createElement('p');p.textContent=writable?'No active businesses. Create a business or restore one below.':'No active businesses are available on this device.';$('businesses').append(p);}
    if(!writable)say(RoadCommercial.readOnly);
    for(const space of spaces)businessRow($('businesses'),space,false,writable);
    $('archive-section').hidden=!archived.length;
    for(const space of archived)businessRow($('archived-businesses'),space,true,writable);
    if(query.get('workspace')==='removed')say('Business removed. Its records are saved under Archived businesses.');
    if(query.get('workspace')==='restored')say('Business restored.');
  }
  $('credentials').onsubmit=run(async e=>{
    const credentials={email:$('email').value.trim(),password:$('password').value};
    if(e.submitter?.value==='signup'){
      try{sessionStorage.setItem(subscriptionKey,'1')}catch{}
      const result=check(await auth.signUp({...credentials,options:{emailRedirectTo:redirect}}));
      if(result.session)await display(result.session);
      else say('Check your email for the verification link.'); 
    } else {
      if(!query.has('subscribe')&&!query.has('signup'))try{sessionStorage.removeItem(subscriptionKey)}catch{}
      const data=check(await auth.signInWithPassword(credentials)); await display(data.session);
      if(switchMode || recoveryCallback)say('Choose a business workspace.');
    }
    $('password').value='';
  });
  $('google').onclick=run(async()=>{
    try{
      if(query.has('subscribe')||query.has('signup'))sessionStorage.setItem(subscriptionKey,'1');
      else sessionStorage.removeItem(subscriptionKey);
    }catch{}
    check(await auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect}}));
  });
  for(const id of ['resend','reset']) $(id).onclick=run(async()=>{
    if(!$('email').reportValidity())return;
    const email=$('email').value.trim();
    check(id==='reset' ? await auth.resetPasswordForEmail(email,{redirectTo:redirect+'?flow=recovery'}) :
      await auth.resend({type:'signup',email,options:{emailRedirectTo:redirect}}));
    say('Check your email for the requested link.');
  });
  $('change').onsubmit=run(async()=>{
    check(await auth.updateUser({password:$('newPassword').value})); $('newPassword').value='';say('Password updated.');
  });
  $('create').onsubmit=run(async()=>{
    if(managing||!user)return;const owner=user.id;const name=$('business').value.trim();if(!name)throw Error('Enter a business name.');
    const verified=check(await auth.getUser());if(verified.user?.id!==owner||user?.id!==owner)throw Error('Account changed. Sign in again.');
    const space=await LocalBooks.create(owner,name);
    if(user?.id===owner)openBusiness(space.id);
  });
  $('logout').onclick=run(async()=>{
    await DeviceSession.signOut(); sessionStorage.removeItem(selection); location.replace('account.html');
  });
  auth.onAuthStateChange((event,session)=>{
    if (event==='PASSWORD_RECOVERY'){
      try{sessionStorage.removeItem(subscriptionKey)}catch{}
      $('change').closest('details').open=true; say('Enter a new password below.');
    }
    if (event==='SIGNED_OUT') display(null);
    if (event==='SIGNED_IN' && session?.user && session.user.id!==user?.id) setTimeout(()=>{if(session.user.id!==user?.id)display(session).catch(e=>say(e.message));},0);
  });
  try { await display(navigator.onLine===false?null:check(await auth.getSession()).session); }
  catch(err){say(err.message);}
})();
