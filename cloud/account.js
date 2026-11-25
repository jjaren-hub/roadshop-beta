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
    try { await fn(event); } catch (err) { say(err.message); }
  };
  let user, displayVersion=0;
  function openBusiness(id) {
    const value = JSON.stringify({user:user.id,id});
    sessionStorage.setItem(selection,value);
    localStorage.setItem('roadshop-last-'+user.id,value);
    location.assign('./');
  }
  async function display(session) {
    const version=++displayVersion;
    user=null;
    if(session){const {data:verified,error}=await auth.getUser();if(version!==displayVersion)return;if(error){$('guest').hidden=false;$('member').hidden=true;sessionStorage.removeItem(selection);say('Could not verify this session. Sign in again or reconnect.');return;}user=verified.user?.is_anonymous?null:verified.user;}
    $('guest').hidden = !!user; $('member').hidden = !user;
    $('businesses').replaceChildren();
    $('start-setup').hidden=true;$('create').hidden=true;
    if (!user){sessionStorage.removeItem(selection);return;}
    if(recoveryCallback)$('change').closest('details').open=true;
    $('identity').textContent = user.email;
    const owner=user.id;const spaces = check(await api.from('workspaces').select('id,name,profile_name:books->roadshop-profile-v2->profile->>business').eq('owner_id',owner).order('name'));
    if(version!==displayVersion)return;
    if(!recoveryCallback && !switchMode){
      if(spaces.length){
        let last;try{last=JSON.parse(localStorage.getItem('roadshop-last-'+user.id));}catch{}
        const selected=spaces.find(space=>space.id===last?.id && last.user===user.id)||spaces[0];
        openBusiness(selected.id);return;
      }
      $('start-setup').hidden=false;
      $('start-setup').onclick=run(async()=>{
        if(creatingFirst)return;
        $('start-setup').disabled=true;
        const owner=user.id;
        try{
          creatingFirst=(async()=>{
            const existing=check(await api.from('workspaces').select('id').eq('owner_id',owner).order('name'));
            if(existing.length)return existing[0];
            return check(await api.from('workspaces').insert({name:'My business'}).select('id').single());
          })();
          const space=await creatingFirst;
          if(user?.id===owner)openBusiness(space.id);
        }finally{creatingFirst=null;$('start-setup').disabled=false;}
      });
      say('Set up your first business to continue.');
      return;
    }
    $('start-setup').hidden=true;
    $('create').hidden=false;
    for(const space of spaces) {
      const b = document.createElement('button'); b.textContent=space.profile_name||space.name;
      b.onclick=()=>openBusiness(space.id); $('businesses').append(b);
    }
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
