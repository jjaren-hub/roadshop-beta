'use strict';
// Portable local-only format. SHA-256 detects corruption; AES-GCM authenticates encrypted files.
// No network, provider secrets, credentials or account tokens are used.
const EarnKeepBackup=(()=>{
 const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true}),format='earnkeep-local-backup',version=2,maxBytes=250000000,iterations=600000,day=86400000;
 const random=n=>crypto.getRandomValues(new Uint8Array(n)),hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
 const b64=b=>{let s='';const a=new Uint8Array(b);for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s)},un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const digest=async s=>hex(await crypto.subtle.digest('SHA-256',typeof s==='string'?enc.encode(s):s));
 const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&Date.parse(s)<=Date.now()+60000;
 const key=(owner,k)=>'earnkeep-backup:'+owner+':'+k;
 const read=(owner,k)=>{try{return JSON.parse(localStorage.getItem(key(owner,k))||'null')}catch{return null}};
 const write=(owner,k,v)=>localStorage.setItem(key(owner,k),JSON.stringify(v));
 function validPayload(p,owner){
  if(!p||p.version!==version||p.owner!==owner||!stamp(p.createdAt)||!Array.isArray(p.workspaces)||p.workspaces.length>1000)throw Error('Backup belongs to another account or uses an unsupported format.');
  const ids=new Set();for(const w of p.workspaces){if(!w||typeof w.id!=='string'||!w.id||w.id.length>100||ids.has(w.id)||typeof w.name!=='string'||!w.name.trim()||w.name.length>200||w.owner_id!==owner||!Number.isSafeInteger(w.revision)||w.revision<0)throw Error('Invalid business record in backup.');ids.add(w.id);BookStore.checkBooks(w.books)}
  if(p.vault!==null&&p.vault!==undefined){const v=p.vault;if(typeof v!=='string'||v.length>5000000)throw Error('Invalid encrypted pending-entry vault.');const x=JSON.parse(v);if(x.version!==1||typeof x.salt!=='string'||typeof x.iv!=='string'||typeof x.cipher!=='string')throw Error('Invalid encrypted pending-entry vault.');}
  if(p.preferences&&(!['system','dark','light',null].includes(p.preferences.theme)||Object.keys(p.preferences).some(k=>k!=='theme')))throw Error('Unsupported preferences.');
  return p;
 }
 async function snapshot(owner){const workspaces=await LocalBooks.list(owner);const vault=localStorage.getItem('roadshop-offline-v1:'+owner);return validPayload({version,owner,createdAt:new Date().toISOString(),origin:location.origin+location.pathname.replace(/[^/]*$/,''),workspaces,vault,preferences:{theme:localStorage.getItem('roadshop-theme')||null}},owner)}
 async function legacySnapshot(owner){
 const books={};for(const k of ['roadshop-ledger-v1','roadshop-quotes-v1','roadshop-shop-rates-v1','roadshop-profile-v2']){const raw=localStorage.getItem(k);if(raw!==null)books[k]=JSON.parse(raw)}
 if(!Object.keys(books).length)throw Error('No older unscoped local records were found on this origin.');
 BookStore.checkBooks(books);
 const id='legacy-'+(await digest(location.origin+'|'+owner+'|roadshop-unscoped-v1')).slice(0,32);
 return validPayload({version,owner,createdAt:new Date().toISOString(),workspaces:[{id,owner_id:owner,name:books['roadshop-profile-v2']?.profile?.business||'Recovered Road & Shop records',revision:0,books}],vault:null,preferences:{theme:null}},owner);
 }
 async function contentHash(p){return digest(JSON.stringify({workspaces:p.workspaces,vault:p.vault??null,preferences:p.preferences??{theme:null}}))}
 async function derive(pass,salt){if(typeof pass!=='string'||pass.length<12||pass.length>256)throw Error('Use a backup password of 12–256 characters.');const base=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
 async function encode(p,pass=''){validPayload(p,p.owner);const data=JSON.stringify(p),hash=await digest(data);let envelope={format,version,encrypted:false,sha256:hash,payload:data};
  if(pass){const salt=random(16),iv=random(12),k=await derive(pass,salt),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(format+':'+version)},k,enc.encode(JSON.stringify({sha256:hash,payload:data})));envelope={format,version,encrypted:true,kdf:'PBKDF2-SHA256',iterations,salt:b64(salt),iv:b64(iv),cipher:b64(cipher)}}
  const text=JSON.stringify(envelope);if(enc.encode(text).byteLength>maxBytes)throw Error('Backup exceeds 250 MB. Keep existing records and contact support without sending financial data.');return text}
 async function decode(text,owner,pass=''){
  if(typeof text!=='string'||enc.encode(text).byteLength>maxBytes)throw Error('Backup exceeds 250 MB.');let obj;try{obj=JSON.parse(text)}catch{throw Error('Invalid JSON backup.');}
  if(obj.format==='roadshop-workspace-export-v1'){
   if(!Array.isArray(obj.workspaces)||!stamp(obj.exportedAt))throw Error('Invalid legacy workspace export.');
   const workspaces=obj.workspaces.map(w=>{if(w.owner_id&&w.owner_id!==owner)throw Error('Legacy backup belongs to another account.');return {...w,owner_id:owner,revision:Number.isSafeInteger(w.revision)&&w.revision>=0?w.revision:0}});
   return {legacy:true,payload:validPayload({version,owner,createdAt:obj.exportedAt,workspaces,vault:null,preferences:{theme:null}},owner)};
  }
  if(obj.format!==format||obj.version!==version||typeof obj.encrypted!=='boolean')throw Error('Unsupported backup version or format.');
  let body=obj;if(obj.encrypted){try{if(obj.kdf!=='PBKDF2-SHA256'||obj.iterations!==iterations)throw Error();const salt=un64(obj.salt),iv=un64(obj.iv);if(salt.length!==16||iv.length!==12)throw Error();const k=await derive(pass,salt);body=JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(format+':'+version)},k,un64(obj.cipher))))}catch{throw Error('Incorrect password or damaged encrypted backup.');}}
  if(typeof body.payload!=='string'||typeof body.sha256!=='string'||await digest(body.payload)!==body.sha256)throw Error('Backup integrity check failed. No records changed.');
  return {legacy:false,payload:validPayload(JSON.parse(body.payload),owner)};
 }
 async function verify(text,owner,pass=''){const result=await decode(text,owner,pass);if(result.legacy)throw Error('Legacy backup has no integrity checksum. Restore it, then create a new verified backup.');const p=result.payload;const hash=await contentHash(p);const prev=read(owner,'last');if(!prev||Date.parse(p.createdAt)>=Date.parse(prev.date))write(owner,'last',{date:p.createdAt,verifiedAt:new Date().toISOString(),hash});return p}
 function age(owner,now=Date.now()){const last=read(owner,'last');let first=read(owner,'first');if(!stamp(first)){first=new Date(now).toISOString();try{write(owner,'first',first)}catch{/* backup downloads remain available even when localStorage is full */}}const base=stamp(last?.date)?last.date:first;return {last:stamp(last?.date)?last.date:null,days:Math.max(0,Math.floor((now-Date.parse(base))/day))}}
 function filename(p){return 'earnkeep-backup-'+p.createdAt.replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8)+'.json'}
 let dbPromise;function configDB(){if(!dbPromise)dbPromise=new Promise((res,rej)=>{const q=indexedDB.open('earnkeep-backup-settings-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('config');q.onsuccess=()=>res(q.result);q.onerror=()=>{dbPromise=null;rej(q.error)};q.onblocked=()=>{dbPromise=null;rej(Error('Backup settings unavailable'))}});return dbPromise}
 async function config(owner,value){const db=await configDB();return new Promise((res,rej)=>{const t=db.transaction('config',value===undefined?'readonly':'readwrite'),o=t.objectStore('config');let q=value===undefined?o.get(owner):value===null?o.delete(owner):o.put(value,owner);t.oncomplete=()=>res(q.result);t.onabort=()=>rej(t.error);})}
 async function writeExternal(owner,dir,p,pass=''){
  const text=await encode(p,pass),name=filename(p),file=await dir.getFileHandle(name,{create:true}),writer=await file.createWritable();
  try{await writer.write(text);await writer.close()}catch(e){try{await writer.abort()}catch{}throw e}
  const reread=await (await file.getFile()).text();if(await digest(reread)!==await digest(text))throw Error('External file did not match the backup. No success recorded.');
  await verify(reread,owner,pass);return name;
 }
 async function auto(owner){
  if(!navigator.locks||document.hidden)return false;
  return navigator.locks.request('earnkeep-backup:'+owner,{ifAvailable:true},async lock=>{if(!lock)return false;if((await DeviceSession.user())?.id!==owner)return false;const c=await config(owner);if(!c?.directory||c.enabled!==true)return false;const last=read(owner,'last');if(stamp(last?.date)&&Date.now()-Date.parse(last.date)<day)return false;if(await c.directory.queryPermission({mode:'readwrite'})!=='granted')return false;const p=await snapshot(owner);if(!p.workspaces.length&&!p.vault)return false;await writeExternal(owner,c.directory,p);return true;});
 }
 function clearMeta(owner){for(const k of ['last','first','disclosure'])localStorage.removeItem(key(owner,k));}
 async function persistent(){if(!navigator.storage?.persist)return false;return await navigator.storage.persisted?.()||await navigator.storage.persist()}
 function reminder(owner,parent){parent.querySelector('#earnkeep-backup-reminder')?.remove();const a=age(owner);if(a.days<3)return;const box=document.createElement('p');box.id='earnkeep-backup-reminder';box.className=a.days>=7?'card tax-warning':'card';box.setAttribute('role',a.days>=7?'alert':'status');box.textContent=(a.days>=7?'WARNING: ':'Backup reminder: ')+(a.last?'No verified external backup for '+a.days+' days. ':'No verified external backup yet. ');const link=document.createElement('a');link.href='backup.html';link.textContent='Backup & Recovery';box.append(link);parent.prepend(box)}
 let attached;
 function attach(owner,parent){if(attached===owner)return;attached=owner;const tick=async()=>{if(document.hidden)return;try{if((await DeviceSession.user())?.id!==owner)return;reminder(owner,parent);if(await auto(owner))reminder(owner,parent)}catch{try{reminder(owner,parent)}catch{}}};tick();window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);setInterval(tick,3600000);}
 return {snapshot,legacySnapshot,encode,decode,verify,contentHash,age,filename,config,writeExternal,auto,clearMeta,persistent,reminder,attach,read,write,maxBytes};
})();