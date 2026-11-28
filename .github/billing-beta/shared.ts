const env=(k:string)=>Deno.env.get(k)||'';
export const base=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY'),stripeKey=env('ROADSHOP_STRIPE_TEST_KEY'),app='https://jjaren-hub.github.io/roadshop-beta/';
// Dedicated beta project after verified separation; no configurable override can target production.
const betaProject='rwwaejqsgtrmpzwcrfpb';
const isolatedBeta=base==='https://'+betaProject+'.supabase.co'
  && (!env('ROADSHOP_BILLING_BETA_PROJECT_REF')||env('ROADSHOP_BILLING_BETA_PROJECT_REF')===betaProject);
export const testEnabled=()=>isolatedBeta&&env('ROADSHOP_STRIPE_TEST_ENABLED')==='true'&&/^(sk|rk)_test_/.test(stripeKey);
export const billingEligible=(account:any)=>account?.app_metadata?.earnkeep_subscription_beta===true;
export function requireBillingBeta(account:any,mode:unknown){
  if(!billingEligible(account))throw Error('USER_DENIED');
  if(mode!=='test'||!testEnabled())throw Error('TEST_DISABLED');
}
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function body(req:Request,max=450000){const reader=req.body?.getReader();if(!reader)throw Error('INVALID_REQUEST');let size=0;const parts:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('SIZE_LIMIT')}parts.push(value)}}finally{reader.releaseLock()}const raw=new Uint8Array(size);let pos=0;for(const p of parts){raw.set(p,pos);pos+=p.length}return new TextDecoder().decode(raw)}
export async function user(req:Request){const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))throw Error('SIGN_IN');const r=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:authorization},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('SIGN_IN');const u=await r.json();if(!UUID.test(u.id||'')||u.is_anonymous)throw Error('SIGN_IN');return u}
export async function db(path:string,method='GET',data?:unknown){const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(12000)});if(!r.ok){const j=await r.json().catch(()=>({}));const code=['CHECKOUT_DISABLED','CHECKOUT_PENDING','MANAGE_EXISTING','ADMIN_DENIED','CUSTOMER_UNKNOWN','USER_DENIED','FEEDBACK_LIMIT'].find(x=>j.message===x);throw Error(code||'DATABASE_ERROR')}const t=await r.text();return t?JSON.parse(t):null}
export const rpc=(name:string,data:object)=>db('rpc/'+name,'POST',data);
export const first=async(path:string)=>(await db(path))[0]||null;
export async function stripe(path:string,params?:Record<string,string>,idem?:string){if(!testEnabled())throw Error('TEST_DISABLED');const r=await fetch('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:'Bearer '+stripeKey,'Stripe-Version':'2025-04-30.basil',...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idem?{'Idempotency-Key':idem}:{})},...(params?{body:new URLSearchParams(params)}:{}),signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok){if(idem&&r.status===409)throw Error('CHECKOUT_PENDING');throw Error('STRIPE_ERROR')}if(j.livemode===true||j.data?.some((x:any)=>x.livemode===true))throw Error('LIVE_DENIED');return j}
export const config=()=>first('rs_billing_config?singleton=eq.true');
export const sub=(id:string)=>first('rs_subscriptions?user_id=eq.'+id);
export const admin=async(id:string)=>!!await first('rs_admins?select=user_id&user_id=eq.'+id);
const iso=(seconds:unknown)=>typeof seconds==='number'&&Number.isSafeInteger(seconds)&&seconds>0&&seconds<253402300800
  ?new Date(seconds*1000).toISOString():null;

const recurringReasons=new Set(['subscription_create','subscription_cycle']);

async function settledThrough(customer:string,subscription:any,item:any,effectiveTime:number){
  const params=new URLSearchParams({customer,subscription:subscription.id,status:'paid',limit:'100'});
  let cutoff=0;
  for(let page=0;page<5;page++){
    const invoices=await stripe('invoices?'+params);
    if(!Array.isArray(invoices.data))throw Error('STRIPE_ERROR');
    for(const invoice of invoices.data){
      if(invoice.livemode!==false||invoice.status!=='paid'||invoice.customer!==customer||
         invoice.parent?.type!=='subscription_details'||
         invoice.parent.subscription_details?.subscription!==subscription.id||
         !recurringReasons.has(invoice.billing_reason))continue;
      if(invoice.lines?.has_more)throw Error('MANUAL_REVIEW');
      for(const line of invoice.lines?.data||[]){
        const details=line.parent?.subscription_item_details;
        const period=line.period;
        if(line.parent?.type!=='subscription_item_details'||details?.proration!==false||
           details.subscription_item!==item.id||details.subscription!==subscription.id||
           line.pricing?.price_details?.price!==item.price.id||line.quantity!==1||
           !Number.isSafeInteger(line.amount)||line.amount<0||
           !iso(period?.start)||!iso(period?.end)||period.start>effectiveTime||period.end<=period.start)continue;
        // A zero-charge trial invoice is not settlement for a paid period.
        if(invoice.amount_paid===0&&subscription.trial_end&&period.start<subscription.trial_end)continue;
        cutoff=Math.max(cutoff,period.end);
      }
    }
    if(!invoices.has_more)return iso(cutoff);
    const cursor=invoices.data.at(-1)?.id;
    if(typeof cursor!=='string'||cursor===params.get('starting_after'))throw Error('STRIPE_ERROR');
    params.set('starting_after',cursor);
  }
  throw Error('MANUAL_REVIEW');
}

export async function snapshot(owner:string,customer:string,event:any=null){
  // Reserve a strictly ordered revision before reading Stripe. Delivery timestamps can tie.
  const revision=await rpc('rs_beta_snapshot_revision',{});
  if(!Number.isSafeInteger(revision)||revision<=0)throw Error('DATABASE_ERROR');
  const at=Date.now();
  const params=new URLSearchParams({customer,status:'all',limit:'100','expand[]':'data.test_clock'});
  const list=await stripe('subscriptions?'+params);
  if(list.has_more||!Array.isArray(list.data))throw Error('MANUAL_REVIEW');
  const subs=list.data;
  const open=subs.filter((s:any)=>!['canceled','incomplete_expired'].includes(s.status));
  if(open.length>1)throw Error('MULTIPLE_SUBSCRIPTIONS');
  const subscription=open[0]||subs.sort((a:any,b:any)=>b.created-a.created||b.id.localeCompare(a.id))[0];
  const item=subscription?.items?.data?.[0], price=item?.price?.id;
  if(subscription&&(subscription.livemode!==false||subscription.customer!==customer||subscription.items?.has_more||
    subscription.items?.data?.length!==1||item.quantity!==1||typeof price!=='string'))throw Error('MANUAL_REVIEW');
  const plan=price?await first('rs_plans?stripe_price=eq.'+encodeURIComponent(price)):null;
  if(subscription&&!plan)throw Error('UNKNOWN_PRICE');

  const clock=subscription?.test_clock;
  if(clock&&(clock.livemode!==false||clock.status!=='ready'||!iso(clock.frozen_time)))throw Error('MANUAL_REVIEW');
  const end=item?.current_period_end??subscription?.current_period_end;
  const paidThrough=['active','past_due','unpaid'].includes(subscription?.status)
    ?await settledThrough(customer,subscription,item,clock?.frozen_time??Math.floor(at/1000)):null;
  return rpc('rs_beta_apply_snapshot',{
    p_user:owner,p_customer:customer,p_subscription:subscription?.id||null,
    p_plan:plan?.code||null,p_status:subscription?.status||'none',
    p_end:iso(end),p_trial:iso(subscription?.trial_end),p_cancel:!!subscription?.cancel_at_period_end,
    p_paid_through:paidThrough,p_test_clock_at:iso(clock?.frozen_time),p_revision:revision,
    p_event:event?.id||null,p_type:event?.type||null,
    p_invoice:event?.type?.startsWith('invoice.')?event.data?.object?.id||null:null
  });
}
export function hostedUrl(v:unknown,host:string){if(typeof v!=='string')throw Error('STRIPE_ERROR');const u=new URL(v);if(u.origin!=='https://'+host||u.username||u.password)throw Error('STRIPE_ERROR');return u.href}
export function statusError(e:unknown){const code=e instanceof Error?e.message:'';const map:Record<string,[number,string]>={SIGN_IN:[401,'Sign in required'],USER_DENIED:[403,'Access denied'],ADMIN_DENIED:[403,'Administrator access required'],TEST_DISABLED:[503,'Stripe test mode is not configured'],CHECKOUT_DISABLED:[503,'Checkout disabled during beta'],CHECKOUT_PENDING:[409,'Complete or allow the existing checkout to expire first'],MANAGE_EXISTING:[409,'Manage your existing subscription in the billing portal'],MULTIPLE_SUBSCRIPTIONS:[409,'Contact support to review existing subscriptions'],UNKNOWN_PRICE:[409,'Subscription price is not configured'],MANUAL_REVIEW:[503,'Billing status needs review. Refresh billing or contact support'],SIZE_LIMIT:[413,'Request too large'],INVALID_REQUEST:[400,'Invalid request'],FEEDBACK_LIMIT:[429,'Feedback limit reached; try again tomorrow'],LIVE_DENIED:[503,'Live billing is blocked']};return map[code]||[503,'Service unavailable; no payment is confirmed here']}
