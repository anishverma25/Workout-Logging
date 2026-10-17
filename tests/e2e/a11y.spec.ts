import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { startWithDemo } from './session';

/** Automated accessibility checks (WCAG 2.1 A and AA) on every screen. The app is dark only (D3). */

/** Reachable without an account: the home page, the tour, the account screens and the policies. */
const PUBLIC_PAGES = ['/', '/welcome', '/sign-in', '/sign-up', '/forgot-password', '/terms', '/privacy'];

const PAGES = [
  '/',
  '/workout',
  '/routines',
  '/progress',
  '/science',
  '/history',
  '/records',
  '/exercises',
  '/body',
  '/profile',
  '/journey',
  '/feedback',
  '/setup',
  '/import',
  '/settings',
  '/pro',
  '/more',
];

test('no accessibility violations', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/welcome');
  // A light preference stored before the redesign is ignored: every screen is checked dark.
  await page.evaluate(() => localStorage.setItem('overload.theme', 'light'));
  const problems: string[] = [];
  for (const path of [...PUBLIC_PAGES]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of results.violations) {
      problems.push(`${path}: ${v.id} (${v.nodes.length}) ${v.help}`);
    }
  }
  await startWithDemo(page, { tag: 'a11y' });
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of results.violations) {
      for (const node of v.nodes.slice(0, 3)) {
        problems.push(
          `${path} ${v.id}: ${node.target.join(' ')} ${node.failureSummary?.split('\n')[1] ?? ''}`,
        );
      }
    }
  }
  expect(problems).toEqual([]);
});

test('no accessibility violations in an active workout and its sheets', async ({ page }) => {
  const scan = async (where: string) => {
    // Scan settled screens, not a frame of a sheet opening or a completion flash.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    return results.violations.map((v) => `${where} ${v.id}: ${v.nodes[0]?.target.join(' ')}`);
  };
  await startWithDemo(page, { tag: 'a11y-workout' });
  await page.goto('/workout');
  await page
    .getByRole('button', { name: /^Start Push/ })
    .first()
    .click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  await card.getByRole('button', { name: 'Mark set 1 done' }).click();
  await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible();
  const problems = await scan('workout');
  await card.getByRole('button', { name: /^Options for/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  problems.push(...(await scan('exercise menu')));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  problems.push(...(await scan('add-exercise sheet')));
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  problems.push(...(await scan('finish sheet')));
  expect(problems).toEqual([]);
});
