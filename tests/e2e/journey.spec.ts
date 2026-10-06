import { expect, test, type Page } from '@playwright/test';

/**
 * The full first-week journey of a new person, in one run, on a fresh account:
 * sign up, plan, train twice, review, track body weight, analyse, Pro states, sign out and in,
 * offline logging and sync. Steps follow the pre-launch audit list.
 */

const PASSWORD = 'correct-horse-9';
const shotsDir = process.env.AUDIT_SHOTS;

async function shot(page: Page, name: string) {
  if (shotsDir)
    await page.screenshot({ path: `${shotsDir}/journey-${test.info().project.name}-${name}.png` });
}

const firstCard = (page: Page) => page.locator('section[aria-labelledby^="ex-"]').first();

async function logBench(page: Page, sets: [string, string][]) {
  const card = firstCard(page);
  await expect(card.getByRole('heading', { name: 'Barbell bench press' })).toBeVisible();
  for (const [i, [kg, reps]] of sets.entries()) {
    await card.getByRole('textbox', { name: `Set ${i + 1} load in kg` }).fill(kg);
    await card.getByRole('textbox', { name: `Set ${i + 1} reps` }).fill(reps);
    await card.getByRole('button', { name: `Mark set ${i + 1} done` }).click();
    await expect(
      card.getByRole('button', { name: `Set ${i + 1} done. Tap to undo.` }),
    ).toBeVisible();
  }
}

async function startPush(page: Page) {
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
}

async function finish(page: Page) {
  await page.getByRole('button', { name: 'Finish' }).click();
  // Unlogged planned sets: keep only what was done.
  const save = page.getByRole('button', { name: /^Finish and save/ });
  await save.first().click();
  await expect(page.getByRole('heading', { name: /done$/ })).toBeVisible();
}

