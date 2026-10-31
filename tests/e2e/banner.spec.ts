import { expect, test } from '@playwright/test';
import { FAKE_SUPABASE, signUpFresh } from './session';

/**
 * The personal message on Home (a thank you to a milestone user): shown to its own account
 * only, dismissible, gone when the server expires it, and never in the way of Home.
 */

const MESSAGE = 'Thank you for being our 100th user. We are giving you one month of Pro free.';

async function setBanner(email: string, message: string | null, hours = 24) {
  const res = await fetch(`${FAKE_SUPABASE}/__test/banner`, {
    method: 'POST',
    body: JSON.stringify({ email, message, hours }),
  });
  expect(res.ok).toBe(true);
  expect(((await res.json()) as { changed: number }).changed).toBe(1);
}

test.describe('personal message', () => {
  test('shows to its own account and stays dismissed', async ({ page }) => {
    const email = await signUpFresh(page, { tag: 'banner' });
    await page.goto('/');
    await expect(page.getByTestId('user-banner')).toHaveCount(0);

    await setBanner(email, MESSAGE);
    // The app asks the server again when it is reopened.
    await page.reload();
    const banner = page.getByTestId('user-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(MESSAGE);

    await banner.getByRole('button', { name: 'Dismiss message' }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#main')).toBeVisible();
    await expect(page.getByTestId('user-banner')).toHaveCount(0);
  });

  test('a new message shows again after an old one was dismissed, and is plain text', async ({
    page,
  }) => {
    const email = await signUpFresh(page, { tag: 'banner-new' });
    await setBanner(email, MESSAGE);
    await page.goto('/');
    await page.getByTestId('user-banner').getByRole('button', { name: 'Dismiss message' }).click();

    await setBanner(email, '<b>Hello</b> second message');
    await page.reload();
    const banner = page.getByTestId('user-banner');
    await expect(banner).toContainText('<b>Hello</b> second message');
    await expect(banner.locator('b')).toHaveCount(0);
  });

  test('is removed by the server when it expires, and Home still opens', async ({ page }) => {
    const email = await signUpFresh(page, { tag: 'banner-gone' });
    await setBanner(email, MESSAGE, 1);
    await page.goto('/');
    await expect(page.getByTestId('user-banner')).toBeVisible();
    await setBanner(email, null);
    await page.reload();
    await expect(page.locator('#main')).toBeVisible();
    await expect(page.getByTestId('user-banner')).toHaveCount(0);
  });
});
