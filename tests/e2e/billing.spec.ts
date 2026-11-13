import { expect, test, type Page } from '@playwright/test';

/**
 * Razorpay subscriptions end to end, against the fake Supabase running the real billing code.
 * Razorpay Checkout is replaced by a stand-in that "pays" and returns a correctly signed
 * response, as the real Checkout does; the server still checks the signature.
 */

const PASSWORD = 'correct-horse-9';
const FAKE = 'http://localhost:54329';

const FAKE_CHECKOUT = `
window.Razorpay = function (options) {
  const handlers = {};
  this.on = function (event, cb) { handlers[event] = cb; };
  this.open = async function () {
    window.__checkout = options;
    if (window.__failPayment) {
      // The person's UPI app declined; they then close the window.
      const description = window.__failPayment;
      window.__failPayment = null;
      handlers['payment.failed']?.({ error: { description } });
      options.modal.ondismiss();
      return;
    }
    const paymentId = 'pay_e2e' + Math.random().toString(36).slice(2, 8);
    const res = await fetch('${FAKE}/__test/razorpay-sign', {
      method: 'POST',
      body: JSON.stringify({
        payment_id: paymentId,
        subscription_id: options.subscription_id,
        order_id: options.order_id,
      }),
    });
    const { signature } = await res.json();
    options.handler(
      options.order_id
        ? { razorpay_payment_id: paymentId, razorpay_order_id: options.order_id, razorpay_signature: signature }
        : { razorpay_payment_id: paymentId, razorpay_subscription_id: options.subscription_id, razorpay_signature: signature },
    );
  };
};`;

const control = (path: string, body: unknown) =>
  fetch(`${FAKE}${path}`, { method: 'POST', body: JSON.stringify(body) });

test.beforeAll(async () => {
  await control('/__test/billing-plans', { connected: true });
});
test.afterAll(async () => {
  await control('/__test/billing-plans', { connected: false });
});

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.route('https://checkout.razorpay.com/v1/checkout.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_CHECKOUT }),
  );
});

