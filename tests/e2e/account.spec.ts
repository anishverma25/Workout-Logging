import { expect, test, type Page } from '@playwright/test';

/**
 * Accounts and sync, against the local fake Supabase (real migrations and row level
 * security on PGlite). Every test uses its own email so tests can run in parallel.
 */

const PASSWORD = 'correct-horse-9';
const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up?next=/account');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/:\d+\/account$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Account', exact: true })).toBeVisible();
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page) {
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByText(/^Signed out/)).toBeVisible();
  // Signing out switches databases and redirects away from Account; let that settle before
  // the next full page load, or the two navigations race.
  await page.waitForURL(/\/sign-in/);
  await page.waitForLoadState('networkidle');
}

async function addWeighIn(page: Page, kg: string, { navigate = true } = {}) {
  if (navigate) await page.goto('/body');
  await page
    .getByRole('button', { name: /weigh-in/i })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('radio', { name: 'kg' }).click();
  await page.getByRole('textbox', { name: 'Weight' }).fill(kg);
  await page.getByRole('button', { name: 'Save weigh-in' }).click();
  await expect(page.getByText('Weigh-in saved')).toBeVisible();
}

const syncStatus = (page: Page) => page.getByRole('status', { name: 'Sync status' });

test('account pages are protected and the guest is told data is device-only', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
  await page.goto('/settings');
  await expect(
    page.getByText('Saved on this device').filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Not backed up/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test('sign up starts a clean account that syncs, survives reloads and comes back after sign-in', async ({
  page,
}) => {
  const email = uniqueEmail('new');
  await signUp(page, email);
  await expect(syncStatus(page)).toContainText('Synced to your account');

  // The account starts clean: no demo athlete, no demo pill.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Arjun');
  await expect(page.getByRole('link', { name: 'Demo data' })).toHaveCount(0);
  await page.goto('/settings');
  await expect(page.getByText(/demo data is not available while you are signed in/)).toBeVisible();

  await addWeighIn(page, '81.4');
  await page.goto('/account');
  await expect(syncStatus(page)).toContainText('Synced to your account', { timeout: 15_000 });

  // The session persists across a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Account', exact: true })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Signing out removes the account's local copy (everything was synced) and shows the guest.
  await signOut(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Arjun');

  // Signing back in brings the data back from the server.
  await signIn(page, email);
  await expect(page).toHaveURL(/:\d+\/account$/);
  await page.goto('/body');
  await expect(page.getByRole('button', { name: /81\.4 kg/ }).first()).toBeVisible({
    timeout: 15_000,
  });
});

test('accounts never see each other’s data', async ({ page }) => {
  const first = uniqueEmail('first');
  await signUp(page, first);
  await addWeighIn(page, '93.2');
  await page.goto('/account');
  await expect(syncStatus(page)).toContainText('Synced to your account', { timeout: 15_000 });
  await signOut(page);

  await signUp(page, uniqueEmail('second'));
  await page.goto('/body');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /93\.2 kg/ })).toHaveCount(0);
});

test('sign-in errors are clear and specific', async ({ page }) => {
  const email = uniqueEmail('err');
  await signUp(page, email);
  await signOut(page);
  await signIn(page, email, 'wrong-password-1');
  await expect(page.getByRole('alert')).toHaveText('That email and password do not match.');
});

test('projects that require email confirmation get a check-your-email screen', async ({ page }) => {
  const email = uniqueEmail('x+confirm');
  await page.goto('/sign-up');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await signIn(page, email);
  await expect(page.getByRole('alert')).toContainText('Confirm your email first');
});

test('password reset requests never reveal whether an account exists', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail('nobody'));
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText(/If there is an account for that email/)).toBeVisible();
});

test('device data moves into an account only when the person chooses', async ({ page }) => {
  // Logged without an account: saved on this device only.
  await addWeighIn(page, '77.7');
  await signUp(page, uniqueEmail('import'));

  const card = page.getByRole('region', { name: 'Data on this device' });
  await expect(card).toContainText('1 body weight entry');
  await expect(card).toContainText('Demo data is never added');

  // Nothing was copied before choosing.
  await page.goto('/body');
  await expect(page.getByRole('button', { name: /77\.7 kg/ })).toHaveCount(0);

  await page.goto('/account');
  await card.getByRole('button', { name: 'Add to my account' }).click();
  await expect(page.getByText('Added to your account')).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(syncStatus(page)).toContainText('Synced to your account', { timeout: 15_000 });
  await page.goto('/body');
  await expect(page.getByRole('button', { name: /77\.7 kg/ }).first()).toBeVisible();
});

test('offline changes are saved on the device and only called synced after the server confirms', async ({
  page,
  context,
}) => {
  await signUp(page, uniqueEmail('offline'));
  await expect(syncStatus(page)).toContainText('Synced to your account');

  // Navigate inside the app: the development server has no service worker, so a full page
  // load (or a screen that was never opened) needs the network.
  const go = (path: string) =>
    page.evaluate((p) => {
      history.pushState({}, '', p);
      dispatchEvent(new PopStateEvent('popstate'));
    }, path);
  await go('/body');
  await expect(page.getByRole('heading', { level: 1, name: 'Body metrics' })).toBeVisible();
  await context.setOffline(true);
  await addWeighIn(page, '70.1', { navigate: false });
  await go('/account');
  await expect(syncStatus(page)).toContainText(/Offline|Saved on this device|Could not reach/, {
    timeout: 15_000,
  });
  await expect(syncStatus(page)).toContainText('1 change');
  await expect(syncStatus(page)).not.toContainText('Synced to your account');

  await context.setOffline(false);
  await expect(syncStatus(page)).toContainText('Synced to your account', { timeout: 20_000 });
});
