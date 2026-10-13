import { expect, test } from '@playwright/test';
import { startWithDemo } from './session';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await startWithDemo(page);
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
  // The most recent Push. Its numbers depend on the date the demo was generated, so the test
  // reads them from the screen rather than expecting fixed ones.
  await page.locator('a[href^="/history/"]', { hasText: 'Push' }).first().click();
  const records = page.locator('dt', { hasText: 'Records' }).locator('xpath=following-sibling::dd');
  expect(Number(await records.textContent())).toBeGreaterThanOrEqual(0);

  const ohp = page.getByRole('region', { name: 'Overhead press' });
  const best = async () =>
    Number(
      /1RM ([\d.]+) kg/.exec((await ohp.getByText(/^Best estimated 1RM/).textContent()) ?? '')?.[1],
    );
  const before = await best();
  expect(before).toBeGreaterThan(0);
  const first = ohp.getByRole('button', { name: /^Working set 1: / });
  const name = (await first.getAttribute('aria-label')) ?? '';
  const [, load, reps] = /^Working set 1: ([\d.]+) × (\d+)/.exec(name) ?? [];
  expect(load && reps).toBeTruthy();

  // A heavier set 1 than anything logged: the best estimate must rise to match it.
  const heavier = String(Number(load) + 20);
  await first.click();
  await page.getByRole('textbox', { name: /^Load/ }).fill(heavier);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Set updated')).toBeVisible();
  await expect(
    ohp.getByRole('button', { name: new RegExp(`^Working set 1: ${heavier} × ${reps},`) }),
  ).toBeVisible();
  await expect(async () => expect(await best()).toBeGreaterThan(before)).toPass();
});

test('deleting a workout removes it from history', async ({ page }) => {
  await page.goto('/history');
  const rows = page.locator('a[href^="/history/"]');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  await rows.first().click();
  await page.getByRole('button', { name: 'Workout options' }).click();
  // The options drop from the button as a menu, not a sheet from the bottom.
  await expect(page.getByRole('menu', { name: /^Options for/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('menuitem', { name: /^Delete workout/ }).click();
  await page.getByRole('button', { name: 'Delete workout' }).click();
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

test('a past workout can be started again from its page', async ({ page }) => {
  await page.goto('/history');
  await page.locator('a[href^="/history/"]').first().click();
  await expect(page.getByRole('button', { name: 'Start this workout' })).toBeVisible();
  await expect(page.locator('section[aria-labelledby]').first()).toBeVisible();
  const name = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  const exercises = await page
    .locator('section[aria-labelledby]')
    .getByRole('heading', { level: 2 })
    .allInnerTexts();
  await page.getByRole('button', { name: 'Start this workout' }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  const logged = page.locator('section[aria-labelledby^="ex-"]');
  const expected = exercises.filter((e) => e !== 'Rest');
  await expect(logged).toHaveCount(expected.length);
  await expect(logged.first()).toContainText(expected[0]!);
  // Every set starts empty, ready to log.
  await expect(
    logged
      .first()
      .getByRole('button', { name: /^Mark set \d+ done$/ })
      .first(),
  ).toBeVisible();
});
