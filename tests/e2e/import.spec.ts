import { expect, test } from '@playwright/test';
import { PASSWORD, signUpFresh, uniqueEmail } from './session';

/** Bringing history over from Hevy and Strong, right after sign-up and from More. */

const FIXTURES = 'src/domain/import/fixtures';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('a new account imports from Hevy, checks the matches, and carries on in setup', async ({
  page,
}) => {
  await page.goto('/sign-up');
  await page.getByRole('textbox', { name: 'Email' }).fill(uniqueEmail('hevy'));
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Coming from another app?' })).toBeVisible();
  await page.getByRole('radio', { name: /^Hevy/ }).click();
  await page.getByRole('button', { name: 'Continue with Hevy' }).click();
  await expect(page.getByRole('heading', { name: 'Export from Hevy' })).toBeVisible();
  await page
    .getByLabel('Hevy export file')
    .setInputFiles([`${FIXTURES}/hevy-workouts.csv`, `${FIXTURES}/hevy-measurements.csv`]);

  // Nothing is saved before this screen.
  await expect(page.getByRole('heading', { name: 'Check before importing' })).toBeVisible();
  await expect(page.getByText('workouts', { exact: true })).toBeVisible();
  const list = page.getByRole('list', { name: 'Exercises to import' });
  const bench = list.getByRole('listitem').filter({ hasText: 'Bench Press (Barbell)' });
  await expect(bench.getByRole('combobox')).toHaveValue(/.+/);
  await expect(bench).toContainText('Matched');
  const pullover = list.getByRole('listitem').filter({ hasText: 'Pullover (Dumbbell)' });
  await expect(pullover).toContainText('Your own');
  // The person can say what an unmatched exercise works.
  await pullover.getByLabel('Main muscle').selectOption('chest');

  await page.getByRole('button', { name: 'Import 2 workouts' }).click();
  await expect(page.getByRole('heading', { name: 'Your history is in' })).toBeVisible();
  await expect(page.getByText('2 workouts and 13 sets added')).toBeVisible();
  await page.getByRole('button', { name: 'Continue setting up' }).click();
  await expect(page).toHaveURL(/\/setup/);

  // Imported training is ordinary training everywhere.
  await page.goto('/history');
  await expect(page.getByRole('link', { name: /Upper A/ }).first()).toBeVisible();
  await page.goto('/records');
  await expect(page.getByText('Barbell bench press').first()).toBeVisible();
  await page.goto('/body');
  await expect(page.getByText(/67\.8/).first()).toBeVisible();
});

test('an existing account imports from Strong in pounds, and a second import adds nothing', async ({
  page,
}) => {
  await signUpFresh(page, { at: '/more', tag: 'strong' });
  await page.getByRole('link', { name: 'Import from Hevy or Strong' }).click();
  await expect(page.getByRole('heading', { name: 'Import your training' })).toBeVisible();
  await page.getByRole('radio', { name: /^Strong/ }).click();
  await page.getByRole('button', { name: 'Continue with Strong' }).click();
  await page.getByRole('radio', { name: 'lb' }).click();
  await page.getByLabel('Strong export file').setInputFiles(`${FIXTURES}/strong.csv`);
  await expect(page.getByRole('heading', { name: 'Check before importing' })).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 workouts' }).click();
  await expect(page.getByText('2 workouts and 6 sets added')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/more$/);

  // The same file again: nothing doubled.
  await page.goto('/import?next=/more');
  await page.getByRole('radio', { name: /^Strong/ }).click();
  await page.getByRole('button', { name: 'Continue with Strong' }).click();
  await page.getByRole('radio', { name: 'lb' }).click();
  await page.getByLabel('Strong export file').setInputFiles(`${FIXTURES}/strong.csv`);
  await page.getByRole('button', { name: 'Import 2 workouts' }).click();
  await expect(page.getByRole('heading', { name: 'Already imported' })).toBeVisible();
  await expect(page.getByText('2 workouts already here, left as they were')).toBeVisible();

  // 225 lb is 102.06 kg, and RPE 8.5 is kept as RIR 1.5.
  await page.goto('/history');
  await page
    .getByRole('link', { name: /Evening Workout/ })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: /Working set 1: 102\.06 × 5, RIR 1\.5/ }),
  ).toBeVisible();
});

test('a file from the other app, or not an export at all, is explained', async ({ page }) => {
  await signUpFresh(page, { at: '/import', tag: 'wrongfile' });
  await page.getByRole('radio', { name: /^Strong/ }).click();
  await page.getByRole('button', { name: 'Continue with Strong' }).click();
  await page.getByLabel('Strong export file').setInputFiles(`${FIXTURES}/hevy-workouts.csv`);
  await expect(page.getByText(/That looks like a Hevy export/)).toBeVisible();
  await page.getByLabel('Strong export file').setInputFiles({
    name: 'notes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a,b\n1,2'),
  });
  await expect(page.getByText(/notes\.csv is not a Hevy or Strong export/)).toBeVisible();
});
