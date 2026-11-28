import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const beta = 'https://jjaren-hub.github.io/roadshop-beta/';
const supabase = 'https://rwwaejqsgtrmpzwcrfpb.supabase.co';
const fixture = 'section7-concurrent-20261128@example.com';
const password = process.env.EARNKEEP_QA_FIXTURE_PASSWORD;
const chrome = process.env.CHROMIUM_PATH;
const action = (request, name) => {
  if (request.url() !== supabase + '/functions/v1/roadshop-commercial' || request.method() !== 'POST') return false;
  return request.postDataJSON()?.action === name;
};
function check(condition, message) {
  if (!condition) throw new Error(message);
}
function sessionId(value) {
  const url = new URL(value);
  const id = url.pathname.match(/\/(cs_test_[A-Za-z\d]+)\/?$/)?.[1];
  check(url.origin === 'https://checkout.stripe.com' && !url.username && !url.password && id, 'Checkout did not return a Stripe Sandbox session.');
  return id;
}

let browser;
let stage = 'Fixture configuration';
const gate = Promise.withResolvers();
let secondReachedGate = false;
try {
  check(password && chrome, 'Set EARNKEEP_QA_FIXTURE_PASSWORD and CHROMIUM_PATH to run this check.');
  browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
  const pages = await Promise.all([1, 2].map(async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(25_000);
    return page;
  }));
  stage = 'Authenticating the same fixture separately in both contexts';
  const identities = await Promise.all(pages.map(async page => {
    await page.goto(beta + 'account.html?subscribe=1', { waitUntil: 'domcontentloaded' });
    const login = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === supabase && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password';
    });
    const status = page.waitForResponse(response => action(response.request(), 'status') && response.ok());
    await page.getByLabel('Email', { exact: true }).fill(fixture);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const response = await login;
    check(response.ok(), 'The fixture sign-in failed in a fresh context.');
    const { user } = await response.json();
    check(user?.email === fixture && user?.app_metadata?.earnkeep_subscription_beta === true, 'A browser did not authenticate the enrolled fictional user.');
    const billing = await (await status).json();
    check(billing.checkoutMode === 'test' && billing.checkoutEnabled === true && billing.enforcement === false, 'Expected beta Sandbox checkout with global enforcement off.');
    check(billing.subscription?.status === 'none' &&
      billing.trialEligible === true && billing.trialDays === 7, 'The fixture is no longer unsubscribed and eligible for its first trial.');
    await page.getByRole('button', { name: 'Start 7-day test trial', exact: true }).waitFor();
    return user.id;
  }));
  check(identities[0] && identities[0] === identities[1], 'Both contexts must authenticate the same fixture.');
  console.log('PASS two separate browser contexts authenticated the same unsubscribed trial-eligible fixture');

  stage = 'Releasing both genuine authenticated Checkout requests together';
  const sent = [];
  let ready = 0;
  const endpoint = supabase + '/functions/v1/roadshop-commercial';
  const completed = new Map();
  async function observeCheckout(page) {
    await page.route(endpoint, async route => {
      const request = route.request();
      if (!action(request, 'checkout')) return route.continue();
      const capture = completed.get(page);
      const body = request.postDataJSON();
      if (!capture || body.mode !== 'test' || body.plan !== 'basic') {
        capture?.reject(new Error('Blocked unexpected checkout request.'));
        return route.abort();
      }
      if (ready < 2) {
        if (++ready === 2) {
          secondReachedGate = true;
          gate.resolve();
        }
        await gate.promise;
        if (!secondReachedGate) return route.abort();
        sent.push(performance.now());
      }
      try {
        // Read the genuine response before following the Stripe redirect, which can evict the browser response body.
        const response = await route.fetch({ maxRedirects: 0 });
        const payload = await response.json();
        if (response.ok()) capture.resolve({ status: response.status(), id: sessionId(payload.url), url: payload.url });
        else {
          check(response.status() === 409 && /existing checkout/i.test(payload.error ?? ''), 'Unexpected beta checkout HTTP ' + response.status() + '.');
          capture.resolve({ status: response.status(), id: null });
        }
        await route.fulfill({ response });
      } catch (error) {
        capture.reject(error);
        await route.abort().catch(() => {});
      }
    });
  }
  await Promise.all(pages.map(observeCheckout));
  async function start(page) {
    const capture = Promise.withResolvers();
    completed.set(page, capture);
    page.once('dialog', dialog => dialog.message().includes('Stripe TEST checkout') ? dialog.accept() : dialog.dismiss());
    const timeout = setTimeout(() => capture.reject(new Error('Checkout response was not captured.')), 25_000);
    try {
      const [result] = await Promise.all([capture.promise, page.getByRole('button', { name: 'Start 7-day test trial', exact: true }).click()]);
      return result;
    } finally {
      clearTimeout(timeout);
      completed.delete(page);
    }
  }
  const pair = await Promise.all(pages.map(start));
  const delta = Math.round(Math.max(...sent) - Math.min(...sent));
  check(sent.length === 2 && delta <= 100, 'The two requests did not leave the barrier within 100 milliseconds.');
  console.log('Paired requests released ' + delta + ' ms apart. Beta HTTP results ' + pair.map(result => result.status).join(', ') + '.');
  const providerId = pair.find(result => result.id)?.id;
  check(providerId, 'Neither request returned a Stripe Sandbox session.');
  stage = 'Checking Stripe Sandbox session identity and pending-request retry';
  for (let i = 0; i < pair.length; i++) {
    if (!pair[i].id) {
      pair[i] = await start(pages[i]);
    }
    check(pair[i].id === providerId, 'The two browser contexts resolved to different Stripe sessions.');
  }
  const fingerprint = createHash('sha256').update(providerId).digest('hex').slice(0, 12);
  console.log('PASS both contexts resolved to one real Stripe Sandbox Checkout session. Session fingerprint ' + fingerprint + '.');
  stage = 'Checking that the real Stripe Sandbox Checkout opened';
  await pages[0].waitForURL(url => url.origin === 'https://checkout.stripe.com' && sessionId(url.href) === providerId, { timeout: 20_000 });
  console.log('PASS the Stripe-hosted Sandbox Checkout opened for the verified session.');
  console.log('Checkout submission and unseen webhook ordering are separate acceptance checks.');
} catch (error) {
  // Only explicit test failures may print details. Browser errors can contain private request data.
  const expected = error.stack?.split('\n').some(line => line.includes('at check ('));
  console.error(stage + ' failed.' + (expected ? ' ' + error.message : ' Browser operation did not finish successfully.'));
  process.exitCode = 1;
} finally {
  gate.resolve();
  await browser?.close();
}