async function signUp(page: Page) {
  await page.goto('/sign-up?next=/pro');
  await page
    .getByRole('textbox', { name: 'Email' })
    .fill(`pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  // The pathname itself: "/sign-up?next=/pro" also ends in /pro.
  await page.waitForURL((u) => u.pathname === '/pro');
}

test('the plans show the prices as they are, with nothing to compare them against', async ({
  page,
}) => {
  await signUp(page);
  const plans = page.getByRole('region', { name: 'Pro plans' });
  const monthly = plans.getByRole('radio', { name: /^Monthly/ });
  const quarterly = plans.getByRole('radio', { name: /^3 months/ });
  const yearly = plans.getByRole('radio', { name: /^Yearly/ });
  await expect(monthly).toContainText('₹149');
  await expect(quarterly).toContainText('₹399');
  await expect(yearly).toContainText('₹1,499');
  await expect(yearly).toContainText('Best value');
  // No offer box, no crossed-out price, no price per day and no percent saved.
  await expect(plans.getByTestId('intro-offer')).toHaveCount(0);
  await expect(plans.locator('[data-regular-price]')).toHaveCount(0);
  await expect(plans).not.toContainText(/a day|save \d+%|early bird/i);
  // Both ways to pay, every time.
  await expect(plans.getByRole('radio', { name: /^Autopay/ })).toBeChecked();
  await plans.getByRole('radio', { name: /^Pay once/ }).click();
  await expect(yearly).toContainText('₹1,499');
  await expect(yearly).toContainText('for 1 year');
});

test('autopay turns Pro on at once; turning renewal off keeps the time and opens both ways to extend', async ({
  page,
}) => {
  await signUp(page);
  await expect(page.getByRole('heading', { name: /^Free trial:/ })).toBeVisible();
  const plans = page.getByRole('region', { name: 'Pro plans' });
  await expect(plans).toContainText('Paying now starts your plan today');
  await plans.getByRole('radio', { name: /^3 months/ }).click();
  await plans.getByRole('button', { name: 'Subscribe for ₹399 every 3 months' }).click();

  // Pro is on as soon as the server confirms the payment.
  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  const mine = page.getByRole('region', { name: 'Your plan' });
  await expect(mine).toContainText('3 months, ₹399 every 3 months');
  await expect(mine).toContainText(/Renews on /);
  // While it renews by itself there is nothing to buy on top, and the page says how to change.
  await expect(page.locator('[data-buy-plan]')).toHaveCount(0);
  await expect(mine.locator('[data-extend-note]')).toContainText('Turn renewal off first');

  await mine.getByRole('button', { name: 'Turn off renewal' }).click();
  const confirm = page.getByRole('dialog', { name: 'Turn off renewal?' });
  await expect(confirm).toContainText('You will not be charged again');
  await confirm.getByRole('button', { name: 'Turn off renewal' }).click();
  await expect(mine).toContainText(/Ends on .*It will not renew\./);
  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  await expect(mine.getByRole('button', { name: 'Turn off renewal' })).toHaveCount(0);

  // Now they can extend, either way. Autopay would start when the paid time runs out.
  const more = page.getByRole('region', { name: 'Extend your Pro' });
  await expect(more.getByRole('radio', { name: /^Pay once/ })).toBeChecked();
  await more.getByRole('radio', { name: /^Autopay/ }).click();
  await expect(more).toContainText(/Autopay starts on .* when the time you paid for runs out/);
  await more.getByRole('radio', { name: /^Yearly/ }).click();
  await expect(more).toContainText(/First charge on /);
  await more.getByRole('button', { name: 'Subscribe for ₹1,499 a year' }).click();
  await expect(mine).toContainText('Yearly, ₹1,499 a year');
  await expect(mine).toContainText(/Renews on /);

  // Pro features are open.
  await page.goto('/progress?range=all');
  await expect(page.locator('[data-pro-lock]')).toHaveCount(0);
});

test('paying once turns Pro on with no renewal, and more time can be added either way', async ({
  page,
}) => {
  await signUp(page);
  const plans = page.getByRole('region', { name: 'Pro plans' });
  await plans.getByRole('radio', { name: /^Pay once/ }).click();
  await expect(plans).toContainText('No mandate and no automatic charge');
  await plans.getByRole('radio', { name: /^3 months/ }).click();
  await plans.getByRole('button', { name: 'Pay ₹399 once for 3 months' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  const mine = page.getByRole('region', { name: 'Your plan' });
  await expect(mine).toContainText('3 months, paid once');
  await expect(mine).toContainText(/Ends on .*It will not renew\./);
  await expect(mine.getByRole('button', { name: 'Turn off renewal' })).toHaveCount(0);

  // More time can be added, with one payment or with autopay.
  const more = page.getByRole('region', { name: 'Extend your Pro' });
  await expect(more.getByRole('radio', { name: /^Autopay/ })).toBeVisible();
  await more.getByRole('radio', { name: /^Monthly/ }).click();
  await more.getByRole('button', { name: 'Pay ₹149 once for 1 month' }).click();
  await expect(mine).toContainText('Monthly, paid once');
  // The extend row is one tap from More, for members too.
  await page.goto('/more');
  await expect(page.locator('[data-pro-row]')).toContainText('Extend or manage your plan');
});

test('a failed autopay says why and offers one payment instead', async ({ page }) => {
  await signUp(page);
  const plans = page.getByRole('region', { name: 'Pro plans' });
  await page.evaluate(() => {
    (window as unknown as { __failPayment: string }).__failPayment =
      'Payment was declined by your UPI app';
  });
  await plans.getByRole('radio', { name: /^Monthly/ }).click();
  await plans.getByRole('button', { name: 'Subscribe for ₹149 a month' }).click();
  const failed = plans.locator('[data-payment-failed]');
  await expect(failed).toContainText('Payment was declined by your UPI app.');
  await expect(failed).toContainText('Nothing was charged');
  // Still on the trial: a failed try gives nothing.
  await expect(page.getByRole('heading', { name: /^Free trial:/ })).toBeVisible();

  await plans.locator('[data-pay-once-instead]').click();
  await expect(plans.getByRole('radio', { name: /^Pay once/ })).toBeChecked();
  await expect(failed).toHaveCount(0);
  await plans.getByRole('button', { name: 'Pay ₹149 once for 1 month' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
});

test('a code takes 10% off the first payment, once per account', async ({ page }) => {
  await control('/__test/coupon', { code: 'GYM10' });
  await signUp(page);
  const plans = page.getByRole('region', { name: 'Pro plans' });
  await plans.getByRole('button', { name: 'Have a code?' }).click();
  await plans.getByLabel('Code').fill('nope');
  await plans.getByRole('button', { name: 'Apply' }).click();
  await expect(plans.getByRole('alert')).toContainText('That code is not valid');
  await plans.getByLabel('Code').fill('gym10');
  await plans.getByRole('button', { name: 'Apply' }).click();
  await expect(plans.locator('[data-coupon-applied]')).toContainText(
    'GYM10 applied: 10% off your first payment',
  );
  // Autopay: the first year at the lower price today, then the normal price.
  await expect(plans.getByRole('button', { name: 'Start autopay, ₹1,349 today' })).toBeVisible();
  await expect(plans).toContainText('₹1,349 today for the first 1 year, then ₹1,499 a year');

  await plans.getByRole('radio', { name: /^Pay once/ }).click();
  await plans.getByRole('button', { name: 'Pay ₹1,349 once for 1 year' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  // The same account cannot use a code again.
  const more = page.getByRole('region', { name: 'Extend your Pro' });
  await more.getByRole('button', { name: 'Have a code?' }).click();
  await more.getByLabel('Code').fill('GYM10');
  await more.getByRole('button', { name: 'Apply' }).click();
  await expect(more.getByRole('alert')).toContainText('already been used on this account');
});

test('right after the trial: 10% off the first payment for 48 hours, with no code', async ({
  page,
}) => {
  const email = `offer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto('/sign-up?next=/pro');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL((u) => u.pathname === '/pro');
  // In the trial there is no offer.
  await expect(page.locator('[data-trial-offer]')).toHaveCount(0);
  await control('/__test/expire-trial', { email, daysAgo: 1 });
  await page.reload();
  const plans = page.getByRole('region', { name: 'Pro plans' });
  await expect(plans.locator('[data-trial-offer]')).toContainText(
    'Your trial has ended. 10% off your first payment',
  );
  await expect(plans.getByRole('button', { name: 'Start autopay, ₹1,349 today' })).toBeVisible();
  await plans.getByRole('radio', { name: /^Pay once/ }).click();
  // The server applies it by itself: the order it makes is for the lower amount.
  const order = page.waitForResponse((r) => r.url().endsWith('/billing/order'));
  await plans.getByRole('button', { name: 'Pay ₹1,349 once for 1 year' }).click();
  expect(((await (await order).json()) as { amount: number }).amount).toBe(134900);
  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  await expect(page.locator('[data-trial-offer]')).toHaveCount(0);
});

