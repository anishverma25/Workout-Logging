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
  await expect(page.getByText('Overhead press, best set each session.')).toBeVisible();
  await expect(page.getByRole('img', { name: /Estimated 1RM for Overhead press/ })).toBeVisible();
  // The choice survives a reload because it lives in the URL.
  await page.reload();
  await expect(page.getByText('Overhead press, best set each session.')).toBeVisible();
});

test('progress: every chart has a table view and insights state their basis', async ({ page }) => {
  await page.goto('/progress?range=30d');
  await expect(page.getByRole('heading', { name: 'Strength', exact: true })).toBeVisible();
  const tables = page.getByText('Show as table');
  await expect(tables.first()).toBeVisible();
  expect(await tables.count()).toBeGreaterThanOrEqual(6);
  await tables.first().click();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  await expect(page.getByText(/planned sessions/).first()).toBeVisible();
});

test('methodology explains each metric', async ({ page }) => {
  await page.goto('/progress');
  await page.getByRole('link', { name: /How every number here is calculated/ }).click();
  for (const name of [
    'Volume load',
    'Estimated 1RM',
    'Relative strength',
    'Adherence',
    'Sets per muscle group',
    'Body weight',
    'Recovery',
  ]) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('e1RM = load × (1 + reps ÷ 30)', { exact: false })).toBeVisible();
});

test('progress shows an honest empty state without data', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear demo data' }).click();
  await expect(page.getByText('Demo data cleared')).toBeVisible();
  await page.goto('/progress');
  await expect(
    page.getByRole('heading', { name: 'Your progress starts with your first workout' }),
  ).toBeVisible();
});
