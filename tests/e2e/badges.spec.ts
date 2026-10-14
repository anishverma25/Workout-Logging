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
  await expect(page.getByText(/^\d+ of \d+ earned$/)).toBeVisible();
  await page.getByRole('button', { name: /^Day one, earned/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Day one' });
  await expect(sheet.getByText('Log your first workout.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Share to your story' }).click();
  const share = page.getByRole('dialog', { name: 'Share to your story' });
  await expect(share.getByRole('img')).toHaveAttribute('alt', /Badge card/);
  // A locked badge shows its progress instead.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Living legend, locked/ }).click();
  await expect(
    page.getByRole('dialog', { name: 'Living legend' }).getByText(/ of 1,000$/),
  ).toBeVisible();
});

test('the update announcement shows once, with how to reach us', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Medals and badges are here')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'overloadgymofficial@gmail.com' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: '@overloadxgym' })).toBeVisible();
  await dialog.getByRole('button', { name: 'See my badges' }).click();
  await expect(page).toHaveURL(/\/badges$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Badges' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});
