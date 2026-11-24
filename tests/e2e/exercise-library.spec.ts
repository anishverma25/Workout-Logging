import { test, expect, type Page } from '@playwright/test';
import { signUpFresh } from './session';

/**
 * The library from the muscle-targeting sheet (November 2026): new exercises, muscles worked,
 * one side at a time by default for one-sided moves, and a Both together / One side at a time
 * choice for moves done either way, all the way to history.
 */
const card = (page: Page, n: number) => page.locator('section[aria-labelledby^="ex-"]').nth(n);

test('bilateral, unilateral and switchable exercises log and save as chosen', async ({ page }) => {
  await signUpFresh(page, { at: '/workout', tag: 'laterality' });
  await page.goto('/workout');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  const search = page.getByRole('searchbox', { name: 'Search exercises' });
  for (const [q, name] of [
    ['barbell bench', /^Barbell bench press/],
    ['bayesian cable curl', /^Bayesian cable curl/],
    ['dumbbell curl', /^Dumbbell curl/],
  ] as const) {
    await search.fill(q);
    await page.getByRole('button', { name }).first().click();
  }
  await page.getByRole('button', { name: 'Add 3 exercises' }).click();

  // Bilateral: one number, muscles shown as small chips.
  const bench = card(page, 0);
  await expect(bench.locator('[data-side-reps]')).toHaveCount(0);
  await expect(bench.locator('[data-laterality-choice]')).toHaveCount(0);
  await expect(bench.locator('[data-muscles-panel]')).toContainText('Mid chest');
  await bench.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('60');
  await bench.getByRole('textbox', { name: 'Set 1 reps' }).fill('8');
  await bench.getByRole('button', { name: 'Mark set 1 done' }).click();

  // Unilateral (new exercise): left and right by default, unequal sides allowed.
  const bayes = card(page, 1);
  await expect(bayes.locator('[data-by-side]')).toBeVisible();
  const sideRow = bayes.locator('[data-side-reps]').first();
  await bayes.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('10');
  await sideRow.getByRole('textbox', { name: /left side/ }).fill('12');
  await sideRow.getByRole('textbox', { name: /right side/ }).fill('9');
  await bayes.getByRole('button', { name: 'Mark set 1 done' }).click();

  // Both: together by default, switched to one side at a time.
  const curl = card(page, 2);
  const choice = curl.locator('[data-laterality-choice]');
  await expect(choice.getByRole('radio', { name: 'Both together' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(curl.locator('[data-side-reps]')).toHaveCount(0);
  await choice.getByRole('radio', { name: 'One side at a time' }).click();
  await expect(curl.locator('[data-side-reps]').first()).toBeVisible();
  const curlRow = curl.locator('[data-side-reps]').first();
  await curl.getByRole('textbox', { name: 'Set 1 load in kg' }).fill('12');
  await curlRow.getByRole('textbox', { name: /left side/ }).fill('10');
  await curlRow.getByRole('textbox', { name: /right side/ }).fill('10');
  await curl.getByRole('button', { name: 'Mark set 1 done' }).click();

  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish and save' }).click();
  await expect(page).toHaveURL(/summary/);

  await page.goto('/history');
  await page.locator('a[href^="/history/"]').first().click();
  await expect(page.getByRole('button', { name: /10 × L 12 · R 9/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /12 × L 10 · R 10/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /60 × 8/ })).toBeVisible();
});

test('the exercise sheet shows muscles worked with roles, nothing extra', async ({ page }) => {
  await signUpFresh(page, { at: '/exercises', tag: 'library-sheet' });
  await page.goto('/exercises');
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('copenhagen');
  await page.getByRole('button', { name: /^Copenhagen adduction/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('[data-muscle-shares]')).toBeVisible();
  await expect(sheet.getByRole('region', { name: 'Primary' })).toContainText('Adductors');
  await expect(sheet).toContainText('not measured muscle activation');
});
