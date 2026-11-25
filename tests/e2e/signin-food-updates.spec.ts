import { expect, test, type Page } from '@playwright/test';
import { expireTrial, PASSWORD, signUpFresh, startWithDemo, uniqueEmail } from './session';

/**
 * November 2026 batch: email codes instead of links (with a spam hint and a resend), Continue
 * with Google behind the owner's switch, protein on logged foods for Pro, suggesting a food
 * saved earlier, last time's RIR in the logger and a red Remove set.
 */

const FAKE = 'http://localhost:54329';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

async function lastCode(email: string): Promise<string> {
  const res = await fetch(`${FAKE}/__test/last-code?email=${encodeURIComponent(email)}`);
  expect(res.ok).toBe(true);
  return ((await res.json()) as { code: string }).code;
}

async function signUpWithConfirmation(page: Page, email: string) {
  await page.goto('/sign-up?next=/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('[data-code-entry="signup"]')).toBeVisible();
}

test('a new account is confirmed with a 6-digit code, with a spam hint and a resend', async ({
  page,
}) => {
  // As in production: email confirmation on (the fake does this for +confirm addresses).
  const email = uniqueEmail('code+confirm');
  await signUpWithConfirmation(page, email);
  const entry = page.locator('[data-code-entry="signup"]');
  await expect(entry).toContainText('We sent a 6-digit code to');
  await expect(page.locator('[data-spam-hint]')).toContainText('Spam, Junk or Promotions');
  await expect(page.locator('[data-spam-hint]')).toContainText('no-reply@macrotrophy.in');
  // Resend waits a minute, as Supabase does.
  await expect(page.locator('[data-resend-code]')).toBeDisabled();
  await expect(page.locator('[data-resend-code]')).toContainText(/Send a new code in \d+ s/);

  // A wrong code says so plainly; the right one confirms, signs in and opens setup.
  await page.getByLabel('Code').fill('000000');
  await page.getByRole('button', { name: 'Confirm and continue' }).click();
  await expect(page.getByRole('alert')).toContainText('That code is wrong or has expired');
  await page.getByLabel('Code').fill(`Code: ${await lastCode(email)}`);
  await expect(page.getByLabel('Code')).toHaveValue(/^\d{6}$/);
  await page.getByRole('button', { name: 'Confirm and continue' }).click();
  await expect(page).toHaveURL(/\/setup/);
});

test('signing in with a password before confirming offers a new code', async ({ page }) => {
  const email = uniqueEmail('late+confirm');
  await signUpWithConfirmation(page, email);
  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Confirm your email first');
  await page.getByRole('button', { name: 'Send me a code to confirm' }).click();
  await expect(page.locator('[data-code-entry="signup"]')).toBeVisible();
  await page.getByLabel('Code').fill(await lastCode(email));
  await page.getByRole('button', { name: 'Confirm and continue' }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/account');
  await expect(page.getByText(email)).toBeVisible();
});

test('an existing account signs in with an emailed code, no password', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'codein' });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/sign-in/);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Use an email code instead' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.locator('[data-code-entry="signin"]')).toBeVisible();
  await page.getByLabel('Code').fill(await lastCode(email));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/account');
  await expect(page.getByText(email)).toBeVisible();

  // An email with no account is told to create one.
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/sign-in/);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Use an email code instead' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail('nobody'));
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('alert')).toContainText('There is no account with this email yet');
});

test('Continue with Google shows only once switched on, and a new account goes to setup', async ({
  page,
}) => {
  await fetch(`${FAKE}/__test/flags`, {
    method: 'POST',
    body: JSON.stringify({ google_sign_in: false }),
  });
  await page.goto('/sign-in');
  await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);

  await fetch(`${FAKE}/__test/flags`, {
    method: 'POST',
    body: JSON.stringify({ google_sign_in: true }),
  });
  try {
    await page.goto('/sign-up');
    const google = page.getByRole('button', { name: 'Continue with Google' });
    await expect(google).toBeVisible();
    await google.click();
    // Back from (the stand-in for) Google, signed in: a brand new account opens setup.
    await expect(page).toHaveURL(/\/setup/);
    await page.goto('/account');
    await expect(page.getByText(/google-.*@example\.com/)).toBeVisible();
  } finally {
    await fetch(`${FAKE}/__test/flags`, {
      method: 'POST',
      body: JSON.stringify({ google_sign_in: false }),
    });
  }
});

