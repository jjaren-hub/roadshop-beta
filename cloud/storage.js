// A single revision covers ledger entries, private quotes and shop defaults together.
const BookStore = (() => {
  const keys = ['roadshop-ledger-v1','roadshop-quotes-v1','roadshop-shop-rates-v1','roadshop-profile-v2'];
  const local = window.localStorage;
  let workspace, owner, busy=false, invalid=false, checking=false;
  const api=window.cloudClient;
  const status=()=>document.getElementById('workspace-status');
  function checkBooks(books){
    if (!books || typeof books!=='object' || Array.isArray(books)) throw Error('Invalid workspace data.');
    for(const [key,value] of Object.entries(books)){
      if(!keys.includes(key)) throw Error('Workspace needs a newer app version.');
      if(key===keys[0]) validate(value);
      if(key===keys[1]){
        if(!Array.isArray(value)||new Set(value.map(q=>q.id)).size!==value.length) throw Error('Invalid quote collection.');
        value.forEach(q=>Q.validate(q,true));
      }
      if(key===keys[3] && (!value || value.version!==2 || !Array.isArray(value.bills) || !value.profile || !value.goals || !value.operating || !Array.isArray(value.hidden)))throw Error('Invalid business profile.');
      if(key===keys[2]){
        if(!value || typeof value!=='object'||Array.isArray(value))throw Error('Invalid shop defaults.');
        for(const k of ['markup','hourly','mileage']) if(value[k]!=null && (!Number.isFinite(value[k])||value[k]<0)) throw Error('Invalid rate.');
      }
    }
  }
  async function write(books){
    if(invalid || busy) throw Error('Workspace changed or is saving. Refresh and retry.');
    checkBooks(books);
    busy=true;
    try{
      const {data,error}=await api.from('workspaces').update({books,revision:workspace.revision+1})
        .eq('id',workspace.id).eq('owner_id',owner).eq('revision',workspace.revision).select('revision').maybeSingle();
      if(error) throw error;
      if(!data) throw Error('Workspace changed on another device. Refresh before saving.');
      workspace={...workspace,books,revision:data.revision};
      status().textContent=workspace.name+' · Saved';
    } catch(e){status().textContent=e.message;throw e;}
    finally {busy=false;}
  }
  async function migrate(){
    if(keys.slice(0,3).some(k=>Object.hasOwn(workspace.books,k))) throw Error('Select an empty workspace to import this device.');
    const books={};
    for(const key of keys){if(Object.hasOwn(workspace.books,key))continue;const raw=local.getItem(key);if(raw!==null)books[key]=JSON.parse(raw);}
    checkBooks(books);
    if(!Object.keys(books).length) throw Error('There are no local records to import.');
    if(!confirm('Copy '+(books[keys[0]]?.length||0)+' ledger entries, '+(books[keys[1]]?.length||0)+' quotes and available rates into '+workspace.name+'? The original device records will stay here.'))return;
    await write({...workspace.books,...books}); location.reload();
  }
  async function refresh(){
    if(!workspace || busy || checking || document.hidden || invalid || !navigator.onLine)return;
    checking=true;try{
    const before=workspace.revision;
    const {data,error}=await api.from('workspaces').select('revision').eq('id',workspace.id).eq('owner_id',owner).maybeSingle();
    if(error){status().textContent='Sync unavailable. Reconnect to save.';return;}
    if(!data){location.replace('account.html');return;}
    if(workspace.revision!==before || busy || data.revision===before)return;
    const editing=document.querySelector('#wizard, #report-view, #scan-editor, #tax-editor, #mechanic-editor, #truck-editor, #finance-editor:not([hidden]), dialog[open], #compose:not([hidden]), #view:not([hidden]), details[open]');
    if(editing){status().textContent='New changes available. Reload before saving.';return;}
    location.reload();
    }finally{checking=false;}
  }
  async function start(){
    const active='roadshop-active-workspace';
    const redirect=()=>{sessionStorage.removeItem(active);location.replace('account.html');return false;};
    if(!api)return redirect();
    const {data:sessionData,error:sessionError}=await api.auth.getSession();
    if(sessionError || !sessionData?.session)return redirect();
    const {data:auth,error:authError}=await api.auth.getUser();
    if(authError){
      if(authError.status===401 || authError.status===403 || authError.name==='AuthSessionMissingError')return redirect();
      throw authError;
    }
    if(!auth?.user || auth.user.is_anonymous)return redirect();
    owner=auth.user.id;
    function parse(raw){try{return JSON.parse(raw);}catch{return null;}}
    let target=parse(sessionStorage.getItem(active));
    if(!target?.id || target.user!==owner)target=parse(local.getItem('roadshop-last-'+owner));
    if(!target?.id || target.user!==owner)return redirect();
    api.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT' || (session && session.user.id!==owner)){invalid=true;document.body.setAttribute('data-auth-pending','');sessionStorage.removeItem(active);location.replace('account.html');}
    });
    const {data,error}=await api.from('workspaces').select('id,name,revision,books').eq('id',target.id).eq('owner_id',owner).single();
    if(error){if(error.code==='PGRST116'){local.removeItem('roadshop-last-'+owner);return redirect();}throw error;}
    if(!data){local.removeItem('roadshop-last-'+owner);return redirect();}
    if(invalid)return false;
    checkBooks(data.books);workspace=data;sessionStorage.setItem(active,JSON.stringify(target));
    status().textContent=data.name+' · Cloud workspace';
    const importBtn=document.getElementById('migrate');
    if(importBtn){
      const available=keys.some(k=>!Object.hasOwn(data.books,k)&&local.getItem(k)!==null);
      importBtn.hidden=!available || keys.slice(0,3).some(k=>Object.hasOwn(data.books,k));
      importBtn.onclick=()=>migrate().catch(e=>alert(e.message));
    }
    window.addEventListener('focus',()=>refresh().catch(e=>status().textContent=e.message));
    setInterval(()=>refresh().catch(e=>status().textContent=e.message),30000);
    return true;
  }
  return {start,checkBooks,get id(){if(!workspace||invalid)throw Error('Sign in to access a business.');return workspace.id},get name(){return workspace?.name||''},getItem(key){
    if(!workspace || invalid)throw Error('Sign in to access a business.');
    return Object.hasOwn(workspace.books,key)?JSON.stringify(workspace.books[key]):null;
  },async setItem(key,raw){
    if(!keys.includes(key))throw Error('Unknown record category.');
    if(!workspace || invalid)throw Error('Sign in to access a business.');
    await write({...workspace.books,[key]:JSON.parse(raw)});
  },async setItems(values){
    if(!workspace || invalid)throw Error('Sign in to access a business.');
    const books={...workspace.books};
    for(const [key,raw] of Object.entries(values)){if(!keys.includes(key))throw Error('Unknown record category.');books[key]=JSON.parse(raw);}
    await write(books);
  }};
})();
