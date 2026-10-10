import { expect, test, type Page } from '@playwright/test';

/** Trial, Pro gating and manual UPI, against the local fake Supabase. */

const PASSWORD = 'correct-horse-9';
const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

async function signUp(page: Page, next = '/pro') {
  await page.goto(`/sign-up?next=${encodeURIComponent(next)}`);
  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail('pro'));
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

const lock = (page: Page, feature: string) => page.locator(`[data-pro-lock="${feature}"]`);

test('guests keep every free feature and see what Pro adds', async ({ page }) => {
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toBeVisible();
  await expect(lock(page, 'muscle_balance')).toBeVisible();
  await page.getByRole('radio', { name: 'All time · Pro' }).click();
  await expect(lock(page, 'long_range')).toContainText('Your history is all here');
  await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toHaveCount(0);

  // History and records are never locked.
  await page.goto('/history');
  await expect(page.locator('[data-pro-lock]')).toHaveCount(0);
  await page.goto('/records');
  await expect(page.locator('[data-pro-lock]')).toHaveCount(0);

  await page.goto('/pro');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Stop guessing. Start progressing.',
  );
  await expect(page.getByRole('link', { name: 'Try Pro free for 7 days' })).toBeVisible();
  // The comparison says plainly what stays free.
  const table = page.getByRole('table', { name: 'What the free plan and Pro include' });
  const history = table.getByRole('row', { name: /Full workout history/ });
  await expect(history.getByRole('img', { name: 'Included' })).toHaveCount(2);
  await expect(page.getByText('Your workout history always stays free.')).toBeVisible();
  // No founding member or early access wording is left.
  await expect(page.getByText(/founding|early access/i)).toHaveCount(0);
});

test('while the server still has early access on, an account simply has Pro', async ({ page }) => {
  await signUp(page, '/');
  // No founding member welcome any more.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/pro');
  await expect(page.getByRole('heading', { name: 'Pro is active' })).toBeVisible();
  // No trial clock and nothing to pay.
  await expect(page.getByRole('progressbar', { name: 'Trial used' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Get Pro' })).toHaveCount(0);
  await expect(page.getByText(/founding|early access/i)).toHaveCount(0);

  await page.goto('/progress?range=all');
  await expect(page.locator('[data-pro-lock]')).toHaveCount(0);
  await page.goto('/more');
  await expect(page.locator('a[href="/profile"]').getByText('Pro', { exact: true })).toBeVisible();
});

test.describe('after early access ends', () => {
  // Stands in for the administrator's SQL. Tests run one at a time, so nothing else sees it.
  const setEarlyAccess = (open: boolean) =>
    fetch('http://localhost:54329/__test/early-access', {
      method: 'POST',
      body: JSON.stringify({ open }),
    });
  test.beforeAll(() => setEarlyAccess(false));
  test.afterAll(() => setEarlyAccess(true));

  test('a new account gets exactly 7 days of Pro from the server', async ({ page }) => {
    await signUp(page);
    await expect(
      page.getByRole('heading', { name: /^Free trial: (7 days|6 days 23 hours) left$/ }),
    ).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Trial used' })).toBeVisible();
    // Signing in again does not restart it: reload reads the same server record.
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Free trial:/ })).toBeVisible();
  });

  test('tampering in the browser does not grant Pro', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      for (const store of [localStorage, sessionStorage]) {
        store.setItem('plan', 'pro');
        store.setItem('pro', 'true');
        store.setItem('isPro', 'true');
        store.setItem(
          'subscription',
          JSON.stringify({ status: 'active', pro_expires_at: '2099-01-01T00:00:00Z' }),
        );
      }
    });
    await page.goto('/progress?range=all&pro=1&plan=pro&isPro=true');
    await expect(lock(page, 'long_range')).toBeVisible();
  });

  test('a signed-in user cannot change their own access through the API', async ({ page }) => {
    await signUp(page);
    const result = await page.evaluate(async () => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      )!;
      const token = JSON.parse(localStorage.getItem(key)!).access_token as string;
      const headers = {
        apikey: token,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates',
      };
      const base = 'http://localhost:54329/rest/v1';
      const statuses: number[] = [];
      // Try to read, insert and overwrite the subscription row directly.
      statuses.push((await fetch(`${base}/subscriptions?select=*`, { headers })).status);
      statuses.push(
        (
          await fetch(`${base}/subscriptions?on_conflict=user_id`, {
            method: 'POST',
            headers,
            body: JSON.stringify([{ status: 'active', pro_expires_at: '2099-01-01T00:00:00Z' }]),
          })
        ).status,
      );
      return statuses;
    });
    expect(result.every((s) => s >= 400)).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Free trial:/ })).toBeVisible();
  });

  test('manual UPI: instructions, reference submission and pending state', async ({ page }) => {
    await signUp(page);
    const pay = page.getByRole('region', { name: 'Get Pro' });
    await expect(pay).toContainText('/ 30 days');
    await expect(pay).toContainText('₹1');
    await expect(pay).toContainText('e2e-test@fakebank');
    await expect(pay).toContainText('Never share your UPI PIN');
    // Only the transaction reference is ever asked for.
    await expect(pay.getByRole('textbox')).toHaveCount(1);

    await pay.getByRole('textbox', { name: 'UPI transaction reference' }).fill('bad ref!');
    await pay.getByRole('button', { name: 'Send reference' }).click();
    await expect(pay.getByText(/6 to 40 letters or numbers/)).toBeVisible();

    await pay.getByRole('textbox', { name: 'UPI transaction reference' }).fill('412345678901');
    await pay.getByRole('button', { name: 'Send reference' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Payment reference' })).toContainText(
      '412345678901',
    );
    // Submitting a reference grants nothing by itself: still the trial.
    await expect(page.getByRole('heading', { name: /^Free trial:/ })).toBeVisible();
  });

  test('development access states preview expired and Pro screens', async ({ page }) => {
    const choose = async (state: string) => {
      await page.goto('/settings');
      await page.getByRole('combobox', { name: 'Access state' }).selectOption(state);
    };
    // Gating, on the demo athlete's data.
    await choose('trial_expired');
    await page.goto('/progress?range=all');
    await expect(lock(page, 'long_range')).toBeVisible();
    await choose('pro');
    await page.goto('/progress?range=all');
    await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toBeVisible();
    await expect(page.locator('[data-pro-lock]')).toHaveCount(0);

    // Plan screens need an account. The override lives in this tab's session storage.
    await signUp(page);
    await choose('trial_expired');
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: 'Your free trial has ended' })).toBeVisible();
    await choose('pro_expired');
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: 'Your Pro has ended' })).toBeVisible();
    await choose('pro');
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: 'Pro is active' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Add more Pro time' })).toBeVisible();
  });
});
