import { expect, test } from '@playwright/test';
import { expireTrial, signUpFresh } from './session';

/** The release announcement: food logging, shown once to everyone, selling Pro to free accounts. */

test('the food announcement shows once and sells Pro to free accounts', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'announce' });
  await expireTrial(email);
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Food logging is here')).toBeVisible();
  await expect(dialog.getByText('Pro goes further')).toBeVisible();
  await expect(dialog.getByText(/Just ₹\d+ a month/)).toBeVisible();
  await dialog.getByRole('button', { name: 'See Pro' }).click();
  await expect(page).toHaveURL(/\/pro$/);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});

test('the announcement leads to logging the first meal', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce-pro' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('You have Pro, so you also get')).toBeVisible();
  await dialog.getByRole('button', { name: 'Log my first meal' }).click();
  await expect(page).toHaveURL(/\/food$/);
});
