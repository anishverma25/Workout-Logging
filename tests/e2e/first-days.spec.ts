import { expect, test, type Page } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * Batch 9: in the first 14 days Home always has one next step, and the first workout gives
 * something true back. The Now card's own cards win when they apply, so each check accepts
 * that the first-days card may be replaced by one of those (never by nothing on day 0).
 */

const nowCard = (page: Page) => page.locator('[data-now-card]');

async function home(page: Page) {
  await page.goto('/');
  await expect(nowCard(page)).toBeVisible();
  return nowCard(page).getAttribute('data-now-card');
}

test('a new account: pick a routine, first workout, first food, first weight', async ({ page }) => {
  test.setTimeout(180_000);
  await signUpFresh(page, { tag: 'firstdays' });

  // No routine yet (setup was skipped): one step, picking a routine.
  expect(await home(page)).toBe('pick_routine');
  await expect(nowCard(page).getByRole('link', { name: 'Pick' })).toHaveAttribute(
    'href',
    '/routines',
  );

  // The first workout, empty, one exercise, two sets.
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).first().click();
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('barbell bench press');
  await page
    .getByRole('button', { name: /^Barbell bench press/ })
    .first()
    .click();
  await page.getByRole('button', { name: /^Add 1 exercise/ }).click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await expect(card.getByRole('heading', { name: 'Barbell bench press' })).toBeVisible();
  for (const i of [1, 2]) {
    const load = card.getByRole('textbox', { name: `Set ${i} load in kg` });
    if (!(await load.count())) await card.getByRole('button', { name: 'Add set' }).click();
    await load.fill('40');
    await card.getByRole('textbox', { name: `Set ${i} reps` }).fill('8');
    await card.getByRole('button', { name: `Mark set ${i} done` }).click();
    await expect(card.getByRole('button', { name: `Set ${i} done. Tap to undo.` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  const save = page.getByRole('button', { name: /^Finish and save/ });
  if (
    await save
      .first()
      .isVisible()
      .catch(() => false)
  )
    await save.first().click();
  await expect(page.getByRole('heading', { name: /done$/ })).toBeVisible();

  // The summary gives something back after the first workout, and two reasons to return.
  const first = page.locator('[data-first-workout]');
  await expect(first).toBeVisible();
  await expect(
    first.getByRole('heading', { name: /^Chest: \d+(\.\d)? hard sets? this week$/ }),
  ).toBeVisible();
  await expect(first.getByRole('link', { name: 'Train with friends' })).toHaveAttribute(
    'href',
    '/groups',
  );

  // Home: the next habit is food.
  expect(['first_food', 'train', 'review']).toContain(await home(page));
  if ((await home(page)) === 'first_food')
    await expect(nowCard(page).getByRole('link', { name: 'Log food' })).toHaveAttribute(
      'href',
      '/food',
    );

  // A weigh-in does not skip food: food comes first.
  await page.goto('/body');
  await page
    .getByRole('button', { name: /weigh-in/i })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('radio', { name: 'kg' }).click();
  await page.getByRole('textbox', { name: 'Weight' }).fill('72');
  await page.getByRole('button', { name: 'Save weigh-in' }).click();
  await expect(page.getByText('Weigh-in saved')).toBeVisible();
  expect(['first_food', 'train', 'review']).toContain(await home(page));
});
