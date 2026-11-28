import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [bin, pgModule] = process.argv.slice(2);
assert(bin && pgModule, 'Pass the PostgreSQL bin directory and pg module, or --wasm and the PGlite module');
const wasm = bin === '--wasm';
const cluster = await mkdtemp(join(tmpdir(), 'earnkeep-billing-pg-'));
const data = join(cluster, 'data');
const pg = (command, args) => execFileSync(join(bin, command), args, { stdio: 'pipe' });
const owner = '10000000-0000-4000-8000-000000000001';
const ordinary = '10000000-0000-4000-8000-000000000002';
const customer = 'cus_Fixture';
const app = 'https://jjaren-hub.github.io/roadshop-beta/';
const project = 'rwwaejqsgtrmpzwcrfpb'; // all HTTP is intercepted; no real service requests
const base = 'https://' + project + '.supabase.co';
const signingSecret = 'whsec_fixture_only';
const auth = {
  owner: { id: owner, app_metadata: { earnkeep_subscription_beta: true }, created_at: new Date().toISOString() },
  ordinary: { id: ordinary, app_metadata: {}, user_metadata: { earnkeep_subscription_beta: true } }
};
let pool, running = false;
let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const rejects = async (action, error) => { await assert.rejects(action, error); checks++; };
const iso = t => new Date(t * 1000).toISOString();
const time = Math.floor(Date.now() / 1000);
const periodEnd = time + 20 * 86400;
let subscription = null, invoices = [], olderInvoices = [];
let stripeCalls = [], dbCalls = [];
const checkoutSessions = new Map();
const customerKeys = new Set();
const dateFields = ['period_end', 'trial_end', 'paid_through', 'test_clock_at'];
const actions = new Set(['rs_beta_snapshot_revision', 'rs_beta_checkout_reserve', 'rs_beta_apply_snapshot']);
let beforeProviderRead;

