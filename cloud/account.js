(async () => {
  const $ = id => document.getElementById(id);
  const say = msg => { $('notice').textContent = msg; };
  const api = window.cloudClient;
  const selection = 'roadshop-active-workspace';
  $('device').onclick = () => sessionStorage.setItem(selection,'device');
  if (!api) return say('Cloud accounts are awaiting setup. Your device-only ledger is available.');
  const redirect = new URL('account.html',location.href).href;
  const recoveryCallback=new URLSearchParams(location.search).get('flow')==='recovery';
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
    user = session?.user;
    $('guest').hidden = !!user; $('member').hidden = !user;
    $('businesses').replaceChildren();
    if (!user) return;
    if(recoveryCallback)$('change').closest('details').open=true;
    $('identity').textContent = user.email;
    const spaces = check(await api.from('workspaces').select('id,name,profile_name:books->roadshop-profile-v2->profile->>business').order('name'));
    if(version!==displayVersion)return;
    for(const space of spaces) {
      const b = document.createElement('button'); b.textContent=space.profile_name||space.name;
      b.onclick=()=>openBusiness(space.id); $('businesses').append(b);
    }
  }
  $('credentials').onsubmit=run(async e=>{
    const credentials={email:$('email').value.trim(),password:$('password').value};
    if(e.submitter?.value==='signup'){
      check(await auth.signUp({...credentials,options:{emailRedirectTo:redirect}}));
      say('Check your email for the verification link.'); 
    } else {
      const data=check(await auth.signInWithPassword(credentials)); await display(data.session);
      say('Choose a business workspace.');
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
    if (event==='SIGNED_IN' && session.user.id!==user?.id) setTimeout(()=>display(session).catch(e=>say(e.message)),0);
  });
  try { await display(check(await auth.getSession()).session); }
  catch(err){say(err.message);}
})();
