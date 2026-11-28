import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const beta = 'https://jjaren-hub.github.io/roadshop-beta/';
const project = 'https://rwwaejqsgtrmpzwcrfpb.supabase.co';
const endpoint = project + '/functions/v1/roadshop-commercial';
const fixture = 'section7-concurrent-20261128@example.com';
// Fingerprint from the two-browser Sandbox run. Abort if Stripe ever returns a different session.
const requiredFingerprint = '10cbef969b35';
const password = process.env.EARNKEEP_QA_FIXTURE_PASSWORD;
const chrome = process.env.CHROMIUM_PATH;
function check(condition, message) {
  if (!condition) throw new Error(message);
}
function isAction(response, name) {
  const request = response.request();
  return request.url() === endpoint && request.method() === 'POST' && request.postDataJSON()?.action === name;
}
function verifiedSession(raw) {
  const url = new URL(raw);
  const id = url.pathname.match(/\/(cs_test_[A-Za-z\d]+)\/?$/)?.[1];
  return url.origin === 'https://checkout.stripe.com' && !url.username && !url.password && id &&
    createHash('sha256').update(id).digest('hex').slice(0, 12) === requiredFingerprint;
}

let browser;
let stage = 'Checking fixture configuration';
try {
  check(password && chrome, 'Fixture password or Chrome unavailable.');
  browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  stage = 'Signing in to the fictional beta account';
  await page.goto(beta + 'account.html?subscribe=1', { waitUntil: 'domcontentloaded' });
  const login = page.waitForResponse(response => response.url().startsWith(project + '/auth/v1/token?grant_type=password'));
  const status = page.waitForResponse(response => isAction(response, 'status') && response.ok());
  await page.getByLabel('Email', { exact: true }).fill(fixture);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const credential = await login;
  check(credential.ok() && (await credential.json()).user?.email === fixture, 'Expected sign-in for the exact fictional account.');
  const billing = await (await status).json();
  check(billing.checkoutMode === 'test' && billing.checkoutEnabled && billing.enforcement === false &&
    billing.subscription?.status === 'none' && billing.subscription.hasCustomer && billing.trialEligible &&
    billing.trialDays === 7, 'Expected one existing Sandbox reservation on an unsubscribed trial-eligible fixture.');

  stage = 'Opening the verified Sandbox session';
  // Hold the existing redirect while checking the upstream provider URL.
  const capture = Promise.withResolvers();
  await page.route(endpoint, async route => {
    const request = route.request();
    if (request.method() !== 'POST' || request.postDataJSON()?.action !== 'checkout') return route.continue();
    const body = request.postDataJSON();
    if (body.mode !== 'test' || body.plan !== 'basic') {
      capture.reject(new Error('Unexpected Checkout mode or plan.'));
      return route.abort();
    }
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      check(response.ok() && verifiedSession((await response.json()).url), 'The original verified Sandbox session is unavailable.');
      capture.resolve();
      await route.fulfill({ response });
    } catch (error) {
      capture.reject(error);
      await route.abort().catch(() => {});
    }
  });
  page.once('dialog', dialog => dialog.message().includes('Stripe TEST checkout') ? dialog.accept() : dialog.dismiss());
  const timeout = setTimeout(() => capture.reject(new Error('Sandbox Checkout response timed out.')), 25_000);
  try {
    await Promise.all([capture.promise, page.getByRole('button', { name: 'Start 7-day test trial', exact: true }).click()]);
  } finally {
    clearTimeout(timeout);
  }
  await page.waitForURL(url => Boolean(verifiedSession(url.href)));
  console.log('PASS verified the original hosted Stripe Sandbox session before entering test details');

  stage = 'Opening the card section using the fictional email';
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await email.fill(fixture);
  await email.press('Tab');
  await page.getByRole('button', { name: 'Pay with card', exact: true }).click();

  stage = 'Filling the synthetic card and billing address';
  await page.getByRole('textbox', { name: 'Card number', exact: true }).fill('4242424242424242');
  await page.getByRole('textbox', { name: 'Expiration', exact: true }).fill('1234');
  await page.getByRole('textbox', { name: 'Credit or debit card CVC/CVV', exact: true }).fill('123');
  await page.getByRole('textbox', { name: 'Cardholder name', exact: true }).fill('EarnKeep QA Fixture');
  await page.getByRole('combobox', { name: 'Country or region', exact: true }).selectOption('US');
  const line = page.locator('#billingAddressLine1');
  await line.fill('123 Sandbox Way');
  const manual = page.getByRole('button', { name: 'Enter address manually', exact: true });
  if (await manual.isVisible()) await manual.click();
  await page.locator('#billingLocality').fill('Salt Lake City');
  await page.locator('#billingAdministrativeArea').selectOption('UT');
  await page.locator('#billingPostalCode').fill('84101');

  const saveWithLink = page.getByRole('checkbox', { name: 'Save my information with Link for faster checkout', exact: true });
  if (await saveWithLink.isVisible()) await saveWithLink.uncheck();
  stage = 'Submitting one Sandbox trial on the verified session';
  check(verifiedSession(page.url()), 'Refusing to submit outside the verified Stripe Sandbox session.');
  const returned = page.waitForURL(url => url.href.startsWith(beta + 'billing.html?checkout=returned'), { timeout: 35_000 });
  await page.getByRole('button', { name: /^(Start (?:your )?(?:7-day |free )?trial|Subscribe(?: now)?)$/i }).click();
  await returned;
  console.log('PASS submitted one Stripe Sandbox trial and returned to the beta Billing page');

  stage = 'Checking the fixture’s trial and duplicate-checkout controls';
  let info;
  for (let i = 0; i < 5; i++) {
    const statusResponse = page.waitForResponse(response => isAction(response, 'status') && response.ok());
    await page.goto(beta + 'subscribe.html', { waitUntil: 'domcontentloaded' });
    info = await (await statusResponse).json();
    if (info.subscription?.status === 'trialing') break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  check(info?.subscription?.status === 'trialing' && info.subscription.trialUsed === true && !info.trialEligible,
    'The provider-backed trial activation was not observable through webhooks.');
  const days = (Date.parse(info.subscription.trialEnd) - Date.now()) / 86_400_000;
  check(days > 6.9 && days <= 7.01, 'The Sandbox trial does not end in seven days.');
  await page.getByText('Your free trial is active.', { exact: true }).waitFor();
  check(await page.getByRole('button', { name: /Start .*trial|Subscribe \(test mode\)/i }).count() === 0,
    'A second checkout is still offered after activation.');
  console.log('PASS beta reports one consumed seven-day trial and hides repeat checkout');
} catch (error) {
  const expected = error.stack?.split('\n').some(line => line.includes('at check ('));
  console.error(stage + ' failed.' + (expected ? ' ' + error.message : ' Browser operation did not finish successfully.'));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