try {
  let exec;
  if (wasm) {
    const { PGlite } = await import(pathToFileURL(pgModule));
    const engine = new PGlite();
    pool = { query: engine.query.bind(engine), end: () => engine.close(), transaction: fn => engine.transaction(fn) };
    exec = engine.exec.bind(engine);
  } else {
    const { default: { Pool } } = await import(pathToFileURL(pgModule));
    pg('initdb', ['-D', data, '-U', 'fixture_admin', '-A', 'trust', '--no-locale']);
    const log = join(cluster, 'postgres.log');
    try {
      pg('pg_ctl', ['-D', data, '-l', log, '-o', `-F -h '' -k ${cluster}`, '-w', 'start']);
    } catch (error) {
      console.error(await readFile(log, 'utf8').catch(() => ''));
      throw error;
    }
    running = true;
    const engine = new Pool({ host: cluster, database: 'postgres', user: 'fixture_admin' });
    pool = {
      query: engine.query.bind(engine), end: () => engine.end(),
      async transaction(fn) {
        const connection = await engine.connect();
        try {
          await connection.query('begin');
          const result = await fn(connection);
          await connection.query('commit');
          return result;
        } catch (error) {
          await connection.query('rollback');
          throw error;
        } finally {
          connection.release();
        }
      }
    };
    exec = pool.query;
  }
  await exec(await readFile(new URL('./fixture.sql', import.meta.url), 'utf8'));
  await exec(await readFile(new URL('./01-billing.sql', import.meta.url), 'utf8'));
  await pool.query('insert into auth.users (id, raw_app_meta_data) values ($1, $3), ($2, $4)',
    [owner, ordinary, auth.owner.app_metadata, auth.ordinary.app_metadata]);

  const rpc = async (name, args) => {
    assert(actions.has(name));
    return pool.transaction(async client => {
      await client.query('set local role service_role');
      const parameters = Object.keys(args).map((key, i) => {
        assert.match(key, /^p_[a-z_]+$/);
        return key + ' => $' + (i + 1);
      });
      const { rows } = await client.query('select public.' + name + '(' + parameters.join(',') + ') as value', Object.values(args));
      return name === 'rs_beta_snapshot_revision' ? Number(rows[0].value) : rows[0].value;
    });
  };
  const { rows: permissions } = await pool.query(`
    select role_name, p.proname,
      has_function_privilege(role_name, p.oid, 'execute') as execute
    from (values ('anon'),('authenticated'),('service_role')) r(role_name)
    cross join pg_proc p where p.proname in
      ('rs_beta_snapshot_revision','rs_beta_checkout_reserve','rs_beta_apply_snapshot')
  `);
  equal(permissions.length, 9, 'all three RPC grants checked against all three client roles');
  for (const row of permissions) equal(row.execute, row.role_name === 'service_role', row.proname + ' privilege');
  await rejects(() => rpc('rs_beta_checkout_reserve', { p_user: ordinary, p_plan: 'basic' }), /USER_DENIED/);

  const handlers = [];
  const env = {
    SUPABASE_URL: base, SUPABASE_ANON_KEY: 'fake-public', SUPABASE_SERVICE_ROLE_KEY: 'fake-private',
    ROADSHOP_BILLING_BETA_PROJECT_REF: project, ROADSHOP_STRIPE_TEST_ENABLED: 'true',
    ROADSHOP_STRIPE_TEST_KEY: 'rk_test_fixture_only', ROADSHOP_STRIPE_TEST_WEBHOOK_SECRET: signingSecret
  };
  globalThis.Deno = { env: { get: name => env[name] }, serve: fn => handlers.push(fn) };
  globalThis.fetch = async (target, options = {}) => {
    const url = new URL(target);
    if (url.origin === base) {
      if (url.pathname === '/auth/v1/user') {
        const account = auth[options.headers.Authorization.slice('Bearer '.length)];
        return Response.json(account ?? {}, { status: account ? 200 : 401 });
      }
      assert(url.pathname.startsWith('/rest/v1/'));
      const path = url.pathname.slice('/rest/v1/'.length);
      dbCalls.push(path);
      if (path.startsWith('rpc/')) {
        try { return Response.json(await rpc(path.slice(4), JSON.parse(options.body))); }
        catch (error) { return Response.json({ message: error.message }, { status: 400 }); }
      }
      if (path === 'rs_subscriptions') {
        const id = url.searchParams.get('user_id')?.slice(3);
        const idCustomer = url.searchParams.get('customer_id')?.slice(3);
        if (options.method === 'PATCH') {
          const { rows } = await pool.query(
            'update public.rs_subscriptions set customer_id=$1 where user_id=$2 and customer_id is null returning user_id',
            [JSON.parse(options.body).customer_id, id]);
          return Response.json(rows);
        }
        const { rows } = await pool.query(
          'select * from public.rs_subscriptions where user_id=$1 or customer_id=$2', [id ?? null, idCustomer ?? null]);
        return Response.json(rows.map(row => ({
          ...row, ...Object.fromEntries(dateFields.map(key => [key, row[key]?.toISOString() ?? null]))
        })));
      }
      if (path === 'rs_events') {
        const { rows } = await pool.query('select event_id from public.rs_events where event_id=$1',
          [url.searchParams.get('event_id').slice(3)]);
        return Response.json(rows);
      }
      if (path === 'rs_billing_config') return Response.json([{
        ...(await pool.query('select * from public.rs_billing_config')).rows[0],
        enforce_subscription: false, support_email: 'fixture@example.invalid'
      }]);
      if (path === 'rs_plans') return Response.json((await pool.query('select * from public.rs_plans')).rows);
      assert(['rs_promotional_access', 'rs_admins'].includes(path));
      return Response.json([]);
    }

    assert.equal(url.origin, 'https://api.stripe.com', 'test does not call real services');
    stripeCalls.push(url.pathname);
    const key = options.headers['Idempotency-Key'];
    if (url.pathname === '/v1/prices/price_fixture') {
      return Response.json({ livemode: false, active: true, currency: 'usd', unit_amount: 499, recurring: { interval: 'month', interval_count: 1 } });
    }
    if (url.pathname === '/v1/customers') {
      customerKeys.add(key);
      return Response.json({ id: customer, livemode: false });
    }
    if (url.pathname === '/v1/checkout/sessions') {
      const body = options.body.toString();
      if (checkoutSessions.has(key)) assert.equal(checkoutSessions.get(key), body);
      checkoutSessions.set(key, body);
      return Response.json({ customer, status: 'open', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture', livemode: false });
    }
    if (url.pathname === '/v1/subscriptions') {
      const view = structuredClone(subscription);
      if (beforeProviderRead) await beforeProviderRead(view);
      return Response.json({ data: view ? [view] : [], has_more: false });
    }
    if (url.pathname === '/v1/invoices') {
      if (url.searchParams.get('status') !== 'paid') return Response.json({ data: [], has_more: false });
      assert.equal(url.searchParams.get('subscription'), subscription.id);
      const page = url.searchParams.has('starting_after');
      return Response.json({ data: page ? olderInvoices : invoices, has_more: !page && olderInvoices.length > 0 });
    }
    throw Error('Unexpected provider fixture route ' + url.pathname);
  };

  // Dedicated project allowlist cannot be overridden to point at production.
  env.ROADSHOP_BILLING_BETA_PROJECT_REF = 'rkxfwkwxdxudzcbufcox';
  env.SUPABASE_URL = 'https://rkxfwkwxdxudzcbufcox.supabase.co';
  const disabled = await import('./shared.ts?project-guard');
  equal(disabled.testEnabled(), false, 'production-project hard denial');
  env.SUPABASE_URL = base;
  equal((await import('./shared.ts?mismatched-project-guard')).testEnabled(), false, 'mismatched configured project denied');
  env.ROADSHOP_BILLING_BETA_PROJECT_REF = project;
  env.SUPABASE_URL = base;
  await import('./roadshop-commercial/index.ts');
  await import('./roadshop-stripe-webhook/index.ts');
  const [commercial, webhook] = handlers;
  const call = async (account, action, extra = {}) => {
    const result = await commercial(new Request(base + '/functions/v1/roadshop-commercial', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + account, Origin: new URL(app).origin },
      body: JSON.stringify({ action, ...extra })
    }));
    return [result.status, await result.json()];
  };
  const deliver = async (id, type) => {
    const raw = JSON.stringify({ id, type, livemode: false, data: { object: { id: 'in_fixture', customer } } });
    const at = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', signingSecret).update(at + '.' + raw).digest('hex');
    return webhook(new Request(base + '/functions/v1/roadshop-stripe-webhook', {
      method: 'POST', headers: { 'Stripe-Signature': 't=' + at + ',v1=' + signature }, body: raw
    }));
  };
  const status = async () => (await call('owner', 'status'))[1].subscription;
  equal((await call('ordinary', 'status'))[1].checkoutEnabled, false, 'ordinary account does not advertise checkout');
  for (const action of ['checkout', 'refresh', 'history', 'portal']) {
    equal((await call('ordinary', action, { mode: 'test', plan: 'basic' }))[0], 403, action + ' requires beta eligibility');
  }
  equal((await call('invalid', 'checkout', { mode: 'test', plan: 'basic' }))[0], 401, 'valid account required');
  equal((await call('owner', 'checkout', { mode: 'live', plan: 'basic' }))[0], 503, 'billing test mode required');
  equal((await call('ordinary','adminOverview'))[0],403,'non-admin privileged API denied');
  equal((await call('invalid','status'))[0],401,'unauthenticated status denied');
  equal((await commercial(new Request(base,{method:'OPTIONS',headers:{Origin:'https://earnkeep.app'}}))).status,403,'production origin denied by beta');
  equal((await commercial(new Request(base,{method:'OPTIONS',headers:{Origin:new URL(app).origin}}))).status,204,'beta CORS preflight allowed');
  equal((await webhook(new Request(base,{method:'POST',body:'{}'}))).status,400,'unsigned webhook denied');
  equal(stripeCalls, [], 'ineligible requests never contact Stripe');

  const checkouts = await Promise.all([1, 2].map(() => call('owner', 'checkout', { mode: 'test', plan: 'basic' })));
  equal(checkouts.map(result => result[0]), [200, 200], 'parallel application checkout responses');
  equal(checkouts[0][1].url, checkouts[1][1].url, 'parallel requests see the same checkout');
  equal(checkoutSessions.size, 1, 'parallel requests share an actual DB reservation and Stripe fixture idempotency key');
  equal(customerKeys.size, 1, 'parallel checkout customer creation is idempotent');
  equal(new URLSearchParams([...checkoutSessions.values()][0]).get('subscription_data[trial_period_days]'), '7', 'eligible account gets one seven-day trial');
  const checkoutParams=new URLSearchParams([...checkoutSessions.values()][0]);
  equal(checkoutParams.get('automatic_tax[enabled]'),'true','automatic tax requested');
  equal(checkoutParams.get('customer_update[address]'),'auto','billing address updated for tax');
  equal(checkoutParams.get('billing_address_collection'),'required','checkout collects tax location');

  const line = (start, end, extra = {}) => ({
    amount: 499, quantity: 1,
    period: { start, end },
    parent: { type: 'subscription_item_details', subscription_item_details: {
      subscription: 'sub_fixture', subscription_item: 'si_fixture', proration: false
    } },
    pricing: { price_details: { price: 'price_fixture' } },
    ...extra
  });
  const invoice = (lines, extra = {}) => ({
    id: 'in_fixture', customer, status: 'paid', amount_paid: 499, billing_reason: 'subscription_cycle', livemode: false,
    parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_fixture' } },
    lines: { data: lines, has_more: false },
    ...extra
  });
  subscription = {
    id: 'sub_fixture', customer, status: 'active', created: time - 86400,
    items: { data: [{ id: 'si_fixture', price: { id: 'price_fixture' }, quantity: 1, current_period_end: periodEnd }] },
    trial_end: time - 100, livemode: false
  };
  invoices = [
    invoice([line(time - 2, periodEnd + 10)], { status: 'open' }),
    invoice([line(time - 2, periodEnd + 20, {
      parent: { type: 'subscription_item_details', subscription_item_details: {
        subscription: 'sub_fixture', subscription_item: 'si_fixture', proration: true
      } }
    })]),
    invoice([line(time - 200, periodEnd + 30)], { billing_reason: 'subscription_create', amount_paid: 0 }),
    invoice([line(time + 50, periodEnd + 40)]),
    invoice([line(time - 2, periodEnd + 50)], { customer: 'cus_Other' }),
    invoice([line(time - 2, periodEnd + 60, { pricing: { price_details: { price: 'price_other' } } })]),
    invoice([line(time - 2, periodEnd + 70, { amount: -499 })]),
  ];
  equal((await deliver('evt_Paid1', 'invoice.paid')).status, 200, 'webhook persists settlement state');
  equal((await status()).paidThrough, null, 'only settled non-prorated positive or zero subscription items extend access');
  olderInvoices = [invoice([line(time - 3, time + 300)], { id: 'in_older' })];
  subscription.status = 'past_due';
  equal((await deliver('evt_Failed1', 'invoice.payment_failed')).status, 200, 'failed invoice can preserve previously settled access');
  equal((await status()).paidThrough, iso(time + 300), 'paid-through is read from paginated invoice lines');
  equal((await status()).periodEnd, iso(periodEnd), 'nominal billing date remains separate');
  equal((await call('owner', 'status'))[1].trialEligible, false, 'trial-use survives transition to paid status');
  const stripeReads = stripeCalls.length;
  equal((await deliver('evt_Failed1', 'invoice.payment_failed')).status, 200, 'duplicate delivery acknowledged');
  equal(stripeCalls.length, stripeReads, 'duplicate delivery skips provider lookup');

  // Hold an earlier observation while a newer one commits in a different database transaction.
  let observed, unblock;
  const entered = new Promise(resolve => { observed = resolve; });
  const wait = new Promise(resolve => { unblock = resolve; });
  beforeProviderRead = async () => { beforeProviderRead = null; observed(); await wait; };
  const delayed = deliver('evt_Delayed', 'customer.subscription.updated');
  await entered;
  subscription.status = 'canceled';
  equal((await deliver('evt_Canceled', 'customer.subscription.deleted')).status, 200, 'newer observation commits');
  unblock();
  equal((await delayed).status, 200, 'delayed webhook is acknowledged');
  equal((await status()).status, 'canceled', 'earlier observation cannot regrant canceled access');
  equal((await status()).paidThrough, null, 'terminal state retains no paid-through grant');
  const previousCheckouts = checkoutSessions.size;
  equal((await call('owner', 'checkout', { mode: 'test', plan: 'basic' }))[0], 200, 'terminal canceled subscription may resubscribe');
  equal(checkoutSessions.size, previousCheckouts + 1, 'resubscription gets a new reservation');
  assert([...checkoutSessions.values()].some(body => !new URLSearchParams(body).has('subscription_data[trial_period_days]')));
  checks++;

  subscription.status = 'past_due';
  subscription.test_clock = { livemode: false, status: 'ready', frozen_time: time + 301 };
  invoices = [invoice([line(time - 3, time + 300)])];
  olderInvoices = [];
  equal((await call('owner', 'refresh', { mode: 'test' }))[0], 200, 'refresh reads the verified Stripe test clock');
  const canceledAtCutoff = await status();
  equal(canceledAtCutoff.billingAsOf, iso(time + 301), 'verified Stripe test clock time reaches client');
  equal(canceledAtCutoff.paidThrough, iso(time + 300), 'expired settlement date is preserved');
  const src = await readFile(new URL('../../cloud/commercial.js', import.meta.url), 'utf8');
  const client = new Function('window', src + '\nreturn RoadCommercial;')({});
  equal(client.paidAccess(canceledAtCutoff, time * 1000), false, 'test-clock payment boundary closes editing');
  equal(client.paidAccess({ status: 'active', periodEnd: iso(periodEnd), paidThrough: null }, time * 1000),
    false, 'active provider state alone cannot extend database-confirmed entitlement');
  equal(client.paidAccess({ status: 'past_due', paidThrough: iso(time + 300) }, time * 1000),
    true, 'failed renewal preserves current settled time before expiry');
  equal(client.paidAccess({ status: 'past_due', paidThrough: iso(time + 300) }, (time + 300) * 1000),
    false, 'expiry is exclusive at the exact instant');
  const { rows: events } = await pool.query('select event_id from public.rs_events');
  equal(events.length, 4, 'separate deliveries recorded and duplicate kept once');
  const terms = await readFile(new URL('../../terms.html', import.meta.url), 'utf8');
  for (const section of ['subscriptions', 'cancellation']) {
    equal(terms.includes('href="#' + section + '"') && terms.includes('id="' + section + '"'), true, 'billing policy section is linked inline');
  }
  equal(terms.includes('Subscription and Cancellation Policy'), false, 'no reference to an unpublished billing policy');
  console.log('PASS isolated billing with '+(wasm?'PostgreSQL WASM':'native PostgreSQL')+', fictional Stripe and frontend rights: '+checks+' assertions');
} finally {
  try {
    if (pool) await pool.end();
    if (running) pg('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  } finally {
    await rm(cluster, { recursive: true, force: true });
  }
}
