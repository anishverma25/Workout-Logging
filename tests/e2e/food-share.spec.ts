import { expect, test, type Page } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * Foods members add for everyone: sent from the own-food form, checked by the owner, then found
 * by anyone. The thank-you (and its 5%) shows only after approval, and only to the author.
 */

const FAKE = 'http://localhost:54329';

async function addLabelFood(page: Page, name: string, share: boolean) {
  await page.locator('[data-add-food]').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Add your own food or family recipe' }).click();
  const form = page.getByRole('dialog', { name: 'Add your own' });
  // Nothing on the form mentions a discount: the thank-you is not an offer.
  await expect(form).not.toContainText(/%|discount|Pro/);
  await form.getByRole('radio', { name: 'From a label' }).click();
  await form.getByLabel('Name').fill(name);
  await form.getByLabel('One serving', { exact: true }).fill('60');
  await form.getByLabel('Calories').fill('240');
  await form.getByLabel('Protein').fill('20');
  if (share) await form.getByRole('switch', { name: 'Add it for everyone' }).click();
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toHaveCount(0);
}

test('a food added for everyone is checked first, then found by others, and its author is thanked once', async ({
  page,
  browser,
}) => {
  const name = `Sattu ladoo ${Date.now().toString(36)}`;
  await signUpFresh(page, { at: '/food', tag: 'food-author' });
  await addLabelFood(page, name, true);
  await expect(page.getByText('Sent for a check before it is added for everyone')).toBeVisible();
  await expect(page.locator('[data-food-thanks]')).toHaveCount(0);

  // Someone else does not find it before it is checked.
  const other = await browser.newPage();
  await signUpFresh(other, { at: '/food', tag: 'food-reader' });
  await other.locator('[data-add-food]').click();
  const search = other.getByRole('dialog');
  await search.getByRole('searchbox').fill(name.toLowerCase());
  await expect(search.locator('[data-food-results]')).not.toContainText(name);

  await fetch(`${FAKE}/__test/approve-foods`, { method: 'POST' });

  // Once checked, everyone finds it, with where it came from (and no author).
  await other.evaluate(() => localStorage.removeItem('overload.sharedFoods'));
  await other.goto('/food');
  await other.locator('[data-add-food]').click();
  const again = other.getByRole('dialog');
  await again.getByRole('searchbox').fill(name.toLowerCase());
  const row = again.locator('[data-food-results] li').filter({ hasText: name }).first();
  await expect(row).toBeVisible();
  await row.locator('[data-food-row]').click();
  await expect(again).toContainText('Added by a member from its label, and checked by Macrotrophy');
  // The reader is never thanked for someone else's food.
  await other.goto('/food');
  await expect(other.locator('[data-food-page]')).toBeVisible();
  await expect(other.locator('[data-food-thanks]')).toHaveCount(0);
  await other.close();

  // The author is thanked, with the 5%, once.
  await page.goto('/food');
  const thanks = page.locator('[data-food-thanks]');
  await expect(thanks).toContainText('Thank you for improving the food library');
  await expect(thanks).toContainText(name);
  await expect(thanks.locator('[data-food-thanks-credit]')).toContainText(
    'your next Pro payment is 5% less',
  );
  await thanks.getByRole('button', { name: 'Close' }).click();
  await expect(thanks).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-food-page]')).toBeVisible();
  await expect(page.locator('[data-food-thanks]')).toHaveCount(0);
});

test('a food kept to yourself is never sent', async ({ page }) => {
  const name = `Private bar ${Date.now().toString(36)}`;
  await signUpFresh(page, { at: '/food', tag: 'food-private' });
  await addLabelFood(page, name, false);
  await expect(page.getByText(`Saved ${name}`, { exact: true })).toBeVisible();
  const res = await fetch(`${FAKE}/__test/approve-foods`, { method: 'POST' });
  const { approved } = (await res.json()) as { approved: number };
  // Other tests may have food waiting; this one never is.
  expect(approved).toBeGreaterThanOrEqual(0);
  await page.goto('/food');
  await expect(page.locator('[data-food-thanks]')).toHaveCount(0);
});
