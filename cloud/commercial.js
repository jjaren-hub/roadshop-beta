const RoadCommercial=window.RoadCommercial=(()=>{
let cached=null;
async function call(action,extra={}){if(!window.cloudClient)throw Error('Sign in online first');const {data,error}=await cloudClient.functions.invoke('roadshop-commercial',{body:{action,...extra}});if(error){let message='Commercial service unavailable';try{const j=await error.context?.json();if(j?.error)message=j.error}catch{}throw Error(message)}if(!data||data.error)throw Error(data?.error||'Service unavailable');return data}
async function load(){cached=await call('status');return cached}
function access(s){if(!s?.enforcement)return true;const x=s.subscription;return ['active','trialing'].includes(x?.status)&&Date.parse(x.periodEnd)>Date.now()||s.promo&&Date.parse(s.promo.until_at)>Date.now()}
function activity(feature){if(feature)call('activity',{feature}).catch(()=>{})}
return {call,load,get status(){return cached},access,activity};})();