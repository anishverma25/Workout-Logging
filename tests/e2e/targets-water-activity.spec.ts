import { expect, test, type Page } from '@playwright/test';
import { signUpFresh, startWithDemo } from './session';

/**
 * Daily targets (worked out or the person's own), the quantity box, water, and activity: cardio,
 * steps and calories burned. Every calorie-burn estimate carries the "can be wrong" note.
 */

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

/** A new account with a profile and a weigh-in: 58 kg, 163 cm, goal hypertrophy. */
async function newPerson(page: Page, tag: string) {
  test.setTimeout(120_000);
  await signUpFresh(page, { at: '/setup?next=/', tag });
  await page.getByRole('textbox', { name: 'Your name' }).fill('Meera Shah');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /^Hypertrophy/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /^Beginner/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Full gym/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Female', exact: true }).click();
  await page.getByRole('textbox', { name: 'Birth date, day' }).click();
  await page.keyboard.type('14031996');
  await page.getByLabel('Height in centimetres').fill('163');
  await page.getByLabel(/Weight/).fill('58');
  await page.getByLabel(/Weight/).blur();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Mostly sitting/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create my routine' }).click();
  await expect(page).toHaveURL(/\/routines\/[\w-]+$/);
}

test('a person chooses worked-out targets, then types their own', async ({ page }) => {
  await newPerson(page, 'targets');
  await page.goto('/food');
  const prompt = page.locator('[data-targets-prompt]');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Choose how' }).click();

  const sheet = page.getByRole('dialog', { name: 'Your daily targets' });
  await sheet.getByRole('radio', { name: /Work them out for me/ }).click();
  const calc = sheet.locator('[data-calculated-targets]');
  for (const label of ['Calories', 'Protein', 'Carbs', 'Fat', 'Fibre', 'Water'])
    await expect(calc).toContainText(label);
  // 35 ml per kg of 58 kg is 2,030 ml, to the nearest 250 ml.
  await expect(calc).toContainText('2,000 ml');
  await sheet.getByRole('button', { name: 'Use these targets' }).click();

  await expect(prompt).toHaveCount(0);
  const totals = page.locator('[data-day-totals]');
  await expect(totals).toContainText('worked out for you');
  await expect(totals.locator('[data-macro-bars]')).toContainText('Carbs');
  await expect(totals.locator('[data-macro-bars]')).toContainText('Fibre');

  // Switch to their own numbers.
  await page.getByRole('button', { name: /Daily targets/ }).click();
  const own = page.getByRole('dialog', { name: 'Your daily targets' });
  await own.getByRole('radio', { name: /I will set my own/ }).click();
  await own.getByLabel('Calories a day').fill('2400');
  // The macros are recommended from the typed calories and the goal, and re-balance when the
  // protein is typed.
  await expect(own.getByLabel('Protein a day')).not.toHaveValue('');
  const carbsBefore = await own.getByLabel('Carbs a day').inputValue();
  await expect(own.locator('[data-macro-help]')).toContainText('recommended from your calories');
  await own.getByLabel('Protein a day').fill('150');
  await own.getByLabel('Protein a day').blur();
  await expect(own.getByLabel('Carbs a day')).not.toHaveValue(carbsBefore);
  await own.getByLabel('Carbs a day').fill('280');
  await own.getByLabel('Fat a day').fill('70');
  await own.getByLabel('Fibre a day').fill('35');
  await own.getByLabel('Water a day').fill('3000');
  await own.getByRole('button', { name: 'Save targets' }).click();

  await expect(totals).toContainText('of 2,400 kcal');
  await expect(totals).toContainText('of 150 g');
  await expect(totals.locator('[data-macro-bars]')).toContainText('of 280');
  await expect(totals).toContainText('your own');
  await expect(page.locator('[data-water-ml]')).toContainText('of 3,000 ml');
});

