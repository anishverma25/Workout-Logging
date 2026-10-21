import { expect, test, type Page } from '@playwright/test';
import { expireTrial, signUpFresh, startWithDemo } from './session';

/**
 * Food logging for Indian meals: the Food tab, a thali built by tapping foods, katori portions
 * and oil levels, edits with undo, family recipes, and what Pro adds (typing a meal, protein
 * help, the Food section on Progress). Every number comes from the food library.
 */

async function openFood(page: Page) {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Food' })
    .first()
    .click();
  await expect(page.locator('[data-food-page]')).toBeVisible();
}

async function addFromSearch(page: Page, query: string) {
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox').fill(query);
  await sheet.locator('[data-food-results] li').first().click();
}

test('a new account logs a thali by the katori, edits it and undoes a delete', async ({ page }) => {
  await signUpFresh(page, { tag: 'food-free' });
  await page.goto('/food');
  await expect(page.locator('[data-food-page]')).toBeVisible();

  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Lunch' }).click();
  await addFromSearch(page, 'daal');
  await addFromSearch(page, 'chapati');
  const plate = sheet.locator('[data-plate]');
  await expect(plate).toContainText('1 katori dal tadka');
  await expect(plate).toContainText('2 rotis');
  // 1 katori of dal tadka (139 kcal) and 2 rotis (204 kcal).
  await expect(plate).toContainText('343 kcal');
  await sheet.locator('[data-log-plate]').click();

  const lunch = page.locator('[data-meal="lunch"]');
  await expect(lunch).toContainText('Dal tadka');
  await expect(lunch).toContainText('Roti');
  await expect(page.locator('[data-day-totals]')).toContainText('343');

  // Rich oil adds fat only.
  await lunch.getByRole('button', { name: /Dal tadka/ }).click();
  const edit = page.getByRole('dialog');
  await edit.getByRole('radio', { name: 'Rich' }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(lunch).toContainText('rich oil');

  // Delete, then undo.
  await lunch.getByRole('button', { name: /Roti/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(lunch.getByRole('button', { name: /Roti/ })).toHaveCount(0);
  await page
    .locator('[aria-live="polite"] > div')
    .filter({ hasText: 'Removed Roti' })
    .getByRole('button', { name: 'Undo' })
    .click();
  await expect(lunch.getByRole('button', { name: /Roti/ })).toBeVisible();
});

test('a family recipe is made once and each person logs a share', async ({ page }) => {
  await signUpFresh(page, { tag: 'food-recipe' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add your own food or family recipe' })
    .click();
  const form = page.getByRole('dialog', { name: 'Add your own' });
  await form.getByLabel('Name').fill('Mum rajma');
  for (const [name, grams] of [
    ['Kidney beans', '200'],
    ['Onion', '100'],
    ['Cooking oil', '30'],
  ] as const) {
    await form.getByRole('searchbox').fill(name.split(' ')[0]!);
    await form
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .first()
      .click();
    await form.getByRole('textbox', { name: new RegExp(`^${name}`) }).fill(grams);
  }
  await form.getByRole('textbox', { name: /Cooked weight/ }).fill('1000');
  await expect(form).toContainText('One share, 250 g');
  await form.getByRole('button', { name: 'Save' }).click();

  await page.locator('[data-add-food]').click();
  await addFromSearch(page, 'mum rajma');
  await expect(page.getByRole('dialog').locator('[data-plate]')).toContainText('1 share');
  await page.getByRole('dialog').locator('[data-log-plate]').click();
  await expect(page.locator('[data-food-page]')).toContainText('Mum rajma');
});

test('free accounts see what Pro adds to food', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'food-locked' });
  await expireTrial(email);
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  await expect(page.getByRole('dialog').locator('[data-type-meal]')).toContainText('Pro');
});

test('Pro types a whole meal, gets protein help and sees food on Progress', async ({ page }) => {
  await startWithDemo(page, { tag: 'food-pro' });
  await openFood(page);

  // The demo athlete's usual breakfast is one tap.
  await page.locator('[data-usual="breakfast"]').getByRole('button', { name: 'Log' }).click();
  await expect(page.locator('[data-meal="breakfast"]')).toContainText('Poha');

  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Dinner' }).click();
  await sheet.locator('[data-type-meal]').click();
  await sheet.getByRole('textbox').fill('3 roti, 1 katori rajma aur pizza');
  await expect(sheet).toContainText('Not in the library: pizza');
  await sheet.getByRole('button', { name: 'Put on my plate' }).click();
  await expect(sheet.locator('[data-plate]')).toContainText('3 rotis');
  await sheet.locator('[data-log-plate]').click();
  await expect(page.locator('[data-meal="dinner"]')).toContainText('Rajma');

  const help = page.locator('[data-protein-help]');
  await expect(help).toContainText('protein to go');
  await help.getByRole('button', { name: 'Apply' }).first().click();
  await expect(
    page.getByText(/^Logged (Paneer|Curd|Boiled|Chicken|Soya|Milk|Roasted|Moong|Sprouts)/),
  ).toBeVisible();

  await page.goto('/progress');
  const section = page.locator('#nutrition');
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator('[data-nutrition-section]')).toBeVisible();
  await expect(section).toContainText('Real maintenance');
});

test('Home shows food today and the coach brief includes food', async ({ page }) => {
  await startWithDemo(page, { tag: 'food-home' });
  await expect(page.locator('[data-food-card]')).toContainText('Food today');
  await page.goto('/body');
  await expect(page.locator('[data-food-log-block]')).toContainText('From your food log');
});