test('a new person’s first week, end to end', async ({ page, context }) => {
  test.setTimeout(240_000);
  page.on('pageerror', (e) => {
    throw e;
  });
  const email = `journey-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

  await test.step('1-4. open, create an account, see a clean Home', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/sign-up?next=/');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Your training starts here' })).toBeVisible();
    await expect(page.getByText(/Arjun/)).toHaveCount(0);
    // Accounts never get demo data; the next step is a routine.
    await expect(page.getByRole('button', { name: 'Load demo data' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pick a routine' })).toBeVisible();
    await shot(page, '04-home-empty');
  });

  await test.step('5. explore exercises', async () => {
    await page.goto('/exercises');
    await page.getByRole('searchbox', { name: 'Search exercises' }).fill('bench');
    await expect(page.getByRole('button', { name: /^Barbell bench press/ })).toBeVisible();
    await page.getByRole('button', { name: /^Barbell bench press/ }).click();
    await expect(page.getByRole('dialog').getByText(/chest/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await shot(page, '05-exercises');
  });

  await test.step('6-7. create a routine from a template and edit it', async () => {
    await page.goto('/routines');
    await expect(page.getByText('No routines yet')).toBeVisible();
    await page
      .getByRole('button', { name: /^(New routine|Create a routine)$/ })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole('button', { name: /^Push Pull Legs 6 days a week/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Push Pull Legs/ })).toBeVisible();
    await page
      .getByRole('button', { name: /Barbell bench press/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Increase sets' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText(/^4 × /).first()).toBeVisible();
    await shot(page, '07-routine');
  });

  await test.step('8-12, 14-17. first workout: log, rest, pause, finish, summary', async () => {
    await startPush(page);
    await expect(firstCard(page).getByText('First time logging this exercise')).toBeVisible();
    await logBench(page, [
      ['60', '8'],
      ['60', '8'],
    ]);
    await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause workout' }).click();
    await expect(page.getByText(/^Paused\./)).toBeVisible();
    await page.getByRole('button', { name: 'Resume workout' }).click();

    // 9. Add an exercise that is not in the plan.
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('searchbox', { name: 'Search exercises' }).fill('pec deck');
    await page.getByRole('button', { name: /^Pec deck/ }).click();
    await page.getByRole('button', { name: 'Add 1 exercise' }).click();
    await expect(page.getByRole('heading', { name: 'Pec deck' })).toBeVisible();
    await shot(page, '12-workout');
    await finish(page);
    await expect(page.getByText('Working sets', { exact: true })).toBeVisible();
    await shot(page, '17-summary-1');
  });

  await test.step('13. second workout shows last time, and a heavier set is a record', async () => {
    await startPush(page);
    const card = firstCard(page);
    await expect(card.getByText(/^Last time/)).toBeVisible();
    await expect(card.getByRole('button', { name: /^Last time 60 × 8/ }).first()).toBeVisible();
    await // Only two sets were done last time, so only two rows show a last time.
    await expect(card.getByRole('button', { name: /^Last time / })).toHaveCount(2);
    await logBench(page, [['65', '8']]);
    await finish(page);
    await expect(page.getByRole('heading', { name: '2 new records' })).toBeVisible();
    await expect(page.getByText('vs earlier today')).toBeVisible();
    await shot(page, '17-summary-2');
  });

  await test.step('18-20. history, the workout itself, records', async () => {
    await page.goto('/history');
    const rows = page.locator('a[href^="/history/"]');
    await expect(rows).toHaveCount(2);
    await rows.first().click();
    await expect(page.getByText('65 kg').first()).toBeVisible();
    await shot(page, '19-detail');
    await page.goto('/records');
    await expect(page.getByText('Barbell bench press').first()).toBeVisible();
    await expect(page.getByText('65 kg').first()).toBeVisible();
    await shot(page, '20-records');
  });

  await test.step('21. body weight', async () => {
    await page.goto('/body');
    await page
      .getByRole('button', { name: /weigh-in/i })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole('radio', { name: 'kg' }).click();
    await page.getByRole('textbox', { name: 'Weight' }).fill('74.2');
    await page.getByRole('button', { name: 'Save weigh-in' }).click();
    await expect(page.getByText('Weigh-in saved')).toBeVisible();
  });

  await test.step('22-25. analytics: ranges, exercise filter, insights', async () => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toBeVisible();
    const workouts = page
      .locator('dt', { hasText: 'Workouts' })
      .locator('xpath=following-sibling::dd[1]');
    await expect(workouts).toHaveText('2');
    await page.getByRole('radio', { name: '7 days' }).click();
    await expect(workouts).toHaveText('2');
    // In the trial, long ranges are open.
    await page.getByRole('radio', { name: 'All time', exact: true }).click();
    await expect(page.locator('[data-pro-lock]')).toHaveCount(0);
    await page.getByRole('button', { name: /^Exercise/ }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Barbell bench press/ })
      .click();
    await expect(
      page.getByRole('img', { name: /Estimated 1RM for Barbell bench press/ }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
    await shot(page, '25-progress');
  });

  await test.step('26-29. Pro page: trial, expired and Pro states', async () => {
    await page.goto('/pro');
    await expect(page.getByRole('heading', { name: /^Free trial: / })).toBeVisible();
    await shot(page, '27-trial');
    for (const [state, heading] of [
      ['trial_expired', 'Your free trial has ended'],
      ['pro', 'Pro is active'],
      ['real', /^Free trial: /],
    ] as const) {
      await page.goto('/settings');
      await page.getByRole('combobox', { name: 'Access state' }).selectOption(state);
      await page.goto('/pro');
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  await test.step('30, 32. sign out and in: everything comes back from the server', async () => {
    await page.goto('/account');
    await expect(page.getByRole('status', { name: 'Sync status' })).toContainText(
      'Synced to your account',
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByText(/^Signed out/)).toBeVisible();
    await page.goto('/sign-in');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.goto('/history');
    await expect(page.locator('a[href^="/history/"]')).toHaveCount(2, { timeout: 15_000 });
    await page.goto('/body');
    await expect(page.getByRole('button', { name: /74\.2 kg/ }).first()).toBeVisible();
  });

  await test.step('31-32. a whole workout offline, then it syncs', async () => {
    await startPush(page);
    await context.setOffline(true);
    await logBench(page, [['67.5', '6']]);
    await finish(page);
    // The summary says where the workout is: on this device, not yet in the account.
    await expect(page.getByRole('status', { name: 'Sync status' })).toContainText(/Offline|Saved/);
    await expect(page.getByRole('status', { name: 'Sync status' })).not.toContainText(
      'Synced to your account',
    );
    await shot(page, '31-offline');
    await context.setOffline(false);
    await expect(page.getByRole('status', { name: 'Sync status' })).toContainText(
      'Synced to your account',
      { timeout: 20_000 },
    );
    await page.goto('/history');
    await expect(page.locator('a[href^="/history/"]')).toHaveCount(3);
  });
});
