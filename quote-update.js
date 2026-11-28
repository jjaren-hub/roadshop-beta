// Keep the current release running until a safe refresh or cold launch.
(()=> {
  const build='20261128-section7-refresh1';
  const buildNode=document.getElementById('app-build'), status=document.getElementById('app-update-status'), refresh=document.getElementById('app-refresh');
  const say=message=>{if(status)status.textContent=message};
  if(buildNode)buildNode.textContent=build;
  if(!('serviceWorker' in navigator)){say('Automatic updates are unavailable in this browser.');if(refresh)refresh.onclick=()=>location.reload();return;}
  let reg, interacted=false, activating=false, reloading=false, checkPromise=null, lastCheck=0;
  const nav=performance.getEntriesByType('navigation')[0];
  let first=false;
  try{first=!sessionStorage.getItem('earnkeep-update-session');sessionStorage.setItem('earnkeep-update-session','1')}catch{}
  const callback=/(?:[?&#])(?:code|auth_code|flow|error|error_code|error_description|token_hash|access_token|refresh_token|type)=/.test(location.search+location.hash);
  const refreshBoundary=!callback&&(first||nav?.type==='reload');
  for(const event of ['pointerdown','keydown','input','change','submit'])document.addEventListener(event,()=>{interacted=true},{capture:true,passive:true});
  function show(){if(activating)return;say(reg?.waiting?'Update ready. Refresh or reopen to apply.':navigator.onLine?'Automatic updates enabled.':'Offline. Using the installed release.')}
  async function check(force=false){
    if(!reg||!navigator.onLine)return;
    if(checkPromise)return checkPromise;
    if(!force&&Date.now()-lastCheck<15000)return;
    lastCheck=Date.now();
    checkPromise=reg.update().then(()=>show()).catch(()=>say('Update check unavailable. Current release is still usable.')).finally(()=>{checkPromise=null});
    return checkPromise;
  }
  async function apply(manual=false){
    if(activating||!reg?.waiting||!navigator.serviceWorker.controller)return false;
    if(!manual&&interacted)return false;
    if(document.querySelector('dialog[open]')){say('Save or close the open entry before refreshing.');return false;}
    activating=true;let accepted=false;if(refresh)refresh.disabled=true;
    try{
      await window.flushWorkspaceDraft?.();await window.flushOfflineDraft?.();
      if(!manual&&interacted)return false;
      const waiting=reg.waiting;if(!waiting)return false;
      const answer=await new Promise(resolve=>{
        const channel=new MessageChannel();
        const timer=setTimeout(()=>{channel.port1.close();resolve('timeout')},4000);
        channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.status)};
        waiting.postMessage({type:'SAFE_ACTIVATE_UPDATE'},[channel.port2]);
      });
      if(answer==='activating'){accepted=true;say('Applying update…');setTimeout(()=>{if(!reloading){activating=false;if(refresh)refresh.disabled=false;say('Update activation delayed. Reopen EarnKeep to retry.')}},15000);return true;}
      say(answer==='busy'?'Close other EarnKeep windows, then refresh again.':'Update not ready. Close and reopen EarnKeep to retry.');
      return false;
    }catch(e){say(e.message||'Could not apply update.');return false;}
    finally{if(!accepted&&!reloading){activating=false;if(refresh)refresh.disabled=false;}}
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(activating&&!reloading){reloading=true;location.reload();}
  });
  if(refresh)refresh.onclick=async()=>{
    if(activating)return;
    if(document.querySelector('dialog[open]')){say('Save or close the open entry before refreshing.');return;}
    try{await window.flushWorkspaceDraft?.();await window.flushOfflineDraft?.();await check(true);
      if(reg?.waiting){await apply(true);return;}
      location.reload();
    }catch(e){say(e.message||'Could not refresh.');}
  };
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async r=>{
    reg=r;
    // A waiting worker is never activated from a foreground check or mid-entry.
    r.addEventListener('updatefound',()=>{const worker=r.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')show()})});
    show();
    if(refreshBoundary&&r.waiting&&!interacted){await apply();return;}
    await check(true);
    if(refreshBoundary&&r.waiting&&!interacted)await apply();
  }).catch(()=>say('Update support unavailable. Current records are unchanged.'));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
  window.addEventListener('pageshow',()=>check());
  window.addEventListener('online',()=>check(true));
  window.addEventListener('focus',()=>check());
})();
(()=>{let promptEvent;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;show()});function show(){if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)return;const main=document.querySelector('main');if(!main||document.getElementById('install-prompt'))return;const box=document.createElement('details');box.id='install-prompt';const summary=document.createElement('summary');summary.textContent='Install EarnKeep';box.append(summary);const p=document.createElement('p');p.textContent='Android / desktop: browser menu → Install app or Add to home screen. iPhone: Safari Share → Add to Home Screen. Internet is required for sign-in and full records.';box.append(p);const b=document.createElement('button');b.textContent='Install app';b.hidden=!promptEvent;b.onclick=async()=>{if(promptEvent){await promptEvent.prompt();promptEvent=null;b.hidden=true}};box.append(b);main.append(box);window.addEventListener('beforeinstallprompt',()=>{b.hidden=false});window.addEventListener('appinstalled',()=>box.remove())}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();})();