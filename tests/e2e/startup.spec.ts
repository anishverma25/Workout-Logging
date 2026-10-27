import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * The app must never sit on a blank screen. If it has not opened in a few seconds, the start-up
 * check in index.html shows what is happening and a way out, whatever went wrong.
 */
test('a start-up that never finishes shows the way out, not a black screen', async ({ page }) => {
  await signUpFresh(page, { at: '/', tag: 'stuck-start' });
  // The app's own code never arrives.
  await page.route(/\/src\/main\.tsx/, () => {});
  await page.goto('/', { waitUntil: 'commit' });
  const help = page.locator('#boot-help');
  await expect(help).toBeVisible({ timeout: 15_000 });
  await expect(help).toContainText('taking longer than usual');
  await expect(help.getByRole('button', { name: 'Repair and open' })).toBeVisible();
  await expect(help.getByRole('button', { name: 'Try again' })).toBeVisible();

  // Once the code is back, Try again opens the app.
  await page.unroute(/\/src\/main\.tsx/);
  await help.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#boot-help')).toHaveCount(0);
  await expect(page.locator('#boot')).toHaveCount(0);
});

test('a normal start never shows the start-up help', async ({ page }) => {
  await signUpFresh(page, { at: '/', tag: 'normal-start' });
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
  await page.waitForTimeout(7_000);
  await expect(page.locator('#boot-help')).toHaveCount(0);
});
