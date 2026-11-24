import { expect, test } from '@playwright/test';
import { startWithDemo } from './session';

// Ready to train (Overview) and Training quality (Strength), from the demo history.
test('progress shows ready to train and training quality', async ({ page }) => {
  await startWithDemo(page, { tag: 'quality' });
  await page.goto('/progress?view=overview&range=30d');
  const ready = page.locator('[data-ready-section]');
  await expect(ready.getByRole('heading', { name: 'Ready to train' })).toBeVisible();
  await expect(ready.locator('[data-ready-status]')).toHaveCount(3);
  await expect(ready.locator('[data-mini-body="both"]')).toBeVisible();

  await page.goto('/progress?view=strength&range=90d');
  const quality = page.locator('[data-quality-section]');
  await expect(quality.getByRole('heading', { name: 'Training quality' })).toBeVisible();
  for (const card of ['fatigue', 'effort', 'ranges'])
    await expect(quality.locator(`[data-quality="${card}"]`)).toBeVisible();
  // Rep range shares are whole numbers adding up to 100.
  const shares = await quality.locator('[data-quality="ranges"] dd').allInnerTexts();
  expect(shares.reduce((n, s) => n + Number(s.replace('%', '')), 0)).toBe(100);
  // No section leaves the page wider than the screen.
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wide).toBe(false);
});
