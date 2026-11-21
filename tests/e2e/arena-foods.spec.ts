import { expect, test } from '@playwright/test';
import { signUpFresh, startWithDemo } from './session';

/**
 * November 2026 batch: branded foods with smarter search, a short undo for water, and new
 * pages opening at their top.
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('food search: a brand typed shows that brand, a plain word shows the everyday food', async ({
  page,
}) => {
  await signUpFresh(page, { at: '/food', tag: 'branded' });
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  const box = sheet.getByRole('searchbox');
  const rows = sheet.locator('[data-food-results] [data-food-row]');

  await box.fill('amul paneer');
  await expect(rows.first()).toContainText(/Amul/);
  await expect(rows.first()).toContainText(/paneer/i);

  await box.fill('dairy milk silk');
  await expect(rows.first()).toContainText('Cadbury Dairy Milk Silk');

  await box.fill('mb biozyme');
  await expect(rows.first()).toContainText('Biozyme');

  // A plain word: the everyday food first, and brands wait behind "Show more".
  await box.fill('paneer');
  await expect(rows.first()).toContainText(/^Paneer/);
  const more = sheet.locator('[data-more-results]');
  await expect(more).toBeVisible();
  const before = await rows.count();
  await more.click();
  await expect.poll(() => rows.count()).toBeGreaterThan(before);
  await expect(sheet.locator('[data-food-results]')).toContainText('Amul');
});

test('the water undo goes away after a few seconds, and glasses never stack up', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'water-toast' });
  const add = page.locator('[data-daily-row] [data-home-add-water]');
  await add.click();
  await add.click();
  const toast = page.getByText('Added a glass of water');
  await expect(toast).toHaveCount(1);
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0, { timeout: 7000 });
});

test('a page opened from far down another one starts at its top', async ({ page }) => {
  await signUpFresh(page, { at: '/more', tag: 'top-of-page' });
  await page.setViewportSize({ width: 390, height: 500 });
  await expect(page.getByRole('link', { name: /^Settings/ }).first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page
    .getByRole('link', { name: /^Settings/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // Back returns to where you were.
  await page.goBack();
  await expect(page).toHaveURL(/\/more/);
});
