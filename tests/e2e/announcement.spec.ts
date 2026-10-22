import { expect, test } from '@playwright/test';
import { expireTrial, signUpFresh } from './session';

/** The release announcement: the all-new food logging, shown once, selling Pro to free accounts. */

test('the food announcement shows once and sells Pro to free accounts', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'announce' });
  await expireTrial(email);
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Snap it. Say it. Logged.')).toBeVisible();
  await expect(dialog.getByText('Snap your plate.')).toBeVisible();
  await expect(
    dialog.getByText(/Photo and AI logging are part of Pro, from ₹\d+ a month/),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'See Pro' }).click();
  await expect(page).toHaveURL(/\/pro$/);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});

test('the announcement leads Pro straight to food logging', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce-pro' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Snap it. Say it. Logged.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Snap my next meal' }).click();
  await expect(page).toHaveURL(/\/food$/);
});
