import { test, expect } from '@playwright/test';
import { expireTrial, startWithDemo } from './session';

/**
 * The Brain and the weekly report are on Home for everyone: a Brain card that opens the plan,
 * and a banner once the week's report can be made, gone for good once it is made.
 */
test('Home: the Brain card opens the plan; the report banner goes once the report is made', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startWithDemo(page, { tag: 'home-brain' });

  const brain = page.locator('[data-brain-home]');
  await expect(brain).toBeVisible({ timeout: 20_000 });
  await expect(brain).toHaveAttribute(
    'aria-label',
    /Macrotrophy Brain: (Learning you · Week \d of \d|Knows you)/,
  );
  if (process.env.PREVIEW_OUT)
    await page.screenshot({ path: `${process.env.PREVIEW_OUT}/home-top.png` });

  const banner = page.locator('[data-report-ready]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Your weekly report is ready');

  await brain.click();
  await expect(page).toHaveURL(/\/brain$/);
  await expect(page.locator('[data-brain-stage]')).toHaveText(/Learning you|It knows you/);
  await expect(page.locator('[data-brain-knows]')).toBeVisible();
  await expect(page.locator('#next-week')).toBeVisible({ timeout: 15_000 });
  if (process.env.PREVIEW_OUT) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${process.env.PREVIEW_OUT}/brain-page.png`, fullPage: true });
  }

  await page.goto('/');
  await banner.locator('[data-report-ready-open]').click();
  await expect(page).toHaveURL(/\/report$/);
  await page.locator('[data-report-make]').click();
  await expect(page.locator('[data-report]')).toBeVisible({ timeout: 20_000 });

  await page.goto('/');
  await expect(brain).toBeVisible();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(brain).toBeVisible();
  await expect(banner).toHaveCount(0);
});

test('Home: free members see the Brain and the report too, and can hide the banner', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const email = await startWithDemo(page, { tag: 'home-brain-free' });
  await expireTrial(email);
  await page.reload();

  const brain = page.locator('[data-brain-home]');
  await expect(brain).toBeVisible({ timeout: 20_000 });
  await brain.click();
  await expect(page).toHaveURL(/\/brain$/);
  await expect(page.locator('[data-brain-stage]')).toBeVisible();
  await expect(page.getByText('This week it read')).toBeVisible();
  await page.goto('/');
  const banner = page.locator('[data-report-ready]');
  await expect(banner).toBeVisible();
  await banner.locator('[data-report-ready-open]').click();
  await expect(page).toHaveURL(/\/report$/);

  await page.goto('/');
  await banner.getByRole('button', { name: 'Hide for this week' }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(brain).toBeVisible();
  await expect(banner).toHaveCount(0);
});
