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

test('a pack: typed from the label, the amount in grams, the numbers worked out', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'food-pack' });
  await openFood(page);
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Snacks' }).click();
  await sheet.locator('[data-pack-food]').click();
  await sheet.locator('[data-label-manual]').click();
  const form = sheet.locator('[data-label-form]');
  await form.getByLabel('Product').fill('Rolled oats');
  await form.getByLabel('Calories').fill('389');
  await form.getByLabel('Protein').fill('13');
  await form.getByLabel('Carbs').fill('66');
  await form.getByLabel('Fat').fill('7');
  await form.getByLabel('Fibre').fill('10');
  await form.getByLabel('Amount').fill('40');
  await expect(form.locator('[data-label-result]')).toContainText('156 kcal · 5.2 g protein');
  await form.locator('[data-label-add]').click();
  await sheet.locator('[data-log-plate]').click();
  await expect(page.locator('[data-meal="snacks"]')).toContainText('Rolled oats', {
    timeout: 10_000,
  });
});

test('Pro photographs a label: only the printed numbers, then servings', async ({ page }) => {
  await signUpFresh(page, { tag: 'food-label' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('[data-pack-food]').click();
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  await sheet.locator('[data-label-input]').setInputFiles({
    name: 'label.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4UaGBFTEMLQkAUtVaAV8W4QQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  const form = sheet.locator('[data-label-form]');
  await expect(form.locator('[data-label-read]')).toContainText('could not be read');
  await expect(form.getByLabel('Product')).toHaveValue('TestFit Whey protein');
  await expect(form.getByLabel('Protein')).toHaveValue('80');
  // Fibre was not readable: left empty, never guessed.
  await expect(form.getByLabel('Fibre')).toHaveValue('');
  // One scoop by default, from the printed serving size.
  await expect(form.locator('[data-label-result]')).toContainText('132 kcal · 26.4 g protein');
  await form.getByLabel('Amount').fill('2');
  await expect(form.locator('[data-label-result]')).toContainText('264 kcal');
  await form.locator('[data-label-add]').click();
  await expect(sheet.locator('[data-plate]')).toContainText('TestFit Whey protein', {
    ignoreCase: true,
  });
});

/** A real EAN-13 barcode drawn on a canvas, as a PNG, so the decoder on the phone is tested. */
async function barcodePng(page: Page, code: string): Promise<Buffer> {
  const dataUrl = await page.evaluate((digits) => {
    const L = [
      '0001101',
      '0011001',
      '0010011',
      '0111101',
      '0100011',
      '0110001',
      '0101111',
      '0111011',
      '0110111',
      '0001011',
    ];
    const G = [
      '0100111',
      '0110011',
      '0011011',
      '0100001',
      '0011101',
      '0111001',
      '0000101',
      '0010001',
      '0001001',
      '0010111',
    ];
    const R = [
      '1110010',
      '1100110',
      '1101100',
      '1000010',
      '1011100',
      '1001110',
      '1010000',
      '1000100',
      '1001000',
      '1110100',
    ];
    const PARITY = [
      'LLLLLL',
      'LLGLGG',
      'LLGGLG',
      'LLGGGL',
      'LGLLGG',
      'LGGLLG',
      'LGGGLL',
      'LGLGLG',
      'LGLGGL',
      'LGGLGL',
    ];
    const d = digits.split('').map(Number);
    const parity = PARITY[d[0]!]!;
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[d[i]!];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += R[d[i]!];
    bits += '101';
    const w = 4;
    const canvas = document.createElement('canvas');
    canvas.width = (bits.length + 20) * w;
    canvas.height = 220;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    [...bits].forEach((b, i) => {
      if (b === '1') ctx.fillRect((i + 10) * w, 20, w, 180);
    });
    return canvas.toDataURL('image/png');
  }, code);
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

test('a pack by barcode: the photo is read on the phone and the product comes from Open Food Facts', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'food-barcode' });
  let asked = '';
  await page.route('https://world.openfoodfacts.org/**', (route) => {
    asked = route.request().url();
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 1,
        product: {
          product_name: 'High Protein Peanut Butter',
          brands: 'Pintola',
          serving_size: '32 g',
          serving_quantity: 32,
          nutriments: {
            'energy-kcal_100g': 600,
            proteins_100g: 30,
            carbohydrates_100g: 20,
            fat_100g: 45,
          },
        },
      }),
    });
  });
  await openFood(page);
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('[data-pack-food]').click();
  // 4006381333931 is a valid EAN-13 test code.
  await sheet.locator('[data-barcode-input]').setInputFiles({
    name: 'barcode.png',
    mimeType: 'image/png',
    buffer: await barcodePng(page, '4006381333931'),
  });
  const form = sheet.locator('[data-label-form]');
  await expect(form.locator('[data-label-read]')).toContainText('From Open Food Facts');
  expect(asked).toContain('/product/4006381333931.json');
  await expect(form.getByLabel('Product')).toHaveValue('Pintola High Protein Peanut Butter');
  // The database has no fibre: left empty for the person, never guessed.
  await expect(form.getByLabel('Fibre')).toHaveValue('');
  await expect(form.locator('[data-label-result]')).toContainText('192 kcal · 9.6 g protein');
  await form.locator('[data-label-add]').click();
  await expect(sheet.locator('[data-plate]')).toContainText('peanut butter', { ignoreCase: true });
});

test('an unknown barcode says so and offers the label', async ({ page }) => {
  await startWithDemo(page, { tag: 'food-barcode-unknown' });
  await page.route('https://world.openfoodfacts.org/**', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{"status":0}' }),
  );
  await openFood(page);
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.locator('[data-pack-food]').click();
  await sheet.getByLabel('Or type the barcode number').fill('8901234567890');
  await sheet.locator('[data-lookup-barcode]').click();
  await expect(sheet.locator('[data-label-error]')).toContainText('not in the database yet');
  await expect(sheet.locator('[data-label-manual]')).toBeVisible();
});
