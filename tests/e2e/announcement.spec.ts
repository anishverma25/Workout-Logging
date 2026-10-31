import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/** The release announcement: 1:1 coaching only, shown once, leading to the coaching page. */

test('the announcement shows once and leads to 1:1 coaching', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Your own coach, inside Overload')).toBeVisible();
  await expect(dialog.getByText('Calls and WhatsApp.')).toBeVisible();
  await expect(dialog.getByText('Pro included.')).toBeVisible();
  await dialog.getByRole('button', { name: 'See 1:1 coaching' }).click();
  await expect(page).toHaveURL(/\/coaching$/);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});

test('Later closes the announcement for good', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce-later' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Later' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});