test('a webhook with a bad signature changes nothing', async () => {
  const res = await fetch(`${FAKE}/functions/v1/billing/webhook`, {
    method: 'POST',
    headers: { 'x-razorpay-signature': 'forged', 'x-razorpay-event-id': 'evt_forged' },
    body: JSON.stringify({
      event: 'subscription.charged',
      payload: { subscription: { entity: { id: 'sub_x', status: 'active' } } },
    }),
  });
  expect(res.status).toBe(401);
});

test('1:1 coaching: the offer, paying once, the member view and the intake', async ({ page }) => {
  await signUp(page);
  await page.goto('/coaching');
  await expect(page.locator('[data-coaching-hero]')).toContainText('₹999');
  // Nobody sees the coach's number before joining.
  await expect(page.locator('[data-whatsapp-coach]')).toHaveCount(0);
  await expect(page.locator('[data-join-coaching]')).toContainText('Start coaching, ₹999 a month');

  await page.locator('[data-join-coaching-once]').click();
  const member = page.locator('[data-coaching-member]');
  await expect(member).toContainText('Welcome to 1:1 coaching');
  await expect(member).toContainText('Your coach: Coach Arjun');
  await expect(member.locator('[data-whatsapp-coach]')).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/919876543210\?text=/,
  );

  const form = page.locator('[data-coaching-form]');
  await form.getByLabel('Your goal').fill('Lose 6 kg and bench 80 kg');
  await form.getByLabel('When you train, and when you can talk').fill('Gym 7 am, free after 8 pm');
  await form.getByLabel('WhatsApp number').fill('+91 98765 43210');
  await form.locator('[data-send-intake]').click();
  const told = page.locator('[data-coaching-intake]');
  await expect(told).toContainText('Lose 6 kg and bench 80 kg');
  await expect(told).toContainText('+91 98765 43210');

  // Coaching includes Pro.
  await page.goto('/progress?range=all');
  await expect(page.locator('[data-pro-lock]')).toHaveCount(0);
  await page.goto('/more');
  await expect(page.locator('[data-coaching-row]')).toContainText('Your 1:1 coaching');
});
