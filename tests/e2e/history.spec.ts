import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page.locator('#today-title')).toBeVisible();
});

test('history filters narrow the timeline and clear again', async ({ page }) => {
  await page.goto('/history');
  const rows = page.locator('a[href^="/history/"]');
  await expect(rows.first()).toBeVisible();
  const total = await rows.count();
  expect(total).toBeGreaterThan(10);

  await page.getByRole('radio', { name: '7 days' }).click();
  const week = await rows.count();
  expect(week).toBeGreaterThan(0);
  expect(week).toBeLessThan(total);

  await page.getByRole('radio', { name: 'All time' }).click();
  await page.getByRole('button', { name: 'Workout', exact: true }).click();
  await page.getByRole('button', { name: /^Legs/ }).click();
  await expect(rows.first()).toContainText('Legs');
  const legs = await rows.count();
  for (let i = 0; i < legs; i++) await expect(rows.nth(i)).toContainText('Legs');

  await page.getByRole('button', { name: 'Clear workout filter' }).click();
  await page.getByRole('button', { name: 'Muscle', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Biceps' }).click();
  // Pull days train biceps; leg days do not.
  await expect(rows.first()).toContainText('Pull');
  expect(await rows.count()).toBeLessThan(total);
});

test('workout detail: correcting a set saves it and recalculates', async ({ page }) => {
  await page.goto('/history');
  // The most recent Push holds an overhead press record: 40 × 8 for an estimated 53.3 kg.
  await page.locator('a[href^="/history/"]', { hasText: 'Push' }).first().click();
  const records = page.locator('dt', { hasText: 'Records' }).locator('xpath=following-sibling::dd');
  const before = Number(await records.textContent());
  expect(before).toBeGreaterThan(0);
  await expect(page.getByText('Best estimated 1RM 53.3 kg.')).toBeVisible();

  await page.getByRole('button', { name: /^Working set 1: 40 × 8,/ }).click();
  await page.getByRole('textbox', { name: 'Reps' }).fill('3');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Set updated')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Working set 1: 40 × 3,/ })).toBeVisible();
  // The best estimate now comes from set 2 (40 × 7 with 1 in reserve), and the totals follow.
  await expect(page.getByText('Best estimated 1RM 53.3 kg.')).toHaveCount(0);
  await expect(page.getByText('Best estimated 1RM 50.7 kg.')).toBeVisible();
});

test('deleting a workout removes it from history', async ({ page }) => {
  await page.goto('/history');
  const rows = page.locator('a[href^="/history/"]');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  await rows.first().click();
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: /^Delete workout/ }).click();
  await page.getByRole('button', { name: 'Delete workout' }).last().click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(rows).toHaveCount(before - 1);
});

test('records page shows actual and estimated bests separately', async ({ page }) => {
  await page.goto('/records');
  await expect(page.getByRole('heading', { name: 'Bests by exercise' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search your exercises' }).fill('bench');
  await page
    .getByRole('button', { name: /Barbell bench press/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Heaviest lifted')).toBeVisible();
  await expect(sheet.getByText('estimate', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Best reps at each load' })).toBeVisible();
  await expect(
    sheet.getByRole('img', { name: /Estimated 1RM for Barbell bench press/ }),
  ).toBeVisible();
});

test('body weight: add in lb, see it in kg, edit and delete', async ({ page }) => {
  await page.goto('/body');
  await page
    .getByRole('button', { name: /Add weigh-in|Weigh-in/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('radio', { name: 'lb' }).click();
  await page.getByRole('textbox', { name: 'Weight' }).fill('150');
  await page.getByRole('button', { name: 'Save weigh-in' }).click();
  await expect(page.getByText('Weigh-in saved')).toBeVisible();
  // 150 lb is 68 kg, shown in the app's unit (kg).
  await expect(page.locator('p', { hasText: /^68\s*kg$/ }).first()).toBeVisible();

  await page.getByRole('button', { name: /68 kg/ }).first().click();
  await page.getByRole('textbox', { name: 'Weight' }).fill('151');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Weigh-in updated')).toBeVisible();

  await page
    .getByRole('button', { name: /68\.5 kg/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete' }).last().click();
  await expect(page.getByText('Weigh-in deleted')).toBeVisible();
  await expect(page.getByRole('button', { name: /68\.5 kg/ })).toHaveCount(0);
});
