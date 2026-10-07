import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page.locator('#today-title')).toBeVisible();
});

test('routine from a template: rename, add a day and exercise, duplicate, delete', async ({
  page,
}) => {
  await page.goto('/routines');
  await page.getByRole('button', { name: 'New routine' }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /^Upper Lower 4 days a week/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Upper Lower/ })).toBeVisible();

  // Rename
  await page
    .getByRole('button', { name: /Upper Lower/ })
    .first()
    .click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Off-season');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Off-season/ })).toBeVisible();

  // Add a day and an exercise to it
  await page.getByRole('button', { name: 'Add a training day' }).click();
  const day3 = page.locator('section', { has: page.getByRole('heading', { name: 'Day 3' }) });
  await day3.getByRole('button', { name: 'Add exercises' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('face pull');
  await page.getByRole('button', { name: /^Face pull/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  // The picker lives inside the day section; wait for it to close before reading the day.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(day3.getByText('Face pull', { exact: true })).toBeVisible();

  // Duplicate and delete
  await page.getByRole('button', { name: 'Routine options' }).click();
  await page.getByRole('button', { name: 'Duplicate routine' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Off-season \(copy\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Routine options' }).click();
  await page.getByRole('button', { name: 'Delete routine' }).click();
  await page.getByRole('button', { name: 'Delete routine' }).last().click();
  await expect(page).toHaveURL(/\/routines$/);
  await expect(page.getByRole('link', { name: 'Off-season', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Off-season (copy)' })).toHaveCount(0);
});

test('remove an exercise from a day by swiping or long pressing, with undo', async ({ page }) => {
  await page.goto('/routines');
  await page
    .getByRole('link', { name: /Push Pull Legs/ })
    .first()
    .click();
  const push = page.locator('section', { has: page.getByRole('heading', { name: 'Push' }) });
  const row = (name: string) => push.getByRole('button', { name: new RegExp(`^\\d+ ${name}`) });
  await expect(row('Barbell bench press')).toBeVisible();

  // Swipe left, then tap the revealed Delete.
  const box = (await row('Barbell bench press').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width - 20 - i * 20, y + 1);
  await page.mouse.up();
  await push.getByRole('button', { name: 'Delete Barbell bench press' }).click();
  await expect(page.getByText('Barbell bench press removed')).toBeVisible();
  await expect(row('Barbell bench press')).toHaveCount(0);

  // Undo puts it back first in the list.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row('Barbell bench press')).toBeVisible();
  await expect(push.getByRole('listitem').first()).toContainText('Barbell bench press');

  // Press and hold opens the menu; Delete from there.
  const second = (await row('Incline dumbbell press').boundingBox())!;
  await page.mouse.move(second.x + 60, second.y + second.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const menu = page.getByRole('dialog', { name: 'Incline dumbbell press' });
  await expect(menu.getByRole('button', { name: 'Move up' })).toBeVisible();
  await menu.getByRole('button', { name: 'Delete from this day' }).click();
  await expect(row('Incline dumbbell press')).toHaveCount(0);
});

test('custom exercise: create, find, edit, delete', async ({ page }) => {
  await page.goto('/exercises');
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('Landmine press');
  await page.getByRole('button', { name: 'Create “Landmine press”' }).click();
  await page
    .getByRole('dialog')
    .getByRole('radiogroup', { name: 'Primary muscle' })
    .getByRole('radio', { name: 'Shoulders' })
    .click();
  await page.getByRole('button', { name: 'Create exercise' }).click();

  // The new exercise opens straight away, marked as yours.
  await expect(page.getByRole('heading', { name: 'Landmine press' })).toBeVisible();
  await expect(page.getByText('Your exercise', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Half-kneeling landmine press');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Half-kneeling landmine press' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete exercise' }).click();

  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('landmine');
  await expect(page.getByText('Nothing matches those filters.')).toBeVisible();
});
