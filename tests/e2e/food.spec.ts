import { expect, test, type Page } from '@playwright/test';
import { expireTrial, signUpFresh, startWithDemo } from './session';

/**
 * Food logging for Indian meals: the Food tab, a thali built by tapping foods, katori portions
 * and oil levels, edits with undo, family recipes, and what Pro adds (AI food logging, protein
 * help, the Food section on Progress).
 */

async function openFood(page: Page) {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Food' })
    .first()
    .click();
  await expect(page.locator('[data-food-page]')).toBeVisible();
}

/** Searches, opens the food's profile and adds it at its usual portion. */
async function addFromSearch(page: Page, query: string) {
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox').fill(query);
  await sheet.locator('[data-food-results] [data-food-row]').first().click();
  await expect(sheet.locator('[data-food-profile]')).toBeVisible();
  await sheet.locator('[data-profile-action]').click();
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

test('Pro tells OverloadGPT a meal and sees food on Progress', async ({ page }) => {
  await startWithDemo(page, { tag: 'food-pro' });
  await openFood(page);

  // The demo athlete's usual breakfast is one tap.
  await page.locator('[data-usual="breakfast"]').getByRole('button', { name: 'Log' }).click();
  await expect(page.locator('[data-meal="breakfast"]')).toContainText('Poha');

  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Dinner' }).click();
  await sheet.locator('[data-type-meal]').click();
  // Asked once per phone before anything is sent.
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await sheet.getByRole('textbox').fill('3 roti, 1 katori rajma aur Domino pizza #food-down');
  await sheet.getByRole('button', { name: 'Work it out' }).click();
  // The AI is down: the library fills what it knows.
  await expect(sheet.locator('[data-ai-result]')).toContainText('could not be reached');
  await expect(sheet.locator('[data-ai-result]')).toContainText('Not in the library');
  await sheet.getByRole('textbox').fill('3 roti, 1 katori rajma aur Domino pizza');
  await sheet.getByRole('button', { name: 'Ask again' }).click();
  const result = sheet.locator('[data-ai-result]');
  await expect(result).toContainText('Domino pizza');
  await expect(result).toContainText('Estimated');
  await expect(result).toContainText('Library');
  await sheet.getByRole('button', { name: 'Put on my plate' }).click();
  await expect(sheet.locator('[data-plate]')).toContainText('3 rotis');
  await sheet.locator('[data-log-plate]').click();
  const dinner = page.locator('[data-meal="dinner"]');
  await expect(dinner).toContainText('Roti');
  await expect(dinner).toContainText('Domino pizza');

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

test('Pro snaps a plate: foods from the photo, library values where known, then logged', async ({
  page,
}) => {
  await signUpFresh(page, { tag: 'food-photo' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Lunch' }).click();
  await sheet.locator('[data-photo-meal]').click();
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  // A small real image; the stand-in AI answers the same for every photo.
  await sheet.locator('[data-photo-input]').setInputFiles({
    name: 'thali.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4UaGBFTEMLQkAUtVaAV8W4QQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(sheet.getByRole('img', { name: 'Your food' })).toBeVisible();
  await sheet.getByRole('textbox').fill('home made');
  await sheet.getByRole('button', { name: 'Work it out' }).click();
  const result = sheet.locator('[data-ai-result]');
  await expect(result).toContainText('Roti');
  await expect(result).toContainText('Library');
  await expect(result).toContainText('Mango pickle');
  await expect(result).toContainText('From the photo');
  await expect(result.locator('[data-confidence="low"]')).toContainText('Not sure about this one');
  await expect(sheet.locator('[data-photos-left]')).toContainText('14 photos left today');
  await sheet.getByRole('button', { name: 'Put on my plate' }).click();
  await expect(sheet.locator('[data-plate]')).toContainText('2 rotis');
  await sheet.locator('[data-log-plate]').click();
  const lunch = page.locator('[data-meal="lunch"]');
  await expect(lunch).toContainText('Roti');
  await expect(lunch).toContainText('Mango pickle');
});

test('free accounts see photo logging as part of Pro', async ({ page }) => {
  const email = await signUpFresh(page, { tag: 'food-photo-free' });
  await expireTrial(email);
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const hero = page.getByRole('dialog').locator('[data-type-meal]');
  await expect(hero).toContainText('Snap a photo');
  await expect(hero).toContainText('Pro');
  await expect(page.getByRole('dialog').locator('[data-photo-meal]')).toHaveCount(0);
});

test('tapping a food opens its profile: nutrients, then the amount, then the plate', async ({
  page,
}) => {
  await signUpFresh(page, { tag: 'food-profile' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox').fill('chapati');
  await sheet.locator('[data-food-results] [data-food-row]').first().click();
  const profile = sheet.locator('[data-food-profile]');
  await expect(profile.locator('[data-nutrition-panel]')).toContainText('Protein');
  await expect(profile.locator('[data-nutrition-panel]')).toContainText('Per 100 g');
  // 2 rotis are 204 kcal; a third makes 306.
  await expect(profile.locator('[data-portion-kcal]')).toHaveText('204');
  await profile.getByRole('button', { name: /^Increase/ }).click();
  await expect(profile.locator('[data-portion-kcal]')).toHaveText('306');
  await sheet.locator('[data-profile-action]').click();
  await expect(sheet.locator('[data-plate]')).toContainText('3 rotis');
  // The plus button still adds in one tap.
  await sheet.getByRole('searchbox').fill('daal');
  await sheet.locator('[data-food-results] [data-quick-add]').first().click();
  await expect(sheet.locator('[data-plate]')).toContainText('dal tadka');
});

test("a meal's + logs to that meal only, in a steady sheet that holds the page still", async ({
  page,
}) => {
  await signUpFresh(page, { tag: 'food-meal-lock' });
  await page.goto('/food');
  await page.getByRole('button', { name: 'Add food to breakfast' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Add to breakfast' })).toBeVisible();
  await expect(sheet.getByRole('radio', { name: 'Lunch' })).toHaveCount(0);
  // The page behind does not scroll while the sheet is open.
  expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
  // Typing does not change the sheet's size.
  // Layout height (offsetHeight ignores the opening scale animation).
  const height = () => sheet.evaluate((el) => (el as HTMLElement).offsetHeight);
  const before = await height();
  await sheet.getByRole('searchbox').fill('poha');
  await expect(sheet.locator('[data-food-results]')).toBeVisible();
  expect(await height()).toBe(before);
  await sheet.locator('[data-food-results] [data-quick-add]').first().click();
  await sheet.locator('[data-log-plate]').click();
  await expect(page.locator('[data-meal="breakfast"]')).toContainText('Poha');
  expect(await page.evaluate(() => document.body.style.position)).toBe('');
});

test('Pro gets the day analysed against published ranges', async ({ page }) => {
  await startWithDemo(page, { tag: 'food-analysis' });
  await openFood(page);
  await page.locator('[data-usual="breakfast"]').getByRole('button', { name: 'Log' }).click();
  const card = page.locator('[data-day-analysis]');
  await expect(card).toContainText('Day analysis');
  await expect(card).toContainText('Today so far');
  await expect(card).toContainText('Where the energy comes from');
  await expect(card).toContainText('Fibre');
  await card.getByRole('link', { name: 'About the day analysis' }).click();
  await expect(page).toHaveURL(/\/science#day-analysis$/);
});

test('typed numbers win, and every AI food can be corrected before logging', async ({ page }) => {
  await startWithDemo(page, { tag: 'food-typed' });
  await openFood(page);
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Dinner' }).click();
  await sheet.locator('[data-type-meal]').click();
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await sheet.getByRole('textbox').fill('200 g paneer bhurji, 30 g protein and 2 roti');
  await sheet.getByRole('button', { name: 'Work it out' }).click();
  const result = sheet.locator('[data-ai-result]');
  // The paneer keeps the person's numbers (the stand-in AI says 150 g and 12 g protein).
  const paneer = result.locator('li', { hasText: 'paneer bhurji' });
  await expect(paneer).toContainText('Your numbers');
  await expect(paneer).toContainText('30 g');
  await expect(paneer).toContainText('320'); // 240 kcal for 150 g, scaled to 200 g

  // Correct the other food by hand.
  const roti = result.locator('li', { hasText: /roti/i }).first();
  await roti.locator('[data-edit-ai-item]').click();
  const editor = roti.locator('[data-ai-item-editor]');
  await editor.getByLabel('Calories').fill('220');
  await editor.getByLabel('Protein').fill('7');
  await editor.locator('[data-save-ai-item]').click();
  await expect(roti).toContainText('220');
  await expect(roti).toContainText('Your numbers');

  await sheet.getByRole('button', { name: 'Put on my plate' }).click();
  await sheet.locator('[data-log-plate]').click();
  await expect(
    page.locator('[aria-live]').filter({ hasText: 'Logged 2 foods to dinner' }),
  ).toHaveCount(1);
  const dinner = page.locator('[data-meal="dinner"]');
  await expect(dinner).toContainText('paneer bhurji', { ignoreCase: true, timeout: 10_000 });
});
