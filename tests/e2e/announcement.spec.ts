import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/** The release announcement: the new name (Macrotrophy) and Macrotrophy AI, in two steps, shown once. */

test('the announcement explains the new name in two steps and opens Food', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Macrotrophy' });
  await expect(dialog.getByText('Overload is now Macrotrophy')).toBeVisible();
  await expect(dialog).toContainText('Your workouts, meals, records, groups and Pro stay exactly');
  await expect(dialog).toContainText('macrotrophy.in');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Your AI has a new name too')).toBeVisible();
  await expect(dialog.locator('[data-release-ai]')).toContainText('AI snap');
  // Back works, then forward again.
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByText('Overload is now Macrotrophy')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Log a meal' }).click();
  await expect(page).toHaveURL(/\/food$/);
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
