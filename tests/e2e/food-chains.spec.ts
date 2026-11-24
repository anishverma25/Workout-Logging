import { expect, test, type Page } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * Chain menus from the chains' own documents (November 2026): a product shows once in search,
 * its size and crust are chosen on its page, pizza by the slice or the whole pizza, drinks by
 * their real cup size, and the day adds up.
 */
async function openProfile(page: Page, query: string, row: RegExp) {
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox').fill(query);
  await sheet
    .locator('[data-food-results] [data-food-row]')
    .filter({ hasText: row })
    .first()
    .click();
  await expect(sheet.locator('[data-food-profile]')).toBeVisible();
  return sheet;
}

test('pizza by size, crust and slices; a Starbucks cup; chapati; a replaced chain food', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUpFresh(page, { tag: 'food-chains' });
  await page.goto('/food');
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Lunch' }).click();

  // One result for the product, with its choices named.
  await sheet.getByRole('searchbox').fill("domino's margherita");
  const rows = sheet.locator('[data-food-results] [data-food-row]');
  await expect(rows.filter({ hasText: /^Domino's Margherita pizza/ })).toHaveCount(1);
  await expect(rows.filter({ hasText: /^Domino's Margherita pizza/ })).toContainText('3 sizes');

  await openProfile(page, "domino's margherita", /^Domino's Margherita pizza/);
  const picker = sheet.locator('[data-variant-picker]');
  await picker
    .getByRole('radiogroup', { name: 'Size' })
    .getByRole('radio', { name: 'Medium' })
    .click();
  await picker
    .getByRole('radiogroup', { name: 'Crust' })
    .getByRole('radio', { name: 'Cheese Burst' })
    .click();
  // Medium cheese burst: 773 kcal a serve of 3 slices, so 2 slices are 515 kcal.
  await expect(sheet.locator('[data-portion-kcal]')).toHaveText('515');
  await expect(sheet.locator('[data-nutrition-panel]')).toContainText('2 slices');
  await expect(sheet.locator('[data-chain-doc]')).toContainText("Domino's India");
  if (process.env.PREVIEW_OUT)
    await page.screenshot({ path: `${process.env.PREVIEW_OUT}/pizza.png` });
  await sheet.locator('[data-profile-action]').click();

  // A drink by its real cup size.
  await openProfile(page, 'starbucks cappuccino', /^Starbucks Cappuccino/);
  await sheet
    .locator('[data-variant-picker]')
    .getByRole('radiogroup', { name: 'Size' })
    .getByRole('radio', { name: 'Grande' })
    .click();
  await expect(sheet.locator('[data-portion-kcal]')).toHaveText('173');
  await sheet.locator('[data-profile-action]').click();

  // An everyday food by its natural unit, and a chain food that kept its id.
  await openProfile(page, 'chapati', /Roti|Chapati/);
  await sheet.locator('[data-profile-action]').click();
  await openProfile(page, 'burger king crispy veg', /^Burger King Crispy Veg(?! Double)/);
  await expect(sheet.locator('[data-portion-kcal]')).toHaveText('306');
  await sheet.locator('[data-profile-action]').click();

  const plate = sheet.locator('[data-plate]');
  await expect(plate).toContainText('2 slices');
  await sheet.locator('[data-log-plate]').click();

  const lunch = page.locator('[data-meal="lunch"]');
  await expect(lunch).toContainText("Domino's Margherita pizza, medium, cheese burst");
  await expect(lunch).toContainText('Starbucks Grande Cappuccino');
  await expect(lunch).toContainText('Burger King Crispy Veg');
  // The day is the sum of what was logged: 515 + 173 + 306 + the chapatis.
  const total = Number(
    (await page.locator('[data-day-totals]').innerText())
      .match(/([\d,]+)\s*kcal/)?.[1]
      ?.replace(',', ''),
  );
  expect(total).toBeGreaterThan(515 + 173 + 306);

  // Editing the pizza to 3 slices changes the day by one slice (258 kcal).
  await lunch.getByRole('button', { name: /Margherita pizza/ }).click();
  const edit = page.getByRole('dialog');
  await edit.getByRole('textbox').first().fill('3 slices');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(lunch).toContainText('3 slices');
  const after = Number(
    (await page.locator('[data-day-totals]').innerText())
      .match(/([\d,]+)\s*kcal/)?.[1]
      ?.replace(',', ''),
  );
  expect(after - total).toBeGreaterThanOrEqual(257);
  expect(after - total).toBeLessThanOrEqual(259);
});
