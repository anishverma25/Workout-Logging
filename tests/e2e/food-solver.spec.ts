import { expect, test } from '@playwright/test';
import { expireTrial, startWithDemo } from './session';

/**
 * The food solver: Eat next on the Food page (free), the weekly meal plan with a grocery list
 * (Pro), and reading a menu (Pro), where the AI gives dish names and the library the numbers.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4UaGBFTEMLQkAUtVaAV8W4QQAAAAASUVORK5CYII=',
  'base64',
);

test('eat next: what is left today and a food added with one tap', async ({ page }) => {
  await startWithDemo(page, { tag: 'eat-next' });
  await page.goto('/food');
  const card = page.locator('[data-eat-next]');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.locator('[data-eat-next-left]')).toContainText(/You have [\d,]+ kcal/);
  const first = card.locator('[data-eat-next-item]').first();
  const name = (await first.locator('p').first().innerText()).trim();
  await expect(first).toContainText(/\d+ kcal · \d+ g protein/);
  await first.locator('[data-eat-next-add]').click();
  await expect(page.getByText(`Logged ${name} to`)).toBeVisible();
  await expect(page.locator('[data-day-totals]')).not.toContainText('0 eaten');
  // It is not suggested again once it is on the plate.
  await expect(card.locator('[data-eat-next-item]').filter({ hasText: name })).toHaveCount(0);
});

test('plan my week: a mess week with room food, kept after a reload, logged with one tap', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await startWithDemo(page, { tag: 'meal-plan' });
  await page.goto('/food');
  await page.locator('[data-plan-week]').click();
  await expect(page).toHaveURL(/\/food\/plan/);
  const plan = page.locator('[data-meal-plan]');
  await plan.getByRole('button', { name: 'Mess' }).click();
  await plan.getByRole('button', { name: 'Tight' }).click();
  await page.locator('[data-meal-plan-make]').click();
  const dayCard = page.locator('[data-meal-plan-day]');
  await expect(dayCard.locator('[data-plan-meal="lunch"]')).toContainText('as served');
  await expect(page.locator('[data-meal-plan-total]')).toContainText(
    /Day total: [\d,]+ kcal · \d+ g protein/,
  );
  await expect(page.locator('[data-grocery]')).toContainText('To keep in your room');
  await expect(page.locator('[data-grocery]')).not.toContainText(/wheat flour/i);

  // Home cooking gives ingredients instead.
  await plan.getByRole('button', { name: 'Home' }).click();
  await page.locator('[data-meal-plan-make]').click();
  await expect(page.locator('[data-grocery]')).toContainText('Grocery list for the week');

  await page.reload();
  await expect(page.locator('[data-grocery]')).toContainText('Grocery list for the week', {
    timeout: 20_000,
  });
  await page.locator('[data-plan-meal="breakfast"] [data-plan-log]').click();
  await expect(page.getByText('Logged breakfast')).toBeVisible();
  await page.goto('/food');
  await expect(page.locator('[data-day-totals]')).not.toContainText('0 eaten');
});

test('read a menu: dish names from the photo, numbers from the library', async ({ page }) => {
  await startWithDemo(page, { tag: 'menu' });
  await page.goto('/food');
  await page.locator('[data-menu-open]').click();
  const sheet = page.getByRole('dialog', { name: 'Read a menu' });
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await sheet
    .locator('[data-menu-input]')
    .setInputFiles({ name: 'menu.png', mimeType: 'image/png', buffer: PNG });
  const results = sheet.locator('[data-menu-results]');
  await expect(results).toBeVisible({ timeout: 15_000 });
  // Prices never come through, a dish the library knows gets its numbers, an unknown one says so.
  await expect(results).not.toContainText('240');
  await expect(results.locator('li').filter({ hasText: 'Dal Tadka' })).toContainText(
    /\d+ kcal · \d+ g protein/,
  );
  await expect(results.locator('[data-menu-dish="unknown"]')).toContainText('Chef Special Zzyx');
  await expect(results.locator('[data-menu-dish="best"]').first()).toContainText(
    'Best for what is left',
  );
});

test('free members see eat next, the plan and the menu as Pro', async ({ page }) => {
  const email = await startWithDemo(page, { tag: 'solver-free' });
  await expireTrial(email);
  await page.goto('/food');
  // Eat next is Pro: free members see how many foods fit, and the card leads to Pro.
  const locked = page.locator('[data-eat-next-locked]');
  await expect(locked).toContainText('With Pro', { timeout: 20_000 });
  await expect(locked).toHaveAttribute('href', '/pro');
  await expect(page.locator('[data-eat-next-item]')).toHaveCount(0);
  await expect(page.locator('[data-menu-open]')).toHaveCount(0);
  await page.goto('/food/plan');
  await expect(page.locator('[data-pro-lock="meal_plan"]')).toBeVisible();
});
