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
  this.open = async function () {
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
  this.on = function () {};
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

test('the plans show honest per-month prices and the introductory framing', async ({ page }) => {
  await signUp(page);
  const plans = page.getByRole('region', { name: 'Pro plans' });
  const yearly = plans.getByRole('radio', { name: /^Yearly/ });
  await expect(yearly).toContainText('₹249');
  await expect(plans.getByTestId('intro-offer')).toContainText('Introductory prices');
  await expect(plans.getByTestId('intro-offer')).toContainText('under ₹1 a day');
  await expect(yearly).toContainText('Best value');
  // 249 a year against 29 a month: 20.75 a month, 28% less.
  await expect(yearly).toContainText('₹20.75 a month · save 28%');
  await expect(plans.getByRole('radio', { name: /^3 months/ })).toContainText('₹23 a month');
});

test('subscribing turns Pro on at once, and cancelling keeps it to the end of the period', async ({
  page,
}) => {
  await signUp(page);
  await expect(page.getByRole('heading', { name: /^Free trial:/ })).toBeVisible();
  const plans = page.getByRole('region', { name: 'Pro plans' });
  await expect(plans).toContainText('Subscribing now starts your plan today');
  await plans.getByRole('radio', { name: /^3 months/ }).click();
  await plans.getByRole('button', { name: 'Subscribe for ₹69 every 3 months' }).click();

  // Pro is on as soon as the server confirms the payment.
  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  const mine = page.getByRole('region', { name: 'Your plan' });
  await expect(mine).toContainText('3 months, ₹69 every 3 months');
  await expect(mine).toContainText(/Renews on /);

  await mine.getByRole('button', { name: 'Cancel plan' }).click();
  const confirm = page.getByRole('dialog', { name: 'Cancel your plan?' });
  await expect(confirm).toContainText('You will not be charged again');
  await confirm.getByRole('button', { name: 'Cancel plan' }).click();
  await expect(mine).toContainText(/Ends on .*It will not renew\./);
  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  await expect(mine.getByRole('button', { name: 'Cancel plan' })).toHaveCount(0);

  // Pro features are open.
  await page.goto('/progress?range=all');
  await expect(page.locator('[data-pro-lock]')).toHaveCount(0);
});

test('paying once turns Pro on with no renewal, and more time can be added', async ({ page }) => {
  await signUp(page);
  const plans = page.getByRole('region', { name: 'Pro plans' });
  await plans.getByRole('radio', { name: /^Pay once/ }).click();
  await expect(plans).toContainText('No mandate and no automatic charge');
  await plans.getByRole('radio', { name: /^3 months/ }).click();
  await plans.getByRole('button', { name: 'Pay ₹69 once for 3 months' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome to Pro' })).toBeVisible();
  const mine = page.getByRole('region', { name: 'Your plan' });
  await expect(mine).toContainText('3 months, paid once');
  await expect(mine).toContainText(/Ends on .*It will not renew\./);
  await expect(mine.getByRole('button', { name: 'Cancel plan' })).toHaveCount(0);

  // More time can be added; it never offers a renewing plan here.
  const more = page.getByRole('region', { name: 'Add more Pro time' });
  await expect(more.getByRole('radio', { name: /^Auto-renew/ })).toHaveCount(0);
  await more.getByRole('radio', { name: /^Monthly/ }).click();
  await more.getByRole('button', { name: 'Pay ₹29 once for 1 month' }).click();
  await expect(mine).toContainText('Ends on');
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
