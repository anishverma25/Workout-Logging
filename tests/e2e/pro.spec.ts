import { expect, test, type Page } from '@playwright/test';
import { expireTrial, loadDemo, signUpFresh } from './session';

/**
 * Trial, Pro gating and the Pro page, against the local fake Supabase, which runs with early
 * access ended (the launch state). Early access itself is tested in subscriptions.test.ts.
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

async function signUp(page: Page, next = '/pro') {
  const email = await signUpFresh(page, { at: next, tag: 'pro' });
  await expect(page).toHaveURL(new RegExp(`${next.replace('?', '\\?')}$`));
  return email;
}

const lock = (page: Page, feature: string) => page.locator(`[data-pro-lock="${feature}"]`);

test.describe('after early access ends', () => {
  // The fake server starts in this state, as production will be at launch.
  test('a free member keeps every free feature and sees what Pro adds', async ({ page }) => {
    const email = await signUp(page, '/settings');
    await loadDemo(page);
    // The trial is over on the server, so this is the real free experience.
    await expireTrial(email, 2);
    await page.goto('/progress?view=volume');
    await expect(page.getByRole('heading', { name: 'Volume', exact: true })).toBeVisible();
    await expect(lock(page, 'muscle_balance')).toBeVisible();
    await page.getByRole('radio', { name: 'All time · Pro' }).click();
    await expect(lock(page, 'long_range')).toContainText('Your history is all here');
    await expect(page.getByRole('heading', { name: 'Volume', exact: true })).toHaveCount(0);

    // History and records are never locked.
    await page.goto('/history');
    await expect(page.locator('[data-pro-lock]')).toHaveCount(0);
    await page.goto('/records');
    await expect(page.locator('[data-pro-lock]')).toHaveCount(0);

    await page.goto('/pro');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Stop guessing. Start progressing.',
    );
    await expect(page.getByRole('heading', { name: 'Your free trial has ended' })).toBeVisible();
    // The comparison says plainly what stays free.
    const table = page.getByRole('table', { name: 'What the free plan and Pro include' });
    const history = table.getByRole('row', { name: /Full workout history/ });
    await expect(history.getByRole('img', { name: 'Included' })).toHaveCount(2);
    await expect(page.getByText('Your workout history always stays free.')).toBeVisible();
    // No founding member or early access wording is left.
    await expect(page.getByText(/founding|early access/i)).toHaveCount(0);
  });

  test('a free member is reminded about Pro with their own numbers, and can say not now', async ({
    page,
  }) => {
    const email = await signUp(page, '/settings');
    await loadDemo(page);
    // Quiet for the first days after a trial ends.
    await expireTrial(email, 1);
    await page.goto('/');
    await expect(page.getByTestId('pro-nudge')).toHaveCount(0);

    // Later, one reminder, built from their own log.
    await expireTrial(email, 20);
    await page.goto('/');
    const nudge = page.getByTestId('pro-nudge');
    await expect(nudge).toBeVisible();
    await expect(nudge).toContainText(/\d+ (days|workouts|personal records)|₹\d+ a month/);
    // No invented urgency anywhere in it.
    await expect(nudge).not.toContainText(/hurry|last chance|only today|expires in/i);

    // It leads to the Pro page.
    await expect(nudge.getByRole('link', { name: 'See what Pro shows' })).toHaveAttribute(
      'href',
      '/pro',
    );
    // "Not now" closes it at once.
    await nudge.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByTestId('pro-nudge')).toHaveCount(0);

    // And it is not repeated on the next visit. The widening gaps between reminders, and the
    // longer silence after "not now", are tested in domain/entitlement/nudge.test.ts: elapsed
    // time since a reminder cannot be faked from here.
    await page.goto('/history');
    await page.goto('/');
    await expect(page.locator('#today-title')).toBeVisible();
    await expect(page.getByTestId('pro-nudge')).toHaveCount(0);
  });

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
    const email = await signUp(page, '/settings');
    await loadDemo(page);
    await expireTrial(email, 1);
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

  test('before Razorpay plans are connected, prices show and nothing can be bought', async ({
    page,
  }) => {
    await signUp(page);
    const plans = page.getByRole('region', { name: 'Pro plans' });
    await expect(plans.getByRole('radio', { name: /^Monthly/ })).toContainText('₹29');
    await expect(plans.getByRole('radio', { name: /^3 months/ })).toContainText('₹69');
    await expect(plans.getByRole('radio', { name: /^Yearly/ })).toContainText('₹249');
    await expect(plans.getByRole('button', { name: 'Plans open soon' })).toBeDisabled();
    // No payment details are ever typed into this page.
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });

  test('development access states preview expired and Pro screens', async ({ page }) => {
    const choose = async (state: string) => {
      await page.goto('/settings');
      await page.getByRole('combobox', { name: 'Access state' }).selectOption(state);
    };
    // Gating, on the demo athlete's data.
    await signUp(page, '/settings');
    await loadDemo(page);
    await choose('trial_expired');
    await page.goto('/progress?range=all');
    await expect(lock(page, 'long_range')).toBeVisible();
    await choose('pro');
    await page.goto('/progress?range=all&view=strength');
    await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toBeVisible();
    await expect(page.locator('[data-pro-lock]')).toHaveCount(0);

    await choose('trial_expired');
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: 'Your free trial has ended' })).toBeVisible();
    await choose('pro_expired');
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: 'Your Pro has ended' })).toBeVisible();
    await choose('pro');
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: 'Your Pro membership' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pro plans' })).toHaveCount(0);
  });
});
