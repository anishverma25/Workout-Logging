import { expect, test } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * The release walkthrough (the Macrotrophy Brain): seven parts, each with a drawing, shown once
 * after the update, and kept on the "What is new" page.
 */

const TITLES = [
  'Macrotrophy now learns you',
  'Your week and next week',
  'Exams, travel, fasts and pain',
  'Eat next, meal plans and menus',
  'Log a set by saying it',
  'A Now card, and an AI that remembers',
  'Duels and Wrapped',
];

test('the walkthrough explains every part of the release and opens the weekly review', async ({
  page,
}) => {
  await signUpFresh(page, { tag: 'announce' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Macrotrophy' });
  for (const [i, title] of TITLES.entries()) {
    await expect(dialog.getByText(title, { exact: true })).toBeVisible();
    // Every part has its drawing, says who gets it, and fits the screen without side scroll.
    await expect(dialog.getByRole('img')).toBeVisible();
    await expect(dialog.locator('[data-release-plan]')).not.toBeEmpty();
    const over = await dialog.evaluate((el) => {
      const body = el.querySelector('[data-sheet-body]') ?? el;
      return body.scrollWidth - body.clientWidth;
    });
    expect(over).toBeLessThanOrEqual(1);
    if (i < TITLES.length - 1) await dialog.getByRole('button', { name: 'Next' }).click();
  }
  await dialog.getByRole('button', { name: 'See your week' }).click();
  await expect(page).toHaveURL(/\/report$/);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'New in Macrotrophy' })).toHaveCount(0);
});

test('Later closes it for good, and it stays readable from More', async ({ page }) => {
  await signUpFresh(page, { tag: 'announce-later' });
  await page.evaluate(() => localStorage.removeItem('overload.whatsNew'));
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New in Macrotrophy' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Later' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).first()).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'New in Macrotrophy' })).toHaveCount(0);

  await page.goto('/more');
  await page.getByRole('link', { name: 'What is new' }).first().click();
  const all = page.locator('[data-whats-new-page]');
  for (const title of TITLES) await expect(all.getByRole('heading', { name: title })).toBeVisible();
  await expect(all.getByRole('img')).toHaveCount(TITLES.length);
});
