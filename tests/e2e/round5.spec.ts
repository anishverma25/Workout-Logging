import { expect, test, type Page } from '@playwright/test';
import { expireTrial, signUpFresh, startWithDemo } from './session';

/**
 * Round 5: regional and Amul foods in search, a food that is not in the library leading to
 * OverloadGPT, renaming AI foods, the Smith machine bench angle, and the profile photo.
 */

async function openAddFood(page: Page) {
  await page.goto('/food');
  await expect(page.locator('[data-food-page]')).toBeVisible();
  await page.locator('[data-add-food]').click();
  return page.getByRole('dialog');
}

async function search(page: Page, text: string) {
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox', { name: 'Search food' }).fill(text);
  return sheet;
}

test('regional dishes and Amul packs are found by name and by other names', async ({ page }) => {
  await signUpFresh(page, { tag: 'regional' });
  await openAddFood(page);
  let sheet = await search(page, 'chum chum');
  await expect(sheet.getByText('Cham cham').first()).toBeVisible({ timeout: 15_000 });
  sheet = await search(page, 'amul kool protein');
  await expect(sheet.getByText(/Amul Kool Protein/).first()).toBeVisible({ timeout: 15_000 });
  await expect(sheet.locator('[data-food-not-found]')).toHaveCount(0);
});

test('a food not in the library offers OverloadGPT with the words already typed', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'not-found-pro' });
  await openAddFood(page);
  const sheet = await search(page, 'zqxv mystery dish');
  const none = sheet.locator('[data-food-not-found]');
  await expect(none).toContainText('is not in our foods yet', { timeout: 15_000 });
  await none.getByRole('button', { name: 'Ask OverloadGPT' }).click();
  const turnOn = sheet.getByRole('button', { name: 'Turn on' });
  if (await turnOn.count()) await turnOn.click();
  await expect(sheet.locator('#ai-food')).toHaveValue('zqxv mystery dish');
});

test('free accounts are told OverloadGPT can find a missing food with Pro', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'not-found-free' });
  await expireTrial(email);
  await openAddFood(page);
  const sheet = await search(page, 'zqxv mystery dish');
  const link = sheet.locator('[data-food-not-found]').getByRole('link', {
    name: 'Ask OverloadGPT with Pro',
  });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await link.click();
  await expect(page).toHaveURL(/\/pro$/);
});

test('an AI food can be renamed before logging, and after it is logged', async ({ page }) => {
  await startWithDemo(page, { tag: 'ai-rename' });
  const sheet = await openAddFood(page);
  await sheet.getByRole('radio', { name: 'Dinner' }).click();
  await sheet.locator('[data-type-meal]').click();
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await sheet.locator('#ai-food').fill('200 g paneer bhurji, 30 g protein and 2 roti');
  await sheet.getByRole('button', { name: 'Work it out' }).click();
  const paneer = sheet.locator('[data-ai-result] li', { hasText: 'paneer bhurji' });
  await paneer.locator('[data-rename-ai-item]').click();
  await paneer.getByRole('textbox', { name: 'Name' }).fill('Mum’s paneer bhurji');
  await paneer.locator('[data-save-ai-name]').click();
  await expect(paneer).toContainText('Mum’s paneer bhurji');
  await sheet.getByRole('button', { name: 'Put on my plate' }).click();
  await sheet.locator('[data-log-plate]').click();
  const dinner = page.locator('[data-meal="dinner"]');
  await expect(dinner).toContainText('Mum’s paneer bhurji', { timeout: 10_000 });

  // Logged: the name can still change from the food's edit sheet.
  await dinner.getByText('Mum’s paneer bhurji').click();
  const edit = page.getByRole('dialog');
  await edit
    .locator('[data-food-name] input, input[data-food-name]')
    .first()
    .fill('Paneer bhurji, home');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dinner).toContainText('Paneer bhurji, home', { timeout: 10_000 });
});

test('a Smith machine bench press takes a bench angle in the logger', async ({ page }) => {
  await signUpFresh(page, { at: '/workout', tag: 'smith' });
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('smith machine bench');
  await page.getByRole('button', { name: /^Smith machine bench press/ }).click();
  await page.getByRole('button', { name: 'Add 1 exercise' }).click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await card.getByRole('button', { name: 'Set bench angle' }).click();
  const sheet = page.getByRole('dialog', { name: 'Bench angle' });
  const add = sheet.getByRole('button', { name: 'Add angle' });
  if (await add.count()) await add.click();
  await sheet.getByRole('button', { name: '30°', exact: true }).click();
  await sheet.getByRole('button', { name: /^Save 30° incline/ }).click();
  await expect(card.getByRole('button', { name: 'Bench 30° incline' })).toBeVisible();
});

test('a profile photo is chosen, shown in the header and removed', async ({ page }) => {
  await signUpFresh(page, { at: '/profile', tag: 'photo' });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Fill in a form instead' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Anish Verma');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.locator('[data-photo-picker] [data-avatar="initials"]')).toContainText('AV');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 200;
    const g = c.getContext('2d')!;
    g.fillStyle = '#3a7';
    g.fillRect(0, 0, 320, 200);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  await page.locator('[data-photo-input]').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.locator('[data-photo-picker] [data-avatar="photo"]')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('[data-avatar="photo"]').first()).toBeVisible();
  await page.goto('/profile');
  await page.locator('[data-remove-photo]').click();
  await expect(page.locator('[data-photo-picker] [data-avatar="initials"]')).toBeVisible();
});
