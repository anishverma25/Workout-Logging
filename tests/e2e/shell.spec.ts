import { expect, test, type Page } from '@playwright/test';

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

/** Primary navigation: the bottom bar on mobile, the sidebar on desktop. */
const mainNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Main navigation' }).locator('visible=true');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
});

test('home shows the demo athlete with real dashboard sections', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Arjun');
  await expect(page.locator('#today-title')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Last 7 days' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Strength' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demo data' }).first()).toBeVisible();
});

test('primary navigation reaches every main area', async ({ page }) => {
  for (const name of ['Routines', 'Workout', 'Progress', 'History']) {
    await mainNav(page).getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }
  await mainNav(page).getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('secondary areas are reachable', async ({ page }) => {
  if (isMobile(page)) {
    await page.getByRole('link', { name: 'More' }).click();
    await page.getByRole('link', { name: 'Settings' }).click();
  } else {
    await mainNav(page).getByRole('link', { name: 'Settings' }).click();
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
});

test('theme and units can be changed', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: 'lb' }).click();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Body weight' })).toContainText('lb');
});

test('demo data can be cleared, loaded and reset', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear demo data' }).click();
  await expect(page.getByText('Demo data cleared')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your training starts here' })).toBeVisible();

  await page.getByRole('button', { name: 'Load demo data' }).click();
  await expect(page.locator('#today-title')).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Reset to today' }).click();
  await expect(page.getByRole('status')).toContainText('workouts');
});

test('clearing demo data survives a reload', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear demo data' }).click();
  // Wait for the write to commit before reloading, or the reload races it.
  await expect(page.getByText('Demo data cleared')).toBeVisible();
  await page.reload();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your training starts here' })).toBeVisible();
});

test('no horizontal scrolling on any main page', async ({ page }) => {
  for (const path of ['/', '/routines', '/history', '/settings', '/more', '/profile']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
