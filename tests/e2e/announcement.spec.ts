import { expect, test } from '@playwright/test';
import { expireTrial, signUpFresh } from './session';

/** The release announcement: the fresh look, shown once, selling Pro to free accounts. */

test('the announcement shows once and sells Pro to free accounts', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'announce' });
  await expireTrial(email);
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Cleaner, calmer, quicker.')).toBeVisible();
  await expect(dialog.getByText('OverloadGPT on every tab.')).toBeVisible();
  await expect(
    dialog.getByText(
      /OverloadGPT and the full Progress analysis are part of Pro, from ₹\d+ a month/,
    ),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'See Pro' }).click();
  await expect(page).toHaveURL(/\/pro$/);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});

test('the announcement leads Pro straight to Progress', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce-pro' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Cleaner, calmer, quicker.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Progress' }).click();
  await expect(page).toHaveURL(/\/progress$/);
});
