import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/** The release announcement: story cards, badges and the weekly report, in three steps, shown once. */

test('the announcement walks through the release in three steps and opens the report', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Macrotrophy' });
  await expect(dialog.getByText('Your workout on your own photo')).toBeVisible();
  await expect(dialog.locator('[data-release-cards]')).toContainText('Seven designs');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Badges got a glow up')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Your week, read for you')).toBeVisible();
  await expect(dialog.locator('[data-release-report]')).toContainText('PDF');
  // The last step can still be closed for later.
  await expect(dialog.getByRole('button', { name: 'Later' })).toBeVisible();
  await dialog.getByRole('button', { name: 'See your weekly report' }).click();
  await expect(page).toHaveURL(/\/report$/);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'New in Macrotrophy' })).toHaveCount(0);
});

test('Later closes the announcement for good', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce-later' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Macrotrophy' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Later' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'New in Macrotrophy' })).toHaveCount(0);
});
