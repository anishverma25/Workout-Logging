import { expect, test, type Page } from '@playwright/test';
import { signUpFresh, startWithDemo } from './session';

/**
 * Round 3: food logging that stays where you are, recent and usual foods with last time's
 * amount, servings in grams with carbs and fat filled in, setup that turns a target weight into
 * calories, protein and a date, notes on each exercise, and the reload reminder in More.
 */

async function openAddFood(page: Page, meal: string) {
  await page.goto('/food');
  await expect(page.locator('[data-food-page]')).toBeVisible();
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: meal }).click();
  return sheet;
}

test('plus adds and adds up without leaving the search; recent and usual show last time', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await startWithDemo(page, { tag: 'plus-stays' });
  const sheet = await openAddFood(page, 'Breakfast');

  // What they had recently comes first, with the amount one tap adds.
  const recent = sheet.locator('[data-food-list="recent-foods"]');
  await expect(recent).toBeVisible();
  await expect(recent.locator('[data-food-row]').first()).toContainText('Last time:');

  await sheet.getByRole('searchbox').fill('roti');
  const row = sheet.locator('[data-food-results] li').first();
  await row.locator('[data-quick-add]').click();
  await row.locator('[data-quick-add]').click();
  // Still on the search, and one line on the plate that added up.
  await expect(sheet.getByRole('searchbox')).toHaveValue('roti');
  await expect(sheet.locator('[data-food-results]')).toBeVisible();
  await expect(sheet.locator('[data-plate] li')).toHaveCount(1);
  const onPlate = row.locator('[data-on-plate]');
  await expect(onPlate).toBeVisible();
  const two = (await onPlate.textContent())!;
  await row.locator('[data-quick-remove]').click();
  await expect(onPlate).not.toHaveText(two);

  // Nothing runs off the side of an iPhone 16.
  const overflow = await sheet.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await sheet.locator('[data-log-plate]').click();
  await expect(page.locator('[data-meal="breakfast"]')).toContainText(/roti/i);
});

test('a food of your own: grams for a serving, carbs and fat from calories and protein', async ({
  page,
}) => {
  await signUpFresh(page, { at: '/food', tag: 'own-serving' });
  const sheet = await openAddFood(page, 'Snacks');
  await sheet.getByRole('button', { name: 'Add your own food or family recipe' }).click();
  const form = page.getByRole('dialog', { name: 'Add your own' });
  await form.getByRole('radio', { name: 'From a label' }).click();
  await form.getByLabel('Name').fill('Protein bar');
  await form.getByLabel('One serving', { exact: true }).fill('50');
  await form.getByLabel('Calories').fill('200');
  await form.getByLabel('Protein').fill('10');
  // 160 kcal left after protein: 60% from carbs (24 g), 40% from fat (7.1 g).
  await expect(form.getByLabel('Carbs')).toHaveValue('24');
  await expect(form.getByLabel('Fat')).toHaveValue('7.1');
  // Typed numbers are kept.
  await form.getByLabel('Fat').fill('8');
  await form.getByLabel('Calories').fill('210');
  await expect(form.getByLabel('Fat')).toHaveValue('8');
  await form.getByRole('button', { name: 'Save' }).click();

  await page.locator('[data-add-food]').click();
  const add = page.getByRole('dialog');
  await add.getByRole('searchbox').fill('protein bar');
  const row = add.locator('[data-food-results] li').first();
  await expect(row).toContainText('1 serving');
  await row.locator('[data-quick-add]').click();
  await expect(add.locator('[data-plate]')).toContainText('1 serving protein bar');
});

