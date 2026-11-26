(async () => {
  const $ = id => document.getElementById(id);
  const say = msg => { $('notice').textContent = msg; };
  const api = window.cloudClient;
  const selection = 'roadshop-active-workspace';
  if (!api) return say('Cloud accounts are awaiting setup. Sign-in is required; existing browser records are unchanged.');
  const redirect = new URL('account.html',location.href).href;
  const query=new URLSearchParams(location.search);
  const recoveryCallback=query.get('flow')==='recovery';
  const switchMode=query.has('switch');
  let creatingFirst=null;
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
      const current=check(await api.from('workspaces').select('id,revision,books').eq('id',space.id).eq('owner_id',owner).single());
      if(!current||!current.books||typeof current.books!=='object'||Array.isArray(current.books))throw Error('Business unavailable.');
      const books={...current.books};
      if(archive)books[archiveKey]=new Date().toISOString();else delete books[archiveKey];
      if(user?.id!==owner)throw Error('Account changed. Sign in again.');
      const saved=check(await api.from('workspaces').update({books,revision:current.revision+1}).eq('id',space.id).eq('owner_id',owner).eq('revision',current.revision).select('id').maybeSingle());
      if(!saved)throw Error('Business changed on another device. Refresh and retry.');
      if(archive)clearSelection(owner,space.id);
      location.replace('account.html?switch=1&workspace='+ (archive?'removed':'restored'));
    }finally{managing=false;}
  }
  function businessRow(parent,space,archived){
    const row=document.createElement('div');row.className='business-manage-row';
    const name=space.profile_name||space.name;
    const b=document.createElement(archived?'span':'button');b.textContent=name;
    if(!archived){b.type='button';b.className='business-open';b.onclick=()=>openBusiness(space.id);}
    const action=document.createElement('button');action.type='button';action.className=archived?'business-restore':'business-remove';action.textContent=archived?'Restore':'Remove';action.setAttribute('aria-label',(archived?'Restore ':'Remove ')+name);action.onclick=run(()=>changeArchive(space,!archived));
    row.append(b,action);parent.append(row);
  }
  function openBusiness(id) {
    const value = JSON.stringify({user:user.id,id});
    sessionStorage.setItem(selection,value);
    localStorage.setItem('roadshop-last-'+user.id,value);
    location.assign('./');
  }
  async function display(session) {
    const version=++displayVersion;
    user=null;
    $('account-title').textContent='Sign in to Road & Shop';
    if(session){const {data:verified,error}=await auth.getUser();if(version!==displayVersion)return;if(error){$('guest').hidden=false;$('member').hidden=true;sessionStorage.removeItem(selection);say('Could not verify this session. Sign in again or reconnect.');return;}user=verified.user?.is_anonymous?null:verified.user;}
    $('guest').hidden = !!user; $('member').hidden = !user;
    $('businesses').replaceChildren();$('archived-businesses').replaceChildren();$('archive-section').hidden=true;
    $('start-setup').hidden=true;$('create').hidden=true;
    if (!user){sessionStorage.removeItem(selection);if($('notice').textContent==='Checking your sign-in…')say('');return;}
    $('account-title').textContent=recoveryCallback?'Reset your password':'Your account';
    if($('notice').textContent==='Checking your sign-in…')say('');
    if(recoveryCallback)$('change').closest('details').open=true;
    $('identity').textContent = user.email;
    const owner=user.id;const allSpaces = check(await api.from('workspaces').select('id,name,profile_name:books->roadshop-profile-v2->profile->>business,archived:books->>roadshop-workspace-archive-v1').eq('owner_id',owner).order('name'));
    const spaces=allSpaces.filter(s=>!s.archived),archived=allSpaces.filter(s=>!!s.archived);
    if(version!==displayVersion)return;
    if(!recoveryCallback && !switchMode){
      if(spaces.length){
        let last;try{last=JSON.parse(localStorage.getItem('roadshop-last-'+user.id));}catch{}
        const selected=spaces.find(space=>space.id===last?.id && last.user===user.id)||spaces[0];
        openBusiness(selected.id);return;
      }
      if(!archived.length){$('start-setup').hidden=false;
      $('start-setup').onclick=run(async()=>{
        if(creatingFirst)return;
        $('start-setup').disabled=true;
        const owner=user.id;
        try{
          creatingFirst=(async()=>{
            const existing=check(await api.from('workspaces').select('id,archived:books->>roadshop-workspace-archive-v1').eq('owner_id',owner).order('name'));
            const active=existing.find(x=>!x.archived);if(active)return active;
            return check(await api.from('workspaces').insert({name:'My business'}).select('id').single());
          })();
          const space=await creatingFirst;
          if(user?.id===owner)openBusiness(space.id);
        }finally{creatingFirst=null;$('start-setup').disabled=false;}
      });
      say('Set up your first business to continue.');
      return;}
    }
    $('start-setup').hidden=true;
    $('create').hidden=false;
    if(!spaces.length){const p=document.createElement('p');p.textContent='No active businesses. Create a business or restore one below.';$('businesses').append(p);}
    for(const space of spaces)businessRow($('businesses'),space,false);
    $('archive-section').hidden=!archived.length;
    for(const space of archived)businessRow($('archived-businesses'),space,true);
    if(query.get('workspace')==='removed')say('Business removed. Its records are saved under Archived businesses.');
    if(query.get('workspace')==='restored')say('Business restored.');
  }
  $('credentials').onsubmit=run(async e=>{
    const credentials={email:$('email').value.trim(),password:$('password').value};
    if(e.submitter?.value==='signup'){
      const result=check(await auth.signUp({...credentials,options:{emailRedirectTo:redirect}}));
      if(result.session)await display(result.session);
      else say('Check your email for the verification link.'); 
    } else {
      const data=check(await auth.signInWithPassword(credentials)); await display(data.session);
      if(switchMode || recoveryCallback)say('Choose a business workspace.');
    }
    $('password').value='';
  });
  $('google').onclick=run(async()=>check(await auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect}})));
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
    const space=check(await api.from('workspaces').insert({name:$('business').value.trim()}).select('id').single());
    openBusiness(space.id);
  });
  $('logout').onclick=run(async()=>{
    check(await auth.signOut({scope:'local'})); sessionStorage.removeItem(selection); location.replace('account.html');
  });
  auth.onAuthStateChange((event,session)=>{
    if (event==='PASSWORD_RECOVERY'){
      $('change').closest('details').open=true; say('Enter a new password below.');
    }
    if (event==='SIGNED_OUT') display(null);
    if (event==='SIGNED_IN' && session?.user && session.user.id!==user?.id) setTimeout(()=>{if(session.user.id!==user?.id)display(session).catch(e=>say(e.message));},0);
  });
  try { await display(check(await auth.getSession()).session); }
  catch(err){say(err.message);}
})();
