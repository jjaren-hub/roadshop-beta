// Offline access is limited to the last successfully verified local account and an existing cached session.
// This is device convenience, not independent encryption or remote revocation while disconnected.
const DeviceSession=(()=>{
 const authKey='roadshop-auth-v1',verifiedKey='earnkeep-last-verified-session',maxAge=7*86400000;
 let current=null;
 function cached(){try{const s=JSON.parse(localStorage.getItem(authKey)||'null'),m=JSON.parse(localStorage.getItem(verifiedKey)||'null');if(s?.user?.id&&s.user.id===m?.id&&!s.user.is_anonymous&&Number.isFinite(m.at)&&m.at<=Date.now()&&Date.now()-m.at<=maxAge)return s.user}catch{}return null}
 async function user(){if(!window.cloudClient)return (current=null);if(navigator.onLine===false)return (current=cached());const {data:s,error:se}=await cloudClient.auth.getSession();if(se)throw se;if(!s?.session)return (current=null);const {data,error}=await cloudClient.auth.getUser();if(error){if(error.status===401||error.status===403||error.name==='AuthSessionMissingError')return (current=null);throw error}const u=data?.user;if(!u||u.is_anonymous)return (current=null);localStorage.setItem(verifiedKey,JSON.stringify({id:u.id,at:Date.now()}));return (current=u);}
 async function signOut(){if(navigator.onLine!==false){const {error}=await cloudClient.auth.signOut({scope:'local'});if(error)throw error}else localStorage.removeItem(authKey);current=null;localStorage.removeItem(verifiedKey);sessionStorage.removeItem('roadshop-active-workspace');}
 return {user,cached,signOut,authKey,get current(){return current}};
})();
// Financial data is browser-only. No network requests are made by this adapter.
const LocalBooks=(()=>{
 const store='workspaces',archive='roadshop-workspace-archive-v1';
 let opening;
 function db(){if(!opening)opening=new Promise((resolve,reject)=>{
  const request=indexedDB.open('earnkeep-local-v1',1);
  request.onupgradeneeded=()=>{const t=request.result.createObjectStore(store,{keyPath:['owner_id','id']});t.createIndex('owner','owner_id');};
  request.onsuccess=()=>{const d=request.result;d.onversionchange=()=>{d.close();opening=null};resolve(d)};
  request.onerror=()=>{opening=null;reject(request.error||Error('Device storage is unavailable.'))};
  request.onblocked=()=>{opening=null;reject(Error('Close other EarnKeep tabs and retry.'))};
 });return opening}
 async function transact(mode,fn){const d=await db();return new Promise((resolve,reject)=>{
  const t=d.transaction(store,mode),o=t.objectStore(store);let result,err;
  const fail=e=>{err=e;try{t.abort()}catch{}};
  t.oncomplete=()=>resolve(result);t.onabort=()=>reject(err||t.error||Error('Device save failed. Check available storage.'));t.onerror=()=>{};
  try{fn(o,v=>{result=v},fail)}catch(e){fail(e)}
 })}
 const ownerCheck=owner=>{if(typeof owner!=='string'||!owner)throw Error('Sign in to access device records.')};
 async function canWrite(owner){
  ownerCheck(owner);
  const user=DeviceSession.current,commercial=window.RoadCommercial;
  if(!commercial?.enrolled(user))return true;
  return user.id===owner&&await commercial.canWrite(user)&&DeviceSession.current?.id===owner;
 }
 async function requireWrite(owner){
  if(await canWrite(owner))return;
  const error=Error(window.RoadCommercial.readOnly);
  error.name='SubscriptionReadOnlyError';
  throw error;
 }
 async function list(owner){ownerCheck(owner);return transact('readonly',(o,done)=>{const q=o.index('owner').getAll(owner);q.onsuccess=()=>done(q.result.sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')||a.id.localeCompare(b.id)))})}
 async function read(owner,id){ownerCheck(owner);return transact('readonly',(o,done)=>{const q=o.get([owner,id]);q.onsuccess=()=>done(q.result||null)})}
 async function create(owner,name){await requireWrite(owner);const w={id:crypto.randomUUID(),owner_id:owner,name,createdAt:new Date().toISOString(),revision:0,books:{}};return transact('readwrite',(o,done)=>{o.add(w);done(w)})}
 async function write(owner,id,revision,books){await requireWrite(owner);return transact('readwrite',(o,done,fail)=>{const q=o.get([owner,id]);q.onsuccess=()=>{const w=q.result;if(!w||w.revision!==revision)return fail(Error('Business changed in another tab. Reopen it before saving.'));const next={...w,books,revision:revision+1};o.put(next);done(next)}})}
 async function restore(owner,workspaces){await requireWrite(owner);if(!Array.isArray(workspaces)||!workspaces.length||workspaces.length>1000)throw Error('Invalid or empty backup.');const seen=new Set();const records=workspaces.map(w=>{if(!w||typeof w.id!=='string'||!w.id||w.id.length>100||seen.has(w.id)||typeof w.name!=='string'||!w.name.trim()||w.name.length>200)throw Error('Invalid business in backup.');seen.add(w.id);BookStore.checkBooks(w.books);return {id:w.id,owner_id:owner,name:w.name,createdAt:typeof w.createdAt==='string'?w.createdAt:new Date().toISOString(),revision:0,books:w.books}});return transact('readwrite',(o,done,fail)=>{const q=o.index('owner').getAll(owner);q.onsuccess=()=>{try{const existing=q.result,known=new Set(existing.map(w=>w.id)),txIds=new Set();for(const w of existing)for(const r of w.books['roadshop-ledger-v1']||[])txIds.add(r.id);let added=0;for(const w of records){if(known.has(w.id))continue;for(const r of w.books['roadshop-ledger-v1']||[]){if(txIds.has(r.id))throw Error('A transaction ID already exists in another business. No businesses were restored.');txIds.add(r.id)}o.add(w);added++}done(added)}catch(e){fail(e)}}})}
 async function erase(owner,expected){await requireWrite(owner);return transact('readwrite',(o,done,fail)=>{const q=o.index('owner').getAll(owner);q.onsuccess=()=>{const rows=q.result,versions=new Map(expected.map(w=>[w.id,w.revision]));if(rows.length!==versions.size||rows.some(w=>versions.get(w.id)!==w.revision))return fail(Error('Records changed since backup. Verify a fresh backup first.'));for(const w of rows)o.delete([owner,w.id]);done(rows.length)}})}
 return {list,read,create,write,restore,erase,archive,canWrite,requireWrite};
})();

// Keep existing book keys and module APIs for compatibility.
const BookStore=(()=>{
 const keys=['roadshop-ledger-v1','roadshop-quotes-v1','roadshop-shop-rates-v1','roadshop-profile-v2'],archiveKey=LocalBooks.archive,local=window.localStorage,api=window.cloudClient;
 let workspace,owner,busy=false,invalid=false,readOnly=false;
 const status=()=>document.getElementById('workspace-status');
  function checkBooks(books){
    if (!books || typeof books!=='object' || Array.isArray(books)) throw Error('Invalid workspace data.');
    for(const [key,value] of Object.entries(books)){
      if(key===archiveKey){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Invalid archive status.');continue;}
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
  if(!workspace||invalid||busy)throw Error('Business changed or is saving. Reopen and retry.');
  if(workspace.books[archiveKey]||books[archiveKey])throw Error('Restore this business before saving.');
  checkBooks(books);busy=true;
  try{const next=await LocalBooks.write(owner,workspace.id,workspace.revision,books);if(invalid)throw Error('Session changed. Reopen your business.');workspace=next;status().textContent=workspace.name+' · Saved on this device';}
  catch(e){status().textContent=e.message||'Device save failed';throw e}finally{busy=false}
 }

 async function refresh(){if(!workspace||busy||invalid||document.hidden)return;const before=workspace.revision;const w=await LocalBooks.read(owner,workspace.id);if(busy||invalid||workspace.revision!==before)return;if(!w||w.books[archiveKey]){invalid=true;document.body.setAttribute('data-auth-pending','');sessionStorage.removeItem('roadshop-active-workspace');location.replace('account.html?switch=1');return;}if(w.revision!==before)status().textContent='Business changed in another tab. Reload before saving.';}
 async function start(){
  const active='roadshop-active-workspace',redirect=()=>{sessionStorage.removeItem(active);location.replace('account.html');return false};
  if(!api)return redirect();const user=await DeviceSession.user();if(!user)return redirect();owner=user.id;try{const accepted=JSON.parse(local.getItem('earnkeep-backup:'+owner+':disclosure')||'null');if(accepted?.version!==1)return redirect()}catch{return redirect()}
  const parse=raw=>{try{return JSON.parse(raw)}catch{return null}};
  let target=parse(sessionStorage.getItem(active));if(!target?.id||target.user!==owner)target=parse(local.getItem('roadshop-last-'+owner));
  if(!target?.id||target.user!==owner)return redirect();
  api.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||session&&session.user.id!==owner){invalid=true;document.body.setAttribute('data-auth-pending','');sessionStorage.removeItem(active);location.replace('account.html')}});
  window.addEventListener('storage',e=>{if(e.key===DeviceSession.authKey||e.key===null){if(!DeviceSession.cached()&&navigator.onLine===false){invalid=true;document.body.setAttribute('data-auth-pending','');location.replace('account.html')}}});
  const data=await LocalBooks.read(owner,target.id);
  if(!data||data.books[archiveKey]){local.removeItem('roadshop-last-'+owner);sessionStorage.removeItem(active);location.replace('account.html?switch=1');return false}
  readOnly=!await LocalBooks.canWrite(owner);
  if(invalid)return false;checkBooks(data.books);workspace=data;sessionStorage.setItem(active,JSON.stringify(target));status().textContent=data.name+' · On this device';
  // Unscoped legacy local keys are not automatically attached to a signed-in account.
  const importBtn=document.getElementById('migrate');if(importBtn)importBtn.hidden=true;
  window.addEventListener('focus',()=>refresh().catch(e=>status().textContent=e.message));setInterval(()=>refresh().catch(e=>status().textContent=e.message),30000);return true;
 }
 return {start,checkBooks,get readOnly(){return readOnly},get id(){if(!workspace||invalid)throw Error('Sign in to access a business.');return workspace.id},get ownerId(){if(!workspace||invalid)throw Error('Sign in to access a business.');return owner},get name(){return workspace?.name||''},getItem(key){if(!workspace||invalid)throw Error('Sign in to access a business.');return Object.hasOwn(workspace.books,key)?JSON.stringify(workspace.books[key]):null},async setItem(key,raw){return this.setItems({[key]:raw})},async setItems(values){if(!workspace||invalid)throw Error('Sign in to access a business.');const books={...workspace.books};for(const [key,raw] of Object.entries(values)){if(!keys.includes(key))throw Error('Unknown record category.');books[key]=JSON.parse(raw)}await write(books)}};
})();