test('an AI food: the serving in grams on the card, macros filled when editing', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'ai-serving' });
  const sheet = await openAddFood(page, 'Dinner');
  await sheet.locator('[data-type-meal]').click();
  await sheet.getByRole('button', { name: 'Turn on' }).click();
  // A made-up brand, so the stand-in AI answers rather than the food library.
  await sheet.locator('#ai-food').fill('ZETAFIT oat cookie');
  await sheet.getByRole('button', { name: 'Work it out' }).click();
  const item = sheet.locator('[data-ai-result] li').first();
  // The stand-in AI says 150 g and 240 kcal; 300 g is twice that.
  const serving = item.getByRole('textbox', { name: /^Serving of .* in grams$/ });
  await expect(serving).toHaveValue('150');
  await serving.fill('300');
  await serving.blur();
  await expect(item).toContainText('480');

  await item.locator('[data-edit-ai-item]').click();
  const editor = item.locator('[data-ai-item-editor]');
  await editor.getByLabel('Calories').fill('300');
  await editor.getByLabel('Protein').fill('20');
  await expect(editor.locator('[data-macros-filled]')).toBeVisible();
  // 220 kcal left, split like the food (carbs 60 g, fat 16 g): about 34.4 g carbs, 9.2 g fat.
  await expect(editor.getByLabel('Carbs')).toHaveValue(/^34\.[3-5]$/);
  await expect(editor.getByLabel('Fat')).toHaveValue(/^9\.[1-3]$/);
  await editor.locator('[data-save-ai-item]').click();
  await expect(item).toContainText('300');
});

test('setup: a target weight gives calories, protein and a date that moves with them', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpFresh(page, { at: '/setup?next=/food', tag: 'target-weight' });
  await page.getByRole('textbox', { name: 'Your name' }).fill('Kabir');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /^Fat loss/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /^Intermediate/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Male', exact: true }).click();
  await page.getByRole('textbox', { name: 'Birth date, day' }).click();
  await page.keyboard.type('02021995');
  await page.getByLabel('Height in centimetres').fill('176');
  await page.getByLabel(/^Weight/).fill('80');
  await page.getByLabel('Target weight (optional)').fill('72');
  await page.getByLabel('Target weight (optional)').blur();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Mostly sitting/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  const card = page.locator('[data-goal-targets]');
  const timeline = card.locator('[data-goal-timeline]');
  await expect(timeline).toContainText(/You reach 72 kg around \d+ \w+ \d{4}, in about \d+ weeks/);
  // 2.2 g per kg of 80 kg.
  await expect(card.getByLabel('Protein a day')).toHaveValue('175');
  const suggested = Number((await card.getByLabel('Calories a day').inputValue()).replace(',', ''));
  const weeks = async () => Number(/about (\d+) weeks/.exec((await timeline.textContent())!)![1]);
  const planned = await weeks();

  // Eating more: a later date.
  await card.getByLabel('Calories a day').fill(String(suggested + 200));
  await card.getByLabel('Calories a day').blur();
  await expect.poll(weeks).toBeGreaterThan(planned);
  // Well above maintenance: the target moves away.
  await card.getByLabel('Calories a day').fill('3800');
  await card.getByLabel('Calories a day').blur();
  await expect(timeline).toContainText('away from 72 kg');
  // Low protein is pointed out.
  await card.getByLabel('Protein a day').fill('100');
  await card.getByLabel('Protein a day').blur();
  await expect(card.locator('[data-goal-warning]').last()).toContainText('g per kg');
  // Back to the suggestion and save.
  await card.getByRole('button', { name: /^Use the suggestion/ }).click();
  await expect(card.getByLabel('Calories a day')).toHaveValue(String(suggested));
  await page.getByRole('button', { name: /Save, I will pick a routine later/ }).click();
  await expect(page).toHaveURL(/\/food$/);
  await expect(page.locator('[data-day-totals]')).toContainText(
    suggested.toLocaleString('en-GB'),
  );
});

test('a note on each exercise, typed on the card and kept', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await startWithDemo(page, { tag: 'exercise-note' });
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  const note = card.locator('[data-exercise-note] textarea');
  await expect(note).toBeVisible();
  // 16 px, so iPhone Safari does not zoom into it.
  expect(await note.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  await note.fill('Seat on 4, wide grip');
  await note.blur();
  // Saved to the phone's database as typed; give the write a moment before reloading.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(
    page.locator('section[aria-labelledby^="ex-"]').first().locator('[data-exercise-note] textarea'),
  ).toHaveValue('Seat on 4, wide grip');
});

test('More always reminds people to reload for new versions', async ({ page }) => {
  await signUpFresh(page, { at: '/more', tag: 'reload-note' });
  const note = page.locator('[data-reload-note]');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Reload');
});
