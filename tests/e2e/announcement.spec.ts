import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/** The release announcement: leaderboards (global and groups) only, in three steps, shown once. */

test('the announcement explains leaderboards in three steps and opens the global board', async ({
  page,
}) => {
  await signUpFresh(page, { tag: 'announce' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Overload' });
  await expect(dialog.getByText('Compete with all of Overload and your friends')).toBeVisible();
  await expect(dialog.getByText('Global leaderboard.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Points for effort, not size')).toBeVisible();
  await expect(dialog.locator('[data-release-points]')).toContainText('+10');
  await expect(dialog.locator('[data-release-points]')).toContainText('protein target');
  // Back works, then forward again.
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByText('Compete with all of Overload and your friends')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('Your name, your choice')).toBeVisible();
  await expect(dialog).toContainText('Your username shows only if you turn it on');
  await expect(dialog).toContainText('Never your weights, food, body weight or workouts');
  await dialog.getByRole('button', { name: 'See the leaderboard' }).click();
  await expect(page).toHaveURL(/\/groups\/global$/);
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
