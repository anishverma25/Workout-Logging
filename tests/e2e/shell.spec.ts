import { expect, test, type Page } from '@playwright/test';
import { startWithDemo } from './session';

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

/** Primary navigation: the bottom bar on mobile, the sidebar on desktop. */
const mainNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Main navigation' }).locator('visible=true');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await startWithDemo(page);
});

test('home shows the demo athlete with real dashboard sections', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Arjun');
  await expect(page.locator('#today-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Last 7 days' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Strength' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demo data' }).first()).toBeVisible();
});

test('primary navigation reaches every main area', async ({ page }) => {
  // Activity sits under More on a phone (and on Home); the desktop sidebar lists it.
  const areas = isMobile(page)
    ? ['Routines', 'Workout', 'Food', 'Progress', 'History']
    : ['Routines', 'Workout', 'Food', 'Activity', 'Progress', 'History'];
  for (const name of areas) {
    await mainNav(page).getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }
  await mainNav(page).getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('secondary areas are reachable', async ({ page }) => {
  if (isMobile(page)) {
    await page.getByRole('link', { name: 'More' }).click();
    // Wait for More to finish loading (its code is fetched on demand) before tapping a row.
    await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
  } else {
    await mainNav(page).getByRole('link', { name: 'Settings' }).click();
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
});

test('the app is dark only and units can be changed', async ({ page }) => {
  // Dark only (D3, B4): a light preference stored before the redesign is ignored, and there
  // is no theme setting any more.
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('overload.theme', 'light'));
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Light' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'lb' }).click();
  await expect(page.getByText('Showing weights in lb')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Body weight' })).toContainText('lb');
});

test('demo data can be cleared, loaded and reset', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear demo data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear demo data' }).click();
  await expect(page.getByText('Demo data cleared')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your training starts here' })).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await expect(page.locator('#demo-data').getByRole('status')).toContainText('workouts');
  await page.goto('/');
  await expect(page.locator('#today-title')).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Reset to today' }).click();
  await expect(page.locator('#demo-data').getByRole('status')).toContainText('workouts');
});

test('clearing demo data survives a reload', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear demo data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear demo data' }).click();
  // Wait for the write to commit before reloading, or the reload races it.
  await expect(page.getByText('Demo data cleared')).toBeVisible();
  await page.reload();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your training starts here' })).toBeVisible();
});

test('no horizontal scrolling on any main page', async ({ page }) => {
  for (const path of [
    '/',
    '/routines',
    '/workout',
    '/food',
    '/progress',
    '/progress?range=7d',
    '/science',
    '/history',
    '/records',
    '/exercises',
    '/body',
    '/settings',
    '/more',
    '/profile',
    '/journey',
    '/feedback',
    '/welcome',
    '/setup',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('setting up a profile greets you by name and keeps the demo profile separate', async ({
  page,
}) => {
  await page.goto('/profile');
  await expect(page.getByText('Fictional demo profile')).toBeVisible();
  await page
    .getByRole('button', { name: /^Set up/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Asha Rao');
  await sheet.getByRole('radio', { name: 'Hypertrophy', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await expect(page.getByText('Asha Rao')).toBeVisible();
  await expect(page.getByText('Fictional demo profile')).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Asha');
});

test('tapping the tab you are on scrolls back to the top', async ({ page }) => {
  const scrollDown = async () => {
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  };
  await mainNav(page).getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Progress');
  await expect(page.locator('#strength')).toBeVisible();
  await scrollDown();
  await mainNav(page).getByRole('link', { name: 'Progress' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page).toHaveURL(/\/progress$/);

  // Inside a tab (a workout in History), the tab button goes back to the list, at the top.
  await mainNav(page).getByRole('link', { name: 'History' }).click();
  await page.locator('a[href^="/history/"]').first().click();
  await expect(page.getByRole('button', { name: 'Start this workout' })).toBeVisible();
  await scrollDown();
  await mainNav(page).getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  // Home too.
  await mainNav(page).getByRole('link', { name: 'Home' }).click();
  await expect(page.locator('#today-title')).toBeVisible();
  await scrollDown();
  await mainNav(page).getByRole('link', { name: 'Home' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
