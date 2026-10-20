import { expect, test } from '@playwright/test';
import { expireTrial, signUpFresh } from './session';

/** The release announcement: the AI coach, shown once to everyone, selling Pro to free accounts. */

test('the AI coach announcement shows once, sells Pro to free accounts', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'announce' });
  await expireTrial(email);
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Meet your AI coach')).toBeVisible();
  await expect(dialog.getByText('Part of Overload Pro')).toBeVisible();
  await expect(dialog.getByText(/Just ₹\d+ a month/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Get Pro' }).click();
  await expect(page).toHaveURL(/\/pro$/);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});

test('Pro accounts are sent straight to the coach', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce-pro' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('You have Pro, so it is ready now')).toBeVisible();
  await dialog.getByRole('button', { name: 'Ask my coach' }).click();
  await expect(page).toHaveURL(/\/coach$/);
});
