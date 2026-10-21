import { expect, test } from '@playwright/test';
import { startWithDemo } from './session';

/** The public home page: what search engines and first-time visitors see at `/`. */

const HEADING = 'Log every set. See real progress.';

test('a first visit opens the public home page, which leads to the tour and an account', async ({
  page,
}) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeVisible();
  await expect(page).toHaveTitle('Overload: workout log and strength progress tracker');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Log every set and every meal/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://overloadgym.in/',
  );
  // Real content to read, not an empty app shell.
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(4);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  expect(await page.locator('body').innerText()).not.toContain('—');

  await page.getByRole('link', { name: 'Take the tour' }).first().click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Take the tour | Overload');

  await page.goto('/');
  await page.getByRole('link', { name: 'Create free account' }).first().click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Create account' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('a policy page leads back to the home page inside the app', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeHidden();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://overloadgym.in/terms',
  );
  await page.getByRole('link', { name: 'Open the app' }).click();
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://overloadgym.in/',
  );
});

test('after the tour, the home address goes to sign in as before', async ({ page }) => {
  await page.goto('/welcome');
  await page.evaluate(() => localStorage.setItem('overload.seenTour', '1'));
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { level: 1, name: HEADING })).toBeHidden();
});

test('someone signed in never sees the home page, even for a moment', async ({ page }) => {
  await startWithDemo(page, { tag: 'landing' });
  await page.goto('/');
  // Checked as the page is parsed, before the app starts: the head script already decided.
  const shown = await page.evaluate(() => document.documentElement.hasAttribute('data-landing'));
  expect(shown).toBe(false);
  await expect(page.locator('#landing')).toBeHidden();
  await expect(page.locator('#today-title')).toBeVisible();
  await expect(page).toHaveTitle('Overload');
});
