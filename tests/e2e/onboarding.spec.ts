import { expect, test } from '@playwright/test';

/**
 * First run: the preview tour (sample data, in memory only), then setup, which builds a
 * personalised routine. Then the newer tracking screens: measurements and goals.
 */

const PASSWORD = 'correct-horse-9';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('a new account sees the tour, then setup builds a personalised plan', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/sign-up');
  await page
    .getByRole('textbox', { name: 'Email' })
    .fill(`tour-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  // The tour: clearly labelled sample data, and the logger can be tried.
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await page.getByRole('button', { name: 'Mark sample set 1 done' }).click();
  await expect(page.getByRole('button', { name: 'Set 1 done' })).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Set up my plan' }).click();

  // Setup.
  await expect(page).toHaveURL(/\/setup/);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Meera Shah');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Build muscle/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Intermediate/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: '5', exact: true }).click();
  // Session length is a scroll wheel; it starts at 60 and the arrow keys move it by 5.
  const wheel = page.getByRole('spinbutton', { name: 'Minutes per session' });
  await expect(wheel).toHaveAttribute('aria-valuenow', '60');
  await wheel.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(wheel).toHaveAttribute('aria-valuetext', '70 min');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Full gym/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Female', exact: true }).click();
  // Birth date: three number boxes, focus moves on by itself as each fills.
  await page.getByRole('textbox', { name: 'Birth date, day' }).click();
  await page.keyboard.type('14031996');
  await expect(page.getByText('14 March 1996, age')).toBeVisible();
  await page.getByLabel('Height in centimetres').fill('163');
  await page.getByLabel(/Weight/).fill('58');
  await page.getByLabel(/Weight/).blur();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Mostly sitting/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // The plan: numbers worked out from what was entered, and a recommended routine.
  await expect(page.getByText('Daily calories')).toBeVisible();
  await expect(page.getByText(/^Maintenance [\d,]+, \+10% for your goal$/)).toBeVisible();
  await expect(page.getByRole('radio', { name: /Push Pull Legs Upper Lower/ })).toBeVisible();
  await page.getByRole('button', { name: 'Create my routine' }).click();
  await expect(page).toHaveURL(/\/routines\/[\w-]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Push Pull Legs Upper Lower');

  // Home is theirs: their name, no sample lifter.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Meera');
  await expect(page.getByText(/Arjun/)).toHaveCount(0);
  await expect(page.getByText('Today in Push Pull Legs Upper Lower')).toBeVisible();
  // Days before the routine existed are not counted as missed.
  await expect(page.getByRole('listitem').filter({ hasText: 'missed' })).toHaveCount(0);
});

test('the tour can be replayed from More and skipped', async ({ page }) => {
  await page.goto('/more');
  await page.getByRole('link', { name: 'Take the tour' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('measurements and goals are saved and shown', async ({ page }) => {
  await page.goto('/body');
  await page
    .getByRole('button', { name: 'Add measurements' })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('textbox', { name: 'Waist' }).fill('81.5');
  await page.getByRole('button', { name: 'Save measurements' }).click();
  await expect(page.getByText('Measurements saved')).toBeVisible();
  await expect(page.getByText(/Waist 81\.5 cm/).first()).toBeVisible();

  await page.goto('/journey');
  await page
    .getByRole('button', { name: /^Add (a )?goal$/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('radio', { name: 'Body weight' }).click();
  await page.getByRole('textbox', { name: 'Target' }).fill('68');
  await page.getByRole('button', { name: 'Add goal' }).last().click();
  await expect(page.getByText('Goal added')).toBeVisible();
  await expect(page.getByRole('button', { name: /Weigh 68 kg/ })).toBeVisible();
});
