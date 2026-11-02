import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/** The release announcement: groups and leaderboards only, in three steps, shown once. */

test('the announcement explains groups in three steps and opens Groups', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Compete with your gym friends')).toBeVisible();
  await expect(dialog.getByText('Join with a code')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Points for effort, not size')).toBeVisible();
  await expect(dialog.locator('[data-release-points]')).toContainText('+10');
  await expect(dialog.locator('[data-release-points]')).toContainText('protein target');
  // Back works, then forward again.
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByText('Compete with your gym friends')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Pick a username to start')).toBeVisible();
  await expect(dialog).toContainText('Never your weights, food, body weight or workouts');
  await dialog.getByRole('button', { name: 'Open Groups' }).click();
  await expect(page).toHaveURL(/\/groups$/);
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
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'New in Overload' })).toHaveCount(0);
});
