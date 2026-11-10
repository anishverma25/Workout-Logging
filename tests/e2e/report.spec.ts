import { expect, test } from '@playwright/test';
import { expireTrial, startWithDemo } from './session';

/**
 * Weekly intelligence (Pro): one report a week, made on the phone and saved once on the server,
 * opened again offline, downloaded as a PDF; free members see what it is and keep past reports.
 */

test('a week gets one report, it opens again offline and downloads as a PDF', async ({ page }) => {
  test.setTimeout(150_000);
  const email = await startWithDemo(page, { tag: 'report' });

  await page.goto('/more');
  await page.getByRole('link', { name: 'Weekly report' }).first().click();
  await expect(page).toHaveURL(/\/report/);

  const make = page.locator('[data-report-make]');
  await expect(make).toBeVisible({ timeout: 20_000 });
  await make.click();
  const report = page.locator('[data-report]');
  await expect(report).toBeVisible();
  await expect(page.locator('[data-report-title]')).toHaveText(/\d+ (to|[A-Z][a-z]{2} to) \d+ [A-Z][a-z]{2}/);
  await expect(page.locator('[data-report-verdict]')).not.toBeEmpty();

  // Hinglish and the full report.
  await page.getByRole('button', { name: 'Hinglish' }).click();
  await expect(page.getByRole('button', { name: 'Hinglish' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Full report' }).click();
  await expect(page.locator('[data-report-section="r-method"]')).toBeVisible();
  // The full report fits a small Galaxy screen without sideways scrolling.
  if (test.info().project.name === 'mobile') {
    await page.setViewportSize({ width: 360, height: 780 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(0);
  }

  // Made once: coming back, and with this phone's copy cleared, there is nothing to make again.
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('overload.reports.')) localStorage.removeItem(k);
  });
  await page.reload();
  await expect(report).toBeVisible({ timeout: 20_000 });
  await expect(make).toHaveCount(0);
  await expect(page.locator('[data-report-generate]')).toHaveCount(0);

  // Offline, the copy kept on the phone still opens (screens already loaded, as the installed
  // app has them all precached).
  await page.goto('/more');
  await page.getByRole('link', { name: 'Weekly report' }).first().click();
  await expect(report).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'More' }).first().click();
  await page.context().setOffline(true);
  await page.getByRole('link', { name: 'Weekly report' }).first().click();
  await expect(report).toBeVisible();
  await page.context().setOffline(false);

  // Download the PDF.
  await page.locator('[data-report-download]').click();
  const sheet = page.getByRole('dialog', { name: 'Download your report' });
  await sheet.getByRole('radio', { name: 'Quick summary' }).click();
  const download = page.waitForEvent('download');
  await sheet.locator('[data-report-save-pdf]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^macrotrophy-report-\d{4}-\d{2}-\d{2}-quick\.pdf$/);
  const path = await file.path();
  const { readFileSync } = await import('node:fs');
  const head = readFileSync(path!).subarray(0, 5).toString();
  expect(head).toBe('%PDF-');

  // After Pro ends, the report stays readable and nothing new can be made.
  await expireTrial(email);
  await page.reload();
  await expect(report).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-pro-lock="weekly_report"]')).toBeVisible();
  await expect(make).toHaveCount(0);
});

test('a free member sees what the report is, from their own counts', async ({ page }) => {
  const email = await startWithDemo(page, { tag: 'report-free' });
  await expireTrial(email);
  await page.goto('/report');
  const lock = page.locator('[data-pro-lock="weekly_report"]');
  await expect(lock).toBeVisible({ timeout: 20_000 });
  await expect(lock).toContainText(/\d+ workouts and \d+ food days are ready to be read together/);
  await expect(page.locator('[data-report-make]')).toHaveCount(0);
});