test('any quantity can be typed, with its unit, and the numbers follow', async ({ page }) => {
  await signUpFresh(page, { tag: 'quantity' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox').fill('chapati');
  await sheet.locator('[data-food-results] [data-food-row]').first().click();
  const profile = sheet.locator('[data-food-profile]');
  // 2 rotis are 204 kcal, so one roti is 102.
  await expect(profile.locator('[data-portion-kcal]')).toHaveText('204');
  await profile.locator('[data-amount-input]').fill('5');
  await expect(profile.locator('[data-portion-kcal]')).toHaveText('510');
  await profile.locator('[data-quantity-text]').fill('3 rotis');
  await profile.locator('[data-quantity-text]').press('Enter');
  await expect(profile.locator('[data-portion-kcal]')).toHaveText('306');
  await expect(profile.locator('[data-amount-input]')).toHaveValue('3');
  // By weight: grams switch the unit.
  await profile.locator('[data-quantity-text]').fill('150 g');
  await profile.locator('[data-quantity-text]').press('Enter');
  await expect(profile.locator('[data-amount-input]')).toHaveValue('150');
  // A unit the food cannot be measured in says so.
  await profile.locator('[data-quantity-text]').fill('2 scoops');
  await profile.locator('[data-quantity-text]').press('Enter');
  await expect(profile.getByRole('alert')).toContainText('cannot be measured that way');
});

test('water: glasses, other amounts, undo and the size of your glass', async ({ page }) => {
  await newPerson(page, 'water');
  // Water lives on the Food page; the old /water address opens it there.
  await page.goto('/water');
  await expect(page).toHaveURL(/\/food#water$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Food');
  await expect(page.locator('[data-water-glasses]')).toHaveText('0');
  await page.locator('[data-add-glass]').click();
  await expect(page.locator('[data-water-glasses]')).toHaveText('1');
  await expect(page.locator('[data-water-ml]')).toContainText('250 ml of 2,000 ml');

  await page.locator('[data-add-other-water]').click();
  const sheet = page.getByRole('dialog', { name: 'Add water' });
  await sheet.getByLabel('Amount in ml').fill('500');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('[data-water-ml]')).toContainText('750 ml');

  await page.getByRole('button', { name: 'Remove the last drink' }).click();
  await expect(page.locator('[data-water-ml]')).toContainText('250 ml');

  // Details: the seven day strip, the day's drinks and the size of your glass.
  await page.locator('[data-water-details]').click();
  const details = page.getByRole('dialog', { name: 'Water' });
  await expect(details.locator('[data-water-week] li')).toHaveCount(7);
  await details.getByRole('button', { name: '300 ml' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-add-glass]')).toContainText('300 ml');
});

test('activity: cardio and steps with estimates, typed numbers and the warning', async ({
  page,
}) => {
  await newPerson(page, 'activity');
  await page.goto('/activity');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Activity');
  await expect(page.locator('[data-burn-summary] [data-estimate-note]')).toContainText(
    'can be wrong',
  );
  // Overload says plainly that it does not count steps itself.
  await expect(page.locator('[data-pedometer-note]')).toContainText('cannot count steps');

  // Cardio: a treadmill walk, estimated from speed and minutes.
  await page.locator('[data-add-cardio]').click();
  const cardio = page.getByRole('dialog', { name: 'Add cardio' });
  await cardio.getByLabel('Speed').fill('5');
  await expect(cardio.locator('[data-cardio-estimate]')).toContainText(/About \d+ kcal/);
  await expect(cardio.locator('[data-estimate-note]')).toContainText('can be wrong');
  await cardio.getByRole('button', { name: 'Save cardio' }).click();
  const list = page.locator('[data-cardio-card]');
  await expect(list).toContainText('Treadmill walk');
  await expect(list).toContainText('30 min');
  await expect(list).toContainText('~');

  // Cardio with a number typed from a machine replaces the estimate.
  await page.locator('[data-add-cardio]').click();
  const second = page.getByRole('dialog', { name: 'Add cardio' });
  await second.getByRole('button', { name: 'Stair master' }).click();
  await second.getByRole('switch').click();
  await second.getByLabel('Calories burned').fill('210');
  await second.getByRole('button', { name: 'Save cardio' }).click();
  await expect(list).toContainText('Stair master');
  await expect(list).toContainText('210 kcal');
  await expect(list).toContainText('typed by you');

  // Steps: estimated, then replaced by a typed number.
  await page.locator('[data-add-steps]').click();
  const steps = page.getByRole('dialog', { name: 'Steps' });
  await steps.getByLabel('Steps today').fill('10000');
  await expect(steps.locator('[data-steps-estimate]')).toContainText(/About \d+ kcal/);
  await steps.getByRole('button', { name: 'Save steps' }).click();
  const stepsCard = page.locator('[data-steps-card]');
  await expect(stepsCard).toContainText('10,000 steps');
  await expect(stepsCard).toContainText('Calories estimated');

  await page.locator('[data-add-steps]').click();
  const again = page.getByRole('dialog', { name: 'Steps' });
  await again.getByRole('switch').click();
  await again.getByLabel('Calories burned from steps').fill('180');
  await again.getByRole('button', { name: 'Save steps' }).click();
  await expect(stepsCard).toContainText('180 kcal');
  await expect(stepsCard).toContainText('Calories typed by you');

  // The day adds up on Home: burned and net under the food, with the warning.
  await page.goto('/');
  const day = page.locator('[data-activity-card]');
  await expect(day).toContainText('kcal burned');
  await expect(day).toContainText('net');
  await expect(day.locator('[data-estimate-note]')).toContainText('can be wrong');
});

test('a finished workout shows an estimated burn, and a tracker number replaces it', async ({
  page,
}) => {
  await startWithDemo(page, { tag: 'burn' });
  await page.goto('/history');
  await page.locator('a[href^="/history/"]').first().click();
  const card = page.locator('[data-workout-burn]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-estimate-note]')).toContainText('can be wrong');
  await expect(card.locator('[data-burn-kcal]')).toContainText('~');

  await card.locator('[data-enter-kcal]').click();
  const sheet = page.getByRole('dialog', { name: 'Calories burned' });
  await sheet.getByLabel('Calories burned').fill('321');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card.locator('[data-burn-kcal]')).toContainText('321');
  await expect(card.locator('[data-burn-kcal]')).not.toContainText('~');
  await expect(card).toContainText('From your watch or tracker');

  // And back to the estimate.
  await card.locator('[data-enter-kcal]').click();
  await page
    .getByRole('dialog', { name: 'Calories burned' })
    .getByRole('button', { name: 'Use the estimate instead' })
    .click();
  await expect(card.locator('[data-burn-kcal]')).toContainText('~');
});

test('Home shows today’s activity under the food card, with steps and cardio in a tap', async ({
  page,
}) => {
  await newPerson(page, 'home-activity');
  await page.goto('/');
  const card = page.locator('[data-activity-card]');
  await expect(card).toBeVisible();
  await card.locator('[data-home-add-steps]').click();
  const steps = page.getByRole('dialog', { name: 'Steps' });
  await steps.getByLabel('Steps today').fill('8000');
  await steps.getByRole('button', { name: 'Save steps' }).click();
  await expect(card.locator('[data-activity-steps]')).toHaveText('8,000');
  await expect(card.locator('[data-estimate-note]')).toBeVisible();
  await card.locator('[data-home-add-cardio]').click();
  await expect(page.getByRole('dialog', { name: 'Add cardio' })).toBeVisible();
});
