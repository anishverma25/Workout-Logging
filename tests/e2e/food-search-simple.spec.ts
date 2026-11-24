import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/** Quick logging (owner, 24 Nov): "rice" shows a short, simple list; the rest waits. */
test('rice shows the everyday choices first, the long tail behind Show more', async ({ page }) => {
  test.setTimeout(90_000);
  await signUpFresh(page, { tag: 'food-simple' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox').fill('rice');
  const rows = sheet.locator('[data-food-results] [data-food-row]');
  await expect(rows.first()).toContainText('Steamed rice');
  await expect(rows).toHaveCount(8);
  await expect(sheet.getByText(/Rice, white, glutinous/)).toHaveCount(0);

  await sheet.getByRole('searchbox').fill('white rice');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText('White rice (raw)');
});
