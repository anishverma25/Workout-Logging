import { expect, type Page } from '@playwright/test';

/**
 * Overload needs an account: the whole app sits behind one, so almost every test starts by
 * creating a fresh one. Each test uses its own email, so they can run in parallel.
 *
 * An account always starts empty, exactly as a real one does. A test that needs training to
 * look at asks for the demo athlete, which the Settings screen can load in development and
 * end-to-end builds, and which never leaves the device.
 */

export const PASSWORD = 'correct-horse-9';

export const uniqueEmail = (tag = 'e2e') =>
  `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

export const FAKE_SUPABASE = 'http://localhost:54329';

/**
 * Stands in for time passing: the account's free trial ended this many days ago, on the
 * server, which is the only place access is decided.
 */
export async function expireTrial(email: string, daysAgo = 1) {
  const res = await fetch(`${FAKE_SUPABASE}/__test/expire-trial`, {
    method: 'POST',
    body: JSON.stringify({ email, daysAgo }),
  });
  expect(res.ok).toBe(true);
}

/** Creates an account and returns the email it used. */
export async function signUpFresh(page: Page, { at = '/', tag = 'e2e' } = {}): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto(`/sign-up?next=${encodeURIComponent(at)}`);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).not.toHaveURL(/sign-up/);
  return email;
}

/** Loads the demo athlete into the account that is open, through the Settings screen. */
export async function loadDemo(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await expect(page.locator('#demo-data').getByRole('status')).toContainText('workouts', {
    timeout: 30_000,
  });
}

/**
 * A fresh account with the demo athlete's training in it, on Home. What most screens need to
 * have something to show.
 */
export async function startWithDemo(page: Page, { tag = 'e2e' } = {}): Promise<string> {
  const email = await signUpFresh(page, { at: '/settings', tag });
  await loadDemo(page);
  await page.goto('/');
  await expect(page.locator('#today-title')).toBeVisible();
  return email;
}