/** Logs one food into lunch from search. */
async function logLunch(page: Page, query: string) {
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Lunch' }).click();
  await sheet.getByRole('searchbox').fill(query);
  await sheet.locator('[data-food-results] [data-food-row]').first().click();
  await sheet.locator('[data-profile-action]').click();
  await sheet.locator('[data-log-plate]').click();
  await expect(page.locator('[data-meal="lunch"]')).toContainText(/Dal/i);
}

test('logged foods show their protein to Pro and trial members, never to free ones', async ({
  page,
}) => {
  const email = await signUpFresh(page, { tag: 'food-protein' });
  await logLunch(page, 'daal');
  // On the trial: each row has its protein.
  const row = page.locator('[data-meal="lunch"] [data-row-protein]').first();
  await expect(row).toBeVisible();
  await expect(row).toHaveText(/^\d+(\.\d)? g protein$/);
  // And each meal shows its carbs, fat and protein in grams, like MyFitnessPal.
  await expect(page.locator('[data-meal-macros="lunch"]')).toHaveText(
    /C\s*\d+ g\s*F\s*\d+ g\s*P\s*\d+ g/,
  );

  await expireTrial(email);
  await page.reload();
  await expect(page.locator('[data-meal="lunch"]')).toContainText(/Dal/i);
  await expect(page.locator('[data-meal="lunch"]')).toContainText('kcal');
  await expect(page.locator('[data-meal="lunch"] [data-row-protein]')).toHaveCount(0);
  // Free: no meal macros and no day macro numbers anywhere on the page, not even hidden.
  await expect(page.locator('[data-meal-macros]')).toHaveCount(0);
  await expect(page.locator('[data-macro-bars]')).toHaveCount(0);
});

test('a food saved earlier can be suggested for everyone from Food settings', async ({ page }) => {
  const name = `Whey bar ${Date.now().toString(36)}`;
  await signUpFresh(page, { at: '/food', tag: 'food-later' });
  await page.locator('[data-add-food]').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add your own food or family recipe' })
    .click();
  const form = page.getByRole('dialog', { name: 'Add your own' });
  await form.getByRole('radio', { name: 'From a label' }).click();
  await form.getByLabel('Name').fill(name);
  await form.getByLabel('One serving', { exact: true }).fill('60');
  await form.getByLabel('Calories').fill('240');
  await form.getByLabel('Protein').fill('20');
  // Kept to themselves when saved.
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toHaveCount(0);

  await page.goto('/food');
  await page.getByRole('button', { name: /^Food settings/ }).click();
  const settings = page.getByRole('dialog', { name: 'Food settings' });
  await settings.getByRole('button', { name: `Suggest ${name} for everyone` }).click();
  await expect(
    page.getByText(`Sent ${name} for a check before it is added for everyone.`),
  ).toBeVisible();
  // Sending it twice is answered plainly, not as an error.
  await settings.getByRole('button', { name: `Suggest ${name} for everyone` }).click();
  await expect(
    page.getByText('A food with this name is already suggested or shared.'),
  ).toBeVisible();
});

test('the logger shows last time RIR, and Remove set is red', async ({ page }) => {
  await startWithDemo(page);
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  // The demo logs RIR on every working set: last time's shows under its load and reps.
  await expect(card.locator('[data-previous-effort]').first()).toHaveText(/^RIR \d+(\.\d)?$/);
  await expect(card.locator('[data-previous-set]').first()).toHaveAttribute(
    'aria-label',
    /Last time .*, RIR \d/,
  );
  const remove = card.locator('[data-remove-set]');
  await expect(remove).toBeVisible();
  const colour = await remove.evaluate((el) => getComputedStyle(el).color);
  const danger = await remove.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--danger-text').trim(),
  );
  // #ff6b5e is rgb(255, 107, 94).
  expect(danger.toLowerCase()).toBe('#ff6b5e');
  expect(colour).toBe('rgb(255, 107, 94)');
});
