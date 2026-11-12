import { expect, test, type Page } from '@playwright/test';
import { expireTrial, startWithDemo } from './session';

/**
 * The adaptive plan (Pro): next week's changes in the weekly review, applied only with a yes;
 * what is coming up; something hurts from the logger; and trying a different plan.
 */

const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function addExams(page: Page) {
  await page.locator('[data-coming-up-add]').click();
  const form = page.locator('[data-coming-up-form]');
  await form.getByRole('button', { name: 'Exams' }).click();
  await expect(form).toContainText('Sessions of about 40 minutes');
  // Two weeks around today, so the planned week is covered whatever day the test runs.
  await form.getByLabel('First day').fill(day(-7));
  await form.getByLabel('Last day').fill(day(14));
  await page.locator('[data-coming-up-save]').click();
}

test('next week: exams change the plan, nothing moves until Apply, and it is remembered', async ({ page }) => {
  test.setTimeout(120_000);
  await startWithDemo(page, { tag: 'brain' });
  await page.goto('/report');
  const next = page.locator('[data-next-week]');
  await expect(next).toBeVisible({ timeout: 30_000 });
  await expect(next.getByRole('heading')).toHaveText(/^(This|Next) week$/);

  // The routine before anything is applied.
  await addExams(page);
  await expect(page.locator('[data-coming-up]')).toContainText('Exams');
  const changes = page.locator('[data-plan-changes]');
  await expect(changes).toBeVisible();
  await expect(changes).toContainText(/Exams this week/);
  await expect(changes.getByRole('link', { name: 'Why' }).first()).toHaveAttribute('href', '/science#adaptive-plan');
  await expect(changes).toContainText(/Until \d+ [A-Z][a-z]{2}/);

  // Try a different plan: the slider moves the projection.
  await page.locator('[data-what-if-open]').click();
  const whatIf = page.locator('[data-what-if]');
  await expect(whatIf.locator('[data-what-if-weight]')).toContainText(/kg a week/);
  const before = await whatIf.locator('[data-what-if-weight]').innerText();
  await whatIf.getByLabel('Calories a day').press('Home');
  await expect(whatIf.locator('[data-what-if-weight]')).not.toHaveText(before);
  await page.keyboard.press('Escape');

  await page.locator('[data-plan-apply]').click();
  const answered = page.locator('[data-plan-answered="applied"]');
  await expect(answered).toBeVisible();
  await expect(answered).toContainText(/^Applied \d+ [A-Z][a-z]{2}/);
  await expect(page.locator('[data-plan-apply]')).toHaveCount(0);

  // Coming back, the week is not asked about again.
  await page.reload();
  await expect(page.locator('[data-plan-answered="applied"]')).toBeVisible({ timeout: 30_000 });
});

test('keeping the plan changes nothing', async ({ page }) => {
  test.setTimeout(120_000);
  await startWithDemo(page, { tag: 'brain-keep' });
  await page.goto('/report');
  await expect(page.locator('[data-next-week]')).toBeVisible({ timeout: 30_000 });
  await addExams(page);
  await page.locator('[data-plan-keep]').click();
  await expect(page.locator('[data-plan-answered="kept"]')).toContainText('You kept your plan');
});

test('something hurts: a red flag stops the plan, a mild one is answered', async ({ page }) => {
  test.setTimeout(120_000);
  await startWithDemo(page, { tag: 'brain-hurts' });
  await page.goto('/workout');
  await page.getByRole('button', { name: /^Start Push/ }).first().click();
  const card = page.locator('section[aria-labelledby^="ex-"]').first();
  const open = async () => {
    await card.getByRole('button', { name: /options|More/i }).first().click();
    await page.getByRole('menuitem', { name: 'Something hurts' }).click();
  };

  await open();
  let form = page.locator('[data-hurts-form]');
  await form.getByRole('button', { name: 'Knee' }).click();
  await form.getByRole('radio', { name: /^Mild/ }).click();
  await form.getByRole('button', { name: 'Swelling' }).click();
  await page.locator('[data-hurts-save]').click();
  await expect(page.locator('[data-hurts-stop]')).toContainText('see a doctor or physiotherapist');
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await open();
  form = page.locator('[data-hurts-form]');
  await form.getByRole('button', { name: 'Shoulder' }).click();
  await form.getByRole('radio', { name: /^Mild/ }).click();
  await page.locator('[data-hurts-save]').click();
  const plan = page.locator('[data-hurts-plan]');
  await expect(plan).toBeVisible();
  await expect(plan).toContainText('For the next 2 weeks');
  await page.locator('[data-hurts-apply]').click();
  await expect(plan).toHaveCount(0);
});

test('a free member can log pain and sees what the plan would do with Pro', async ({ page }) => {
  test.setTimeout(120_000);
  const email = await startWithDemo(page, { tag: 'brain-free' });
  await expireTrial(email);
  await page.goto('/report');
  await expect(page.locator('[data-pro-lock="adaptive_plan"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-plan-apply]')).toHaveCount(0);
});
