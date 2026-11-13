import { expect, test } from '@playwright/test';
import { startWithDemo } from './session';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await startWithDemo(page, { tag: 'badges' });
});

test('a set that beats your best gets a live gold medal', async ({ page }) => {
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await expect(card.getByRole('heading', { name: 'Barbell bench press' })).toBeVisible();
  await card.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('200');
  await card.getByRole('textbox', { name: 'Set 1 reps' }).fill('5');
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  const alert = page.getByRole('status').filter({ hasText: /new record/i });
  await expect(alert).toContainText('Barbell bench press');
  await expect(alert).toContainText('Heaviest load 200 kg');
});

test('badges show what is earned, how close the rest are, and share as a story', async ({
  page,
}) => {
  // In More on phones, in the sidebar on desktop.
  await page.goto('/more');
  await page
    .getByRole('link', { name: 'Badges', exact: true })
    .locator('visible=true')
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Badges' })).toBeVisible();
  await expect(page.locator('[data-badge-collection]')).toContainText(/\d+ of \d+badges collected/);
  await page.getByRole('button', { name: /^Day one, earned/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Day one' });
  await expect(sheet.getByText('Log your first workout.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Share as story card' }).click();
  const share = page.getByRole('dialog', { name: 'Share to your story' });
  await expect(share.getByRole('img')).toHaveAttribute('alt', /Badge card/);
  // A locked badge shows its progress instead.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Living legend, locked/ }).click();
  await expect(
    page.getByRole('dialog', { name: 'Living legend' }).getByText(/ of 1,000$/),
  ).toBeVisible();
});

test('a badge earned in a workout gets its unlock moment once', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('overload.test.unlock', 'on'));
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await expect(card.getByRole('heading', { name: 'Barbell bench press' })).toBeVisible();
  for (const i of [1, 2, 3]) {
    await card.getByRole('textbox', { name: `Set ${i} load in kg` }).fill('200');
    await card.getByRole('textbox', { name: `Set ${i} reps` }).fill('5');
    // The header counts sets done; a tap the record alert swallowed is tapped again.
    const counted = page.getByText(new RegExp(`^${i} of \\d+ sets$`));
    await expect(async () => {
      if (!(await counted.count()))
        await card.getByRole('button', { name: `Mark set ${i} done` }).click();
      await expect(counted).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });
  }
  // The record alert can still be on screen; tap Finish until the sheet opens.
  const save = page.getByRole('button', { name: /^Finish and save/ }).first();
  await expect(async () => {
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await expect(save).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await save.click();

  const unlock = page.locator('[data-badge-unlock]');
  await expect(unlock).toBeVisible();
  await expect(unlock).toContainText(/(Bronze|Silver|Gold|Legend) badge unlocked/);
  const url = page.url();
  // Every new badge in turn, then it is gone, and it never comes back for this workout.
  for (let i = 0; i < 12 && (await unlock.count()); i++)
    await page.locator('[data-unlock-next]').click();
  await expect(unlock).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /done$/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /done$/ })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(unlock).toHaveCount(0);
  expect(page.url()).toBe(url);
});
