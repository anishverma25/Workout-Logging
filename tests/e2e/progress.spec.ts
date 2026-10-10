import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page.locator('#today-title')).toBeVisible();
});

test('progress: ranges and exercise filter scope the whole page', async ({ page }) => {
  // Long ranges are part of Pro; preview them with the development-only access state.
  await page.evaluate(() => sessionStorage.setItem('overload.dev.entitlement', 'pro'));
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toBeVisible();
  const workouts = page
    .locator('dt', { hasText: 'Workouts' })
    .locator('xpath=following-sibling::dd[1]');
  const month = Number(await workouts.textContent());

  await page.getByRole('radio', { name: '7 days' }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect.poll(async () => Number(await workouts.textContent())).toBeLessThan(month);

  await page.getByRole('radio', { name: 'All time' }).click();
  await expect.poll(async () => Number(await workouts.textContent())).toBeGreaterThanOrEqual(month);

  await page.getByRole('button', { name: /^Exercise/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Overhead press/ })
    .click();
  await expect(page.getByRole('button', { name: /^Exercise: Overhead press/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Estimated 1RM for Overhead press/ })).toBeVisible();
  // The choice survives a reload because it lives in the URL.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Exercise: Overhead press/ })).toBeVisible();
});

test('progress: every chart has a table view and insights state their basis', async ({ page }) => {
  await page.goto('/progress?range=30d');
  await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toBeVisible();
  const tables = page.getByText('Show as table');
  await expect(tables.first()).toBeVisible();
  expect(await tables.count()).toBeGreaterThanOrEqual(6);
  // The whole summary row is the control (its touch area covers the label text).
  await page.locator('summary', { hasText: 'Show as table' }).first().click();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  // Adherence is a stat, worded like Home's (D7): "4 of 5 planned, last 30 days".
  await expect(page.getByText(/\d+ of \d+ planned, last 30 days/)).toBeVisible();
});

test('the science page explains each number with typeset formulas and sources', async ({
  page,
}) => {
  await page.goto('/progress');
  await page.getByRole('link', { name: /How every number is calculated/ }).click();
  await expect(page).toHaveURL(/\/science$/);
  for (const name of [
    'Estimated 1RM',
    'Relative strength',
    'Hard sets per muscle',
    'Volume load',
    'Adherence',
    'Body weight trend',
    'Protein',
    'Recovery',
  ]) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  // Formulas are typeset with KaTeX and read out in words.
  const e1rm = page.locator('#e1rm');
  await expect(e1rm.locator('.katex').first()).toBeVisible();
  await expect(e1rm.getByRole('math').first()).toHaveAttribute('aria-label', /30/);
  await expect(
    e1rm.getByRole('link', { name: /doi\.org\/10\.1007\/s40279-023-01937-7/ }),
  ).toBeVisible();

  // Each Progress section links straight to its explanation.
  await page.goto('/progress');
  await page.getByRole('link', { name: 'About strength', exact: true }).click();
  await expect(page).toHaveURL(/\/science#e1rm$/);
  await expect(page.locator('#e1rm')).toBeInViewport();

  // The old address still works.
  await page.goto('/progress/methodology#protein');
  await expect(page).toHaveURL(/\/science#protein$/);
});

test('progress shows an honest empty state without data', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear demo data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear demo data' }).click();
  await expect(page.getByText('Demo data cleared')).toBeVisible();
  await page.goto('/progress');
  await expect(
    page.getByRole('heading', { name: 'Your progress starts with your first workout' }),
  ).toBeVisible();
});
